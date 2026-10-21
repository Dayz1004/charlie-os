import { describe, expect, it, vi } from "vitest";
import type { Project, Task, TimeEntry, Workspace } from "./models";
import { isEligible, planWorkspace } from "./planning";
import { assessTask } from "./priority";

const NOW = Date.parse("2026-10-06T15:00:00Z");
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
    estimatedMinutes: 60,
    splittable: true,
    minimumUsefulBlockMinutes: 25,
    actualMinutes: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    ...changes,
  };
}
function workspace(tasks: Task[], changes: Partial<Workspace> = {}): Workspace {
  return {
    preferences: { theme: "system", horizonDays: 42 },
    tasks,
    projects: [],
    dependencies: [],
    timeEntries: [],
    events: [],
    availability: [],
    planBlocks: [],
    revision: 0,
    planningState: null,
    ...changes,
  };
}
function dueIn(minutes: number): Task["deadline"] {
  return { kind: "instant", value: new Date(NOW + minutes * 60000).toISOString() };
}

describe("deterministic planning", () => {
  it("recommends tasks without deadlines, with or without an estimate", () => {
    const plan = planWorkspace(workspace([task("no-deadline", { estimatedMinutes: null })]), clock);
    expect(plan.next?.task.id).toBe("no-deadline");
    expect(plan.next?.risk).toBe("low");
    expect(plan.next?.remainingMinutes).toBe(30);
    expect(plan.next?.reason).toContain("assumes 30 minutes");
  });
  it("excludes blocked, completed, cancelled, and active tasks", () => {
    const data = workspace([
      task("blocked", { status: "blocked", deadline: dueIn(-1) }),
      task("done", { status: "done" }),
      task("cancelled", { status: "cancelled" }),
      task("active", { status: "in_progress" }),
      task("open"),
    ]);
    expect(planWorkspace(data, clock).candidates.map((c) => c.task.id)).toEqual(["open"]);
    expect(planWorkspace(data, clock).attention[0]?.task.id).toBe("blocked");
  });
  it("requires every prerequisite to be done, including cancelled prerequisites", () => {
    const child = task("child");
    const parent = task("parent", { status: "cancelled" });
    const data = workspace([child, parent], {
      dependencies: [{ taskId: "child", dependsOnTaskId: "parent" }],
    });
    expect(isEligible(child, data)).toBe(false);
    parent.status = "done";
    expect(isEligible(child, data)).toBe(true);
    data.dependencies.push({ taskId: "child", dependsOnTaskId: "missing" });
    expect(isEligible(child, data)).toBe(false);
  });
  it.each(["paused", "completed", "archived"] as const)(
    "excludes tasks from %s projects",
    (status) => {
      const project: Project = {
        id: "p",
        name: "p",
        color: "#6d8c80",
        description: null,
        status,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
        archivedAt: null,
      };
      expect(
        planWorkspace(workspace([task("t", { projectId: "p" })], { projects: [project] }), clock)
          .next,
      ).toBeNull();
    },
  );
  it("uses manual priority, then deadline, creation time, and ID for stable ties", () => {
    const tasks = [
      task("b"),
      task("a"),
      task("old", { createdAt: "2026-09-30T00:00:00Z" }),
      task("due", { deadline: dueIn(10000) }),
      task("high", { priority: "high" }),
    ];
    const first = planWorkspace(workspace(tasks), clock);
    const second = planWorkspace(workspace([...tasks].reverse()), clock);
    expect(first.candidates.map((c) => c.task.id)).toEqual(["high", "due", "old", "a", "b"]);
    expect(first).toEqual(second);
  });
  it("reads the injected clock once and produces identical plans with a fixed clock", () => {
    const read = vi.fn(() => NOW);
    const data = workspace([task("test", { deadline: dueIn(30) })]);
    expect(planWorkspace(data, { now: read })).toEqual(planWorkspace(data, clock));
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("keeps one active task visible and suppresses a new recommendation", () => {
    const entry: TimeEntry = {
      id: "e",
      taskId: "active",
      startedAt: "2026-10-06T14:45:00Z",
      endedAt: null,
      durationMinutes: null,
      createdAt: "2026-10-06T14:45:00Z",
    };
    const data = workspace([task("active", { status: "in_progress" }), task("next")], {
      timeEntries: [entry],
    });
    const plan = planWorkspace(data, clock);
    expect(plan.active?.task.id).toBe("active");
    expect(plan.next).toBeNull();
    data.tasks[0].status = "done";
    entry.endedAt = "2026-10-06T15:00:00Z";
    entry.durationMinutes = 15;
    expect(planWorkspace(data, clock).next?.task.id).toBe("next");
  });
});

describe("priority and deadline risk", () => {
  it.each([
    [10000, "low"],
    [4320, "medium"],
    [1440, "high"],
    [60, "critical"],
    [0, "critical"],
    [-1, "critical"],
  ] as const)("classifies a 60-minute task due in %s minutes as %s", (minutes, risk) => {
    expect(assessTask(task("t", { deadline: dueIn(minutes) }), NOW).risk).toBe(risk);
  });
  it("increases risk for larger remaining work, even several days out", () => {
    expect(assessTask(task("small", { deadline: dueIn(6000) }), NOW).risk).toBe("low");
    expect(
      assessTask(task("large", { estimatedMinutes: 4000, deadline: dueIn(6000) }), NOW).risk,
    ).toBe("high");
  });
  it("prioritizes deadline risk ahead of manual priority", () => {
    const data = workspace([
      task("manual", { priority: "high" }),
      task("urgent", { priority: "low", deadline: dueIn(10) }),
    ]);
    expect(planWorkspace(data, clock).next?.task.id).toBe("urgent");
  });
  it("subtracts recorded work and preserves a minimum remaining minute", () => {
    expect(assessTask(task("t", { actualMinutes: 45 }), NOW).remainingMinutes).toBe(15);
    expect(assessTask(task("t", { actualMinutes: 100 }), NOW).remainingMinutes).toBe(1);
  });
  it("includes active work in risk assessments without persisting it prematurely", () => {
    const entry: TimeEntry = {
      id: "e",
      taskId: "t",
      startedAt: "2026-10-06T14:45:00Z",
      endedAt: null,
      durationMinutes: null,
      createdAt: "2026-10-06T14:45:00Z",
    };
    expect(assessTask(task("t", { actualMinutes: 5 }), NOW, entry).remainingMinutes).toBe(40);
  });
});
