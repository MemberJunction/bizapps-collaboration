import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient } from '@mj-biz-apps/collaboration-entities';
import { COLLABORATION_TEST_AGENT_ID, COLLABORATION_TEST_AGENT_NAME } from '../../agents/test-agent.js';
import {
    AI_AGENT_ENTITY,
    AI_AGENT_PERMISSION_ENTITY,
    AI_AGENT_PROMPT_ENTITY,
    AI_AGENT_SEARCH_SCOPE_ENTITY,
    AI_AGENT_SKILL_ENTITY,
    AI_SKILL_ENTITY,
    CONVERSATION_DETAIL_ENTITY,
    FILE_ENTITY,
    SEARCH_SCOPE_ENTITY,
    SEARCH_SCOPE_ENTITY_ENTITY,
    SPACE_ITEM_ENTITY,
} from '../../entity-names.js';
import { FindRows, getPersonaClientContext, getPersonaContext } from '../../wire.js';
import { cleanupConversation, deleteRowAndConfirm, registerChecks, runAllSteps } from '../cleanup-helpers.js';
import { attachTestAgent, detachTestAgent } from '../test-agent-attachment.js';

const createdDetailIds: string[] = [];
let testAgentAttachmentId: string | null = null;


const AGENT_ID = '9E6D761A-197A-40AF-995B-3D3DD9BD7B9E';
const SEARCH_SCOPE_ID = '6E5187CF-7E5B-447F-893D-D291994083C0';
const PROMPT_ID = 'F8DE6158-9A74-4C23-8B39-44F4C68B6E32';
const EXPANSION_QUERY_ID = 'FA742FD3-00D4-461F-A356-0265D72C39F4';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const DELIVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000003';
const CLOSED_PAST_SPACE_ID = 'C1000001-0000-4000-8000-000000000008';

const EXPECTED_SKILL_NAMES = ['Find & act', 'Promote', 'Summarize'];

async function resolveItemNames(ctx: IntegrationCheckContext, items: Array<{ RecordID: string }>): Promise<string[]> {
    const fileIds = items.map((i) => i.RecordID.replace(/^ID\|/, '')).filter(Boolean);
    if (fileIds.length === 0) return [];
    const inClause = fileIds.map((id) => `'${id}'`).join(',');
    const files = await FindRows<{ ID: string; Name: string }>(
        ctx,
        FILE_ENTITY,
        `ID IN (${inClause})`,
        ['ID', 'Name'],
        ctx.User,
    );
    return files.map((f) => f.Name);
}

const checks: NamedCheck[] = [
    {
        Id: 'agent.AG1',
        Name: 'AG1 — Collaboration Space Agent, skills, and Search Scope metadata contract',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            // 1. Verify Search Scope and its restricting SpaceID dimension with expansion query
            const scopes = await FindRows<{ ID: string; Name: string; SearchContextConfig: string }>(
                ctx,
                SEARCH_SCOPE_ENTITY,
                `ID = '${SEARCH_SCOPE_ID}'`,
                ['ID', 'Name', 'SearchContextConfig'],
            );
            Assert(scopes.length === 1, 'Collaboration Space Scope exists');
            Assert(scopes[0].Name === 'Collaboration Space Scope', 'Scope name matches');

            const parsedConfig = JSON.parse(scopes[0].SearchContextConfig ?? '{}');
            Assert(Array.isArray(parsedConfig.dimensions), 'SearchContextConfig declares dimensions');
            const spaceDimension = parsedConfig.dimensions.find((d: { name: string }) => d.name === 'SpaceID');
            Assert(!!spaceDimension, 'SearchContextConfig declares SpaceID dimension');
            Assert(spaceDimension.restricts === true, 'SpaceID dimension restricts: true');
            Assert(spaceDimension.trust === 'ServerDerived', 'SpaceID dimension trust: ServerDerived');
            Assert(spaceDimension.valueType === 'uuid[]', 'SpaceID dimension valueType: uuid[]');
            Assert(spaceDimension.valueDomain === 'set', 'SpaceID dimension valueDomain: set');
            Assert(spaceDimension.expansionQueryID?.toLowerCase() === EXPANSION_QUERY_ID.toLowerCase(), 'SpaceID dimension references expansion query');
            Assert(spaceDimension.required === true, 'SpaceID dimension required: true');

            // 2. Verify Search Scope Entities and RequiredMetadataKeys
            const scopeEntities = await FindRows<{ ID: string; SearchScopeID: string; ExtraFilter: string; RequiredMetadataKeys: string }>(
                ctx,
                SEARCH_SCOPE_ENTITY_ENTITY,
                `SearchScopeID = '${SEARCH_SCOPE_ID}'`,
                ['ID', 'SearchScopeID', 'ExtraFilter', 'RequiredMetadataKeys'],
            );
            Assert(scopeEntities.length === 2, 'Search Scope has 2 entity lanes (Space Items and Tasks)');
            for (const lane of scopeEntities) {
                Assert(lane.ExtraFilter.includes('context.SecondaryScopes.SpaceID'), 'ExtraFilter binds context.SecondaryScopes.SpaceID template');
                const reqKeys = JSON.parse(lane.RequiredMetadataKeys ?? '[]');
                Assert(Array.isArray(reqKeys) && reqKeys.includes('SpaceID'), 'Lane declares SpaceID in RequiredMetadataKeys');
            }

            // 3. Verify Collaboration Space Agent
            const agents = await FindRows<{ ID: string; Name: string; AcceptsSkills: string; SkillActivationMode: string; ExposeAsAction: boolean; DriverClass: string | null }>(
                ctx,
                AI_AGENT_ENTITY,
                `ID = '${AGENT_ID}'`,
                ['ID', 'Name', 'AcceptsSkills', 'SkillActivationMode', 'ExposeAsAction', 'DriverClass'],
            );
            Assert(agents.length === 1, 'Collaboration Space Agent exists');
            Assert(agents[0].Name === 'Collaboration Space Agent', 'Agent name matches');
            Assert(agents[0].AcceptsSkills === 'Limited', 'Agent AcceptsSkills is Limited');
            Assert(agents[0].SkillActivationMode === 'Auto', 'Agent SkillActivationMode is Auto');
            Assert(agents[0].ExposeAsAction === false, 'Agent ExposeAsAction is false (isolated from global chat area)');
            Assert(agents[0].DriverClass === null, `The shipped agent has no DriverClass; no test changes a shipped row (saw ${agents[0].DriverClass})`);

            // 4. Verify 3 assigned skills
            const assignedSkills = await FindRows<{ ID: string; SkillID: string }>(
                ctx,
                AI_AGENT_SKILL_ENTITY,
                `AgentID = '${AGENT_ID}'`,
                ['ID', 'SkillID'],
            );
            Assert(assignedSkills.length === 3, 'Agent has 3 skills assigned (Promote, Summarize, Find & act)');

            const skillIds = assignedSkills.map((s) => `'${s.SkillID}'`).join(',');
            const skills = await FindRows<{ ID: string; Name: string; Instructions: string }>(
                ctx,
                AI_SKILL_ENTITY,
                `ID IN (${skillIds})`,
                ['ID', 'Name', 'Instructions'],
            );
            const foundSkillNames = skills.map((s) => s.Name).sort();
            Assert(JSON.stringify(foundSkillNames) === JSON.stringify(EXPECTED_SKILL_NAMES), 'Expected 3 collaboration skills assigned to agent');

            // 5. Verify Prompt link
            const agentPrompts = await FindRows<{ ID: string; PromptID: string; Status: string }>(
                ctx,
                AI_AGENT_PROMPT_ENTITY,
                `AgentID = '${AGENT_ID}'`,
                ['ID', 'PromptID', 'Status'],
            );
            Assert(agentPrompts.length === 1, 'Agent has 1 linked prompt');
            Assert(agentPrompts[0].PromptID.toLowerCase() === PROMPT_ID.toLowerCase(), 'Linked to Collaboration Space Agent - Ask prompt');
            Assert(agentPrompts[0].Status === 'Active', 'Agent prompt is Active');

            // 6. Verify Permissions: 5 roles (Space Participant, UI, Integration, Developer, Agent Administrator) with CanRun and CanView
            const agentPermissions = await FindRows<{ ID: string; CanRun: boolean; CanView: boolean }>(
                ctx,
                AI_AGENT_PERMISSION_ENTITY,
                `AgentID = '${AGENT_ID}'`,
                ['ID', 'CanRun', 'CanView'],
            );
            Assert(agentPermissions.length === 5, `Agent has 5 permission records, saw ${agentPermissions.length}`);
            for (const perm of agentPermissions) {
                Assert(perm.CanRun === true, 'Permission CanRun is true');
                Assert(perm.CanView === true, 'Permission CanView is true');
            }

            // 7. Verify Search Scope link
            const agentScopes = await FindRows<{ ID: string; SearchScopeID: string; Phase: string }>(
                ctx,
                AI_AGENT_SEARCH_SCOPE_ENTITY,
                `AgentID = '${AGENT_ID}'`,
                ['ID', 'SearchScopeID', 'Phase'],
            );
            Assert(agentScopes.length === 1, 'Agent is linked to 1 Search Scope');
            Assert(agentScopes[0].SearchScopeID.toLowerCase() === SEARCH_SCOPE_ID.toLowerCase(), 'Linked to Collaboration Space Scope');

            // Note: ExplainScope has no GraphQL endpoint on MJ next; the server harness covers it.
        },
    },
    {
        Id: 'agent.AG2',
        Name: 'AG2 — Client in Discovery reads only Discovery Shared material via row filters, never Team',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');

            // Discovery has:
            // - site-photo.png (Shared, uploader bea)
            // - discovery-brief.pdf (Team, uploader ada)
            const items = await FindRows<{ ID: string; RecordID: string; Band: string }>(
                beaCtx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID', 'RecordID', 'Band'],
                beaCtx.User,
            );
            const names = await resolveItemNames(beaCtx, items);
            Assert(names.includes('site-photo.png'), 'Shared site-photo.png is visible to client Bea');
            Assert(!names.includes('discovery-brief.pdf'), 'Team discovery-brief.pdf is NEVER visible to client Bea');
        },
    },
    {
        Id: 'agent.AG3',
        Name: 'AG3 — Asked from child space stays inside child space (no parent or sibling leak)',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');

            const items = await FindRows<{ ID: string; SpaceID: string; RecordID: string }>(
                beaCtx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID', 'SpaceID', 'RecordID'],
                beaCtx.User,
            );
            const names = await resolveItemNames(beaCtx, items);
            Assert(names.includes('site-photo.png'), 'Must quote site-photo.png inside child space');

            for (const item of items) {
                Assert(
                    item.SpaceID.toLowerCase() !== NORTHWIND_SPACE_ID.toLowerCase(),
                    'Parent space (Northwind) items are not quoted when asked from child space (Discovery)',
                );
                Assert(
                    item.SpaceID.toLowerCase() !== DELIVERY_SPACE_ID.toLowerCase(),
                    'Sibling space (Delivery) items are not quoted',
                );
            }
        },
    },
    {
        Id: 'agent.AG4',
        Name: 'AG4 — Staff owner in Discovery reads Team items via row filters',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');

            const items = await FindRows<{ ID: string; RecordID: string; Band: string }>(
                adaCtx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID', 'RecordID', 'Band'],
                adaCtx.User,
            );
            const names = await resolveItemNames(adaCtx, items);
            Assert(names.includes('site-photo.png'), 'Ada sees Shared site-photo.png');
            Assert(names.includes('discovery-brief.pdf'), 'Ada sees Team discovery-brief.pdf in Discovery');
        },
    },
    {
        Id: 'agent.AG5',
        Name: 'AG5 — Parent-to-child retrieval honors ExcludedFromParentScope and ExcludedEntirely',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');

            const items = await FindRows<{ ID: string; SpaceID: string; RecordID: string }>(
                adaCtx,
                SPACE_ITEM_ENTITY,
                `SpaceID IN ('${NORTHWIND_SPACE_ID}', '${DISCOVERY_SPACE_ID}')`,
                ['ID', 'SpaceID', 'RecordID'],
                adaCtx.User,
            );
            const names = await resolveItemNames(adaCtx, items);
            Assert(names.includes('site-photo.png'), 'Must include site-photo.png in reachable subtree');

            for (const item of items) {
                Assert(
                    item.SpaceID.toLowerCase() !== DELIVERY_SPACE_ID.toLowerCase(),
                    'Delivery items are excluded from parent scope (ExcludedFromParentScope)',
                );
                Assert(
                    item.SpaceID.toLowerCase() !== CLOSED_PAST_SPACE_ID.toLowerCase(),
                    'Closed past space items are excluded entirely (ExcludedEntirely)',
                );
            }
        },
    },
    {
        Id: 'agent.AG6',
        Name: 'AG6 — Space room message submission via typed client verifies DetailID',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);
            const beaClient = new CollaborationClient(beaCtx.GraphQLProvider);

            const startRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-client-ag6-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.Success === true && !!startRes.ConversationID && !!startRes.SpaceChatID, `Ada creates General conversation for client AG6: ${startRes.ErrorMessage ?? ''}`);
            const convId = startRes.ConversationID!;
            const chatId = startRes.SpaceChatID!;

            try {
                const result = await beaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: convId,
                    Text: 'AG6 client check verification message',
                });
                Assert(result.Success === true, `PostSpaceMessage succeeded: ${result.ErrorMessage ?? 'none'}`);
                Assert(typeof result.DetailID === 'string' && result.DetailID.length > 0, 'PostSpaceMessage returned valid DetailID');
                if (result.DetailID) {
                    createdDetailIds.push(result.DetailID);
                }
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, convId, chatId);
            }
        },
    },
    {
        Id: 'agent.AG7',
        Name: 'AG7 — Space chat turn honors conversation kind audience bounding (Item 23)',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);

            const genStart = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-client-ag7-gen-${Date.now()}`,
                Kind: 'General',
            });
            Assert(genStart.Success === true && !!genStart.ConversationID && !!genStart.SpaceChatID, `Ada creates General conversation: ${genStart.ErrorMessage ?? ''}`);
            const genConvId = genStart.ConversationID!;
            const genChatId = genStart.SpaceChatID!;

            const privStart = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-client-ag7-priv-${Date.now()}`,
                Kind: 'Private',
            });
            Assert(privStart.Success === true && !!privStart.ConversationID && !!privStart.SpaceChatID, `Ada creates Private conversation: ${privStart.ErrorMessage ?? ''}`);
            const privConvId = privStart.ConversationID!;
            const privChatId = privStart.SpaceChatID!;

            try {
                // 1. Ada posts in General conversation tagging agent
                const genMsg = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} summarize available documents`,
                });
                Assert(genMsg.Success === true && !!genMsg.DetailID, `Ada posted tagged message in General: ${genMsg.ErrorMessage ?? ''}`);
                if (genMsg.DetailID) createdDetailIds.push(genMsg.DetailID);

                const genTurnRes = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: genMsg.DetailID!,
                    AgentID: COLLABORATION_TEST_AGENT_ID,
                });
                Assert(genTurnRes.Success === true, `Agent turn in General succeeded: ${genTurnRes.ErrorMessage ?? ''}`);
                if (genTurnRes.ReplyDetailIDs) createdDetailIds.push(...genTurnRes.ReplyDetailIDs);
                Assert(genTurnRes.AllowedItemNames !== undefined, 'General turn returned AllowedItemNames over wire');
                Assert(genTurnRes.AllowedItemNames!.includes('site-photo.png'), 'General turn MUST allow Shared file site-photo.png');
                Assert(!genTurnRes.AllowedItemNames!.includes('discovery-brief.pdf'), 'General turn must NOT allow Team file discovery-brief.pdf');

                // Bea (client with Shared-only visibility) can view the General conversation assistant reply
                const beaReplies = await FindRows<{ ID: string; Role: string; Message: string }>(
                    beaCtx,
                    CONVERSATION_DETAIL_ENTITY,
                    `ConversationID = '${genConvId}' AND Role = 'AI'`,
                    ['ID', 'Role', 'Message'],
                    beaCtx.User,
                );
                Assert(beaReplies.length >= 1, 'Bea can read assistant reply in General conversation');
                Assert(beaReplies[0].Message.includes('site-photo.png'), 'Bea reads assistant reply quoting site-photo.png');
                Assert(!beaReplies[0].Message.includes('discovery-brief.pdf'), 'Bea never sees discovery-brief.pdf in General reply');

                // 2. Ada posts in Private conversation tagging agent
                const privMsg = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: privConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} summarize available documents`,
                });
                Assert(privMsg.Success === true && !!privMsg.DetailID, `Ada posted tagged message in Private: ${privMsg.ErrorMessage ?? ''}`);
                if (privMsg.DetailID) createdDetailIds.push(privMsg.DetailID);

                const privTurnRes = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: privConvId,
                    UserMessageID: privMsg.DetailID!,
                    AgentID: COLLABORATION_TEST_AGENT_ID,
                });
                Assert(privTurnRes.Success === true, `Agent turn in Private succeeded: ${privTurnRes.ErrorMessage ?? ''}`);
                if (privTurnRes.ReplyDetailIDs) createdDetailIds.push(...privTurnRes.ReplyDetailIDs);
                Assert(privTurnRes.AllowedItemNames !== undefined, 'Private turn returned AllowedItemNames over wire');
                Assert(privTurnRes.AllowedItemNames!.includes('site-photo.png'), 'Private turn MUST allow Shared file site-photo.png');
                Assert(privTurnRes.AllowedItemNames!.includes('discovery-brief.pdf'), 'Private turn MUST allow Team file discovery-brief.pdf');

                // 3. Test Item 6: Untagged message with AgentID under MentionOnly is refused turn
                const untaggedMsg = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    Text: 'Untagged message asking for turn over wire',
                });
                Assert(untaggedMsg.Success === true && !!untaggedMsg.DetailID, `Ada posted untagged message: ${untaggedMsg.ErrorMessage ?? ''}`);
                if (untaggedMsg.DetailID) createdDetailIds.push(untaggedMsg.DetailID);

                const untaggedTurnRes = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: untaggedMsg.DetailID!,
                    AgentID: COLLABORATION_TEST_AGENT_ID,
                });
                Assert(!untaggedTurnRes.Success, 'Untagged message with AgentID under MentionOnly must be refused a turn over wire');
                Assert(untaggedTurnRes.ErrorMessage === 'The message does not mention an agent.', `Untagged refusal matches: ${untaggedTurnRes.ErrorMessage}`);

                // 4. Test Item 5 & 22: Second turn on same userMessageId is refused
                const secondTurnRes = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: genMsg.DetailID!,
                    AgentID: COLLABORATION_TEST_AGENT_ID,
                });
                Assert(!secondTurnRes.Success, 'Second turn on already-processed UserMessageID must be refused over wire');
                Assert(secondTurnRes.ErrorMessage === 'This message has already been processed by an agent turn.', `Second turn refusal matches: ${secondTurnRes.ErrorMessage}`);

                // 5. Person-only @mention is refused a turn over the wire
                const personMentionMsg = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    Text: `@{"type":"user","id":"${beaCtx.User.ID}","name":"Bea"} can you check the shared photo?`,
                });
                Assert(personMentionMsg.Success === true && !!personMentionMsg.DetailID, `Ada posted person-mention message: ${personMentionMsg.ErrorMessage ?? ''}`);
                if (personMentionMsg.DetailID) createdDetailIds.push(personMentionMsg.DetailID);

                const personTurnRes = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: personMentionMsg.DetailID!,
                });
                Assert(!personTurnRes.Success, 'Message mentioning only a person must be refused a turn over wire');
                Assert(/addressed to a person/i.test(personTurnRes.ErrorMessage ?? ''), `Person mention refusal matches: ${personTurnRes.ErrorMessage}`);

                // 6. Thread reply (ParentDetailID pointing to assistant reply) routes to the parent's agent without @mention over the wire
                const assistantReplyId = genTurnRes.ReplyDetailIDs?.[0];
                Assert(!!assistantReplyId, 'General turn returned at least one ReplyDetailID');
                const threadReplyMsg = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    Text: 'What else can you tell me about that file?',
                    ParentDetailID: assistantReplyId,
                });
                Assert(threadReplyMsg.Success === true && !!threadReplyMsg.DetailID, `Ada posted thread reply: ${threadReplyMsg.ErrorMessage ?? ''}`);
                if (threadReplyMsg.DetailID) createdDetailIds.push(threadReplyMsg.DetailID);

                const threadTurnRes = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: threadReplyMsg.DetailID!,
                    Route: 'ThreadReply',
                });
                Assert(threadTurnRes.Success === true, `Thread-reply agent turn succeeded over wire without @mention: ${threadTurnRes.ErrorMessage ?? ''}`);
                if (threadTurnRes.ReplyDetailIDs) createdDetailIds.push(...threadTurnRes.ReplyDetailIDs);
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, genConvId, genChatId);
                await cleanupConversation(ctx.Provider, ctx.User, privConvId, privChatId);
            }
        },
    },
    {
        Id: 'agent.AG8',
        Name: 'AG8 — ExecuteSpaceChatTurn over the wire retrieves a variety of uploaded document types (.pdf, .docx, .xlsx, .csv, .md, .json, .html, .txt, .png) according to conversation audience',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);
            const stamp = Date.now();

            const docs: Array<{ fileName: string; mimeType: string; band: 'Shared' | 'Team'; content: string }> = [
                { fileName: `ag8-wire-roadmap-${stamp}.pdf`, mimeType: 'application/pdf', band: 'Shared', content: '%PDF-1.4 roadmap' },
                { fileName: `ag8-wire-sow-${stamp}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', band: 'Shared', content: 'PK\x03\x04 sow docx' },
                { fileName: `ag8-wire-pricing-${stamp}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', band: 'Team', content: 'PK\x03\x04 pricing xlsx' },
                { fileName: `ag8-wire-metrics-${stamp}.csv`, mimeType: 'text/csv', band: 'Shared', content: 'site,otif\nChicago,94.2\n' },
                { fileName: `ag8-wire-adr-${stamp}.md`, mimeType: 'text/markdown', band: 'Shared', content: '# ADR-01\n' },
                { fileName: `ag8-wire-contract-${stamp}.json`, mimeType: 'application/json', band: 'Shared', content: '{"openapi":"3.1.0"}' },
                { fileName: `ag8-wire-portal-${stamp}.html`, mimeType: 'text/html', band: 'Shared', content: '<html><body>Portal</body></html>' },
                { fileName: `ag8-wire-playbook-${stamp}.txt`, mimeType: 'text/plain', band: 'Team', content: 'Internal playbook' },
                { fileName: `ag8-wire-diagram-${stamp}.png`, mimeType: 'image/png', band: 'Shared', content: '\x89PNG\r\n\x1a\n' },
            ];

            const uploadedItemIds: string[] = [];
            let genConvId: string | null = null;
            let genChatId: string | null = null;
            let privConvId: string | null = null;
            let privChatId: string | null = null;

            try {
                for (const doc of docs) {
                    const up = await adaClient.UploadSpaceFile({
                        SpaceID: DISCOVERY_SPACE_ID,
                        FileName: doc.fileName,
                        MimeType: doc.mimeType,
                        Base64Data: Buffer.from(doc.content).toString('base64'),
                        Folder: 'Briefs',
                        Band: doc.band,
                    });
                    Assert(up.Success === true && !!up.ItemID, `AG8 wire upload succeeded for ${doc.fileName}: ${up.ErrorMessage ?? ''}`);
                    if (up.ItemID) uploadedItemIds.push(up.ItemID);
                }

                const sharedDocNames = docs.filter((d) => d.band === 'Shared').map((d) => d.fileName);
                const teamDocNames = docs.filter((d) => d.band === 'Team').map((d) => d.fileName);

                const genStart = await adaClient.CreateSpaceConversation({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-client-ag8-gen-${stamp}`,
                    Kind: 'General',
                });
                Assert(genStart.Success === true && !!genStart.ConversationID && !!genStart.SpaceChatID, `Ada creates General conversation: ${genStart.ErrorMessage ?? ''}`);
                genConvId = genStart.ConversationID!;
                genChatId = genStart.SpaceChatID!;

                const genMsg = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} summarize uploaded documents`,
                });
                Assert(genMsg.Success === true && !!genMsg.DetailID, `Ada posts in General: ${genMsg.ErrorMessage ?? ''}`);
                if (genMsg.DetailID) createdDetailIds.push(genMsg.DetailID);

                const genTurn = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: genMsg.DetailID!,
                    AgentID: COLLABORATION_TEST_AGENT_ID,
                });
                Assert(genTurn.Success === true && !!genTurn.ReplyDetailIDs?.length, `General turn over wire succeeded: ${genTurn.ErrorMessage ?? ''}`);
                if (genTurn.ReplyDetailIDs) createdDetailIds.push(...genTurn.ReplyDetailIDs);
                const [genReply] = await FindRows<{ Message: string }>(
                    ctx,
                    CONVERSATION_DETAIL_ENTITY,
                    `ID = '${genTurn.ReplyDetailIDs![0]}'`,
                    ['Message'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(!!genReply?.Message, 'General turn over wire persisted assistant reply');
                for (const name of sharedDocNames) {
                    Assert(genTurn.AllowedItemNames?.includes(name) === true, `General turn allows Shared uploaded doc ${name}`);
                    Assert(genReply.Message.includes(name), `General turn assistant reply quotes Shared uploaded doc ${name}`);
                }
                for (const name of teamDocNames) {
                    Assert(!genTurn.AllowedItemNames?.includes(name), `General turn blocks Team uploaded doc ${name}`);
                    Assert(!genReply.Message.includes(name), `General turn assistant reply NEVER quotes Team uploaded doc ${name}`);
                }

                const privStart = await adaClient.CreateSpaceConversation({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-client-ag8-priv-${stamp}`,
                    Kind: 'Private',
                });
                Assert(privStart.Success === true && !!privStart.ConversationID && !!privStart.SpaceChatID, `Ada creates Private conversation: ${privStart.ErrorMessage ?? ''}`);
                privConvId = privStart.ConversationID!;
                privChatId = privStart.SpaceChatID!;

                const privMsg = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: privConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} summarize all uploaded documents`,
                });
                Assert(privMsg.Success === true && !!privMsg.DetailID, `Ada posts in Private: ${privMsg.ErrorMessage ?? ''}`);
                if (privMsg.DetailID) createdDetailIds.push(privMsg.DetailID);

                const privTurn = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: privConvId,
                    UserMessageID: privMsg.DetailID!,
                    AgentID: COLLABORATION_TEST_AGENT_ID,
                });
                Assert(privTurn.Success === true && !!privTurn.ReplyDetailIDs?.length, `Private turn over wire succeeded: ${privTurn.ErrorMessage ?? ''}`);
                if (privTurn.ReplyDetailIDs) createdDetailIds.push(...privTurn.ReplyDetailIDs);
                const [privReply] = await FindRows<{ Message: string }>(
                    ctx,
                    CONVERSATION_DETAIL_ENTITY,
                    `ID = '${privTurn.ReplyDetailIDs![0]}'`,
                    ['Message'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(!!privReply?.Message, 'Private turn over wire persisted assistant reply');
                for (const name of [...sharedDocNames, ...teamDocNames]) {
                    Assert(privTurn.AllowedItemNames?.includes(name) === true, `Private turn allows uploaded doc ${name}`);
                    Assert(privReply.Message.includes(name), `Private turn assistant reply quotes uploaded doc ${name}`);
                }
            } finally {
                if (genConvId && genChatId) await cleanupConversation(ctx.Provider, ctx.User, genConvId, genChatId);
                if (privConvId && privChatId) await cleanupConversation(ctx.Provider, ctx.User, privConvId, privChatId);
                await runAllSteps(
                    uploadedItemIds.reverse().map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, id, 'an AG8 wire uploaded item')),
                );
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('agent', {
    // The turn checks run on the harness's own test agent, attached to the Northwind root for the bundle; its children inherit it.
    // The MJAPI this harness talks to must load the test agent's driver (docs/reviewing-the-data.md).
    Setup: async (ctx: IntegrationCheckContext) => {
        testAgentAttachmentId = await attachTestAgent(ctx, NORTHWIND_SPACE_ID);
    },
    Teardown: async (ctx: IntegrationCheckContext) =>
        runAllSteps([
            async () => {
                if (testAgentAttachmentId) {
                    const attachmentId = testAgentAttachmentId;
                    testAgentAttachmentId = null;
                    await detachTestAgent(ctx, attachmentId);
                }
            },
            ...createdDetailIds.splice(0).reverse().map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, CONVERSATION_DETAIL_ENTITY, id, 'a message a agent check posted')),
        ]),
});
