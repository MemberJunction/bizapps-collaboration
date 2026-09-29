import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import { syncRoomEditGrantsForSpace, CONVERSATIONS_RESOURCE_TYPE_ID } from '../dist/room-edit-grants.js';

describe('syncRoomEditGrantsForSpace', () => {
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
    const SPACE_ID = '11111111-1111-4111-8111-111111111111';
    const PARENT_SPACE_ID = '22222222-2222-4222-8222-222222222222';
    const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
    const CONTRIBUTING_USER_ID = '44444444-4444-4444-8444-444444444444';
    const NON_CONTRIBUTING_USER_ID = '55555555-5555-4555-8555-555555555555';
    const PARENT_CONTRIBUTING_USER_ID = '66666666-6666-4666-8666-666666666666';

    const ROLE_CONTRIB_ID = '77777777-7777-4777-8777-777777777777';
    const ROLE_NON_CONTRIB_ID = '88888888-8888-4888-8888-888888888888';

    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;

    before(() => {
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
    });

    interface MockPermission {
        ID: string;
        ResourceTypeID: string;
        ResourceRecordID: string;
        Type: 'User' | 'Role';
        UserID: string;
        PermissionLevel: string;
        Status?: string;
    }

    function createMockEnvironment(options: {
        isClosed?: boolean;
        inheritsMembership?: boolean;
        existingGrants?: MockPermission[];
        failMembersRead?: boolean;
        customMembers?: { ID: string; SpaceID: string; UserID: string; SpaceRoleTypeID: string; Band?: string; Status?: string }[];
    }) {
        const grants: MockPermission[] = [...(options.existingGrants ?? [])];
        const deletedIds: string[] = [];

        const mockProvider = {
            EntityByName() { return { ID: 'mock-entity-id' }; },
            EntityByID() { return { Name: 'mock-entity' }; },
            async RunView(params: { EntityName: string; ExtraFilter?: string }) {
                const { EntityName, ExtraFilter = '' } = params;

                if (EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    return {
                        Success: true,
                        Results: [{ ID: 'chat-1', ConversationID: CONVERSATION_ID, Status: 'Active' }],
                    };
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    if (ExtraFilter.includes(SPACE_ID)) {
                        return {
                            Success: true,
                            Results: [{
                                ID: SPACE_ID,
                                Name: 'Test Space',
                                ParentID: options.inheritsMembership ? PARENT_SPACE_ID : null,
                                InheritsMembership: !!options.inheritsMembership,
                                ClosedAt: options.isClosed ? '2026-09-01T00:00:00Z' : null,
                            }],
                        };
                    }
                    if (ExtraFilter.includes(PARENT_SPACE_ID)) {
                        return {
                            Success: true,
                            Results: [{
                                ID: PARENT_SPACE_ID,
                                Name: 'Parent Space',
                                ParentID: null,
                                InheritsMembership: false,
                                ClosedAt: null,
                            }],
                        };
                    }
                    if (ExtraFilter.includes('ParentID')) {
                        return { Success: true, Results: [] };
                    }
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    if (options.failMembersRead) {
                        return { Success: false, ErrorMessage: 'Database connection failed' };
                    }
                    if (options.customMembers) {
                        return { Success: true, Results: options.customMembers };
                    }
                    const members = [
                        { ID: 'm1', SpaceID: SPACE_ID, UserID: CONTRIBUTING_USER_ID, SpaceRoleTypeID: ROLE_CONTRIB_ID },
                        { ID: 'm2', SpaceID: SPACE_ID, UserID: NON_CONTRIBUTING_USER_ID, SpaceRoleTypeID: ROLE_NON_CONTRIB_ID },
                    ];
                    if (options.inheritsMembership) {
                        members.push({
                            ID: 'm3',
                            SpaceID: PARENT_SPACE_ID,
                            UserID: PARENT_CONTRIBUTING_USER_ID,
                            SpaceRoleTypeID: ROLE_CONTRIB_ID,
                        });
                    }
                    return { Success: true, Results: members };
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return {
                        Success: true,
                        Results: [
                            { ID: ROLE_CONTRIB_ID, CanContribute: true },
                            { ID: ROLE_NON_CONTRIB_ID, CanContribute: false },
                        ],
                    };
                }

                if (EntityName === 'MJ: Resource Permissions') {
                    return {
                        Success: true,
                        Results: grants.filter((g) => !deletedIds.includes(g.ID)),
                    };
                }

                return { Success: true, Results: [] };
            },
            async GetEntityObject(name: string) {
                if (name === 'MJ: Resource Permissions') {
                    let currentRecord: MockPermission = {
                        ID: `grant-${Date.now()}-${Math.random()}`,
                        ResourceTypeID: '',
                        ResourceRecordID: '',
                        Type: 'User',
                        UserID: '',
                        PermissionLevel: '',
                    };
                    return {
                        NewRecord() {
                            currentRecord = {
                                ID: `grant-${Date.now()}-${Math.random()}`,
                                ResourceTypeID: '',
                                ResourceRecordID: '',
                                Type: 'User',
                                UserID: '',
                                PermissionLevel: '',
                            };
                            return true;
                        },
                        async Load(id: string) {
                            const found = grants.find((g) => g.ID === id);
                            if (found) {
                                currentRecord = found;
                                return true;
                            }
                            return false;
                        },
                        async Save() {
                            const existingIndex = grants.findIndex((g) => g.ID === currentRecord.ID);
                            if (existingIndex >= 0) {
                                grants[existingIndex] = { ...currentRecord };
                            } else {
                                grants.push({ ...currentRecord });
                            }
                            return true;
                        },
                        async Delete() {
                            deletedIds.push(currentRecord.ID);
                            const idx = grants.findIndex((g) => g.ID === currentRecord.ID);
                            if (idx >= 0) grants.splice(idx, 1);
                            return true;
                        },
                        get ID() { return currentRecord.ID; },
                        set ID(val: string) { currentRecord.ID = val; },
                        get ResourceTypeID() { return currentRecord.ResourceTypeID; },
                        set ResourceTypeID(val: string) { currentRecord.ResourceTypeID = val; },
                        get ResourceRecordID() { return currentRecord.ResourceRecordID; },
                        set ResourceRecordID(val: string) { currentRecord.ResourceRecordID = val; },
                        get Type() { return currentRecord.Type; },
                        set Type(val: 'User' | 'Role') { currentRecord.Type = val; },
                        get UserID() { return currentRecord.UserID; },
                        set UserID(val: string) { currentRecord.UserID = val; },
                        get PermissionLevel() { return currentRecord.PermissionLevel; },
                        set PermissionLevel(val: string) { currentRecord.PermissionLevel = val; },
                        get Status() { return currentRecord.Status; },
                        set Status(val: string | undefined) { currentRecord.Status = val; },
                    };
                }
                return {};
            },
        };

        return { mockProvider, grants, deletedIds };
    }

    it('creates Edit grant for active contributing member on open space and excludes non-contributor', async () => {
        const { mockProvider, grants } = createMockEnvironment({ isClosed: false });
        await syncRoomEditGrantsForSpace(mockProvider, SPACE_ID);

        const contribGrant = grants.find((g) => g.UserID === CONTRIBUTING_USER_ID);
        assert.ok(contribGrant, 'Contributing user must have an Edit grant');
        assert.equal(contribGrant.PermissionLevel, 'Edit');
        assert.equal(contribGrant.ResourceTypeID, CONVERSATIONS_RESOURCE_TYPE_ID);
        assert.equal(contribGrant.ResourceRecordID, CONVERSATION_ID);

        const nonContribGrant = grants.find((g) => g.UserID === NON_CONTRIBUTING_USER_ID);
        assert.equal(nonContribGrant, undefined, 'Non-contributing user must not have a grant');
    });

    it('inherits contributing member from parent space when InheritsMembership is true', async () => {
        const { mockProvider, grants } = createMockEnvironment({ isClosed: false, inheritsMembership: true });
        await syncRoomEditGrantsForSpace(mockProvider, SPACE_ID);

        const parentContribGrant = grants.find((g) => g.UserID === PARENT_CONTRIBUTING_USER_ID);
        assert.ok(parentContribGrant, 'Parent contributing user must have an inherited Edit grant');
        assert.equal(parentContribGrant.PermissionLevel, 'Edit');
    });

    it('revokes grants when a space is closed', async () => {
        const existing: MockPermission = {
            ID: 'existing-grant-1',
            ResourceTypeID: CONVERSATIONS_RESOURCE_TYPE_ID,
            ResourceRecordID: CONVERSATION_ID,
            Type: 'User',
            UserID: CONTRIBUTING_USER_ID,
            PermissionLevel: 'Edit',
        };
        const { mockProvider, grants, deletedIds } = createMockEnvironment({
            isClosed: true,
            existingGrants: [existing],
        });

        await syncRoomEditGrantsForSpace(mockProvider, SPACE_ID);
        assert.equal(grants.length, 0, 'Closed space must revoke all edit grants');
        assert.ok(deletedIds.includes('existing-grant-1'), 'Existing grant must be deleted');
    });

    it('revokes grant for user who is no longer a contributing member', async () => {
        const staleGrant: MockPermission = {
            ID: 'stale-grant-1',
            ResourceTypeID: CONVERSATIONS_RESOURCE_TYPE_ID,
            ResourceRecordID: CONVERSATION_ID,
            Type: 'User',
            UserID: '99999999-9999-4999-8999-999999999999',
            PermissionLevel: 'Edit',
        };
        const { mockProvider, grants, deletedIds } = createMockEnvironment({
            isClosed: false,
            existingGrants: [staleGrant],
        });

        await syncRoomEditGrantsForSpace(mockProvider, SPACE_ID);
        assert.ok(deletedIds.includes('stale-grant-1'), 'Stale grant must be deleted');
        assert.equal(grants.some((g) => g.UserID === '99999999-9999-4999-8999-999999999999'), false);
        assert.ok(grants.some((g) => g.UserID === CONTRIBUTING_USER_ID), 'Active contributing user gets grant');
    });

    it('does not delete existing grants when members read fails', async () => {
        const existing: MockPermission = {
            ID: 'existing-grant-keep',
            ResourceTypeID: CONVERSATIONS_RESOURCE_TYPE_ID,
            ResourceRecordID: CONVERSATION_ID,
            Type: 'User',
            UserID: CONTRIBUTING_USER_ID,
            PermissionLevel: 'Edit',
        };
        const { mockProvider, grants, deletedIds } = createMockEnvironment({
            isClosed: false,
            existingGrants: [existing],
            failMembersRead: true,
        });

        await syncRoomEditGrantsForSpace(mockProvider, SPACE_ID);
        assert.equal(deletedIds.length, 0, 'Must not delete existing grants on read failure');
        assert.equal(grants.length, 1, 'Existing grant must be retained');
    });

    it('enforces nearest seat rule: contributing on parent, non-contributing on space -> no edit grant', async () => {
        const OVERRIDE_USER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
        const { mockProvider, grants } = createMockEnvironment({
            isClosed: false,
            inheritsMembership: true,
            customMembers: [
                { ID: 'm1', SpaceID: SPACE_ID, UserID: OVERRIDE_USER_ID, SpaceRoleTypeID: ROLE_NON_CONTRIB_ID },
                { ID: 'm2', SpaceID: PARENT_SPACE_ID, UserID: OVERRIDE_USER_ID, SpaceRoleTypeID: ROLE_CONTRIB_ID },
            ],
        });

        await syncRoomEditGrantsForSpace(mockProvider, SPACE_ID);
        const overrideGrant = grants.find((g) => g.UserID === OVERRIDE_USER_ID);
        assert.equal(overrideGrant, undefined, 'Nearest seat on child space (non-contributing) overrides parent seat');
    });
});
