import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { mjBizAppsCollaborationSpacePageEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_ENTITY, SPACE_ITEM_ENTITY, SPACE_PAGE_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaContext, View } from '../../wire.js';
import { deleteRowAndConfirm, registerChecks } from '../cleanup-helpers.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const HARBOR_SPACE_ID = 'C1000001-0000-4000-8000-000000000006';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';

const checks: NamedCheck[] = [
    {
        Id: 'row-filters.RF1',
        Name: 'RF1 — Bea (Client on Discovery) sees Discovery and Field notes, but nothing from Harbor over the wire',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const view = View(beaCtx);

            const spaces = await view.RunView<{ ID: string; Name: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID', 'Name'],
                ResultType: 'simple',
            });

            Assert(spaces.Success, `Bea RunView Spaces failed over the wire: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Bea can see Discovery space');
            Assert(!visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Bea MUST NOT see Harbor space');
        },
    },
    {
        Id: 'row-filters.RF2',
        Name: 'RF2 — Bea sees only Shared band items; Team items (discovery-brief) are hidden over the wire',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const view = View(beaCtx);

            const items = await view.RunView<{ ID: string; SpaceID: string; Band: string }>({
                EntityName: SPACE_ITEM_ENTITY,
                Fields: ['ID', 'SpaceID', 'Band'],
                ResultType: 'simple',
            });

            Assert(items.Success, `Bea RunView Space Items failed over the wire: ${items.ErrorMessage ?? 'unknown'}`);
            Assert(Array.isArray(items.Results) && items.Results.length > 0, 'Bea must see at least one Shared item in Discovery');
            for (const item of items.Results ?? []) {
                Assert(item.Band === 'Shared', `Bea saw non-Shared item with band '${item.Band}'`);
            }

            // Find Team items in Discovery space and assert Bea cannot see any of them by ID
            const teamItems = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND Band = 'Team'`,
                ['ID'],
            );
            Assert(teamItems.length > 0, 'At least one Team item exists in Discovery space');
            const beaVisibleItemIds = new Set((items.Results ?? []).map((i) => i.ID.toLowerCase()));
            for (const teamItem of teamItems) {
                Assert(!beaVisibleItemIds.has(teamItem.ID.toLowerCase()), `Team item ${teamItem.ID} MUST NOT be visible to Bea`);
            }
        },
    },
    {
        Id: 'row-filters.RF3',
        Name: 'RF3 — Harper (Client on Harbor) sees Harbor, but nothing from Discovery or Committee over the wire',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harperCtx = await getPersonaContext(ctx, 'harper');
            const view = View(harperCtx);

            const spaces = await view.RunView<{ ID: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID'],
                ResultType: 'simple',
            });

            Assert(spaces.Success, `Harper RunView Spaces failed over the wire: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Harper can see Harbor space');
            Assert(!visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Harper MUST NOT see Discovery space');
            Assert(!visibleIds.has(COMMITTEE_SPACE_ID.toLowerCase()), 'Harper MUST NOT see Committee space');
        },
    },
    {
        Id: 'row-filters.RF4',
        Name: 'RF4 — Dana (Director on Committee) sees Committee, but not Discovery or Harbor over the wire',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const danaCtx = await getPersonaContext(ctx, 'dana');
            const view = View(danaCtx);

            const spaces = await view.RunView<{ ID: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID'],
                ResultType: 'simple',
            });

            Assert(spaces.Success, `Dana RunView Spaces failed over the wire: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(COMMITTEE_SPACE_ID.toLowerCase()), 'Dana can see Committee space');
            Assert(!visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Dana MUST NOT see Discovery space');
            Assert(!visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Dana MUST NOT see Harbor space');
        },
    },
    {
        Id: 'row-filters.RF5',
        Name: 'RF5 — Bea (outside Client on Discovery) reads Space Pages and gets Shared pages only, never a Team page over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const view = View(beaCtx);

            let sharedPageId: string | null = null;
            let teamPageId: string | null = null;
            try {
                const sharedPage = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpacePageEntity>(SPACE_PAGE_ENTITY, adaCtx.User);
                sharedPage.NewRecord();
                sharedPage.SpaceID = DISCOVERY_SPACE_ID;
                sharedPage.Title = 'RF5 Client Shared Discovery Page';
                sharedPage.Band = 'Shared';
                sharedPage.Status = 'Published';
                sharedPage.Sequence = 10;
                sharedPage.PublishedBlocks = '[]';
                Assert(await sharedPage.Save(), `Ada failed to save Shared page over the wire: ${sharedPage.LatestResult?.CompleteMessage ?? 'unknown'}`);
                sharedPageId = sharedPage.ID;

                const teamPage = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpacePageEntity>(SPACE_PAGE_ENTITY, adaCtx.User);
                teamPage.NewRecord();
                teamPage.SpaceID = DISCOVERY_SPACE_ID;
                teamPage.Title = 'RF5 Client Internal Team Discovery Page';
                teamPage.Band = 'Team';
                teamPage.Status = 'Published';
                teamPage.Sequence = 11;
                teamPage.PublishedBlocks = '[]';
                Assert(await teamPage.Save(), `Ada failed to save Team page over the wire: ${teamPage.LatestResult?.CompleteMessage ?? 'unknown'}`);
                teamPageId = teamPage.ID;

                const pages = await view.RunView<{ ID: string; SpaceID: string; Band: string; Title: string }>({
                    EntityName: SPACE_PAGE_ENTITY,
                    ExtraFilter: `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                    Fields: ['ID', 'SpaceID', 'Band', 'Title'],
                    ResultType: 'simple',
                    BypassCache: true,
                });

                Assert(pages.Success, `Bea RunView Space Pages failed over the wire: ${pages.ErrorMessage ?? 'unknown'}`);
                const results = pages.Results ?? [];
                Assert(results.length > 0, 'Bea must see at least the Shared page in Discovery over the wire');
                for (const p of results) {
                    Assert(p.Band === 'Shared', `Bea saw non-Shared page '${p.Title}' with band '${p.Band}' over the wire`);
                }
                const visiblePageIds = new Set(results.map((p) => p.ID.toLowerCase()));
                Assert(visiblePageIds.has(sharedPageId.toLowerCase()), 'Bea must see the Shared page over the wire');
                Assert(!visiblePageIds.has(teamPageId.toLowerCase()), 'Bea MUST NOT see the Team page over the wire');
            } finally {
                if (sharedPageId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_PAGE_ENTITY, sharedPageId, 'RF5 Client Shared Space Page');
                }
                if (teamPageId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_PAGE_ENTITY, teamPageId, 'RF5 Client Team Space Page');
                }
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('row-filters', {
    Setup: async () => {},
    Teardown: async () => {},
});
