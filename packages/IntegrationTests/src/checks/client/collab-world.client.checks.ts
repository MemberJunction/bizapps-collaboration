import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { SPACE_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ITEM_ENTITY, PERSON_ENTITY } from '../../entity-names.js';
import { FindRows, View } from '../../wire.js';

const checks: NamedCheck[] = [
    {
        Id: 'collab-world.CW1',
        Name: 'CW1 — 13 sample spaces exist with expected hierarchy and owners',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const spaces = await FindRows<{ ID: string; Name: string; ParentID: string | null; OwnerID: string }>(
                ctx,
                SPACE_ENTITY,
                "ID IS NOT NULL",
                ['ID', 'Name', 'ParentID', 'OwnerID'],
            );
            Assert(spaces.length >= 13, `Expected at least 13 spaces, found ${spaces.length}`);

            const byName = new Map(spaces.map((s) => [s.Name.trim(), s]));
            Assert(byName.has('Northwind relationship'), 'Northwind relationship missing');
            Assert(byName.has('Discovery'), 'Discovery missing');
            Assert(byName.has('Delivery'), 'Delivery missing');
            Assert(byName.has('Audit committee'), 'Audit committee missing');
            Assert(byName.has('Spring cohort'), 'Spring cohort missing');
            Assert(byName.has('Field notes'), 'Field notes missing');
            Assert(byName.has('Harbor relationship'), 'Harbor relationship missing');
            Assert(byName.has('Closed this month'), 'Closed this month missing');
            Assert(byName.has('Closed last year'), 'Closed last year missing');
            Assert(byName.has('Closed indefinite'), 'Closed indefinite missing');

            // Hierarchy
            const discovery = byName.get('Discovery')!;
            const northwind = byName.get('Northwind relationship')!;
            const fieldNotes = byName.get('Field notes')!;

            Assert(discovery.ParentID?.toLowerCase() === northwind.ID.toLowerCase(), 'Discovery parent is Northwind');
            Assert(fieldNotes.ParentID?.toLowerCase() === discovery.ID.toLowerCase(), 'Field notes parent is Discovery');
        },
    },
    {
        Id: 'collab-world.CW2',
        Name: 'CW2 — seats established across personas including Invited (Pat) and Removed (Remy)',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const seats = await FindRows<{ ID: string; SpaceID: string; UserID: string; Status: string; Band: string }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                "ID IS NOT NULL",
                ['ID', 'SpaceID', 'UserID', 'Status', 'Band'],
            );
            Assert(seats.length >= 26, `Expected at least 26 seats, found ${seats.length}`);

            const statuses = new Set(seats.map((s) => s.Status.trim()));
            Assert(statuses.has('Active'), 'Active seats exist');
            Assert(statuses.has('Invited'), 'Invited seats exist (Pat)');
            Assert(statuses.has('Removed'), 'Removed seats exist (Remy)');

            const bands = new Set(seats.map((s) => s.Band.trim()));
            Assert(bands.has('Team'), 'Team band seats exist');
            Assert(bands.has('Shared'), 'Shared band seats exist');
        },
    },
    {
        Id: 'collab-world.CW3',
        Name: 'CW3 — library items exist across bands and entities',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const items = await FindRows<{ ID: string; SpaceID: string; Band: string; EntityID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                "ID IS NOT NULL",
                ['ID', 'SpaceID', 'Band', 'EntityID'],
            );
            Assert(items.length >= 4, `Expected at least 4 items, found ${items.length}`);

            const bands = new Set(items.map((i) => i.Band.trim()));
            Assert(bands.has('Team'), 'Team band items exist');
            Assert(bands.has('Shared'), 'Shared band items exist');
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('collab-world', {
    Setup: async () => {},
    Teardown: async () => {},
});
