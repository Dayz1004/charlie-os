import { useState } from "react";
import type { AvailabilityInput } from "../../domain/models";
import { TIME_ZONE } from "../../domain/time";

const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export function AvailabilityForm({
  availability,
  busy,
  onSave,
}: {
  availability: AvailabilityInput[];
  busy: boolean;
  onSave(input: AvailabilityInput[]): Promise<boolean>;
}) {
  const [rows, setRows] = useState<AvailabilityInput[]>(() =>
    availability.length
      ? availability.map((a) => ({
          weekday: a.weekday,
          startLocal: a.startLocal,
          endLocal: a.endLocal,
          enabled: a.enabled,
        }))
      : weekdays.map((_, i) => ({
          weekday: i + 1,
          startLocal: "09:00",
          endLocal: "17:00",
          enabled: false,
        })),
  );
  const [saved, setSaved] = useState(false);
  function update(index: number, change: Partial<AvailabilityInput>) {
    setSaved(false);
    setRows(rows.map((r, i) => (i === index ? { ...r, ...change } : r)));
  }
  return (
    <form
      className="panel space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(rows).then(setSaved);
      }}
      aria-label="Disponibilidad semanal"
    >
      <h2 className="font-medium">Disponibilidad semanal · {TIME_ZONE}</h2>
      <p className="text-sm text-muted">
        Activa los horarios en que puedes trabajar y guarda los cambios. Las franjas desactivadas no
        aportan tiempo al plan. Agrega franjas separadas para dejar descansos.
      </p>
      <fieldset disabled={busy} className="space-y-3">
        {rows.map((r, index) => (
          <div key={index} className={`availability-row ${r.enabled ? "enabled" : "disabled"}`}>
            <label className="field">
              Día
              <select
                aria-label={`Día de la franja ${index + 1}`}
                value={r.weekday}
                onChange={(e) => update(index, { weekday: Number(e.target.value) })}
              >
                {weekdays.map((d, i) => (
                  <option value={i + 1} key={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Desde
              <input
                aria-label={`Inicio de disponibilidad ${index + 1}`}
                type="time"
                required
                value={r.startLocal}
                onChange={(e) => update(index, { startLocal: e.target.value })}
              />
            </label>
            <label className="field">
              Hasta
              <input
                aria-label={`Fin de disponibilidad ${index + 1}`}
                type="time"
                required
                value={r.endLocal}
                onChange={(e) => update(index, { endLocal: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm">
                <input
                  aria-label={`Activar franja ${index + 1}`}
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(index, { enabled: e.target.checked })}
                />{" "}
                {r.enabled ? "Activa" : "Desactivada"}
              </label>
              <button
                className="button"
                type="button"
                onClick={() => {
                  setRows(rows.filter((_, i) => i !== index));
                  setSaved(false);
                }}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-3">
          <button
            className="button"
            type="button"
            onClick={() => {
              setRows([
                ...rows,
                { weekday: 1, startLocal: "09:00", endLocal: "17:00", enabled: false },
              ]);
              setSaved(false);
            }}
          >
            + Franja
          </button>
          <button className="button-primary" type="submit">
            Guardar disponibilidad
          </button>
        </div>
      </fieldset>
      {saved && (
        <p role="status" className="text-sm">
          Disponibilidad guardada. Replanifica para actualizar los bloques.
        </p>
      )}
    </form>
  );
}
