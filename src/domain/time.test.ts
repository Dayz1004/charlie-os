import { describe, expect, it } from "vitest";
import type { TimeEntry } from "./models";
import {
  dayGreeting,
  deadlineAt,
  entryMinutes,
  formatDeadline,
  instantToLocalInput,
  localDeadlineToInstant,
} from "./time";

describe("Santiago dates and timestamps", () => {
  it("ends date-only deadlines at the next Santiago day, not UTC midnight", () => {
    expect(deadlineAt({ kind: "date", value: "2026-10-06" })).toBe(
      Date.parse("2026-10-07T03:00:00Z"),
    );
    expect(deadlineAt({ kind: "date", value: "2026-07-06" })).toBe(
      Date.parse("2026-07-07T04:00:00Z"),
    );
  });
  it("handles Chile's shortened DST day and missing midnight", () => {
    const before = deadlineAt({ kind: "date", value: "2026-09-05" });
    const after = deadlineAt({ kind: "date", value: "2026-09-06" });
    expect(before).toBe(Date.parse("2026-09-06T04:00:00Z"));
    expect((after - before) / 3600000).toBe(23);
  });
  it("handles the 25-hour DST fall-back day", () => {
    expect(
      (deadlineAt({ kind: "date", value: "2026-04-04" }) -
        deadlineAt({ kind: "date", value: "2026-04-03" })) /
        3600000,
    ).toBe(25);
  });
  it("respects absolute offsets and preserves millisecond precision in editor round trips", () => {
    expect(deadlineAt({ kind: "instant", value: "2026-10-06T12:00:00-03:00" })).toBe(
      Date.parse("2026-10-06T15:00:00Z"),
    );
    const instant = "2026-07-06T15:45:12.345Z";
    expect(instantToLocalInput(instant)).toBe("2026-07-06T11:45:12.345");
    expect(localDeadlineToInstant(instantToLocalInput(instant))).toBe(instant);
  });
  it("rejects nonexistent and ambiguous Santiago local times", () => {
    expect(() => localDeadlineToInstant("2026-09-06T00:30")).toThrow();
    expect(() => localDeadlineToInstant("2026-04-04T23:30")).toThrow();
  });
  it("rejects invalid dates instead of normalizing them", () => {
    expect(() => deadlineAt({ kind: "date", value: "2026-02-30" })).toThrow();
    expect(() => deadlineAt({ kind: "instant", value: "2026-10-06T12:00:00" })).toThrow();
  });
  it("formats a date-only deadline without shifting its day", () => {
    expect(formatDeadline({ kind: "date", value: "2026-10-06" })).toContain("6 oct 2026");
    expect(formatDeadline(null)).toBe("Sin fecha límite");
    expect(dayGreeting(Date.parse("2026-10-07T02:00:00Z"))).toBe("Buenas noches.");
  });
});

describe("time entry duration", () => {
  const entry: TimeEntry = {
    id: "e",
    taskId: "t",
    startedAt: "2026-10-06T14:00:00.000Z",
    endedAt: null,
    durationMinutes: null,
    createdAt: "2026-10-06T14:00:00.000Z",
  };
  it("calculates fractional elapsed minutes with an explicit now", () => {
    expect(entryMinutes(entry, Date.parse("2026-10-06T14:01:30Z"))).toBe(1.5);
  });
  it("uses persisted closed durations independently of current time", () => {
    expect(
      entryMinutes({ ...entry, endedAt: "2026-10-06T14:01:30Z", durationMinutes: 1.5 }, 0),
    ).toBe(1.5);
  });
  it("clamps a live display when the system clock moves backward", () => {
    expect(entryMinutes(entry, Date.parse("2026-10-06T13:59:00Z"))).toBe(0);
  });
});
