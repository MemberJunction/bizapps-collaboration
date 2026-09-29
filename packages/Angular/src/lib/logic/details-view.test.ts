import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planDetailsView } from './details-view.ts';

const fields = [
    { name: 'TermName', label: 'Term', required: true },
    { name: 'Cadence', label: 'Cadence', required: false },
];
const noForm = async () => false;
const aForm = async () => true;

describe("how a space's details are drawn", () => {
    it('is nothing when the type\'s UI driver shows none', async () => {
        assert.equal(await planDetailsView({ fields, descriptor: undefined, hasForm: aForm, formSections: ['boardDetails'] }), null);
    });

    it("is the driver's own component when it gives one, without asking for a form", async () => {
        class Own {}
        let asked = 0;
        const view = await planDetailsView({ fields, descriptor: { entityName: 'Boards', component: Own }, hasForm: async () => { asked += 1; return true; }, formSections: ['boardDetails'] });
        assert.deepEqual(view, { presentation: 'component', fields: [], component: Own, formSections: [] });
        assert.equal(asked, 0);
    });

    it('is the subtype\'s form when one is registered, whatever fields the driver hides', async () => {
        const view = await planDetailsView({ fields, descriptor: { entityName: 'Boards', hiddenFieldNames: ['Cadence'] }, hasForm: aForm, formSections: ['boardDetails'] });
        assert.deepEqual(view, { presentation: 'form', fields: [], component: null, formSections: ['boardDetails'] });
    });

    it("is the field list, though a form is registered, when the subtype's columns share a section with the space's (no sections to show alone)", async () => {
        let asked = 0;
        const hasForm = async () => { asked += 1; return true; };
        const none = await planDetailsView({ fields, descriptor: { entityName: 'Boards' }, hasForm, formSections: null });
        assert.equal(none?.presentation, 'fields');
        assert.deepEqual(none?.fields.map((f) => f.name), ['TermName', 'Cadence']);
        assert.equal((await planDetailsView({ fields, descriptor: { entityName: 'Boards' }, hasForm, formSections: [] }))?.presentation, 'fields');
        assert.equal(asked, 0, 'a form is not even asked for');
    });

    it('is a field for each column when there is no form, less the optional ones the driver hides', async () => {
        assert.deepEqual((await planDetailsView({ fields, descriptor: { entityName: 'Boards' }, hasForm: noForm, formSections: ['boardDetails'] }))?.fields.map((f) => f.name), ['TermName', 'Cadence']);
        assert.deepEqual((await planDetailsView({ fields, descriptor: { entityName: 'Boards', hiddenFieldNames: ['cadence', 'TermName'] }, hasForm: noForm, formSections: ['boardDetails'] }))?.fields.map((f) => f.name), ['TermName']);
    });

    it('is nothing when there is no form and no column to show', async () => {
        assert.equal(await planDetailsView({ fields: [], descriptor: { entityName: 'Boards' }, hasForm: noForm, formSections: ['boardDetails'] }), null);
        assert.equal(await planDetailsView({ fields: [{ name: 'Cadence', label: 'Cadence', required: false }], descriptor: { entityName: 'Boards', hiddenFieldNames: ['Cadence'] }, hasForm: noForm, formSections: ['boardDetails'] }), null);
    });
});
