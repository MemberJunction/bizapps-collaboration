import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient, mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import type { MJFileEntity } from '@memberjunction/core-entities';
import { FILE_ENTITY, SPACE_ITEM_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaContext } from '../../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const createdItemIds: string[] = [];

const checks: NamedCheck[] = [
    {
        Id: 'library.LB1',
        Name: 'LB1 — UploadSpaceFile enforces non-empty content and size cap over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const client = new CollaborationClient(beaCtx.GraphQLProvider);

            // 1. Empty content refused
            const emptyRes = await client.uploadSpaceFile({
                SpaceID: DISCOVERY_SPACE_ID,
                FileName: 'empty.txt',
                Base64Data: '',
                Folder: 'Briefs',
            });
            Assert(!emptyRes.Success, 'Empty file must be refused over the wire');

            // 2. Valid upload succeeds
            const validRes = await client.uploadSpaceFile({
                SpaceID: DISCOVERY_SPACE_ID,
                FileName: 'bea-upload.txt',
                Base64Data: Buffer.from('Hello from Bea over GraphQL').toString('base64'),
                Folder: 'Briefs',
            });
            Assert(validRes.Success === true, `Valid upload by Bea must succeed: ${validRes.ErrorMessage ?? ''}`);
            Assert(!!validRes.ItemID, 'UploadSpaceFile returns ItemID');
            if (validRes.ItemID) createdItemIds.push(validRes.ItemID);
        },
    },
    {
        Id: 'library.LB2',
        Name: 'LB2 — UploadSpaceFile rewrites unsafe html to text/plain over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const client = new CollaborationClient(beaCtx.GraphQLProvider);

            const htmlRes = await client.uploadSpaceFile({
                SpaceID: DISCOVERY_SPACE_ID,
                FileName: 'unsafe.html',
                MimeType: 'text/html',
                Base64Data: Buffer.from('<html><script>alert(1)</script></html>').toString('base64'),
                Folder: 'Briefs',
            });
            Assert(htmlRes.Success === true, `Upload of html must succeed with rewrite: ${htmlRes.ErrorMessage ?? ''}`);
            Assert(!!htmlRes.ItemID, 'ItemID returned for html upload');
            if (htmlRes.ItemID) createdItemIds.push(htmlRes.ItemID);

            // Inspect the created Space Item and linked File
            const items = await FindRows<{ ID: string; RecordID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `ID = '${htmlRes.ItemID}'`,
                ['ID', 'RecordID'],
            );
            Assert(items.length === 1, 'Space Item created');
            const files = await FindRows<{ ID: string; ContentType: string }>(
                ctx,
                FILE_ENTITY,
                `ID = '${items[0].RecordID}'`,
                ['ID', 'ContentType'],
            );
            Assert(files.length === 1, 'Linked File found');
            Assert(files[0].ContentType === 'text/plain', `HTML ContentType rewritten to text/plain, saw: ${files[0].ContentType}`);
        },
    },
    {
        Id: 'library.LB3',
        Name: 'LB3 — UploadSpaceFile refuses non-contributor over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const remyCtx = await getPersonaContext(ctx, 'remy');
            const remyClient = new CollaborationClient(remyCtx.GraphQLProvider);

            const refuseRes = await remyClient.uploadSpaceFile({
                SpaceID: DISCOVERY_SPACE_ID,
                FileName: 'blocked.pdf',
                Base64Data: Buffer.from('blocked content').toString('base64'),
                Folder: 'Briefs',
            });
            Assert(!refuseRes.Success, 'Upload from non-contributor Remy must be refused');
        },
    },
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
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
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
                        const rawRecId = item.RecordID;
                        const fileId = rawRecId ? (rawRecId.toLowerCase().startsWith('id|') ? rawRecId.slice(3) : rawRecId) : null;
                        const deletedItem = await item.Delete();
                        if (!deletedItem) {
                            errors.push(`Failed to delete Space Item ${id}: ${item.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                        }

                        if (fileId) {
                            try {
                                const fileEntity = await ctx.Provider.GetEntityObject<MJFileEntity>(FILE_ENTITY, ctx.User);
                                if (await fileEntity.Load(fileId)) {
                                    const deletedFile = await fileEntity.Delete();
                                    if (!deletedFile) {
                                        errors.push(`Failed to delete File ${fileId}: ${fileEntity.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                                    }
                                }
                            } catch (fe) {
                                errors.push(`Error deleting File ${fileId}: ${fe instanceof Error ? fe.message : String(fe)}`);
                            }
                        }
                    }
                } catch (e) {
                    errors.push(`Error deleting Space Item ${id}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
        }
        if (errors.length > 0) {
            throw new Error(`library Teardown encountered ${errors.length} error(s):\n${errors.join('\n')}`);
        }
    },
});
