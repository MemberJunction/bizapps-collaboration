import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RoleFlags } from '@mj-biz-apps/collaboration-core';
import { seatActions } from './seat-actions.ts';

const role = (over: Partial<RoleFlags>): RoleFlags => ({ level: 20, maxGrantableLevel: 10, canInvite: false, canPromoteBand: false, canSeeTeamBand: true, isOwnerRole: false, canContribute: true, ...over });
const owner = role({ level: 100, maxGrantableLevel: 100, canInvite: true, canPromoteBand: true, isOwnerRole: true });
const sam = role({ canInvite: true });
const guest = role({ level: 5, maxGrantableLevel: 0, canSeeTeamBand: false, canContribute: false });

const target = (status: string, over: { role?: RoleFlags; isOnlyActiveOwner?: boolean } = {}) => ({
    status, role: over.role ?? guest, isOnlyActiveOwner: over.isOnlyActiveOwner ?? false,
});

describe('the seat actions offered', () => {
    it("offers Sam (a member who can invite) no Approve or Change role on a type that holds invites for approval, but Remove", () => {
        const invited = seatActions({ caller: sam, typeApprovesInvites: true, target: target('Invited') });
        assert.deepEqual(invited, { approve: false, remove: true, changeRole: false });
        assert.deepEqual(seatActions({ caller: sam, typeApprovesInvites: true, target: target('Active') }), { approve: false, remove: true, changeRole: false });
    });

    it('offers Sam Approve and Change role on a type that approves automatically', () => {
        assert.equal(seatActions({ caller: sam, typeApprovesInvites: false, target: target('Invited') }).approve, true);
        assert.equal(seatActions({ caller: sam, typeApprovesInvites: false, target: target('Active') }).changeRole, true);
    });

    it('offers an owner Approve, Change role and Remove on a guest', () => {
        assert.deepEqual(seatActions({ caller: owner, typeApprovesInvites: true, target: target('Invited') }), { approve: true, remove: true, changeRole: false });
        assert.deepEqual(seatActions({ caller: owner, typeApprovesInvites: true, target: target('Active') }), { approve: false, remove: true, changeRole: true });
    });

    it("offers nothing on a seat above the viewer's ceiling, or one carrying a power they lack", () => {
        const admin = role({ level: 40, maxGrantableLevel: 40, canInvite: true, canPromoteBand: true });
        assert.deepEqual(seatActions({ caller: sam, typeApprovesInvites: false, target: target('Active', { role: admin }) }), { approve: false, remove: false, changeRole: false });
        const powerful = role({ level: 5, canPromoteBand: true });
        assert.equal(seatActions({ caller: sam, typeApprovesInvites: false, target: target('Active', { role: powerful }) }).remove, false);
    });

    it("hides Remove and Change role on the only active owner seat, whoever is looking, and offers nothing for someone who cannot invite", () => {
        const only = target('Active', { role: owner, isOnlyActiveOwner: true });
        assert.deepEqual(seatActions({ caller: owner, typeApprovesInvites: true, target: only }), { approve: false, remove: false, changeRole: false });
        assert.deepEqual(seatActions({ caller: role({ ...owner }), typeApprovesInvites: false, target: only }), { approve: false, remove: false, changeRole: false });
        assert.deepEqual(seatActions({ caller: role({}), typeApprovesInvites: false, target: target('Active') }), { approve: false, remove: false, changeRole: false });
    });
});
