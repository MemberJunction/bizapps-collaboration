import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ResolveSpaceConfiguration } from '@mj-biz-apps/collaboration-core';
import { rulesFromServerDocument, sameRules } from './space-rules.ts';

const APP = { Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' }, Agents: { ListMode: 'Extend' } };

/** The document the server sends: the same resolver, over the app, a type and no space. */
function serverDocument(typeSettings: Record<string, unknown>): string {
    const configuration = ResolveSpaceConfiguration({
        App: { Settings: APP as never, Grants: [] },
        Type: { ID: 'T1', Settings: typeSettings as never, Grants: [] },
        Spaces: [],
    });
    return JSON.stringify(configuration);
}

describe("the rules from the server's configuration document", () => {
    it("carries the type's labels, which a participant's browser cannot resolve itself", () => {
        const rules = rulesFromServerDocument(serverDocument({ Labels: { Tabs: { people: 'Members' }, Bands: { Shared: 'Chapter members' } } }));
        assert.equal(rules?.Labels?.Tabs?.people, 'Members');
        assert.equal(rules?.Chats.WhoCanStart, 'Anyone');
    });

    it('gives null for a missing, broken or shapeless document, so the browser keeps its own answer', () => {
        assert.equal(rulesFromServerDocument(null), null);
        assert.equal(rulesFromServerDocument(''), null);
        assert.equal(rulesFromServerDocument('{not json'), null);
        assert.equal(rulesFromServerDocument('{"Grants":{}}'), null);
        assert.equal(rulesFromServerDocument('"a string"'), null);
    });

    it('tells the same rules from changed ones', () => {
        const a = rulesFromServerDocument(serverDocument({ Labels: { Tabs: { people: 'Members' } } }));
        const b = rulesFromServerDocument(serverDocument({ Labels: { Tabs: { people: 'Members' } } }));
        const c = rulesFromServerDocument(serverDocument({ Labels: { Tabs: { people: 'Chapter members' } } }));
        assert.equal(sameRules(a, b), true);
        assert.equal(sameRules(a, c), false);
        assert.equal(sameRules(null, undefined), true);
    });
});
