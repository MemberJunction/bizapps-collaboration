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
        assert.deepEqual(access, { showTab: true, canEdit: false, canChangeLifecycle: true, readOnlyNote: "You can reopen this space, but you can't change its settings while it is closed." });
    });

    it('offers the form without a close button to an owner who may configure but not close', () => {
        assert.deepEqual(settingsAccess({ ...none, canConfigure: true }), { showTab: true, canEdit: true, canChangeLifecycle: false, readOnlyNote: '' });
    });

    it('offers the form and the button to someone who may do both', () => {
        assert.deepEqual(settingsAccess({ ...none, canConfigure: true, canClose: true }), { showTab: true, canEdit: true, canChangeLifecycle: true, readOnlyNote: '' });
        // A closed space is read-only even for someone who may configure it: the form waits for the reopen
        assert.deepEqual(settingsAccess({ ...none, isClosed: true, canConfigure: true, canReopen: true }), { showTab: true, canEdit: false, canChangeLifecycle: true, readOnlyNote: "You can reopen this space, but you can't change its settings while it is closed." });
    });

    it('does not offer Close on a closed space, or Reopen on an open one, whatever the rights say', () => {
        assert.equal(settingsAccess({ ...none, isClosed: true, canClose: true }).canChangeLifecycle, false);
        assert.equal(settingsAccess({ ...none, canReopen: true }).canChangeLifecycle, false);
    });
});

describe('a terminal status (stage 1: Closed moves forward only)', () => {
    it('offers no reopen, whatever the rights say, and says so above the read-only view', () => {
        const access = settingsAccess({ ...none, isClosed: true, isTerminal: true, canConfigure: true, canReopen: true });
        assert.deepEqual(access, { showTab: true, canEdit: false, canChangeLifecycle: false, readOnlyNote: "This space is closed. Closed moves forward only, so nobody brings it back; its settings can't change." });
    });

    it('offers nothing to someone with neither right on a terminal space', () => {
        assert.deepEqual(settingsAccess({ ...none, isClosed: true, isTerminal: true, canReopen: true }), { showTab: false, canEdit: false, canChangeLifecycle: false, readOnlyNote: '' });
    });

    it('still offers the reopen on a closed space whose status is not terminal', () => {
        assert.equal(settingsAccess({ ...none, isClosed: true, isTerminal: false, canReopen: true }).canChangeLifecycle, true);
    });
});
