import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { grantAdministerTo, grantAdministerToDefaultRoles } from './administer.test-support.ts';
import { WellKnownUserSource, type UserInfo, type UserRoleInfo } from '@memberjunction/core';
import type { ValidationErrorInfo } from '@memberjunction/global';
import type { mjBizAppsTasksTaskAssignmentEntity } from '@mj-biz-apps/tasks-entities';
import { CollaborationTaskEntityServer } from '../dist/task-entity-server.js';
import { assigneeSeatMessage, relevantFieldsChanged } from '../dist/task-space.js';

// Staff stand-ins: the engine answers 'Administer Spaces' the way the shipped grants do, by the roles a test user carries
let restoreAdminister: () => void;
before(() => { restoreAdminister = grantAdministerToDefaultRoles(); });
after(() => { restoreAdminister(); });

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
    function createMockProvider(allowParentAssignees: boolean, closedAt: string | null = null) {
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
                        return { Success: true, Results: [{ ID: CHILD_SPACE_ID, ParentID: PARENT_SPACE_ID, InheritsMembership: true, AllowParentAssignees: allowParentAssignees, ClosedAt: closedAt }] };
                    }
                    if (ExtraFilter.includes(PARENT_SPACE_ID)) {
                        return { Success: true, Results: [{ ID: PARENT_SPACE_ID, ParentID: null, InheritsMembership: true, AllowParentAssignees: true, ClosedAt: null }] };
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

    it('seats a Person assignee through the user that links to a People subtype, with LinkedUserID empty', async () => {
        const PERSON_ID = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
        const PEOPLE_ENTITY_ID = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';
        const PLATFORM_PEOPLE_ID = 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC';
        const peopleEntity = { ID: PEOPLE_ENTITY_ID, Name: 'MJ_BizApps_Common: People', ParentChain: [] };
        const platformPeople = { ID: PLATFORM_PEOPLE_ID, Name: 'Platform: People', ParentChain: [peopleEntity] };
        const base = createMockProvider(true);
        const peopleReads: string[] = [];
        const provider = {
            ...base,
            Entities: [peopleEntity, platformPeople],
            EntityByID(id: string) { return [peopleEntity, platformPeople].find((e) => e.ID.toLowerCase() === id.toLowerCase()) ?? null; },
            async RunView(params: { EntityName: string; ExtraFilter?: string }) {
                if (params.EntityName === 'MJ: Users') {
                    return { Success: true, Results: params.ExtraFilter?.includes(PERSON_ID.toLowerCase()) ? [{ ID: ASSIGNEE_USER_ID, LinkedEntityRecordID: PERSON_ID }] : [] };
                }
                if (params.EntityName === 'MJ_BizApps_Common: People') {
                    peopleReads.push(params.ExtraFilter ?? '');
                    return { Success: true, Results: [] };
                }
                return base.RunView(params);
            },
        };
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as UserInfo;
        try {
            const assignment = {
                IsSaved: false,
                Fields: [],
                ProviderToUse: provider,
                RunViewProviderToUse: provider,
                ContextCurrentUser: { ID: CALLER_USER_ID, UserRoles: [{ Role: 'Space Participant' }] } as unknown as UserInfo,
                TaskID: TASK_ID,
                AssigneeEntityID: PEOPLE_ENTITY_ID,
                AssigneeRecordID: PERSON_ID,
            } as unknown as mjBizAppsTasksTaskAssignmentEntity;

            assert.equal(await assigneeSeatMessage(assignment), null);
            assert.deepEqual(peopleReads, []);
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

    describe("holds by the authorization, not by a role's name", () => {
        let restore: () => void;
        before(() => { restore = grantAdministerTo(['Community Manager']); });
        after(() => { restore(); });

        async function assignAs(role: string): Promise<string | null> {
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
                    ContextCurrentUser: { ID: CALLER_USER_ID, UserRoles: [{ Role: role }] } as unknown as UserInfo,
                    TaskID: TASK_ID,
                    AssigneeEntityID: USERS_ENTITY_ID,
                    AssigneeRecordID: ASSIGNEE_USER_ID,
                } as unknown as mjBizAppsTasksTaskAssignmentEntity;
                return await assigneeSeatMessage(assignment);
            } finally {
                source.GetSystemUser = orig;
            }
        }

        it('lets a user whose only role is one no code knows, and that holds the grant, assign someone seated above', async () => {
            assert.equal(await assignAs('Community Manager'), null);
        });

        it('refuses a UI user whose role lost the grant', async () => {
            assert.equal(await assignAs('UI'), 'Assignment refused: participants may not assign people seated above this space.');
        });
    });

    it('refuses assignment in a closed space', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as UserInfo;
        try {
            const provider = createMockProvider(true, '2026-01-01T00:00:00Z');
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
            assert.equal(msg, 'Assignment refused: cannot update assignments in a closed space.');
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

    function makeTask(provider: object, user: UserInfo, fields: Array<{ Name: string; Dirty: boolean }> = [{ Name: 'Status', Dirty: true }]) {
        const task = Object.create(CollaborationTaskEntityServer.prototype) as CollaborationTaskEntityServer;
        Object.defineProperties(task, {
            ID: { value: TASK_ID, writable: true },
            IsSaved: { value: true, writable: true },
            Fields: { value: fields, writable: true },
            ProviderToUse: { value: provider, writable: true },
            RunViewProviderToUse: { value: provider, writable: true },
            ContextCurrentUser: { value: user, writable: true },
            _resultHistory: { value: [], writable: true },
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

    it('refuses name or priority update when the space is closed', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: '2026-09-01', canContribute: true });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;

            // Name update
            const nameTask = makeTask(provider, user, [{ Name: 'Name', Dirty: true }]);
            const nameRes = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(nameTask);
            assert.equal(nameRes.Success, false);
            const nameErr = nameRes.Errors.find((e) => e.Source === 'Name');
            assert.ok(nameErr, 'Expected error on Name');
            assert.equal(nameErr?.Message, 'Task refused: cannot update a task in a closed space.');

            // Priority update
            const prioTask = makeTask(provider, user, [{ Name: 'Priority', Dirty: true }]);
            const prioRes = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(prioTask);
            assert.equal(prioRes.Success, false);
            const prioErr = prioRes.Errors.find((e) => e.Source === 'Priority');
            assert.ok(prioErr, 'Expected error on Priority');
            assert.equal(prioErr?.Message, 'Task refused: cannot update a task in a closed space.');
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
            const err = res.Errors.find((e: ValidationErrorInfo) => e.Source === 'Status');
            assert.ok(err, 'Expected error on Status');
            assert.equal(err?.Message, 'Task refused: you do not have permission to update task status in this space.');
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('permits TaskTypeStatusID update when user has canContribute in an open space', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: null, canContribute: true });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;
            const task = makeTask(provider, user, [{ Name: 'TaskTypeStatusID', Dirty: true }]);
            const res = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(task);
            assert.equal(res.Success, true);
            assert.equal(res.Errors.length, 0);
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('refuses TaskTypeStatusID update when user lacks canContribute', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: null, canContribute: false });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;
            const task = makeTask(provider, user, [{ Name: 'TaskTypeStatusID', Dirty: true }]);
            const res = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(task);
            assert.equal(res.Success, false);
            const err = res.Errors.find((e: ValidationErrorInfo) => e.Source === 'TaskTypeStatusID');
            assert.ok(err, 'Expected error on TaskTypeStatusID');
            assert.equal(err?.Message, 'Task refused: you do not have permission to update task status in this space.');
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('refuses TaskTypeStatusID update when the space is closed', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: '2026-09-01', canContribute: true });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;
            const task = makeTask(provider, user, [{ Name: 'TaskTypeStatusID', Dirty: true }]);
            const res = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(task);
            assert.equal(res.Success, false);
            const err = res.Errors.find((e: ValidationErrorInfo) => e.Source === 'TaskTypeStatusID');
            assert.ok(err, 'Expected error on TaskTypeStatusID');
            assert.equal(err?.Message, 'Task refused: cannot update a task in a closed space.');
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('refuses new subtask creation when parent task is in a closed space', async () => {
        const source = WellKnownUserSource.Instance;
        const orig = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID }) as Partial<UserInfo> as UserInfo;
        try {
            const provider = createMockStatusProvider({ closedAt: '2026-09-01', canContribute: true });
            const user = {
                ID: ASSIGNEE_USER_ID,
                UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
            } as Partial<UserInfo> as UserInfo;
            const task = Object.create(CollaborationTaskEntityServer.prototype) as CollaborationTaskEntityServer;
            Object.defineProperties(task, {
                ID: { value: '99999999-9999-4999-8999-999999999999', writable: true },
                ParentID: { value: TASK_ID, writable: true },
                IsSaved: { value: false, writable: true },
                Fields: { value: [{ Name: 'Name', Dirty: true }, { Name: 'ParentID', Dirty: true }], writable: true },
                ProviderToUse: { value: provider, writable: true },
                RunViewProviderToUse: { value: provider, writable: true },
                ContextCurrentUser: { value: user, writable: true },
            });
            const res = await CollaborationTaskEntityServer.prototype.ValidateAsync.call(task);
            assert.equal(res.Success, false);
            const err = res.Errors.find((e: ValidationErrorInfo) => e.Source === 'ParentID');
            assert.ok(err, 'Expected error on ParentID');
            assert.equal(err?.Message, 'Task refused: cannot create a task in a closed space.');
        } finally {
            source.GetSystemUser = orig;
        }
    });

    it('refuses task delete when the space is closed', async () => {
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
            const deleted = await CollaborationTaskEntityServer.prototype.Delete.call(task);
            assert.equal(deleted, false);
            assert.equal(task.LatestResult?.Message, 'Task delete refused: cannot delete a task in a closed space.');
        } finally {
            source.GetSystemUser = orig;
        }
    });
});

