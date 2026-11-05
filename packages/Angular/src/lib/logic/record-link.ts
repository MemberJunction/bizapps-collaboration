/**
 * A record link's key, read against the entity's primary key the way MJ's `ConversationUtility.CompositeKeyFromRecordLink` reads
 * it: one value per key field, with `id` standing in for `ID`. Null when the entity has no key fields or the link lacks one.
 */
export function recordLinkKeyPairs(keys: Readonly<Record<string, string | number>>, primaryKeyNames: readonly string[]): Array<{ FieldName: string; Value: string }> | null {
    if (!primaryKeyNames.length) return null;
    const pairs: Array<{ FieldName: string; Value: string }> = [];
    for (const name of primaryKeyNames) {
        const value = keys[name] ?? (name === 'ID' ? keys['id'] : undefined);
        if (value == null || value === '') return null;
        pairs.push({ FieldName: name, Value: String(value) });
    }
    return pairs;
}
