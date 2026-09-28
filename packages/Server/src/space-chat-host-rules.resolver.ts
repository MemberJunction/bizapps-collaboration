import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, ObjectType, Query, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { resolveSpaceChatHostRules } from '@mj-biz-apps/collaboration-core-entities-server';

@ObjectType()
export class ChatMentionPersonPayload {
    @Field()
    ID: string;

    @Field()
    Name: string;

    @Field({ nullable: true })
    Email?: string;
}

@ObjectType()
export class SpaceChatHostRulesPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;

    @Field()
    AgentReplyMode: string;

    @Field(() => [String], { nullable: true })
    AllowedAgentIDs?: string[];

    @Field({ nullable: true })
    DefaultAgentID?: string;

    @Field({ nullable: true })
    AgentHistoryFrom?: Date;

    @Field(() => [ChatMentionPersonPayload])
    MentionPeople: ChatMentionPersonPayload[];
}

/**
 * Resolves space chat host rules from the server's view of the space (D25).
 */
@Resolver()
export class SpaceChatHostRulesResolver extends ResolverBase {
    @Query(() => SpaceChatHostRulesPayload)
    async GetSpaceChatHostRules(
        @Arg('spaceId', () => String) spaceId: string,
        @Arg('conversationId', () => String, { nullable: true }) conversationId: string | undefined,
        @Ctx() context: AppContext,
    ): Promise<SpaceChatHostRulesPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) {
            return {
                Success: false,
                ErrorMessage: 'Resolving space chat host rules requires a signed-in user.',
                AgentReplyMode: 'MentionOnly',
                MentionPeople: [],
            };
        }
        try {
            const result = await resolveSpaceChatHostRules(provider, user, spaceId, conversationId);
            if (!result.ok) {
                return {
                    Success: false,
                    ErrorMessage: result.message,
                    AgentReplyMode: 'MentionOnly',
                    MentionPeople: [],
                };
            }
            return {
                Success: true,
                AgentReplyMode: result.agentReplyMode,
                AllowedAgentIDs: result.allowedAgentIds ?? undefined,
                DefaultAgentID: result.defaultAgentId ?? undefined,
                AgentHistoryFrom: result.agentHistoryFrom ?? undefined,
                MentionPeople: result.mentionPeople.map((p) => ({
                    ID: p.ID,
                    Name: p.Name,
                    Email: p.Email ?? undefined,
                })),
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            LogError(`GetSpaceChatHostRules failed: ${message}`);
            return {
                Success: false,
                ErrorMessage: message,
                AgentReplyMode: 'MentionOnly',
                MentionPeople: [],
            };
        }
    }
}
