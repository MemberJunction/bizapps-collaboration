/**
 * ExampleBoardServerDriver
 * Reference implementation of a server driver for board and committee spaces.
 * Extensibility plan § 5, § 10.3.
 */

import { RegisterClass } from '@memberjunction/global';
import {
    BaseSpaceTypeServerDriver,
    type DriverValidationResult,
    type SpaceChangeContext,
    type ChildSpaceChangeContext,
    type MemberChangeContext,
    type ItemChangeContext,
    type TaskFiledContext,
    type AgentContextParams,
    type AgentContextResult,
    type PersonSeatInput,
    type SyncSeatsResult,
    type DriverBaseContext,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { type EffectiveSpaceRules } from '@mj-biz-apps/collaboration-core';
import { type mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { CollaborationEngine } from '@mj-biz-apps/collaboration-core-entities-server';
import { readExtension, stringList } from '../extension-config.js';

const KEY = 'example-board';

@RegisterClass(BaseSpaceTypeServerDriver, 'example-board')
export class ExampleBoardServerDriver extends BaseSpaceTypeServerDriver {
    /**
     * Narrows the rules for board spaces: only contributors start a conversation, where the rules would let anyone. A driver
     * narrows; it never widens what the type or the app set.
     */
    public override AdjustRules(
        _ctx: DriverBaseContext,
        rules: EffectiveSpaceRules
    ): EffectiveSpaceRules {
        return {
            ...rules,
            Chats: {
                ...rules.Chats,
                WhoCanStart: rules.Chats?.WhoCanStart === 'Anyone' ? 'Contributors' : rules.Chats?.WhoCanStart,
            },
        };
    }

    /**
     * Validates changes to the board space:
     * - Cannot delete an active board (must be closed first)
     */
    public override ValidateSpaceChange(
        ctx: SpaceChangeContext
    ): DriverValidationResult {
        // A board with motions open (the count comes from the space's own configuration, kept by whatever runs the votes) stays open
        if (ctx.kind === 'Close' && Number(readExtension(ctx.space.Configuration, KEY)['OpenMotions'] ?? 0) > 0) {
            return { ok: false, message: 'Cannot close a Board space while motions are open for voting.' };
        }
        if (ctx.kind === 'Delete') {
            const isClosed = ctx.space.ClosedAt != null;
            if (!isClosed) {
                return {
                    ok: false,
                    message: 'Cannot delete an active Board space. Close it first.',
                };
            }
        }
        return { ok: true };
    }

    public override OnSpaceChanged(_ctx: SpaceChangeContext): void {
        // Board lifecycle hook reaction inside transaction
    }

    /**
     * Validates child spaces under the board:
     * - A room can't sit under a board (by the child's type code).
     * - Sub-committees the type names as sealed (`Extensions.example-board.SealedChildNames`) must not inherit membership.
     */
    public override ValidateChildSpaceChange(
        ctx: ChildSpaceChangeContext
    ): DriverValidationResult {
        // Every kind that leaves a child open under the board: a created, moved-in, changed or reopened sub-committee
        if (ctx.kind !== 'CreateChild' && ctx.kind !== 'MoveChildIn' && ctx.kind !== 'UpdateChild' && ctx.kind !== 'ReopenChild') return { ok: true };
        const childTypeCode = CollaborationEngine.Instance.SpaceTypeById(ctx.childSpace.SpaceTypeID)?.Code;
        if (childTypeCode === 'example-room') {
            return { ok: false, message: 'Boards cannot contain Deal Rooms.', field: 'ParentID' };
        }
        const sealedNames = stringList(readExtension(ctx.spaceType.Configuration, KEY)['SealedChildNames'], 'SealedChildNames');
        const childName = (ctx.childSpace.Name ?? '').toLowerCase();
        if (ctx.childSpace.InheritsMembership && sealedNames.some((name) => childName.includes(name))) {
            return {
                ok: false,
                message: 'Sealed sub-committees (for example Compensation) must not inherit membership.',
                field: 'InheritsMembership',
            };
        }
        return { ok: true };
    }

    public override OnChildSpaceChanged(_ctx: ChildSpaceChangeContext): void {
        // Child space change reaction
    }

    /**
     * Validates board membership changes: a board may seat only so many outside directors. The most is the type's
     * `Extensions.example-board.MaxOutsideDirectors`; with none set there is no cap. An outside seat is one on the Shared band, which
     * the seat gate sets from the role before it asks this driver, so the rule sees the band the seat will have.
     */
    public override async ValidateMemberChange(
        ctx: MemberChangeContext
    ): Promise<DriverValidationResult> {
        if (ctx.kind !== 'Invite' || ctx.member.Band !== 'Shared') return { ok: true };
        const cap = readExtension(ctx.spaceType.Configuration, KEY)['MaxOutsideDirectors'];
        if (cap === undefined) return { ok: true };
        if (typeof cap !== 'number' || !Number.isInteger(cap) || cap < 0) {
            const message = `The extension setting MaxOutsideDirectors of "${KEY}" must be a whole number, not ${JSON.stringify(cap)}.`;
            LogError(message);
            throw new Error(message);
        }
        const seated = await this.CountOutsideDirectors(ctx);
        if (seated >= cap) {
            return {
                ok: false,
                message: `This board already has ${seated} outside director${seated === 1 ? '' : 's'}, the most its type allows (${cap}).`,
                field: 'SpaceRoleTypeID',
            };
        }
        return { ok: true };
    }

    /** The seats on the Shared band of this board that are not removed, other than the one being saved. */
    protected async CountOutsideDirectors(ctx: MemberChangeContext): Promise<number> {
        const own = ctx.member.ID ? ` AND ID <> '${ctx.member.ID}'` : '';
        const result = await RunView.FromMetadataProvider(ctx.provider as IMetadataProvider).RunView<{ ID: string }>({
            EntityName: 'MJ_BizApps_Collaboration: Space Members',
            ExtraFilter: `SpaceID = '${ctx.space.ID}' AND Band = 'Shared' AND Status <> 'Removed'${own}`,
            Fields: ['ID'],
            ResultType: 'simple',
        }, ctx.actingUser);
        if (!result.Success) throw new Error(`The outside directors could not be counted: ${result.ErrorMessage ?? 'unknown error'}`);
        return result.Results?.length ?? 0;
    }

    public override OnMemberChanged(_ctx: MemberChangeContext): void {
        // Member change reaction
    }

    /**
     * Validates item additions or promotions in the board space.
     */
    public override ValidateItemChange(
        _ctx: ItemChangeContext
    ): DriverValidationResult {
        return { ok: true };
    }

    public override OnItemChanged(_ctx: ItemChangeContext): void {
        // Item change reaction
    }

    public override OnTaskFiled(_ctx: TaskFiledContext): void {
        // Governance task notification hook
    }

    /**
     * Injects board-specific governance context into agent runs:
     * - Current term, quorum threshold, and meeting dates
     */
    public override BuildAgentContext(
        _ctx: AgentContextParams
    ): AgentContextResult {
        return {
            instructions: [
                'This space is an Audit Committee / Board space governed by formal committee rules of order.',
                'Current term: FY2026. Next meeting: Q3 Audit Committee meeting on Oct 2, 4:00-5:30 PM.',
                'Quorum requirement: 50% of voting members.',
            ],
            contextData: {
                term: 'FY2026',
                quorumPercent: 50,
                nextMeeting: '2026-10-02T16:00:00Z',
                cadence: 'Meets quarterly',
            },
        };
    }

    /**
     * Syncs board seats from an external roster (Committees memberships).
     */
    public override async SyncSeats(
        space: mjBizAppsCollaborationSpaceEntity,
        source: string,
        people: PersonSeatInput[],
        actingUser: UserInfo,
        provider: IMetadataProvider
    ): Promise<SyncSeatsResult> {
        return super.SyncSeats(space, source, people, actingUser, provider);
    }
}
