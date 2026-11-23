import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';
import {
    BaseEntity,
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type TransactionGroupBase,
    type UserInfo,
    type UserRoleInfo,
} from '@memberjunction/core';
import type { EffectiveSpaceConfiguration } from '@mj-biz-apps/collaboration-core';
import {
    COLLABORATION_SPACE_SCOPE_ID,
    COLLABORATION_SPACE_SCOPE_NAME,
    dispatchMultiScopeTurnSearch,
    persistSpaceAgentSourceReceipts,
    resolveTurnKnowledgeScopes,
} from '../dist/index.js';

const SPACE_ID = '11111111-1111-4111-8111-111111111111';
const CHAT_ID = '22222222-2222-4222-8222-222222222222';
const CONV_ID = '33333333-3333-4333-8333-333333333333';
const DETAIL_ID = '44444444-4444-4444-8444-444444444444';
const SYSTEM_USER_ID = '55555555-5555-4555-8555-555555555555';
const CALLER_USER_ID = '66666666-6666-4666-8666-666666666666';
const OTHER_USER_ID = '77777777-7777-4777-8777-777777777777';
const ROLE_PARTICIPANT_ID = '88888888-8888-4888-8888-888888888888';

const CS_POLICY_ID = 'aa000001-0000-4000-8000-000000000001';
const CS_TEAM_ID = 'aa000001-0000-4000-8000-000000000002';
const CS_REVOKED_ID = 'aa000001-0000-4000-8000-000000000003';
const CS_READ_ONLY_ID = 'aa000001-0000-4000-8000-000000000004';
const CS_EXPIRED_ID = 'aa000001-0000-4000-8000-000000000005';
const CS_DENIED_USER_ID = 'aa000001-0000-4000-8000-000000000006';

const SCOPE_POLICY_ID = 'bb000001-0000-4000-8000-000000000001';
const SCOPE_TEAM_ID = 'bb000001-0000-4000-8000-000000000002';
const SCOPE_READ_ONLY_ID = 'bb000001-0000-4000-8000-000000000003';
const SCOPE_EXPIRED_ID = 'bb000001-0000-4000-8000-000000000004';
const SCOPE_DENIED_USER_ID = 'bb000001-0000-4000-8000-000000000005';
const SCOPE_UNGRANTED_ID = 'bb000001-0000-4000-8000-000000000099';

function makeTestUser(id: string, roleIds: string[] = [ROLE_PARTICIPANT_ID]): UserInfo {
    const user: Partial<UserInfo> = {
        ID: id,
        Name: `User ${id.slice(0, 6)}`,
        Email: `${id.slice(0, 6)}@example.test`,
        UserRoles: roleIds.map((rid) => ({ UserID: id, RoleID: rid, Role: 'Role' } as UserRoleInfo)),
    };
    return user as UserInfo;
}

function makeConfiguration(knowledgeGrants: EffectiveSpaceConfiguration['Grants']['KnowledgeSource']): EffectiveSpaceConfiguration {
    return {
        Settings: {
            StorageAccountID: null,
            Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOnly', HistoryOnAdd: 'None' },
            Agents: { ListMode: 'Extend' },
            Labels: {},
            Extensions: {},
        },
        Audience: 'StaffAndParticipants',
        Grants: {
            Agent: [],
            Action: [],
            Query: [],
            View: [],
            Dashboard: [],
            Component: [],
            KnowledgeSource: knowledgeGrants,
        },
        DefaultAgentGrantID: null,
        DataReach: [],
        Chain: [],
        ReplacedKinds: [],
    };
}

describe('CT-3 Granted Extra Knowledge Scopes & Originating Scope Attribution', () => {
    it('resolves zero, single, and multiple granted extra scopes via batched RunView (ResultType: simple) and excludes unauthorized or expired scopes', async () => {
        const recordedCalls: RunViewParams[] = [];
        const caller = makeTestUser(CALLER_USER_ID);
        const system = makeTestUser(SYSTEM_USER_ID, []);

        const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
            Entities: [],
            async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                recordedCalls.push(params);
                assert.equal(params.ResultType, 'simple', `Expected ResultType: 'simple' for ${params.EntityName}`);
                const filter = String(params.ExtraFilter ?? '');
                let rows: object[] = [];

                if (params.EntityName === 'MJ: Content Sources') {
                    const allCs = [
                        { ID: CS_POLICY_ID, Name: 'Organization Policy KB', Configuration: null },
                        { ID: CS_TEAM_ID, Name: 'Internal Operations Runbooks', Configuration: JSON.stringify({ searchScopeId: SCOPE_TEAM_ID }) },
                        { ID: CS_READ_ONLY_ID, Name: 'Read Only KB', Configuration: null },
                        { ID: CS_EXPIRED_ID, Name: 'Expired KB', Configuration: JSON.stringify({ SearchScopeID: SCOPE_EXPIRED_ID }) },
                        { ID: CS_DENIED_USER_ID, Name: 'User Denied KB', Configuration: JSON.stringify({ SearchScopeID: SCOPE_DENIED_USER_ID }) },
                    ];
                    rows = allCs.filter((r) => filter.toLowerCase().includes(r.ID.toLowerCase()));
                } else if (params.EntityName === 'MJ: Search Scope Entities') {
                    if (filter.toLowerCase().includes(CS_READ_ONLY_ID.toLowerCase())) {
                        rows.push({
                            ID: 'sse-ro',
                            SearchScopeID: SCOPE_READ_ONLY_ID,
                            EntityID: 'ent-chunks',
                            ExtraFilter: `ContentSourceID = '${CS_READ_ONLY_ID}'`,
                        });
                    }
                } else if (params.EntityName === 'MJ: Search Scopes') {
                    const allScopes = [
                        { ID: COLLABORATION_SPACE_SCOPE_ID, Name: COLLABORATION_SPACE_SCOPE_NAME, Status: 'Active', IsGlobal: false },
                        { ID: SCOPE_POLICY_ID, Name: 'Organization Policy Scope', Status: 'Active', IsGlobal: false },
                        { ID: SCOPE_TEAM_ID, Name: 'Internal Ops Scope', Status: 'Active', IsGlobal: false },
                        { ID: SCOPE_READ_ONLY_ID, Name: 'Read-Only Catalog Scope', Status: 'Active', IsGlobal: false },
                        {
                            ID: SCOPE_EXPIRED_ID,
                            Name: 'Expired Knowledge Scope',
                            Status: 'Active',
                            IsGlobal: false,
                            EndAt: '2020-01-01T00:00:00Z',
                        },
                        { ID: SCOPE_DENIED_USER_ID, Name: 'Explicitly Denied Scope', Status: 'Active', IsGlobal: false },
                    ];
                    rows = allScopes.filter(
                        (s) => filter.toLowerCase().includes(s.ID.toLowerCase()) || filter.includes('ScopeConfig LIKE'),
                    );
                } else if (params.EntityName === 'MJ: Search Scope Permissions') {
                    const perms = [
                        { ID: 'p1', SearchScopeID: SCOPE_POLICY_ID, UserID: null, RoleID: ROLE_PARTICIPANT_ID, PermissionLevel: 'Search' },
                        { ID: 'p2', SearchScopeID: SCOPE_TEAM_ID, UserID: CALLER_USER_ID, RoleID: null, PermissionLevel: 'Manage' },
                        { ID: 'p3', SearchScopeID: SCOPE_READ_ONLY_ID, UserID: null, RoleID: ROLE_PARTICIPANT_ID, PermissionLevel: 'Read' },
                        { ID: 'p4', SearchScopeID: SCOPE_DENIED_USER_ID, UserID: null, RoleID: ROLE_PARTICIPANT_ID, PermissionLevel: 'Search' },
                        { ID: 'p5', SearchScopeID: SCOPE_DENIED_USER_ID, UserID: CALLER_USER_ID, RoleID: null, PermissionLevel: 'None' },
                    ];
                    rows = perms.filter((p) => filter.toLowerCase().includes(p.SearchScopeID.toLowerCase()));
                }

                return {
                    Success: true,
                    Results: rows as T[],
                    RowCount: rows.length,
                    TotalRowCount: rows.length,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                    UserViewRunID: '',
                };
            },
        };
        const provider = providerObj as IMetadataProvider;

        // 1. Zero granted knowledge sources -> native scope only
        const zeroRes = await resolveTurnKnowledgeScopes({
            provider,
            systemUser: system,
            contextUser: caller,
            configuration: makeConfiguration([]),
            audience: 'Shared',
            primaryScopeRecordId: CHAT_ID,
        });
        assert.deepEqual(zeroRes.searchScopeIds, [COLLABORATION_SPACE_SCOPE_ID]);
        assert.equal(zeroRes.grantedScopes.length, 0);
        assert.equal(zeroRes.nativeScope.scopeName, COLLABORATION_SPACE_SCOPE_NAME);

        // 2. Single granted scope (Shared audience) -> native + 1 extra scope, with Team grant excluded
        recordedCalls.length = 0;
        const grants = [
            {
                GrantID: 'g-policy',
                Kind: 'KnowledgeSource' as const,
                TargetEntityID: 'e-cs',
                TargetRecordID: CS_POLICY_ID,
                Label: 'Org Policy',
                Band: 'Shared' as const,
                IsDefault: false,
                Sequence: 2,
                Bindings: {},
                Settings: { SearchScopeID: SCOPE_POLICY_ID },
                Level: 'Space' as const,
                LevelID: SPACE_ID,
            },
            {
                GrantID: 'g-team',
                Kind: 'KnowledgeSource' as const,
                TargetEntityID: 'e-cs',
                TargetRecordID: CS_TEAM_ID,
                Label: 'Team Ops',
                Band: 'Team' as const,
                IsDefault: false,
                Sequence: 1,
                Bindings: {},
                Settings: null,
                Level: 'Space' as const,
                LevelID: SPACE_ID,
            },
        ];
        const singleShared = await resolveTurnKnowledgeScopes({
            provider,
            systemUser: system,
            contextUser: caller,
            configuration: makeConfiguration(grants),
            audience: 'Shared',
            primaryScopeRecordId: CHAT_ID,
        });
        assert.deepEqual(singleShared.searchScopeIds, [
            COLLABORATION_SPACE_SCOPE_ID,
            SCOPE_POLICY_ID.toLowerCase(),
        ]);
        assert.equal(singleShared.grantedScopes[0]?.scopeName, 'Organization Policy Scope');
        // Verify single batched queries with ID IN (...) rather than N+1 loops
        assert.ok(recordedCalls.some((c) => c.EntityName === 'MJ: Content Sources' && String(c.ExtraFilter).includes('ID IN (')));
        assert.ok(recordedCalls.some((c) => c.EntityName === 'MJ: Search Scopes' && String(c.ExtraFilter).includes('ID IN (')));
        assert.ok(recordedCalls.some((c) => c.EntityName === 'MJ: Search Scope Permissions' && String(c.ExtraFilter).includes('SearchScopeID IN (')));

        // 3. Multiple granted scopes under Team audience + deduplication + unauthorized/expired exclusion
        const multiGrants = [
            ...grants,
            {
                GrantID: 'g-policy-dup',
                Kind: 'KnowledgeSource' as const,
                TargetEntityID: 'e-cs',
                TargetRecordID: CS_POLICY_ID,
                Label: 'Org Policy Duplicate',
                Band: 'Shared' as const,
                IsDefault: false,
                Sequence: 9,
                Bindings: {},
                Settings: { SearchScopeID: SCOPE_POLICY_ID },
                Level: 'Space' as const,
                LevelID: SPACE_ID,
            },
            {
                GrantID: 'g-ro',
                Kind: 'KnowledgeSource' as const,
                TargetEntityID: 'e-cs',
                TargetRecordID: CS_READ_ONLY_ID,
                Label: 'Read Only',
                Band: 'Shared' as const,
                IsDefault: false,
                Sequence: 3,
                Bindings: {},
                Settings: null,
                Level: 'Space' as const,
                LevelID: SPACE_ID,
            },
            {
                GrantID: 'g-exp',
                Kind: 'KnowledgeSource' as const,
                TargetEntityID: 'e-cs',
                TargetRecordID: CS_EXPIRED_ID,
                Label: 'Expired',
                Band: 'Shared' as const,
                IsDefault: false,
                Sequence: 4,
                Bindings: {},
                Settings: null,
                Level: 'Space' as const,
                LevelID: SPACE_ID,
            },
            {
                GrantID: 'g-deny',
                Kind: 'KnowledgeSource' as const,
                TargetEntityID: 'e-cs',
                TargetRecordID: CS_DENIED_USER_ID,
                Label: 'User Denied',
                Band: 'Shared' as const,
                IsDefault: false,
                Sequence: 5,
                Bindings: {},
                Settings: null,
                Level: 'Space' as const,
                LevelID: SPACE_ID,
            },
        ];

        const multiTeam = await resolveTurnKnowledgeScopes({
            provider,
            systemUser: system,
            contextUser: caller,
            configuration: makeConfiguration(multiGrants),
            audience: 'Team',
            primaryScopeRecordId: CHAT_ID,
        });
        assert.deepEqual(
            multiTeam.searchScopeIds,
            [
                COLLABORATION_SPACE_SCOPE_ID,
                SCOPE_TEAM_ID.toLowerCase(),
                SCOPE_POLICY_ID.toLowerCase(),
            ],
            'Ordered deterministically by grant Sequence, deduplicated, and excluding Read-only / Expired / Explicit None deny',
        );
        assert.ok(multiTeam.rejectedScopes.some((r) => r.scopeId === SCOPE_READ_ONLY_ID));
        assert.ok(multiTeam.rejectedScopes.some((r) => r.scopeId === SCOPE_EXPIRED_ID));
        assert.ok(multiTeam.rejectedScopes.some((r) => r.scopeId === SCOPE_DENIED_USER_ID));

        // 4. Audience intersection: another participant lacking Search permission on SCOPE_POLICY_ID excludes it
        const outsiderNoScope = makeTestUser(OTHER_USER_ID, ['00000000-0000-4000-8000-000000000999']);
        const audienceChecked = await resolveTurnKnowledgeScopes({
            provider,
            systemUser: system,
            contextUser: caller,
            configuration: makeConfiguration(grants),
            audience: 'Shared',
            audienceUsers: [caller, outsiderNoScope],
            primaryScopeRecordId: CHAT_ID,
        });
        assert.deepEqual(audienceChecked.searchScopeIds, [COLLABORATION_SPACE_SCOPE_ID]);
        assert.equal(audienceChecked.grantedScopes.length, 0);

        // 5. Duplicate ContentSource grants with Shared vs Team bands: last/highest-sequence effective grant wins,
        // matching ResolveSpaceConfiguration / resolveEffectiveKnowledgeSourceBandsBySpace and SQL fnEffectiveKnowledgeSourceGrants
        const duplicateSharedThenTeam = [
            {
                GrantID: 'g-dup-1',
                Kind: 'KnowledgeSource' as const,
                TargetEntityID: 'e-cs',
                TargetRecordID: CS_POLICY_ID,
                Label: 'Shared First',
                Band: 'Shared' as const,
                IsDefault: false,
                Sequence: 1,
                Bindings: {},
                Settings: { SearchScopeID: SCOPE_POLICY_ID },
                Level: 'Space' as const,
                LevelID: SPACE_ID,
            },
            {
                GrantID: 'g-dup-2',
                Kind: 'KnowledgeSource' as const,
                TargetEntityID: 'e-cs',
                TargetRecordID: CS_POLICY_ID,
                Label: 'Team Override',
                Band: 'Team' as const,
                IsDefault: false,
                Sequence: 2,
                Bindings: {},
                Settings: { SearchScopeID: SCOPE_POLICY_ID },
                Level: 'Space' as const,
                LevelID: SPACE_ID,
            },
        ];
        const dupSharedChat = await resolveTurnKnowledgeScopes({
            provider,
            systemUser: system,
            contextUser: caller,
            configuration: makeConfiguration(duplicateSharedThenTeam),
            audience: 'Shared',
            primaryScopeRecordId: CHAT_ID,
        });
        assert.deepEqual(dupSharedChat.searchScopeIds, [COLLABORATION_SPACE_SCOPE_ID]);

        const dupTeamChat = await resolveTurnKnowledgeScopes({
            provider,
            systemUser: system,
            contextUser: caller,
            configuration: makeConfiguration(duplicateSharedThenTeam),
            audience: 'Team',
            primaryScopeRecordId: CHAT_ID,
        });
        assert.equal(dupTeamChat.maxBandByContentSourceId.get(CS_POLICY_ID.toLowerCase()), 'Team');
        assert.equal(dupTeamChat.scopeByContentSourceId.get(CS_POLICY_ID.toLowerCase())?.maxBand, 'Team');

        const duplicateTeamThenShared = [
            { ...duplicateSharedThenTeam[1], Sequence: 1 },
            { ...duplicateSharedThenTeam[0], Sequence: 2 },
        ];
        const dupDemotedTeamChat = await resolveTurnKnowledgeScopes({
            provider,
            systemUser: system,
            contextUser: caller,
            configuration: makeConfiguration(duplicateTeamThenShared),
            audience: 'Team',
            primaryScopeRecordId: CHAT_ID,
        });
        assert.equal(dupDemotedTeamChat.maxBandByContentSourceId.get(CS_POLICY_ID.toLowerCase()), 'Shared');
        assert.equal(dupDemotedTeamChat.scopeByContentSourceId.get(CS_POLICY_ID.toLowerCase())?.maxBand, 'Shared');
    });

    it('dispatches bounded multi-scope searches, drops ungranted scope hits fail-closed, and records OriginatingScopeName on receipts via TransactionGroup', async () => {
        const caller = makeTestUser(CALLER_USER_ID);
        const system = makeTestUser(SYSTEM_USER_ID, []);

        const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
            Entities: [],
            EntityByName(name: string): EntityInfo | undefined {
                if (name === 'MJ: Content Sources') {
                    return { ID: 'e-cs-id', Name: name } as Partial<EntityInfo> as EntityInfo;
                }
                return undefined;
            },
            async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                if (params.EntityName === 'MJ: Content Sources') {
                    return {
                        Success: true,
                        Results: [{ ID: CS_POLICY_ID, Name: 'Organization Policy KB', Configuration: null }] as T[],
                        RowCount: 1,
                        TotalRowCount: 1,
                        ExecutionTime: 1,
                        ErrorMessage: '',
                        UserViewRunID: '',
                    };
                }
                if (params.EntityName === 'MJ: Search Scopes') {
                    return {
                        Success: true,
                        Results: [
                            { ID: COLLABORATION_SPACE_SCOPE_ID, Name: COLLABORATION_SPACE_SCOPE_NAME, Status: 'Active', IsGlobal: false },
                            { ID: SCOPE_POLICY_ID, Name: 'Organization Policy Scope', Status: 'Active', IsGlobal: false },
                        ] as T[],
                        RowCount: 2,
                        TotalRowCount: 2,
                        ExecutionTime: 1,
                        ErrorMessage: '',
                        UserViewRunID: '',
                    };
                }
                if (params.EntityName === 'MJ: Search Scope Permissions') {
                    return {
                        Success: true,
                        Results: [
                            { ID: 'p1', SearchScopeID: SCOPE_POLICY_ID, UserID: CALLER_USER_ID, RoleID: null, PermissionLevel: 'Search' },
                        ] as T[],
                        RowCount: 1,
                        TotalRowCount: 1,
                        ExecutionTime: 1,
                        ErrorMessage: '',
                        UserViewRunID: '',
                    };
                }
                return {
                    Success: true,
                    Results: [] as T[],
                    RowCount: 0,
                    TotalRowCount: 0,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                    UserViewRunID: '',
                };
            },
        };
        const provider = providerObj as IMetadataProvider;

        const resolved = await resolveTurnKnowledgeScopes({
            provider,
            systemUser: system,
            contextUser: caller,
            configuration: makeConfiguration([
                {
                    GrantID: 'g-policy',
                    Kind: 'KnowledgeSource',
                    TargetEntityID: 'e-cs',
                    TargetRecordID: CS_POLICY_ID,
                    Label: 'Org Policy',
                    Band: 'Shared',
                    IsDefault: false,
                    Sequence: 1,
                    Bindings: {},
                    Settings: { SearchScopeID: SCOPE_POLICY_ID },
                    Level: 'Space',
                    LevelID: SPACE_ID,
                },
            ]),
            audience: 'Shared',
            primaryScopeRecordId: CHAT_ID,
        });

        let capturedScopeIds: string[] | undefined;
        let capturedMaxResults: number | undefined;
        const dispatchResult = await dispatchMultiScopeTurnSearch(
            {
                query: 'retention policy',
                spaceId: SPACE_ID,
                spaceChatId: CHAT_ID,
                maxResults: 100, // should be clamped cleanly by bounded cap
                nativeScope: resolved.nativeScope,
                grantedScopes: resolved.grantedScopes,
                scopeById: resolved.scopeById,
                scopeByContentSourceId: resolved.scopeByContentSourceId,
                contentSourceNamesById: resolved.contentSourceNamesById,
                maxBandByContentSourceId: resolved.maxBandByContentSourceId,
                searchScopeIds: resolved.searchScopeIds,
                contextUser: caller,
                provider,
            },
            async (searchParams) => {
                capturedScopeIds = searchParams.ScopeIDs;
                capturedMaxResults = searchParams.MaxResults;
                return {
                    Success: true,
                    Results: [
                        {
                            EntityName: 'MJ_BizApps_Collaboration: Space Items',
                            RecordID: '99990000-0000-4000-8000-000000000001',
                            Title: 'Discovery Charter',
                            Score: 0.85,
                            SourceType: 'lexical',
                            OriginatingScopeID: COLLABORATION_SPACE_SCOPE_ID,
                            OriginatingScopeName: 'Collaboration Space Scope',
                        },
                        {
                            EntityName: 'MJ: Content Item Chunks',
                            RecordID: '99990000-0000-4000-8000-000000000002',
                            Title: 'Data Retention Clause 4.2',
                            Snippet: 'Records must be retained for 7 years.',
                            Score: 0.93,
                            SourceType: 'vector',
                            RawMetadata: { ContentSourceID: CS_POLICY_ID },
                            OriginatingScopeID: SCOPE_POLICY_ID,
                            OriginatingScopeName: 'Organization Policy Scope',
                        },
                        {
                            EntityName: 'MJ: Content Item Chunks',
                            RecordID: '99990000-0000-4000-8000-000000000099',
                            Title: 'Ungranted Secret Doc',
                            Score: 0.99,
                            SourceType: 'vector',
                            OriginatingScopeID: SCOPE_UNGRANTED_ID,
                            OriginatingScopeName: 'Ungranted Scope',
                        },
                    ],
                };
            },
        );

        assert.deepEqual(capturedScopeIds, [COLLABORATION_SPACE_SCOPE_ID, SCOPE_POLICY_ID.toLowerCase()]);
        assert.ok((capturedMaxResults ?? 0) <= 20, 'Enforces bounded combined top-K cap');
        assert.equal(dispatchResult.nativeToolHits.length, 1);
        assert.equal(dispatchResult.extraKnowledgeCandidates.length, 1);
        assert.equal(dispatchResult.extraKnowledgeCandidates[0]?.originatingScopeId, SCOPE_POLICY_ID.toLowerCase());
        assert.equal(dispatchResult.extraKnowledgeCandidates[0]?.originatingScopeName, 'Organization Policy Scope');
        assert.equal(dispatchResult.grantedKnowledgeHits.length, 1);
        assert.equal(dispatchResult.grantedKnowledgeHits[0]?.scopeName, 'Organization Policy Scope');
        assert.equal(
            dispatchResult.extraKnowledgeCandidates.some((c) => c.originatingScopeName === 'Ungranted Scope'),
            false,
            'Ungranted scope hits must be dropped fail-closed',
        );

        // Verify TransactionGroup batching + OriginatingScopeID/OriginatingScopeName persistence
        let tgSubmitted = 0;
        const savedRows: Array<{
            ID: string;
            OriginatingScopeID: string | null;
            OriginatingScopeName: string | null;
            TransactionGroup: TransactionGroupBase | null;
        }> = [];
        const tgProviderObj: Partial<IMetadataProvider & IRunViewProvider> = {
            Entities: [],
            async RunView<T>(): Promise<RunViewResult<T>> {
                return { Success: true, Results: [] as T[], RowCount: 0, TotalRowCount: 0, ExecutionTime: 1, ErrorMessage: '', UserViewRunID: '' };
            },
            async CreateTransactionGroup(): Promise<TransactionGroupBase> {
                const tg: Partial<TransactionGroupBase> = {
                    async Submit() {
                        tgSubmitted += 1;
                        return true;
                    },
                };
                return tg as TransactionGroupBase;
            },
            async GetEntityObject<T extends BaseEntity>(): Promise<T> {
                const entityState = {
                    ID: `rec-${savedRows.length + 1}`,
                    SpaceID: SPACE_ID,
                    SpaceChatID: CHAT_ID,
                    ConversationID: CONV_ID,
                    ConversationDetailID: DETAIL_ID,
                    AgentRunID: null as string | null,
                    SourceKind: 'SpaceItem',
                    SpaceItemID: null as string | null,
                    ContentSourceID: null as string | null,
                    TargetEntityID: null as string | null,
                    TargetRecordID: null as string | null,
                    SourceTitle: '',
                    Band: 'Shared',
                    WasSupplied: true,
                    WasCited: false,
                    RetrievalRank: null as number | null,
                    RelevanceScore: null as number | null,
                    RankingMode: 'none',
                    CitationOrdinal: null as number | null,
                    EstimatedTokens: 0,
                    WasTruncated: false,
                    Sequence: 1,
                    OriginatingScopeID: null as string | null,
                    OriginatingScopeName: null as string | null,
                    TransactionGroup: null as TransactionGroupBase | null,
                    NewRecord() {
                        return true;
                    },
                    async Load() {
                        return true;
                    },
                    async Save() {
                        savedRows.push({
                            ID: entityState.ID,
                            OriginatingScopeID: entityState.OriginatingScopeID,
                            OriginatingScopeName: entityState.OriginatingScopeName,
                            TransactionGroup: entityState.TransactionGroup,
                        });
                        return true;
                    },
                };
                return entityState as object as T;
            },
        };

        const persisted = await persistSpaceAgentSourceReceipts({
            provider: tgProviderObj as IMetadataProvider,
            systemUser: system,
            turnUserId: CALLER_USER_ID,
            spaceChatId: CHAT_ID,
            conversationId: CONV_ID,
            conversationDetailId: DETAIL_ID,
            receipts: [
                {
                    sourceKind: 'SpaceItem',
                    spaceId: SPACE_ID,
                    spaceItemId: '99990000-0000-4000-8000-000000000001',
                    contentSourceId: null,
                    targetEntityId: 'e-si',
                    targetRecordId: '99990000-0000-4000-8000-000000000001',
                    sourceTitle: 'Discovery Charter',
                    band: 'Shared',
                    wasSupplied: true,
                    wasCited: true,
                    retrievalRank: 1,
                    relevanceScore: 0.85,
                    rankingMode: 'lexical',
                    citationOrdinal: 1,
                    estimatedTokens: 20,
                    wasTruncated: false,
                    sequence: 1,
                    originatingScopeId: COLLABORATION_SPACE_SCOPE_ID,
                    originatingScopeName: 'Collaboration Space Scope',
                },
                {
                    ...dispatchResult.extraKnowledgeCandidates[0]!,
                    wasSupplied: true,
                    wasCited: true,
                    citationOrdinal: 2,
                    sequence: 2,
                    originatingScopeId: SCOPE_POLICY_ID,
                    originatingScopeName: 'Organization Policy Scope',
                },
            ],
        });

        assert.equal(persisted.ok, true);
        assert.equal(tgSubmitted, 1, 'Multiple source receipts batch via TransactionGroup');
        assert.equal(savedRows.length, 2);
        assert.ok(savedRows.every((r) => r.TransactionGroup !== null), 'Every queued entity receives the TransactionGroup');
        assert.equal(savedRows[0]?.OriginatingScopeName, 'Collaboration Space Scope');
        assert.equal(savedRows[1]?.OriginatingScopeName, 'Organization Policy Scope');
    });

    it('drops hits with an explicit ungranted ContentSourceID on a composite SearchScope while falling back when ContentSourceID is omitted or null', async () => {
        const caller = makeTestUser(CALLER_USER_ID);
        const compositeScopeId = 'bb000001-0000-4000-8000-000000000050';
        const csExcludedId = 'aa000001-0000-4000-8000-000000000099';
        const csFirstId = CS_POLICY_ID.toLowerCase();
        const csSecondId = CS_TEAM_ID.toLowerCase();

        const compositeScope = {
            scopeId: compositeScopeId,
            scopeName: 'Composite Shared Knowledge Scope',
            maxBand: 'Shared' as const,
            contentSourceIds: [csFirstId, csSecondId],
            contentSourceNamesById: new Map<string, string>([
                [csFirstId, 'Organization Policy KB'],
                [csSecondId, 'Internal Operations Runbooks'],
            ]),
            sequence: 1,
        };

        const providerObj: Partial<IMetadataProvider> = {
            Entities: [],
            EntityByName(name: string): EntityInfo | undefined {
                if (name === 'MJ: Content Sources') {
                    return { ID: 'e-cs-id', Name: name } as Partial<EntityInfo> as EntityInfo;
                }
                return undefined;
            },
        };

        const dispatchResult = await dispatchMultiScopeTurnSearch(
            {
                query: 'incident checklist',
                spaceId: SPACE_ID,
                spaceChatId: CHAT_ID,
                maxResults: 10,
                nativeScope: {
                    scopeId: COLLABORATION_SPACE_SCOPE_ID,
                    scopeName: COLLABORATION_SPACE_SCOPE_NAME,
                },
                grantedScopes: [compositeScope],
                scopeById: new Map([[compositeScopeId, compositeScope]]),
                scopeByContentSourceId: new Map([
                    [csFirstId, compositeScope],
                    [csSecondId, compositeScope],
                ]),
                contentSourceNamesById: compositeScope.contentSourceNamesById,
                maxBandByContentSourceId: new Map([
                    [csFirstId, 'Shared' as const],
                    [csSecondId, 'Shared' as const],
                ]),
                searchScopeIds: [COLLABORATION_SPACE_SCOPE_ID, compositeScopeId],
                contextUser: caller,
                provider: providerObj as IMetadataProvider,
            },
            async () => ({
                Success: true,
                Results: [
                    {
                        EntityName: 'MJ: Content Item Chunks',
                        RecordID: '99990000-0000-4000-8000-000000000101',
                        Title: 'Excluded Content Source Hit',
                        Snippet: 'Should be dropped rather than attributed to sibling ContentSource.',
                        Score: 0.98,
                        SourceType: 'vector',
                        RawMetadata: { ContentSourceID: csExcludedId },
                        OriginatingScopeID: compositeScopeId,
                        OriginatingScopeName: 'Composite Shared Knowledge Scope',
                    },
                    {
                        EntityName: 'MJ: Content Item Chunks',
                        RecordID: '99990000-0000-4000-8000-000000000102',
                        Title: 'Second Granted Source Hit',
                        Snippet: 'Explicitly matched second ContentSource in composite scope.',
                        Score: 0.91,
                        SourceType: 'vector',
                        RawMetadata: { ContentSourceID: csSecondId },
                        OriginatingScopeID: compositeScopeId,
                        OriginatingScopeName: 'Composite Shared Knowledge Scope',
                    },
                    {
                        EntityName: 'MJ: Content Item Chunks',
                        RecordID: '99990000-0000-4000-8000-000000000103',
                        Title: 'Omitted Content Source Hit',
                        Snippet: 'Falls back cleanly to first granted ContentSource when omitted/null.',
                        Score: 0.87,
                        SourceType: 'vector',
                        RawMetadata: { ContentSourceID: null },
                        OriginatingScopeID: compositeScopeId,
                        OriginatingScopeName: 'Composite Shared Knowledge Scope',
                    },
                ],
            }),
        );

        assert.equal(dispatchResult.grantedKnowledgeHits.length, 2, 'Excluded ContentSource hit must be dropped fail-closed');
        assert.equal(
            dispatchResult.grantedKnowledgeHits.some((h) => h.title === 'Excluded Content Source Hit' || h.contentSourceId === csExcludedId),
            false,
            'Excluded ContentSource hit must not fall back to grantedScope.contentSourceIds[0]',
        );
        assert.equal(dispatchResult.grantedKnowledgeHits[0]?.contentSourceId, csSecondId);
        assert.equal(dispatchResult.grantedKnowledgeHits[1]?.contentSourceId, csFirstId);
        assert.deepEqual(
            dispatchResult.extraKnowledgeCandidates.map((c) => c.contentSourceId),
            [csSecondId, csFirstId],
        );
    });

    it('enforces dual-dialect migration parity and zero-any / zero-unknown / zero-BaseEntity.Get()/Set() strictness across Slice 2 files', () => {
        const repoRoot = resolve(process.cwd());
        const tsqlMig = readFileSync(
            resolve(repoRoot, 'migrations/V202611231200__v0.2.x__Source_Receipt_Originating_Scope.sql'),
            'utf8',
        );
        const pgMig = readFileSync(
            resolve(repoRoot, 'migrations-pg/V202611231200__v0.2.x__Source_Receipt_Originating_Scope.pg.sql'),
            'utf8',
        );

        const codegenBanner = '-- GENERATED BY MemberJunction CodeGen';
        assert.ok(tsqlMig.includes(codegenBanner), 'SQL Server migration must include CodeGen banner');
        assert.ok(pgMig.includes(codegenBanner), 'PostgreSQL migration must include CodeGen banner');
        assert.ok(tsqlMig.slice(0, tsqlMig.indexOf(codegenBanner)).includes('\n'.repeat(50)), 'SQL Server migration must include >=50 blank lines above CodeGen banner');
        assert.ok(pgMig.slice(0, pgMig.indexOf(codegenBanner)).includes('\n'.repeat(50)), 'PostgreSQL migration must include >=50 blank lines above CodeGen banner');
        for (const section of ['-- 1.', '-- 2.', '-- 3.', '-- 4.']) {
            assert.ok(tsqlMig.includes(section), `SQL Server migration missing section ${section}`);
            assert.ok(pgMig.includes(section), `PostgreSQL migration missing section ${section}`);
        }
        for (const marker of ['OriginatingScopeID', 'OriginatingScopeName', 'vwSpaceAgentSourceReceipts', 'spCreateSpaceAgentSourceReceipt', 'spUpdateSpaceAgentSourceReceipt']) {
            assert.ok(tsqlMig.includes(marker), `SQL Server migration must include ${marker}`);
            assert.ok(pgMig.includes(marker), `PostgreSQL migration must include ${marker}`);
        }
        assert.ok(pgMig.includes('WITH (security_invoker = true)'), 'PG view must retain security_invoker = true');
        assert.ok(pgMig.includes('vwSpaceAgentSourceReceiptsAuthorized'), 'PG migration must restore vwSpaceAgentSourceReceiptsAuthorized');

        const slice2SourceFiles = [
            'packages/Core/src/source-receipts.ts',
            'packages/CoreEntitiesServer/src/turn-tools.ts',
            'packages/CoreEntitiesServer/src/turn-knowledge-scopes.ts',
            'packages/CoreEntitiesServer/src/turn-knowledge-scopes.test.ts',
            'packages/Angular/src/lib/logic/source-receipts.ts',
            'packages/AngularWidgets/src/lib/types.ts',
        ];
        const assertStrictAst = (node: ts.Node, label: string): void => {
            assert.notEqual(node.kind, ts.SyntaxKind.AnyKeyword, `Disallowed 'any' type in ${label}`);
            assert.notEqual(node.kind, ts.SyntaxKind.UnknownKeyword, `Disallowed 'unknown' type in ${label}`);
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
                const propName = node.expression.name.text;
                assert.ok(propName !== 'Get' && propName !== 'Set', `Disallowed BaseEntity.${propName}() in ${label}`);
            }
            ts.forEachChild(node, (child) => assertStrictAst(child, label));
        };
        for (const relPath of slice2SourceFiles) {
            const absPath = resolve(repoRoot, relPath);
            const srcText = readFileSync(absPath, 'utf8');
            const sf = ts.createSourceFile(absPath, srcText, ts.ScriptTarget.Latest, true);
            assertStrictAst(sf, relPath);
        }
        // Check Slice 2 additions in pre-existing grants.ts separately
        const grantsPath = resolve(repoRoot, 'packages/Core/src/grants.ts');
        const grantsSf = ts.createSourceFile(grantsPath, readFileSync(grantsPath, 'utf8'), ts.ScriptTarget.Latest, true);
        ts.forEachChild(grantsSf, (stmt) => {
            if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === 'validateKnowledgeSourceGrantSettings') {
                assertStrictAst(stmt, 'packages/Core/src/grants.ts#validateKnowledgeSourceGrantSettings');
            }
        });
    });
});
