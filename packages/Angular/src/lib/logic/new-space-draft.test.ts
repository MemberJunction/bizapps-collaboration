import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BaseEntity, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { NewSpaceDraft, SpaceDetails } from './space-details.ts';

const USER = { ID: 'user-1' } as UserInfo;
const TYPE = { ID: 'type-1', DefaultInheritsMembership: true };

interface FakeField { Name: string; DisplayNameOrName: string; IsPrimaryKey: boolean; IsVirtual: boolean; AllowUpdateAPI: boolean; AllowsNull: boolean; DefaultValue: string | null; Sequence: number }
const field = (Name: string, over: Partial<FakeField> = {}): FakeField => ({ Name, DisplayNameOrName: Name, IsPrimaryKey: false, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: true, DefaultValue: null, Sequence: 10, ...over });

/** A space and, when given, the subtype `EnsureISAChild` attaches to it. */
function fakeSpace(opts: { child?: { fields: FakeField[]; values: Record<string, unknown> }; saveOk?: boolean; message?: string }) {
    const saved: string[] = [];
    const leaf = {
        Save: async () => { saved.push('leaf'); return opts.saveOk ?? true; },
        Get: (name: string) => opts.child?.values[name],
        LatestResult: { CompleteMessage: opts.message ?? '' },
    };
    const space: Record<string, unknown> = {
        ID: 'space-1',
        NewRecord: () => undefined,
        EnsureISAChild: async () => opts.child ? { EntityInfo: { Fields: opts.child.fields, ParentEntityFieldNames: new Set(['Name', 'Description']) } } : null,
        LeafEntity: opts.child ? leaf : undefined,
        Save: async () => { saved.push('space'); return opts.saveOk ?? true; },
        LatestResult: { CompleteMessage: opts.message ?? '' },
    };
    if (!opts.child) space['LeafEntity'] = space;
    return { space, leaf, saved };
}

function providerOf(space: Record<string, unknown>, seat: Record<string, unknown>): IMetadataProvider {
    return {
        GetEntityObject: async (name: string) => (name.endsWith('Spaces') ? space : seat),
    } as unknown as IMetadataProvider;
}

const seatStub = (ok = true, message = '') => {
    const seat: Record<string, unknown> = { NewRecord: () => undefined, Save: async () => ok, LatestResult: { CompleteMessage: message } };
    return seat;
};

describe('making a new space', () => {
    it('starts as its type, owned by the person, inheriting as the type says, with no detail fields for a plain type', async () => {
        const { space } = fakeSpace({});
        const draft = await NewSpaceDraft.Start(providerOf(space, seatStub()), USER, TYPE);
        assert.equal(space['SpaceTypeID'], 'type-1');
        assert.equal(space['OwnerID'], 'user-1');
        assert.equal(space['InheritsMembership'], true);
        assert.equal(draft.HasDetails, false);
        assert.deepEqual(draft.MissingDetails(), []);
    });

    it("offers a subtype's own fields and reports the required ones still empty", async () => {
        const values: Record<string, unknown> = {};
        const { space } = fakeSpace({ child: { fields: [field('ID', { IsPrimaryKey: true }), field('Name', { IsVirtual: true }), field('TermName', { AllowsNull: false }), field('Cadence')], values } });
        const draft = await NewSpaceDraft.Start(providerOf(space, seatStub()), USER, TYPE);
        assert.deepEqual(draft.DetailFields.map((f) => f.name), ['TermName', 'Cadence']);
        assert.deepEqual(draft.MissingDetails().map((f) => f.name), ['TermName']);
        values['TermName'] = '2026';
        assert.deepEqual(draft.MissingDetails(), []);
    });

    it('saves through the subtype, then seats the person as the owner, in the Team band and Active', async () => {
        const { space, saved } = fakeSpace({ child: { fields: [], values: {} } });
        const seat = seatStub();
        const draft = await NewSpaceDraft.Start(providerOf(space, seat), USER, TYPE);
        const outcome = await draft.Save(providerOf(space, seat), USER, { name: 'Board', description: '', ownerRoleId: 'role-owner' });
        assert.deepEqual(outcome, { status: 'created', spaceId: 'space-1' });
        assert.deepEqual(saved, ['leaf']);
        assert.equal(space['Name'], 'Board');
        assert.equal(space['Description'], null);
        assert.deepEqual([seat['SpaceID'], seat['UserID'], seat['SpaceRoleTypeID'], seat['Band'], seat['Status']], ['space-1', 'user-1', 'role-owner', 'Team', 'Active']);
    });

    it('saves a plain space through itself', async () => {
        const { space, saved } = fakeSpace({});
        const draft = await NewSpaceDraft.Start(providerOf(space, seatStub()), USER, TYPE);
        const outcome = await draft.Save(providerOf(space, seatStub()), USER, { name: 'Ws', description: 'notes', ownerRoleId: 'role-owner' });
        assert.equal(outcome.status, 'created');
        assert.deepEqual(saved, ['space']);
        assert.equal(space['Description'], 'notes');
    });

    it("reports the server's refusal, and seats no one", async () => {
        const { space } = fakeSpace({ saveOk: false, message: 'A board may not sit here.' });
        const seat = seatStub();
        let seatsMade = 0;
        seat['NewRecord'] = () => { seatsMade += 1; };
        const draft = await NewSpaceDraft.Start(providerOf(space, seat), USER, TYPE);
        const outcome = await draft.Save(providerOf(space, seat), USER, { name: 'x', description: '', ownerRoleId: 'role-owner' });
        assert.deepEqual(outcome, { status: 'refused', message: 'A board may not sit here.' });
        assert.equal(seatsMade, 0);
    });

    it('says the space exists when the seat is refused or there is no owner role', async () => {
        const { space } = fakeSpace({});
        const draft = await NewSpaceDraft.Start(providerOf(space, seatStub(false, 'No.')), USER, TYPE);
        const refused = await draft.Save(providerOf(space, seatStub(false, 'No.')), USER, { name: 'x', description: '', ownerRoleId: 'role-owner' });
        assert.deepEqual(refused, { status: 'unseated', spaceId: 'space-1', message: 'The space was created, but you could not be seated as its owner: No.' });
        const noRole = await draft.Save(providerOf(space, seatStub()), USER, { name: 'x', description: '', ownerRoleId: undefined });
        assert.equal(noRole.status, 'unseated');
    });
});

describe("a saved space's details", () => {
    interface FakeLeaf { fields: Record<string, { Dirty: boolean }>; saveOk: boolean; message: string; reverted: number }
    function loadable(opts: { child: boolean; loads?: boolean; leaf?: Partial<FakeLeaf> }) {
        const leaf: FakeLeaf & Record<string, unknown> = { fields: { TermName: { Dirty: false } }, saveOk: true, message: '', reverted: 0, ...opts.leaf };
        const leafEntity = {
            EntityInfo: { Fields: [field('ID', { IsPrimaryKey: true }), field('TermName', { AllowsNull: false })], ParentEntityFieldNames: new Set<string>() },
            GetFieldByName: (name: string) => leaf.fields[name] ?? null,
            Get: (name: string) => (name === 'TermName' ? leaf['term'] : undefined),
            Save: async () => leaf.saveOk,
            Revert: () => { leaf.reverted += 1; return true; },
            LatestResult: { CompleteMessage: leaf.message },
        };
        const space: Record<string, unknown> = { Load: async () => opts.loads ?? true };
        space['LeafEntity'] = opts.child ? leafEntity : space;
        const provider = { GetEntityObject: async () => space } as unknown as IMetadataProvider;
        return { provider, leaf };
    }

    it('are its subtype record and fields when the space has a subtype', async () => {
        const { provider } = loadable({ child: true });
        const details = await SpaceDetails.Load(provider, USER, 'space-1');
        assert.deepEqual(details?.Fields.map((f) => f.name), ['TermName']);
    });

    it('are none for a plain space or one that will not load', async () => {
        assert.equal(await SpaceDetails.Load(loadable({ child: false }).provider, USER, 'space-1'), null);
        assert.equal(await SpaceDetails.Load(loadable({ child: true, loads: false }).provider, USER, 'space-1'), null);
    });

    it('are dirty once a detail field changes, and missing while a required one is empty', async () => {
        const { provider, leaf } = loadable({ child: true });
        const details = (await SpaceDetails.Load(provider, USER, 'space-1'))!;
        assert.equal(details.Dirty, false);
        assert.deepEqual(details.MissingDetails().map((f) => f.name), ['TermName']);
        leaf.fields['TermName'].Dirty = true;
        leaf['term'] = '2026';
        assert.equal(details.Dirty, true);
        assert.deepEqual(details.MissingDetails(), []);
    });

    it('save, or say why not, and are put back on Discard', async () => {
        const ok = (await SpaceDetails.Load(loadable({ child: true }).provider, USER, 'space-1'))!;
        assert.deepEqual(await ok.Save(), { ok: true });
        const { provider, leaf } = loadable({ child: true, leaf: { saveOk: false, message: 'Quorum must be 1 to 100.' } });
        const bad = (await SpaceDetails.Load(provider, USER, 'space-1'))!;
        assert.deepEqual(await bad.Save(), { ok: false, message: 'Quorum must be 1 to 100.' });
        bad.Discard();
        assert.equal(leaf.reverted, 1);
    });
});

// keeps the BaseEntity type in the import list honest for the stubs above
void (null as unknown as BaseEntity);
