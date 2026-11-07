import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detailFields, missingDetails, sectionKeyOf, sectionKeyOfCategory, subtypeFormSections, visibleDetailFields, type DetailFieldShape, type FieldSectionShape } from './detail-fields.ts';

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

describe("a subtype's generated form", () => {
    const col = (Name: string, over: Partial<FieldSectionShape> = {}): FieldSectionShape => ({ Name, IsPrimaryKey: false, Category: null, GeneratedFormSection: 'Details', IncludeInGeneratedForm: true, ...over });
    const own = new Set(['TermName', 'Cadence']);

    it('is keyed the way CodeGen keys a section: the category in camel case, or details', () => {
        assert.equal(sectionKeyOfCategory('Board Details'), 'boardDetails');
        assert.equal(sectionKeyOfCategory('Deal & Stage 2'), 'dealStage2');
        assert.equal(sectionKeyOfCategory('2026 Term'), '_2026Term');
        assert.equal(sectionKeyOf(col('X', { Category: 'Board Details', GeneratedFormSection: 'Category' })), 'boardDetails');
        assert.equal(sectionKeyOf(col('X')), 'details');
        assert.equal(sectionKeyOf(col('X', { GeneratedFormSection: 'Top' })), 'top-area');
        assert.equal(sectionKeyOf(col('X', { IncludeInGeneratedForm: false })), null);
        assert.equal(sectionKeyOf(col('X', { Category: '  ', GeneratedFormSection: 'Category' })), null);
    });

    it("can be shown on its own when the subtype's columns are in sections that hold none of the space's", () => {
        const fields = [
            col('ID', { IsPrimaryKey: true }),
            col('TermName', { Category: 'Board Details', GeneratedFormSection: 'Category' }),
            col('Cadence', { Category: 'Board Details', GeneratedFormSection: 'Category' }),
            col('Name'),
            col('OwnerID'),
            col('__mj_CreatedAt'),
        ];
        assert.deepEqual(subtypeFormSections(fields, own), ['boardDetails']);
    });

    it("can be shown on several sections, each the subtype's alone", () => {
        const fields = [col('TermName', { Category: 'Term', GeneratedFormSection: 'Category' }), col('Cadence', { Category: 'Meetings', GeneratedFormSection: 'Category' }), col('Name')];
        assert.deepEqual(subtypeFormSections(fields, own), ['meetings', 'term']);
    });

    it("cannot when a subtype column shares a section with the space's own (nobody gave it a category), or none is on the form", () => {
        assert.equal(subtypeFormSections([col('TermName'), col('Cadence'), col('Name')], own), null);
        assert.equal(subtypeFormSections([col('TermName', { Category: 'Board Details', GeneratedFormSection: 'Category' }), col('Cadence'), col('Name')], own), null);
        assert.equal(subtypeFormSections([col('TermName', { IncludeInGeneratedForm: false }), col('Name')], own), null);
    });

    it("cannot when a column of the space is in the form's top area, which shows whatever sections are asked for", () => {
        const fields = [col('TermName', { Category: 'Board Details', GeneratedFormSection: 'Category' }), col('Name', { GeneratedFormSection: 'Top' })];
        assert.equal(subtypeFormSections(fields, own), null);
        // A column of the subtype in the top area is the subtype's own: the space has none there
        assert.deepEqual(subtypeFormSections([col('TermName', { GeneratedFormSection: 'Top' }), col('Name')], own), ['top-area']);
    });

    it("leaves out a section that holds only the columns the driver hides, and can't be shown when hidden and shown columns share one", () => {
        const fields = [
            col('TermName', { Category: 'Board Details', GeneratedFormSection: 'Category' }),
            col('QuorumPercentage', { Category: 'Board Details', GeneratedFormSection: 'Category' }),
            col('NextMeetingDate', { Category: 'Next Meeting', GeneratedFormSection: 'Category' }),
            col('NextMeetingLocation', { Category: 'Next Meeting', GeneratedFormSection: 'Category' }),
            col('Name'),
        ];
        const board = new Set(['TermName', 'QuorumPercentage', 'NextMeetingDate', 'NextMeetingLocation']);
        // The driver hides the next meeting: its section goes, and Board Details shows alone
        assert.deepEqual(subtypeFormSections(fields, board, new Set(['nextmeetingdate', 'nextmeetinglocation'])), ['boardDetails']);
        // Hiding one column of a section the others still show: the form can't show it without the hidden one, so no sections
        assert.equal(subtypeFormSections(fields, board, new Set(['quorumpercentage'])), null);
        // Hiding everything: nothing to show as a form
        assert.equal(subtypeFormSections(fields, board, new Set(['termname', 'quorumpercentage', 'nextmeetingdate', 'nextmeetinglocation'])), null);
        // Nothing hidden: both sections, as before
        assert.deepEqual(subtypeFormSections(fields, board), ['boardDetails', 'nextMeeting']);
    });

    it('ignores the key: it is on no section of the form', () => {
        assert.deepEqual(subtypeFormSections([col('ID', { IsPrimaryKey: true }), col('TermName', { Category: 'Board Details', GeneratedFormSection: 'Category' })], new Set(['TermName'])), ['boardDetails']);
    });
});
