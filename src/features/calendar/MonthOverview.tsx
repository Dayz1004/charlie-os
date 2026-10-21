import { Temporal } from "@js-temporal/polyfill";
import type { Workspace } from "../../domain/models";
import { localDate } from "../../domain/intervals";
import { dayLoad } from "../../domain/scheduling";
import { assessTask } from "../../domain/priority";
import { formatMinutes } from "../../domain/time";
import { agendaItems, dayDeadlines, projectColor, warningDate } from "../../presentation/workspace";

export function MonthOverview({
  workspace,
  month,
  now,
  selected,
  onSelect,
}: {
  workspace: Workspace;
  month: Temporal.PlainDate;
  now: number;
  selected: string | null;
  onSelect(date: string): void;
}) {
  const start = month.with({ day: 1 });
  return (
    <div className="month-overview" aria-label="Resumen mensual">
      {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
        <p key={d} className="month-weekday">
          {d}
        </p>
      ))}
      {Array.from({ length: start.dayOfWeek - 1 }, (_, i) => (
        <div key={`empty-${i}`} />
      ))}
      {Array.from({ length: start.daysInMonth }, (_, i) => {
        const day = start.add({ days: i });
        const key = day.toString();
        const load = dayLoad(workspace, day);
        const due = dayDeadlines(workspace, key);
        const events = agendaItems(workspace, key).filter((item) => item.event);
        const risk =
          due.some((t) => ["high", "critical"].includes(assessTask(t, now).risk)) ||
          workspace.planningState?.warnings.some(
            (w) =>
              warningDate(w) === key &&
              [
                "deadline_capacity",
                "unscheduled_work",
                "horizon_capacity",
                "preserved_conflict",
                "preserved_unavailable",
              ].includes(w.code),
          ) ||
          load.plannedMinutes > load.capacityMinutes;
        return (
          <button
            key={key}
            className={`month-day ${key === localDate(now).toString() ? "is-today" : ""} ${selected === key ? "selected" : ""}`}
            onClick={() => onSelect(key)}
            aria-label={`${day.toLocaleString("es-CL", { day: "numeric", month: "long" })}, ${due.length} entregas, ${events.length} eventos${risk ? ", requiere atención" : ""}`}
            aria-pressed={selected === key}
          >
            <span className="month-number">{day.day}</span>
            {risk && (
              <span className="month-risk" title="Requiere atención">
                !
              </span>
            )}
            {load.plannedMinutes > 0 && (
              <>
                <p className="month-load">{formatMinutes(load.plannedMinutes)}</p>
                <div className="load-bar">
                  <span
                    style={{
                      width: `${Math.min(100, load.capacityMinutes ? (load.plannedMinutes / load.capacityMinutes) * 100 : 100)}%`,
                    }}
                  />
                </div>
              </>
            )}
            {due.slice(0, 2).map((t) => (
              <p className="month-label" key={t.id} title={t.title}>
                <span
                  className="project-dot"
                  style={{ background: projectColor(workspace, t.projectId) }}
                />
                {t.title}
              </p>
            ))}
            {due.length > 2 && (
              <p className="month-label">
                +{due.length - 2} {due.length === 3 ? "entrega" : "entregas"}
              </p>
            )}
            {events.length > 0 && (
              <p className="month-label event-label" title={events.map((e) => e.title).join(", ")}>
                ◦ {events[0].title}
                {events.length > 1 ? ` +${events.length - 1}` : ""}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
