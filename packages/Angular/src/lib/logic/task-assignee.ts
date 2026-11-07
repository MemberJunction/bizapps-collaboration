/** One Task Assignments row, as the Work tab reads it. The assignee is polymorphic: a People record or a User. */
export interface TaskAssignmentRow {
    TaskID: string;
    AssigneeEntityID: string;
    AssigneeRecordID: string;
    Status: string;
    AssignedAt?: string | null;
}

/** The kind of record an assignment names, as far as the Work tab can show one. */
export type AssigneeKind = 'person' | 'user' | null;

const STILL_ON_IT = new Set(['Pending', 'InProgress']);

function time(value: string | null | undefined): number {
    const t = value ? new Date(value).getTime() : NaN;
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/**
 * The name each task's Work row shows, keyed by lower-case task ID. Whoever is still on the task (Pending or InProgress)
 * comes before whoever finished, and the earliest assigned first; more than one reads "Ana Ruiz +1". An assignee whose
 * name isn't known is skipped, and a task with no named assignee has no entry, so the row reads Unassigned.
 */
export function taskAssigneeLabels(
    rows: TaskAssignmentRow[],
    kindOf: (entityId: string) => AssigneeKind,
    names: { person: Map<string, string>; user: Map<string, string> },
): Map<string, string> {
    const byTask = new Map<string, TaskAssignmentRow[]>();
    for (const row of rows) {
        const key = row.TaskID.toLowerCase();
        byTask.set(key, [...(byTask.get(key) ?? []), row]);
    }
    const labels = new Map<string, string>();
    for (const [task, assigned] of byTask) {
        const named = [...assigned]
            .sort((a, b) => Number(STILL_ON_IT.has(b.Status)) - Number(STILL_ON_IT.has(a.Status)) || time(a.AssignedAt) - time(b.AssignedAt))
            .map((row) => {
                const kind = kindOf(row.AssigneeEntityID);
                return kind ? names[kind].get(row.AssigneeRecordID.toLowerCase()) : undefined;
            })
            .filter((name): name is string => !!name);
        const unique = [...new Set(named)];
        if (unique.length) labels.set(task, unique.length > 1 ? `${unique[0]} +${unique.length - 1}` : unique[0]);
    }
    return labels;
}
