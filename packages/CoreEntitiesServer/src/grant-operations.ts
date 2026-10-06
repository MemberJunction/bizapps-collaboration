/**
 * The grant operations (B17, D29): `RunSpaceView`, `RunSpaceQuery` and `GetSpaceDashboard`. Every one parses its ids before they
 * reach a filter, checks that the caller reaches the space and that the grant is in force there for their band, refuses a client
 * value for a bound name and for a name the target does not have, and logs the run (A2's stand-in: an `MJ: Audit Logs` row under
 * *Collaboration: Grant Run*, naming the grant, the space, the caller, the bound names and the agent run when an agent made it).
 *
 * Until MJ#4789 (the plan's D36) each runs only what #8's plan § 4 allows: `RunSpaceView` runs view grants with no binding, as the
 * caller, so row-level security applies; `RunSpaceQuery` runs the query with the bound values as the system user (a stored
 * procedure's rights), without the server-set context A17 brings; `GetSpaceDashboard` has no grant to return.
 */
import { type BaseEntity, type EntitySaveOptions, type IMetadataProvider, type IRunQueryProvider, LogError, RunQuery, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import { type EffectiveGrant, type EffectiveSpaceConfiguration, type GrantKind, GrantsForViewer, membershipReaches, refuseClientValues } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { resolveBindings } from './resolve-bindings.js';
import { loadReach } from './space-reach.js';
import { loadSpaceConfiguration } from './space-configuration.js';
import { parseUuid } from './uuid.js';

export const GRANT_RUN_AUDIT_LOG_TYPE = 'Collaboration: Grant Run';
const GRANTS_ENTITY = 'MJ_BizApps_Collaboration: Space Grants';

export type ClientValues = Record<string, string | number | boolean | null>;

export interface GrantRunRequest {
    provider: IMetadataProvider;
    user: UserInfo;
    spaceId: string;
    grantId: string;
    /** The values the client sent for the target's own (unbound) parameters or properties. */
    clientValues?: ClientValues | null;
    /** The agent run this run belongs to, when an agent made it (A2). */
    agentRunId?: string | null;
}

export type RowsOutcome =
    | { ok: true; rows: Record<string, unknown>[]; rowCount: number }
    | { ok: false; message: string };

interface Prepared {
    space: string;
    grant: EffectiveGrant;
    configuration: EffectiveSpaceConfiguration;
    canSeeTeam: boolean;
}

const refuse = (message: string): { ok: false; message: string } => ({ ok: false, message: message.startsWith('Run refused') ? message : `Run refused: ${message}` });

/** The checks every operation makes first: ids, reach, and the grant in force for the caller's band. */
async function prepare(request: GrantRunRequest, kind: GrantKind): Promise<Prepared | { ok: false; message: string }> {
    const space = parseUuid(request.spaceId);
    const grantId = parseUuid(request.grantId);
    const caller = parseUuid(request.user?.ID);
    if (!space || !grantId || !caller) return refuse('the space id or the grant id is not valid.');

    const engine = CollaborationEngine.Instance;
    const administers = engine.UserMayAdministerSpaces(request.user, request.provider);
    let canSeeTeam = administers;
    try {
        const reach = await loadReach(request.provider, request.user, space);
        const seat = membershipReaches(reach.spaces, reach.memberships, caller, space);
        if (!seat && !administers) return refuse('you do not reach this space.');
        canSeeTeam = administers || !!seat?.role.canSeeTeamBand;
    } catch (error) {
        return refuse(error instanceof Error ? error.message : 'your reach could not be checked.');
    }

    let configuration: EffectiveSpaceConfiguration;
    try {
        configuration = (await loadSpaceConfiguration(request.provider, space)).configuration;
    } catch (error) {
        return refuse(error instanceof Error ? error.message : "the space's configuration could not be resolved.");
    }
    const grant = GrantsForViewer(configuration, kind, canSeeTeam).find((candidate) => parseUuid(candidate.GrantID) === grantId);
    if (!grant) return refuse(`no ${kind.toLowerCase()} grant with that id is in force in this space for you.`);
    return { space, grant, configuration, canSeeTeam };
}

/** Writes the run to the audit log. A log that cannot be written refuses the run: a door that cannot record who went through stays shut. */
async function logRun(request: GrantRunRequest, prepared: Prepared, status: 'Success' | 'Failed', detail: Record<string, unknown>): Promise<string | null> {
    const grantsEntity = request.provider.EntityByName(GRANTS_ENTITY);
    const details = JSON.stringify({
        kind: prepared.grant.Kind,
        grantId: prepared.grant.GrantID,
        targetRecordId: prepared.grant.TargetRecordID,
        spaceId: prepared.space,
        userId: request.user.ID,
        agentRunId: request.agentRunId ?? null,
        boundNames: Object.keys(prepared.grant.Bindings),
        ...detail,
    });
    // The audit log writer lives on MJ's database provider, not on the metadata interface
    type AuditWriter = { CreateAuditLogRecord?: (user: UserInfo, authorizationName: string | null, auditLogTypeName: string, status: string, details: string | null, entityId: string, recordId: string | null, description: string | null, saveOptions: EntitySaveOptions | null) => Promise<BaseEntity | null> };
    const writer = request.provider as unknown as AuditWriter;
    if (typeof writer.CreateAuditLogRecord !== 'function') return 'the provider cannot write the audit log, so the run cannot be recorded.';
    try {
        const row = await writer.CreateAuditLogRecord(
            request.user,
            null,
            GRANT_RUN_AUDIT_LOG_TYPE,
            status,
            details,
            grantsEntity?.ID ?? '',
            prepared.grant.GrantID,
            `${prepared.grant.Kind} grant ${prepared.grant.Label ?? prepared.grant.TargetRecordID} run in space ${prepared.space}`,
            null,
        );
        if (!row) return `the run could not be logged (audit log type "${GRANT_RUN_AUDIT_LOG_TYPE}" is missing, or the write failed).`;
        return null;
    } catch (error) {
        return `the run could not be logged: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/** `RunSpaceView(spaceId, grantId, properties?)`: the view, as the caller, so row-level security applies. Until A14 a view grant has no binding to apply. */
export async function runSpaceView(request: GrantRunRequest): Promise<RowsOutcome> {
    const prepared = await prepare(request, 'View');
    if ('ok' in prepared) return prepared;
    const clientRefusal = refuseClientValues(request.clientValues, prepared.grant.Bindings, null);
    if (clientRefusal) return refuse(clientRefusal);
    if (Object.keys(prepared.grant.Bindings).length) {
        // Not reachable through a saved grant before MJ#4789 (the grant server refuses a bound view), and refused again here in case it is
        return refuse('a view cannot be bound to the space until MJ#4789 (A14); this grant carries bindings, so it does not run.');
    }
    if (request.clientValues && Object.keys(request.clientValues).length) {
        return refuse("a view takes no properties until MJ#4789 (A14).");
    }
    const run = await RunView.FromMetadataProvider(request.provider).RunView<Record<string, unknown>>({ ViewID: prepared.grant.TargetRecordID, ResultType: 'simple' }, request.user);
    const logged = await logRun(request, prepared, run.Success ? 'Success' : 'Failed', { rowCount: run.Success ? run.Results?.length ?? 0 : 0, error: run.Success ? null : run.ErrorMessage ?? 'unknown error' });
    if (logged) return refuse(logged);
    if (!run.Success) return refuse(`the view did not run: ${run.ErrorMessage ?? 'unknown error'}`);
    return { ok: true, rows: run.Results ?? [], rowCount: run.Results?.length ?? 0 };
}

/**
 * `RunSpaceQuery(spaceId, grantId, parameters?)`: D29's door. The bindings are resolved on the server, a client value for a bound
 * name or for a parameter the query lacks is refused, and the query runs with the bound values as the system user, the way a stored
 * procedure runs with its owner's rights. The caller and the bound names go to the log.
 */
export async function runSpaceQuery(request: GrantRunRequest): Promise<RowsOutcome> {
    const prepared = await prepare(request, 'Query');
    if ('ok' in prepared) return prepared;
    const system = await WellKnownUserSource.Instance.GetSystemUser(request.provider);
    if (!system) return refuse('the system user is not available, so the query cannot run with the server\'s rights.');

    // The query's own parameters, so a value for a name it lacks is refused
    const parameters = await RunView.FromMetadataProvider(request.provider).RunView<{ Name: string }>({
        EntityName: 'MJ: Query Parameters',
        ExtraFilter: `QueryID = '${parseUuid(prepared.grant.TargetRecordID)}'`,
        Fields: ['Name'],
        ResultType: 'simple',
        MaxRows: 500,
    }, system);
    if (!parameters.Success) return refuse(`the query's parameters could not be read: ${parameters.ErrorMessage ?? 'unknown error'}`);
    const names = (parameters.Results ?? []).map((row) => row.Name);
    const clientRefusal = refuseClientValues(request.clientValues, prepared.grant.Bindings, names);
    if (clientRefusal) return refuse(clientRefusal);

    const bound = await resolveBindings(request.provider, request.user, prepared.space, prepared.grant, prepared.configuration);
    if (!bound.ok) {
        const logged = await logRun(request, prepared, 'Failed', { error: bound.message });
        return refuse(logged ?? bound.message);
    }
    const values: Record<string, unknown> = { ...(request.clientValues ?? {}), ...bound.values };
    const run = await new RunQuery(request.provider as unknown as IRunQueryProvider).RunQuery({ QueryID: prepared.grant.TargetRecordID, Parameters: values }, system);
    const logged = await logRun(request, prepared, run.Success ? 'Success' : 'Failed', {
        boundSources: bound.sources,
        clientNames: Object.keys(request.clientValues ?? {}),
        rowCount: run.Success ? run.Results?.length ?? 0 : 0,
        error: run.Success ? null : run.ErrorMessage ?? 'unknown error',
    });
    if (logged) return refuse(logged);
    if (!run.Success) return refuse(`the query did not run: ${run.ErrorMessage ?? 'unknown error'}`);
    return { ok: true, rows: (run.Results ?? []) as Record<string, unknown>[], rowCount: run.Results?.length ?? 0 };
}

export type DashboardOutcome =
    | { ok: true; dashboardId: string; properties: Record<string, unknown> }
    | { ok: false; message: string };

/** `GetSpaceDashboard(spaceId, grantId)`: under D36 no dashboard is granted before A15, so there is no grant to return; the operation exists so the browser is wired for the follow-up. */
export async function getSpaceDashboard(request: GrantRunRequest): Promise<DashboardOutcome> {
    const prepared = await prepare(request, 'Dashboard');
    if ('ok' in prepared) return prepared;
    LogError(`GetSpaceDashboard: a dashboard grant ${prepared.grant.GrantID} is in force before MJ#4789, which the grant server should have refused.`);
    return refuse('a dashboard has no properties to scope it to the space until MJ#4789 (A15), so none is returned.');
}
