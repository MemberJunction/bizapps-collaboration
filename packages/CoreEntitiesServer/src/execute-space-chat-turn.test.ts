import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type IMetadataProvider, type IRunViewProvider, type RunViewParams, type RunViewResult, type UserInfo } from '@memberjunction/core';
import { AgentRunner } from '@memberjunction/ai-agents';
import { executeSpaceChatTurn, type ExecuteSpaceChatTurnInput } from '../dist/execute-space-chat-turn.js';
import { resolveSpaceChatHostRules } from '../dist/resolve-space-chat-host-rules.js';
import { COLLABORATION_DEFAULT_AGENT_ID } from '../dist/resolve-allowed-agents.js';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';

function mockResult<T>(results: T[]): RunViewResult<T> {
    return {
        Success: true,
        Results: results,
        RowCount: results.length,
        TotalRowCount: results.length,
        ExecutionTime: 0,
        ErrorMessage: '',
    };
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

    before(() => {
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
                agentRun: run as never,
                result: 'Mocked agent response',
                finalPayload: 'Mocked agent response',
            };
        };
    });

    after(() => {
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
        callerHasReach?: boolean;
        messageUserId?: string;
        messageRole?: string;
        messageConversationId?: string;
        messageText?: string;
        spaceConfiguration?: string | null;
        allowedAgents?: string[];
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
                return {
                    ID: 'mock-entity-id',
                    GetUserPermisions: () => ({ CanRead: true, CanCreate: true, CanUpdate: true, CanDelete: true }),
                } as never;
            },
            EntityByID() {
                return { Name: 'mock-entity' } as never;
            },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return {
                        RunViewProviderToUse: provider,
                        ProviderToUse: provider,
                    } as never;
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
                            savedDetails.push({ ...this });
                            return true;
                        },
                    };
                    return detail as never;
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
                    return run as never;
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
                    return agent as never;
                }
                return undefined as never;
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
                        } as unknown as T,
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
                        } as unknown as T,
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
                        } as unknown as T,
                        {
                            ID: ROLE_NON_CONTRIB_ID,
                            Level: 10,
                            MaxGrantableLevel: 10,
                            CanInvite: false,
                            CanPromoteBand: false,
                            CanSeeTeamBand: false,
                            IsOwnerRole: false,
                            CanContribute: false,
                        } as unknown as T,
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
                        } as unknown as T,
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
                        } as unknown as T,
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
                        } as unknown as T,
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
                        return mockResult<T>([{ ID: 'run-existing-1', ExternalReferenceID: USER_MESSAGE_ID } as unknown as T]);
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
                                }) as unknown as T,
                        ),
                    );
                }

                if (EntityName === 'MJ: AI Agents') {
                    return mockResult<T>([
                        {
                            ID: ALLOWED_AGENT_ID,
                            Name: 'Sage',
                        } as unknown as T,
                    ]);
                }

                if (EntityName === 'MJ: Users') {
                    return mockResult<T>([
                        {
                            ID: CALLER_ID,
                            Name: 'Caller',
                            Email: 'caller@example.com',
                        } as unknown as T,
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
                        return mockResult<T>([{ ID: 'detail-reply-1', ParentID: USER_MESSAGE_ID, Role: 'AI' } as unknown as T]);
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
            agentRun: { ID: 'failed-run' } as never,
        });
        try {
            const provider = createMockProvider({
                messageText: `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} summarize this space`,
            });
            const result = await executeSpaceChatTurn(provider, callerUser, defaultInput);
            assert.equal(result.ok, false);
            assert.match(result.message, /Simulated LLM failure/);
            assert.ok(provider.savedDetails.length >= 2);
            const errorReply = provider.savedDetails[provider.savedDetails.length - 1];
            assert.equal(errorReply.Status, 'Error');
            assert.match(errorReply.Message ?? '', /Simulated LLM failure/);
        } finally {
            AgentRunner.prototype.RunAgent = origRunner;
        }
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
