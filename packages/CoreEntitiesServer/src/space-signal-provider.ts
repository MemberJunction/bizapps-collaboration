/**
 * SpaceSignalProvider
 * Follows extensibility plan § 5.
 */

import { type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { type mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';

export interface SpaceSignalObservation {
    title: string;
    description?: string;
    source: string;
    observedAt: Date;
    metadata?: Record<string, unknown>;
}

export abstract class BaseSpaceSignalProvider {
    /**
     * Produces dated observations about a space.
     * The Collaboration engine stores returned observations as Team-band items.
     */
    public abstract GetSignals(
        space: mjBizAppsCollaborationSpaceEntity,
        contextUser: UserInfo,
        provider: IMetadataProvider
    ): Promise<SpaceSignalObservation[]>;
}
