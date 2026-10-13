import type { ReactNode } from "react";
import { BrandMark } from "../components/ui/BrandMark";
import { primaryNavigation } from "./navigation";
import type { ActiveView } from "./App";

export function AppShell({
  children,
  view,
  onNavigate,
}: {
  children: ReactNode;
  view: ActiveView;
  onNavigate(view: ActiveView): void;
}) {
  return (
    <div className="flex min-h-screen bg-canvas text-foreground">
      <aside className="flex w-52 shrink-0 flex-col border-r border-line bg-surface p-5">
        <div className="mb-10 flex items-center gap-3">
          <BrandMark />
          <span className="text-sm font-semibold tracking-widest">CHARLIE OS</span>
        </div>

        <nav aria-label="Main navigation" className="space-y-1">
          {primaryNavigation.map((section) =>
            section.id === "today" ||
            section.id === "tasks" ||
            section.id === "projects" ||
            section.id === "calendar" ? (
              <button
                key={section.id}
                type="button"
                onClick={() => onNavigate(section.id as ActiveView)}
                aria-current={view === section.id ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${view === section.id ? "bg-accent-soft text-accent" : "text-muted"}`}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
                {section.label}
              </button>
            ) : (
              <button
                key={section.id}
                type="button"
                disabled
                aria-label={`${section.label} — coming soon`}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted"
              >
                {section.label}
                <span className="text-xs">Soon</span>
              </button>
            ),
          )}
        </nav>

        <div className="mt-auto pt-10">
          <button
            type="button"
            disabled
            aria-label="Settings — coming soon"
            className="w-full px-3 py-2.5 text-left text-sm text-muted"
          >
            Settings
          </button>
          <p className="mt-4 px-3 text-xs text-muted">Your personal workspace · v0.1</p>
        </div>
      </aside>

      <main id={view} className="min-w-0 flex-1 px-8 py-12 lg:px-14">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
