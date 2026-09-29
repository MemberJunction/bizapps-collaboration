import { LogError } from '@memberjunction/core';

/**
 * The example drivers read their behaviour switches from configuration, not from literals in code: a space type's or a space's
 * `Configuration.Extensions[<driver key>]` object (extensibility plan § 4). Settings are refused when they don't parse or have
 * the wrong shape, never quietly read as empty: a typo must not turn a rule off.
 */
export type ExtensionSettings = Record<string, unknown>;

/** The `Extensions[key]` object of a configuration string; empty when there is none. Throws when the configuration doesn't parse. */
export function readExtension(configuration: string | null | undefined, key: string): ExtensionSettings {
    if (!configuration) return {};
    let parsed: { Extensions?: Record<string, ExtensionSettings> };
    try {
        parsed = JSON.parse(configuration) as { Extensions?: Record<string, ExtensionSettings> };
    } catch (error) {
        const message = `The configuration read for extension "${key}" does not parse: ${error instanceof Error ? error.message : String(error)}`;
        LogError(message);
        throw new Error(message);
    }
    const found = parsed.Extensions?.[key];
    if (found === undefined) return {};
    if (!found || typeof found !== 'object' || Array.isArray(found)) {
        const message = `Extensions["${key}"] must be an object.`;
        LogError(message);
        throw new Error(message);
    }
    return found;
}

/** A setting that is a list of strings, lower-cased for comparison. Absent reads as empty; anything else throws, naming the setting. */
export function stringList(value: unknown, name = 'setting'): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        const message = `The extension ${name} must be a list of strings.`;
        LogError(message);
        throw new Error(message);
    }
    return value.map((item: string) => item.toLowerCase().trim());
}
