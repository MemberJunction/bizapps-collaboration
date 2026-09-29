/**
 * Task statuses and priorities as the task entity stores them, with one place that says how each reads and looks.
 * The list holds the stored values; only this module turns them into words and badge classes.
 */
export const TASK_STATUS_LABELS: Readonly<Record<string, string>> = {
  Open: 'Open',
  InProgress: 'In progress',
  Blocked: 'Blocked',
  Cancelled: 'Cancelled',
  Completed: 'Completed',
};

export const TASK_PRIORITY_LABELS: Readonly<Record<string, string>> = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Critical: 'Critical',
};

/** The status as a person reads it. A value the entity doesn't know is shown as it is. */
export function taskStatusLabel(status: string): string {
  return TASK_STATUS_LABELS[status] ?? status;
}

/** The badge class for a status: the stored value in lower case, so every value has a style. */
export function taskStatusClass(status: string): string {
  return `status-${status.toLowerCase()}`;
}

export function taskPriorityLabel(priority: string): string {
  return TASK_PRIORITY_LABELS[priority] ?? priority;
}

export function taskPriorityClass(priority: string): string {
  return `priority-${priority.toLowerCase()}`;
}

export function isTaskInProgress(status: string): boolean {
  return status === 'InProgress';
}

/** A task that is done with, one way or the other: it no longer counts as open work. */
export function isTaskClosed(status: string): boolean {
  return status === 'Completed' || status === 'Cancelled';
}
