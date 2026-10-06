import type { ProjectInput, TaskInput, Workspace } from "../domain/models";

export interface WorkspaceRepository {
  read(): Promise<Workspace>;
  createTask(input: TaskInput): Promise<Workspace>;
  updateTask(id: string, input: TaskInput): Promise<Workspace>;
  createProject(input: ProjectInput): Promise<Workspace>;
  updateProject(id: string, input: ProjectInput): Promise<Workspace>;
  startTask(id: string): Promise<Workspace>;
  stopTask(id: string): Promise<Workspace>;
  completeTask(id: string): Promise<Workspace>;
  setDependencies(id: string, prerequisiteIds: string[]): Promise<Workspace>;
}

// Every mutation returns the authoritative workspace after the Rust transaction.
// UI state is a replaceable projection, never a second persistent task store.
export class WorkspaceService {
  constructor(readonly repository: WorkspaceRepository) {}
  load() {
    return this.repository.read();
  }
  saveTask(input: TaskInput, id?: string) {
    return id ? this.repository.updateTask(id, input) : this.repository.createTask(input);
  }
  saveProject(input: ProjectInput, id?: string) {
    return id ? this.repository.updateProject(id, input) : this.repository.createProject(input);
  }
  start(id: string) {
    return this.repository.startTask(id);
  }
  stop(id: string) {
    return this.repository.stopTask(id);
  }
  complete(id: string) {
    return this.repository.completeTask(id);
  }
}
