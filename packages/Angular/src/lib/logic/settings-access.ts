/** What a person may do on the Settings tab of a space: the rights, and what the screen offers because of them. */
export interface SettingsRights {
    isClosed: boolean;
    /** The space's status is terminal (stage 1): Closed moves forward only, so there is no reopen. False for a status a space comes back from. */
    isTerminal?: boolean;
    /** May change the space's settings ('Configure Spaces' and an owner seat). */
    canConfigure: boolean;
    /** May close an open space ('Close and Reopen Spaces' and an owner seat). */
    canClose: boolean;
    /** May reopen a closed space ('Close and Reopen Spaces' and an owner seat, even when its access has ended). */
    canReopen: boolean;
}

export interface SettingsAccess {
    /** The Settings tab is offered. */
    showTab: boolean;
    /** The form is editable. When false, the screen shows only the close or reopen control. */
    canEdit: boolean;
    /** The close (or, on a closed space, reopen) button is offered. */
    canChangeLifecycle: boolean;
    /** Said above the read-only view, and empty when the form is editable. */
    readOnlyNote: string;
}

/**
 * The page follows the server: closing and reopening need the 'Close and Reopen Spaces' authorization and an owner seat, and
 * nothing more; changing settings needs 'Configure Spaces'. So someone who may close but not configure sees read-only Settings
 * with Close, and an owner who may configure but not close sees the form without the close button.
 */
export function settingsAccess(rights: SettingsRights): SettingsAccess {
    // A closed space is read-only for everyone (stage 1): the form is not edited; and a terminal status offers no way back
    const terminal = rights.isClosed && !!rights.isTerminal;
    const canChangeLifecycle = rights.isClosed ? rights.canReopen && !terminal : rights.canClose;
    const showTab = rights.canConfigure || canChangeLifecycle;
    const canEdit = rights.canConfigure && !rights.isClosed;
    const readOnlyNote = !showTab || canEdit
        ? ''
        : terminal
            ? "This space is closed. Closed moves forward only, so nobody brings it back; its settings can't change."
            : rights.isClosed
                ? canChangeLifecycle
                    ? "You can reopen this space, but you can't change its settings while it is closed."
                    : "This space is closed; its settings can't change while it is."
                : "You can close this space, but you can't change its settings.";
    return { showTab, canEdit, canChangeLifecycle, readOnlyNote };
}
