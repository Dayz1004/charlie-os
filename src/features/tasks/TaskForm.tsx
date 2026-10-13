import { useState, type FormEvent } from "react";
import type { Deadline, Priority, Project, Task, TaskInput, TaskStatus } from "../../domain/models";
import { instantToLocalInput, localDeadlineToInstant, TIME_ZONE } from "../../domain/time";

interface Props {
  task?: Task;
  projects: Project[];
  busy: boolean;
  onSave(input: TaskInput, id?: string): Promise<boolean>;
  onCancel(): void;
}

export function TaskForm({ task, projects, busy, onSave, onCancel }: Props) {
  const [deadlineKind, setDeadlineKind] = useState(task?.deadline?.kind ?? "none");
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let deadline: Deadline | null = null;
    try {
      const value = String(data.get("deadline") ?? "");
      if (deadlineKind !== "none") {
        if (!value) throw new Error("Missing deadline");
        deadline =
          deadlineKind === "date"
            ? { kind: "date", value }
            : { kind: "instant", value: localDeadlineToInstant(value) };
      }
    } catch {
      setError(
        "Enter a valid deadline. Timed deadlines use America/Santiago; ambiguous or nonexistent daylight-saving times are not accepted.",
      );
      return;
    }
    setError(null);
    const saved = await onSave(
      {
        title: String(data.get("title")),
        description: String(data.get("description")) || null,
        projectId: String(data.get("projectId")) || null,
        status: String(data.get("status")) as TaskStatus,
        priority: (String(data.get("priority")) || null) as Priority | null,
        estimatedMinutes: data.get("estimate") ? Number(data.get("estimate")) : null,
        deadline,
        splittable: data.get("splittable") === "on",
        minimumUsefulBlockMinutes: Number(data.get("minimumBlock")),
      },
      task?.id,
    );
    if (saved) onCancel();
  }
  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="panel space-y-4"
      aria-label={task ? "Edit task" : "Create task"}
    >
      <h2 className="text-lg font-medium">{task ? "Edit task" : "Create task"}</h2>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy} className="space-y-4">
        <label className="field">
          Title
          <input name="title" required maxLength={200} defaultValue={task?.title} autoFocus />
        </label>
        <label className="field">
          Description
          <textarea name="description" rows={2} defaultValue={task?.description ?? ""} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Minimum useful block (minutes)
            <input
              name="minimumBlock"
              type="number"
              min={1}
              max={90}
              step={1}
              required
              defaultValue={task?.minimumUsefulBlockMinutes ?? 25}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="splittable" type="checkbox" defaultChecked={task?.splittable ?? true} />
            Allow splitting into multiple work blocks
          </label>
          <label className="field">
            Project
            <select name="projectId" defaultValue={task?.projectId ?? ""}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Status
            <select name="status" defaultValue={task?.status ?? "todo"}>
              {task?.status === "in_progress" ? (
                <option value="in_progress">In progress — use Stop/Complete</option>
              ) : (
                <>
                  <option value="todo">To do</option>
                  <option value="inbox">Inbox</option>
                  <option value="blocked">Blocked</option>
                  <option value="cancelled">Cancelled</option>
                  {task?.status === "done" && <option value="done">Done</option>}
                </>
              )}
            </select>
          </label>
          <label className="field">
            Manual priority
            <select name="priority" defaultValue={task?.priority ?? ""}>
              <option value="">Unspecified</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="field">
            Estimated minutes
            <input
              name="estimate"
              type="number"
              min={1}
              max={525600}
              step={1}
              defaultValue={task?.estimatedMinutes ?? ""}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            Deadline type
            <select
              value={deadlineKind}
              onChange={(e) => setDeadlineKind(e.target.value as typeof deadlineKind)}
            >
              <option value="none">No deadline</option>
              <option value="date">Date only · end of Santiago day</option>
              <option value="instant">Date and time · Santiago</option>
            </select>
          </label>
          {deadlineKind !== "none" && (
            <label className="field">
              {deadlineKind === "date" ? "Deadline date" : `Deadline time (${TIME_ZONE})`}
              <input
                key={deadlineKind}
                name="deadline"
                required
                type={deadlineKind === "date" ? "date" : "datetime-local"}
                min="0001-01-01"
                max={deadlineKind === "date" ? "9998-12-31" : "9998-12-31T23:59:59.999"}
                step={deadlineKind === "instant" ? "0.001" : undefined}
                defaultValue={
                  task?.deadline?.kind === deadlineKind
                    ? task.deadline.kind === "date"
                      ? task.deadline.value
                      : instantToLocalInput(task.deadline.value)
                    : ""
                }
              />
            </label>
          )}
        </div>
        <div className="flex gap-3">
          <button className="button-primary" type="submit">
            Save task
          </button>
          <button className="button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
