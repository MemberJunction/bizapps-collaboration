/**
 * ExampleDealRoomSignalProvider
 * Reference implementation of a space signal provider for deal rooms.
 * Extensibility plan § 5, § 10.3, § 12.
 */

import { RegisterClass } from '@memberjunction/global';
import {
    BaseSpaceSignalProvider,
    type SpaceSignalObservation,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { type mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { type IMetadataProvider, type UserInfo } from '@memberjunction/core';

@RegisterClass(BaseSpaceSignalProvider, 'example-deal-room-signals')
export class ExampleDealRoomSignalProvider extends BaseSpaceSignalProvider {
    public override async GetSignals(
        space: mjBizAppsCollaborationSpaceEntity,
        _contextUser: UserInfo,
        _provider: IMetadataProvider
    ): Promise<SpaceSignalObservation[]> {
        const now = new Date();
        const spaceName = space.Name ?? 'Account';

        return [
            {
                title: `Quarterly 10-Q filing published for ${spaceName}`,
                description: 'SEC filing shows 18% YoY growth and positive operating cash flow.',
                source: 'SEC Edgar Feed',
                observedAt: now,
                metadata: {
                    spaceId: space.ID,
                    category: 'Public Filing',
                },
            },
            {
                title: `Deal stage advanced to Proposal Review`,
                description: 'Buyer champion confirmed receipt of final commercial terms.',
                source: 'Sales Engine',
                observedAt: now,
                metadata: {
                    spaceId: space.ID,
                    stage: 'Proposal Review',
                },
            },
        ];
    }
}
