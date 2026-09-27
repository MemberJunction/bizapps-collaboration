import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IMetadataProvider } from '@memberjunction/core';
import {
    resolveAllowedAgents,
    COLLABORATION_DEFAULT_AGENT_ID,
} from '../dist/resolve-allowed-agents.js';
import {
    resolveSpaceKnowledgeSources,
    resolveSpaceAgentSkills,
} from '../dist/resolve-space-agent-context.js';

describe('Resolve Allowed Agents, Knowledge Sources, and Skills down Space Hierarchy', () => {
    const APP_AGENT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
    const TYPE_AGENT_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
    const CHILD_AGENT_ID = 'cccccccc-3333-4333-8333-333333333333';
    const SKILL_ID_1 = 'dddddddd-4444-4444-8444-444444444444';
    const SKILL_ID_2 = 'eeeeeeee-5555-4555-8555-555555555555';
    const SOURCE_ID_1 = 'ffffffff-6666-4666-8666-666666666666';
    const SOURCE_ID_2 = '00000000-7777-4777-8777-777777777777';

    const TYPE_ID = '10000000-0000-4000-8000-000000000000';
    const ROOT_SPACE_ID = '20000000-0000-4000-8000-000000000000';
    const CHILD_SPACE_ID = '30000000-0000-4000-8000-000000000000';

    interface MockWorldOptions {
        typeConfig?: string | null;
        spaceConfig?: string | null;
        agentRows?: Array<{ AgentID: string; SpaceTypeID?: string | null; SpaceID?: string | null; IsDefault?: boolean }>;
        knowledgeRows?: Array<{ ContentSourceID: string; SpaceTypeID?: string | null; SpaceID?: string | null }>;
        skillRows?: Array<{ SkillID: string; SpaceTypeID?: string | null; SpaceID?: string | null }>;
    }

    function createMockProvider(options: MockWorldOptions): IMetadataProvider {
        const {
            typeConfig = null,
            spaceConfig = null,
            agentRows = [],
            knowledgeRows = [],
            skillRows = [],
        } = options;

        const provider: Record<string, unknown> = {
            async RunView(params: { EntityName: string; ExtraFilter?: string }) {
                const { EntityName, ExtraFilter = '' } = params;

                if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    if (ExtraFilter.includes(CHILD_SPACE_ID)) {
                        return {
                            Success: true,
                            Results: [
                                {
                                    ID: CHILD_SPACE_ID,
                                    ParentID: ROOT_SPACE_ID,
                                    SpaceTypeID: TYPE_ID,
                                    Configuration: spaceConfig,
                                },
                            ],
                        };
                    }
                    if (ExtraFilter.includes(ROOT_SPACE_ID)) {
                        return {
                            Success: true,
                            Results: [
                                {
                                    ID: ROOT_SPACE_ID,
                                    ParentID: null,
                                    SpaceTypeID: TYPE_ID,
                                    Configuration: null,
                                },
                            ],
                        };
                    }
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                    return {
                        Success: true,
                        Results: [
                            {
                                ID: TYPE_ID,
                                Configuration: typeConfig,
                            },
                        ],
                    };
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Agents') {
                    return {
                        Success: true,
                        Results: agentRows,
                    };
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Knowledge Sources') {
                    return {
                        Success: true,
                        Results: knowledgeRows,
                    };
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Agent Skills') {
                    return {
                        Success: true,
                        Results: skillRows,
                    };
                }

                return { Success: true, Results: [] };
            },
            async RunViews(paramsList: Array<{ EntityName: string; ExtraFilter?: string }>) {
                const results = [];
                for (const p of paramsList) {
                    results.push(await (this as { RunView: (params: { EntityName: string; ExtraFilter?: string }) => Promise<unknown> }).RunView(p));
                }
                return results;
            },
        };

        return provider as unknown as IMetadataProvider;
    }

    it('returns built-in default agent when no SpaceAgent rows exist', async () => {
        const provider = createMockProvider({});
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [COLLABORATION_DEFAULT_AGENT_ID]);
        assert.equal(result.defaultAgentId, COLLABORATION_DEFAULT_AGENT_ID);
        assert.equal(result.agents[0].source, 'App');
    });

    it('app-wide SpaceAgent row is resolved when present', async () => {
        const provider = createMockProvider({
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true },
            ],
        });
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [APP_AGENT_ID]);
        assert.equal(result.defaultAgentId, APP_AGENT_ID);
        assert.equal(result.agents[0].source, 'App');
    });

    it('extends app agent with type agent when type ListMode is Extend', async () => {
        const provider = createMockProvider({
            typeConfig: JSON.stringify({ Agents: { ListMode: 'Extend' } }),
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { AgentID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: true },
            ],
        });
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [APP_AGENT_ID, TYPE_AGENT_ID]);
        assert.equal(result.defaultAgentId, TYPE_AGENT_ID);
    });

    it('replaces app agent with type agent when type ListMode is Replace', async () => {
        const provider = createMockProvider({
            typeConfig: JSON.stringify({ Agents: { ListMode: 'Replace' } }),
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { AgentID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: true },
            ],
        });
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [TYPE_AGENT_ID]);
        assert.equal(result.defaultAgentId, TYPE_AGENT_ID);
    });

    it('replaces with space agent when space ListMode is Replace (via SpaceOverridable)', async () => {
        const provider = createMockProvider({
            typeConfig: JSON.stringify({
                SpaceOverridable: ['Agents.ListMode'],
                Agents: { ListMode: 'Extend' },
            }),
            spaceConfig: JSON.stringify({
                Agents: { ListMode: 'Replace' },
            }),
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { AgentID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: false },
                { AgentID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, IsDefault: true },
            ],
        });
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [CHILD_AGENT_ID]);
        assert.equal(result.defaultAgentId, CHILD_AGENT_ID);
        assert.equal(result.agents[0].source, 'Space');
    });

    it('resolves bound knowledge sources across type and space hierarchy', async () => {
        const provider = createMockProvider({
            knowledgeRows: [
                { ContentSourceID: SOURCE_ID_1, SpaceTypeID: TYPE_ID, SpaceID: null },
                { ContentSourceID: SOURCE_ID_2, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID },
            ],
        });
        const sources = await resolveSpaceKnowledgeSources(provider, CHILD_SPACE_ID);

        assert.equal(sources.length, 2);
        assert.ok(sources.includes(SOURCE_ID_1.toUpperCase()));
        assert.ok(sources.includes(SOURCE_ID_2.toUpperCase()));
    });

    it('resolves bound AI skills across type and space hierarchy', async () => {
        const provider = createMockProvider({
            skillRows: [
                { SkillID: SKILL_ID_1, SpaceTypeID: TYPE_ID, SpaceID: null },
                { SkillID: SKILL_ID_2, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID },
            ],
        });
        const skills = await resolveSpaceAgentSkills(provider, CHILD_SPACE_ID);

        assert.equal(skills.length, 2);
        assert.ok(skills.includes(SKILL_ID_1.toUpperCase()));
        assert.ok(skills.includes(SKILL_ID_2.toUpperCase()));
    });
});
