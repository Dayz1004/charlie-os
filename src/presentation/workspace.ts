import { Temporal } from "@js-temporal/polyfill";
import type { PlanningWarning, Workspace } from "../domain/models";
import {
  availabilityForDate,
  dayBounds,
  instant,
  localDate,
  minutes,
  overlaps,
  subtractIntervals,
} from "../domain/intervals";
import { deadlineAt, formatMinutes, TIME_ZONE } from "../domain/time";

export const taskStatusLabels = {
  inbox: "Por revisar",
  todo: "Pendiente",
  in_progress: "En curso",
  blocked: "Bloqueada",
  done: "Completada",
  cancelled: "Cancelada",
};
export const projectStatusLabels = {
  active: "Activo",
  paused: "En pausa",
  completed: "Completado",
  archived: "Archivado",
};
export const priorityLabels = { low: "Baja", normal: "Normal", high: "Alta" };
export const riskLabels = { low: "Bajo", medium: "Moderado", high: "Alto", critical: "Crítico" };
export const projectPalette = ["#6d8c80", "#638ac1", "#a780b7", "#c18b54", "#c07079", "#699ba0"];
export const projectColor = (workspace: Workspace, id: string | null) =>
  workspace.projects.find((p) => p.id === id)?.color ?? "#87909d";
export const projectName = (workspace: Workspace, id: string | null) =>
  workspace.projects.find((p) => p.id === id)?.name ?? "Sin proyecto";
export const formatTime = (value: string | number) =>
  new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(typeof value === "string" ? instant(value) : value);

export function agendaItems(workspace: Workspace, date: string) {
  const bounds = dayBounds(Temporal.PlainDate.from(date));
  return [
    ...workspace.events.map((event) => ({
      id: event.id,
      title: event.title,
      projectId: event.projectId,
      startAt: event.startAt,
      endAt: event.endAt,
      event,
      block: null,
    })),
    ...workspace.planBlocks.map((block) => {
      const task = workspace.tasks.find((t) => t.id === block.taskId);
      return {
        id: block.id,
        title: task?.title ?? "Tarea",
        projectId: task?.projectId ?? null,
        startAt: block.startAt,
        endAt: block.endAt,
        event: null,
        block,
      };
    }),
  ]
    .filter((i) => overlaps(bounds, { start: instant(i.startAt), end: instant(i.endAt) }))
    .sort((a, b) => instant(a.startAt) - instant(b.startAt) || a.id.localeCompare(b.id));
}
export function dayDeadlines(workspace: Workspace, date: string) {
  return workspace.tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "cancelled" &&
      t.deadline &&
      (t.deadline.kind === "date"
        ? t.deadline.value === date
        : localDate(instant(t.deadline.value)).toString() === date),
  );
}
// Remaining capacity subtracts actual reservations, including overlapping events, once.
export function remainingDayCapacity(workspace: Workspace, now: number): number {
  const date = localDate(now);
  return minutes(
    subtractIntervals(
      availabilityForDate(date, workspace.availability).map((w) => ({
        start: Math.max(now, w.start),
        end: w.end,
      })),
      [...workspace.events, ...workspace.planBlocks].map((i) => ({
        start: instant(i.startAt),
        end: instant(i.endAt),
      })),
    ),
  );
}
export function warningDate(warning: PlanningWarning): string | null {
  if (!warning.at) return null;
  const cutoff = ["deadline_capacity", "horizon_capacity", "unscheduled_work"].includes(
    warning.code,
  );
  return localDate(instant(warning.at) - (cutoff ? 1 : 0)).toString();
}
export function planningSummary(w: PlanningWarning, workspace: Workspace): string {
  const task = workspace.tasks.find((t) => t.id === w.taskId);
  const name = task?.title ?? "Esta tarea";
  const required = formatMinutes(w.requiredMinutes ?? 0);
  const capacity = formatMinutes(w.capacityMinutes ?? 0);
  const due = w.at
    ? Temporal.PlainDate.from(warningDate(w)!).toLocaleString("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "short",
      })
    : null;
  switch (w.code) {
    case "deadline_capacity":
      return `Las entregas hasta el ${due} están en riesgo: necesitas ${required} y quedan ${capacity} de tiempo disponible.`;
    case "horizon_capacity":
      return `Tu carga supera el tiempo disponible: ${required} de trabajo para ${capacity} de capacidad en el período.`;
    case "unscheduled_work":
      return `${name}: faltan ${formatMinutes(Math.max(0, (w.requiredMinutes ?? 0) - (w.capacityMinutes ?? 0)))} por ubicar${due ? ` hasta el ${due}` : ""}. Revisa disponibilidad o bloques mínimos.`;
    case "missing_estimate":
      return `${name}: usamos 30 min para planificar porque aún no tiene estimación.`;
    case "ineligible":
      return `${name}: no se planifica mientras esté bloqueada, su proyecto esté inactivo o tenga requisitos pendientes.`;
    case "active_task":
      return `${name}: el cronómetro está en marcha. Páusalo y replanifica para incorporar el tiempo trabajado.`;
    case "unsplittable":
      return `${name}: necesita más de 1 h 30 min. Permite dividirla en bloques para poder planificarla.`;
    case "preserved_conflict":
      return `${name}: un bloque reservado coincide con otro compromiso. Revisa el horario o libera el bloque futuro.`;
    case "preserved_unavailable":
      return `${name}: un bloque reservado queda fuera de tu disponibilidad.`;
    case "preserved_ineligible":
      return `${name}: conserva un bloque del plan aunque ya no está disponible para trabajar.`;
    case "preserved_late":
      return `${name}: un bloque reservado termina después de su fecha límite.`;
    default:
      return `${name}: revisa las condiciones de planificación.`;
  }
}
export function deadlineHint(workspace: Workspace, taskId: string, now: number) {
  const task = workspace.tasks.find((t) => t.id === taskId);
  if (!task?.deadline) return "Sin fecha límite";
  if (deadlineAt(task.deadline) <= now) return "Fecha límite vencida";
  const date =
    task.deadline.kind === "date"
      ? Temporal.PlainDate.from(task.deadline.value)
      : localDate(instant(task.deadline.value));
  const days = localDate(now).until(date).days;
  return days === 0
    ? "Vence hoy"
    : days === 1
      ? "Vence mañana"
      : `Vence el ${date.toLocaleString("es-CL", { weekday: "long", day: "numeric" })}`;
}

export function timelineMinute(value: number, date: string): number {
  const bounds = dayBounds(Temporal.PlainDate.from(date));
  const first = Temporal.Instant.fromEpochMilliseconds(bounds.start).toZonedDateTimeISO(TIME_ZONE);
  return first.hour * 60 + (value - bounds.start) / 60000;
}

// Position by elapsed minutes since this local day's start, so repeated hours stay distinct.
// Concurrent visual spans get independent lanes so overlapping fixed events remain readable.
export function timelineItems(workspace: Workspace, date: string) {
  const bounds = dayBounds(Temporal.PlainDate.from(date));
  const items = agendaItems(workspace, date)
    .map((item) => {
      const start = Math.max(bounds.start, instant(item.startAt));
      const end = Math.min(bounds.end, instant(item.endAt));
      const top = timelineMinute(start, date);
      return { ...item, top, bottom: top + (end - start) / 60000, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  let group: typeof items = [];
  let groupEnd = -Infinity;
  function finish() {
    const ends: number[] = [];
    for (const item of group) {
      let lane = ends.findIndex((end) => end <= item.top + 1e-7);
      if (lane === -1) lane = ends.length;
      ends[lane] = item.bottom;
      item.lane = lane;
    }
    for (const item of group) item.lanes = ends.length;
  }
  for (const item of items) {
    if (item.top >= groupEnd - 1e-7) {
      finish();
      group = [];
      groupEnd = -Infinity;
    }
    group.push(item);
    groupEnd = Math.max(groupEnd, item.bottom);
  }
  finish();
  return items;
}
