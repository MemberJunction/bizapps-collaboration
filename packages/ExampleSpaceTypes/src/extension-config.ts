/**
 * The example drivers read their behaviour switches from configuration, not from literals in code: a space type's or a space's
 * `Configuration.Extensions[<driver key>]` object (extensibility plan § 4).
 */
export type ExtensionSettings = Record<string, unknown>;

/** The `Extensions[key]` object of a configuration string, or an empty object when there is none or it doesn't parse. */
export function readExtension(configuration: string | null | undefined, key: string): ExtensionSettings {
    if (!configuration) return {};
    try {
        const parsed = JSON.parse(configuration) as { Extensions?: Record<string, ExtensionSettings> };
        const found = parsed.Extensions?.[key];
        return found && typeof found === 'object' && !Array.isArray(found) ? found : {};
    } catch {
        return {};
    }
}

/** A setting that is a list of strings, lower-cased for comparison. Anything else reads as an empty list. */
export function stringList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.toLowerCase().trim()) : [];
}
