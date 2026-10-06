import { Temporal } from "@js-temporal/polyfill";
import type { Deadline, TimeEntry } from "./models";

export const TIME_ZONE = "America/Santiago";
export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };

export function deadlineAt(deadline: Deadline): number {
  if (deadline.kind === "instant") return Temporal.Instant.from(deadline.value).epochMilliseconds;
  // A date-only deadline expires at the start of the following Santiago day.
  // Temporal handles 23/25-hour days and missing midnight during Chilean DST.
  return Temporal.PlainDate.from(deadline.value).add({ days: 1 }).toZonedDateTime(TIME_ZONE)
    .epochMilliseconds;
}

export function localDeadlineToInstant(value: string): string {
  return Temporal.PlainDateTime.from(value)
    .toZonedDateTime(TIME_ZONE, { disambiguation: "reject" })
    .toInstant()
    .toString({ smallestUnit: "millisecond" });
}

export function instantToLocalInput(value: string): string {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(TIME_ZONE)
    .toPlainDateTime()
    .toString({ smallestUnit: "millisecond" });
}

export function entryMinutes(entry: TimeEntry, now: number): number {
  if (entry.durationMinutes !== null) return entry.durationMinutes;
  const end = entry.endedAt ? Temporal.Instant.from(entry.endedAt).epochMilliseconds : now;
  return Math.max(0, end - Temporal.Instant.from(entry.startedAt).epochMilliseconds) / 60000;
}

export function formatDeadline(deadline: Deadline | null): string {
  if (!deadline) return "No deadline";
  if (deadline.kind === "date") {
    const date = Temporal.PlainDate.from(deadline.value);
    return `${date.toLocaleString("en-GB", { dateStyle: "medium" })} · all day`;
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(Temporal.Instant.from(deadline.value).epochMilliseconds);
}

export function formatMinutes(minutes: number): string {
  if (minutes > 0 && minutes < 1) return "<1 min";
  return `${Math.round(minutes)} min`;
}

export function dayGreeting(now: number): string {
  const hour = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(TIME_ZONE).hour;
  return hour < 12 ? "Good morning." : hour < 19 ? "Good afternoon." : "Good evening.";
}
