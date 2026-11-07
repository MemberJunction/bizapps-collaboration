import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { IMetadataProvider } from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { resolveSpaceChatSettings } from '../dist/resolve-space-chat-settings.js';
import { seedAppSettings } from './app-settings.test-support.ts';

const WORKSPACE_TYPE_ID = '10000000-0000-4000-8000-000000000001';
const TEAM_TYPE_ID = '10000000-0000-4000-8000-000000000002';
const WORKSPACE_ID = '20000000-0000-4000-8000-000000000001';
const TEAM_ID = '20000000-0000-4000-8000-000000000002';
const SUB_TEAM_ID = '20000000-0000-4000-8000-000000000003';

/** A Workspace may set the agent list mode and who starts chats; a Team may set only who starts chats. */
const TYPES = [
    { ID: WORKSPACE_TYPE_ID, Configuration: JSON.stringify({ SpaceOverridable: ['Agents.ListMode', 'Chats.WhoCanStart'] }) },
    { ID: TEAM_TYPE_ID, Configuration: JSON.stringify({ SpaceOverridable: ['Chats.WhoCanStart'] }) },
];

function providerWith(workspaceConfiguration: string | null, teamConfiguration: string | null = null): IMetadataProvider {
    const spaces = [
        { ID: SUB_TEAM_ID, ParentID: TEAM_ID, SpaceTypeID: TEAM_TYPE_ID, Configuration: null },
        { ID: TEAM_ID, ParentID: WORKSPACE_ID, SpaceTypeID: TEAM_TYPE_ID, Configuration: teamConfiguration },
        { ID: WORKSPACE_ID, ParentID: null, SpaceTypeID: WORKSPACE_TYPE_ID, Configuration: workspaceConfiguration },
    ];
    const provider = {
        async RunView(params: { EntityName: string; ExtraFilter?: string }) {
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') return { Success: true, Results: TYPES };
            if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                const wanted = /'([0-9a-f-]{36})'/i.exec(params.ExtraFilter ?? '')?.[1]?.toLowerCase();
                return { Success: true, Results: spaces.filter((s) => s.ID === wanted) };
            }
            return { Success: true, Results: [] };
        },
        async RunViews(list: Array<{ EntityName: string; ExtraFilter?: string }>) {
            return Promise.all(list.map((p) => provider.RunView(p)));
        },
    };
    return provider as unknown as IMetadataProvider;
}

describe('a link in the settings chain is judged by its own space type', () => {
    let restoreAppSettings: () => void;
    before(() => { restoreAppSettings = seedAppSettings(); });
    after(() => restoreAppSettings());

    it("does not refuse a Team under a Workspace that sets what a Team may not, and inherits nothing from a parent of another type (D30)", async () => {
        const provider = providerWith(JSON.stringify({ Agents: { ListMode: 'Replace' }, Chats: { WhoCanStart: 'Owners' } }));
        await CollaborationEngine.Instance.Config(true, undefined, provider);

        const result = await resolveSpaceChatSettings(provider, TEAM_ID);

        assert.equal(result.resolvedSettings.Chats.WhoCanStart, 'Anyone', "a Team starts again from its own type: the Workspace's override does not reach it");
        assert.equal(result.resolvedSettings.Agents.ListMode, 'Extend', "the Workspace's list mode does not reach a Team");
        assert.deepEqual(result.configuration.Chain.map((link) => link.LevelID), [null, TEAM_TYPE_ID, TEAM_ID]);
    });

    it('a Team under a Team inherits the override its parent made, as the same-type run allows', async () => {
        const provider = providerWith(null, JSON.stringify({ Chats: { WhoCanStart: 'Owners' } }));
        await CollaborationEngine.Instance.Config(true, undefined, provider);

        const result = await resolveSpaceChatSettings(provider, SUB_TEAM_ID);

        assert.equal(result.resolvedSettings.Chats.WhoCanStart, 'Owners', "the parent Team's override reaches its same-type child");
        assert.deepEqual(result.configuration.Chain.map((link) => link.LevelID), [null, TEAM_TYPE_ID, TEAM_ID, SUB_TEAM_ID]);
    });

    it('still refuses a link that is invalid for its own type', async () => {
        const provider = providerWith(JSON.stringify({ StorageAccountID: '40000000-0000-4000-8000-000000000001' }));
        await CollaborationEngine.Instance.Config(true, undefined, provider);

        await assert.rejects(() => resolveSpaceChatSettings(provider, TEAM_ID), /Space settings refused/);
    });
});
