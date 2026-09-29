import type { BaseEntity, IMetadataProvider, UserInfo } from '@memberjunction/core';
import type {
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';

/** A column of an entity as this module reads it: the parts of `EntityFieldInfo` that decide whether a form asks for it. */
export interface DetailFieldShape {
    Name: string;
    DisplayName: string;
    IsPrimaryKey: boolean;
    IsVirtual: boolean;
    AllowUpdateAPI: boolean;
    AllowsNull: boolean;
    /** The database default, or null when there is none. */
    DefaultValue: string | null;
    Sequence: number;
}

/** A field a space's subtype keeps of its own, as the dialog and the settings ask for it. */
export interface DetailField {
    name: string;
    label: string;
    /** The person must fill it in: the column allows no null and has no default. */
    required: boolean;
}

/**
 * The columns a subtype adds to a space, in the order the entity gives them. A subtype's entity also carries the space's own
 * columns (the primary key, the parent's fields, the audit columns, and view-only columns): those are the space's, not its details.
 */
export function detailFields(fields: readonly DetailFieldShape[], parentFieldNames: ReadonlySet<string>): DetailField[] {
    return fields
        .filter((f) => !f.IsPrimaryKey && !f.IsVirtual && f.AllowUpdateAPI && !f.Name.startsWith('__mj_') && !parentFieldNames.has(f.Name))
        .sort((a, b) => a.Sequence - b.Sequence)
        .map((f) => ({
            name: f.Name,
            label: f.DisplayName,
            required: !f.AllowsNull && (f.DefaultValue === null || f.DefaultValue === undefined || f.DefaultValue === ''),
        }));
}

function isFilled(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    return typeof value === 'string' ? value.trim().length > 0 : true;
}

/** The subtype's own detail fields, read from the entity object's metadata. */
export function ownDetailFields(leaf: BaseEntity): DetailField[] {
    return detailFields(
        leaf.EntityInfo.Fields.map((f) => ({
            Name: f.Name,
            DisplayName: f.DisplayNameOrName,
            IsPrimaryKey: f.IsPrimaryKey,
            IsVirtual: f.IsVirtual,
            AllowUpdateAPI: f.AllowUpdateAPI,
            AllowsNull: f.AllowsNull,
            DefaultValue: f.DefaultValue ?? null,
            Sequence: f.Sequence,
        })),
        leaf.EntityInfo.ParentEntityFieldNames,
    );
}

/**
 * The fields a UI driver's details form leaves in: those it does not name as hidden, compared without regard to case. A required
 * field stays whatever the driver says, since a space can't be saved without it.
 */
export function visibleDetailFields(fields: readonly DetailField[], hiddenFieldNames: readonly string[] | undefined): DetailField[] {
    const hidden = new Set((hiddenFieldNames ?? []).map((n) => n.toLowerCase()));
    return fields.filter((f) => f.required || !hidden.has(f.name.toLowerCase()));
}

/** The required details that have no value yet. */
export function missingDetails(fields: readonly DetailField[], valueOf: (name: string) => unknown): DetailField[] {
    return fields.filter((f) => f.required && !isFilled(valueOf(f.name)));
}

const SPACE_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBER_ENTITY = 'MJ_BizApps_Collaboration: Space Members';

/**
 * What a save of the draft came to. `unseated` means the space was written but the seat that makes the person its owner was not:
 * the space exists, and the screen opens it and says what is missing.
 */
export type NewSpaceOutcome =
    | { status: 'created'; spaceId: string }
    | { status: 'unseated'; spaceId: string; message: string }
    | { status: 'refused'; message: string };

/**
 * A space that is being made: its own record, and, when its type keeps details in a subtype of Space, that subtype record attached
 * to it, so one save writes both rows. The screen draws the subtype's own fields from `DetailFields` and reads them back from `Leaf`.
 */
export class NewSpaceDraft {
    public readonly Space: mjBizAppsCollaborationSpaceEntity;
    public readonly Leaf: BaseEntity;
    public readonly DetailFields: readonly DetailField[];

    private constructor(space: mjBizAppsCollaborationSpaceEntity, leaf: BaseEntity, own: readonly DetailField[]) {
        this.Space = space;
        this.Leaf = leaf;
        this.DetailFields = own;
    }

    /** Makes the draft for a type. A type with no subtype gives a plain space and no detail fields. */
    public static async Start(
        provider: IMetadataProvider,
        user: UserInfo,
        type: Pick<mjBizAppsCollaborationSpaceTypeEntity, 'ID' | 'DefaultInheritsMembership'>,
    ): Promise<NewSpaceDraft> {
        const space = await provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, user);
        space.NewRecord();
        space.SpaceTypeID = type.ID;
        space.OwnerID = user.ID;
        space.InheritsMembership = type.DefaultInheritsMembership;
        // The type names the subtype, and the resolver answers from it: the child is attached to this very object
        const attached = await space.EnsureISAChild();
        const leaf: BaseEntity = attached ? space.LeafEntity : space;
        const own = attached ? ownDetailFields(attached) : [];
        return new NewSpaceDraft(space, leaf, own);
    }

    public get HasDetails(): boolean {
        return this.DetailFields.length > 0;
    }

    /** The subtype's required fields that are still empty. */
    public MissingDetails(): DetailField[] {
        return missingDetails(this.DetailFields, (name) => this.Leaf.Get(name));
    }

    /**
     * Saves the space (through its subtype, which writes both rows) and seats the person as its owner.
     * A failed seat is reported, not hidden: the space exists, and its owner can still open it.
     */
    public async Save(
        provider: IMetadataProvider,
        user: UserInfo,
        input: { name: string; description: string; ownerRoleId: string | undefined },
    ): Promise<NewSpaceOutcome> {
        this.Space.Name = input.name;
        this.Space.Description = input.description || null;
        if (!(await this.Leaf.Save())) {
            const result = this.Leaf.LatestResult ?? this.Space.LatestResult;
            return { status: 'refused', message: result?.CompleteMessage || 'The space could not be created.' };
        }
        const spaceId = this.Space.ID;
        if (!input.ownerRoleId) {
            return { status: 'unseated', spaceId, message: 'The space was created, but there is no owner role to seat you in.' };
        }
        const seat = await provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, user);
        seat.NewRecord();
        seat.SpaceID = spaceId;
        seat.UserID = user.ID;
        seat.SpaceRoleTypeID = input.ownerRoleId;
        seat.Band = 'Team';
        seat.Status = 'Active';
        if (!(await seat.Save())) {
            return { status: 'unseated', spaceId, message: `The space was created, but you could not be seated as its owner: ${seat.LatestResult?.CompleteMessage ?? 'unknown error'}` };
        }
        return { status: 'created', spaceId };
    }
}


/** What saving a space's details came to. */
export type SaveDetailsOutcome = { ok: true } | { ok: false; message: string };

/**
 * The details a saved space keeps of its own, when its type names a subtype: the subtype record, loaded through the space, and the
 * fields to draw. Saving it writes the subtype's columns (and the space, if it changed) in one save.
 */
export class SpaceDetails {
    public readonly Leaf: BaseEntity;
    public readonly Fields: readonly DetailField[];

    private constructor(leaf: BaseEntity, fields: readonly DetailField[]) {
        this.Leaf = leaf;
        this.Fields = fields;
    }

    /** Loads a space and returns its details, or null when the space is plain (its type names no subtype) or can't be read. */
    public static async Load(provider: IMetadataProvider, user: UserInfo, spaceId: string): Promise<SpaceDetails | null> {
        const space = await provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, user);
        if (!(await space.Load(spaceId))) return null;
        const leaf: BaseEntity = space.LeafEntity;
        if (leaf === space) return null;
        return new SpaceDetails(leaf, ownDetailFields(leaf));
    }

    /** True while a detail was changed and not saved. */
    public get Dirty(): boolean {
        return this.Fields.some((f) => this.Leaf.GetFieldByName(f.name)?.Dirty === true);
    }

    public MissingDetails(hiddenFieldNames?: readonly string[]): DetailField[] {
        return missingDetails(visibleDetailFields(this.Fields, hiddenFieldNames), (name) => this.Leaf.Get(name));
    }

    public async Save(): Promise<SaveDetailsOutcome> {
        if (await this.Leaf.Save()) return { ok: true };
        return { ok: false, message: this.Leaf.LatestResult?.CompleteMessage || 'The details could not be saved.' };
    }

    /** Puts every detail back to what was saved. */
    public Discard(): void {
        this.Leaf.Revert();
    }
}
