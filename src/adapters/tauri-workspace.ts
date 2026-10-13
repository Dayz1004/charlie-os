import { invoke, isTauri } from "@tauri-apps/api/core";
import type { WorkspaceRepository } from "../application/workspace-service";
import type {
  AvailabilityInput,
  EventInput,
  ProjectInput,
  ScheduleInput,
  TaskInput,
  Workspace,
} from "../domain/models";

// Mirrors commands.rs. Keep all command names/DTOs at this adapter boundary.
interface Commands {
  read_workspace: undefined;
  create_task: { input: TaskInput };
  update_task: { id: string; input: TaskInput };
  create_project: { input: ProjectInput };
  update_project: { id: string; input: ProjectInput };
  start_task: { id: string };
  stop_task: { id: string };
  complete_task: { id: string };
  set_task_dependencies: { id: string; prerequisiteIds: string[] };
  save_event: { id: string | null; input: EventInput };
  delete_event: { id: string };
  replace_availability: { input: AvailabilityInput[] };
  replace_schedule: { input: ScheduleInput };
  set_block_locked: { id: string; locked: boolean };
}
function command<K extends keyof Commands>(name: K, args: Commands[K]): Promise<Workspace> {
  if (!isTauri())
    return Promise.reject(
      new Error("Open CHARLIE OS with pnpm tauri dev to access the local SQLite workspace."),
    );
  return invoke<Workspace>(name, args);
}

export const tauriWorkspace: WorkspaceRepository = {
  saveEvent: (input, id) => command("save_event", { input, id: id ?? null }),
  deleteEvent: (id) => command("delete_event", { id }),
  replaceAvailability: (input) => command("replace_availability", { input }),
  replaceSchedule: (input) => command("replace_schedule", { input }),
  setBlockLocked: (id, locked) => command("set_block_locked", { id, locked }),
  read: () => command("read_workspace", undefined),
  createTask: (input) => command("create_task", { input }),
  updateTask: (id, input) => command("update_task", { id, input }),
  createProject: (input) => command("create_project", { input }),
  updateProject: (id, input) => command("update_project", { id, input }),
  startTask: (id) => command("start_task", { id }),
  stopTask: (id) => command("stop_task", { id }),
  completeTask: (id) => command("complete_task", { id }),
  setDependencies: (id, prerequisiteIds) =>
    command("set_task_dependencies", { id, prerequisiteIds }),
};
