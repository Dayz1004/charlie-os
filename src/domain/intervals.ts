import { Temporal } from "@js-temporal/polyfill";
import type { AvailabilityInput } from "./models";
import { TIME_ZONE } from "./time";

export interface Interval {
  start: number;
  end: number;
}
export const instant = (value: string) => Temporal.Instant.from(value).epochMilliseconds;
export const iso = (value: number) =>
  Temporal.Instant.fromEpochMilliseconds(value).toString({ smallestUnit: "millisecond" });
export const localDate = (value: number) =>
  Temporal.Instant.fromEpochMilliseconds(value).toZonedDateTimeISO(TIME_ZONE).toPlainDate();
export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
export const minutes = (intervals: Interval[]) =>
  intervals.reduce((sum, i) => sum + (i.end - i.start) / 60000, 0);

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const interval of intervals
    .filter((i) => i.start < i.end)
    .sort((a, b) => a.start - b.start || a.end - b.end)) {
    const previous = result[result.length - 1];
    if (previous && interval.start <= previous.end)
      previous.end = Math.max(previous.end, interval.end);
    else result.push({ ...interval });
  }
  return result;
}

export function subtractIntervals(windows: Interval[], obstacles: Interval[]): Interval[] {
  let result = mergeIntervals(windows);
  for (const obstacle of mergeIntervals(obstacles)) {
    result = result.flatMap((i) =>
      !overlaps(i, obstacle)
        ? [i]
        : [
            { start: i.start, end: Math.min(i.end, obstacle.start) },
            { start: Math.max(i.start, obstacle.end), end: i.end },
          ].filter((piece) => piece.start < piece.end),
    );
  }
  return result;
}

export function dayBounds(date: Temporal.PlainDate): Interval {
  return {
    start: date.toZonedDateTime(TIME_ZONE).epochMilliseconds,
    end: date.add({ days: 1 }).toZonedDateTime(TIME_ZONE).epochMilliseconds,
  };
}

// Map each local window over every constant-offset segment of the actual day.
// Repeated wall-clock minutes are available twice; skipped minutes contribute zero.
// This also excludes the gap between repeated partial windows (e.g. 23:00–23:45).
export function availabilityForDate(
  date: Temporal.PlainDate,
  rules: AvailabilityInput[],
): Interval[] {
  const bounds = dayBounds(date);
  const segments: Interval[] = [];
  let start = bounds.start;
  while (start < bounds.end) {
    const zoned = Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO(TIME_ZONE);
    const transition = zoned.getTimeZoneTransition("next")?.epochMilliseconds ?? Infinity;
    const end = Math.min(bounds.end, transition);
    segments.push({ start, end });
    start = end;
  }
  const result: Interval[] = [];
  for (const rule of rules.filter((r) => r.enabled && r.weekday === date.dayOfWeek)) {
    const nominalStart = date
      .toPlainDateTime(rule.startLocal)
      .toZonedDateTime("UTC").epochMilliseconds;
    const nominalEnd = date.toPlainDateTime(rule.endLocal).toZonedDateTime("UTC").epochMilliseconds;
    for (const segment of segments) {
      const offset =
        Temporal.Instant.fromEpochMilliseconds(segment.start).toZonedDateTimeISO(TIME_ZONE)
          .offsetNanoseconds / 1e6;
      result.push({
        start: Math.max(segment.start, nominalStart - offset),
        end: Math.min(segment.end, nominalEnd - offset),
      });
    }
  }
  return mergeIntervals(result);
}
