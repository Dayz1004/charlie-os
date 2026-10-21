import { useState, type FormEvent } from "react";
import type { CalendarEvent, EventInput, Project } from "../../domain/models";
import { instantToLocalInput, localDeadlineToInstant, TIME_ZONE } from "../../domain/time";
import { instant } from "../../domain/intervals";

export function EventForm({
  event,
  projects,
  busy,
  now,
  onSave,
  onCancel,
}: {
  event?: CalendarEvent;
  projects: Project[];
  busy: boolean;
  now: number;
  onSave(input: EventInput, id?: string): Promise<boolean>;
  onCancel(): void;
}) {
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    let startAt: string, endAt: string;
    try {
      startAt = localDeadlineToInstant(String(data.get("startAt")));
      endAt = localDeadlineToInstant(String(data.get("endAt")));
    } catch {
      setError("Revisa los horarios. La hora debe existir y ser inequívoca en Santiago.");
      return;
    }
    if (instant(endAt) <= instant(startAt)) {
      setError("La hora de fin debe ser posterior a la de inicio.");
      return;
    }
    setError("");
    if (
      await onSave(
        {
          title: String(data.get("title")),
          startAt,
          endAt,
          projectId: String(data.get("projectId")) || null,
          location: String(data.get("location")) || null,
          notes: String(data.get("notes")) || null,
        },
        event?.id,
      )
    )
      onCancel();
  }
  return (
    <form
      className="panel space-y-4"
      aria-label={event ? "Editar evento" : "Nuevo evento"}
      onSubmit={(e) => {
        void submit(e);
      }}
    >
      <h2 className="font-medium">
        {event ? "Editar evento" : "Nuevo evento"} · {TIME_ZONE}
      </h2>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy} className="space-y-4">
        <label className="field">
          Nombre del evento
          <input name="title" required maxLength={200} autoFocus defaultValue={event?.title} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Inicio
            <input
              name="startAt"
              type="datetime-local"
              step={event ? "0.001" : "60"}
              required
              defaultValue={
                event
                  ? instantToLocalInput(event.startAt)
                  : instantToLocalInput(
                      new Date(Math.ceil(now / 1800000) * 1800000).toISOString(),
                    ).slice(0, 16)
              }
            />
          </label>
          <label className="field">
            Fin
            <input
              name="endAt"
              type="datetime-local"
              step={event ? "0.001" : "60"}
              required
              defaultValue={
                event
                  ? instantToLocalInput(event.endAt)
                  : instantToLocalInput(
                      new Date(Math.ceil(now / 1800000) * 1800000 + 3600000).toISOString(),
                    ).slice(0, 16)
              }
            />
          </label>
        </div>
        <label className="field">
          Proyecto
          <select name="projectId" defaultValue={event?.projectId ?? ""}>
            <option value="">Sin proyecto</option>
            {projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <details
          className="advanced-fields"
          open={event?.location || event?.notes ? true : undefined}
        >
          <summary>Lugar y notas</summary>
          <div className="space-y-3 mt-3">
            <label className="field">
              Lugar
              <input name="location" defaultValue={event?.location ?? ""} />
            </label>
            <label className="field">
              Notas
              <textarea name="notes" defaultValue={event?.notes ?? ""} />
            </label>
          </div>
        </details>
        <div className="flex gap-3">
          <button className="button-primary" type="submit">
            Guardar evento
          </button>
          <button className="button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
