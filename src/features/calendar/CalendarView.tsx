import { useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import type { AvailabilityInput, CalendarEvent, EventInput, Workspace } from "../../domain/models";
import { instant, localDate } from "../../domain/intervals";
import { dayLoad, HORIZON_DAYS } from "../../domain/scheduling";
import { assessTask } from "../../domain/priority";
import { formatDeadline, formatMinutes, TIME_ZONE } from "../../domain/time";
import { AgendaDay } from "./AgendaDay";
import { AvailabilityForm } from "./AvailabilityForm";
import { EventForm } from "./EventForm";
import { PlanningWarnings } from "./PlanningWarnings";

interface Props {
  workspace: Workspace;
  now: number;
  busy: boolean;
  onReplan(): void;
  onLock(id: string, locked: boolean): void;
  onSaveEvent(input: EventInput, id?: string): Promise<boolean>;
  onDeleteEvent(id: string): Promise<boolean>;
  onSaveAvailability(input: AvailabilityInput[]): Promise<boolean>;
}
type Mode = "week" | "month" | "events" | "availability";

export function CalendarView({
  workspace,
  now,
  busy,
  onReplan,
  onLock,
  onSaveEvent,
  onDeleteEvent,
  onSaveAvailability,
}: Props) {
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(() => localDate(now).toString());
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const date = Temporal.PlainDate.from(anchor);
  const monday = date.subtract({ days: date.dayOfWeek - 1 });
  const monthStart = date.with({ day: 1 });
  const editEvent = (id: string) => {
    setEditing(workspace.events.find((e) => e.id === id) ?? null);
    setMode("events");
  };
  function move(direction: number) {
    setAnchor(
      (mode === "month"
        ? monthStart.add({ months: direction })
        : date.add({ days: 7 * direction })
      ).toString(),
    );
    setSelected(null);
  }
  return (
    <section className="space-y-6" aria-labelledby="calendar-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="calendar-heading" className="text-3xl font-semibold">
          Calendar
        </h1>
        <button className="button-primary" disabled={busy} onClick={onReplan}>
          Plan / Replan
        </button>
      </div>
      <p className="text-sm text-muted">
        {TIME_ZONE} · Plans cover the next {HORIZON_DAYS} local days. Tasks keep their estimates and
        deadlines.
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Calendar views">
        {(["week", "month", "events", "availability"] as const).map((m) => (
          <button
            className={m === mode ? "button-primary" : "button"}
            key={m}
            aria-pressed={m === mode}
            onClick={() => setMode(m)}
          >
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <PlanningWarnings workspace={workspace} />
      {(mode === "week" || mode === "month") && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button className="button" onClick={() => move(-1)}>
              Previous {mode}
            </button>
            <h2 className="font-medium">
              {mode === "week"
                ? `Week of ${monday.toString()}`
                : monthStart.toLocaleString("en-GB", { month: "long", year: "numeric" })}
            </h2>
            <button className="button" onClick={() => move(1)}>
              Next {mode}
            </button>
            <button
              className="button"
              onClick={() => {
                setAnchor(localDate(now).toString());
                setSelected(null);
              }}
            >
              Current {mode}
            </button>
          </div>
          {mode === "week" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 7 }, (_, i) => (
                <AgendaDay
                  key={i}
                  workspace={workspace}
                  date={monday.add({ days: i }).toString()}
                  now={now}
                  busy={busy}
                  onLock={onLock}
                  onEditEvent={editEvent}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2" aria-label="Month overview">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <p key={d} className="text-center text-xs text-muted">
                    {d}
                  </p>
                ))}
                {Array.from({ length: monthStart.dayOfWeek - 1 }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: date.daysInMonth }, (_, i) => {
                  const d = monthStart.add({ days: i });
                  const key = d.toString();
                  const load = dayLoad(workspace, d);
                  const tasks = workspace.tasks.filter(
                    (t) =>
                      t.status !== "done" &&
                      t.status !== "cancelled" &&
                      t.deadline &&
                      (t.deadline.kind === "date"
                        ? t.deadline.value === key
                        : localDate(instant(t.deadline.value)).toString() === key),
                  );
                  const risk = tasks.some((t) =>
                    ["high", "critical"].includes(assessTask(t, now).risk),
                  );
                  const shortfall = workspace.planningState?.warnings.some(
                    (w) =>
                      w.at &&
                      localDate(instant(w.at) - 1).toString() === key &&
                      ["deadline_capacity", "unscheduled_work", "horizon_capacity"].includes(
                        w.code,
                      ),
                  );
                  return (
                    <button
                      className="rounded-lg border border-line bg-surface p-2 text-left"
                      key={key}
                      aria-label={`Open day ${key}`}
                      onClick={() => setSelected(key)}
                    >
                      <span className="text-sm font-medium">{i + 1}</span>
                      <p className="text-xs text-muted">
                        {Math.round(load.plannedMinutes)} / {Math.round(load.capacityMinutes)} min
                      </p>
                      {tasks.length > 0 && <p className="text-xs">{tasks.length} due</p>}
                      {(risk || shortfall || load.plannedMinutes > load.capacityMinutes) && (
                        <p className="text-xs">Risk / shortfall</p>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted">
                Planned minutes / capacity after fixed events. Select a day for its agenda.
              </p>
              {selected && (
                <AgendaDay
                  workspace={workspace}
                  date={selected}
                  now={now}
                  busy={busy}
                  onLock={onLock}
                  onEditEvent={editEvent}
                />
              )}
            </>
          )}
        </>
      )}
      {mode === "availability" && (
        <AvailabilityForm
          key="availability"
          availability={workspace.availability}
          busy={busy}
          onSave={onSaveAvailability}
        />
      )}
      {mode === "events" && (
        <div className="space-y-4">
          <button className="button-primary" disabled={busy} onClick={() => setEditing("new")}>
            Create event
          </button>
          {editing && (
            <EventForm
              key={editing === "new" ? "new" : editing.id}
              event={editing === "new" ? undefined : editing}
              projects={workspace.projects}
              now={now}
              busy={busy}
              onSave={onSaveEvent}
              onCancel={() => setEditing(null)}
            />
          )}
          {workspace.events.length === 0 && (
            <p className="panel text-muted">No local events yet.</p>
          )}
          {workspace.events.map((e) => (
            <article key={e.id} className="panel space-y-3">
              <h2 className="font-medium">{e.title}</h2>
              <p className="text-sm text-muted">
                {formatDeadline({ kind: "instant", value: e.startAt })} →{" "}
                {formatDeadline({ kind: "instant", value: e.endAt })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="button" disabled={busy} onClick={() => setEditing(e)}>
                  Edit event
                </button>
                {deleting === e.id ? (
                  <>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => {
                        void onDeleteEvent(e.id).then((ok) => {
                          if (ok) setDeleting(null);
                        });
                      }}
                    >
                      Confirm delete event
                    </button>
                    <button className="button" onClick={() => setDeleting(null)}>
                      Keep event
                    </button>
                  </>
                ) : (
                  <button className="button" disabled={busy} onClick={() => setDeleting(e.id)}>
                    Delete event
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {mode === "month" && (
        <div className="panel space-y-2">
          <h2 className="font-medium">Open task deadlines</h2>
          {workspace.tasks
            .filter((t) => t.status !== "done" && t.status !== "cancelled" && t.deadline)
            .map((t) => (
              <p key={t.id} className="text-sm text-muted">
                {t.title} · {formatDeadline(t.deadline)} · {assessTask(t, now).risk} risk ·{" "}
                {formatMinutes(t.estimatedMinutes ?? 30)} estimated
              </p>
            ))}
        </div>
      )}
    </section>
  );
}
