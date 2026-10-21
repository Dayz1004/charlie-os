import { useEffect, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import type { AvailabilityInput, CalendarEvent, EventInput, Workspace } from "../../domain/models";
import { localDate, instant } from "../../domain/intervals";
import { formatDeadline } from "../../domain/time";
import { projectColor } from "../../presentation/workspace";
import type { TaskActions } from "../tasks/TasksView";
import { PlanningWarnings } from "./PlanningWarnings";
import { AgendaDay } from "./AgendaDay";
import { EventForm } from "./EventForm";
import { AvailabilityForm } from "./AvailabilityForm";
import { WeekTimeline } from "./WeekTimeline";
import { MonthOverview } from "./MonthOverview";

type Mode = "week" | "month" | "events" | "availability";
interface Props {
  workspace: Workspace;
  now: number;
  busy: boolean;
  actions: TaskActions;
  onReplan(): void;
  onLock(id: string, locked: boolean): void;
  onSaveEvent(input: EventInput, id?: string): Promise<boolean>;
  onDeleteEvent(id: string): Promise<boolean>;
  onSaveAvailability(input: AvailabilityInput[]): Promise<boolean>;
}
const modeLabels = {
  week: "Semana",
  month: "Mes",
  events: "Eventos",
  availability: "Disponibilidad",
};
export function CalendarView({
  workspace,
  now,
  busy,
  actions,
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
  const [showPast, setShowPast] = useState(false);
  const agendaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [mode]);
  const date = Temporal.PlainDate.from(anchor);
  const monday = date.subtract({ days: date.dayOfWeek - 1 });
  const editEvent = (id: string) => {
    setEditing(workspace.events.find((e) => e.id === id) ?? null);
    setMode("events");
  };
  function move(direction: number) {
    setAnchor(
      (mode === "month"
        ? date.with({ day: 1 }).add({ months: direction })
        : date.add({ days: 7 * direction })
      ).toString(),
    );
    setSelected(null);
  }
  return (
    <section className="space-y-5" aria-labelledby="calendar-heading">
      <div className="view-header">
        <div>
          <p className="eyebrow">Un lugar para cada cosa</p>
          <h1 id="calendar-heading">Calendario</h1>
        </div>
        <div className="flex gap-2">
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              setMode("events");
              setEditing("new");
            }}
          >
            + Evento
          </button>
          <button className="button-primary" disabled={busy} onClick={onReplan}>
            {workspace.planningState ? "Replanificar" : "Planificar"}
          </button>
        </div>
      </div>
      <div className="tabs" aria-label="Vistas del calendario">
        {(["week", "month", "events", "availability"] as const).map((m) => (
          <button key={m} aria-pressed={m === mode} onClick={() => setMode(m)}>
            {modeLabels[m]}
          </button>
        ))}
      </div>
      <PlanningWarnings workspace={workspace} compact />
      {(mode === "week" || mode === "month") && (
        <>
          <div className="calendar-toolbar">
            <h2>
              {mode === "week"
                ? `${monday.toLocaleString("es-CL", { day: "numeric", month: "short" })} – ${monday.add({ days: 6 }).toLocaleString("es-CL", { day: "numeric", month: "short", year: "numeric" })}`
                : date.toLocaleString("es-CL", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex gap-2">
              <button
                className="button-small"
                aria-label={mode === "week" ? "Semana anterior" : "Mes anterior"}
                onClick={() => move(-1)}
              >
                ←
              </button>
              <button
                className="button-small"
                onClick={() => {
                  setAnchor(localDate(now).toString());
                  setSelected(null);
                }}
              >
                Hoy
              </button>
              <button
                className="button-small"
                aria-label={mode === "week" ? "Semana siguiente" : "Mes siguiente"}
                onClick={() => move(1)}
              >
                →
              </button>
            </div>
          </div>
          {mode === "week" ? (
            <>
              <div className="calendar-legend">
                <span>▧ Evento fijo</span>
                <span>▰ Trabajo propuesto</span>
                <span>◆ Reservado</span>
                <span className="ml-auto">Santiago</span>
              </div>
              <WeekTimeline
                workspace={workspace}
                monday={monday}
                now={now}
                onSelect={setSelected}
              />
              <p className="text-xs text-muted">
                Selecciona un bloque o un día para ver sus acciones. Los bloques reservados se
                conservan al replanificar.
              </p>
            </>
          ) : (
            <>
              <MonthOverview
                workspace={workspace}
                month={date}
                now={now}
                selected={selected}
                onSelect={setSelected}
              />
              <p className="text-xs text-muted">
                La barra muestra trabajo planificado respecto a tu capacidad. ! indica riesgo o
                sobrecarga. Selecciona un día para ver su agenda.
              </p>
            </>
          )}
          {selected && (
            <div ref={agendaRef} className="day-details">
              <button
                className="text-button mb-3"
                onClick={() => {
                  setSelected(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                ← Volver al calendario
              </button>
              <AgendaDay
                workspace={workspace}
                date={selected}
                now={now}
                busy={busy}
                onLock={onLock}
                onEditEvent={editEvent}
                actions={actions}
              />
            </div>
          )}
        </>
      )}
      {mode === "availability" && (
        <AvailabilityForm
          availability={workspace.availability}
          busy={busy}
          onSave={onSaveAvailability}
        />
      )}
      {mode === "events" && (
        <div className="space-y-4">
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
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Tus compromisos</h2>
            <label className="text-sm text-muted">
              <input
                type="checkbox"
                checked={showPast}
                onChange={(e) => setShowPast(e.target.checked)}
              />{" "}
              Incluir pasados
            </label>
          </div>
          {workspace.events.filter((e) => showPast || instant(e.endAt) > now).length === 0 && (
            <p className="empty-state">Sin eventos próximos. Agrega un compromiso con + Evento.</p>
          )}
          {[...workspace.events]
            .filter((e) => showPast || instant(e.endAt) > now)
            .sort((a, b) => instant(a.startAt) - instant(b.startAt))
            .map((e) => (
              <article
                key={e.id}
                className="task-row"
                style={{ borderLeftColor: projectColor(workspace, e.projectId) }}
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{e.title}</h2>
                    <p className="text-sm text-muted mt-1">
                      {formatDeadline({ kind: "instant", value: e.startAt })} →{" "}
                      {formatDeadline({ kind: "instant", value: e.endAt })}
                    </p>
                    {e.location && <p className="text-xs text-muted mt-1">{e.location}</p>}
                  </div>
                  <div className="flex gap-2 items-start">
                    <button className="button-small" disabled={busy} onClick={() => setEditing(e)}>
                      Editar
                    </button>
                    {deleting === e.id ? (
                      <>
                        <button
                          className="button-small"
                          disabled={busy}
                          onClick={() => {
                            void onDeleteEvent(e.id).then((ok) => {
                              if (ok) setDeleting(null);
                            });
                          }}
                        >
                          Confirmar eliminación
                        </button>
                        <button className="button-small" onClick={() => setDeleting(null)}>
                          Conservar
                        </button>
                      </>
                    ) : (
                      <button
                        className="button-small"
                        disabled={busy}
                        onClick={() => setDeleting(e.id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
