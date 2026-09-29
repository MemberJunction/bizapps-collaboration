/** A space type as the New space dialog reads it. */
export interface StartableTypeShape {
    ID: string;
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
        .map((t) => ({ id: t.ID, name: t.Name, description: t.Description ?? '', iconClass: t.IconClass || DEFAULT_KIND_ICON, color: t.Color || '' }));
}
