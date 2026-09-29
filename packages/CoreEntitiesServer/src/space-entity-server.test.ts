import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { BaseEntity, WellKnownUserSource, type UserInfo, type UserRoleInfo } from '@memberjunction/core';
import { isStaffUser, STAFF_ROLES } from '../dist/load-graph.js';
import { SpaceEntityServer } from '../dist/SpaceEntityServer.js';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { BaseSpaceTypeServerDriver, type DriverValidationResult, type SpaceChangeContext } from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
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
        newRecordAllow?: boolean;
        newRecordAgent?: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
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
            _callerSpecifiedAllowParentAssignees: { value: !!options.allowDirty, writable: true },
            _callerSpecifiedAgentRetrieval: { value: !!options.agentDirty, writable: true },
            _newRecordAllowParentAssignees: { value: options.newRecordAllow ?? true, writable: true },
            _newRecordAgentRetrieval: { value: options.newRecordAgent ?? 'Included', writable: true },
            Fields: { value: fields, writable: true },
            RunViewProviderToUse: { value: rvMock, writable: true },
            ProviderToUse: { value: mockProvider, writable: true },
            init: { value: () => undefined, writable: true },
            notifyEmbeddedNewRecord: { value: () => undefined, writable: true },
            RaiseEvent: { value: () => undefined, writable: true },
            EntityInfo: { value: { PrimaryKeys: [], Fields: [{ Name: 'AllowParentAssignees' }, { Name: 'AgentRetrieval' }] }, writable: true },
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

    it("keeps the loader's explicit value", async () => {
        const space = mockCreateSpace({
            user: staffUser,
            agentRetrieval: 'ExcludedFromParentScope',
            defaultAgent: 'Included',
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, true, `Validation should succeed: ${res.Errors.map((e) => e.Message).join(', ')}`);
        assert.equal(space.AgentRetrieval, 'ExcludedFromParentScope');
    });

    it("gets the type's defaults when SetMany() leaves fields at column defaults", async () => {
        const space = mockCreateSpace({
            user: staffUser,
            allowParentAssignees: true, // column default
            agentRetrieval: 'Included', // column default
            defaultAllow: false,        // type default differs
            defaultAgent: 'ExcludedFromParentScope', // type default differs
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, true, `Validation should succeed: ${res.Errors.map((e) => e.Message).join(', ')}`);
        assert.equal(space.AllowParentAssignees, false);
        assert.equal(space.AgentRetrieval, 'ExcludedFromParentScope');
    });

    it('keeps explicit value passed to NewRecord matching column default when space type default differs', async () => {
        const space = mockCreateSpace({
            user: staffUser,
            allowParentAssignees: true, // caller explicitly chose column default true
            allowDirty: true,           // caller specified it in NewRecord
            agentRetrieval: 'Included', // caller explicitly chose column default Included
            agentDirty: true,           // caller specified it in NewRecord
            defaultAllow: false,        // type default differs
            defaultAgent: 'ExcludedFromParentScope', // type default differs
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, true, `Validation should succeed: ${res.Errors.map((e) => e.Message).join(', ')}`);
        assert.equal(space.AllowParentAssignees, true, 'Explicit AllowParentAssignees=true must be kept');
        assert.equal(space.AgentRetrieval, 'Included', 'Explicit AgentRetrieval=Included must be kept');
    });

    it('keeps an explicit non-default from staff', async () => {
        const space = mockCreateSpace({
            user: staffUser,
            allowParentAssignees: false,
            agentRetrieval: 'ExcludedEntirely',
            defaultAllow: true,
            defaultAgent: 'Included',
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, true, `Validation should succeed: ${res.Errors.map((e) => e.Message).join(', ')}`);
        assert.equal(space.AllowParentAssignees, false);
        assert.equal(space.AgentRetrieval, 'ExcludedEntirely');
    });

    it('refuses an explicit non-default from someone who is not staff', async () => {
        const spaceAllow = mockCreateSpace({
            user: participantUser,
            allowParentAssignees: false,
            defaultAllow: true,
        });
        const resAllow = await SpaceEntityServer.prototype.ValidateAsync.call(spaceAllow);
        assert.equal(resAllow.Success, false);
        const allowErr = resAllow.Errors.find((e) => e.Source === 'AllowParentAssignees');
        assert.ok(allowErr, 'Expected error on AllowParentAssignees');
        assert.equal(allowErr?.Message, 'Space change refused: only staff may change the allow-parent-assignees setting.');

        const spaceAgent = mockCreateSpace({
            user: participantUser,
            agentRetrieval: 'ExcludedEntirely',
            defaultAgent: 'Included',
        });
        const resAgent = await SpaceEntityServer.prototype.ValidateAsync.call(spaceAgent);
        assert.equal(resAgent.Success, false);
        const agentErr = resAgent.Errors.find((e) => e.Source === 'AgentRetrieval');
        assert.ok(agentErr, 'Expected error on AgentRetrieval');
        assert.equal(agentErr?.Message, 'Space change refused: only staff may change the agent retrieval setting.');
    });

    it("applies the type's defaults after NewRecord() with no sets", async () => {
        const space = mockCreateSpace({
            user: staffUser,
            defaultAllow: false,
            defaultAgent: 'ExcludedFromParentScope',
        });
        space.NewRecord();
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, true, `Validation should succeed: ${res.Errors.map((e) => e.Message).join(', ')}`);
        assert.equal(space.AllowParentAssignees, false);
        assert.equal(space.AgentRetrieval, 'ExcludedFromParentScope');
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

interface MockSpaceChatEntity {
    ID: string;
    Status: string;
    ArchivedOnSpaceClose: boolean;
    Load(id: string): Promise<boolean>;
    Save(): Promise<boolean>;
    LatestResult: { CompleteMessage: string };
}

describe('SpaceEntityServer close and reopen chat archiving and restoration', () => {
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let origBaseSave: typeof BaseEntity.prototype.Save;

    before(() => {
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);

        origBaseSave = BaseEntity.prototype.Save;
        BaseEntity.prototype.Save = async function () {
            return true;
        };
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        BaseEntity.prototype.Save = origBaseSave;
    });

    it('archives active chats with ArchivedOnSpaceClose flag when space closes', async () => {
        const archivedChats: Array<{ id: string; status: string; archivedOnSpaceClose: boolean }> = [];

        const mockSpaceChat: MockSpaceChatEntity = {
            ID: 'chat-active-1',
            Status: 'Active',
            ArchivedOnSpaceClose: false,
            async Load(id: string) {
                return id === 'chat-active-1';
            },
            async Save() {
                archivedChats.push({
                    id: this.ID,
                    status: this.Status,
                    archivedOnSpaceClose: this.ArchivedOnSpaceClose,
                });
                return true;
            },
            LatestResult: { CompleteMessage: '' },
        };

        const spaceId = 'space-close-test-1';
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        const closedAtDate = new Date();

        const mockProvider = {
            EntityByName() { return { ID: 'mock-id' }; },
            EntityByID() { return { Name: 'mock' }; },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    return mockSpaceChat;
                }
                return mockSpaceChat;
            },
            async RunView(params: { EntityName: string; ExtraFilter: string }) {
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    if (params.ExtraFilter.includes(`SpaceID = '${spaceId}' AND Status = 'Active'`)) {
                        return {
                            Success: true,
                            Results: [{ ID: 'chat-active-1' }],
                        };
                    }
                }
                return { Success: true, Results: [] };
            },
        };

        Object.defineProperties(space, {
            ID: { value: spaceId, writable: true },
            ContextCurrentUser: { value: { ID: 'caller-1', Name: 'Caller' } as UserInfo, writable: true },
            ClosedAt: { value: closedAtDate, writable: true },
            Fields: {
                value: [
                    { Name: 'ClosedAt', Value: closedAtDate, OldValue: null, Dirty: true },
                    { Name: 'ParentID', Value: null, OldValue: null, Dirty: false },
                    { Name: 'InheritsMembership', Value: false, OldValue: false, Dirty: false },
                ],
                writable: true,
            },
            ProviderToUse: { value: mockProvider, writable: true },
            RunViewProviderToUse: { value: mockProvider, writable: true },
        });

        // ACT: Execute the actual SpaceEntityServer.Save() method
        const saveOk = await space.Save();
        assert.equal(saveOk, true);

        // ASSERT: The chat was archived and marked ArchivedOnSpaceClose by SpaceEntityServer.Save()
        assert.equal(archivedChats.length, 1);
        assert.equal(archivedChats[0].status, 'Archived');
        assert.equal(archivedChats[0].archivedOnSpaceClose, true);
    });

    it('restores archived chats where ArchivedOnSpaceClose was 1 when space reopens', async () => {
        const restoredChats: Array<{ id: string; status: string; archivedOnSpaceClose: boolean }> = [];

        const mockSpaceChat: MockSpaceChatEntity = {
            ID: 'chat-archived-1',
            Status: 'Archived',
            ArchivedOnSpaceClose: true,
            async Load(id: string) {
                return id === 'chat-archived-1';
            },
            async Save() {
                restoredChats.push({
                    id: this.ID,
                    status: this.Status,
                    archivedOnSpaceClose: this.ArchivedOnSpaceClose,
                });
                return true;
            },
            LatestResult: { CompleteMessage: '' },
        };

        const spaceId = 'space-reopen-test-1';
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        const prevClosedAt = new Date();

        const mockProvider = {
            EntityByName() { return { ID: 'mock-id' }; },
            EntityByID() { return { Name: 'mock' }; },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    return mockSpaceChat;
                }
                return mockSpaceChat;
            },
            async RunView(params: { EntityName: string; ExtraFilter: string }) {
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    if (params.ExtraFilter.includes('ArchivedOnSpaceClose = 1')) {
                        return {
                            Success: true,
                            Results: [{ ID: 'chat-archived-1' }],
                        };
                    }
                }
                return { Success: true, Results: [] };
            },
        };

        Object.defineProperties(space, {
            ID: { value: spaceId, writable: true },
            ContextCurrentUser: { value: { ID: 'caller-1', Name: 'Caller' } as UserInfo, writable: true },
            ClosedAt: { value: null, writable: true },
            IsSaved: { value: true, writable: true },
            Fields: {
                value: [
                    { Name: 'ClosedAt', Value: null, OldValue: prevClosedAt, Dirty: true },
                    { Name: 'ParentID', Value: null, OldValue: null, Dirty: false },
                    { Name: 'InheritsMembership', Value: false, OldValue: false, Dirty: false },
                ],
                writable: true,
            },
            ProviderToUse: { value: mockProvider, writable: true },
            RunViewProviderToUse: { value: mockProvider, writable: true },
        });

        // ACT: Execute the actual SpaceEntityServer.Save() method
        const saveOk = await space.Save();
        assert.equal(saveOk, true);

        // ASSERT: The chat was restored to Active and ArchivedOnSpaceClose reset to false
        assert.equal(restoredChats.length, 1);
        assert.equal(restoredChats[0].status, 'Active');
        assert.equal(restoredChats[0].archivedOnSpaceClose, false);
    });
});

describe('SpaceEntityServer type change', () => {
    const OWNER_ID = '22222222-2222-4222-8222-222222222222';
    const owner = { ID: OWNER_ID, UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo] } as Partial<UserInfo> as UserInfo;
    const OLD_TYPE_ID = '44444444-4444-4444-8444-444444444444';
    const NEW_TYPE_ID = '55555555-5555-4555-8555-555555555555';
    const SPACE_ID = '33333333-3333-4333-8333-333333333333';

    const typeRows = new Map<string, mjBizAppsCollaborationSpaceTypeEntity>();
    const drivers = new Map<string, BaseSpaceTypeServerDriver>();
    let mayConfigure = true;
    let saved: {
        engineLoaded: typeof CollaborationEngine.Instance.EnsureLoaded;
        typeById: typeof CollaborationEngine.Instance.SpaceTypeById;
        mayConfigure: typeof CollaborationEngine.Instance.UserCanConfigureSpaces;
        driverFor: typeof ServerDriverRegistry.Instance.GetDriverForType;
        systemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    };

    function typeRow(id: string, extensionEntity: string | null): mjBizAppsCollaborationSpaceTypeEntity {
        return { ID: id, Name: id, SpaceExtensionEntity: extensionEntity, DefaultAllowParentAssignees: true, DefaultAgentRetrieval: 'Included' } as Partial<mjBizAppsCollaborationSpaceTypeEntity> as mjBizAppsCollaborationSpaceTypeEntity;
    }

    /** A driver that records what it is asked to judge, and answers as told. */
    class SpyDriver extends BaseSpaceTypeServerDriver {
        public judged: SpaceChangeContext[] = [];
        private readonly answer: DriverValidationResult;
        constructor(answer: DriverValidationResult) {
            super();
            this.answer = answer;
        }
        public override ValidateSpaceChange(ctx: SpaceChangeContext): DriverValidationResult {
            this.judged.push(ctx);
            return this.answer;
        }
    }

    function savedSpaceChangingType() {
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        const provider = { GetEntityObject: async () => ({}), EntityByID: () => ({}), EntityByName: () => ({}), Entities: [], CurrentUser: owner };
        Object.defineProperties(space, {
            ContextCurrentUser: { value: owner, writable: true },
            IsSaved: { value: true, writable: true },
            ID: { value: SPACE_ID, writable: true },
            OwnerID: { value: OWNER_ID, writable: true },
            ParentID: { value: null, writable: true },
            SpaceTypeID: { value: NEW_TYPE_ID, writable: true },
            Configuration: { value: null, writable: true },
            Fields: {
                value: [
                    { Name: 'SpaceTypeID', Dirty: true, OldValue: OLD_TYPE_ID, Value: NEW_TYPE_ID },
                    { Name: 'OwnerID', Dirty: false },
                ],
                writable: true,
            },
            ProviderToUse: { value: provider, writable: true },
            RunViewProviderToUse: { value: { RunView: async () => ({ Success: true, Results: [] }) }, writable: true },
            EntityInfo: { value: { PrimaryKeys: [], Fields: [{ Name: 'SpaceTypeID' }] }, writable: true },
        });
        return space;
    }

    before(() => {
        const engine = CollaborationEngine.Instance;
        const registry = ServerDriverRegistry.Instance;
        saved = {
            engineLoaded: engine.EnsureLoaded.bind(engine),
            typeById: engine.SpaceTypeById.bind(engine),
            mayConfigure: engine.UserCanConfigureSpaces.bind(engine),
            driverFor: registry.GetDriverForType.bind(registry),
            systemUser: WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance),
        };
        engine.EnsureLoaded = async () => undefined;
        engine.SpaceTypeById = (id: string | null | undefined) => typeRows.get(String(id).toLowerCase());
        engine.UserCanConfigureSpaces = async () => mayConfigure;
        registry.GetDriverForType = (type) => drivers.get(type.ID) ?? new BaseSpaceTypeServerDriver();
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
    });
    after(() => {
        const engine = CollaborationEngine.Instance;
        engine.EnsureLoaded = saved.engineLoaded;
        engine.SpaceTypeById = saved.typeById;
        engine.UserCanConfigureSpaces = saved.mayConfigure;
        ServerDriverRegistry.Instance.GetDriverForType = saved.driverFor;
        WellKnownUserSource.Instance.GetSystemUser = saved.systemUser;
    });

    function reset(options: { oldExtension?: string | null; newExtension?: string | null; configure?: boolean; oldAnswer?: DriverValidationResult }) {
        typeRows.clear();
        drivers.clear();
        typeRows.set(OLD_TYPE_ID, typeRow(OLD_TYPE_ID, options.oldExtension ?? null));
        typeRows.set(NEW_TYPE_ID, typeRow(NEW_TYPE_ID, options.newExtension ?? null));
        const oldDriver = new SpyDriver(options.oldAnswer ?? { ok: true });
        drivers.set(OLD_TYPE_ID, oldDriver);
        mayConfigure = options.configure ?? true;
        return oldDriver;
    }

    it('refuses an owner who lacks the Configure Spaces authorization', async () => {
        const oldDriver = reset({ configure: false });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(savedSpaceChangingType());
        assert.equal(res.Success, false);
        assert.match(res.Errors.find((e) => e.Source === 'SpaceTypeID')?.Message ?? '', /needs the 'Configure Spaces' authorization/);
        assert.equal(oldDriver.judged.length, 0, 'no driver judges a change the caller may not make');
    });

    it('refuses a change between types that do not share a subtype table', async () => {
        const oldDriver = reset({ oldExtension: 'MJ_Example: Boards', newExtension: 'MJ_Example: Rooms' });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(savedSpaceChangingType());
        assert.equal(res.Success, false);
        assert.match(res.Errors.find((e) => e.Source === 'SpaceTypeID')?.Message ?? '', /do not share a subtype table/);
        assert.equal(oldDriver.judged.length, 0);
    });

    it("has the previous type's driver judge the change, and stops when it refuses", async () => {
        const oldDriver = reset({ oldAnswer: { ok: false, field: 'SpaceTypeID', message: 'A board cannot become a room.' } });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(savedSpaceChangingType());
        assert.equal(res.Success, false);
        assert.equal(res.Errors.find((e) => e.Source === 'SpaceTypeID')?.Message, 'A board cannot become a room.');
        assert.equal(oldDriver.judged.length, 1);
        assert.equal(oldDriver.judged[0].spaceType.ID, OLD_TYPE_ID);
        assert.equal(oldDriver.judged[0].kind, 'Update');
        assert.deepEqual(oldDriver.judged[0].oldValues, { SpaceTypeID: OLD_TYPE_ID });
    });

    it("passes when both types' drivers accept, and both see the change (the new one with oldValues)", async () => {
        const newDriver = reset({});
        void newDriver;
        const previous = drivers.get(OLD_TYPE_ID) as SpyDriver;
        const next = new SpyDriver({ ok: true });
        drivers.set(NEW_TYPE_ID, next);
        const space = savedSpaceChangingType();
        // A provider that can answer the write graph for an owner of this space
        const OWNER_ROLE = '69090145-C214-4C16-83C5-9D0F1F3B6DE4';
        const answers = (entityName: string, filter = ''): unknown[] => {
            if (entityName.endsWith('Space Members')) {
                return filter.includes('<>') || filter.includes("Status = 'Active'")
                    ? []
                    : [{ SpaceID: SPACE_ID, UserID: OWNER_ID, Status: 'Active', Band: 'Team', SpaceRoleTypeID: OWNER_ROLE }];
            }
            if (entityName.endsWith('Space Role Types')) {
                return [{ ID: OWNER_ROLE, Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true }];
            }
            if (entityName.endsWith('Space Types')) return [{ ID: NEW_TYPE_ID, InviteApproval: 'Approve', MemberCap: null }];
            if (entityName.endsWith('Spaces')) return [{ ID: SPACE_ID, ParentID: null, InheritsMembership: true, OwnerID: OWNER_ID, AgentRetrieval: 'Included', SpaceTypeID: NEW_TYPE_ID }];
            return [];
        };
        const provider = {
            async RunView(params: { EntityName: string; ExtraFilter?: string }) { return { Success: true, Results: answers(params.EntityName, params.ExtraFilter ?? '') }; },
            async RunViews(params: { EntityName: string; ExtraFilter?: string }[]) { return params.map((q) => ({ Success: true, Results: answers(q.EntityName, q.ExtraFilter ?? '') })); },
            GetEntityObject: async () => ({}),
            EntityByID: () => ({}),
            EntityByName: () => ({}),
            Entities: [],
            CurrentUser: owner,
        };
        Object.defineProperties(space, {
            ProviderToUse: { value: provider, writable: true },
            RunViewProviderToUse: { value: provider, writable: true },
            ParentID: { value: null, writable: true },
            OwnerID: { value: OWNER_ID, writable: true },
            ClosedAt: { value: null, writable: true },
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Errors.length, 0, res.Errors.map((e) => `${e.Source}: ${e.Message}`).join('; '));
        assert.equal(previous.judged.length, 1, "the previous type's driver judged it");
        assert.equal(next.judged.length, 1, "the new type's driver judged it");
        assert.deepEqual(next.judged[0].oldValues, { SpaceTypeID: OLD_TYPE_ID });
        assert.equal(next.judged[0].kind, 'Update');
    });

    it('refuses a saved space whose new type is missing or not a UUID, instead of skipping the type checks', async () => {
        reset({});
        const space = savedSpaceChangingType();
        Object.defineProperties(space, {
            SpaceTypeID: { value: null, writable: true },
            Fields: { value: [{ Name: 'SpaceTypeID', Dirty: true, OldValue: OLD_TYPE_ID, Value: null }, { Name: 'OwnerID', Dirty: false }], writable: true },
        });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        assert.match(res.Errors.find((e) => e.Source === 'SpaceTypeID')?.Message ?? '', /the space type id is not valid/);
    });

    it('does not treat a save that leaves the type alone as a type change', async () => {
        const oldDriver = reset({ configure: false });
        const space = savedSpaceChangingType();
        Object.defineProperty(space, 'Fields', { value: [{ Name: 'SpaceTypeID', Dirty: false, OldValue: NEW_TYPE_ID, Value: NEW_TYPE_ID }, { Name: 'Name', Dirty: true }], writable: true });
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Errors.find((e) => e.Source === 'SpaceTypeID' && /needs the 'Configure Spaces'/.test(e.Message)), undefined);
        assert.equal(oldDriver.judged.length, 0);
    });
});
