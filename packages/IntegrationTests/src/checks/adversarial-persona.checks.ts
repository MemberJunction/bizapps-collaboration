import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { RunView, type BaseEntity, type UserInfo } from '@memberjunction/core';
import {
    MJAIAgentEntity,
    MJAIAgentRunEntity,
    MJAIAgentRunStepEntity,
    MJAIPromptRunEntity,
    MJContentItemChunkEntity,
    MJContentItemEntity,
    MJEntityRecordDocumentEntity,
    MJRoleEntity,
    MJSearchScopeEntity,
    MJSearchScopePermissionEntity,
    MJUserEntity,
    MJUserRoleEntity,
} from '@memberjunction/core-entities';
import { SearchEngine } from '@memberjunction/search-engine';
import { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';
import {
    mjBizAppsTasksMeetingEntity,
    mjBizAppsTasksTaskEntity,
} from '@mj-biz-apps/tasks-entities';
import type { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import {
    collaborationFileStore,
    createSpaceConversation,
    createSpaceMeeting,
    createSpaceTask,
    decideUploadBand,
    ensureMeetingSpaceChat,
    executeSpaceChatTurn,
    mintSpaceLink,
    postSpaceMessage,
    uploadSpaceFile,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { COLLABORATION_TEST_AGENT_ID, COLLABORATION_TEST_AGENT_NAME } from '../agents/test-agent.js';
import {
    AI_AGENT_ENTITY,
    CONVERSATION_DETAIL_ENTITY,
    FILE_ENTITY,
    PERSON_ENTITY,
    SEARCH_SCOPE_ENTITY,
    SEARCH_SCOPE_PERMISSION_ENTITY,
    SHARE_NOTICE_ENTITY,
    SPACE_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    TASK_ACTIVITY_ENTITY,
    TASK_ENTITY,
    TASK_LINK_ENTITY,
    USER_ENTITY,
    USER_ROLE_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser, SameID, View } from '../wire.js';
import { getPersonaContext, type PersonaIntegrationCheckContext } from '../persona-provider.js';
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount } from '../world/local-storage-account.js';
import { worldStorageRoot } from '../world/seed-files.js';
import { cleanupConversation, cleanupStep, deleteRowAndConfirm, deleteWhere, registerChecks, runAllSteps } from './cleanup-helpers.js';
import { makePdf, purgeTestSpaceItemPipelineRows, waitForSpaceItemPipeline } from './content-pipeline-fixtures.js';
import { attachTestAgent, detachTestAgent } from './test-agent-attachment.js';

const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const HARBOR_SPACE_ID = 'C1000001-0000-4000-8000-000000000006';
const COLLABORATION_SEARCH_SCOPE_ID = '6E5187CF-7E5B-447F-893D-D291994083C0';
const PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';

const AGENT_RUN_ENTITY = 'MJ: AI Agent Runs';
const AGENT_RUN_STEP_ENTITY = 'MJ: AI Agent Run Steps';
const PROMPT_RUN_ENTITY = 'MJ: AI Prompt Runs';
const CONTENT_ITEM_ENTITY = 'MJ: Content Items';
const CONTENT_ITEM_CHUNK_ENTITY = 'MJ: Content Item Chunks';
const ENTITY_RECORD_DOCUMENT_ENTITY = 'MJ: Entity Record Documents';
const MEETING_ENTITY = 'MJ_BizApps_Tasks: Meetings';
const MEETING_ATTENDEE_ENTITY = 'MJ_BizApps_Tasks: Meeting Attendees';
const MEETING_LINK_ENTITY = 'MJ_BizApps_Tasks: Meeting Links';
const ROLE_ENTITY = 'MJ: Roles';
const ITEM_USE_ENTITY = 'MJ_BizApps_Collaboration: Item Uses';

const MARK = 'COLLAB-CHECK ap';

let bundleTestAgentAttachmentId: string | null = null;

function asPersona(ctx: IntegrationCheckContext, persona: PersonaIntegrationCheckContext): IntegrationCheckContext {
    return { ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext;
}

function asUser(ctx: IntegrationCheckContext, user: UserInfo): IntegrationCheckContext {
    const provider = Object.create(ctx.Provider);
    Object.defineProperty(provider, 'CurrentUser', {
        value: user,
        configurable: true,
        enumerable: true,
    });
    return { ...ctx, Provider: provider, User: user } as IntegrationCheckContext;
}

async function resolveDiscoveryTaskRoots(ctx: IntegrationCheckContext): Promise<{ sharedRootId: string; teamRootId: string; sharedName: string; teamName: string }> {
    const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
    Assert(!!taskEntity, 'Task entity metadata exists');
    const items = await FindRows<{ RecordID: string; Band: string }>(
        ctx,
        SPACE_ITEM_ENTITY,
        `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${taskEntity!.ID}'`,
        ['RecordID', 'Band'],
    );
    const rootOf = (raw: string): string => (raw.toLowerCase().startsWith('id|') ? raw.slice(3) : raw);
    const sharedItem = items.find((i) => i.Band === 'Shared');
    const teamItem = items.find((i) => i.Band === 'Team');
    Assert(!!sharedItem && !!teamItem, 'Discovery holds both a Shared and a Team root task');
    const sharedRootId = rootOf(sharedItem!.RecordID);
    const teamRootId = rootOf(teamItem!.RecordID);
    const [sharedRow] = await FindRows<{ Name: string }>(ctx, TASK_ENTITY, `ID = '${sharedRootId}'`, ['Name']);
    const [teamRow] = await FindRows<{ Name: string }>(ctx, TASK_ENTITY, `ID = '${teamRootId}'`, ['Name']);
    Assert(!!sharedRow?.Name && !!teamRow?.Name, 'Discovery Shared and Team root tasks have names');
    return { sharedRootId, teamRootId, sharedName: sharedRow!.Name, teamName: teamRow!.Name };
}

async function cleanupTaskWithLinks(ctx: IntegrationCheckContext, taskId: string | null, itemId: string | null): Promise<void> {
    await runAllSteps([
        ...(itemId ? [() => deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${itemId}'`, 'AP share notice')] : []),
        ...(itemId ? [() => deleteWhere(ctx.Provider, ctx.User, ITEM_USE_ENTITY, `ItemID = '${itemId}'`, 'AP item use')] : []),
        ...(itemId ? [() => deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, itemId, 'AP space item')] : []),
        ...(taskId ? [() => deleteWhere(ctx.Provider, ctx.User, TASK_LINK_ENTITY, `TaskID = '${taskId}'`, 'AP task link')] : []),
        ...(taskId ? [() => deleteWhere(ctx.Provider, ctx.User, TASK_ACTIVITY_ENTITY, `TaskID = '${taskId}'`, 'AP task activity')] : []),
        ...(taskId ? [() => deleteRowAndConfirm(ctx.Provider, ctx.User, TASK_ENTITY, taskId, 'AP task')] : []),
    ]);
}

async function cleanupMeetingRows(ctx: IntegrationCheckContext, meetingId: string | null): Promise<void> {
    if (!meetingId) return;
    const items = await FindRows<{ ID: string }>(
        ctx,
        SPACE_ITEM_ENTITY,
        `RecordID IN ('${meetingId}', 'ID|${meetingId}')`,
        ['ID'],
        undefined,
        { BypassCache: true },
    );
    for (const item of items) {
        await deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${item.ID}'`, 'AP meeting share notice');
        await deleteWhere(ctx.Provider, ctx.User, ITEM_USE_ENTITY, `ItemID = '${item.ID}'`, 'AP meeting item use');
    }
    await deleteWhere(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, `RecordID IN ('${meetingId}', 'ID|${meetingId}')`, 'AP meeting item');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_LINK_ENTITY, `MeetingID = '${meetingId}'`, 'AP meeting link');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_ATTENDEE_ENTITY, `MeetingID = '${meetingId}'`, 'AP meeting attendees');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_ENTITY, `ID = '${meetingId}'`, 'AP meeting');
}

async function assertFieldAccessDeniedOrOmitted(
    ctx: IntegrationCheckContext,
    actor: UserInfo,
    agentId: string,
    label: string,
): Promise<void> {
    const safeRes = await RunView.FromMetadataProvider(ctx.Provider).RunView<{ ID: string; Name: string }>(
        {
            EntityName: AI_AGENT_ENTITY,
            ExtraFilter: `ID = '${agentId}'`,
            Fields: ['ID', 'Name'],
            ResultType: 'simple',
            BypassCache: true,
        },
        actor,
    );
    Assert(safeRes.Success && (safeRes.Results?.length ?? 0) === 1, `${label}: reads safe fields on MJ: AI Agents (${safeRes.ErrorMessage ?? ''})`);

    const ownerRes = await RunView.FromMetadataProvider(ctx.Provider).RunView<{
        ID: string;
        Name: string;
        OwnerUserID?: string | null;
        OwnerUser?: string | null;
    }>(
        {
            EntityName: AI_AGENT_ENTITY,
            ExtraFilter: `ID = '${agentId}'`,
            Fields: ['ID', 'Name', 'OwnerUserID', 'OwnerUser'],
            ResultType: 'simple',
            BypassCache: true,
        },
        actor,
    );

    if (!ownerRes.Success) {
        const msg = (ownerRes.ErrorMessage ?? '').toLowerCase();
        Assert(
            msg.includes('permission') || msg.includes('security') || msg.includes('denied') || msg.includes('access'),
            `${label}: expected FLS/permission denial on OwnerUser/OwnerUserID, got: ${ownerRes.ErrorMessage ?? ''}`,
        );
        return;
    }

    for (const row of ownerRes.Results ?? []) {
        Assert(row.OwnerUserID == null || row.OwnerUserID === '', `${label}: OwnerUserID leaked: ${row.OwnerUserID}`);
        Assert(row.OwnerUser == null || row.OwnerUser === '', `${label}: OwnerUser leaked: ${row.OwnerUser}`);
    }
}

interface PersistedTurnRunIds {
    runId: string;
    stepId: string;
    promptRunId: string;
}

function assertAIRunTurnRefusal(entity: BaseEntity, entityName: string, label: string): void {
    const msg = entity.LatestResult?.CompleteMessage ?? entity.LatestResult?.Message ?? '';
    Assert(
        msg.includes(`Space Participant cannot create or mutate ${entityName} outside an active space chat turn`) ||
            msg.includes(`Direct client CRUD on ${entityName} is forbidden for Space Participant`),
        `${label}: expected turn-authority refusal for ${entityName}, got: "${msg}"`,
    );
}

function assertAIRunDeleteRefusal(entity: BaseEntity, entityName: string, label: string): void {
    const msg = (entity.LatestResult?.CompleteMessage ?? entity.LatestResult?.Message ?? '').toLowerCase();
    Assert(
        msg.includes('cannot delete') || msg.includes('permission') || msg.includes('denied') || msg.includes('forbidden') || msg.includes('delete'),
        `${label}: expected delete/permission denial for ${entityName}, got: "${msg}"`,
    );
}

async function assertDirectAIRunLockdown(
    ctx: IntegrationCheckContext,
    actor: UserInfo,
    seed: { agentId: string; promptId: string; modelId: string; vendorId: string },
    validAgentRunId: string,
    label: string,
): Promise<void> {
    const runAttempt = await ctx.Provider.GetEntityObject<MJAIAgentRunEntity>(AGENT_RUN_ENTITY, actor);
    runAttempt.NewRecord();
    runAttempt.AgentID = seed.agentId;
    runAttempt.UserID = actor.ID;
    runAttempt.Status = 'Running';
    runAttempt.StartedAt = new Date();
    const runSaved = await runAttempt.Save();
    Assert(!runSaved, `${label}: direct create on ${AGENT_RUN_ENTITY} must be refused`);
    assertAIRunTurnRefusal(runAttempt, AGENT_RUN_ENTITY, `${label} run create`);

    const stepAttempt = await ctx.Provider.GetEntityObject<MJAIAgentRunStepEntity>(AGENT_RUN_STEP_ENTITY, actor);
    stepAttempt.NewRecord();
    stepAttempt.AgentRunID = validAgentRunId;
    stepAttempt.StepNumber = 99;
    stepAttempt.StepType = 'Prompt';
    stepAttempt.StepName = 'AP forged step';
    stepAttempt.Status = 'Running';
    stepAttempt.StartedAt = new Date();
    const stepSaved = await stepAttempt.Save();
    Assert(!stepSaved, `${label}: direct create on ${AGENT_RUN_STEP_ENTITY} must be refused`);
    assertAIRunTurnRefusal(stepAttempt, AGENT_RUN_STEP_ENTITY, `${label} step create`);

    const promptAttempt = await ctx.Provider.GetEntityObject<MJAIPromptRunEntity>(PROMPT_RUN_ENTITY, actor);
    promptAttempt.NewRecord();
    promptAttempt.PromptID = seed.promptId;
    promptAttempt.ModelID = seed.modelId;
    promptAttempt.VendorID = seed.vendorId;
    promptAttempt.RunAt = new Date();
    promptAttempt.Success = true;
    promptAttempt.RunType = 'Single';
    const promptSaved = await promptAttempt.Save();
    Assert(!promptSaved, `${label}: direct create on ${PROMPT_RUN_ENTITY} must be refused`);
    assertAIRunTurnRefusal(promptAttempt, PROMPT_RUN_ENTITY, `${label} prompt create`);
}

async function assertTurnPersistedAllThreeEntities(
    ctx: IntegrationCheckContext,
    ownerCtx: IntegrationCheckContext,
    conversationId: string,
    label: string,
): Promise<PersistedTurnRunIds> {
    const persistedRuns = await FindRows<{ ID: string; UserID: string | null }>(
        ctx,
        AGENT_RUN_ENTITY,
        `ConversationID = '${conversationId}'`,
        ['ID', 'UserID'],
        undefined,
        { BypassCache: true },
    );
    Assert(persistedRuns.length >= 1, `${label}: server turn persisted AI Agent Run record`);
    const runId = persistedRuns[0].ID;
    Assert(SameID(persistedRuns[0].UserID, ownerCtx.User.ID), `${label}: persisted AI Agent Run is owned by caller`);

    const persistedSteps = await FindRows<{ ID: string; StepType: string; Status: string; TargetLogID: string | null }>(
        ctx,
        AGENT_RUN_STEP_ENTITY,
        `AgentRunID = '${runId}'`,
        ['ID', 'StepType', 'Status', 'TargetLogID'],
        undefined,
        { BypassCache: true },
    );
    const promptStep = persistedSteps.find((s) => s.StepType === 'Prompt' && !!s.TargetLogID);
    Assert(!!promptStep && promptStep.Status === 'Completed', `${label}: server turn persisted completed AI Agent Run Step`);
    const stepId = promptStep!.ID;
    const promptRunId = promptStep!.TargetLogID!;

    const persistedPrompts = await FindRows<{ ID: string; Success: boolean }>(
        ctx,
        PROMPT_RUN_ENTITY,
        `ID = '${promptRunId}'`,
        ['ID', 'Success'],
        undefined,
        { BypassCache: true },
    );
    Assert(persistedPrompts.length === 1 && persistedPrompts[0].Success === true, `${label}: server turn persisted AI Prompt Run`);

    // Owner can read all three via Own* RLS filters
    const ownerRuns = await FindRows<{ ID: string }>(ownerCtx, AGENT_RUN_ENTITY, `ID = '${runId}'`, ['ID'], ownerCtx.User, { BypassCache: true });
    const ownerSteps = await FindRows<{ ID: string }>(ownerCtx, AGENT_RUN_STEP_ENTITY, `ID = '${stepId}'`, ['ID'], ownerCtx.User, { BypassCache: true });
    const ownerPrompts = await FindRows<{ ID: string }>(ownerCtx, PROMPT_RUN_ENTITY, `ID = '${promptRunId}'`, ['ID'], ownerCtx.User, { BypassCache: true });
    Assert(
        ownerRuns.length === 1 && ownerSteps.length === 1 && ownerPrompts.length === 1,
        `${label}: owner reads persisted AgentRun, AgentRunStep, and PromptRun`,
    );

    return { runId, stepId, promptRunId };
}

async function assertPostTurnOwnerLockdown(
    ctx: IntegrationCheckContext,
    ownerUser: UserInfo,
    ids: PersistedTurnRunIds,
    label: string,
): Promise<void> {
    const postTurnRun = await ctx.Provider.GetEntityObject<MJAIAgentRunEntity>(AGENT_RUN_ENTITY, ownerUser);
    Assert(await postTurnRun.Load(ids.runId), `${label}: owner MUST Load persisted AI Agent Run ${ids.runId}`);
    postTurnRun.Result = 'post-turn-tamper';
    Assert(!(await postTurnRun.Save()), `${label}: owner MUST NOT mutate AI Agent Run after turn completes`);
    assertAIRunTurnRefusal(postTurnRun, AGENT_RUN_ENTITY, `${label} run update`);
    Assert(!(await postTurnRun.Delete()), `${label}: owner MUST NOT delete AI Agent Run after turn completes`);
    assertAIRunDeleteRefusal(postTurnRun, AGENT_RUN_ENTITY, `${label} run delete`);

    const postTurnStep = await ctx.Provider.GetEntityObject<MJAIAgentRunStepEntity>(AGENT_RUN_STEP_ENTITY, ownerUser);
    Assert(await postTurnStep.Load(ids.stepId), `${label}: owner MUST Load persisted AI Agent Run Step ${ids.stepId}`);
    postTurnStep.StepName = 'post-turn-step-tamper';
    Assert(!(await postTurnStep.Save()), `${label}: owner MUST NOT mutate AI Agent Run Step after turn completes`);
    assertAIRunTurnRefusal(postTurnStep, AGENT_RUN_STEP_ENTITY, `${label} step update`);
    Assert(!(await postTurnStep.Delete()), `${label}: owner MUST NOT delete AI Agent Run Step after turn completes`);
    assertAIRunDeleteRefusal(postTurnStep, AGENT_RUN_STEP_ENTITY, `${label} step delete`);

    const postTurnPrompt = await ctx.Provider.GetEntityObject<MJAIPromptRunEntity>(PROMPT_RUN_ENTITY, ownerUser);
    Assert(await postTurnPrompt.Load(ids.promptRunId), `${label}: owner MUST Load persisted AI Prompt Run ${ids.promptRunId}`);
    postTurnPrompt.Result = 'post-turn-prompt-tamper';
    Assert(!(await postTurnPrompt.Save()), `${label}: owner MUST NOT mutate AI Prompt Run after turn completes`);
    assertAIRunTurnRefusal(postTurnPrompt, PROMPT_RUN_ENTITY, `${label} prompt update`);
    Assert(!(await postTurnPrompt.Delete()), `${label}: owner MUST NOT delete AI Prompt Run after turn completes`);
    assertAIRunDeleteRefusal(postTurnPrompt, PROMPT_RUN_ENTITY, `${label} prompt delete`);
}

async function assertCrossUserRunIsolation(
    otherCtx: IntegrationCheckContext,
    ids: PersistedTurnRunIds,
    label: string,
): Promise<void> {
    const runs = await FindRows<{ ID: string }>(otherCtx, AGENT_RUN_ENTITY, `ID = '${ids.runId}'`, ['ID'], otherCtx.User, { BypassCache: true });
    const steps = await FindRows<{ ID: string }>(otherCtx, AGENT_RUN_STEP_ENTITY, `ID = '${ids.stepId}'`, ['ID'], otherCtx.User, { BypassCache: true });
    const prompts = await FindRows<{ ID: string }>(otherCtx, PROMPT_RUN_ENTITY, `ID = '${ids.promptRunId}'`, ['ID'], otherCtx.User, { BypassCache: true });
    Assert(
        runs.length === 0 && steps.length === 0 && prompts.length === 0,
        `${label}: cross-user MUST NOT read AgentRun, AgentRunStep, or PromptRun`,
    );

    const runObj = await otherCtx.Provider.GetEntityObject<MJAIAgentRunEntity>(AGENT_RUN_ENTITY, otherCtx.User);
    const stepObj = await otherCtx.Provider.GetEntityObject<MJAIAgentRunStepEntity>(AGENT_RUN_STEP_ENTITY, otherCtx.User);
    const promptObj = await otherCtx.Provider.GetEntityObject<MJAIPromptRunEntity>(PROMPT_RUN_ENTITY, otherCtx.User);
    Assert(!(await runObj.Load(ids.runId)), `${label}: cross-user Load(AgentRun) must fail`);
    Assert(!(await stepObj.Load(ids.stepId)), `${label}: cross-user Load(AgentRunStep) must fail`);
    Assert(!(await promptObj.Load(ids.promptRunId)), `${label}: cross-user Load(PromptRun) must fail`);
}

async function resolvePromptSeed(ctx: IntegrationCheckContext): Promise<{ agentId: string; promptId: string; modelId: string; vendorId: string }> {
    const [prompt] = await FindRows<{ ID: string }>(ctx, 'MJ: AI Prompts', '', ['ID']);
    const [model] = await FindRows<{ ID: string }>(ctx, 'MJ: AI Models', '', ['ID']);
    const [vendor] = await FindRows<{ ID: string }>(ctx, 'MJ: AI Vendors', '', ['ID']);
    Assert(!!prompt?.ID && !!model?.ID && !!vendor?.ID, 'Seeded AI Prompt, Model, and Vendor rows exist');
    return {
        agentId: COLLABORATION_TEST_AGENT_ID,
        promptId: prompt!.ID,
        modelId: model!.ID,
        vendorId: vendor!.ID,
    };
}

const checks: NamedCheck[] = [
    {
        Id: 'adversarial-persona.AP1',
        Name: 'AP1 — Tasks adversarial read/write boundaries across spaces, bands, and outsider personas',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const harperCtx = await getPersonaContext(ctx, 'harper');
            const { sharedRootId, teamRootId } = await resolveDiscoveryTaskRoots(ctx);
            const stamp = Date.now();
            let createdTaskId: string | null = null;
            let createdItemId: string | null = null;

            try {
                // 1. Read boundaries
                const beaShared = await FindRows<{ ID: string }>(asPersona(ctx, beaCtx), TASK_ENTITY, `ID = '${sharedRootId}'`, ['ID'], beaCtx.User, { BypassCache: true });
                Assert(beaShared.length === 1, 'Bea reads Discovery Shared root task');

                const beaTeam = await FindRows<{ ID: string }>(asPersona(ctx, beaCtx), TASK_ENTITY, `ID = '${teamRootId}'`, ['ID'], beaCtx.User, { BypassCache: true });
                Assert(beaTeam.length === 0, 'Bea MUST NOT read Discovery Team task');

                const harperShared = await FindRows<{ ID: string }>(asPersona(ctx, harperCtx), TASK_ENTITY, `ID = '${sharedRootId}'`, ['ID'], harperCtx.User, { BypassCache: true });
                const harperTeam = await FindRows<{ ID: string }>(asPersona(ctx, harperCtx), TASK_ENTITY, `ID = '${teamRootId}'`, ['ID'], harperCtx.User, { BypassCache: true });
                Assert(harperShared.length === 0 && harperTeam.length === 0, 'Harper (Harbor outsider) MUST NOT read Discovery Shared or Team tasks');

                // 2. Adversarial write boundaries (direct entity load/save/delete & cross-band/cross-space filing)
                const beaTeamLoad = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
                Assert(!(await beaTeamLoad.Load(teamRootId)), 'Bea MUST NOT Load Discovery Team task');

                const beaNorthwindAttempt = await createSpaceTask(ctx.Provider, beaCtx.User, {
                    spaceId: NORTHWIND_SPACE_ID,
                    name: `${MARK} AP1 northwind trespass ${stamp}`,
                    band: 'Shared',
                });
                Assert(!beaNorthwindAttempt.ok, 'Bea cannot file task into Northwind (outside her reach)');

                const beaTeamBandAttempt = await createSpaceTask(ctx.Provider, beaCtx.User, {
                    spaceId: DISCOVERY_SPACE_ID,
                    name: `${MARK} AP1 team band escalation ${stamp}`,
                    band: 'Team',
                });
                Assert(!beaTeamBandAttempt.ok, 'Bea cannot file task into Team band on Discovery');

                const harperDiscoveryAttempt = await createSpaceTask(ctx.Provider, harperCtx.User, {
                    spaceId: DISCOVERY_SPACE_ID,
                    name: `${MARK} AP1 harper discovery trespass ${stamp}`,
                    band: 'Shared',
                });
                Assert(!harperDiscoveryAttempt.ok, 'Harper cannot file task into Discovery');

                const beaDeleteAttempt = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
                Assert(await beaDeleteAttempt.Load(sharedRootId), 'Bea can Load Shared task for read');
                Assert(!(await beaDeleteAttempt.Delete()), 'Space Participant Bea MUST NOT delete tasks');

                // 3. Positive control: Bea files a Shared task in Discovery
                const created = await createSpaceTask(ctx.Provider, beaCtx.User, {
                    spaceId: DISCOVERY_SPACE_ID,
                    name: `${MARK} AP1 shared followup ${stamp}`,
                    band: 'Shared',
                });
                Assert(created.ok === true, `Bea can file a Shared task in Discovery: ${created.ok ? '' : created.message}`);
                if (created.ok) {
                    createdTaskId = created.taskId;
                    createdItemId = created.itemId;
                }
            } finally {
                await cleanupTaskWithLinks(ctx, createdTaskId, createdItemId);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP2',
        Name: 'AP2 — Meetings adversarial read/write boundaries across visibility, attendee reach, and space boundaries',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const caseyCtx = await getPersonaContext(ctx, 'casey');
            const harperCtx = await getPersonaContext(ctx, 'harper');
            const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
            const endsAt = new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString();
            const stamp = Date.now();

            let stdMeetingId: string | null = null;
            let privMeetingId: string | null = null;
            let stdChat: { conversationId: string; spaceChatId: string } | null = null;

            try {
                const stdRes = await createSpaceMeeting(ctx.Provider, ada, {
                    spaceId: NORTHWIND_SPACE_ID,
                    name: `${MARK} AP2 Standard ${stamp}`,
                    startsAt,
                    endsAt,
                    timeZone: 'America/Chicago',
                    locationType: 'Virtual',
                    visibility: 'Standard',
                });
                Assert(stdRes.ok === true, `Ada schedules Northwind Standard meeting: ${stdRes.ok ? '' : stdRes.message}`);
                if (!stdRes.ok) throw new Error(stdRes.message);
                stdMeetingId = stdRes.meetingId;

                const privRes = await createSpaceMeeting(ctx.Provider, ada, {
                    spaceId: NORTHWIND_SPACE_ID,
                    name: `${MARK} AP2 Private ${stamp}`,
                    startsAt,
                    endsAt,
                    timeZone: 'America/Chicago',
                    locationType: 'Virtual',
                    visibility: 'Private',
                });
                Assert(privRes.ok === true, `Ada schedules Northwind Private meeting: ${privRes.ok ? '' : privRes.message}`);
                if (!privRes.ok) throw new Error(privRes.message);
                privMeetingId = privRes.meetingId;

                // Casey reaches Northwind Shared -> sees Standard, NOT Private
                const caseyStd = await FindRows<{ ID: string }>(asPersona(ctx, caseyCtx), MEETING_ENTITY, `ID = '${stdMeetingId}'`, ['ID'], caseyCtx.User, { BypassCache: true });
                const caseyPriv = await FindRows<{ ID: string }>(asPersona(ctx, caseyCtx), MEETING_ENTITY, `ID = '${privMeetingId}'`, ['ID'], caseyCtx.User, { BypassCache: true });
                Assert(caseyStd.length === 1, 'Casey sees Northwind Standard meeting');
                Assert(caseyPriv.length === 0, 'Casey MUST NOT read Northwind Private meeting without attendance');

                // Harper (Harbor outsider) sees neither
                const harperBoth = await FindRows<{ ID: string }>(
                    asPersona(ctx, harperCtx),
                    MEETING_ENTITY,
                    `ID IN ('${stdMeetingId}', '${privMeetingId}')`,
                    ['ID'],
                    harperCtx.User,
                    { BypassCache: true },
                );
                Assert(harperBoth.length === 0, 'Harper MUST NOT read any Northwind meeting');

                // Adversarial meeting chat / mutation probes
                const caseyPrivChat = await ensureMeetingSpaceChat(ctx.Provider, {
                    spaceId: NORTHWIND_SPACE_ID,
                    meetingId: privMeetingId,
                    meetingName: `${MARK} AP2 Private ${stamp}`,
                    visibility: 'Private',
                    contextUser: caseyCtx.User,
                });
                Assert(!caseyPrivChat.ok, 'Non-attendee Casey cannot ensure chat for Private meeting');

                const caseyDiscoveryMeeting = await createSpaceMeeting(ctx.Provider, caseyCtx.User, {
                    spaceId: DISCOVERY_SPACE_ID,
                    name: `${MARK} AP2 Casey Trespass ${stamp}`,
                    startsAt,
                    endsAt,
                    timeZone: 'America/Chicago',
                    locationType: 'Virtual',
                    visibility: 'Standard',
                });
                Assert(!caseyDiscoveryMeeting.ok, 'Casey cannot schedule a meeting in Discovery (outside reach)');

                const harperNorthwindMeeting = await createSpaceMeeting(ctx.Provider, harperCtx.User, {
                    spaceId: NORTHWIND_SPACE_ID,
                    name: `${MARK} AP2 Harper Trespass ${stamp}`,
                    startsAt,
                    endsAt,
                    timeZone: 'America/Chicago',
                    locationType: 'Virtual',
                    visibility: 'Standard',
                });
                Assert(!harperNorthwindMeeting.ok, 'Harper cannot schedule a meeting in Northwind');

                // Direct entity create & delete refused for Space Participant
                const [meetingType] = await FindRows<{ ID: string }>(ctx, 'MJ_BizApps_Tasks: Meeting Types', '', ['ID']);
                const directMeeting = await caseyCtx.Provider.GetEntityObject<mjBizAppsTasksMeetingEntity>(MEETING_ENTITY, caseyCtx.User);
                directMeeting.NewRecord();
                directMeeting.Name = `${MARK} AP2 Direct Forgery ${stamp}`;
                directMeeting.Status = 'Scheduled';
                directMeeting.StartsAt = new Date(startsAt);
                directMeeting.EndsAt = new Date(endsAt);
                directMeeting.TimeZone = 'America/Chicago';
                directMeeting.LocationType = 'Virtual';
                if (meetingType?.ID) directMeeting.TypeID = meetingType.ID;
                Assert(!(await directMeeting.Save()), 'Space Participant direct Save() on Meetings must be refused');

                const caseyLoadStd = await caseyCtx.Provider.GetEntityObject<mjBizAppsTasksMeetingEntity>(MEETING_ENTITY, caseyCtx.User);
                Assert(await caseyLoadStd.Load(stdMeetingId), 'Casey loads Northwind Standard meeting');
                Assert(!(await caseyLoadStd.Delete()), 'Space Participant Delete() on Meetings must be refused');

                // Positive control: Ada opens Standard meeting chat and Casey cannot trespass into Private chat
                const adaChat = await ensureMeetingSpaceChat(ctx.Provider, {
                    spaceId: NORTHWIND_SPACE_ID,
                    meetingId: stdMeetingId,
                    meetingName: `${MARK} AP2 Standard ${stamp}`,
                    visibility: 'Standard',
                    contextUser: ada,
                });
                Assert(adaChat.ok === true, `Ada ensures Standard meeting chat: ${adaChat.ok ? '' : adaChat.message}`);
                if (adaChat.ok) stdChat = { conversationId: adaChat.conversationId, spaceChatId: adaChat.spaceChatId };
            } finally {
                if (stdChat) await cleanupConversation(ctx.Provider, ctx.User, stdChat.conversationId, stdChat.spaceChatId);
                await cleanupMeetingRows(ctx, privMeetingId);
                await cleanupMeetingRows(ctx, stdMeetingId);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP3',
        Name: 'AP3 — Content items, entity record documents, and content chunks enforce Shared/Team/outsider read boundaries and block direct writes',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
            const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
            const ada = await GetPersonaUser(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const harperCtx = await getPersonaContext(ctx, 'harper');
            const stamp = Date.now();

            const createdItemIds: string[] = [];
            const createdFileIds: string[] = [];

            try {
                const sharedUpload = await uploadSpaceFile({
                    user: ada,
                    storageUser: ctx.User,
                    provider: ctx.Provider,
                    store,
                    spaceId: DISCOVERY_SPACE_ID,
                    folder: 'Pipeline',
                    fileName: `ap3-shared-${stamp}.pdf`,
                    mimeType: 'application/pdf',
                    content: makePdf(`AP3 Shared Deliverable Token${stamp}`),
                    gate: () => decideUploadBand(ctx.Provider, ada, DISCOVERY_SPACE_ID, 'Shared'),
                });
                Assert(sharedUpload.ok, `Shared PDF upload succeeded: ${sharedUpload.ok ? '' : sharedUpload.message}`);
                if (!sharedUpload.ok) throw new Error(sharedUpload.message);
                createdItemIds.push(sharedUpload.itemId);
                createdFileIds.push(sharedUpload.fileId);

                const teamUpload = await uploadSpaceFile({
                    user: ada,
                    storageUser: ctx.User,
                    provider: ctx.Provider,
                    store,
                    spaceId: DISCOVERY_SPACE_ID,
                    folder: 'Pipeline',
                    fileName: `ap3-team-${stamp}.pdf`,
                    mimeType: 'application/pdf',
                    content: makePdf(`AP3 Team Confidential Token${stamp}`),
                    gate: () => decideUploadBand(ctx.Provider, ada, DISCOVERY_SPACE_ID, 'Team'),
                });
                Assert(teamUpload.ok, `Team PDF upload succeeded: ${teamUpload.ok ? '' : teamUpload.message}`);
                if (!teamUpload.ok) throw new Error(teamUpload.message);
                createdItemIds.push(teamUpload.itemId);
                createdFileIds.push(teamUpload.fileId);

                const sharedPipeline = await waitForSpaceItemPipeline(ctx.Provider, ctx.User, sharedUpload.itemId);
                const teamPipeline = await waitForSpaceItemPipeline(ctx.Provider, ctx.User, teamUpload.itemId);
                Assert(sharedPipeline.chunks.length > 0 && teamPipeline.chunks.length > 0, 'Content pipeline produced chunks for Shared and Team uploads');

                const sharedChunkId = sharedPipeline.chunks[0].ID;
                const teamChunkId = teamPipeline.chunks[0].ID;

                // 1. Bea reads Shared ERD / ContentItem / ContentItemChunk; CANNOT read Team equivalents
                const beaSharedItems = await FindRows<{ ID: string }>(asPersona(ctx, beaCtx), CONTENT_ITEM_ENTITY, `ID = '${sharedPipeline.contentItemId}'`, ['ID'], beaCtx.User, { BypassCache: true });
                const beaSharedChunks = await FindRows<{ ID: string }>(asPersona(ctx, beaCtx), CONTENT_ITEM_CHUNK_ENTITY, `ID = '${sharedChunkId}'`, ['ID'], beaCtx.User, { BypassCache: true });
                Assert(beaSharedItems.length === 1 && beaSharedChunks.length === 1, 'Bea reads Discovery Shared ContentItem and ContentItemChunk');

                const beaTeamItems = await FindRows<{ ID: string }>(asPersona(ctx, beaCtx), CONTENT_ITEM_ENTITY, `ID = '${teamPipeline.contentItemId}'`, ['ID'], beaCtx.User, { BypassCache: true });
                const beaTeamChunks = await FindRows<{ ID: string }>(asPersona(ctx, beaCtx), CONTENT_ITEM_CHUNK_ENTITY, `ID = '${teamChunkId}'`, ['ID'], beaCtx.User, { BypassCache: true });
                const beaTeamErds = await FindRows<{ ID: string }>(
                    asPersona(ctx, beaCtx),
                    ENTITY_RECORD_DOCUMENT_ENTITY,
                    `RecordID IN ('ID|${teamUpload.itemId}', '${teamUpload.itemId}')`,
                    ['ID'],
                    beaCtx.User,
                    { BypassCache: true },
                );
                Assert(
                    beaTeamItems.length === 0 && beaTeamChunks.length === 0 && beaTeamErds.length === 0,
                    'Bea MUST NOT read Team EntityRecordDocument, ContentItem, or ContentItemChunk',
                );

                // 2. Harper (Harbor outsider) sees zero rows for BOTH Shared and Team Discovery artifacts
                const harperItems = await FindRows<{ ID: string }>(
                    asPersona(ctx, harperCtx),
                    CONTENT_ITEM_ENTITY,
                    `ID IN ('${sharedPipeline.contentItemId}', '${teamPipeline.contentItemId}')`,
                    ['ID'],
                    harperCtx.User,
                    { BypassCache: true },
                );
                const harperChunks = await FindRows<{ ID: string }>(
                    asPersona(ctx, harperCtx),
                    CONTENT_ITEM_CHUNK_ENTITY,
                    `ID IN ('${sharedChunkId}', '${teamChunkId}')`,
                    ['ID'],
                    harperCtx.User,
                    { BypassCache: true },
                );
                Assert(harperItems.length === 0 && harperChunks.length === 0, 'Harper MUST NOT read Discovery Shared or Team ContentItems/Chunks');

                // 3. Adversarial direct write/delete refusals on Content Items, Content Item Chunks, Entity Record Documents
                const chunkLoad = await beaCtx.Provider.GetEntityObject<MJContentItemChunkEntity>(CONTENT_ITEM_CHUNK_ENTITY, beaCtx.User);
                Assert(await chunkLoad.Load(sharedChunkId), 'Bea loads Shared chunk for read');
                chunkLoad.Text = 'tampered';
                Assert(!(await chunkLoad.Save()), 'Bea MUST NOT mutate ContentItemChunk');
                Assert(!(await chunkLoad.Delete()), 'Bea MUST NOT delete ContentItemChunk');

                const newChunk = await beaCtx.Provider.GetEntityObject<MJContentItemChunkEntity>(CONTENT_ITEM_CHUNK_ENTITY, beaCtx.User);
                newChunk.NewRecord();
                newChunk.ContentItemID = sharedPipeline.contentItemId;
                newChunk.Sequence = 999;
                newChunk.Text = 'forged chunk';
                Assert(!(await newChunk.Save()), 'Bea MUST NOT create ContentItemChunk');

                const itemLoad = await beaCtx.Provider.GetEntityObject<MJContentItemEntity>(CONTENT_ITEM_ENTITY, beaCtx.User);
                Assert(await itemLoad.Load(sharedPipeline.contentItemId), 'Bea loads Shared ContentItem');
                Assert(!(await itemLoad.Delete()), 'Bea MUST NOT delete ContentItem');

                const [sharedErd] = await FindRows<{ ID: string }>(
                    ctx,
                    ENTITY_RECORD_DOCUMENT_ENTITY,
                    `RecordID IN ('ID|${sharedUpload.itemId}', '${sharedUpload.itemId}')`,
                    ['ID'],
                );
                if (sharedErd?.ID) {
                    const erdLoad = await beaCtx.Provider.GetEntityObject<MJEntityRecordDocumentEntity>(ENTITY_RECORD_DOCUMENT_ENTITY, beaCtx.User);
                    if (await erdLoad.Load(sharedErd.ID)) {
                        Assert(!(await erdLoad.Delete()), 'Bea MUST NOT delete EntityRecordDocument');
                    }
                }
            } finally {
                await purgeTestSpaceItemPipelineRows(ctx.Provider, ctx.User, createdItemIds);
                await runAllSteps([
                    ...createdItemIds.map((id) => () => deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${id}'`, 'AP3 share notice')),
                    ...createdItemIds.map((id) => () => deleteWhere(ctx.Provider, ctx.User, ITEM_USE_ENTITY, `ItemID = '${id}'`, 'AP3 item use')),
                    ...createdItemIds.map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, id, 'AP3 space item')),
                    ...createdFileIds.map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, FILE_ENTITY, id, 'AP3 file')),
                ]);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP4',
        Name: 'AP4 — Search scopes adversarial read/write lockouts and runtime scope isolation (cross-audience & cross-space)',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const harperCtx = await getPersonaContext(ctx, 'harper');
            const { sharedRootId, teamRootId, sharedName, teamName } = await resolveDiscoveryTaskRoots(ctx);
            const stamp = Date.now();

            let genConvId: string | null = null;
            let genChatId: string | null = null;
            let privConvId: string | null = null;
            let privChatId: string | null = null;

            try {
                // 1. Direct read/write lockdown on Search Scopes and Search Scope Permissions
                const scopeAttempt = await beaCtx.Provider.GetEntityObject<MJSearchScopeEntity>(SEARCH_SCOPE_ENTITY, beaCtx.User);
                scopeAttempt.NewRecord();
                scopeAttempt.Name = `${MARK} Forged Scope ${stamp}`;
                Assert(!(await scopeAttempt.Save()), 'Space Participant Bea MUST NOT create MJ: Search Scopes');

                const permAttempt = await beaCtx.Provider.GetEntityObject<MJSearchScopePermissionEntity>(SEARCH_SCOPE_PERMISSION_ENTITY, beaCtx.User);
                permAttempt.NewRecord();
                permAttempt.SearchScopeID = COLLABORATION_SEARCH_SCOPE_ID;
                permAttempt.UserID = beaCtx.User.ID;
                permAttempt.PermissionLevel = 'Manage';
                Assert(!(await permAttempt.Save()), 'Space Participant Bea MUST NOT create MJ: Search Scope Permissions');

                const beaScopeRead = await View(asPersona(ctx, beaCtx)).RunView<{ ID: string }>(
                    { EntityName: SEARCH_SCOPE_ENTITY, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
                    beaCtx.User,
                );
                Assert(
                    !beaScopeRead.Success || (beaScopeRead.Results?.length ?? 0) === 0,
                    'Space Participant has no direct read access on MJ: Search Scopes',
                );

                // 2. Runtime SearchEngine & chat turn scope boundaries
                const genStart = await createSpaceConversation(ctx.Provider, ada, { SpaceID: DISCOVERY_SPACE_ID, Name: `ap4-gen-${stamp}`, Kind: 'General' });
                const privStart = await createSpaceConversation(ctx.Provider, ada, { SpaceID: DISCOVERY_SPACE_ID, Name: `ap4-priv-${stamp}`, Kind: 'Private' });
                Assert(
                    genStart.ok && !!genStart.conversationId && !!genStart.spaceChatId && privStart.ok && !!privStart.conversationId && !!privStart.spaceChatId,
                    'Ada creates General and Private conversations in Discovery',
                );
                if (!genStart.ok || !genStart.conversationId || !genStart.spaceChatId || !privStart.ok || !privStart.conversationId || !privStart.spaceChatId) {
                    throw new Error('Conversation creation failed');
                }
                const activeGenConvId = genStart.conversationId;
                const activeGenChatId = genStart.spaceChatId;
                const activePrivConvId = privStart.conversationId;
                const activePrivChatId = privStart.spaceChatId;
                genConvId = activeGenConvId;
                genChatId = activeGenChatId;
                privConvId = activePrivConvId;
                privChatId = activePrivChatId;

                await SearchEngine.Instance.Config({}, ada);
                const runSearch = (user: UserInfo, chatId: string, query: string) =>
                    SearchEngine.Instance.Search(
                        {
                            Query: query,
                            ScopeIDs: [COLLABORATION_SEARCH_SCOPE_ID],
                            SearchContext: { PrimaryScopeRecordID: chatId },
                            AIAgentID: COLLABORATION_TEST_AGENT_ID,
                            MaxResults: 50,
                            Mode: 'preview',
                        },
                        user,
                    );

                const beaGenShared = await runSearch(beaCtx.User, activeGenChatId, sharedName);
                Assert(
                    beaGenShared.Success && beaGenShared.Results.some((r) => SameID(r.RecordID, sharedRootId)),
                    'Bea searches Discovery General chat and finds Shared root task',
                );

                const beaGenTeam = await runSearch(beaCtx.User, activeGenChatId, teamName);
                Assert(
                    !beaGenTeam.Results.some((r) => SameID(r.RecordID, teamRootId)),
                    'Bea search in General chat MUST NOT return Team root task',
                );

                // Adversarial Private-chat scope ID injection by Bea
                const beaPrivTeam = await runSearch(beaCtx.User, activePrivChatId, teamName);
                Assert(
                    !beaPrivTeam.Results.some((r) => SameID(r.RecordID, teamRootId)),
                    'Bea passing Private chat ID to SearchEngine MUST NOT leak Discovery Team root task',
                );

                // Harper (Harbor outsider) querying Discovery chat IDs
                const harperGenShared = await runSearch(harperCtx.User, activeGenChatId, sharedName);
                const harperPrivTeam = await runSearch(harperCtx.User, activePrivChatId, teamName);
                Assert(
                    !harperGenShared.Results.some((r) => SameID(r.RecordID, sharedRootId)) &&
                        !harperPrivTeam.Results.some((r) => SameID(r.RecordID, teamRootId)),
                    'Harper querying Discovery chat scopes MUST NOT read Discovery tasks',
                );

                // Turn refusal when Bea posts/executes against Ada's Private conversation or Harbor
                const beaPrivPost = await postSpaceMessage(ctx.Provider, beaCtx.User, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: activePrivConvId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} show team notes`,
                });
                Assert(!beaPrivPost.ok, 'Bea cannot post into Ada Private conversation');

                const harperTurnAttempt = await executeSpaceChatTurn(ctx.Provider, beaCtx.User, {
                    spaceId: HARBOR_SPACE_ID,
                    conversationId: activeGenConvId,
                    userMessageId: '00000000-0000-4000-8000-000000000099',
                });
                Assert(!harperTurnAttempt.ok, 'Bea cannot execute turn against Harbor');
            } finally {
                if (genConvId && genChatId) await cleanupConversation(ctx.Provider, ctx.User, genConvId, genChatId);
                if (privConvId && privChatId) await cleanupConversation(ctx.Provider, ctx.User, privConvId, privChatId);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP5',
        Name: 'AP5 — CT-7 AI run-row lockdown (positive turn + off-turn refusal + post-turn mutation denial) and CT-8 MJ: AI Agents owner omission',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const harperCtx = await getPersonaContext(ctx, 'harper');
            const promptSeed = await resolvePromptSeed(ctx);
            const stamp = Date.now();

            let genConvId: string | null = null;
            let genChatId: string | null = null;
            let adaRunId: string | null = null;
            let adaPromptRunId: string | null = null;
            let previousOwnerUserId: string | null = null;

            try {
                // 1. Positive authorized participant turn (Bea in Discovery General) -> persists AgentRun, AgentRunStep, and PromptRun
                const started = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `ap5-ct7-${stamp}`,
                    Kind: 'General',
                });
                Assert(started.ok === true && !!started.conversationId && !!started.spaceChatId, `Ada creates General chat: ${started.ok ? '' : started.message}`);
                if (!started.ok || !started.conversationId || !started.spaceChatId) throw new Error(started.ok ? 'Missing conversationId' : started.message);
                const activeConvId = started.conversationId;
                genConvId = activeConvId;
                genChatId = started.spaceChatId;

                const posted = await postSpaceMessage(ctx.Provider, beaCtx.User, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: activeConvId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} what shared files are here?`,
                });
                Assert(posted.ok === true && !!posted.detailId, `Bea posts question: ${posted.ok ? '' : posted.message}`);
                if (!posted.ok) throw new Error(posted.message);

                const turn = await executeSpaceChatTurn(ctx.Provider, beaCtx.User, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: activeConvId,
                    userMessageId: posted.detailId,
                });
                Assert(turn.ok === true, `Authorized participant turn succeeds: ${turn.ok ? '' : turn.message}`);
                if (!turn.ok) throw new Error(turn.message);

                const [reply] = await FindRows<{ Message: string }>(
                    asPersona(ctx, beaCtx),
                    CONVERSATION_DETAIL_ENTITY,
                    `ID = '${turn.replyDetailIds[0]}'`,
                    ['Message'],
                    beaCtx.User,
                    { BypassCache: true },
                );
                Assert(
                    !!reply?.Message && reply.Message.includes('site-photo.png') && !reply.Message.includes('discovery-brief.pdf'),
                    'Bea reads permitted Shared reply without leaking Team brief',
                );

                // Verify server orchestration persisted all three CT-7 entities (AgentRun, AgentRunStep, PromptRun)
                const beaTurnIds = await assertTurnPersistedAllThreeEntities(ctx, asPersona(ctx, beaCtx), activeConvId, 'AP5 Bea turn');

                // 2. Off-turn direct Create CT-7 lockdown for Bea & Harper using the real persisted beaTurnIds.runId
                await assertDirectAIRunLockdown(ctx, beaCtx.User, promptSeed, beaTurnIds.runId, 'Bea off-turn');
                await assertDirectAIRunLockdown(ctx, harperCtx.User, promptSeed, beaTurnIds.runId, 'Harper off-turn');

                // 3. Post-turn unconditional Load + Save() + Delete() refusal for Bea on AgentRun, AgentRunStep, and PromptRun
                await assertPostTurnOwnerLockdown(ctx, beaCtx.User, beaTurnIds, 'AP5 Bea post-turn');

                // 4. Cross-user isolation & load denial for Harper on Bea's AgentRun, AgentRunStep, and PromptRun
                await assertCrossUserRunIsolation(asPersona(ctx, harperCtx), beaTurnIds, 'AP5 Harper vs Bea runs');

                // 5. Cross-user staff control run isolation (Ada AgentRun + AgentRunStep + PromptRun)
                const adaPromptRun = await ctx.Provider.GetEntityObject<MJAIPromptRunEntity>(PROMPT_RUN_ENTITY, ada);
                adaPromptRun.NewRecord();
                adaPromptRun.PromptID = promptSeed.promptId;
                adaPromptRun.ModelID = promptSeed.modelId;
                adaPromptRun.VendorID = promptSeed.vendorId;
                adaPromptRun.AgentID = COLLABORATION_TEST_AGENT_ID;
                adaPromptRun.RunAt = new Date();
                adaPromptRun.CompletedAt = new Date();
                adaPromptRun.Success = true;
                adaPromptRun.RunType = 'Single';
                Assert(await adaPromptRun.Save(), 'Staff Ada saves own AI Prompt Run control row');
                adaPromptRunId = adaPromptRun.ID;

                const adaRun = await ctx.Provider.GetEntityObject<MJAIAgentRunEntity>(AGENT_RUN_ENTITY, ada);
                adaRun.NewRecord();
                adaRun.AgentID = COLLABORATION_TEST_AGENT_ID;
                adaRun.UserID = ada.ID;
                adaRun.Status = 'Completed';
                adaRun.StartedAt = new Date();
                adaRun.CompletedAt = new Date();
                adaRun.Success = true;
                Assert(await adaRun.Save(), 'Staff Ada saves own AI Agent Run control row');
                adaRunId = adaRun.ID;

                const adaStep = await ctx.Provider.GetEntityObject<MJAIAgentRunStepEntity>(AGENT_RUN_STEP_ENTITY, ada);
                adaStep.NewRecord();
                adaStep.AgentRunID = adaRunId;
                adaStep.StepNumber = 1;
                adaStep.StepType = 'Prompt';
                adaStep.StepName = 'AP5 Ada control step';
                adaStep.TargetID = promptSeed.promptId;
                adaStep.TargetLogID = adaPromptRunId;
                adaStep.Status = 'Completed';
                adaStep.StartedAt = new Date();
                adaStep.CompletedAt = new Date();
                adaStep.Success = true;
                Assert(await adaStep.Save(), 'Staff Ada saves own AI Agent Run Step control row');

                await assertCrossUserRunIsolation(
                    asPersona(ctx, beaCtx),
                    { runId: adaRunId, stepId: adaStep.ID, promptRunId: adaPromptRunId },
                    'AP5 Bea vs Ada staff control runs',
                );

                // 6. CT-8 OwnerUser / OwnerUserID omission on in-reach MJ: AI Agents + Harper outsider RLS isolation
                const agentEnt = await ctx.Provider.GetEntityObject<MJAIAgentEntity>(AI_AGENT_ENTITY, ctx.User);
                Assert(await agentEnt.Load(COLLABORATION_TEST_AGENT_ID), 'Load test agent');
                previousOwnerUserId = agentEnt.OwnerUserID;
                if (!SameID(previousOwnerUserId, ada.ID)) {
                    agentEnt.OwnerUserID = ada.ID;
                    Assert(await agentEnt.Save(), 'Set test agent OwnerUserID to Ada for CT-8 check');
                }

                const [adaAgentRow] = await FindRows<{ OwnerUserID: string; OwnerUser: string }>(
                    ctx,
                    AI_AGENT_ENTITY,
                    `ID = '${COLLABORATION_TEST_AGENT_ID}'`,
                    ['OwnerUserID', 'OwnerUser'],
                    ada,
                    { BypassCache: true },
                );
                Assert(SameID(adaAgentRow?.OwnerUserID, ada.ID) && !!adaAgentRow?.OwnerUser, 'Staff Ada reads non-empty OwnerUser and OwnerUserID on MJ: AI Agents');

                // Bea reaches COLLABORATION_TEST_AGENT_ID via Discovery -> Northwind ancestor grant
                await assertFieldAccessDeniedOrOmitted(ctx, beaCtx.User, COLLABORATION_TEST_AGENT_ID, 'Bea CT-8');

                // Harper is the Harbor outsider and has no reach to Northwind -> Collaboration: Agents In Reach returns 0 rows
                const harperAgentRows = await FindRows<{ ID: string }>(
                    asPersona(ctx, harperCtx),
                    AI_AGENT_ENTITY,
                    `ID = '${COLLABORATION_TEST_AGENT_ID}'`,
                    ['ID'],
                    harperCtx.User,
                    { BypassCache: true },
                );
                Assert(harperAgentRows.length === 0, 'Harper (Harbor outsider) MUST NOT read ungranted test agent via Collaboration: Agents In Reach');
            } finally {
                if (previousOwnerUserId) {
                    const restoreAgent = await ctx.Provider.GetEntityObject<MJAIAgentEntity>(AI_AGENT_ENTITY, ctx.User);
                    if (await restoreAgent.Load(COLLABORATION_TEST_AGENT_ID)) {
                        restoreAgent.OwnerUserID = previousOwnerUserId;
                        await restoreAgent.Save();
                    }
                }
                if (adaRunId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, AGENT_RUN_ENTITY, adaRunId, 'AP5 Ada control run');
                }
                if (adaPromptRunId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, PROMPT_RUN_ENTITY, adaPromptRunId, 'AP5 Ada control prompt run');
                }
                if (genConvId && genChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, genConvId, genChatId);
                }
            }
        },
    },
    {
        Id: 'adversarial-persona.AP6',
        Name: 'AP6 — Multi-role non-staff user holding Space Participant + secondary non-staff role maintains full adversarial isolation across all surfaces',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
            const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
            const ada = await GetPersonaUser(ctx, 'ada');
            const promptSeed = await resolvePromptSeed(ctx);
            const { sharedRootId, teamRootId, sharedName, teamName } = await resolveDiscoveryTaskRoots(ctx);
            const stamp = Date.now();
            const multiEmail = `ct6.multirole.${stamp}@collab-world.example`;

            let tempRoleId: string | null = null;
            let tempUserId: string | null = null;
            const tempUserRoleIds: string[] = [];
            let tempPersonId: string | null = null;
            let tempMemberId: string | null = null;
            let teamUploadItemId: string | null = null;
            let teamUploadFileId: string | null = null;
            let genConvId: string | null = null;
            let genChatId: string | null = null;

            try {
                // Seed temporary non-staff role + user holding [Space Participant, Secondary Role]
                const role = await ctx.Provider.GetEntityObject<MJRoleEntity>(ROLE_ENTITY, ctx.User);
                role.NewRecord();
                role.Name = `CT6 NonStaff ${stamp}`;
                role.Description = 'Temporary secondary non-staff role for CT-6 adversarial check';
                Assert(await role.Save(), `Create temporary non-staff role: ${role.LatestResult?.CompleteMessage ?? ''}`);
                tempRoleId = role.ID;

                const user = await ctx.Provider.GetEntityObject<MJUserEntity>(USER_ENTITY, ctx.User);
                user.NewRecord();
                user.Name = `CT6 MultiRole ${stamp}`;
                user.Email = multiEmail;
                user.FirstName = 'CT6';
                user.LastName = 'MultiRole';
                user.Type = 'User';
                user.IsActive = true;
                Assert(await user.Save(), `Create temporary multi-role user: ${user.LatestResult?.CompleteMessage ?? ''}`);
                tempUserId = user.ID;

                for (const roleId of [PARTICIPANT_ROLE_ID, tempRoleId]) {
                    const ur = await ctx.Provider.GetEntityObject<MJUserRoleEntity>(USER_ROLE_ENTITY, ctx.User);
                    ur.NewRecord();
                    ur.UserID = tempUserId;
                    ur.RoleID = roleId;
                    Assert(await ur.Save(), `Grant role ${roleId}: ${ur.LatestResult?.CompleteMessage ?? ''}`);
                    tempUserRoleIds.push(ur.ID);
                }

                const person = await ctx.Provider.GetEntityObject<mjBizAppsCommonPersonEntity>(PERSON_ENTITY, ctx.User);
                person.NewRecord();
                person.FirstName = 'CT6';
                person.LastName = 'MultiRole';
                person.Email = multiEmail;
                person.LinkedUserID = tempUserId;
                Assert(await person.Save(), `Create linked person: ${person.LatestResult?.CompleteMessage ?? ''}`);
                tempPersonId = person.ID;

                const [clientMemberRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'client-member'", ['ID']);
                Assert(!!clientMemberRole?.ID, 'Seeded client-member SpaceRoleType exists');

                const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ctx.User);
                seat.NewRecord();
                seat.SpaceID = DISCOVERY_SPACE_ID;
                seat.UserID = tempUserId;
                seat.SpaceRoleTypeID = clientMemberRole!.ID;
                seat.Band = 'Shared';
                seat.Status = 'Active';
                Assert(await seat.Save(), `Seat multi-role user on Discovery Shared: ${seat.LatestResult?.CompleteMessage ?? ''}`);
                tempMemberId = seat.ID;

                const multiUser = await GetPersonaUser(ctx, multiEmail);
                Assert(multiUser.UserRoles.length >= 2, `Multi-role user loaded with >= 2 roles (saw ${multiUser.UserRoles.length})`);

                // Seed a Team-band PDF so content chunk isolation is verified for multi-role participant
                const teamPdf = await uploadSpaceFile({
                    user: ada,
                    storageUser: ctx.User,
                    provider: ctx.Provider,
                    store,
                    spaceId: DISCOVERY_SPACE_ID,
                    folder: 'Pipeline',
                    fileName: `ap6-team-${stamp}.pdf`,
                    mimeType: 'application/pdf',
                    content: makePdf(`AP6 Team Confidential Token${stamp}`),
                    gate: () => decideUploadBand(ctx.Provider, ada, DISCOVERY_SPACE_ID, 'Team'),
                });
                Assert(teamPdf.ok, 'Seed AP6 Team PDF');
                if (!teamPdf.ok) throw new Error(teamPdf.message);
                teamUploadItemId = teamPdf.itemId;
                teamUploadFileId = teamPdf.fileId;
                const teamPipeline = await waitForSpaceItemPipeline(ctx.Provider, ctx.User, teamUploadItemId);
                Assert(teamPipeline.chunks.length > 0, 'AP6 Team PDF produced chunks');

                const multiCtx = asUser(ctx, multiUser!);

                // 1. Spaces & Tasks
                const multiSpaces = await FindRows<{ ID: string }>(multiCtx, SPACE_ENTITY, `ID IN ('${DISCOVERY_SPACE_ID}', '${HARBOR_SPACE_ID}')`, ['ID'], multiUser, { BypassCache: true });
                Assert(
                    multiSpaces.some((s) => SameID(s.ID, DISCOVERY_SPACE_ID)) && !multiSpaces.some((s) => SameID(s.ID, HARBOR_SPACE_ID)),
                    'Multi-role user sees Discovery and NOT Harbor',
                );
                const multiSharedTask = await FindRows<{ ID: string }>(multiCtx, TASK_ENTITY, `ID = '${sharedRootId}'`, ['ID'], multiUser, { BypassCache: true });
                const multiTeamTask = await FindRows<{ ID: string }>(multiCtx, TASK_ENTITY, `ID = '${teamRootId}'`, ['ID'], multiUser, { BypassCache: true });
                Assert(multiSharedTask.length === 1 && multiTeamTask.length === 0, 'Multi-role user sees Discovery Shared task and NOT Team task');

                const multiTeamTaskWrite = await createSpaceTask(ctx.Provider, multiUser!, {
                    spaceId: DISCOVERY_SPACE_ID,
                    name: `${MARK} AP6 team task ${stamp}`,
                    band: 'Team',
                });
                Assert(!multiTeamTaskWrite.ok, 'Multi-role user cannot file a Team task');

                // 2. Meetings (no Northwind seat -> 0 Northwind meetings, direct Save() refused)
                const nwMeetings = await FindRows<{ ID: string }>(multiCtx, MEETING_ENTITY, '', ['ID'], multiUser, { BypassCache: true });
                Assert(nwMeetings.length === 0, 'Multi-role user without Northwind seat sees 0 Northwind meetings');
                const multiMeetingAttempt = await createSpaceMeeting(ctx.Provider, multiUser!, {
                    spaceId: HARBOR_SPACE_ID,
                    name: `${MARK} AP6 Harbor Meeting ${stamp}`,
                    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
                    endsAt: new Date(Date.now() + 90_000_000).toISOString(),
                    timeZone: 'America/Chicago',
                    locationType: 'Virtual',
                    visibility: 'Standard',
                });
                Assert(!multiMeetingAttempt.ok, 'Multi-role user cannot schedule meeting in Harbor');

                // 3. Content chunks (Team chunk hidden & direct chunk write denied)
                const multiTeamChunks = await FindRows<{ ID: string }>(
                    multiCtx,
                    CONTENT_ITEM_CHUNK_ENTITY,
                    `ID = '${teamPipeline.chunks[0].ID}'`,
                    ['ID'],
                    multiUser,
                    { BypassCache: true },
                );
                Assert(multiTeamChunks.length === 0, 'Multi-role user MUST NOT read Team ContentItemChunk');

                const chunkAttempt = await ctx.Provider.GetEntityObject<MJContentItemChunkEntity>(CONTENT_ITEM_CHUNK_ENTITY, multiUser);
                chunkAttempt.NewRecord();
                chunkAttempt.ContentItemID = teamPipeline.contentItemId;
                chunkAttempt.Sequence = 77;
                chunkAttempt.Text = 'forged';
                Assert(!(await chunkAttempt.Save()), 'Multi-role user MUST NOT write ContentItemChunk');

                // 4. Search scope isolation & write lockout
                const started = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `ap6-gen-${stamp}`,
                    Kind: 'General',
                });
                Assert(started.ok === true && !!started.conversationId && !!started.spaceChatId, 'Ada opens Discovery General chat for AP6');
                if (!started.ok || !started.conversationId || !started.spaceChatId) {
                    throw new Error(started.ok ? 'Missing conversationId' : started.message);
                }
                const activeConvId = started.conversationId;
                const activeChatId = started.spaceChatId;
                genConvId = activeConvId;
                genChatId = activeChatId;

                await SearchEngine.Instance.Config({}, ada);
                const multiSearchShared = await SearchEngine.Instance.Search(
                    {
                        Query: sharedName,
                        ScopeIDs: [COLLABORATION_SEARCH_SCOPE_ID],
                        SearchContext: { PrimaryScopeRecordID: activeChatId },
                        AIAgentID: COLLABORATION_TEST_AGENT_ID,
                        MaxResults: 50,
                        Mode: 'preview',
                    },
                    multiUser!,
                );
                const multiSearchTeam = await SearchEngine.Instance.Search(
                    {
                        Query: teamName,
                        ScopeIDs: [COLLABORATION_SEARCH_SCOPE_ID],
                        SearchContext: { PrimaryScopeRecordID: activeChatId },
                        AIAgentID: COLLABORATION_TEST_AGENT_ID,
                        MaxResults: 50,
                        Mode: 'preview',
                    },
                    multiUser!,
                );
                Assert(
                    multiSearchShared.Results.some((r) => SameID(r.RecordID, sharedRootId)) &&
                        !multiSearchTeam.Results.some((r) => SameID(r.RecordID, teamRootId)),
                    'Multi-role search finds Shared task and excludes Team task',
                );

                // 5. CT-7 AI run lockdown (positive turn + off-turn create + post-turn update/delete denial + cross-user isolation)
                const multiPost = await postSpaceMessage(ctx.Provider, multiUser!, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: activeConvId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} what shared materials exist?`,
                });
                Assert(multiPost.ok === true && !!multiPost.detailId, `Multi-role posts to Discovery General: ${multiPost.ok ? '' : multiPost.message}`);
                if (!multiPost.ok) throw new Error(multiPost.message);

                const multiTurn = await executeSpaceChatTurn(ctx.Provider, multiUser!, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: activeConvId,
                    userMessageId: multiPost.detailId,
                });
                Assert(multiTurn.ok === true, `Multi-role authorized turn succeeds: ${multiTurn.ok ? '' : multiTurn.message}`);
                if (!multiTurn.ok) throw new Error(multiTurn.message);

                const multiTurnIds = await assertTurnPersistedAllThreeEntities(ctx, multiCtx, activeConvId, 'AP6 Multi-role turn');
                await assertDirectAIRunLockdown(ctx, multiUser!, promptSeed, multiTurnIds.runId, 'Multi-role CT-7');
                await assertPostTurnOwnerLockdown(ctx, multiUser!, multiTurnIds, 'AP6 Multi-role post-turn');

                // Cross-user isolation against an Ada staff run/step/promptRun
                const adaPromptRun = await ctx.Provider.GetEntityObject<MJAIPromptRunEntity>(PROMPT_RUN_ENTITY, ada);
                adaPromptRun.NewRecord();
                adaPromptRun.PromptID = promptSeed.promptId;
                adaPromptRun.ModelID = promptSeed.modelId;
                adaPromptRun.VendorID = promptSeed.vendorId;
                adaPromptRun.AgentID = COLLABORATION_TEST_AGENT_ID;
                adaPromptRun.RunAt = new Date();
                adaPromptRun.CompletedAt = new Date();
                adaPromptRun.Success = true;
                adaPromptRun.RunType = 'Single';
                Assert(await adaPromptRun.Save(), 'AP6 Ada saves control PromptRun');
                const adaPromptId = adaPromptRun.ID;

                const adaRun = await ctx.Provider.GetEntityObject<MJAIAgentRunEntity>(AGENT_RUN_ENTITY, ada);
                adaRun.NewRecord();
                adaRun.AgentID = COLLABORATION_TEST_AGENT_ID;
                adaRun.UserID = ada.ID;
                adaRun.Status = 'Completed';
                adaRun.StartedAt = new Date();
                adaRun.CompletedAt = new Date();
                adaRun.Success = true;
                Assert(await adaRun.Save(), 'AP6 Ada saves control AgentRun');
                const adaRunId = adaRun.ID;

                const adaStep = await ctx.Provider.GetEntityObject<MJAIAgentRunStepEntity>(AGENT_RUN_STEP_ENTITY, ada);
                adaStep.NewRecord();
                adaStep.AgentRunID = adaRunId;
                adaStep.StepNumber = 1;
                adaStep.StepType = 'Prompt';
                adaStep.StepName = 'AP6 Ada control step';
                adaStep.TargetID = promptSeed.promptId;
                adaStep.TargetLogID = adaPromptId;
                adaStep.Status = 'Completed';
                adaStep.StartedAt = new Date();
                adaStep.CompletedAt = new Date();
                adaStep.Success = true;
                Assert(await adaStep.Save(), 'AP6 Ada saves control AgentRunStep');

                try {
                    await assertCrossUserRunIsolation(
                        multiCtx,
                        { runId: adaRunId, stepId: adaStep.ID, promptRunId: adaPromptId },
                        'AP6 Multi-role vs Ada control runs',
                    );
                } finally {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, AGENT_RUN_ENTITY, adaRunId, 'AP6 Ada control run');
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, PROMPT_RUN_ENTITY, adaPromptId, 'AP6 Ada control prompt run');
                }

                // 6. CT-8 owner omission & CT-5 invite authorization refusal
                await assertFieldAccessDeniedOrOmitted(ctx, multiUser!, COLLABORATION_TEST_AGENT_ID, 'Multi-role CT-8');

                const inviteAttempt = await mintSpaceLink({
                    provider: ctx.Provider,
                    user: multiUser!,
                    spaceId: DISCOVERY_SPACE_ID,
                    email: `forged-invite-${stamp}@example.com`,
                    roleId: clientMemberRole!.ID,
                });
                Assert(!inviteAttempt.ok, 'Multi-role non-staff user MUST NOT issue space invite links (CT-5)');
            } finally {
                if (genConvId && genChatId) await cleanupConversation(ctx.Provider, ctx.User, genConvId, genChatId);
                if (teamUploadItemId) {
                    await purgeTestSpaceItemPipelineRows(ctx.Provider, ctx.User, [teamUploadItemId]);
                    await deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${teamUploadItemId}'`, 'AP6 share notice');
                    await deleteWhere(ctx.Provider, ctx.User, ITEM_USE_ENTITY, `ItemID = '${teamUploadItemId}'`, 'AP6 item use');
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, teamUploadItemId, 'AP6 space item');
                }
                if (teamUploadFileId) await deleteRowAndConfirm(ctx.Provider, ctx.User, FILE_ENTITY, teamUploadFileId, 'AP6 file');
                if (tempMemberId) await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, tempMemberId, 'AP6 multi-role seat');
                if (tempPersonId) await deleteRowAndConfirm(ctx.Provider, ctx.User, PERSON_ENTITY, tempPersonId, 'AP6 multi-role person');
                for (const urId of tempUserRoleIds) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, USER_ROLE_ENTITY, urId, 'AP6 multi-role user-role');
                }
                if (tempUserId) {
                    await cleanupStep(async () => {
                        const u = await ctx.Provider.GetEntityObject<MJUserEntity>(USER_ENTITY, ctx.User);
                        if (await u.Load(tempUserId!)) {
                            u.IsActive = false;
                            await u.Save();
                            await u.Delete();
                        }
                    });
                }
                if (tempRoleId) {
                    await cleanupStep(async () => {
                        const r = await ctx.Provider.GetEntityObject<MJRoleEntity>(ROLE_ENTITY, ctx.User);
                        if (await r.Load(tempRoleId!)) {
                            const deleted = await r.Delete();
                            Assert(deleted, `AP6 temporary role cleanup failed: ${r.LatestResult?.CompleteMessage ?? ''}`);
                        }
                    });
                }
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('adversarial-persona', {
    Setup: async (ctx: IntegrationCheckContext) => {
        bundleTestAgentAttachmentId = await attachTestAgent(ctx, NORTHWIND_SPACE_ID);
    },
    Teardown: async (ctx: IntegrationCheckContext) => {
        if (bundleTestAgentAttachmentId) {
            const id = bundleTestAgentAttachmentId;
            bundleTestAgentAttachmentId = null;
            await detachTestAgent(ctx, id);
        }
    },
});
