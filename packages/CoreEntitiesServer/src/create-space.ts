import { type BaseEntity, type DatabaseProviderBase, EntityFieldTSType, LogError, WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import { ownDetailFields, type mjBizAppsCollaborationSpaceEntity, type mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { parseUuid } from './uuid.js';

const SPACE_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBER_ENTITY = 'MJ_BizApps_Collaboration: Space Members';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateSpaceInput {
    TypeID: string;
    Name: string;
    Description?: string | null;
    /** The parent, for a sub-space; absent for a top-level space. The parent's type says which types may sit under it. */
    ParentID?: string | null;
    /** Whether the space's members come from its parent (D22: the creator chooses). A top-level space has no parent to inherit from; default true. */
    InheritsMembership?: boolean;
    /** The subtype's own columns, by field name. Only what the type's subtype adds to a space is accepted. */
    Details?: Record<string, unknown> | null;
}

export type CreateSpaceResult = { status: 'created'; spaceId: string } | { status: 'refused'; message: string };

/** Puts a value from JSON where the entity field wants it: a date field takes a Date, not its text. */
function asFieldValue(leaf: BaseEntity, name: string, value: unknown): unknown {
    const field = leaf.EntityInfo.Fields.find((f) => f.Name === name);
    if (field?.TSType === EntityFieldTSType.Date && typeof value === 'string') return new Date(value);
    return value;
}

/**
 * Makes a top-level space of a type, and seats the person who makes it as its owner, in one transaction: the space (through its
 * subtype, when the type names one) and the seat are written together or not at all, so a failed seat leaves no space nobody is
 * seated on. The space's own rules apply as for any save: it is the person's own save, judged as they are.
 */
export async function createSpace(provider: DatabaseProviderBase, user: UserInfo, input: CreateSpaceInput): Promise<CreateSpaceResult> {
    const typeId = parseUuid(input.TypeID);
    if (!typeId) return { status: 'refused', message: 'Invalid space type.' };
    const name = input.Name?.trim() ?? '';
    if (!name) return { status: 'refused', message: 'A space needs a name.' };

    try {
        const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
        if (!system) throw new Error('the system user is not available');
        await CollaborationEngine.Instance.Config(false, system, provider);
    } catch (error) {
        LogError(`createSpace could not load the collaboration settings: ${error instanceof Error ? error.message : String(error)}`);
        return { status: 'refused', message: 'The space could not be created: the collaboration settings could not be read.' };
    }
    const type = CollaborationEngine.Instance.SpaceTypeById(typeId);
    if (!type || !type.IsActive) return { status: 'refused', message: 'That kind of space is not available.' };
    const ownerRole = CollaborationEngine.Instance.SpaceRoleTypeByCode('owner');
    if (!ownerRole) return { status: 'refused', message: "The owner role isn't set up, so the space can't be created." };

    const space = await provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, user);
    space.NewRecord();
    space.SpaceTypeID = type.ID;
    space.OwnerID = user.ID;
    if (input.ParentID !== undefined && input.ParentID !== null && input.ParentID !== '') {
        if (!UUID.test(input.ParentID)) return { status: 'refused', message: 'The parent space id is not valid.' };
        space.ParentID = input.ParentID;
    }
    space.InheritsMembership = input.InheritsMembership ?? true;
    space.Name = name;
    space.Description = input.Description?.trim() || null;
    const attached = await space.EnsureISAChild();
    const leaf: BaseEntity = attached ? space.LeafEntity : space;

    const allowed = new Set(attached ? ownDetailFields(attached).map((f) => f.name) : []);
    for (const [field, value] of Object.entries(input.Details ?? {})) {
        if (!allowed.has(field)) return { status: 'refused', message: `${field} is not a detail of a ${type.Name} space.` };
        leaf.Set(field, asFieldValue(leaf, field, value));
    }

    await provider.BeginTransaction();
    try {
        if (!(await leaf.Save())) {
            throw new RefusedError(leaf.LatestResult?.CompleteMessage || 'The space could not be created.');
        }
        const seat = await provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, user);
        seat.NewRecord();
        seat.SpaceID = space.ID;
        seat.UserID = user.ID;
        seat.SpaceRoleTypeID = ownerRole.ID;
        seat.Band = 'Team';
        seat.Status = 'Active';
        if (!(await seat.Save())) {
            throw new RefusedError(`You could not be seated as the space's owner: ${seat.LatestResult?.CompleteMessage ?? 'unknown error'}`);
        }
        await provider.CommitTransaction();
        return { status: 'created', spaceId: space.ID };
    } catch (error) {
        await provider.RollbackTransaction();
        if (error instanceof RefusedError) return { status: 'refused', message: error.message };
        LogError(`createSpace failed: ${error instanceof Error ? error.message : String(error)}`);
        return { status: 'refused', message: 'The space could not be created.' };
    }
}

/** A refusal with words for the person, as opposed to a failure that is only logged. */
class RefusedError extends Error {}
