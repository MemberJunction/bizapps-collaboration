import { RunView, type UserInfo } from '@memberjunction/core';
import type { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { SearchEngine } from '@memberjunction/search-engine';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { createSpaceConversation, executeSpaceChatTurn, postSpaceMessage, resolveSpaceAgentRetrieval } from '@mj-biz-apps/collaboration-core-entities-server';
import { COLLABORATION_TEST_AGENT_ID, COLLABORATION_TEST_AGENT_NAME } from '../agents/test-agent.js';
import {
    AI_AGENT_ENTITY,
    AI_AGENT_PERMISSION_ENTITY,
    AI_AGENT_PROMPT_ENTITY,
    AI_AGENT_SEARCH_SCOPE_ENTITY,
    AI_AGENT_SKILL_ENTITY,
    ENTITY_PERMISSION_ENTITY,
    ROW_LEVEL_SECURITY_FILTER_ENTITY,
    SEARCH_SCOPE_PERMISSION_ENTITY,
    AI_SKILL_ENTITY,
    CONVERSATION_DETAIL_ENTITY,
    FILE_ENTITY,
    SEARCH_SCOPE_ENTITY,
    SEARCH_SCOPE_ENTITY_ENTITY,
    SPACE_ITEM_ENTITY,
    TASK_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser, SameID, View, isClientTransport } from '../wire.js';
import { cleanupConversation, registerChecks } from './cleanup-helpers.js';
import { attachTestAgent, detachTestAgent } from './test-agent-attachment.js';

const AGENT_ID = '9E6D761A-197A-40AF-995B-3D3DD9BD7B9E';
const SEARCH_SCOPE_ID = '6E5187CF-7E5B-447F-893D-D291994083C0';
const PROMPT_ID = 'F8DE6158-9A74-4C23-8B39-44F4C68B6E32';
const EXPANSION_QUERY_ID = 'FA742FD3-00D4-461F-A356-0265D72C39F4';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const DELIVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000003';
const CLOSED_PAST_SPACE_ID = 'C1000001-0000-4000-8000-000000000008';
const FIELD_NOTES_SPACE_ID = 'C1000001-0000-4000-8000-000000000011';
const SEALED_CHILD_SPACE_ID = 'C1000001-0000-4000-8000-000000000015';

const EXPECTED_BEA_DISCOVERY_SPACES = new Set([
    DISCOVERY_SPACE_ID.toLowerCase(),
    FIELD_NOTES_SPACE_ID.toLowerCase(),
]);

const EXPECTED_ADA_NORTHWIND_SPACES = new Set([
    NORTHWIND_SPACE_ID.toLowerCase(),
    DISCOVERY_SPACE_ID.toLowerCase(),
    FIELD_NOTES_SPACE_ID.toLowerCase(),
    SEALED_CHILD_SPACE_ID.toLowerCase(),
]);

const EXPECTED_SKILL_NAMES = ['Find & act', 'Promote', 'Summarize'];
const createdDetailIds: string[] = [];
let testAgentAttachmentId: string | null = null;


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

            // 4. Verify 3 assigned skills (Ask is prompt, not skill)
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
            for (const skill of skills) {
                Assert(!!skill.Instructions && skill.Instructions.length > 0, `Skill ${skill.Name} has instructions`);
            }

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

            // 8. Verify SearchEngine.ExplainScope
            if (isClientTransport(ctx)) {
                // ExplainScope has no GraphQL endpoint in MJ 6.1.3; covered on server harness
                return;
            }
            const bea = await GetPersonaUser(ctx, 'bea');
            await SearchEngine.Instance.Config({}, bea);
            const explanations = await SearchEngine.Instance.ExplainScope(
                {
                    ScopeIDs: [SEARCH_SCOPE_ID],
                    SearchContext: {
                        PrimaryScopeRecordID: DISCOVERY_SPACE_ID,
                    },
                    AIAgentID: AGENT_ID,
                },
                bea,
            );
            Assert(explanations.length === 1, 'ExplainScope returned 1 explanation');
            const scopeExp = explanations[0];
            Assert(scopeExp.ScopeID.toLowerCase() === SEARCH_SCOPE_ID.toLowerCase(), 'Scope explanation matches ScopeID');
            Assert(scopeExp.Entitlement?.Allowed === true, `Entitlement.Allowed is true (saw ${JSON.stringify(scopeExp.Entitlement)})`);

            const spaceDim = scopeExp.Dimensions.find((d) => d.Name === 'SpaceID');
            Assert(!!spaceDim && spaceDim.Value !== null, 'SpaceID dimension is explained');
            if (!spaceDim || spaceDim.Value === null) throw new Error('SpaceID dimension missing in explanation');
            const rawVal = spaceDim.Value;
            const resolvedSpaceIds = (Array.isArray(rawVal) ? rawVal : [rawVal]).map((id) => String(id).toLowerCase());
            Assert(resolvedSpaceIds.includes(DISCOVERY_SPACE_ID.toLowerCase()), 'Resolved SpaceID set includes Discovery Space');

            Assert(scopeExp.Lanes.length === 2, 'ExplainScope reports 2 lanes');
            for (const lane of scopeExp.Lanes) {
                Assert(lane.Status === 'Active', `Lane ${lane.Target} status is Active`);
                Assert(!!lane.RenderedFilter && lane.RenderedFilter.toLowerCase().includes(DISCOVERY_SPACE_ID.toLowerCase()), `Lane ${lane.Target} filter rendered with Discovery SpaceID`);
            }

            // 9. Verify expansion query injection safety: single quote in PrimaryScopeRecordID returns empty set, not error
            const injectionExp = await SearchEngine.Instance.ExplainScope(
                {
                    ScopeIDs: [SEARCH_SCOPE_ID],
                    SearchContext: {
                        PrimaryScopeRecordID: `${DISCOVERY_SPACE_ID}' OR '1'='1`,
                    },
                    AIAgentID: AGENT_ID,
                },
                bea,
            );
            Assert(injectionExp.length === 1, 'ExplainScope with quote handled without error');
            const injSpaceDim = injectionExp[0].Dimensions.find((d) => d.Name === 'SpaceID');
            if (!injSpaceDim) {
                throw new Error('SpaceID dimension must be present in explanation');
            }
            Assert(injSpaceDim.Provenance === 'ServerDerived', 'SpaceID dimension provenance must be ServerDerived');
            const injVals = (Array.isArray(injSpaceDim.Value) ? injSpaceDim.Value : (injSpaceDim.Value ? [injSpaceDim.Value] : []));
            Assert(injVals.length === 0, `Quote injection must return empty SpaceID set, saw ${injVals.length}`);
            Assert(injectionExp[0].Reachable === true, 'Lanes are active with always-false branch, so Reachable is true');
            Assert(injectionExp[0].Lanes.length === 2, 'ExplainScope reports 2 lanes');
            for (const lane of injectionExp[0].Lanes) {
                Assert(lane.Status === 'Active', `Lane ${lane.Target} status is Active`);
                Assert(
                    !!lane.RenderedFilter && lane.RenderedFilter.includes('SpaceID IS NULL AND 1 = 0'),
                    `Lane ${lane.Target} renders always-false branch (saw: ${lane.RenderedFilter})`,
                );
            }

            // 10. Verify parity between expansion query and resolveSpaceAgentRetrieval for Bea in Discovery
            const retrieval = await resolveSpaceAgentRetrieval(ctx.Provider, bea, DISCOVERY_SPACE_ID);
            const explainedSet = new Set(resolvedSpaceIds);
            const retrievalSearchedSet = new Set(retrieval.searchedSpaceIds.map((s) => s.toLowerCase()));

            // Assert both implementations against the world's own answer: Discovery and Field notes
            Assert(
                explainedSet.size === EXPECTED_BEA_DISCOVERY_SPACES.size &&
                    [...explainedSet].every((id) => EXPECTED_BEA_DISCOVERY_SPACES.has(id)),
                `ExplainScope for Bea in Discovery must match expected world answer: query=${[...explainedSet].sort().join(',')} expected=${[...EXPECTED_BEA_DISCOVERY_SPACES].sort().join(',')}`,
            );
            Assert(
                retrievalSearchedSet.size === EXPECTED_BEA_DISCOVERY_SPACES.size &&
                    [...retrievalSearchedSet].every((id) => EXPECTED_BEA_DISCOVERY_SPACES.has(id)),
                `resolveSpaceAgentRetrieval for Bea in Discovery must match expected world answer: retrieval=${[...retrievalSearchedSet].sort().join(',')} expected=${[...EXPECTED_BEA_DISCOVERY_SPACES].sort().join(',')}`,
            );

            // Assert exact bidirectional set equality between both implementations
            Assert(
                explainedSet.size === retrievalSearchedSet.size &&
                    [...retrievalSearchedSet].every((id) => explainedSet.has(id)),
                `Bea in Discovery searched space sets must match exactly: query=${[...explainedSet].sort().join(',')} retrieval=${[...retrievalSearchedSet].sort().join(',')}`,
            );
            for (const item of retrieval.quotedItems) {
                Assert(explainedSet.has(item.SpaceID.toLowerCase()), `Item ${item.Name} space ${item.SpaceID} must be in expansion query scope`);
            }

            // 11. Ask from Northwind as Ada: covers Delivery (ExcludedFromParentScope), closed-past (ExcludedEntirely), and sealed-child
            const ada = await GetPersonaUser(ctx, 'ada');
            const adaExplanations = await SearchEngine.Instance.ExplainScope(
                {
                    ScopeIDs: [SEARCH_SCOPE_ID],
                    SearchContext: {
                        PrimaryScopeRecordID: NORTHWIND_SPACE_ID,
                    },
                    AIAgentID: AGENT_ID,
                },
                ada,
            );
            Assert(adaExplanations.length === 1, 'ExplainScope returned 1 explanation for Ada');
            const adaScopeExp = adaExplanations[0];
            const adaSpaceDim = adaScopeExp.Dimensions.find((d) => d.Name === 'SpaceID');
            Assert(!!adaSpaceDim && adaSpaceDim.Value !== null, 'SpaceID dimension is explained for Ada');
            if (!adaSpaceDim || adaSpaceDim.Value === null) throw new Error('SpaceID dimension missing for Ada');
            Assert(adaSpaceDim.Provenance === 'ServerDerived', 'Ada SpaceID provenance is ServerDerived');
            const adaRawVal = adaSpaceDim.Value;
            const adaResolvedSpaceIds = (Array.isArray(adaRawVal) ? adaRawVal : [adaRawVal]).map((id) => String(id).toLowerCase());
            const adaExplainedSet = new Set(adaResolvedSpaceIds);

            // Parity: resolveSpaceAgentRetrieval for Ada in Northwind
            const adaRetrieval = await resolveSpaceAgentRetrieval(ctx.Provider, ada, NORTHWIND_SPACE_ID);
            const adaRetrievalSearchedSet = new Set(adaRetrieval.searchedSpaceIds.map((s) => s.toLowerCase()));

            // Assert both implementations against the world's own answer: Northwind, Discovery, Field notes, Closed this month, Closed indefinite, Sealed child
            Assert(
                adaExplainedSet.size === EXPECTED_ADA_NORTHWIND_SPACES.size &&
                    [...adaExplainedSet].every((id) => EXPECTED_ADA_NORTHWIND_SPACES.has(id)),
                `ExplainScope for Ada in Northwind must match expected world answer: query=${[...adaExplainedSet].sort().join(',')} expected=${[...EXPECTED_ADA_NORTHWIND_SPACES].sort().join(',')}`,
            );
            Assert(
                adaRetrievalSearchedSet.size === EXPECTED_ADA_NORTHWIND_SPACES.size &&
                    [...adaRetrievalSearchedSet].every((id) => EXPECTED_ADA_NORTHWIND_SPACES.has(id)),
                `resolveSpaceAgentRetrieval for Ada in Northwind must match expected world answer: retrieval=${[...adaRetrievalSearchedSet].sort().join(',')} expected=${[...EXPECTED_ADA_NORTHWIND_SPACES].sort().join(',')}`,
            );

            // Assert exact bidirectional set equality between both implementations
            Assert(
                adaExplainedSet.size === adaRetrievalSearchedSet.size &&
                    [...adaRetrievalSearchedSet].every((id) => adaExplainedSet.has(id)),
                `Ada in Northwind searched space sets must match exactly: query=${[...adaExplainedSet].sort().join(',')} retrieval=${[...adaRetrievalSearchedSet].sort().join(',')}`,
            );
            for (const item of adaRetrieval.quotedItems) {
                Assert(adaExplainedSet.has(item.SpaceID.toLowerCase()), `Ada quoted item ${item.Name} space ${item.SpaceID} must be in expansion query scope`);
            }
        },
    },
    {
        Id: 'agent.AG2',
        Name: 'AG2 — Client asks in Discovery: retrieves only Discovery Shared material, never Team',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');

            const retrieval = await resolveSpaceAgentRetrieval(ctx.Provider, bea, DISCOVERY_SPACE_ID);

            Assert(retrieval.spaceId.toLowerCase() === DISCOVERY_SPACE_ID.toLowerCase(), 'Retrieval scoped to Discovery');
            Assert(retrieval.callerCanSeeTeam === false, 'Client Bea cannot see Team band');

            // Discovery has:
            // - site-photo.png (Shared, uploader bea)
            // - discovery-brief.pdf (Team, uploader ada)
            const quotedNames = retrieval.quotedItems.map((item) => item.Name);
            Assert(quotedNames.includes('site-photo.png'), 'Shared site-photo.png is quoted');
            Assert(!quotedNames.includes('discovery-brief.pdf'), 'Team discovery-brief.pdf is NEVER quoted for client Bea');

            // Verify decisions array explains each outcome
            const photoDecision = retrieval.decisions.find((d) => d.item.Name === 'site-photo.png');
            Assert(photoDecision?.allowed === true, 'site-photo.png decision is allowed');
            const briefDecision = retrieval.decisions.find((d) => d.item.Name === 'discovery-brief.pdf');
            Assert(briefDecision === undefined || briefDecision.allowed === false, 'discovery-brief.pdf decision is refused or omitted');
        },
    },
    {
        Id: 'agent.AG3',
        Name: 'AG3 — Asked from child space stays inside child space (no parent or sibling leak)',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');

            const retrieval = await resolveSpaceAgentRetrieval(ctx.Provider, bea, DISCOVERY_SPACE_ID);
            const quotedItems = retrieval.quotedItems;

            Assert(quotedItems.some((item) => item.Name === 'site-photo.png'), 'Must quote site-photo.png inside child space');

            // Every quoted item must have SpaceID == DISCOVERY_SPACE_ID or sub-spaces
            for (const item of quotedItems) {
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
        Name: 'AG4 — Staff owner asks in Discovery: can quote Team items',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');

            const retrieval = await resolveSpaceAgentRetrieval(ctx.Provider, ada, DISCOVERY_SPACE_ID);
            Assert(retrieval.callerCanSeeTeam === true, 'Staff owner Ada can see Team band');

            const quotedNames = retrieval.quotedItems.map((item) => item.Name);
            Assert(quotedNames.includes('site-photo.png'), 'Ada quotes Shared site-photo.png');
            Assert(quotedNames.includes('discovery-brief.pdf'), 'Ada quotes Team discovery-brief.pdf in Discovery');
        },
    },
    {
        Id: 'agent.AG5',
        Name: 'AG5 — Parent-to-child retrieval honors ExcludedFromParentScope and ExcludedEntirely',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');

            // Asked from root space Northwind:
            // Delivery has AgentRetrieval: 'ExcludedFromParentScope'
            // Closed last year has AgentRetrieval: 'ExcludedEntirely'
            const retrieval = await resolveSpaceAgentRetrieval(ctx.Provider, ada, NORTHWIND_SPACE_ID);

            Assert(retrieval.quotedItems.some((item) => item.Name === 'site-photo.png'), 'Must quote site-photo.png in reachable subtree');

            for (const item of retrieval.quotedItems) {
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
        Name: 'AG6 — Server room agent execution via postSpaceMessage saves assistant detail with quotes',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            const startRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-ag6-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.ok === true && !!startRes.conversationId && !!startRes.spaceChatId, `Ada starts General conversation for AG6: ${startRes.message ?? ''}`);
            const convId = startRes.conversationId!;
            const chatId = startRes.spaceChatId!;

            try {
                const postRes = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: convId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} what shared materials are available in Discovery?`,
                });

                Assert(postRes.ok === true, 'postSpaceMessage succeeds');
                if (!postRes.ok) throw new Error(postRes.message);
                Assert(!!postRes.detailId, 'Human conversation detail was created');
                createdDetailIds.push(postRes.detailId);

                const result = await executeSpaceChatTurn(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: convId,
                    userMessageId: postRes.detailId,
                });

                Assert(result.ok === true, 'executeSpaceChatTurn succeeds');
                if (!result.ok) throw new Error(result.message);
                const assistantDetailId = result.replyDetailIds?.[0];
                Assert(!!assistantDetailId, 'Assistant conversation detail was created');
                if (assistantDetailId) createdDetailIds.push(assistantDetailId);

                Assert(result.quotedCount !== undefined && result.quotedCount > 0, 'Agent quoted at least 1 shared item');

                // Verify the assistant detail in the database
                const details = await FindRows<{ ID: string; Role: string; Message: string; HiddenToUser: boolean; AgentID?: string }>(
                    ctx,
                    CONVERSATION_DETAIL_ENTITY,
                    `ID = '${assistantDetailId}'`,
                    ['ID', 'Role', 'Message', 'HiddenToUser', 'AgentID'],
                );

                Assert(details.length === 1, 'Assistant conversation detail found');
                Assert(details[0].Role === 'AI', 'Detail Role is AI');
                Assert(details[0].HiddenToUser === false, 'Detail is visible to user');
                Assert(details[0].AgentID?.toLowerCase() === COLLABORATION_TEST_AGENT_ID.toLowerCase(), 'Assistant detail names the test agent');
                Assert(details[0].Message.includes('site-photo.png'), 'Assistant response quotes site-photo.png');
                Assert(!details[0].Message.includes('discovery-brief.pdf'), 'Assistant response never mentions discovery-brief.pdf');
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, convId, chatId);
            }
        },
    },
    {
        Id: 'agent.AG7',
        Name: 'AG7 — Agent turns bound by conversation kind: General excludes Team items, Private includes discovery-brief.pdf',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            const genStart = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-ag7-gen-${Date.now()}`,
                Kind: 'General',
            });
            Assert(genStart.ok === true && !!genStart.conversationId && !!genStart.spaceChatId, `Ada starts General conversation for AG7: ${genStart.message ?? ''}`);
            const genConvId = genStart.conversationId!;
            const genChatId = genStart.spaceChatId!;

            const privStart = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-ag7-priv-${Date.now()}`,
                Kind: 'Private',
            });
            Assert(privStart.ok === true && !!privStart.conversationId && !!privStart.spaceChatId, `Ada starts Private conversation for AG7: ${privStart.message ?? ''}`);
            const privConvId = privStart.conversationId!;
            const privChatId = privStart.spaceChatId!;

            try {
                // 1. Ada posts in General conversation tagging agent
                const adaGenMsg = await postSpaceMessage(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: genConvId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} summarize available documents`,
                });
                if (!adaGenMsg.ok) {
                    throw new Error(`Ada posted tagged message in General failed: ${adaGenMsg.message}`);
                }
                Assert(adaGenMsg.ok === true && !!adaGenMsg.detailId, 'Ada posted tagged message in General');
                createdDetailIds.push(adaGenMsg.detailId);

                const genTurnRes = await executeSpaceChatTurn(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: genConvId,
                    userMessageId: adaGenMsg.detailId,
                    agentId: COLLABORATION_TEST_AGENT_ID,
                });
                if (!genTurnRes.ok) {
                    throw new Error(`Agent turn in General failed: ${genTurnRes.message}`);
                }
                Assert(genTurnRes.ok === true, 'Agent turn in General succeeded');
                createdDetailIds.push(...genTurnRes.replyDetailIds);
                Assert(genTurnRes.allowedItemNames !== undefined, 'General turn returned allowedItemNames');
                Assert(genTurnRes.allowedItemNames!.includes('site-photo.png'), 'General turn MUST allow Shared file site-photo.png');
                Assert(!genTurnRes.allowedItemNames!.includes('discovery-brief.pdf'), 'General turn must NOT allow Team file discovery-brief.pdf');

                // ExplainScope dry-run: assert that the search lane filter for General conversation is strictly bounded to Band IN ('Shared')
                if (!isClientTransport(ctx)) {
                    await SearchEngine.Instance.Config({}, ada);
                    const genScopeExp = await SearchEngine.Instance.ExplainScope(
                        {
                            ScopeIDs: [SEARCH_SCOPE_ID],
                            SearchContext: {
                                PrimaryScopeRecordID: genChatId,
                            },
                            AIAgentID: AGENT_ID,
                        },
                        ada,
                    );
                    Assert(genScopeExp.length === 1, 'General scope explanation returned');
                    const itemsLane = genScopeExp[0].Lanes.find((l) => l.Target.includes('Space Items'));
                    Assert(!!itemsLane && itemsLane.Status === 'Active', 'Space Items lane is Active in General chat');
                    Assert(
                        !!itemsLane?.RenderedFilter && itemsLane.RenderedFilter.includes("Band IN ('Shared')"),
                        `General chat search lane filter MUST restrict to Band IN ('Shared') (got: ${itemsLane?.RenderedFilter})`
                    );
                }

                // Bea (client with Shared-only visibility) can view the General conversation assistant reply
                const beaView = RunView.FromMetadataProvider(ctx.Provider);
                const beaReplies = await beaView.RunView<{ ID: string; Role: string; Message: string }>({
                    EntityName: CONVERSATION_DETAIL_ENTITY,
                    ExtraFilter: `ConversationID = '${genConvId}' AND Role = 'AI'`,
                    Fields: ['ID', 'Role', 'Message'],
                    ResultType: 'simple',
                }, bea);
                Assert(beaReplies.Success === true && (beaReplies.Results?.length ?? 0) >= 1, 'Bea can read assistant reply in General conversation');
                const beaSeenReply = beaReplies.Results![0].Message;
                Assert(beaSeenReply.includes('site-photo.png'), 'Bea reads assistant reply quoting site-photo.png');
                Assert(!beaSeenReply.includes('discovery-brief.pdf'), 'Bea never sees discovery-brief.pdf in General reply');

                // 2. Ada posts in Private conversation tagging agent
                const adaPrivMsg = await postSpaceMessage(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: privConvId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} summarize available documents`,
                });
                if (!adaPrivMsg.ok) {
                    throw new Error(`Ada posted tagged message in Private failed: ${adaPrivMsg.message}`);
                }
                Assert(adaPrivMsg.ok === true && !!adaPrivMsg.detailId, 'Ada posted tagged message in Private');
                createdDetailIds.push(adaPrivMsg.detailId);

                const privTurnRes = await executeSpaceChatTurn(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: privConvId,
                    userMessageId: adaPrivMsg.detailId,
                    agentId: COLLABORATION_TEST_AGENT_ID,
                });
                if (!privTurnRes.ok) {
                    throw new Error(`Agent turn in Private failed: ${privTurnRes.message}`);
                }
                Assert(privTurnRes.ok === true, 'Agent turn in Private succeeded');
                createdDetailIds.push(...privTurnRes.replyDetailIds);
                Assert(privTurnRes.allowedItemNames !== undefined, 'Private turn returned allowedItemNames');
                Assert(privTurnRes.allowedItemNames!.includes('site-photo.png'), 'Private turn MUST allow Shared file site-photo.png');
                Assert(privTurnRes.allowedItemNames!.includes('discovery-brief.pdf'), 'Private turn MUST allow Team file discovery-brief.pdf');

                // ExplainScope dry-run: assert that Private conversation includes both Shared and Team
                if (!isClientTransport(ctx)) {
                    const privScopeExp = await SearchEngine.Instance.ExplainScope(
                        {
                            ScopeIDs: [SEARCH_SCOPE_ID],
                            SearchContext: {
                                PrimaryScopeRecordID: privChatId,
                            },
                            AIAgentID: AGENT_ID,
                        },
                        ada,
                    );
                    Assert(privScopeExp.length === 1, 'Private scope explanation returned');
                    const privItemsLane = privScopeExp[0].Lanes.find((l) => l.Target.includes('Space Items'));
                    Assert(!!privItemsLane && privItemsLane.Status === 'Active', 'Space Items lane is Active in Private chat');
                    Assert(
                        !!privItemsLane?.RenderedFilter &&
                            privItemsLane.RenderedFilter.includes('Shared') &&
                            privItemsLane.RenderedFilter.includes('Team'),
                        `Private chat search lane filter allows both Shared and Team (got: ${privItemsLane?.RenderedFilter})`
                    );
                }

                // 3. Test Item 6: Untagged message with AgentID under MentionOnly is refused turn
                const untaggedMsg = await postSpaceMessage(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: genConvId,
                    text: 'Untagged message asking for turn',
                });
                if (!untaggedMsg.ok) {
                    throw new Error(`Ada posted untagged message failed: ${untaggedMsg.message}`);
                }
                Assert(untaggedMsg.ok === true && !!untaggedMsg.detailId, 'Ada posted untagged message');
                createdDetailIds.push(untaggedMsg.detailId);

                const untaggedTurnRes = await executeSpaceChatTurn(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: genConvId,
                    userMessageId: untaggedMsg.detailId,
                    agentId: COLLABORATION_TEST_AGENT_ID,
                });
                Assert(!untaggedTurnRes.ok, 'Untagged message with AgentID under MentionOnly must be refused a turn');
                if (untaggedTurnRes.ok) throw new Error('Expected untagged turn to fail');
                Assert(untaggedTurnRes.message === 'The message does not mention an agent.', `Untagged refusal matches: ${untaggedTurnRes.message}`);

                // 4. Test Item 5 & 22: Second turn on same userMessageId is refused
                const secondTurnRes = await executeSpaceChatTurn(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: genConvId,
                    userMessageId: adaGenMsg.detailId,
                    agentId: COLLABORATION_TEST_AGENT_ID,
                });
                Assert(!secondTurnRes.ok, 'Second turn on already-processed userMessageId must be refused');
                if (secondTurnRes.ok) throw new Error('Expected second turn to fail');
                Assert(secondTurnRes.message === 'This message has already been processed by an agent turn.', `Second turn refusal matches: ${secondTurnRes.message}`);
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, genConvId, genChatId);
                await cleanupConversation(ctx.Provider, ctx.User, privConvId, privChatId);
            }
        },
    },
    {
        Id: 'agent.AG8',
        Name: "AG8 — A conversation's kind bounds the search itself: its lane filter, run on the real tables, returns Shared for General and Shared plus Team for Private",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            if (isClientTransport(ctx)) return; // ExplainScope has no GraphQL endpoint in MJ 6.1.3; the server harness covers it
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            // A space item points at a record: the two files the world seeds in Discovery, one Shared and one Team.
            const files = await FindRows<{ ID: string; Name: string }>(
                ctx,
                FILE_ENTITY,
                `Name IN ('site-photo.png', 'discovery-brief.pdf')`,
                ['ID', 'Name'],
            );
            const photoFileId = files.find((f) => f.Name === 'site-photo.png')?.ID;
            const briefFileId = files.find((f) => f.Name === 'discovery-brief.pdf')?.ID;
            Assert(!!photoFileId && !!briefFileId, 'The world seeds site-photo.png and discovery-brief.pdf');
            const reaches = (rows: readonly { RecordID: string }[], fileId: string | undefined): boolean =>
                !!fileId && rows.some((r) => r.RecordID.toLowerCase().endsWith(fileId.toLowerCase()));

            // The negative control: Discovery holds a Shared item and a Team item, so a missing item below is the filter's doing
            const discoveryItems = await FindRows<{ RecordID: string; Band: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['RecordID', 'Band'],
            );
            Assert(
                reaches(discoveryItems.filter((i) => i.Band === 'Shared'), photoFileId) &&
                    reaches(discoveryItems.filter((i) => i.Band === 'Team'), briefFileId),
                'Discovery holds a Shared item (site-photo.png) and a Team item (discovery-brief.pdf), so the filters below have something to exclude',
            );

            const general = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-ag8-gen-${Date.now()}`,
                Kind: 'General',
            });
            Assert(general.ok === true && !!general.conversationId && !!general.spaceChatId, `Ada starts General conversation for AG8: ${general.message ?? ''}`);
            const generalConvId = general.conversationId!;
            const generalChatId = general.spaceChatId!;
            let privateConvId: string | undefined;
            let privateChatId: string | undefined;

            try {
                const priv = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-ag8-priv-${Date.now()}`,
                    Kind: 'Private',
                });
                Assert(priv.ok === true && !!priv.conversationId && !!priv.spaceChatId, `Ada starts Private conversation for AG8: ${priv.message ?? ''}`);
                privateConvId = priv.conversationId;
                privateChatId = priv.spaceChatId;

                await SearchEngine.Instance.Config({}, ada);
                const laneFilters = async (chatId: string, asUser: UserInfo = ada): Promise<{ items: string; tasks: string }> => {
                    const explained = await SearchEngine.Instance.ExplainScope(
                        {
                            ScopeIDs: [SEARCH_SCOPE_ID],
                            SearchContext: { PrimaryScopeRecordID: chatId },
                            AIAgentID: AGENT_ID,
                        },
                        asUser,
                    );
                    Assert(explained.length === 1, 'One scope explanation');
                    Assert(explained[0].Entitlement?.Allowed === true, `${asUser.Name} may search this scope (saw ${JSON.stringify(explained[0].Entitlement)})`);
                    const items = explained[0].Lanes.find((l) => l.Target.includes('Space Items'));
                    const tasks = explained[0].Lanes.find((l) => l.Target.includes('Tasks'));
                    Assert(!!items?.RenderedFilter && items.Status === 'Active', `Space Items lane is Active with a rendered filter (saw ${items?.Status})`);
                    Assert(!!tasks?.RenderedFilter && tasks.Status === 'Active', `Tasks lane is Active with a rendered filter (saw ${tasks?.Status})`);
                    return { items: items!.RenderedFilter!, tasks: tasks!.RenderedFilter! };
                };
                // What the Space Items lane reaches: its own filter, run on the real table by the system user,
                // so the filter is the only thing between a row and the result.
                const laneRows = (filter: string) =>
                    FindRows<{ RecordID: string; Band: string; SpaceID: string }>(ctx, SPACE_ITEM_ENTITY, filter, ['RecordID', 'Band', 'SpaceID']);

                // The Tasks lane, on the real Tasks table: the world files a Shared and a Team root task in Discovery
                const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
                Assert(!!taskEntity, 'Task entity found');
                const taskItems = await FindRows<{ RecordID: string; Band: string }>(
                    ctx,
                    SPACE_ITEM_ENTITY,
                    `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${taskEntity?.ID}'`,
                    ['RecordID', 'Band'],
                );
                const rootId = (recordId: string): string => (recordId.toLowerCase().startsWith('id|') ? recordId.slice(3) : recordId).toLowerCase();
                const sharedRoots = new Set(taskItems.filter((t) => t.Band === 'Shared').map((t) => rootId(t.RecordID)));
                const teamRoots = new Set(taskItems.filter((t) => t.Band === 'Team').map((t) => rootId(t.RecordID)));
                Assert(sharedRoots.size > 0 && teamRoots.size > 0, 'Discovery holds a Shared and a Team root task, so the Tasks lane has something to exclude');
                const laneTasks = (filter: string) => FindRows<{ ID: string; RootParentID: string | null }>(ctx, TASK_ENTITY, filter, ['ID', 'RootParentID']);
                const rootOf = (t: { ID: string; RootParentID: string | null }): string => (t.RootParentID ?? t.ID).toLowerCase();

                const generalLanes = await laneFilters(generalChatId);
                const generalTasks = await laneTasks(generalLanes.tasks);
                Assert(generalTasks.length > 0 && generalTasks.every((t) => sharedRoots.has(rootOf(t))), 'General Tasks lane reaches only tasks under a Shared root');
                Assert(!generalTasks.some((t) => teamRoots.has(rootOf(t))), 'General Tasks lane never reaches a task under a Team root');

                // Bea, a client, gets the same General lane, and MemberJunction lets her search: the agent, its scope
                // assignment and the scope's permission rows are the three things it reads as her
                const beaGeneralLanes = await laneFilters(generalChatId, bea);
                Assert(beaGeneralLanes.items === generalLanes.items && beaGeneralLanes.tasks === generalLanes.tasks, "Bea's General lanes are Ada's General lanes");
                const generalRows = await laneRows(generalLanes.items);
                Assert(generalRows.length > 0, 'General lane reaches at least one item');
                Assert(reaches(generalRows, photoFileId), 'General lane reaches the Shared site-photo.png');
                Assert(!reaches(generalRows, briefFileId), 'General lane never reaches the Team discovery-brief.pdf');
                Assert(generalRows.every((r) => r.Band === 'Shared'), `General lane reaches only the Shared band (saw ${[...new Set(generalRows.map((r) => r.Band))].join(',')})`);
                Assert(
                    generalRows.every((r) => EXPECTED_BEA_DISCOVERY_SPACES.has(r.SpaceID.toLowerCase())),
                    'General lane stays inside Discovery and its child',
                );
                Assert(generalLanes.tasks.includes("Band IN ('Shared')") && !generalLanes.tasks.includes("'Team'"), `General Tasks lane is bounded to the Shared band (got: ${generalLanes.tasks})`);

                const privateLanes = await laneFilters(privateChatId!);
                const privateRows = await laneRows(privateLanes.items);
                Assert(reaches(privateRows, photoFileId), 'Private lane reaches the Shared site-photo.png');
                Assert(reaches(privateRows, briefFileId), 'Private lane reaches the Team discovery-brief.pdf');
                Assert(privateRows.every((r) => r.Band === 'Shared' || r.Band === 'Team'), 'Private lane reaches Shared and Team, and no other band');
                const privateTasks = await laneTasks(privateLanes.tasks);
                Assert(privateTasks.some((t) => sharedRoots.has(rootOf(t))) && privateTasks.some((t) => teamRoots.has(rootOf(t))), 'Private Tasks lane reaches tasks under a Shared root and under a Team root');
                Assert(privateTasks.every((t) => sharedRoots.has(rootOf(t)) || teamRoots.has(rootOf(t))), 'Private Tasks lane stays inside the Discovery roots');
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, generalConvId, generalChatId);
                if (privateConvId) await cleanupConversation(ctx.Provider, ctx.User, privateConvId, privateChatId);
            }
        },
    },
    {
        Id: 'agent.AG9',
        Name: "AG9 — A client's agent reads stay narrow: no other user's permission row, no agent outside the spaces they reach",
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            if (isClientTransport(ctx)) return;
            const bea = await GetPersonaUser(ctx, 'bea');
            const view = View(ctx);
            const beaRoleIds = new Set(bea.UserRoles.map((r) => r.RoleID.toLowerCase()));
            Assert(beaRoleIds.size > 0, 'Bea holds a role');

            // Scope permission rows: only ones that name Bea or a role she holds
            const scopePerms = await view.RunView<{ ID: string; UserID: string | null; RoleID: string | null }>(
                { EntityName: SEARCH_SCOPE_PERMISSION_ENTITY, Fields: ['ID', 'UserID', 'RoleID'], ResultType: 'simple' },
                bea,
            );
            Assert(scopePerms.Success === true, `Bea reads Search Scope Permissions: ${scopePerms.ErrorMessage ?? ''}`);
            const permRows = scopePerms.Results ?? [];
            Assert(permRows.length > 0, 'Bea reads at least the permission row her own role holds');
            Assert(
                permRows.every((r) => (r.UserID && SameID(r.UserID, bea.ID)) || (r.RoleID && beaRoleIds.has(r.RoleID.toLowerCase()))),
                'Every Search Scope Permissions row Bea reads names her or a role she holds',
            );
            const allPerms = await FindRows<{ ID: string }>(ctx, SEARCH_SCOPE_PERMISSION_ENTITY, '1=1', ['ID']);
            Assert(allPerms.length > permRows.length, 'The scope has permission rows for other roles that Bea does not read');

            // Agent permission rows: no grant at all
            const agentPerms = await view.RunView<{ ID: string }>(
                { EntityName: AI_AGENT_PERMISSION_ENTITY, Fields: ['ID'], ResultType: 'simple' },
                bea,
            );
            Assert(!agentPerms.Success || (agentPerms.Results?.length ?? 0) === 0, 'Bea reads no AI Agent Permissions row');

            // Agents: the shipped agent, and none that no reached space runs. The test agent is attached to Northwind, which Bea does not
            // reach, but it is an ancestor of Discovery, which she does, so she may run it; a second row proves the negative.
            const agents = await view.RunView<{ ID: string }>(
                { EntityName: AI_AGENT_ENTITY, Fields: ['ID'], ResultType: 'simple' },
                bea,
            );
            Assert(agents.Success === true, `Bea reads AI Agents: ${agents.ErrorMessage ?? ''}`);
            const agentIds = (agents.Results ?? []).map((a) => a.ID.toLowerCase());
            Assert(agentIds.includes(AGENT_ID.toLowerCase()), 'Bea reads the shipped space agent');
            const everyAgent = await FindRows<{ ID: string }>(ctx, AI_AGENT_ENTITY, '1=1', ['ID']);
            Assert(everyAgent.length > agentIds.length, `The host has agents Bea does not read (host ${everyAgent.length}, Bea ${agentIds.length})`);
        },
    },
    {
        Id: 'agent.AG10',
        Name: 'AG10 — No Space Participant grant still uses the retired "Collaboration: Agent Catalog" filter',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const filters = await FindRows<{ ID: string }>(ctx, ROW_LEVEL_SECURITY_FILTER_ENTITY, `Name = 'Collaboration: Agent Catalog'`, ['ID']);
            Assert(
                filters.length === 0,
                'The retired "Collaboration: Agent Catalog" row filter (1 = 1) is still in this database. It lets a client read every agent and scope permission. Clean it up as docs/reviewing-the-data.md says.',
            );
            const grants = await FindRows<{ ID: string }>(
                ctx,
                ENTITY_PERMISSION_ENTITY,
                `ReadRLSFilterID IN (SELECT ID FROM [${ctx.Schema}].[vwRowLevelSecurityFilters] WHERE Name = 'Collaboration: Agent Catalog')`,
                ['ID'],
            );
            Assert(grants.length === 0, `${grants.length} entity permission(s) still use the retired "Collaboration: Agent Catalog" filter. Clean them up as docs/reviewing-the-data.md says.`);
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('agent', {
    // The turn checks run on the harness's own test agent, attached to the Northwind root for the bundle; its children inherit it.
    Setup: async (ctx: IntegrationCheckContext) => {
        testAgentAttachmentId = await attachTestAgent(ctx, NORTHWIND_SPACE_ID);
    },
    Teardown: async (ctx: IntegrationCheckContext) => {
        if (testAgentAttachmentId) {
            const attachmentId = testAgentAttachmentId;
            testAgentAttachmentId = null;
            await detachTestAgent(ctx, attachmentId);
        }
        while (createdDetailIds.length > 0) {
            const id = createdDetailIds.pop();
            if (id) {
                const detail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, ctx.User);
                if (await detail.Load(id)) {
                    const deleted = await detail.Delete();
                    if (!deleted) {
                        const err = detail.LatestResult?.CompleteMessage ?? 'Delete returned false';
                        console.error(`agent Teardown failed to delete detail ${id}: ${err}`);
                        throw new Error(`agent Teardown failed to delete detail ${id}: ${err}`);
                    }
                }
            }
        }
    },
});
