import { LogError, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import {
    type CollaborationSettings,
    type ResolvedCollaborationSettings,
    ValidateCollaborationSettings,
} from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';

export interface ResolvedSpaceChatSettings {
    resolvedSettings: ResolvedCollaborationSettings;
    agentReplyMode: 'Always' | 'MentionOnly';
    historyOnAdd: 'None' | 'All' | 'Since';
    typeConfig: CollaborationSettings | null;
}

/**
 * Unifies space chat settings resolution for host rules query and agent turn (Items 16 & 20).
 * Resolves Chats settings through the engine's LoadSpaceSettingsChain (parents included)
 * and validates each space's configuration against the space type.
 */
export async function resolveSpaceChatSettings(
    provider: IMetadataProvider,
    spaceId: string,
    contextUser?: UserInfo,
): Promise<ResolvedSpaceChatSettings> {
    await CollaborationEngine.Instance.EnsureLoaded(contextUser, provider);

    const spaceChain = await CollaborationEngine.Instance.LoadSpaceSettingsChain(
        spaceId,
        provider,
        contextUser
    );

    const spaceType = spaceChain.typeId
        ? CollaborationEngine.Instance.SpaceTypeById(spaceChain.typeId)
        : undefined;

    const typeConfig = parseTypeConfig(spaceChain.typeId);

    // Each link is judged by the type it was saved under: a Workspace may set what a Team may not.
    const validConfigs: CollaborationSettings[] = [];
    spaceChain.configs.forEach((cfg, i) => {
        const linkTypeConfig = i === 0 ? typeConfig : parseTypeConfig(spaceChain.typeIds[i] ?? null);
        const val = ValidateCollaborationSettings(cfg, 'space', linkTypeConfig ?? undefined);
        if (!val.valid) {
            LogError(`resolveSpaceChatSettings: Invalid space configuration in chain for space ${spaceId}: ${val.errors.join(', ')}`);
            throw new Error(`Space settings refused: a space in the chain of ${spaceId} has an invalid configuration: ${val.errors.join('; ')}`);
        }
        validConfigs.push(cfg);
    });

    const resolvedSettings = CollaborationEngine.Instance.ResolveSettingsForSpace(
        validConfigs,
        spaceChain.typeId
    );

    const rawReplyMode = resolvedSettings.Chats?.AgentReplyMode ?? 'MentionOrOneToOne';
    const agentReplyMode: 'Always' | 'MentionOnly' = rawReplyMode === 'Always' ? 'Always' : 'MentionOnly';
    const historyOnAdd: 'None' | 'All' | 'Since' = resolvedSettings.Chats?.HistoryOnAdd ?? 'None';

    return {
        resolvedSettings,
        agentReplyMode,
        historyOnAdd,
        typeConfig,
    };
}

/** The parsed configuration of a space type; null when the type has none. A configuration that does not parse refuses. */
function parseTypeConfig(typeId: string | null): CollaborationSettings | null {
    const spaceType = typeId ? CollaborationEngine.Instance.SpaceTypeById(typeId) : undefined;
    if (!spaceType?.Configuration) return null;
    try {
        return typeof spaceType.Configuration === 'string'
            ? (JSON.parse(spaceType.Configuration) as CollaborationSettings)
            : (spaceType.Configuration as CollaborationSettings);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        LogError(`resolveSpaceChatSettings: Failed to parse type configuration for space type ${typeId}: ${detail}`);
        throw new Error(`Space settings refused: the space type ${typeId} has a configuration that does not parse: ${detail}`);
    }
}
