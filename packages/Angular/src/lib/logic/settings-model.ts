import type { SpaceSettingsModel } from '@mj-biz-apps/collaboration-ng-widgets';

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
    Retention?: 'Month' | 'Year' | 'Indefinite' | null;
    ClosedAt?: Date | string | null;
}

/** What the screen shows about the space's type. */
export interface SettingsTypeInfo {
    name: string;
    icon: string | null;
    color: string | null;
    /** The type's own default retention, used when the space has none. */
    defaultRetention: 'Month' | 'Year' | 'Indefinite' | null;
}


export function buildSettingsModel(space: SettingsSpaceRow, type: SettingsTypeInfo): SpaceSettingsModel {
    return {
        id: space.ID,
        name: space.Name,
        description: space.Description || '',
        spaceType: type.name || 'Unknown Type',
        spaceTypeId: space.SpaceTypeID,
        iconClass: space.IconClass || type.icon || 'fa-solid fa-compass',
        color: space.Color || type.color || '#0076b6',
        backgroundImageUrl: space.BackgroundImageURL || '',
        inheritsMembership: space.InheritsMembership === true,
        agentRetrieval: space.AgentRetrieval || 'Included',
        // A space with no retention of its own uses its type's default. Show that, and never write it back as a choice.
        retention: space.Retention ?? '',
        typeDefaultRetention: type.defaultRetention ?? 'Indefinite',
        status: space.ClosedAt ? 'Closed' : 'Active',
    };
}

/** The columns a save writes: only those whose value the person changed from what the screen showed them. */
export type SettingsChanges = Partial<Pick<SettingsSpaceRow,
    'Name' | 'Description' | 'IconClass' | 'Color' | 'BackgroundImageURL' | 'InheritsMembership' | 'AgentRetrieval' | 'Retention'>>;

export function changedSettings(baseline: SpaceSettingsModel, edited: SpaceSettingsModel): SettingsChanges {
    const changes: SettingsChanges = {};
    if (edited.name !== baseline.name) changes.Name = edited.name;
    if (edited.description !== baseline.description) changes.Description = edited.description;
    if (edited.iconClass !== baseline.iconClass) changes.IconClass = edited.iconClass;
    if (edited.color !== baseline.color) changes.Color = edited.color;
    if (edited.backgroundImageUrl !== baseline.backgroundImageUrl) changes.BackgroundImageURL = edited.backgroundImageUrl || null;
    if (edited.inheritsMembership !== baseline.inheritsMembership) changes.InheritsMembership = edited.inheritsMembership;
    if (edited.agentRetrieval !== baseline.agentRetrieval) changes.AgentRetrieval = edited.agentRetrieval as SettingsSpaceRow['AgentRetrieval'];
    if (edited.retention !== baseline.retention) changes.Retention = edited.retention === '' ? null : (edited.retention as SettingsSpaceRow['Retention']);
    return changes;
}
