import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    CONVERSATION_DETAIL_ENTITY,
    SPACE_CHAT_ENTITY,
    SPACE_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_MEMBER_ENTITY,
    TASK_ENTITY,
} from '../../entity-names.js';
import { FindRows } from '../../wire.js';
import { registerChecks } from '../cleanup-helpers.js';


const checks: NamedCheck[] = [
    {
        Id: 'features.FE1',
        Name: 'FE1 — spaces have distinct IconClass, Color, and BackgroundImageURL',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const spaces = await FindRows<{
                ID: string;
                Name: string;
                IconClass: string | null;
                Color: string | null;
                BackgroundImageURL: string | null;
            }>(
                ctx,
                SPACE_ENTITY,
                "ID LIKE 'C1000001-0000-4000-8000-%'",
                ['ID', 'Name', 'IconClass', 'Color', 'BackgroundImageURL'],
            );
            Assert(spaces.length === 19, `Expected 19 world spaces (15 and the four chapter spaces of stage 2), found ${spaces.length}`);

            const icons = new Set<string>();
            const colors = new Set<string>();
            const backdrops = new Set<string>();

            for (const s of spaces) {
                Assert(!!s.IconClass && s.IconClass.trim().length > 0, `Space ${s.Name} must have an IconClass`);
                Assert(!!s.Color && s.Color.trim().length > 0, `Space ${s.Name} must have a Color`);
                Assert(!!s.BackgroundImageURL && s.BackgroundImageURL.trim().length > 0, `Space ${s.Name} must have a BackgroundImageURL`);

                icons.add(s.IconClass!.trim());
                colors.add(s.Color!.trim().toLowerCase());
                backdrops.add(s.BackgroundImageURL!.trim());
            }

            Assert(icons.size === 19, `World spaces must have pairwise-distinct IconClass values: expected 19, got ${icons.size}`);
            Assert(colors.size === 19, `World spaces must have pairwise-distinct Color values: expected 19, got ${colors.size}`);
            Assert(backdrops.size === 19, `World spaces must have pairwise-distinct BackgroundImageURL values: expected 19, got ${backdrops.size}`);
        },
    },
    {
        Id: 'features.FE3',
        Name: 'FE3 — tasks linked to spaces via polymorphic SpaceItem',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const tasksEntity = ctx.Provider.EntityByName(TASK_ENTITY);
            Assert(tasksEntity !== null && tasksEntity !== undefined, 'Tasks entity is installed in metadata');
            if (!tasksEntity?.ID) throw new Error('Tasks entity has no ID');

            const taskItems = await FindRows<{
                ID: string;
                SpaceID: string;
                RecordID: string;
                EntityID: string;
                Band: string;
            }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `EntityID = '${tasksEntity.ID}'`,
                ['ID', 'SpaceID', 'RecordID', 'EntityID', 'Band'],
            );
            Assert(taskItems.length > 0, 'Tasks are linked to spaces via SpaceItem');

            const taskIds = taskItems.map((item) => (item.RecordID ?? '').replace(/^ID\|/i, ''));
            const tasks = await FindRows<{ ID: string; Name: string; Status: string }>(
                ctx,
                TASK_ENTITY,
                `ID IN (${taskIds.map((id) => `'${id}'`).join(',')})`,
                ['ID', 'Name', 'Status'],
            );
            Assert(tasks.length > 0, 'Referenced tasks exist in Tasks table');
        },
    },
    {
        Id: 'features.FE4',
        Name: 'FE4 — space conversations have active message history per space',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const spaceChats = await FindRows<{
                ID: string;
                SpaceID: string;
                ConversationID: string;
            }>(
                ctx,
                SPACE_CHAT_ENTITY,
                "Status = 'Active'",
                ['ID', 'SpaceID', 'ConversationID'],
            );
            Assert(spaceChats.length > 0, 'Space chats exist');

            const convIds = spaceChats.map((c) => c.ConversationID).filter(Boolean);
            const messages = await FindRows<{
                ID: string;
                ConversationID: string;
                UserID: string;
                Message: string;
            }>(
                ctx,
                CONVERSATION_DETAIL_ENTITY,
                `ConversationID IN (${convIds.map((id) => `'${id}'`).join(',')})`,
                ['ID', 'ConversationID', 'UserID', 'Message'],
            );
            Assert(messages.length > 0, 'Conversation detail messages exist in space rooms');

            const nonTrivialMessages = messages.filter((m) => m.Message && m.Message.trim().length > 5);
            Assert(nonTrivialMessages.length > 0, 'Messages have non-trivial text content');
        },
    },
    {
        Id: 'features.FE5',
        Name: 'FE5 — hierarchical space structure supports parent-child breadcrumbs and nested navigation',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const spaces = await FindRows<{
                ID: string;
                Name: string;
                ParentID: string | null;
            }>(
                ctx,
                SPACE_ENTITY,
                'ID IS NOT NULL',
                ['ID', 'Name', 'ParentID'],
            );

            const spaceMap = new Map(spaces.map((s) => [s.ID.toLowerCase(), s]));
            const children = spaces.filter((s) => s.ParentID !== null && s.ParentID !== undefined);
            Assert(children.length > 0, 'Child spaces exist with ParentID set');

            const multiLevel = children.find((c) => {
                if (!c.ParentID) return false;
                const parent = spaceMap.get(c.ParentID.toLowerCase());
                return parent && parent.ParentID !== null;
            });
            Assert(multiLevel !== undefined, 'Multi-level space hierarchy (Grandparent > Parent > Child) exists for deep breadcrumbs');
        },
    },
    {
        Id: 'features.FE6',
        Name: 'FE6 — multi-user collaboration rosters populated across spaces',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const members = await FindRows<{
                ID: string;
                SpaceID: string;
                UserID: string;
                Status: string;
            }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                "Status = 'Active'",
                ['ID', 'SpaceID', 'UserID', 'Status'],
            );

            const bySpace = new Map<string, Set<string>>();
            for (const m of members) {
                const set = bySpace.get(m.SpaceID.toLowerCase()) ?? new Set<string>();
                set.add(m.UserID.toLowerCase());
                bySpace.set(m.SpaceID.toLowerCase(), set);
            }

            const multiUserSpaces = [...bySpace.values()].filter((userSet) => userSet.size >= 3);
            Assert(multiUserSpaces.length > 0, 'At least one space has 3 or more active distinct user members');
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('features', {
    Setup: async () => {},
    Teardown: async () => {},
});
