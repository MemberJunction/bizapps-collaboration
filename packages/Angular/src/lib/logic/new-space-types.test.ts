import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_KIND_ICON, newSpaceKinds, type StartableTypeShape } from './new-space-types.ts';

const type = (over: Partial<StartableTypeShape> & { ID: string; Name: string }): StartableTypeShape => ({
    Description: null, IconClass: null, Color: null, DisplayRank: 100, IsActive: true, ...over,
});

describe('the kinds of space the New space dialog offers', () => {
    it('are the active types, by rank and then name', () => {
        const kinds = newSpaceKinds([
            type({ ID: 'c', Name: 'Cohort', DisplayRank: 20 }),
            type({ ID: 'b', Name: 'Board', DisplayRank: 20 }),
            type({ ID: 'w', Name: 'Workspace', DisplayRank: 10 }),
            type({ ID: 'x', Name: 'Retired', DisplayRank: 1, IsActive: false }),
        ]);
        assert.deepEqual(kinds.map((k) => k.id), ['w', 'b', 'c']);
    });

    it('carry the description, and fall back to the default icon and no colour', () => {
        const [plain, styled] = newSpaceKinds([
            type({ ID: 'p', Name: 'Plain', DisplayRank: 1 }),
            type({ ID: 's', Name: 'Styled', DisplayRank: 2, Description: 'A governing body', IconClass: 'fa-solid fa-landmark', Color: '#0076b6' }),
        ]);
        assert.deepEqual(plain, { id: 'p', name: 'Plain', description: '', iconClass: DEFAULT_KIND_ICON, color: '' });
        assert.deepEqual(styled, { id: 's', name: 'Styled', description: 'A governing body', iconClass: 'fa-solid fa-landmark', color: '#0076b6' });
    });

    it('are none when no type is active', () => {
        assert.deepEqual(newSpaceKinds([type({ ID: 'x', Name: 'Retired', IsActive: false })]), []);
    });
});
