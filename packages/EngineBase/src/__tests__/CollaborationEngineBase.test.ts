import { describe, it, beforeEach, expect } from 'vitest';
import { CollaborationEngineBase, COLLABORATION_APP_ID } from '../CollaborationEngineBase.js';
import type {
    mjBizAppsCollaborationSpaceTypeEntity,
    mjBizAppsCollaborationSpaceRoleTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import type { MJApplicationSettingEntity } from '@memberjunction/core-entities';

describe('CollaborationEngineBase (Punch list 2 item 54)', () => {
    let engine: CollaborationEngineBase;

    beforeEach(() => {
        engine = CollaborationEngineBase.Instance;
        // Seed mock state on engine for unit testing without full DB
        const mockTypes: Partial<mjBizAppsCollaborationSpaceTypeEntity>[] = [
            {
                ID: 'TYPE-111',
                Code: 'workspace',
                Name: 'Workspace',
                Configuration: JSON.stringify({
                    StorageAccountID: 'TYPE-STORAGE-1',
                    SpaceOverridable: ['StorageAccountID', 'Chats.WhoCanStart'],
                }),
            },
            {
                ID: 'TYPE-222',
                Code: 'project',
                Name: 'Project',
                Configuration: JSON.stringify({
                    PostCloseAccess: 'None',
                    PostCloseAccessDays: 30,
                }),
            },
        ];

        const mockRoleTypes: Partial<mjBizAppsCollaborationSpaceRoleTypeEntity>[] = [
            {
                ID: 'ROLE-OWNER',
                Code: 'owner',
                Name: 'Owner',
                Level: 40,
                IsOwnerRole: true,
            },
            {
                ID: 'ROLE-MEMBER',
                Code: 'member',
                Name: 'Member',
                Level: 20,
                IsOwnerRole: false,
            },
        ];

        const mockAppSettings: Partial<MJApplicationSettingEntity>[] = [
            {
                ID: 'APP-SETTING-1',
                ApplicationID: COLLABORATION_APP_ID,
                Name: 'CollaborationSettings',
                Value: JSON.stringify({
                    PostCloseAccess: 'ReadOnly',
                    PostCloseAccessDays: null,
                    StorageAccountID: 'DEFAULT-APP-STORAGE',
                    Chats: {
                        WhoCanStart: 'Anyone',
                        AgentReplyMode: 'MentionOrOneToOne',
                        HistoryOnAdd: 'None',
                    },
                    Agents: {
                        ListMode: 'Extend',
                    },
                }),
            },
        ];

        // Assign mock internal state
        (engine as unknown as { _spaceTypes: unknown[] })._spaceTypes = mockTypes;
        (engine as unknown as { _spaceRoleTypes: unknown[] })._spaceRoleTypes = mockRoleTypes;
        (engine as unknown as { _applicationSettings: unknown[] })._applicationSettings = mockAppSettings;
        (engine as unknown as { _authorizations: unknown[] })._authorizations = [];
        (engine as unknown as { _authorizationRoles: unknown[] })._authorizationRoles = [];
        (engine as unknown as { _appAndTypeSpaceAgents: unknown[] })._appAndTypeSpaceAgents = [];
        (engine as unknown as { _appAndTypeSpaceAgentSkills: unknown[] })._appAndTypeSpaceAgentSkills = [];
        (engine as unknown as { _appAndTypeSpaceKnowledgeSources: unknown[] })._appAndTypeSpaceKnowledgeSources = [];

        // Reset indexes
        void (engine as unknown as { AdditionalLoading: () => Promise<void> }).AdditionalLoading();
    });

    it('looks up space types by ID and by code (case-insensitive)', () => {
        const byId = engine.SpaceTypeById('type-111');
        expect(byId).toBeDefined();
        expect(byId?.Code).toBe('workspace');

        const byCode = engine.SpaceTypeByCode('WORKSPACE');
        expect(byCode).toBeDefined();
        expect(byCode?.ID).toBe('TYPE-111');

        expect(engine.SpaceTypeById('non-existent')).toBeUndefined();
        expect(engine.SpaceTypeByCode('non-existent')).toBeUndefined();
    });

    it('looks up space role types by ID and by code', () => {
        const ownerById = engine.SpaceRoleTypeById('role-owner');
        expect(ownerById).toBeDefined();
        expect(ownerById?.Name).toBe('Owner');
        expect(ownerById?.IsOwnerRole).toBe(true);

        const memberByCode = engine.SpaceRoleTypeByCode('member');
        expect(memberByCode).toBeDefined();
        expect(memberByCode?.ID).toBe('ROLE-MEMBER');
    });

    it('reloads and resets lookups when new type row reaches engine without restart', async () => {
        // First lookup establishes memoized maps
        expect(engine.SpaceTypeById('type-333')).toBeUndefined();

        // A new type row is saved / pushed into internal collection
        const newType: Partial<mjBizAppsCollaborationSpaceTypeEntity> = {
            ID: 'TYPE-333',
            Code: 'community',
            Name: 'Community',
        };
        (engine as unknown as { _spaceTypes: unknown[] })._spaceTypes.push(newType);

        // BaseEngine triggers AdditionalLoading on entity save or reload
        await (engine as unknown as { AdditionalLoading: () => Promise<void> }).AdditionalLoading();

        // New row is immediately accessible without a process restart
        const newlyFound = engine.SpaceTypeById('type-333');
        expect(newlyFound).toBeDefined();
        expect(newlyFound?.Code).toBe('community');

        const newlyFoundByCode = engine.SpaceTypeByCode('community');
        expect(newlyFoundByCode).toBeDefined();
        expect(newlyFoundByCode?.ID).toBe('TYPE-333');
    });

    it('reads parsed CollaborationSettings and resolves settings for a space', () => {
        const settings = engine.CollaborationSettings;
        expect(settings.StorageAccountID).toBe('DEFAULT-APP-STORAGE');
        expect(settings.PostCloseAccess).toBe('ReadOnly');

        // Space override with type config
        const resolved = engine.ResolveSettingsForSpace(
            [{ StorageAccountID: 'SPACE-OVERRIDE-STORAGE' }],
            'TYPE-111' // type has SpaceOverridable: ['StorageAccountID']
        );
        expect(resolved.StorageAccountID).toBe('SPACE-OVERRIDE-STORAGE');
        expect(resolved.PostCloseAccess).toBe('ReadOnly'); // from app default
    });

    describe('settings fail closed', () => {
        type Internals = { _spaceTypes: Array<Partial<mjBizAppsCollaborationSpaceTypeEntity>>; _applicationSettings: unknown[] };

        it('refuses to resolve when a space type configuration does not parse', () => {
            const internals = engine as unknown as Internals;
            internals._spaceTypes.push({ ID: 'TYPE-BAD', Code: 'bad', Name: 'Bad', Configuration: '{ not json' });
            expect(() => engine.ResolveSettingsForSpace([], 'TYPE-BAD')).toThrow(/has a configuration that does not parse/);
        });

        it('refuses to resolve when the app settings row does not validate, instead of using it anyway', () => {
            const internals = engine as unknown as Internals;
            const held = internals._applicationSettings;
            internals._applicationSettings = [{
                ApplicationID: 'unused', Application: 'Collaboration', Name: 'CollaborationSettings',
                Value: JSON.stringify({ Chats: { WhoCanStart: 'Owner' } }),
            }];
            (engine as unknown as { _cachedParsedSettings: undefined })._cachedParsedSettings = undefined;
            try {
                expect(() => engine.ResolveSettingsForSpace([], 'TYPE-111')).toThrow(/CollaborationSettings are invalid/);
            } finally {
                internals._applicationSettings = held;
                (engine as unknown as { _cachedParsedSettings: undefined })._cachedParsedSettings = undefined;
            }
        });

        it('refuses to resolve when the app settings row is missing, instead of falling back to defaults', () => {
            const internals = engine as unknown as Internals;
            const held = internals._applicationSettings;
            internals._applicationSettings = [];
            (engine as unknown as { _cachedParsedSettings: undefined })._cachedParsedSettings = undefined;
            try {
                expect(() => engine.ResolveSettingsForSpace([], 'TYPE-111')).toThrow();
            } finally {
                internals._applicationSettings = held;
                (engine as unknown as { _cachedParsedSettings: undefined })._cachedParsedSettings = undefined;
            }
        });

        it('says the same thing on every read of a refused row, and reads a fixed row after a reload', async () => {
            const internals = engine as unknown as Internals;
            const reload = () => (engine as unknown as { AdditionalLoading: () => Promise<void> }).AdditionalLoading();
            const held = internals._applicationSettings;
            const rowWith = (value: string) => [{
                ApplicationID: 'unused', Application: 'Collaboration', Name: 'CollaborationSettings', Value: value,
            }];
            try {
                // An invalid row: both reads name the reasons
                internals._applicationSettings = rowWith(JSON.stringify({ Chats: { WhoCanStart: 'Owner' } }));
                await reload();
                expect(() => engine.CollaborationSettings).toThrow(/CollaborationSettings are invalid/);
                expect(() => engine.CollaborationSettings).toThrow(/CollaborationSettings are invalid/);

                // An unparseable row: both reads say it didn't parse, not that the row is missing
                internals._applicationSettings = rowWith('{ not json');
                await reload();
                expect(() => engine.CollaborationSettings).toThrow(/Failed to parse/);
                expect(() => engine.CollaborationSettings).toThrow(/Failed to parse/);

                // A reload that finds the row missing drops the old row's reasons
                internals._applicationSettings = [];
                await reload();
                expect(() => engine.CollaborationSettings).toThrow(/^(?!.*(invalid|Failed to parse))/s);

                // A reload that finds a good row reads it
                internals._applicationSettings = held;
                await reload();
                expect(engine.CollaborationSettings.PostCloseAccess).toBe('ReadOnly');
            } finally {
                internals._applicationSettings = held;
                await reload();
            }
        });
    });
});
