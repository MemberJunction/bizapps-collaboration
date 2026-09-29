import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detailFields, missingDetails, visibleDetailFields, type DetailFieldShape } from './detail-fields.ts';

const field = (over: Partial<DetailFieldShape> & { Name: string }): DetailFieldShape => ({
    DisplayName: over.Name, IsPrimaryKey: false, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: true, DefaultValue: null, Sequence: 10, ...over,
});

describe("a space subtype's own details", () => {
    const parentNames = new Set(['Name', 'Description', 'SpaceTypeID']);
    const fields: DetailFieldShape[] = [
        field({ Name: 'ID', IsPrimaryKey: true, Sequence: 1 }),
        field({ Name: 'Name', AllowsNull: false, Sequence: 2, IsVirtual: true }),
        field({ Name: 'SpaceType', IsVirtual: true, AllowUpdateAPI: false, Sequence: 3 }),
        field({ Name: 'QuorumPercentage', DisplayName: 'Quorum', AllowsNull: false, DefaultValue: '(50)', Sequence: 6 }),
        field({ Name: 'TermName', DisplayName: 'Term', AllowsNull: false, Sequence: 5 }),
        field({ Name: 'MeetingCadence', DisplayName: 'Meeting cadence', Sequence: 7 }),
        field({ Name: '__mj_CreatedAt', AllowsNull: false, Sequence: 100 }),
    ];

    it('are the columns the subtype adds, in the entity order, without the space\'s own, the key, view-only and audit columns', () => {
        assert.deepEqual(detailFields(fields, parentNames).map((f) => f.name), ['TermName', 'QuorumPercentage', 'MeetingCadence']);
    });

    it('leave out a column that the space owns even when the subtype entity lists it as writable', () => {
        const withName = [...fields, field({ Name: 'Description', Sequence: 4 })];
        assert.ok(!detailFields(withName, parentNames).some((f) => f.name === 'Description'));
    });

    it('carry the display name, and are required only when the column allows no null and has no default', () => {
        const byName = Object.fromEntries(detailFields(fields, parentNames).map((f) => [f.name, f]));
        assert.equal(byName['TermName'].label, 'Term');
        assert.equal(byName['TermName'].required, true);
        assert.equal(byName['QuorumPercentage'].required, false);
        assert.equal(byName['MeetingCadence'].required, false);
    });

    it('count an empty default as no default', () => {
        const [only] = detailFields([field({ Name: 'Stage', AllowsNull: false, DefaultValue: '' })], parentNames);
        assert.equal(only.required, true);
    });

    it('are missing when a required one is empty, blank or unset, and nothing is missing once they are filled in', () => {
        const required = detailFields(fields, parentNames);
        assert.deepEqual(missingDetails(required, () => null).map((f) => f.name), ['TermName']);
        assert.deepEqual(missingDetails(required, (n) => (n === 'TermName' ? '   ' : 'x')).map((f) => f.name), ['TermName']);
        assert.deepEqual(missingDetails(required, (n) => (n === 'TermName' ? '2026' : null)), []);
    });

    it('count zero and false as filled in', () => {
        const required = detailFields([field({ Name: 'Count', AllowsNull: false }), field({ Name: 'Flag', AllowsNull: false })], parentNames);
        assert.deepEqual(missingDetails(required, (n) => (n === 'Count' ? 0 : false)), []);
    });

    it("leave out the fields a UI driver hides, whatever the case, but never a required one", () => {
        const all = detailFields(fields, parentNames);
        assert.deepEqual(visibleDetailFields(all, ['meetingcadence', 'TermName']).map((f) => f.name), ['TermName', 'QuorumPercentage']);
        assert.deepEqual(visibleDetailFields(all, undefined).map((f) => f.name), ['TermName', 'QuorumPercentage', 'MeetingCadence']);
    });
});
