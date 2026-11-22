import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BaseEntity,
    CompositeKey,
    type EntityFieldInfo,
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    Metadata,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import type { AppContext } from '@memberjunction/server';
import type { PubSubEngine } from 'type-graphql';
import {
    COLLABORATION_SOURCE_RECEIPT_ENTITY,
    SpaceAgentSourceReceiptEntityServer,
} from '@mj-biz-apps/collaboration-core-entities-server';

// @memberjunction/server evaluates LoadConfig() on module load; provide benign non-secret
// placeholder defaults when running unit tests without a local DB config, then restore.
const heldEnv = {
    DB_DATABASE: process.env.DB_DATABASE,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
};
process.env.DB_DATABASE ??= 'unit_test_db';
process.env.DB_USERNAME ??= 'unit_test_user';
process.env.DB_PASSWORD ??= 'unit_test_placeholder';

const [{ LoadBizAppsCollaborationServer }, { mjBizAppsCollaborationSpaceAgentSourceReceiptResolver }] = await Promise.all([
    import('../dist/index.js'),
    import('../dist/generated/generated.js'),
]);

if (heldEnv.DB_DATABASE === undefined) delete process.env.DB_DATABASE;
if (heldEnv.DB_USERNAME === undefined) delete process.env.DB_USERNAME;
if (heldEnv.DB_PASSWORD === undefined) delete process.env.DB_PASSWORD;

const SPACE_A = '11111111-1111-4111-8111-111111111111';
const SPACE_B = '22222222-2222-4222-8222-222222222222';
const SPACE_CHAT_ID = '44444444-4444-4444-8444-444444444444';
const CONV_ID = '55555555-5555-4555-8555-555555555555';
const DETAIL_ID = '66666666-6666-4666-8666-666666666666';
const USER_PARTICIPANT_ID = '77777777-7777-4777-8777-777777777777';
const USER_OUTSIDER_ID = '88888888-8888-4888-8888-888888888888';
const ROLE_SHARED_ID = '99999999-9999-4999-8999-999999999999';
const TARGET_ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_ITEM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MOVED_ITEM_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const REVOKED_KS_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const VALID_REC_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
const MOVED_REC_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
const REVOKED_REC_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3';

function makeUser(id: string, roleName: string): UserInfo {
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: roleName,
        Email: `${id.slice(0, 6)}@example.com`,
        UserRoles: [{ UserID: id, RoleID: 'role-id', Role: roleName }],
    };
    return partial as UserInfo;
}

describe('SpaceAgentSourceReceipt generated GraphQL resolver (CR-2)', () => {
    it('routes single-record resolver and view queries through provider hook and strict reach validation', async () => {
        LoadBizAppsCollaborationServer();

        let activeAppUser: string | null = null;
        let activeMjUser: string | null = null;

        const pooledClient = {
            releasedCount: 0,
            async query(sqlText: string): Promise<{ rows: Array<Record<string, unknown>> }> {
                if (sqlText.startsWith('SET LOCAL app.current_user_id')) {
                    activeAppUser = /'([^']+)'/.exec(sqlText)?.[1] ?? null;
                } else if (sqlText.startsWith('SET LOCAL mj.current_user_id')) {
                    activeMjUser = /'([^']+)'/.exec(sqlText)?.[1] ?? null;
                } else if (sqlText === 'RESET app.current_user_id') {
                    activeAppUser = null;
                } else if (sqlText === 'RESET mj.current_user_id') {
                    activeMjUser = null;
                } else if (sqlText === 'COMMIT' || sqlText === 'ROLLBACK') {
                    activeAppUser = null;
                    activeMjUser = null;
                }
                return { rows: [] };
            },
            release(): void {
                this.releasedCount += 1;
            },
        };

        const storedReceipts: Array<Record<string, string | number | boolean | null>> = [
            {
                ID: VALID_REC_ID,
                SpaceID: SPACE_A,
                SpaceChatID: SPACE_CHAT_ID,
                ConversationID: CONV_ID,
                ConversationDetailID: DETAIL_ID,
                AgentRunID: null,
                SourceKind: 'SpaceItem',
                SpaceItemID: VALID_ITEM_ID,
                ContentSourceID: null,
                TargetEntityID: TARGET_ENTITY_ID,
                TargetRecordID: `ID|${VALID_ITEM_ID}`,
                SourceTitle: 'Valid Shared Receipt',
                Band: 'Shared',
                WasSupplied: true,
                WasCited: true,
                RetrievalRank: 1,
                RelevanceScore: 0.95,
                RankingMode: 'lexical',
                CitationOrdinal: 1,
                EstimatedTokens: 25,
                WasTruncated: false,
                Sequence: 1,
            },
            {
                ID: MOVED_REC_ID,
                SpaceID: SPACE_A,
                SpaceChatID: SPACE_CHAT_ID,
                ConversationID: CONV_ID,
                ConversationDetailID: DETAIL_ID,
                AgentRunID: null,
                SourceKind: 'SpaceItem',
                SpaceItemID: MOVED_ITEM_ID,
                ContentSourceID: null,
                TargetEntityID: TARGET_ENTITY_ID,
                TargetRecordID: `ID|${MOVED_ITEM_ID}`,
                SourceTitle: 'Moved Space Receipt',
                Band: 'Shared',
                WasSupplied: true,
                WasCited: false,
                RetrievalRank: 2,
                RelevanceScore: 0.85,
                RankingMode: 'lexical',
                CitationOrdinal: null,
                EstimatedTokens: 20,
                WasTruncated: false,
                Sequence: 2,
            },
            {
                ID: REVOKED_REC_ID,
                SpaceID: SPACE_A,
                SpaceChatID: SPACE_CHAT_ID,
                ConversationID: CONV_ID,
                ConversationDetailID: DETAIL_ID,
                AgentRunID: null,
                SourceKind: 'KnowledgeSource',
                SpaceItemID: null,
                ContentSourceID: REVOKED_KS_ID,
                TargetEntityID: TARGET_ENTITY_ID,
                TargetRecordID: `ID|${REVOKED_KS_ID}`,
                SourceTitle: 'Revoked KS Receipt',
                Band: 'Shared',
                WasSupplied: true,
                WasCited: false,
                RetrievalRank: 3,
                RelevanceScore: 0.75,
                RankingMode: 'grant',
                CitationOrdinal: null,
                EstimatedTokens: 15,
                WasTruncated: false,
                Sequence: 3,
            },
        ];

        const fields: EntityFieldInfo[] = Object.keys(storedReceipts[0]).map((name) => ({
            Name: name,
            CodeName: name,
            DisplayName: name,
            AllowsNull: true,
            IsPrimaryKey: name === 'ID',
            ReadOnly: false,
            AutoIncrement: false,
            Type: typeof storedReceipts[0][name] === 'boolean'
                ? 'bit'
                : typeof storedReceipts[0][name] === 'number'
                    ? 'int'
                    : 'nvarchar',
            EntityFieldValues: [],
            Validate() {
                return { Success: true, Errors: [] };
            },
        } as Partial<EntityFieldInfo> as EntityFieldInfo));

        const entityObj: Partial<EntityInfo> = {
            Name: COLLABORATION_SOURCE_RECEIPT_ENTITY,
            SchemaName: '__mj_BizAppsCollaboration',
            BaseView: 'vwSpaceAgentSourceReceipts',
            IncludeInAPI: true,
            AllowAllRowsAPI: false,
            Fields: fields,
            PrimaryKeys: fields.filter((f) => f.IsPrimaryKey),
            FirstPrimaryKey: fields.find((f) => f.IsPrimaryKey),
            RelatedEntities: [],
            GetUserPermisions: (user: UserInfo) => ({
                ID: 'perm-1',
                Entity: entityObj as EntityInfo,
                User: user,
                CanRead: true,
                CanCreate: false,
                CanUpdate: false,
                CanDelete: false,
            }),
            GetEffectiveRowFilterWhereClause: () => '',
        };
        const entityInfo = entityObj as EntityInfo;

        const observedContextDuringSql: Array<{ appUser: string | null; mjUser: string | null }> = [];
        const providerState = {
            PlatformKey: 'postgresql',
            DatabaseConnection: {
                async connect() {
                    return pooledClient;
                },
            },
            Entities: [entityInfo],
            EntityByName(name: string) {
                return name === COLLABORATION_SOURCE_RECEIPT_ENTITY ? entityInfo : undefined;
            },
            EntityByID(id: string) {
                return id === entityInfo.ID ? entityInfo : undefined;
            },
            async ExecuteSQL(_sqlText: string, _params?: unknown[], _options?: unknown, _contextUser?: UserInfo) {
                observedContextDuringSql.push({ appUser: activeAppUser, mjUser: activeMjUser });
                return [];
            },
            async Load(_entity: BaseEntity, key: CompositeKey) {
                observedContextDuringSql.push({ appUser: activeAppUser, mjUser: activeMjUser });
                const targetId = String(key.GetValueByFieldName('ID') ?? '').toLowerCase();
                const found = storedReceipts.find((r) => String(r.ID).toLowerCase() === targetId);
                return found ? { ...found } : null;
            },
            async GetEntityObject<T extends BaseEntity>(
                entityName: string,
                loadKeyOrUser?: CompositeKey | UserInfo,
                contextUser?: UserInfo,
            ): Promise<T> {
                if (entityName !== COLLABORATION_SOURCE_RECEIPT_ENTITY) {
                    throw new Error(`Unexpected entity ${entityName}`);
                }
                const isKey = loadKeyOrUser instanceof CompositeKey;
                const user = isKey ? contextUser : loadKeyOrUser;
                const ent = new SpaceAgentSourceReceiptEntityServer(entityInfo);
                const metaProvider = providerState as Partial<IMetadataProvider> as IMetadataProvider;
                const rvProvider = providerState as Partial<IRunViewProvider> as IRunViewProvider;
                Object.defineProperty(ent, 'ContextCurrentUser', { get: () => user });
                Object.defineProperty(ent, 'ProviderToUse', { get: () => metaProvider });
                Object.defineProperty(ent, 'RunViewProviderToUse', { get: () => rvProvider });
                Object.defineProperty(ent, 'ActiveUser', { get: () => user });
                if (isKey) {
                    await ent.InnerLoad(loadKeyOrUser);
                }
                const baseEnt: BaseEntity = ent;
                return baseEnt as T;
            },
            async RunView<T>(params: RunViewParams, contextUser?: UserInfo): Promise<RunViewResult<T>> {
                await providerState.ExecuteSQL(
                    `SELECT * FROM __mj_BizAppsCollaboration."vwSpaceAgentSourceReceipts"`,
                    undefined,
                    undefined,
                    contextUser,
                );
                const filter = typeof params.ExtraFilter === 'string' ? params.ExtraFilter.toLowerCase() : '';
                let results: object[] = [];
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    results = [{ ID: SPACE_CHAT_ID, SpaceID: SPACE_A, ConversationID: CONV_ID, Kind: 'General', OwnerUserID: null }];
                } else if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    results = [
                        { ID: SPACE_A, ParentID: null, InheritsMembership: true, OwnerID: USER_PARTICIPANT_ID, AgentRetrieval: 'Included', AllowParentAssignees: true, ClosedAt: null, StatusID: null, SpaceTypeID: null, Configuration: null },
                        { ID: SPACE_B, ParentID: null, InheritsMembership: true, OwnerID: USER_OUTSIDER_ID, AgentRetrieval: 'Included', AllowParentAssignees: true, ClosedAt: null, StatusID: null, SpaceTypeID: null, Configuration: null },
                    ];
                } else if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    const members = [
                        { SpaceID: SPACE_A, UserID: USER_PARTICIPANT_ID, Status: 'Active', Band: 'Shared', SpaceRoleTypeID: ROLE_SHARED_ID },
                    ];
                    results = members.filter((m) => filter.includes(m.UserID.toLowerCase()));
                } else if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    results = [{ ID: ROLE_SHARED_ID, Level: 10, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true }];
                } else if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                    const items = [
                        { ID: VALID_ITEM_ID, SpaceID: SPACE_A, Band: 'Shared' },
                        { ID: MOVED_ITEM_ID, SpaceID: SPACE_B, Band: 'Shared' },
                    ];
                    results = items.filter((i) => filter.includes(i.ID.toLowerCase()));
                } else if (params.EntityName === 'MJ_BizApps_Collaboration: Space Grants') {
                    results = [
                        { ID: '1', SpaceID: null, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetRecordID: REVOKED_KS_ID, Sequence: 1 },
                        { ID: '2', SpaceID: SPACE_A, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Remove', Band: 'Shared', TargetRecordID: REVOKED_KS_ID, Sequence: 2 },
                    ];
                } else if (params.EntityName === COLLABORATION_SOURCE_RECEIPT_ENTITY) {
                    const callerId = contextUser?.ID?.toLowerCase() ?? '';
                    results = callerId === USER_PARTICIPANT_ID.toLowerCase() ? [storedReceipts[0]] : [];
                }
                return {
                    Success: true,
                    Results: results as T[],
                    UserViewRunID: '',
                    TotalRowCount: results.length,
                    RowCount: results.length,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            },
        };

        const priorProvider = Metadata.Provider;
        const metaProvider = providerState as Partial<IMetadataProvider> as IMetadataProvider;
        Metadata.Provider = metaProvider;
        try {
            const resolver = new mjBizAppsCollaborationSpaceAgentSourceReceiptResolver();
            const pubSub: PubSubEngine = { async publish() {} } as Partial<PubSubEngine> as PubSubEngine;
            const participant = makeUser(USER_PARTICIPANT_ID, 'Space Participant');
            const outsider = makeUser(USER_OUTSIDER_ID, 'Space Participant');

            const makeCtx = (user: UserInfo): AppContext => ({
                providers: [{ provider: metaProvider, type: 'Read-Write' }],
                userPayload: { email: user.Email, userRecord: user },
            } as Partial<AppContext> as AppContext);

            // 1. Authorized single-record GraphQL query succeeds with PostgreSQL GUC context automatically set
            const validGql = await resolver.mjBizAppsCollaborationSpaceAgentSourceReceipt(
                VALID_REC_ID,
                makeCtx(participant),
                pubSub,
            );
            assert.ok(validGql);
            assert.equal(validGql.SourceTitle, 'Valid Shared Receipt');
            assert.ok(
                observedContextDuringSql.some((c) => c.appUser === USER_PARTICIPANT_ID && c.mjUser === USER_PARTICIPANT_ID),
                'Resolver must establish both app.current_user_id and mj.current_user_id on PostgreSQL provider',
            );
            assert.equal(activeAppUser, null, 'GUCs must reset cleanly after resolver completes');
            assert.equal(activeMjUser, null);

            // 2. Moved item & revoked grant receipts fail closed (null) via generated single-record resolver
            assert.equal(
                await resolver.mjBizAppsCollaborationSpaceAgentSourceReceipt(MOVED_REC_ID, makeCtx(participant), pubSub),
                null,
            );
            assert.equal(
                await resolver.mjBizAppsCollaborationSpaceAgentSourceReceipt(REVOKED_REC_ID, makeCtx(participant), pubSub),
                null,
            );

            // 3. Consecutive different-user request switches context cleanly to outsider and returns null
            observedContextDuringSql.length = 0;
            const outsiderGql = await resolver.mjBizAppsCollaborationSpaceAgentSourceReceipt(
                VALID_REC_ID,
                makeCtx(outsider),
                pubSub,
            );
            assert.equal(outsiderGql, null);
            assert.ok(
                observedContextDuringSql.some((c) => c.appUser === USER_OUTSIDER_ID && c.mjUser === USER_OUTSIDER_ID),
            );
            assert.equal(activeAppUser, null);
        } finally {
            Metadata.Provider = priorProvider;
        }
    });
});
