import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceService } from "../application/workspace-service";
import type { Workspace } from "../domain/models";
import { systemClock } from "../domain/time";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}

export function useWorkspace(service: WorkspaceService) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => systemClock.now());
  const pending = useRef(false);
  const run = useCallback(async (action: () => Promise<Workspace>): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setWorkspace(next);
      setNow(systemClock.now());
      return true;
    } catch (error) {
      setError(errorMessage(error));
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);
  const reload = useCallback(() => run(() => service.load()), [run, service]);
  useEffect(() => {
    let alive = true;
    service
      .load()
      .then((data) => {
        if (alive) setWorkspace(data);
      })
      .catch((error) => {
        if (alive) setError(errorMessage(error));
      });
    const timer = window.setInterval(() => setNow(systemClock.now()), 1000);
    const onFocus = () => {
      void reload();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [service, reload]);
  return { workspace, error, busy, run, reload, now };
}
