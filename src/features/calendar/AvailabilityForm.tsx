import { useState } from "react";
import type { AvailabilityInput } from "../../domain/models";
import { TIME_ZONE } from "../../domain/time";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
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
      aria-label="Weekly availability"
    >
      <h2 className="font-medium">Weekly availability · {TIME_ZONE}</h2>
      <p className="text-sm text-muted">
        Enable your work windows. Use separate windows for breaks; each window stays within one
        local day. Capacity starts at zero until you save enabled windows.
      </p>
      <fieldset disabled={busy} className="space-y-3">
        {rows.map((r, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4"
          >
            <label className="field">
              Weekday
              <select
                aria-label={`Weekday window ${index + 1}`}
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
              Start
              <input
                aria-label={`Availability start ${index + 1}`}
                type="time"
                required
                value={r.startLocal}
                onChange={(e) => update(index, { startLocal: e.target.value })}
              />
            </label>
            <label className="field">
              End
              <input
                aria-label={`Availability end ${index + 1}`}
                type="time"
                required
                value={r.endLocal}
                onChange={(e) => update(index, { endLocal: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm">
                <input
                  aria-label={`Enabled window ${index + 1}`}
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(index, { enabled: e.target.checked })}
                />{" "}
                Enabled
              </label>
              <button
                className="button"
                type="button"
                onClick={() => {
                  setRows(rows.filter((_, i) => i !== index));
                  setSaved(false);
                }}
              >
                Remove window
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
            Add window
          </button>
          <button className="button-primary" type="submit">
            Save availability
          </button>
        </div>
      </fieldset>
      {saved && (
        <p role="status" className="text-sm">
          Availability saved. Replan to update work blocks.
        </p>
      )}
    </form>
  );
}
