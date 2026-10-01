import { describe, it, beforeEach, expect, vi } from 'vitest';
import { CollaborationAdminEngineBase } from '../CollaborationAdminEngineBase.js';
import { CollaborationEngineBase } from '../CollaborationEngineBase.js';
import type { BaseEnginePropertyConfig, IMetadataProvider } from '@memberjunction/core';

type Row = { ID: string; Name?: string; SpaceTypeID: string | null; SpaceID: string | null };

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
        const agents: Row[] = [
            { ID: 'A-APP', SpaceTypeID: null, SpaceID: null },
            { ID: 'A-TYPE-1', SpaceTypeID: 'type-1', SpaceID: null },
            { ID: 'A-TYPE-1-SPACE', SpaceTypeID: 'type-1', SpaceID: 'space-9' },
        ];
        const skills: Row[] = [{ ID: 'S-APP', SpaceTypeID: null, SpaceID: null }, { ID: 'S-TYPE-1', SpaceTypeID: 'TYPE-1', SpaceID: null }];
        const knowledge: Row[] = [{ ID: 'K-TYPE-2', SpaceTypeID: 'type-2', SpaceID: null }];
        const seeded = engine as unknown as Record<string, unknown>;
        seeded['_appAndTypeSpaceAgents'] = agents;
        seeded['_appAndTypeSpaceAgentSkills'] = skills;
        seeded['_appAndTypeSpaceKnowledgeSources'] = knowledge;
        seeded['_authorizations'] = [{ ID: 'AUTH-1', Name: 'Configure Spaces' }, { ID: 'AUTH-2', Name: 'Administer Spaces' }];
        seeded['_authorizationRoles'] = [];
        seeded['_authorizationsByName'] = null;
    });

    it('the base engine loads only the three entities every seated person reads, and the admin engine the five only staff read', async () => {
        expect(await configuredEntities(CollaborationEngineBase.Instance)).toEqual([
            'MJ_BizApps_Collaboration: Space Types',
            'MJ_BizApps_Collaboration: Space Role Types',
            'MJ: Application Settings',
        ]);
        expect(await configuredEntities(engine)).toEqual([
            'MJ: Authorizations',
            'MJ: Authorization Roles',
            'MJ_BizApps_Collaboration: Space Agents',
            'MJ_BizApps_Collaboration: Space Agent Skills',
            'MJ_BizApps_Collaboration: Space Knowledge Sources',
        ]);
    });

    it('splits the app-level rows from a type-level rows, case-insensitively, and leaves a space-level row out of both', () => {
        expect(engine.AppSpaceAgents.map((a) => a.ID)).toEqual(['A-APP']);
        expect(engine.SpaceAgentsForType('TYPE-1').map((a) => a.ID)).toEqual(['A-TYPE-1']);
        expect(engine.AppSpaceAgentSkills.map((s) => s.ID)).toEqual(['S-APP']);
        expect(engine.SpaceAgentSkillsForType('type-1').map((s) => s.ID)).toEqual(['S-TYPE-1']);
        expect(engine.AppSpaceKnowledgeSources).toEqual([]);
        expect(engine.SpaceKnowledgeSourcesForType('type-2').map((k) => k.ID)).toEqual(['K-TYPE-2']);
    });

    it('finds an authorization by name, case-insensitively, and forgets the index on a reload', async () => {
        expect(engine.AuthorizationByName('configure spaces')?.ID).toBe('AUTH-1');
        (engine as unknown as Record<string, unknown>)['_authorizations'] = [{ ID: 'AUTH-3', Name: 'Configure Spaces' }];
        expect(engine.AuthorizationByName('Configure Spaces')?.ID).toBe('AUTH-1');
        await (engine as unknown as { AdditionalLoading: () => Promise<void> }).AdditionalLoading();
        expect(engine.AuthorizationByName('Configure Spaces')?.ID).toBe('AUTH-3');
    });
});
