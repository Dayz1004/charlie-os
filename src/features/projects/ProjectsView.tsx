import { projectColor, projectPalette, projectStatusLabels } from "../../presentation/workspace";
import { useState, type FormEvent } from "react";
import type { Project, ProjectInput, ProjectStatus, Workspace } from "../../domain/models";

interface Props {
  workspace: Workspace;
  busy: boolean;
  onTasks(id: string): void;
  onSave(input: ProjectInput, id?: string): Promise<boolean>;
}

export function ProjectsView({ workspace, busy, onSave, onTasks }: Props) {
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (
      await onSave(
        {
          name: String(data.get("name")),
          description: String(data.get("description")) || null,
          status: String(data.get("status")) as ProjectStatus,
          color: String(data.get("color")),
        },
        editing && editing !== "new" ? editing.id : undefined,
      )
    )
      setEditing(null);
  }
  return (
    <section className="space-y-6" aria-labelledby="projects-heading">
      <div className="flex items-center justify-between">
        <h1 id="projects-heading" className="text-3xl font-semibold">
          Proyectos
        </h1>
        <button className="button-primary" disabled={busy} onClick={() => setEditing("new")}>
          + Proyecto
        </button>
      </div>
      {editing && (
        <form
          key={editing === "new" ? "new" : editing.id}
          onSubmit={(event) => {
            void submit(event);
          }}
          className="panel"
        >
          <fieldset disabled={busy} className="space-y-4">
            <label className="field">
              Nombre
              <input
                name="name"
                required
                maxLength={200}
                autoFocus
                defaultValue={editing === "new" ? "" : editing.name}
              />
            </label>
            <label className="field">
              Descripción
              <textarea
                name="description"
                defaultValue={editing === "new" ? "" : (editing.description ?? "")}
              />
            </label>
            <label className="field">
              Color del proyecto
              <input
                name="color"
                type="color"
                defaultValue={
                  editing === "new"
                    ? (projectPalette.find(
                        (color) => !workspace.projects.some((p) => p.color === color),
                      ) ?? projectPalette[workspace.projects.length % projectPalette.length])
                    : editing.color
                }
              />
            </label>
            <label className="field">
              Estado
              <select name="status" defaultValue={editing === "new" ? "active" : editing.status}>
                {["active", "paused", "completed", "archived"].map((s) => (
                  <option key={s} value={s}>
                    {projectStatusLabels[s as ProjectStatus]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-3">
              <button className="button-primary" type="submit">
                Guardar proyecto
              </button>
              <button className="button" type="button" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {workspace.projects.length === 0 && (
        <p className="panel text-muted">
          Crea un proyecto para agrupar tu trabajo. También puedes tener tareas sin proyecto.
        </p>
      )}
      <div className="project-list">
        {workspace.projects.map((p) => {
          const count = workspace.tasks.filter(
            (t) => t.projectId === p.id && t.status !== "done" && t.status !== "cancelled",
          ).length;
          return (
            <article
              className="task-row space-y-3"
              style={{ borderLeftColor: projectColor(workspace, p.id) }}
              key={p.id}
            >
              <h2 className="text-lg font-medium">{p.name}</h2>
              <p className="text-sm text-muted">
                {projectStatusLabels[p.status]} ·{" "}
                <button className="text-button" onClick={() => onTasks(p.id)}>
                  {count} {count === 1 ? "tarea abierta" : "tareas abiertas"}
                </button>
              </p>
              {p.description && <p className="text-sm text-muted">{p.description}</p>}
              <button className="button" disabled={busy} onClick={() => setEditing(p)}>
                Editar proyecto
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
