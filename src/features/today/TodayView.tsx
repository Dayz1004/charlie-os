import type { Workspace } from "../../domain/models";
import { planWorkspace } from "../../domain/planning";
import {
  dayGreeting,
  entryMinutes,
  formatDeadline,
  formatMinutes,
  TIME_ZONE,
} from "../../domain/time";
import type { TaskActions } from "../tasks/TasksView";

interface Props extends TaskActions {
  workspace: Workspace;
  now: number;
  onReplan(): void;
  onTasks(): void;
}

export function TodayView({ workspace, now, onReplan, onTasks, ...actions }: Props) {
  const plan = planWorkspace(workspace, { now: () => now });
  const next = plan.next;
  return (
    <section aria-labelledby="today-heading" className="space-y-6">
      <p className="text-xs font-medium tracking-widest text-muted uppercase">
        Your day, with intention
      </p>
      <h1 id="today-heading" className="text-3xl font-semibold">
        {dayGreeting(now)}
      </h1>
      <p className="text-sm text-muted">
        {new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: TIME_ZONE }).format(now)} ·{" "}
        {TIME_ZONE}
      </p>
      <div className="flex flex-wrap gap-3 text-sm text-muted">
        <span>{plan.candidates.length} available tasks</span>
        <span>{workspace.tasks.filter((t) => t.status === "done").length} completed</span>
        <span>
          {formatMinutes(workspace.tasks.reduce((sum, task) => sum + task.actualMinutes, 0))}{" "}
          recorded
        </span>
      </div>
      {plan.attention.length > 0 && (
        <aside className="panel space-y-2" aria-label="Deadline alerts">
          <h2 className="font-medium">
            {plan.attention.length} deadline{plan.attention.length === 1 ? "" : "s"} require
            attention
          </h2>
          {plan.attention.map((item) => (
            <p key={item.task.id} className="text-sm text-muted">
              {item.task.title} · {item.risk} risk · {formatDeadline(item.task.deadline)}
              {item.task.status === "blocked" ? " · blocked" : ""}
            </p>
          ))}
        </aside>
      )}
      {plan.active && (
        <article className="panel space-y-4" aria-label="Active task">
          <p className="text-xs font-medium tracking-widest text-accent uppercase">In progress</p>
          <h2 className="text-xl font-medium">{plan.active.task.title}</h2>
          <p className="text-sm text-muted">
            This session: {formatMinutes(entryMinutes(plan.active.entry, now))} · Previously
            recorded: {formatMinutes(plan.active.task.actualMinutes)}
          </p>
          <p className="text-xs text-muted">
            Time continues across app restarts until you stop or complete this task.
          </p>
          <div className="flex gap-3">
            <button
              className="button"
              disabled={actions.busy}
              onClick={() => actions.onStop(plan.active!.task.id)}
            >
              Stop
            </button>
            <button
              className="button-primary"
              disabled={actions.busy}
              onClick={() => actions.onComplete(plan.active!.task.id)}
            >
              Complete task
            </button>
          </div>
        </article>
      )}
      <article className="panel space-y-4" aria-label="Next Task">
        <p className="text-xs font-medium tracking-widest text-accent uppercase">Next Task</p>
        {next ? (
          <>
            <h2 className="text-xl font-medium">{next.task.title}</h2>
            <p className="text-sm text-muted">
              {workspace.projects.find((p) => p.id === next.task.projectId)?.name ?? "No project"} ·{" "}
              {formatMinutes(next.remainingMinutes)} remaining
              {next.task.estimatedMinutes === null ? " (assumed)" : ""}
            </p>
            <p className="text-sm text-muted">
              {formatDeadline(next.task.deadline)} · {next.risk} risk
            </p>
            <p className="text-sm leading-6 text-muted">{next.reason}</p>
            <button
              className="button-primary"
              disabled={actions.busy}
              onClick={() => actions.onStart(next.task.id)}
            >
              Start task
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">
            {plan.active
              ? "Finish or stop the active task to choose what comes next."
              : "No available task. Create a task, unblock one, or activate its project."}
          </p>
        )}
        <div className="flex gap-3">
          <button className="button" disabled={actions.busy} onClick={onReplan}>
            Replan
          </button>
          <button className="button" onClick={onTasks}>
            View tasks
          </button>
        </div>
      </article>
      <p className="text-xs text-muted">
        Recommendations use deadline risk and manual priority. They compare work with elapsed time
        until the deadline; calendar availability is not modeled yet.
      </p>
    </section>
  );
}
