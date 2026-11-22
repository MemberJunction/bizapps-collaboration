import { describe, it, beforeEach, expect } from 'vitest';
import { ResolveSpaceConfiguration, type CollaborationSettings } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngineBase, COLLABORATION_APP_ID, MissingAppSettingsError } from '../CollaborationEngineBase.js';
import type {
    mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType,
    mjBizAppsCollaborationSpaceTypeEntity,
    mjBizAppsCollaborationSpaceRoleTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import type { IMetadataProvider, IRunViewProvider, RunViewParams, RunViewResult, UserInfo } from '@memberjunction/core';
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

    describe('LoadSpaceAgentSourceReceiptsForConversation (CR-5 & CR-8)', () => {
        const CONV_UUID = '55555555-5555-4555-8555-555555555555';
        const mockUser = { ID: '88888888-8888-4888-8888-888888888888', Name: 'Reader' } as UserInfo;

        it('rejects malformed or quote-containing conversationId and detailIds with zero RunView calls', async () => {
            let runViewCalls = 0;
            const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
                async RunView<T>(_params: RunViewParams): Promise<RunViewResult<T>> {
                    runViewCalls += 1;
                    return { Success: true, Results: [], UserViewRunID: '', TotalRowCount: 0, RowCount: 0, ExecutionTime: 0, ErrorMessage: '' };
                },
            };
            const provider = providerObj as IMetadataProvider;

            expect(await engine.LoadSpaceAgentSourceReceiptsForConversation("' OR 1=1--", mockUser, provider)).toEqual([]);
            expect(await engine.LoadSpaceAgentSourceReceiptsForConversation('not-a-uuid', mockUser, provider)).toEqual([]);
            expect(await engine.LoadSpaceAgentSourceReceiptsForConversation('', mockUser, provider)).toEqual([]);
            expect(
                await engine.LoadSpaceAgentSourceReceiptsForConversation(CONV_UUID, mockUser, provider, {
                    detailIds: ["11111111-1111-4111-8111-111111111111' OR '1'='1"],
                }),
            ).toEqual([]);
            expect(runViewCalls).toBe(0);
        });

        it('loads >500 receipts across multiple answers using deterministic AfterKey paging without truncation', async () => {
            const totalReceipts = 650;
            const rows: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[] = [];
            for (let i = 0; i < totalReceipts; i++) {
                const answerIndex = Math.floor(i / 50);
                const detailId = `aaaa0000-0000-4000-8000-${String(answerIndex + 1).padStart(12, '0')}`;
                const receiptId = `bbbb0000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
                rows.push({
                    ID: receiptId,
                    SpaceID: '11111111-1111-4111-8111-111111111111',
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: detailId,
                    AgentRunID: null,
                    SourceKind: 'SpaceItem',
                    SpaceItemID: `cccc0000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
                    ContentSourceID: null,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: `Receipt ${i + 1}`,
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: (i % 5) === 0,
                    RetrievalRank: (i % 50) + 1,
                    RelevanceScore: 0.9,
                    RankingMode: 'lexical',
                    CitationOrdinal: (i % 5) === 0 ? 1 : null,
                    EstimatedTokens: 50,
                    WasTruncated: false,
                    Sequence: (i % 50) + 1,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Space',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                });
            }

            const runViewCalls: RunViewParams[] = [];
            const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
                async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                    runViewCalls.push(params);
                    const afterId = params.AfterKey ? String(params.AfterKey.GetValueByFieldName('ID')).toLowerCase() : '';
                    const filtered = afterId ? rows.filter((r) => r.ID.toLowerCase() > afterId) : rows;
                    const page = params.MaxRows ? filtered.slice(0, params.MaxRows) : filtered;
                    return {
                        Success: true,
                        Results: page as Partial<T>[] as T[],
                        UserViewRunID: '',
                        TotalRowCount: page.length,
                        RowCount: page.length,
                        ExecutionTime: 1,
                        ErrorMessage: '',
                    };
                },
            };

            const loaded = await engine.LoadSpaceAgentSourceReceiptsForConversation(
                CONV_UUID,
                mockUser,
                providerObj as IMetadataProvider,
                { pageSize: 200 },
            );

            expect(loaded).toHaveLength(totalReceipts);
            expect(runViewCalls).toHaveLength(4);
            const perAnswerCounts = new Map<string, number>();
            for (const r of loaded) {
                perAnswerCounts.set(r.ConversationDetailID, (perAnswerCounts.get(r.ConversationDetailID) ?? 0) + 1);
            }
            expect(perAnswerCounts.size).toBe(13);
            for (const count of perAnswerCounts.values()) {
                expect(count).toBe(50);
            }
        });
    });
});
