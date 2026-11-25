import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ConversationEngine } from '@memberjunction/core-entities';
import { WellKnownUserSource, type EntityInfo, type IMetadataProvider, type IRunViewProvider, type RunViewParams, type RunViewResult, UserInfo } from '@memberjunction/core';
import { AgentRunner } from '@memberjunction/ai-agents';
import type { ExecuteAgentParams, ExecuteAgentResult, MJAIAgentRunEntityExtended } from '@memberjunction/ai-core-plus';
import {
    clearSpaceChatModelOverrideCache,
    EXPLICIT_ASK_MARKER,
    executeSpaceChatTurn,
    parseSpaceChatEffortLevel,
    type ExecuteSpaceChatTurnInput,
} from '../dist/execute-space-chat-turn.js';
import { COLLABORATION_AI_RUN_LOCKDOWN_ENTITIES, evaluateParticipantAIRunWriteAccess } from '../dist/ai-run-lockdown.js';
import { PARTICIPANT_ROLE_ID } from '../dist/task-attribution.js';
import { resolveSpaceChatHostRules } from '../dist/resolve-space-chat-host-rules.js';
import { COLLABORATION_SPACE_SCOPE_ID, type SpaceTurnContext } from '../dist/turn-tools.js';
import { recordScopedSearchHitsOnContext } from '../dist/turn-tools.js';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { BaseSpaceTypeServerDriver } from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import { seedAppSettings } from './app-settings.test-support.ts';

/** The mock hands back whatever row type its caller asked for; this and `stubOf` are the two places a cast is made. */
function mockResult<T>(results: readonly object[]): RunViewResult<T> {
    return {
        Success: true,
        Results: (results as object) as T[],
        RowCount: results.length,
        TotalRowCount: results.length,
        ExecutionTime: 0,
        ErrorMessage: '',
    };
}

/** A stand-in for an entity or engine object the code under test only reads a few members of. */
function stubOf<T>(value: object): T {
    return value as T;
}

describe('executeSpaceChatTurn', () => {
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
    const CALLER_ID = '11111111-1111-4111-8111-111111111111';
    const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
    const SPACE_ID = '33333333-3333-4333-8333-333333333333';
    const CONVERSATION_ID = '44444444-4444-4444-8444-444444444444';
    const OTHER_CONVERSATION_ID = '44444444-4444-4444-8444-999999999999';
    const USER_MESSAGE_ID = '55555555-5555-4555-8555-555555555555';
    const ROLE_CONTRIB_ID = '66666666-6666-4666-8666-666666666666';
    const ROLE_NON_CONTRIB_ID = '77777777-7777-4777-8777-777777777777';
    const TYPE_ID = '88888888-8888-4888-8888-888888888888';
    const ALLOWED_AGENT_ID = '9e6d761a-197a-40af-995b-3d3dd9bd7b9e';
    const DISALLOWED_AGENT_ID = '99999999-9999-4999-8999-999999999999';
    const RUN_MOCKED_1 = '99000000-0000-4000-8000-000000000001';
    const RUN_MOCKED_2 = '99000000-0000-4000-8000-000000000002';
    const RUN_BG_1 = '99000000-0000-4000-8000-000000000003';
    const SPACE_CHAT_1 = '99000000-0000-4000-8000-000000000010';
    let replyUuidSeq = 0;
    let runUuidSeq = 0;
    const nextReplyUuid = (): string => `99000000-0001-4000-8000-${String(++replyUuidSeq).padStart(12, '0')}`;
    const nextRunUuid = (): string => `99000000-0002-4000-8000-${String(++runUuidSeq).padStart(12, '0')}`;

    const callerUser = { ID: CALLER_ID, Name: 'Caller' } as UserInfo;
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let origRunAgent: typeof AgentRunner.prototype.RunAgent;

    let restoreAppSettings: () => void = () => undefined;
    /** The type's driver as the turn resolves it; a test sets it to throw, as an unregistered driver does. */
    let resolveDriver: () => Promise<{ space: object; spaceType: object; driver: BaseSpaceTypeServerDriver }> = async () => ({ space: {}, spaceType: {}, driver: new BaseSpaceTypeServerDriver() });
    let origResolveSpaceAndType: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    before(() => {
        origResolveSpaceAndType = ServerDriverRegistry.Instance.ResolveSpaceAndType.bind(ServerDriverRegistry.Instance);
        ServerDriverRegistry.Instance.ResolveSpaceAndType = stubOf<typeof ServerDriverRegistry.Instance.ResolveSpaceAndType>(() => resolveDriver());
        restoreAppSettings = seedAppSettings();
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);

        origRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = async (params) => {
            const run = {
                ID: RUN_MOCKED_1,
                Message: 'Mocked agent response',
                Result: 'Mocked agent response',
                Status: 'Completed',
                ExternalReferenceID: params.conversationDetailId,
            };
            if (typeof params.onAgentRunCreated === 'function') {
                await params.onAgentRunCreated(RUN_MOCKED_1);
            }
            return {
                success: true,
                agentRun: stubOf<MJAIAgentRunEntityExtended>(run),
                result: 'Mocked agent response',
                finalPayload: 'Mocked agent response',
            };
        };
    });

    after(() => {
        ServerDriverRegistry.Instance.ResolveSpaceAndType = origResolveSpaceAndType;
        restoreAppSettings();
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        AgentRunner.prototype.RunAgent = origRunAgent;
    });

    interface MockWorldOptions {
        canContribute?: boolean;
        closedAt?: string | null;
        hasRoomChat?: boolean;
        hasExistingAgentRun?: boolean;
        hasExistingReplyDetail?: boolean;
        agentRunReadFails?: boolean;
        /** The reply's save fails once it carries this status (the final save, when 'Complete'). */
        detailSaveFailsWhenStatus?: string;
        /** The reply's save throws once it carries this status, as `Save()` does when the database can't be reached. */
        detailSaveThrowsWhenStatus?: string;
        callerHasReach?: boolean;
        messageUserId?: string;
        messageRole?: string;
        messageConversationId?: string;
        messageText?: string;
        messageParentId?: string | null;
        conversationDetails?: ReadonlyArray<{
            ID: string;
            Sequence?: number;
            Role: string;
            Message?: string;
            UserID?: string | null;
            User?: string | null;
            AgentID?: string | null;
            Agent?: string | null;
            ParentID?: string | null;
            __mj_CreatedAt?: string | Date | null;
        }>;
        spaceConfiguration?: string | null;
        allowedAgents?: string[];
        /** No agent is Active: the agents read comes back empty. */
        noActiveAgents?: boolean;
        /** The read of the seats that reach the room (the audience's roster) fails. */
        rosterReadFails?: boolean;
        /** The caller's seat is there for the turn's first gate and gone by the time the audience is read. */
        seatGoneAfterGate?: boolean;
        /** Other people seated on the space. With it the seat reads honour their filter, MaxRows and AfterKey, as the database does. */
        roomSeats?: ReadonlyArray<{ UserID: string; User: string }>;
    }

    interface SavedDetail {
        ID?: string;
        ConversationID?: string;
        ParentID?: string | null;
        UserID?: string | null;
        Role?: string;
        AgentID?: string | null;
        Status?: string;
        Message?: string;
        ExternalID?: string | null;
        serverAuthoredReplyMarked?: boolean;
    }

    interface SavedRun {
        ID?: string;
        ExternalReferenceID?: string | null;
        Status?: string;
    }

    type MockMetadataProvider = IMetadataProvider & {
        readonly savedDetails: SavedDetail[];
        readonly savedRuns: SavedRun[];
        /** Every read of the seats, in order. */
        readonly seatReads: RunViewParams[];
    };

    const seatRowId = (n: number): string => `abababab-0000-4000-8000-${String(n).padStart(12, '0')}`;

    function createMockProvider(options: MockWorldOptions = {}): MockMetadataProvider {
        const canContribute = options.canContribute !== false;
        const closedAt = options.closedAt ?? null;
        const hasRoomChat = options.hasRoomChat !== false;
        const hasExistingAgentRun = options.hasExistingAgentRun === true;
        const callerHasReach = options.callerHasReach !== false;
        const messageUserId = options.messageUserId ?? CALLER_ID;
        const messageRole = options.messageRole ?? 'User';
        const messageConversationId = options.messageConversationId ?? CONVERSATION_ID;
        const messageText = options.messageText ?? `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} help`;

        const savedDetails: SavedDetail[] = [];
        const savedRuns: SavedRun[] = [];
        const seatReads: RunViewParams[] = [];

        const provider: Partial<IMetadataProvider & IRunViewProvider> = {
            EntityByName() {
                return stubOf<EntityInfo>({
                    ID: 'mock-entity-id',
                    GetUserPermisions: () => ({ CanRead: true, CanCreate: true, CanUpdate: true, CanDelete: true }),
                });
            },
            EntityByID() {
                return stubOf<EntityInfo>({ Name: 'mock-entity' });
            },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return stubOf<never>({
                        RunViewProviderToUse: provider,
                        ProviderToUse: provider,
                    });
                }
                if (entityName === 'MJ: Conversation Details') {
                    const detail = {
                        ID: USER_MESSAGE_ID,
                        ConversationID: messageConversationId,
                        UserID: messageUserId,
                        Role: messageRole,
                        Message: messageText,
                        ParentID: options.messageParentId ?? null,
                        AgentID: null as string | null,
                        Status: 'Complete',
                        HiddenToUser: false,
                        IsPinned: false,
                        OriginalMessageChanged: false,
                        LatestResult: { CompleteMessage: '' },
                        serverAuthoredReplyMarked: false,
                        NewRecord() {
                            this.ID = nextReplyUuid();
                            this.serverAuthoredReplyMarked = false;
                        },
                        MarkServerAuthoredReply() {
                            this.serverAuthoredReplyMarked = true;
                        },
                        async Load(id: string) {
                            return id.toLowerCase() === USER_MESSAGE_ID.toLowerCase();
                        },
                        async Save() {
                            if (options.detailSaveThrowsWhenStatus && this.Status === options.detailSaveThrowsWhenStatus) {
                                throw new Error('the database could not be reached');
                            }
                            savedDetails.push({ ...this });
                            return this.Status !== options.detailSaveFailsWhenStatus;
                        },
                    };
                    return stubOf<never>(detail);
                }
                if (entityName === 'MJ: AI Agent Runs') {
                    const run = {
                        ID: 'run-new-id',
                        AgentID: null as string | null,
                        ConversationID: null as string | null,
                        ConversationDetailID: null as string | null,
                        UserID: null as string | null,
                        Status: 'Completed',
                        StartedAt: null as Date | null,
                        CompletedAt: null as Date | null,
                        Success: true,
                        Result: null as string | null,
                        NewRecord() {
                            this.ID = nextRunUuid();
                        },
                        async Load(id: string) {
                            this.ID = id;
                            return true;
                        },
                        async Save() {
                            savedRuns.push({ ...this });
                            return true;
                        },
                    };
                    return stubOf<never>(run);
                }
                if (entityName === 'MJ: AI Agents') {
                    const agent = {
                        ID: ALLOWED_AGENT_ID,
                        Name: 'Sage',
                        TypeID: 'agent-type-1',
                        DriverClass: null,
                        async Load(id: string) {
                            return id.toLowerCase() === ALLOWED_AGENT_ID.toLowerCase();
                        },
                    };
                    return stubOf<never>(agent);
                }
                return stubOf<never>({});
            },
            async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                const { EntityName, ExtraFilter = '' } = params;

                if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return mockResult<T>([
                        {
                            ID: SPACE_ID,
                            ParentID: null,
                            InheritsMembership: false,
                            OwnerID: CALLER_ID,
                            AgentRetrieval: 'Included',
                            SpaceTypeID: TYPE_ID,
                            AllowParentAssignees: true,
                            ClosedAt: closedAt,
                            Configuration: options.spaceConfiguration ?? null,
                        },
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    seatReads.push(params);
                    if (!callerHasReach) {
                        return mockResult<T>([]);
                    }
                    const seatFilter = String(ExtraFilter);
                    const readsTheAudience = seatFilter.includes('SpaceID IN (') || /^UserID = '[^']+' AND Status = 'Active'$/.test(seatFilter);
                    if (options.rosterReadFails && seatFilter.includes('SpaceID IN (')) {
                        return { Success: false, Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 0, ErrorMessage: 'Database connection failed while reading the seats.' };
                    }
                    if (options.seatGoneAfterGate && readsTheAudience) {
                        return mockResult<T>([]);
                    }
                    if (options.roomSeats) {
                        const everySeat = [{ UserID: CALLER_ID, User: 'Caller' }, ...options.roomSeats].map((person, index) => ({
                            ID: seatRowId(index + 1),
                            SpaceID: SPACE_ID,
                            UserID: person.UserID,
                            User: person.User,
                            Status: 'Active',
                            Band: 'Team',
                            SpaceRoleTypeID: ROLE_CONTRIB_ID,
                            __mj_CreatedAt: new Date('2026-01-01T00:00:00Z'),
                        }));
                        const onlyUser = /UserID = '([^']+)'/.exec(seatFilter)?.[1].toLowerCase();
                        const after = params.AfterKey ? String(params.AfterKey.GetValueByFieldName('ID')).toLowerCase() : '';
                        const matching = everySeat
                            .filter((row) => !onlyUser || row.UserID.toLowerCase() === onlyUser)
                            .filter((row) => row.ID > after);
                        return mockResult<T>(params.MaxRows ? matching.slice(0, params.MaxRows) : matching);
                    }
                    return mockResult<T>([
                        {
                            ID: '99000000-0003-4000-8000-000000000001',
                            SpaceID: SPACE_ID,
                            UserID: CALLER_ID,
                            Status: 'Active',
                            Band: 'Team',
                            SpaceRoleTypeID: canContribute ? ROLE_CONTRIB_ID : ROLE_NON_CONTRIB_ID,
                            __mj_CreatedAt: new Date('2026-01-01T00:00:00Z'),
                        },
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return mockResult<T>([
                        {
                            ID: ROLE_CONTRIB_ID,
                            Level: 40,
                            MaxGrantableLevel: 40,
                            CanInvite: true,
                            CanPromoteBand: true,
                            CanSeeTeamBand: true,
                            IsOwnerRole: true,
                            CanContribute: true,
                        },
                        {
                            ID: ROLE_NON_CONTRIB_ID,
                            Level: 10,
                            MaxGrantableLevel: 10,
                            CanInvite: false,
                            CanPromoteBand: false,
                            CanSeeTeamBand: false,
                            IsOwnerRole: false,
                            CanContribute: false,
                        },
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                    return mockResult<T>([
                        {
                            ID: TYPE_ID,
                            DriverKey: null,
                            ServerDriverClass: null,
                            UIDriverClass: null,
                            AllowSubSpaces: true,
                            Configuration: JSON.stringify({
                                Chats: {
                                    WhoCanStart: 'Anyone',
                                    AgentReplyMode: 'MentionOrOneToOne',
                                    HistoryOnAdd: 'None',
                                },
                                Agents: {
                                    ListMode: 'Extend',
                                },
                                SpaceOverridable: ['Chats.AgentReplyMode'],
                            }),
                        },
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    if (!hasRoomChat) {
                        return mockResult<T>([]);
                    }
                    return mockResult<T>([
                        {
                            ID: SPACE_CHAT_1,
                            ConversationID: CONVERSATION_ID,
                            Kind: 'General',
                            Status: 'Active',
                        },
                    ]);
                }

                if (EntityName === 'MJ: Application Settings') {
                    return mockResult<T>([
                        {
                            ID: 'app-setting-1',
                            Name: 'Collaboration Settings',
                            Value: JSON.stringify({
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
                    ]);
                }

                if (EntityName === 'MJ: AI Agent Runs') {
                    if (options.agentRunReadFails) {
                        return {
                            Success: false,
                            Results: [],
                            RowCount: 0,
                            TotalRowCount: 0,
                            ExecutionTime: 0,
                            ErrorMessage: 'Database connection failed while checking agent runs.',
                        };
                    }
                    if (hasExistingAgentRun && String(ExtraFilter).includes(USER_MESSAGE_ID)) {
                        return mockResult<T>([{ ID: 'run-existing-1', ExternalReferenceID: USER_MESSAGE_ID }]);
                    }
                    return mockResult<T>([]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Grants') {
                    const agentIds = options.allowedAgents ?? [ALLOWED_AGENT_ID];
                    return mockResult<T>(
                        agentIds.map(
                            (id, index) =>
                                ({
                                    ID: `space-agent-${index}`,
                                    Kind: 'Agent',
                                    Mode: 'Extend',
                                    Band: 'Shared',
                                    TargetEntityID: 'E-AGENTS',
                                    Sequence: index,
                                    TargetRecordID: id,
                                    SpaceTypeID: null,
                                    SpaceID: SPACE_ID,
                                    IsDefault: true,
                                }),
                        ),
                    );
                }

                if (EntityName === 'MJ: AI Agents') {
                    // The shipped assistant is not in this world; the allowed agent answers every read by id
                    if (String(ExtraFilter).includes('Name =')) return mockResult<T>([]);
                    if (options.noActiveAgents && String(ExtraFilter).includes("Status = 'Active'")) return mockResult<T>([]);
                    return mockResult<T>([
                        {
                            ID: ALLOWED_AGENT_ID,
                            Name: 'Sage',
                        },
                    ]);
                }

                if (EntityName === 'MJ: Users') {
                    return mockResult<T>([
                        {
                            ID: CALLER_ID,
                            Name: 'Caller',
                            Email: 'caller@example.com',
                        },
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Type Agents') {
                    return mockResult<T>([]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                    return mockResult<T>([]);
                }

                if (EntityName === 'MJ: Conversation Details') {
                    if (options.hasExistingReplyDetail && String(ExtraFilter).includes(`ParentID = '${USER_MESSAGE_ID}'`)) {
                        return mockResult<T>([{ ID: 'detail-reply-1', ParentID: USER_MESSAGE_ID, Role: 'AI' }]);
                    }
                    if (options.conversationDetails && !String(ExtraFilter).includes(`ParentID = '${USER_MESSAGE_ID}'`)) {
                        const rows = options.conversationDetails.map((r, index) => ({
                            Sequence: r.Sequence ?? index + 1,
                            SummaryOfEarlierConversation: null,
                            ...r,
                        }));
                        const byId = /\bID = '([^']+)'/.exec(String(ExtraFilter))?.[1];
                        if (byId) {
                            return mockResult<T>(rows.filter((r) => r.ID.toLowerCase() === byId.toLowerCase()));
                        }
                        if (String(ExtraFilter).includes("Role = 'AI'")) {
                            return mockResult<T>(rows.filter((r) => r.Role === 'AI'));
                        }
                        return mockResult<T>(rows);
                    }
                    return mockResult<T>([]);
                }

                return mockResult<T>([]);
            },
            async RunViews(queries: Array<{ EntityName: string; ExtraFilter?: string }>) {
                return Promise.all(queries.map((q) => provider.RunView!(q)));
            },
        };

        const fullProvider = Object.assign(provider, {
            savedDetails,
            savedRuns,
            seatReads,
        });

        return fullProvider as MockMetadataProvider;
    }

    const defaultInput: ExecuteSpaceChatTurnInput = {
        spaceId: SPACE_ID,
        conversationId: CONVERSATION_ID,
        userMessageId: USER_MESSAGE_ID,
    };

    it("refuses a turn in a space whose type names a driver that is not registered", async () => {
        const held = resolveDriver;
        resolveDriver = async () => { throw new Error('Space driver class "no-such-driver" is not registered on the server.'); };
        try {
            const provider = createMockProvider({ messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} help` });
            const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
            assert.equal(result.ok, false);
            assert.match(result.message, /not registered/);
            assert.equal(provider.savedDetails.length, 0, 'nothing is written for a refused turn');
        } finally {
            resolveDriver = held;
        }
    });

    it('refuses when user ID on message does not match caller (someone elses message)', async () => {
        const provider = createMockProvider({ messageUserId: OTHER_USER_ID });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /Only messages authored by the caller/i);
        }
    });

    it('refuses when message Role is not User', async () => {
        const provider = createMockProvider({ messageRole: 'AI' });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /Only messages authored by the caller/i);
        }
    });

    it('refuses untagged message under default MentionOrOneToOne/MentionOnly reply mode', async () => {
        const provider = createMockProvider({ messageText: 'Hello room without any agent mention' });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /does not mention an agent/i);
        }
    });

    it('under MentionOnly, an untagged message sent with agentId is refused', async () => {
        const provider = createMockProvider({ messageText: 'Hello room without any agent mention' });
        const result = await executeSpaceChatTurn(provider, callerUser, {
            ...defaultInput,
            agentId: ALLOWED_AGENT_ID,
        });
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /does not mention an agent/i);
        }
    });

    it('refuses a message that @-mentions a person without mentioning an agent', async () => {
        const provider = createMockProvider({
            messageText: `@{"type":"user","id":"${OTHER_USER_ID}","name":"Other User"} can you review the draft?`,
        });
        const result = await executeSpaceChatTurn(provider, callerUser, {
            ...defaultInput,
            agentId: ALLOWED_AGENT_ID,
        });
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /addressed to a person and does not mention an agent/i);
        }
    });

    it('succeeds under MentionOnly when replying (ParentID) to an AI message in the conversation', async () => {
        const parentAiDetailId = 'aaaaaaaa-1111-4111-8111-111111111111';
        const provider = createMockProvider({
            messageText: 'Can you expand on point 2?',
            messageParentId: parentAiDetailId,
            conversationDetails: [
                {
                    ID: parentAiDetailId,
                    Role: 'AI',
                    AgentID: ALLOWED_AGENT_ID,
                    Agent: 'Sage',
                    Message: 'Here are the 3 key points.',
                    __mj_CreatedAt: new Date('2026-02-01T00:00:00Z'),
                },
            ],
        });
        const result = await executeSpaceChatTurn(provider, callerUser, {
            ...defaultInput,
            agentId: ALLOWED_AGENT_ID,
        });
        assert.equal(result.ok, true);
    });

    it("hands every agent's run the space's search scope, whichever agent runs", async () => {
        const parentAiDetailId = 'aaaaaaaa-1111-4111-8111-111111111112';
        const provider = createMockProvider({
            messageText: 'What does the account plan say?',
            messageParentId: parentAiDetailId,
            conversationDetails: [
                { ID: parentAiDetailId, Role: 'AI', AgentID: ALLOWED_AGENT_ID, Agent: 'Sage', Message: 'Earlier answer.', __mj_CreatedAt: new Date('2026-02-01T00:00:00Z') },
            ],
        });
        let searchScopeIDs: string[] | undefined;
        const heldRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = async (params) => {
            searchScopeIDs = params.SearchScopeIDs;
            return heldRunAgent.call(AgentRunner.prototype, params) as never;
        };
        try {
            const result = await executeSpaceChatTurn(provider, callerUser, { ...defaultInput, agentId: ALLOWED_AGENT_ID, route: 'ThreadReply' });
            assert.equal(result.ok, true, result.ok ? '' : result.message);
            assert.deepEqual(searchScopeIDs, [COLLABORATION_SPACE_SCOPE_ID]);
        } finally {
            AgentRunner.prototype.RunAgent = heldRunAgent;
        }
    });

    it('refuses when replying (ParentID) to a human message without mentioning an agent', async () => {
        const parentHumanDetailId = 'bbbbbbbb-1111-4111-8111-111111111111';
        const provider = createMockProvider({
            messageText: 'I agree with your point!',
            messageParentId: parentHumanDetailId,
            conversationDetails: [
                {
                    ID: parentHumanDetailId,
                    Role: 'User',
                    UserID: OTHER_USER_ID,
                    User: 'Other User',
                    Message: 'We should ship on Tuesday.',
                    __mj_CreatedAt: new Date('2026-02-01T00:00:00Z'),
                },
            ],
        });
        const result = await executeSpaceChatTurn(provider, callerUser, {
            ...defaultInput,
            agentId: ALLOWED_AGENT_ID,
        });
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /replies to a person and does not mention an agent/i);
        }
    });

    it('refuses an untagged follow-up with agentId under MentionOnly when the server decision selects no_agent (human-to-human remark)', async () => {
        const provider = createMockProvider({
            messageText: 'Hey Bea, are you free after standup?',
            conversationDetails: [
                {
                    ID: 'detail-1',
                    Sequence: 1,
                    Role: 'User',
                    UserID: CALLER_ID,
                    User: 'Caller',
                    Message: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} draft the release notes`,
                    __mj_CreatedAt: new Date('2026-02-01T10:00:00Z'),
                },
                {
                    ID: 'detail-2',
                    Sequence: 2,
                    Role: 'AI',
                    AgentID: ALLOWED_AGENT_ID,
                    Agent: 'Sage',
                    ParentID: 'detail-1',
                    Message: 'Here is the initial draft.',
                    __mj_CreatedAt: new Date('2026-02-01T10:00:05Z'),
                },
                {
                    ID: USER_MESSAGE_ID,
                    Sequence: 3,
                    Role: 'User',
                    UserID: CALLER_ID,
                    User: 'Caller',
                    Message: 'Hey Bea, are you free after standup?',
                    __mj_CreatedAt: new Date('2026-02-01T10:02:00Z'),
                },
            ],
        });
        const result = await executeSpaceChatTurn(provider, callerUser, {
            ...defaultInput,
            agentId: ALLOWED_AGENT_ID,
            decisionRunner: async () => ({
                Success: true,
                ModelName: 'Jev',
                ResolvedModel: 'typesafe/jev-1.13-20260917',
                Answers: {
                    route: {
                        Kind: 'Choice',
                        Value: 'no_agent',
                        Confidence: 0.98,
                        Probabilities: { [ALLOWED_AGENT_ID]: 0.02, no_agent: 0.98 },
                    },
                    continues: {
                        Kind: 'Likelihood',
                        Probability: 0.05,
                    },
                },
            }),
        });
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /does not mention an agent/i);
        }
    });

    it('routes an untagged follow-up under MentionOnly when the server decision confirms the participating agent', async () => {
        const detail1Id = 'bbbbbbbb-0001-4111-8111-111111111111';
        const detail2Id = 'bbbbbbbb-0002-4111-8111-111111111111';
        const provider = createMockProvider({
            messageText: 'Make the second paragraph shorter',
            conversationDetails: [
                {
                    ID: detail1Id,
                    Sequence: 1,
                    Role: 'User',
                    UserID: CALLER_ID,
                    User: 'Caller',
                    Message: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} draft the release notes`,
                    __mj_CreatedAt: new Date('2026-02-01T10:00:00Z'),
                },
                {
                    ID: detail2Id,
                    Sequence: 2,
                    Role: 'AI',
                    AgentID: ALLOWED_AGENT_ID,
                    Agent: 'Sage',
                    ParentID: detail1Id,
                    Message: 'Here is the initial draft.',
                    __mj_CreatedAt: new Date('2026-02-01T10:00:05Z'),
                },
                {
                    ID: USER_MESSAGE_ID,
                    Sequence: 3,
                    Role: 'User',
                    UserID: CALLER_ID,
                    User: 'Caller',
                    Message: 'Make the second paragraph shorter',
                    __mj_CreatedAt: new Date('2026-02-01T10:02:00Z'),
                },
            ],
        });
        let capturedState = '';
        const result = await executeSpaceChatTurn(provider, callerUser, {
            ...defaultInput,
            agentId: undefined,
            decisionCalibration: { A: 1, B: 0 },
            decisionRunner: async ({ state }) => {
                capturedState = state;
                return {
                    Success: true,
                    ModelName: 'LLM Decision',
                    ResolvedModel: 'GPT-OSS-120B',
                    Answers: {
                        route: {
                            Kind: 'Choice',
                            Value: ALLOWED_AGENT_ID,
                            Confidence: 0.95,
                            Probabilities: { [ALLOWED_AGENT_ID]: 0.95, no_agent: 0.05 },
                        },
                        continues: {
                            Kind: 'Likelihood',
                            Probability: 0.95,
                        },
                    },
                };
            },
        });
        assert.equal(result.ok, true);
        assert.match(capturedState, /Make the second paragraph shorter/);
    });

    it('attributes speakers and reply targets via AssembleContextWindow on a thread-reply turn', async () => {
        const detail1Id = 'aaaaaaaa-0001-4111-8111-111111111111';
        const detail2Id = 'aaaaaaaa-0002-4111-8111-111111111111';
        const detail3Id = 'aaaaaaaa-0003-4111-8111-111111111111';
        const provider = createMockProvider({
            messageText: 'Make the second paragraph shorter',
            messageParentId: detail2Id,
            conversationDetails: [
                {
                    ID: detail1Id,
                    Sequence: 1,
                    Role: 'User',
                    UserID: CALLER_ID,
                    User: 'Caller',
                    Message: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} draft the release notes`,
                    __mj_CreatedAt: new Date('2026-02-01T10:00:00Z'),
                },
                {
                    ID: detail2Id,
                    Sequence: 2,
                    Role: 'AI',
                    AgentID: ALLOWED_AGENT_ID,
                    Agent: 'Sage',
                    ParentID: detail1Id,
                    Message: 'Here is the initial draft.',
                    __mj_CreatedAt: new Date('2026-02-01T10:00:05Z'),
                },
                {
                    ID: detail3Id,
                    Sequence: 3,
                    Role: 'User',
                    UserID: OTHER_USER_ID,
                    User: 'Other User',
                    Message: 'Looks good so far.',
                    __mj_CreatedAt: new Date('2026-02-01T10:01:00Z'),
                },
                {
                    ID: USER_MESSAGE_ID,
                    Sequence: 4,
                    Role: 'User',
                    UserID: CALLER_ID,
                    User: 'Caller',
                    ParentID: detail2Id,
                    Message: 'Make the second paragraph shorter',
                    __mj_CreatedAt: new Date('2026-02-01T10:02:00Z'),
                },
            ],
        });

        let capturedMessages: Array<{ role: string; content: string | object | null | undefined }> | undefined;
        const heldRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = async (params) => {
            capturedMessages = (params.conversationMessages ?? []) as Array<{ role: string; content: string | object | null | undefined }>;
            return heldRunAgent.call(AgentRunner.prototype, params) as never;
        };

        try {
            const result = await executeSpaceChatTurn(provider, callerUser, {
                ...defaultInput,
                agentId: undefined,
            });
            assert.equal(result.ok, true, result.ok ? '' : result.message);
            assert.ok(capturedMessages && capturedMessages.length === 4);
            assert.match(String(capturedMessages[0].content), /^\[Caller\]:/);
            assert.equal(capturedMessages[1].content, '[Sage -> replying to Caller]: Here is the initial draft.');
            assert.equal(capturedMessages[2].content, '[Other User]: Looks good so far.');
            assert.equal(
                capturedMessages[3].content,
                '[Caller -> replying to Sage]: Make the second paragraph shorter',
            );
        } finally {
            AgentRunner.prototype.RunAgent = heldRunAgent;
        }
    });

    it('refuses when target space is closed', async () => {
        const provider = createMockProvider({ closedAt: new Date().toISOString() });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /closed space does not take a new turn/i);
        }
    });

    it('refuses when caller seat role cannot contribute', async () => {
        const provider = createMockProvider({ canContribute: false });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /cannot run an agent turn/i);
        }
    });

    it('refuses a second turn on a message that already has an agent run', async () => {
        const provider = createMockProvider({ hasExistingAgentRun: true });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /already been processed by an agent turn/i);
        }
    });

    it('refuses a second turn on a message that already has an AI reply detail', async () => {
        const provider = createMockProvider({ hasExistingReplyDetail: true });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /already been processed by an agent turn/i);
        }
    });

    it('refuses when second-turn read fails', async () => {
        const provider = createMockProvider({ agentRunReadFails: true });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /Could not verify agent run status|Database connection failed/i);
        }
    });

    it('refuses when conversation does not belong to active space chat', async () => {
        const provider = createMockProvider({ hasRoomChat: false });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /active conversations in this space accept agent turns/i);
        }
    });

    it('refuses when message does not belong to the conversation', async () => {
        const provider = createMockProvider({ messageConversationId: OTHER_CONVERSATION_ID });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /does not belong to this conversation/i);
        }
    });

    it('refuses when agent mentioned is not allowed in space', async () => {
        const provider = createMockProvider({
            messageText: `@{"type":"agent","id":"${DISALLOWED_AGENT_ID}","name":"Unauthorized"} help`,
            allowedAgents: [ALLOWED_AGENT_ID],
        });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /is not allowed in this space/i);
        }
    });

    it('succeeds when message mentions allowed agent, marks server-authored reply, and passes room Audience to AgentRunner', async () => {
        const provider = createMockProvider({
            messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`,
        });
        let capturedRunParams: { Audience?: { Mode: string; UserIDs: string[] } } | undefined;
        const heldRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = async (params) => {
            capturedRunParams = stubOf<{ Audience?: { Mode: string; UserIDs: string[] } }>(params);
            return heldRunAgent.call(AgentRunner.prototype, params) as never;
        };
        let result: Awaited<ReturnType<typeof executeSpaceChatTurn>>;
        try {
            result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        } finally {
            AgentRunner.prototype.RunAgent = heldRunAgent;
        }
        assert.equal(result.ok, true);
        if (result.ok) {
            assert.ok(result.replyDetailIds.length > 0);
            assert.ok(result.agentRunId);
        }

        // Assert saved reply and A19 Part 2 MarkServerAuthoredReply()
        assert.ok(provider.savedDetails.length >= 2, 'Should save In-Progress and Complete reply details');
        const initialReply = provider.savedDetails[0];
        assert.equal(initialReply.ParentID, USER_MESSAGE_ID);
        assert.equal(initialReply.Role, 'AI');
        assert.equal(initialReply.Status, 'In-Progress');
        assert.equal(initialReply.serverAuthoredReplyMarked, true, 'Assistant reply must call MarkServerAuthoredReply() before Save()');
        assert.equal(initialReply.ExternalID ?? null, null, 'a tagged turn\'s reply carries no explicit-ask marker');
        const finalReply = provider.savedDetails[provider.savedDetails.length - 1];
        assert.equal(finalReply.ParentID, USER_MESSAGE_ID);
        assert.equal(finalReply.Role, 'AI');
        assert.equal(finalReply.Status, 'Complete');
        assert.equal(finalReply.Message, 'Mocked agent response');
        assert.equal(finalReply.AgentID?.toLowerCase(), ALLOWED_AGENT_ID.toLowerCase());
        assert.equal(finalReply.serverAuthoredReplyMarked, true);

        // Assert B2.3 Audience passed to AgentRunner.RunAgent
        assert.ok(capturedRunParams, 'AgentRunner.RunAgent was called');
        const audience = capturedRunParams.Audience as { Mode: string; UserIDs: string[] } | undefined;
        assert.ok(audience, 'Audience was passed to AgentRunner.RunAgent');
        assert.equal(audience.Mode, 'Intersection');
        assert.deepEqual(
            audience.UserIDs.map((id) => id.toLowerCase()),
            [CALLER_ID.toLowerCase()],
            'Audience.UserIDs carries the room participants',
        );

        // Assert ExternalReferenceID stamp
        assert.ok(provider.savedRuns.length >= 1, 'Should save stamped agent run');
        const stampedRun = provider.savedRuns.find((r) => r.ExternalReferenceID === USER_MESSAGE_ID);
        assert.ok(stampedRun, 'Agent run should have ExternalReferenceID stamped with user message ID');
    });

    /** Runs a turn with the agent runner watched: what the run was given, or undefined when no run was started. */
    async function runWatchedTurn(provider: MockMetadataProvider, input: ExecuteSpaceChatTurnInput): Promise<{ result: Awaited<ReturnType<typeof executeSpaceChatTurn>>; runParams: { Audience?: { Mode: string; UserIDs: string[] } } | undefined }> {
        let runParams: { Audience?: { Mode: string; UserIDs: string[] } } | undefined;
        const heldRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = async (params) => {
            runParams = stubOf<{ Audience?: { Mode: string; UserIDs: string[] } }>(params);
            return heldRunAgent.call(AgentRunner.prototype, params) as never;
        };
        try {
            return { result: await executeSpaceChatTurn(provider, callerUser, input), runParams };
        } finally {
            AgentRunner.prototype.RunAgent = heldRunAgent;
        }
    }

    it('refuses the turn, before a reply is written or an agent runs, when the seats that reach the room cannot be read', async () => {
        const provider = createMockProvider({
            messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`,
            rosterReadFails: true,
        });
        const { result, runParams } = await runWatchedTurn(provider, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /Refusing retrieval: the spaces, roles or seats could not be read, so the audience would be incomplete/);
        }
        assert.equal(runParams, undefined, 'no agent runs, so none runs bounded by the asker alone');
        assert.equal(provider.savedDetails.length, 0, 'nothing is written for a refused turn');
    });

    it('refuses the turn when no audience comes back for it, rather than running for the asker alone', async () => {
        const provider = createMockProvider({
            messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`,
            seatGoneAfterGate: true,
        });
        const { result, runParams } = await runWatchedTurn(provider, defaultInput);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message, /the conversation's audience could not be worked out/);
        }
        assert.equal(runParams, undefined);
        assert.equal(provider.savedDetails.length, 0);
    });

    it('gives the agent run, and the type\'s driver, every member of a roster longer than one page', async () => {
        const others = Array.from({ length: 7 }, (_, index) => ({
            UserID: `dddddddd-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            User: `Member ${index + 1}`,
        }));
        const provider = createMockProvider({
            messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`,
            roomSeats: others,
        });
        let viewers: Record<string, 'Team' | 'Shared'> | undefined;
        class WatchingDriver extends BaseSpaceTypeServerDriver {
            public override BuildAgentContext(input: Parameters<BaseSpaceTypeServerDriver['BuildAgentContext']>[0]): ReturnType<BaseSpaceTypeServerDriver['BuildAgentContext']> {
                viewers = input.viewerBands;
                return super.BuildAgentContext(input);
            }
        }
        const held = resolveDriver;
        resolveDriver = async () => ({ space: {}, spaceType: {}, driver: new WatchingDriver() });
        let watched: Awaited<ReturnType<typeof runWatchedTurn>>;
        try {
            watched = await runWatchedTurn(provider, { ...defaultInput, rosterPageSize: 3 });
        } finally {
            resolveDriver = held;
        }
        assert.equal(watched.result.ok, true);
        const everyone = [CALLER_ID, ...others.map((person) => person.UserID)].map((id) => id.toLowerCase()).sort();
        const audience = watched.runParams?.Audience as { Mode: string; UserIDs: string[] } | undefined;
        assert.ok(audience, 'Audience was passed to AgentRunner.RunAgent');
        assert.deepEqual(audience.UserIDs.map((id) => id.toLowerCase()).sort(), everyone, 'all eight people bound the run');
        assert.ok(viewers, 'the type\'s driver was asked for its context');
        assert.deepEqual(Object.keys(viewers).map((id) => id.toLowerCase()).sort(), everyone, 'the driver is told of all eight viewers');
        const pagedReads = provider.seatReads.filter((read) => read.AfterKey);
        assert.ok(pagedReads.length >= 4, `both seat reads went past their first page (${pagedReads.length} later pages)`);
        assert.ok(pagedReads.every((read) => read.MaxRows === 3));
    });

    it('marks reply detail as Error when agent execution fails', async () => {
        const origRunner = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = async () => ({
            success: false,
            errorMessage: 'Simulated LLM failure',
            agentRun: stubOf<MJAIAgentRunEntityExtended>({ ID: 'failed-run' }),
        });
        try {
            const provider = createMockProvider({
                messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`,
            });
            const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
            assert.equal(result.ok, false);
            assert.match(result.message, /could not answer/);
            assert.doesNotMatch(result.message, /Simulated LLM failure/, 'the cause goes to the log, not to the conversation');
            assert.ok(provider.savedDetails.length >= 2);
            const errorReply = provider.savedDetails[provider.savedDetails.length - 1];
            assert.equal(errorReply.Status, 'Error');
            assert.match(errorReply.Message ?? '', /could not answer/);
            assert.doesNotMatch(errorReply.Message ?? '', /Simulated LLM failure/);
        } finally {
            AgentRunner.prototype.RunAgent = origRunner;
        }
    });

    it('marks the reply Error when the history read fails, with a plain sentence', async () => {
        const held = ConversationEngine.LoadWindowRowsFresh;
        ConversationEngine.LoadWindowRowsFresh = async () => {
            throw new Error('the history read failed');
        };
        try {
            const provider = createMockProvider({ messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space` });
            const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
            assert.equal(result.ok, false);
            assert.match(result.message, /could not answer/);
            const reply = provider.savedDetails[provider.savedDetails.length - 1];
            assert.equal(reply.Status, 'Error');
            assert.match(reply.Message ?? '', /could not answer/);
            assert.doesNotMatch(reply.Message ?? '', /history read failed/);
        } finally {
            ConversationEngine.LoadWindowRowsFresh = held;
        }
    });

    it('marks the reply Error when its final save fails, instead of leaving it In-Progress', async () => {
        const provider = createMockProvider({
            messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`,
            detailSaveFailsWhenStatus: 'Complete',
        });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        const statuses = provider.savedDetails.map((detail) => detail.Status);
        assert.deepEqual(statuses.slice(-2), ['Complete', 'Error'], `the reply's saves were ${statuses.join(', ')}`);
    });

    it('runs one turn when two calls arrive for the same message at once', async () => {
        const origRunner = AgentRunner.prototype.RunAgent;
        let runs = 0;
        AgentRunner.prototype.RunAgent = async (params) => {
            runs++;
            await new Promise((resolve) => setTimeout(resolve, 25));
            if (typeof params.onAgentRunCreated === 'function') await params.onAgentRunCreated(RUN_MOCKED_2);
            return { success: true, agentRun: stubOf<MJAIAgentRunEntityExtended>({ ID: RUN_MOCKED_2, Message: 'Mocked agent response' }), result: 'Mocked agent response' };
        };
        try {
            const provider = createMockProvider({ messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space` });
            const [first, second] = await Promise.all([
                executeSpaceChatTurn(provider, callerUser, defaultInput),
                executeSpaceChatTurn(provider, callerUser, defaultInput),
            ]);
            assert.equal(runs, 1, 'the agent ran once');
            assert.deepEqual([first.ok, second.ok].sort(), [false, true]);
            const refused = first.ok ? second : first;
            assert.equal(refused.ok === false && refused.message, 'This message has already been processed by an agent turn.');
            // Once the turn has finished, the claim is released: a later call is judged by the saved reply, not by the claim
            const later = await executeSpaceChatTurn(provider, callerUser, defaultInput);
            assert.equal(runs, 2, 'a later call is not blocked by the claim');
            assert.equal(later.ok, true);
        } finally {
            AgentRunner.prototype.RunAgent = origRunner;
        }
    });

    describe('in the background', () => {
        const MENTION = `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`;
        /** A run that waits at the gate, so a test can look at the turn while the agent is still working. */
        const gatedRun = (gate: Promise<void>, seen: { progress: string[]; streamed: string[] }) => async (params: Parameters<AgentRunner['RunAgent']>[0]) => {
            if (typeof params.onAgentRunCreated === 'function') await params.onAgentRunCreated(RUN_BG_1);
            params.onProgress?.({ step: 'prompt_execution', message: 'Thinking it over' });
            params.onStreaming?.({ content: 'Partial words', isComplete: false });
            await gate;
            return { success: true, agentRun: stubOf<MJAIAgentRunEntityExtended>({ ID: RUN_BG_1, Message: 'The final answer' }), result: 'The final answer' };
        };

        it('answers with the In-Progress reply before the agent is done, hands progress and text to the observer, and tells it the end', async () => {
            const held = AgentRunner.prototype.RunAgent;
            let open: () => void = () => undefined;
            const gate = new Promise<void>((resolve) => { open = resolve; });
            const seen = { progress: [] as string[], streamed: [] as string[] };
            const outcomes: { replyDetailId: string; success: boolean; runId: string | undefined }[] = [];
            AgentRunner.prototype.RunAgent = gatedRun(gate, seen);
            try {
                const provider = createMockProvider({ messageText: MENTION });
                const result = await executeSpaceChatTurn(provider, callerUser, {
                    ...defaultInput,
                    background: true,
                    observer: {
                        OnProgress: (progress) => seen.progress.push(progress.message),
                        OnStreaming: (chunk) => seen.streamed.push(chunk.content),
                        OnFinished: (outcome) => outcomes.push({ replyDetailId: outcome.replyDetailId, success: outcome.success, runId: outcome.agentRun?.ID }),
                    },
                });
                assert.equal(result.ok, true, result.ok ? '' : result.message);
                assert.equal(result.ok && result.replyDetailIds.length, 1);
                assert.equal(provider.savedDetails[provider.savedDetails.length - 1].Status, 'In-Progress', 'the reply is still In-Progress when the call returns');
                assert.equal(outcomes.length, 0, 'the run has not ended');

                // While it runs, the message's claim holds: a second turn on it is refused
                const again = await executeSpaceChatTurn(provider, callerUser, defaultInput);
                assert.equal(again.ok, false);

                open();
                await new Promise((resolve) => setTimeout(resolve, 20));
                assert.deepEqual(seen.progress, ['Thinking it over']);
                assert.deepEqual(seen.streamed, ['Partial words']);
                const finalReply = provider.savedDetails[provider.savedDetails.length - 1];
                assert.equal(finalReply.Status, 'Complete');
                assert.equal(finalReply.Message, 'The final answer');
                assert.deepEqual(outcomes, [{ replyDetailId: result.ok ? result.replyDetailIds[0] : '', success: true, runId: RUN_BG_1 }]);
            } finally {
                AgentRunner.prototype.RunAgent = held;
            }
        });

        it('tells the observer a run that failed, and that a fault in the observer does not fail the turn', async () => {
            const held = AgentRunner.prototype.RunAgent;
            AgentRunner.prototype.RunAgent = async () => ({ success: false, errorMessage: 'Simulated LLM failure', agentRun: stubOf<MJAIAgentRunEntityExtended>({ ID: 'failed-bg-run' }) });
            const outcomes: { success: boolean; errorMessage: string | undefined }[] = [];
            try {
                const provider = createMockProvider({ messageText: MENTION });
                const result = await executeSpaceChatTurn(provider, callerUser, {
                    ...defaultInput,
                    background: true,
                    observer: { OnFinished: (outcome) => { outcomes.push({ success: outcome.success, errorMessage: outcome.errorMessage }); throw new Error('the observer broke'); } },
                });
                assert.equal(result.ok, true, result.ok ? '' : result.message);
                await new Promise((resolve) => setTimeout(resolve, 20));
                assert.deepEqual(outcomes, [{ success: false, errorMessage: 'Simulated LLM failure' }]);
                const reply = provider.savedDetails[provider.savedDetails.length - 1];
                assert.equal(reply.Status, 'Error');
                // The claim was released even though the observer threw: a later call is judged by the saved reply again
                const later = await executeSpaceChatTurn(provider, callerUser, defaultInput);
                assert.notEqual(later.ok && later.replyDetailIds.length, 0);
            } finally {
                AgentRunner.prototype.RunAgent = held;
            }
        });
    });

    it("a fault in the observer does not fail a turn that answers when it ends: the reply is saved and reported, and the observer's error is only logged", async () => {
        const provider = createMockProvider({ messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space` });
        const outcomes: { success: boolean; result: boolean }[] = [];
        const result = await executeSpaceChatTurn(provider, callerUser, {
            ...defaultInput,
            observer: { OnFinished: (outcome) => { outcomes.push({ success: outcome.success, result: !!outcome.result }); throw new Error('the observer broke'); } },
        });
        assert.equal(result.ok, true, 'the turn answers although its observer threw');
        assert.deepEqual(outcomes, [{ success: true, result: true }], "the observer heard the end, with the run's result");
        const reply = provider.savedDetails[provider.savedDetails.length - 1];
        assert.equal(reply.Status, 'Complete');
    });

    it("a turn that throws after the run still ends: the reply is marked Error, and the observer is told the turn failed, with the reply row's id, once", async () => {
        const mention = `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`;
        // In the background: the call has answered, so the observer's word is the only thing that tells the chat the reply finished
        const background = createMockProvider({ messageText: mention, detailSaveThrowsWhenStatus: 'Complete' });
        const outcomes: { replyDetailId: string; success: boolean; errorMessage: string | undefined; runId: string | undefined; hasResult: boolean }[] = [];
        const started = await executeSpaceChatTurn(background, callerUser, {
            ...defaultInput,
            background: true,
            observer: { OnFinished: (outcome) => { outcomes.push({ replyDetailId: outcome.replyDetailId, success: outcome.success, errorMessage: outcome.errorMessage, runId: outcome.agentRun?.ID, hasResult: !!outcome.result }); } },
        });
        assert.equal(started.ok, true);
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(outcomes.length, 1, 'the observer hears the end once');
        assert.equal(outcomes[0].success, false);
        assert.equal(outcomes[0].replyDetailId, started.ok ? started.replyDetailIds[0] : '');
        assert.match(outcomes[0].errorMessage ?? '', /could not be reached/);
        // The run had finished before the throw, so the failure carries it: the chat reads a completion's run
        assert.equal(outcomes[0].runId, RUN_MOCKED_1, 'the failure names the run that finished');
        assert.equal(outcomes[0].hasResult, true, 'and carries its result');
        assert.equal(background.savedDetails[background.savedDetails.length - 1].Status, 'Error', 'the row is marked Error, not left In-Progress');
        // The claim is released: a later call for the same message is judged again
        const later = await executeSpaceChatTurn(createMockProvider({ messageText: mention }), callerUser, defaultInput);
        assert.equal(later.ok, true);

        // In the foreground the call itself answers that the assistant failed, where it used to reject
        const foreground = createMockProvider({ messageText: mention, detailSaveThrowsWhenStatus: 'Complete' });
        const result = await executeSpaceChatTurn(foreground, callerUser, defaultInput);
        assert.equal(result.ok, false);
        assert.equal(foreground.savedDetails[foreground.savedDetails.length - 1].Status, 'Error');
    });

    it('refuses an untagged message under Always when no agent is Active', async () => {
        const provider = createMockProvider({
            messageText: 'Hello without any agent mention',
            spaceConfiguration: JSON.stringify({ Chats: { AgentReplyMode: 'Always' } }),
            noActiveAgents: true,
        });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, false);
        assert.match(result.message, /No assistant is available/);
    });

    it('succeeds with untagged message when space reply mode is Always', async () => {
        const alwaysConfig = JSON.stringify({
            Chats: { AgentReplyMode: 'Always' },
        });
        const provider = createMockProvider({
            messageText: 'Hello room without any agent mention',
            spaceConfiguration: alwaysConfig,
        });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, true);
        if (result.ok) {
            assert.ok(result.replyDetailIds.length > 0);
            assert.ok(result.agentRunId);
        }
    });

    it('refuses host-rules query when caller does not reach space', async () => {
        const provider = createMockProvider({ callerHasReach: false });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.match(result.message ?? '', /Caller does not reach this space/i);
        }
    });

    it('resolves host-rules query with caller reach and HistoryOnAdd floor', async () => {
        const provider = createMockProvider({ callerHasReach: true });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, true);
        if (result.ok) {
            assert.equal(result.agentReplyMode, 'MentionOnly');
            assert.ok(result.agentHistoryFrom instanceof Date);
            assert.equal(result.mentionPeople.length, 1);
            assert.equal(result.mentionPeople[0].ID, CALLER_ID);
        }
    });

    it("executes an explicit ask (route: 'Redirect') by the message's author on an untagged message in a MentionOnly space, threads the reply under that message, and keeps UserID as the system user (R5-B1, R5-B2, R5-S1)", async () => {
        const provider = createMockProvider({
            messageText: 'Can someone check the Q3 variance numbers?',
            messageUserId: CALLER_ID,
            spaceConfiguration: JSON.stringify({ Chats: { AgentReplyMode: 'MentionOnly' } }),
        });
        const result = await executeSpaceChatTurn(provider, callerUser, {
            ...defaultInput,
            route: 'Redirect',
            agentId: ALLOWED_AGENT_ID,
        });
        assert.equal(result.ok, true, result.ok ? '' : result.message);
        if (result.ok) {
            assert.ok(result.replyDetailIds.length > 0);
        }
        const reply = provider.savedDetails[provider.savedDetails.length - 1];
        assert.equal(reply.ParentID, USER_MESSAGE_ID, 'reply threads under the asked message');
        assert.equal(reply.AgentID, ALLOWED_AGENT_ID, 'reply runs the requested allowed agent');
        assert.equal(reply.UserID, SYSTEM_USER_ID, 'reply stays authored by the server system user (R5-B1)');
        assert.equal(reply.Status, 'Complete');
        assert.equal(provider.savedDetails[0].ExternalID, EXPLICIT_ASK_MARKER, 'the reply row is inserted with the explicit-ask marker');
    });

    it("refuses an explicit ask (route: 'Redirect') from another member who did not author the message, when the caller cannot post, or when the agent is not allowed in the space (R5-B2)", async () => {
        const nonAuthorProvider = createMockProvider({
            messageText: 'Can someone check the Q3 variance numbers?',
            messageUserId: OTHER_USER_ID,
            spaceConfiguration: JSON.stringify({ Chats: { AgentReplyMode: 'MentionOnly' } }),
        });
        const nonAuthorResult = await executeSpaceChatTurn(nonAuthorProvider, callerUser, {
            ...defaultInput,
            route: 'Redirect',
            agentId: ALLOWED_AGENT_ID,
        });
        assert.equal(nonAuthorResult.ok, false);
        if (!nonAuthorResult.ok) {
            assert.match(nonAuthorResult.message, /Only messages authored by the caller can initiate an agent turn/i);
        }

        const nonContribProvider = createMockProvider({
            canContribute: false,
            messageText: 'Can someone check the Q3 variance numbers?',
            spaceConfiguration: JSON.stringify({ Chats: { AgentReplyMode: 'MentionOnly' } }),
        });
        const nonContribResult = await executeSpaceChatTurn(nonContribProvider, callerUser, {
            ...defaultInput,
            route: 'Redirect',
            agentId: ALLOWED_AGENT_ID,
        });
        assert.equal(nonContribResult.ok, false);
        if (!nonContribResult.ok) {
            assert.match(nonContribResult.message, /cannot run an agent turn/i);
        }

        const disallowedAgentProvider = createMockProvider({
            messageText: 'Can someone check the Q3 variance numbers?',
            spaceConfiguration: JSON.stringify({ Chats: { AgentReplyMode: 'MentionOnly' } }),
        });
        const disallowedResult = await executeSpaceChatTurn(disallowedAgentProvider, callerUser, {
            ...defaultInput,
            route: 'Redirect',
            agentId: DISALLOWED_AGENT_ID,
        });
        assert.equal(disallowedResult.ok, false);
        if (!disallowedResult.ok) {
            assert.match(disallowedResult.message, /not allowed in this space/i);
        }
    });

    it('wraps AgentRunner.RunAgent in CT-7 turn authority for Space Participant caller only during execution', async () => {
        const participantCaller = new UserInfo(undefined, {
            ID: CALLER_ID,
            Name: 'Caller',
            Email: 'caller@example.com',
            UserRoles: [{ ID: 'ur-caller', UserID: CALLER_ID, RoleID: PARTICIPANT_ROLE_ID, Role: 'Space Participant' }],
        });
        const otherParticipant = new UserInfo(undefined, {
            ID: OTHER_USER_ID,
            Name: 'Other',
            Email: 'other@example.com',
            UserRoles: [{ ID: 'ur-other', UserID: OTHER_USER_ID, RoleID: PARTICIPANT_ROLE_ID, Role: 'Space Participant' }],
        });

        const observedInsideTurn: Record<string, string | null> = {};
        const prevRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = async <C, R>(
            params: ExecuteAgentParams<C>
        ): Promise<ExecuteAgentResult<R>> => {
            for (const entityName of COLLABORATION_AI_RUN_LOCKDOWN_ENTITIES) {
                observedInsideTurn[`self:${entityName}`] = evaluateParticipantAIRunWriteAccess(
                    entityName,
                    'save',
                    participantCaller
                );
                observedInsideTurn[`other:${entityName}`] = evaluateParticipantAIRunWriteAccess(
                    entityName,
                    'save',
                    otherParticipant
                );
            }
            return prevRunAgent(params);
        };

        try {
            const provider = createMockProvider({
                messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} run check`,
            });
            const result = await executeSpaceChatTurn(provider, participantCaller, defaultInput);
            assert.equal(result.ok, true);
        } finally {
            AgentRunner.prototype.RunAgent = prevRunAgent;
        }

        for (const entityName of COLLABORATION_AI_RUN_LOCKDOWN_ENTITIES) {
            assert.equal(
                observedInsideTurn[`self:${entityName}`],
                null,
                `Caller must be allowed to write ${entityName} during their active turn`
            );
            assert.ok(
                observedInsideTurn[`other:${entityName}`],
                `Another participant must remain blocked from writing ${entityName} during caller's turn`
            );
            assert.ok(
                evaluateParticipantAIRunWriteAccess(entityName, 'save', participantCaller),
                `Caller must be locked down again once executeSpaceChatTurn returns (${entityName})`
            );
        }
    });

    it('records tool-retrieved in-reach sources alongside cited receipts while rejecting out-of-reach tool hits and excluding un-retrieved static KnowledgeSource grants (CR-6)', async () => {
        const ITEM_TOP1 = 'aa100000-0000-4000-8000-000000000001';
        const ITEM_TOOL_HIT = 'aa100000-0000-4000-8000-000000000002';
        const ITEM_OUT_OF_REACH_TEAM = 'aa100000-0000-4000-8000-000000000003';
        const FILE_ENTITY_ID = 'bb100000-0000-4000-8000-000000000001';
        const FILE_1 = 'cc100000-0000-4000-8000-000000000001';
        const FILE_2 = 'cc100000-0000-4000-8000-000000000002';
        const FILE_3 = 'cc100000-0000-4000-8000-000000000003';
        const STATIC_KNOWLEDGE_ID = 'dd100000-0000-4000-8000-000000000001';

        const baseProvider = createMockProvider({
            messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize top calibration item`,
        });
        const baseRunView = stubOf<IRunViewProvider>(baseProvider);
        const persistedReceiptRows: Array<Record<string, string | number | boolean | null>> = [];

        const cr6ProviderObj: Partial<IMetadataProvider & IRunViewProvider> = {
            ...baseProvider,
            EntityByID(id: string): EntityInfo | undefined {
                if (id.toLowerCase() === FILE_ENTITY_ID) {
                    return { ID: FILE_ENTITY_ID, Name: 'MJ: Files' } as Partial<EntityInfo> as EntityInfo;
                }
                return baseProvider.EntityByID(id);
            },
            EntityByName(name: string): EntityInfo | undefined {
                if (name === 'MJ: Files' || name === 'MJ: Content Sources') {
                    return { Name: name } as Partial<EntityInfo> as EntityInfo;
                }
                return baseProvider.EntityByName(name);
            },
            GetEntityObject: (async <T extends import('@memberjunction/core').BaseEntity>(
                entityName: string,
                loadKeyOrUser?: UserInfo,
                contextUserArg?: UserInfo,
            ): Promise<T> => {
                if (entityName === 'MJ_BizApps_Collaboration: Space Agent Source Receipts') {
                    const row: Record<string, string | number | boolean | null | (() => boolean) | (() => Promise<boolean>)> = {
                        ID: nextReplyUuid(),
                        NewRecord() {
                            return true;
                        },
                        async Load() {
                            return true;
                        },
                        async Save() {
                            const snapshot: Record<string, string | number | boolean | null> = {};
                            for (const [k, v] of Object.entries(row)) {
                                if (typeof v !== 'function') snapshot[k] = v;
                            }
                            persistedReceiptRows.push(snapshot);
                            return true;
                        },
                    };
                    return stubOf<T>(row);
                }
                if (contextUserArg !== undefined) {
                    return baseProvider.GetEntityObject<T>(
                        entityName,
                        stubOf<import('@memberjunction/core').CompositeKey>(loadKeyOrUser as object),
                        contextUserArg,
                    );
                }
                return baseProvider.GetEntityObject<T>(entityName, loadKeyOrUser);
            }) as IMetadataProvider['GetEntityObject'],
            async RunView<T>(params: RunViewParams, userArg?: UserInfo): Promise<RunViewResult<T>> {
                const entity = params.EntityName ?? '';
                const filter = String(params.ExtraFilter ?? '');
                if (entity === 'MJ_BizApps_Collaboration: Space Grants') {
                    return mockResult<T>([
                        {
                            ID: '10100000-0000-4000-8000-000000000001',
                            Kind: 'Agent',
                            Mode: 'Extend',
                            Band: 'Shared',
                            TargetEntityID: 'E-AGENTS',
                            Sequence: 0,
                            TargetRecordID: ALLOWED_AGENT_ID,
                            SpaceTypeID: null,
                            SpaceID: SPACE_ID,
                            IsDefault: true,
                        },
                        {
                            ID: '10100000-0000-4000-8000-000000000002',
                            Kind: 'KnowledgeSource',
                            Mode: 'Extend',
                            Band: 'Shared',
                            TargetEntityID: 'E-SOURCES',
                            Sequence: 1,
                            TargetRecordID: STATIC_KNOWLEDGE_ID,
                            SpaceTypeID: null,
                            SpaceID: SPACE_ID,
                            IsDefault: false,
                        },
                    ]);
                }
                if (entity === 'MJ: Content Sources') {
                    return mockResult<T>([
                        { ID: STATIC_KNOWLEDGE_ID, Name: 'Unretrieved Knowledge Grant' },
                    ]);
                }
                if (entity === 'MJ_BizApps_Collaboration: Space Items') {
                    const allItems = [
                        { ID: ITEM_TOP1, SpaceID: SPACE_ID, EntityID: FILE_ENTITY_ID, RecordID: FILE_1, Band: 'Shared' },
                        { ID: ITEM_TOOL_HIT, SpaceID: SPACE_ID, EntityID: FILE_ENTITY_ID, RecordID: FILE_2, Band: 'Shared' },
                        { ID: ITEM_OUT_OF_REACH_TEAM, SpaceID: SPACE_ID, EntityID: FILE_ENTITY_ID, RecordID: FILE_3, Band: 'Team' },
                    ];
                    if (filter.includes("Band = 'Shared'")) {
                        return mockResult<T>(allItems.filter((i) => i.Band === 'Shared'));
                    }
                    if (/\bID IN \(/i.test(filter)) {
                        return mockResult<T>(allItems.filter((i) => filter.toLowerCase().includes(i.ID.toLowerCase())));
                    }
                    return mockResult<T>(allItems);
                }
                if (entity === 'MJ: Files') {
                    return mockResult<T>([
                        { ID: FILE_1, Name: 'calibration-summary-alpha.pdf', Description: 'calibration alpha primary', ContentType: 'application/pdf' },
                        { ID: FILE_2, Name: 'secondary-addendum.pdf', Description: 'routine appendix discovered via scoped search tool', ContentType: 'application/pdf' },
                        { ID: FILE_3, Name: 'team-secret-board-notes.pdf', Description: 'confidential team memo', ContentType: 'application/pdf' },
                    ]);
                }
                return baseRunView.RunView<T>(params, userArg);
            },
            async RunViews<T>(paramsList: RunViewParams[], userArg?: UserInfo): Promise<RunViewResult<T>[]> {
                return Promise.all(paramsList.map((p) => cr6ProviderObj.RunView!<T>(p, userArg)));
            },
        };

        const prevRunAgent = AgentRunner.prototype.RunAgent;
        const runId = nextRunUuid();
        AgentRunner.prototype.RunAgent = async <C, R>(params: ExecuteAgentParams<C>): Promise<ExecuteAgentResult<R>> => {
            // Simulate an in-turn Scoped Search tool call discovering ITEM_TOOL_HIT (outside topK=1)
            // plus an out-of-reach Team item ITEM_OUT_OF_REACH_TEAM (in a General/Shared chat).
            const ctx = params.context as SpaceTurnContext | undefined;
            if (ctx) {
                recordScopedSearchHitsOnContext(
                    {
                        Context: ctx,
                        RunScope: {
                            PrimaryScopeRecordID: SPACE_ID,
                            SearchScopeIDs: [COLLABORATION_SPACE_SCOPE_ID],
                        },
                    },
                    {
                        Success: true,
                        ResultCode: 'SUCCESS',
                        Params: [
                            {
                                Name: 'Results',
                                Type: 'Output',
                                Value: [
                                    { EntityName: 'MJ_BizApps_Collaboration: Space Items', RecordID: ITEM_TOOL_HIT, Score: 0.94 },
                                    { EntityName: 'MJ_BizApps_Collaboration: Space Items', RecordID: ITEM_OUT_OF_REACH_TEAM, Score: 0.99 },
                                ],
                            },
                        ],
                    },
                );
            }
            if (typeof params.onAgentRunCreated === 'function') {
                await params.onAgentRunCreated(runId);
            }
            const replyText =
                `Verified addendum [source:${ITEM_TOOL_HIT}] and blocked ref [source:${ITEM_OUT_OF_REACH_TEAM}].`;
            const runObj = {
                ID: runId,
                Message: replyText,
                Result: replyText,
                Status: 'Completed',
                ExternalReferenceID: params.conversationDetailId,
            };
            return {
                success: true,
                agentRun: stubOf<MJAIAgentRunEntityExtended>(runObj),
            };
        };

        try {
            const turnResult = await executeSpaceChatTurn(
                cr6ProviderObj as IMetadataProvider,
                callerUser,
                {
                    ...defaultInput,
                    topK: 1,
                },
            );
            assert.equal(turnResult.ok, true, turnResult.ok ? '' : turnResult.message);
            if (!turnResult.ok) return;

            const receipts = turnResult.sourceReceipts ?? [];
            const ids = receipts.map((r) => r.spaceItemId?.toLowerCase());
            assert.ok(ids.includes(ITEM_TOP1), 'Initial top-1 supplied item should have a receipt');
            assert.ok(ids.includes(ITEM_TOOL_HIT), 'Tool-retrieved in-reach item outside initial top-1 must be recorded as Supplied + Cited');
            assert.ok(!ids.includes(ITEM_OUT_OF_REACH_TEAM), 'Out-of-reach Team tool hit must be rejected even if cited');
            assert.equal(
                receipts.some((r) => r.sourceKind === 'KnowledgeSource'),
                false,
                'Un-retrieved static KnowledgeSource grant must NOT be marked Supplied (CR-6)',
            );

            const toolReceipt = receipts.find((r) => r.spaceItemId?.toLowerCase() === ITEM_TOOL_HIT);
            assert.equal(toolReceipt?.wasSupplied, true);
            assert.equal(toolReceipt?.wasCited, true);
            assert.equal(toolReceipt?.citationOrdinal, 1);

            const persistedTool = persistedReceiptRows.find(
                (r) => String(r['SpaceItemID'] ?? '').toLowerCase() === ITEM_TOOL_HIT,
            );
            assert.ok(persistedTool, 'Tool-hit receipt must be persisted to DB');
            assert.equal(persistedTool?.['WasSupplied'], true);
            assert.equal(persistedTool?.['WasCited'], true);
        } finally {
            AgentRunner.prototype.RunAgent = prevRunAgent;
        }
    });

    it('hydrates missing UserCache audience participants via batched RunView and fails closed when any participant cannot be verified (CR-4)', async () => {
        const EXTRA_SCOPE_ID = 'ee100000-0000-4000-8000-000000000001';
        const EXTRA_CS_ID = 'ff100000-0000-4000-8000-000000000001';
        const EXTRA_ROLE_ID = 'aa200000-0000-4000-8000-000000000001';

        const makeAudienceProvider = (opts: { hydrateOtherUser: boolean; otherHasRole: boolean }) => {
            const baseProvider = createMockProvider({
                roomSeats: [{ UserID: OTHER_USER_ID, User: 'Other Participant' }],
            });
            const baseRunView = stubOf<IRunViewProvider>(baseProvider);
            const audienceProviderObj: Partial<IMetadataProvider & IRunViewProvider> = {
                ...baseProvider,
                async RunView<T>(params: RunViewParams, userArg?: UserInfo): Promise<RunViewResult<T>> {
                    const entity = params.EntityName ?? '';
                    const filter = String(params.ExtraFilter ?? '');
                    if (entity === 'MJ_BizApps_Collaboration: Space Grants') {
                        return mockResult<T>([
                            {
                                ID: '10200000-0000-4000-8000-000000000001',
                                Kind: 'Agent',
                                Mode: 'Extend',
                                Band: 'Shared',
                                TargetEntityID: 'E-AGENTS',
                                Sequence: 0,
                                TargetRecordID: ALLOWED_AGENT_ID,
                                SpaceTypeID: null,
                                SpaceID: SPACE_ID,
                                IsDefault: true,
                            },
                            {
                                ID: '10200000-0000-4000-8000-000000000002',
                                Kind: 'KnowledgeSource',
                                Mode: 'Extend',
                                Band: 'Shared',
                                TargetEntityID: 'E-SOURCES',
                                Sequence: 1,
                                TargetRecordID: EXTRA_CS_ID,
                                SpaceTypeID: null,
                                SpaceID: SPACE_ID,
                                IsDefault: false,
                                Settings: JSON.stringify({ SearchScopeID: EXTRA_SCOPE_ID }),
                            },
                        ]);
                    }
                    if (entity === 'MJ: Content Sources') {
                        return mockResult<T>([{ ID: EXTRA_CS_ID, Name: 'Audience Test KB', Configuration: null }]);
                    }
                    if (entity === 'MJ: Search Scopes') {
                        return mockResult<T>([
                            { ID: COLLABORATION_SPACE_SCOPE_ID, Name: 'Collaboration Space Scope', Status: 'Active', IsGlobal: false },
                            { ID: EXTRA_SCOPE_ID, Name: 'Audience Checked Scope', Status: 'Active', IsGlobal: false },
                        ]);
                    }
                    if (entity === 'MJ: Search Scope Permissions') {
                        return mockResult<T>([
                            { ID: 'perm-caller', SearchScopeID: EXTRA_SCOPE_ID, UserID: CALLER_ID, RoleID: null, PermissionLevel: 'Search', PrimaryScopeRecordID: null },
                            { ID: 'perm-role', SearchScopeID: EXTRA_SCOPE_ID, UserID: null, RoleID: EXTRA_ROLE_ID, PermissionLevel: 'Search', PrimaryScopeRecordID: null },
                        ]);
                    }
                    if (entity === 'MJ: Users' && filter.toLowerCase().includes(OTHER_USER_ID.toLowerCase())) {
                        return opts.hydrateOtherUser
                            ? mockResult<T>([{ ID: OTHER_USER_ID, Name: 'Other Participant', Email: 'other@example.test', IsActive: true }])
                            : mockResult<T>([]);
                    }
                    if (entity === 'MJ: User Roles' && filter.toLowerCase().includes(OTHER_USER_ID.toLowerCase())) {
                        return opts.hydrateOtherUser && opts.otherHasRole
                            ? mockResult<T>([{ ID: 'ur-other-1', UserID: OTHER_USER_ID, RoleID: EXTRA_ROLE_ID, Role: 'Authorized Reader' }])
                            : mockResult<T>([]);
                    }
                    return baseRunView.RunView<T>(params, userArg);
                },
                async RunViews<T>(paramsList: RunViewParams[], userArg?: UserInfo): Promise<RunViewResult<T>[]> {
                    return Promise.all(paramsList.map((p) => audienceProviderObj.RunView!<T>(p, userArg)));
                },
            };
            return stubOf<IMetadataProvider>(audienceProviderObj);
        };

        // Case 1: Missing from UserCache, fallback RunView fails to find OTHER_USER_ID -> FAIL CLOSED
        let unverifiedSearchCalled = false;
        const missingRes = await executeSpaceChatTurn(
            makeAudienceProvider({ hydrateOtherUser: false, otherHasRole: false }),
            callerUser,
            {
                ...defaultInput,
                multiScopeSearch: async () => {
                    unverifiedSearchCalled = true;
                    return { Success: true, Results: [] };
                },
            },
        );
        assert.equal(missingRes.ok, true, missingRes.ok ? '' : missingRes.message);
        if (missingRes.ok) {
            assert.deepEqual(missingRes.tools?.searchScopeIds, [COLLABORATION_SPACE_SCOPE_ID]);
            assert.deepEqual(missingRes.tools?.grantedKnowledgeScopeNames, []);
        }
        assert.equal(unverifiedSearchCalled, false, 'Must never dispatch multi-scope search without verified full Audience.Readers');

        // Case 2: Fallback RunView hydrates OTHER_USER_ID WITHOUT role -> audience intersection withholds extra scope
        const deniedRes = await executeSpaceChatTurn(
            makeAudienceProvider({ hydrateOtherUser: true, otherHasRole: false }),
            callerUser,
            {
                ...defaultInput,
                multiScopeSearch: async () => ({ Success: true, Results: [] }),
            },
        );
        assert.equal(deniedRes.ok, true, deniedRes.ok ? '' : deniedRes.message);
        if (deniedRes.ok) {
            assert.deepEqual(deniedRes.tools?.searchScopeIds, [COLLABORATION_SPACE_SCOPE_ID]);
            assert.deepEqual(deniedRes.tools?.grantedKnowledgeScopeNames, []);
        }

        // Case 3: Fallback RunView hydrates OTHER_USER_ID WITH authorized role -> extra scope authorized & Audience.Readers populated
        let capturedReaderIds: string[] = [];
        const authorizedRes = await executeSpaceChatTurn(
            makeAudienceProvider({ hydrateOtherUser: true, otherHasRole: true }),
            callerUser,
            {
                ...defaultInput,
                multiScopeSearch: async (searchParams) => {
                    capturedReaderIds = (searchParams.Audience?.Readers ?? []).map((r) => r.ID.toLowerCase());
                    return { Success: true, Results: [] };
                },
            },
        );
        assert.equal(authorizedRes.ok, true, authorizedRes.ok ? '' : authorizedRes.message);
        if (authorizedRes.ok) {
            assert.deepEqual(authorizedRes.tools?.searchScopeIds, [COLLABORATION_SPACE_SCOPE_ID, EXTRA_SCOPE_ID]);
            assert.deepEqual(authorizedRes.tools?.grantedKnowledgeScopeNames, ['Audience Checked Scope']);
        }
        assert.equal(capturedReaderIds.includes(CALLER_ID.toLowerCase()), true);
        assert.equal(capturedReaderIds.includes(OTHER_USER_ID.toLowerCase()), true);
    });

    it('overrides InjectNotes and InjectExamples to false in memory for ambient agents like Sage without ever calling Save()', async () => {
        const baseProvider = createMockProvider();
        const baseGetEntityObject = baseProvider.GetEntityObject.bind(baseProvider);
        let agentSaveCalls = 0;
        let capturedAgent: { InjectNotes?: boolean; InjectExamples?: boolean } | null = null;

        const providerWithSage = stubOf<IMetadataProvider>({
            ...baseProvider,
            EntityByName: baseProvider.EntityByName.bind(baseProvider),
            EntityByID: baseProvider.EntityByID.bind(baseProvider),
            RunView: (baseProvider as unknown as IRunViewProvider).RunView.bind(baseProvider),
            RunViews: (baseProvider as unknown as IRunViewProvider).RunViews.bind(baseProvider),
            async GetEntityObject(entityName: string, contextUser?: UserInfo) {
                if (entityName === 'MJ: AI Agents') {
                    return stubOf<never>({
                        ID: ALLOWED_AGENT_ID,
                        Name: 'Sage',
                        TypeID: 'agent-type-1',
                        DriverClass: null,
                        InjectNotes: true,
                        InjectExamples: true,
                        async Load(id: string) {
                            return id.toLowerCase() === ALLOWED_AGENT_ID.toLowerCase();
                        },
                        async Save() {
                            agentSaveCalls++;
                            return true;
                        },
                    });
                }
                return baseGetEntityObject(entityName, contextUser);
            },
        });

        const prevRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = stubOf<typeof AgentRunner.prototype.RunAgent>(async (params: ExecuteAgentParams) => {
            capturedAgent = {
                InjectNotes: params.agent?.InjectNotes,
                InjectExamples: params.agent?.InjectExamples,
            };
            return prevRunAgent.call(new AgentRunner(providerWithSage), params);
        });
        try {
            const res = await executeSpaceChatTurn(providerWithSage, callerUser, defaultInput);
            assert.equal(res.ok, true, res.ok ? '' : res.message);
            assert.deepEqual(capturedAgent, { InjectNotes: false, InjectExamples: false });
            assert.equal(agentSaveCalls, 0, 'executeSpaceChatTurn must NEVER persist agentEntity.Save()');
        } finally {
            AgentRunner.prototype.RunAgent = prevRunAgent;
        }
    });

    it('resolves COLLABORATION_SPACE_CHAT_MODEL (cached) and COLLABORATION_SPACE_CHAT_EFFORT_LEVEL overrides, and preserves defaults when unset', async () => {
        const MODEL_ID = 'aaaa1111-2222-4333-8444-555566667777';
        const prevModel = process.env['COLLABORATION_SPACE_CHAT_MODEL'];
        const prevEffort = process.env['COLLABORATION_SPACE_CHAT_EFFORT_LEVEL'];
        clearSpaceChatModelOverrideCache();

        assert.equal(parseSpaceChatEffortLevel(undefined), undefined);
        assert.equal(parseSpaceChatEffortLevel(''), undefined);
        assert.equal(parseSpaceChatEffortLevel('Low'), 15);
        assert.equal(parseSpaceChatEffortLevel('low'), 15);
        assert.equal(parseSpaceChatEffortLevel('15'), 15);
        assert.equal(parseSpaceChatEffortLevel('Medium'), 50);
        assert.equal(parseSpaceChatEffortLevel('High'), 85);
        assert.equal(parseSpaceChatEffortLevel('42'), 42);
        assert.equal(parseSpaceChatEffortLevel('not-a-level'), undefined);
        assert.equal(parseSpaceChatEffortLevel('150'), undefined);

        let modelLookupCount = 0;
        const makeModelAwareProvider = (modelFound: boolean): IMetadataProvider => {
            const base = createMockProvider();
            const baseRv = base as unknown as IRunViewProvider;
            const wrapped: Partial<IMetadataProvider & IRunViewProvider> = {
                EntityByName: base.EntityByName.bind(base),
                EntityByID: base.EntityByID.bind(base),
                GetEntityObject: base.GetEntityObject.bind(base),
                async RunView<T>(params: RunViewParams, userArg?: UserInfo): Promise<RunViewResult<T>> {
                    if (params.EntityName === 'MJ: AI Models') {
                        modelLookupCount++;
                        assert.match(String(params.ExtraFilter ?? ''), /IsActive\s*=\s*1/i);
                        return modelFound
                            ? mockResult<T>([{ ID: MODEL_ID, Name: 'Gemini 4 Hydrogen' }])
                            : mockResult<T>([]);
                    }
                    return baseRv.RunView<T>(params, userArg);
                },
                async RunViews<T>(paramsList: RunViewParams[], userArg?: UserInfo): Promise<RunViewResult<T>[]> {
                    return Promise.all(paramsList.map((p) => wrapped.RunView!<T>(p, userArg)));
                },
            };
            return stubOf<IMetadataProvider>(wrapped);
        };

        const capturedParams: Array<{ override?: ExecuteAgentParams['override']; effortLevel?: ExecuteAgentParams['effortLevel'] }> = [];
        const prevRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = stubOf<typeof AgentRunner.prototype.RunAgent>(async (params: ExecuteAgentParams) => {
            capturedParams.push({ override: params.override, effortLevel: params.effortLevel });
            return prevRunAgent.call(new AgentRunner(createMockProvider()), params);
        });

        try {
            // 1. Unset env vars -> standard model/effort selection unchanged
            delete process.env['COLLABORATION_SPACE_CHAT_MODEL'];
            delete process.env['COLLABORATION_SPACE_CHAT_EFFORT_LEVEL'];
            const unsetRes = await executeSpaceChatTurn(makeModelAwareProvider(true), callerUser, defaultInput);
            assert.equal(unsetRes.ok, true, unsetRes.ok ? '' : unsetRes.message);
            assert.equal(modelLookupCount, 0);
            assert.equal(capturedParams[0]?.override, undefined);
            assert.equal(capturedParams[0]?.effortLevel, undefined);

            // 2. Env vars set -> resolves active model once, caches across turns, maps "Low" -> 15
            process.env['COLLABORATION_SPACE_CHAT_MODEL'] = 'Gemini 4 Hydrogen';
            process.env['COLLABORATION_SPACE_CHAT_EFFORT_LEVEL'] = 'Low';
            const firstOverrideRes = await executeSpaceChatTurn(makeModelAwareProvider(true), callerUser, defaultInput);
            assert.equal(firstOverrideRes.ok, true, firstOverrideRes.ok ? '' : firstOverrideRes.message);
            assert.equal(modelLookupCount, 1);
            assert.deepEqual(capturedParams[1]?.override, { modelId: MODEL_ID });
            assert.equal(capturedParams[1]?.effortLevel, 15);

            // Second turn with numeric effort "25" reuses cached model ID without querying MJ: AI Models again
            process.env['COLLABORATION_SPACE_CHAT_EFFORT_LEVEL'] = '25';
            const secondOverrideRes = await executeSpaceChatTurn(makeModelAwareProvider(true), callerUser, defaultInput);
            assert.equal(secondOverrideRes.ok, true, secondOverrideRes.ok ? '' : secondOverrideRes.message);
            assert.equal(modelLookupCount, 1, 'Model lookup should be cached per model name');
            assert.deepEqual(capturedParams[2]?.override, { modelId: MODEL_ID });
            assert.equal(capturedParams[2]?.effortLevel, 25);

            // 3. Unknown model name -> falls back cleanly without override
            clearSpaceChatModelOverrideCache();
            process.env['COLLABORATION_SPACE_CHAT_MODEL'] = 'Nonexistent Model';
            delete process.env['COLLABORATION_SPACE_CHAT_EFFORT_LEVEL'];
            const missingModelRes = await executeSpaceChatTurn(makeModelAwareProvider(false), callerUser, defaultInput);
            assert.equal(missingModelRes.ok, true, missingModelRes.ok ? '' : missingModelRes.message);
            assert.equal(modelLookupCount, 2);
            assert.equal(capturedParams[3]?.override, undefined);
            assert.equal(capturedParams[3]?.effortLevel, undefined);
        } finally {
            AgentRunner.prototype.RunAgent = prevRunAgent;
            clearSpaceChatModelOverrideCache();
            if (prevModel === undefined) delete process.env['COLLABORATION_SPACE_CHAT_MODEL'];
            else process.env['COLLABORATION_SPACE_CHAT_MODEL'] = prevModel;
            if (prevEffort === undefined) delete process.env['COLLABORATION_SPACE_CHAT_EFFORT_LEVEL'];
            else process.env['COLLABORATION_SPACE_CHAT_EFFORT_LEVEL'] = prevEffort;
        }
    });
});
