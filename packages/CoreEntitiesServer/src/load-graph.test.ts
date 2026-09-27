import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import type { BaseEntity } from '@memberjunction/core';
import { loadMemberReach, loadWriteContext } from '../dist/load-graph.js';

const USER = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE1';
const ASSIGNEE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE4';
const MEMBER_ROLE = '7F565CD3-5E5C-4073-AD3D-55EFE85B0D40';
const SPACE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';
const ROLE = '69090145-C214-4C16-83C5-9D0F1F3B6DE4';
const TYPE = 'C76A0ACA-CBF8-43AD-A996-9296CDA681BE';

const tables = {
    members: [{
        ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE3',
        SpaceID: SPACE,
        UserID: USER,
        Status: 'Active',
        Band: 'Team',
        SpaceRoleTypeID: ROLE,
    }, {
        ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE5',
        SpaceID: SPACE,
        UserID: ASSIGNEE,
        Status: 'Active',
        Band: 'Shared',
        SpaceRoleTypeID: MEMBER_ROLE,
    }],
    roles: [{
        ID: ROLE,
        Level: 40,
        MaxGrantableLevel: 40,
        CanInvite: true,
        CanPromoteBand: true,
        CanSeeTeamBand: true,
        IsOwnerRole: true,
        CanContribute: true,
    }, {
        ID: MEMBER_ROLE,
        Level: 10,
        MaxGrantableLevel: 10,
        CanInvite: false,
        CanPromoteBand: false,
        CanSeeTeamBand: false,
        IsOwnerRole: false,
        CanContribute: true,
    }],
    spaces: [{
        ID: SPACE,
        ParentID: null,
        InheritsMembership: true,
        OwnerID: USER,
        AgentRetrieval: 'Included',
        SpaceTypeID: TYPE,
    }],
    types: [{ ID: TYPE, InviteApproval: 'Approve', MemberCap: null }],
};

function quoted(filter: string, field: string): string | null {
    const match = filter.match(new RegExp(`${field}\\s*=\\s*'([^']+)'`, 'i'));
    return match?.[1] ?? null;
}

function same(left: string, right: string | null): boolean {
    return !!right && left.toLowerCase() === right.toLowerCase();
}

function listed(id: string, filter: string): boolean {
    return filter.toLowerCase().includes(id.toLowerCase());
}

function select(entityName: string, filter = ''): unknown[] {
    if (entityName.endsWith('Space Members')) {
        return tables.members.filter((row) => {
            if (filter.includes('UserID') && !filter.includes('SpaceID')) return same(row.UserID, quoted(filter, 'UserID'));
            if (filter.includes('<>')) return same(row.SpaceID, quoted(filter, 'SpaceID')) && row.Status !== 'Removed';
            if (filter.includes("Status = 'Active'")) return same(row.SpaceID, quoted(filter, 'SpaceID')) && row.Status === 'Active' && listed(row.SpaceRoleTypeID, filter);
            if (filter.includes('UserID')) return same(row.UserID, quoted(filter, 'UserID'));
            return false;
        });
    }
    if (entityName.endsWith('Space Role Types')) {
        if (filter.includes('IsOwnerRole')) return tables.roles.filter((row) => row.IsOwnerRole);
        if (filter.includes('ID IN')) return tables.roles.filter((row) => listed(row.ID, filter));
        return [];
    }
    if (entityName.endsWith('Space Types')) {
        return tables.types.filter((row) => same(row.ID, quoted(filter, 'ID')));
    }
    if (entityName.endsWith('Spaces')) {
        return tables.spaces.filter((row) => same(row.ID, quoted(filter, 'ID')));
    }
    return [];
}

const provider = {
    async RunView(params: { EntityName: string; ExtraFilter?: string }) {
        return { Success: true, Results: select(params.EntityName, params.ExtraFilter ?? '') };
    },
    async RunViews(params: { EntityName: string; ExtraFilter?: string }[]) {
        return params.map((item) => ({ Success: true, Results: select(item.EntityName, item.ExtraFilter ?? '') }));
    },
    GetEntityObject() { return undefined; },
    EntityByID() { return { Name: 'x' }; },
};

describe('loadWriteContext on SQL Server ids', () => {
    it('keeps the owner flag when the database returns uppercase GUIDs', async () => {
        const source = WellKnownUserSource.Instance;
        const original = source.GetSystemUser.bind(source);
        source.GetSystemUser = async () => ({ ID: USER }) as UserInfo;
        try {
            const entity = {
                RunViewProviderToUse: provider,
                ProviderToUse: provider,
            } as unknown as BaseEntity;
            const context = await loadWriteContext(entity, { ID: USER } as UserInfo, SPACE, ROLE);
            assert.equal(context.memberships[0]?.role.isOwnerRole, true);
            assert.equal(context.memberships[0]?.role.canInvite, true);
            assert.equal(context.role?.isOwnerRole, true);
            assert.equal(context.spaces[0]?.id, SPACE.toLowerCase());
            assert.equal(context.spaces[0]?.ownerId, USER.toLowerCase());
            assert.equal(context.ownerCount, 1);
            assert.equal(context.approval, 'Approve');
        } finally {
            source.GetSystemUser = original;
        }
    });
});

describe('loadMemberReach', () => {
    const entity = { RunViewProviderToUse: provider, ProviderToUse: provider } as unknown as BaseEntity;
    const reader = { ID: USER } as UserInfo;

    it('uses the assignee seat and ignores the reader seat', async () => {
        const reach = await loadMemberReach(entity, reader, ASSIGNEE, SPACE);
        assert.equal(reach?.role.canSeeTeamBand, false);
        assert.equal(reach?.role.canContribute, true);
        assert.equal(reach?.userId, ASSIGNEE.toLowerCase());
    });

    it('refuses an assignee with no seat', async () => {
        const reach = await loadMemberReach(entity, reader, 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE9', SPACE);
        assert.equal(reach, null);
    });

    it('refuses a full page instead of deciding on part of the roster', async () => {
        const saved = tables.members;
        tables.members = Array.from({ length: 2000 }, () => saved[1]);
        try {
            await assert.rejects(() => loadMemberReach(entity, reader, ASSIGNEE, SPACE), /full page/);
        } finally {
            tables.members = saved;
        }
    });
});
