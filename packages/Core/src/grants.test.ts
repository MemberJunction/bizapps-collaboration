/**
 * The pure rules on a space grant (stage 1, B15): what a binding may say, and how far an agent grant's settings may go.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRANT_KIND_ENTITY, GRANT_KINDS, isGrantKind, parseBindingExpression, validateAgentGrantSettings, validateSpaceGrantBindings } from './grants.ts';

describe('grant kinds', () => {
    it("names D27's seven, each with the MJ entity its targets live in", () => {
        assert.equal(GRANT_KINDS.length, 7);
        for (const kind of GRANT_KINDS) assert.ok(GRANT_KIND_ENTITY[kind].startsWith('MJ: '), kind);
        assert.equal(isGrantKind('Agent'), true);
        assert.equal(isGrantKind('Widget'), false);
    });
});

describe('parseBindingExpression', () => {
    it('accepts the six From shapes and a literal Value', () => {
        for (const from of ['Anchor:chapter', 'Space.Name', 'Config:StorageAccountID', 'User.ID', 'User.Email', 'User.PersonID']) {
            assert.deepEqual(parseBindingExpression('p', { From: from }), { ok: true, expression: { From: from } });
        }
        assert.deepEqual(parseBindingExpression('p', { Value: 12 }), { ok: true, expression: { Value: 12 } });
    });

    it('refuses an unknown prefix, a bare prefix, both From and Value, and a non-literal Value', () => {
        assert.equal(parseBindingExpression('p', { From: 'Member.ID' }).ok, false);
        assert.equal(parseBindingExpression('p', { From: 'Anchor:' }).ok, false);
        assert.equal(parseBindingExpression('p', { From: 'User.ID', Value: 1 }).ok, false);
        assert.equal(parseBindingExpression('p', { Value: { nested: true } }).ok, false);
        assert.equal(parseBindingExpression('p', 'User.ID').ok, false);
    });
});

describe('validateSpaceGrantBindings', () => {
    it("checks every key against the target's names when they are known, and only the expressions when they are not", () => {
        const bindings = { ChapterID: { From: 'Anchor:chapter' }, Limit: { Value: 50 } };
        assert.deepEqual(validateSpaceGrantBindings(bindings, ['ChapterID', 'Limit']), []);
        assert.deepEqual(validateSpaceGrantBindings(bindings, null), []);
        const errors = validateSpaceGrantBindings({ Nope: { From: 'User.ID' } }, ['ChapterID']);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /names nothing the target has/);
    });

    it('allows no bindings at all, and refuses a non-object', () => {
        assert.deepEqual(validateSpaceGrantBindings(null, ['x']), []);
        assert.equal(validateSpaceGrantBindings(['a'], null).length, 1);
    });
});

describe('validateAgentGrantSettings', () => {
    const agent = { AcceptsSkills: 'Limited', LimitedSkillIds: ['S1', 's2'], SupportsPlanMode: false, Limits: { MaxCostPerRun: 5, MaxTokensPerRun: null } };

    it('lets a grant narrow the agent: a subset of its skills, lower limits, no plan mode where it has none', () => {
        assert.deepEqual(validateAgentGrantSettings({ Skills: ['s1'], Limits: { MaxCostPerRun: 2, MaxTokensPerRun: 1000 }, PlanMode: 'Off', MemoryWrites: false, EffortLevel: 40 }, agent), []);
        assert.deepEqual(validateAgentGrantSettings({ Skills: 'None' }, agent), []);
        assert.deepEqual(validateAgentGrantSettings(null, agent), []);
    });

    it('refuses what widens: a skill the agent lacks, a limit above its own, plan mode it does not support, a limit MJ has no column for', () => {
        const errors = validateAgentGrantSettings({ Skills: ['S9'], Limits: { MaxCostPerRun: 9, MaxWidgets: 1 }, PlanMode: 'Required' }, agent);
        assert.equal(errors.length, 4, errors.join(' | '));
        assert.ok(errors.some((e) => /does not accept skill S9/.test(e)));
        assert.ok(errors.some((e) => /MaxCostPerRun \(9\) is above the agent's own \(5\)/.test(e)));
        assert.ok(errors.some((e) => /does not support plan mode/.test(e)));
        assert.ok(errors.some((e) => /MaxWidgets is not one of MJ's per-run limits/.test(e)));
    });

    it("judges Skills against AcceptsSkills as MJ reads it: none for None, the catalog for All", () => {
        assert.equal(validateAgentGrantSettings({ Skills: ['S1'] }, { AcceptsSkills: 'None' }).length, 1);
        assert.deepEqual(validateAgentGrantSettings({ Skills: ['S1'] }, { AcceptsSkills: 'All', ActiveSkillIds: ['S1', 'S2'] }), []);
        assert.equal(validateAgentGrantSettings({ Skills: ['S3'] }, { AcceptsSkills: 'All', ActiveSkillIds: ['S1', 'S2'] }).length, 1);
    });
});
