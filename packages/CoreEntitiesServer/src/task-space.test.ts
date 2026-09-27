import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WellKnownUserSource, type UserInfo, type UserRoleInfo } from '@memberjunction/core';
import type { ValidationErrorInfo } from '@memberjunction/global';
import type { mjBizAppsTasksTaskAssignmentEntity } from '@mj-biz-apps/tasks-entities';
import { CollaborationTaskEntityServer } from '../dist/task-entity-server.js';
import { assigneeSeatMessage, relevantFieldsChanged } from '../dist/task-space.js';

describe('relevantFieldsChanged', () => {
    it('checks a new record, and a saved record only when a named field is dirty', () => {
        assert.equal(relevantFieldsChanged({ IsSaved: false, Fields: [] }, ['TaskID']), true);
        assert.equal(relevantFieldsChanged({
            IsSaved: true,
            Fields: [{ Name: 'Status', Dirty: true }, { Name: 'TaskID', Dirty: false }],
        }, ['TaskID', 'AssigneeEntityID', 'AssigneeRecordID']), false);
        assert.equal(relevantFieldsChanged({
            IsSaved: true,
            Fields: [{ Name: 'AssigneeRecordID', Dirty: true }],
        }, ['TaskID', 'AssigneeEntityID', 'AssigneeRecordID']), true);
    });
});

const SYSTEM_USER_ID = '11111111-1111-4111-8111-111111111111';
const CALLER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ASSIGNEE_USER_ID = '33333333-3333-4333-8333-333333333333';
const PARENT_SPACE_ID = '44444444-4444-4444-8444-444444444444';
const CHILD_SPACE_ID = '55555555-5555-4555-8555-555555555555';
const TASK_ID = '66666666-6666-4666-8666-666666666666';
const TASKS_ENTITY_ID = '77777777-7777-4777-8777-777777777777';
const USERS_ENTITY_ID = '88888888-8888-4888-8888-888888888888';
const ROLE_ID = '99999999-9999-4999-8999-999999999999';

describe('assigneeSeatMessage', () => {
    function createMockProvider(allowParentAssignees: boolean) {
        return {
            EntityByName(name: string) {
                if (name === 'MJ_BizApps_Tasks: Tasks') return { ID: TASKS_ENTITY_ID, Name: name };
                if (name === 'MJ: Users') return { ID: USERS_ENTITY_ID, Name: name };
                return null;
            },
            GetEntityObject() { return undefined; },
            EntityByID() { return { Name: 'x' }; },
            async RunView(params: { EntityName: string; ExtraFilter?: string }) {
                const { EntityName, ExtraFilter = '' } = params;
                if (EntityName === 'MJ_BizApps_Tasks: Tasks') {
                    return { Success: true, Results: [{ RootParentID: TASK_ID }] };
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                    return { Success: true, Results: [{ SpaceID: CHILD_SPACE_ID, Band: 'Shared' }] };
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    if (ExtraFilter.includes(CHILD_SPACE_ID)) {
                        return { Success: true, Results: [{ ID: CHILD_SPACE_ID, ParentID: PARENT_SPACE_ID, InheritsMembership: true, AllowParentAssignees: allowParentAssignees }] };
                    }
                    if (ExtraFilter.includes(PARENT_SPACE_ID)) {
                        return { Success: true, Results: [{ ID: PARENT_SPACE_ID, ParentID: null, InheritsMembership: true, AllowParentAssignees: true }] };
                    }
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    return { Success: true, Results: [{ SpaceID: PARENT_SPACE_ID, UserID: ASSIGNEE_USER_ID, Status: 'Active', Band: 'Shared', SpaceRoleTypeID: ROLE_ID }] };
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return { Success: true, Results: [{ ID: ROLE_ID, Level: 10, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true }] };
                }
                return { Success: true, Results: [] };
            },
        };
    }

    it('allows participant to assign an ancestor member when AllowParentAssignees is true', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as UserInfo;
        try {
            const provider = createMockProvider(true);
            const assignment = {
                IsSaved: false,
                Fields: [],
                ProviderToUse: provider,
                RunViewProviderToUse: provider,
                ContextCurrentUser: { ID: CALLER_USER_ID, UserRoles: [{ Role: 'Space Participant' }] } as unknown as UserInfo,
                TaskID: TASK_ID,
                AssigneeEntityID: USERS_ENTITY_ID,
                AssigneeRecordID: ASSIGNEE_USER_ID,
            } as unknown as mjBizAppsTasksTaskAssignmentEntity;

            const msg = await assigneeSeatMessage(assignment);
            assert.equal(msg, null);
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('refuses participant assigning an ancestor member when AllowParentAssignees is false', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as UserInfo;
        try {
            const provider = createMockProvider(false);
            const assignment = {
                IsSaved: false,
                Fields: [],
                ProviderToUse: provider,
                RunViewProviderToUse: provider,
                ContextCurrentUser: { ID: CALLER_USER_ID, UserRoles: [{ Role: 'Space Participant' }] } as unknown as UserInfo,
                TaskID: TASK_ID,
                AssigneeEntityID: USERS_ENTITY_ID,
                AssigneeRecordID: ASSIGNEE_USER_ID,
            } as unknown as mjBizAppsTasksTaskAssignmentEntity;

            const msg = await assigneeSeatMessage(assignment);
            assert.equal(msg, 'Assignment refused: participants may not assign people seated above this space.');
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('allows staff to assign an ancestor member even when AllowParentAssignees is false', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as UserInfo;
        try {
            const provider = createMockProvider(false);
            const assignment = {
                IsSaved: false,
                Fields: [],
                ProviderToUse: provider,
                RunViewProviderToUse: provider,
                ContextCurrentUser: { ID: CALLER_USER_ID, UserRoles: [{ Role: 'UI' }] } as unknown as UserInfo,
                TaskID: TASK_ID,
                AssigneeEntityID: USERS_ENTITY_ID,
                AssigneeRecordID: ASSIGNEE_USER_ID,
            } as unknown as mjBizAppsTasksTaskAssignmentEntity;

            const msg = await assigneeSeatMessage(assignment);
            assert.equal(msg, null);
        } finally {
            source.GetSystemUser = orig;
        }
    });
});

describe('CollaborationTaskEntityServer status guardrails', () => {
    function createMockStatusProvider(options: { closedAt: string | null; canContribute: boolean }) {
        const provider = {
            EntityByName(name: string) {
                if (name === 'MJ_BizApps_Tasks: Tasks') return { ID: TASKS_ENTITY_ID, Name: name };
                return { ID: '88888888-8888-4888-8888-888888888888', Name: name };
            },
            GetEntityObject() { return undefined; },
            EntityByID() { return { Name: 'x' }; },
            async RunView(params: { EntityName: string; ExtraFilter?: string }) {
                const { EntityName } = params;
                if (EntityName === 'MJ_BizApps_Tasks: Tasks') {
                    return { Success: true, Results: [{ RootParentID: TASK_ID }] };
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                    return { Success: true, Results: [{ SpaceID: CHILD_SPACE_ID, Band: 'Shared' }] };
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return { Success: true, Results: [{ ID: CHILD_SPACE_ID, ParentID: null, InheritsMembership: false, ClosedAt: options.closedAt, OwnerID: '88888888-8888-4888-8888-888888888888', AgentRetrieval: 'Included', SpaceTypeID: '88888888-8888-4888-8888-888888888888' }] };
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    return { Success: true, Results: [{ SpaceID: CHILD_SPACE_ID, UserID: ASSIGNEE_USER_ID, Status: 'Active', Band: 'Shared', SpaceRoleTypeID: ROLE_ID }] };
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return { Success: true, Results: [{ ID: ROLE_ID, Level: 10, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: options.canContribute }] };
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                    return { Success: true, Results: [{ ID: '88888888-8888-4888-8888-888888888888', DriverKey: null }] };
                }
                return { Success: true, Results: [] };
            },
            async RunViews(queries: Array<{ EntityName: string; ExtraFilter?: string }>) {
                return Promise.all(queries.map(q => provider.RunView(q)));
            },
        };
        return provider;
    }

    function makeTask(provider: object, user: UserInfo) {
        const task = Object.create(CollaborationTaskEntityServer.prototype) as CollaborationTaskEntityServer;
        Object.defineProperties(task, {
            ID: { value: TASK_ID, writable: true },
            IsSaved: { value: true, writable: true },
            Fields: { value: [{ Name: 'Status', Dirty: true }], writable: true },
            ProviderToUse: { value: provider, writable: true },
            RunViewProviderToUse: { value: provider, writable: true },
            ContextCurrentUser: { value: user, writable: true },
        });
        return task;
    }

    it('refuses status update when the space is closed', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: '2026-09-01', canContribute: true });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;
            const task = makeTask(provider, user);
            const res = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(task);
            assert.equal(res.Success, false);
            const err = res.Errors.find((e) => e.Source === 'Status');
            assert.ok(err, 'Expected error on Status');
            assert.equal(err?.Message, 'Task refused: cannot update a task in a closed space.');
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('refuses status update when user lacks canContribute', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: null, canContribute: false });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;
            const task = makeTask(provider, user);
            const res = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(task);
            assert.equal(res.Success, false);
            const err = res.Errors.find((e) => e.Source === 'Status');
            assert.ok(err, 'Expected error on Status');
            assert.equal(err?.Message, 'Task refused: you do not have permission to update task status in this space.');
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('permits status update when user has canContribute in an open space', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: null, canContribute: true });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;
            const task = makeTask(provider, user);
            const res = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(task);
            assert.equal(res.Success, true);
            assert.equal(res.Errors.length, 0);
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('refuses status update for staff users without contributing seat', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: null, canContribute: false });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;
            const task = makeTask(provider, user);
            const res = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(task);
            assert.equal(res.Success, false);
            assert.ok(res.Errors.some((e: ValidationErrorInfo) => e.Source === 'Status'));
        } finally {
            source.GetSystemUser = orig;
        }
    });
});

