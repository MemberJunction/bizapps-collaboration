import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RoleFlags } from '@mj-biz-apps/collaboration-core';
import { grantableRoles, type RoleChoice } from './grantable-roles.ts';

const role = (Code: string, Name: string, Level: number, over: Partial<RoleChoice> = {}): RoleChoice => ({
    Code, Name, Level, IsActive: true, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: false, ...over,
});
const roles: RoleChoice[] = [
    role('owner', 'Owner', 100, { MaxGrantableLevel: 100, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true }),
    role('admin', 'Admin', 40, { MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, CanContribute: true }),
    role('member', 'Member', 20, { MaxGrantableLevel: 10, CanSeeTeamBand: true, CanContribute: true }),
    role('client-member', 'Outside member', 10, { CanContribute: true }),
    role('guest', 'Guest', 5),
    role('retired', 'Retired', 5, { IsActive: false }),
];
const flags = (over: Partial<RoleFlags>): RoleFlags => ({ level: 20, maxGrantableLevel: 10, canInvite: true, canPromoteBand: false, canSeeTeamBand: true, isOwnerRole: false, canContribute: true, ...over });

describe('the roles a seat may hand out', () => {
    it("gives Sam (a member with ceiling 10) only Outside member and Guest, highest first", () => {
        assert.deepEqual(grantableRoles(roles, flags({})).map((r) => r.code), ['client-member', 'guest']);
    });

    it("gives Casey (an outside admin, ceiling 10, no team band) the same two", () => {
        assert.deepEqual(grantableRoles(roles, flags({ canSeeTeamBand: false })).map((r) => r.code), ['client-member', 'guest']);
    });

    it('gives an owner every active role', () => {
        const owner = flags({ level: 100, maxGrantableLevel: 100, canPromoteBand: true, isOwnerRole: true });
        assert.deepEqual(grantableRoles(roles, owner).map((r) => r.code), ['owner', 'admin', 'member', 'client-member', 'guest']);
    });

    it("leaves out a role below the ceiling that carries a power the grantor lacks", () => {
        const noContribute = flags({ maxGrantableLevel: 20, canContribute: false });
        assert.ok(!grantableRoles(roles, noContribute).some((r) => r.code === 'client-member'));
    });
});
