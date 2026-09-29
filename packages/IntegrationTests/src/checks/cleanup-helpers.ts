import { Assert } from '@memberjunction/testing-integration/registry';
import { RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJAIAgentRunEntity, MJConversationDetailEntity, MJConversationEntity, MJResourcePermissionEntity } from '@memberjunction/core-entities';
import {
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceChatEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    CONVERSATION_ENTITY,
    CONVERSATION_DETAIL_ENTITY,
    SPACE_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_CHAT_ENTITY,
    SPACE_MEMBER_ENTITY,
} from '../entity-names.js';

export async function cleanupConversation(
    provider: IMetadataProvider,
    user: UserInfo,
    conversationId?: string | null,
    spaceChatId?: string | null,
): Promise<void> {
    const rv = RunView.FromMetadataProvider(provider);
    if (conversationId) {
        // 1. Agent runs created for this conversation
        const runs = await rv.RunView<{ ID: string }>({
            EntityName: 'MJ: AI Agent Runs',
            ExtraFilter: `ConversationID = '${conversationId}'`,
            Fields: ['ID'],
            MaxRows: 100,
        }, user);
        if (runs?.Success && runs.Results) {
            for (const r of runs.Results) {
                const runObj = await provider.GetEntityObject<MJAIAgentRunEntity>('MJ: AI Agent Runs', user);
                if (await runObj.Load(r.ID)) {
                    const del = await runObj.Delete();
                    Assert(del === true, `Failed to delete AI Agent Run ${r.ID}`);
                }
            }
        }

        // 2. Space chats
        const chats = await rv.RunView<{ ID: string }>({
            EntityName: SPACE_CHAT_ENTITY,
            ExtraFilter: `ConversationID = '${conversationId}'`,
            Fields: ['ID'],
            MaxRows: 100,
        }, user);
        if (chats?.Success && chats.Results) {
            for (const c of chats.Results) {
                const chat = await provider.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>(SPACE_CHAT_ENTITY, user);
                if (await chat.Load(c.ID)) {
                    const del = await chat.Delete();
                    Assert(del === true, `Failed to delete Space Chat ${c.ID}`);
                }
            }
        }

        // 3. Conversation details
        const details = await rv.RunView<{ ID: string }>({
            EntityName: CONVERSATION_DETAIL_ENTITY,
            ExtraFilter: `ConversationID = '${conversationId}'`,
            Fields: ['ID'],
            MaxRows: 1000,
        }, user);
        if (details?.Success && details.Results) {
            for (const d of details.Results) {
                const det = await provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, user);
                if (await det.Load(d.ID)) {
                    const del = await det.Delete();
                    Assert(del === true, `Failed to delete Conversation Detail ${d.ID}`);
                }
            }
        }

        // 4. Resource permissions
        const grants = await rv.RunView<{ ID: string }>({
            EntityName: 'MJ: Resource Permissions',
            ExtraFilter: `ResourceRecordID = '${conversationId}'`,
            Fields: ['ID'],
            MaxRows: 1000,
        }, user);
        if (grants?.Success && grants.Results) {
            for (const g of grants.Results) {
                const p = await provider.GetEntityObject<MJResourcePermissionEntity>('MJ: Resource Permissions', user);
                if (await p.Load(g.ID)) {
                    const del = await p.Delete();
                    Assert(del === true, `Failed to delete Resource Permission ${g.ID}`);
                }
            }
        }

        // 5. Conversation record
        const conv = await provider.GetEntityObject<MJConversationEntity>(CONVERSATION_ENTITY, user);
        if (await conv.Load(conversationId)) {
            const del = await conv.Delete();
            Assert(del === true, `Failed to delete Conversation ${conversationId}`);
        }
    } else if (spaceChatId) {
        const chat = await provider.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>(SPACE_CHAT_ENTITY, user);
        if (await chat.Load(spaceChatId)) {
            const del = await chat.Delete();
            Assert(del === true, `Failed to delete Space Chat ${spaceChatId}`);
        }
    }
}

export async function cleanupSpace(
    provider: IMetadataProvider,
    user: UserInfo,
    spaceId: string,
): Promise<void> {
    const rv = RunView.FromMetadataProvider(provider);

    // 1. Chats & conversations
    const chats = await rv.RunView<{ ID: string; ConversationID: string }>({
        EntityName: SPACE_CHAT_ENTITY,
        ExtraFilter: `SpaceID = '${spaceId}'`,
        Fields: ['ID', 'ConversationID'],
        MaxRows: 100,
    }, user);
    if (chats?.Success && chats.Results) {
        for (const c of chats.Results) {
            await cleanupConversation(provider, user, c.ConversationID, c.ID);
        }
    }

    // 2. Items
    const items = await rv.RunView<{ ID: string }>({
        EntityName: SPACE_ITEM_ENTITY,
        ExtraFilter: `SpaceID = '${spaceId}'`,
        Fields: ['ID'],
        MaxRows: 100,
    }, user);
    if (items?.Success && items.Results) {
        for (const item of items.Results) {
            const itemObj = await provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, user);
            if (await itemObj.Load(item.ID)) {
                const del = await itemObj.Delete();
                Assert(del === true, `Failed to delete Space Item ${item.ID}`);
            }
        }
    }

    // 3. Members
    const members = await rv.RunView<{ ID: string }>({
        EntityName: SPACE_MEMBER_ENTITY,
        ExtraFilter: `SpaceID = '${spaceId}'`,
        Fields: ['ID'],
        MaxRows: 100,
    }, user);
    if (members?.Success && members.Results) {
        for (const m of members.Results) {
            const memObj = await provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, user);
            if (await memObj.Load(m.ID)) {
                const del = await memObj.Delete();
                Assert(del === true, `Failed to delete Space Member ${m.ID}`);
            }
        }
    }

    // 4. Space record
    const spaceObj = await provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, user);
    if (await spaceObj.Load(spaceId)) {
        const del = await spaceObj.Delete();
        Assert(del === true, `Failed to delete Space ${spaceId}`);
    }
}
