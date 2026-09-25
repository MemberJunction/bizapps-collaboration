import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import { isStaffUser, STAFF_ROLES } from '../dist/load-graph.js';
import { SpaceEntityServer } from '../dist/SpaceEntityServer.js';

describe('isStaffUser', () => {
    it('returns true for UI, Developer, and Integration roles', () => {
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'UI' }] } as UserInfo), true);
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Developer' }] } as UserInfo), true);
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Integration' }] } as UserInfo), true);
    });

    it('returns false for Space Participant, empty roles, or null', () => {
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Space Participant' }] } as UserInfo), false);
        assert.equal(isStaffUser({ UserRoles: [] } as UserInfo), false);
        assert.equal(isStaffUser(null), false);
        assert.equal(isStaffUser(undefined), false);
    });
});

describe('SpaceEntityServer staff-only edit gate', () => {
    const participantUser = {
        ID: '11111111-1111-4111-8111-111111111111',
        UserRoles: [{ Role: 'Space Participant' }],
    } as unknown as UserInfo;

    const staffUser = {
        ID: '22222222-2222-4222-8222-222222222222',
        UserRoles: [{ Role: 'UI' }],
    } as unknown as UserInfo;

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
        UserRoles: [{ Role: 'Space Participant' }],
    } as unknown as UserInfo;

    const staffUser = {
        ID: '22222222-2222-4222-8222-222222222222',
        UserRoles: [{ Role: 'UI' }],
    } as unknown as UserInfo;

    const TYPE_ID = '44444444-4444-4444-8444-444444444444';

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
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        const fields: Array<{ Name: string; Dirty: boolean; OldValue?: unknown; Value?: unknown }> = [
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
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
    });
    after(() => {
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
