import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import type { BaseEntity } from '@memberjunction/core';
import { loadWriteContext } from '../dist/load-graph.js';

const USER = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE1';
const SPACE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';
const ROLE = 'B2000001-0000-4000-8000-000000000001';
const TYPE = 'A1000001-0000-4000-8000-000000000001';

const tables = {
    members: [{
        ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE3',
        SpaceID: SPACE,
        UserID: USER,
        Status: 'Active',
        Band: 'Team',
        SpaceRoleTypeID: ROLE,
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
            const context = await loadWriteContext(entity, { ID: USER } as UserInfo, USER, ROLE);
            assert.equal(context.memberships[0]?.role.isOwnerRole, true);
            assert.equal(context.memberships[0]?.role.canInvite, true);
            assert.equal(context.role?.isOwnerRole, true);
        } finally {
            source.GetSystemUser = original;
        }
    });
});
