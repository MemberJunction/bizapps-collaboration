const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** A value that will be interpolated into ExtraFilter. Anything else is refused. */
export function requireUuid(value: string | null | undefined, field: string): string {
    if (!value || !UUID.test(value)) {
        throw new Error(`${field} must be a UUID before it can be used in a filter.`);
    }
    return value;
}
