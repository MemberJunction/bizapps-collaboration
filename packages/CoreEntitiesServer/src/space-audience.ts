/**
 * The staff-only promise (stage 1, item 157). A type that declares `Seats.Audience: 'StaffOnly'` may carry grants of a view,
 * a query or a component, because no participant will reach its spaces. That is the type's promise, and it is checked where
 * it could break: a seat whose role cannot see the Team band, a Space Participant link, and a space of the type inheriting
 * membership from a parent that participants reach. The reach test is the same one the resolver and the turn use: a space
 * "seats participants" when an active seat whose role cannot see Team reaches it, on the space itself or on an ancestor while
 * each space between inherits membership.
 */
import { RunView, type UserInfo } from '@memberjunction/core';
import { type CollaborationSettings, typeSeatsAudience } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { parseUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';

export type SeatsAudience = 'StaffOnly' | 'StaffAndParticipants';

interface SpaceLink { ID: string; ParentID: string | null; InheritsMembership: boolean }

/** Who a type seats, from its configuration as the engine holds it. Absent, unreadable or unknown fails closed to StaffAndParticipants. */
export function spaceTypeAudience(typeId: string | null | undefined): SeatsAudience {
    const id = parseUuid(typeId ?? '');
    const type = id ? CollaborationEngine.Instance.SpaceTypeById(id) : undefined;
    if (!type?.Configuration) return 'StaffAndParticipants';
    try {
        return typeSeatsAudience(JSON.parse(type.Configuration) as CollaborationSettings);
    } catch {
        return 'StaffAndParticipants';
    }
}

/**
 * Whether participants reach a space: an Active seat whose role cannot see the Team band, on the space or on an ancestor
 * while each space between inherits membership. Read as the system user, since the caller may not see every seat. Throws
 * when a read fails, so a caller fails closed.
 */
export async function spaceSeatsParticipants(rv: RunView, system: UserInfo, spaceId: string): Promise<boolean> {
    const start = parseUuid(spaceId);
    if (!start) return false;
    const chain: string[] = [];
    const seen = new Set<string>();
    let current: string | null = start;
    while (current && !seen.has(current)) {
        seen.add(current);
        const rows: SpaceLink[] = await read<SpaceLink>(rv, system, SPACES, `ID = '${current}'`, ['ID', 'ParentID', 'InheritsMembership']);
        const row: SpaceLink | undefined = rows[0];
        if (!row) break;
        chain.push(current);
        current = row.InheritsMembership && row.ParentID ? parseUuid(row.ParentID) : null;
    }
    if (!chain.length) return false;
    const seats = await read<{ SpaceRoleTypeID: string }>(rv, system, MEMBERS, `SpaceID IN (${chain.map((id) => `'${id}'`).join(', ')}) AND Status = 'Active'`, ['SpaceRoleTypeID']);
    const roleIds = [...new Set(seats.map((seat) => parseUuid(seat.SpaceRoleTypeID)).filter((id): id is string => !!id))];
    if (!roleIds.length) return false;
    const engine = CollaborationEngine.Instance;
    const canSeeTeam = new Map<string, boolean>();
    const missing: string[] = [];
    for (const id of roleIds) {
        const role = engine.SpaceRoleTypeById(id);
        if (role) canSeeTeam.set(id, !!role.CanSeeTeamBand);
        else missing.push(id);
    }
    if (missing.length) {
        const rows = await read<{ ID: string; CanSeeTeamBand: boolean }>(rv, system, ROLES, `ID IN (${missing.map((id) => `'${id}'`).join(', ')})`, ['ID', 'CanSeeTeamBand']);
        for (const row of rows) canSeeTeam.set(parseUuid(row.ID) ?? row.ID, !!row.CanSeeTeamBand);
    }
    // A role that cannot be read is judged as one that cannot see Team: the promise fails closed
    return roleIds.some((id) => canSeeTeam.get(id) !== true);
}

async function read<T>(rv: RunView, user: UserInfo, entityName: string, filter: string, fields: string[]): Promise<T[]> {
    const result = await rv.RunView<T>({ EntityName: entityName, ExtraFilter: filter, Fields: fields, ResultType: 'simple', MaxRows: 2000 }, user);
    if (!result.Success) throw new Error(result.ErrorMessage ?? `Could not read ${entityName}.`);
    if ((result.Results?.length ?? 0) >= 2000) throw new Error(`Refusing the write: ${entityName} returned a full page, so the check would be incomplete.`);
    return result.Results ?? [];
}
