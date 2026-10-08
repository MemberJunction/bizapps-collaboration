/**
 * The space status rules (stage 1): the default, which moves a type's attributes allow, and what a status list must look like.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHIPPED_STATUSES, defaultStatus, reachableStatuses, statusAllowsWrites, statusChangeRefusal, validateStatusList } from './statuses.ts';

const by = (code: string) => SHIPPED_STATUSES.find((s) => s.Code === code)!;

describe('the shipped statuses', () => {
    it('are the four Ian named, valid as a list, with Active the default', () => {
        assert.deepEqual(SHIPPED_STATUSES.map((s) => s.Code), ['active', 'paused', 'closed', 'archived']);
        assert.deepEqual(validateStatusList(SHIPPED_STATUSES), []);
        assert.equal(defaultStatus(SHIPPED_STATUSES)?.Code, 'active');
    });

    it('allow writes only in Active, and hide only Archived', () => {
        assert.equal(statusAllowsWrites(by('active')), true);
        for (const code of ['paused', 'closed', 'archived']) assert.equal(statusAllowsWrites(by(code)), false, code);
        assert.deepEqual(SHIPPED_STATUSES.filter((s) => !s.Visible).map((s) => s.Code), ['archived']);
    });
});

describe('statusChangeRefusal', () => {
    it('lets Active and Paused move anywhere, Paused back to Active included', () => {
        assert.equal(statusChangeRefusal(by('active'), by('paused')), null);
        assert.equal(statusChangeRefusal(by('paused'), by('active')), null);
        assert.equal(statusChangeRefusal(by('active'), by('archived')), null);
    });

    it('lets Closed move forward to Archived only: terminal statuses never go back', () => {
        assert.equal(statusChangeRefusal(by('closed'), by('archived')), null);
        assert.equal(statusChangeRefusal(by('closed'), by('active'))?.code, 'terminal-backward');
        assert.equal(statusChangeRefusal(by('closed'), by('paused'))?.code, 'terminal-backward');
        assert.deepEqual(reachableStatuses(by('closed'), SHIPPED_STATUSES).map((s) => s.Code), ['archived']);
    });

    it('freezes Archived, and refuses a move to the same status as a no-op', () => {
        assert.equal(statusChangeRefusal(by('archived'), by('active'))?.code, 'frozen');
        assert.deepEqual(reachableStatuses(by('archived'), SHIPPED_STATUSES), []);
        assert.equal(statusChangeRefusal(by('active'), by('active'))?.code, 'same');
    });
});

describe('validateStatusList', () => {
    it('wants exactly one default, distinct codes and sequences, and no non-terminal status nothing can leave', () => {
        const base = { Name: 'x', ReadOnly: false, Visible: true, AgentRetrieval: true, CanChangeAfter: true, NotifyMembersOnEnter: false, IsTerminal: false };
        assert.equal(validateStatusList([]).length, 1);
        const twoDefaults = [{ ...base, Code: 'a', Sequence: 1, IsDefault: true }, { ...base, Code: 'b', Sequence: 2, IsDefault: true }];
        assert.ok(validateStatusList(twoDefaults).some((e) => /exactly one default/.test(e)));
        const dupes = [{ ...base, Code: 'a', Sequence: 1, IsDefault: true }, { ...base, Code: 'A', Sequence: 1, IsDefault: false }];
        const errors = validateStatusList(dupes);
        assert.ok(errors.some((e) => /used twice/.test(e) && /code/i.test(e)));
        assert.ok(errors.some((e) => /Sequence 1 is used twice/.test(e)));
        const trap = [{ ...base, Code: 'a', Sequence: 1, IsDefault: true }, { ...base, Code: 'stuck', Sequence: 2, IsDefault: false, CanChangeAfter: false }];
        assert.ok(validateStatusList(trap).some((e) => /nothing could ever leave it/.test(e)));
    });
});
