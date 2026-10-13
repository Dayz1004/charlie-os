import type { Workspace } from "../../domain/models";
import { formatMinutes } from "../../domain/time";

export function PlanningWarnings({ workspace }: { workspace: Workspace }) {
  const state = workspace.planningState;
  return (
    <aside className="panel space-y-3" aria-label="Planning warnings">
      <h2 className="font-medium">Planning status</h2>
      {!state ? (
        <p className="text-sm text-muted">
          No schedule yet. Configure availability and select Plan / Replan.
        </p>
      ) : (
        <>
          {state.revision !== workspace.revision && (
            <p className="text-sm">
              Tasks or calendar data changed. Replan to update the proposed schedule.
            </p>
          )}
          {state.warnings.length === 0 && (
            <p className="text-sm text-muted">
              All eligible work fit within the last planning horizon.
            </p>
          )}
          {state.warnings.map((w, index) => (
            <p key={index} className="text-sm text-muted">
              {w.taskId
                ? `${workspace.tasks.find((t) => t.id === w.taskId)?.title ?? "Task"}: `
                : ""}
              {w.message}
              {w.requiredMinutes !== null && w.capacityMinutes !== null && (
                <>
                  {" "}
                  ({formatMinutes(w.requiredMinutes)} required; {formatMinutes(w.capacityMinutes)}{" "}
                  {w.code === "unscheduled_work" ? "scheduled" : "usable"})
                </>
              )}
            </p>
          ))}
        </>
      )}
    </aside>
  );
}
