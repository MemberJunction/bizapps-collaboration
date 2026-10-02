/**
 * EnsureSpaceForRecord
 * Returns the space of a given type anchored to an external app's record,
 * creating it on the first call. Safe to call multiple times.
 * Follows extensibility plan § 5. Stage 1: the anchor is a `Space Anchors` row (B14, D26), the space's primary one; the
 * space is found by it (one primary anchor per type for a record), and created with it in one go.
 */

import { type IMetadataProvider, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import {
    type mjBizAppsCollaborationSpaceAnchorEntity,
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { canonicalAnchorRecordId, releaseAnchorWrite, vouchAnchorWrite } from './SpaceAnchorEntityServer.js';
import { asMetadata } from './uuid.js';

export interface EnsureSpaceForRecordParams {
    typeCode: string;
    entityName: string;
    recordId: string;
    spaceName?: string;
    /** The anchor's role, for a type whose spaces anchor to more than one record. Default 'primary'. */
    anchorRole?: string;
    /** Whether the space inherits its parent's membership (D22: the creator chooses). Default true. */
    inheritsMembership?: boolean;
    contextUser: UserInfo;
    provider: IMetadataProvider;
}

export async function EnsureSpaceForRecord(
    params: EnsureSpaceForRecordParams
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
    if (!entityInfo) throw new Error(`Entity "${params.entityName}" is not in this provider's metadata.`);
    // The anchor's record id in the one spelling the anchors use, so the lookup and the row agree
    const recordId = canonicalAnchorRecordId(entityInfo, params.recordId);

    // 2. Load Space Type: the anchor is looked up within the type, since one record may anchor a space of each type
    const typeResult = await rv.RunView<mjBizAppsCollaborationSpaceTypeEntity>({
        EntityName: 'MJ_BizApps_Collaboration: Space Types',
        ExtraFilter: `Code = '${params.typeCode.replace(/'/g, "''")}'`,
        ResultType: 'entity_object',
        MaxRows: 1,
    }, system);

    if (!typeResult.Success || !typeResult.Results?.[0]) {
        throw new Error(`Space type with code "${params.typeCode}" not found.`);
    }
    const spaceType = typeResult.Results[0];

    // 3. Check if an anchored space already exists: the primary anchor of a space of this type on this record
    const existingResult = await rv.RunView<{ SpaceID: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Anchors',
        ExtraFilter: `SpaceTypeID = '${spaceType.ID}' AND EntityID = '${entityId}' AND RecordID = '${recordId.replace(/'/g, "''")}' AND IsPrimary = 1`,
        Fields: ['SpaceID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (existingResult.Success && existingResult.Results?.[0]?.SpaceID) {
        const space = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(
            'MJ_BizApps_Collaboration: Spaces',
            params.contextUser
        );
        if (await space.Load(existingResult.Results[0].SpaceID)) {
            return space;
        }
    }

    // 4. Resolve Driver and validate anchor
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

    const parentId = await driver.ResolveAnchorParent(anchorCtx);

    // 5. Create Space, then its primary anchor. The anchor's own gate asks for Configure Spaces; this path is the type's driver's,
    // so the row is vouched for in process (as an upload vouches for its file), and the two writes go together or not at all.
    const newSpace = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(
        'MJ_BizApps_Collaboration: Spaces',
        params.contextUser
    );
    newSpace.NewRecord();
    newSpace.Name = params.spaceName || `${spaceType.Name}: ${params.recordId}`;
    newSpace.SpaceTypeID = spaceType.ID;
    newSpace.OwnerID = params.contextUser.ID;
    newSpace.ParentID = parentId;
    newSpace.InheritsMembership = params.inheritsMembership ?? true;

    const saved = await newSpace.Save();
    if (!saved) {
        throw new Error(
            newSpace.LatestResult?.CompleteMessage || 'Failed to save new anchored space.'
        );
    }

    const anchor = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceAnchorEntity>('MJ_BizApps_Collaboration: Space Anchors', params.contextUser);
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
        const message = anchor.LatestResult?.CompleteMessage || 'Failed to anchor the new space to its record.';
        // The space without its anchor would be found by nobody: take it back out
        await newSpace.Delete();
        throw new Error(message);
    }

    return newSpace;
}
