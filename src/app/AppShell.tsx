import type { ReactNode } from "react";
import { BrandMark } from "../components/ui/BrandMark";
import { primaryNavigation } from "./navigation";
import type { ActiveView } from "./App";

export function AppShell({
  children,
  view,
  onNavigate,
  onQuickTask,
  busy,
}: {
  children: ReactNode;
  view: ActiveView;
  onNavigate(view: ActiveView): void;
  onQuickTask(): void;
  busy: boolean;
}) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          <BrandMark />
          <span>CHARLIE OS</span>
        </div>
        <button className="button-primary quick-task" onClick={onQuickTask} disabled={busy}>
          + Tarea
        </button>
        <nav aria-label="Navegación principal">
          {primaryNavigation.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onNavigate(section.id)}
              aria-current={view === section.id ? "page" : undefined}
            >
              <span aria-hidden="true">{section.icon}</span>
              {section.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={() => onNavigate("settings")}
            aria-current={view === "settings" ? "page" : undefined}
          >
            Ajustes
          </button>
          <p>
            Tu espacio personal
            <br />
            Local · v0.1
          </p>
        </div>
      </aside>
      <main id={view} className="app-main">
        <div
          className={
            view === "calendar" ? "workspace-content calendar-content" : "workspace-content"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}
