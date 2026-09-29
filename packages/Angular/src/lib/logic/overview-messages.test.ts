import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toOverviewMessages, type OverviewMessageRow } from './overview-messages.ts';

const plain = (text: string): string => text.replace(/@\{[^}]*\}\s*/, '');
const rows: OverviewMessageRow[] = [
    { ID: '2', Role: 'AI', Message: 'Here is the answer', __mj_CreatedAt: '2026-09-29T10:01:00Z' },
    { ID: '1', Role: 'User', Message: '@{"type":"agent","id":"a","name":"Sage"} what changed?', User: 'Bea Client', UserID: 'u-bea', __mj_CreatedAt: '2026-09-29T10:00:00Z' },
];

describe('the Discussion card lines', () => {
    it('shows what was typed, not the stored mention, and reads oldest first', () => {
        const lines = toOverviewMessages(rows, plain, () => false, (iso) => iso);
        assert.deepEqual(lines.map((l) => l.text), ['what changed?', 'Here is the answer']);
    });

    it("draws an outside seat's sender as outside, and staff and the assistant as not", () => {
        const lines = toOverviewMessages(rows, plain, (id) => id === 'u-bea', (iso) => iso);
        assert.equal(lines[0].isOutside, true);
        assert.equal(lines[1].isOutside, false);
        assert.equal(lines[1].isAssistant, true);
    });

    it('keeps the last five', () => {
        const many: OverviewMessageRow[] = Array.from({ length: 8 }, (_, i) => ({ ID: String(i), Role: 'User', Message: `m${i}`, __mj_CreatedAt: 'x' }));
        assert.equal(toOverviewMessages(many, plain, () => false, (i) => i).length, 5);
    });
});
