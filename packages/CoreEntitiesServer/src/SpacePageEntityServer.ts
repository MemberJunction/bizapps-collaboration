/**
 * SpacePageEntityServer (Round 2b): block-canvas pages in a space (both built-in tab layouts and custom pages).
 * Unlike SpaceNoteEntityServer — which restricts edits to the note's original author — any editor permitted by
 * `pageEditVerdict` (space owner, a seat whose role can promote the band, someone who can edit the space's settings,
 * or a space administrator) may create, edit, publish, or delete a page in an open, writable space.
 * A closed or read-only space refuses everyone. A Team page requires a seat that can see Team (or an administrator).
 * A page stays in its space, and a Shared page never moves back to Team.
 */
import { BaseEntity, Metadata, type UserInfo, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { membershipReaches, pageEditVerdict, spaceIsReadOnly } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpacePageEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { callerUuid, loadWriteContext, mayAdminister } from './load-graph.js';
import { failDelete } from './space-driver-call.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Pages';

@RegisterClass(BaseEntity, ENTITY)
export class SpacePageEntityServer extends mjBizAppsCollaborationSpacePageEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    private stampDefaults(): void {
        const caller = callerUuid(this.ContextCurrentUser);
        if (!this.Band) this.Band = 'Team';
        if (!this.Status) this.Status = 'Published';
        if (this.Sequence === null || this.Sequence === undefined) this.Sequence = 0;
        const publishing =
            this.Status === 'Published' &&
            (!this.IsSaved ||
                this.Fields.some(
                    (f) => f.Dirty && (f.Name === 'Status' || f.Name === 'PublishedBlocks' || f.Name === 'Title'),
                ));
        if (publishing) {
            if (caller && (!parseUuid(this.PublishedByUserID) || this.IsSaved)) {
                this.PublishedByUserID = caller;
            }
            if (!this.PublishedAt || this.IsSaved) {
                this.PublishedAt = new Date();
            }
        }
    }

    private async checkEditPermission(
        caller: string,
        user: UserInfo,
        spaceId: string,
        prefix: 'Page change refused' | 'Page delete refused',
        band?: string | null,
    ): Promise<{ ok: true } | { ok: false; field: string; message: string }> {
        let context: Awaited<ReturnType<typeof loadWriteContext>>;
        try {
            context = await loadWriteContext(this, user, spaceId, null);
        } catch (error) {
            return {
                ok: false,
                field: 'SpaceID',
                message: error instanceof Error ? error.message : `${prefix}: the space could not be read.`,
            };
        }

        const space = context.spaces.find((node) => node.id.toLowerCase() === spaceId.toLowerCase());
        if (!space) return { ok: false, field: 'SpaceID', message: `${prefix}: the space could not be read.` };

        const administers = mayAdminister(this, user);
        const reach = membershipReaches(context.spaces, context.memberships, caller, spaceId);
        if (!reach && !administers) {
            return { ok: false, field: 'SpaceID', message: `${prefix}: the signer does not reach this space.` };
        }

        if (band === 'Team' && !administers && !reach?.role.canSeeTeamBand) {
            return { ok: false, field: 'Band', message: `${prefix}: a seat that can't see Team can't write a Team page.` };
        }

        const isSpaceOwner = space.ownerId.toLowerCase() === caller.toLowerCase();
        const canEditSpaceSettings =
            Boolean(reach?.role.isOwnerRole) &&
            (await CollaborationEngine.Instance.UserCanConfigureSpaces(
                user,
                spaceId,
                asMetadata(this.ProviderToUse) ?? Metadata.Provider,
            ));

        const verdict = pageEditVerdict(
            {
                userId: caller,
                isSpaceOwner,
                role: reach?.role ?? null,
                canEditSpaceSettings,
                administers,
            },
            {
                isReadOnly: spaceIsReadOnly(space),
                closedAt: space.closedAt,
            },
        );
        if (!verdict.ok) {
            return { ok: false, field: 'SpaceID', message: `${prefix}: ${verdict.message}` };
        }

        return { ok: true };
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        this.stampDefaults();
        return super.Save(options);
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        this.stampDefaults();
        const caller = callerUuid(this.ContextCurrentUser);
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user || !caller) return fail(result, 'SpaceID', 'Page change refused: there is no signed-in user.');
        const spaceId = parseUuid(this.SpaceID);
        if (!spaceId) return fail(result, 'SpaceID', 'Page change refused: the space id is not valid.');
        if (!(this.Title ?? '').trim()) return fail(result, 'Title', 'Page change refused: a page needs a title.');

        if (this.IsSaved) {
            if (this.Fields.some((f) => f.Name === 'SpaceID' && f.Dirty)) {
                return fail(result, 'SpaceID', 'Page change refused: a page stays in its space.');
            }
            const bandField = this.Fields.find((f) => f.Name === 'Band');
            if (bandField?.Dirty && bandField.OldValue === 'Shared' && this.Band === 'Team') {
                return fail(result, 'Band', 'Page change refused: a Shared page is not taken back to Team; members may have read it.');
            }
        }

        const check = await this.checkEditPermission(caller, user, spaceId, 'Page change refused', this.Band);
        if (!check.ok) {
            return fail(result, check.field, check.message);
        }

        return result;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const caller = callerUuid(this.ContextCurrentUser);
        const user = this.ContextCurrentUser;
        if (!user || !caller) return failDelete(this, 'Page delete refused: there is no signed-in user.');
        const spaceId = parseUuid(this.SpaceID);
        if (!spaceId) return failDelete(this, 'Page delete refused: the space id is not valid.');

        const check = await this.checkEditPermission(caller, user, spaceId, 'Page delete refused');
        if (!check.ok) {
            return failDelete(this, check.message);
        }

        return super.Delete(options);
    }
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpacePageEntityServer(): void {
    void SpacePageEntityServer;
}
