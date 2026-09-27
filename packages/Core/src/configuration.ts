/**
 * Configuration interfaces and rule resolution for Space and SpaceType.
 * Follows the extensibility plan § 4.
 */

/** A JSON value, for settings that a type's own drivers define. */
export type ConfigurationValue =
    | string
    | number
    | boolean
    | null
    | ConfigurationValue[]
    | { [key: string]: ConfigurationValue };

export interface ISpaceRules {
    Chats?: {
        /** Who may start a chat. Default 'Anyone': every seat, read-only guests included. */
        WhoCanStart?: 'Anyone' | 'Contributors' | 'Owners';
        /** When an agent replies. Default 'MentionOrOneToOne'. */
        AgentReplyMode?: 'MentionOrOneToOne' | 'MentionOnly' | 'Always';
        /** The choice preselected when someone is added to an existing chat. Default 'None'. */
        HistoryOnAdd?: 'None' | 'All' | 'Since';
    };
    Agents?: {
        /** How this level's SpaceAgent rows combine with the list above. Default 'Extend'. A level without rows passes the list down. */
        ListMode?: 'Extend' | 'Replace';
    };
    /** Behavior switches that the type's own drivers read, keyed by the app that owns them. Data goes in the subtype entity, never here. */
    Extensions?: Record<string, Record<string, ConfigurationValue>>;
}

export interface ISpaceTypeConfiguration extends ISpaceRules {
    /** Types that may be created under a space of this type, by SpaceType.Code. Absent means any. */
    Children?: { AllowedTypeCodes?: string[]; MaxOpen?: number };
    /** Roles that administer spaces of this type, beside Collaboration's staff roles. */
    Admin?: { RoleNames?: string[] };
    /** Words this type shows instead of Collaboration's, for example { Tabs: { Library: 'Papers', People: 'Members' } }. */
    Labels?: { Tabs?: Record<string, string> };
    /** Dotted keys a space may override, for example 'Chats.WhoCanStart'. Absent means none. */
    SpaceOverridable?: string[];
}

export interface ISpaceConfiguration extends ISpaceRules {}

export interface EffectiveSpaceRules {
    Chats: {
        WhoCanStart: 'Anyone' | 'Contributors' | 'Owners';
        AgentReplyMode: 'MentionOrOneToOne' | 'MentionOnly' | 'Always';
        HistoryOnAdd: 'None' | 'All' | 'Since';
    };
    Agents: {
        ListMode: 'Extend' | 'Replace';
    };
    Labels?: { Tabs?: Record<string, string> };
    Extensions: Record<string, Record<string, ConfigurationValue>>;
}

export const DEFAULT_SPACE_RULES: EffectiveSpaceRules = {
    Chats: {
        WhoCanStart: 'Anyone',
        AgentReplyMode: 'MentionOrOneToOne',
        HistoryOnAdd: 'None',
    },
    Agents: {
        ListMode: 'Extend',
    },
    Labels: undefined,
    Extensions: {},
};

/**
 * Resolves effective rules for a space given its type configuration and space-level overrides.
 *
 * 1. Starts from Collaboration's defaults.
 * 2. Applies the type's values.
 * 3. Applies the space's values ONLY for the dotted keys listed in `type.SpaceOverridable`.
 */
export function ResolveSpaceRules(
    typeConfig: ISpaceTypeConfiguration | null | undefined,
    spaceConfig: ISpaceConfiguration | null | undefined
): EffectiveSpaceRules {
    const rules: EffectiveSpaceRules = {
        Chats: {
            WhoCanStart: typeConfig?.Chats?.WhoCanStart ?? DEFAULT_SPACE_RULES.Chats.WhoCanStart,
            AgentReplyMode: typeConfig?.Chats?.AgentReplyMode ?? DEFAULT_SPACE_RULES.Chats.AgentReplyMode,
            HistoryOnAdd: typeConfig?.Chats?.HistoryOnAdd ?? DEFAULT_SPACE_RULES.Chats.HistoryOnAdd,
        },
        Agents: {
            ListMode: typeConfig?.Agents?.ListMode ?? DEFAULT_SPACE_RULES.Agents.ListMode,
        },
        Labels: typeConfig?.Labels,
        Extensions: {
            ...(typeConfig?.Extensions ?? {}),
        },
    };

    if (!spaceConfig || !typeConfig?.SpaceOverridable || typeConfig.SpaceOverridable.length === 0) {
        return rules;
    }

    const overridable = new Set(typeConfig.SpaceOverridable);

    if (overridable.has('Chats.WhoCanStart') && spaceConfig.Chats?.WhoCanStart) {
        rules.Chats.WhoCanStart = spaceConfig.Chats.WhoCanStart;
    }
    if (overridable.has('Chats.AgentReplyMode') && spaceConfig.Chats?.AgentReplyMode) {
        rules.Chats.AgentReplyMode = spaceConfig.Chats.AgentReplyMode;
    }
    if (overridable.has('Chats.HistoryOnAdd') && spaceConfig.Chats?.HistoryOnAdd) {
        rules.Chats.HistoryOnAdd = spaceConfig.Chats.HistoryOnAdd;
    }
    if (overridable.has('Agents.ListMode') && spaceConfig.Agents?.ListMode) {
        rules.Agents.ListMode = spaceConfig.Agents.ListMode;
    }

    // Check extensions overrides (e.g. 'Extensions.MyApp')
    if (spaceConfig.Extensions) {
        for (const [appName, appSettings] of Object.entries(spaceConfig.Extensions)) {
            if (overridable.has(`Extensions.${appName}`) || overridable.has('Extensions')) {
                rules.Extensions[appName] = {
                    ...(rules.Extensions[appName] ?? {}),
                    ...appSettings,
                };
            }
        }
    }

    return rules;
}

/**
 * Validates a SpaceTypeConfiguration object structure.
 */
export function validateSpaceTypeConfiguration(config: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { valid: false, errors: ['Configuration must be a non-null object.'] };
    }

    const c = config as ISpaceTypeConfiguration;

    if (c.Chats) {
        if (c.Chats.WhoCanStart && !['Anyone', 'Contributors', 'Owners'].includes(c.Chats.WhoCanStart)) {
            errors.push(`Invalid Chats.WhoCanStart: ${c.Chats.WhoCanStart}`);
        }
        if (c.Chats.AgentReplyMode && !['MentionOrOneToOne', 'MentionOnly', 'Always'].includes(c.Chats.AgentReplyMode)) {
            errors.push(`Invalid Chats.AgentReplyMode: ${c.Chats.AgentReplyMode}`);
        }
        if (c.Chats.HistoryOnAdd && !['None', 'All', 'Since'].includes(c.Chats.HistoryOnAdd)) {
            errors.push(`Invalid Chats.HistoryOnAdd: ${c.Chats.HistoryOnAdd}`);
        }
    }

    if (c.Agents) {
        if (c.Agents.ListMode && !['Extend', 'Replace'].includes(c.Agents.ListMode)) {
            errors.push(`Invalid Agents.ListMode: ${c.Agents.ListMode}`);
        }
    }

    if (c.Children) {
        if (c.Children.AllowedTypeCodes && !Array.isArray(c.Children.AllowedTypeCodes)) {
            errors.push('Children.AllowedTypeCodes must be an array of strings.');
        }
        if (c.Children.MaxOpen !== undefined && (typeof c.Children.MaxOpen !== 'number' || c.Children.MaxOpen < 0)) {
            errors.push('Children.MaxOpen must be a non-negative number.');
        }
    }

    if (c.SpaceOverridable && !Array.isArray(c.SpaceOverridable)) {
        errors.push('SpaceOverridable must be an array of strings.');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates a SpaceConfiguration against allowed overridable keys from its SpaceType.
 */
export function validateSpaceConfiguration(
    spaceConfig: unknown,
    typeConfig: ISpaceTypeConfiguration | null | undefined
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!spaceConfig) return { valid: true, errors: [] };

    if (typeof spaceConfig !== 'object' || Array.isArray(spaceConfig)) {
        return { valid: false, errors: ['Space Configuration must be an object.'] };
    }

    const sc = spaceConfig as ISpaceConfiguration;
    const overridable = new Set(typeConfig?.SpaceOverridable ?? []);

    if (sc.Chats?.WhoCanStart && !overridable.has('Chats.WhoCanStart')) {
        errors.push("Chats.WhoCanStart cannot be overridden by space: not in type's SpaceOverridable.");
    }
    if (sc.Chats?.AgentReplyMode && !overridable.has('Chats.AgentReplyMode')) {
        errors.push("Chats.AgentReplyMode cannot be overridden by space: not in type's SpaceOverridable.");
    }
    if (sc.Chats?.HistoryOnAdd && !overridable.has('Chats.HistoryOnAdd')) {
        errors.push("Chats.HistoryOnAdd cannot be overridden by space: not in type's SpaceOverridable.");
    }
    if (sc.Agents?.ListMode && !overridable.has('Agents.ListMode')) {
        errors.push("Agents.ListMode cannot be overridden by space: not in type's SpaceOverridable.");
    }

    if (sc.Extensions) {
        for (const appName of Object.keys(sc.Extensions)) {
            if (!overridable.has(`Extensions.${appName}`) && !overridable.has('Extensions')) {
                errors.push(`Extensions.${appName} cannot be overridden by space: not in type's SpaceOverridable.`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}
