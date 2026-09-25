import { randomUUID } from 'node:crypto';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { MJFileEntity } from '@memberjunction/core-entities';
import { mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import {
    collaborationFileStore,
    decideUploadBand,
    releaseStoredFile,
    uploadSpaceFile,
    vouchStoredFile,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { FILE_ENTITY, SPACE_ITEM_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount, readStoredFile } from '../world/local-storage-account.js';
import { worldStorageRoot } from '../world/seed-files.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const createdItemIds: string[] = [];
const createdFileIds: string[] = [];

const checks: NamedCheck[] = [
    {
        Id: 'library.LB4',
        Name: 'LB4 — seeded library items exist in database with correct bands',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const items = await FindRows<{ ID: string; SpaceID: string; Band: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID', 'SpaceID', 'Band'],
            );
            Assert(items.length > 0, 'Discovery has seeded items');
            const hasShared = items.some((i) => i.Band === 'Shared');
            const hasTeam = items.some((i) => i.Band === 'Team');
            Assert(hasShared, 'Discovery has Shared band item');
            Assert(hasTeam, 'Discovery has Team band item');
        },
    },
    {
        Id: 'library.LB5',
        Name: 'LB5 — deleting uploaded space item deletes linked file row and stored object',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
            const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
            const ada = await GetPersonaUser(ctx, 'ada');

            const outcome = await uploadSpaceFile({
                user: ada,
                storageUser: ctx.User,
                provider: ctx.Provider,
                store,
                spaceId: DISCOVERY_SPACE_ID,
                folder: 'Briefs',
                fileName: `lb5-delete-${Date.now()}.txt`,
                mimeType: 'text/plain',
                content: Buffer.from('LB5 file content to delete'),
                gate: () => decideUploadBand(ctx.Provider, ada, DISCOVERY_SPACE_ID),
            });
            Assert(outcome.ok, `UploadSpaceFile should succeed: ${outcome.ok ? '' : outcome.message}`);
            if (!outcome.ok) throw new Error(outcome.message);

            const { itemId, fileId } = outcome;
            createdItemIds.push(itemId);
            createdFileIds.push(fileId);

            // Verify file and item exist
            const fileEntity = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
            Assert(await fileEntity.Load(fileId), 'File row exists before delete');
            const storagePath = fileEntity.ProviderKey;
            Assert(!!storagePath, 'File row has storage path');
            if (!storagePath) throw new Error('File row has storage path');

            // Delete the space item
            const item = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
            Assert(await item.Load(itemId), 'Load created space item');
            const deleted = await item.Delete();
            Assert(deleted === true, 'Space item delete returned true');

            // Assert File row is gone
            const fileAfter = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
            const fileRowExists = await fileAfter.Load(fileId);
            Assert(!fileRowExists, 'MJ: Files row must be deleted after Space Item delete');

            // Assert stored object is gone
            let objectStillExists = true;
            try {
                await readStoredFile(ctx.Provider, ctx.User, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath);
            } catch {
                objectStillExists = false;
            }
            Assert(!objectStillExists, 'Stored file object must be removed after Space Item delete');
        },
    },
    {
        Id: 'library.LB6',
        Name: 'LB6 — deleting space item whose file another item still uses preserves file row and stored object',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
            const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
            const ada = await GetPersonaUser(ctx, 'ada');

            const outcome = await uploadSpaceFile({
                user: ada,
                storageUser: ctx.User,
                provider: ctx.Provider,
                store,
                spaceId: DISCOVERY_SPACE_ID,
                folder: 'Briefs',
                fileName: `lb6-share-${Date.now()}.txt`,
                mimeType: 'text/plain',
                content: Buffer.from('LB6 shared file content'),
                gate: () => decideUploadBand(ctx.Provider, ada, DISCOVERY_SPACE_ID),
            });
            Assert(outcome.ok, `UploadSpaceFile should succeed: ${outcome.ok ? '' : outcome.message}`);
            if (!outcome.ok) throw new Error(outcome.message);

            const { itemId, fileId } = outcome;
            createdItemIds.push(itemId);
            createdFileIds.push(fileId);

            // Verify file row and storage object exist
            const fileEntity = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
            Assert(await fileEntity.Load(fileId), 'File row exists');
            const storagePath = fileEntity.ProviderKey;
            Assert(!!storagePath, 'File row has storage path');
            if (!storagePath) throw new Error('File row has storage path');

            // Create a second space item pointing to the same file
            // Using raw RecordID without ID| prefix so that it satisfies unique constraint while pointing to fileId
            const filesEntity = ctx.Provider.EntityByName(FILE_ENTITY);
            Assert(!!filesEntity, 'MJ: Files entity found');
            if (!filesEntity) throw new Error('MJ: Files entity found');

            const secondItemId = randomUUID();
            createdItemIds.push(secondItemId);

            const appSchema = `${ctx.Schema || '__mj'}_BizAppsCollaboration`;
            if (ctx.Pool) {
                await ctx.Pool.request().query(`
                    INSERT INTO [${appSchema}].[SpaceItem]
                    (ID, SpaceID, EntityID, RecordID, Band, PromotedAt, PromotedByUserID)
                    VALUES ('${secondItemId}', '${DISCOVERY_SPACE_ID}', '${filesEntity.ID}', '${fileId}', 'Shared', GETUTCDATE(), '${ctx.User.ID}')
                `);
            } else {
                const secondItem = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
                secondItem.NewRecord();
                secondItem.SpaceID = DISCOVERY_SPACE_ID;
                secondItem.EntityID = filesEntity.ID;
                secondItem.RecordID = fileId;
                secondItem.Band = 'Shared';
                vouchStoredFile(secondItem);
                try {
                    await secondItem.Save();
                } finally {
                    releaseStoredFile(secondItem);
                }
            }

            // Verify second item exists
            const secondItemLoaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
            Assert(await secondItemLoaded.Load(secondItemId), 'Second item loaded');

            // 1. Delete the first item
            const item1 = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
            Assert(await item1.Load(itemId), 'Load first item');
            const deleted1 = await item1.Delete();
            Assert(deleted1 === true, 'First item delete returned true');

            // Assert File row STILL exists because second item still references it!
            const fileAfterFirstDelete = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
            const fileRowStays = await fileAfterFirstDelete.Load(fileId);
            Assert(fileRowStays === true, 'MJ: Files row must STAY when second Space Item still points to it');

            // Assert stored object STILL exists
            let objectStays = false;
            try {
                const bytes = await readStoredFile(ctx.Provider, ctx.User, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath);
                objectStays = bytes.length > 0;
            } catch {
                objectStays = false;
            }
            Assert(objectStays === true, 'Stored object must STAY when second Space Item still points to it');

            // 2. Delete the second item — now the file should be cleaned up!
            const deleted2 = await secondItemLoaded.Delete();
            Assert(deleted2 === true, 'Second item delete returned true');

            // Assert File row is now gone
            const fileAfterSecondDelete = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
            const fileRowGone = !(await fileAfterSecondDelete.Load(fileId));
            Assert(fileRowGone === true, 'MJ: Files row must be DELETED after last Space Item is deleted');

            // Assert stored object is now gone
            let objectGone = false;
            try {
                await readStoredFile(ctx.Provider, ctx.User, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath);
            } catch {
                objectGone = true;
            }
            Assert(objectGone === true, 'Stored object must be REMOVED after last Space Item is deleted');
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('library', {
    Setup: async () => {},
    Teardown: async (ctx: IntegrationCheckContext) => {
        while (createdItemIds.length > 0) {
            const id = createdItemIds.pop();
            if (id) {
                try {
                    const item = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
                    if (await item.Load(id)) {
                        await item.Delete();
                    }
                } catch {
                    // ignore teardown error
                }
            }
        }
        while (createdFileIds.length > 0) {
            const fid = createdFileIds.pop();
            if (fid) {
                try {
                    const file = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
                    if (await file.Load(fid)) {
                        await file.Delete();
                    }
                } catch {
                    // ignore teardown error
                }
            }
        }
    },
});
