import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type UserInfo, type UserRoleInfo } from '@memberjunction/core';
import { isStaffUser, STAFF_ROLES } from '../dist/load-graph.js';
import { SpaceEntityServer } from '../dist/SpaceEntityServer.js';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { membershipReaches, type SpaceNode, type MemberSnapshot } from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';

describe('isStaffUser', () => {
    it('returns true for UI, Developer, and Integration roles', () => {
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'UI' }] }), true);
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Developer' }] }), true);
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Integration' }] }), true);
    });

    it('returns false for Space Participant, empty roles, or null', () => {
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Space Participant' }] }), false);
        assert.equal(isStaffUser({ UserRoles: [] }), false);
        assert.equal(isStaffUser(null), false);
        assert.equal(isStaffUser(undefined), false);
    });
});

describe('SpaceEntityServer staff-only edit gate', () => {
    const participantUser = {
        ID: '11111111-1111-4111-8111-111111111111',
        UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    const staffUser = {
        ID: '22222222-2222-4222-8222-222222222222',
        UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    function mockSpace(user: UserInfo, isSaved: boolean, dirtyFieldName: string) {
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        Object.defineProperties(space, {
            ContextCurrentUser: { value: user, writable: true },
            IsSaved: { value: isSaved, writable: true },
            ID: { value: '33333333-3333-4333-8333-333333333333', writable: true },
            OwnerID: { value: user.ID, writable: true },
            ParentID: { value: null, writable: true },
            Fields: {
                value: [
                    { Name: dirtyFieldName, Dirty: true, OldValue: false, Value: true },
                    { Name: 'OwnerID', Dirty: false },
                ],
                writable: true,
            },
        });
        return space;
    }

    it('refuses a participant owner editing AllowParentAssignees', async () => {
        const space = mockSpace(participantUser, true, 'AllowParentAssignees');
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'AllowParentAssignees');
        assert.ok(err, 'Expected error on AllowParentAssignees');
        assert.equal(err?.Message, 'Space change refused: only staff may change the allow-parent-assignees setting.');
    });

    it('refuses a participant owner editing AgentRetrieval', async () => {
        const space = mockSpace(participantUser, true, 'AgentRetrieval');
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'AgentRetrieval');
        assert.ok(err, 'Expected error on AgentRetrieval');
        assert.equal(err?.Message, 'Space change refused: only staff may change the agent retrieval setting.');
    });

    it('allows staff to edit AllowParentAssignees without setting refusal', async () => {
        const space = mockSpace(staffUser, true, 'AllowParentAssignees');
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        const err = res.Errors.find((e) => e.Source === 'AllowParentAssignees');
        assert.equal(err, undefined, 'Staff should not be refused for AllowParentAssignees');
    });

    it('allows staff to edit AgentRetrieval without setting refusal', async () => {
        const space = mockSpace(staffUser, true, 'AgentRetrieval');
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        const err = res.Errors.find((e) => e.Source === 'AgentRetrieval');
        assert.equal(err, undefined, 'Staff should not be refused for AgentRetrieval');
    });
});

describe('SpaceEntityServer create path validation', () => {
    const participantUser = {
        ID: '11111111-1111-4111-8111-111111111111',
        UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    const staffUser = {
        ID: '22222222-2222-4222-8222-222222222222',
        UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    const TYPE_ID = '44444444-4444-4444-8444-444444444444';

    let origSpaceTypeById: typeof CollaborationEngine.Instance.SpaceTypeById;
    let currentMockType: mjBizAppsCollaborationSpaceTypeEntity | undefined;

    function mockCreateSpace(options: {
        user: UserInfo;
        allowParentAssignees?: boolean;
        allowDirty?: boolean;
        agentRetrieval?: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
        agentDirty?: boolean;
        typeLookupSuccess?: boolean;
        defaultAllow?: boolean;
        defaultAgent?: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
    }) {
        if (options.typeLookupSuccess === false) {
            currentMockType = undefined;
        } else {
            currentMockType = {
                ID: TYPE_ID,
                Name: 'Standard',
                DefaultAllowParentAssignees: options.defaultAllow ?? true,
                DefaultAgentRetrieval: options.defaultAgent ?? 'Included',
            } as Partial<mjBizAppsCollaborationSpaceTypeEntity> as mjBizAppsCollaborationSpaceTypeEntity;
        }

        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        const fields: Array<{ Name: string; Dirty: boolean; OldValue?: string | number | boolean | null; Value?: string | number | boolean | null }> = [
            { Name: 'OwnerID', Dirty: false },
        ];
        if (options.allowDirty) {
            fields.push({ Name: 'AllowParentAssignees', Dirty: true, Value: options.allowParentAssignees });
        }
        if (options.agentDirty) {
            fields.push({ Name: 'AgentRetrieval', Dirty: true, Value: options.agentRetrieval });
        }

        const rvMock = {
            RunView: async () => {
                if (options.typeLookupSuccess === false) {
                    return { Success: false, ErrorMessage: 'Type not found', Results: [] };
                }
                return {
                    Success: true,
                    Results: [{
                        DefaultAllowParentAssignees: options.defaultAllow ?? true,
                        DefaultAgentRetrieval: options.defaultAgent ?? 'Included',
                    }],
                };
            },
        };

        const mockProvider = {
            GetEntityObject: async () => ({}),
            EntityByID: () => ({}),
            Entities: [],
            CurrentUser: options.user,
        };

        Object.defineProperties(space, {
            ContextCurrentUser: { value: options.user, writable: true },
            IsSaved: { value: false, writable: true },
            ID: { value: '33333333-3333-4333-8333-333333333333', writable: true },
            OwnerID: { value: options.user.ID, writable: true },
            ParentID: { value: null, writable: true },
            SpaceTypeID: { value: TYPE_ID, writable: true },
            AllowParentAssignees: { value: options.allowParentAssignees ?? true, writable: true },
            AgentRetrieval: { value: options.agentRetrieval ?? 'Included', writable: true },
            Fields: { value: fields, writable: true },
            RunViewProviderToUse: { value: rvMock, writable: true },
            ProviderToUse: { value: mockProvider, writable: true },
        });
        return space;
    }

    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    before(() => {
        const engine = CollaborationEngine.Instance;
        origSpaceTypeById = engine.SpaceTypeById.bind(engine);
        engine.SpaceTypeById = (id: string | null | undefined) => {
            if (id === TYPE_ID) {
                return currentMockType;
            }
            return origSpaceTypeById(id);
        };
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
    });
    after(() => {
        CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
    });

    it('refuses save when space type cannot be read (fails closed)', async () => {
        const space = mockCreateSpace({ user: participantUser, typeLookupSuccess: false });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'SpaceTypeID');
        assert.ok(err, 'Expected error on SpaceTypeID');
        assert.equal(err?.Message, 'Space change refused: the space type could not be read.');
    });

    it('allows participant to send type default for AllowParentAssignees', async () => {
        const space = mockCreateSpace({
            user: participantUser,
            allowParentAssignees: true,
            allowDirty: true,
            defaultAllow: true,
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        const err = res.Errors.find((e) => e.Source === 'AllowParentAssignees');
        assert.equal(err, undefined, 'Matching type default should not be refused');
    });

    it('refuses participant sending value differing from type default for AllowParentAssignees', async () => {
        const space = mockCreateSpace({
            user: participantUser,
            allowParentAssignees: false,
            allowDirty: true,
            defaultAllow: true,
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'AllowParentAssignees');
        assert.ok(err, 'Expected error on AllowParentAssignees');
        assert.equal(err?.Message, 'Space change refused: only staff may change the allow-parent-assignees setting.');
    });

    it('allows participant to send type default for AgentRetrieval', async () => {
        const space = mockCreateSpace({
            user: participantUser,
            agentRetrieval: 'ExcludedFromParentScope',
            agentDirty: true,
            defaultAgent: 'ExcludedFromParentScope',
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        const err = res.Errors.find((e) => e.Source === 'AgentRetrieval');
        assert.equal(err, undefined, 'Matching type default should not be refused');
    });

    it('refuses participant sending value differing from type default for AgentRetrieval', async () => {
        const space = mockCreateSpace({
            user: participantUser,
            agentRetrieval: 'ExcludedEntirely',
            agentDirty: true,
            defaultAgent: 'Included',
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'AgentRetrieval');
        assert.ok(err, 'Expected error on AgentRetrieval');
        assert.equal(err?.Message, 'Space change refused: only staff may change the agent retrieval setting.');
    });
});

describe('SpaceEntityServer closure and reopening validation', () => {
    const staffUser = {
        ID: '22222222-2222-4222-8222-222222222222',
        UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    it('refuses future ClosedAt when closing a space', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        Object.defineProperties(space, {
            ContextCurrentUser: { value: staffUser, writable: true },
            IsSaved: { value: true, writable: true },
            ID: { value: '33333333-3333-4333-8333-333333333333', writable: true },
            OwnerID: { value: staffUser.ID, writable: true },
            ClosedAt: { value: futureDate, writable: true },
            Fields: {
                value: [
                    { Name: 'ClosedAt', Dirty: true, OldValue: null, Value: futureDate },
                    { Name: 'OwnerID', Dirty: false },
                ],
                writable: true,
            },
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'ClosedAt');
        assert.ok(err, 'Expected error on ClosedAt');
        assert.equal(err?.Message, 'Space change refused: ClosedAt cannot be in the future.');
    });

    it('refuses modifying other fields when reopening a space', async () => {
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        Object.defineProperties(space, {
            ContextCurrentUser: { value: staffUser, writable: true },
            IsSaved: { value: true, writable: true },
            ID: { value: '33333333-3333-4333-8333-333333333333', writable: true },
            OwnerID: { value: staffUser.ID, writable: true },
            ClosedAt: { value: null, writable: true },
            Fields: {
                value: [
                    { Name: 'ClosedAt', Dirty: true, OldValue: '2026-01-01T00:00:00Z', Value: null },
                    { Name: 'Name', Dirty: true, OldValue: 'Old Name', Value: 'New Name' },
                    { Name: 'OwnerID', Dirty: false },
                ],
                writable: true,
            },
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'Name');
        assert.ok(err, 'Expected error on Name');
        assert.equal(err?.Message, 'Space change refused: reopening a space cannot modify other fields simultaneously.');
    });

    it('allows co-owner to reach closed space with no post-close access when ignorePostCloseFilter is true', () => {
        const spaceId = '55555555-5555-4555-8555-555555555555';
        const coOwnerUserId = '66666666-6666-4666-8666-666666666666';
        const spaces: SpaceNode[] = [
            {
                id: spaceId,
                parentId: null,
                inheritsMembership: false,
                ownerId: '77777777-7777-4777-8777-777777777777',
                agentRetrieval: 'Included',
                closedAt: '2026-01-01T00:00:00Z',
                postCloseAccess: 'None',
            },
        ];
        const memberships: MemberSnapshot[] = [
            {
                spaceId,
                userId: coOwnerUserId,
                status: 'Active',
                band: 'Team',
                role: {
                    level: 2,
                    maxGrantableLevel: 2,
                    canInvite: true,
                    canPromoteBand: true,
                    canSeeTeamBand: true,
                    isOwnerRole: true,
                    canContribute: true,
                },
            },
        ];

        // Without bypass, membership reaches returns null because space is closed with postCloseAccess: 'None'
        const normalReach = membershipReaches(spaces, memberships, coOwnerUserId, spaceId);
        assert.equal(normalReach, null);

        // With ignorePostCloseFilter = true (reopen bypass), co-owner reaches the closed space
        const reopenReach = membershipReaches(spaces, memberships, coOwnerUserId, spaceId, new Date(), true);
        assert.ok(reopenReach);
        assert.equal(reopenReach?.role.isOwnerRole, true);
    });
});
