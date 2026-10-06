import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EffectiveGrant, EffectiveSpaceConfiguration } from './effective-configuration.ts';
import { agentGrantFor, agentRunSettingsFor, audienceOfConversationKind, turnToolsFor } from './turn-tools.ts';

let n = 0;
function grant(kind: EffectiveGrant['Kind'], band: 'Team' | 'Shared', extra: Partial<EffectiveGrant> = {}): EffectiveGrant {
    n += 1;
    return { GrantID: `G${n}`, Kind: kind, TargetEntityID: 'E', TargetRecordID: `T${n}`, Label: null, Band: band, IsDefault: false, Sequence: n, Bindings: {}, Settings: null, Level: 'Type', LevelID: 'TY', ...extra };
}

function configuration(grants: EffectiveGrant[]): EffectiveSpaceConfiguration {
    const byKind = { Agent: [], Action: [], Query: [], View: [], Dashboard: [], Component: [], KnowledgeSource: [] } as EffectiveSpaceConfiguration['Grants'];
    for (const g of grants) byKind[g.Kind].push(g);
    return { Settings: {} as never, Audience: 'StaffAndParticipants' as never, Grants: byKind, DefaultAgentGrantID: null, DataReach: [], Chain: [], ReplacedKinds: [] };
}

describe("a turn's tools", () => {
    it("keeps no Team grant when the conversation seats everyone (an outsider's chat)", () => {
        const team = grant('Action', 'Team');
        const shared = grant('Action', 'Shared');
        const teamQuery = grant('Query', 'Team');
        const tools = turnToolsFor(configuration([team, shared, teamQuery]), 'Shared');
        assert.deepEqual(tools.Actions.map((g) => g.GrantID), [shared.GrantID]);
        assert.deepEqual(tools.DataGrants, []);
        const internal = turnToolsFor(configuration([team, shared, teamQuery]), 'Team');
        assert.deepEqual(internal.Actions.map((g) => g.GrantID).sort(), [team.GrantID, shared.GrantID].sort());
        assert.deepEqual(internal.DataGrants.map((g) => g.GrantID), [teamQuery.GrantID]);
    });

    it('withholds an action that binds a parameter, naming the bound names (A16, row 15), and gives one that binds none', () => {
        const bound = grant('Action', 'Shared', { Bindings: { ChapterID: { From: 'Anchor:chapter' } } as never });
        const free = grant('Action', 'Shared');
        const tools = turnToolsFor(configuration([bound, free]), 'Shared');
        assert.deepEqual(tools.Actions.map((g) => g.GrantID), [free.GrantID]);
        assert.deepEqual(tools.WithheldActions.map((w) => [w.grant.GrantID, w.boundNames]), [[bound.GrantID, ['ChapterID']]]);
    });

    it('runs granted queries and unbound views through Run space data, holds a bound view for A14, and never a dashboard or component (row 19)', () => {
        const query = grant('Query', 'Shared');
        const view = grant('View', 'Shared');
        const boundView = grant('View', 'Shared', { Bindings: { Filter: { From: 'Space.ID' } } as never });
        const dashboard = grant('Dashboard', 'Shared');
        const component = grant('Component', 'Shared');
        const tools = turnToolsFor(configuration([query, view, boundView, dashboard, component]), 'Shared');
        assert.deepEqual(tools.DataGrants.map((g) => g.GrantID), [query.GrantID, view.GrantID]);
        assert.deepEqual(tools.WithheldViews.map((g) => g.GrantID), [boundView.GrantID]);
        assert.equal(JSON.stringify(tools).includes(dashboard.GrantID), false);
        assert.equal(JSON.stringify(tools).includes(component.GrantID), false);
    });

    it('lists the knowledge sources in force once each, for the audience', () => {
        const a = grant('KnowledgeSource', 'Shared', { TargetRecordID: 'cs-a' });
        const again = grant('KnowledgeSource', 'Shared', { TargetRecordID: 'CS-A' });
        const team = grant('KnowledgeSource', 'Team', { TargetRecordID: 'cs-t' });
        assert.deepEqual(turnToolsFor(configuration([a, again, team]), 'Shared').KnowledgeSourceIDs, ['CS-A']);
        assert.deepEqual(turnToolsFor(configuration([a, again, team]), 'Team').KnowledgeSourceIDs, ['CS-A', 'CS-T']);
    });

    it('reads the audience off the conversation kind', () => {
        assert.equal(audienceOfConversationKind('Private'), 'Team');
        assert.equal(audienceOfConversationKind('General'), 'Shared');
        assert.equal(audienceOfConversationKind('Topic'), 'Shared');
        assert.equal(audienceOfConversationKind(null), 'Shared');
    });

    it("finds the agent's grant at the nearest level, within the audience", () => {
        const typeLevel = grant('Agent', 'Shared', { TargetRecordID: 'AG', Level: 'Type', Settings: { EffortLevel: 2 } });
        const spaceLevel = grant('Agent', 'Shared', { TargetRecordID: 'ag', Level: 'Space', Settings: { EffortLevel: 5 } });
        const teamOnly = grant('Agent', 'Team', { TargetRecordID: 'AG', Level: 'Space', Settings: { EffortLevel: 9 } });
        assert.equal(agentGrantFor(configuration([typeLevel, spaceLevel, teamOnly]), 'ag', 'Shared')?.Settings?.EffortLevel, 5);
        assert.equal(agentGrantFor(configuration([typeLevel, spaceLevel, teamOnly]), 'ag', 'Team')?.Settings?.EffortLevel, 9);
        assert.equal(agentGrantFor(configuration([typeLevel]), 'other', 'Shared'), null);
    });

    it("maps the grant's settings onto the run, and names what MJ's run cannot take yet", () => {
        const settings = agentRunSettingsFor({ Settings: { PlanMode: 'Required', EffortLevel: 3, Skills: ['s1', 'S1', 's2'], MemoryWrites: false, Limits: { MaxIterationsPerRun: 4.7, MaxTimePerRun: 30, MaxCostPerRun: 1, MaxTokensPerRun: 1000 } } });
        assert.deepEqual(settings, { planMode: true, effortLevel: 3, requestedSkillIDs: ['S1', 'S2'], absoluteMaxIterations: 4, maxExecutionTimeMs: 30000, closed: ['Limits.MaxCostPerRun', 'Limits.MaxTokensPerRun', 'MemoryWrites'] });
        assert.deepEqual(agentRunSettingsFor({ Settings: { PlanMode: 'Off', Skills: 'None' } }), { planMode: false, requestedSkillIDs: [], closed: [] });
        assert.deepEqual(agentRunSettingsFor({ Settings: { PlanMode: 'Allowed' } }).planMode, undefined);
        assert.deepEqual(agentRunSettingsFor(null), { requestedSkillIDs: [], closed: [] });
    });
});
