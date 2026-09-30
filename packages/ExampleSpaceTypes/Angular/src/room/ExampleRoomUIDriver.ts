/**
 * ExampleRoomUIDriver
 * Reference implementation of UI driver for deal room spaces.
 * Extensibility plan § 6, § 10.2, § 10.3.
 */

import { RegisterClass } from '@memberjunction/global';
import {
    BaseSpaceTypeUIDriver,
    overlayDescriptors,
    type SpaceUIContext,
    type SpaceOverviewCardDescriptor,
    type BeforeInviteEvent,
    type BeforePostMessageEvent,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { ExampleRoomDealSummaryCard } from './ExampleRoomDealSummaryCard.js';

@RegisterClass(BaseSpaceTypeUIDriver, 'example-room')
export class ExampleRoomUIDriver extends BaseSpaceTypeUIDriver {
    /**
     * Contributes the Deal Summary card onto the overview.
     */
    public override GetOverviewCards(
        _ctx: SpaceUIContext,
        defaultCards: SpaceOverviewCardDescriptor[]
    ): SpaceOverviewCardDescriptor[] {
        // The card is also registered as a contribution for this type, so it may already be among the defaults: it replaces
        // itself by key, and never draws twice
        return overlayDescriptors(defaultCards, [
            {
                key: 'deal-summary',
                title: 'Deal Overview',
                sortKey: 15,
                side: 'Shared',
                component: ExampleRoomDealSummaryCard,
            },
        ]);
    }

    /**
     * Vets invitations into the deal room:
     * - Refuses invitees with opt-out / blocklisted addresses
     */
    public override BeforeInvite(
        event: BeforeInviteEvent
    ): void {
        const email = (event.email ?? '').toLowerCase();
        if (email.includes('optout') || email.includes('donotcontact')) {
            event.cancel = true;
            event.cancelReason = 'This contact has opted out of communications.';
        }
    }

    /**
     * Client-side message validation. The phrases are literals here because a browser hook sees only the event, not the type's
     * configuration; they mirror the type's `BlockedPhrases`, which the server driver reads and enforces. The server is the authority.
     *
     * - Warns if confidential pricing floor text is being submitted
     */
    public override BeforePostMessage(
        event: BeforePostMessageEvent
    ): void {
        const text = (event.messageText ?? '').toLowerCase();
        if (text.includes('internal margin target') || text.includes('confidential deal floor')) {
            event.cancel = true;
            event.cancelReason = 'Cannot post confidential margin or pricing floor terms in Deal Room chat.';
        }
    }
}
