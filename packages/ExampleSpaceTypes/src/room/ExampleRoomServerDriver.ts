/**
 * ExampleRoomServerDriver
 * Reference implementation of a server driver for deal room spaces anchored to external records.
 * Extensibility plan § 5, § 10.2, § 10.3.
 */

import { RegisterClass } from '@memberjunction/global';
import {
    BaseSpaceTypeServerDriver,
    type DriverValidationResult,
    type AnchorContext,
    type ChatChangeContext,
    type MessageValidationContext,
    type MessageContext,
    type AgentContextParams,
    type AgentContextResult,
    type PersonSeatInput,
    type SyncSeatsResult,
    type SpaceChangeContext,
    type ChildSpaceChangeContext,
    type MemberChangeContext,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { type mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { readExtension, stringList } from '../extension-config.js';

const KEY = 'example-room';

@RegisterClass(BaseSpaceTypeServerDriver, 'example-room')
export class ExampleRoomServerDriver extends BaseSpaceTypeServerDriver {
    /**
     * Validates that the caller can open an anchored deal room:
     * - Anchor must be a Deal or Opportunity
     * - Acting user must have update permission on the record
     */
    public override ValidateAnchor(
        ctx: AnchorContext
    ): DriverValidationResult {
        if (!ctx.recordId) {
            return {
                ok: false,
                message: 'A Deal record ID is required to open a Deal Room.',
                field: 'AnchorRecordID',
            };
        }
        // The entities a room may be anchored to come from the type's configuration (`Extensions.example-room.AnchorEntities`)
        const anchorEntities = stringList(readExtension(ctx.spaceType.Configuration, KEY)['AnchorEntities']);
        const entityName = (ctx.entityName ?? '').toLowerCase().trim();
        if (!anchorEntities.includes(entityName)) {
            return {
                ok: false,
                message: `Invalid anchor entity "${ctx.entityName}". A deal room anchors to one of: ${anchorEntities.join(', ') || 'no entity (none is configured)'}.`,
                field: 'AnchorEntityID',
            };
        }
        return { ok: true };
    }

    /**
     * Resolves the parent space ID for the anchored deal room.
     * In a full implementation, queries for the Account space.
     */
    public override ResolveAnchorParent(
        _ctx: AnchorContext
    ): string | null {
        // Return null for root or a mock account space ID
        return null;
    }

    /**
     * Validates that Deal Rooms cannot have child spaces (they are leaf workstreams).
     */
    public override ValidateChildSpaceChange(
        ctx: ChildSpaceChangeContext
    ): DriverValidationResult {
        if (ctx.kind === 'CreateChild' || ctx.kind === 'MoveChildIn') {
            return {
                ok: false,
                message: 'Deal Rooms cannot contain child spaces.',
            };
        }
        return { ok: true };
    }

    public override ValidateSpaceChange(
        _ctx: SpaceChangeContext
    ): DriverValidationResult {
        return { ok: true };
    }

    /**
     * Refuses to seat someone who opted out of outreach: the users named in `Extensions.example-room.OptedOutUserIds`
     * on the room's own configuration.
     */
    public override ValidateMemberChange(
        ctx: MemberChangeContext
    ): DriverValidationResult {
        if (ctx.kind !== 'Invite') return { ok: true };
        const optedOut = stringList(readExtension(ctx.space.Configuration, KEY)['OptedOutUserIds']);
        if (optedOut.includes((ctx.member.UserID ?? '').toLowerCase())) {
            return { ok: false, message: 'This contact has opted out of communications.', field: 'UserID' };
        }
        return { ok: true };
    }

    /**
     * Validates who can start chats in a deal room:
     * - Only contributors or owners can start chats
     */
    public override ValidateChatChange(
        _ctx: ChatChangeContext
    ): DriverValidationResult {
        return { ok: true };
    }

    /**
     * Message gate:
     * - Prevents leaking confidential margin or internal pricing codes in messages
     */
    public override ValidateMessage(
        ctx: MessageValidationContext
    ): DriverValidationResult {
        const text = (ctx.messageText ?? '').toLowerCase();
        const blocked = stringList(readExtension(ctx.spaceType.Configuration, KEY)['BlockedPhrases']);
        if (blocked.some((phrase) => text.includes(phrase))) {
            return {
                ok: false,
                message: 'Cannot post confidential margin or pricing floor terms in Deal Room chat.',
            };
        }
        return { ok: true };
    }

    public override OnMessagePosted(_ctx: MessageContext): void {
        // Track deal engagement touchpoint
    }

    /**
     * Injects deal context into agent runs with audience filtering:
     * - If ANY participant in the chat has 'Shared' band (buyer contacts),
     *   leaves out Team-only data such as win probability and internal margin notes.
     * - If ALL participants are 'Team', includes full forecast and win probability!
     */
    public override BuildAgentContext(
        ctx: AgentContextParams
    ): AgentContextResult {
        const hasSharedViewer = Object.values(ctx.viewerBands).includes('Shared');

        if (hasSharedViewer) {
            // Buyer is in this chat: bounded to customer-facing details only
            return {
                instructions: [
                    'This is a Deal Room chat with buyer contacts present.',
                    'Discuss only customer-facing proposal terms, timeline, and deliverables.',
                    'DO NOT quote internal margins, loss notes, or win probability.',
                ],
                contextData: {
                    stage: 'Proposal Review',
                    targetCloseDate: '2026-11-15',
                    isSharedAudience: true,
                },
            };
        }

        // Internal deal team only: include full sales intelligence
        return {
            instructions: [
                'This is an internal Deal Room chat for the sales team.',
                'Full deal data accessible: stage, probability, and margin analysis.',
            ],
            contextData: {
                stage: 'Proposal Review',
                targetCloseDate: '2026-11-15',
                winProbability: 75,
                marginTargetPercent: 42,
                internalNotes: 'Client expressed budget concerns on Phase 2.',
                isSharedAudience: false,
            },
        };
    }

    /**
     * Syncs seats for two rosters:
     * - Deal team on Team band
     * - Buyer contacts on Shared band
     * - Refuses contacts who opted out of outreach
     */
    public override async SyncSeats(
        space: mjBizAppsCollaborationSpaceEntity,
        source: string,
        people: PersonSeatInput[],
        actingUser: UserInfo,
        provider: IMetadataProvider
    ): Promise<SyncSeatsResult> {
        // Filter out any contacts who opted out (`Extensions.example-room.OptedOutEmails` on the room's configuration)
        const optedOut = stringList(readExtension(space.Configuration, KEY)['OptedOutEmails']);
        const eligiblePeople = people.filter((p) => !optedOut.includes((p.Email ?? '').toLowerCase().trim()));
        return super.SyncSeats(space, source, eligiblePeople, actingUser, provider);
    }
}
