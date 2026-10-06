export type TaskStatus = "inbox" | "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type Priority = "low" | "normal" | "high";
// A calendar date has no offset; an instant always includes one.
export type Deadline = { kind: "date"; value: string } | { kind: "instant"; value: string };

export interface ProjectInput {
  name: string;
  description: string | null;
  status: ProjectStatus;
}
export interface Project extends ProjectInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
export interface TaskInput {
  title: string;
  description: string | null;
  projectId: string | null;
  status: TaskStatus;
  priority: Priority | null;
  deadline: Deadline | null;
  estimatedMinutes: number | null;
}
export interface Task extends TaskInput {
  id: string;
  actualMinutes: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export interface TimeEntry {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  createdAt: string;
}
export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
}
export interface Workspace {
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  dependencies: TaskDependency[];
}
