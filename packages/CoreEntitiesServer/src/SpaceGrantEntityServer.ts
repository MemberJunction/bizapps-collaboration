/**
 * SpaceGrantEntityServer (B15, D27, D30, D31, items 142, 148, 149): what the app, a type or a space offers in its spaces. Each
 * refusal is in `ValidateAsync`: the target exists and its entity is its kind's; each bound name is a real parameter of the target
 * and each expression parses; an agent's settings stay inside its definition; and, until MJ#4789, § 4's four rules hold at every
 * level: a view with a binding, or a dashboard, is refused; a view with none, a query or a component only goes to a type that seats
 * staff only (`Seats.Audience`, absent fails closed); an action with a bound parameter is stored (the turn leaves it out).
 * Rights: the app's and a type's rows need 'Configure Space Types'; a space's need 'Configure Spaces' and an owner seat on it, or
 * 'Administer Spaces' (the world loader and the harness write grants without a seat).
 */
import { BaseEntity, type IMetadataProvider, Metadata, RunView, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    type AgentDefinitionForGrant,
    type CollaborationSettings,
    GRANT_KIND_ENTITY,
    isGrantKind,
    typeSeatsAudience,
    validateAgentGrantSettings,
    validateSpaceGrantBindings,
} from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceGrantEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { requireSystemUser } from './load-graph.js';
import { failDelete } from './space-driver-call.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Grants';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';

/** § 4's four rules (item 142), judged from the kind, the bindings and who the type seats. Null when the grant may be saved. */
export function grantRuleRefusal(input: { kind: string; hasBindings: boolean; audience: 'StaffOnly' | 'StaffAndParticipants' }): string | null {
    const staffOnly = input.audience === 'StaffOnly';
    switch (input.kind) {
        case 'View':
            if (input.hasBindings) return 'Grant refused: a view cannot be bound to the space until MJ#4789 (A14).';
            if (!staffOnly) return 'Grant refused: until MJ#4789 a view may only be granted to a type that seats staff only (A17).';
            return null;
        case 'Dashboard':
            return 'Grant refused: a dashboard has no properties to scope it to the space, so it cannot be granted until MJ#4789 (A15).';
        case 'Query':
        case 'Component':
            if (!staffOnly) return `Grant refused: until MJ#4789 a ${input.kind.toLowerCase()} may only be granted to a type that seats staff only (A17, D34).`;
            return null;
        default:
            return null;
    }
}

@RegisterClass(BaseEntity, ENTITY)
export class SpaceGrantEntityServer extends mjBizAppsCollaborationSpaceGrantEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    /** The right the row's level asks for. Null when the caller holds it. */
    private async rightRefusal(spaceId: string | null): Promise<string | null> {
        const user = this.ContextCurrentUser;
        if (!user) return 'Grant change refused: there is no signed-in user.';
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
        if (spaceId) {
            if (CollaborationEngine.Instance.UserMayAdministerSpaces(user, md)) return null;
            if (!(await CollaborationEngine.Instance.UserCanConfigureSpaces(user, spaceId, md))) {
                return "Grant change refused: a space's grants are written with the 'Configure Spaces' authorization and an owner seat on the space.";
            }
            return null;
        }
        if (!CollaborationEngine.Instance.UserCanConfigureSpaceTypes(user, md)) {
            return "Grant change refused: the app's and a type's grants are written with the 'Configure Space Types' authorization.";
        }
        return null;
    }

    /** The target's entity is its kind's (item 149): stamped when the row names none, ahead of MJ's required-field check. */
    private stampTargetEntity(): void {
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
        const kind = this.Kind;
        if (isGrantKind(kind) && !parseUuid(this.TargetEntityID)) {
            const stamped = md.EntityByName(GRANT_KIND_ENTITY[kind]);
            if (stamped) this.TargetEntityID = stamped.ID;
        }
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        this.stampTargetEntity();
        return super.Save(options);
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        this.stampTargetEntity();
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
        const kind = this.Kind;
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user) return fail(result, 'Kind', 'Grant change refused: there is no signed-in user.');
        if (!isGrantKind(kind)) return fail(result, 'Kind', `Grant change refused: "${String(kind)}" is not a kind of grant.`);
        const spaceId = this.SpaceID ? parseUuid(this.SpaceID) : null;
        if (this.SpaceID && !spaceId) return fail(result, 'SpaceID', 'Grant change refused: the space id is not valid.');
        let typeId = this.SpaceTypeID ? parseUuid(this.SpaceTypeID) : null;
        if (this.SpaceTypeID && !typeId) return fail(result, 'SpaceTypeID', 'Grant change refused: the space type id is not valid.');
        if (spaceId && typeId) return fail(result, 'SpaceID', "Grant change refused: a grant is the app's, a type's or a space's, not a type's and a space's.");
        if (this.IsDefault && kind !== 'Agent') return fail(result, 'IsDefault', 'Grant change refused: only an agent can be the default.');

        const refused = await this.rightRefusal(spaceId);
        if (refused) return fail(result, spaceId ? 'SpaceID' : 'SpaceTypeID', refused);

        // The target's entity is its kind's (item 149): refused when it names another
        const kindEntity = md.EntityByName(GRANT_KIND_ENTITY[kind]);
        if (!kindEntity) return fail(result, 'TargetEntityID', `Grant change refused: ${GRANT_KIND_ENTITY[kind]} is not in this database.`);
        const givenEntity = parseUuid(this.TargetEntityID);
        if (givenEntity && givenEntity !== parseUuid(kindEntity.ID)) {
            return fail(result, 'TargetEntityID', `Grant change refused: a ${kind} grant's target lives in ${kindEntity.Name}.`);
        }
        if (!givenEntity) this.TargetEntityID = kindEntity.ID;
        const targetId = parseUuid(this.TargetRecordID);
        if (!targetId) return fail(result, 'TargetRecordID', 'Grant change refused: the target id is not valid.');

        let system;
        try {
            system = await requireSystemUser(this);
        } catch (error) {
            return fail(result, 'TargetRecordID', error instanceof Error ? error.message : 'Grant change refused: the system user is not available.');
        }
        const rv = new RunView(this.RunViewProviderToUse);

        // The type the grant is judged under (its own, or its space's) and § 4's four rules come first: a kind the rule refuses is
        // refused by the rule, whether or not its target exists
        const judged = await this.judgedUnder(rv, system, spaceId, typeId, md as IMetadataProvider);
        if ('refusal' in judged) return fail(result, judged.field, judged.refusal);
        typeId = judged.typeId;
        const typeConfig = judged.typeConfig;
        let bindings: unknown = null;
        if (this.Bindings) {
            try {
                bindings = JSON.parse(this.Bindings);
            } catch {
                return fail(result, 'Bindings', 'Grant change refused: Bindings must be valid JSON.');
            }
        }
        const hasBindings = !!bindings && typeof bindings === 'object' && Object.keys(bindings as object).length > 0;
        const rule = grantRuleRefusal({ kind, hasBindings, audience: typeSeatsAudience(typeConfig) });
        if (rule) return fail(result, 'Kind', rule);

        const targetFields = kind === 'Agent' ? ['ID', 'Name', 'Status', 'AcceptsSkills', 'MaxCostPerRun', 'MaxTokensPerRun', 'MaxIterationsPerRun', 'MaxTimePerRun'] : ['ID', 'Name'];
        const targets = await rv.RunView<Record<string, unknown>>({
            EntityName: kindEntity.Name,
            ExtraFilter: `ID = '${targetId}'`,
            Fields: targetFields,
            ResultType: 'simple',
            MaxRows: 1,
        }, system);
        if (!targets.Success) return fail(result, 'TargetRecordID', `Grant change refused: the target could not be read: ${targets.ErrorMessage ?? 'unknown error'}`);
        const target = targets.Results?.[0];
        if (!target) return fail(result, 'TargetRecordID', `Grant change refused: no ${kindEntity.Name} row has id ${targetId}.`);

        // Bindings: each name a real parameter of the target where the server knows them, each expression parses
        if (bindings !== null) {
            const names = await this.targetNames(rv, system, kind, targetId);
            const errors = validateSpaceGrantBindings(bindings, names);
            if (errors.length) return fail(result, 'Bindings', `Grant change refused: ${errors.join(' ')}`);
        }

        // An agent's settings stay inside its definition (item 148)
        if (this.Settings) {
            if (kind !== 'Agent') return fail(result, 'Settings', 'Grant change refused: only an agent grant carries settings.');
            let settings: unknown;
            try {
                settings = JSON.parse(this.Settings);
            } catch {
                return fail(result, 'Settings', 'Grant change refused: Settings must be valid JSON.');
            }
            const agent = await this.agentDefinition(rv, system, target);
            const errors = validateAgentGrantSettings(settings, agent);
            if (errors.length) return fail(result, 'Settings', `Grant change refused: ${errors.join(' ')}`);
        }
        return result;
    }

    /** The type a grant is judged under (its own, or its space's) and that type's configuration. */
    private async judgedUnder(rv: RunView, system: Parameters<RunView['RunView']>[1], spaceId: string | null, typeId: string | null, md: IMetadataProvider | undefined): Promise<{ typeId: string | null; typeConfig: CollaborationSettings | null } | { field: string; refusal: string }> {
        if (spaceId) {
            const spaces = await rv.RunView<{ SpaceTypeID: string }>({ EntityName: SPACES, ExtraFilter: `ID = '${spaceId}'`, Fields: ['SpaceTypeID'], ResultType: 'simple', MaxRows: 1 }, system);
            if (!spaces.Success) return { field: 'SpaceID', refusal: `Grant change refused: the space could not be read: ${spaces.ErrorMessage ?? 'unknown error'}` };
            if (!spaces.Results?.[0]) return { field: 'SpaceID', refusal: 'Grant change refused: that space does not exist.' };
            typeId = parseUuid(spaces.Results[0].SpaceTypeID);
        }
        let typeConfig: CollaborationSettings | null = null;
        if (typeId) {
            await CollaborationEngine.Instance.EnsureLoaded(system, md);
            const type = CollaborationEngine.Instance.SpaceTypeById(typeId);
            if (!type) return { field: 'SpaceTypeID', refusal: 'Grant change refused: the space type could not be read.' };
            if (type.Configuration) {
                try {
                    typeConfig = JSON.parse(type.Configuration) as CollaborationSettings;
                } catch {
                    return { field: 'SpaceTypeID', refusal: "Grant change refused: the type's configuration does not parse." };
                }
            }
        }
        return { typeId, typeConfig };
    }

    /** The parameter names of an action or a query; null for a target whose names the server does not read. */
    private async targetNames(rv: RunView, system: Parameters<RunView['RunView']>[1], kind: string, targetId: string): Promise<string[] | null> {
        const source = kind === 'Action'
            ? { entity: 'MJ: Action Params', filter: `ActionID = '${targetId}'` }
            : kind === 'Query'
                ? { entity: 'MJ: Query Parameters', filter: `QueryID = '${targetId}'` }
                : null;
        if (!source) return null;
        const rows = await rv.RunView<{ Name: string }>({ EntityName: source.entity, ExtraFilter: source.filter, Fields: ['Name'], ResultType: 'simple', MaxRows: 500 }, system);
        if (!rows.Success) throw new Error(`the target's parameters could not be read: ${rows.ErrorMessage ?? 'unknown error'}`);
        return (rows.Results ?? []).map((row) => row.Name);
    }

    /** What MJ says of the agent, as the settings validator judges against it. */
    private async agentDefinition(rv: RunView, system: Parameters<RunView['RunView']>[1], agent: Record<string, unknown>): Promise<AgentDefinitionForGrant> {
        const id = String(agent['ID']);
        const accepts = (agent['AcceptsSkills'] as string | null | undefined) ?? 'None';
        const definition: AgentDefinitionForGrant = {
            AcceptsSkills: accepts,
            SupportsPlanMode: (agent['SupportsPlanMode'] as boolean | null | undefined) ?? null,
            Limits: {
                MaxCostPerRun: agent['MaxCostPerRun'] as number | null | undefined,
                MaxTokensPerRun: agent['MaxTokensPerRun'] as number | null | undefined,
                MaxIterationsPerRun: agent['MaxIterationsPerRun'] as number | null | undefined,
                MaxTimePerRun: agent['MaxTimePerRun'] as number | null | undefined,
            },
        };
        if (accepts === 'Limited') {
            const rows = await rv.RunView<{ SkillID: string }>({ EntityName: 'MJ: AI Agent Skills', ExtraFilter: `AgentID = '${id}' AND Status = 'Active'`, Fields: ['SkillID'], ResultType: 'simple', MaxRows: 500 }, system);
            definition.LimitedSkillIds = rows.Success ? (rows.Results ?? []).map((row) => row.SkillID) : [];
        } else if (accepts === 'All') {
            const rows = await rv.RunView<{ ID: string }>({ EntityName: 'MJ: AI Skills', ExtraFilter: `Status = 'Active'`, Fields: ['ID'], ResultType: 'simple', MaxRows: 2000 }, system);
            definition.ActiveSkillIds = rows.Success ? (rows.Results ?? []).map((row) => row.ID) : [];
        }
        return definition;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const refused = await this.rightRefusal(this.SpaceID ? parseUuid(this.SpaceID) : null);
        if (refused) return failDelete(this, refused.replace('Grant change refused', 'Grant delete refused'));
        return super.Delete(options);
    }
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceGrantEntityServer(): void {
    void SpaceGrantEntityServer;
}
