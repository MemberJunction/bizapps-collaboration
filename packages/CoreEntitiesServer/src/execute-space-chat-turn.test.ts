import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ConversationEngine } from '@memberjunction/core-entities';
import { WellKnownUserSource, type EntityInfo, type IMetadataProvider, type IRunViewProvider, type RunViewParams, type RunViewResult, type UserInfo } from '@memberjunction/core';
import { AgentRunner } from '@memberjunction/ai-agents';
import type { MJAIAgentRunEntityExtended } from '@memberjunction/ai-core-plus';
import { executeSpaceChatTurn, type ExecuteSpaceChatTurnInput } from '../dist/execute-space-chat-turn.js';
import { resolveSpaceChatHostRules } from '../dist/resolve-space-chat-host-rules.js';
import { COLLABORATION_DEFAULT_AGENT_ID } from '../dist/resolve-allowed-agents.js';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { BaseSpaceTypeServerDriver } from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import { seedAppSettings } from './app-settings.test-support.ts';

/** The mock hands back whatever row type its caller asked for; this and `stubOf` are the two places a cast is made. */
function mockResult<T>(results: readonly object[]): RunViewResult<T> {
    return {
        Success: true,
        Results: results as unknown as T[],
        RowCount: results.length,
        TotalRowCount: results.length,
        ExecutionTime: 0,
        ErrorMessage: '',
    };
}

/** A stand-in for an entity or engine object the code under test only reads a few members of. */
function stubOf<T>(value: object): T {
    return value as unknown as T;
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
    const ALLOWED_AGENT_ID = COLLABORATION_DEFAULT_AGENT_ID;
    const DISALLOWED_AGENT_ID = '99999999-9999-4999-8999-999999999999';

    const callerUser = { ID: CALLER_ID, Name: 'Caller' } as UserInfo;
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let origRunAgent: typeof AgentRunner.prototype.RunAgent;

    let restoreAppSettings: () => void = () => undefined;
    /** The type's driver as the turn resolves it; a test sets it to throw, as an unregistered driver does. */
    let resolveDriver: () => Promise<{ space: object; spaceType: object; driver: BaseSpaceTypeServerDriver }> = async () => ({ space: {}, spaceType: {}, driver: new BaseSpaceTypeServerDriver() });
    let origResolveSpaceAndType: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    before(() => {
        origResolveSpaceAndType = ServerDriverRegistry.Instance.ResolveSpaceAndType.bind(ServerDriverRegistry.Instance);
        ServerDriverRegistry.Instance.ResolveSpaceAndType = (() => resolveDriver()) as unknown as typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
        restoreAppSettings = seedAppSettings();
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);

        origRunAgent = AgentRunner.prototype.RunAgent;
        AgentRunner.prototype.RunAgent = async (params) => {
            const run = {
                ID: 'run-mocked-1',
                Message: 'Mocked agent response',
                Result: 'Mocked agent response',
                Status: 'Completed',
                ExternalReferenceID: params.conversationDetailId,
            };
            if (typeof params.onAgentRunCreated === 'function') {
                await params.onAgentRunCreated('run-mocked-1');
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
        spaceConfiguration?: string | null;
        allowedAgents?: string[];
        /** No agent is Active: the agents read comes back empty. */
        noActiveAgents?: boolean;
    }

    interface SavedDetail {
        ID?: string;
        ConversationID?: string;
        ParentID?: string | null;
        Role?: string;
        AgentID?: string | null;
        Status?: string;
        Message?: string;
    }

    interface SavedRun {
        ID?: string;
        ExternalReferenceID?: string | null;
        Status?: string;
    }

    type MockMetadataProvider = IMetadataProvider & {
        readonly savedDetails: SavedDetail[];
        readonly savedRuns: SavedRun[];
    };

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
                        AgentID: null as string | null,
                        Status: 'Complete',
                        HiddenToUser: false,
                        IsPinned: false,
                        OriginalMessageChanged: false,
                        LatestResult: { CompleteMessage: '' },
                        NewRecord() {
                            this.ID = 'reply-detail-' + Math.random().toString(36).slice(2);
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
                            this.ID = 'run-' + Math.random().toString(36).slice(2);
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
                    if (!callerHasReach) {
                        return mockResult<T>([]);
                    }
                    return mockResult<T>([
                        {
                            ID: 'mem-1',
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
                                PostCloseAccess: 'ReadOnly',
                                PostCloseAccessDays: null,
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
                            ID: 'chat-1',
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
                                PostCloseAccess: 'ReadOnly',
                                PostCloseAccessDays: null,
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

                if (EntityName === 'MJ_BizApps_Collaboration: Space Agents') {
                    const agentIds = options.allowedAgents ?? [ALLOWED_AGENT_ID];
                    return mockResult<T>(
                        agentIds.map(
                            (id) =>
                                ({
                                    AgentID: id,
                                    SpaceTypeID: null,
                                    SpaceID: SPACE_ID,
                                    IsDefault: true,
                                }),
                        ),
                    );
                }

                if (EntityName === 'MJ: AI Agents') {
                    if (options.noActiveAgents) return mockResult<T>([]);
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
                    if (options.hasExistingReplyDetail && String(ExtraFilter).includes(USER_MESSAGE_ID)) {
                        return mockResult<T>([{ ID: 'detail-reply-1', ParentID: USER_MESSAGE_ID, Role: 'AI' }]);
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

    it('succeeds when message mentions allowed agent', async () => {
        const provider = createMockProvider({
            messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`,
        });
        const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
        assert.equal(result.ok, true);
        if (result.ok) {
            assert.ok(result.replyDetailIds.length > 0);
            assert.ok(result.agentRunId);
        }

        // Assert saved reply
        assert.ok(provider.savedDetails.length >= 2, 'Should save In-Progress and Complete reply details');
        const initialReply = provider.savedDetails[0];
        assert.equal(initialReply.ParentID, USER_MESSAGE_ID);
        assert.equal(initialReply.Role, 'AI');
        assert.equal(initialReply.Status, 'In-Progress');
        const finalReply = provider.savedDetails[provider.savedDetails.length - 1];
        assert.equal(finalReply.ParentID, USER_MESSAGE_ID);
        assert.equal(finalReply.Role, 'AI');
        assert.equal(finalReply.Status, 'Complete');
        assert.equal(finalReply.Message, 'Mocked agent response');
        assert.equal(finalReply.AgentID?.toLowerCase(), ALLOWED_AGENT_ID.toLowerCase());

        // Assert ExternalReferenceID stamp
        assert.ok(provider.savedRuns.length >= 1, 'Should save stamped agent run');
        const stampedRun = provider.savedRuns.find((r) => r.ExternalReferenceID === USER_MESSAGE_ID);
        assert.ok(stampedRun, 'Agent run should have ExternalReferenceID stamped with user message ID');
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
            if (typeof params.onAgentRunCreated === 'function') await params.onAgentRunCreated('run-mocked-2');
            return { success: true, agentRun: stubOf<MJAIAgentRunEntityExtended>({ ID: 'run-mocked-2', Message: 'Mocked agent response' }), result: 'Mocked agent response' };
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
            if (typeof params.onAgentRunCreated === 'function') await params.onAgentRunCreated('run-bg-1');
            params.onProgress?.({ step: 'prompt_execution', message: 'Thinking it over' });
            params.onStreaming?.({ content: 'Partial words', isComplete: false });
            await gate;
            return { success: true, agentRun: stubOf<MJAIAgentRunEntityExtended>({ ID: 'run-bg-1', Message: 'The final answer' }), result: 'The final answer' };
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
                assert.equal(result.ok, true);
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
                assert.deepEqual(outcomes, [{ replyDetailId: result.ok ? result.replyDetailIds[0] : '', success: true, runId: 'run-bg-1' }]);
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
                assert.equal(result.ok, true);
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
        const outcomes: { replyDetailId: string; success: boolean; errorMessage: string | undefined }[] = [];
        const started = await executeSpaceChatTurn(background, callerUser, {
            ...defaultInput,
            background: true,
            observer: { OnFinished: (outcome) => { outcomes.push({ replyDetailId: outcome.replyDetailId, success: outcome.success, errorMessage: outcome.errorMessage }); } },
        });
        assert.equal(started.ok, true);
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(outcomes.length, 1, 'the observer hears the end once');
        assert.equal(outcomes[0].success, false);
        assert.equal(outcomes[0].replyDetailId, started.ok ? started.replyDetailIds[0] : '');
        assert.match(outcomes[0].errorMessage ?? '', /could not be reached/);
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
});
