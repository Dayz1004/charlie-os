import { useState } from "react";
import type { Workspace } from "../../domain/models";
import { planWorkspace } from "../../domain/planning";
import { dayGreeting, entryMinutes, formatMinutes, TIME_ZONE } from "../../domain/time";
import { instant, localDate } from "../../domain/intervals";
import { dayLoad, scheduledNext } from "../../domain/scheduling";
import {
  deadlineHint,
  formatTime,
  projectColor,
  projectName,
  remainingDayCapacity,
} from "../../presentation/workspace";
import type { TaskActions } from "../tasks/TasksView";
import { AgendaDay } from "../calendar/AgendaDay";
import { PlanningWarnings } from "../calendar/PlanningWarnings";

interface Props extends TaskActions {
  workspace: Workspace;
  now: number;
  onReplan(): void;
  onTasks(): void;
  onCalendar(): void;
  onLock(id: string, locked: boolean): void;
}
export function TodayView({
  workspace,
  now,
  onReplan,
  onTasks,
  onCalendar,
  onLock,
  ...actions
}: Props) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const plan = planWorkspace(workspace, { now: () => now });
  const scheduled = scheduledNext(workspace, now);
  const candidates = plan.candidates.filter((c) => !skipped.includes(c.task.id));
  const next = !plan.active
    ? (candidates.find((c) => c.task.id === scheduled?.id) ?? candidates[0])
    : null;
  const focus = plan.active?.task ?? next?.task;
  const block = focus
    ? workspace.planBlocks.find((b) => b.taskId === focus.id && instant(b.endAt) > now)
    : null;
  const event = workspace.events
    .filter((e) => instant(e.endAt) > now)
    .sort((a, b) => instant(a.startAt) - instant(b.startAt))[0];
  const today = localDate(now);
  const load = dayLoad(workspace, today);
  const free = remainingDayCapacity(workspace, now);
  const completed = workspace.tasks.filter(
    (t) => t.completedAt && localDate(instant(t.completedAt)).equals(today),
  ).length;
  return (
    <section aria-labelledby="today-heading" className="space-y-5">
      <div className="view-header">
        <div>
          <p className="eyebrow">Tu día, con intención</p>
          <h1 id="today-heading">{dayGreeting(now)}</h1>
          <p className="text-muted text-sm mt-2">
            {new Intl.DateTimeFormat("es-CL", { dateStyle: "full", timeZone: TIME_ZONE }).format(
              now,
            )}
          </p>
        </div>
        <button
          className="button-primary"
          disabled={actions.busy}
          onClick={() => {
            setSkipped([]);
            onReplan();
          }}
        >
          {workspace.planningState ? "Replanificar" : "Planificar"}
        </button>
      </div>
      <div className="daily-summary" aria-label="Resumen del día">
        <div>
          <strong>{formatMinutes(load.plannedMinutes)}</strong>
          <span>de trabajo planificado hoy</span>
        </div>
        <div>
          <strong>{formatMinutes(free)}</strong>
          <span>libres desde ahora</span>
        </div>
        <div>
          <strong>{completed}</strong>
          <span>{completed === 1 ? "tarea completada hoy" : "tareas completadas hoy"}</span>
        </div>
      </div>
      <div className="today-focus-grid">
        <article
          className="focus-panel"
          aria-label={plan.active ? "Tarea en curso" : "Qué hacer ahora"}
          style={{ borderColor: projectColor(workspace, focus?.projectId ?? null) }}
        >
          <p className="eyebrow">
            {plan.active
              ? "En curso"
              : block && instant(block.startAt) > now
                ? "Tu próximo bloque"
                : "Ahora"}
          </p>
          {focus ? (
            <>
              <h2 className="text-2xl font-semibold mt-3 break-words">{focus.title}</h2>
              <p className="text-sm text-muted mt-2">
                {projectName(workspace, focus.projectId)} · {deadlineHint(workspace, focus.id, now)}
              </p>
              <p className="text-sm mt-4">
                {plan.active
                  ? `${formatMinutes(entryMinutes(plan.active.entry, now))} en esta sesión`
                  : `${formatMinutes(next!.remainingMinutes)} de trabajo restante${focus.estimatedMinutes === null ? " · estimación provisional" : ""}`}
              </p>
              {block && (
                <p className="text-sm text-muted mt-1">
                  {localDate(instant(block.startAt)).equals(today)
                    ? "Hoy"
                    : localDate(instant(block.startAt)).toLocaleString("es-CL", {
                        weekday: "long",
                        day: "numeric",
                      })}
                  , {formatTime(block.startAt)}–{formatTime(block.endAt)}
                  {block.locked ? " · reservado" : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-5">
                {plan.active ? (
                  <>
                    <button
                      className="button-primary"
                      disabled={actions.busy}
                      onClick={() => actions.onComplete(focus.id)}
                    >
                      Completar
                    </button>
                    <button
                      className="button"
                      disabled={actions.busy}
                      onClick={() => actions.onStop(focus.id)}
                    >
                      Pausar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="button-primary"
                      disabled={actions.busy}
                      onClick={() => actions.onStart(focus.id)}
                    >
                      Empezar
                    </button>
                    <button
                      className="button"
                      disabled={actions.busy}
                      onClick={() => actions.onComplete(focus.id)}
                    >
                      Completar
                    </button>
                    <button
                      className="button"
                      disabled={actions.busy}
                      onClick={() => setSkipped([...skipped, focus.id])}
                    >
                      Otra tarea
                    </button>
                  </>
                )}
              </div>
              {plan.active && (
                <p className="text-xs text-muted mt-3">
                  El cronómetro sigue hasta que pauses o completes la tarea.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-medium mt-3">
                {skipped.length ? "Has revisado las opciones." : "Un momento para ordenar tu día."}
              </h2>
              <p className="text-sm text-muted mt-2">
                Crea una tarea o revisa las que están bloqueadas.
              </p>
              <button
                className="button mt-4"
                onClick={skipped.length ? () => setSkipped([]) : onTasks}
              >
                {skipped.length ? "Ver opciones de nuevo" : "Ver tareas"}
              </button>
            </>
          )}
        </article>
        <aside className="next-event" aria-label="Próximo evento">
          <p className="eyebrow">
            {event && instant(event.startAt) <= now ? "Evento en curso" : "Próximo compromiso"}
          </p>
          {event ? (
            <>
              <p className="text-xl font-medium mt-3">{event.title}</p>
              <p className="text-sm mt-2">
                {localDate(instant(event.startAt)).equals(today)
                  ? "Hoy"
                  : localDate(instant(event.startAt)).toLocaleString("es-CL", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                · {formatTime(event.startAt)}–{formatTime(event.endAt)}
              </p>
              {event.location && <p className="text-sm text-muted mt-1">{event.location}</p>}
            </>
          ) : (
            <p className="text-sm text-muted mt-3">Sin compromisos próximos.</p>
          )}
          <button className="text-button mt-4" onClick={onCalendar}>
            Ver calendario →
          </button>
          {plan.attention.length > 0 && (
            <aside className="space-y-2 mt-5" aria-label="Entregas que requieren atención">
              <h2 className="text-sm font-medium">Entregas que requieren atención</h2>
              {plan.attention.slice(0, 2).map((item) => (
                <p key={item.task.id} className="text-sm text-muted">
                  <span
                    className="project-dot"
                    style={{ background: projectColor(workspace, item.task.projectId) }}
                  />
                  {item.task.title} · {deadlineHint(workspace, item.task.id, now)}
                  {item.task.status === "blocked" ? " · bloqueada" : ""}
                </p>
              ))}
              {plan.attention.length > 2 && (
                <button className="text-button" onClick={onTasks}>
                  Ver las {plan.attention.length} tareas en riesgo
                </button>
              )}
            </aside>
          )}
        </aside>
      </div>
      <PlanningWarnings workspace={workspace} />
      <AgendaDay
        workspace={workspace}
        date={today.toString()}
        now={now}
        busy={actions.busy}
        onLock={onLock}
        remainingOnly
        actions={actions}
      />
    </section>
  );
}
