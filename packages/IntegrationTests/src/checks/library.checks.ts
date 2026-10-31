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
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount, readStoredFile, storedFileExists } from '../world/local-storage-account.js';
import { worldStorageRoot } from '../world/seed-files.js';
import { deleteRowAndConfirm, registerChecks, runAllSteps } from './cleanup-helpers.js';
import { purgeTestSpaceItemPipelineRows } from './content-pipeline-fixtures.js';

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
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, ITEM_USE_ENTITY, createdUseId, 'an item use');
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
            const refusedName = `lb8-refused-${Date.now()}.txt`;
            const refused = await upload(lee, 'Team', refusedName);
            Assert(!refused.ok, 'Lee choosing Team is refused');
            const storedRefused = await FindRows<{ ID: string }>(ctx, FILE_ENTITY, `Name = '${refusedName}'`, ['ID']);
            Assert(storedRefused.length === 0, 'A refused upload stores nothing');
            Assert(!refused.ok && refused.message === 'Upload refused: this seat cannot place material in the Team band.', `Refusal names the band: ${refused.ok ? '' : refused.message}`);
        },
    },
    {
        Id: 'library.LB9',
        Name: "LB9 — in Discovery, a Team-default space, an upload with no band chosen lands on Team, and a member who can only keep material on Team is refused Shared",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
            const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');

            const upload = async (user: typeof ada, chosen: 'Shared' | 'Team' | null, name: string) =>
                uploadSpaceFile({
                    user,
                    storageUser: ctx.User,
                    provider: ctx.Provider,
                    store,
                    spaceId: DISCOVERY_SPACE_ID,
                    folder: 'Briefs',
                    fileName: name,
                    mimeType: 'text/plain',
                    content: Buffer.from(`LB9 ${name}`),
                    gate: () => decideUploadBand(ctx.Provider, user, DISCOVERY_SPACE_ID, chosen),
                });

            // Ada and Sam both reach Discovery through Northwind, an inherited seat. Discovery is a Workspace: its default band is Team.
            const byDefault = await upload(ada, null, `lb9-default-${Date.now()}.txt`);
            Assert(byDefault.ok, `Ada's upload with no band chosen: ${byDefault.ok ? '' : byDefault.message}`);
            if (!byDefault.ok) throw new Error(byDefault.message);
            createdItemIds.push(byDefault.itemId);
            createdFileIds.push(byDefault.fileId);
            const defaultItem = await FindRows<{ Band: string }>(ctx, SPACE_ITEM_ENTITY, `ID = '${byDefault.itemId}'`, ['Band']);
            Assert(defaultItem[0]?.Band === 'Team', `An upload with no band chosen takes Discovery's default, Team (saw ${defaultItem[0]?.Band})`);

            // Sam is a member: he can see Team but not promote, so Shared is a band he may not choose
            const refusedName = `lb9-refused-${Date.now()}.txt`;
            const refused = await upload(sam, 'Shared', refusedName);
            Assert(!refused.ok, 'Sam choosing Shared is refused');
            Assert(!refused.ok && refused.message === 'Upload refused: this seat cannot place material in the Shared band.', `Refusal names the band: ${refused.ok ? '' : refused.message}`);
            const stored = await FindRows<{ ID: string }>(ctx, FILE_ENTITY, `Name = '${refusedName}'`, ['ID']);
            Assert(stored.length === 0, 'A refused upload stores nothing');

            // What he may do is keep it on Team
            const kept = await upload(sam, 'Team', `lb9-team-${Date.now()}.txt`);
            Assert(kept.ok, `Sam's upload with Team chosen: ${kept.ok ? '' : kept.message}`);
            if (!kept.ok) throw new Error(kept.message);
            createdItemIds.push(kept.itemId);
            createdFileIds.push(kept.fileId);
        },
    },
    {
        Id: 'library.LB10',
        Name: 'LB10 — uploading a variety of document formats (.pdf, .docx, .xlsx, .csv, .md, .json, .html, .xml, .txt, .png, .svg) across Shared and Team bands resolves each MJ Artifact Type, rewrites unsafe MIME types, and enforces band RLS',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
            const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const stamp = Date.now();

            const catalog: Array<{
                fileName: string;
                mimeType: string;
                expectedStoredMime: string;
                expectedArtifactType: string;
                band: 'Shared' | 'Team';
                folder: string;
                content: Buffer;
            }> = [
                {
                    fileName: `lb10-roadmap-${stamp}.pdf`,
                    mimeType: 'application/pdf',
                    expectedStoredMime: 'application/pdf',
                    expectedArtifactType: 'PDF',
                    band: 'Shared',
                    folder: 'Briefs',
                    content: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'),
                },
                {
                    fileName: `lb10-sow-${stamp}.docx`,
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    expectedStoredMime: 'application/octet-stream',
                    expectedArtifactType: 'Word Document',
                    band: 'Shared',
                    folder: 'Contracts',
                    content: Buffer.from('PK\x03\x04 statement of work docx payload'),
                },
                {
                    fileName: `lb10-financials-${stamp}.xlsx`,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    expectedStoredMime: 'application/octet-stream',
                    expectedArtifactType: 'Excel Spreadsheet',
                    band: 'Team',
                    folder: 'Models',
                    content: Buffer.from('PK\x03\x04 internal margin model xlsx payload'),
                },
                {
                    fileName: `lb10-telemetry-${stamp}.csv`,
                    mimeType: 'text/csv',
                    expectedStoredMime: 'text/plain',
                    expectedArtifactType: 'CSV',
                    band: 'Shared',
                    folder: 'Data',
                    content: Buffer.from('site,dwell_hours,otif_pct\nChicago,3.8,94.2\nDallas,4.1,92.7\n'),
                },
                {
                    fileName: `lb10-architecture-${stamp}.md`,
                    mimeType: 'text/markdown',
                    expectedStoredMime: 'text/plain',
                    expectedArtifactType: 'Markdown Document',
                    band: 'Shared',
                    folder: 'Engineering',
                    content: Buffer.from('# Architecture Overview\n\n- GraphQL transport\n- Row-Level Security\n'),
                },
                {
                    fileName: `lb10-contract-${stamp}.json`,
                    mimeType: 'application/json',
                    expectedStoredMime: 'application/octet-stream',
                    expectedArtifactType: 'JSON',
                    band: 'Shared',
                    folder: 'Engineering',
                    content: Buffer.from(JSON.stringify({ openapi: '3.1.0', info: { title: 'Northwind Webhook API' } })),
                },
                {
                    fileName: `lb10-portal-${stamp}.html`,
                    mimeType: 'text/html',
                    expectedStoredMime: 'text/plain',
                    expectedArtifactType: 'HTML',
                    band: 'Shared',
                    folder: 'Snapshots',
                    content: Buffer.from('<!doctype html><html><body><h1>Partner Portal</h1></body></html>'),
                },
                {
                    fileName: `lb10-ledger-${stamp}.xml`,
                    mimeType: 'application/xml',
                    expectedStoredMime: 'application/octet-stream',
                    expectedArtifactType: 'XML',
                    band: 'Team',
                    folder: 'Schemas',
                    content: Buffer.from('<?xml version="1.0"?><ledger currency="USD"/>'),
                },
                {
                    fileName: `lb10-playbook-${stamp}.txt`,
                    mimeType: 'text/plain',
                    expectedStoredMime: 'text/plain',
                    expectedArtifactType: 'Generic Text',
                    band: 'Team',
                    folder: 'Notes',
                    content: Buffer.from('Internal negotiation playbook: preserve 18% margin floor.'),
                },
                {
                    fileName: `lb10-diagram-${stamp}.png`,
                    mimeType: 'image/png',
                    expectedStoredMime: 'image/png',
                    expectedArtifactType: 'Image',
                    band: 'Shared',
                    folder: 'Diagrams',
                    content: Buffer.from('\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR'),
                },
                {
                    fileName: `lb10-topology-${stamp}.svg`,
                    mimeType: 'image/svg+xml',
                    expectedStoredMime: 'application/octet-stream',
                    expectedArtifactType: 'SVG Image',
                    band: 'Shared',
                    folder: 'Diagrams',
                    content: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'),
                },
            ];

            const uploadedByDoc = new Map<string, { itemId: string; fileId: string; artifactVersionId: string }>();
            for (const doc of catalog) {
                const outcome = await uploadSpaceFile({
                    user: ada,
                    storageUser: ctx.User,
                    provider: ctx.Provider,
                    store,
                    spaceId: DISCOVERY_SPACE_ID,
                    folder: doc.folder,
                    fileName: doc.fileName,
                    mimeType: doc.mimeType,
                    content: doc.content,
                    gate: () => decideUploadBand(ctx.Provider, ada, DISCOVERY_SPACE_ID, doc.band),
                });
                Assert(outcome.ok, `Upload must succeed for ${doc.fileName}: ${outcome.ok ? '' : outcome.message}`);
                if (!outcome.ok) throw new Error(outcome.message);
                createdItemIds.push(outcome.itemId);
                createdFileIds.push(outcome.fileId);
                uploadedByDoc.set(doc.fileName, outcome);

                // Verify MJ: Files row ContentType (including text/plain rewrite for HTML, XML, SVG) and stored bytes on disk
                const [fileRow] = await FindRows<{ ID: string; Name: string; ContentType: string; ProviderKey: string | null }>(
                    ctx,
                    FILE_ENTITY,
                    `ID = '${outcome.fileId}'`,
                    ['ID', 'Name', 'ContentType', 'ProviderKey'],
                );
                Assert(!!fileRow, `MJ: Files row exists for ${doc.fileName}`);
                Assert(
                    fileRow.ContentType === doc.expectedStoredMime,
                    `${doc.fileName} stored ContentType expected ${doc.expectedStoredMime}, saw ${fileRow.ContentType}`,
                );
                Assert(!!fileRow.ProviderKey, `MJ: Files ProviderKey is set for ${doc.fileName}`);
                const diskBytes = await readStoredFile(
                    ctx.Provider,
                    ctx.User,
                    COLLABORATION_STORAGE_ACCOUNT_ID,
                    fileRow.ProviderKey!,
                );
                Assert(
                    Buffer.compare(diskBytes, doc.content) === 0,
                    `Stored bytes on disk match uploaded payload for ${doc.fileName}`,
                );

                // Verify MJ: Artifact Versions & MJ: Artifacts & MJ: Artifact Types
                const [verRow] = await FindRows<{ ID: string; ArtifactID: string; ContentMode: string; FileID: string; FileName: string; MimeType: string; ContentSizeBytes: number }>(
                    ctx,
                    'MJ: Artifact Versions',
                    `ID = '${outcome.artifactVersionId}'`,
                    ['ID', 'ArtifactID', 'ContentMode', 'FileID', 'FileName', 'MimeType', 'ContentSizeBytes'],
                );
                Assert(!!verRow && verRow.ContentMode === 'File', `Artifact Version in File mode exists for ${doc.fileName}`);
                Assert(verRow.FileID.toLowerCase() === outcome.fileId.toLowerCase(), `Artifact Version links to FileID for ${doc.fileName}`);
                Assert(verRow.MimeType === doc.expectedStoredMime, `Artifact Version MimeType matches for ${doc.fileName}`);
                Assert(Number(verRow.ContentSizeBytes) === doc.content.byteLength, `Artifact Version ContentSizeBytes matches for ${doc.fileName}`);

                const [artRow] = await FindRows<{ ID: string; TypeID: string }>(
                    ctx,
                    'MJ: Artifacts',
                    `ID = '${verRow.ArtifactID}'`,
                    ['ID', 'TypeID'],
                );
                Assert(!!artRow, `Artifact row exists for ${doc.fileName}`);
                const [typeRow] = await FindRows<{ Name: string }>(
                    ctx,
                    'MJ: Artifact Types',
                    `ID = '${artRow.TypeID}'`,
                    ['Name'],
                );
                Assert(
                    typeRow?.Name === doc.expectedArtifactType,
                    `${doc.fileName} resolved MJ: Artifact Types expected "${doc.expectedArtifactType}", saw "${typeRow?.Name ?? ''}"`,
                );

                // Verify Space Item links ArtifactVersionID and Band
                const [itemRow] = await FindRows<{ ID: string; Band: string; Folder: string; ArtifactVersionID: string | null }>(
                    ctx,
                    SPACE_ITEM_ENTITY,
                    `ID = '${outcome.itemId}'`,
                    ['ID', 'Band', 'Folder', 'ArtifactVersionID'],
                );
                Assert(itemRow?.Band === doc.band, `Space Item Band matches ${doc.band} for ${doc.fileName}`);
                Assert(itemRow?.Folder === doc.folder, `Space Item Folder matches ${doc.folder} for ${doc.fileName}`);
                Assert(
                    itemRow?.ArtifactVersionID?.toLowerCase() === outcome.artifactVersionId.toLowerCase(),
                    `Space Item ArtifactVersionID links to version for ${doc.fileName}`,
                );
            }

            // Verify client Bea (Shared-band participant in Discovery) reads all 8 Shared uploaded documents and none of the 3 Team uploaded documents
            const beaItems = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
                bea,
                { BypassCache: true },
            );
            const beaItemIdSet = new Set(beaItems.map((i) => i.ID.toLowerCase()));
            for (const doc of catalog) {
                const uploaded = uploadedByDoc.get(doc.fileName)!;
                if (doc.band === 'Shared') {
                    Assert(beaItemIdSet.has(uploaded.itemId.toLowerCase()), `Client Bea reads Shared uploaded document ${doc.fileName}`);
                } else {
                    Assert(!beaItemIdSet.has(uploaded.itemId.toLowerCase()), `Client Bea cannot read Team uploaded document ${doc.fileName}`);
                }
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('library', {
    Setup: async () => {},
    // Every step runs and reads back, newest first; the first failure is thrown at the end
    Teardown: async (ctx: IntegrationCheckContext) => {
        const itemsToPurge = createdItemIds.splice(0);
        const filesToPurge = createdFileIds.splice(0);
        await runAllSteps([
            ...itemsToPurge
                .slice()
                .reverse()
                .map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, id, 'a library item')),
            () => purgeTestSpaceItemPipelineRows(ctx.Provider, ctx.User, itemsToPurge),
            ...filesToPurge
                .slice()
                .reverse()
                .map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, FILE_ENTITY, id, 'a library file')),
        ]);
    },
});
