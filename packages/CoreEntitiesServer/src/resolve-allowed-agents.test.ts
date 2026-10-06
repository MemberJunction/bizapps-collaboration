import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { IMetadataProvider } from '@memberjunction/core';
import { readFileSync } from 'node:fs';
import { resolveAllowedAgents } from '../dist/resolve-allowed-agents.js';
import {
    resolveSpaceKnowledgeSources,
    resolveSpaceAgentSkills,
} from '../dist/resolve-space-agent-context.js';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { seedAppSettings } from './app-settings.test-support.ts';

/** The shipped agent, read from the metadata that ships it: the resolver finds it by this name (item 42). */
const SHIPPED = (JSON.parse(readFileSync(new URL('../../../metadata/agents/.collaboration-agent.json', import.meta.url), 'utf8')) as Array<{ primaryKey: { ID: string }; fields: { Name: string } }>)[0];
const COLLABORATION_DEFAULT_AGENT_ID = SHIPPED.primaryKey.ID;

describe('Resolve Allowed Agents, Knowledge Sources, and Skills down Space Hierarchy', () => {
    // The one resolver starts from the app's row, as every configuration does
    let restoreAppSettings: () => void;
    before(() => { restoreAppSettings = seedAppSettings(); });
    after(() => restoreAppSettings());

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
        /** Agent grants (stage 1: `Space Grants` with Kind 'Agent'; the agent is `TargetRecordID`). */
        agentRows?: Array<{ TargetRecordID: string; SpaceTypeID?: string | null; SpaceID?: string | null; IsDefault?: boolean; Settings?: string | null }>;
        /** Agents whose Status is not Active: the agents read leaves them out. */
        inactiveAgentIds?: string[];
        /** KnowledgeSource grants: the content source is `TargetRecordID`. */
        knowledgeRows?: Array<{ TargetRecordID: string; SpaceTypeID?: string | null; SpaceID?: string | null }>;
    }

    let currentOptions: MockWorldOptions = {};

    const mockProvider = {
        async RunView(params: { EntityName: string; ExtraFilter?: string }) {
            const { EntityName, ExtraFilter = '' } = params;
            const typeConfig = currentOptions.typeConfig ?? null;
            const spaceConfig = currentOptions.spaceConfig ?? null;
            const agentRows = (currentOptions.agentRows ?? []).map((row, index) => ({ ID: `agent-grant-${index}`, Kind: 'Agent', Mode: 'Extend', Band: 'Shared', TargetEntityID: 'E-AGENTS', Sequence: index, Settings: null, ...row }));
            const knowledgeRows = (currentOptions.knowledgeRows ?? []).map((row, index) => ({ ID: `knowledge-grant-${index}`, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetEntityID: 'E-SOURCES', Sequence: index, Settings: null, ...row }));

            if (EntityName === 'MJ: AI Agents') {
                // The shipped assistant, by its name; every other read is by id, and an inactive agent is left out of an Active read
                if (ExtraFilter.includes('Name =')) return { Success: true, Results: ExtraFilter.includes(SHIPPED.fields.Name) ? [{ ID: COLLABORATION_DEFAULT_AGENT_ID }] : [] };
                const wanted = [...ExtraFilter.matchAll(/'([0-9a-f-]{36})'/gi)].map((m) => m[1].toLowerCase());
                const inactive = new Set((currentOptions.inactiveAgentIds ?? []).map((id) => id.toLowerCase()));
                const statusRead = ExtraFilter.includes("Status = 'Active'");
                return { Success: true, Results: wanted.filter((id) => !statusRead || !inactive.has(id)).map((id) => ({ ID: id })) };
            }

            if (EntityName === 'MJ: Content Sources') {
                // Every granted source exists
                const wanted = [...ExtraFilter.matchAll(/'([0-9a-f-]{36})'/gi)].map((m) => m[1]);
                return { Success: true, Results: wanted.map((id) => ({ ID: id })) };
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

            if (EntityName === 'MJ_BizApps_Collaboration: Space Grants') {
                // The engine loads every app- and type-level grant; the resolvers read a space's rows of one kind
                const rows = ExtraFilter.includes("Kind = 'Agent'") ? agentRows : ExtraFilter.includes("Kind = 'KnowledgeSource'") ? knowledgeRows : [...agentRows, ...knowledgeRows];
                return { Success: true, Results: rows };
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
                { TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true },
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
                { TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { TargetRecordID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: true },
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
                { TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { TargetRecordID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: true },
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
                { TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { TargetRecordID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: false },
                { TargetRecordID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, IsDefault: true },
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
                { TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true },
                { TargetRecordID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: false },
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
                { TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: false },
                { TargetRecordID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, IsDefault: true },
                { TargetRecordID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, IsDefault: true },
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
                { TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true },
                { TargetRecordID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, IsDefault: false },
            ],
            inactiveAgentIds: [APP_AGENT_ID],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, [CHILD_AGENT_ID]);
        assert.equal(result.defaultAgentId, CHILD_AGENT_ID);
    });

    it('returns no default and no agents when not even the shipped agent is Active', async () => {
        currentOptions = {
            agentRows: [{ TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true }],
            inactiveAgentIds: [APP_AGENT_ID, COLLABORATION_DEFAULT_AGENT_ID],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);

        assert.deepEqual(result.allowedAgentIds, []);
        assert.equal(result.defaultAgentId, null);
    });

    it('refuses, rather than skipping a link, when a type configuration does not parse', async () => {
        currentOptions = { typeConfig: '{ not json' };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        await assert.rejects(() => resolveAllowedAgents(provider, CHILD_SPACE_ID), /refused.*does not parse/);
    });

    it('refuses when a space that holds agent rows has a configuration that does not parse', async () => {
        currentOptions = {
            spaceConfig: '{ not json',
            agentRows: [{ TargetRecordID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, IsDefault: true }],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        await assert.rejects(() => resolveAllowedAgents(provider, CHILD_SPACE_ID), /refused.*does not parse/);
    });

    it('gives no agents and no default when a level replaced the list and none of its agents is Active, and the shipped one is Active', async () => {
        currentOptions = {
            spaceConfig: JSON.stringify({ Agents: { ListMode: 'Replace' } }),
            typeConfig: JSON.stringify({ SpaceOverridable: ['Agents.ListMode'] }),
            agentRows: [{ TargetRecordID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, IsDefault: true }],
            inactiveAgentIds: [CHILD_AGENT_ID],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const result = await resolveAllowedAgents(provider, CHILD_SPACE_ID);
        assert.deepEqual(result.allowedAgentIds, []);
        assert.equal(result.defaultAgentId, null);
    });

    it('uses the shipped agent as the last resort when nothing configured is Active', async () => {
        currentOptions = {
            agentRows: [{ TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, IsDefault: true }],
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
                { TargetRecordID: SOURCE_ID_1, SpaceTypeID: TYPE_ID, SpaceID: null },
                { TargetRecordID: SOURCE_ID_2, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID },
            ],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const sources = await resolveSpaceKnowledgeSources(provider, CHILD_SPACE_ID);

        assert.equal(sources.length, 2);
        assert.ok(sources.includes(SOURCE_ID_1.toUpperCase()));
        assert.ok(sources.includes(SOURCE_ID_2.toUpperCase()));
    });

    it("resolves the AI skills the agent grants' settings name across type and space hierarchy", async () => {
        currentOptions = {
            agentRows: [
                { TargetRecordID: TYPE_AGENT_ID, SpaceTypeID: TYPE_ID, SpaceID: null, Settings: JSON.stringify({ Skills: [SKILL_ID_1] }) },
                { TargetRecordID: CHILD_AGENT_ID, SpaceTypeID: null, SpaceID: CHILD_SPACE_ID, Settings: JSON.stringify({ Skills: [SKILL_ID_2] }) },
                { TargetRecordID: APP_AGENT_ID, SpaceTypeID: null, SpaceID: null, Settings: JSON.stringify({ Skills: 'None' }) },
            ],
        };
        await CollaborationEngine.Instance.Config(true, undefined, provider);
        const skills = await resolveSpaceAgentSkills(provider, CHILD_SPACE_ID);

        assert.equal(skills.length, 2);
        assert.ok(skills.includes(SKILL_ID_1.toUpperCase()));
        assert.ok(skills.includes(SKILL_ID_2.toUpperCase()));
    });
});
