/**
 * SpaceAnchorEntityServer (B14, D26): the records a space is about. Each refusal is in `ValidateAsync`, as the plan's § 5 asks:
 * the space exists; the entity exists and the record's key parses for it; `SpaceTypeID` is the space's type; at most one primary
 * per space, and one space of a type per primary record; writes need Configure Spaces on the space (or Administer Spaces), or
 * come from the type's driver through `EnsureSpaceForRecord` or `SyncSeats`, which vouch for the row in process.
 */
import { BaseEntity, type UserInfo, type EntityInfo, Metadata, RunView, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsCollaborationSpaceAnchorEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { requireSystemUser } from './load-graph.js';
import { failDelete } from './space-driver-call.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Anchors';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';

/** The anchors a driver's own path writes: `EnsureSpaceForRecord` and `SyncSeats` vouch for a row they are about to save. */
const vouched = new WeakSet<BaseEntity>();
export function vouchAnchorWrite(anchor: BaseEntity): void {
    vouched.add(anchor);
}
export function releaseAnchorWrite(anchor: BaseEntity): void {
    vouched.delete(anchor);
}

/**
 * Whether `recordId` is a key the entity's primary key accepts: MJ's composite form (`ID|<value>`, `A|1||B|2`) or the bare value of
 * a single key. A uniqueidentifier key needs a UUID; any other type needs a non-empty value.
 */
export function recordKeyParses(entity: Pick<EntityInfo, 'PrimaryKeys'>, recordId: string): boolean {
    const keys = entity.PrimaryKeys ?? [];
    if (keys.length === 0) return false;
    const raw = recordId.trim();
    if (!raw) return false;
    const parts = raw.split('||').map((part) => part.trim()).filter((part) => part.length > 0);
    const values = new Map<string, string>();
    for (const part of parts) {
        const at = part.indexOf('|');
        if (at < 0) {
            if (keys.length !== 1 || parts.length !== 1) return false;
            values.set(keys[0].Name.toLowerCase(), part);
        } else {
            values.set(part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim());
        }
    }
    for (const key of keys) {
        const value = values.get(key.Name.toLowerCase());
        if (value === undefined || value === '') return false;
        if ((key.Type ?? '').toLowerCase() === 'uniqueidentifier' && !parseUuid(value)) return false;
    }
    return values.size === keys.length;
}

/**
 * One spelling of a record id, the one Space Items use: `ID|<value>` for a single-key entity (a bare value gets the key's name),
 * MJ's composite form as given for a composite key. Two anchors on the same record then collide however they were written.
 */
export function canonicalAnchorRecordId(entity: Pick<EntityInfo, 'PrimaryKeys'>, recordId: string): string {
    const raw = recordId.trim();
    const keys = entity.PrimaryKeys ?? [];
    if (keys.length === 1 && !raw.includes('|')) return `${keys[0].Name}|${raw}`;
    return raw;
}

@RegisterClass(BaseEntity, ENTITY)
export class SpaceAnchorEntityServer extends mjBizAppsCollaborationSpaceAnchorEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    private async mayWrite(spaceId: string): Promise<boolean> {
        if (vouched.has(this)) return true;
        const user = this.ContextCurrentUser;
        if (!user) return false;
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
        if (CollaborationEngine.Instance.UserMayAdministerSpaces(user, md)) return true;
        return CollaborationEngine.Instance.UserCanConfigureSpaces(user, spaceId, md);
    }

    /** The space's type and a primary anchor's role, read ahead of MJ's required-field check, which runs before ValidateAsync. */
    private async stampDefaults(): Promise<void> {
        if (!(this.Role ?? '').trim() && this.IsPrimary) this.Role = 'primary';
        const entityId = parseUuid(this.EntityID);
        const entity = entityId ? (asMetadata(this.ProviderToUse) ?? Metadata.Provider).EntityByID(entityId) : null;
        if (entity && (this.RecordID ?? '').trim()) {
            const canonical = canonicalAnchorRecordId(entity, this.RecordID);
            if (canonical !== this.RecordID) this.RecordID = canonical;
        }
        const spaceId = parseUuid(this.SpaceID);
        if (spaceId && !parseUuid(this.SpaceTypeID)) {
            try {
                const system = await requireSystemUser(this);
                const rows = await new RunView(this.RunViewProviderToUse).RunView<{ SpaceTypeID: string }>({ EntityName: SPACES, ExtraFilter: `ID = '${spaceId}'`, Fields: ['SpaceTypeID'], ResultType: 'simple', MaxRows: 1 }, system);
                const typeId = parseUuid(rows.Results?.[0]?.SpaceTypeID);
                if (rows.Success && typeId) this.SpaceTypeID = typeId;
            } catch {
                // the gate reports what it could not read
            }
        }
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        await this.stampDefaults();
        return super.Save(options);
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        await this.stampDefaults();
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user) return fail(result, 'SpaceID', 'Anchor change refused: there is no signed-in user.');
        const spaceId = parseUuid(this.SpaceID);
        if (!spaceId) return fail(result, 'SpaceID', 'Anchor change refused: the space id is not valid.');
        const entityId = parseUuid(this.EntityID);
        if (!entityId) return fail(result, 'EntityID', 'Anchor change refused: the entity id is not valid.');
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;

        const entity = md.EntityByID(entityId);
        if (!entity) return fail(result, 'EntityID', 'Anchor change refused: that entity is not in this database.');
        const recordId = (this.RecordID ?? '').trim();
        if (!recordId) return fail(result, 'RecordID', 'Anchor change refused: the record id is required.');
        if (!recordKeyParses(entity, recordId)) {
            return fail(result, 'RecordID', `Anchor change refused: "${recordId}" is not a key of ${entity.Name}.`);
        }
        if (!(this.Role ?? '').trim()) {
            if (this.IsPrimary) this.Role = 'primary';
            else return fail(result, 'Role', 'Anchor change refused: an anchor names its role (what the record is to the space).');
        }

        let system;
        try {
            system = await requireSystemUser(this);
        } catch (error) {
            return fail(result, 'SpaceID', error instanceof Error ? error.message : 'Anchor change refused: the system user is not available.');
        }
        const rv = new RunView(this.RunViewProviderToUse);
        const spaces = await rv.RunView<{ ID: string; SpaceTypeID: string; Name: string }>({
            EntityName: SPACES,
            ExtraFilter: `ID = '${spaceId}'`,
            Fields: ['ID', 'SpaceTypeID', 'Name'],
            ResultType: 'simple',
            MaxRows: 1,
        }, system);
        if (!spaces.Success) return fail(result, 'SpaceID', `Anchor change refused: the space could not be read: ${spaces.ErrorMessage ?? 'unknown error'}`);
        const space = spaces.Results?.[0];
        if (!space) return fail(result, 'SpaceID', 'Anchor change refused: that space does not exist.');

        // The type is the space's, kept in step by the server: stamped when empty, refused when it names another
        const spaceTypeId = parseUuid(space.SpaceTypeID);
        const givenType = parseUuid(this.SpaceTypeID);
        if (givenType && spaceTypeId && givenType !== spaceTypeId) {
            return fail(result, 'SpaceTypeID', "Anchor change refused: the anchor's type must be the space's type.");
        }
        if (!givenType && spaceTypeId) this.SpaceTypeID = spaceTypeId;

        if (!(await this.mayWrite(spaceId))) {
            return fail(result, 'SpaceID', "Anchor change refused: anchors are written with the 'Configure Spaces' authorization and an owner seat on the space, with 'Administer Spaces', or by the type's driver.");
        }

        if (this.IsPrimary) {
            const notSelf = this.IsSaved && parseUuid(this.ID) ? ` AND ID <> '${parseUuid(this.ID)}'` : '';
            const samePrimary = await rv.RunView<{ ID: string }>({
                EntityName: ENTITY,
                ExtraFilter: `SpaceID = '${spaceId}' AND IsPrimary = 1${notSelf}`,
                Fields: ['ID'],
                ResultType: 'simple',
                MaxRows: 1,
            }, system);
            if (!samePrimary.Success) return fail(result, 'IsPrimary', `Anchor change refused: the space's anchors could not be read: ${samePrimary.ErrorMessage ?? 'unknown error'}`);
            if (samePrimary.Results?.length) return fail(result, 'IsPrimary', `Anchor change refused: ${space.Name} already has a primary anchor.`);

            if (spaceTypeId) {
                const sameRecord = await rv.RunView<{ SpaceID: string; Space: string }>({
                    EntityName: ENTITY,
                    ExtraFilter: `SpaceTypeID = '${spaceTypeId}' AND EntityID = '${entityId}' AND RecordID = '${recordId.replace(/'/g, "''")}' AND IsPrimary = 1 AND SpaceID <> '${spaceId}'`,
                    Fields: ['SpaceID', 'Space'],
                    ResultType: 'simple',
                    MaxRows: 1,
                }, system);
                if (!sameRecord.Success) return fail(result, 'RecordID', `Anchor change refused: the type's anchors could not be read: ${sameRecord.ErrorMessage ?? 'unknown error'}`);
                const other = sameRecord.Results?.[0];
                if (other) return fail(result, 'RecordID', `Anchor change refused: ${other.Space || 'another space'} of the same type is already anchored to this record.`);
            }
        }
        return result;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const spaceId = parseUuid(this.SpaceID);
        if (!spaceId) return failDelete(this, 'Anchor delete refused: the space id is not valid.');
        if (!(await this.mayWrite(spaceId))) {
            return failDelete(this, "Anchor delete refused: anchors are removed with the 'Configure Spaces' authorization and an owner seat on the space, or by the type's driver.");
        }
        return super.Delete(options);
    }
}

/**
 * The space of `typeId` that already holds one of `spaceId`'s primary anchors, if any (item 149): a retype onto `typeId` would put
 * two spaces of one type on the same record. Read as the system user. Throws when a read fails, so the caller fails closed.
 */
export async function primaryAnchorCollision(
    rv: RunView,
    system: UserInfo,
    spaceId: string,
    typeId: string,
): Promise<{ space: string; entity: string; recordId: string } | null> {
    const own = await rv.RunView<{ EntityID: string; RecordID: string }>({
        EntityName: ENTITY,
        ExtraFilter: `SpaceID = '${spaceId}' AND IsPrimary = 1`,
        Fields: ['EntityID', 'RecordID'],
        ResultType: 'simple',
    }, system);
    if (!own.Success) throw new Error(own.ErrorMessage ?? "The space's anchors could not be read.");
    for (const anchor of own.Results ?? []) {
        const other = await rv.RunView<{ Space: string; Entity: string }>({
            EntityName: ENTITY,
            ExtraFilter: `SpaceTypeID = '${typeId}' AND EntityID = '${anchor.EntityID}' AND RecordID = '${String(anchor.RecordID).replace(/'/g, "''")}' AND IsPrimary = 1 AND SpaceID <> '${spaceId}'`,
            Fields: ['Space', 'Entity'],
            ResultType: 'simple',
            MaxRows: 1,
        }, system);
        if (!other.Success) throw new Error(other.ErrorMessage ?? "The type's anchors could not be read.");
        const hit = other.Results?.[0];
        if (hit) return { space: hit.Space || 'another space', entity: hit.Entity || anchor.EntityID, recordId: anchor.RecordID };
    }
    return null;
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceAnchorEntityServer(): void {
    void SpaceAnchorEntityServer;
}
