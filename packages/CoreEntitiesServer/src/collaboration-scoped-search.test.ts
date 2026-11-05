import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionRunScope } from '@memberjunction/actions-base';
import { CollaborationScopedSearchAction, unquoteSpaceSearch, unwrapPhraseQuotes } from '../dist/CollaborationScopedSearchAction.js';
import { COLLABORATION_SPACE_SCOPE_ID } from '../dist/turn-tools.js';

const spaceScope: ActionRunScope = { PrimaryScopeEntityName: 'MJ_BizApps_Collaboration: Space Chats', PrimaryScopeRecordID: 'chat-1', SecondaryScopes: null, SearchScopeIDs: [COLLABORATION_SPACE_SCOPE_ID.toLowerCase()] };
const queryParams = (value: unknown, name = 'Query'): ActionParam[] => [{ Name: name, Type: 'Input', Value: value }, { Name: 'AgentID', Type: 'Input', Value: 'agent-1' }];

describe('unwrapPhraseQuotes', () => {
    it('drops one pair of straight or curly quotes around the whole query', () => {
        assert.equal(unwrapPhraseQuotes('"Executive Steering Review"'), 'Executive Steering Review');
        assert.equal(unwrapPhraseQuotes(' “Executive Steering Review” '), 'Executive Steering Review');
        assert.equal(unwrapPhraseQuotes('"SOW"'), 'SOW');
        assert.equal(unwrapPhraseQuotes('”mismatched“'), 'mismatched');
        assert.equal(unwrapPhraseQuotes('"two\nlines"'), 'two\nlines');
    });

    it('leaves an inner quote, a query of only quotes, and an unquoted query as they are', () => {
        assert.equal(unwrapPhraseQuotes('6" pipe'), '6" pipe');
        assert.equal(unwrapPhraseQuotes('the "SOW" task'), 'the "SOW" task');
        assert.equal(unwrapPhraseQuotes('""'), '""');
        assert.equal(unwrapPhraseQuotes('" "'), '" "');
        assert.equal(unwrapPhraseQuotes('Executive Steering Review'), 'Executive Steering Review');
    });
});

describe('unquoteSpaceSearch', () => {
    it('unquotes the Query of a run that searches a space, whatever case the agent named it in', () => {
        for (const name of ['Query', 'query']) {
            const params = queryParams('"Executive Steering Review"', name);
            unquoteSpaceSearch({ Params: params, RunScope: spaceScope });
            assert.equal(params[0].Value, 'Executive Steering Review', name);
        }
    });

    it('leaves every other search alone: no run scope, another scope, or a Query that is not text', () => {
        const unscoped = queryParams('"Executive Steering Review"');
        unquoteSpaceSearch({ Params: unscoped, RunScope: undefined });
        assert.equal(unscoped[0].Value, '"Executive Steering Review"');
        const otherScope = queryParams('"Executive Steering Review"');
        unquoteSpaceSearch({ Params: otherScope, RunScope: { ...spaceScope, SearchScopeIDs: ['00000000-0000-0000-0000-000000000001'] } });
        assert.equal(otherScope[0].Value, '"Executive Steering Review"');
        const notText = queryParams(42);
        unquoteSpaceSearch({ Params: notText, RunScope: spaceScope });
        assert.equal(notText[0].Value, 42);
    });
});

describe('CollaborationScopedSearchAction', () => {
    it("is what MJ's Scoped Search driver class resolves to", () => {
        const registration = MJGlobal.Instance.ClassFactory.GetRegistration(BaseAction, '__Scoped_Search');
        assert.equal(registration?.SubClass, CollaborationScopedSearchAction);
    });
});
