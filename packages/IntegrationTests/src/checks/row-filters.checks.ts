import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { SPACE_ENTITY, SPACE_ITEM_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser, View } from '../wire.js';
import { registerChecks } from './cleanup-helpers.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const HARBOR_SPACE_ID = 'C1000001-0000-4000-8000-000000000006';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';

const checks: NamedCheck[] = [
    {
        Id: 'row-filters.RF1',
        Name: 'RF1 — Bea (Client on Discovery) sees Discovery and Field notes, but nothing from Harbor',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const view = View(ctx);

            const spaces = await view.RunView<{ ID: string; Name: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID', 'Name'],
                ResultType: 'simple',
            }, bea);

            Assert(spaces.Success, `Bea RunView Spaces failed: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Bea can see Discovery space');
            Assert(!visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Bea MUST NOT see Harbor space');
        },
    },
    {
        Id: 'row-filters.RF2',
        Name: 'RF2 — Bea sees only Shared band items; Team items (discovery-brief) are hidden',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const view = View(ctx);

            const items = await view.RunView<{ ID: string; SpaceID: string; Band: string }>({
                EntityName: SPACE_ITEM_ENTITY,
                Fields: ['ID', 'SpaceID', 'Band'],
                ResultType: 'simple',
            }, bea);

            Assert(items.Success, `Bea RunView Space Items failed: ${items.ErrorMessage ?? 'unknown'}`);
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
        Name: 'RF3 — Harper (Client on Harbor) sees Harbor, but nothing from Discovery or Committee',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harper = await GetPersonaUser(ctx, 'harper');
            const view = View(ctx);

            const spaces = await view.RunView<{ ID: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID'],
                ResultType: 'simple',
            }, harper);

            Assert(spaces.Success, `Harper RunView Spaces failed: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Harper can see Harbor space');
            Assert(!visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Harper MUST NOT see Discovery space');
            Assert(!visibleIds.has(COMMITTEE_SPACE_ID.toLowerCase()), 'Harper MUST NOT see Committee space');
        },
    },
    {
        Id: 'row-filters.RF4',
        Name: 'RF4 — Dana (Director on Committee) sees Committee, but not Discovery or Harbor',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const dana = await GetPersonaUser(ctx, 'dana');
            const view = View(ctx);

            const spaces = await view.RunView<{ ID: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID'],
                ResultType: 'simple',
            }, dana);

            Assert(spaces.Success, `Dana RunView Spaces failed: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(COMMITTEE_SPACE_ID.toLowerCase()), 'Dana can see Committee space');
            Assert(!visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Dana MUST NOT see Discovery space');
            Assert(!visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Dana MUST NOT see Harbor space');
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('row-filters', {
    Setup: async () => {},
    Teardown: async () => {},
});
