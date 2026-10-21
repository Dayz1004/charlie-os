import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceService } from "../application/workspace-service";
import type { Workspace } from "../domain/models";
import { systemClock } from "../domain/time";

function errorMessage(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  const translations: [string, string][] = [
    ["already active", "Ya hay una tarea en curso. Páusala o complétala antes de empezar otra."],
    [
      "changed",
      "Los datos cambiaron mientras se guardaba el plan. Actualiza y vuelve a planificar.",
    ],
    ["overlap", "Los horarios se superponen. Ajusta las franjas e inténtalo de nuevo."],
    ["end must", "La hora de fin debe ser posterior a la de inicio."],
    ["End must", "La hora de fin debe ser posterior a la de inicio."],
    ["Stop or complete", "Pausa o completa la tarea en curso antes de cambiar su proyecto."],
    ["prerequisite", "Esta tarea tiene requisitos pendientes. Complétalos antes de empezar."],
    ["project must", "Activa el proyecto para poder empezar esta tarea."],
    ["Only open", "Solo puedes empezar tareas pendientes que estén disponibles."],
    ["clock", "Revisa el reloj del equipo: la hora actual es anterior al inicio del cronómetro."],
    ["Name must", "Escribe un nombre de entre 1 y 200 caracteres."],
    ["escritorio", message],
  ];
  return (
    translations.find(([key]) => message.includes(key))?.[1] ??
    "No se pudo guardar o cargar el cambio. Revisa los datos y vuelve a intentarlo."
  );
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
