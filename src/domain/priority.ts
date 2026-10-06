import type { Task, TimeEntry } from "./models";
import { deadlineAt, entryMinutes } from "./time";

export type Risk = "low" | "medium" | "high" | "critical";
export interface Assessment {
  risk: Risk;
  score: number;
  reason: string;
  remainingMinutes: number;
  deadlineAt: number | null;
}
const riskScores: Record<Risk, number> = { low: 0, medium: 100, high: 200, critical: 300 };
const priorityScores = { low: 0, normal: 10, high: 20 };

export function assessTask(task: Task, now: number, activeEntry?: TimeEntry): Assessment {
  const actual = task.actualMinutes + (activeEntry ? entryMinutes(activeEntry, now) : 0);
  // Unknown estimates use 30 minutes for scoring, explicitly disclosed to the user.
  const remainingMinutes = Math.max(1, (task.estimatedMinutes ?? 30) - actual);
  const due = task.deadline ? deadlineAt(task.deadline) : null;
  const available = due === null ? null : (due - now) / 60000;
  let risk: Risk = "low";
  let reason = "No deadline; ranked by manual priority, then creation time.";
  if (available !== null) {
    if (available <= 0) {
      risk = "critical";
      reason = "The deadline has passed.";
    } else if (available <= remainingMinutes) {
      risk = "critical";
      reason = "Time until the deadline is no greater than the estimated work remaining.";
    } else if (available <= remainingMinutes * 2 || available <= 1440) {
      risk = "high";
      reason = "Due within 24 hours or with at most twice the remaining work time available.";
    } else if (available <= remainingMinutes * 4 || available <= 4320) {
      risk = "medium";
      reason = "Due within 72 hours or with at most four times the remaining work time available.";
    } else {
      reason =
        "The deadline currently allows more than four times the remaining work and 72 hours.";
    }
  }
  if (task.estimatedMinutes === null) reason += " No estimate: scoring assumes 30 minutes.";
  return {
    risk,
    score: riskScores[risk] + (task.priority ? priorityScores[task.priority] : 0),
    reason,
    remainingMinutes,
    deadlineAt: due,
  };
}
