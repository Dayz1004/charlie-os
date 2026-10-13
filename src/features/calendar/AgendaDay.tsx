import { Temporal } from "@js-temporal/polyfill";
import type { Workspace } from "../../domain/models";
import { dayBounds, instant, localDate, overlaps } from "../../domain/intervals";
import { dayLoad } from "../../domain/scheduling";
import { assessTask } from "../../domain/priority";
import { formatMinutes, TIME_ZONE } from "../../domain/time";

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(instant(value));
interface Props {
  workspace: Workspace;
  date: string;
  now: number;
  busy: boolean;
  onLock(id: string, locked: boolean): void;
  onEditEvent?(id: string): void;
}

export function AgendaDay({ workspace, date, now, busy, onLock, onEditEvent }: Props) {
  const day = Temporal.PlainDate.from(date);
  const bounds = dayBounds(day);
  const load = dayLoad(workspace, day);
  const items = [
    ...workspace.events.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt,
      event: e,
      block: null,
    })),
    ...workspace.planBlocks.map((b) => ({
      id: b.id,
      title: workspace.tasks.find((t) => t.id === b.taskId)?.title ?? "Task",
      startAt: b.startAt,
      endAt: b.endAt,
      event: null,
      block: b,
    })),
  ]
    .filter((i) => overlaps(bounds, { start: instant(i.startAt), end: instant(i.endAt) }))
    .sort((a, b) => instant(a.startAt) - instant(b.startAt) || a.id.localeCompare(b.id));
  const deadlines = workspace.tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "cancelled" &&
      t.deadline &&
      (t.deadline.kind === "date"
        ? t.deadline.value === date
        : localDate(instant(t.deadline.value)).toString() === date),
  );
  const conflict = items.some((a, index) =>
    items
      .slice(index + 1)
      .some(
        (b) =>
          (a.block || b.block) &&
          overlaps(
            { start: instant(a.startAt), end: instant(a.endAt) },
            { start: instant(b.startAt), end: instant(b.endAt) },
          ),
      ),
  );
  const warnings =
    workspace.planningState?.warnings.filter(
      (w) => w.at && localDate(instant(w.at) - 1).toString() === date,
    ) ?? [];
  return (
    <article className="panel space-y-3" aria-label={`Agenda ${date}`}>
      <h3 className="font-medium">
        {day.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
      </h3>
      <p className="text-xs text-muted">
        Planned: {formatMinutes(load.plannedMinutes)} / capacity after events:{" "}
        {formatMinutes(load.capacityMinutes)}
      </p>
      {(conflict || load.plannedMinutes > load.capacityMinutes || warnings.length > 0) && (
        <p className="text-sm font-medium text-foreground">
          Planning conflict / deadline shortfall — review the warnings.
        </p>
      )}
      {items.length === 0 && <p className="text-sm text-muted">No events or work blocks.</p>}
      {items.map((item) => (
        <div key={item.id} className="border-t border-line pt-3 text-sm space-y-2">
          <p>
            {formatTime(item.startAt)}–{formatTime(item.endAt)} {item.title}
          </p>
          <p className="text-xs text-muted">
            {item.event
              ? `Fixed event${item.event.location ? ` · ${item.event.location}` : ""}`
              : `Work block · ${item.block?.locked ? "Locked" : "Unlocked"}`}
            {instant(item.endAt) <= now ? " · Past" : ""}
            {localDate(instant(item.startAt)).toString() !==
            localDate(instant(item.endAt) - 1).toString()
              ? " · spans local days"
              : ""}
          </p>
          {item.event?.notes && <p className="text-xs text-muted">{item.event.notes}</p>}
          {item.block && instant(item.startAt) > now && (
            <button
              className="button"
              disabled={busy}
              onClick={() => onLock(item.id, !item.block!.locked)}
            >
              {item.block.locked ? "Unlock block" : "Lock block"}
            </button>
          )}
          {item.event && onEditEvent && (
            <button className="button" disabled={busy} onClick={() => onEditEvent(item.id)}>
              Edit event
            </button>
          )}
        </div>
      ))}
      {deadlines.map((t) => (
        <p key={t.id} className="text-xs text-muted">
          Deadline: {t.title} · {assessTask(t, now).risk} risk
        </p>
      ))}
    </article>
  );
}
