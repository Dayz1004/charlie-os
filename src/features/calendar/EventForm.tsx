import { useState, type FormEvent } from "react";
import type { CalendarEvent, EventInput, Project } from "../../domain/models";
import { instantToLocalInput, localDeadlineToInstant, TIME_ZONE } from "../../domain/time";

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
      setError(
        "Enter valid Santiago times. Ambiguous and nonexistent daylight-saving times are rejected.",
      );
      return;
    }
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
      aria-label={event ? "Edit event" : "Create event"}
      onSubmit={(e) => {
        void submit(e);
      }}
    >
      <h2 className="font-medium">
        {event ? "Edit event" : "Create event"} · {TIME_ZONE}
      </h2>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy} className="space-y-4">
        <label className="field">
          Event title
          <input name="title" required maxLength={200} autoFocus defaultValue={event?.title} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Event start
            <input
              name="startAt"
              type="datetime-local"
              step="0.001"
              required
              defaultValue={instantToLocalInput(event?.startAt ?? new Date(now).toISOString())}
            />
          </label>
          <label className="field">
            Event end
            <input
              name="endAt"
              type="datetime-local"
              step="0.001"
              required
              defaultValue={instantToLocalInput(
                event?.endAt ?? new Date(now + 3600000).toISOString(),
              )}
            />
          </label>
        </div>
        <label className="field">
          Project
          <select name="projectId" defaultValue={event?.projectId ?? ""}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Location
          <input name="location" defaultValue={event?.location ?? ""} />
        </label>
        <label className="field">
          Notes
          <textarea name="notes" defaultValue={event?.notes ?? ""} />
        </label>
        <div className="flex gap-3">
          <button className="button-primary" type="submit">
            Save event
          </button>
          <button className="button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
