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
        const reloadEngine = (): Promise<void> =>
            (Reflect.get(engine, 'AdditionalLoading') as () => Promise<void>).call(engine);
        Reflect.set(engine, '_spaceTypes', mockTypes);
        Reflect.set(engine, '_spaceRoleTypes', mockRoleTypes);
        Reflect.set(engine, '_applicationSettings', mockAppSettings);

        // Reset indexes
        void reloadEngine();
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
        (Reflect.get(engine, '_spaceTypes') as Partial<mjBizAppsCollaborationSpaceTypeEntity>[]).push(newType);

        // BaseEngine triggers AdditionalLoading on entity save or reload
        await (Reflect.get(engine, 'AdditionalLoading') as () => Promise<void>).call(engine);

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
        type EngineSettingRow = { ApplicationID: string; Application: string; Name: string; Value: string };
        const internals = {
            get _applicationSettings(): EngineSettingRow[] {
                return Reflect.get(engine, '_applicationSettings') as EngineSettingRow[];
            },
            set _applicationSettings(rows: EngineSettingRow[]) {
                Reflect.set(engine, '_applicationSettings', rows);
            },
        };
        const resetCachedSettings = (): void => {
            Reflect.set(engine, '_cachedParsedSettings', undefined);
        };

        it('refuses to resolve when the app settings row does not validate, instead of using it anyway', () => {
            const held = internals._applicationSettings;
            internals._applicationSettings = [{
                ApplicationID: 'unused', Application: 'Collaboration', Name: 'CollaborationSettings',
                Value: JSON.stringify({ Chats: { WhoCanStart: 'Owner' } }),
            }];
            resetCachedSettings();
            try {
                expect(() => engine.CollaborationSettings).toThrow(/CollaborationSettings are invalid/);
            } finally {
                internals._applicationSettings = held;
                resetCachedSettings();
            }
        });

        it('refuses to resolve when the app settings row is missing, instead of falling back to defaults', () => {
            const held = internals._applicationSettings;
            internals._applicationSettings = [];
            resetCachedSettings();
            try {
                expect(() => engine.CollaborationSettings).toThrow();
            } finally {
                internals._applicationSettings = held;
                resetCachedSettings();
            }
        });

        it('says the same thing on every read of a refused row, and reads a fixed row after a reload', async () => {
            const reload = () => (Reflect.get(engine, 'AdditionalLoading') as () => Promise<void>).call(engine);
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
                    if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                        const liveItems = rows.map((r) => ({
                            ID: r.SpaceItemID,
                            SpaceID: r.SpaceID,
                            Band: r.Band,
                        }));
                        return {
                            Success: true,
                            Results: liveItems as Partial<T>[] as T[],
                            UserViewRunID: '',
                            TotalRowCount: liveItems.length,
                            RowCount: liveItems.length,
                            ExecutionTime: 1,
                            ErrorMessage: '',
                        };
                    }
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
            expect(runViewCalls.filter((c) => c.EntityName === 'MJ_BizApps_Collaboration: Space Agent Source Receipts')).toHaveLength(4);
            const perAnswerCounts = new Map<string, number>();
            for (const r of loaded) {
                perAnswerCounts.set(r.ConversationDetailID, (perAnswerCounts.get(r.ConversationDetailID) ?? 0) + 1);
            }
            expect(perAnswerCounts.size).toBe(13);
            for (const count of perAnswerCounts.values()) {
                expect(count).toBe(50);
            }
        });

        it('filters stale receipts when SpaceItem is demoted/moved or KnowledgeSource grant is removed/demoted (CR-1)', async () => {
            const spaceA = '11111111-1111-4111-8111-111111111111';
            const spaceB = '22222222-2222-4222-8222-222222222222';
            const demotedItem = 'cccc0000-0000-4000-8000-000000000001';
            const movedItem = 'cccc0000-0000-4000-8000-000000000002';
            const validItem = 'cccc0000-0000-4000-8000-000000000003';
            const revokedKs = 'dddd0000-0000-4000-8000-000000000004';
            const demotedKs = 'dddd0000-0000-4000-8000-000000000005';
            const validKs = 'dddd0000-0000-4000-8000-000000000006';

            const receiptRows: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[] = [
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000001',
                    SpaceID: spaceA,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'SpaceItem',
                    SpaceItemID: demotedItem,
                    ContentSourceID: null,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Demoted Item',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: true,
                    RetrievalRank: 1,
                    RelevanceScore: 0.9,
                    RankingMode: 'lexical',
                    CitationOrdinal: 1,
                    EstimatedTokens: 50,
                    WasTruncated: false,
                    Sequence: 1,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Space A',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000002',
                    SpaceID: spaceA,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'SpaceItem',
                    SpaceItemID: movedItem,
                    ContentSourceID: null,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Moved Item',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: 2,
                    RelevanceScore: 0.8,
                    RankingMode: 'lexical',
                    CitationOrdinal: null,
                    EstimatedTokens: 50,
                    WasTruncated: false,
                    Sequence: 2,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Space A',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000003',
                    SpaceID: spaceA,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'SpaceItem',
                    SpaceItemID: validItem,
                    ContentSourceID: null,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Valid Shared Item',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: true,
                    RetrievalRank: 3,
                    RelevanceScore: 0.7,
                    RankingMode: 'lexical',
                    CitationOrdinal: 2,
                    EstimatedTokens: 50,
                    WasTruncated: false,
                    Sequence: 3,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Space A',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000004',
                    SpaceID: spaceA,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'KnowledgeSource',
                    SpaceItemID: null,
                    ContentSourceID: revokedKs,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Revoked KS',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null,
                    RelevanceScore: null,
                    RankingMode: 'grant',
                    CitationOrdinal: null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 4,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Space A',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000005',
                    SpaceID: spaceA,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'KnowledgeSource',
                    SpaceItemID: null,
                    ContentSourceID: demotedKs,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Demoted KS',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null,
                    RelevanceScore: null,
                    RankingMode: 'grant',
                    CitationOrdinal: null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 5,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Space A',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000006',
                    SpaceID: spaceA,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'KnowledgeSource',
                    SpaceItemID: null,
                    ContentSourceID: validKs,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Valid Shared KS',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null,
                    RelevanceScore: null,
                    RankingMode: 'grant',
                    CitationOrdinal: null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 6,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Space A',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
            ];

            const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
                async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                    if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                        return {
                            Success: true,
                            Results: [
                                { ID: demotedItem, SpaceID: spaceA, Band: 'Team' },
                                { ID: movedItem, SpaceID: spaceB, Band: 'Shared' },
                                { ID: validItem, SpaceID: spaceA, Band: 'Shared' },
                            ] as Partial<T>[] as T[],
                            UserViewRunID: '',
                            TotalRowCount: 3,
                            RowCount: 3,
                            ExecutionTime: 1,
                            ErrorMessage: '',
                        };
                    }
                    if (params.EntityName === 'MJ_BizApps_Collaboration: Space Grants') {
                        return {
                            Success: false,
                            ErrorMessage: 'Permission denied on Space Grants',
                            Results: [] as T[],
                            UserViewRunID: '',
                            TotalRowCount: 0,
                            RowCount: 0,
                            ExecutionTime: 1,
                        };
                    }
                    return {
                        Success: true,
                        Results: receiptRows as Partial<T>[] as T[],
                        UserViewRunID: '',
                        TotalRowCount: receiptRows.length,
                        RowCount: receiptRows.length,
                        ExecutionTime: 1,
                        ErrorMessage: '',
                    };
                },
            };

            const loaded = await engine.LoadSpaceAgentSourceReceiptsForConversation(
                CONV_UUID,
                mockUser,
                providerObj as IMetadataProvider,
                {
                    activeKnowledgeSourceBandsBySpace: {
                        [spaceA]: {
                            [demotedKs]: 'Team',
                            [validKs]: 'Shared',
                        },
                    },
                },
            );

            expect(loaded.map((r) => r.SourceTitle)).toEqual(['Valid Shared Item', 'Valid Shared KS']);
        });

        it('enforces 3-level same-type hierarchy, ListMode=Replace, SpaceType boundary, and fail-closed Space Grants denial (CR-1)', async () => {
            const typeA = '10000000-0000-4000-8000-000000000001';
            const typeB = '10000000-0000-4000-8000-000000000002';
            const gpId = '20000000-0000-4000-8000-000000000001';
            const parentId = '20000000-0000-4000-8000-000000000002';
            const leafId = '20000000-0000-4000-8000-000000000003';
            const diffParentId = '20000000-0000-4000-8000-000000000004';
            const restartLeafId = '20000000-0000-4000-8000-000000000005';
            const replaceLeafId = '20000000-0000-4000-8000-000000000006';

            const ksGpRemoved = '30000000-0000-4000-8000-000000000001';
            const ksGpTeam = '30000000-0000-4000-8000-000000000002';
            const ksValid = '30000000-0000-4000-8000-000000000003';

            const receipts: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[] = [
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000101',
                    SpaceID: leafId,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'KnowledgeSource',
                    SpaceItemID: null,
                    ContentSourceID: ksGpRemoved,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Removed at Grandparent',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null,
                    RelevanceScore: null,
                    RankingMode: 'grant',
                    CitationOrdinal: null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 1,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Leaf',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000102',
                    SpaceID: leafId,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'KnowledgeSource',
                    SpaceItemID: null,
                    ContentSourceID: ksGpTeam,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Demoted to Team at Grandparent',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null,
                    RelevanceScore: null,
                    RankingMode: 'grant',
                    CitationOrdinal: null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 2,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Leaf',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000103',
                    SpaceID: leafId,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'KnowledgeSource',
                    SpaceItemID: null,
                    ContentSourceID: ksValid,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Valid Shared KS',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null,
                    RelevanceScore: null,
                    RankingMode: 'grant',
                    CitationOrdinal: null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 3,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Leaf',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000104',
                    SpaceID: restartLeafId,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'KnowledgeSource',
                    SpaceItemID: null,
                    ContentSourceID: ksGpRemoved,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Valid Type-Restart KS',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null,
                    RelevanceScore: null,
                    RankingMode: 'grant',
                    CitationOrdinal: null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 4,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Restart Leaf',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
                {
                    ID: 'bbbb0000-0000-4000-8000-000000000105',
                    SpaceID: replaceLeafId,
                    SpaceChatID: '44444444-4444-4444-8444-444444444444',
                    ConversationID: CONV_UUID,
                    ConversationDetailID: 'aaaa0000-0000-4000-8000-000000000001',
                    AgentRunID: null,
                    SourceKind: 'KnowledgeSource',
                    SpaceItemID: null,
                    ContentSourceID: ksValid,
                    TargetEntityID: null,
                    TargetRecordID: null,
                    SourceTitle: 'Cut Off By ListMode Replace',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null,
                    RelevanceScore: null,
                    RankingMode: 'grant',
                    CitationOrdinal: null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 5,
                    __mj_CreatedAt: new Date('2026-11-21T00:00:00Z'),
                    __mj_UpdatedAt: new Date('2026-11-21T00:00:00Z'),
                    Space: 'Replace Leaf',
                    SpaceChat: 'General',
                    Conversation: 'General',
                    ContentSource: null,
                    TargetEntity: null,
                },
            ];

            let denySpaceGrants = false;
            const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
                async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                    if (params.EntityName === 'MJ_BizApps_Collaboration: Space Grants') {
                        if (denySpaceGrants) {
                            return {
                                Success: false,
                                ErrorMessage: 'Permission denied: user does not have read access on MJ_BizApps_Collaboration: Space Grants',
                                Results: [] as T[],
                                UserViewRunID: '',
                                TotalRowCount: 0,
                                RowCount: 0,
                                ExecutionTime: 1,
                            };
                        }
                        return {
                            Success: true,
                            Results: [
                                { ID: '1', SpaceID: null, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetRecordID: ksGpRemoved, Sequence: 1 },
                                { ID: '2', SpaceID: null, SpaceTypeID: typeA, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetRecordID: ksGpTeam, Sequence: 2 },
                                { ID: '3', SpaceID: null, SpaceTypeID: typeA, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetRecordID: ksValid, Sequence: 3 },
                                { ID: '4', SpaceID: gpId, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Remove', Band: 'Shared', TargetRecordID: ksGpRemoved, Sequence: 1 },
                                { ID: '5', SpaceID: gpId, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Team', TargetRecordID: ksGpTeam, Sequence: 2 },
                            ] as Partial<T>[] as T[],
                            UserViewRunID: '',
                            TotalRowCount: 5,
                            RowCount: 5,
                            ExecutionTime: 1,
                            ErrorMessage: '',
                        };
                    }
                    if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                        return {
                            Success: true,
                            Results: [
                                { ID: gpId, ParentID: null, SpaceTypeID: typeA, Configuration: null },
                                { ID: parentId, ParentID: gpId, SpaceTypeID: typeA, Configuration: null },
                                { ID: leafId, ParentID: parentId, SpaceTypeID: typeA, Configuration: null },
                                { ID: diffParentId, ParentID: gpId, SpaceTypeID: typeB, Configuration: null },
                                { ID: restartLeafId, ParentID: diffParentId, SpaceTypeID: typeA, Configuration: null },
                                {
                                    ID: replaceLeafId,
                                    ParentID: parentId,
                                    SpaceTypeID: typeA,
                                    Configuration: JSON.stringify({ Grants: { KnowledgeSource: { ListMode: 'Replace' } } }),
                                },
                            ] as Partial<T>[] as T[],
                            UserViewRunID: '',
                            TotalRowCount: 6,
                            RowCount: 6,
                            ExecutionTime: 1,
                            ErrorMessage: '',
                        };
                    }
                    if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                        return {
                            Success: true,
                            Results: [
                                { ID: typeA, Configuration: JSON.stringify({ SpaceOverridable: ['Grants.KnowledgeSource'] }) },
                                { ID: typeB, Configuration: null },
                            ] as Partial<T>[] as T[],
                            UserViewRunID: '',
                            TotalRowCount: 2,
                            RowCount: 2,
                            ExecutionTime: 1,
                            ErrorMessage: '',
                        };
                    }
                    return {
                        Success: true,
                        Results: receipts as Partial<T>[] as T[],
                        UserViewRunID: '',
                        TotalRowCount: receipts.length,
                        RowCount: receipts.length,
                        ExecutionTime: 1,
                        ErrorMessage: '',
                    };
                },
            };

            // 1. Direct SpaceGrant + SpaceType + full ancestor chain resolution
            const loadedDirect = await engine.LoadSpaceAgentSourceReceiptsForConversation(
                CONV_UUID,
                mockUser,
                providerObj as IMetadataProvider,
            );
            expect(loadedDirect.map((r) => r.SourceTitle)).toEqual(['Valid Shared KS', 'Valid Type-Restart KS']);

            // 2. When Space Grants read is denied and NO server config resolver is available -> fail closed (ZERO KnowledgeSource receipts)
            denySpaceGrants = true;
            const failClosedLoaded = await engine.LoadSpaceAgentSourceReceiptsForConversation(
                CONV_UUID,
                mockUser,
                providerObj as IMetadataProvider,
            );
            expect(failClosedLoaded).toEqual([]);

            // 3. When Space Grants read is denied and GetSpaceConfiguration (via ExecuteGQL) is available -> resolves via server config
            const providerWithGql = {
                ...providerObj,
                async ExecuteGQL(_query: string, variables?: Record<string, string | number | boolean | null>) {
                    const sid = String(variables?.spaceId ?? '').toLowerCase();
                    if (sid === leafId) {
                        return {
                            GetSpaceConfiguration: {
                                Success: true,
                                CanSeeTeam: false,
                                Full: false,
                                ConfigurationJSON: JSON.stringify({
                                    Grants: {
                                        KnowledgeSource: [
                                            { TargetRecordID: ksValid, Band: 'Shared' },
                                            { TargetRecordID: ksGpTeam, Band: 'Team' },
                                        ],
                                    },
                                }),
                            },
                        };
                    }
                    return {
                        GetSpaceConfiguration: {
                            Success: true,
                            CanSeeTeam: false,
                            Full: false,
                            ConfigurationJSON: JSON.stringify({ Grants: { KnowledgeSource: [] } }),
                        },
                    };
                },
            };
            const loadedViaGql = await engine.LoadSpaceAgentSourceReceiptsForConversation(
                CONV_UUID,
                mockUser,
                providerWithGql as Partial<IMetadataProvider> as IMetadataProvider,
            );
            expect(loadedViaGql.map((r) => r.SourceTitle)).toEqual(['Valid Shared KS']);
        });
    });
});
