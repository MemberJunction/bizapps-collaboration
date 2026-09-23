const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Null when the value is not a UUID. Callers turn that into a validation error, not a throw. */
export function parseUuid(value: string | null | undefined): string | null {
    if (!value || !UUID.test(value)) {
        return null;
    }
    return value;
}
