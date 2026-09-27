import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient, mjBizAppsCollaborationItemUseEntity, mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { FILE_ENTITY, ITEM_USE_ENTITY, SPACE_ITEM_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext } from '../../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const createdItemIds: string[] = [];

const checks: NamedCheck[] = [
    {
        Id: 'library.LB1',
        Name: 'LB1 — UploadSpaceFile enforces non-empty content and size cap over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const client = new CollaborationClient(beaCtx.GraphQLProvider);

            // 1. Empty content refused
            const emptyRes = await client.UploadSpaceFile({
                SpaceID: DISCOVERY_SPACE_ID,
                FileName: 'empty.txt',
                MimeType: 'text/plain',
                Base64Data: '',
                Folder: 'Briefs',
            });
            Assert(!emptyRes.Success, 'Empty file must be refused over the wire');
            Assert(
                (emptyRes.ErrorMessage ?? '').toLowerCase().includes('empty'),
                `Error message should state file is empty: ${emptyRes.ErrorMessage ?? ''}`,
            );

            // 2. Over size cap refused (10MB + 1 byte)
            const overCapBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
            const overCapRes = await client.UploadSpaceFile({
                SpaceID: DISCOVERY_SPACE_ID,
                FileName: 'huge.bin',
                MimeType: 'application/octet-stream',
                Base64Data: overCapBuffer.toString('base64'),
                Folder: 'Briefs',
            });
            Assert(!overCapRes.Success, 'File over 10MB size cap must be refused over the wire');
            Assert(
                (overCapRes.ErrorMessage ?? '').toLowerCase().includes('limited to'),
                `Error message should state the size limit: ${overCapRes.ErrorMessage ?? ''}`,
            );

            // 3. Valid upload succeeds
            const validRes = await client.UploadSpaceFile({
                SpaceID: DISCOVERY_SPACE_ID,
                FileName: 'bea-upload.txt',
                MimeType: 'text/plain',
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
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const client = new CollaborationClient(beaCtx.GraphQLProvider);

            const htmlRes = await client.UploadSpaceFile({
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
            const fileRecordId = items[0].RecordID.includes('|') ? items[0].RecordID.split('|').pop()! : items[0].RecordID;
            const files = await FindRows<{ ID: string; ContentType: string }>(
                ctx,
                FILE_ENTITY,
                `ID = '${fileRecordId}'`,
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
            const remyCtx = await getPersonaClientContext(ctx, 'remy');
            const remyClient = new CollaborationClient(remyCtx.GraphQLProvider);

            const refuseRes = await remyClient.UploadSpaceFile({
                SpaceID: DISCOVERY_SPACE_ID,
                FileName: 'blocked.pdf',
                MimeType: 'application/pdf',
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
    {
        Id: 'library.LB5',
        Name: 'LB5 — non-authorized participant (Bea) calling delete on a Shared item with uses is refused, and both item and uses survive over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaClientContext(ctx, 'bea');

            // 1. Find a Shared space item in Discovery space that has uses
            //    (or find any Shared space item in Discovery space and ensure an Item Use exists)
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
                const use = await beaCtx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, beaCtx.User);
                use.NewRecord();
                use.ItemID = targetItem.ID;
                use.SpaceID = targetItem.SpaceID;
                use.UserID = beaCtx.User.ID;
                use.Kind = 'open';
                use.UsedAt = new Date();
                Assert(await use.Save(), 'Created Item Use for test');
                createdUseId = use.ID;
            }

            try {
                // 3. Bea attempts to delete the Space Item by sending the mutation directly over GraphQL
                const DELETE_SPACE_ITEM_MUTATION = `
                    mutation DeletemjBizAppsCollaborationSpaceItem($ID: String!, $options___: DeleteOptionsInput!) {
                        DeletemjBizAppsCollaborationSpaceItem(ID: $ID, options___: $options___) {
                            ID
                        }
                    }
                `;
                let mutationThrew = false;
                let mutationNullOrRefused = false;
                let rejectionReason: string | null = null;
                try {
                    const res = await beaCtx.GraphQLProvider.ExecuteGQL(DELETE_SPACE_ITEM_MUTATION, {
                        ID: targetItem.ID,
                        options___: {
                            SkipEntityAIActions: false,
                            SkipEntityActions: false,
                            ReplayOnly: false,
                            IsParentEntityDelete: false,
                            SkipRecordChanges: false,
                        },
                    });
                    const deletedId = (res?.DeletemjBizAppsCollaborationSpaceItem as { ID?: string } | undefined)?.ID;
                    if (!deletedId) {
                        mutationNullOrRefused = true;
                        rejectionReason = (res as { errors?: Array<{ message: string }> })?.errors?.[0]?.message ?? 'Mutation returned null ID';
                    }
                } catch (e) {
                    mutationThrew = true;
                    rejectionReason = e instanceof Error ? e.message : String(e);
                }
                Assert(mutationThrew || mutationNullOrRefused, 'Server MUST refuse DeletemjBizAppsCollaborationSpaceItem mutation when sent by participant Bea');
                Assert(
                    !!rejectionReason && /permission/i.test(rejectionReason),
                    `Rejection reason MUST indicate permission refusal, got: "${rejectionReason ?? ''}"`
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
                    if (await use.Load(createdUseId)) {
                        const deleted = await use.Delete();
                        if (!deleted) {
                            throw new Error(`client LB5 cleanup failed to delete Item Use ${createdUseId}: ${use.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                        }
                    }
                }
            }
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
                        const deletedItem = await item.Delete();
                        if (!deletedItem) {
                            errors.push(`Failed to delete Space Item ${id}: ${item.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
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
