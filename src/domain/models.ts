export type TaskStatus = "inbox" | "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type Priority = "low" | "normal" | "high";
// A calendar date has no offset; an instant always includes one.
export type Deadline = { kind: "date"; value: string } | { kind: "instant"; value: string };

export interface ProjectInput {
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
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
  splittable: boolean;
  minimumUsefulBlockMinutes: number;
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
  preferences: Preferences;
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  dependencies: TaskDependency[];
  events: CalendarEvent[];
  availability: Availability[];
  planBlocks: PlanBlock[];
  revision: number;
  planningState: PlanningState | null;
}

export interface Preferences {
  theme: "system" | "dark" | "light";
  horizonDays: number;
}

export interface EventInput {
  title: string;
  startAt: string;
  endAt: string;
  projectId: string | null;
  location: string | null;
  notes: string | null;
}
export interface CalendarEvent extends EventInput {
  id: string;
  source: "local";
  createdAt: string;
  updatedAt: string;
}
export interface AvailabilityInput {
  weekday: number;
  startLocal: string;
  endLocal: string;
  enabled: boolean;
}
export interface Availability extends AvailabilityInput {
  id: string;
  timeZone: "America/Santiago";
}
export interface PlanBlock {
  id: string;
  taskId: string;
  startAt: string;
  endAt: string;
  locked: boolean;
  source: "scheduler";
  createdAt: string;
  updatedAt: string;
}
export interface PlanningWarning {
  code: string;
  taskId: string | null;
  at: string | null;
  message: string;
  requiredMinutes: number | null;
  capacityMinutes: number | null;
}
export interface PlanningState {
  plannedAt: string;
  horizonEnd: string;
  revision: number;
  warnings: PlanningWarning[];
}
export interface ScheduleInput {
  expectedRevision: number;
  plannedAt: string;
  horizonEnd: string;
  blocks: PlanBlock[];
  warnings: PlanningWarning[];
}
