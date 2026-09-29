import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { BaseSpaceTypeServerDriver, type DriverValidationResult, type MemberChangeContext } from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import { reportedMemberChangeKind, SpaceMemberEntityServer } from '../dist/SpaceMemberEntityServer.js';

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
    public override ValidateMemberChange(ctx: MemberChangeContext): DriverValidationResult {
        this.judged.push(ctx);
        return this.answer;
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

describe('the kind of change the driver hears about after a save', () => {
    it('is the kind validation decided, which the saved row no longer shows', () => {
        assert.equal(reportedMemberChangeKind('BandChange', 'Active', false), 'BandChange');
        assert.equal(reportedMemberChangeKind('Remove', 'Active', false), 'Remove');
    });

    it('is worked out from the saved row when validation did not run', () => {
        assert.equal(reportedMemberChangeKind(null, 'Removed', false), 'Remove');
        assert.equal(reportedMemberChangeKind(null, 'Active', true), 'Invite');
        assert.equal(reportedMemberChangeKind(null, 'Active', false), 'RoleChange');
    });
});
