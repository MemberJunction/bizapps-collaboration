/**
 * `ResolveBindings` (B17, D27): the server fills in a grant's bound values when the granted thing runs. `Anchor:<role>` is the record
 * id of the space's anchor with that role (none, or two, refuses); `Anchor:<role>.<Field>` reads that field of the anchored record as
 * the system user, since the caller never sees the value; `Space.<Field>` reads the space; `Config:<path>` reads the effective
 * settings; `User.ID`, `User.Email` and `User.PersonID` describe the caller (no linked Person refuses); a `Value` is used as it is.
 * A binding that does not resolve refuses the run: nothing runs unbound.
 */
import { type IMetadataProvider, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import {
    anchorRolesNeeded,
    type BindingSource,
    bindingSources,
    type EffectiveGrant,
    type EffectiveSpaceConfiguration,
    needsCallerPerson,
    readSettingsPath,
    SPACE_BINDING_FIELDS,
} from '@mj-biz-apps/collaboration-core';
import { parseUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const ANCHORS = 'MJ_BizApps_Collaboration: Space Anchors';
const PEOPLE = 'MJ_BizApps_Common: People';

export type BoundValue = string | number | boolean | null;

export type ResolveBindingsOutcome =
    | { ok: true; values: Record<string, BoundValue>; sources: Record<string, string> }
    | { ok: false; message: string };

interface AnchorRow { ID: string; EntityID: string; RecordID: string; Role: string }

const refuse = (message: string): ResolveBindingsOutcome => ({ ok: false, message: `Run refused: ${message}` });

/** Resolves every binding of a grant for a run in `spaceId` by `user`. */
export async function resolveBindings(provider: IMetadataProvider, user: UserInfo, spaceId: string, grant: Pick<EffectiveGrant, 'GrantID' | 'Bindings'>, configuration: EffectiveSpaceConfiguration): Promise<ResolveBindingsOutcome> {
    const space = parseUuid(spaceId);
    if (!space) return refuse('the space id is not valid.');
    const read = bindingSources(grant.Bindings);
    if (!read.ok) return refuse(read.error);
    if (!read.sources.size) return { ok: true, values: {}, sources: {} };

    const system = (await WellKnownUserSource.Instance.GetSystemUser(provider)) ?? user;
    const rv = RunView.FromMetadataProvider(provider);

    // The anchors the bindings name, read once: exactly one per role
    const anchors = new Map<string, AnchorRow>();
    const roles = anchorRolesNeeded(read.sources);
    if (roles.length) {
        const rows = await rv.RunView<AnchorRow>({
            EntityName: ANCHORS,
            ExtraFilter: `SpaceID = '${space}' AND Role IN (${roles.map((role) => `'${role.replace(/'/g, "''")}'`).join(', ')})`,
            Fields: ['ID', 'EntityID', 'RecordID', 'Role'],
            ResultType: 'simple',
            MaxRows: 200,
        }, system);
        if (!rows.Success) return refuse(`the space's anchors could not be read: ${rows.ErrorMessage ?? 'unknown error'}`);
        for (const role of roles) {
            const matching = (rows.Results ?? []).filter((row) => row.Role.trim().toLowerCase() === role);
            if (matching.length === 0) return refuse(`the space has no anchor with the role "${role}", which grant ${grant.GrantID} binds to.`);
            if (matching.length > 1) return refuse(`the space has ${matching.length} anchors with the role "${role}"; a binding needs exactly one.`);
            anchors.set(role, matching[0]);
        }
    }

    // The space's own row, read once when a binding names it
    let spaceRow: Record<string, unknown> | null = null;
    if ([...read.sources.values()].some((source) => source.kind === 'space')) {
        const rows = await rv.RunView<Record<string, unknown>>({ EntityName: SPACES, ExtraFilter: `ID = '${space}'`, Fields: [...SPACE_BINDING_FIELDS], ResultType: 'simple', MaxRows: 1 }, system);
        if (!rows.Success || !rows.Results?.[0]) return refuse(`the space could not be read: ${rows.ErrorMessage ?? 'not found'}`);
        spaceRow = rows.Results[0];
    }

    // The caller's Person, when a binding names it
    let personId: string | null = null;
    if (needsCallerPerson(read.sources)) {
        const rows = await rv.RunView<{ ID: string }>({ EntityName: PEOPLE, ExtraFilter: `LinkedUserID = '${parseUuid(user.ID)}'`, Fields: ['ID'], ResultType: 'simple', MaxRows: 2 }, system);
        if (!rows.Success) return refuse(`the caller's Person could not be read: ${rows.ErrorMessage ?? 'unknown error'}`);
        if ((rows.Results?.length ?? 0) !== 1) return refuse('the caller has no linked Person, which the grant binds to.');
        personId = rows.Results![0].ID;
    }

    const values: Record<string, BoundValue> = {};
    const sources: Record<string, string> = {};
    for (const [name, source] of read.sources) {
        const resolved = await valueOf(provider, system, source, { anchors, spaceRow, personId, user, configuration });
        if (!resolved.ok) return refuse(`binding "${name}": ${resolved.message}`);
        values[name] = resolved.value;
        sources[name] = describe(source);
    }
    return { ok: true, values, sources };
}

/** A source as the log names it: where the value came from, never the value itself. */
function describe(source: BindingSource): string {
    switch (source.kind) {
        case 'anchor': return source.field ? `Anchor:${source.role}.${source.field}` : `Anchor:${source.role}`;
        case 'space': return `Space.${source.field}`;
        case 'config': return `Config:${source.path}`;
        case 'user': return `User.${source.field}`;
        case 'value': return 'Value';
    }
}

interface Materials { anchors: Map<string, AnchorRow>; spaceRow: Record<string, unknown> | null; personId: string | null; user: UserInfo; configuration: EffectiveSpaceConfiguration }

async function valueOf(provider: IMetadataProvider, system: UserInfo, source: BindingSource, materials: Materials): Promise<{ ok: true; value: BoundValue } | { ok: false; message: string }> {
    switch (source.kind) {
        case 'value':
            return { ok: true, value: source.value };
        case 'user':
            if (source.field === 'ID') return { ok: true, value: materials.user.ID };
            if (source.field === 'Email') return materials.user.Email ? { ok: true, value: materials.user.Email } : { ok: false, message: 'the caller has no email.' };
            return materials.personId ? { ok: true, value: materials.personId } : { ok: false, message: 'the caller has no linked Person.' };
        case 'config': {
            const value = readSettingsPath(materials.configuration.Settings, source.path);
            if (value === undefined) return { ok: false, message: `the effective settings have no value at ${source.path}.` };
            return { ok: true, value };
        }
        case 'space': {
            const raw = materials.spaceRow?.[source.field];
            if (raw === undefined) return { ok: false, message: `the space has no ${source.field}.` };
            return { ok: true, value: scalar(raw) };
        }
        case 'anchor': {
            const anchor = materials.anchors.get(source.role.toLowerCase());
            if (!anchor) return { ok: false, message: `no anchor with the role "${source.role}".` };
            const entity = provider.EntityByID(anchor.EntityID);
            if (!entity) return { ok: false, message: `the anchored record's entity ${anchor.EntityID} is not in this provider's metadata.` };
            // An anchor spells its record `<PK>|<value>` (MJ's composite form); the bound value is the record's key, as a parameter takes it
            if (!source.field) return { ok: true, value: keyValueOf(entity, anchor.RecordID) };
            const field = entity.Fields.find((f) => f.Name.toLowerCase() === source.field!.toLowerCase());
            if (!field) return { ok: false, message: `${entity.Name} has no field named ${source.field}.` };
            if (entity.PrimaryKeys.length !== 1) return { ok: false, message: `${entity.Name} has a composite key, which an anchor binding does not read yet.` };
            const rows = await RunView.FromMetadataProvider(provider).RunView<Record<string, unknown>>({
                EntityName: entity.Name,
                ExtraFilter: `[${entity.PrimaryKeys[0].Name}] = '${keyValueOf(entity, anchor.RecordID).replace(/'/g, "''")}'`,
                Fields: [field.Name],
                ResultType: 'simple',
                MaxRows: 1,
            }, system);
            if (!rows.Success) return { ok: false, message: `the anchored ${entity.Name} could not be read: ${rows.ErrorMessage ?? 'unknown error'}` };
            const row = rows.Results?.[0];
            if (!row) return { ok: false, message: `the anchored ${entity.Name} ${anchor.RecordID} no longer exists.` };
            return { ok: true, value: scalar(row[field.Name]) };
        }
    }
}

/** The key value an anchor's RecordID spells: `ID|<value>` for a single-key entity gives `<value>`; anything else is taken as it is. */
function keyValueOf(entity: { PrimaryKeys: Array<{ Name: string }> }, recordId: string): string {
    const raw = recordId.trim();
    if (entity.PrimaryKeys.length === 1) {
        const prefix = `${entity.PrimaryKeys[0].Name}|`;
        if (raw.toLowerCase().startsWith(prefix.toLowerCase())) return raw.slice(prefix.length);
    }
    return raw;
}

function scalar(raw: unknown): BoundValue {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
    if (raw instanceof Date) return raw.toISOString();
    return String(raw);
}
