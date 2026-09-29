/** A column of an entity as this module reads it: the parts of `EntityFieldInfo` that decide whether a form asks for it. */
export interface DetailFieldShape {
    Name: string;
    DisplayName: string;
    IsPrimaryKey: boolean;
    IsVirtual: boolean;
    AllowUpdateAPI: boolean;
    AllowsNull: boolean;
    /** The database default, or null when there is none. */
    DefaultValue: string | null;
    Sequence: number;
}

/** A field a space's subtype keeps of its own, as the dialog and the settings ask for it. */
export interface DetailField {
    name: string;
    label: string;
    /** The person must fill it in: the column allows no null and has no default. */
    required: boolean;
}

/**
 * The columns a subtype adds to a space, in the order the entity gives them. A subtype's entity also carries the space's own
 * columns (the primary key, the parent's fields, the audit columns, and view-only columns): those are the space's, not its details.
 */
export function detailFields(fields: readonly DetailFieldShape[], parentFieldNames: ReadonlySet<string>): DetailField[] {
    return fields
        .filter((f) => !f.IsPrimaryKey && !f.IsVirtual && f.AllowUpdateAPI && !f.Name.startsWith('__mj_') && !parentFieldNames.has(f.Name))
        .sort((a, b) => a.Sequence - b.Sequence)
        .map((f) => ({
            name: f.Name,
            label: f.DisplayName,
            required: !f.AllowsNull && (f.DefaultValue === null || f.DefaultValue === undefined || f.DefaultValue === ''),
        }));
}

function isFilled(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    return typeof value === 'string' ? value.trim().length > 0 : true;
}

/**
 * The fields a UI driver's details form leaves in: those it does not name as hidden, compared without regard to case. A required
 * field stays whatever the driver says, since a space can't be saved without it.
 */
export function visibleDetailFields(fields: readonly DetailField[], hiddenFieldNames: readonly string[] | undefined): DetailField[] {
    const hidden = new Set((hiddenFieldNames ?? []).map((n) => n.toLowerCase()));
    return fields.filter((f) => f.required || !hidden.has(f.name.toLowerCase()));
}

/** The required details that have no value yet. */
export function missingDetails(fields: readonly DetailField[], valueOf: (name: string) => unknown): DetailField[] {
    return fields.filter((f) => f.required && !isFilled(valueOf(f.name)));
}
