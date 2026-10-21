import { useEffect, useState } from "react";
import { tauriWorkspace } from "../adapters/tauri-workspace";
import { WorkspaceService } from "../application/workspace-service";
import { CalendarView } from "../features/calendar/CalendarView";
import { ProjectsView } from "../features/projects/ProjectsView";
import { TasksView } from "../features/tasks/TasksView";
import { TodayView } from "../features/today/TodayView";
import { SettingsView } from "../features/settings/SettingsView";
import { QuickTaskDialog } from "../features/tasks/QuickTaskDialog";
import { AppShell } from "./AppShell";
import { useWorkspace } from "./useWorkspace";

const service = new WorkspaceService(tauriWorkspace);
export type ActiveView = "today" | "tasks" | "projects" | "calendar" | "settings";

export function App() {
  const [view, setView] = useState<ActiveView>("today");
  const [quickTask, setQuickTask] = useState(false);
  const [taskProject, setTaskProject] = useState("");
  const { workspace, busy, error, run, reload, now } = useWorkspace(service);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);
  useEffect(() => {
    document.documentElement.dataset.theme = workspace?.preferences.theme ?? "system";
  }, [workspace?.preferences.theme]);
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
    <AppShell
      view={view}
      onNavigate={(next) => {
        if (next === "tasks") setTaskProject("");
        setView(next);
      }}
      onQuickTask={() => setQuickTask(true)}
      busy={busy || !workspace}
    >
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
            Volver a intentar
          </button>
        </div>
      )}
      {!workspace && !error && <p role="status">Cargando tu espacio…</p>}
      {busy && (
        <p role="status" className="saving-status">
          Guardando…
        </p>
      )}
      {workspace && (
        <>
          {quickTask && (
            <QuickTaskDialog
              projects={workspace.projects}
              busy={busy}
              error={error}
              onSave={(input) => run(() => service.saveTask(input))}
              onClose={() => setQuickTask(false)}
            />
          )}
          {view === "settings" && (
            <SettingsView
              preferences={workspace.preferences}
              busy={busy}
              onSave={(input) => run(() => service.savePreferences(input))}
            />
          )}
          {view === "calendar" && (
            <CalendarView
              workspace={workspace}
              now={now}
              busy={busy}
              actions={actions}
              onReplan={() => {
                void run(() => service.replan());
              }}
              onLock={(id, locked) => {
                void run(() => service.lock(id, locked));
              }}
              onSaveEvent={(input, id) => run(() => service.saveEvent(input, id))}
              onDeleteEvent={(id) => run(() => service.deleteEvent(id))}
              onSaveAvailability={(input) => run(() => service.saveAvailability(input))}
            />
          )}
          {view === "today" && (
            <TodayView
              workspace={workspace}
              now={now}
              {...actions}
              onReplan={() => {
                void run(() => service.replan());
              }}
              onTasks={() => {
                setTaskProject("");
                setView("tasks");
              }}
              onCalendar={() => setView("calendar")}
              onLock={(id, locked) => {
                void run(() => service.lock(id, locked));
              }}
            />
          )}
          {view === "tasks" && (
            <TasksView
              key={taskProject}
              initialProject={taskProject}
              workspace={workspace}
              now={now}
              {...actions}
              onSave={(input, id) => run(() => service.saveTask(input, id))}
            />
          )}
          {view === "projects" && (
            <ProjectsView
              onTasks={(id) => {
                setTaskProject(id);
                setView("tasks");
              }}
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
