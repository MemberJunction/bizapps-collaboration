import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizationInfo, type IMetadataProvider, type RunViewParams, type RunViewResult, type UserInfo } from '@memberjunction/core';
import { CollaborationEngineBase, type RoleTypeFlags } from '../CollaborationEngineBase.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';
const SEALED = 'C1000001-0000-4000-8000-000000000003';
const CLOSED_NONE = 'C1000001-0000-4000-8000-000000000009';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const TYPE_ID = 'B0000000-0000-4000-8000-000000000001';
const ACTIVE_STATUS = 'E0000000-0000-4000-8000-000000000001';
const ARCHIVED_STATUS = 'E0000000-0000-4000-8000-000000000004';
const OWNER_ROLE = 'A0000000-0000-4000-8000-000000000001';
const MEMBER_ROLE = 'A0000000-0000-4000-8000-000000000002';

interface SpaceRow {
    ID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    OwnerID: string;
    ClosedAt: string | null;
    SpaceTypeID?: string | null;
    StatusID?: string | null;
}
interface SeatRow {
    SpaceID: string;
    UserID: string;
    Status: 'Active';
    Band: 'Team';
    SpaceRoleTypeID: string;
}

const spaces: SpaceRow[] = [
    { ID: NORTHWIND, ParentID: null, InheritsMembership: true, OwnerID: USER_ID, ClosedAt: null },
    { ID: DISCOVERY, ParentID: NORTHWIND, InheritsMembership: true, OwnerID: USER_ID, ClosedAt: null },
    { ID: SEALED, ParentID: NORTHWIND, InheritsMembership: false, OwnerID: USER_ID, ClosedAt: null },
    { ID: CLOSED_NONE, ParentID: null, InheritsMembership: true, OwnerID: OTHER_ID, ClosedAt: '2026-01-01T00:00:00Z', SpaceTypeID: TYPE_ID, StatusID: ARCHIVED_STATUS },
];

/** The type's statuses, as the engine would hold them: Archived hides the space. */
const statuses = [
    { ID: ACTIVE_STATUS, SpaceTypeID: TYPE_ID, Code: 'active', Sequence: 1, IsDefault: true, ReadOnly: false, Visible: true, AgentRetrieval: true, CanChangeAfter: true, IsTerminal: false },
    { ID: ARCHIVED_STATUS, SpaceTypeID: TYPE_ID, Code: 'archived', Sequence: 4, IsDefault: false, ReadOnly: true, Visible: false, AgentRetrieval: false, CanChangeAfter: false, IsTerminal: true },
];

/** A provider whose reads answer from `seats` and `spaces`, or fail on request. */
/** The 'Collaboration' root and its 'Close and Reopen Spaces' child, the child executable by the given roles only. */
function lifecycleAuthorizations(allowedRoles: string[]): AuthorizationInfo[] {
    const root = new AuthorizationInfo();
    root.ID = 'D0000000-0000-4000-8000-000000000001';
    root.Name = 'Collaboration';
    root.IsActive = true;
    const child = new AuthorizationInfo();
    child.ID = 'D0000000-0000-4000-8000-000000000002';
    child.Name = 'Close and Reopen Spaces';
    child.ParentID = root.ID;
    child.IsActive = true;
    Object.defineProperty(child, 'UserCanExecute', { value: (who: UserInfo) => who?.UserRoles?.some((role) => !!role.Role && allowedRoles.includes(role.Role)) ?? false });
    return [root, child];
}

function providerOver(seats: SeatRow[], failSpaces = false, failSeats = false, authorizations: AuthorizationInfo[] = lifecycleAuthorizations(['Space Participant'])): IMetadataProvider {
    const runView = async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
        const ok = (rows: object[]): RunViewResult<T> => ({ Success: true, Results: rows as unknown as T[], RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0, ErrorMessage: '' });
        const fail = (): RunViewResult<T> => ({ Success: false, Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 0, ErrorMessage: 'the read failed' });
        if (params.EntityName.endsWith('Spaces')) {
            if (failSpaces) return fail();
            const id = /'([0-9a-f-]{36})'/i.exec(String(params.ExtraFilter))?.[1]?.toLowerCase();
            return ok(spaces.filter((s) => s.ID.toLowerCase() === id));
        }
        if (failSeats) return fail();
        const ids = [...String(params.ExtraFilter).matchAll(/'([0-9a-f-]{36})'/gi)].map((m) => m[1].toLowerCase());
        return ok(seats.filter((seat) => ids.includes(seat.SpaceID.toLowerCase())));
    };
    return { EntityByName: () => ({}), RunView: runView, Authorizations: authorizations } as unknown as IMetadataProvider;
}

describe('CollaborationEngineBase.ReachedSeat', () => {
    const user = { ID: USER_ID, UserRoles: [{ Role: 'Space Participant' }] } as unknown as UserInfo;
    let engine: CollaborationEngineBase;

    /** The two role types the seats hold, given to the walk directly instead of loaded into the engine. */
    const roleTypes: Record<string, RoleTypeFlags> = {
        [OWNER_ROLE.toLowerCase()]: { Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
        [MEMBER_ROLE.toLowerCase()]: { Level: 20, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true },
    };
    const roleTypeOf = (id: string): RoleTypeFlags | undefined => roleTypes[id.toLowerCase()];

    const reachedSeat = (spaceId: string, provider: IMetadataProvider) => engine.ReachedSeat(user, spaceId, provider, roleTypeOf);

    beforeEach(() => {
        engine = CollaborationEngineBase.Instance;
        const internals = engine as unknown as Record<string, unknown>;
        internals['_spaceTypeStatuses'] = statuses;
        internals['_statusesById'] = null;
        internals['_statusesByType'] = null;
    });

    const seat = (spaceId: string, roleId: string): SeatRow => ({ SpaceID: spaceId, UserID: USER_ID, Status: 'Active', Band: 'Team', SpaceRoleTypeID: roleId });

    it('finds an owner seat held on an ancestor the space inherits from', async () => {
        const reached = await reachedSeat(DISCOVERY, providerOver([seat(NORTHWIND, OWNER_ROLE)]));
        expect(reached?.role.isOwnerRole).toBe(true);
        expect(reached?.spaceId.toLowerCase()).toBe(NORTHWIND.toLowerCase());
    });

    it('prefers a seat held on the space itself over one inherited from above', async () => {
        const reached = await reachedSeat(DISCOVERY, providerOver([seat(NORTHWIND, OWNER_ROLE), seat(DISCOVERY, MEMBER_ROLE)]));
        expect(reached?.role.isOwnerRole).toBe(false);
        expect(reached?.spaceId.toLowerCase()).toBe(DISCOVERY.toLowerCase());
    });

    it("ends the walk at a sealed space: a seat above it doesn't reach it", async () => {
        const reached = await reachedSeat(SEALED, providerOver([seat(NORTHWIND, OWNER_ROLE)]));
        expect(reached).toBeNull();
    });

    it('is null for a person with no seat anywhere on the walk', async () => {
        expect(await reachedSeat(DISCOVERY, providerOver([]))).toBeNull();
    });

    it('is null, not a guess, when the space read fails', async () => {
        expect(await reachedSeat(DISCOVERY, providerOver([seat(NORTHWIND, OWNER_ROLE)], true))).toBeNull();
    });

    it('is null, not a guess, when the seats read fails', async () => {
        expect(await reachedSeat(DISCOVERY, providerOver([seat(NORTHWIND, OWNER_ROLE)], false, true))).toBeNull();
    });

    it('is null for an id that is not a UUID', async () => {
        expect(await reachedSeat("x'; DROP TABLE Space; --", providerOver([]))).toBeNull();
    });

    it("reopens a space whose post-close access ended, for an owner, though the owner no longer reaches it to configure it", async () => {
        const provider = providerOver([seat(CLOSED_NONE, OWNER_ROLE)]);
        expect(await reachedSeat(CLOSED_NONE, provider)).toBeNull();
        expect(await engine.UserCanReopenSpace(user, CLOSED_NONE, provider, roleTypeOf)).toBe(true);
    });

    it("gives an owner no reopen right without the 'Close and Reopen Spaces' authorization, though the seat is right", async () => {
        const without = providerOver([seat(CLOSED_NONE, OWNER_ROLE), seat(DISCOVERY, OWNER_ROLE)], false, false, lifecycleAuthorizations(['Developer']));
        expect(await engine.UserCanReopenSpace(user, CLOSED_NONE, without, roleTypeOf)).toBe(false);
        expect(await engine.UserCanCloseSpace(user, DISCOVERY, without, roleTypeOf)).toBe(false);
        // The same owner, with the authorization, may close the open space they hold a seat on: the seat is right, so the authorization decides
        const withIt = providerOver([seat(DISCOVERY, OWNER_ROLE)], false, false, lifecycleAuthorizations(['Space Participant']));
        expect(await engine.UserCanCloseSpace(user, DISCOVERY, withIt, roleTypeOf)).toBe(true);
        const notWithIt = providerOver([seat(DISCOVERY, OWNER_ROLE)], false, false, lifecycleAuthorizations(['Developer']));
        expect(await engine.UserCanCloseSpace(user, DISCOVERY, notWithIt, roleTypeOf)).toBe(false);
    });

    it('gives no reopen right to a member who does not own the archived space, or to someone with no seat', async () => {
        expect(await engine.UserCanReopenSpace(user, CLOSED_NONE, providerOver([seat(CLOSED_NONE, MEMBER_ROLE)]), roleTypeOf)).toBe(false);
        expect(await engine.UserCanReopenSpace(user, CLOSED_NONE, providerOver([]), roleTypeOf)).toBe(false);
    });
});
