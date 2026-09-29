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
import { CollaborationEngine } from '../dist/CollaborationEngine.js';

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
        /** Agents whose Status is not Active: the agents read leaves them out. */
        inactiveAgentIds?: string[];
        knowledgeRows?: Array<{ ContentSourceID: string; SpaceTypeID?: string | null; SpaceID?: string | null }>;
        skillRows?: Array<{ SkillID: string; SpaceTypeID?: string | null; SpaceID?: string | null }>;
    }

    let currentOptions: MockWorldOptions = {};

    const mockProvider = {
        async RunView(params: { EntityName: string; ExtraFilter?: string }) {
            const { EntityName, ExtraFilter = '' } = params;
            const typeConfig = currentOptions.typeConfig ?? null;
            const spaceConfig = currentOptions.spaceConfig ?? null;
            const agentRows = currentOptions.agentRows ?? [];
            const knowledgeRows = currentOptions.knowledgeRows ?? [];
            const skillRows = currentOptions.skillRows ?? [];

            if (EntityName === 'MJ: AI Agents') {
                const wanted = [...ExtraFilter.matchAll(/'([0-9a-f-]{36})'/gi)].map((m) => m[1].toLowerCase());
                const inactive = new Set((currentOptions.inactiveAgentIds ?? []).map((id) => id.toLowerCase()));
                return { Success: true, Results: wanted.filter((id) => !inactive.has(id)).map((id) => ({ ID: id })) };
            }

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

    const provider = mockProvider as unknown as IMetadataProvider;

    it('returns built-in default agent when no SpaceAgent rows exist', async () => {
        currentOptions = {};
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [COLLABORATION_DEFAULT_AGENT_ID]);
        assert.equal(result.defaultAgentId, COLLABORATION_DEFAULT_AGENT_ID);
        assert.equal(result.agents[0].source, 'App');
    });

    it('app-wide SpaceAgent row is resolved when present', async () => {
        currentOptions = {
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true },
            ],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [APP_AGENT_ID]);
        assert.equal(result.defaultAgentId, APP_AGENT_ID);
        assert.equal(result.agents[0].source, 'App');
    });

    it('extends app agent with type agent when type ListMode is Extend', async () => {
        currentOptions = {
            typeConfig: JSON.stringify({ Agents: { ListMode: 'Extend' } }),
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { AgentID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: true },
            ],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [APP_AGENT_ID, TYPE_AGENT_ID]);
        assert.equal(result.defaultAgentId, TYPE_AGENT_ID);
    });

    it('replaces app agent with type agent when type ListMode is Replace', async () => {
        currentOptions = {
            typeConfig: JSON.stringify({ Agents: { ListMode: 'Replace' } }),
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { AgentID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: true },
            ],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [TYPE_AGENT_ID]);
        assert.equal(result.defaultAgentId, TYPE_AGENT_ID);
    });

    it('replaces with space agent when space ListMode is Replace (via SpaceOverridable)', async () => {
        currentOptions = {
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
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [CHILD_AGENT_ID]);
        assert.equal(result.defaultAgentId, CHILD_AGENT_ID);
        assert.equal(result.agents[0].source, 'Space');
    });

    it('leaves a disabled non-default agent out of the list', async () => {
        currentOptions = {
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true },
                { AgentID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: false },
            ],
            inactiveAgentIds: [TYPE_AGENT_ID],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [APP_AGENT_ID]);
        assert.equal(result.defaultAgentId, APP_AGENT_ID);
    });

    it('falls back to the next default when the configured default is disabled', async () => {
        currentOptions = {
            typeConfig: JSON.stringify({ Agents: { ListMode: 'Extend' } }),
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { AgentID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: true },
                { AgentID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, IsDefault: true },
            ],
            inactiveAgentIds: [TYPE_AGENT_ID],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.equal(result.allowedAgentIds.some((id) => id === TYPE_AGENT_ID), false, 'the disabled default is not allowed');
        assert.equal(result.defaultAgentId, CHILD_AGENT_ID, 'the next default takes over');
    });

    it("falls back to the first Active agent when the disabled default was the only one marked default", async () => {
        currentOptions = {
            agentRows: [
                { AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true },
                { AgentID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, IsDefault: false },
            ],
            inactiveAgentIds: [APP_AGENT_ID],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [CHILD_AGENT_ID]);
        assert.equal(result.defaultAgentId, CHILD_AGENT_ID);
    });

    it('uses the shipped agent as the last resort when nothing configured is Active', async () => {
        currentOptions = {
            agentRows: [{ AgentID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true }],
            inactiveAgentIds: [APP_AGENT_ID],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [COLLABORATION_DEFAULT_AGENT_ID]);
        assert.equal(result.defaultAgentId, COLLABORATION_DEFAULT_AGENT_ID);
    });

    it('resolves bound knowledge sources across type and space hierarchy', async () => {
        currentOptions = {
            knowledgeRows: [
                { ContentSourceID: SOURCE_ID_1, SpaceTypeID: TYPE_ID, SpaceID: null },
                { ContentSourceID: SOURCE_ID_2, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID },
            ],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const sources = await resolveSpaceKnowledgeSources(provider, CHILD_SPACE_ID);

        assert.equal(sources.length, 2);
        assert.ok(sources.includes(SOURCE_ID_1.toUpperCase()));
        assert.ok(sources.includes(SOURCE_ID_2.toUpperCase()));
    });

    it('resolves bound AI skills across type and space hierarchy', async () => {
        currentOptions = {
            skillRows: [
                { SkillID: SKILL_ID_1, SpaceTypeID: TYPE_ID, SpaceID: null },
                { SkillID: SKILL_ID_2, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID },
            ],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const skills = await resolveSpaceAgentSkills(provider, CHILD_SPACE_ID);

        assert.equal(skills.length, 2);
        assert.ok(skills.includes(SKILL_ID_1.toUpperCase()));
        assert.ok(skills.includes(SKILL_ID_2.toUpperCase()));
    });
});
