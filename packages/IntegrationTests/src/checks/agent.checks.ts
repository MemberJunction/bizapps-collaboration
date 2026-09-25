import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { SearchEngine } from '@memberjunction/search-engine';
import { resolveSpaceAgentRetrieval, postSpaceMessage } from '@mj-biz-apps/collaboration-core-entities-server';
import type { MJConversationDetailEntity } from '@memberjunction/core-entities';
import {
    AI_AGENT_ENTITY,
    AI_AGENT_PERMISSION_ENTITY,
    AI_AGENT_PROMPT_ENTITY,
    AI_AGENT_SEARCH_SCOPE_ENTITY,
    AI_AGENT_SKILL_ENTITY,
    AI_SKILL_ENTITY,
    CONVERSATION_DETAIL_ENTITY,
    SEARCH_SCOPE_ENTITY,
    SEARCH_SCOPE_ENTITY_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser, isClientTransport } from '../wire.js';

const AGENT_ID = '9E6D761A-197A-40AF-995B-3D3DD9BD7B9E';
const SEARCH_SCOPE_ID = '6E5187CF-7E5B-447F-893D-D291994083C0';
const PROMPT_ID = 'F8DE6158-9A74-4C23-8B39-44F4C68B6E32';
const EXPANSION_QUERY_ID = 'FA742FD3-00D4-461F-A356-0265D72C39F4';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const DELIVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000003';
const CLOSED_PAST_SPACE_ID = 'C1000001-0000-4000-8000-000000000008';

const EXPECTED_SKILL_NAMES = ['Find & act', 'Promote', 'Summarize'];
const createdDetailIds: string[] = [];

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
            const agents = await FindRows<{ ID: string; Name: string; AcceptsSkills: string; SkillActivationMode: string; ExposeAsAction: boolean }>(
                ctx,
                AI_AGENT_ENTITY,
                `ID = '${AGENT_ID}'`,
                ['ID', 'Name', 'AcceptsSkills', 'SkillActivationMode', 'ExposeAsAction'],
            );
            Assert(agents.length === 1, 'Collaboration Space Agent exists');
            Assert(agents[0].Name === 'Collaboration Space Agent', 'Agent name matches');
            Assert(agents[0].AcceptsSkills === 'Limited', 'Agent AcceptsSkills is Limited');
            Assert(agents[0].SkillActivationMode === 'Auto', 'Agent SkillActivationMode is Auto');
            Assert(agents[0].ExposeAsAction === false, 'Agent ExposeAsAction is false (isolated from global chat area)');

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
            Assert(scopeExp.Entitlement?.Allowed === true, 'Entitlement.Allowed is true');

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
            const failureDiag = (injectionExp[0].Diagnostics ?? []).find(
                (d) => d.toLowerCase().includes('failed') || d.toLowerCase().includes('error'),
            );
            Assert(!failureDiag, `No diagnostic reports failure: ${failureDiag ?? ''}`);

            // 10. Verify parity between expansion query and resolveSpaceAgentRetrieval for Bea in Discovery (both directions)
            const retrieval = await resolveSpaceAgentRetrieval(ctx.Provider, bea, DISCOVERY_SPACE_ID);
            const explainedIds = new Set(resolvedSpaceIds);
            for (const item of retrieval.quotedItems) {
                Assert(explainedIds.has(item.SpaceID.toLowerCase()), `Item ${item.Name} space ${item.SpaceID} must be in expansion query scope`);
            }
            const quotedSpaceIds = new Set(retrieval.quotedItems.map((i) => i.SpaceID.toLowerCase()));
            for (const spaceId of explainedIds) {
                Assert(quotedSpaceIds.has(spaceId), `Space ${spaceId} from expansion query must have quoted items in retrieval`);
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

            // Northwind, Discovery, and sealed-child must be present
            Assert(adaExplainedSet.has(NORTHWIND_SPACE_ID.toLowerCase()), 'Northwind space is in Ada expansion scope');
            Assert(adaExplainedSet.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Discovery space is in Ada expansion scope');
            const SEALED_CHILD_SPACE_ID = 'C1000001-0000-4000-8000-000000000015'.toLowerCase();
            const SEALED_BRANCH_SPACE_ID = 'C1000001-0000-4000-8000-000000000014'.toLowerCase();
            Assert(adaExplainedSet.has(SEALED_CHILD_SPACE_ID), 'Sealed child space where Ada holds a seat is in expansion scope');
            Assert(!adaExplainedSet.has(SEALED_BRANCH_SPACE_ID), 'Sealed branch parent where Ada holds no seat must be excluded');

            // ExcludedFromParentScope (Delivery) and ExcludedEntirely (closed-past) must NOT be present
            Assert(!adaExplainedSet.has(DELIVERY_SPACE_ID.toLowerCase()), 'Delivery (ExcludedFromParentScope) must NOT be in Ada expansion scope');
            Assert(!adaExplainedSet.has(CLOSED_PAST_SPACE_ID.toLowerCase()), 'Closed past (ExcludedEntirely) must NOT be in Ada expansion scope');

            // Parity: resolveSpaceAgentRetrieval for Ada in Northwind
            const adaRetrieval = await resolveSpaceAgentRetrieval(ctx.Provider, ada, NORTHWIND_SPACE_ID);
            for (const item of adaRetrieval.quotedItems) {
                Assert(adaExplainedSet.has(item.SpaceID.toLowerCase()), `Ada quoted item ${item.Name} space ${item.SpaceID} must be in expansion query scope`);
            }
            const adaQuotedSpaces = new Set(adaRetrieval.quotedItems.map((i) => i.SpaceID.toLowerCase()));
            Assert(!adaQuotedSpaces.has(DELIVERY_SPACE_ID.toLowerCase()), 'Delivery items must NOT be quoted for Ada from Northwind');
            Assert(!adaQuotedSpaces.has(CLOSED_PAST_SPACE_ID.toLowerCase()), 'Closed-past items must NOT be quoted for Ada from Northwind');
            Assert(!adaQuotedSpaces.has(SEALED_BRANCH_SPACE_ID), 'Sealed branch items must NOT be quoted for Ada');
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
            const bea = await GetPersonaUser(ctx, 'bea');

            const result = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                text: 'What shared materials are available in Discovery?',
                executeAgent: true,
            });

            Assert(result.ok === true, 'postSpaceMessage with executeAgent succeeds');
            if (!result.ok) throw new Error(result.message);
            Assert(!!result.detailId, 'Human conversation detail was created');
            Assert(!!result.assistantDetailId, 'Assistant conversation detail was created');
            createdDetailIds.push(result.detailId);
            if (result.assistantDetailId) createdDetailIds.push(result.assistantDetailId);

            Assert(result.quotedCount !== undefined && result.quotedCount > 0, 'Agent quoted at least 1 shared item');

            // Verify the assistant detail in the database
            const details = await FindRows<{ ID: string; Role: string; Message: string; HiddenToUser: boolean; AgentID?: string }>(
                ctx,
                CONVERSATION_DETAIL_ENTITY,
                `ID = '${result.assistantDetailId}'`,
                ['ID', 'Role', 'Message', 'HiddenToUser', 'AgentID'],
            );

            Assert(details.length === 1, 'Assistant conversation detail found');
            Assert(details[0].Role === 'AI', 'Detail Role is AI');
            Assert(details[0].HiddenToUser === false, 'Detail is visible to user');
            Assert(details[0].AgentID?.toLowerCase() === AGENT_ID.toLowerCase(), 'Assistant detail has AgentID set');
            Assert(details[0].Message.includes('site-photo.png'), 'Assistant response quotes site-photo.png');
            Assert(!details[0].Message.includes('discovery-brief.pdf'), 'Assistant response never mentions discovery-brief.pdf');
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('agent', {
    Setup: async () => {},
    Teardown: async (ctx: IntegrationCheckContext) => {
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
