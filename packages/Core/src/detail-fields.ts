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

/** A column as far as CodeGen's form layout is concerned: the section it lands in. */
export interface FieldSectionShape {
    Name: string;
    IsPrimaryKey: boolean;
    /** The category the column was given, or null. */
    Category: string | null;
    /** 'Category', 'Details' or 'Top': which kind of section the column lands in. */
    GeneratedFormSection: string;
    IncludeInGeneratedForm: boolean;
}

/** CodeGen's key for a section named by a category (its `camelCase`): words joined, first letter lowered, a leading digit prefixed with an underscore. */
export function sectionKeyOfCategory(category: string): string {
    const words = category.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s(.)/g, (_m, char: string) => char.toUpperCase()).replace(/\s/g, '').replace(/^(.)/, (_m, char: string) => char.toLowerCase());
    return /^\d/.test(words) ? `_${words}` : words;
}

/** The key CodeGen gives the form's top area. */
export const TOP_AREA = 'top-area';

/** The key of the section CodeGen's generated form puts a column in; null for a column that isn't on the form. */
export function sectionKeyOf(field: FieldSectionShape): string | null {
    if (!field.IncludeInGeneratedForm) return null;
    if (field.GeneratedFormSection === 'Category' && field.Category && field.Category.trim() !== '') return sectionKeyOfCategory(field.Category);
    if (field.GeneratedFormSection === 'Details') return 'details';
    // The top area is on the form whatever sections are asked for
    if (field.GeneratedFormSection === 'Top') return TOP_AREA;
    return null;
}

/**
 * The sections of a subtype's generated form that hold only the columns the subtype adds, or null when the form can't be shown on
 * its own. The form of an IsA child lays out every column of its view, the space's own included; the details screens show the
 * subtype's part only, by naming its sections. That works only when those sections hold none of the space's columns: a column of the
 * subtype in the same section as the space's (both in `details`, when nobody gave it a category) can't be shown without them.
 */
export function subtypeFormSections(fields: readonly FieldSectionShape[], ownNames: ReadonlySet<string>): string[] | null {
    const own = new Set<string>();
    const others = new Set<string>();
    for (const field of fields) {
        if (field.IsPrimaryKey) continue;
        const key = sectionKeyOf(field);
        if (!key) continue;
        (ownNames.has(field.Name) ? own : others).add(key);
    }
    if (own.size === 0) return null;
    // The top area is shown whichever sections are asked for: a column of the space in it would show beside the subtype's
    if (others.has(TOP_AREA)) return null;
    for (const key of own) if (others.has(key)) return null;
    return [...own].sort();
}
