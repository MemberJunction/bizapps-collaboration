/**
 * Server guard for `MJ_BizApps_Collaboration: Space Agent Source Receipts`.
 *
 * Prevents direct client CRUD and enforces fail-closed structural and cross-scope `(space, band)`
 * invariants on every server save.
 */

import {
    BaseEntity,
    BaseEntityResult,
    type EntityDeleteOptions,
    type EntitySaveOptions,
    LogError,
    Metadata,
    RunView,
    ValidationErrorInfo,
    ValidationErrorType,
    type ValidationResult,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    canReaderAccessSourceReceipt,
    isSourceReceiptBand,
    isSourceReceiptKind,
    isSourceReceiptRankingMode,
    membershipReaches,
    normalizeReceiptUuid,
    spaceAllowsAgentRetrieval,
    stripRecordKeyPrefix,
    type MemberSnapshot,
    type RoleFlags,
    type SourceReceiptBand,
    type SpaceNode,
} from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceAgentSourceReceiptEntity } from '@mj-biz-apps/collaboration-entities';
import {
    COLLABORATION_SOURCE_RECEIPT_ENTITY,
    evaluateParticipantSourceReceiptWriteAccess,
    getCollaborationTurnAuthorityContext,
} from './ai-run-lockdown.js';
import { toNode, type SpaceRow } from './load-graph.js';
import { asMetadata, parseUuid } from './uuid.js';

const CONVERSATION_DETAILS_ENTITY = 'MJ: Conversation Details';
const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_CHATS_ENTITY = 'MJ_BizApps_Collaboration: Space Chats';
const SPACE_ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';
const SPACE_GRANTS_ENTITY = 'MJ_BizApps_Collaboration: Space Grants';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const SPACE_ROLES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';

interface SpaceChatValidationRow {
    ID: string;
    SpaceID: string;
    ConversationID: string;
    Kind: string;
    OwnerUserID?: string | null;
}

interface ConversationDetailValidationRow {
    ID: string;
    ConversationID: string;
    Role: string | null;
}

interface SpaceGrantValidationRow {
    ID: string;
    SpaceID: string | null;
    SpaceTypeID: string | null;
    Kind: string;
    Mode: string;
    Band: string;
    TargetRecordID: string;
}

interface SpaceMemberValidationRow {
    SpaceID: string;
    UserID: string;
    Status: string;
    Band: string;
    SpaceRoleTypeID: string;
}

interface SpaceRoleValidationRow {
    ID: string;
    Level: number;
    MaxGrantableLevel: number;
    CanInvite: boolean;
    CanPromoteBand: boolean;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
    CanContribute: boolean;
}

function isSpaceReachableInChatSubtree(
    spaces: readonly SpaceNode[],
    chatSpaceId: string,
    candidateSpaceId: string,
    allowEverythingScope: boolean,
): boolean {
    const index = new Map<string, SpaceNode>();
    for (const s of spaces) {
        index.set(s.id.toLowerCase(), s);
    }
    const target = index.get(candidateSpaceId.toLowerCase());
    if (!target || !spaceAllowsAgentRetrieval(target)) {
        return false;
    }

    // Verify no ancestor (including target) is ExcludedEntirely
    let cur: SpaceNode | undefined = target;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id.toLowerCase())) {
        if (cur.agentRetrieval === 'ExcludedEntirely') {
            return false;
        }
        seen.add(cur.id.toLowerCase());
        cur = cur.parentId ? index.get(cur.parentId.toLowerCase()) : undefined;
    }

    // Check if candidateSpaceId is chatSpaceId or in its non-excluded subtree
    cur = target;
    const between = new Set<string>();
    const cleanChatSpace = chatSpaceId.toLowerCase();
    while (cur && !between.has(cur.id.toLowerCase())) {
        if (cur.id.toLowerCase() === cleanChatSpace) {
            return true;
        }
        if (cur.agentRetrieval === 'ExcludedFromParentScope') {
            break;
        }
        between.add(cur.id.toLowerCase());
        cur = cur.parentId ? index.get(cur.parentId.toLowerCase()) : undefined;
    }

    return allowEverythingScope;
}

function resolveSpaceChainIdsAndType(
    spaceRows: readonly SpaceRow[],
    anchorSpaceId: string,
): { chainIds: string[]; spaceTypeIds: string[] } {
    const index = new Map<string, SpaceRow>();
    for (const s of spaceRows) {
        const cleanId = parseUuid(s.ID);
        if (cleanId) index.set(cleanId.toLowerCase(), s);
    }
    const chainIds: string[] = [];
    const spaceTypeIds: string[] = [];
    const seen = new Set<string>();
    let cur = index.get(anchorSpaceId.toLowerCase());
    while (cur) {
        const cleanCurId = parseUuid(cur.ID);
        if (!cleanCurId || seen.has(cleanCurId.toLowerCase())) break;
        seen.add(cleanCurId.toLowerCase());
        chainIds.push(cleanCurId);
        const typeId = parseUuid(cur.SpaceTypeID);
        if (typeId && !spaceTypeIds.some((t) => t.toLowerCase() === typeId.toLowerCase())) {
            spaceTypeIds.push(typeId);
        }
        const parentId = cur.ParentID ? parseUuid(cur.ParentID) : null;
        cur = parentId ? index.get(parentId.toLowerCase()) : undefined;
    }
    return { chainIds, spaceTypeIds };
}

function recordRefusal(entity: BaseEntity, action: 'save' | 'delete', message: string): false {
    const result = new BaseEntityResult();
    result.Success = false;
    result.Type = action === 'delete' ? 'delete' : entity.IsSaved ? 'update' : 'create';
    result.Message = message;
    entity.RegisterResultHistoryEntry(result);
    LogError(`SpaceAgentSourceReceiptEntityServer: ${message}`);
    return false;
}

function failValidation(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, undefined, ValidationErrorType.Failure));
    return result;
}

@RegisterClass(BaseEntity, COLLABORATION_SOURCE_RECEIPT_ENTITY)
export class SpaceAgentSourceReceiptEntityServer extends mjBizAppsCollaborationSpaceAgentSourceReceiptEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        const refusal = evaluateParticipantSourceReceiptWriteAccess('save', this.ContextCurrentUser);
        if (refusal) {
            return recordRefusal(this, 'save', refusal);
        }
        return super.Save(options);
    }

    public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
        const refusal = evaluateParticipantSourceReceiptWriteAccess('delete', this.ContextCurrentUser);
        if (refusal) {
            return recordRefusal(this, 'delete', refusal);
        }
        return super.Delete(options);
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();

        const spaceId = normalizeReceiptUuid(this.SpaceID);
        const spaceChatId = normalizeReceiptUuid(this.SpaceChatID);
        const conversationId = normalizeReceiptUuid(this.ConversationID);
        const conversationDetailId = normalizeReceiptUuid(this.ConversationDetailID);
        if (!spaceId) return failValidation(result, 'SpaceID', 'SpaceID must be a valid UUID.');
        if (!spaceChatId) return failValidation(result, 'SpaceChatID', 'SpaceChatID must be a valid UUID.');
        if (!conversationId) return failValidation(result, 'ConversationID', 'ConversationID must be a valid UUID.');
        if (!conversationDetailId) {
            return failValidation(result, 'ConversationDetailID', 'ConversationDetailID must be a valid UUID.');
        }

        if (!isSourceReceiptKind(this.SourceKind)) {
            return failValidation(result, 'SourceKind', 'SourceKind must be SpaceItem or KnowledgeSource.');
        }
        if (!isSourceReceiptBand(this.Band)) {
            return failValidation(result, 'Band', 'Band must be Shared or Team.');
        }
        if (!isSourceReceiptRankingMode(this.RankingMode)) {
            return failValidation(result, 'RankingMode', 'RankingMode must be vector, lexical, grant, or none.');
        }
        if (!this.SourceTitle || this.SourceTitle.trim().length === 0) {
            return failValidation(result, 'SourceTitle', 'SourceTitle is required.');
        }

        const spaceItemId = normalizeReceiptUuid(this.SpaceItemID);
        const contentSourceId = normalizeReceiptUuid(this.ContentSourceID);
        if (this.SourceKind === 'SpaceItem') {
            if (!spaceItemId || contentSourceId !== null || this.ContentSourceID != null) {
                return failValidation(
                    result,
                    'SpaceItemID',
                    'SpaceItem source receipts require a valid SpaceItemID and null ContentSourceID.',
                );
            }
        } else {
            if (!contentSourceId || spaceItemId !== null || this.SpaceItemID != null) {
                return failValidation(
                    result,
                    'ContentSourceID',
                    'KnowledgeSource receipts require a valid ContentSourceID and null SpaceItemID.',
                );
            }
        }

        if (this.WasCited) {
            if (this.CitationOrdinal == null || !Number.isInteger(this.CitationOrdinal) || this.CitationOrdinal < 1) {
                return failValidation(result, 'CitationOrdinal', 'CitationOrdinal must be >= 1 when WasCited is true.');
            }
        } else if (this.CitationOrdinal != null) {
            return failValidation(result, 'CitationOrdinal', 'CitationOrdinal must be null when WasCited is false.');
        }

        if (this.Sequence == null || !Number.isInteger(this.Sequence) || this.Sequence < 1) {
            return failValidation(result, 'Sequence', 'Sequence must be an integer >= 1.');
        }

        const actingUser = this.ContextCurrentUser;
        if (actingUser) {
            const rv = RunView.FromMetadataProvider(asMetadata(this.ProviderToUse) ?? Metadata.Provider);
            const [chatRes, detailRes, spacesRes] = await rv.RunViews([
                {
                    EntityName: SPACE_CHATS_ENTITY,
                    ExtraFilter: `ID = '${spaceChatId}'`,
                    Fields: ['ID', 'SpaceID', 'ConversationID', 'Kind', 'OwnerUserID'],
                    ResultType: 'simple',
                    // row-cap-ok: primary key lookup by SpaceChatID returns at most one row
                    MaxRows: 2,
                },
                {
                    EntityName: CONVERSATION_DETAILS_ENTITY,
                    ExtraFilter: `ID = '${conversationDetailId}'`,
                    Fields: ['ID', 'ConversationID', 'Role'],
                    ResultType: 'simple',
                    // row-cap-ok: primary key lookup by ConversationDetailID returns at most one row
                    MaxRows: 2,
                },
                {
                    EntityName: SPACES_ENTITY,
                    Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'AllowParentAssignees', 'ClosedAt', 'StatusID', 'SpaceTypeID'],
                    ResultType: 'simple',
                    // row-cap-ok: refuses on a full page
                    MaxRows: 2000,
                },
            ], actingUser);

            const chat = chatRes?.Success && chatRes.Results
                ? (chatRes.Results as SpaceChatValidationRow[])[0]
                : undefined;
            if (!chat) {
                return failValidation(result, 'SpaceChatID', 'SpaceChat could not be resolved for source receipt.');
            }
            if (normalizeReceiptUuid(chat.ConversationID) !== conversationId) {
                return failValidation(
                    result,
                    'ConversationID',
                    'ConversationID must match the SpaceChat conversation.',
                );
            }

            const detail = detailRes?.Success && detailRes.Results
                ? (detailRes.Results as ConversationDetailValidationRow[])[0]
                : undefined;
            if (!detail) {
                return failValidation(result, 'ConversationDetailID', 'Referenced ConversationDetail does not exist.');
            }
            if (normalizeReceiptUuid(detail.ConversationID) !== conversationId) {
                return failValidation(
                    result,
                    'ConversationDetailID',
                    'ConversationDetailID must belong to ConversationID.',
                );
            }
            const detailRole = (detail.Role ?? '').trim().toLowerCase();
            if (!detailRole || detailRole === 'user') {
                return failValidation(
                    result,
                    'ConversationDetailID',
                    'Source receipts can only be attached to assistant/agent messages, never User messages.',
                );
            }

            const receiptBand: SourceReceiptBand = this.Band === 'Team' ? 'Team' : 'Shared';
            if ((chat.Kind === 'General' || chat.Kind === 'Topic') && receiptBand === 'Team') {
                return failValidation(
                    result,
                    'Band',
                    `Shared ${chat.Kind} chats cannot record Team-band source receipts.`,
                );
            }

            if (!spacesRes?.Success || !spacesRes.Results || spacesRes.Results.length >= 2000) {
                return failValidation(
                    result,
                    'SpaceID',
                    'Space hierarchy could not be read completely to validate source receipt reach.',
                );
            }
            const spaceRows = spacesRes.Results as SpaceRow[];
            const spaceNodes = spaceRows.map(toNode);
            const chatSpaceId = normalizeReceiptUuid(chat.SpaceID);
            if (!chatSpaceId) {
                return failValidation(result, 'SpaceChatID', 'SpaceChat has an invalid SpaceID.');
            }

            // If inside an active turn authority scope with a frozen reachContext for this chat, enforce it fail-closed
            const turnAuthority = getCollaborationTurnAuthorityContext();
            if (
                turnAuthority?.reachContext &&
                (!turnAuthority.spaceChatId || normalizeReceiptUuid(turnAuthority.spaceChatId) === spaceChatId)
            ) {
                if (!canReaderAccessSourceReceipt({ spaceId, band: receiptBand }, turnAuthority.reachContext)) {
                    return failValidation(
                        result,
                        'SpaceID',
                        `Source receipt (${spaceId}, ${receiptBand}) is outside the chat turn's authorized reach.`,
                    );
                }
            }

            if (!isSpaceReachableInChatSubtree(spaceNodes, chatSpaceId, spaceId, chat.Kind === 'Assistant')) {
                return failValidation(
                    result,
                    'SpaceID',
                    'Source receipt SpaceID is outside the SpaceChat authorized retrieval reach.',
                );
            }

            // For Assistant chats (and Team receipts on Private/Assistant chats), verify member reach and CanSeeTeamBand
            const subjectUserId =
                chat.Kind === 'Assistant'
                    ? normalizeReceiptUuid(chat.OwnerUserID)
                    : (parseUuid(turnAuthority?.userId) ?? null);

            if (subjectUserId && (chat.Kind === 'Assistant' || receiptBand === 'Team')) {
                const [membersRes, rolesRes] = await rv.RunViews([
                    {
                        EntityName: SPACE_MEMBERS_ENTITY,
                        ExtraFilter: `UserID = '${subjectUserId}' AND Status = 'Active'`,
                        Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
                        ResultType: 'simple',
                        // row-cap-ok: bounded by single user's active memberships
                        MaxRows: 2000,
                    },
                    {
                        EntityName: SPACE_ROLES_ENTITY,
                        Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
                        ResultType: 'simple',
                        // row-cap-ok: bounded space role catalog
                        MaxRows: 200,
                    },
                ], actingUser);

                if (!membersRes?.Success || !rolesRes?.Success) {
                    return failValidation(result, 'SpaceID', 'Member reach could not be verified for source receipt.');
                }
                const roleMap = new Map<string, RoleFlags>();
                for (const r of (rolesRes.Results as SpaceRoleValidationRow[] ?? [])) {
                    const rid = normalizeReceiptUuid(r.ID);
                    if (!rid) continue;
                    roleMap.set(rid, {
                        level: Number(r.Level),
                        maxGrantableLevel: Number(r.MaxGrantableLevel),
                        canInvite: !!r.CanInvite,
                        canPromoteBand: !!r.CanPromoteBand,
                        canSeeTeamBand: !!r.CanSeeTeamBand,
                        isOwnerRole: !!r.IsOwnerRole,
                        canContribute: !!r.CanContribute,
                    });
                }
                const snapshots: MemberSnapshot[] = [];
                for (const m of (membersRes.Results as SpaceMemberValidationRow[] ?? [])) {
                    const roleId = normalizeReceiptUuid(m.SpaceRoleTypeID);
                    const flags = roleId ? roleMap.get(roleId) : undefined;
                    if (!flags) continue;
                    snapshots.push({
                        spaceId: m.SpaceID,
                        userId: m.UserID,
                        status: m.Status as MemberSnapshot['status'],
                        band: m.Band as SourceReceiptBand,
                        role: flags,
                    });
                }
                const userReach = membershipReaches(spaceNodes, snapshots, subjectUserId, spaceId);
                if (!userReach) {
                    return failValidation(
                        result,
                        'SpaceID',
                        'Chat principal does not reach the receipt SpaceID.',
                    );
                }
                if (receiptBand === 'Team' && !userReach.role.canSeeTeamBand) {
                    return failValidation(
                        result,
                        'Band',
                        'Chat principal lacks Team visibility on the receipt SpaceID.',
                    );
                }
            }

            if (this.SourceKind === 'SpaceItem' && spaceItemId) {
                const itemRes = await rv.RunView<{ ID: string; SpaceID: string; Band: string }>({
                    EntityName: SPACE_ITEMS_ENTITY,
                    ExtraFilter: `ID = '${spaceItemId}'`,
                    Fields: ['ID', 'SpaceID', 'Band'],
                    ResultType: 'simple',
                    // row-cap-ok: primary key lookup by SpaceItemID returns at most one row
                    MaxRows: 2,
                }, actingUser);
                const item = itemRes.Success && itemRes.Results ? itemRes.Results[0] : undefined;
                if (!item) {
                    return failValidation(result, 'SpaceItemID', 'Referenced SpaceItem does not exist in scope.');
                }
                if (normalizeReceiptUuid(item.SpaceID) !== spaceId || item.Band !== this.Band) {
                    return failValidation(
                        result,
                        'SpaceItemID',
                        'Source receipt (SpaceID, Band) does not match the referenced SpaceItem.',
                    );
                }
            } else if (this.SourceKind === 'KnowledgeSource' && contentSourceId) {
                const { chainIds, spaceTypeIds } = resolveSpaceChainIdsAndType(spaceRows, chatSpaceId);
                if (spaceId !== chatSpaceId && !chainIds.some((id) => id.toLowerCase() === spaceId)) {
                    const targetChain = resolveSpaceChainIdsAndType(spaceRows, spaceId);
                    for (const cid of targetChain.chainIds) {
                        if (!chainIds.some((id) => id.toLowerCase() === cid.toLowerCase())) chainIds.push(cid);
                    }
                    for (const tid of targetChain.spaceTypeIds) {
                        if (!spaceTypeIds.some((t) => t.toLowerCase() === tid.toLowerCase())) spaceTypeIds.push(tid);
                    }
                }
                const spaceClause = chainIds.map((id) => `'${id}'`).join(', ');
                const typeClause = spaceTypeIds.map((id) => `'${id}'`).join(', ');
                const scopeParts: string[] = [];
                if (spaceClause) scopeParts.push(`SpaceID IN (${spaceClause})`);
                if (typeClause) scopeParts.push(`SpaceTypeID IN (${typeClause})`);
                scopeParts.push('(SpaceID IS NULL AND SpaceTypeID IS NULL)');

                const grantsRes = await rv.RunView<SpaceGrantValidationRow>({
                    EntityName: SPACE_GRANTS_ENTITY,
                    ExtraFilter: `Kind = 'KnowledgeSource' AND (${scopeParts.join(' OR ')})`,
                    Fields: ['ID', 'SpaceID', 'SpaceTypeID', 'Kind', 'Mode', 'Band', 'TargetRecordID'],
                    ResultType: 'simple',
                    // row-cap-ok: bounded by KnowledgeSource grants on a single space chain
                    MaxRows: 500,
                }, actingUser);
                if (!grantsRes.Success || !grantsRes.Results) {
                    return failValidation(
                        result,
                        'ContentSourceID',
                        'KnowledgeSource grant status could not be verified.',
                    );
                }
                const matchingGrants = grantsRes.Results.filter(
                    (g) => normalizeReceiptUuid(stripRecordKeyPrefix(g.TargetRecordID)) === contentSourceId,
                );
                const hasRevoke = matchingGrants.some((g) => g.Mode === 'Revoke');
                const activeGrant = matchingGrants.find(
                    (g) =>
                        g.Mode !== 'Revoke' &&
                        (g.Band === receiptBand || (receiptBand === 'Team' && g.Band === 'Shared')),
                );
                if (hasRevoke || !activeGrant) {
                    return failValidation(
                        result,
                        'ContentSourceID',
                        'KnowledgeSource receipt requires an active enabled KnowledgeSource grant for the chat space and band.',
                    );
                }
            }
        }

        return result;
    }
}

export function LoadSpaceAgentSourceReceiptEntityServer(): void {
    void SpaceAgentSourceReceiptEntityServer;
}
