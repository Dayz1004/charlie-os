import { useEffect, useRef, type CSSProperties } from "react";
import { Temporal } from "@js-temporal/polyfill";
import type { Workspace } from "../../domain/models";
import { dayBounds, localDate } from "../../domain/intervals";
import {
  dayDeadlines,
  formatTime,
  projectColor,
  projectName,
  timelineItems,
  timelineMinute,
} from "../../presentation/workspace";

const PIXELS_PER_MINUTE = 1.35;
export function WeekTimeline({
  workspace,
  monday,
  now,
  onSelect,
}: {
  workspace: Workspace;
  monday: Temporal.PlainDate;
  now: number;
  onSelect(date: string): void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: 7 }, (_, i) => monday.add({ days: i }));
  const columns = days.map((day) => timelineItems(workspace, day.toString()));
  const first = Math.min(7 * 60, ...columns.flat().map((i) => Math.floor(i.top / 60) * 60));
  const last = Math.max(22 * 60, ...columns.flat().map((i) => Math.ceil(i.bottom / 60) * 60));
  const height = (last - first) * PIXELS_PER_MINUTE;
  const today = localDate(now).toString();
  const currentMinute = timelineMinute(now, today);
  const weekKey = monday.toString();
  useEffect(() => {
    if (scroll.current)
      scroll.current.scrollTop = Math.max(0, (9 * 60 - first) * PIXELS_PER_MINUTE - 20);
  }, [weekKey, first]);
  return (
    <div
      className="week-scroll"
      ref={scroll}
      tabIndex={0}
      aria-label="Horario semanal; desplázate para ver otras horas"
    >
      <div className="week-grid" style={{ minHeight: height + 90 }}>
        <div className="week-corner">Hora</div>
        {days.map((day) => (
          <button
            key={day.toString()}
            className={`week-header ${day.toString() === today ? "is-today" : ""}`}
            onClick={() => onSelect(day.toString())}
          >
            <span>{day.toLocaleString("es-CL", { weekday: "short" })}</span>
            <strong>{day.day}</strong>
            {dayBounds(day).end - dayBounds(day).start !== 86400000 && (
              <small>Cambio de hora</small>
            )}
            {dayDeadlines(workspace, day.toString()).length > 0 && (
              <small>
                {dayDeadlines(workspace, day.toString()).length} entrega
                {dayDeadlines(workspace, day.toString()).length === 1 ? "" : "s"}
              </small>
            )}
          </button>
        ))}
        <div className="time-axis" style={{ height }}>
          {Array.from({ length: (last - first) / 60 }, (_, i) => (
            <span key={i} style={{ top: i * 60 * PIXELS_PER_MINUTE }}>
              {String((first / 60 + i) % 24).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((day, index) => (
          <div
            key={day.toString()}
            className={`day-column ${day.toString() === today ? "is-today" : ""}`}
            style={{ height }}
          >
            {Array.from({ length: (last - first) / 60 }, (_, i) => (
              <div key={i} className="hour-line" style={{ top: i * 60 * PIXELS_PER_MINUTE }} />
            ))}
            {dayBounds(day).end - dayBounds(day).start > 86400000 && last > 1440 && (
              <span
                className="dst-repeat-label"
                style={{ top: (1440 - first) * PIXELS_PER_MINUTE }}
              >
                23:00 · segunda vez
              </span>
            )}
            {columns[index].map((item) => (
              <button
                key={item.id}
                className={`timeline-item ${item.event ? "event" : "work"} ${item.block?.locked ? "locked" : ""} ${item.bottom - item.top < 35 ? "short" : ""}`}
                style={
                  {
                    top: (item.top - first) * PIXELS_PER_MINUTE,
                    height: Math.max(2, (item.bottom - item.top) * PIXELS_PER_MINUTE - 2),
                    left: `calc(${(item.lane / item.lanes) * 100}% + 3px)`,
                    width: `calc(${100 / item.lanes}% - 6px)`,
                    borderColor: projectColor(workspace, item.projectId),
                    "--project-color": projectColor(workspace, item.projectId),
                  } as CSSProperties
                }
                onClick={() => onSelect(day.toString())}
                aria-label={`${item.title}, ${formatTime(item.startAt)} a ${formatTime(item.endAt)}, ${item.event ? "evento fijo" : item.block?.locked ? "trabajo reservado" : "trabajo propuesto"}`}
                title={`${item.title}\n${projectName(workspace, item.projectId)}\n${formatTime(item.startAt)}–${formatTime(item.endAt)}${item.block?.locked ? " · reservado" : ""}`}
              >
                <span className="timeline-time">
                  {formatTime(item.startAt)}
                  {item.block?.locked ? " · ◆" : item.event ? " · fijo" : ""}
                </span>
                <strong>{item.title}</strong>
                <span className="timeline-project">{projectName(workspace, item.projectId)}</span>
              </button>
            ))}
            {day.toString() === today && currentMinute >= first && currentMinute < last && (
              <div
                className="now-line"
                style={{ top: (currentMinute - first) * PIXELS_PER_MINUTE }}
                aria-label={`Hora actual ${formatTime(now)}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
