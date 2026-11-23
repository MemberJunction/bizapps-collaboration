/**
 * EnsureSpaceForRecord (CX-1):
 * Returns the space of a given type anchored to an external app's record,
 * creating it atomically on the first call with:
 *  - full IsA subtype resolution (`EnsureISAChild()` + `Details` validation),
 *  - owner seat assignment (`SpaceMember` with `owner` role on `Team` band),
 *  - sealed posture by default (`InheritsMembership = false`, honoring explicit overrides), and
 *  - deterministic distributed race-winner idempotency backed by database uniqueness
 *    (`UQ_SpaceAnchor_PrimaryPerType`) + conflict-read recovery (no in-memory mutex).
 */

import { type BaseEntity, type IMetadataProvider, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import type { SpaceDetailsMap } from '@mj-biz-apps/collaboration-core';
import {
    type mjBizAppsCollaborationSpaceAnchorEntity,
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceMemberEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { canonicalAnchorRecordId, releaseAnchorWrite, vouchAnchorWrite } from './SpaceAnchorEntityServer.js';
import { applySubtypeDetails } from './subtype-details.js';
import { asMetadata, parseUuid } from './uuid.js';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const SPACE_ANCHORS_ENTITY = 'MJ_BizApps_Collaboration: Space Anchors';
const SPACE_ROLE_TYPES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';
const SPACE_TYPES_ENTITY = 'MJ_BizApps_Collaboration: Space Types';

export interface EnsureSpaceForRecordParams {
    typeCode: string;
    entityName: string;
    recordId: string;
    spaceName?: string;
    /** The anchor's role, for a type whose spaces anchor to more than one record. Default 'primary'. */
    anchorRole?: string;
    /** Whether the space inherits its parent's membership. Defaults to `false` (sealed posture). */
    inheritsMembership?: boolean;
    /** Optional subtype-specific column values when SpaceType names a subtype entity. */
    details?: SpaceDetailsMap | null;
    /** Optional parent space ID override when driver does not specify one. */
    parentSpaceId?: string | null;
    contextUser: UserInfo;
    provider: IMetadataProvider;
}

interface TransactionCapableProvider {
    BeginTransaction(): Promise<void>;
    CommitTransaction(): Promise<void>;
    RollbackTransaction(): Promise<void>;
}

function asTransactionProvider(provider: IMetadataProvider): TransactionCapableProvider | null {
    const candidate = provider as IMetadataProvider & Partial<TransactionCapableProvider>;
    if (
        typeof candidate.BeginTransaction === 'function' &&
        typeof candidate.CommitTransaction === 'function' &&
        typeof candidate.RollbackTransaction === 'function'
    ) {
        return candidate as TransactionCapableProvider;
    }
    return null;
}

async function resolveOwnerRoleId(
    rv: RunView,
    system: UserInfo,
    provider: IMetadataProvider,
): Promise<string> {
    try {
        await CollaborationEngine.Instance.EnsureLoaded(system, provider);
        const cached = CollaborationEngine.Instance.SpaceRoleTypeByCode('owner');
        if (cached?.ID) {
            return cached.ID;
        }
    } catch {
        // Fallback to direct RunView lookup below when engine cache is unpopulated
    }

    const roleResult = await rv.RunView<{ ID: string }>({
        EntityName: SPACE_ROLE_TYPES_ENTITY,
        ExtraFilter: "Code = 'owner'",
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!roleResult.Success || !roleResult.Results?.[0]?.ID) {
        throw new Error("The owner role isn't set up, so the space can't be created.");
    }
    return roleResult.Results[0].ID;
}

async function findExistingPrimaryAnchorSpaceId(
    rv: RunView,
    system: UserInfo,
    spaceTypeId: string,
    entityId: string,
    canonicalRecordId: string,
): Promise<string | null> {
    const existingResult = await rv.RunView<{ SpaceID: string }>({
        EntityName: SPACE_ANCHORS_ENTITY,
        ExtraFilter: `SpaceTypeID = '${spaceTypeId}' AND EntityID = '${entityId}' AND RecordID = '${canonicalRecordId.replace(/'/g, "''")}' AND IsPrimary = 1`,
        Fields: ['SpaceID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!existingResult.Success) {
        throw new Error(existingResult.ErrorMessage || 'Failed to query existing space anchors.');
    }
    return existingResult.Results?.[0]?.SpaceID ?? null;
}

async function loadAnchoredSpaceForCaller(
    metadata: NonNullable<ReturnType<typeof asMetadata>>,
    contextUser: UserInfo,
    spaceId: string,
): Promise<mjBizAppsCollaborationSpaceEntity> {
    const space = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACES_ENTITY, contextUser);
    if (await space.Load(spaceId)) {
        return space;
    }
    throw new Error('Anchored space already exists for this record, but the current user cannot access it.');
}

function isLikelyUniqueOrAnchorConflict(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes('uq_spaceanchor') ||
        lower.includes('already anchored') ||
        lower.includes('duplicate key') ||
        lower.includes('unique constraint') ||
        lower.includes('unique index') ||
        lower.includes('2601') ||
        lower.includes('2627') ||
        lower.includes('23505')
    );
}

export async function EnsureSpaceForRecord(
    params: EnsureSpaceForRecordParams,
): Promise<mjBizAppsCollaborationSpaceEntity> {
    const metadata = asMetadata(params.provider);
    if (!metadata) {
        throw new Error('Provider cannot create entities.');
    }

    const system = await WellKnownUserSource.Instance.GetSystemUser(params.provider);
    if (!system) {
        throw new Error('System user is not available.');
    }

    const rv = RunView.FromMetadataProvider(params.provider);

    // 1. Resolve Entity ID
    const entityResult = await rv.RunView<{ ID: string }>({
        EntityName: 'MJ: Entities',
        ExtraFilter: `Name = '${params.entityName.replace(/'/g, "''")}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (!entityResult.Success || !entityResult.Results?.[0]?.ID) {
        throw new Error(`Entity "${params.entityName}" could not be resolved.`);
    }
    const entityId = entityResult.Results[0].ID;
    const entityInfo = metadata.EntityByID(entityId);
    if (!entityInfo) {
        throw new Error(`Entity "${params.entityName}" is not in this provider's metadata.`);
    }
    const recordId = canonicalAnchorRecordId(entityInfo, params.recordId);

    // 2. Load Space Type
    const typeResult = await rv.RunView<mjBizAppsCollaborationSpaceTypeEntity>({
        EntityName: SPACE_TYPES_ENTITY,
        ExtraFilter: `Code = '${params.typeCode.replace(/'/g, "''")}'`,
        ResultType: 'entity_object',
        MaxRows: 1,
    }, system);

    if (!typeResult.Success || !typeResult.Results?.[0]) {
        throw new Error(`Space type with code "${params.typeCode}" not found.`);
    }
    const spaceType = typeResult.Results[0];

    // 3. Check if an anchored space already exists
    const existingSpaceId = await findExistingPrimaryAnchorSpaceId(rv, system, spaceType.ID, entityId, recordId);
    if (existingSpaceId) {
        return loadAnchoredSpaceForCaller(metadata, params.contextUser, existingSpaceId);
    }

    // 4. Resolve Driver, owner role, and validate anchor
    const ownerRoleId = await resolveOwnerRoleId(rv, system, params.provider);
    const driver = ServerDriverRegistry.Instance.GetDriverForType(spaceType);
    const anchorCtx = {
        actingUser: params.contextUser,
        provider: params.provider,
        spaceType,
        entityName: params.entityName,
        recordId: params.recordId,
    };

    const validation = await driver.ValidateAnchor(anchorCtx);
    if (!validation.ok) {
        throw new Error(validation.message || 'Anchor validation refused creation of space for record.');
    }

    const driverParentId = await driver.ResolveAnchorParent(anchorCtx);
    const explicitParentId = params.parentSpaceId ? parseUuid(params.parentSpaceId) : null;
    if (params.parentSpaceId && !explicitParentId) {
        throw new Error('The parent space id is not valid.');
    }
    const parentId = driverParentId ?? explicitParentId;

    // 5. Prepare subtyped space (default sealed: InheritsMembership = false)
    const newSpace = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACES_ENTITY, params.contextUser);
    newSpace.NewRecord();
    newSpace.Name = params.spaceName?.trim() || `${spaceType.Name}: ${params.recordId}`;
    newSpace.SpaceTypeID = spaceType.ID;
    newSpace.OwnerID = params.contextUser.ID;
    newSpace.ParentID = parentId;
    newSpace.InheritsMembership = params.inheritsMembership ?? false;

    const attached = typeof newSpace.EnsureISAChild === 'function' ? await newSpace.EnsureISAChild() : null;
    const expectedExtension = spaceType.SpaceExtensionEntity?.trim();
    if (expectedExtension && !attached) {
        throw new Error(`Space type "${spaceType.Name}" requires subtype "${expectedExtension}", which could not be attached.`);
    }
    const leaf: BaseEntity = attached ? newSpace.LeafEntity : newSpace;

    const detailRefusal = applySubtypeDetails(leaf, attached, spaceType.Name, params.details);
    if (detailRefusal) {
        throw new Error(detailRefusal);
    }

    // 6. Atomically save Space (via subtype leaf), Owner Seat, and Primary Anchor with conflict-read recovery
    const txProvider = asTransactionProvider(params.provider);
    let createdSeat: mjBizAppsCollaborationSpaceMemberEntity | null = null;
    let spaceSaved = false;

    if (txProvider) {
        await txProvider.BeginTransaction();
    }

    try {
        const saved = await leaf.Save();
        if (!saved) {
            throw new Error(leaf.LatestResult?.CompleteMessage || 'Failed to save new anchored space.');
        }
        spaceSaved = true;

        const ownerSeat = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
            SPACE_MEMBERS_ENTITY,
            params.contextUser,
        );
        ownerSeat.NewRecord();
        ownerSeat.SpaceID = newSpace.ID;
        ownerSeat.UserID = params.contextUser.ID;
        ownerSeat.SpaceRoleTypeID = ownerRoleId;
        ownerSeat.Band = 'Team';
        ownerSeat.Status = 'Active';
        if (!(await ownerSeat.Save())) {
            throw new Error(ownerSeat.LatestResult?.CompleteMessage || 'Failed to assign owner seat for anchored space.');
        }
        createdSeat = ownerSeat;

        const anchor = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceAnchorEntity>(
            SPACE_ANCHORS_ENTITY,
            params.contextUser,
        );
        anchor.NewRecord();
        anchor.SpaceID = newSpace.ID;
        anchor.SpaceTypeID = spaceType.ID;
        anchor.EntityID = entityId;
        anchor.RecordID = recordId;
        anchor.Role = params.anchorRole?.trim() || 'primary';
        anchor.IsPrimary = true;
        anchor.Sequence = 0;

        vouchAnchorWrite(anchor);
        let anchored = false;
        try {
            anchored = await anchor.Save();
        } finally {
            releaseAnchorWrite(anchor);
        }
        if (!anchored) {
            throw new Error(anchor.LatestResult?.CompleteMessage || 'Failed to anchor the new space to its record.');
        }

        if (txProvider) {
            await txProvider.CommitTransaction();
        }
        return newSpace;
    } catch (error) {
        if (txProvider) {
            try {
                await txProvider.RollbackTransaction();
            } catch {
                // Rollback best effort before conflict recovery
            }
        } else {
            if (createdSeat) {
                try {
                    await createdSeat.Delete();
                } catch {
                    // Compensating cleanup best effort
                }
            }
            if (spaceSaved) {
                try {
                    await newSpace.Delete();
                } catch {
                    // Compensating cleanup best effort
                }
            }
        }

        const errMessage = error instanceof Error ? error.message : String(error);
        const winnerSpaceId = await findExistingPrimaryAnchorSpaceId(rv, system, spaceType.ID, entityId, recordId);
        if (winnerSpaceId) {
            return loadAnchoredSpaceForCaller(metadata, params.contextUser, winnerSpaceId);
        }

        if (isLikelyUniqueOrAnchorConflict(errMessage)) {
            const retriedWinnerId = await findExistingPrimaryAnchorSpaceId(rv, system, spaceType.ID, entityId, recordId);
            if (retriedWinnerId) {
                return loadAnchoredSpaceForCaller(metadata, params.contextUser, retriedWinnerId);
            }
        }

        throw error instanceof Error ? error : new Error(errMessage);
    }
}
