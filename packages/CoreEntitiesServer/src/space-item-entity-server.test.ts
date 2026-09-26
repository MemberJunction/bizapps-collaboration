import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    BaseEntity,
    EntityPermissionType,
    TransactionGroupBase,
    WellKnownUserSource,
    type IMetadataProvider,
    type IRunViewProvider,
    type UserInfo,
    type UserRoleInfo,
} from '@memberjunction/core';
import { SpaceItemEntityServer, vouchStoredFile, releaseStoredFile } from '../dist/SpaceItemEntityServer.js';

describe('SpaceItemEntityServer file ownership and validation', () => {
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    before(() => {
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
    });

    const partialUser: Partial<UserInfo> = {
        ID: '11111111-1111-4111-8111-111111111111',
        UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
    };
    const user = partialUser as UserInfo;

    const FILES_ENTITY_ID = '33642155-617e-4825-a2cc-f071a60f3739';
    const OTHER_ENTITY_ID = '55555555-5555-4555-8555-555555555555';
    const SPACE_ID = '22222222-2222-4222-8222-222222222222';
    const FILE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const ROLE_ID = '44444444-4444-4444-8444-444444444444';

    function mockProvider(): IMetadataProvider {
        const mock = {
            EntityByName(name: string) {
                if (name === 'MJ: Files') return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByName']>;
                if (name === 'MJ_BizApps_Tasks: Tasks') return { ID: OTHER_ENTITY_ID, Name: 'MJ_BizApps_Tasks: Tasks' } as ReturnType<IMetadataProvider['EntityByName']>;
                return undefined;
            },
            EntityByID(id: string) {
                if (id.toLowerCase() === FILES_ENTITY_ID.toLowerCase()) return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByID']>;
                return undefined;
            },
            async RunView(params: { EntityName: string }) {
                if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return { Success: true, Results: [{ ID: SPACE_ID, ParentID: null, SpaceTypeID: null, AgentRetrieval: 'Inherited', AllowParentAssignees: true }] };
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return { Success: true, Results: [{ ID: ROLE_ID, Level: 100, MaxGrantableLevel: 100, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true }] };
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    return { Success: true, Results: [{ ID: 'mem-1', SpaceID: SPACE_ID, UserID: user.ID, Status: 'Active', Band: 'Team', SpaceRoleTypeID: ROLE_ID }] };
                }
                return { Success: true, Results: [] };
            },
            async RunViews(views: Array<{ EntityName: string }>) {
                return views.map((v) => {
                    if (v.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                        return { Success: true, Results: [{ ID: 'mem-1', SpaceID: SPACE_ID, UserID: user.ID, Status: 'Active', Band: 'Team', SpaceRoleTypeID: ROLE_ID }] };
                    }
                    if (v.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                        return { Success: true, Results: [{ ID: ROLE_ID, Level: 100, MaxGrantableLevel: 100, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true }] };
                    }
                    return { Success: true, Results: [] };
                });
            },
            async GetEntityObject(_entityName: string) {
                return {
                    async Load() { return true; },
                    async Delete() { return true; },
                } as unknown as BaseEntity;
            },
        };
        return mock as unknown as IMetadataProvider;
    }

    it('refuses saving a new file item that was not vouched through space upload', async () => {
        const item = Object.create(SpaceItemEntityServer.prototype) as SpaceItemEntityServer;
        Object.defineProperties(item, {
            ContextCurrentUser: { value: user, writable: true },
            IsSaved: { value: false, writable: true },
            ID: { value: '99999999-9999-4999-8999-999999999999', writable: true },
            SpaceID: { value: SPACE_ID, writable: true },
            EntityID: { value: FILES_ENTITY_ID, writable: true },
            RecordID: { value: `ID|${FILE_ID}`, writable: true },
            Band: { value: 'Shared', writable: true },
            ProviderToUse: { value: mockProvider(), writable: true },
            Fields: {
                value: [
                    { Name: 'SpaceID', Dirty: true, Value: SPACE_ID },
                    { Name: 'EntityID', Dirty: true, Value: FILES_ENTITY_ID },
                    { Name: 'RecordID', Dirty: true, Value: `ID|${FILE_ID}` },
                    { Name: 'Band', Dirty: true, Value: 'Shared' },
                ],
                writable: true,
            },
        });

        // Mock ValidateAsync super call
        const originalValidateAsync = Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync = async function () {
            return { Success: true, Errors: [] };
        };

        try {
            const res = await SpaceItemEntityServer.prototype.ValidateAsync.call(item);
            assert.equal(res.Success, false);
            assert.equal(res.Errors.length, 1);
            assert.equal(res.Errors[0].Message, 'Item change refused: file items must be created through space upload.');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync = originalValidateAsync;
        }
    });

    it('refuses changing an existing item to point to a file without voucher', async () => {
        const item = Object.create(SpaceItemEntityServer.prototype) as SpaceItemEntityServer;
        Object.defineProperties(item, {
            ContextCurrentUser: { value: user, writable: true },
            IsSaved: { value: true, writable: true },
            ID: { value: '99999999-9999-4999-8999-999999999999', writable: true },
            SpaceID: { value: SPACE_ID, writable: true },
            EntityID: { value: FILES_ENTITY_ID, writable: true },
            RecordID: { value: `ID|${FILE_ID}`, writable: true },
            Band: { value: 'Shared', writable: true },
            ProviderToUse: { value: mockProvider(), writable: true },
            Fields: {
                value: [
                    { Name: 'SpaceID', Dirty: false, Value: SPACE_ID },
                    { Name: 'EntityID', Dirty: true, Value: FILES_ENTITY_ID, OldValue: OTHER_ENTITY_ID },
                    { Name: 'RecordID', Dirty: true, Value: `ID|${FILE_ID}` },
                    { Name: 'Band', Dirty: false, Value: 'Shared' },
                ],
                writable: true,
            },
        });

        const originalValidateAsync = Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync = async function () {
            return { Success: true, Errors: [] };
        };

        try {
            const res = await SpaceItemEntityServer.prototype.ValidateAsync.call(item);
            assert.equal(res.Success, false);
            assert.equal(res.Errors[0].Message, 'Item change refused: file items must be created through space upload.');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync = originalValidateAsync;
        }
    });

    it('allows vouched file item through vouchStoredFile', async () => {
        const item = Object.create(SpaceItemEntityServer.prototype) as SpaceItemEntityServer;
        Object.defineProperties(item, {
            ContextCurrentUser: { value: user, writable: true },
            IsSaved: { value: false, writable: true },
            ID: { value: '99999999-9999-4999-8999-999999999999', writable: true },
            SpaceID: { value: SPACE_ID, writable: true },
            EntityID: { value: FILES_ENTITY_ID, writable: true },
            RecordID: { value: `ID|${FILE_ID}`, writable: true },
            Band: { value: 'Shared', writable: true },
            ProviderToUse: { value: mockProvider(), writable: true },
            Fields: {
                value: [
                    { Name: 'SpaceID', Dirty: true, Value: SPACE_ID },
                    { Name: 'EntityID', Dirty: true, Value: FILES_ENTITY_ID },
                    { Name: 'RecordID', Dirty: true, Value: `ID|${FILE_ID}` },
                    { Name: 'Band', Dirty: true, Value: 'Shared' },
                ],
                writable: true,
            },
            PromotedAt: { value: null, writable: true },
            PromotedByUserID: { value: null, writable: true },
        });

        vouchStoredFile(item);
        try {
            const originalValidateAsync = Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync;
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync = async function () {
                return { Success: true, Errors: [] };
            };

            try {
                const res = await SpaceItemEntityServer.prototype.ValidateAsync.call(item);
                assert.equal(res.Success, true, 'Vouched item should validate successfully');
                assert.equal(res.Errors.length, 0, 'Vouched item should have no validation errors');
            } finally {
                Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync = originalValidateAsync;
            }
        } finally {
            releaseStoredFile(item);
        }
    });

    interface MockProviderOptions {
        itemsRunViewResult?: Array<{ ID: string }>;
        runViewFails?: boolean;
        submitFails?: boolean;
        onFileCleanup?: () => void;
        usesResult?: Array<{ ID: string }>;
        noticesResult?: Array<{ ID: string }>;
        onChildDelete?: (entityName: string, entity: BaseEntity) => void;
        onRunView?: (params: { EntityName: string; ResultType?: string; IgnoreMaxRows?: boolean; ExtraFilter?: string }) => void;
    }

    function createDeleteMockProvider(opts: MockProviderOptions = {}): IMetadataProvider {
        const mockTg: Partial<TransactionGroupBase> = {
            AddTransaction() {},
            async Submit() { return !opts.submitFails; },
        };

        const mock = {
            EntityByName(name: string) {
                if (name === 'MJ: Files') return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByName']>;
                return undefined;
            },
            EntityByID(id: string) {
                if (id.toLowerCase() === FILES_ENTITY_ID.toLowerCase()) return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByID']>;
                return undefined;
            },
            async CreateTransactionGroup() {
                return mockTg as TransactionGroupBase;
            },
            async RunView(params: { EntityName: string; ResultType?: string; IgnoreMaxRows?: boolean; ExtraFilter?: string }) {
                opts.onRunView?.(params);
                if (opts.runViewFails && params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                    return { Success: false, ErrorMessage: 'Database connection failed', Results: [] };
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Item Uses') {
                    const results = (opts.usesResult ?? []).map((r) => {
                        const ent = {
                            ID: r.ID,
                            TransactionGroup: undefined as TransactionGroupBase | undefined,
                            async Delete() {
                                opts.onChildDelete?.(params.EntityName, ent as unknown as BaseEntity);
                                return true;
                            },
                        };
                        return ent;
                    });
                    return { Success: true, Results: results };
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Share Notices') {
                    const results = (opts.noticesResult ?? []).map((r) => {
                        const ent = {
                            ID: r.ID,
                            TransactionGroup: undefined as TransactionGroupBase | undefined,
                            async Delete() {
                                opts.onChildDelete?.(params.EntityName, ent as unknown as BaseEntity);
                                return true;
                            },
                        };
                        return ent;
                    });
                    return { Success: true, Results: results };
                }
                return { Success: true, Results: opts.itemsRunViewResult ?? [] };
            },
            async RunViews() {
                if (opts.runViewFails) {
                    return [{ Success: false, ErrorMessage: 'Database connection failed', Results: [] }];
                }
                return [{ Success: true, Results: opts.itemsRunViewResult ?? [] }];
            },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ: Files') {
                    opts.onFileCleanup?.();
                }
                const entity = {
                    TransactionGroup: undefined as TransactionGroupBase | undefined,
                    async Load() { return true; },
                    async Delete() {
                        opts.onChildDelete?.(entityName, entity as unknown as BaseEntity);
                        return true;
                    },
                };
                return entity as unknown as BaseEntity;
            },
        };
        return mock as unknown as IMetadataProvider;
    }

    function createMockItem(provider: IMetadataProvider, recordId: string = `ID|${FILE_ID}`): SpaceItemEntityServer {
        const item = Object.create(SpaceItemEntityServer.prototype) as SpaceItemEntityServer;
        Object.defineProperties(item, {
            ID: { value: 'item-1', writable: true },
            IsSaved: { value: true, writable: true },
            TransactionGroup: { value: undefined, writable: true },
            EntityID: { value: FILES_ENTITY_ID, writable: true },
            RecordID: { value: recordId, writable: true },
            ProviderToUse: { value: provider, writable: true },
            ContextCurrentUser: { value: user, writable: true },
            CheckPermissions: { value: () => true, writable: true },
            _resultHistory: { value: [], writable: true },
        });
        return item;
    }

    it('Delete() returns false when caller lacks delete permission without touching references or file', async () => {
        let queryRun = false;
        let tgCreated = false;
        const providerMock = {
            async CreateTransactionGroup() {
                tgCreated = true;
                const mockTg: Partial<TransactionGroupBase> = {
                    AddTransaction() {},
                    async Submit() { return true; },
                };
                return mockTg as TransactionGroupBase;
            },
            async RunView() {
                queryRun = true;
                return { Success: true, Results: [] };
            },
        };
        const item = Object.create(SpaceItemEntityServer.prototype) as SpaceItemEntityServer;
        Object.defineProperties(item, {
            ID: { value: 'item-1', writable: true },
            IsSaved: { value: true, writable: true },
            ProviderToUse: { value: providerMock as unknown as IMetadataProvider, writable: true },
            ContextCurrentUser: { value: user, writable: true },
            CheckPermissions: {
                value: (_type: EntityPermissionType, throwError: boolean) => {
                    if (throwError) {
                        throw new Error('User does NOT have permission to Delete Space Item records.');
                    }
                    return false;
                },
                writable: true,
            },
            _resultHistory: { value: [], writable: true },
        });

        const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
        assert.equal(ok, false, 'Delete must return false when caller lacks delete permission');
        assert.equal(queryRun, false, 'No queries should run when delete permission is refused');
        assert.equal(tgCreated, false, 'No transaction should be created when delete permission is refused');
        assert.ok(item.LatestResult, 'LatestResult must be recorded on refusal');
        assert.equal(item.LatestResult.Success, false);
        assert.equal(item.LatestResult.Type, 'delete');
        assert.match(item.LatestResult.CompleteMessage, /permission/i);
    });

    it('Delete() skips file cleanup when other items still point to the file', async () => {
        let cleanupCalled = false;
        const provider = createDeleteMockProvider({
            itemsRunViewResult: [{ ID: 'other-item-id' }],
            onFileCleanup: () => { cleanupCalled = true; },
        });
        const item = createMockItem(provider);

        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            return true;
        };

        try {
            const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(ok, true);
            assert.equal(cleanupCalled, false, 'Cleanup should not be called when another item points to the file');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });

    it('Delete() calls file cleanup when no other item points to the file', async () => {
        let cleanupCalled = false;
        const provider = createDeleteMockProvider({
            itemsRunViewResult: [],
            onFileCleanup: () => { cleanupCalled = true; },
        });
        const item = createMockItem(provider);

        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            return true;
        };

        try {
            const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(ok, true);
            assert.equal(cleanupCalled, true, 'Cleanup should be called when no other items point to the file');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });

    it('Delete() preserves file and skips cleanup when count query fails', async () => {
        let cleanupCalled = false;
        const provider = createDeleteMockProvider({
            runViewFails: true,
            onFileCleanup: () => { cleanupCalled = true; },
        });
        const item = createMockItem(provider);

        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            return true;
        };

        try {
            const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(ok, true);
            assert.equal(cleanupCalled, false, 'File cleanup must NOT run when count query fails');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });

    it('Delete() skips cleanup when file record id is unparseable', async () => {
        let cleanupCalled = false;
        const provider = createDeleteMockProvider({
            itemsRunViewResult: [],
            onFileCleanup: () => { cleanupCalled = true; },
        });
        const item = createMockItem(provider, "invalid'quote--id");

        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            return true;
        };

        try {
            const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(ok, true);
            assert.equal(cleanupCalled, false, 'File cleanup must NOT run when RecordID is not a valid UUID');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });

    it('Delete() returns false and skips file cleanup when transaction commit fails', async () => {
        let cleanupCalled = false;
        const provider = createDeleteMockProvider({
            submitFails: true,
            onFileCleanup: () => { cleanupCalled = true; },
        });
        const item = createMockItem(provider);

        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            return true;
        };

        try {
            const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(ok, false, 'Delete must return false when transaction commit fails');
            assert.equal(cleanupCalled, false, 'File cleanup must NOT run when transaction commit fails');
            assert.equal(item.TransactionGroup, undefined, 'TransactionGroup must be cleared on failed submit');
            assert.ok(item.LatestResult, 'LatestResult must be recorded on commit failure');
            assert.equal(item.LatestResult.Success, false);
            assert.equal(item.LatestResult.Type, 'delete');
            assert.match(item.LatestResult.CompleteMessage, /transaction failed/i);
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });

    it('Delete() queues child uses and share notices into the same transaction group with IgnoreMaxRows: true', async () => {
        const queuedEntities: Array<{ name: string; tg: TransactionGroupBase | undefined }> = [];
        const runViewCalls: Array<{ EntityName: string; ResultType?: string; IgnoreMaxRows?: boolean }> = [];
        let createdTg: TransactionGroupBase | undefined;
        const provider = createDeleteMockProvider({
            usesResult: [{ ID: 'use-1' }],
            noticesResult: [{ ID: 'notice-1' }],
            onChildDelete: (name, ent) => {
                queuedEntities.push({ name, tg: ent.TransactionGroup });
            },
            onRunView: (params) => {
                runViewCalls.push(params);
            },
        });
        const originalCreateTg = provider.CreateTransactionGroup;
        provider.CreateTransactionGroup = async () => {
            const tg = await originalCreateTg();
            createdTg = tg;
            return tg;
        };

        const item = createMockItem(provider);
        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            queuedEntities.push({ name: 'item', tg: this.TransactionGroup });
            return true;
        };

        try {
            const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(ok, true);
            assert.equal(queuedEntities.length, 3, 'Use, notice, and item must all be queued');
            assert.ok(createdTg, 'Transaction group should be created');
            assert.equal(queuedEntities[0].name, 'MJ_BizApps_Collaboration: Item Uses');
            assert.equal(queuedEntities[0].tg, createdTg);
            assert.equal(queuedEntities[1].name, 'MJ_BizApps_Collaboration: Share Notices');
            assert.equal(queuedEntities[1].tg, createdTg);
            assert.equal(queuedEntities[2].name, 'item');
            assert.equal(queuedEntities[2].tg, createdTg);

            const usesCall = runViewCalls.find((c) => c.EntityName === 'MJ_BizApps_Collaboration: Item Uses');
            assert.ok(usesCall, 'Item Uses RunView call must occur');
            assert.equal(usesCall.IgnoreMaxRows, true, 'Item Uses query must set IgnoreMaxRows: true');
            assert.equal(usesCall.ResultType, 'entity_object', 'Item Uses query must set ResultType: entity_object');

            const noticesCall = runViewCalls.find((c) => c.EntityName === 'MJ_BizApps_Collaboration: Share Notices');
            assert.ok(noticesCall, 'Share Notices RunView call must occur');
            assert.equal(noticesCall.IgnoreMaxRows, true, 'Share Notices query must set IgnoreMaxRows: true');
            assert.equal(noticesCall.ResultType, 'entity_object', 'Share Notices query must set ResultType: entity_object');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });

    it('Delete() clears transaction group on failure so a retry starts fresh with a new transaction group', async () => {
        let shouldFail = true;
        let createdGroupsCount = 0;
        const provider = createDeleteMockProvider({
            itemsRunViewResult: [],
        });
        provider.CreateTransactionGroup = async () => {
            createdGroupsCount++;
            return {
                AddTransaction() {},
                async Submit() { return !shouldFail; },
            } as unknown as TransactionGroupBase;
        };

        const item = createMockItem(provider);
        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            return true;
        };

        try {
            // First call fails
            const firstOk = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(firstOk, false, 'First attempt fails');
            assert.equal(item.TransactionGroup, undefined, 'Item transaction group cleared after failure');
            assert.equal(createdGroupsCount, 1);

            // Second call succeeds
            shouldFail = false;
            const secondOk = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(secondOk, true, 'Retry attempt succeeds');
            assert.equal(createdGroupsCount, 2, 'Retry created a fresh transaction group');
            assert.equal(item.TransactionGroup, undefined, 'Item transaction group cleared after success');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });

    it('Delete() inside caller transaction group defers cleanup to TransactionNotifications$', async () => {
        let cleanupCalled = false;
        const provider = createDeleteMockProvider({
            itemsRunViewResult: [],
            onFileCleanup: () => { cleanupCalled = true; },
        });
        const item = createMockItem(provider);

        type NotificationCallback = (n: { success: boolean }) => void;
        const subscribers: NotificationCallback[] = [];
        const callerTg = {
            AddTransaction() {},
            async Submit() { return true; },
            TransactionNotifications$: {
                subscribe(cb: NotificationCallback) {
                    subscribers.push(cb);
                    return { unsubscribe() {} };
                },
            },
        } as unknown as TransactionGroupBase;

        item.TransactionGroup = callerTg;

        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            return true;
        };

        try {
            const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(ok, true, 'Delete queues in caller group and returns true');
            assert.equal(cleanupCalled, false, 'File cleanup must NOT run before caller group commits');
            assert.equal(subscribers.length, 1, 'Subscribed to TransactionNotifications$');

            // Emit success
            await subscribers[0]({ success: true });
            assert.equal(cleanupCalled, true, 'File cleanup runs after TransactionNotifications$ reports success');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });

    it('Delete() inside caller transaction group skips file cleanup when caller group fails', async () => {
        let cleanupCalled = false;
        const provider = createDeleteMockProvider({
            itemsRunViewResult: [],
            onFileCleanup: () => { cleanupCalled = true; },
        });
        const item = createMockItem(provider);

        type NotificationCallback = (n: { success: boolean }) => void;
        const subscribers: NotificationCallback[] = [];
        const callerTg = {
            AddTransaction() {},
            async Submit() { return false; },
            TransactionNotifications$: {
                subscribe(cb: NotificationCallback) {
                    subscribers.push(cb);
                    return { unsubscribe() {} };
                },
            },
        } as unknown as TransactionGroupBase;

        item.TransactionGroup = callerTg;

        const originalDelete = Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete;
        Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = async function () {
            return true;
        };

        try {
            const ok = await SpaceItemEntityServer.prototype.Delete.call(item);
            assert.equal(ok, true, 'Delete queues in caller group and returns true');
            assert.equal(subscribers.length, 1, 'Subscribed to TransactionNotifications$');

            // Emit failure
            await subscribers[0]({ success: false });
            assert.equal(cleanupCalled, false, 'File cleanup must NOT run when caller group fails');
        } finally {
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).Delete = originalDelete;
        }
    });
});

