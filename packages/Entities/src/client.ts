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
    ErrorMessage?: string;
}

export interface UploadSpaceFileInput {
    SpaceID: string;
    FileName: string;
    MimeType?: string;
    Base64Data: string;
    Folder?: string | null;
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
    ExecuteAgent?: boolean;
    ConversationID?: string;
}

export interface PostSpaceMessageGraphQLPayload {
    Success: boolean;
    DetailID?: string;
    AssistantDetailID?: string;
    AssistantError?: string;
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
    AllowedAgentIDs?: string[];
    DefaultAgentID?: string;
    AgentHistoryFrom?: string;
    CanStartConversation: boolean;
    AllowedConversationKinds: string[];
    MentionPeople: {
        ID: string;
        Name: string;
        Email?: string;
    }[];
}

export interface OpenSpaceFilePayload {
    Success: boolean;
    Base64?: string;
    MimeType?: string;
    Name?: string;
    Mode?: string;
    ErrorMessage?: string;
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

const GET_SPACE_CHAT_HOST_RULES_QUERY = `
query GetSpaceChatHostRules($spaceId: String!, $conversationId: String) {
    GetSpaceChatHostRules(spaceId: $spaceId, conversationId: $conversationId) {
        Success
        ErrorMessage
        AgentReplyMode
        AllowedAgentIDs
        DefaultAgentID
        AgentHistoryFrom
        CanStartConversation
        AllowedConversationKinds
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
        AssistantDetailID
        AssistantError
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

const OPEN_SPACE_FILE_MUTATION = `
mutation OpenSpaceFile($itemId: String!) {
    OpenSpaceFile(itemId: $itemId) {
        Success
        Base64
        MimeType
        Name
        Mode
        ErrorMessage
    }
}
`;

export function hasExecuteGQL(target: object | null | undefined): target is GraphQLExecutor {
    return target != null && 'ExecuteGQL' in target && typeof (target as { ExecuteGQL?: () => Promise<Record<string, object | null | undefined>> }).ExecuteGQL === 'function';
}

/**
 * Typed client for Collaboration GraphQL mutations:
 * MintSpaceLink, UploadSpaceFile, CreateSpaceTask, PostSpaceMessage, OpenSpaceFile.
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

    async OpenSpaceFile(itemId: string): Promise<OpenSpaceFilePayload> {
        const res = await this.activeExecutor.ExecuteGQL(OPEN_SPACE_FILE_MUTATION, { itemId });
        return (res?.OpenSpaceFile as OpenSpaceFilePayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
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
