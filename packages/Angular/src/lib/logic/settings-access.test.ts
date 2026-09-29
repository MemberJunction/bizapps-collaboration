import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { settingsAccess } from './settings-access.ts';

const none = { isClosed: false, canConfigure: false, canClose: false, canReopen: false };

describe('what Settings offers', () => {
    it('offers nothing to someone with no right', () => {
        assert.deepEqual(settingsAccess(none), { showTab: false, canEdit: false, canChangeLifecycle: false, readOnlyNote: '' });
    });

    it('offers Close, read-only, to an owner who holds the lifecycle authorization but not Configure Spaces', () => {
        const access = settingsAccess({ ...none, canClose: true });
        assert.deepEqual(access, { showTab: true, canEdit: false, canChangeLifecycle: true, readOnlyNote: "You can close this space, but you can't change its settings." });
    });

    it('offers Reopen, read-only, on a closed space to an owner who may only reopen', () => {
        const access = settingsAccess({ ...none, isClosed: true, canReopen: true });
        assert.deepEqual(access, { showTab: true, canEdit: false, canChangeLifecycle: true, readOnlyNote: "You can reopen this space, but you can't change its settings." });
    });

    it('offers the form without a close button to an owner who may configure but not close', () => {
        assert.deepEqual(settingsAccess({ ...none, canConfigure: true }), { showTab: true, canEdit: true, canChangeLifecycle: false, readOnlyNote: '' });
    });

    it('offers the form and the button to someone who may do both', () => {
        assert.deepEqual(settingsAccess({ ...none, canConfigure: true, canClose: true }), { showTab: true, canEdit: true, canChangeLifecycle: true, readOnlyNote: '' });
        assert.deepEqual(settingsAccess({ ...none, isClosed: true, canConfigure: true, canReopen: true }), { showTab: true, canEdit: true, canChangeLifecycle: true, readOnlyNote: '' });
    });

    it('does not offer Close on a closed space, or Reopen on an open one, whatever the rights say', () => {
        assert.equal(settingsAccess({ ...none, isClosed: true, canClose: true }).canChangeLifecycle, false);
        assert.equal(settingsAccess({ ...none, canReopen: true }).canChangeLifecycle, false);
    });
});
