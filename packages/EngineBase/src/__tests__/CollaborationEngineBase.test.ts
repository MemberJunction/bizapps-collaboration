import { describe, it, beforeEach, expect } from 'vitest';
import { ResolveSpaceConfiguration, type CollaborationSettings } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngineBase, COLLABORATION_APP_ID, MissingAppSettingsError } from '../CollaborationEngineBase.js';
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
                    Chats: { WhoCanStart: 'Owners' },
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
        expect(settings.Chats?.WhoCanStart).toBe('Anyone');

        // The engine's row is the app level of the one resolver (B16); the type has SpaceOverridable: ['StorageAccountID']
        const type = engine.SpaceTypeById('TYPE-111');
        const resolved = ResolveSpaceConfiguration({
            App: { Settings: settings, Grants: [] },
            Type: { ID: 'TYPE-111', Settings: type?.Configuration ? (JSON.parse(type.Configuration) as CollaborationSettings) : null, Grants: [] },
            Spaces: [{ ID: 'SPACE-1', TypeID: 'TYPE-111', Settings: { StorageAccountID: 'SPACE-OVERRIDE-STORAGE' }, Grants: [] }],
        });
        expect(resolved.Settings.StorageAccountID).toBe('SPACE-OVERRIDE-STORAGE');
        expect(resolved.Settings.Chats.WhoCanStart).toBe('Anyone'); // from app default
    });

    describe('settings fail closed', () => {
        type Internals = { _spaceTypes: Array<Partial<mjBizAppsCollaborationSpaceTypeEntity>>; _applicationSettings: unknown[] };

        it('refuses to resolve when the app settings row does not validate, instead of using it anyway', () => {
            const internals = engine as unknown as Internals;
            const held = internals._applicationSettings;
            internals._applicationSettings = [{
                ApplicationID: 'unused', Application: 'Collaboration', Name: 'CollaborationSettings',
                Value: JSON.stringify({ Chats: { WhoCanStart: 'Owner' } }),
            }];
            (engine as unknown as { _cachedParsedSettings: undefined })._cachedParsedSettings = undefined;
            try {
                expect(() => engine.CollaborationSettings).toThrow(/CollaborationSettings are invalid/);
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
                expect(() => engine.CollaborationSettings).toThrow();
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
                expect(() => engine.CollaborationSettings).toThrow(MissingAppSettingsError);
                expect(() => engine.CollaborationSettings).not.toThrow(/Failed to parse|invalid/);

                // A reload that finds a good row reads it
                internals._applicationSettings = held;
                await reload();
                expect(engine.CollaborationSettings.Chats?.WhoCanStart).toBe('Anyone');
            } finally {
                internals._applicationSettings = held;
                await reload();
            }
        });
    });
});
