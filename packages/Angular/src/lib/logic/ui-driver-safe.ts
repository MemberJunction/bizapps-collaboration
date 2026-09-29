/**
 * Creates a space type's UI driver without letting a driver that throws take the space down: the failure goes to `onError` and the
 * fallback driver is used.
 */
export function resolveDriverSafely<TDriver>(
    resolve: () => TDriver,
    fallback: () => TDriver,
    onError: (error: unknown) => void,
): TDriver {
    try {
        return resolve();
    } catch (error) {
        onError(error);
        return fallback();
    }
}
