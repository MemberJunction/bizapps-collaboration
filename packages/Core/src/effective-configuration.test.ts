import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CollaborationSettings } from './configuration.ts';
import { MissingAppSettingsError } from './configuration.ts';
import {
    CutConfigurationForViewer,
    GrantsForViewer,
    ResolveSpaceConfiguration,
    RulesOf,
    sameTypeRun,
    type GrantRowInput,
    type SpaceLevelInput,
} from './effective-configuration.ts';

const APP: CollaborationSettings = {
    Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' },
    Agents: { ListMode: 'Extend' },
    Labels: { Tabs: { Library: 'Library' } },
};
const TYPE_A = 'AAAAAAAA-0000-4000-8000-000000000001';
const TYPE_B = 'BBBBBBBB-0000-4000-8000-000000000002';
const AGENTS = 'E0000000-0000-4000-8000-00000000000A';
const ACTIONS = 'E0000000-0000-4000-8000-00000000000B';
const QUERIES = 'E0000000-0000-4000-8000-00000000000C';

let seq = 0;
function grant(partial: Partial<GrantRowInput> & { Kind: string; TargetRecordID: string }): GrantRowInput {
    seq += 1;
    return {
        ID: partial.ID ?? `G${String(seq).padStart(7, '0')}-0000-4000-8000-000000000000`,
        Mode: 'Extend',
        TargetEntityID: partial.Kind === 'Agent' ? AGENTS : partial.Kind === 'Action' ? ACTIONS : QUERIES,
        Band: 'Shared',
        Sequence: seq,
        ...partial,
    };
}
function space(id: string, typeId: string | null, settings: CollaborationSettings | null = null, grants: GrantRowInput[] = []): SpaceLevelInput {
    return { ID: id, TypeID: typeId, Settings: settings, Grants: grants };
}
const ids = (list: { TargetRecordID: string }[]) => list.map((g) => g.TargetRecordID);

describe('sameTypeRun', () => {
    it('is the space and the ancestors directly above it of its type, nearest first, stopping at the first of another type', () => {
        const chain = [space('s3', TYPE_A), space('s2', TYPE_A), space('s1', TYPE_B), space('s0', TYPE_A)];
        assert.deepEqual(sameTypeRun(chain).map((s) => s.ID), ['s3', 's2']);
    });
    it('is the space alone when its parent has another type, whatever lies above', () => {
        const chain = [space('s2', TYPE_B), space('s1', TYPE_A), space('s0', TYPE_A)];
        assert.deepEqual(sameTypeRun(chain).map((s) => s.ID), ['s2']);
    });
    it('compares types without regard to case', () => {
        const chain = [space('s1', TYPE_A.toLowerCase()), space('s0', TYPE_A)];
        assert.equal(sameTypeRun(chain).length, 2);
    });
});

describe('ResolveSpaceConfiguration: the settings down the chain', () => {
    it('refuses without the app row, as the settings resolver does', () => {
        assert.throws(() => ResolveSpaceConfiguration({ App: { Settings: null, Grants: [] }, Type: null, Spaces: [space('s', null)] }), MissingAppSettingsError);
    });

    it('a same-type sub-space inherits its parent\'s override; a parent of another type is not read', () => {
        const type = { ID: TYPE_A, Settings: { SpaceOverridable: ['Chats.WhoCanStart'] } as CollaborationSettings, Grants: [] };
        const inherits = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [] },
            Type: type,
            Spaces: [space('child', TYPE_A), space('parent', TYPE_A, { Chats: { WhoCanStart: 'Owners' } })],
        });
        assert.equal(inherits.Settings.Chats.WhoCanStart, 'Owners');

        const restarts = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [] },
            Type: type,
            Spaces: [space('child', TYPE_A), space('parent', TYPE_B, { Chats: { WhoCanStart: 'Owners' } })],
        });
        assert.equal(restarts.Settings.Chats.WhoCanStart, 'Anyone', 'the parent of another type does not reach the child');
        assert.deepEqual(restarts.Chain, [{ Level: 'App', LevelID: null }, { Level: 'Type', LevelID: TYPE_A }, { Level: 'Space', LevelID: 'child' }]);
    });

    it('a same-type space below a parent of another type starts a new run that its own same-type children inherit', () => {
        const type = { ID: TYPE_A, Settings: { SpaceOverridable: ['Chats.WhoCanStart'] } as CollaborationSettings, Grants: [] };
        const resolved = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [] },
            Type: type,
            Spaces: [space('leaf', TYPE_A), space('mid', TYPE_A, { Chats: { WhoCanStart: 'Owners' } }), space('other', TYPE_B), space('root', TYPE_A, { Chats: { WhoCanStart: 'Anyone' } })],
        });
        assert.equal(resolved.Settings.Chats.WhoCanStart, 'Owners');
        assert.deepEqual(resolved.Chain.map((link) => link.LevelID), [null, TYPE_A, 'mid', 'leaf']);
        assert.deepEqual(RulesOf(resolved), { Chats: resolved.Settings.Chats, Agents: resolved.Settings.Agents, Labels: resolved.Settings.Labels, Extensions: {} });
    });

    it('a space\'s value for a key its type does not list is refused by the resolver: the type\'s value stands', () => {
        const resolved = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [] },
            Type: { ID: TYPE_A, Settings: { Chats: { WhoCanStart: 'Owners' } }, Grants: [] },
            Spaces: [space('s', TYPE_A, { Chats: { WhoCanStart: 'Anyone' } })],
        });
        assert.equal(resolved.Settings.Chats.WhoCanStart, 'Owners');
    });

    it('carries the type\'s audience and data reach, and fails closed without them', () => {
        const reach = [{ Entity: 'X: Members', Path: 'ChapterID', AnchorRole: 'chapter', Band: 'Shared' as const, Fields: ['Name'] }];
        const resolved = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [] },
            Type: { ID: TYPE_A, Settings: { Seats: { Audience: 'StaffOnly' }, DataReach: reach }, Grants: [] },
            Spaces: [space('s', TYPE_A)],
        });
        assert.equal(resolved.Audience, 'StaffOnly');
        assert.deepEqual(resolved.DataReach, reach);
        const bare = ResolveSpaceConfiguration({ App: { Settings: APP, Grants: [] }, Type: null, Spaces: [space('s', null)] });
        assert.equal(bare.Audience, 'StaffAndParticipants');
        assert.deepEqual(bare.DataReach, []);
        assert.deepEqual(bare.Chain, [{ Level: 'App', LevelID: null }, { Level: 'Space', LevelID: 's' }]);
    });
});

describe('ResolveSpaceConfiguration: grants per kind', () => {
    it('Extend adds each level\'s rows below the inherited ones, in Sequence order, and a lower row for the same target takes its place', () => {
        const resolved = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [grant({ Kind: 'Action', TargetRecordID: 'a1', Sequence: 2 }), grant({ Kind: 'Action', TargetRecordID: 'a2', Sequence: 1 })] },
            Type: { ID: TYPE_A, Settings: null, Grants: [grant({ Kind: 'Action', TargetRecordID: 'a3' }), grant({ Kind: 'Action', TargetRecordID: 'a1', Label: 'the type\'s a1', Band: 'Team' })] },
            Spaces: [space('s', TYPE_A, null, [grant({ Kind: 'Action', TargetRecordID: 'a4' })])],
        });
        assert.deepEqual(ids(resolved.Grants.Action), ['a2', 'a3', 'a1', 'a4']);
        const a1 = resolved.Grants.Action.find((g) => g.TargetRecordID === 'a1')!;
        assert.equal(a1.Level, 'Type');
        assert.equal(a1.Label, 'the type\'s a1');
        assert.equal(a1.Band, 'Team');
        assert.equal(resolved.Grants.Action.find((g) => g.TargetRecordID === 'a4')!.LevelID, 's');
        assert.deepEqual(resolved.Grants.Query, []);
    });

    it('Replace at the type keeps only the type\'s rows; Replace at a space needs the type\'s leave', () => {
        const app = { Settings: APP, Grants: [grant({ Kind: 'Action', TargetRecordID: 'app' })] };
        const typeReplaces = ResolveSpaceConfiguration({
            App: app,
            Type: { ID: TYPE_A, Settings: { Grants: { Action: { ListMode: 'Replace' } } }, Grants: [grant({ Kind: 'Action', TargetRecordID: 'type' })] },
            Spaces: [space('s', TYPE_A)],
        });
        assert.deepEqual(ids(typeReplaces.Grants.Action), ['type']);
        assert.deepEqual(typeReplaces.ReplacedKinds, ['Action']);

        const spaceNotAllowed = ResolveSpaceConfiguration({
            App: app,
            Type: { ID: TYPE_A, Settings: null, Grants: [] },
            Spaces: [space('s', TYPE_A, { Grants: { Action: { ListMode: 'Replace' } } }, [grant({ Kind: 'Action', TargetRecordID: 'mine' })])],
        });
        assert.deepEqual(ids(spaceNotAllowed.Grants.Action), ['app', 'mine'], 'without SpaceOverridable the space extends');
        assert.deepEqual(spaceNotAllowed.ReplacedKinds, []);

        const spaceAllowed = ResolveSpaceConfiguration({
            App: app,
            Type: { ID: TYPE_A, Settings: { SpaceOverridable: ['Grants.Action'] }, Grants: [] },
            Spaces: [space('s', TYPE_A, { Grants: { Action: { ListMode: 'Replace' } } }, [grant({ Kind: 'Action', TargetRecordID: 'mine' })])],
        });
        assert.deepEqual(ids(spaceAllowed.Grants.Action), ['mine']);
    });

    it('the legacy Agents.ListMode still governs the Agent kind', () => {
        const resolved = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [grant({ Kind: 'Agent', TargetRecordID: 'sage' })] },
            Type: { ID: TYPE_A, Settings: { Agents: { ListMode: 'Replace' } }, Grants: [grant({ Kind: 'Agent', TargetRecordID: 'scribe' })] },
            Spaces: [space('s', TYPE_A)],
        });
        assert.deepEqual(ids(resolved.Grants.Agent), ['scribe']);
    });

    it('a Remove row drops one inherited grant by its target, for that level and below only, and a Remove of nothing is logged', () => {
        const logs: string[] = [];
        const typeLevel = { ID: TYPE_A, Settings: null, Grants: [grant({ Kind: 'Action', TargetRecordID: 'a1' }), grant({ Kind: 'Action', TargetRecordID: 'a2' })] };
        const parent = space('parent', TYPE_A, null, [grant({ Kind: 'Action', TargetRecordID: 'a1', Mode: 'Remove' })]);
        const child = space('child', TYPE_A, null, [grant({ Kind: 'Action', TargetRecordID: 'a9', Mode: 'Remove', ID: 'REMOVE-NOTHING' })]);
        const resolved = ResolveSpaceConfiguration({ App: { Settings: APP, Grants: [] }, Type: typeLevel, Spaces: [child, parent], Log: (m) => logs.push(m) });
        assert.deepEqual(ids(resolved.Grants.Action), ['a2']);
        assert.equal(logs.length, 1);
        assert.match(logs[0], /REMOVE-NOTHING .*removes nothing/);

        const sibling = ResolveSpaceConfiguration({ App: { Settings: APP, Grants: [] }, Type: typeLevel, Spaces: [space('sibling', TYPE_A)] });
        assert.deepEqual(ids(sibling.Grants.Action), ['a1', 'a2'], 'the parent\'s Remove does not reach a space outside its subtree');
    });

    it('a grant whose target is gone, or whose bindings or settings do not parse, is left out with a log', () => {
        const logs: string[] = [];
        const logged = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [] },
            Type: {
                ID: TYPE_A,
                Settings: null,
                Grants: [
                    grant({ Kind: 'Action', TargetRecordID: 'gone', TargetExists: false, ID: 'GONE' }),
                    grant({ Kind: 'Action', TargetRecordID: 'bad-bindings', Bindings: '{not json', ID: 'BADB' }),
                    grant({ Kind: 'Agent', TargetRecordID: 'bad-settings', Settings: '[]', ID: 'BADS' }),
                    grant({ Kind: 'Action', TargetRecordID: 'fine', Bindings: '{"ChapterID":{"From":"Anchor:chapter"}}' }),
                    grant({ Kind: 'Widget', TargetRecordID: 'unknown-kind', ID: 'KIND' }),
                ],
            },
            Spaces: [space('s', TYPE_A)],
            Log: (m) => logs.push(m),
        });
        assert.deepEqual(ids(logged.Grants.Action), ['fine']);
        assert.deepEqual(logged.Grants.Action[0].Bindings, { ChapterID: { From: 'Anchor:chapter' } });
        assert.deepEqual(ids(logged.Grants.Agent), []);
        assert.equal(logs.filter((m) => m.includes('GONE')).length, 1);
        assert.equal(logs.filter((m) => m.includes('BADB')).length, 1);
        assert.equal(logs.filter((m) => m.includes('BADS')).length, 1);
        assert.equal(logs.filter((m) => m.includes('KIND') && m.includes('not a kind of grant')).length, 1);
    });

    it('the default agent is the nearest level\'s IsDefault row, else the first agent grant, else null; settings ride on the grant', () => {
        const resolved = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [grant({ Kind: 'Agent', TargetRecordID: 'sage', IsDefault: true, ID: 'SAGE' })] },
            Type: { ID: TYPE_A, Settings: null, Grants: [grant({ Kind: 'Agent', TargetRecordID: 'scribe', IsDefault: true, ID: 'SCRIBE', Settings: { PlanMode: 'Off' } })] },
            Spaces: [space('s', TYPE_A)],
        });
        assert.equal(resolved.DefaultAgentGrantID, 'SCRIBE');
        assert.deepEqual(resolved.Grants.Agent.find((g) => g.GrantID === 'SCRIBE')!.Settings, { PlanMode: 'Off' });

        const unflagged = ResolveSpaceConfiguration({
            App: { Settings: APP, Grants: [grant({ Kind: 'Agent', TargetRecordID: 'sage', ID: 'ONLY' })] },
            Type: null,
            Spaces: [space('s', null)],
        });
        assert.equal(unflagged.DefaultAgentGrantID, 'ONLY');
        const none = ResolveSpaceConfiguration({ App: { Settings: APP, Grants: [] }, Type: null, Spaces: [space('s', null)] });
        assert.equal(none.DefaultAgentGrantID, null);
    });
});

describe('CutConfigurationForViewer', () => {
    const full = ResolveSpaceConfiguration({
        App: { Settings: APP, Grants: [] },
        Type: {
            ID: TYPE_A,
            Settings: { DataReach: [{ Entity: 'X', Path: 'P', AnchorRole: 'r', Band: 'Team', Fields: ['F'] }] },
            Grants: [
                grant({ Kind: 'Agent', TargetRecordID: 'team-agent', Band: 'Team', IsDefault: true, ID: 'TEAM' }),
                grant({ Kind: 'Agent', TargetRecordID: 'shared-agent', Band: 'Shared', ID: 'SHARED' }),
                grant({ Kind: 'Action', TargetRecordID: 'a', Band: 'Shared', Bindings: { ChapterID: { From: 'Anchor:chapter' } } }),
            ],
        },
        Spaces: [space('s', TYPE_A)],
    });

    it('a Shared viewer gets the Shared grants with their bindings removed, a default agent they can use, and no Team reach', () => {
        const cut = CutConfigurationForViewer(full, { canSeeTeam: false, full: false });
        assert.deepEqual(ids(cut.Grants.Agent), ['shared-agent']);
        assert.equal(cut.DefaultAgentGrantID, 'SHARED');
        assert.deepEqual(cut.Grants.Action[0].Bindings, {});
        assert.deepEqual(cut.DataReach, []);
        assert.deepEqual(full.Grants.Action[0].Bindings, { ChapterID: { From: 'Anchor:chapter' } }, 'the full document is untouched');
    });

    it('a Team viewer without the settings authorizations gets every grant, bindings removed', () => {
        const cut = CutConfigurationForViewer(full, { canSeeTeam: true, full: false });
        assert.deepEqual(ids(cut.Grants.Agent), ['team-agent', 'shared-agent']);
        assert.equal(cut.DefaultAgentGrantID, 'TEAM');
        assert.deepEqual(cut.Grants.Action[0].Bindings, {});
        assert.equal(cut.DataReach.length, 1);
    });

    it('a full viewer gets the document as it is', () => {
        assert.equal(CutConfigurationForViewer(full, { canSeeTeam: true, full: true }), full);
    });

    it('GrantsForViewer is the band cut alone', () => {
        assert.deepEqual(ids(GrantsForViewer(full, 'Agent', false)), ['shared-agent']);
        assert.deepEqual(ids(GrantsForViewer(full, 'Agent', true)), ['team-agent', 'shared-agent']);
    });
});
