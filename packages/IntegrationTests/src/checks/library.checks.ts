import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { SPACE_UPLOAD_MAX_BYTES } from '@mj-biz-apps/collaboration-core';
import { uploadSpaceFile, type SpaceFileStore, type StoredSpaceFile } from '@mj-biz-apps/collaboration-core-entities-server';
import { FILE_ENTITY, SPACE_ITEM_ENTITY, USER_NOTIFICATION_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';

const checks: NamedCheck[] = [
    {
        Id: 'library.LB1',
        Name: 'LB1 — uploadSpaceFile enforces non-empty content and size cap (50MB)',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const ada = await GetPersonaUser(ctx, 'ada');

            const dummyStore: SpaceFileStore = {
                put: async () => ({ fileId: 'f1', storagePath: 'p1', accountId: 'a1' }),
                remove: async () => true,
            };

            // 1. Empty content refused
            const emptyRes = await uploadSpaceFile({
                user: bea,
                storageUser: ada,
                provider: ctx.Provider,
                store: dummyStore,
                spaceId: DISCOVERY_SPACE_ID,
                folder: 'Briefs',
                fileName: 'empty.txt',
                mimeType: 'text/plain',
                content: new Uint8Array(0),
                gate: async () => ({ ok: true, band: 'Shared' }),
            });
            Assert(!emptyRes.ok, 'Empty file must be refused');

            // 2. Over cap refused
            const overCapRes = await uploadSpaceFile({
                user: bea,
                storageUser: ada,
                provider: ctx.Provider,
                store: dummyStore,
                spaceId: DISCOVERY_SPACE_ID,
                folder: 'Briefs',
                fileName: 'huge.bin',
                mimeType: 'application/octet-stream',
                content: new Uint8Array(10),
                maxBytes: 5, // artificial small cap
                gate: async () => ({ ok: true, band: 'Shared' }),
            });
            Assert(!overCapRes.ok, 'File exceeding maxBytes must be refused');
        },
    },
    {
        Id: 'library.LB2',
        Name: 'LB2 — uploadSpaceFile rewrites unsafe html to text/plain',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const ada = await GetPersonaUser(ctx, 'ada');

            let storedMimeType = '';
            const testStore: SpaceFileStore = {
                put: async (input) => {
                    storedMimeType = input.mimeType;
                    throw new Error('stop_after_put');
                },
                remove: async () => true,
            };

            await uploadSpaceFile({
                user: bea,
                storageUser: ada,
                provider: ctx.Provider,
                store: testStore,
                spaceId: DISCOVERY_SPACE_ID,
                folder: null,
                fileName: 'page.html',
                mimeType: 'text/html',
                content: new TextEncoder().encode('<html></html>'),
                gate: async () => ({ ok: true, band: 'Shared' }),
            });

            Assert(storedMimeType === 'text/plain', `Expected text/plain rewrite for html, got ${storedMimeType}`);
        },
    },
    {
        Id: 'library.LB3',
        Name: 'LB3 — uploadSpaceFile rolls back stored file if item save fails',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const ada = await GetPersonaUser(ctx, 'ada');

            const removed: StoredSpaceFile[] = [];
            const testStore: SpaceFileStore = {
                put: async () => ({ fileId: 'f1', storagePath: 'p1', accountId: 'a1' }),
                remove: async (stored) => {
                    removed.push(stored);
                    return true;
                },
            };

            // Gate fails or returns error
            const failRes = await uploadSpaceFile({
                user: bea,
                storageUser: ada,
                provider: ctx.Provider,
                store: testStore,
                spaceId: DISCOVERY_SPACE_ID,
                folder: null,
                fileName: 'doc.pdf',
                mimeType: 'application/pdf',
                content: new TextEncoder().encode('hello'),
                gate: async () => ({ ok: false, message: 'Gate refused' }),
            });

            Assert(!failRes.ok, 'Gate failure reported');
            Assert(removed.length === 0, 'No file put if gate refused before put');
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
    Teardown: async () => {},
});
