import { TodayView } from "../features/today/TodayView";
import { AppShell } from "./AppShell";
import { useWorkspace } from "./useWorkspace";

const service = new WorkspaceService(tauriWorkspace);
export type ActiveView = "today" | "tasks" | "projects";

export function App() {
  const [view, setView] = useState<ActiveView>("today");
  const { workspace, busy, error, run, reload, now } = useWorkspace(service);
  const actions = {
    busy,
    onStart: (id: string) => {
      void run(() => service.start(id));
    },
    onStop: (id: string) => {
      void run(() => service.stop(id));
    },
    onComplete: (id: string) => {
      void run(() => service.complete(id));
    },
  };
  return (
    <AppShell view={view} onNavigate={setView}>
      {error && (
        <div role="alert" className="panel mb-6 space-y-3">
          <p>{error}</p>
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              void reload();
            }}
          >
            Retry / Refresh
          </button>
        </div>
      )}
      {!workspace && !error && <p role="status">Loading local workspace…</p>}
      {busy && (
        <p role="status" className="mb-3 text-sm text-muted">
          Saving / refreshing…
        </p>
      )}
      {workspace && (
        <>
          {view === "today" && (
            <TodayView
              workspace={workspace}
              now={now}
              {...actions}
              onReplan={() => {
                void reload();
              }}
              onTasks={() => setView("tasks")}
            />
          )}
          {view === "tasks" && (
            <TasksView
              workspace={workspace}
              now={now}
              {...actions}
              onSave={(input, id) => run(() => service.saveTask(input, id))}
            />
          )}
          {view === "projects" && (
            <ProjectsView
              workspace={workspace}
              busy={busy}
              onSave={(input, id) => run(() => service.saveProject(input, id))}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
import { useState } from "react";
import { tauriWorkspace } from "../adapters/tauri-workspace";
import { WorkspaceService } from "../application/workspace-service";
import { ProjectsView } from "../features/projects/ProjectsView";
import { TasksView } from "../features/tasks/TasksView";
