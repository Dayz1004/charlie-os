import { useState } from "react";
import type { Preferences } from "../../domain/models";
import { TIME_ZONE } from "../../domain/time";

export function SettingsView({
  preferences,
  busy,
  onSave,
}: {
  preferences: Preferences;
  busy: boolean;
  onSave(input: Preferences): Promise<boolean>;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <section className="space-y-6" aria-labelledby="settings-heading">
      <div className="view-header">
        <div>
          <p className="eyebrow">A tu manera</p>
          <h1 id="settings-heading">Ajustes</h1>
        </div>
      </div>
      <form
        className="panel space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void onSave({
            theme: String(data.get("theme")) as Preferences["theme"],
            horizonDays: Number(data.get("horizonDays")),
          }).then(setSaved);
        }}
        onChange={() => setSaved(false)}
      >
        <fieldset disabled={busy} className="space-y-5">
          <label className="field">
            Apariencia
            <select name="theme" defaultValue={preferences.theme}>
              <option value="system">Seguir el sistema</option>
              <option value="dark">Oscura</option>
              <option value="light">Clara</option>
            </select>
          </label>
          <div>
            <h2 className="text-sm font-medium">Zona horaria</h2>
            <p className="text-sm text-muted mt-1">Santiago de Chile · {TIME_ZONE}</p>
            <p className="text-xs text-muted mt-1">
              Los horarios y las fechas se interpretan en Santiago, incluidos los cambios de hora.
            </p>
          </div>
          <label className="field">
            Días que abarca el plan
            <input
              name="horizonDays"
              type="number"
              required
              min={1}
              max={90}
              step={1}
              defaultValue={preferences.horizonDays}
            />
            <span className="text-xs">
              De 1 a 90 días. Se aplica la próxima vez que planifiques.
            </span>
          </label>
          <p className="text-sm text-muted">
            Cada bloque de trabajo dura hasta 1 h 30 min. Puedes ajustar los bloques mínimos en cada
            tarea y tus horarios en Calendario → Disponibilidad.
          </p>
          <button className="button-primary" type="submit">
            Guardar ajustes
          </button>
        </fieldset>
        {saved && (
          <p role="status" className="text-sm">
            Ajustes guardados.
          </p>
        )}
      </form>
    </section>
  );
}
