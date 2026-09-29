import type { BaseEntity, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { missingDetails, visibleDetailFields, type DetailField } from '@mj-biz-apps/collaboration-core';
import { ownDetailFields, type CreateSpaceGraphQLInput, type CreateSpaceGraphQLPayload, type mjBizAppsCollaborationSpaceEntity, type mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';

const SPACE_ENTITY = 'MJ_BizApps_Collaboration: Spaces';

/** What a save of the draft came to: the new space's id, or the words to show. The space and its owner's seat are written together, so a refusal leaves nothing behind. */
export type NewSpaceOutcome = { status: 'created'; spaceId: string } | { status: 'refused'; message: string };

/** What the draft needs of the server: the operation that makes the space and its owner's seat in one transaction. */
export interface SpaceCreator {
    CreateSpace(input: CreateSpaceGraphQLInput): Promise<CreateSpaceGraphQLPayload>;
}

/**
 * A space that is being made: a record of it, and, when its type keeps details in a subtype of Space, that subtype record attached,
 * so the screen can draw the subtype's own fields (`DetailFields`) and read what was typed back from `Leaf`. Nothing is saved from
 * here: Create sends the type, the name and those values to the server, which writes the space and the owner's seat together.
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
        // The type names the subtype, and the resolver answers from it: the child is attached to this very object. Core logs a load
        // error here for a row that can't exist yet (MemberJunction/MJ#4859); nothing is wrong.
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

    /** What was typed into the subtype's fields, by field name. A field with no value is left out, so the column's own default applies. */
    public Details(): Record<string, unknown> {
        const values: Record<string, unknown> = {};
        for (const field of this.DetailFields) {
            const value = this.Leaf.Get(field.name);
            if (value !== null && value !== undefined && value !== '') values[field.name] = value;
        }
        return values;
    }

    /** Asks the server to make the space and seat the person as its owner, together. */
    public async Create(creator: SpaceCreator, input: { name: string; description: string }): Promise<NewSpaceOutcome> {
        const res = await creator.CreateSpace({
            TypeID: this.Space.SpaceTypeID,
            Name: input.name,
            Description: input.description || undefined,
            ...(this.HasDetails ? { Details: this.Details() } : {}),
        });
        if (res.Success && res.SpaceID) return { status: 'created', spaceId: res.SpaceID };
        return { status: 'refused', message: res.ErrorMessage || 'The space could not be created.' };
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
