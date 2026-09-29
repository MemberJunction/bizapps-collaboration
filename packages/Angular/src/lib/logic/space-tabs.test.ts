import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SpaceTabDescriptor } from '@mj-biz-apps/collaboration-ng-widgets';
import { buildSpaceTabs, buildSpaceTabsSafely, resolveTabId, tabKey } from './space-tabs.ts';

const allPanels = { MessagingPanel: true, LibraryPanel: true, WorkPanel: true };
const identity = (defaults: SpaceTabDescriptor[]): SpaceTabDescriptor[] => defaults;
const keepLabel = (_key: string, label: string): string => label;
class PapersTab {}
class MeetingsTab {}

describe("a space's tabs", () => {
    it('offers the built-in tabs, in order, when the type has every panel', () => {
        const model = buildSpaceTabs({ panels: allPanels, finalize: identity, labelFor: keepLabel });
        assert.deepEqual(model.tabs.map((t) => t.id), ['Overview', 'Library', 'Work', 'Chat', 'People', 'Settings']);
        assert.equal(model.contributed.size, 0);
    });

    it('shows no Library for a type with LibraryPanel off, even when the driver names it', () => {
        const withLibrary = (defaults: SpaceTabDescriptor[]): SpaceTabDescriptor[] => [...defaults, { key: 'library', label: 'Papers', sortKey: 20 }];
        const model = buildSpaceTabs({ panels: { ...allPanels, LibraryPanel: false }, finalize: withLibrary, labelFor: keepLabel });
        assert.equal(model.tabs.some((t) => tabKey(t.id) === 'library'), false);
        assert.equal(model.tabs.some((t) => t.id === 'Work'), true);
    });

    it("mounts a contributed tab, and keeps the built-in id when the board's own 'overview' names the built-in Overview", () => {
        const board = (defaults: SpaceTabDescriptor[]): SpaceTabDescriptor[] => [
            ...defaults.filter((d) => tabKey(d.key) !== 'overview'),
            { key: 'overview', label: 'Board overview', sortKey: 10 },
            { key: 'papers', label: 'Papers', sortKey: 25, component: PapersTab as never },
        ];
        const model = buildSpaceTabs({ panels: allPanels, finalize: board, labelFor: keepLabel });
        assert.equal(model.tabs.filter((t) => tabKey(t.id) === 'overview').length, 1);
        assert.equal(model.tabs.find((t) => tabKey(t.id) === 'overview')?.id, 'Overview');
        assert.equal(model.tabs.find((t) => t.id === 'Overview')?.label, 'Board overview');
        assert.equal(model.contributed.get('papers'), PapersTab);
        assert.deepEqual(model.tabs.map((t) => t.id).slice(0, 3), ['Overview', 'Library', 'papers']);
    });

    it('drops a tab that names no built-in tab and brings nothing to draw', () => {
        const model = buildSpaceTabs({ panels: allPanels, finalize: (d) => [...d, { key: 'ghost', label: 'Ghost' }], labelFor: keepLabel });
        assert.equal(model.tabs.some((t) => t.id === 'ghost'), false);
    });

    it('relabels a tab from Labels.Tabs whatever the key casing', () => {
        const labels: Record<string, string> = { library: 'Documents' };
        const model = buildSpaceTabs({
            panels: allPanels,
            finalize: identity,
            labelFor: (key, label) => labels[tabKey(key)] ?? label,
        });
        assert.equal(model.tabs.find((t) => t.id === 'Library')?.label, 'Documents');
    });

    it('resolves a deep link to the tab id without regard to case, and by its alias', () => {
        const model = buildSpaceTabs({ panels: allPanels, finalize: (d) => [...d, { key: 'Meetings', label: 'Meetings', component: MeetingsTab as never }], labelFor: keepLabel });
        assert.equal(resolveTabId(model, 'LIBRARY'), 'Library');
        assert.equal(resolveTabId(model, 'discussions'), 'Chat');
        assert.equal(resolveTabId(model, 'meetings'), 'Meetings');
        assert.equal(resolveTabId(model, 'nope'), null);
    });
});

describe('a UI driver that throws', () => {
    it('still gives the space its built-in tabs, and reports the failure', () => {
        const errors: unknown[] = [];
        const model = buildSpaceTabsSafely({
            panels: { ...allPanels, WorkPanel: false },
            finalize: () => { throw new Error('the driver broke'); },
            labelFor: keepLabel,
        }, (e) => errors.push(e));
        assert.equal(errors.length, 1);
        assert.deepEqual(model.tabs.map((tab) => tab.id), ['Overview', 'Library', 'Chat', 'People', 'Settings']);
    });

    it('gives the driver its tabs when it does not throw', () => {
        const model = buildSpaceTabsSafely({ panels: allPanels, finalize: (d) => d.slice(0, 2), labelFor: keepLabel }, () => { throw new Error('unexpected'); });
        assert.deepEqual(model.tabs.map((tab) => tab.id), ['Overview', 'Library']);
    });
});
