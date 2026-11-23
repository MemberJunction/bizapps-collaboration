/**
 * CX-3 Server-Bound Action Grant Registry, Exposure Builder & Invocation Wrapper.
 *
 * Exposes ONLY unbound user-level parameters in agent-visible tool schemas and prompts;
 * strips all server-bound contextual parameters (SpaceID, RootSpaceID, RootEntityID,
 * RootRecordID, Band, DeliveryPrincipalID, plus grant Bindings) from agent schemas;
 * and enforces server-side parameter injection & anti-spoofing before action dispatch.
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import type { BoundActionParams } from '@memberjunction/ai-core-plus';
import {
    type BaseEntity,
    type EntitySaveOptions,
    type IMetadataProvider,
    LogError,
    RunView,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { BaseSingleton, MJGlobal } from '@memberjunction/global';
import {
    type ActionMetadataDescriptor,
    type ActionParamDefinition,
    type BoundActionGrantExposure,
    type BoundActionPromptCatalogItem,
    type BoundParamValue,
    type BoundParamValuesMap,
    buildBoundActionGrantExposure,
    buildBoundActionPromptCatalog,
    type ChatAudience,
    type EffectiveGrant,
    enforceBoundActionParameters,
    type HiddenBoundParamOverridePolicy,
    membershipReaches,
    spaceIsReadOnly,
} from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { resolvePerRootDeliveryPrincipal } from './delivery-principal.js';
import { loadWriteContext } from './load-graph.js';
import { type BoundValue, resolveBindings } from './resolve-bindings.js';
import { loadSpaceConfiguration, type LoadedSpaceConfiguration } from './space-configuration.js';
import { parseUuid } from './uuid.js';

const ACTIONS_ENTITY = 'MJ: Actions';
const ACTION_PARAMS_ENTITY = 'MJ: Action Params';
const ANCHORS_ENTITY = 'MJ_BizApps_Collaboration: Space Anchors';
const GRANTS_ENTITY = 'MJ_BizApps_Collaboration: Space Grants';
const GRANT_RUN_AUDIT_LOG_TYPE = 'Collaboration: Grant Run';

interface ActionRowProjection {
    ID: string;
    Name: string;
    Description: string | null;
    DriverClass: string | null;
    Type: string | null;
    Status: string | null;
}

interface ActionParamRowProjection {
    ActionID: string;
    Name: string;
    Type: 'Input' | 'Output' | 'Both';
    ValueType: string | null;
    IsRequired: boolean;
    IsArray: boolean;
    Description: string | null;
    DefaultValue: string | null;
}

interface AnchorSummaryRow {
    EntityID: string;
    RecordID: string;
    IsPrimary: boolean;
}

interface AuditWriterProvider {
    CreateAuditLogRecord?: (
        user: UserInfo,
        authorizationName: string | null,
        auditLogTypeName: string,
        status: string,
        details: string | null,
        entityId: string,
        recordId: string | null,
        description: string | null,
        saveOptions: EntitySaveOptions | null,
    ) => Promise<BaseEntity | null>;
}

export interface ResolvedTurnBoundActions {
    exposures: BoundActionGrantExposure[];
    promptCatalog: BoundActionPromptCatalogItem[];
    boundActionParams: BoundActionParams;
    resolvedValuesByActionId: Record<string, BoundParamValuesMap>;
    paramDefsByActionId: Record<string, ActionParamDefinition[]>;
    grantByActionId: Record<string, EffectiveGrant>;
    actionMetadataById: Record<string, ActionMetadataDescriptor>;
    actionIds: string[];
    withheldReasons: string[];
}

export interface InvokeBoundSpaceAgentActionParams {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
    audience: ChatAudience;
    actionIdOrName: string;
    callerArgs: BoundParamValuesMap;
    agentRunId?: string | null;
    audienceReaders?: readonly UserInfo[];
    overridePolicy?: HiddenBoundParamOverridePolicy;
    loadedConfiguration?: LoadedSpaceConfiguration;
}

function escapeSql(value: string): string {
    return value.replace(/'/g, "''");
}

function stripCompositeKeyPrefix(recordId: string): string {
    const trimmed = recordId.trim();
    const pipeIdx = trimmed.indexOf('|');
    if (pipeIdx > 0 && !trimmed.includes('||')) {
        return trimmed.slice(pipeIdx + 1).trim();
    }
    return trimmed;
}

function toBoundParamValue(val: BoundValue): BoundParamValue {
    return val;
}

function detectSupportsAudience(actionRow: ActionRowProjection): boolean {
    const key = actionRow.DriverClass?.trim() || actionRow.Name.trim();
    if (!key) return false;
    const reg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseAction, key);
    if (!reg) return false;
    try {
        const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(BaseAction, key);
        if (!instance || instance.constructor === BaseAction) return false;
        const withProp = instance as BaseAction & { SupportsAudience?: boolean };
        return withProp.SupportsAudience === true;
    } catch {
        return false;
    }
}

export class CollaborationBoundActionGrantRegistry extends BaseSingleton<CollaborationBoundActionGrantRegistry> {
    protected constructor() {
        super();
    }

    public static get Instance(): CollaborationBoundActionGrantRegistry {
        return super.getInstance<CollaborationBoundActionGrantRegistry>('CollaborationBoundActionGrantRegistry');
    }

    /**
     * Resolves all Action grants in force for the turn's audience (`Shared` vs `Team`),
     * redacts hidden bound parameters from agent-visible schemas, and prepares server-bound
     * parameter injection maps (`ExecuteAgentParams.boundActionParams`).
     */
    public async ResolveForTurn(params: {
        provider: IMetadataProvider;
        systemUser: UserInfo;
        spaceId: string;
        audience: ChatAudience;
        loadedConfiguration: LoadedSpaceConfiguration;
        callerUser: UserInfo;
    }): Promise<ResolvedTurnBoundActions> {
        const cleanSpaceId = parseUuid(params.spaceId);
        if (!cleanSpaceId) {
            throw new Error('Cannot resolve bound action grants: invalid SpaceID.');
        }

        const inForceGrants = params.loadedConfiguration.configuration.Grants.Action.filter(
            (grant) => params.audience === 'Team' || grant.Band === 'Shared',
        );
        if (inForceGrants.length === 0) {
            return {
                exposures: [],
                promptCatalog: [],
                boundActionParams: {},
                resolvedValuesByActionId: {},
                paramDefsByActionId: {},
                grantByActionId: {},
                actionMetadataById: {},
                actionIds: [],
                withheldReasons: [],
            };
        }

        const rv = RunView.FromMetadataProvider(params.provider);
        const actionIds = [
            ...new Set(
                inForceGrants
                    .map((g) => parseUuid(g.TargetRecordID))
                    .filter((id): id is string => id !== null),
            ),
        ];

        const idClause = actionIds.map((id) => `'${escapeSql(id)}'`).join(', ');
        const [actionsRes, paramsRes] = await Promise.all([
            rv.RunView<ActionRowProjection>(
                {
                    EntityName: ACTIONS_ENTITY,
                    ExtraFilter: `ID IN (${idClause})`,
                    Fields: ['ID', 'Name', 'Description', 'DriverClass', 'Type', 'Status'],
                    ResultType: 'simple',
                    MaxRows: 500, // row-cap-ok: granted actions per space turn is bounded below 500
                },
                params.systemUser,
            ),
            rv.RunView<ActionParamRowProjection>(
                {
                    EntityName: ACTION_PARAMS_ENTITY,
                    ExtraFilter: `ActionID IN (${idClause})`,
                    Fields: ['ActionID', 'Name', 'Type', 'ValueType', 'IsRequired', 'IsArray', 'Description', 'DefaultValue'],
                    OrderBy: 'Name',
                    ResultType: 'simple',
                    MaxRows: 2000, // row-cap-ok: action parameter definitions across turn actions
                },
                params.systemUser,
            ),
        ]);

        if (!actionsRes.Success) {
            throw new Error(`Could not load granted actions: ${actionsRes.ErrorMessage ?? 'unknown error'}`);
        }
        if (!paramsRes.Success) {
            throw new Error(`Could not load granted action parameters: ${paramsRes.ErrorMessage ?? 'unknown error'}`);
        }

        const actionMap = new Map<string, ActionRowProjection>();
        for (const row of actionsRes.Results ?? []) {
            actionMap.set(row.ID.toUpperCase(), row);
        }

        const paramMap = new Map<string, ActionParamDefinition[]>();
        for (const pRow of paramsRes.Results ?? []) {
            const key = pRow.ActionID.toUpperCase();
            const list = paramMap.get(key) ?? [];
            list.push({
                Name: pRow.Name,
                Type: pRow.Type,
                ValueType: pRow.ValueType,
                IsRequired: Boolean(pRow.IsRequired),
                IsArray: Boolean(pRow.IsArray),
                Description: pRow.Description,
                DefaultValue: pRow.DefaultValue,
            });
            paramMap.set(key, list);
        }

        // Resolve root space & primary anchor + optional per-root delivery principal for implicit bindings
        const chain = params.loadedConfiguration.chain;
        const rootSpaceId = chain.length > 0 ? (parseUuid(chain[chain.length - 1].ID) ?? cleanSpaceId) : cleanSpaceId;
        const anchorRes = await rv.RunView<AnchorSummaryRow>(
            {
                EntityName: ANCHORS_ENTITY,
                ExtraFilter: `SpaceID = '${rootSpaceId}' AND IsPrimary = 1`,
                Fields: ['EntityID', 'RecordID', 'IsPrimary'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            params.systemUser,
        );
        const primaryAnchor = anchorRes.Success ? anchorRes.Results?.[0] : undefined;
        const rootEntityId = primaryAnchor ? parseUuid(primaryAnchor.EntityID) : null;
        const rootRecordId = primaryAnchor?.RecordID ? stripCompositeKeyPrefix(primaryAnchor.RecordID) : null;

        const principalOutcome = await resolvePerRootDeliveryPrincipal({
            provider: params.provider,
            systemUser: params.systemUser,
            spaceId: cleanSpaceId,
            loadedConfiguration: params.loadedConfiguration,
        });
        const deliveryPrincipalUserId = principalOutcome.ok ? principalOutcome.principalUserId : null;

        const exposures: BoundActionGrantExposure[] = [];
        const boundActionParams: BoundActionParams = {};
        const resolvedValuesByActionId: Record<string, BoundParamValuesMap> = {};
        const paramDefsByActionId: Record<string, ActionParamDefinition[]> = {};
        const grantByActionId: Record<string, EffectiveGrant> = {};
        const actionMetadataById: Record<string, ActionMetadataDescriptor> = {};
        const resolvedActionIds: string[] = [];
        const withheldReasons: string[] = [];

        for (const grant of inForceGrants) {
            const actionKey = parseUuid(grant.TargetRecordID)?.toUpperCase();
            if (!actionKey) continue;
            const actionRow = actionMap.get(actionKey);
            if (!actionRow || (actionRow.Status && actionRow.Status.toLowerCase() !== 'active')) {
                withheldReasons.push(`action grant ${grant.GrantID} target action is missing or inactive`);
                continue;
            }

            const allParams = paramMap.get(actionKey) ?? [];
            const explicitBindingOutcome = await resolveBindings(
                params.provider,
                params.callerUser,
                cleanSpaceId,
                grant,
                params.loadedConfiguration.configuration,
                {
                    band: params.audience,
                    rootSpaceId,
                    rootEntityId,
                    rootRecordId,
                    deliveryPrincipalUserId,
                },
            );

            if (!explicitBindingOutcome.ok) {
                withheldReasons.push(`action grant ${grant.GrantID} (${actionRow.Name}): ${explicitBindingOutcome.message}`);
                continue;
            }

            // Combine implicit server-bound space contextual params (when declared as inputs on the action)
            // plus all explicit grant bindings.
            const serverBoundValues: BoundParamValuesMap = {};
            const implicitContextMap: Record<string, BoundParamValue | null> = {
                spaceid: cleanSpaceId,
                rootspaceid: rootSpaceId,
                rootentityid: rootEntityId,
                rootrecordid: rootRecordId,
                band: params.audience,
                deliveryprincipalid: deliveryPrincipalUserId,
            };

            for (const def of allParams) {
                if (def.Type !== 'Input' && def.Type !== 'Both') continue;
                const lower = def.Name.trim().toLowerCase();
                if (lower in implicitContextMap) {
                    const ctxVal = implicitContextMap[lower];
                    if (ctxVal !== null && ctxVal !== undefined) {
                        serverBoundValues[def.Name] = ctxVal;
                    }
                }
            }

            for (const [bKey, bVal] of Object.entries(explicitBindingOutcome.values)) {
                serverBoundValues[bKey] = toBoundParamValue(bVal);
            }

            // Verify required implicit server-bound parameters resolved cleanly (fail-closed)
            const missingRequired = allParams.find((def) => {
                if ((def.Type !== 'Input' && def.Type !== 'Both') || !def.IsRequired) return false;
                const lower = def.Name.trim().toLowerCase();
                if (!(lower in implicitContextMap)) return false;
                const resolved = Object.entries(serverBoundValues).find(([k]) => k.trim().toLowerCase() === lower)?.[1];
                return resolved === null || resolved === undefined || resolved === '';
            });
            if (missingRequired) {
                withheldReasons.push(
                    `action grant ${grant.GrantID} (${actionRow.Name}) withheld: required bound context '${missingRequired.Name}' could not be resolved`,
                );
                continue;
            }

            const supportsAudience = detectSupportsAudience(actionRow);
            const meta: ActionMetadataDescriptor = {
                ActionID: actionRow.ID,
                ActionName: actionRow.Name,
                Description: actionRow.Description,
                DriverClass: actionRow.DriverClass,
                SupportsAudience: supportsAudience,
            };

            const exposure = buildBoundActionGrantExposure(grant, meta, allParams);
            exposures.push(exposure);
            resolvedActionIds.push(actionRow.ID.toUpperCase());
            resolvedValuesByActionId[actionKey] = serverBoundValues;
            paramDefsByActionId[actionKey] = allParams;
            grantByActionId[actionKey] = grant;
            actionMetadataById[actionKey] = meta;

            // Populate ExecuteAgentParams.boundActionParams for MJ's A16 native tool-schema & dispatch enforcement
            const agentBoundMap: Record<string, BoundParamValue> = {};
            for (const [k, v] of Object.entries(serverBoundValues)) {
                if (v !== undefined) {
                    agentBoundMap[k] = v;
                }
            }
            if (Object.keys(agentBoundMap).length > 0) {
                boundActionParams[actionRow.ID] = agentBoundMap;
            }
        }

        return {
            exposures,
            promptCatalog: buildBoundActionPromptCatalog(exposures),
            boundActionParams,
            resolvedValuesByActionId,
            paramDefsByActionId,
            grantByActionId,
            actionMetadataById,
            actionIds: resolvedActionIds,
            withheldReasons,
        };
    }

    /**
     * Server-side invocation wrapper for bound space agent actions (CX-3).
     * Rejects spoofed hidden bound parameter attempts, validates seat reach & SupportsAudience,
     * injects server-bound values exclusively on the server, audits the run, and dispatches.
     */
    public async InvokeBoundAction(params: InvokeBoundSpaceAgentActionParams): Promise<ActionResultSimple> {
        const cleanSpaceId = parseUuid(params.spaceId);
        const callerId = parseUuid(params.callerUser?.ID);
        if (!cleanSpaceId || !callerId) {
            return { Success: false, ResultCode: 'FAILED', Message: 'Invocation refused: valid SpaceID and ContextUser are required.' };
        }

        let systemUser: UserInfo | undefined;
        try {
            systemUser = (await WellKnownUserSource.Instance.GetSystemUser(params.provider)) ?? undefined;
        } catch {
            systemUser = undefined;
        }
        if (!systemUser) {
            return { Success: false, ResultCode: 'FAILED', Message: 'Invocation refused: system user is unavailable.' };
        }

        const probe = await params.provider.GetEntityObject<BaseEntity>('MJ_BizApps_Collaboration: Spaces', params.callerUser);
        let writeContext;
        try {
            writeContext = await loadWriteContext(probe, params.callerUser, cleanSpaceId, null);
        } catch (error) {
            return {
                Success: false,
                ResultCode: 'UNAUTHORIZED',
                Message: error instanceof Error ? error.message : 'Invocation refused: space could not be read.',
            };
        }

        const targetSpace = writeContext.spaces.find((s) => s.id.toLowerCase() === cleanSpaceId.toLowerCase());
        if (!targetSpace) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'Invocation refused: space not found.' };
        }
        if (spaceIsReadOnly(targetSpace)) {
            return { Success: false, ResultCode: 'FAILED', Message: 'Invocation refused: space is read-only or closed.' };
        }

        const administers = CollaborationEngine.Instance.UserMayAdministerSpaces(params.callerUser, params.provider);
        const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);
        if (!reach && !administers) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'Invocation refused: caller does not reach this space.' };
        }
        if (!administers && !reach?.role.canContribute) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'Invocation refused: caller role cannot contribute in this space.' };
        }
        if (params.audience === 'Team' && !administers && !reach?.role.canSeeTeamBand) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'Invocation refused: caller lacks Team-band clearance.' };
        }

        const loaded = params.loadedConfiguration ?? (await loadSpaceConfiguration(params.provider, cleanSpaceId, { reader: systemUser }));
        const resolvedTurn = await this.ResolveForTurn({
            provider: params.provider,
            systemUser,
            spaceId: cleanSpaceId,
            audience: params.audience,
            loadedConfiguration: loaded,
            callerUser: params.callerUser,
        });

        const wanted = params.actionIdOrName.trim().toLowerCase();
        const exposure = resolvedTurn.exposures.find(
            (e) =>
                e.ActionID.toLowerCase() === wanted ||
                e.ActionName.toLowerCase() === wanted ||
                e.DisplayName.toLowerCase() === wanted,
        );
        if (!exposure) {
            return {
                Success: false,
                ResultCode: 'UNAUTHORIZED',
                Message: `Invocation refused: action '${params.actionIdOrName}' is not granted for ${params.audience}-band audience in space ${cleanSpaceId}.`,
            };
        }

        const actionKey = exposure.ActionID.toUpperCase();
        const grant = resolvedTurn.grantByActionId[actionKey];
        const allParams = resolvedTurn.paramDefsByActionId[actionKey] ?? [];
        const serverBoundValues = resolvedTurn.resolvedValuesByActionId[actionKey] ?? {};
        const meta = resolvedTurn.actionMetadataById[actionKey];

        if (!exposure.SupportsAudience) {
            await this.auditBoundGrantRun(params.provider, params.callerUser, grant, cleanSpaceId, params.agentRunId ?? null, 'Failed', {
                reason: 'AUDIENCE_UNSUPPORTED',
                actionId: exposure.ActionID,
            });
            return {
                Success: false,
                ResultCode: 'AUDIENCE_UNSUPPORTED',
                Message: `Invocation refused: action '${exposure.ActionName}' does not declare SupportsAudience = true.`,
            };
        }

        const enforcement = enforceBoundActionParameters({
            actionName: exposure.ActionName,
            callerArgs: params.callerArgs,
            serverBoundValues,
            allParams,
            overridePolicy: params.overridePolicy ?? 'Reject',
        });

        if (!enforcement.allowed) {
            await this.auditBoundGrantRun(params.provider, params.callerUser, grant, cleanSpaceId, params.agentRunId ?? null, 'Failed', {
                resultCode: enforcement.resultCode,
                spoofedParamNames: enforcement.spoofedParamNames,
                message: enforcement.message,
            });
            return {
                Success: false,
                ResultCode: enforcement.resultCode,
                Message: enforcement.message,
            };
        }

        const driverKey = meta?.DriverClass?.trim() || exposure.ActionName;
        const actionInstance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(BaseAction, driverKey);
        if (!actionInstance || actionInstance.constructor === BaseAction) {
            return {
                Success: false,
                ResultCode: 'FAILED',
                Message: `Action class '${driverKey}' is not registered in ClassFactory.`,
            };
        }

        const dispatchParams: ActionParam[] = [];
        for (const [pName, pVal] of Object.entries(enforcement.injectedParams)) {
            dispatchParams.push({
                Name: pName,
                Type: 'Input',
                Value: pVal,
                Bound: enforcement.boundParamNames.includes(pName),
            });
        }

        const serverBoundScopeParams: Record<string, string | number | boolean | null> = {};
        for (const [k, v] of Object.entries(serverBoundValues)) {
            if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                serverBoundScopeParams[k] = v;
            }
        }

        const runParams: RunActionParams = {
            Action: { ID: exposure.ActionID, Name: exposure.ActionName, DriverClass: driverKey } as RunActionParams['Action'],
            ContextUser: params.callerUser,
            Provider: params.provider,
            Params: dispatchParams,
            Filters: [],
            Context: {
                spaceId: cleanSpaceId,
                audience: params.audience,
                agentRunId: params.agentRunId ?? null,
            },
            ServerBoundScopeParams: serverBoundScopeParams,
            Audience: params.audienceReaders?.length
                ? { Readers: [...params.audienceReaders] }
                : { Readers: [params.callerUser] },
        };

        const result = await actionInstance.Run(runParams);
        await this.auditBoundGrantRun(
            params.provider,
            params.callerUser,
            grant,
            cleanSpaceId,
            params.agentRunId ?? null,
            result.Success ? 'Success' : 'Failed',
            {
                actionId: exposure.ActionID,
                boundParamNames: enforcement.boundParamNames,
                strippedSpoofedNames: enforcement.strippedSpoofedNames,
                resultCode: result.ResultCode,
            },
        );
        return result;
    }

    private async auditBoundGrantRun(
        provider: IMetadataProvider,
        user: UserInfo,
        grant: EffectiveGrant,
        spaceId: string,
        agentRunId: string | null,
        status: 'Success' | 'Failed',
        detail: Record<string, string | number | boolean | readonly string[] | null | undefined>,
    ): Promise<void> {
        const writer = provider as IMetadataProvider & AuditWriterProvider;
        if (typeof writer.CreateAuditLogRecord !== 'function') return;
        const grantsEntity = provider.EntityByName(GRANTS_ENTITY);
        try {
            await writer.CreateAuditLogRecord(
                user,
                null,
                GRANT_RUN_AUDIT_LOG_TYPE,
                status,
                JSON.stringify({
                    kind: 'Action',
                    grantId: grant.GrantID,
                    targetRecordId: grant.TargetRecordID,
                    spaceId,
                    userId: user.ID,
                    agentRunId,
                    boundNames: Object.keys(grant.Bindings ?? {}),
                    ...detail,
                }),
                grantsEntity?.ID ?? '',
                grant.GrantID,
                `Bound action grant ${grant.Label ?? grant.TargetRecordID} executed in space ${spaceId}`,
                null,
            );
        } catch (err) {
            LogError(`CollaborationBoundActionGrantRegistry: audit log write failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
