import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { freshSelectionState, LoadingFlag } from './selection-reset.ts';

describe('a selection starts clean', () => {
    it('closes the drawer, clears the item, resets both bands and drops the last save message', () => {
        const state = freshSelectionState();
        assert.equal(state.isDrawerOpen, false);
        assert.equal(state.selectedItemId, null);
        assert.equal(state.spaceAudienceBand, 'Team');
        assert.equal(state.chatAudienceBand, 'Team');
        assert.equal(state.settingsSaveSuccess, '');
        assert.equal(state.settingsInfoMessage, '');
    });
});

describe('the loading flag of a selection', () => {
    it('is raised while a selection loads and lowered when it finishes', () => {
        const flag = new LoadingFlag();
        assert.equal(flag.Active, false);
        const end = flag.Begin();
        assert.equal(flag.Active, true);
        end();
        assert.equal(flag.Active, false);
    });

    it('stays raised when an older selection finishes after a newer one began', () => {
        const flag = new LoadingFlag();
        const endFirst = flag.Begin();
        const endSecond = flag.Begin();
        endFirst();
        assert.equal(flag.Active, true, 'the newer selection is still loading');
        endSecond();
        assert.equal(flag.Active, false);
    });
});
