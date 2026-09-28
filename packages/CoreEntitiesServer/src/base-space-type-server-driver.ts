/**
 * BaseSpaceTypeServerDriver
 * Extensibility plan § 5.
 */

import { type IEntityDataProvider, type IMetadataProvider, LogError, type UserInfo } from '@memberjunction/core';
import { type EffectiveSpaceRules } from '@mj-biz-apps/collaboration-core';
import {
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceItemEntity,
    type mjBizAppsCollaborationSpaceMemberEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import { requireSystemUser } from './load-graph.js';
import { asMetadata } from './uuid.js';

export interface DriverValidationResult {
    ok: boolean;
    message?: string;
    field?: string;
}

export interface DriverBaseContext {
    actingUser: UserInfo;
    provider: IMetadataProvider | IEntityDataProvider;
    space: mjBizAppsCollaborationSpaceEntity;
    spaceType: mjBizAppsCollaborationSpaceTypeEntity;
    effectiveRules: EffectiveSpaceRules;
    subtypeEntityName?: string | null;
}

export type SpaceChangeKind = 'Create' | 'Update' | 'Move' | 'Close' | 'Reopen' | 'Delete';

export interface SpaceChangeContext extends DriverBaseContext {
    kind: SpaceChangeKind;
    oldValues?: Record<string, unknown>;
}

export interface ChildSpaceChangeContext extends DriverBaseContext {
    childSpace: mjBizAppsCollaborationSpaceEntity;
    kind: 'CreateChild' | 'MoveChildIn' | 'MoveChildOut' | 'CloseChild' | 'DeleteChild';
}

export type MemberChangeKind = 'Invite' | 'RoleChange' | 'BandChange' | 'Remove';

export interface MemberChangeContext extends DriverBaseContext {
    member: mjBizAppsCollaborationSpaceMemberEntity;
    kind: MemberChangeKind;
    oldValues?: Record<string, unknown>;
}

export type ItemChangeKind = 'Add' | 'Promote' | 'Move' | 'Remove';

export interface ItemChangeContext extends DriverBaseContext {
    item: mjBizAppsCollaborationSpaceItemEntity;
    kind: ItemChangeKind;
    oldValues?: Record<string, unknown>;
}

export interface ChatChangeContext extends DriverBaseContext {
    chatName: string;
    chatKind: 'General' | 'Private' | 'Room' | 'Topic';
    isNew: boolean;
}

export interface MessageValidationContext extends DriverBaseContext {
    chatId: string;
    messageText: string;
}

export interface MessageContext extends DriverBaseContext {
    chatId: string;
    messageId: string;
    messageText: string;
}

export interface AgentContextParams extends DriverBaseContext {
    chatId: string;
    viewerBands: Record<string, 'Team' | 'Shared'>;
}

export interface AgentContextResult {
    instructions?: string[];
    contextData?: Record<string, unknown>;
}

export interface TaskFiledContext extends DriverBaseContext {
    taskId: string;
    taskTitle: string;
    band: 'Team' | 'Shared';
}

export interface AnchorContext {
    actingUser: UserInfo;
    provider: IMetadataProvider;
    spaceType: mjBizAppsCollaborationSpaceTypeEntity;
    entityName: string;
    recordId: string;
}

export interface PersonSeatInput {
    PersonID?: string | null;
    UserID?: string | null;
    Email?: string | null;
    RoleTypeName: string;
}

export interface SyncSeatsResult {
    added: number;
    updated: number;
    removed: number;
    invited: number;
    errors: string[];
}

export class BaseSpaceTypeServerDriver {
    /** Adjust or narrow the effective space rules. */
    public AdjustRules(
        _ctx: DriverBaseContext,
        rules: EffectiveSpaceRules
    ): Promise<EffectiveSpaceRules> | EffectiveSpaceRules {
        return rules;
    }

    /** Validate a change to the space itself. */
    public ValidateSpaceChange(
        _ctx: SpaceChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to a change to the space (runs inside the save transaction). */
    public OnSpaceChanged(_ctx: SpaceChangeContext): Promise<void> | void {}

    /** Validate a child space under this space (runs on parent's type driver). */
    public ValidateChildSpaceChange(
        _ctx: ChildSpaceChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to a child space change (runs on parent's type driver). */
    public OnChildSpaceChanged(_ctx: ChildSpaceChangeContext): Promise<void> | void {}

    /** Validate a member change. */
    public ValidateMemberChange(
        _ctx: MemberChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to a member change. */
    public OnMemberChanged(_ctx: MemberChangeContext): Promise<void> | void {}

    /** Validate an item change. */
    public ValidateItemChange(
        _ctx: ItemChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to an item change. */
    public OnItemChanged(_ctx: ItemChangeContext): Promise<void> | void {}

    /** Validate a chat creation or change. */
    public ValidateChatChange(
        _ctx: ChatChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** Validate a message before posting. */
    public ValidateMessage(
        _ctx: MessageValidationContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to a posted message. */
    public OnMessagePosted(_ctx: MessageContext): Promise<void> | void {}

    /** Build agent context for a turn. */
    public BuildAgentContext(
        _ctx: AgentContextParams
    ): Promise<AgentContextResult> | AgentContextResult {
        return { instructions: [], contextData: {} };
    }

    /** React when a task is filed in the space. */
    public OnTaskFiled(_ctx: TaskFiledContext): Promise<void> | void {}

    /** Validate whether the caller can open an anchored space for a record. */
    public ValidateAnchor(
        _ctx: AnchorContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** Resolve parent space ID for an anchored space (null for root). */
    public ResolveAnchorParent(
        _ctx: AnchorContext
    ): Promise<string | null> | string | null {
        return null;
    }

    /**
     * Helper to sync seats from an external roster (e.g. Committees membership).
     * Modifies only seats with the matching SyncSource.
     */
    public async SyncSeats(
        _space: mjBizAppsCollaborationSpaceEntity,
        _source: string,
        _people: PersonSeatInput[],
        _actingUser: UserInfo,
        _provider: IMetadataProvider
    ): Promise<SyncSeatsResult> {
        return {
            added: 0,
            updated: 0,
            removed: 0,
            invited: 0,
            errors: ['SyncSeats is not implemented in PR #7; scheduled for PR #8 external roster sync.'],
        };
    }
}
