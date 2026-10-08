import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_COLLABORATION_SETTINGS } from './configuration.ts';
import { anchorRolesNeeded, bindingSource, bindingSources, boundNames, needsCallerPerson, readSettingsPath, refuseClientValues } from './bindings.ts';

describe('bindingSource', () => {
    it('reads each source the plan names', () => {
        assert.deepEqual(bindingSource('p', { From: 'Anchor:chapter' }), { ok: true, source: { kind: 'anchor', role: 'chapter', field: null } });
        assert.deepEqual(bindingSource('p', { From: 'Anchor:chapter.Region' }), { ok: true, source: { kind: 'anchor', role: 'chapter', field: 'Region' } });
        assert.deepEqual(bindingSource('p', { From: 'Space.PlannedCloseAt' }), { ok: true, source: { kind: 'space', field: 'PlannedCloseAt' } });
        assert.deepEqual(bindingSource('p', { From: 'Space.name' }), { ok: true, source: { kind: 'space', field: 'Name' } });
        assert.deepEqual(bindingSource('p', { From: 'Config:Extensions.example-chapter.Region' }), { ok: true, source: { kind: 'config', path: 'Extensions.example-chapter.Region' } });
        assert.deepEqual(bindingSource('p', { From: 'User.PersonID' }), { ok: true, source: { kind: 'user', field: 'PersonID' } });
        assert.deepEqual(bindingSource('p', { Value: 12 }), { ok: true, source: { kind: 'value', value: 12 } });
    });

    it('refuses what it cannot read: a space column off the list, a nameless anchor role or field, a caller field off the list', () => {
        for (const from of ['Space.Configuration', 'Space.BackgroundImageURL', 'Anchor:', 'Anchor:chapter.', 'Anchor:chapter.Reg ion', 'User.Name', 'Config:', 'Config:Chats..X', 'Nowhere']) {
            const read = bindingSource('p', { From: from as never });
            assert.equal(read.ok, false, from);
            if (!read.ok) assert.match(read.error, /^Binding "p"/);
        }
    });

    it('bindingSources reads them all or names the first bad one; the helpers read the roles and the Person need off them', () => {
        const all = bindingSources({ ChapterID: { From: 'Anchor:chapter' }, Region: { From: 'Anchor:Chapter.Region' }, Who: { From: 'User.PersonID' }, Flag: { Value: true } });
        assert.equal(all.ok, true);
        if (all.ok) {
            assert.deepEqual(anchorRolesNeeded(all.sources), ['chapter']);
            assert.equal(needsCallerPerson(all.sources), true);
        }
        const none = bindingSources({ A: { From: 'Space.ID' } });
        if (none.ok) {
            assert.deepEqual(anchorRolesNeeded(none.sources), []);
            assert.equal(needsCallerPerson(none.sources), false);
        }
        const bad = bindingSources({ A: { From: 'Space.ID' }, B: { From: 'Space.Secret' as never } });
        assert.equal(bad.ok, false);
        assert.deepEqual(bindingSources(null), { ok: true, sources: new Map() });
    });
});

describe('readSettingsPath', () => {
    const settings = { ...DEFAULT_COLLABORATION_SETTINGS, Extensions: { 'example-chapter': { Region: 'West', Caps: [1, 2] } } };
    it('reads scalars down a dotted path and nothing else', () => {
        assert.equal(readSettingsPath(settings, 'Chats.WhoCanStart'), 'Anyone');
        assert.equal(readSettingsPath(settings, 'Extensions.example-chapter.Region'), 'West');
        assert.equal(readSettingsPath(settings, 'StorageAccountID'), null);
        assert.equal(readSettingsPath(settings, 'Chats'), undefined, 'an object is not a value');
        assert.equal(readSettingsPath(settings, 'Extensions.example-chapter.Caps'), undefined, 'a list is not a value');
        assert.equal(readSettingsPath(settings, 'Extensions.example-chapter.Caps.0'), undefined, 'and is not read by index');
        assert.equal(readSettingsPath(settings, 'Nope.Deeper'), undefined);
    });
});

describe('refuseClientValues', () => {
    const bindings = { ChapterID: { From: 'Anchor:chapter' as const } };
    it('refuses a value for a bound name whatever its case, and a value for a name the target lacks', () => {
        assert.match(refuseClientValues({ chapterid: 40 }, bindings, ['ChapterID', 'Month']) ?? '', /bound by the grant/);
        assert.match(refuseClientValues({ Year: 2026 }, bindings, ['ChapterID', 'Month']) ?? '', /no parameter or property named "Year"/);
        assert.equal(refuseClientValues({ Month: 3 }, bindings, ['ChapterID', 'Month']), null);
        assert.equal(refuseClientValues({ Month: 3 }, bindings, null), null, 'unknown target names: only the bound rule applies');
        assert.equal(refuseClientValues(null, bindings, ['ChapterID']), null);
        assert.deepEqual([...boundNames(bindings)], ['chapterid']);
    });
});
