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
    isSourceReceiptBand,
    isSourceReceiptKind,
    isSourceReceiptRankingMode,
    normalizeReceiptUuid,
} from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceAgentSourceReceiptEntity } from '@mj-biz-apps/collaboration-entities';
import {
    COLLABORATION_SOURCE_RECEIPT_ENTITY,
    evaluateParticipantSourceReceiptWriteAccess,
} from './ai-run-lockdown.js';
import { asMetadata } from './uuid.js';

const SPACE_CHATS_ENTITY = 'MJ_BizApps_Collaboration: Space Chats';
const SPACE_ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';

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
            const chatRes = await rv.RunView<{ ID: string; SpaceID: string; ConversationID: string; Kind: string }>({
                EntityName: SPACE_CHATS_ENTITY,
                ExtraFilter: `ID = '${spaceChatId}'`,
                Fields: ['ID', 'SpaceID', 'ConversationID', 'Kind'],
                ResultType: 'simple',
                // row-cap-ok: primary key lookup by SpaceChatID returns at most one row
                MaxRows: 2,
            }, actingUser);
            const chat = chatRes.Success && chatRes.Results ? chatRes.Results[0] : undefined;
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
            if ((chat.Kind === 'General' || chat.Kind === 'Topic') && this.Band === 'Team') {
                return failValidation(
                    result,
                    'Band',
                    `Shared ${chat.Kind} chats cannot record Team-band source receipts.`,
                );
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
            }
        }

        return result;
    }
}

export function LoadSpaceAgentSourceReceiptEntityServer(): void {
    void SpaceAgentSourceReceiptEntityServer;
}
