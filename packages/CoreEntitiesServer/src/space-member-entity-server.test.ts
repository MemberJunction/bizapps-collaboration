import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { BaseEntity, WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { BaseSpaceTypeServerDriver, type DriverValidationResult, type MemberChangeContext } from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import { decideMemberKind, SpaceMemberEntityServer } from '../dist/SpaceMemberEntityServer.js';

const LEAVER = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE1';
const OWNER = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE9';
const SPACE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';
const MEMBER_ROLE = '7F565CD3-5E5C-4073-AD3D-55EFE85B0D40';
const OWNER_ROLE = '69090145-C214-4C16-83C5-9D0F1F3B6DE4';
const TYPE = 'C76A0ACA-CBF8-43AD-A996-9296CDA681BE';

const roles = [
    { ID: OWNER_ROLE, Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
    { ID: MEMBER_ROLE, Level: 20, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true },
];
const members = [
    { ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEF1', SpaceID: SPACE, UserID: LEAVER, Status: 'Active', Band: 'Team', SpaceRoleTypeID: MEMBER_ROLE },
    { ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEF2', SpaceID: SPACE, UserID: OWNER, Status: 'Active', Band: 'Team', SpaceRoleTypeID: OWNER_ROLE },
];

function select(entityName: string, filter = ''): unknown[] {
    if (entityName.endsWith('Space Members')) {
        if (filter.includes('<>')) return members.filter((row) => row.Status !== 'Removed');
        if (filter.includes("Status = 'Active'")) return members.filter((row) => row.Status === 'Active' && filter.toLowerCase().includes(row.SpaceRoleTypeID.toLowerCase()));
        return members.filter((row) => filter.toLowerCase().includes(row.UserID.toLowerCase()));
    }
    if (entityName.endsWith('Space Role Types')) {
        if (filter.includes('IsOwnerRole')) return roles.filter((row) => row.IsOwnerRole);
        return roles.filter((row) => filter.toLowerCase().includes(row.ID.toLowerCase()));
    }
    if (entityName.endsWith('Space Types')) return [{ ID: TYPE, InviteApproval: 'Approve', MemberCap: null }];
    if (entityName.endsWith('Spaces')) return [{ ID: SPACE, ParentID: null, InheritsMembership: true, OwnerID: OWNER, AgentRetrieval: 'Included', SpaceTypeID: TYPE }];
    return [];
}

const provider = {
    async RunView(params: { EntityName: string; ExtraFilter?: string }) {
        return { Success: true, Results: select(params.EntityName, params.ExtraFilter ?? '') };
    },
    async RunViews(params: { EntityName: string; ExtraFilter?: string }[]) {
        return params.map((item) => ({ Success: true, Results: select(item.EntityName, item.ExtraFilter ?? '') }));
    },
    GetEntityObject() { return undefined; },
    EntityByID() { return { Name: 'x' }; },
};

/** A stand-in for an entity the resolver only passes through. */
function stubOf<T extends object>(partial: Partial<T>): T {
    return partial as T;
}

/** A driver that records the seat changes it is asked to judge, and answers as told. */
class SpyDriver extends BaseSpaceTypeServerDriver {
    public judged: MemberChangeContext[] = [];
    private readonly answer: DriverValidationResult;
    constructor(answer: DriverValidationResult) {
        super();
        this.answer = answer;
    }
    public heard: MemberChangeContext[] = [];
    public override ValidateMemberChange(ctx: MemberChangeContext): DriverValidationResult {
        this.judged.push(ctx);
        return this.answer;
    }
    public override OnMemberChanged(ctx: MemberChangeContext): void {
        this.heard.push(ctx);
    }
}

describe('a member leaving a space', () => {
    let systemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let resolveSpace: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    let driver: SpyDriver = new SpyDriver({ ok: true });

    before(() => {
        systemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
        const registry = ServerDriverRegistry.Instance;
        resolveSpace = registry.ResolveSpaceAndType.bind(registry);
        registry.ResolveSpaceAndType = async () => ({
            driver,
            space: stubOf<mjBizAppsCollaborationSpaceEntity>({}),
            spaceType: stubOf<mjBizAppsCollaborationSpaceTypeEntity>({}),
        });
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = systemUser;
        ServerDriverRegistry.Instance.ResolveSpaceAndType = resolveSpace;
    });

    /** The leaver's own seat, saved as Removed by the leaver: the one-field self-removal the invite rules let through. */
    function leaving() {
        const seat = Object.create(SpaceMemberEntityServer.prototype) as SpaceMemberEntityServer;
        Object.defineProperties(seat, {
            ContextCurrentUser: { value: { ID: LEAVER, Name: 'Leaver', UserRoles: [] }, writable: true },
            IsSaved: { value: true, writable: true },
            ID: { value: members[0].ID, writable: true },
            UserID: { value: LEAVER, writable: true },
            SpaceID: { value: SPACE, writable: true },
            SpaceRoleTypeID: { value: MEMBER_ROLE, writable: true },
            Status: { value: 'Removed', writable: true },
            Band: { value: 'Team', writable: true },
            Fields: {
                value: [
                    { Name: 'Status', Dirty: true, OldValue: 'Active', Value: 'Removed' },
                    { Name: 'SpaceRoleTypeID', Dirty: false, OldValue: MEMBER_ROLE, Value: MEMBER_ROLE },
                ],
                writable: true,
            },
            RunViewProviderToUse: { value: provider, writable: true },
            ProviderToUse: { value: provider, writable: true },
        });
        return seat;
    }

    it("is judged by the space type's driver, as a Remove", async () => {
        driver = new SpyDriver({ ok: true });
        const res = await SpaceMemberEntityServer.prototype.ValidateAsync.call(leaving());
        assert.equal(res.Errors.length, 0, res.Errors.map((e) => e.Message).join('; '));
        assert.equal(driver.judged.length, 1);
        assert.equal(driver.judged[0].kind, 'Remove');
    });

    it('is refused when the space type refuses it', async () => {
        driver = new SpyDriver({ ok: false, field: 'Status', message: 'A board member may not leave mid-term.' });
        const res = await SpaceMemberEntityServer.prototype.ValidateAsync.call(leaving());
        assert.equal(res.Success, false);
        assert.equal(res.Errors.find((e) => e.Source === 'Status')?.Message, 'A board member may not leave mid-term.');
        assert.equal(driver.judged.length, 1);
    });

    it('is refused, closed, when the space type cannot be resolved', async () => {
        const registry = ServerDriverRegistry.Instance;
        const held = registry.ResolveSpaceAndType;
        registry.ResolveSpaceAndType = async () => {
            throw new Error('The space type has no driver.');
        };
        try {
            const res = await SpaceMemberEntityServer.prototype.ValidateAsync.call(leaving());
            assert.equal(res.Success, false);
            assert.equal(res.Errors.find((e) => e.Source === 'SpaceID')?.Message, 'The space type has no driver.');
        } finally {
            registry.ResolveSpaceAndType = held;
        }
    });
});

describe('a seat being deleted', () => {
    let systemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let resolveSpace: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    let driver: SpyDriver = new SpyDriver({ ok: true });

    before(() => {
        systemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
        resolveSpace = ServerDriverRegistry.Instance.ResolveSpaceAndType.bind(ServerDriverRegistry.Instance);
        ServerDriverRegistry.Instance.ResolveSpaceAndType = async () => ({
            driver,
            space: stubOf<mjBizAppsCollaborationSpaceEntity>({}),
            spaceType: stubOf<mjBizAppsCollaborationSpaceTypeEntity>({}),
        });
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = systemUser;
        ServerDriverRegistry.Instance.ResolveSpaceAndType = resolveSpace;
    });

    function seat() {
        const entity = Object.create(SpaceMemberEntityServer.prototype) as SpaceMemberEntityServer;
        const history: unknown[] = [];
        Object.defineProperties(entity, {
            ContextCurrentUser: { value: { ID: OWNER, Name: 'Owner', UserRoles: [] }, writable: true },
            IsSaved: { value: true, writable: true },
            ID: { value: members[0].ID, writable: true },
            SpaceID: { value: SPACE, writable: true },
            ProviderToUse: { value: provider, writable: true },
            RegisterResultHistoryEntry: { value: (entry: unknown) => history.push(entry), writable: true },
        });
        return { entity, history };
    }

    it("is judged by the space type's driver, as a Remove, and refused when the type says no", async () => {
        driver = new SpyDriver({ ok: false, message: 'A board seat can only be removed by vote.' });
        const { entity, history } = seat();
        const deleted = await SpaceMemberEntityServer.prototype.Delete.call(entity);
        assert.equal(deleted, false);
        assert.equal(driver.judged.length, 1);
        assert.equal(driver.judged[0].kind, 'Remove');
        assert.match(JSON.stringify(history), /removed by vote/);
    });

    it('is refused when the space type cannot be resolved', async () => {
        const registry = ServerDriverRegistry.Instance;
        const held = registry.ResolveSpaceAndType;
        registry.ResolveSpaceAndType = async () => { throw new Error('The space type has no driver.'); };
        try {
            const { entity } = seat();
            assert.equal(await SpaceMemberEntityServer.prototype.Delete.call(entity), false);
        } finally {
            registry.ResolveSpaceAndType = held;
        }
    });
});

describe('the kind of change a seat save is', () => {
    const base = { isNew: false, status: 'Active', statusChanged: false, roleChanged: false, bandChanged: false };

    it('names a removal, a role change and a band change from what changed', () => {
        assert.equal(decideMemberKind({ ...base, status: 'Removed', statusChanged: true }), 'Remove');
        assert.equal(decideMemberKind({ ...base, roleChanged: true }), 'RoleChange');
        assert.equal(decideMemberKind({ ...base, bandChanged: true }), 'BandChange');
    });

    it('calls a new seat, an approval and a reinstatement an Invite: they have no kind of their own', () => {
        assert.equal(decideMemberKind({ ...base, isNew: true }), 'Invite');
        assert.equal(decideMemberKind({ ...base, statusChanged: true }), 'Invite');
        assert.equal(decideMemberKind({ ...base, isNew: true, status: 'Removed' }), 'Remove');
    });

    it('gives a save that touches no status, role or band no kind, so it raises no seat reaction', () => {
        assert.equal(decideMemberKind(base), null);
    });
});

describe('a seat saved through its own validation', () => {
    let systemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let resolveSpace: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    let baseSave: typeof BaseEntity.prototype.Save;
    let driver = new SpyDriver({ ok: true });
    let lastRefusal = '';

    before(() => {
        systemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
        const registry = ServerDriverRegistry.Instance;
        resolveSpace = registry.ResolveSpaceAndType.bind(registry);
        registry.ResolveSpaceAndType = async () => ({
            driver,
            space: stubOf<mjBizAppsCollaborationSpaceEntity>({}),
            spaceType: stubOf<mjBizAppsCollaborationSpaceTypeEntity>({ Code: 'example' }),
        });
        // MJ's Save runs the class's own validation and, when it passes, writes; here the write is a return
        baseSave = BaseEntity.prototype.Save;
        BaseEntity.prototype.Save = async function (this: BaseEntity) {
            const validation = await this.ValidateAsync();
            lastRefusal = validation.Errors.map((e) => e.Message).join('; ');
            return validation.Success;
        };
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = systemUser;
        ServerDriverRegistry.Instance.ResolveSpaceAndType = resolveSpace;
        BaseEntity.prototype.Save = baseSave;
    });

    /** The leaver's seat, edited by the space's owner. `values` are what the save leaves in the fields; `dirty` says which changed, and from what. */
    function editedSeat(values: { Status: string; Band: string; SpaceRoleTypeID: string }, dirty: Array<{ Name: string; OldValue: string }>, isSaved = true) {
        const seat = Object.create(SpaceMemberEntityServer.prototype) as SpaceMemberEntityServer;
        const fields = ['Status', 'Band', 'SpaceRoleTypeID'].map((Name) => {
            const change = dirty.find((d) => d.Name === Name);
            return { Name, Dirty: !!change, OldValue: change?.OldValue ?? (values as Record<string, string>)[Name], Value: (values as Record<string, string>)[Name] };
        });
        Object.defineProperties(seat, {
            ContextCurrentUser: { value: { ID: OWNER, Name: 'Owner', UserRoles: [] }, writable: true },
            IsSaved: { value: isSaved, writable: true },
            ID: { value: members[0].ID, writable: true },
            UserID: { value: LEAVER, writable: true },
            SpaceID: { value: SPACE, writable: true },
            PersonID: { value: null, writable: true },
            SpaceRoleTypeID: { value: values.SpaceRoleTypeID, writable: true },
            Status: { value: values.Status, writable: true },
            Band: { value: values.Band, writable: true },
            Fields: { value: fields, writable: true },
            RunViewProviderToUse: { value: provider, writable: true },
            ProviderToUse: { value: provider, writable: true },
        });
        return seat;
    }

    it('tells the driver, when it is asked to judge and when it is told, the same kind and the same old values, for a band edit the gate puts back', async () => {
        driver = new SpyDriver({ ok: true });
        // Asked for Shared on a role that sees the Team band: the gate sets Team again, and the kind is still what the save asked for
        const seat = editedSeat({ Status: 'Active', Band: 'Shared', SpaceRoleTypeID: MEMBER_ROLE }, [{ Name: 'Band', OldValue: 'Team' }]);
        assert.equal(await seat.Save(), true, lastRefusal);
        assert.deepEqual(driver.judged.map((c) => c.kind), ['BandChange']);
        assert.deepEqual(driver.heard.map((c) => c.kind), ['BandChange']);
        assert.deepEqual(driver.judged[0].oldValues, { Band: 'Team' });
        assert.deepEqual(driver.heard[0].oldValues, driver.judged[0].oldValues);
    });

    it('tells the driver an Invite, both times, for an approval whose band no longer matches the role', async () => {
        driver = new SpyDriver({ ok: true });
        const seat = editedSeat({ Status: 'Active', Band: 'Shared', SpaceRoleTypeID: MEMBER_ROLE }, [{ Name: 'Status', OldValue: 'Invited' }, { Name: 'Band', OldValue: 'Team' }]);
        assert.equal(await seat.Save(), true, lastRefusal);
        assert.deepEqual(driver.judged.map((c) => c.kind), ['Invite']);
        assert.deepEqual(driver.heard.map((c) => c.kind), ['Invite']);
        assert.deepEqual(driver.heard[0].oldValues, driver.judged[0].oldValues);
    });

    it('tells the driver an Invite, both times, for a new seat whose band differs from its role: the gate derives the band, the kind is what was asked', async () => {
        driver = new SpyDriver({ ok: true });
        // A new seat asked to sit on Shared under a role that sees the Team band; the gate sets Team
        const seat = editedSeat({ Status: 'Active', Band: 'Shared', SpaceRoleTypeID: MEMBER_ROLE }, [], false);
        assert.equal(await seat.Save(), true, lastRefusal);
        assert.deepEqual(driver.judged.map((c) => c.kind), ['Invite']);
        assert.deepEqual(driver.heard.map((c) => c.kind), ['Invite']);
        assert.deepEqual(driver.judged[0].oldValues, {});
        assert.deepEqual(driver.heard[0].oldValues, {});
        assert.equal(driver.judged[0].member.Band, 'Team', 'the driver is asked with the band the gate derived');
    });

    it('says nothing to the driver, asked or told, when the save touches no status, role or band', async () => {
        driver = new SpyDriver({ ok: true });
        const seat = editedSeat({ Status: 'Active', Band: 'Team', SpaceRoleTypeID: MEMBER_ROLE }, []);
        (seat.Fields as Array<{ Name: string; Dirty: boolean; OldValue?: unknown; Value?: unknown }>).push({ Name: 'SyncSource', Dirty: true, OldValue: null, Value: 'import' });
        assert.equal(await seat.Save(), true, lastRefusal);
        assert.deepEqual(driver.judged, []);
        assert.deepEqual(driver.heard, []);
    });

    it('starts each save clean: a refused save leaves no reading for the next', async () => {
        driver = new SpyDriver({ ok: false, message: 'No band changes this term.' });
        const refused = editedSeat({ Status: 'Active', Band: 'Shared', SpaceRoleTypeID: MEMBER_ROLE }, [{ Name: 'Band', OldValue: 'Team' }]);
        assert.equal(await refused.Save(), false);
        assert.deepEqual(driver.heard, []);
        driver = new SpyDriver({ ok: true });
        assert.equal(await refused.Save(), true);
        assert.deepEqual(driver.heard.map((c) => c.kind), ['BandChange']);
    });
});
