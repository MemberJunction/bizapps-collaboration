import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
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
        UserRoles: [{ Role: 'UI' }],
    };
    const user = partialUser as UserInfo;

    const FILES_ENTITY_ID = '33642155-617e-4825-a2cc-f071a60f3739';
    const OTHER_ENTITY_ID = '55555555-5555-4555-8555-555555555555';
    const SPACE_ID = '22222222-2222-4222-8222-222222222222';
    const FILE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    function mockProvider(): IMetadataProvider {
        const mock: Partial<IMetadataProvider> = {
            EntityByName(name: string) {
                if (name === 'MJ: Files') return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByName']>;
                if (name === 'MJ_BizApps_Tasks: Tasks') return { ID: OTHER_ENTITY_ID, Name: 'MJ_BizApps_Tasks: Tasks' } as ReturnType<IMetadataProvider['EntityByName']>;
                return undefined;
            },
            EntityByID(id: string) {
                if (id.toLowerCase() === FILES_ENTITY_ID.toLowerCase()) return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByID']>;
                return undefined;
            },
            async RunViews() {
                return [{ Success: true, Results: [] }];
            },
            async GetEntityObject(entityName: string) {
                const mockEntity: Partial<BaseEntity> = {};
                return mockEntity as BaseEntity;
            },
        };
        return mock as IMetadataProvider;
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
        });

        vouchStoredFile(item);
        try {
            const originalValidateAsync = Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync;
            Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync = async function () {
                return { Success: true, Errors: [] };
            };

            try {
                // When vouched, it passes the isFile voucher check and proceeds to loadWriteContext
                // (which fails because loadWriteContext is not mocked here, proving it passed the file check!)
                const res = await SpaceItemEntityServer.prototype.ValidateAsync.call(item).catch((err: Error) => {
                    return { Success: false, Errors: [{ Source: 'Band', Message: err.message }] };
                });
                const fileCheckErr = res.Errors.find((e: { Message: string }) => e.Message.includes('file items must be created through space upload'));
                assert.equal(fileCheckErr, undefined, 'Vouched item should not fail file upload check');
            } finally {
                Object.getPrototypeOf(SpaceItemEntityServer.prototype).ValidateAsync = originalValidateAsync;
            }
        } finally {
            releaseStoredFile(item);
        }
    });

    it('Delete() skips file cleanup when other items still point to the file', async () => {
        let cleanupCalled = false;
        const providerMock: Partial<IMetadataProvider> = {
            EntityByName(name: string) {
                if (name === 'MJ: Files') return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByName']>;
                return undefined;
            },
            EntityByID(id: string) {
                if (id.toLowerCase() === FILES_ENTITY_ID.toLowerCase()) return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByID']>;
                return undefined;
            },
            async RunView() {
                return { Success: true, Results: [{ ID: 'other-item-id' }] };
            },
            async RunViews() {
                // Return 1 other item still pointing to this file
                return [{ Success: true, Results: [{ ID: 'other-item-id' }] }];
            },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ: Files') {
                    cleanupCalled = true;
                }
                const mockEntity: Partial<BaseEntity> = {
                    async Load() { return true; },
                    async Delete() { return true; },
                };
                return mockEntity as BaseEntity;
            },
        };
        const provider = providerMock as IMetadataProvider;

        const item = Object.create(SpaceItemEntityServer.prototype) as SpaceItemEntityServer;
        Object.defineProperties(item, {
            ID: { value: 'item-1', writable: true },
            EntityID: { value: FILES_ENTITY_ID, writable: true },
            RecordID: { value: `ID|${FILE_ID}`, writable: true },
            ProviderToUse: { value: provider, writable: true },
            ContextCurrentUser: { value: user, writable: true },
        });

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
        const providerMock: Partial<IMetadataProvider> = {
            EntityByName(name: string) {
                if (name === 'MJ: Files') return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByName']>;
                return undefined;
            },
            EntityByID(id: string) {
                if (id.toLowerCase() === FILES_ENTITY_ID.toLowerCase()) return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as ReturnType<IMetadataProvider['EntityByID']>;
                return undefined;
            },
            async RunView() {
                return { Success: true, Results: [] };
            },
            async RunViews() {
                // Return 0 other items pointing to this file
                return [{ Success: true, Results: [] }];
            },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ: Files') {
                    cleanupCalled = true;
                }
                const mockEntity: Partial<BaseEntity> = {
                    async Load() { return true; },
                    async Delete() { return true; },
                };
                return mockEntity as BaseEntity;
            },
        };
        const provider = providerMock as IMetadataProvider;

        const item = Object.create(SpaceItemEntityServer.prototype) as SpaceItemEntityServer;
        Object.defineProperties(item, {
            ID: { value: 'item-1', writable: true },
            EntityID: { value: FILES_ENTITY_ID, writable: true },
            RecordID: { value: `ID|${FILE_ID}`, writable: true },
            ProviderToUse: { value: provider, writable: true },
            ContextCurrentUser: { value: user, writable: true },
        });

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
});
