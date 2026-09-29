/**
 * Runs a type's UI driver `Before…` hook. A hook that throws must not become an action that goes ahead unchecked, and must
 * not escape as an unhandled rejection: the throw is reported to `onError` (which logs it) and the answer is false.
 */
export function runBeforeHookSafely(
    hook: string,
    typeCode: string | undefined,
    spaceId: string,
    run: () => void,
    onError: (message: string) => void,
): boolean {
    try {
        run();
        return true;
    } catch (err) {
        onError(`${hook} of space type '${typeCode ?? 'unknown'}' failed for space ${spaceId}: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}
