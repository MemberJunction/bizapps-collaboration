import { MJFileEntity } from '@memberjunction/core-entities';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    collaborationFileStore,
    decideUploadBand,
    releaseStoredFile,
    uploadSpaceFile,
    vouchStoredFile,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { mjBizAppsCollaborationItemUseEntity, mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { randomUUID } from 'node:crypto';
import { FILE_ENTITY, ITEM_USE_ENTITY, SPACE_ITEM_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser, View } from '../wire.js';
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount, storedFileExists } from '../world/local-storage-account.js';
import { worldStorageRoot } from '../world/seed-files.js';
import { registerChecks } from './cleanup-helpers.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const COHORT_SPACE_ID = 'C1000001-0000-4000-8000-000000000005';
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

            // Assert stored object exists before delete
            Assert(await storedFileExists(ctx.Provider, ctx.User, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath), 'Stored file object exists before delete');

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
            const objectStillExists = await storedFileExists(ctx.Provider, ctx.User, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath);
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

            // Assert stored object exists before delete
            Assert(await storedFileExists(ctx.Provider, ctx.User, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath), 'Stored file object exists before delete');

            // Create a second space item pointing to the same file
            // Using raw RecordID without ID| prefix so that it satisfies unique constraint while pointing to fileId
            const filesEntity = ctx.Provider.EntityByName(FILE_ENTITY);
            Assert(!!filesEntity, 'MJ: Files entity found');
            if (!filesEntity) throw new Error('MJ: Files entity found');

            const itemsEntity = ctx.Provider.EntityByName(SPACE_ITEM_ENTITY);
            Assert(!!itemsEntity, 'Space Items entity found');
            if (!itemsEntity) throw new Error('Space Items entity found');

            const secondItemId = randomUUID();
            createdItemIds.push(secondItemId);

            if (ctx.Pool) {
                await ctx.Pool.request().query(`
                    INSERT INTO [${itemsEntity.SchemaName}].[${itemsEntity.BaseTable}]
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
                    const saved = await secondItem.Save();
                    Assert(saved === true, `Second item save failed: ${secondItem.LatestResult?.CompleteMessage ?? 'Save returned false'}`);
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
            const objectStays = await storedFileExists(ctx.Provider, ctx.User, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath);
            Assert(objectStays === true, 'Stored object must STAY when second Space Item still points to it');

            // 2. Delete the second item — now the file should be cleaned up!
            const deleted2 = await secondItemLoaded.Delete();
            Assert(deleted2 === true, 'Second item delete returned true');

            // Assert File row is now gone
            const fileAfterSecondDelete = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
            const fileRowGone = !(await fileAfterSecondDelete.Load(fileId));
            Assert(fileRowGone === true, 'MJ: Files row must be DELETED after last Space Item is deleted');

            // Assert stored object is now gone
            const objectGone = !(await storedFileExists(ctx.Provider, ctx.User, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath));
            Assert(objectGone === true, 'Stored object must be REMOVED after last Space Item is deleted');
        },
    },
    {
        Id: 'library.LB7',
        Name: 'LB7 — non-authorized participant (Bea) calling delete on a Shared item with uses is refused, and both item and uses survive',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');

            // 1. Find a Shared space item in Discovery space that has uses
            const sharedItems = await FindRows<{ ID: string; SpaceID: string; Band: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND Band = 'Shared'`,
                ['ID', 'SpaceID', 'Band'],
            );
            Assert(sharedItems.length > 0, 'Discovery space has at least one Shared space item');
            const targetItem = sharedItems[0];

            // 2. Ensure an Item Use exists for targetItem
            const existingUses = await FindRows<{ ID: string }>(
                ctx,
                ITEM_USE_ENTITY,
                `ItemID = '${targetItem.ID}'`,
                ['ID'],
            );
            let createdUseId: string | null = null;
            if (existingUses.length === 0) {
                const use = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, bea);
                use.NewRecord();
                use.ItemID = targetItem.ID;
                use.SpaceID = targetItem.SpaceID;
                use.UserID = bea.ID;
                use.Kind = 'open';
                use.UsedAt = new Date();
                Assert(await use.Save(), 'Created Item Use for test');
                createdUseId = use.ID;
            }

            try {
                // 3. Bea attempts to delete the Space Item
                const item = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, bea);
                Assert(await item.Load(targetItem.ID), 'Bea loads Shared space item');

                let deleteThrew = false;
                let deleteReturnedFalse = false;
                let refusalMessage: string = '';
                try {
                    const deleted = await item.Delete();
                    deleteReturnedFalse = !deleted;
                    refusalMessage = item.LatestResult?.CompleteMessage ?? '';
                } catch (e) {
                    deleteThrew = true;
                    refusalMessage = e instanceof Error ? e.message : String(e);
                }
                Assert(deleteThrew || deleteReturnedFalse, 'Bea deleting a Shared space item MUST fail / be refused');
                Assert(
                    /permission/i.test(refusalMessage),
                    `Rejection reason MUST indicate permission refusal, got: "${refusalMessage}"`
                );

                // 4. Assert BOTH the Space Item and its Item Uses survive!
                const itemAfter = await FindRows<{ ID: string }>(
                    ctx,
                    SPACE_ITEM_ENTITY,
                    `ID = '${targetItem.ID}'`,
                    ['ID'],
                );
                Assert(itemAfter.length === 1, 'Space Item MUST still exist after unauthorized delete attempt');

                const usesAfter = await FindRows<{ ID: string }>(
                    ctx,
                    ITEM_USE_ENTITY,
                    `ItemID = '${targetItem.ID}'`,
                    ['ID'],
                );
                Assert(usesAfter.length >= 1, 'Item Uses MUST still exist after unauthorized delete attempt');
            } finally {
                if (createdUseId) {
                    const use = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, ctx.User);
                    const loaded = await use.Load(createdUseId);
                    Assert(loaded === true, `LB7 cleanup: loading Item Use ${createdUseId} must succeed`);
                    const deleted = await use.Delete();
                    Assert(deleted === true, `LB7 cleanup: deleting Item Use ${createdUseId} must succeed: ${use.LatestResult?.CompleteMessage ?? ''}`);
                }
            }
        },
    },
    {
        Id: 'library.LB8',
        Name: 'LB8 — an upload lands in the band its uploader chose: Team in a Shared-default space stays hidden from a learner, and a seat that cannot see Team cannot choose it',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
            const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
            const ada = await GetPersonaUser(ctx, 'ada');
            const lee = await GetPersonaUser(ctx, 'lee');

            const upload = async (user: typeof ada, chosen: 'Shared' | 'Team' | null, name: string) =>
                uploadSpaceFile({
                    user,
                    storageUser: ctx.User,
                    provider: ctx.Provider,
                    store,
                    spaceId: COHORT_SPACE_ID,
                    folder: 'Welcome',
                    fileName: name,
                    mimeType: 'text/plain',
                    content: Buffer.from(`LB8 ${name}`),
                    gate: () => decideUploadBand(ctx.Provider, user, COHORT_SPACE_ID, chosen),
                });

            // The cohort type's default band is Shared, so an owner who says nothing publishes to every seat
            const byDefault = await upload(ada, null, `lb8-default-${Date.now()}.txt`);
            Assert(byDefault.ok, `Ada's upload with no band chosen: ${byDefault.ok ? '' : byDefault.message}`);
            if (!byDefault.ok) throw new Error(byDefault.message);
            createdItemIds.push(byDefault.itemId);
            createdFileIds.push(byDefault.fileId);
            const defaultItem = await FindRows<{ Band: string }>(ctx, SPACE_ITEM_ENTITY, `ID = '${byDefault.itemId}'`, ['Band']);
            Assert(defaultItem[0]?.Band === 'Shared', `An upload with no band chosen takes the type's default, Shared (saw ${defaultItem[0]?.Band})`);

            // Choosing Team keeps the file internal, and the learner cannot read the item
            const internal = await upload(ada, 'Team', `lb8-team-${Date.now()}.txt`);
            Assert(internal.ok, `Ada's upload with Team chosen: ${internal.ok ? '' : internal.message}`);
            if (!internal.ok) throw new Error(internal.message);
            createdItemIds.push(internal.itemId);
            createdFileIds.push(internal.fileId);
            const teamItem = await FindRows<{ Band: string }>(ctx, SPACE_ITEM_ENTITY, `ID = '${internal.itemId}'`, ['Band']);
            Assert(teamItem[0]?.Band === 'Team', `An upload with Team chosen lands on Team (saw ${teamItem[0]?.Band})`);
            const learnerRead = await View(ctx).RunView<{ ID: string }>(
                { EntityName: SPACE_ITEM_ENTITY, ExtraFilter: `SpaceID = '${COHORT_SPACE_ID}'`, Fields: ['ID'], ResultType: 'simple' },
                lee,
            );
            Assert(learnerRead.Success === true, `Lee reads the cohort's items: ${learnerRead.ErrorMessage ?? ''}`);
            const learnerIds = (learnerRead.Results ?? []).map((r) => r.ID.toLowerCase());
            Assert(learnerIds.includes(byDefault.itemId.toLowerCase()), 'Lee reads the Shared upload');
            Assert(!learnerIds.includes(internal.itemId.toLowerCase()), 'Lee cannot read the Team upload');

            // A seat that cannot see Team cannot choose it, and nothing is stored
            const refused = await upload(lee, 'Team', `lb8-refused-${Date.now()}.txt`);
            Assert(!refused.ok, 'Lee choosing Team is refused');
            Assert(!refused.ok && refused.message === 'Upload refused: this seat cannot place material in the Team band.', `Refusal names the band: ${refused.ok ? '' : refused.message}`);
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('library', {
    Setup: async () => {},
    Teardown: async (ctx: IntegrationCheckContext) => {
        const errors: string[] = [];
        while (createdItemIds.length > 0) {
            const id = createdItemIds.pop();
            if (id) {
                try {
                    const item = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
                    if (await item.Load(id)) {
                        const deleted = await item.Delete();
                        if (!deleted) {
                            errors.push(`Failed to delete Space Item ${id}: ${item.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                        }
                    }
                } catch (e) {
                    errors.push(`Error deleting Space Item ${id}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        }
        while (createdFileIds.length > 0) {
            const fid = createdFileIds.pop();
            if (fid) {
                try {
                    const file = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
                    if (await file.Load(fid)) {
                        const deleted = await file.Delete();
                        if (!deleted) {
                            errors.push(`Failed to delete File ${fid}: ${file.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                        }
                    }
                } catch (e) {
                    errors.push(`Error deleting File ${fid}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        }
        if (errors.length > 0) {
            throw new Error(`library Teardown encountered ${errors.length} error(s):\n${errors.join('\n')}`);
        }
    },
});
