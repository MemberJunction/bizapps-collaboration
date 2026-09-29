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
        assert.equal(await planDetailsView({ fields, descriptor: undefined, hasForm: aForm }), null);
    });

    it("is the driver's own component when it gives one, without asking for a form", async () => {
        class Own {}
        let asked = 0;
        const view = await planDetailsView({ fields, descriptor: { entityName: 'Boards', component: Own }, hasForm: async () => { asked += 1; return true; } });
        assert.deepEqual(view, { presentation: 'component', fields: [], component: Own });
        assert.equal(asked, 0);
    });

    it('is the subtype\'s form when one is registered, whatever fields the driver hides', async () => {
        const view = await planDetailsView({ fields, descriptor: { entityName: 'Boards', hiddenFieldNames: ['Cadence'] }, hasForm: aForm });
        assert.deepEqual(view, { presentation: 'form', fields: [], component: null });
    });

    it('is a field for each column when there is no form, less the optional ones the driver hides', async () => {
        assert.deepEqual((await planDetailsView({ fields, descriptor: { entityName: 'Boards' }, hasForm: noForm }))?.fields.map((f) => f.name), ['TermName', 'Cadence']);
        assert.deepEqual((await planDetailsView({ fields, descriptor: { entityName: 'Boards', hiddenFieldNames: ['cadence', 'TermName'] }, hasForm: noForm }))?.fields.map((f) => f.name), ['TermName']);
    });

    it('is nothing when there is no form and no column to show', async () => {
        assert.equal(await planDetailsView({ fields: [], descriptor: { entityName: 'Boards' }, hasForm: noForm }), null);
        assert.equal(await planDetailsView({ fields: [{ name: 'Cadence', label: 'Cadence', required: false }], descriptor: { entityName: 'Boards', hiddenFieldNames: ['Cadence'] }, hasForm: noForm }), null);
    });
});
