import { describe, it, beforeEach, expect, vi } from 'vitest';
import { CollaborationAdminEngineBase } from '../CollaborationAdminEngineBase.js';
import { CollaborationEngineBase } from '../CollaborationEngineBase.js';
import type { BaseEnginePropertyConfig, IMetadataProvider } from '@memberjunction/core';

type Row = { ID: string; Name?: string; Kind?: string; SpaceTypeID: string | null; SpaceID: string | null };

/** The entity names an engine's Config hands to Load, read by spying on the protected Load. */
async function configuredEntities(engine: CollaborationEngineBase | CollaborationAdminEngineBase): Promise<string[]> {
    const prototype = Object.getPrototypeOf(engine) as { Load: (...args: unknown[]) => Promise<void> };
    const spy = vi.spyOn(prototype, 'Load').mockResolvedValue(undefined);
    try {
        await engine.Config(false, undefined, {} as IMetadataProvider);
        const [params] = spy.mock.calls[0] as [Partial<BaseEnginePropertyConfig>[]];
        return params.map((p) => p.EntityName ?? '');
    } finally {
        spy.mockRestore();
    }
}

describe('CollaborationAdminEngineBase: the staff-only metadata, apart from what every seated person reads', () => {
    let engine: CollaborationAdminEngineBase;

    beforeEach(() => {
        engine = CollaborationAdminEngineBase.Instance;
        const grants: Row[] = [
            { ID: 'A-APP', Kind: 'Agent', SpaceTypeID: null, SpaceID: null },
            { ID: 'A-TYPE-1', Kind: 'Agent', SpaceTypeID: 'type-1', SpaceID: null },
            { ID: 'A-TYPE-1-SPACE', Kind: 'Agent', SpaceTypeID: 'type-1', SpaceID: 'space-9' },
            { ID: 'K-TYPE-2', Kind: 'KnowledgeSource', SpaceTypeID: 'type-2', SpaceID: null },
            { ID: 'Q-APP', Kind: 'Query', SpaceTypeID: null, SpaceID: null },
        ];
        const seeded = engine as unknown as Record<string, unknown>;
        seeded['_appAndTypeSpaceGrants'] = grants;
        seeded['_authorizations'] = [{ ID: 'AUTH-1', Name: 'Configure Spaces' }, { ID: 'AUTH-2', Name: 'Administer Spaces' }];
        seeded['_authorizationRoles'] = [];
        seeded['_authorizationsByName'] = null;
    });

    it('the base engine loads only the four entities every seated person reads, and the admin engine the three only staff read', async () => {
        expect(await configuredEntities(CollaborationEngineBase.Instance)).toEqual([
            'MJ_BizApps_Collaboration: Space Types',
            'MJ_BizApps_Collaboration: Space Type Status',
            'MJ_BizApps_Collaboration: Space Role Types',
            'MJ: Application Settings',
        ]);
        expect(await configuredEntities(engine)).toEqual([
            'MJ: Authorizations',
            'MJ: Authorization Roles',
            'MJ_BizApps_Collaboration: Space Grants',
        ]);
    });

    it('splits the app-level grants from a type-level grants, case-insensitively and by kind, and leaves a space-level row out of both', () => {
        expect(engine.AppSpaceGrants.map((g) => g.ID)).toEqual(['A-APP', 'Q-APP']);
        expect(engine.SpaceGrantsForType('TYPE-1').map((g) => g.ID)).toEqual(['A-TYPE-1']);
        expect(engine.AppGrantsOfKind('Agent').map((g) => g.ID)).toEqual(['A-APP']);
        expect(engine.AppGrantsOfKind('KnowledgeSource')).toEqual([]);
        expect(engine.TypeGrantsOfKind('type-2', 'KnowledgeSource').map((g) => g.ID)).toEqual(['K-TYPE-2']);
        expect(engine.TypeGrantsOfKind('type-1', 'KnowledgeSource')).toEqual([]);
    });

    it('finds an authorization by name, case-insensitively, and forgets the index on a reload', async () => {
        expect(engine.AuthorizationByName('configure spaces')?.ID).toBe('AUTH-1');
        (engine as unknown as Record<string, unknown>)['_authorizations'] = [{ ID: 'AUTH-3', Name: 'Configure Spaces' }];
        expect(engine.AuthorizationByName('Configure Spaces')?.ID).toBe('AUTH-1');
        await (engine as unknown as { AdditionalLoading: () => Promise<void> }).AdditionalLoading();
        expect(engine.AuthorizationByName('Configure Spaces')?.ID).toBe('AUTH-3');
    });
});
