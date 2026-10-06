import { useState, type FormEvent } from "react";
import type { Project, ProjectInput, ProjectStatus, Workspace } from "../../domain/models";

interface Props {
  workspace: Workspace;
  busy: boolean;
  onSave(input: ProjectInput, id?: string): Promise<boolean>;
}

export function ProjectsView({ workspace, busy, onSave }: Props) {
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
          Projects
        </h1>
        <button className="button-primary" disabled={busy} onClick={() => setEditing("new")}>
          Create project
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
              Name
              <input
                name="name"
                required
                maxLength={200}
                autoFocus
                defaultValue={editing === "new" ? "" : editing.name}
              />
            </label>
            <label className="field">
              Description
              <textarea
                name="description"
                defaultValue={editing === "new" ? "" : (editing.description ?? "")}
              />
            </label>
            <label className="field">
              Status
              <select name="status" defaultValue={editing === "new" ? "active" : editing.status}>
                {["active", "paused", "completed", "archived"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-3">
              <button className="button-primary" type="submit">
                Save project
              </button>
              <button className="button" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {workspace.projects.length === 0 && (
        <p className="panel text-muted">No projects yet. Tasks can also exist without a project.</p>
      )}
      {workspace.projects.map((p) => (
        <article className="panel space-y-3" key={p.id}>
          <h2 className="text-lg font-medium">{p.name}</h2>
          <p className="text-sm text-muted">
            {p.status} ·{" "}
            {
              workspace.tasks.filter(
                (t) => t.projectId === p.id && t.status !== "done" && t.status !== "cancelled",
              ).length
            }{" "}
            open tasks
          </p>
          {p.description && <p className="text-sm text-muted">{p.description}</p>}
          <button className="button" disabled={busy} onClick={() => setEditing(p)}>
            Edit project
          </button>
        </article>
      ))}
    </section>
  );
}
