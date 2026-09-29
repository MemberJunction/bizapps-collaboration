import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applySettingsChanges, buildSettingsModel, changedSettings, SettingsSession, type SettingsSpaceRow, type SettingsTypeInfo } from './settings-model.ts';

const yearType: SettingsTypeInfo = { name: 'Project', icon: 'fa-solid fa-diagram-project', color: '#123456', defaultRetention: 'Year' };

function space(overrides: Partial<SettingsSpaceRow> = {}): SettingsSpaceRow {
    return {
        ID: 'C1000001-0000-4000-8000-000000000002',
        Name: 'Discovery',
        Description: 'Where the work starts',
        SpaceTypeID: '44444444-4444-4444-8444-444444444444',
        IconClass: null,
        Color: null,
        BackgroundImageURL: null,
        InheritsMembership: true,
        AgentRetrieval: 'Included',
        Retention: null,
        ClosedAt: null,
        ...overrides,
    };
}

describe('the Settings model', () => {
    it("shows a space with no retention of its own as its type's default, not as Indefinite", () => {
        const model = buildSettingsModel(space(), yearType);
        assert.equal(model.retention, '');
        assert.equal(model.typeDefaultRetention, 'Year');
    });

    it('shows a retention the space chose', () => {
        assert.equal(buildSettingsModel(space({ Retention: 'Month' }), yearType).retention, 'Month');
    });

    it('takes the icon and color from the type when the space has none', () => {
        const model = buildSettingsModel(space(), yearType);
        assert.equal(model.iconClass, 'fa-solid fa-diagram-project');
        assert.equal(model.color, '#123456');
    });

    it('marks a closed space', () => {
        assert.equal(buildSettingsModel(space({ ClosedAt: new Date() }), yearType).status, 'Closed');
    });
});

describe('what a Settings save writes', () => {
    it('writes nothing for a screen the person did not change', () => {
        const loaded = space();
        const shown = buildSettingsModel(loaded, yearType);
        assert.deepEqual(changedSettings(shown, { ...shown }), {});
    });

    it('keeps Retention null when only the name changes (a rename must not turn the type default into Indefinite)', () => {
        const loaded = space();
        const shown = buildSettingsModel(loaded, yearType);
        const changes = changedSettings(shown, { ...shown, name: 'Discovery, renamed' });
        assert.deepEqual(changes, { Name: 'Discovery, renamed' });
        assert.equal('Retention' in changes, false);
    });

    it('writes a retention the person picked, and null when they go back to the type default', () => {
        const loaded = space({ Retention: 'Month' });
        const shown = buildSettingsModel(loaded, yearType);
        assert.deepEqual(changedSettings(shown, { ...shown, retention: 'Indefinite' }), { Retention: 'Indefinite' });
        assert.deepEqual(changedSettings(shown, { ...shown, retention: '' }), { Retention: null });
    });

    it('clears a background the person emptied', () => {
        const loaded = space({ BackgroundImageURL: 'https://example.test/x.png' });
        const shown = buildSettingsModel(loaded, yearType);
        assert.deepEqual(changedSettings(shown, { ...shown, backgroundImageUrl: '' }), { BackgroundImageURL: null });
    });
});

describe('the Settings session across two saves', () => {
    it("writes only the second edit on the second save, after the form is rebuilt from what the first save wrote", () => {
        const session = new SettingsSession(buildSettingsModel(space(), yearType));

        // First edit: rename, and save
        const firstForm = { ...session.Shown, name: 'Discovery, renamed' };
        const firstCopy = { ...firstForm };
        assert.deepEqual(session.Changes(firstCopy), { Name: 'Discovery, renamed' });
        session.Saved(firstCopy);

        // The tab is left and reopened: the form is rebuilt from what the screen holds, which must be the saved name
        const reopened = { ...session.Shown };
        assert.equal(reopened.name, 'Discovery, renamed');

        // Second edit: only the color. The old name must not be written back.
        const secondForm = { ...reopened, color: '#112233' };
        assert.deepEqual(session.Changes(secondForm), { Color: '#112233' });
    });

    it('does not count an edit made while a save was running as saved', () => {
        const session = new SettingsSession(buildSettingsModel(space(), yearType));
        const copyTakenBeforeTheAwait = { ...session.Shown, name: 'First' };
        const editedDuringTheSave = { ...copyTakenBeforeTheAwait, description: 'typed while saving' };
        session.Saved(copyTakenBeforeTheAwait);
        assert.deepEqual(session.Changes(editedDuringTheSave), { Description: 'typed while saving' });
    });

    it('starts from the new space when another is selected', () => {
        const session = new SettingsSession(buildSettingsModel(space(), yearType));
        session.Saved({ ...session.Shown, name: 'Old space, saved' });
        const other = buildSettingsModel(space({ ID: 'C1000001-0000-4000-8000-000000000003', Name: 'Delivery' }), yearType);
        session.Open(other);
        assert.equal(session.Shown.name, 'Delivery');
        assert.deepEqual(session.Changes({ ...other }), {});
    });
});

describe('writing the changes onto a space', () => {
    it('sets exactly the fields that changed', () => {
        const target = { Name: 'a', Description: 'b', IconClass: 'c', Color: 'd', BackgroundImageURL: null, InheritsMembership: true, AgentRetrieval: 'Included', Retention: null } as Required<Parameters<typeof applySettingsChanges>[0]>;
        applySettingsChanges(target, { Name: 'renamed', Retention: 'Year' });
        assert.equal(target.Name, 'renamed');
        assert.equal(target.Retention, 'Year');
        assert.equal(target.Description, 'b');
        assert.equal(target.Color, 'd');
    });

    it('can set a field to null', () => {
        const target = { Name: 'a', Description: 'b', IconClass: 'c', Color: 'd', BackgroundImageURL: 'x', InheritsMembership: true, AgentRetrieval: 'Included', Retention: 'Year' } as Required<Parameters<typeof applySettingsChanges>[0]>;
        applySettingsChanges(target, { BackgroundImageURL: null, Retention: null });
        assert.equal(target.BackgroundImageURL, null);
        assert.equal(target.Retention, null);
    });
});
