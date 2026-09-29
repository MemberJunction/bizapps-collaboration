import assert from 'node:assert/strict';
import { before, after, describe, it } from 'node:test';
import {
    WellKnownUserSource,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { resolveSpaceChatHostRules } from '../dist/resolve-space-chat-host-rules.js';
import { COLLABORATION_DEFAULT_AGENT_ID } from '../dist/resolve-allowed-agents.js';

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

describe('resolveSpaceChatHostRules', () => {
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
    const CALLER_ID = '11111111-1111-4111-8111-111111111111';
    const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
    const SPACE_ID = '33333333-3333-4333-8333-333333333333';
    const TYPE_ID = '44444444-4444-4444-8444-444444444444';
    const CONVERSATION_ID = '55555555-5555-4555-8555-555555555555';
    const ROLE_TEAM_ID = '66666666-6666-4666-8666-666666666666';
    const ROLE_SHARED_ID = '77777777-7777-4777-8777-777777777777';

    const callerUser = { ID: CALLER_ID, Name: 'Caller' } as UserInfo;
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;

    before(() => {
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
    });

    interface MockHostRulesOptions {
        callerReaches?: boolean;
        callerCanSeeTeam?: boolean;
        closedAt?: string | null;
        chatStatus?: string;
        chatKind?: string;
        conversationNotFound?: boolean;
    }

    function createMockProvider(options: MockHostRulesOptions = {}): IMetadataProvider {
        const callerReaches = options.callerReaches !== false;
        const callerCanSeeTeam = options.callerCanSeeTeam !== false;
        const closedAt = options.closedAt ?? null;
        const chatStatus = options.chatStatus ?? 'Active';
        const chatKind = options.chatKind ?? 'General';
        const conversationNotFound = options.conversationNotFound === true;

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
                return {
                    RunViewProviderToUse: provider,
                    ProviderToUse: provider,
                } as never;
            },
            async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                const { EntityName, ExtraFilter } = params;
                if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return mockResult<T>([
                        {
                            ID: SPACE_ID,
                            Name: 'Test Space',
                            ParentID: null,
                            InheritsMembership: false,
                            OwnerID: CALLER_ID,
                            ClosedAt: closedAt,
                            SpaceTypeID: TYPE_ID,
                            Configuration: null,
                        } as unknown as T,
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    if (!callerReaches) {
                        return mockResult<T>([]);
                    }
                    return mockResult<T>([
                        {
                            ID: 'mem-1',
                            SpaceID: SPACE_ID,
                            UserID: CALLER_ID,
                            User: 'Caller User',
                            SpaceRoleTypeID: callerCanSeeTeam ? ROLE_TEAM_ID : ROLE_SHARED_ID,
                            Band: callerCanSeeTeam ? 'Team' : 'Shared',
                            Status: 'Active',
                            __mj_CreatedAt: new Date().toISOString(),
                        } as unknown as T,
                        {
                            ID: 'mem-2',
                            SpaceID: SPACE_ID,
                            UserID: OTHER_USER_ID,
                            User: 'Other Team User',
                            SpaceRoleTypeID: ROLE_TEAM_ID,
                            Band: 'Team',
                            Status: 'Active',
                            __mj_CreatedAt: new Date().toISOString(),
                        } as unknown as T,
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return mockResult<T>([
                        {
                            ID: ROLE_TEAM_ID,
                            Level: 30,
                            MaxGrantableLevel: 30,
                            CanInvite: true,
                            CanPromoteBand: true,
                            CanSeeTeamBand: true,
                            IsOwnerRole: true,
                            CanContribute: true,
                        } as unknown as T,
                        {
                            ID: ROLE_SHARED_ID,
                            Level: 10,
                            MaxGrantableLevel: 10,
                            CanInvite: false,
                            CanPromoteBand: false,
                            CanSeeTeamBand: false,
                            IsOwnerRole: false,
                            CanContribute: true,
                        } as unknown as T,
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                    return mockResult<T>([
                        {
                            ID: TYPE_ID,
                            Configuration: null,
                        } as unknown as T,
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    if (conversationNotFound) {
                        return mockResult<T>([]);
                    }
                    return mockResult<T>([
                        {
                            ID: 'chat-1',
                            SpaceID: SPACE_ID,
                            ConversationID: CONVERSATION_ID,
                            Name: 'General',
                            Kind: chatKind,
                            Status: chatStatus,
                            ArchivedOnSpaceClose: false,
                        } as unknown as T,
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Agents') {
                    return mockResult<T>([]);
                }

                if (EntityName === 'MJ: AI Agents') {
                    const filterStr = typeof ExtraFilter === 'string' ? ExtraFilter : '';
                    if (!ExtraFilter || filterStr.includes(COLLABORATION_DEFAULT_AGENT_ID)) {
                        return mockResult<T>([
                            {
                                ID: COLLABORATION_DEFAULT_AGENT_ID,
                                Name: 'Collaboration Space Agent',
                            } as unknown as T,
                        ]);
                    }
                    return mockResult<T>([]);
                }

                if (EntityName === 'MJ: Application Settings') {
                    return mockResult<T>([]);
                }

                if (EntityName === 'MJ: Users') {
                    return mockResult<T>([
                        { ID: CALLER_ID, Name: 'Caller User', Email: 'caller@example.com' } as unknown as T,
                        { ID: OTHER_USER_ID, Name: 'Other Team User', Email: 'other@example.com' } as unknown as T,
                    ]);
                }

                return mockResult<T>([]);
            },
            async RunViews(queries: Array<{ EntityName: string; ExtraFilter?: string }>) {
                return Promise.all(queries.map((q) => provider.RunView!(q)));
            },
        };

        return provider as IMetadataProvider;
    }

    it('refuses when caller does not reach the space', async () => {
        const provider = createMockProvider({ callerReaches: false });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, false);
        assert.equal(result.message, 'Caller does not reach this space.');
    });

    it('returns allowed kinds including Private for Team member in open space', async () => {
        const provider = createMockProvider({ callerCanSeeTeam: true });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, true);
        assert.equal(result.canStartConversation, true);
        assert.ok(result.allowedConversationKinds.includes('General'));
        assert.ok(result.allowedConversationKinds.includes('Topic'));
        assert.ok(result.allowedConversationKinds.includes('Private'));
        assert.equal(result.agentReplyMode, 'MentionOnly');
        assert.equal(result.defaultAgentId, COLLABORATION_DEFAULT_AGENT_ID);
        assert.equal(result.defaultAgentName, 'Collaboration Space Agent');
    });

    it('excludes Private kind for outside member who cannot see Team band', async () => {
        const provider = createMockProvider({ callerCanSeeTeam: false });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, true);
        assert.equal(result.canStartConversation, true);
        assert.ok(result.allowedConversationKinds.includes('General'));
        assert.ok(result.allowedConversationKinds.includes('Topic'));
        assert.equal(result.allowedConversationKinds.includes('Private'), false);
    });

    it('disallows starting conversation when space is closed', async () => {
        const provider = createMockProvider({ closedAt: '2026-01-01T00:00:00Z' });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, true);
        assert.equal(result.canStartConversation, false);
        assert.deepEqual(result.allowedConversationKinds, []);
    });

    it('refuses when target conversation does not belong to space', async () => {
        const provider = createMockProvider({ conversationNotFound: true });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID, CONVERSATION_ID);
        assert.equal(result.ok, false);
        assert.equal(result.message, 'The conversation does not belong to this space.');
    });

    it('answers read-only when target conversation is archived', async () => {
        const provider = createMockProvider({ chatStatus: 'Archived' });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID, CONVERSATION_ID);
        assert.equal(result.ok, true);
        assert.equal(result.canStartConversation, false);
        assert.deepEqual(result.allowedConversationKinds, []);
        assert.deepEqual(result.allowedAgentIds, []);
    });
});
