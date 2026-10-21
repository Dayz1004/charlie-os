import { useEffect, useRef } from "react";
import type { Project, TaskInput } from "../../domain/models";
import { TaskForm } from "./TaskForm";

export function QuickTaskDialog({
  projects,
  busy,
  error,
  onSave,
  onClose,
}: {
  projects: Project[];
  busy: boolean;
  error: string | null;
  onSave(input: TaskInput): Promise<boolean>;
  onClose(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="quick-dialog" aria-label="Crear una tarea" onCancel={onClose}>
      {error && (
        <p role="alert" className="notice m-4">
          {error}
        </p>
      )}
      <TaskForm projects={projects} busy={busy} onSave={onSave} onCancel={onClose} />
    </dialog>
  );
}
