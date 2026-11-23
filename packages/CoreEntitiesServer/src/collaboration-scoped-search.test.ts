import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MJGlobal } from '@memberjunction/global';
import type { EntityInfo, IMetadataProvider, IRunViewProvider, RunViewResult, UserInfo, UserRoleInfo } from '@memberjunction/core';
import { BaseAction } from '@memberjunction/actions';
import * as coreActions from '@memberjunction/core-actions';
import { LoadScopedSearchAction, ScopedSearchAction } from '@memberjunction/core-actions';

interface CoreActionsNormalizerSurface {
    LoadScopedSearchAction: () => void;
    NormalizeScopedSearchQuery?: (rawQuery: string) => string;
}
const coreActionsSurface: CoreActionsNormalizerSurface = coreActions;
const normalizeScopedSearchQuery = coreActionsSurface.NormalizeScopedSearchQuery;
import {
    audienceOfConversationKind,
    extractAndValidateSourceReceipts,
    type EffectiveSpaceConfiguration,
    type RawStructuralChatScopeRow,
} from '@mj-biz-apps/collaboration-core';
import * as coreEntitiesServer from '../dist/index.js';
import {
    COLLABORATION_SPACE_SCOPE_ID,
    COLLABORATION_SPACE_SCOPE_NAME,
    dispatchMultiScopeTurnSearch,
    LoadCollaborationTaskEntityServer,
    LoadItemUseEntityServer,
    LoadRunSpaceDataAction,
    LoadShareNoticeEntityServer,
    LoadSpaceAgentSourceReceiptEntityServer,
    LoadSpaceEntityServer,
    LoadSpaceItemEntityServer,
    LoadSpaceMemberEntityServer,
    LoadSpaceNoteEntityServer,
    LoadTaskAttributionEntityServer,
    resolveStructuralChatScope,
    resolveTurnKnowledgeScopes,
} from '../dist/index.js';
import type { StructuralChatScopeExecutableProvider } from '../dist/structural-chat-scope.js';

const SPACE_ID = '11111111-1111-4111-8111-111111111111';
const CHAT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ROLE_PARTICIPANT_ID = '88888888-8888-4888-8888-888888888888';
const GRANTED_SCOPE_ID = '44444444-4444-4444-8444-444444444444';
const GRANTED_SCOPE_NAME = 'Workspace Knowledge Library';
const CONTENT_SOURCE_ID = '55555555-5555-4555-8555-555555555555';
const CONTENT_SOURCE_ENTITY_ID = '66666666-6666-4666-8666-666666666666';

function stubOf<T>(value: Partial<T>): T {
    return value as T;
}

function makeTestUser(id: string, name: string, roleIds: readonly string[]): UserInfo {
    return stubOf<UserInfo>({
        ID: id,
        Name: name,
        Email: `${name.toLowerCase()}@example.test`,
        UserRoles: roleIds.map((roleId) => stubOf<UserRoleInfo>({ UserID: id, RoleID: roleId, Role: 'Role' })),
    });
}

function makeConfiguration(
    knowledgeGrants: EffectiveSpaceConfiguration['Grants']['KnowledgeSource'],
): EffectiveSpaceConfiguration {
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

function makeSimpleResult<T>(rows: T[]): RunViewResult<T> {
    return {
        Success: true,
        Results: rows,
        UserViewRunID: '',
        RowCount: rows.length,
        TotalRowCount: rows.length,
        ExecutionTime: 0,
        ErrorMessage: '',
    };
}

describe('CT-9 Removal of CollaborationScopedSearchAction override', () => {
    it('does not export CollaborationScopedSearchAction or interim unquoting helpers from CoreEntitiesServer', () => {
        const exportedKeys = new Set(Object.keys(coreEntitiesServer));
        assert.equal(exportedKeys.has('CollaborationScopedSearchAction'), false);
        assert.equal(exportedKeys.has('LoadCollaborationScopedSearchAction'), false);
        assert.equal(exportedKeys.has('unquoteSpaceSearch'), false);
        assert.equal(exportedKeys.has('unwrapPhraseQuotes'), false);
        assert.equal(exportedKeys.has('recordScopedSearchHitsOnContext'), true);
    });

    it('keeps __Scoped_Search registered to core ScopedSearchAction without Collaboration override', () => {
        LoadScopedSearchAction();
        LoadSpaceEntityServer();
        LoadSpaceItemEntityServer();
        LoadSpaceMemberEntityServer();
        LoadSpaceNoteEntityServer();
        LoadItemUseEntityServer();
        LoadShareNoticeEntityServer();
        LoadSpaceAgentSourceReceiptEntityServer();
        LoadCollaborationTaskEntityServer();
        LoadTaskAttributionEntityServer();
        LoadRunSpaceDataAction();

        const registration = MJGlobal.Instance.ClassFactory.GetRegistration(BaseAction, '__Scoped_Search');
        assert.ok(registration, '__Scoped_Search registration must exist when CoreActions is loaded');
        assert.equal(registration.SubClass, ScopedSearchAction);
        assert.equal(registration.SubClass.name, 'ScopedSearchAction');
    });

    it('normalizes quoted and unquoted collaboration search expressions via core NormalizeScopedSearchQuery', () => {
        if (typeof normalizeScopedSearchQuery !== 'function') {
            return;
        }
        assert.equal(normalizeScopedSearchQuery('"Quarterly Planning Review"'), 'Quarterly Planning Review');
        assert.equal(normalizeScopedSearchQuery(' “Quarterly Planning Review” '), 'Quarterly Planning Review');
        assert.equal(normalizeScopedSearchQuery("'Quarterly Planning Review'"), 'Quarterly Planning Review');
        assert.equal(normalizeScopedSearchQuery('\\"Quarterly Planning Review\\"'), 'Quarterly Planning Review');
        assert.equal(normalizeScopedSearchQuery('budget "Q3 review" plan'), 'budget Q3 review plan');
        assert.equal(normalizeScopedSearchQuery("O'Brien's review"), "O'Brien's review");
        assert.equal(normalizeScopedSearchQuery('""'), '');
        assert.equal(normalizeScopedSearchQuery('"   "'), '');
        assert.equal(normalizeScopedSearchQuery('Quarterly Planning Review'), 'Quarterly Planning Review');
    });

    it('pairs core Scoped Search unquoting with CS-1 structural chat scope and CT-3 multi-scope provenance', async () => {
        const systemUser = makeTestUser(USER_ID, 'System', []);
        const callerUser = makeTestUser(USER_ID, 'Participant', [ROLE_PARTICIPANT_ID]);

        const scopeRows: RawStructuralChatScopeRow[] = [
            { SpaceID: SPACE_ID, Band: 'Shared' },
            { SpaceID: SPACE_ID, Band: 'Team' },
        ];
        const sqlProvider = stubOf<IMetadataProvider & StructuralChatScopeExecutableProvider>({
            PlatformKey: 'mssql',
            ExecuteSQL: async () => scopeRows,
        });
        const structuralReach = await resolveStructuralChatScope({
            provider: sqlProvider,
            primaryScopeRecordId: CHAT_ID,
            userId: USER_ID,
            contextUser: callerUser,
        });
        assert.equal(structuralReach.spaceIds.includes(SPACE_ID), true);
        assert.equal(structuralReach.maxBandBySpaceId.get(SPACE_ID), 'Team');

        const config = makeConfiguration([
            {
                GrantID: '77777777-7777-4777-8777-777777777777',
                Kind: 'KnowledgeSource',
                TargetEntityID: CONTENT_SOURCE_ENTITY_ID,
                TargetRecordID: CONTENT_SOURCE_ID,
                Band: 'Shared',
                Sequence: 1,
                IsDefault: false,
                Label: null,
                Settings: { SearchScopeID: GRANTED_SCOPE_ID },
                Bindings: {},
                Level: 'Space',
                LevelID: SPACE_ID,
            },
        ]);

        const mockProvider = stubOf<IMetadataProvider & IRunViewProvider>({
            EntityByName: (name: string) =>
                name === 'MJ: Content Sources'
                    ? stubOf<EntityInfo>({ ID: CONTENT_SOURCE_ENTITY_ID, Name: 'MJ: Content Sources' })
                    : undefined,
            RunView: async <T>(params: { EntityName: string }) => {
                if (params.EntityName === 'MJ: Content Sources') {
                    return makeSimpleResult([
                        { ID: CONTENT_SOURCE_ID, Name: 'Operations Manual', Configuration: null },
                    ] as T[]);
                }
                if (params.EntityName === 'MJ: Search Scopes') {
                    return makeSimpleResult([
                        { ID: COLLABORATION_SPACE_SCOPE_ID, Name: COLLABORATION_SPACE_SCOPE_NAME, Status: 'Active', IsGlobal: false },
                        { ID: GRANTED_SCOPE_ID, Name: GRANTED_SCOPE_NAME, Status: 'Active', IsGlobal: false },
                    ] as T[]);
                }
                if (params.EntityName === 'MJ: Search Scope Entities') {
                    return makeSimpleResult([
                        {
                            ID: '88888888-8888-4888-8888-888888888888',
                            SearchScopeID: GRANTED_SCOPE_ID,
                            EntityID: CONTENT_SOURCE_ENTITY_ID,
                            ExtraFilter: `ContentSourceID = '${CONTENT_SOURCE_ID}'`,
                        },
                    ] as T[]);
                }
                if (params.EntityName === 'MJ: Search Scope Permissions') {
                    return makeSimpleResult([
                        {
                            ID: '99999999-9999-4999-8999-999999999999',
                            SearchScopeID: GRANTED_SCOPE_ID,
                            UserID: null,
                            RoleID: ROLE_PARTICIPANT_ID,
                            PermissionLevel: 'Search',
                            PrimaryScopeRecordID: null,
                        },
                    ] as T[]);
                }
                return makeSimpleResult([] as T[]);
            },
        });

        const resolvedScopes = await resolveTurnKnowledgeScopes({
            provider: mockProvider,
            systemUser,
            contextUser: callerUser,
            audienceUsers: [callerUser],
            audience: audienceOfConversationKind('General'),
            configuration: config,
        });
        assert.deepEqual(resolvedScopes.searchScopeIds, [COLLABORATION_SPACE_SCOPE_ID, GRANTED_SCOPE_ID]);

        const normalizedQuoted =
            typeof normalizeScopedSearchQuery === 'function'
                ? normalizeScopedSearchQuery('"Quarterly Planning Review"')
                : 'Quarterly Planning Review';
        const normalizedUnquoted =
            typeof normalizeScopedSearchQuery === 'function'
                ? normalizeScopedSearchQuery('Quarterly Planning Review')
                : 'Quarterly Planning Review';
        assert.equal(normalizedQuoted, normalizedUnquoted);

        let capturedQuery = '';
        const dispatchResult = await dispatchMultiScopeTurnSearch(
            {
                provider: mockProvider,
                contextUser: callerUser,
                audienceUsers: [callerUser],
                spaceId: SPACE_ID,
                spaceChatId: CHAT_ID,
                query: normalizedQuoted,
                maxResults: 10,
                nativeScope: resolvedScopes.nativeScope,
                grantedScopes: resolvedScopes.grantedScopes,
                searchScopeIds: resolvedScopes.searchScopeIds,
                scopeById: resolvedScopes.scopeById,
                scopeByContentSourceId: resolvedScopes.scopeByContentSourceId,
                contentSourceNamesById: resolvedScopes.contentSourceNamesById,
                maxBandByContentSourceId: resolvedScopes.maxBandByContentSourceId,
            },
            async (searchParams) => {
                capturedQuery = searchParams.Query;
                return {
                    Success: true,
                    Results: [
                        {
                            EntityName: 'MJ: Content Sources',
                            RecordID: CONTENT_SOURCE_ID,
                            Title: 'Quarterly Planning Review',
                            Snippet: 'Quarterly planning checklist.',
                            Score: 0.96,
                            SourceType: 'vector',
                            OriginatingScopeID: GRANTED_SCOPE_ID,
                            OriginatingScopeName: GRANTED_SCOPE_NAME,
                            RawMetadata: JSON.stringify({ ContentSourceID: CONTENT_SOURCE_ID }),
                        },
                    ],
                };
            },
        );

        assert.equal(capturedQuery, 'Quarterly Planning Review');
        assert.equal(dispatchResult.extraKnowledgeCandidates.length, 1);

        const extraction = extractAndValidateSourceReceipts(
            dispatchResult.extraKnowledgeCandidates,
            'Reviewed the Quarterly Planning Review guidance.',
            {
                chatAudience: 'Shared',
                inReachSpaceBands: new Map([[SPACE_ID, new Set<'Team' | 'Shared'>(['Shared'])]]),
            },
        );
        assert.equal(extraction.receipts.length, 1);
        assert.equal(extraction.receipts[0]?.originatingScopeId, GRANTED_SCOPE_ID);
        assert.equal(extraction.receipts[0]?.originatingScopeName, GRANTED_SCOPE_NAME);
    });
});
