import { useState } from "react";
import type { Task, TaskInput, Workspace } from "../../domain/models";
import { isEligible } from "../../domain/planning";
import { assessTask } from "../../domain/priority";
import { formatDeadline, formatMinutes } from "../../domain/time";
import {
  taskStatusLabels,
  priorityLabels,
  riskLabels,
  projectColor,
  projectName,
} from "../../presentation/workspace";
import { TaskForm } from "./TaskForm";

export interface TaskActions {
  busy: boolean;
  onStart(id: string): void;
  onStop(id: string): void;
  onComplete(id: string): void;
}
interface Props extends TaskActions {
  workspace: Workspace;
  now: number;
  initialProject?: string;
  onSave(input: TaskInput, id?: string): Promise<boolean>;
}

export function TasksView({ workspace, now, onSave, initialProject = "", ...actions }: Props) {
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [status, setStatus] = useState("open");
  const [project, setProject] = useState(initialProject);
  const activeEntry = workspace.timeEntries.find((entry) => entry.endedAt === null);
  const filtered = workspace.tasks.filter(
    (task) =>
      (!project || task.projectId === project) &&
      (status === "all" ||
        (status === "open"
          ? task.status !== "done" && task.status !== "cancelled"
          : task.status === status)),
  );
  return (
    <section aria-labelledby="tasks-heading" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 id="tasks-heading" className="text-3xl font-semibold">
          Tareas
        </h1>
        <button
          className="button-primary"
          disabled={actions.busy}
          onClick={() => setEditing("new")}
        >
          + Tarea
        </button>
      </div>
      {editing && (
        <TaskForm
          key={editing === "new" ? "new" : editing.id}
          task={editing === "new" ? undefined : editing}
          projects={workspace.projects}
          busy={actions.busy}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      )}
      <div className="flex flex-wrap gap-4">
        <label className="field">
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">Tareas abiertas</option>
            <option value="all">Todas las tareas</option>
            {["inbox", "todo", "in_progress", "blocked", "done", "cancelled"].map((s) => (
              <option key={s} value={s}>
                {taskStatusLabels[s as keyof typeof taskStatusLabels]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Proyecto
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {workspace.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length === 0 && (
        <p className="panel text-muted">No hay tareas en esta vista. Crea una para empezar.</p>
      )}
      <div className="space-y-3">
        {filtered.map((task) => {
          const risk = assessTask(
            task,
            now,
            task.id === activeEntry?.taskId ? activeEntry : undefined,
          );
          const eligible = isEligible(task, workspace);
          return (
            <article
              key={task.id}
              className="task-row space-y-2"
              style={{ borderLeftColor: projectColor(workspace, task.projectId) }}
              aria-label={task.title}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-medium break-words">{task.title}</h2>
                <span className="text-xs text-muted">{taskStatusLabels[task.status]}</span>
              </div>
              {task.description && (
                <p className="text-sm whitespace-pre-wrap text-muted">{task.description}</p>
              )}
              <p className="text-sm text-muted">
                {projectName(workspace, task.projectId)} · {formatDeadline(task.deadline)}
              </p>
              <p className="text-sm text-muted">
                Estimación:{" "}
                {task.estimatedMinutes === null
                  ? "Sin estimar"
                  : formatMinutes(task.estimatedMinutes)}{" "}
                · Trabajado: {formatMinutes(task.actualMinutes)} · Prioridad:{" "}
                {task.priority ? priorityLabels[task.priority] : "Sin preferencia"}
              </p>
              {task.status !== "done" && task.status !== "cancelled" && (
                <p className="text-sm" title={`Riesgo ${riskLabels[risk.risk].toLowerCase()}`}>
                  Riesgo: {riskLabels[risk.risk]}
                  {!eligible && task.status !== "in_progress"
                    ? " · No disponible para trabajar"
                    : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button className="button" disabled={actions.busy} onClick={() => setEditing(task)}>
                  Editar
                </button>
                {eligible && (
                  <button
                    className="button"
                    disabled={actions.busy || !!activeEntry}
                    onClick={() => actions.onStart(task.id)}
                  >
                    Empezar
                  </button>
                )}
                {task.status === "in_progress" && (
                  <button
                    className="button"
                    disabled={actions.busy}
                    onClick={() => actions.onStop(task.id)}
                  >
                    Pausar
                  </button>
                )}
                {task.status !== "done" && task.status !== "cancelled" && (
                  <button
                    className="button"
                    disabled={actions.busy}
                    onClick={() => actions.onComplete(task.id)}
                  >
                    Completar
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
