import { useState } from "react";
import type { Task, TaskInput, Workspace } from "../../domain/models";
import { isEligible } from "../../domain/planning";
import { assessTask } from "../../domain/priority";
import { formatDeadline, formatMinutes } from "../../domain/time";
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
  onSave(input: TaskInput, id?: string): Promise<boolean>;
}

export function TasksView({ workspace, now, onSave, ...actions }: Props) {
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [status, setStatus] = useState("open");
  const [project, setProject] = useState("");
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
          Tasks
        </h1>
        <button
          className="button-primary"
          disabled={actions.busy}
          onClick={() => setEditing("new")}
        >
          Create task
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
          Filter by status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">Open tasks</option>
            <option value="all">All tasks</option>
            {["inbox", "todo", "in_progress", "blocked", "done", "cancelled"].map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Filter by project
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All projects</option>
            {workspace.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length === 0 && (
        <p className="panel text-muted">No tasks match this view. Create a task to get started.</p>
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
            <article key={task.id} className="panel space-y-3" aria-label={task.title}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-medium break-words">{task.title}</h2>
                <span className="text-xs text-muted">{task.status.replace("_", " ")}</span>
              </div>
              {task.description && (
                <p className="text-sm whitespace-pre-wrap text-muted">{task.description}</p>
              )}
              <p className="text-sm text-muted">
                {workspace.projects.find((p) => p.id === task.projectId)?.name ?? "No project"} ·{" "}
                {formatDeadline(task.deadline)}
              </p>
              <p className="text-sm text-muted">
                Estimate:{" "}
                {task.estimatedMinutes === null ? "Not set" : formatMinutes(task.estimatedMinutes)}{" "}
                · Recorded: {formatMinutes(task.actualMinutes)} · Priority:{" "}
                {task.priority ?? "unspecified"}
              </p>
              {task.status !== "done" && task.status !== "cancelled" && (
                <p className="text-sm" title={risk.reason}>
                  Risk: {risk.risk}
                  {!eligible && task.status !== "in_progress"
                    ? " · Unavailable for recommendation"
                    : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button className="button" disabled={actions.busy} onClick={() => setEditing(task)}>
                  Edit
                </button>
                {eligible && (
                  <button
                    className="button"
                    disabled={actions.busy || !!activeEntry}
                    onClick={() => actions.onStart(task.id)}
                  >
                    Start
                  </button>
                )}
                {task.status === "in_progress" && (
                  <button
                    className="button"
                    disabled={actions.busy}
                    onClick={() => actions.onStop(task.id)}
                  >
                    Stop
                  </button>
                )}
                {task.status !== "done" && task.status !== "cancelled" && (
                  <button
                    className="button"
                    disabled={actions.busy}
                    onClick={() => actions.onComplete(task.id)}
                  >
                    Complete
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
