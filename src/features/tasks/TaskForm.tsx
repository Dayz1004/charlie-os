import { useState, type FormEvent } from "react";
import type { Deadline, Priority, Project, Task, TaskInput, TaskStatus } from "../../domain/models";
import { instantToLocalInput, localDeadlineToInstant } from "../../domain/time";
import { projectStatusLabels } from "../../presentation/workspace";

interface Props {
  task?: Task;
  projects: Project[];
  busy: boolean;
  onSave(input: TaskInput, id?: string): Promise<boolean>;
  onCancel(): void;
}
export function TaskForm({ task, projects, busy, onSave, onCancel }: Props) {
  const [deadlineKind, setDeadlineKind] = useState<"date" | "instant">(
    task?.deadline?.kind ?? "date",
  );
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let deadline: Deadline | null = null;
    try {
      const value = String(data.get("deadline") ?? "");
      if (value)
        deadline =
          deadlineKind === "date"
            ? { kind: "date", value }
            : { kind: "instant", value: localDeadlineToInstant(value) };
    } catch {
      setError("Revisa la fecha límite. La hora debe existir y ser inequívoca en Santiago.");
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
      onSubmit={(e) => {
        void submit(e);
      }}
      className="panel space-y-4"
      aria-label={task ? "Editar tarea" : "Nueva tarea"}
    >
      <h2 className="text-lg font-medium">{task ? "Editar tarea" : "Nueva tarea"}</h2>
      {error && (
        <p role="alert" className="text-warning">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        <label className="field">
          ¿Qué quieres hacer?
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={task?.title}
            placeholder="Por ejemplo, revisar el informe"
            autoFocus
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Proyecto
            <select name="projectId" defaultValue={task?.projectId ?? ""}>
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status !== "active" ? ` · ${projectStatusLabels[p.status]}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Duración estimada (min)
            <input
              name="estimate"
              type="number"
              min={1}
              max={525600}
              step={1}
              defaultValue={task?.estimatedMinutes ?? ""}
              placeholder="Opcional, por ejemplo 60"
            />
          </label>
          <label className="field">
            Fecha límite · opcional
            <input
              key={deadlineKind}
              name="deadline"
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
          <label className="field">
            Prioridad
            <select name="priority" defaultValue={task?.priority ?? ""}>
              <option value="">Sin preferencia</option>
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </label>
        </div>
        <details open={task ? true : undefined} className="advanced-fields">
          <summary>Más opciones</summary>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <label className="field">
              Descripción
              <textarea name="description" rows={2} defaultValue={task?.description ?? ""} />
            </label>
            <label className="field">
              Estado
              <select name="status" defaultValue={task?.status ?? "todo"}>
                {task?.status === "in_progress" ? (
                  <option value="in_progress">En curso · usa Pausar o Completar</option>
                ) : (
                  <>
                    <option value="todo">Pendiente</option>
                    <option value="inbox">Por revisar</option>
                    <option value="blocked">Bloqueada</option>
                    <option value="cancelled">Cancelada</option>
                    {task?.status === "done" && <option value="done">Completada</option>}
                  </>
                )}
              </select>
            </label>
            <label className="field">
              Tipo de fecha límite
              <select
                value={deadlineKind}
                onChange={(e) => setDeadlineKind(e.target.value as typeof deadlineKind)}
              >
                <option value="date">Día completo</option>
                <option value="instant">Día y hora · Santiago</option>
              </select>
            </label>
            <label className="field">
              Bloque mínimo útil (min)
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
              Permitir varios bloques de trabajo
            </label>
          </div>
        </details>
        <div className="flex gap-3">
          <button className="button-primary" type="submit">
            {task ? "Guardar cambios" : "Crear tarea"}
          </button>
          <button className="button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
