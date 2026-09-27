/**
 * EnsureSpaceForRecord
 * Returns the space of a given type anchored to an external app's record,
 * creating it on the first call. Safe to call multiple times.
 * Follows extensibility plan § 5.
 */

import { type IMetadataProvider, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import {
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { asMetadata } from './uuid.js';

export interface EnsureSpaceForRecordParams {
    typeCode: string;
    entityName: string;
    recordId: string;
    spaceName?: string;
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

    // 2. Check if anchored space already exists
    const existingResult = await rv.RunView<{ ID: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Spaces',
        ExtraFilter: `AnchorEntityID = '${entityId}' AND AnchorRecordID = '${params.recordId.replace(/'/g, "''")}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (existingResult.Success && existingResult.Results?.[0]?.ID) {
        const space = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(
            'MJ_BizApps_Collaboration: Spaces',
            params.contextUser
        );
        if (await space.Load(existingResult.Results[0].ID)) {
            return space;
        }
    }

    // 3. Load Space Type
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

    // 5. Create Space
    const newSpace = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(
        'MJ_BizApps_Collaboration: Spaces',
        params.contextUser
    );
    newSpace.NewRecord();
    newSpace.Name = params.spaceName || `${spaceType.Name}: ${params.recordId}`;
    newSpace.SpaceTypeID = spaceType.ID;
    newSpace.OwnerID = params.contextUser.ID;
    newSpace.ParentID = parentId;
    newSpace.AnchorEntityID = entityId;
    newSpace.AnchorRecordID = params.recordId;
    newSpace.InheritsMembership = spaceType.DefaultInheritsMembership ?? true;
    newSpace.PostCloseAccess = spaceType.PostCloseAccess ?? 'None';
    newSpace.PostCloseAccessDays = spaceType.PostCloseAccessDays ?? null;

    const saved = await newSpace.Save();
    if (!saved) {
        throw new Error(
            newSpace.LatestResult?.CompleteMessage || 'Failed to save new anchored space.'
        );
    }

    return newSpace;
}
