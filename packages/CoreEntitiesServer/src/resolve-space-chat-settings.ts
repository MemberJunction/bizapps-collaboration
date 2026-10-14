import { type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import type { CollaborationSettings, EffectiveSpaceConfiguration, ResolvedCollaborationSettings } from '@mj-biz-apps/collaboration-core';
import { loadSpaceConfiguration, type LoadedSpaceConfiguration } from './space-configuration.js';

export interface ResolvedSpaceChatSettings {
    resolvedSettings: ResolvedCollaborationSettings;
    agentReplyMode: 'Always' | 'MentionOnly';
    historyOnAdd: 'None' | 'All' | 'Since';
    typeConfig: CollaborationSettings | null;
    /** The whole configuration the settings came from, so a caller needing the grants does not load the chain again. */
    configuration: EffectiveSpaceConfiguration;
}

/**
 * The chat settings of a space (items 16 and 20), read off the one configuration (B16): the app, the type, the same-type run and
 * the space, each link judged by its own type. A chain that cannot be read or holds an invalid link refuses.
 */
export async function resolveSpaceChatSettings(
    provider: IMetadataProvider,
    spaceId: string,
    contextUser?: UserInfo,
    loaded?: LoadedSpaceConfiguration,
): Promise<ResolvedSpaceChatSettings> {
    const { configuration, typeSettings } = loaded ?? (await loadSpaceConfiguration(provider, spaceId, { reader: contextUser }));
    const resolvedSettings = configuration.Settings;
    const rawReplyMode = resolvedSettings.Chats?.AgentReplyMode ?? 'MentionOrOneToOne';
    const agentReplyMode: 'Always' | 'MentionOnly' = rawReplyMode === 'Always' ? 'Always' : 'MentionOnly';
    const historyOnAdd: 'None' | 'All' | 'Since' = resolvedSettings.Chats?.HistoryOnAdd ?? 'None';
    return { resolvedSettings, agentReplyMode, historyOnAdd, typeConfig: typeSettings, configuration };
}
