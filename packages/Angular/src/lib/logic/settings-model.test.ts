import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSettingsModel, changedSettings, type SettingsSpaceRow, type SettingsTypeInfo } from './settings-model.ts';

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
