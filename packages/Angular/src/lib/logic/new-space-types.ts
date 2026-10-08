/** A space type as the New space dialog reads it. */
export interface StartableTypeShape {
    ID: string;
    /** The type's code, which a parent type's Children.AllowedTypeCodes names. */
    Code?: string | null;
    Name: string;
    Description: string | null;
    IconClass: string | null;
    Color: string | null;
    DisplayRank: number;
    IsActive: boolean;
}

/** A kind of space the dialog offers. */
export interface NewSpaceKind {
    id: string;
    code: string;
    name: string;
    description: string;
    iconClass: string;
    color: string;
}

export const DEFAULT_KIND_ICON = 'fa-solid fa-compass';

/** The active types, in display order (rank, then name), each with the icon and colour the rail gives that type. */
export function newSpaceKinds(types: readonly StartableTypeShape[]): NewSpaceKind[] {
    return types
        .filter((t) => t.IsActive)
        .sort((a, b) => a.DisplayRank - b.DisplayRank || a.Name.localeCompare(b.Name))
        .map((t) => ({ id: t.ID, code: t.Code ?? '', name: t.Name, description: t.Description ?? '', iconClass: t.IconClass || DEFAULT_KIND_ICON, color: t.Color || '' }));
}

/**
 * The kinds that may sit under a parent: those the parent type's `Children.AllowedTypeCodes` names, in the dialog's order. A
 * parent type that names none allows every kind; the server judges the parent's other rules (MaxOpen, its driver) on create.
 */
export function subSpaceKinds(kinds: readonly NewSpaceKind[], parentConfiguration: string | null | undefined): NewSpaceKind[] {
    const allowed = allowedChildTypeCodes(parentConfiguration);
    if (!allowed) return [...kinds];
    const codes = new Set(allowed.map((code) => code.toLowerCase()));
    return kinds.filter((kind) => codes.has(kind.code.toLowerCase()));
}

function allowedChildTypeCodes(configuration: string | null | undefined): string[] | null {
    if (!configuration) return null;
    try {
        const parsed = JSON.parse(configuration) as { Children?: { AllowedTypeCodes?: unknown } };
        const codes = parsed?.Children?.AllowedTypeCodes;
        return Array.isArray(codes) && codes.length > 0 ? codes.filter((c): c is string => typeof c === 'string') : null;
    } catch {
        return null;
    }
}
