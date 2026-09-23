import { BaseEntity, CompositeKey, LogError, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { authorizeItemWrite, type Band } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext } from './load-graph.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Items';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceItemEntityServer extends mjBizAppsCollaborationSpaceItemEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const caller = callerUuid(user);
        const spaceId = parseUuid(this.SpaceID);
        if (!user || !caller || !spaceId) {
            return fail(result, 'Item change refused: the signer and the space must be real ids.');
        }
        const previousRaw = this.Fields.find((field) => field.Name === 'SpaceID')?.OldValue as string | null | undefined;
        const previousSpace = previousRaw ? parseUuid(String(previousRaw)) : null;
        if (previousRaw && !previousSpace) {
            return fail(result, 'Item change refused: the saved space id is not valid.');
        }
        const previousBand = this.Fields.find((field) => field.Name === 'Band')?.OldValue as Band | null | undefined;
        let context;
        try {
            context = await loadWriteContext(this, user, spaceId, null);
        } catch (error) {
            return fail(result, error instanceof Error ? error.message : 'Item change refused: the space could not be read completely.');
        }
        let spaces = context.spaces;
        if (previousSpace && previousSpace !== spaceId && parseUuid(previousSpace)) {
            try {
                const previous = await loadWriteContext(this, user, previousSpace, null);
                spaces = [...spaces, ...previous.spaces.filter((space) => !spaces.some((have) => have.id === space.id))];
                context.memberships.push(...previous.memberships);
            } catch (error) {
                return fail(result, error instanceof Error ? error.message : 'Item change refused: the previous space could not be read.');
            }
        }
        const decision = authorizeItemWrite({
            callerUserId: caller,
            previousSpaceId: this.IsSaved ? (previousSpace ?? spaceId) : null,
            nextSpaceId: spaceId,
            previousBand: this.IsSaved ? (previousBand ?? this.Band) : null,
            nextBand: this.Band,
            now: new Date(),
            spaces,
            memberships: context.memberships,
        });
        if (!decision.ok) {
            return fail(result, decision.message);
        }
        const canonical = canonicalRecordId(this);
        if (canonical) {
            this.RecordID = canonical;
        }
        const readable = await callerCanReadTarget(this, user);
        if (!readable) {
            return fail(result, 'Item change refused: the signer cannot read the record this item points at.');
        }
        if (decision.rewriteStamp) {
            this.PromotedAt = decision.promotedAt;
            this.PromotedByUserID = decision.promotedByUserId;
        } else {
            const at = this.Fields.find((field) => field.Name === 'PromotedAt');
            const by = this.Fields.find((field) => field.Name === 'PromotedByUserID');
            if (at) this.PromotedAt = (at.OldValue as Date | null) ?? null;
            if (by) this.PromotedByUserID = (by.OldValue as string | null) ?? null;
        }
        return result;
    }
}

function canonicalRecordId(item: SpaceItemEntityServer): string | null {
    const provider = asMetadata(item.ProviderToUse);
    const entityId = parseUuid(item.EntityID);
    if (!provider || !entityId || !item.RecordID) {
        return null;
    }
    const info = provider.EntityByID(entityId);
    if (!info) {
        return null;
    }
    try {
        return CompositeKey.FromURLSegment(info, item.RecordID).ToRecordID();
    } catch (error) {
        LogError(`Space item record id: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

async function callerCanReadTarget(item: SpaceItemEntityServer, user: NonNullable<SpaceItemEntityServer['ContextCurrentUser']>): Promise<boolean> {
    const entityId = parseUuid(item.EntityID);
    if (!entityId || !item.RecordID) {
        return false;
    }
    const provider = asMetadata(item.ProviderToUse);
    if (!provider) {
        LogError('Space item target check: the provider has no entity metadata.');
        return false;
    }
    const info = provider.EntityByID(entityId);
    if (!info) {
        return false;
    }
    let key: CompositeKey;
    try {
        key = CompositeKey.FromURLSegment(info, item.RecordID);
    } catch (error) {
        LogError(`Space item target check: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
    try {
        const record = await provider.GetEntityObject(info.Name, user);
        return await record.InnerLoad(key);
    } catch (error) {
        LogError(`Space item target check: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

function fail(result: ValidationResult, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo('Band', message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceItemEntityServer(): void {
    void SpaceItemEntityServer;
}
