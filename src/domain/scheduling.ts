import type { PlanBlock, PlanningWarning, ScheduleInput, Task, Workspace } from "./models";
import { isEligible, planWorkspace } from "./planning";
import { deadlineAt, entryMinutes, type Clock } from "./time";
import {
  availabilityForDate,
  dayBounds,
  instant,
  iso,
  localDate,
  mergeIntervals,
  minutes,
  overlaps,
  subtractIntervals,
  type Interval,
} from "./intervals";

export const MAX_FOCUS_MINUTES = 90;
export const HORIZON_DAYS = 42;
const interval = (b: { startAt: string; endAt: string }): Interval => ({
  start: instant(b.startAt),
  end: instant(b.endAt),
});
export interface DayLoad {
  date: string;
  capacityMinutes: number;
  plannedMinutes: number;
  freeMinutes: number;
}
export interface Schedule extends ScheduleInput {
  days: DayLoad[];
}

export function dayLoad(workspace: Workspace, date: ReturnType<typeof localDate>): DayLoad {
  const bounds = dayBounds(date);
  const capacity = subtractIntervals(
    availabilityForDate(date, workspace.availability),
    workspace.events.map(interval),
  );
  const planned = workspace.planBlocks
    .map(interval)
    .map((b) => ({ start: Math.max(bounds.start, b.start), end: Math.min(bounds.end, b.end) }))
    .filter((b) => b.start < b.end);
  const plannedMinutes = minutes(planned);
  return {
    date: date.toString(),
    capacityMinutes: minutes(capacity),
    plannedMinutes,
    freeMinutes: Math.max(0, minutes(capacity) - plannedMinutes),
  };
}

export function generateSchedule(
  workspace: Workspace,
  clock: Clock,
  horizonDays = HORIZON_DAYS,
): Schedule {
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 90)
    throw new Error("Planning horizon must be 1–90 days.");
  const now = clock.now();
  const today = localDate(now);
  const end = dayBounds(today.add({ days: horizonDays })).start;
  const plannedAt = iso(now);
  const warnings: PlanningWarning[] = [];
  const warn = (
    code: string,
    message: string,
    taskId: string | null = null,
    at: number | null = null,
    requiredMinutes: number | null = null,
    capacityMinutes: number | null = null,
  ) =>
    warnings.push({
      code,
      message,
      taskId,
      at: at === null ? null : iso(at),
      requiredMinutes,
      capacityMinutes,
    });
  const events = workspace.events.map(interval);
  const preserved = workspace.planBlocks.filter((b) => b.locked || instant(b.startAt) <= now);
  const windows: Interval[] = [];
  for (let day = 0; day < horizonDays; day++)
    windows.push(...availabilityForDate(today.add({ days: day }), workspace.availability));
  const usable = subtractIntervals(
    windows.map((w) => ({ start: Math.max(now, w.start), end: Math.min(end, w.end) })),
    events,
  );
  let free = subtractIntervals(usable, preserved.map(interval));
  const initialFree = [...free];
  for (const block of preserved.filter((b) => instant(b.endAt) > now)) {
    const span = { start: Math.max(now, instant(block.startAt)), end: instant(block.endAt) };
    if (
      events.some((e) => overlaps(span, e)) ||
      preserved.some((b) => b.id !== block.id && overlaps(span, interval(b)))
    )
      warn(
        "preserved_conflict",
        "A preserved block conflicts with an event or another preserved block. Unlock a future block or edit the commitment.",
        block.taskId,
        span.start,
      );
    // Inspect the complete reservation, including locked blocks beyond this horizon.
    const fullWindows: Interval[] = [];
    for (let d = localDate(span.start); dayBounds(d).start < span.end; d = d.add({ days: 1 }))
      fullWindows.push(...availabilityForDate(d, workspace.availability));
    if (subtractIntervals([span], fullWindows).length > 0)
      warn(
        "preserved_unavailable",
        "A preserved block is outside configured availability.",
        block.taskId,
        span.start,
      );
    const task = workspace.tasks.find((t) => t.id === block.taskId);
    if (
      task &&
      (task.status === "done" ||
        task.status === "cancelled" ||
        (!isEligible(task, workspace) && task.status !== "in_progress"))
    )
      warn(
        "preserved_ineligible",
        "A preserved block belongs to a completed, cancelled, or unavailable task.",
        task.id,
        span.start,
      );
    if (task?.deadline && span.end > deadlineAt(task.deadline))
      warn("preserved_late", "A preserved block ends after its task deadline.", task.id, span.end);
  }
  const activeEntry = workspace.timeEntries.find((e) => e.endedAt === null);
  const candidates = planWorkspace(workspace, { now: () => now }).candidates.sort(
    (a, b) =>
      (a.deadlineAt ?? Infinity) - (b.deadlineAt ?? Infinity) ||
      b.score - a.score ||
      a.task.createdAt.localeCompare(b.task.createdAt) ||
      a.task.id.localeCompare(b.task.id),
  );
  const remaining = new Map<string, number>();
  for (const { task } of candidates) {
    const recorded =
      task.actualMinutes + (activeEntry?.taskId === task.id ? entryMinutes(activeEntry, now) : 0);
    const due = task.deadline ? deadlineAt(task.deadline) : Infinity;
    const reserved = minutes(
      mergeIntervals(
        preserved
          .filter((b) => b.taskId === task.id)
          .map(interval)
          .map((b) => ({ start: Math.max(now, b.start), end: Math.min(due, b.end) })),
      ),
    );
    remaining.set(task.id, Math.max(0, (task.estimatedMinutes ?? 30) - recorded - reserved));
    if (task.estimatedMinutes === null)
      warn("missing_estimate", "No estimate: this task is scheduled assuming 30 minutes.", task.id);
  }
  for (const task of workspace.tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled" && !isEligible(t, workspace),
  )) {
    if (task.status !== "in_progress")
      warn(
        "ineligible",
        "Work is not scheduled until this task is unblocked, its project is active, and prerequisites are completed.",
        task.id,
      );
    else
      warn(
        "active_task",
        "The running task is excluded from new work blocks. Stop it, then replan using the recorded time.",
        task.id,
      );
  }
  const cutoffs = [
    ...new Set(
      candidates
        .filter((c) => c.task.deadline)
        .map((c) => Math.min(end, deadlineAt(c.task.deadline!))),
    ),
  ].sort((a, b) => a - b);
  for (const cutoff of cutoffs) {
    const demand = candidates
      .filter((c) => c.task.deadline && deadlineAt(c.task.deadline) <= cutoff)
      .reduce((sum, c) => sum + remaining.get(c.task.id)!, 0);
    const capacity = minutes(
      initialFree
        .map((s) => ({ start: s.start, end: Math.min(s.end, cutoff) }))
        .filter((s) => s.start < s.end),
    );
    if (demand > capacity + 1e-6)
      warn(
        "deadline_capacity",
        `${Math.ceil(demand)} minutes of work are required before this deadline, with only ${Math.floor(capacity)} usable minutes.`,
        null,
        cutoff,
        demand,
        capacity,
      );
  }
  const total = [...remaining.values()].reduce((a, b) => a + b, 0);
  if (total > minutes(initialFree) + 1e-6)
    warn(
      "horizon_capacity",
      "Required work exceeds usable capacity in the planning horizon.",
      null,
      end,
      total,
      minutes(initialFree),
    );
  const generated: PlanBlock[] = [];
  for (const { task } of candidates) {
    const required = remaining.get(task.id)!;
    let left = Math.ceil(required * 60000);
    const due = Math.min(end, task.deadline ? deadlineAt(task.deadline) : end);
    if (!task.splittable && left > MAX_FOCUS_MINUTES * 60000) {
      warn(
        "unsplittable",
        "This unsplittable task exceeds the 90-minute focus limit. Enable splitting or revise its estimate.",
        task.id,
      );
    } else {
      while (left > 0) {
        let chosen: { slot: Interval; size: number } | null = null;
        for (const slot of free) {
          const available = Math.min(slot.end, due) - slot.start;
          if (available <= 0) continue;
          let size = task.splittable ? Math.min(left, available, MAX_FOCUS_MINUTES * 60000) : left;
          const min = task.minimumUsefulBlockMinutes * 60000;
          // Avoid a tiny tail when there is enough room to leave a useful final block.
          if (left > size && left - size < min && left > min && size - (min - (left - size)) >= min)
            size = left - min;
          if (size > available || (size < min && size < left)) continue;
          chosen = { slot, size };
          break;
        }
        if (!chosen) break;
        const { slot, size } = chosen;
        const blockEnd = slot.start + size;
        generated.push({
          id: `plan-${task.id}-${slot.start}-${blockEnd}`,
          taskId: task.id,
          startAt: iso(slot.start),
          endAt: iso(blockEnd),
          locked: false,
          source: "scheduler",
          createdAt: plannedAt,
          updatedAt: plannedAt,
        });
        free = subtractIntervals(free, [{ start: slot.start, end: blockEnd }]);
        left -= size;
      }
    }
    if (left > 0)
      warn(
        "unscheduled_work",
        `${Math.ceil(left / 60000)} minutes remain unscheduled before the deadline or horizon. Capacity, minimum blocks, or splitting constraints prevent a complete plan.`,
        task.id,
        due,
        required,
        required - left / 60000,
      );
  }
  const blocks = [...preserved, ...generated].sort(
    (a, b) => instant(a.startAt) - instant(b.startAt) || a.id.localeCompare(b.id),
  );
  const resultWorkspace = { ...workspace, planBlocks: blocks };
  const days = Array.from({ length: horizonDays }, (_, i) =>
    dayLoad(resultWorkspace, today.add({ days: i })),
  );
  return {
    expectedRevision: workspace.revision,
    plannedAt,
    horizonEnd: iso(end),
    blocks,
    warnings,
    days,
  };
}

export function scheduledNext(workspace: Workspace, now: number): Task | null {
  const block = workspace.planBlocks
    .filter((b) => {
      const task = workspace.tasks.find((t) => t.id === b.taskId);
      return instant(b.endAt) > now && !!task && isEligible(task, workspace);
    })
    .sort((a, b) => instant(a.startAt) - instant(b.startAt) || a.id.localeCompare(b.id))[0];
  return block ? (workspace.tasks.find((t) => t.id === block.taskId) ?? null) : null;
}
