/**
 * CA-2, CA-3 & CA-4 Server Approval Promotion Engine:
 * - Reuses `@mj-biz-apps/tasks-entities` (`Tasks` with `ParentID` + polymorphic `TaskLink` + `TaskDecision`)
 *   to create, link, verify, and execute Team-to-Shared draft promotion.
 * - Enforces strict Team-band privacy (CA-3) on draft approval tasks and linked draft payloads so
 *   Shared-band users and non-Team participants cannot read or enumerate drafts before approval.
 * - Executes post-approval promotion atomically under the resolved per-root delivery principal (CA-4).
 */
import {
    type BaseEntity,
    type EntitySaveOptions,
    type IMetadataProvider,
    LogError,
    RunView,
    type TransactionGroupBase,
    type UserInfo,
} from '@memberjunction/core';
import {
    type mjBizAppsTasksTaskActivityEntity,
    type mjBizAppsTasksTaskDecisionEntity,
    type mjBizAppsTasksTaskDecisionOutcomeEntity,
    type mjBizAppsTasksTaskEntity,
    type mjBizAppsTasksTaskLinkEntity,
} from '@mj-biz-apps/tasks-entities';
import {
    type Band,
    evaluateApprovalPromotionGate,
    evaluateDraftApprovalTaskVisibility,
    membershipReaches,
    spaceIsReadOnly,
} from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { resolvePerRootDeliveryPrincipal } from './delivery-principal.js';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { createSpaceDoc, type SpaceDocRecord } from './space-docs.js';
import { SpaceItemEntityServer, vouchStoredFile } from './SpaceItemEntityServer.js';
import { callerPersonId } from './task-attribution.js';
import { parseUuid } from './uuid.js';

const TASKS_ENTITY = 'MJ_BizApps_Tasks: Tasks';
const TASK_LINKS_ENTITY = 'MJ_BizApps_Tasks: Task Links';
const TASK_DECISIONS_ENTITY = 'MJ_BizApps_Tasks: Task Decisions';
const TASK_DECISION_OUTCOMES_ENTITY = 'MJ_BizApps_Tasks: Task Decision Outcomes';
const TASK_ACTIVITIES_ENTITY = 'MJ_BizApps_Tasks: Task Activities';
const TASK_TYPES_ENTITY = 'MJ_BizApps_Tasks: Task Types';
const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';
const APPROVAL_TASK_TYPE_CODE = 'APPROVAL_REQUEST';
const GENERAL_TASK_TYPE_CODE = 'GENERAL';
export const DRAFT_PROMOTED_AUDIT_LOG_TYPE = 'Collaboration: Grant Run';

export interface CreateSpaceDraftApprovalInput {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
    title: string;
    content: string;
    parentTaskId?: string | null;
    rootEntityId?: string | null;
    rootRecordId?: string | null;
    folder?: string | null;
    agentRunId?: string | null;
}

export interface SpaceDraftApprovalSummary {
    taskId: string;
    taskSpaceItemId: string;
    draftSpaceItemId: string;
    draftArtifactId: string;
    draftVersionId: string;
    spaceId: string;
    title: string;
    band: Band;
    taskStatus: string;
    taskLinkIds: readonly string[];
    promotedByPrincipalUserId?: string | null;
    approvedByUserId?: string | null;
    promotedAt?: Date | null;
}

export type ApprovalWorkflowOutcome<T> =
    | { ok: true; data: T }
    | { ok: false; code: string; message: string };

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

interface RawTaskItemRow {
    ID: string;
    SpaceID: string;
    RecordID: string;
    Band: Band;
}

interface RawTaskRow {
    ID: string;
    Name: string;
    Status: string;
    ParentID: string | null;
}

interface RawTaskLinkRow {
    ID: string;
    TaskID: string;
    EntityID: string;
    RecordID: string;
    Description: string | null;
}

function escapeSql(value: string): string {
    return value.replace(/'/g, "''");
}

function extractRecordUuid(recordId: string): string | null {
    const trimmed = recordId.trim();
    const raw = trimmed.toLowerCase().startsWith('id|') ? trimmed.slice(3) : trimmed;
    return parseUuid(raw);
}

async function resolveApprovalTaskTypeId(provider: IMetadataProvider, system: UserInfo): Promise<string | null> {
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<{ ID: string; Code: string }>(
        {
            EntityName: TASK_TYPES_ENTITY,
            ExtraFilter: `Code IN ('${APPROVAL_TASK_TYPE_CODE}', '${GENERAL_TASK_TYPE_CODE}')`,
            Fields: ['ID', 'Code'],
            ResultType: 'simple',
            MaxRows: 10, // row-cap-ok: lookup of at most 2 task type codes
        },
        system,
    );
    if (!res.Success || !res.Results?.length) return null;
    const approval = res.Results.find((r) => r.Code.toUpperCase() === APPROVAL_TASK_TYPE_CODE);
    return approval?.ID ?? res.Results[0]?.ID ?? null;
}

async function resolveDecisionOutcomeId(
    provider: IMetadataProvider,
    system: UserInfo,
    desired: 'Approved' | 'Rejected',
): Promise<string | null> {
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<{ ID: string; Code: string; Name: string }>(
        {
            EntityName: TASK_DECISION_OUTCOMES_ENTITY,
            ExtraFilter: `Code = '${desired}' OR Name = '${desired}'`,
            Fields: ['ID', 'Code', 'Name'],
            ResultType: 'simple',
            MaxRows: 10, // row-cap-ok: small catalog of decision outcomes
        },
        system,
    );
    if (!res.Success || !res.Results?.length) return null;
    const exactCode = res.Results.find((r) => r.Code.toLowerCase() === desired.toLowerCase());
    if (exactCode) return exactCode.ID;
    const exactName = res.Results.find((r) => r.Name.toLowerCase() === desired.toLowerCase());
    return exactName?.ID ?? null;
}

/**
 * Creates a Team-band draft MJ Doc and links a Team-band `@mj-biz-apps/tasks-entities`
 * `APPROVAL_REQUEST` Task + polymorphic `TaskLink` rows (CA-2 & CA-3).
 */
export async function createSpaceDraftApprovalTask(
    input: CreateSpaceDraftApprovalInput,
): Promise<ApprovalWorkflowOutcome<SpaceDraftApprovalSummary>> {
    const cleanSpaceId = parseUuid(input.spaceId);
    const callerId = parseUuid(input.callerUser?.ID);
    const title = input.title.trim();
    if (!cleanSpaceId || !callerId || !title) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Valid SpaceID, callerUser, and title are required.' };
    }

    const probe = await input.provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, input.callerUser);
    const system = await requireSystemUser(probe);
    let writeContext;
    try {
        writeContext = await loadWriteContext(probe, input.callerUser, cleanSpaceId, null);
    } catch (err) {
        return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: err instanceof Error ? err.message : 'Space could not be read.',
        };
    }

    const spaceNode = writeContext.spaces.find((s) => s.id.toLowerCase() === cleanSpaceId.toLowerCase());
    if (!spaceNode) {
        return { ok: false, code: 'NOT_FOUND', message: `Space ${cleanSpaceId} was not found.` };
    }
    if (spaceIsReadOnly(spaceNode)) {
        return { ok: false, code: 'READ_ONLY', message: 'Draft proposal refused: space is read-only or closed.' };
    }

    const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(input.callerUser, input.provider);
    const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);
    const visibility = evaluateDraftApprovalTaskVisibility({ callerReach: reach, itemBand: 'Team', isAdmin });
    if (!visibility.allowed) {
        return { ok: false, code: 'PRIVACY_DENIED', message: visibility.reason };
    }
    if (!isAdmin && !reach?.role.canContribute) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Draft proposal refused: caller cannot contribute in this space.' };
    }

    // 1. Create the Team-band draft MJ Doc (`MJ: Artifacts` + `SpaceItem(Band = 'Team')`)
    const draftDocOutcome: Awaited<ReturnType<typeof createSpaceDoc>> = await createSpaceDoc({
        provider: input.provider,
        callerUser: input.callerUser,
        spaceId: cleanSpaceId,
        title,
        content: input.content,
        band: 'Team',
        folder: input.folder,
    });
    if (!draftDocOutcome.ok) {
        return { ok: false, code: draftDocOutcome.code, message: draftDocOutcome.message };
    }
    const draftDoc: SpaceDocRecord = draftDocOutcome.data;

    // 2. Create the APPROVAL_REQUEST Task (reusing @mj-biz-apps/tasks-entities)
    const tasksEntity = input.provider.EntityByName(TASKS_ENTITY);
    const spacesEntity = input.provider.EntityByName(SPACES_ENTITY);
    const itemsEntity = input.provider.EntityByName(ITEMS_ENTITY);
    if (!tasksEntity || !spacesEntity || !itemsEntity) {
        return { ok: false, code: 'FAILED', message: 'Required Task, Space, or Space Items entity metadata is missing.' };
    }

    const taskTypeId = await resolveApprovalTaskTypeId(input.provider, system);
    if (!taskTypeId) {
        return { ok: false, code: 'FAILED', message: 'Approval task type (APPROVAL_REQUEST / GENERAL) is not configured.' };
    }

    const authorPersonId = await callerPersonId(probe, input.callerUser);
    const task = await input.provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS_ENTITY, system);
    task.NewRecord();
    task.Name = `Approve & promote: ${title}`;
    task.Description = `Team-band draft approval task for space item ${draftDoc.spaceItemId}.`;
    task.TypeID = taskTypeId;
    task.Status = 'Open';
    task.Priority = 'High';
    task.ParentID = parseUuid(input.parentTaskId) ?? null;
    if (authorPersonId) {
        task.CreatedByPersonID = authorPersonId;
    }
    if (!(await task.Save()) || !task.ID) {
        return {
            ok: false,
            code: 'FAILED',
            message: task.LatestResult?.CompleteMessage ?? 'Failed to create approval Task.',
        };
    }

    // 3. File the approval Task on the Team band in Space Items (enforces CA-3 SQL + service Team-band privacy!)
    // Use callerUser (already verified as a Team-band contributor in this space) so SpaceItemEntityServer.Save()
    // authorizes the item write cleanly against real SQL Server reach rules.
    const taskSpaceItem = await input.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, input.callerUser);
    vouchStoredFile(taskSpaceItem);
    taskSpaceItem.NewRecord();
    taskSpaceItem.SpaceID = cleanSpaceId;
    taskSpaceItem.EntityID = tasksEntity.ID;
    taskSpaceItem.RecordID = `ID|${task.ID}`;
    taskSpaceItem.Band = 'Team';
    if (!(await taskSpaceItem.Save()) || !taskSpaceItem.ID) {
        await task.Delete();
        return {
            ok: false,
            code: 'FAILED',
            message: taskSpaceItem.LatestResult?.CompleteMessage ?? 'Failed to file approval Task on Team band.',
        };
    }

    // 4. Create polymorphic TaskLink records linking the Task to the Space, Draft SpaceItem, and optional Root record
    const taskLinkIds: string[] = [];
    const linkTargets: Array<{ entityId: string; recordId: string; description: string }> = [
        { entityId: spacesEntity.ID, recordId: `ID|${cleanSpaceId}`, description: 'Space' },
        { entityId: itemsEntity.ID, recordId: `ID|${draftDoc.spaceItemId}`, description: 'TeamDraftSpaceItem' },
    ];
    const cleanRootEntityId = parseUuid(input.rootEntityId);
    const cleanRootRecordId = input.rootRecordId?.trim();
    if (cleanRootEntityId && cleanRootRecordId) {
        linkTargets.push({
            entityId: cleanRootEntityId,
            recordId: cleanRootRecordId,
            description: 'RootRecord',
        });
    }

    for (const target of linkTargets) {
        const link = await input.provider.GetEntityObject<mjBizAppsTasksTaskLinkEntity>(TASK_LINKS_ENTITY, system);
        link.NewRecord();
        link.TaskID = task.ID;
        link.EntityID = target.entityId;
        link.RecordID = target.recordId;
        link.Description = target.description;
        if (!(await link.Save()) || !link.ID) {
            return {
                ok: false,
                code: 'FAILED',
                message: link.LatestResult?.CompleteMessage ?? `Failed to save TaskLink (${target.description}).`,
            };
        }
        taskLinkIds.push(link.ID);
    }

    return {
        ok: true,
        data: {
            taskId: task.ID,
            taskSpaceItemId: taskSpaceItem.ID,
            draftSpaceItemId: draftDoc.spaceItemId,
            draftArtifactId: draftDoc.artifactId,
            draftVersionId: draftDoc.versionId,
            spaceId: cleanSpaceId,
            title,
            band: 'Team',
            taskStatus: task.Status,
            taskLinkIds,
        },
    };
}

/**
 * Lists unapproved/active draft approval tasks in `spaceId`, strictly enforcing CA-3 Team-band privacy.
 * Shared-band participants are denied (`PRIVACY_DENIED`) so unapproved draft titles and metadata never leak.
 */
export async function listSpaceApprovalTasks(params: {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
}): Promise<ApprovalWorkflowOutcome<SpaceDraftApprovalSummary[]>> {
    const cleanSpaceId = parseUuid(params.spaceId);
    const callerId = parseUuid(params.callerUser?.ID);
    if (!cleanSpaceId || !callerId) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Valid SpaceID and callerUser are required.' };
    }

    const probe = await params.provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, params.callerUser);
    const system = await requireSystemUser(probe);
    let writeContext;
    try {
        writeContext = await loadWriteContext(probe, params.callerUser, cleanSpaceId, null);
    } catch (err) {
        return { ok: false, code: 'UNAUTHORIZED', message: err instanceof Error ? err.message : 'Space could not be read.' };
    }

    const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(params.callerUser, params.provider);
    const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);
    const visibility = evaluateDraftApprovalTaskVisibility({ callerReach: reach, itemBand: 'Team', isAdmin });
    if (!visibility.allowed) {
        return { ok: false, code: 'PRIVACY_DENIED', message: visibility.reason };
    }

    const tasksEntity = inputEntity(params.provider, TASKS_ENTITY);
    const itemsEntity = inputEntity(params.provider, ITEMS_ENTITY);
    if (!tasksEntity || !itemsEntity) {
        return { ok: true, data: [] };
    }

    const rv = RunView.FromMetadataProvider(params.provider);
    const taskItemsRes = await rv.RunView<RawTaskItemRow>(
        {
            EntityName: ITEMS_ENTITY,
            ExtraFilter: `SpaceID = '${cleanSpaceId}' AND EntityID = '${tasksEntity.ID}' AND Band = 'Team'`,
            Fields: ['ID', 'SpaceID', 'RecordID', 'Band'],
            ResultType: 'simple',
            MaxRows: 500, // row-cap-ok: approval tasks per space
        },
        system,
    );
    if (!taskItemsRes.Success) {
        return { ok: false, code: 'FAILED', message: taskItemsRes.ErrorMessage ?? 'Failed to load space approval task items.' };
    }

    const taskItems = taskItemsRes.Results ?? [];
    if (taskItems.length === 0) return { ok: true, data: [] };

    const taskIds = [
        ...new Set(
            taskItems
                .map((row) => extractRecordUuid(row.RecordID))
                .filter((id): id is string => id !== null),
        ),
    ];
    if (taskIds.length === 0) return { ok: true, data: [] };

    const inTasks = taskIds.map((id) => `'${escapeSql(id)}'`).join(', ');
    const [tasksRes, linksRes] = await Promise.all([
        rv.RunView<RawTaskRow>(
            {
                EntityName: TASKS_ENTITY,
                ExtraFilter: `ID IN (${inTasks})`,
                Fields: ['ID', 'Name', 'Status', 'ParentID'],
                ResultType: 'simple',
                MaxRows: 500, // row-cap-ok: matches taskIds bound
            },
            system,
        ),
        rv.RunView<RawTaskLinkRow>(
            {
                EntityName: TASK_LINKS_ENTITY,
                ExtraFilter: `TaskID IN (${inTasks})`,
                Fields: ['ID', 'TaskID', 'EntityID', 'RecordID', 'Description'],
                ResultType: 'simple',
                MaxRows: 2000, // row-cap-ok: links per task list
            },
            system,
        ),
    ]);

    const taskMap = new Map<string, RawTaskRow>();
    for (const t of tasksRes.Results ?? []) {
        taskMap.set(t.ID.toLowerCase(), t);
    }
    const linksByTask = new Map<string, RawTaskLinkRow[]>();
    for (const l of linksRes.Results ?? []) {
        const key = l.TaskID.toLowerCase();
        const arr = linksByTask.get(key) ?? [];
        arr.push(l);
        linksByTask.set(key, arr);
    }

    const draftItemIds = [
        ...new Set(
            (linksRes.Results ?? [])
                .filter((l) => l.EntityID.toLowerCase() === itemsEntity.ID.toLowerCase())
                .map((l) => extractRecordUuid(l.RecordID))
                .filter((id): id is string => id !== null),
        ),
    ];
    const draftBandMap = new Map<string, { Band: Band; RecordID: string; ArtifactVersionID: string | null }>();
    if (draftItemIds.length > 0) {
        const draftItemsRes = await rv.RunView<{ ID: string; Band: Band; RecordID: string; ArtifactVersionID: string | null }>(
            {
                EntityName: ITEMS_ENTITY,
                ExtraFilter: `ID IN (${draftItemIds.map((id) => `'${escapeSql(id)}'`).join(', ')})`,
                Fields: ['ID', 'Band', 'RecordID', 'ArtifactVersionID'],
                ResultType: 'simple',
                MaxRows: 500, // row-cap-ok: matches draftItemIds bound
            },
            system,
        );
        for (const d of draftItemsRes.Results ?? []) {
            draftBandMap.set(d.ID.toLowerCase(), d);
        }
    }

    const out: SpaceDraftApprovalSummary[] = [];
    for (const ti of taskItems) {
        const tId = extractRecordUuid(ti.RecordID);
        if (!tId) continue;
        const taskRow = taskMap.get(tId.toLowerCase());
        if (!taskRow) continue;
        const links = linksByTask.get(tId.toLowerCase()) ?? [];
        const draftLink = links.find((l) => l.EntityID.toLowerCase() === itemsEntity.ID.toLowerCase());
        const draftItemId = draftLink ? extractRecordUuid(draftLink.RecordID) : null;
        if (!draftItemId) continue;
        const draftItem = draftBandMap.get(draftItemId.toLowerCase());
        if (!draftItem) continue;

        out.push({
            taskId: taskRow.ID,
            taskSpaceItemId: ti.ID,
            draftSpaceItemId: draftItemId,
            draftArtifactId: extractRecordUuid(draftItem.RecordID) ?? '',
            draftVersionId: parseUuid(draftItem.ArtifactVersionID) ?? '',
            spaceId: cleanSpaceId,
            title: taskRow.Name,
            band: draftItem.Band,
            taskStatus: taskRow.Status,
            taskLinkIds: links.map((l) => l.ID),
        });
    }

    return { ok: true, data: out };
}

/**
 * Loads a specific draft approval task by `taskId`, enforcing CA-3 Team-band privacy.
 */
export async function getSpaceApprovalTask(params: {
    provider: IMetadataProvider;
    callerUser: UserInfo;
    spaceId: string;
    taskId: string;
}): Promise<ApprovalWorkflowOutcome<SpaceDraftApprovalSummary>> {
    const cleanTaskId = parseUuid(params.taskId);
    if (!cleanTaskId) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Valid TaskID is required.' };
    }
    const listOutcome = await listSpaceApprovalTasks({
        provider: params.provider,
        callerUser: params.callerUser,
        spaceId: params.spaceId,
    });
    if (!listOutcome.ok) return listOutcome;
    const found = listOutcome.data.find((entry) => entry.taskId.toLowerCase() === cleanTaskId.toLowerCase());
    if (!found) {
        return { ok: false, code: 'NOT_FOUND', message: `Approval task ${cleanTaskId} was not found in space ${params.spaceId}.` };
    }
    return { ok: true, data: found };
}

/**
 * Records an explicit approval or rejection decision on an `APPROVAL_REQUEST` Task and,
 * when approved, atomically promotes the linked Team-band draft to the Shared band attributed
 * to the resolved per-root delivery principal (CA-2, CA-3, CA-4).
 */
export async function decideAndPromoteSpaceDraft(params: {
    provider: IMetadataProvider;
    approverUser: UserInfo;
    spaceId: string;
    taskId: string;
    decision: 'Approved' | 'Rejected';
    decisionNotes?: string;
    deliveryTarget?: {
        band?: Band;
    };
}): Promise<ApprovalWorkflowOutcome<SpaceDraftApprovalSummary>> {
    const cleanSpaceId = parseUuid(params.spaceId);
    const cleanTaskId = parseUuid(params.taskId);
    const callerId = parseUuid(params.approverUser?.ID);
    if (!cleanSpaceId || !cleanTaskId || !callerId) {
        return { ok: false, code: 'INVALID_INPUT', message: 'Valid SpaceID, TaskID, and approverUser are required.' };
    }

    const probe = await params.provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, params.approverUser);
    const system = await requireSystemUser(probe);
    let writeContext;
    try {
        writeContext = await loadWriteContext(probe, params.approverUser, cleanSpaceId, null);
    } catch (err) {
        return { ok: false, code: 'UNAUTHORIZED', message: err instanceof Error ? err.message : 'Space could not be read.' };
    }

    const spaceNode = writeContext.spaces.find((s) => s.id.toLowerCase() === cleanSpaceId.toLowerCase());
    if (!spaceNode) {
        return { ok: false, code: 'NOT_FOUND', message: `Space ${cleanSpaceId} was not found.` };
    }
    const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(params.approverUser, params.provider);
    const isOwner = spaceNode.ownerId.toLowerCase() === callerId.toLowerCase();
    const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, cleanSpaceId);

    const visibility = evaluateDraftApprovalTaskVisibility({ callerReach: reach, itemBand: 'Team', isAdmin });
    if (!visibility.allowed) {
        return { ok: false, code: 'PRIVACY_DENIED', message: visibility.reason };
    }
    const hasPromoteAuthority = isAdmin || isOwner || Boolean(reach?.role.canPromoteBand);
    if (!hasPromoteAuthority) {
        return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Approval refused: caller lacks CanPromoteBand or owner authority in this space.',
        };
    }
    if (spaceIsReadOnly(spaceNode)) {
        return { ok: false, code: 'READ_ONLY', message: 'Approval refused: space is read-only or closed.' };
    }

    const tasksEntity = params.provider.EntityByName(TASKS_ENTITY);
    const itemsEntity = params.provider.EntityByName(ITEMS_ENTITY);
    if (!tasksEntity || !itemsEntity) {
        return { ok: false, code: 'FAILED', message: 'Required Task or Space Items entity metadata is missing.' };
    }

    const rv = RunView.FromMetadataProvider(params.provider);
    const linksRes = await rv.RunView<RawTaskLinkRow>(
        {
            EntityName: TASK_LINKS_ENTITY,
            ExtraFilter: `TaskID = '${cleanTaskId}'`,
            Fields: ['ID', 'TaskID', 'EntityID', 'RecordID', 'Description'],
            ResultType: 'simple',
            MaxRows: 50, // row-cap-ok: links on a single approval task
        },
        system,
    );
    const links = linksRes.Success ? (linksRes.Results ?? []) : [];
    const spaceLink = links.find((l) => extractRecordUuid(l.RecordID)?.toLowerCase() === cleanSpaceId.toLowerCase());
    const draftItemLink = links.find((l) => l.EntityID.toLowerCase() === itemsEntity.ID.toLowerCase());
    const draftSpaceItemId = draftItemLink ? extractRecordUuid(draftItemLink.RecordID) : null;
    if (!spaceLink || !draftSpaceItemId) {
        return {
            ok: false,
            code: 'NOT_FOUND',
            message: `Approval task ${cleanTaskId} is not linked to space ${cleanSpaceId} and a Team draft item via TaskLink.`,
        };
    }

    const task = await params.provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS_ENTITY, system);
    if (!(await task.Load(cleanTaskId))) {
        return { ok: false, code: 'NOT_FOUND', message: `Approval task ${cleanTaskId} was not found.` };
    }
    if (task.Status === 'Completed' || task.Status === 'Cancelled') {
        return { ok: false, code: 'INVALID_STATE', message: `Approval task ${cleanTaskId} is already ${task.Status}.` };
    }

    const draftItem = await params.provider.GetEntityObject<SpaceItemEntityServer>(ITEMS_ENTITY, system);
    if (!(await draftItem.Load(draftSpaceItemId))) {
        return { ok: false, code: 'NOT_FOUND', message: `Linked draft SpaceItem ${draftSpaceItemId} was not found.` };
    }

    const outcomeId = await resolveDecisionOutcomeId(inputProviderOr(params.provider), system, params.decision);
    if (!outcomeId) {
        return {
            ok: false,
            code: 'FAILED',
            message: `TaskDecisionOutcome for '${params.decision}' is not configured.`,
        };
    }

    // Handle Rejection cleanly: draft stays private on Team band
    if (params.decision === 'Rejected') {
        const decisionRec = await params.provider.GetEntityObject<mjBizAppsTasksTaskDecisionEntity>(TASK_DECISIONS_ENTITY, system);
        decisionRec.NewRecord();
        decisionRec.TaskID = task.ID;
        decisionRec.OutcomeID = outcomeId;
        const personId = await callerPersonId(probe, params.approverUser);
        if (personId) decisionRec.DecidedByPersonID = personId;
        decisionRec.DecisionNotes = params.decisionNotes?.trim() || 'Rejected';
        await decisionRec.Save();

        task.Status = 'Cancelled';
        task.CompletionNotes = params.decisionNotes?.trim() || 'Draft promotion rejected; draft remains on Team band.';
        await task.Save();

        const activity = await params.provider.GetEntityObject<mjBizAppsTasksTaskActivityEntity>(TASK_ACTIVITIES_ENTITY, system);
        activity.NewRecord();
        activity.TaskID = task.ID;
        activity.ActivityType = 'DecisionRecorded';
        activity.NewValue = 'Rejected';
        activity.Description = `Draft promotion rejected by user ${params.approverUser.ID}; draft ${draftSpaceItemId} remains Team-private.`;
        await activity.Save();

        return {
            ok: true,
            data: {
                taskId: task.ID,
                taskSpaceItemId: '',
                draftSpaceItemId,
                draftArtifactId: extractRecordUuid(draftItem.RecordID) ?? '',
                draftVersionId: parseUuid(draftItem.ArtifactVersionID) ?? '',
                spaceId: cleanSpaceId,
                title: task.Name,
                band: draftItem.Band,
                taskStatus: task.Status,
                taskLinkIds: links.map((l) => l.ID),
                approvedByUserId: params.approverUser.ID,
                promotedByPrincipalUserId: null,
                promotedAt: null,
            },
        };
    }

    // Approval path: resolve per-root delivery principal FIRST (CA-4 fail-closed, never falls back to approver!)
    const principalOutcome = await resolvePerRootDeliveryPrincipal({
        provider: params.provider,
        systemUser: system,
        spaceId: cleanSpaceId,
    });
    if (!principalOutcome.ok) {
        return { ok: false, code: 'MISSING_PRINCIPAL', message: principalOutcome.message };
    }

    const gateVerdict = evaluateApprovalPromotionGate({
        callerUserId: params.approverUser.ID,
        callerReach: reach,
        isAdmin,
        isSpaceOwner: isOwner,
        spaceReadOnly: spaceIsReadOnly(spaceNode),
        itemBand: draftItem.Band,
        taskStatus: task.Status,
        hasApprovingDecision: true,
        hasRejectionDecision: false,
        deliveryPrincipalUserId: principalOutcome.principalUserId,
    });
    if (!gateVerdict.ok) {
        return { ok: false, code: gateVerdict.code, message: gateVerdict.message };
    }

    // Execute atomic promotion using TransactionGroup when supported by provider
    const tg: TransactionGroupBase | null =
        typeof params.provider.CreateTransactionGroup === 'function'
            ? await params.provider.CreateTransactionGroup()
            : null;

    const decisionRec = await params.provider.GetEntityObject<mjBizAppsTasksTaskDecisionEntity>(TASK_DECISIONS_ENTITY, system);
    decisionRec.NewRecord();
    decisionRec.TaskID = task.ID;
    decisionRec.OutcomeID = outcomeId;
    const approverPersonId = await callerPersonId(probe, params.approverUser);
    if (approverPersonId) decisionRec.DecidedByPersonID = approverPersonId;
    decisionRec.DecisionNotes = params.decisionNotes?.trim() || 'Approved for Shared band promotion';

    task.Status = 'Completed';
    task.CompletedAt = new Date();
    task.CompletionNotes = `Approved by ${params.approverUser.ID}; promoted under delivery principal ${principalOutcome.principalUserId}.`;

    const promotedItem = await params.provider.GetEntityObject<SpaceItemEntityServer>(
        ITEMS_ENTITY,
        principalOutcome.principalUser,
    );
    if (!(await promotedItem.Load(draftSpaceItemId))) {
        return { ok: false, code: 'NOT_FOUND', message: `Draft item ${draftSpaceItemId} could not be loaded under delivery principal.` };
    }
    vouchStoredFile(promotedItem);
    promotedItem.Band = 'Shared';

    const activity = await params.provider.GetEntityObject<mjBizAppsTasksTaskActivityEntity>(TASK_ACTIVITIES_ENTITY, system);
    activity.NewRecord();
    activity.TaskID = task.ID;
    activity.ActivityType = 'DecisionRecorded';
    activity.NewValue = 'Approved';
    activity.Description = `Draft ${draftSpaceItemId} approved by ${params.approverUser.ID} and promoted to Shared under delivery principal ${principalOutcome.principalUserId}.`;

    const promotedAt = new Date();
    if (tg) {
        decisionRec.TransactionGroup = tg;
        task.TransactionGroup = tg;
        promotedItem.TransactionGroup = tg;
        activity.TransactionGroup = tg;
        await decisionRec.Save();
        await task.Save();
        await promotedItem.Save();
        await activity.Save();
        const committed = await tg.Submit();
        if (!committed) {
            return { ok: false, code: 'FAILED', message: 'Atomic promotion transaction failed to commit.' };
        }
        decisionRec.TransactionGroup = null;
        task.TransactionGroup = null;
        promotedItem.TransactionGroup = null;
        activity.TransactionGroup = null;
    } else {
        if (!(await decisionRec.Save())) {
            return { ok: false, code: 'FAILED', message: decisionRec.LatestResult?.CompleteMessage ?? 'Failed to save approval TaskDecision.' };
        }
        if (!(await task.Save())) {
            await decisionRec.Delete();
            return { ok: false, code: 'FAILED', message: task.LatestResult?.CompleteMessage ?? 'Failed to complete approval Task.' };
        }
        if (!(await promotedItem.Save())) {
            task.Status = 'Open';
            task.CompletedAt = null;
            await task.Save();
            await decisionRec.Delete();
            return {
                ok: false,
                code: 'FAILED',
                message: promotedItem.LatestResult?.CompleteMessage ?? 'Failed to promote draft item to Shared band.',
            };
        }
        await activity.Save();
    }

    // Write structured audit log recording both approver and per-root delivery principal
    const writer = params.provider as IMetadataProvider & AuditWriterProvider;
    if (typeof writer.CreateAuditLogRecord === 'function') {
        try {
            await writer.CreateAuditLogRecord(
                principalOutcome.principalUser,
                null,
                DRAFT_PROMOTED_AUDIT_LOG_TYPE,
                'Success',
                JSON.stringify({
                    event: 'DraftPromotedToShared',
                    spaceId: cleanSpaceId,
                    taskId: task.ID,
                    draftSpaceItemId,
                    approvedByUserId: params.approverUser.ID,
                    deliveryPrincipalUserId: principalOutcome.principalUserId,
                    rootSpaceId: principalOutcome.rootSpaceId,
                    sourceLevel: principalOutcome.sourceLevel,
                }),
                itemsEntity.ID,
                draftSpaceItemId,
                `Draft item ${draftSpaceItemId} promoted to Shared under delivery principal ${principalOutcome.principalUserId}`,
                null,
            );
        } catch (err) {
            LogError(`decideAndPromoteSpaceDraft: audit log write failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return {
        ok: true,
        data: {
            taskId: task.ID,
            taskSpaceItemId: '',
            draftSpaceItemId,
            draftArtifactId: extractRecordUuid(promotedItem.RecordID) ?? '',
            draftVersionId: parseUuid(promotedItem.ArtifactVersionID) ?? '',
            spaceId: cleanSpaceId,
            title: task.Name,
            band: promotedItem.Band,
            taskStatus: task.Status,
            taskLinkIds: links.map((l) => l.ID),
            approvedByUserId: params.approverUser.ID,
            promotedByPrincipalUserId: principalOutcome.principalUserId,
            promotedAt: promotedItem.PromotedAt ?? promotedAt,
        },
    };
}

function inputProviderOr(provider: IMetadataProvider): IMetadataProvider {
    return provider;
}

function inputEntity(provider: IMetadataProvider, name: string) {
    return typeof provider.EntityByName === 'function' ? provider.EntityByName(name) : null;
}
