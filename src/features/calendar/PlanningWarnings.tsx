import type { Workspace } from "../../domain/models";
import { planningSummary } from "../../presentation/workspace";

export function PlanningWarnings({
  workspace,
  compact = false,
}: {
  workspace: Workspace;
  compact?: boolean;
}) {
  const state = workspace.planningState;
  const warnings = state?.warnings ?? [];
  const urgent = warnings.filter(
    (w) => !["missing_estimate", "ineligible", "active_task"].includes(w.code),
  );
  const order = [
    "deadline_capacity",
    "horizon_capacity",
    "unscheduled_work",
    "preserved_conflict",
    "preserved_late",
    "preserved_unavailable",
    "unsplittable",
    "preserved_ineligible",
  ];
  urgent.sort(
    (a, b) =>
      (order.indexOf(a.code) < 0 ? order.length : order.indexOf(a.code)) -
      (order.indexOf(b.code) < 0 ? order.length : order.indexOf(b.code)),
  );
  const visible = urgent.slice(0, compact ? 1 : 2);
  const rest = warnings.filter((w) => !visible.includes(w));
  if (state && state.revision === workspace.revision && !warnings.length) return null;
  return (
    <aside className="notice space-y-2" aria-label="Estado del plan">
      {!state && <p>Configura tu disponibilidad y planifica para darle un lugar a tu trabajo.</p>}
      {state && state.revision !== workspace.revision && (
        <p className="font-medium">
          Hay cambios desde el último plan. Replanifica para actualizar tu agenda.
        </p>
      )}
      {visible.map((w, i) => (
        <p key={i}>{planningSummary(w, workspace)}</p>
      ))}
      {rest.length > 0 && (
        <details>
          <summary>
            {rest.length} detalle{rest.length === 1 ? "" : "s"} del plan
          </summary>
          <div className="mt-3 space-y-2">
            {rest.map((w, i) => (
              <p key={i}>{planningSummary(w, workspace)}</p>
            ))}
          </div>
        </details>
      )}
    </aside>
  );
}
