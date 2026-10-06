import type { Task, TimeEntry, Workspace } from "./models";
import { assessTask, type Assessment } from "./priority";
import type { Clock } from "./time";

export interface Candidate extends Assessment {
  task: Task;
}
export interface Plan {
  generatedAt: number;
  candidates: Candidate[];
  next: Candidate | null;
  active: { task: Task; entry: TimeEntry } | null;
  attention: Candidate[];
}

export function isEligible(task: Task, workspace: Workspace): boolean {
  if (task.status !== "todo" && task.status !== "inbox") return false;
  if (
    task.projectId &&
    workspace.projects.find((p) => p.id === task.projectId)?.status !== "active"
  )
    return false;
  return workspace.dependencies
    .filter((d) => d.taskId === task.id)
    .every((d) => workspace.tasks.find((t) => t.id === d.dependsOnTaskId)?.status === "done");
}

export function planWorkspace(workspace: Workspace, clock: Clock): Plan {
  const now = clock.now(); // Exactly one clock read per plan.
  const entry = workspace.timeEntries.find((e) => e.endedAt === null);
  const activeTask = entry && workspace.tasks.find((t) => t.id === entry.taskId);
  const active = entry && activeTask ? { task: activeTask, entry } : null;
  const candidates = workspace.tasks
    .filter((t) => isEligible(t, workspace))
    .map((task) => ({ task, ...assessTask(task, now) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.deadlineAt ?? Infinity) - (b.deadlineAt ?? Infinity) ||
        a.task.createdAt.localeCompare(b.task.createdAt) ||
        a.task.id.localeCompare(b.task.id),
    );
  const attention = workspace.tasks
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .map((task) => ({
      task,
      ...assessTask(task, now, task.id === active?.task.id ? active.entry : undefined),
    }))
    .filter((t) => t.risk === "high" || t.risk === "critical")
    .sort((a, b) => b.score - a.score || a.task.id.localeCompare(b.task.id));
  return {
    generatedAt: now,
    candidates,
    next: active ? null : (candidates[0] ?? null),
    active,
    attention,
  };
}
