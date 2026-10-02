/**
 * SpaceMemberPinEntityServer (B22, D32, item 149): what a member keeps at the top of a space. The user is the caller, and reaches
 * the space; a Record pin's target is in the space (an item of it, or a note of it the caller can read) and a Grant pin's grant is
 * in force there (the app's, the space's type's, the space's own or an ancestor's: the levels resolveAllowedAgents walks). The owner
 * removes a pin, or someone who administers spaces.
 */
import { BaseEntity, Metadata, RunView, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { membershipReaches, type SpaceNode } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceMemberPinEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext, mayAdminister, requireSystemUser } from './load-graph.js';
import { failDelete } from './space-driver-call.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Member Pins';
const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const NOTES = 'MJ_BizApps_Collaboration: Space Notes';
const GRANTS = 'MJ_BizApps_Collaboration: Space Grants';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceMemberPinEntityServer extends mjBizAppsCollaborationSpaceMemberPinEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    /** A pin is the caller's own: stamped ahead of MJ's required-field check, which runs before ValidateAsync. */
    private stampOwner(): void {
        const caller = callerUuid(this.ContextCurrentUser);
        if (caller && !parseUuid(this.UserID)) this.UserID = caller;
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        this.stampOwner();
        return super.Save(options);
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        this.stampOwner();
        const caller = callerUuid(this.ContextCurrentUser);
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user || !caller) return fail(result, 'UserID', 'Pin change refused: there is no signed-in user.');
        const spaceId = parseUuid(this.SpaceID);
        if (!spaceId) return fail(result, 'SpaceID', 'Pin change refused: the space id is not valid.');
        const owner = parseUuid(this.UserID);
        if (owner && owner !== caller) return fail(result, 'UserID', 'Pin change refused: a pin is the signed-in user\'s own.');
        if (!owner) this.UserID = caller;

        let context: Awaited<ReturnType<typeof loadWriteContext>>;
        try {
            context = await loadWriteContext(this, user, spaceId, null);
        } catch (error) {
            return fail(result, 'SpaceID', error instanceof Error ? error.message : 'Pin change refused: the space could not be read.');
        }
        if (!membershipReaches(context.spaces, context.memberships, caller, spaceId)) {
            return fail(result, 'SpaceID', 'Pin change refused: the signer does not reach this space.');
        }

        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
        const rv = new RunView(this.RunViewProviderToUse);
        if (this.Kind === 'Record') {
            const entityId = parseUuid(this.TargetEntityID);
            const recordId = (this.TargetRecordID ?? '').trim();
            if (!entityId || !recordId) return fail(result, 'TargetRecordID', 'Pin change refused: a Record pin names its target entity and record.');
            if (this.GrantID) return fail(result, 'GrantID', 'Pin change refused: a Record pin names no grant.');
            const entity = md.EntityByID(entityId);
            if (!entity) return fail(result, 'TargetEntityID', 'Pin change refused: that entity is not in this database.');
            // The target is in the space: an item of it, or one of its notes. Read as the caller, so a target they can't read can't be pinned.
            const bare = recordId.toLowerCase().startsWith('id|') ? recordId.slice(3) : recordId;
            const inSpace = entity.Name === NOTES
                ? await rv.RunView<{ ID: string }>({ EntityName: NOTES, ExtraFilter: `ID = '${parseUuid(bare) ?? ''}' AND SpaceID = '${spaceId}'`, Fields: ['ID'], ResultType: 'simple', MaxRows: 1 }, user)
                : await rv.RunView<{ ID: string }>({ EntityName: ITEMS, ExtraFilter: `SpaceID = '${spaceId}' AND EntityID = '${entityId}' AND (RecordID = '${recordId.replace(/'/g, "''")}' OR RecordID = 'ID|${bare.replace(/'/g, "''")}')`, Fields: ['ID'], ResultType: 'simple', MaxRows: 1 }, user);
            if (!inSpace.Success) return fail(result, 'TargetRecordID', `Pin change refused: the space's material could not be read: ${inSpace.ErrorMessage ?? 'unknown error'}`);
            if (!inSpace.Results?.length) return fail(result, 'TargetRecordID', 'Pin change refused: the target is not in this space, or not one the signer can read.');
        } else if (this.Kind === 'Grant') {
            const grantId = parseUuid(this.GrantID);
            if (!grantId) return fail(result, 'GrantID', 'Pin change refused: a Grant pin names its grant.');
            if (this.TargetEntityID || this.TargetRecordID) return fail(result, 'TargetRecordID', 'Pin change refused: a Grant pin names no record.');
            // A participant reads no grant rows (the server cuts a space's configuration to what they may see), so the grant in force
            // is read as the system user: the question is whether it is in force here, not whether the caller may read its row
            let system;
            try {
                system = await requireSystemUser(this);
            } catch (error) {
                return fail(result, 'GrantID', error instanceof Error ? error.message : 'Pin change refused: the system user is not available.');
            }
            const spaces = await rv.RunView<{ SpaceTypeID: string }>({ EntityName: SPACES, ExtraFilter: `ID = '${spaceId}'`, Fields: ['SpaceTypeID'], ResultType: 'simple', MaxRows: 1 }, system);
            const typeId = parseUuid(spaces.Results?.[0]?.SpaceTypeID);
            // In force here: the app's, the space's type's, and the space's own or an ancestor's (what resolveAllowedAgents walks)
            const chain = ancestorChain(context.spaces, spaceId);
            const grants = await rv.RunView<{ ID: string }>({
                EntityName: GRANTS,
                ExtraFilter: `ID = '${grantId}' AND ((SpaceID IS NULL AND SpaceTypeID IS NULL) OR ${chain.map((id) => `SpaceID = '${id}'`).join(' OR ')}${typeId ? ` OR (SpaceID IS NULL AND SpaceTypeID = '${typeId}')` : ''})`,
                Fields: ['ID'],
                ResultType: 'simple',
                MaxRows: 1,
            }, system);
            if (!grants.Success) return fail(result, 'GrantID', `Pin change refused: the grants could not be read: ${grants.ErrorMessage ?? 'unknown error'}`);
            if (!grants.Results?.length) return fail(result, 'GrantID', 'Pin change refused: that grant is not in force in this space.');
        } else {
            return fail(result, 'Kind', 'Pin change refused: a pin is a Record or a Grant.');
        }
        return result;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const caller = callerUuid(this.ContextCurrentUser);
        if (!caller) return failDelete(this, 'Pin delete refused: there is no signed-in user.');
        // The owner removes their pin; so may someone who administers spaces (a seat's removal, the harness's cleanup)
        if (parseUuid(this.UserID) !== caller && !mayAdminister(this, this.ContextCurrentUser)) {
            return failDelete(this, 'Pin delete refused: only its owner removes a pin.');
        }
        return super.Delete(options);
    }
}

/** The space and its ancestors, nearest first; the space alone when the graph does not hold it. */
function ancestorChain(spaces: ReadonlyArray<SpaceNode>, spaceId: string): string[] {
    const byId = new Map(spaces.map((node) => [node.id.toLowerCase(), node]));
    const chain: string[] = [];
    let current: string | null = spaceId.toLowerCase();
    while (current && !chain.includes(current)) {
        chain.push(current);
        current = byId.get(current)?.parentId?.toLowerCase() ?? null;
    }
    return chain;
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceMemberPinEntityServer(): void {
    void SpaceMemberPinEntityServer;
}
