import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { resolveSpaceAgentRetrieval, postSpaceMessage } from '@mj-biz-apps/collaboration-core-entities-server';
import {
    AI_AGENT_ENTITY,
    AI_AGENT_SEARCH_SCOPE_ENTITY,
    AI_AGENT_SKILL_ENTITY,
    AI_SKILL_ENTITY,
    CONVERSATION_DETAIL_ENTITY,
    SEARCH_SCOPE_ENTITY,
    SEARCH_SCOPE_ENTITY_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';

const AGENT_ID = 'E5000001-0000-4000-8000-000000000001';
const SEARCH_SCOPE_ID = 'E5000003-0000-4000-8000-000000000001';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const DELIVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000003';
const CLOSED_PAST_SPACE_ID = 'C1000001-0000-4000-8000-000000000008';

const EXPECTED_SKILL_NAMES = ['Ask', 'Promote', 'Summarize', 'Find & act'];

const checks: NamedCheck[] = [
    {
        Id: 'agent.AG1',
        Name: 'AG1 — Collaboration Space Agent, skills, and Search Scope metadata contract',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            // 1. Verify Search Scope and its restricting SpaceID dimension
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
            Assert(spaceDimension.valueType === 'uuid', 'SpaceID dimension valueType: uuid');
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
                Assert(lane.ExtraFilter.includes("SpaceID = '{{SpaceID}}'"), 'ExtraFilter binds SpaceID template');
                const reqKeys = JSON.parse(lane.RequiredMetadataKeys ?? '[]');
                Assert(Array.isArray(reqKeys) && reqKeys.includes('SpaceID'), 'Lane declares SpaceID in RequiredMetadataKeys');
            }

            // 3. Verify Collaboration Space Agent
            const agents = await FindRows<{ ID: string; Name: string; AcceptsSkills: string; SkillActivationMode: string }>(
                ctx,
                AI_AGENT_ENTITY,
                `ID = '${AGENT_ID}'`,
                ['ID', 'Name', 'AcceptsSkills', 'SkillActivationMode'],
            );
            Assert(agents.length === 1, 'Collaboration Space Agent exists');
            Assert(agents[0].Name === 'Collaboration Space Agent', 'Agent name matches');
            Assert(agents[0].AcceptsSkills === 'Limited', 'Agent AcceptsSkills is Limited');
            Assert(agents[0].SkillActivationMode === 'Auto', 'Agent SkillActivationMode is Auto');

            // 4. Verify 4 assigned skills
            const assignedSkills = await FindRows<{ ID: string; SkillID: string }>(
                ctx,
                AI_AGENT_SKILL_ENTITY,
                `AgentID = '${AGENT_ID}'`,
                ['ID', 'SkillID'],
            );
            Assert(assignedSkills.length === 4, 'Agent has 4 skills assigned');

            const skillIds = assignedSkills.map((s) => `'${s.SkillID}'`).join(',');
            const skills = await FindRows<{ ID: string; Name: string; Instructions: string }>(
                ctx,
                AI_SKILL_ENTITY,
                `ID IN (${skillIds})`,
                ['ID', 'Name', 'Instructions'],
            );
            const foundSkillNames = skills.map((s) => s.Name).sort();
            const expectedSorted = [...EXPECTED_SKILL_NAMES].sort();
            Assert(JSON.stringify(foundSkillNames) === JSON.stringify(expectedSorted), 'All 4 collaboration skills assigned to agent');
            for (const skill of skills) {
                Assert(!!skill.Instructions && skill.Instructions.length > 0, `Skill ${skill.Name} has instructions`);
            }

            // 5. Verify Search Scope link
            const agentScopes = await FindRows<{ ID: string; SearchScopeID: string; Phase: string }>(
                ctx,
                AI_AGENT_SEARCH_SCOPE_ENTITY,
                `AgentID = '${AGENT_ID}'`,
                ['ID', 'SearchScopeID', 'Phase'],
            );
            Assert(agentScopes.length === 1, 'Agent is linked to 1 Search Scope');
            Assert(agentScopes[0].SearchScopeID.toLowerCase() === SEARCH_SCOPE_ID.toLowerCase(), 'Linked to Collaboration Space Scope');
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
            Assert(!!result.assistantDetailId, 'Assistant conversation detail was created');
            Assert(result.quotedCount !== undefined && result.quotedCount > 0, 'Agent quoted at least 1 shared item');

            // Verify the assistant detail in the database
            const details = await FindRows<{ ID: string; Role: string; Message: string; HiddenToUser: boolean }>(
                ctx,
                CONVERSATION_DETAIL_ENTITY,
                `ID = '${result.assistantDetailId}'`,
                ['ID', 'Role', 'Message', 'HiddenToUser'],
            );

            Assert(details.length === 1, 'Assistant conversation detail found');
            Assert(details[0].Role === 'AI', 'Detail Role is AI');
            Assert(details[0].HiddenToUser === false, 'Detail is visible to user');
            Assert(details[0].Message.includes('site-photo.png'), 'Assistant response quotes site-photo.png');
            Assert(!details[0].Message.includes('discovery-brief.pdf'), 'Assistant response never mentions discovery-brief.pdf');
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('agent', {
    Setup: async () => {},
    Teardown: async () => {},
});

