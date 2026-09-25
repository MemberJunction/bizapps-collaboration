import { Metadata } from '@memberjunction/core';

export interface GraphQLExecutor {
    ExecuteGQL: (query: string, variables?: Record<string, unknown>) => Promise<Record<string, unknown>>;
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
}

export interface PostSpaceMessageGraphQLPayload {
    Success: boolean;
    DetailID?: string;
    ErrorMessage?: string;
}

export interface OpenSpaceFilePayload {
    Success: boolean;
    Base64?: string;
    MimeType?: string;
    Name?: string;
    ErrorMessage?: string;
}

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
        ErrorMessage
    }
}
`;

function hasExecuteGQL(target: object | null | undefined): target is GraphQLExecutor {
    return target != null && 'ExecuteGQL' in target && typeof target.ExecuteGQL === 'function';
}

function resolveExecutor(executor?: GraphQLExecutor): GraphQLExecutor {
    if (executor && hasExecuteGQL(executor)) return executor;
    const provider = Metadata.Provider;
    if (hasExecuteGQL(provider)) return provider;
    throw new Error('GraphQL execution requires a provider with ExecuteGQL configured.');
}

/**
 * Typed client for Collaboration GraphQL mutations:
 * MintSpaceLink, UploadSpaceFile, CreateSpaceTask, PostSpaceMessage, OpenSpaceFile.
 */
export class CollaborationClient {
    constructor(private readonly executor?: GraphQLExecutor) {}

    static isAvailable(target?: object | null): boolean {
        return hasExecuteGQL(target ?? Metadata.Provider);
    }

    private get activeExecutor(): GraphQLExecutor {
        return resolveExecutor(this.executor);
    }

    async mintSpaceLink(input: MintSpaceLinkInput): Promise<MintSpaceLinkPayload> {
        const res = await this.activeExecutor.ExecuteGQL(MINT_SPACE_LINK_MUTATION, { input });
        return (res?.MintSpaceLink as MintSpaceLinkPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async uploadSpaceFile(input: UploadSpaceFileInput): Promise<UploadSpaceFilePayload> {
        const res = await this.activeExecutor.ExecuteGQL(UPLOAD_SPACE_FILE_MUTATION, { input });
        return (res?.UploadSpaceFile as UploadSpaceFilePayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async createSpaceTask(input: CreateSpaceTaskInput): Promise<CreateSpaceTaskPayload> {
        const res = await this.activeExecutor.ExecuteGQL(CREATE_SPACE_TASK_MUTATION, { input });
        return (res?.CreateSpaceTask as CreateSpaceTaskPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async postSpaceMessage(input: PostSpaceMessageGraphQLInput): Promise<PostSpaceMessageGraphQLPayload> {
        const res = await this.activeExecutor.ExecuteGQL(POST_SPACE_MESSAGE_MUTATION, { input });
        return (res?.PostSpaceMessage as PostSpaceMessageGraphQLPayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }

    async openSpaceFile(itemId: string): Promise<OpenSpaceFilePayload> {
        const res = await this.activeExecutor.ExecuteGQL(OPEN_SPACE_FILE_MUTATION, { itemId });
        return (res?.OpenSpaceFile as OpenSpaceFilePayload) ?? { Success: false, ErrorMessage: 'No payload returned' };
    }
}

export async function mintSpaceLink(input: MintSpaceLinkInput, executor?: GraphQLExecutor): Promise<MintSpaceLinkPayload> {
    return new CollaborationClient(executor).mintSpaceLink(input);
}

export async function uploadSpaceFileClient(input: UploadSpaceFileInput, executor?: GraphQLExecutor): Promise<UploadSpaceFilePayload> {
    return new CollaborationClient(executor).uploadSpaceFile(input);
}

export async function createSpaceTaskClient(input: CreateSpaceTaskInput, executor?: GraphQLExecutor): Promise<CreateSpaceTaskPayload> {
    return new CollaborationClient(executor).createSpaceTask(input);
}

export async function postSpaceMessageClient(input: PostSpaceMessageGraphQLInput, executor?: GraphQLExecutor): Promise<PostSpaceMessageGraphQLPayload> {
    return new CollaborationClient(executor).postSpaceMessage(input);
}

export async function openSpaceFileClient(itemId: string, executor?: GraphQLExecutor): Promise<OpenSpaceFilePayload> {
    return new CollaborationClient(executor).openSpaceFile(itemId);
}
