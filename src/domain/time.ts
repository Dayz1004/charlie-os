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
  if (!deadline) return "Sin fecha límite";
  if (deadline.kind === "date") {
    const date = Temporal.PlainDate.from(deadline.value);
    return `${date.toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric" })} · todo el día`;
  }
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(Temporal.Instant.from(deadline.value).epochMilliseconds);
}

export function formatMinutes(minutes: number): string {
  if (minutes > 0 && minutes < 1) return "<1 min";
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

export function dayGreeting(now: number): string {
  const hour = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(TIME_ZONE).hour;
  return hour < 12 ? "Buenos días." : hour < 19 ? "Buenas tardes." : "Buenas noches.";
}
