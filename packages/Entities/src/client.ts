export interface GraphQLExecutor {
    ExecuteGQL: (query: string, variables?: Record<string, string | number | boolean | null | undefined | object>) => Promise<Record<string, object | null | undefined>>;
}

export interface MintSpaceLinkInput {
    SpaceID: string;
    Email: string;
    RoleID: string;
}

export interface MintSpaceLinkPayload {
    Success: boolean;
    Sent?: boolean;
    RedemptionUrl?: string;
    /** On success: what happened (seated, Invited awaiting approval, already seated, whether a link went out). */
    Message?: string;
    ErrorMessage?: string;
}

export interface UploadSpaceFileInput {
    SpaceID: string;
    FileName: string;
    MimeType?: string;
    Base64Data: string;
    Folder?: string | null;
    /** The band the person chose. Left out, the space type's default applies. */
    Band?: 'Shared' | 'Team';
}

export interface UploadSpaceFilePayload {
    Success: boolean;
    ItemID?: string;
    ErrorMessage?: string;
}

export interface CreateSpaceTaskInput {
    SpaceID: string;
    Name: string;
    Band?: 'Team' | 'Shared';
}

export interface CreateSpaceTaskPayload {
    Success: boolean;
    TaskID?: string;
    ItemID?: string;
    ErrorMessage?: string;
}

export interface PostSpaceMessageGraphQLInput {
    SpaceID: string;
    Text: string;
    ConversationID?: string;
}

export interface PostSpaceMessageGraphQLPayload {
    Success: boolean;
    DetailID?: string;
    ErrorMessage?: string;
}

export interface ExecuteSpaceChatTurnGraphQLInput {
    SpaceID: string;
    ConversationID: string;
    UserMessageID: string;
    AgentID?: string;
}

export interface ExecuteSpaceChatTurnGraphQLPayload {
    Success: boolean;
    ReplyDetailIDs?: string[];
    AgentRunID?: string;
    QuotedCount?: number;
    AllowedItemNames?: string[];
    ErrorMessage?: string;
}

export interface CreateSpaceConversationGraphQLInput {
    SpaceID: string;
    Name: string;
    Kind?: 'General' | 'Topic' | 'Private';
}

export interface CreateSpaceConversationGraphQLPayload {
    Success: boolean;
    ConversationID?: string;
    SpaceChatID?: string;
    Name?: string;
    Kind?: string;
    ErrorMessage?: string;
}

export interface SpaceChatHostRulesGraphQLPayload {
    Success: boolean;
    ErrorMessage?: string;
    AgentReplyMode: 'Always' | 'MentionOnly';
    AllowedAgentIDs: string[];
    DefaultAgentID?: string;
    DefaultAgentName?: string;
    AgentHistoryFrom?: string;
    CanStartConversation: boolean;
    AllowedConversationKinds: string[];
    /** The largest upload the host takes. */
    UploadMaxBytes?: number;
    MentionPeople: {
        ID: string;
        Name: string;
        Email?: string;
    }[];
}


const CREATE_SPACE_CONVERSATION_MUTATION = `
mutation CreateSpaceConversation($input: CreateSpaceConversationInput!) {
    CreateSpaceConversation(input: $input) {
        Success
        ConversationID
        SpaceChatID
        Name
        Kind
        ErrorMessage
    }
}
`;

/** What closing a space would do, read from the server. */
export interface CloseConsequenceGraphQLPayload {
    Success: boolean;
    ErrorMessage?: string;
    /** ReadOnly, ReadOnlyWithAgent or None. */
    Access?: string;
    Days?: number;
    KeeperUserID?: string;
    KeeperName?: string;
    KeeperCanReopen?: boolean;
}

/** What Home counts across every space the signed-in person reaches. */
export interface HomeCountsGraphQLPayload {
    Success: boolean;
    ErrorMessage?: string;
    SharedFiles?: number;
    OpenTasks?: number;
    AwaitingApproval?: number;
}

/** An invitation waiting on an owner. */
export interface HomeInvitationGraphQL {
    SeatID: string;
    SpaceID: string;
    SpaceName: string;
    Person: string;
    RoleName: string;
    InvitedAt?: string | null;
}

/** An open task filed in one of the person's spaces. */
export interface HomeOpenTaskGraphQL {
    TaskID: string;
    Name: string;
    Status: string;
    Priority?: string | null;
    DueAt?: string | null;
    SpaceID: string;
    SpaceName: string;
}

/** The rows behind Home's counts. */
export interface HomeListsGraphQLPayload {
    Success: boolean;
    ErrorMessage?: string;
    Invitations?: HomeInvitationGraphQL[];
    OpenTasks?: HomeOpenTaskGraphQL[];
}

const GET_HOME_LISTS_QUERY = `
query GetHomeLists {
    GetHomeLists {
        Success
        ErrorMessage
        Invitations { SeatID SpaceID SpaceName Person RoleName InvitedAt }
        OpenTasks { TaskID Name Status Priority DueAt SpaceID SpaceName }
    }
}
`;

const GET_HOME_COUNTS_QUERY = `
query GetHomeCounts {
    GetHomeCounts {
        Success
        ErrorMessage
        SharedFiles
        OpenTasks
        AwaitingApproval
    }
}
`;

const GET_CLOSE_CONSEQUENCE_QUERY = `
query GetCloseConsequence($spaceId: String!) {
    GetCloseConsequence(spaceId: $spaceId) {
        Success
        ErrorMessage
        Access
        Days
        KeeperUserID
        KeeperName
        KeeperCanReopen
    }
}
`;

const GET_SPACE_CHAT_HOST_RULES_QUERY = `
query GetSpaceChatHostRules($spaceId: String!, $conversationId: String) {
    GetSpaceChatHostRules(spaceId: $spaceId, conversationId: $conversationId) {
        Success
        ErrorMessage
        AgentReplyMode
        AllowedAgentIDs
        DefaultAgentID
        DefaultAgentName
        AgentHistoryFrom
        CanStartConversation
        AllowedConversationKinds
        UploadMaxBytes
        MentionPeople {
            ID
            Name
            Email
        }
    }
}
`;

const MINT_SPACE_LINK_MUTATION = `
mutation MintSpaceLink($input: MintSpaceLinkInput!) {
    MintSpaceLink(input: $input) {
        Success
        Sent
        RedemptionUrl
        Message
        ErrorMessage
    }
}
`;

const UPLOAD_SPACE_FILE_MUTATION = `
mutation UploadSpaceFile($input: UploadSpaceFileInput!) {
    UploadSpaceFile(input: $input) {
        Success
        ItemID
        ErrorMessage
    }
}
`;

const CREATE_SPACE_TASK_MUTATION = `
mutation CreateSpaceTask($input: CreateSpaceTaskInput!) {
    CreateSpaceTask(input: $input) {
        Success
        TaskID
        ItemID
        ErrorMessage
    }
}
`;

const POST_SPACE_MESSAGE_MUTATION = `
mutation PostSpaceMessage($input: PostSpaceMessageInput!) {
    PostSpaceMessage(input: $input) {
        Success
        DetailID
        ErrorMessage
    }
}
`;

const EXECUTE_SPACE_CHAT_TURN_MUTATION = `
mutation ExecuteSpaceChatTurn($input: ExecuteSpaceChatTurnInput!) {
    ExecuteSpaceChatTurn(input: $input) {
        Success
        ReplyDetailIDs
        AgentRunID
        QuotedCount
        AllowedItemNames
        ErrorMessage
    }
}
`;


export function hasExecuteGQL(target: object | null | undefined): target is GraphQLExecutor {
    return target != null && 'ExecuteGQL' in target && typeof (target as { ExecuteGQL?: () => Promise<Record<string, object | null | undefined>> }).ExecuteGQL === 'function';
}

/**
 * Typed client for Collaboration GraphQL mutations:
 * MintSpaceLink, UploadSpaceFile, CreateSpaceTask, PostSpaceMessage.
 */
export class CollaborationClient {
    constructor(private readonly executor: GraphQLExecutor) {
        if (!hasExecuteGQL(executor)) {
            throw new Error('GraphQL execution requires a provider with ExecuteGQL configured.');
        }
    }

    static isAvailable(target: object | null | undefined): target is GraphQLExecutor {
        return hasExecuteGQL(target);
    }

    private get activeExecutor(): GraphQLExecutor {
        return this.executor;
    }

    async MintSpaceLink(input: MintSpaceLinkInput): Promise<MintSpaceLinkPayload> {
        const res = await this.activeExecutor.ExecuteGQL(MINT_SPACE_LINK_MUTATION, { input });
        return (res?.MintSpaceLink as MintSpaceLinkPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async UploadSpaceFile(input: UploadSpaceFileInput): Promise<UploadSpaceFilePayload> {
        const res = await this.activeExecutor.ExecuteGQL(UPLOAD_SPACE_FILE_MUTATION, { input });
        return (res?.UploadSpaceFile as UploadSpaceFilePayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async CreateSpaceTask(input: CreateSpaceTaskInput): Promise<CreateSpaceTaskPayload> {
        const res = await this.activeExecutor.ExecuteGQL(CREATE_SPACE_TASK_MUTATION, { input });
        return (res?.CreateSpaceTask as CreateSpaceTaskPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async PostSpaceMessage(input: PostSpaceMessageGraphQLInput): Promise<PostSpaceMessageGraphQLPayload> {
        const res = await this.activeExecutor.ExecuteGQL(POST_SPACE_MESSAGE_MUTATION, { input });
        return (res?.PostSpaceMessage as PostSpaceMessageGraphQLPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async ExecuteSpaceChatTurn(input: ExecuteSpaceChatTurnGraphQLInput): Promise<ExecuteSpaceChatTurnGraphQLPayload> {
        const res = await this.activeExecutor.ExecuteGQL(EXECUTE_SPACE_CHAT_TURN_MUTATION, { input });
        return (res?.ExecuteSpaceChatTurn as ExecuteSpaceChatTurnGraphQLPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async CreateSpaceConversation(input: CreateSpaceConversationGraphQLInput): Promise<CreateSpaceConversationGraphQLPayload> {
        const res = await this.activeExecutor.ExecuteGQL(CREATE_SPACE_CONVERSATION_MUTATION, { input });
        return (res?.CreateSpaceConversation as CreateSpaceConversationGraphQLPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }


    async GetHomeCounts(): Promise<HomeCountsGraphQLPayload> {
        const res = await this.activeExecutor.ExecuteGQL(GET_HOME_COUNTS_QUERY, {});
        return (res?.GetHomeCounts as HomeCountsGraphQLPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async GetHomeLists(): Promise<HomeListsGraphQLPayload> {
        const res = await this.activeExecutor.ExecuteGQL(GET_HOME_LISTS_QUERY, {});
        return (res?.GetHomeLists as HomeListsGraphQLPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async GetCloseConsequence(spaceId: string): Promise<CloseConsequenceGraphQLPayload> {
        const res = await this.activeExecutor.ExecuteGQL(GET_CLOSE_CONSEQUENCE_QUERY, { spaceId });
        return (res?.GetCloseConsequence as CloseConsequenceGraphQLPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async GetSpaceChatHostRules(spaceId: string, conversationId?: string): Promise<SpaceChatHostRulesGraphQLPayload> {
        const res = await this.activeExecutor.ExecuteGQL(GET_SPACE_CHAT_HOST_RULES_QUERY, { spaceId, conversationId });
        return (res?.GetSpaceChatHostRules as SpaceChatHostRulesGraphQLPayload) ?? {
            Success: false,
            ErrorMessage: 'No payload returned',
            AgentReplyMode: 'MentionOnly',
            MentionPeople: [],
            CanStartConversation: false,
            AllowedConversationKinds: [],
        };
    }
}
