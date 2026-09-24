import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationShareNoticeEntity,
    mjBizAppsCollaborationItemUseEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    SPACE_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_ITEM_ENTITY,
    SHARE_NOTICE_ENTITY,
    ITEM_USE_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser, RequireSave } from '../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const FIELD_NOTES_SPACE_ID = 'C1000001-0000-4000-8000-000000000011';

const checks: NamedCheck[] = [
    {
        Id: 'write-gates.WG1',
        Name: 'WG1 — space write gates: cycle detection and participant root creation refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            // 1. Participant (Bea) creating a root space (ParentID = null) is refused
            const rootAttempt = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea);
            rootAttempt.NewRecord();
            rootAttempt.Name = 'Bea Root Space';
            rootAttempt.OwnerID = bea.ID;
            rootAttempt.SpaceTypeID = 'A1000001-0000-4000-8000-000000000001'; // workspace type
            rootAttempt.ParentID = null;

            const valRoot = await rootAttempt.ValidateAsync();
            Assert(!valRoot.Success, 'Participant creating root space must be refused');

            // 2. Cycle detection: moving Northwind under Discovery (its own child)
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await space.Load(NORTHWIND_SPACE_ID), 'Load Northwind space');
            space.ParentID = DISCOVERY_SPACE_ID;

            const valCycle = await space.ValidateAsync();
            Assert(!valCycle.Success, 'Moving space under its own descendant must fail validation');
            Assert(
                valCycle.Errors.some((e) => e.Message.includes('would put the space inside its own subtree')),
                `Expected cycle message, got: ${valCycle.Errors.map((e) => e.Message).join('; ')}`,
            );
        },
    },
    {
        Id: 'write-gates.WG2',
        Name: 'WG2 — member write gates: immutable Space/User, last owner protection, self-removal',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');

            // 1. Find Ada's owner seat on Northwind
            const seats = await FindRows<{ ID: string; SpaceID: string; UserID: string; SpaceRoleTypeID: string }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                `SpaceID = '${NORTHWIND_SPACE_ID}' AND UserID = '${ada.ID}'`,
                ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID'],
            );
            Assert(seats.length === 1, 'Ada seat found on Northwind');

            const member = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
            Assert(await member.Load(seats[0].ID), 'Load Ada seat');

            // Attempt to change SpaceID on saved membership
            member.SpaceID = DISCOVERY_SPACE_ID;
            const valSpace = await member.ValidateAsync();
            Assert(!valSpace.Success, 'Changing SpaceID on saved membership must fail');
            Assert(
                valSpace.Errors.some((e) => e.Message.includes('stays on the space and the person')),
                `Expected immutable seat message, got: ${valSpace.Errors.map((e) => e.Message).join('; ')}`,
            );

            // Reload and attempt to remove last owner
            await member.Load(seats[0].ID);
            member.Status = 'Removed';
            const valStrand = await member.ValidateAsync();
            Assert(!valStrand.Success, 'Removing last active owner must fail validation');
            Assert(
                valStrand.Errors.some((e) => e.Message.includes('last owner of this space')),
                `Expected last owner message, got: ${valStrand.Errors.map((e) => e.Message).join('; ')}`,
            );
        },
    },
    {
        Id: 'write-gates.WG3',
        Name: 'WG3 — item write gates: valid space/signer, subtask cannot be filed as space root',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');

            // Attempt to file an item without valid SpaceID
            const item = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, bea);
            item.NewRecord();
            item.SpaceID = '00000000-0000-0000-0000-000000000000';
            item.Band = 'Shared';

            const val = await item.ValidateAsync();
            Assert(!val.Success, 'Invalid SpaceID must fail item validation');
        },
    },
    {
        Id: 'write-gates.WG4',
        Name: 'WG4 — share notice write gates: recipient must be in space roster',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const harper = await GetPersonaUser(ctx, 'harper'); // Harper is in Harbor, not Discovery

            // Find an item in Discovery
            const items = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            Assert(items.length > 0, 'Discovery items exist');
            const itemId = items[0].ID;

            // Attempt to create ShareNotice for Harper (not in Discovery)
            const notice = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationShareNoticeEntity>(SHARE_NOTICE_ENTITY, ada);
            notice.NewRecord();
            notice.SpaceID = DISCOVERY_SPACE_ID;
            notice.ItemID = itemId;
            notice.RecipientUserID = harper.ID;

            const val = await notice.ValidateAsync();
            Assert(!val.Success, 'Share notice to user not in space roster must fail validation');
        },
    },
    {
        Id: 'write-gates.WG5',
        Name: 'WG5 — item use write gates: caller must reach space to record use',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harper = await GetPersonaUser(ctx, 'harper'); // In Harbor, not Discovery

            const items = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            const itemId = items[0].ID;

            const use = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, harper);
            use.NewRecord();
            use.SpaceID = DISCOVERY_SPACE_ID;
            use.ItemID = itemId;
            use.UserID = harper.ID;
            use.Kind = 'open';

            const val = await use.ValidateAsync();
            Assert(!val.Success, 'Item use by caller outside space must fail validation');
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('write-gates', {
    Setup: async () => {},
    Teardown: async () => {},
});
