/**
 * The pure half of the binding resolver (B17, D27): what a binding expression asks for, and what a grant's bindings need from
 * the space, its anchors and the caller. The server's `ResolveBindings` reads records with these; nothing here does.
 */
import type { BindingExpression, SpaceGrantBindings } from './grants.ts';
import type { ResolvedCollaborationSettings } from './configuration.ts';

/** The columns of a space a binding may read. A binding may not read a space's Configuration or its image URL. */
export const SPACE_BINDING_FIELDS = ['ID', 'Name', 'Description', 'StartedAt', 'PlannedCloseAt', 'ClosedAt', 'ParentID', 'SpaceTypeID', 'OwnerID', 'StatusID'] as const;
export type SpaceBindingField = (typeof SPACE_BINDING_FIELDS)[number];

export const USER_BINDING_FIELDS = ['ID', 'Email', 'PersonID'] as const;
export type UserBindingField = (typeof USER_BINDING_FIELDS)[number];

/** Where one bound value comes from, read off its expression. */
export type BindingSource =
    | { kind: 'anchor'; role: string; field: string | null }
    | { kind: 'space'; field: SpaceBindingField }
    | { kind: 'config'; path: string }
    | { kind: 'user'; field: UserBindingField }
    | { kind: 'value'; value: string | number | boolean };

/** Reads an expression into its source, or says what is wrong with it. `name` is the bound parameter's name, for the message. */
export function bindingSource(name: string, expression: BindingExpression): { ok: true; source: BindingSource } | { ok: false; error: string } {
    if ('Value' in expression) return { ok: true, source: { kind: 'value', value: expression.Value } };
    const from = expression.From;
    if (from.startsWith('Anchor:')) {
        const rest = from.slice('Anchor:'.length);
        const dot = rest.indexOf('.');
        const role = (dot < 0 ? rest : rest.slice(0, dot)).trim();
        const field = dot < 0 ? null : rest.slice(dot + 1).trim();
        if (!role) return { ok: false, error: `Binding "${name}": Anchor: names no role.` };
        if (dot >= 0 && !field) return { ok: false, error: `Binding "${name}": Anchor:${role}. names no field.` };
        if (field && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) return { ok: false, error: `Binding "${name}": "${field}" is not a column name.` };
        return { ok: true, source: { kind: 'anchor', role, field } };
    }
    if (from.startsWith('Space.')) {
        const field = from.slice('Space.'.length).trim();
        const known = SPACE_BINDING_FIELDS.find((candidate) => candidate.toLowerCase() === field.toLowerCase());
        if (!known) return { ok: false, error: `Binding "${name}": a binding may read a space's ${SPACE_BINDING_FIELDS.join(', ')}, not "${field}".` };
        return { ok: true, source: { kind: 'space', field: known } };
    }
    if (from.startsWith('Config:')) {
        const path = from.slice('Config:'.length).trim();
        if (!path || !/^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/.test(path)) return { ok: false, error: `Binding "${name}": "${path}" is not a dotted settings path.` };
        return { ok: true, source: { kind: 'config', path } };
    }
    if (from.startsWith('User.')) {
        const field = from.slice('User.'.length).trim();
        const known = USER_BINDING_FIELDS.find((candidate) => candidate === field);
        if (!known) return { ok: false, error: `Binding "${name}": a binding may read the caller's ${USER_BINDING_FIELDS.join(', ')}, not "${field}".` };
        return { ok: true, source: { kind: 'user', field: known } };
    }
    return { ok: false, error: `Binding "${name}": From "${from}" is not Anchor:<role>, Space.<column>, Config:<key>, User.ID, User.Email or User.PersonID.` };
}

/** Every source a grant's bindings name, by parameter, or the first thing wrong with them. */
export function bindingSources(bindings: SpaceGrantBindings | null | undefined): { ok: true; sources: Map<string, BindingSource> } | { ok: false; error: string } {
    const sources = new Map<string, BindingSource>();
    for (const [name, expression] of Object.entries(bindings ?? {})) {
        const read = bindingSource(name, expression);
        if (!read.ok) return read;
        sources.set(name, read.source);
    }
    return { ok: true, sources };
}

/** The anchor roles a grant's bindings read, so the server loads those anchors once. */
export function anchorRolesNeeded(sources: ReadonlyMap<string, BindingSource>): string[] {
    const roles = new Set<string>();
    for (const source of sources.values()) if (source.kind === 'anchor') roles.add(source.role.toLowerCase());
    return [...roles];
}

/** Whether a grant's bindings read the caller's Person, which refuses when the caller has none. */
export function needsCallerPerson(sources: ReadonlyMap<string, BindingSource>): boolean {
    for (const source of sources.values()) if (source.kind === 'user' && source.field === 'PersonID') return true;
    return false;
}

/**
 * Reads a dotted path off the effective settings: `Chats.WhoCanStart`, `Extensions.example-chapter.Region`. Returns `undefined`
 * when any step is missing, and refuses to descend into arrays, so a path never reads a list by index.
 */
export function readSettingsPath(settings: ResolvedCollaborationSettings, path: string): string | number | boolean | null | undefined {
    let current: unknown = settings;
    for (const step of path.split('.')) {
        if (current === null || current === undefined || typeof current !== 'object' || Array.isArray(current)) return undefined;
        current = (current as Record<string, unknown>)[step];
    }
    if (current === null) return null;
    if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') return current;
    return undefined;
}

/** The bound parameter names, lower-cased, so a client value for one is refused whatever its case (D27). */
export function boundNames(bindings: SpaceGrantBindings | null | undefined): Set<string> {
    return new Set(Object.keys(bindings ?? {}).map((name) => name.toLowerCase()));
}

/**
 * Judges the values a client sent against a grant's bindings and the target's parameter names: a value for a bound name is
 * refused, as is a value for a name the target does not have. `targetNames` is null when the server does not know them, as for a
 * view's properties before MJ#4789; then only the bound-name rule applies.
 */
export function refuseClientValues(clientValues: Record<string, unknown> | null | undefined, bindings: SpaceGrantBindings | null | undefined, targetNames: readonly string[] | null): string | null {
    if (!clientValues) return null;
    const bound = boundNames(bindings);
    const known = targetNames ? new Set(targetNames.map((name) => name.toLowerCase())) : null;
    for (const name of Object.keys(clientValues)) {
        const key = name.toLowerCase();
        if (bound.has(key)) return `Run refused: "${name}" is bound by the grant, so a value for it is not accepted.`;
        if (known && !known.has(key)) return `Run refused: the target has no parameter or property named "${name}".`;
    }
    return null;
}
