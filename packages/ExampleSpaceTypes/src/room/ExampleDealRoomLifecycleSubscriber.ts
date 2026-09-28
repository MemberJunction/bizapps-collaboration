/**
 * ExampleDealRoomLifecycleSubscriber
 * Reference implementation of a space lifecycle subscriber for deal rooms.
 * Extensibility plan § 5, § 10.3, § 12.
 */

import { RegisterClass } from '@memberjunction/global';
import {
    BaseSpaceLifecycleSubscriber,
    type SpaceLifecyclePayload,
} from '@mj-biz-apps/collaboration-core-entities-server';

export interface DealRoomLifecycleRecord {
    event: string;
    spaceId: string;
    timestamp: Date;
    data?: Record<string, unknown>;
}

@RegisterClass(BaseSpaceLifecycleSubscriber, 'example-deal-room-lifecycle')
export class ExampleDealRoomLifecycleSubscriber extends BaseSpaceLifecycleSubscriber {
    private static _receivedEvents: DealRoomLifecycleRecord[] = [];

    public static get ReceivedEvents(): readonly DealRoomLifecycleRecord[] {
        return this._receivedEvents;
    }

    public static clearEvents(): void {
        this._receivedEvents = [];
    }

    public override OnEvent(payload: SpaceLifecyclePayload): void {
        ExampleDealRoomLifecycleSubscriber._receivedEvents.push({
            event: payload.event,
            spaceId: payload.spaceId,
            timestamp: payload.timestamp,
            data: payload.data,
        });

        switch (payload.event) {
            case 'AfterSpaceClosed':
                // In production: if won, creates onboarding space/tasks; if lost, archives
                break;
            case 'AfterMemberAdded':
                // In production: notifies account exec of buyer join
                break;
            case 'AfterMemberRemoved':
                // In production: logs contact departure
                break;
            case 'AfterItemPromoted':
                // In production: logs sales collateral shared with client
                break;
        }
    }
}
