import { Temporal } from "@js-temporal/polyfill";
import type { Workspace } from "../../domain/models";
import { instant, overlaps } from "../../domain/intervals";
import { dayLoad } from "../../domain/scheduling";
import { isEligible } from "../../domain/planning";
import { formatMinutes } from "../../domain/time";
import {
  agendaItems,
  dayDeadlines,
  formatTime,
  projectColor,
  projectName,
} from "../../presentation/workspace";
import type { TaskActions } from "../tasks/TasksView";

interface Props {
  workspace: Workspace;
  date: string;
  now: number;
  busy: boolean;
  remainingOnly?: boolean;
  onLock(id: string, locked: boolean): void;
  onEditEvent?(id: string): void;
  actions?: TaskActions;
}
export function AgendaDay({
  workspace,
  date,
  now,
  busy,
  remainingOnly,
  onLock,
  onEditEvent,
  actions,
}: Props) {
  const day = Temporal.PlainDate.from(date);
  const load = dayLoad(workspace, day);
  const allItems = agendaItems(workspace, date);
  const items = allItems.filter((i) => !remainingOnly || instant(i.endAt) > now);
  const active = workspace.timeEntries.some((e) => e.endedAt === null);
  const conflict = allItems.some((a, index) =>
    allItems
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
  return (
    <article className="agenda" aria-label={`Agenda ${date}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-medium">
          {remainingOnly
            ? "Lo que queda del día"
            : day.toLocaleString("es-CL", { weekday: "long", day: "numeric", month: "short" })}
        </h2>
        {!remainingOnly && (
          <p className="text-xs text-muted">
            {formatMinutes(load.plannedMinutes)} de trabajo · {formatMinutes(load.capacityMinutes)}{" "}
            de capacidad
          </p>
        )}
      </div>
      {(conflict || load.plannedMinutes > load.capacityMinutes) && (
        <p className="text-sm text-warning mb-3">
          Hay compromisos que coinciden o superan tu capacidad. Revisa el plan.
        </p>
      )}
      {items.length === 0 && (
        <p className="empty-state">
          {remainingOnly
            ? "Tu agenda está libre por el resto del día."
            : "Sin eventos ni bloques de trabajo."}
        </p>
      )}
      {items.map((item) => {
        const task = item.block ? workspace.tasks.find((t) => t.id === item.block!.taskId) : null;
        const past = instant(item.endAt) <= now;
        return (
          <div key={item.id} className={`agenda-row ${past ? "past" : ""}`}>
            <div className="agenda-time">
              <span>{formatTime(item.startAt)}</span>
              <span className="text-muted">{formatTime(item.endAt)}</span>
            </div>
            <span
              className={`agenda-marker ${item.event ? "fixed" : ""}`}
              style={{ background: projectColor(workspace, item.projectId) }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{item.title}</p>
              <p className="text-xs text-muted mt-1">
                {projectName(workspace, item.projectId)} ·{" "}
                {item.event
                  ? `Evento fijo${item.event.location ? ` · ${item.event.location}` : ""}`
                  : `${formatMinutes((instant(item.endAt) - instant(item.startAt)) / 60000)} · ${item.block?.locked ? "Reservado" : "Trabajo propuesto"}`}
                {task?.status === "done" ? " · Completada" : ""}
              </p>
              {item.event?.notes && <p className="text-xs text-muted mt-1">{item.event.notes}</p>}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {actions && task && !past && isEligible(task, workspace) && (
                <button
                  className="button-small"
                  disabled={busy || active}
                  onClick={() => actions.onStart(task.id)}
                >
                  Empezar
                </button>
              )}
              {actions &&
                task &&
                !past &&
                task.status !== "done" &&
                task.status !== "cancelled" && (
                  <button
                    className="button-small"
                    disabled={busy}
                    onClick={() => actions.onComplete(task.id)}
                  >
                    Completar tarea
                  </button>
                )}
              {item.block && instant(item.startAt) > now && (
                <button
                  className="button-small"
                  disabled={busy}
                  onClick={() => onLock(item.id, !item.block!.locked)}
                >
                  {item.block.locked ? "Liberar" : "Reservar"}
                </button>
              )}
              {item.event && onEditEvent && (
                <button
                  className="button-small"
                  disabled={busy}
                  onClick={() => onEditEvent(item.id)}
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        );
      })}
      {dayDeadlines(workspace, date).map((t) => (
        <p
          key={t.id}
          className="deadline-line"
          style={{ borderColor: projectColor(workspace, t.projectId) }}
        >
          Entrega: {t.title}
        </p>
      ))}
    </article>
  );
}
