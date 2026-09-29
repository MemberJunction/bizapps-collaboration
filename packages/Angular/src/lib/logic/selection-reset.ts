import type { SpaceBand } from '@mj-biz-apps/collaboration-ng-widgets';

/**
 * What the screen holds for "the space shown" that belongs to one space and must not outlive it. A selection starts from this:
 * the drawer is closed, the bands read as the narrowest audience (Team) until the members and conversations are read, and the
 * last space's save messages are gone.
 */
export interface SelectionState {
    isDrawerOpen: boolean;
    selectedItemId: string | null;
    spaceAudienceBand: SpaceBand;
    chatAudienceBand: SpaceBand;
    settingsSaveSuccess: string;
    settingsInfoMessage: string;
    /** The share, upload and new-conversation dialogs are each for one space, so none stays open over the next one. */
    isShareDialogOpen: boolean;
    isUploadDialogOpen: boolean;
    isNewConversationDialogOpen: boolean;
}

export function freshSelectionState(): SelectionState {
    return {
        isDrawerOpen: false,
        selectedItemId: null,
        spaceAudienceBand: 'Team',
        chatAudienceBand: 'Team',
        settingsSaveSuccess: '',
        settingsInfoMessage: '',
        isShareDialogOpen: false,
        isUploadDialogOpen: false,
        isNewConversationDialogOpen: false,
    };
}

/** The flag a selection raises while its reads run and lowers when they finish — but only the newest selection may lower it. */
export class LoadingFlag {
    private latest = 0;
    private active = false;

    public get Active(): boolean {
        return this.active;
    }

    /** A selection starts. Returns the function that ends it. */
    public Begin(): () => void {
        const mine = ++this.latest;
        this.active = true;
        return () => {
            if (mine === this.latest) this.active = false;
        };
    }
}
