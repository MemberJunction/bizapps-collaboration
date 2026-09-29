import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, after, describe, it } from 'node:test';
import {
    WellKnownUserSource,
    type BaseEntity,
    type EntityInfo,
    type EntityUserPermissionInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { resolveSpaceChatHostRules } from '../dist/resolve-space-chat-host-rules.js';
import { seedAppSettings } from './app-settings.test-support.ts';

/** The shipped agent, read from the metadata that ships it: the resolver's own fallback constant can't vouch for itself. */
const SHIPPED_AGENT = (
    JSON.parse(readFileSync(new URL('../../../metadata/agents/.collaboration-agent.json', import.meta.url), 'utf8')) as Array<{
        primaryKey: { ID: string };
        fields: { Name: string };
    }>
)[0];
const SHIPPED_AGENT_ID = SHIPPED_AGENT.primaryKey.ID;
const SHIPPED_AGENT_NAME = SHIPPED_AGENT.fields.Name;
const OTHER_AGENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_AGENT_NAME = 'Other Space Agent';
const MISSING_AGENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DISABLED_AGENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** A stand-in for a metadata class the resolver only reads a few members of. */
function stubOf<T extends object>(partial: Partial<T>): T {
    return partial as T;
}

/** The mock hands back whatever row type its caller asked for; this is the one place that cast is made. */
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

    let restoreAppSettings: () => void = () => undefined;
    before(() => {
        restoreAppSettings = seedAppSettings();
        const src = WellKnownUserSource.Instance;
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);
    });

    after(() => {
        restoreAppSettings();
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
    });

    interface MockHostRulesOptions {
        callerReaches?: boolean;
        callerCanSeeTeam?: boolean;
        closedAt?: string | null;
        chatStatus?: string;
        chatKind?: string;
        conversationNotFound?: boolean;
        spaceAgents?: ReadonlyArray<{ AgentID: string; IsDefault: boolean }>;
        spaceConfiguration?: string;
    }

    /** The agents table: a filter returns only the rows it names, as a database would. */
    const AGENT_ROWS = [
        { ID: SHIPPED_AGENT_ID, Name: SHIPPED_AGENT_NAME, Status: 'Active' },
        { ID: OTHER_AGENT_ID, Name: OTHER_AGENT_NAME, Status: 'Active' },
        { ID: DISABLED_AGENT_ID, Name: 'Disabled Space Agent', Status: 'Disabled' },
    ];
    function agentsMatching(filter: string | undefined): readonly object[] {
        const named = filter?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
        const activeOnly = !!filter && /Status = 'Active'/.test(filter);
        const byStatus = activeOnly ? AGENT_ROWS.filter((row) => row.Status === 'Active') : AGENT_ROWS;
        if (!named) return byStatus;
        const wanted = new Set(named.map((id) => id.toLowerCase()));
        return byStatus.filter((row) => wanted.has(row.ID.toLowerCase()));
    }

    function createMockProvider(options: MockHostRulesOptions = {}): IMetadataProvider {
        const callerReaches = options.callerReaches !== false;
        const callerCanSeeTeam = options.callerCanSeeTeam !== false;
        const closedAt = options.closedAt ?? null;
        const chatStatus = options.chatStatus ?? 'Active';
        const chatKind = options.chatKind ?? 'General';
        const conversationNotFound = options.conversationNotFound === true;
        const spaceAgents = options.spaceAgents ?? [];
        const spaceConfiguration = options.spaceConfiguration ?? null;

        const provider: Partial<IMetadataProvider & IRunViewProvider> = {
            EntityByName() {
                return stubOf<EntityInfo>({
                    ID: 'mock-entity-id',
                    GetUserPermisions: () => stubOf<EntityUserPermissionInfo>({ CanRead: true, CanCreate: true, CanUpdate: true, CanDelete: true }),
                });
            },
            EntityByID() {
                return stubOf<EntityInfo>({ Name: 'mock-entity' });
            },
            async GetEntityObject<T extends BaseEntity>(): Promise<T> {
                return stubOf<T>({ RunViewProviderToUse: provider, ProviderToUse: provider } as Partial<T>);
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
                            Configuration: spaceConfiguration,
                        },
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
                        },
                        {
                            ID: 'mem-2',
                            SpaceID: SPACE_ID,
                            UserID: OTHER_USER_ID,
                            User: 'Other Team User',
                            SpaceRoleTypeID: ROLE_TEAM_ID,
                            Band: 'Team',
                            Status: 'Active',
                            __mj_CreatedAt: new Date().toISOString(),
                        },
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
                        },
                        {
                            ID: ROLE_SHARED_ID,
                            Level: 10,
                            MaxGrantableLevel: 10,
                            CanInvite: false,
                            CanPromoteBand: false,
                            CanSeeTeamBand: false,
                            IsOwnerRole: false,
                            CanContribute: true,
                        },
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                    return mockResult<T>([
                        {
                            ID: TYPE_ID,
                            // The engine caches types for the whole file, so the type is the same in every test: a space may set its agent list mode
                            Configuration: JSON.stringify({ SpaceOverridable: ['Agents.ListMode'] }),
                        },
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
                        },
                    ]);
                }

                if (EntityName === 'MJ_BizApps_Collaboration: Space Agents') {
                    return mockResult<T>(
                        spaceAgents.map((row, index) => ({ ID: `space-agent-${index}`, AgentID: row.AgentID, SpaceID: SPACE_ID, IsDefault: row.IsDefault })),
                    );
                }

                if (EntityName === 'MJ: AI Agents') {
                    return mockResult<T>(agentsMatching(typeof ExtraFilter === 'string' ? ExtraFilter : undefined));
                }

                if (EntityName === 'MJ: Application Settings') {
                    return mockResult<T>([]);
                }

                if (EntityName === 'MJ: Users') {
                    return mockResult<T>([
                        { ID: CALLER_ID, Name: 'Caller User', Email: 'caller@example.com' },
                        { ID: OTHER_USER_ID, Name: 'Other Team User', Email: 'other@example.com' },
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
        assert.equal(result.defaultAgentId, SHIPPED_AGENT_ID);
        assert.equal(result.defaultAgentName, SHIPPED_AGENT_NAME);
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
    it("names the space's own default agent, not the shipped one", async () => {
        const provider = createMockProvider({
            spaceConfiguration: JSON.stringify({ Agents: { ListMode: 'Replace' } }),
            spaceAgents: [{ AgentID: OTHER_AGENT_ID, IsDefault: true }],
        });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, true);
        assert.equal(result.defaultAgentId, OTHER_AGENT_ID);
        assert.equal(result.defaultAgentName, OTHER_AGENT_NAME);
        assert.deepEqual(result.allowedAgentIds, [OTHER_AGENT_ID]);
    });

    it('does not name a disabled agent as the default, and falls back to the shipped agent', async () => {
        const provider = createMockProvider({
            spaceConfiguration: JSON.stringify({ Agents: { ListMode: 'Replace' } }),
            spaceAgents: [{ AgentID: DISABLED_AGENT_ID, IsDefault: true }],
        });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, true);
        assert.equal(result.defaultAgentId, SHIPPED_AGENT_ID);
        assert.equal(result.defaultAgentName, SHIPPED_AGENT_NAME);
        assert.deepEqual(result.allowedAgentIds, [SHIPPED_AGENT_ID]);
    });

    it('drops an agent that does not exist from the list', async () => {
        const provider = createMockProvider({
            spaceConfiguration: JSON.stringify({ Agents: { ListMode: 'Replace' } }),
            spaceAgents: [{ AgentID: MISSING_AGENT_ID, IsDefault: true }],
        });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID);
        assert.equal(result.ok, true);
        assert.equal(result.allowedAgentIds.includes(MISSING_AGENT_ID), false);
    });

    it('does not tell a caller without Team that an internal conversation is archived', async () => {
        const provider = createMockProvider({ callerCanSeeTeam: false, chatKind: 'Private', chatStatus: 'Archived' });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID, CONVERSATION_ID);
        assert.equal(result.ok, false);
        assert.equal(result.message, 'Caller does not have access to this internal conversation.');
    });

    it('answers read-only for a caller with Team when the internal conversation is archived', async () => {
        const provider = createMockProvider({ callerCanSeeTeam: true, chatKind: 'Private', chatStatus: 'Archived' });
        const result = await resolveSpaceChatHostRules(provider, callerUser, SPACE_ID, CONVERSATION_ID);
        assert.equal(result.ok, true);
        assert.equal(result.message, 'The conversation is archived.');
        assert.equal(result.canStartConversation, false);
    });
});
