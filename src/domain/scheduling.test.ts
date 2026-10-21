import { describe, expect, it, vi } from "vitest";
import type { Availability, CalendarEvent, PlanBlock, Task, Workspace } from "./models";
import {
  availabilityForDate,
  dayBounds,
  instant,
  iso,
  localDate,
  minutes,
  overlaps,
} from "./intervals";
import { generateSchedule, MAX_FOCUS_MINUTES } from "./scheduling";
import { deadlineAt } from "./time";
import { Temporal } from "@js-temporal/polyfill";

const NOW = instant("2026-10-06T11:00:00Z"); // Tuesday 08:00 Santiago
const clock = { now: () => NOW };
function task(id: string, changes: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: null,
    projectId: null,
    status: "todo",
    priority: null,
    deadline: null,
    estimatedMinutes: 120,
    actualMinutes: 0,
    splittable: true,
    minimumUsefulBlockMinutes: 25,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    ...changes,
  };
}
function rule(weekday = 2, startLocal = "09:00", endLocal = "17:00", enabled = true): Availability {
  return {
    id: `${weekday}-${startLocal}`,
    weekday,
    startLocal,
    endLocal,
    enabled,
    timeZone: "America/Santiago",
  };
}
function data(tasks: Task[], changes: Partial<Workspace> = {}): Workspace {
  return {
    preferences: { theme: "system", horizonDays: 42 },
    tasks,
    projects: [],
    dependencies: [],
    timeEntries: [],
    events: [],
    availability: [rule()],
    planBlocks: [],
    revision: 10,
    planningState: null,
    ...changes,
  };
}
function event(
  id: string,
  startAt = "2026-10-06T13:00:00Z",
  endAt = "2026-10-06T14:00:00Z",
): CalendarEvent {
  return {
    id,
    title: id,
    startAt,
    endAt,
    projectId: null,
    location: null,
    notes: null,
    source: "local",
    createdAt: iso(NOW),
    updatedAt: iso(NOW),
  };
}
function block(
  id: string,
  taskId = "a",
  startAt = "2026-10-06T15:00:00.000Z",
  endAt = "2026-10-06T16:00:00.000Z",
  locked = true,
): PlanBlock {
  return {
    id,
    taskId,
    startAt,
    endAt,
    locked,
    source: "scheduler",
    createdAt: iso(NOW - 1000),
    updatedAt: iso(NOW - 1000),
  };
}
function sum(blocks: PlanBlock[]) {
  return blocks.reduce((s, b) => s + (instant(b.endAt) - instant(b.startAt)) / 60000, 0);
}
function assertValid(workspace: Workspace, blocks: PlanBlock[]) {
  for (const [i, b] of blocks.entries()) {
    const span = { start: instant(b.startAt), end: instant(b.endAt) };
    expect((span.end - span.start) / 60000).toBeLessThanOrEqual(MAX_FOCUS_MINUTES);
    expect(
      workspace.events.every(
        (e) => !overlaps(span, { start: instant(e.startAt), end: instant(e.endAt) }),
      ),
    ).toBe(true);
    expect(
      blocks
        .slice(i + 1)
        .every(
          (other) => !overlaps(span, { start: instant(other.startAt), end: instant(other.endAt) }),
        ),
    ).toBe(true);
    expect(
      availabilityForDate(localDate(span.start), workspace.availability).some(
        (w) => w.start <= span.start && w.end >= span.end,
      ),
    ).toBe(true);
  }
}

describe("deterministic scheduling", () => {
  it("schedules around multiple fixed events and availability boundaries", () => {
    const workspace = data([task("a", { estimatedMinutes: 240 })], {
      events: [event("meeting"), event("class", "2026-10-06T16:00:00Z", "2026-10-06T17:00:00Z")],
    });
    const result = generateSchedule(workspace, clock, 1);
    expect(sum(result.blocks)).toBe(240);
    expect(result.blocks[0].startAt).toBe("2026-10-06T12:00:00.000Z");
    assertValid(workspace, result.blocks);
  });
  it("fills a long slot with separate focus blocks and avoids a tiny tail", () => {
    const workspace = data([task("a", { estimatedMinutes: 280 })]);
    const result = generateSchedule(workspace, clock, 1);
    expect(result.blocks.map((b) => sum([b]))).toEqual([90, 90, 75, 25]);
    assertValid(workspace, result.blocks);
  });
  it("skips gaps smaller than the useful minimum", () => {
    const workspace = data([task("a", { estimatedMinutes: 60 })], {
      events: [event("e", "2026-10-06T12:15:00Z", "2026-10-06T13:00:00Z")],
    });
    expect(generateSchedule(workspace, clock, 1).blocks[0].startAt).toBe(
      "2026-10-06T13:00:00.000Z",
    );
  });
  it("allows a complete small task smaller than its minimum block", () => {
    expect(
      sum(generateSchedule(data([task("a", { estimatedMinutes: 10 })]), clock, 1).blocks),
    ).toBe(10);
  });
  it("preserves truth when an unsplittable task exceeds the focus limit", () => {
    const result = generateSchedule(
      data([task("a", { splittable: false, estimatedMinutes: 120 })]),
      clock,
      1,
    );
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "unsplittable")).toBe(true);
  });
  it("requires a single fitting slot for an unsplittable task", () => {
    const workspace = data([task("a", { splittable: false, estimatedMinutes: 60 })], {
      events: [event("gap", "2026-10-06T12:30:00Z", "2026-10-06T13:00:00Z")],
    });
    const result = generateSchedule(workspace, clock, 1);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].startAt).toBe("2026-10-06T13:00:00.000Z");
  });
  it("schedules across several days and supports different daily windows", () => {
    const workspace = data([task("a", { estimatedMinutes: 180 })], {
      availability: [rule(2, "09:00", "10:00"), rule(3, "14:00", "16:00")],
    });
    const result = generateSchedule(workspace, clock, 2);
    expect(sum(result.blocks)).toBe(180);
    expect(result.blocks.map((b) => localDate(instant(b.startAt)).toString())).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-07",
    ]);
    assertValid(workspace, result.blocks);
  });
  it("clips today at the explicit current time", () => {
    const now = instant("2026-10-06T13:15:00.000Z");
    expect(generateSchedule(data([task("a")]), { now: () => now }, 1).blocks[0].startAt).toBe(
      iso(now),
    );
  });
  it("schedules deadline tasks before no-deadline tasks even with manual priority", () => {
    const workspace = data([
      task("free", { priority: "high" }),
      task("due", { deadline: { kind: "instant", value: "2026-10-06T14:00:00Z" } }),
    ]);
    const result = generateSchedule(workspace, clock, 1);
    expect(result.blocks[0].taskId).toBe("due");
    expect(
      result.blocks
        .filter((b) => b.taskId === "due")
        .every((b) => instant(b.endAt) <= instant("2026-10-06T14:00:00Z")),
    ).toBe(true);
    expect(result.blocks.some((b) => b.taskId === "free")).toBe(true);
  });
  it("never generates work after an expired deadline", () => {
    const result = generateSchedule(
      data([task("a", { deadline: { kind: "date", value: "2026-10-05" } })]),
      clock,
      1,
    );
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "unscheduled_work")).toBe(true);
  });
  it("excludes blocked, paused-project, active, and unfinished-prerequisite tasks", () => {
    const workspace = data(
      [
        task("blocked", { status: "blocked" }),
        task("project", { projectId: "p" }),
        task("dependent"),
        task("parent"),
        task("active", { status: "in_progress" }),
      ],
      {
        projects: [
          {
            id: "p",
            name: "p",
            color: "#6d8c80",
            description: null,
            status: "paused",
            createdAt: iso(NOW),
            updatedAt: iso(NOW),
            archivedAt: null,
          },
        ],
        dependencies: [{ taskId: "dependent", dependsOnTaskId: "parent" }],
      },
    );
    const result = generateSchedule(workspace, clock, 1);
    expect([...new Set(result.blocks.map((b) => b.taskId))]).toEqual(["parent"]);
    workspace.tasks.find((t) => t.id === "parent")!.status = "done";
    expect(generateSchedule(workspace, clock, 1).blocks.some((b) => b.taskId === "dependent")).toBe(
      true,
    );
  });
  it("preserves past and locked blocks exactly and replaces unlocked future blocks", () => {
    const past = block("past", "a", "2026-10-05T12:00:00.000Z", "2026-10-05T13:00:00.000Z", false);
    const locked = block("locked");
    const old = block("old", "a", "2026-10-06T17:00:00.000Z", "2026-10-06T18:00:00.000Z", false);
    const workspace = data([task("a", { estimatedMinutes: 120 })], {
      planBlocks: [past, locked, old],
    });
    const result = generateSchedule(workspace, clock, 1);
    expect(result.blocks.find((b) => b.id === "past")).toEqual(past);
    expect(result.blocks.find((b) => b.id === "locked")).toEqual(locked);
    expect(result.blocks.some((b) => b.id === "old")).toBe(false);
    expect(sum(result.blocks.filter((b) => b.id !== "past"))).toBe(120);
  });
  it("reports locked conflicts rather than moving the reservation", () => {
    const locked = block("locked");
    const result = generateSchedule(
      data([task("a")], {
        planBlocks: [locked],
        events: [event("collision", locked.startAt, locked.endAt)],
      }),
      clock,
      1,
    );
    expect(result.blocks.find((b) => b.id === "locked")).toEqual(locked);
    expect(result.warnings.some((w) => w.code === "preserved_conflict")).toBe(true);
  });
  it("deducts recorded work and future reservations, but not missed past proposals", () => {
    const workspace = data([task("a", { estimatedMinutes: 180, actualMinutes: 60 })], {
      planBlocks: [
        block("past", "a", "2026-10-05T12:00:00.000Z", "2026-10-05T13:00:00.000Z", false),
        block("locked"),
      ],
    });
    const result = generateSchedule(workspace, clock, 1);
    expect(sum(result.blocks.filter((b) => !b.locked && instant(b.startAt) > NOW))).toBe(60);
    expect(workspace.tasks[0].estimatedMinutes).toBe(180);
  });
  it("does not schedule exhausted estimates or count planned work as actual", () => {
    const workspace = data([task("a", { actualMinutes: 120 })]);
    expect(generateSchedule(workspace, clock, 1).blocks).toHaveLength(0);
    expect(workspace.tasks[0].actualMinutes).toBe(120);
  });
  it("exposes 9 hours of work against 5 hours of usable capacity", () => {
    const workspace = data(
      [task("a", { estimatedMinutes: 540, deadline: { kind: "date", value: "2026-10-06" } })],
      { availability: [rule(2, "09:00", "15:00")], events: [event("e")] },
    );
    const result = generateSchedule(workspace, clock, 1);
    const warning = result.warnings.find((w) => w.code === "deadline_capacity")!;
    expect(warning.requiredMinutes).toBe(540);
    expect(warning.capacityMinutes).toBe(300);
    expect(sum(result.blocks)).toBe(300);
    expect(result.warnings.find((w) => w.code === "unscheduled_work")?.requiredMinutes).toBe(540);
  });
  it("has zero capacity until availability is explicitly configured", () => {
    const result = generateSchedule(data([task("a")], { availability: [] }), clock, 1);
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === "horizon_capacity")).toBe(true);
  });
  it("is deterministic, reads its clock once, and does not mutate inputs", () => {
    const workspace = data([task("b"), task("a")]);
    const copy = structuredClone(workspace);
    const read = vi.fn(() => NOW);
    const first = generateSchedule(workspace, { now: read }, 1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(first).toEqual(
      generateSchedule({ ...workspace, tasks: [...workspace.tasks].reverse() }, clock, 1),
    );
    expect(workspace).toEqual(copy);
    const replanned = generateSchedule({ ...workspace, planBlocks: first.blocks }, clock, 1);
    expect(replanned.blocks).toEqual(first.blocks);
  });
  it("uses an explicit, disclosed assumption for missing estimates", () => {
    const result = generateSchedule(data([task("a", { estimatedMinutes: null })]), clock, 1);
    expect(sum(result.blocks)).toBe(30);
    expect(result.warnings.some((w) => w.code === "missing_estimate")).toBe(true);
  });
  it("keeps ongoing blocks and credits only their future portion", () => {
    const ongoing = block(
      "ongoing",
      "a",
      "2026-10-06T10:30:00.000Z",
      "2026-10-06T11:30:00.000Z",
      false,
    );
    const result = generateSchedule(
      data([task("a", { estimatedMinutes: 120, actualMinutes: 30 })], { planBlocks: [ongoing] }),
      clock,
      1,
    );
    expect(result.blocks.find((b) => b.id === "ongoing")).toEqual(ongoing);
    expect(sum(result.blocks.filter((b) => b.id !== "ongoing"))).toBe(60);
  });
});

describe("Santiago DST availability", () => {
  it("does not fabricate skipped local minutes during spring forward", () => {
    const day = Temporal.PlainDate.from("2026-09-06");
    expect(minutes(availabilityForDate(day, [rule(7, "00:00", "02:00")]))).toBe(60);
    expect(minutes(availabilityForDate(day, [rule(7, "00:00", "00:45")]))).toBe(0);
    const now = dayBounds(day).start;
    const workspace = data([task("a", { estimatedMinutes: 120 })], {
      availability: [rule(7, "00:00", "02:00")],
    });
    const result = generateSchedule(workspace, { now: () => now }, 1);
    expect(sum(result.blocks)).toBe(60);
    assertValid(workspace, result.blocks);
  });
  it("includes both repeated partial windows, excluding the unavailable gap", () => {
    const date = Temporal.PlainDate.from("2026-04-04");
    const windows = availabilityForDate(date, [rule(6, "23:00", "23:45")]);
    expect(windows.map((w) => (w.end - w.start) / 60000)).toEqual([45, 45]);
    expect(windows[1].start - windows[0].end).toBe(15 * 60000);
    const workspace = data([task("a", { estimatedMinutes: 90 })], {
      availability: [rule(6, "23:00", "23:45")],
    });
    const result = generateSchedule(workspace, { now: () => dayBounds(date).start }, 1);
    expect(result.blocks).toHaveLength(2);
    expect(sum(result.blocks)).toBe(90);
    assertValid(workspace, result.blocks);
    expect(
      result.blocks.every(
        (b) => instant(b.endAt) <= deadlineAt({ kind: "date", value: "2026-04-04" }),
      ),
    ).toBe(true);
  });
});
