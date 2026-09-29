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

/**
 * What a change to a space means to the space's own driver. A kind is what the save asked for, read before anything rewrites the
 * row: a create; a close or a reopen (`ClosedAt` set or cleared); a move (the parent changed); else an update. A close or a reopen
 * that also moves the space is refused, so no save is two of these.
 */
export type SpaceChangeKind = 'Create' | 'Update' | 'Move' | 'Close' | 'Reopen' | 'Delete';

export interface SpaceChangeContext extends DriverBaseContext {
    kind: SpaceChangeKind;
    oldValues?: Record<string, unknown>;
}

/**
 * What a change to a sub-space means to its parent's driver. A `MoveChildIn` and a `MoveChildOut` are one save seen from the two
 * parents: the one it joins hears the first, the one it leaves the second. A `ReopenChild` is a closed sub-space becoming open
 * again. A save that closes and moves a space at once is refused, so no save is both.
 *
 * A rule on which sub-spaces may sit under a space has to judge every kind that leaves a sub-space open under it: `CreateChild`,
 * `MoveChildIn` and `ReopenChild`, and `UpdateChild` for a retype or a rename. Judging only `CreateChild` lets a move or a reopen
 * walk around the rule.
 */
export type ChildSpaceChangeKind = 'CreateChild' | 'UpdateChild' | 'ReopenChild' | 'MoveChildIn' | 'MoveChildOut' | 'CloseChild' | 'DeleteChild';

export interface ChildSpaceChangeContext extends DriverBaseContext {
    childSpace: mjBizAppsCollaborationSpaceEntity;
    kind: ChildSpaceChangeKind;
    /** What the child's changed fields held before this save. Empty for a create. */
    oldValues?: Record<string, unknown>;
}

/**
 * What a change to a seat means to the driver, from what the save asked for. A new seat is an `Invite`, or a `Remove` when it is
 * made Removed. A saved seat whose status becomes Active or Invited is an `Invite` too: an approval, a reinstatement or a re-invitation is the seat coming
 * into being, not a route the driver hears. Otherwise a status made Removed is a `Remove`, and a role or a band edit is a `RoleChange`
 * or a `BandChange`. The kind is what was asked for: a band the gate puts back still reaches the driver as a `BandChange`. A save
 * that touches none of status, role and band raises no seat reaction.
 *
 * A rule on who may hold a seat has to judge every kind that leaves someone holding it: `Invite`, `RoleChange` and `BandChange`
 * (and not only `Invite`). Judging only an invitation lets a role change walk around the rule.
 */
export type MemberChangeKind = 'Invite' | 'RoleChange' | 'BandChange' | 'Remove';

export interface MemberChangeContext extends DriverBaseContext {
    member: mjBizAppsCollaborationSpaceMemberEntity;
    kind: MemberChangeKind;
    oldValues?: Record<string, unknown>;
}

/**
 * What a change to an item means to the driver: a new item is `Add`; a different space is `Move`; a band that became Shared is
 * `Promote`; any other change (a rename, a note) is `Update`. `Remove` is a delete.
 */
export type ItemChangeKind = 'Add' | 'Update' | 'Promote' | 'Move' | 'Remove';

export interface ItemChangeContext extends DriverBaseContext {
    item: mjBizAppsCollaborationSpaceItemEntity;
    kind: ItemChangeKind;
    oldValues?: Record<string, unknown>;
}

export interface ChatChangeContext extends DriverBaseContext {
    chatName: string;
    chatKind: 'General' | 'Topic' | 'Private';
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

    /**
     * Validate a change to the space itself.
     *
     * A change to only the columns of the space's subtype (a board's term, a deal's stage) is judged here too, as kind `Update`.
     * What the context holds then depends on how the subtype was saved. Saved through a space that was loaded (a server-side save),
     * `oldValues` names the subtype's changed columns and `subtypeEntityName` names the subtype. Saved from a client over the wire,
     * MJ builds the subtype from its own side, and its parent, this space, has no link back to it: `oldValues` is empty and the new
     * values aren't in reach, so a rule about a subtype column can't be enforced from here (MemberJunction/MJ#4870). Put such a rule
     * in the subtype entity's own server class until then.
     */
    public ValidateSpaceChange(
        _ctx: SpaceChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /**
     * React to a change to the space. It runs after the space's own save returns, and a failure is logged and the save stands. It
     * does not run after a commit when the save is part of a larger transaction: a space saved through its subtype (MJ's IsA save
     * wraps both rows) and `CreateSpace` run it inside that transaction, and for a change to only the subtype's columns before the
     * subtype's own row is written. Outside work (email, HTTP) belongs in `provider.RunAfterCommit`, which runs once the whole
     * transaction has committed. A change to only the subtype's columns is told here alone, not to the parent's driver, with the
     * same context as `ValidateSpaceChange` gave (over the wire, no old values).
     */
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
            errors: ['SyncSeats is not built yet: no roster sync exists for a type today.'],
        };
    }
}
