/**
 * SpaceNoteEntityServer (B21, D33, item 146): light notes in the space. The author is the caller on create, and only the author
 * edits or deletes a note (someone who administers spaces may delete one); a caller who can't see Team can't write a Team note; a private note is its author's alone. A Team note
 * doesn't move to Shared until the plan's § 11 call 15 (Shared to Team only narrows, and is allowed). A read-only status takes
 * the notes' writes away with every other write.
 */
import { BaseEntity, LogError, ValidationErrorInfo, ValidationErrorType, type UserInfo, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { membershipReaches, NOTE_PROMOTED_AUDIT_LOG_TYPE, notePromotionVerdict, spaceIsReadOnly } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceNoteEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext, mayAdminister } from './load-graph.js';
import { failDelete } from './space-driver-call.js';
import { parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Notes';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceNoteEntityServer extends mjBizAppsCollaborationSpaceNoteEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    /** A new note's author is the caller, and a new private note sits on Team: stamped ahead of MJ's required-field check, which runs before ValidateAsync. */
    private stampDefaults(): void {
        const caller = callerUuid(this.ContextCurrentUser);
        if (!this.IsSaved && caller && !parseUuid(this.AuthorUserID)) this.AuthorUserID = caller;
        // A saved note keeps what was asked, so a private note's move to Shared is refused in ValidateAsync rather than undone in silence
        if (!this.IsSaved && this.Visibility === 'Private' && this.Band !== 'Team') this.Band = 'Team';
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        this.stampDefaults();
        this.promotionToLog = null;
        const saved = await super.Save(options);
        const promotion = this.promotionToLog;
        this.promotionToLog = null;
        // After a promotion saves, it is recorded: who moved which note to Shared, in which space
        if (saved && promotion) await this.logPromotion(promotion);
        return saved;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        this.stampDefaults();
        const caller = callerUuid(this.ContextCurrentUser);
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user || !caller) return fail(result, 'AuthorUserID', 'Note change refused: there is no signed-in user.');
        const spaceId = parseUuid(this.SpaceID);
        if (!spaceId) return fail(result, 'SpaceID', 'Note change refused: the space id is not valid.');
        if (!(this.Title ?? '').trim()) return fail(result, 'Title', 'Note change refused: a note needs a title.');

        const author = parseUuid(this.AuthorUserID);
        // A promotion (call 15): the band moves from Team to Shared and nothing else changes; the owner or a promoting seat does it
        const bandField = this.Fields.find((f) => f.Name === 'Band');
        const promoting = this.IsSaved && !!bandField?.Dirty && bandField.OldValue === 'Team' && this.Band === 'Shared';
        if (!this.IsSaved) {
            if (author && author !== caller) return fail(result, 'AuthorUserID', 'Note change refused: a note is written as its author, the signed-in user.');
            if (!author) this.AuthorUserID = caller;
        } else {
            const savedAuthor = parseUuid(String(this.Fields.find((f) => f.Name === 'AuthorUserID')?.OldValue ?? this.AuthorUserID ?? ''));
            if (author !== savedAuthor) return fail(result, 'AuthorUserID', "Note change refused: a note's author does not change.");
            if (this.Fields.some((f) => f.Name === 'SpaceID' && f.Dirty)) return fail(result, 'SpaceID', 'Note change refused: a note stays in its space.');
            if (savedAuthor !== caller && !promoting) return fail(result, 'AuthorUserID', 'Note change refused: only the author edits a note.');
            if (promoting && this.Fields.some((f) => f.Dirty && f.Name !== 'Band')) {
                return fail(result, 'Band', 'Note change refused: a promotion moves the note to Shared and changes nothing else.');
            }
            if (bandField?.Dirty && bandField.OldValue === 'Shared' && this.Band === 'Team') {
                return fail(result, 'Band', 'Note change refused: a Shared note is not taken back to Team; members may have read it.');
            }
        }

        let context: Awaited<ReturnType<typeof loadWriteContext>>;
        try {
            context = await loadWriteContext(this, user, spaceId, null);
        } catch (error) {
            return fail(result, 'SpaceID', error instanceof Error ? error.message : 'Note change refused: the space could not be read.');
        }
        if (this.Visibility === 'Private' && this.Band !== 'Team') {
            return fail(result, 'Band', promoting ? 'Note change refused: a private note is not promoted. Make it a space note first.' : 'Note change refused: a private note sits on Team.');
        }
        const administers = mayAdminister(this, user);
        const reach = membershipReaches(context.spaces, context.memberships, caller, spaceId);
        if (!reach && !(promoting && administers)) return fail(result, 'SpaceID', 'Note change refused: the signer does not reach this space.');
        const space = context.spaces.find((node) => node.id.toLowerCase() === spaceId.toLowerCase());
        if (space && spaceIsReadOnly(space)) return fail(result, 'SpaceID', 'Note change refused: the space is read-only in its current status.');
        if (promoting) {
            const oldVisibility = String(this.Fields.find((f) => f.Name === 'Visibility')?.OldValue ?? this.Visibility);
            const verdict = notePromotionVerdict(
                { userId: caller, isSpaceOwner: !!space && space.ownerId.toLowerCase() === caller.toLowerCase(), role: reach?.role ?? null, administers },
                { Band: 'Team', Visibility: oldVisibility === 'Private' ? 'Private' : 'Space', AuthorUserID: this.AuthorUserID },
            );
            if (!verdict.ok) return fail(result, 'Band', `Note change refused: ${verdict.message}`);
            this.promotionToLog = { spaceId, by: user };
            return result;
        }
        if (this.Band === 'Team' && !reach!.role.canSeeTeamBand) return fail(result, 'Band', "Note change refused: a seat that can't see Team can't write a Team note.");
        return result;
    }

    /** Set by ValidateAsync for a promotion; the save writes the audit row once the band change is committed. */
    private promotionToLog: { spaceId: string; by: UserInfo } | null = null;

    private async logPromotion(promotion: { spaceId: string; by: UserInfo }): Promise<void> {
        type AuditWriter = { CreateAuditLogRecord?: (user: UserInfo, authorizationName: string | null, auditLogTypeName: string, status: string, details: string | null, entityId: string, recordId: string, description: string, options: unknown) => Promise<unknown> };
        const writer = this.ProviderToUse as unknown as AuditWriter;
        if (typeof writer.CreateAuditLogRecord !== 'function') {
            LogError(`Note ${this.ID} was promoted to Shared but the provider cannot write the audit log.`);
            return;
        }
        try {
            const details = JSON.stringify({ noteId: this.ID, spaceId: promotion.spaceId, userId: promotion.by.ID, authorUserId: this.AuthorUserID, title: this.Title, from: 'Team', to: 'Shared' });
            const row = await writer.CreateAuditLogRecord(promotion.by, null, NOTE_PROMOTED_AUDIT_LOG_TYPE, 'Success', details, this.EntityInfo.ID, this.ID, `Note "${this.Title}" promoted to Shared in space ${promotion.spaceId}`, null);
            if (!row) LogError(`Note ${this.ID} was promoted to Shared but the audit row was not written (audit log type "${NOTE_PROMOTED_AUDIT_LOG_TYPE}" missing?).`);
        } catch (error) {
            LogError(`Note ${this.ID} was promoted to Shared but the audit row failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const caller = callerUuid(this.ContextCurrentUser);
        if (!caller) return failDelete(this, 'Note delete refused: there is no signed-in user.');
        // The author removes their note; so may someone who administers spaces (a host clearing a space, the harness's cleanup)
        if (parseUuid(this.AuthorUserID) !== caller && !mayAdminister(this, this.ContextCurrentUser)) {
            return failDelete(this, 'Note delete refused: only the author deletes a note.');
        }
        return super.Delete(options);
    }
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceNoteEntityServer(): void {
    void SpaceNoteEntityServer;
}
