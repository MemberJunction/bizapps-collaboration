import type { SpaceSettingsModel } from '@mj-biz-apps/collaboration-ng-widgets';
import type { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';

/** The colour a space shows in the settings colour input when neither it nor its type has one. The input needs a hex value. */
export const DEFAULT_TYPE_COLOR = '#0076b6'; // hex-ok: the colour input's default, the one place a hex is required

/** The columns of a space the Settings screen reads and writes. */
export interface SettingsSpaceRow {
    ID: string;
    Name: string;
    Description?: string | null;
    SpaceTypeID: string;
    IconClass?: string | null;
    Color?: string | null;
    BackgroundImageURL?: string | null;
    InheritsMembership?: boolean;
    AgentRetrieval?: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely' | null;
    ClosedAt?: Date | string | null;
    /** The name of the space's effective status (stage 1), when the caller knows it; else Closed or Active is read from ClosedAt. */
    StatusName?: string | null;
}

/** What the screen shows about the space's type. */
export interface SettingsTypeInfo {
    name: string;
    icon: string | null;
    color: string | null;
}


export function buildSettingsModel(space: SettingsSpaceRow, type: SettingsTypeInfo): SpaceSettingsModel {
    return {
        id: space.ID,
        name: space.Name,
        description: space.Description || '',
        spaceType: type.name || 'Unknown Type',
        spaceTypeId: space.SpaceTypeID,
        iconClass: space.IconClass || type.icon || 'fa-solid fa-compass',
        color: space.Color || type.color || DEFAULT_TYPE_COLOR,
        backgroundImageUrl: space.BackgroundImageURL || '',
        inheritsMembership: space.InheritsMembership === true,
        agentRetrieval: space.AgentRetrieval || 'Included',
        status: space.StatusName || (space.ClosedAt ? 'Closed' : 'Active'),
    };
}

/** The columns a save writes: only those whose value the person changed from what the screen showed them. Keys are the entity's own. */
export type SettingsChanges = Partial<Pick<
    mjBizAppsCollaborationSpaceEntity,
    'Name' | 'Description' | 'IconClass' | 'Color' | 'BackgroundImageURL' | 'InheritsMembership' | 'AgentRetrieval'
>>;

export function changedSettings(baseline: SpaceSettingsModel, edited: SpaceSettingsModel): SettingsChanges {
    const changes: SettingsChanges = {};
    if (edited.name !== baseline.name) changes.Name = edited.name;
    if (edited.description !== baseline.description) changes.Description = edited.description;
    if (edited.iconClass !== baseline.iconClass) changes.IconClass = edited.iconClass;
    if (edited.color !== baseline.color) changes.Color = edited.color;
    if (edited.backgroundImageUrl !== baseline.backgroundImageUrl) changes.BackgroundImageURL = edited.backgroundImageUrl || null;
    if (edited.inheritsMembership !== baseline.inheritsMembership) changes.InheritsMembership = edited.inheritsMembership;
    if (edited.agentRetrieval !== baseline.agentRetrieval) changes.AgentRetrieval = edited.agentRetrieval as mjBizAppsCollaborationSpaceEntity['AgentRetrieval'];
    return changes;
}

/** Writes the changes onto the space, field by field, so a field the save doesn't know about can't be silently ignored. */
export function applySettingsChanges(target: Required<SettingsChanges>, changes: SettingsChanges): void {
    if (changes.Name !== undefined) target.Name = changes.Name;
    if (changes.Description !== undefined) target.Description = changes.Description;
    if (changes.IconClass !== undefined) target.IconClass = changes.IconClass;
    if (changes.Color !== undefined) target.Color = changes.Color;
    if (changes.BackgroundImageURL !== undefined) target.BackgroundImageURL = changes.BackgroundImageURL;
    if (changes.InheritsMembership !== undefined) target.InheritsMembership = changes.InheritsMembership;
    if (changes.AgentRetrieval !== undefined) target.AgentRetrieval = changes.AgentRetrieval;
}

/**
 * What the Settings screen shows and what a save is measured against. The screen rebuilds its form from `Shown` each time it
 * opens, so after a save both must hold what was saved, or the next save writes the old values back.
 */
export class SettingsSession {
    private baseline: SpaceSettingsModel;
    private shown: SpaceSettingsModel;

    constructor(model: SpaceSettingsModel) {
        this.baseline = { ...model };
        this.shown = { ...model };
    }

    /** A new space was selected: start from what it holds. */
    public Open(model: SpaceSettingsModel): void {
        this.baseline = { ...model };
        this.shown = { ...model };
    }

    /** What the form is built from. */
    public get Shown(): SpaceSettingsModel {
        return this.shown;
    }

    /** What differs between the screen as it was shown and the edited form. */
    public Changes(edited: SpaceSettingsModel): SettingsChanges {
        return changedSettings(this.baseline, edited);
    }

    /** A save succeeded. Pass the copy taken before the save started, so an edit made during it is not counted as saved. */
    public Saved(savedCopy: SpaceSettingsModel): void {
        this.baseline = { ...savedCopy };
        this.shown = { ...savedCopy };
    }
}
