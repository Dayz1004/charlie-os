import { describe, expect, it } from "vitest";
import type { CalendarEvent, PlanningWarning, Task, Workspace } from "../domain/models";
import { formatMinutes } from "../domain/time";
import {
  agendaItems,
  dayDeadlines,
  deadlineHint,
  planningSummary,
  remainingDayCapacity,
  timelineItems,
  warningDate,
} from "./workspace";

const now = Date.parse("2026-10-13T15:00:00Z"); // noon in Santiago
const workspace = (): Workspace => ({
  preferences: { theme: "system", horizonDays: 42 },
  tasks: [],
  projects: [],
  dependencies: [],
  timeEntries: [],
  events: [],
  availability: [
    {
      id: "a",
      weekday: 2,
      startLocal: "09:00",
      endLocal: "17:00",
      enabled: true,
      timeZone: "America/Santiago",
    },
  ],
  planBlocks: [],
  revision: 0,
  planningState: null,
});
const event = (id: string, startAt: string, endAt: string): CalendarEvent => ({
  id,
  title: id,
  startAt,
  endAt,
  projectId: null,
  location: null,
  notes: null,
  source: "local",
  createdAt: startAt,
  updatedAt: startAt,
});
const task = (deadline: Task["deadline"]): Task => ({
  id: "t",
  title: "Compiladores",
  description: null,
  projectId: null,
  status: "todo",
  priority: null,
  deadline,
  estimatedMinutes: 240,
  actualMinutes: 0,
  splittable: true,
  minimumUsefulBlockMinutes: 25,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  completedAt: null,
});
const warning = (changes: Partial<PlanningWarning> = {}): PlanningWarning => ({
  code: "deadline_capacity",
  taskId: null,
  at: "2026-10-16T03:00:00Z",
  requiredMinutes: 240,
  capacityMinutes: 150,
  message: "Internal diagnostic",
  ...changes,
});
describe("Spanish planning presentation", () => {
  it("formats durations across hour boundaries without 60-minute tails", () => {
    expect([0, 0.5, 25, 59.6, 60, 90, 150].map(formatMinutes)).toEqual([
      "0 min",
      "<1 min",
      "25 min",
      "1 h",
      "1 h",
      "1 h 30 min",
      "2 h 30 min",
    ]);
  });
  it("describes capacity and unscheduled work with the correct quantities", () => {
    const w = workspace();
    w.tasks = [task(null)];
    expect(planningSummary(warning(), w)).toContain("4 h y quedan 2 h 30 min");
    expect(planningSummary(warning({ code: "unscheduled_work", taskId: "t" }), w)).toContain(
      "Compiladores: faltan 1 h 30 min por ubicar",
    );
    expect(planningSummary(warning({ code: "missing_estimate", taskId: "t" }), w)).toContain(
      "usamos 30 min",
    );
  });
  it("assigns deadline cutoffs to the preceding day but conflicts to their own day", () => {
    expect(warningDate(warning())).toBe("2026-10-15");
    expect(warningDate(warning({ code: "preserved_conflict" }))).toBe("2026-10-16");
  });
  it("keeps date-only deadlines on their date and excludes finished work", () => {
    const w = workspace();
    w.tasks = [task({ kind: "date", value: "2026-10-13" })];
    expect(dayDeadlines(w, "2026-10-13")).toHaveLength(1);
    expect(deadlineHint(w, "t", now)).toBe("Vence hoy");
    expect(deadlineHint(w, "t", Date.parse("2026-10-14T03:00:00Z"))).toBe("Fecha límite vencida");
    w.tasks[0].status = "done";
    expect(dayDeadlines(w, "2026-10-13")).toHaveLength(0);
  });
});
describe("remaining capacity and visual schedule", () => {
  it("ignores elapsed availability and subtracts overlapping commitments only once", () => {
    const w = workspace();
    w.events = [
      event("one", "2026-10-13T16:00:00Z", "2026-10-13T17:00:00Z"),
      event("two", "2026-10-13T16:30:00Z", "2026-10-13T17:30:00Z"),
    ];
    w.planBlocks = [
      {
        id: "b",
        taskId: "t",
        startAt: "2026-10-13T18:00:00Z",
        endAt: "2026-10-13T19:00:00Z",
        locked: true,
        source: "scheduler",
        createdAt: "2026-10-13T15:00:00Z",
        updatedAt: "2026-10-13T15:00:00Z",
      },
    ];
    expect(remainingDayCapacity(w, now)).toBe(150);
    expect(remainingDayCapacity(w, Date.parse("2026-10-13T21:00:00Z"))).toBe(0);
    w.availability[0].enabled = false;
    expect(remainingDayCapacity(w, now)).toBe(0);
  });
  it("gives concurrent events separate lanes and reuses them after the group ends", () => {
    const w = workspace();
    w.events = [
      event("a", "2026-10-13T12:00:00Z", "2026-10-13T13:00:00Z"),
      event("b", "2026-10-13T12:30:00Z", "2026-10-13T14:00:00Z"),
      event("c", "2026-10-13T14:00:00Z", "2026-10-13T15:00:00Z"),
    ];
    const result = timelineItems(w, "2026-10-13");
    expect(result.map((i) => [i.lane, i.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
    expect(result[0].top).toBe(540);
  });
  it("clips multi-day events and retains elapsed duration in Santiago repeated hours", () => {
    const w = workspace();
    w.events = [event("DST", "2026-04-05T02:30:00Z", "2026-04-05T03:30:00Z")];
    const result = timelineItems(w, "2026-04-04");
    expect(result[0].bottom - result[0].top).toBe(60);
    w.events.push(event("repeated", "2026-04-05T03:30:00Z", "2026-04-05T04:00:00Z"));
    const repeated = timelineItems(w, "2026-04-04");
    expect(repeated[1].top).toBe(repeated[0].bottom);
    expect(repeated.map((i) => i.lanes)).toEqual([1, 1]);
    expect(agendaItems(w, "2026-04-05")).toHaveLength(0);
    w.events = [event("midnight", "2026-10-13T02:30:00Z", "2026-10-13T04:00:00Z")];
    expect(timelineItems(w, "2026-10-13")[0].top).toBe(0);
    expect(timelineItems(w, "2026-10-13")[0].bottom).toBe(60);
  });
  it("keeps adjacent blocks with second precision in one lane", () => {
    const w = workspace();
    w.events = [
      event("a", "2026-10-13T12:07:45.123Z", "2026-10-13T13:07:45.123Z"),
      event("b", "2026-10-13T13:07:45.123Z", "2026-10-13T13:32:45.123Z"),
    ];
    expect(timelineItems(w, "2026-10-13").map((i) => i.lanes)).toEqual([1, 1]);
  });
});
