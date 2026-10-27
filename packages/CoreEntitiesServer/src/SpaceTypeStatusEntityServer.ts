/**
 * SpaceTypeStatusEntityServer (stage 1): the statuses a type declares. Staff holding 'Configure Space Types' add, change and
 * remove them; the type's list as a whole must stay sound (one default, distinct codes and sequences, nothing frozen that is not
 * terminal); a status a space still names cannot go.
 */
import { BaseEntity, Metadata, RunView, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { validateStatusList, type SpaceTypeStatusAttributes } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceTypeStatusEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { requireSystemUser } from './load-graph.js';
import { failDelete } from './space-driver-call.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Type Status';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';

function attributesOf(row: { ID?: string; Code: string; Name: string; Sequence: number; IsDefault: boolean; ReadOnly: boolean; Visible: boolean; AgentRetrieval: boolean; CanChangeAfter: boolean; NotifyMembersOnEnter: boolean; IsTerminal: boolean }): SpaceTypeStatusAttributes {
    return {
        ID: row.ID, Code: row.Code, Name: row.Name, Sequence: Number(row.Sequence), IsDefault: !!row.IsDefault, ReadOnly: !!row.ReadOnly,
        Visible: !!row.Visible, AgentRetrieval: !!row.AgentRetrieval, CanChangeAfter: !!row.CanChangeAfter, NotifyMembersOnEnter: !!row.NotifyMembersOnEnter, IsTerminal: !!row.IsTerminal,
    };
}

@RegisterClass(BaseEntity, ENTITY)
export class SpaceTypeStatusEntityServer extends mjBizAppsCollaborationSpaceTypeStatusEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    private configurer(): string | null {
        const user = this.ContextCurrentUser;
        if (!user) return 'Status change refused: there is no signed-in user.';
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
        if (!CollaborationEngine.Instance.UserCanConfigureSpaceTypes(user, md)) {
            return "Status change refused: a type's statuses are written with the 'Configure Space Types' authorization.";
        }
        return null;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const refused = this.configurer();
        if (refused) return fail(result, 'SpaceTypeID', refused);
        const typeId = parseUuid(this.SpaceTypeID);
        if (!typeId) return fail(result, 'SpaceTypeID', 'Status change refused: the space type id is not valid.');
        if (!(this.Code ?? '').trim()) return fail(result, 'Code', 'Status change refused: a status needs a code.');
        if (!(this.Name ?? '').trim()) return fail(result, 'Name', 'Status change refused: a status needs a name.');

        // The type's list with this row in it must be sound as a whole
        let system;
        try {
            system = await requireSystemUser(this);
        } catch (error) {
            return fail(result, 'SpaceTypeID', error instanceof Error ? error.message : 'Status change refused: the system user is not available.');
        }
        const rv = new RunView(this.RunViewProviderToUse);
        const own = parseUuid(this.ID);
        const others = await rv.RunView<Parameters<typeof attributesOf>[0]>({
            EntityName: ENTITY,
            ExtraFilter: `SpaceTypeID = '${typeId}'${own ? ` AND ID <> '${own}'` : ''}`,
            ResultType: 'simple',
            MaxRows: 200,
        }, system);
        if (!others.Success) return fail(result, 'SpaceTypeID', `Status change refused: the type's statuses could not be read: ${others.ErrorMessage ?? 'unknown error'}`);
        const list = [...(others.Results ?? []).map(attributesOf), attributesOf(this)];
        const errors = validateStatusList(list);
        if (errors.length) return fail(result, 'Sequence', `Status change refused: ${errors.join(' ')}`);
        return result;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const refused = this.configurer();
        if (refused) return failDelete(this, refused.replace('Status change refused', 'Status delete refused'));
        const id = parseUuid(this.ID);
        if (id) {
            const system = await requireSystemUser(this);
            const named = await new RunView(this.RunViewProviderToUse).RunView<{ ID: string }>({
                EntityName: SPACES,
                ExtraFilter: `StatusID = '${id}'`,
                Fields: ['ID'],
                ResultType: 'simple',
                MaxRows: 1,
            }, system);
            if (!named.Success) return failDelete(this, `Status delete refused: the spaces could not be read: ${named.ErrorMessage ?? 'unknown error'}`);
            if (named.Results?.length) return failDelete(this, `Status delete refused: a space is ${this.Name}; move it to another status first.`);
            // The type keeps a sound list without this row
            const rest = await new RunView(this.RunViewProviderToUse).RunView<Parameters<typeof attributesOf>[0]>({
                EntityName: ENTITY,
                ExtraFilter: `SpaceTypeID = '${parseUuid(this.SpaceTypeID)}' AND ID <> '${id}'`,
                ResultType: 'simple',
                MaxRows: 200,
            }, system);
            if (rest.Success && (rest.Results?.length ?? 0) > 0) {
                const errors = validateStatusList((rest.Results ?? []).map(attributesOf));
                if (errors.length) return failDelete(this, `Status delete refused: without it the type's statuses would not be sound: ${errors.join(' ')}`);
            }
        }
        const ok = await super.Delete(options);
        return ok;
    }
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceTypeStatusEntityServer(): void {
    void SpaceTypeStatusEntityServer;
}
