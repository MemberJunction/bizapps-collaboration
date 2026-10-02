/**
 * SpaceNoteEntityServer (B21, D33, item 146): light notes in the space. The author is the caller on create, and only the author
 * edits or deletes a note; a caller who can't see Team can't write a Team note; a private note is its author's alone; a Team note
 * doesn't move to Shared until the plan's § 11 call 15 (Shared to Team only narrows, and is allowed). A read-only status takes
 * the notes' writes away with every other write.
 */
import { BaseEntity, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { membershipReaches, spaceIsReadOnly } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceNoteEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext } from './load-graph.js';
import { failDelete } from './space-driver-call.js';
import { parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Notes';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceNoteEntityServer extends mjBizAppsCollaborationSpaceNoteEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const caller = callerUuid(user);
        if (!user || !caller) return fail(result, 'AuthorUserID', 'Note change refused: there is no signed-in user.');
        const spaceId = parseUuid(this.SpaceID);
        if (!spaceId) return fail(result, 'SpaceID', 'Note change refused: the space id is not valid.');
        if (!(this.Title ?? '').trim()) return fail(result, 'Title', 'Note change refused: a note needs a title.');

        const author = parseUuid(this.AuthorUserID);
        if (!this.IsSaved) {
            if (author && author !== caller) return fail(result, 'AuthorUserID', 'Note change refused: a note is written as its author, the signed-in user.');
            if (!author) this.AuthorUserID = caller;
        } else {
            const savedAuthor = parseUuid(String(this.Fields.find((f) => f.Name === 'AuthorUserID')?.OldValue ?? this.AuthorUserID ?? ''));
            if (savedAuthor !== caller) return fail(result, 'AuthorUserID', 'Note change refused: only the author edits a note.');
            if (author !== savedAuthor) return fail(result, 'AuthorUserID', "Note change refused: a note's author does not change.");
            if (this.Fields.some((f) => f.Name === 'SpaceID' && f.Dirty)) return fail(result, 'SpaceID', 'Note change refused: a note stays in its space.');
            const bandField = this.Fields.find((f) => f.Name === 'Band');
            if (bandField?.Dirty && bandField.OldValue === 'Team' && this.Band === 'Shared') {
                return fail(result, 'Band', "Note change refused: a Team note doesn't move to Shared until the plan's call 15 is made.");
            }
        }

        let context: Awaited<ReturnType<typeof loadWriteContext>>;
        try {
            context = await loadWriteContext(this, user, spaceId, null);
        } catch (error) {
            return fail(result, 'SpaceID', error instanceof Error ? error.message : 'Note change refused: the space could not be read.');
        }
        const reach = membershipReaches(context.spaces, context.memberships, caller, spaceId);
        if (!reach) return fail(result, 'SpaceID', 'Note change refused: the signer does not reach this space.');
        const space = context.spaces.find((node) => node.id.toLowerCase() === spaceId.toLowerCase());
        if (space && spaceIsReadOnly(space)) return fail(result, 'SpaceID', 'Note change refused: the space is read-only in its current status.');
        if (this.Band === 'Team' && !reach.role.canSeeTeamBand) return fail(result, 'Band', "Note change refused: a seat that can't see Team can't write a Team note.");
        return result;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const caller = callerUuid(this.ContextCurrentUser);
        if (!caller) return failDelete(this, 'Note delete refused: there is no signed-in user.');
        if (parseUuid(this.AuthorUserID) !== caller) return failDelete(this, 'Note delete refused: only the author deletes a note.');
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
