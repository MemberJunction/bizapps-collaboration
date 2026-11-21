import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { RunView, type UserInfo } from '@memberjunction/core';
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
import { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';
import {
    mjBizAppsTasksMeetingEntity,
    mjBizAppsTasksTaskEntity,
} from '@mj-biz-apps/tasks-entities';
import {
    CollaborationClient,
    type mjBizAppsCollaborationSpaceMemberEntity,
} from '@mj-biz-apps/collaboration-entities';
import { COLLABORATION_TEST_AGENT_ID, COLLABORATION_TEST_AGENT_NAME } from '../../agents/test-agent.js';
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
} from '../../entity-names.js';
import { FindRows, getPersonaClientContext, SameID } from '../../wire.js';
import { buildUserKeyProvider, mintUserApiKey } from '../../persona-provider.js';
import { cleanupConversation, cleanupStep, deleteRowAndConfirm, deleteWhere, registerChecks, runAllSteps } from '../cleanup-helpers.js';
import { makePdf, purgeTestSpaceItemPipelineRows, waitForSpaceItemPipeline } from '../content-pipeline-fixtures.js';
import { attachTestAgent, detachTestAgent } from '../test-agent-attachment.js';

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

const MARK = 'COLLAB-CHECK ap wire';

type ClientPersona = Awaited<ReturnType<typeof getPersonaClientContext>>;

let bundleTestAgentAttachmentId: string | null = null;

function asPersona(ctx: IntegrationCheckContext, persona: ClientPersona): IntegrationCheckContext {
    return { ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext;
}

function clientOf(persona: ClientPersona): CollaborationClient {
    return new CollaborationClient(persona.GraphQLProvider);
}

async function resolveDiscoveryTaskRoots(ctx: IntegrationCheckContext): Promise<{ sharedRootId: string; teamRootId: string; sharedName: string; teamName: string }> {
    const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
    Assert(!!taskEntity, 'Task entity metadata exists');
    const items = await FindRows<{ RecordID: string; Band: string }>(
        ctx,
        SPACE_ITEM_ENTITY,
        `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${taskEntity!.ID}'`,
        ['RecordID', 'Band'],
        undefined,
        { BypassCache: true },
    );
    const rootOf = (raw: string): string => (raw.toLowerCase().startsWith('id|') ? raw.slice(3) : raw);
    const sharedItem = items.find((i) => i.Band === 'Shared');
    const teamItem = items.find((i) => i.Band === 'Team');
    Assert(!!sharedItem && !!teamItem, 'Discovery holds Shared and Team root tasks');
    const sharedRootId = rootOf(sharedItem!.RecordID);
    const teamRootId = rootOf(teamItem!.RecordID);
    const [sharedRow] = await FindRows<{ Name: string }>(ctx, TASK_ENTITY, `ID = '${sharedRootId}'`, ['Name'], undefined, { BypassCache: true });
    const [teamRow] = await FindRows<{ Name: string }>(ctx, TASK_ENTITY, `ID = '${teamRootId}'`, ['Name'], undefined, { BypassCache: true });
    Assert(!!sharedRow?.Name && !!teamRow?.Name, 'Discovery root tasks have names');
    return { sharedRootId, teamRootId, sharedName: sharedRow!.Name, teamName: teamRow!.Name };
}

async function resolvePromptSeed(ctx: IntegrationCheckContext): Promise<{ agentId: string; promptId: string; modelId: string; vendorId: string }> {
    const [prompt] = await FindRows<{ ID: string }>(ctx, 'MJ: AI Prompts', '', ['ID']);
    const [model] = await FindRows<{ ID: string }>(ctx, 'MJ: AI Models', '', ['ID']);
    const [vendor] = await FindRows<{ ID: string }>(ctx, 'MJ: AI Vendors', '', ['ID']);
    Assert(!!prompt?.ID && !!model?.ID && !!vendor?.ID, 'Seeded AI Prompt, Model, and Vendor exist');
    return {
        agentId: COLLABORATION_TEST_AGENT_ID,
        promptId: prompt!.ID,
        modelId: model!.ID,
        vendorId: vendor!.ID,
    };
}

async function assertFieldAccessDeniedOrOmitted(
    ctx: IntegrationCheckContext,
    actor: UserInfo,
    agentId: string,
    label: string,
): Promise<void> {
    const rv = RunView.FromMetadataProvider(ctx.Provider);
    const safeRes = await rv.RunView<{ ID: string; Name: string }>(
        {
            EntityName: AI_AGENT_ENTITY,
            ExtraFilter: `ID = '${agentId}'`,
            Fields: ['ID', 'Name'],
            ResultType: 'simple',
            BypassCache: true,
        },
        actor,
    );
    Assert(safeRes.Success && (safeRes.Results?.length ?? 0) === 1, `${label}: reads safe MJ: AI Agents fields over wire (${safeRes.ErrorMessage ?? ''})`);

    const ownerRes = await rv.RunView<{
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
        const err = (ownerRes.ErrorMessage ?? '').toLowerCase();
        Assert(
            err.includes('permission') || err.includes('security') || err.includes('denied') || err.includes('access'),
            `${label}: expected FLS/permission denial on OwnerUser/OwnerUserID, got: ${ownerRes.ErrorMessage ?? ''}`,
        );
        return;
    }

    for (const row of ownerRes.Results ?? []) {
        Assert(row.OwnerUserID == null || row.OwnerUserID === '', `${label}: OwnerUserID leaked over wire: ${row.OwnerUserID}`);
        Assert(row.OwnerUser == null || row.OwnerUser === '', `${label}: OwnerUser leaked over wire: ${row.OwnerUser}`);
    }
}

async function assertDirectAIRunLockdownOverWire(
    ctx: IntegrationCheckContext,
    actor: UserInfo,
    seed: { agentId: string; promptId: string; modelId: string; vendorId: string },
    label: string,
): Promise<void> {
    const runAttempt = await ctx.Provider.GetEntityObject<MJAIAgentRunEntity>(AGENT_RUN_ENTITY, actor);
    runAttempt.NewRecord();
    runAttempt.AgentID = seed.agentId;
    runAttempt.UserID = actor.ID;
    runAttempt.Status = 'Running';
    runAttempt.StartedAt = new Date();
    Assert(!(await runAttempt.Save()), `${label}: direct create on ${AGENT_RUN_ENTITY} over wire must be refused`);

    const fakeRunId = '00000000-0000-4000-8000-000000000099';
    const stepAttempt = await ctx.Provider.GetEntityObject<MJAIAgentRunStepEntity>(AGENT_RUN_STEP_ENTITY, actor);
    stepAttempt.NewRecord();
    stepAttempt.AgentRunID = fakeRunId;
    stepAttempt.StepNumber = 1;
    stepAttempt.StepType = 'Prompt';
    stepAttempt.StepName = 'AP wire forged step';
    stepAttempt.Status = 'Running';
    stepAttempt.StartedAt = new Date();
    Assert(!(await stepAttempt.Save()), `${label}: direct create on ${AGENT_RUN_STEP_ENTITY} over wire must be refused`);

    const promptAttempt = await ctx.Provider.GetEntityObject<MJAIPromptRunEntity>(PROMPT_RUN_ENTITY, actor);
    promptAttempt.NewRecord();
    promptAttempt.PromptID = seed.promptId;
    promptAttempt.ModelID = seed.modelId;
    promptAttempt.VendorID = seed.vendorId;
    promptAttempt.RunAt = new Date();
    promptAttempt.Success = true;
    Assert(!(await promptAttempt.Save()), `${label}: direct create on ${PROMPT_RUN_ENTITY} over wire must be refused`);
}

async function cleanupTaskRows(ctx: IntegrationCheckContext, taskId: string | null, itemId: string | null): Promise<void> {
    await runAllSteps([
        ...(itemId ? [() => deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${itemId}'`, 'AP wire share notice')] : []),
        ...(itemId ? [() => deleteWhere(ctx.Provider, ctx.User, ITEM_USE_ENTITY, `ItemID = '${itemId}'`, 'AP wire item use')] : []),
        ...(itemId ? [() => deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, itemId, 'AP wire space item')] : []),
        ...(taskId ? [() => deleteWhere(ctx.Provider, ctx.User, TASK_LINK_ENTITY, `TaskID = '${taskId}'`, 'AP wire task link')] : []),
        ...(taskId ? [() => deleteWhere(ctx.Provider, ctx.User, TASK_ACTIVITY_ENTITY, `TaskID = '${taskId}'`, 'AP wire task activity')] : []),
        ...(taskId ? [() => deleteRowAndConfirm(ctx.Provider, ctx.User, TASK_ENTITY, taskId, 'AP wire task')] : []),
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
        await deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${item.ID}'`, 'AP wire meeting share notice');
        await deleteWhere(ctx.Provider, ctx.User, ITEM_USE_ENTITY, `ItemID = '${item.ID}'`, 'AP wire meeting item use');
    }
    await deleteWhere(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, `RecordID IN ('${meetingId}', 'ID|${meetingId}')`, 'AP wire meeting item');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_LINK_ENTITY, `MeetingID = '${meetingId}'`, 'AP wire meeting link');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_ATTENDEE_ENTITY, `MeetingID = '${meetingId}'`, 'AP wire meeting attendees');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_ENTITY, `ID = '${meetingId}'`, 'AP wire meeting');
}

const checks: NamedCheck[] = [
    {
        Id: 'adversarial-persona.AP1',
        Name: 'AP1 — over the wire: Tasks adversarial read/write boundaries across spaces, bands, and outsider personas',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await getPersonaClientContext(ctx, 'bea');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const { sharedRootId, teamRootId } = await resolveDiscoveryTaskRoots(ctx);
            const stamp = Date.now();
            let createdTaskId: string | null = null;
            let createdItemId: string | null = null;

            try {
                const beaShared = await FindRows<{ ID: string }>(asPersona(ctx, bea), TASK_ENTITY, `ID = '${sharedRootId}'`, ['ID'], bea.User, { BypassCache: true });
                const beaTeam = await FindRows<{ ID: string }>(asPersona(ctx, bea), TASK_ENTITY, `ID = '${teamRootId}'`, ['ID'], bea.User, { BypassCache: true });
                Assert(beaShared.length === 1 && beaTeam.length === 0, 'Bea reads Discovery Shared task only over wire');

                const harperTasks = await FindRows<{ ID: string }>(
                    asPersona(ctx, harper),
                    TASK_ENTITY,
                    `ID IN ('${sharedRootId}', '${teamRootId}')`,
                    ['ID'],
                    harper.User,
                    { BypassCache: true },
                );
                Assert(harperTasks.length === 0, 'Harper MUST NOT read Discovery tasks over wire');

                const northwindAttempt = await clientOf(bea).CreateSpaceTask({
                    SpaceID: NORTHWIND_SPACE_ID,
                    Name: `${MARK} AP1 northwind ${stamp}`,
                    Band: 'Shared',
                });
                Assert(!northwindAttempt.Success, 'Bea cannot file task into Northwind over wire');

                const teamBandAttempt = await clientOf(bea).CreateSpaceTask({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `${MARK} AP1 team ${stamp}`,
                    Band: 'Team',
                });
                Assert(!teamBandAttempt.Success, 'Bea cannot file Team task in Discovery over wire');

                const harperAttempt = await clientOf(harper).CreateSpaceTask({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `${MARK} AP1 harper ${stamp}`,
                    Band: 'Shared',
                });
                Assert(!harperAttempt.Success, 'Harper cannot file task in Discovery over wire');

                const beaDeleteAttempt = await bea.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, bea.User);
                Assert(await beaDeleteAttempt.Load(sharedRootId), 'Bea loads Shared task over wire');
                Assert(!(await beaDeleteAttempt.Delete()), 'Space Participant Bea MUST NOT delete tasks over wire');

                const created = await clientOf(bea).CreateSpaceTask({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `${MARK} AP1 shared followup ${stamp}`,
                    Band: 'Shared',
                });
                Assert(created.Success === true && !!created.TaskID, `Bea files Shared task over wire: ${created.ErrorMessage ?? ''}`);
                createdTaskId = created.TaskID ?? null;
                createdItemId = created.ItemID ?? null;
            } finally {
                await cleanupTaskRows(ctx, createdTaskId, createdItemId);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP2',
        Name: 'AP2 — over the wire: Meetings adversarial read/write boundaries across visibility, attendee reach, and space boundaries',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const casey = await getPersonaClientContext(ctx, 'casey');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
            const endsAt = new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString();
            const stamp = Date.now();

            let stdMeetingId: string | null = null;
            let privMeetingId: string | null = null;

            try {
                const stdRes = await clientOf(ada).CreateSpaceMeeting({
                    SpaceID: NORTHWIND_SPACE_ID,
                    Name: `${MARK} AP2 Standard ${stamp}`,
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    Visibility: 'Standard',
                });
                Assert(stdRes.Success === true && !!stdRes.MeetingID, `Ada schedules Standard meeting over wire: ${stdRes.ErrorMessage ?? ''}`);
                stdMeetingId = stdRes.MeetingID!;

                const privRes = await clientOf(ada).CreateSpaceMeeting({
                    SpaceID: NORTHWIND_SPACE_ID,
                    Name: `${MARK} AP2 Private ${stamp}`,
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    Visibility: 'Private',
                });
                Assert(privRes.Success === true && !!privRes.MeetingID, `Ada schedules Private meeting over wire: ${privRes.ErrorMessage ?? ''}`);
                privMeetingId = privRes.MeetingID!;

                const caseyStd = await FindRows<{ ID: string }>(asPersona(ctx, casey), MEETING_ENTITY, `ID = '${stdMeetingId}'`, ['ID'], casey.User, { BypassCache: true });
                const caseyPriv = await FindRows<{ ID: string }>(asPersona(ctx, casey), MEETING_ENTITY, `ID = '${privMeetingId}'`, ['ID'], casey.User, { BypassCache: true });
                Assert(caseyStd.length === 1 && caseyPriv.length === 0, 'Casey sees Standard meeting and NOT Private meeting over wire');

                const harperBoth = await FindRows<{ ID: string }>(
                    asPersona(ctx, harper),
                    MEETING_ENTITY,
                    `ID IN ('${stdMeetingId}', '${privMeetingId}')`,
                    ['ID'],
                    harper.User,
                    { BypassCache: true },
                );
                Assert(harperBoth.length === 0, 'Harper reads 0 Northwind meetings over wire');

                const caseyPrivChat = await clientOf(casey).EnsureMeetingSpaceChat({
                    SpaceID: NORTHWIND_SPACE_ID,
                    MeetingID: privMeetingId,
                    MeetingName: `${MARK} AP2 Private ${stamp}`,
                    Visibility: 'Private',
                });
                Assert(!caseyPrivChat.Success, 'Non-attendee Casey cannot ensure chat for Private meeting over wire');

                const harperCreate = await clientOf(harper).CreateSpaceMeeting({
                    SpaceID: NORTHWIND_SPACE_ID,
                    Name: `${MARK} AP2 Harper Trespass ${stamp}`,
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    Visibility: 'Standard',
                });
                Assert(!harperCreate.Success, 'Harper cannot schedule meeting in Northwind over wire');

                const directMeeting = await casey.Provider.GetEntityObject<mjBizAppsTasksMeetingEntity>(MEETING_ENTITY, casey.User);
                directMeeting.NewRecord();
                directMeeting.Name = `${MARK} AP2 Forged ${stamp}`;
                directMeeting.Status = 'Scheduled';
                directMeeting.StartsAt = new Date(startsAt);
                directMeeting.EndsAt = new Date(endsAt);
                directMeeting.TimeZone = 'America/Chicago';
                directMeeting.LocationType = 'Virtual';
                Assert(!(await directMeeting.Save()), 'Space Participant direct Save() on Meetings over wire must be refused');

                const caseyDeleteStd = await casey.Provider.GetEntityObject<mjBizAppsTasksMeetingEntity>(MEETING_ENTITY, casey.User);
                Assert(await caseyDeleteStd.Load(stdMeetingId), 'Casey loads Northwind Standard meeting over wire');
                Assert(!(await caseyDeleteStd.Delete()), 'Space Participant Delete() on Meetings over wire must be refused');
            } finally {
                await cleanupMeetingRows(ctx, privMeetingId);
                await cleanupMeetingRows(ctx, stdMeetingId);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP3',
        Name: 'AP3 — over the wire: Content items, entity record documents, and content chunks enforce read boundaries and block direct writes',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const bea = await getPersonaClientContext(ctx, 'bea');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const stamp = Date.now();

            const createdItemIds: string[] = [];
            const createdFileIds: string[] = [];

            try {
                const sharedUpload = await clientOf(ada).UploadSpaceFile({
                    SpaceID: DISCOVERY_SPACE_ID,
                    FileName: `ap3-wire-shared-${stamp}.pdf`,
                    MimeType: 'application/pdf',
                    Base64Data: makePdf(`AP3 Wire Shared Token${stamp}`).toString('base64'),
                    Folder: 'Pipeline',
                    Band: 'Shared',
                });
                Assert(sharedUpload.Success === true && !!sharedUpload.ItemID, `Ada uploads Shared PDF over wire: ${sharedUpload.ErrorMessage ?? ''}`);
                createdItemIds.push(sharedUpload.ItemID!);

                const teamUpload = await clientOf(ada).UploadSpaceFile({
                    SpaceID: DISCOVERY_SPACE_ID,
                    FileName: `ap3-wire-team-${stamp}.pdf`,
                    MimeType: 'application/pdf',
                    Base64Data: makePdf(`AP3 Wire Team Token${stamp}`).toString('base64'),
                    Folder: 'Pipeline',
                    Band: 'Team',
                });
                Assert(teamUpload.Success === true && !!teamUpload.ItemID, `Ada uploads Team PDF over wire: ${teamUpload.ErrorMessage ?? ''}`);
                createdItemIds.push(teamUpload.ItemID!);

                for (const itemId of createdItemIds) {
                    const [row] = await FindRows<{ RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `ID = '${itemId}'`, ['RecordID'], undefined, { BypassCache: true });
                    if (row?.RecordID) createdFileIds.push(row.RecordID.replace(/^ID\|/i, ''));
                }

                const sharedPipeline = await waitForSpaceItemPipeline(ctx.Provider, ctx.User, sharedUpload.ItemID!);
                const teamPipeline = await waitForSpaceItemPipeline(ctx.Provider, ctx.User, teamUpload.ItemID!);
                Assert(sharedPipeline.chunks.length > 0 && teamPipeline.chunks.length > 0, 'Content pipeline produced chunks for Shared and Team uploads');

                const sharedChunkId = sharedPipeline.chunks[0].ID;
                const teamChunkId = teamPipeline.chunks[0].ID;

                const beaSharedItems = await FindRows<{ ID: string }>(asPersona(ctx, bea), CONTENT_ITEM_ENTITY, `ID = '${sharedPipeline.contentItemId}'`, ['ID'], bea.User, { BypassCache: true });
                const beaSharedChunks = await FindRows<{ ID: string }>(asPersona(ctx, bea), CONTENT_ITEM_CHUNK_ENTITY, `ID = '${sharedChunkId}'`, ['ID'], bea.User, { BypassCache: true });
                Assert(beaSharedItems.length === 1 && beaSharedChunks.length === 1, 'Bea reads Discovery Shared ContentItem and ContentItemChunk over wire');

                const beaTeamItems = await FindRows<{ ID: string }>(asPersona(ctx, bea), CONTENT_ITEM_ENTITY, `ID = '${teamPipeline.contentItemId}'`, ['ID'], bea.User, { BypassCache: true });
                const beaTeamChunks = await FindRows<{ ID: string }>(asPersona(ctx, bea), CONTENT_ITEM_CHUNK_ENTITY, `ID = '${teamChunkId}'`, ['ID'], bea.User, { BypassCache: true });
                const beaTeamErds = await FindRows<{ ID: string }>(
                    asPersona(ctx, bea),
                    ENTITY_RECORD_DOCUMENT_ENTITY,
                    `RecordID IN ('ID|${teamUpload.ItemID!}', '${teamUpload.ItemID!}')`,
                    ['ID'],
                    bea.User,
                    { BypassCache: true },
                );
                Assert(beaTeamItems.length === 0 && beaTeamChunks.length === 0 && beaTeamErds.length === 0, 'Bea MUST NOT read Team ERD, ContentItem, or Chunk over wire');

                const harperChunks = await FindRows<{ ID: string }>(
                    asPersona(ctx, harper),
                    CONTENT_ITEM_CHUNK_ENTITY,
                    `ID IN ('${sharedChunkId}', '${teamChunkId}')`,
                    ['ID'],
                    harper.User,
                    { BypassCache: true },
                );
                Assert(harperChunks.length === 0, 'Harper MUST NOT read Discovery chunks over wire');

                const chunkLoad = await bea.Provider.GetEntityObject<MJContentItemChunkEntity>(CONTENT_ITEM_CHUNK_ENTITY, bea.User);
                Assert(await chunkLoad.Load(sharedChunkId), 'Bea loads Shared chunk over wire');
                chunkLoad.Text = 'tampered';
                Assert(!(await chunkLoad.Save()), 'Bea MUST NOT mutate ContentItemChunk over wire');
                Assert(!(await chunkLoad.Delete()), 'Bea MUST NOT delete ContentItemChunk over wire');

                const itemLoad = await bea.Provider.GetEntityObject<MJContentItemEntity>(CONTENT_ITEM_ENTITY, bea.User);
                Assert(await itemLoad.Load(sharedPipeline.contentItemId), 'Bea loads Shared ContentItem over wire');
                Assert(!(await itemLoad.Delete()), 'Bea MUST NOT delete ContentItem over wire');

                const erdAttempt = await bea.Provider.GetEntityObject<MJEntityRecordDocumentEntity>(ENTITY_RECORD_DOCUMENT_ENTITY, bea.User);
                erdAttempt.NewRecord();
                erdAttempt.RecordID = 'forged';
                Assert(!(await erdAttempt.Save()), 'Bea MUST NOT create EntityRecordDocument over wire');
            } finally {
                await purgeTestSpaceItemPipelineRows(ctx.Provider, ctx.User, createdItemIds);
                await runAllSteps([
                    ...createdItemIds.map((id) => () => deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${id}'`, 'AP3 wire share notice')),
                    ...createdItemIds.map((id) => () => deleteWhere(ctx.Provider, ctx.User, ITEM_USE_ENTITY, `ItemID = '${id}'`, 'AP3 wire item use')),
                    ...createdItemIds.map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, id, 'AP3 wire space item')),
                    ...createdFileIds.map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, FILE_ENTITY, id, 'AP3 wire file')),
                ]);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP4',
        Name: 'AP4 — over the wire: Search scopes lockouts and cross-audience/cross-space chat turn isolation',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const bea = await getPersonaClientContext(ctx, 'bea');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const { sharedName, teamName } = await resolveDiscoveryTaskRoots(ctx);
            const stamp = Date.now();

            let genConvId: string | null = null;
            let genChatId: string | null = null;
            let privConvId: string | null = null;
            let privChatId: string | null = null;

            try {
                const scopeAttempt = await bea.Provider.GetEntityObject<MJSearchScopeEntity>(SEARCH_SCOPE_ENTITY, bea.User);
                scopeAttempt.NewRecord();
                scopeAttempt.Name = `${MARK} AP4 Scope ${stamp}`;
                Assert(!(await scopeAttempt.Save()), 'Bea MUST NOT create MJ: Search Scopes over wire');

                const permAttempt = await bea.Provider.GetEntityObject<MJSearchScopePermissionEntity>(SEARCH_SCOPE_PERMISSION_ENTITY, bea.User);
                permAttempt.NewRecord();
                permAttempt.SearchScopeID = COLLABORATION_SEARCH_SCOPE_ID;
                permAttempt.UserID = bea.User.ID;
                permAttempt.PermissionLevel = 'Manage';
                Assert(!(await permAttempt.Save()), 'Bea MUST NOT create MJ: Search Scope Permissions over wire');

                const beaScopeView = await RunView.FromMetadataProvider(bea.Provider).RunView<{ ID: string }>(
                    { EntityName: SEARCH_SCOPE_ENTITY, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
                    bea.User,
                );
                Assert(!beaScopeView.Success || (beaScopeView.Results?.length ?? 0) === 0, 'Bea has no direct Search Scopes read over wire');

                const genStart = await clientOf(ada).CreateSpaceConversation({ SpaceID: DISCOVERY_SPACE_ID, Name: `ap4-wire-gen-${stamp}`, Kind: 'General' });
                const privStart = await clientOf(ada).CreateSpaceConversation({ SpaceID: DISCOVERY_SPACE_ID, Name: `ap4-wire-priv-${stamp}`, Kind: 'Private' });
                Assert(genStart.Success === true && privStart.Success === true, 'Ada starts General and Private chats over wire');
                genConvId = genStart.ConversationID!;
                genChatId = genStart.SpaceChatID!;
                privConvId = privStart.ConversationID!;
                privChatId = privStart.SpaceChatID!;

                const beaMsg = await clientOf(bea).PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} summarize ${sharedName} and ${teamName}`,
                });
                Assert(beaMsg.Success === true && !!beaMsg.DetailID, 'Bea posts to General chat over wire');
                const beaTurn = await clientOf(bea).ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: beaMsg.DetailID!,
                });
                Assert(beaTurn.Success === true, `Bea General turn succeeds over wire: ${beaTurn.ErrorMessage ?? ''}`);
                const [reply] = await FindRows<{ Message: string }>(
                    asPersona(ctx, bea),
                    CONVERSATION_DETAIL_ENTITY,
                    `ID = '${beaTurn.ReplyDetailIDs?.[0]}'`,
                    ['Message'],
                    bea.User,
                    { BypassCache: true },
                );
                Assert(
                    !!reply?.Message && reply.Message.includes(sharedName) && !reply.Message.includes(teamName),
                    'General wire turn includes Shared task and never leaks Team task',
                );

                // Adversarial Private chat message / turn refusal
                const beaPrivMsg = await clientOf(bea).PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: privConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} show team tasks`,
                });
                Assert(!beaPrivMsg.Success, 'Bea cannot post into Ada Private conversation over wire');

                const harperTurn = await clientOf(harper).ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: beaMsg.DetailID!,
                });
                Assert(!harperTurn.Success, 'Harper cannot execute turn on Discovery conversation over wire');
            } finally {
                if (genConvId && genChatId) await cleanupConversation(ctx.Provider, ctx.User, genConvId, genChatId);
                if (privConvId && privChatId) await cleanupConversation(ctx.Provider, ctx.User, privConvId, privChatId);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP5',
        Name: 'AP5 — over the wire: CT-7 AI run-row lockdown (off-turn refusal + positive wire turn + post-turn mutation denial) and CT-8 owner omission',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const bea = await getPersonaClientContext(ctx, 'bea');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const promptSeed = await resolvePromptSeed(ctx);
            const stamp = Date.now();

            let genConvId: string | null = null;
            let genChatId: string | null = null;
            let adaRunId: string | null = null;
            let previousOwnerUserId: string | null = null;

            try {
                await assertDirectAIRunLockdownOverWire(asPersona(ctx, bea), bea.User, promptSeed, 'Bea wire');
                await assertDirectAIRunLockdownOverWire(asPersona(ctx, harper), harper.User, promptSeed, 'Harper wire');

                const started = await clientOf(ada).CreateSpaceConversation({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `ap5-wire-ct7-${stamp}`,
                    Kind: 'General',
                });
                Assert(started.Success === true && !!started.ConversationID, `Ada starts General chat over wire: ${started.ErrorMessage ?? ''}`);
                genConvId = started.ConversationID!;
                genChatId = started.SpaceChatID!;

                const posted = await clientOf(bea).PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} what shared files are here?`,
                });
                Assert(posted.Success === true && !!posted.DetailID, `Bea posts message over wire: ${posted.ErrorMessage ?? ''}`);

                const turn = await clientOf(bea).ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: genConvId,
                    UserMessageID: posted.DetailID!,
                });
                Assert(turn.Success === true, `Authorized participant wire turn succeeds: ${turn.ErrorMessage ?? ''}`);

                const [reply] = await FindRows<{ Message: string }>(
                    asPersona(ctx, bea),
                    CONVERSATION_DETAIL_ENTITY,
                    `ID = '${turn.ReplyDetailIDs?.[0]}'`,
                    ['Message'],
                    bea.User,
                    { BypassCache: true },
                );
                Assert(
                    !!reply?.Message && reply.Message.includes('site-photo.png') && !reply.Message.includes('discovery-brief.pdf'),
                    'Bea reads permitted Shared reply over wire without leaking Team brief',
                );

                const persistedRuns = await FindRows<{ ID: string }>(
                    ctx,
                    AGENT_RUN_ENTITY,
                    `ConversationID = '${genConvId}'`,
                    ['ID'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(persistedRuns.length >= 1, 'Server persisted AI Agent Run row during wire turn');
                const beaRunId = persistedRuns[0].ID;

                const harperReadsBeaRun = await FindRows<{ ID: string }>(
                    asPersona(ctx, harper),
                    AGENT_RUN_ENTITY,
                    `ID = '${beaRunId}'`,
                    ['ID'],
                    harper.User,
                    { BypassCache: true },
                );
                Assert(harperReadsBeaRun.length === 0, 'Harper MUST NOT read Bea AI Agent Run over wire');

                const postTurnRun = await bea.Provider.GetEntityObject<MJAIAgentRunEntity>(AGENT_RUN_ENTITY, bea.User);
                if (await postTurnRun.Load(beaRunId)) {
                    postTurnRun.Result = 'post-turn-wire-tamper';
                    Assert(!(await postTurnRun.Save()), 'Bea MUST NOT mutate her AI Agent Run over wire after turn ends');
                    Assert(!(await postTurnRun.Delete()), 'Bea MUST NOT delete her AI Agent Run over wire after turn ends');
                }

                // Staff control run isolation
                const adaRun = await ada.Provider.GetEntityObject<MJAIAgentRunEntity>(AGENT_RUN_ENTITY, ada.User);
                adaRun.NewRecord();
                adaRun.AgentID = COLLABORATION_TEST_AGENT_ID;
                adaRun.UserID = ada.User.ID;
                adaRun.Status = 'Completed';
                adaRun.StartedAt = new Date();
                adaRun.CompletedAt = new Date();
                adaRun.Success = true;
                Assert(await adaRun.Save(), 'Staff Ada saves own AI Agent Run over wire');
                adaRunId = adaRun.ID;

                const beaReadsAdaRun = await FindRows<{ ID: string }>(
                    asPersona(ctx, bea),
                    AGENT_RUN_ENTITY,
                    `ID = '${adaRunId}'`,
                    ['ID'],
                    bea.User,
                    { BypassCache: true },
                );
                Assert(beaReadsAdaRun.length === 0, 'Bea MUST NOT read Ada AI Agent Run over wire');

                // CT-8 MJ: AI Agents OwnerUser/OwnerUserID omission
                const agentEnt = await ctx.Provider.GetEntityObject<MJAIAgentEntity>(AI_AGENT_ENTITY, ctx.User);
                Assert(await agentEnt.Load(COLLABORATION_TEST_AGENT_ID), 'Load test agent');
                previousOwnerUserId = agentEnt.OwnerUserID;
                if (!SameID(previousOwnerUserId, ada.User.ID)) {
                    agentEnt.OwnerUserID = ada.User.ID;
                    Assert(await agentEnt.Save(), 'Set test agent OwnerUserID to Ada');
                }

                const [adaAgentRow] = await FindRows<{ OwnerUserID: string; OwnerUser: string }>(
                    asPersona(ctx, ada),
                    AI_AGENT_ENTITY,
                    `ID = '${COLLABORATION_TEST_AGENT_ID}'`,
                    ['OwnerUserID', 'OwnerUser'],
                    ada.User,
                    { BypassCache: true },
                );
                Assert(SameID(adaAgentRow?.OwnerUserID, ada.User.ID) && !!adaAgentRow?.OwnerUser, 'Staff Ada reads OwnerUser/OwnerUserID over wire');

                await assertFieldAccessDeniedOrOmitted(asPersona(ctx, bea), bea.User, COLLABORATION_TEST_AGENT_ID, 'Bea wire CT-8');
                await assertFieldAccessDeniedOrOmitted(asPersona(ctx, harper), harper.User, COLLABORATION_TEST_AGENT_ID, 'Harper wire CT-8');
            } finally {
                if (previousOwnerUserId) {
                    const restoreAgent = await ctx.Provider.GetEntityObject<MJAIAgentEntity>(AI_AGENT_ENTITY, ctx.User);
                    if (await restoreAgent.Load(COLLABORATION_TEST_AGENT_ID)) {
                        restoreAgent.OwnerUserID = previousOwnerUserId;
                        await restoreAgent.Save();
                    }
                }
                if (adaRunId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, AGENT_RUN_ENTITY, adaRunId, 'AP5 wire Ada run');
                }
                if (genConvId && genChatId) await cleanupConversation(ctx.Provider, ctx.User, genConvId, genChatId);
            }
        },
    },
    {
        Id: 'adversarial-persona.AP6',
        Name: 'AP6 — over the wire: Multi-role non-staff user holding Space Participant + secondary non-staff role preserves full boundary lockdown',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const promptSeed = await resolvePromptSeed(ctx);
            const { sharedRootId, teamRootId } = await resolveDiscoveryTaskRoots(ctx);
            const stamp = Date.now();
            const multiEmail = `ct6.wire.multirole.${stamp}@collab-world.example`;

            let tempRoleId: string | null = null;
            let tempUserId: string | null = null;
            const tempUserRoleIds: string[] = [];
            let tempPersonId: string | null = null;
            let tempMemberId: string | null = null;
            let mintedKeyId: string | null = null;
            let mintedScopeRuleId: string | null = null;
            let teamUploadItemId: string | null = null;
            let teamUploadFileId: string | null = null;

            try {
                const role = await ctx.Provider.GetEntityObject<MJRoleEntity>(ROLE_ENTITY, ctx.User);
                role.NewRecord();
                role.Name = `CT6 Wire NonStaff ${stamp}`;
                role.Description = 'Temporary secondary non-staff role for CT-6 wire check';
                Assert(await role.Save(), `Create temporary non-staff role: ${role.LatestResult?.CompleteMessage ?? ''}`);
                tempRoleId = role.ID;

                const user = await ctx.Provider.GetEntityObject<MJUserEntity>(USER_ENTITY, ctx.User);
                user.NewRecord();
                user.Name = `CT6 Wire MultiRole ${stamp}`;
                user.Email = multiEmail;
                user.FirstName = 'CT6';
                user.LastName = 'WireMulti';
                user.Type = 'User';
                user.IsActive = true;
                Assert(await user.Save(), `Create multi-role user: ${user.LatestResult?.CompleteMessage ?? ''}`);
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
                person.LastName = 'WireMulti';
                person.Email = multiEmail;
                person.LinkedUserID = tempUserId;
                Assert(await person.Save(), `Create person: ${person.LatestResult?.CompleteMessage ?? ''}`);
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

                const minted = await mintUserApiKey(ctx, tempUserId, `ct6-multirole-wire-${stamp}`);
                mintedKeyId = minted.keyId;
                mintedScopeRuleId = minted.scopeRuleId;

                // Wait for MJAPI UserCache debounce so CurrentUser reflects both roles
                let multiProvider = await buildUserKeyProvider(minted.rawKey);
                const cacheDeadline = Date.now() + 10_000;
                while ((multiProvider.CurrentUser?.UserRoles?.length ?? 0) < 2 && Date.now() < cacheDeadline) {
                    await new Promise((r) => setTimeout(r, 350));
                    multiProvider = await buildUserKeyProvider(minted.rawKey);
                }
                const multiUser = multiProvider.CurrentUser;
                Assert(!!multiUser && multiUser.UserRoles.length >= 2, `MJAPI sees >= 2 roles for multi-role user (saw ${multiUser?.UserRoles.length ?? 0})`);

                const teamPdf = await clientOf(ada).UploadSpaceFile({
                    SpaceID: DISCOVERY_SPACE_ID,
                    FileName: `ap6-wire-team-${stamp}.pdf`,
                    MimeType: 'application/pdf',
                    Base64Data: makePdf(`AP6 Wire Team Token${stamp}`).toString('base64'),
                    Folder: 'Pipeline',
                    Band: 'Team',
                });
                Assert(teamPdf.Success === true && !!teamPdf.ItemID, 'Ada uploads AP6 Team PDF');
                teamUploadItemId = teamPdf.ItemID!;
                const [itemRow] = await FindRows<{ RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `ID = '${teamUploadItemId}'`, ['RecordID'], undefined, { BypassCache: true });
                if (itemRow?.RecordID) teamUploadFileId = itemRow.RecordID.replace(/^ID\|/i, '');
                const teamPipeline = await waitForSpaceItemPipeline(ctx.Provider, ctx.User, teamUploadItemId);
                Assert(teamPipeline.chunks.length > 0, 'AP6 Team PDF produced chunks');

                const multiCtx: IntegrationCheckContext = { ...ctx, Provider: multiProvider, User: multiUser! };
                const multiClient = new CollaborationClient(multiProvider);

                const multiSpaces = await FindRows<{ ID: string }>(multiCtx, SPACE_ENTITY, `ID IN ('${DISCOVERY_SPACE_ID}', '${HARBOR_SPACE_ID}')`, ['ID'], multiUser, { BypassCache: true });
                Assert(
                    multiSpaces.some((s) => SameID(s.ID, DISCOVERY_SPACE_ID)) && !multiSpaces.some((s) => SameID(s.ID, HARBOR_SPACE_ID)),
                    'Multi-role user sees Discovery and NOT Harbor over wire',
                );

                const multiSharedTask = await FindRows<{ ID: string }>(multiCtx, TASK_ENTITY, `ID = '${sharedRootId}'`, ['ID'], multiUser, { BypassCache: true });
                const multiTeamTask = await FindRows<{ ID: string }>(multiCtx, TASK_ENTITY, `ID = '${teamRootId}'`, ['ID'], multiUser, { BypassCache: true });
                Assert(multiSharedTask.length === 1 && multiTeamTask.length === 0, 'Multi-role user reads Shared task only over wire');

                const teamTaskAttempt = await multiClient.CreateSpaceTask({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `${MARK} AP6 wire team task ${stamp}`,
                    Band: 'Team',
                });
                Assert(!teamTaskAttempt.Success, 'Multi-role user cannot file Team task over wire');

                const meetings = await FindRows<{ ID: string }>(multiCtx, MEETING_ENTITY, '', ['ID'], multiUser, { BypassCache: true });
                Assert(meetings.length === 0, 'Multi-role user sees 0 unseated Northwind meetings over wire');

                const multiChunks = await FindRows<{ ID: string }>(
                    multiCtx,
                    CONTENT_ITEM_CHUNK_ENTITY,
                    `ID = '${teamPipeline.chunks[0].ID}'`,
                    ['ID'],
                    multiUser,
                    { BypassCache: true },
                );
                Assert(multiChunks.length === 0, 'Multi-role user MUST NOT read Team chunk over wire');

                const chunkAttempt = await multiProvider.GetEntityObject<MJContentItemChunkEntity>(CONTENT_ITEM_CHUNK_ENTITY, multiUser);
                chunkAttempt.NewRecord();
                chunkAttempt.ContentItemID = teamPipeline.contentItemId;
                chunkAttempt.Sequence = 88;
                chunkAttempt.Text = 'forged';
                Assert(!(await chunkAttempt.Save()), 'Multi-role user MUST NOT write ContentItemChunk over wire');

                const scopeAttempt = await multiProvider.GetEntityObject<MJSearchScopeEntity>(SEARCH_SCOPE_ENTITY, multiUser);
                scopeAttempt.NewRecord();
                scopeAttempt.Name = `${MARK} AP6 Scope ${stamp}`;
                Assert(!(await scopeAttempt.Save()), 'Multi-role user MUST NOT write Search Scopes over wire');

                await assertDirectAIRunLockdownOverWire(multiCtx, multiUser!, promptSeed, 'Multi-role wire CT-7');
                await assertFieldAccessDeniedOrOmitted(multiCtx, multiUser!, COLLABORATION_TEST_AGENT_ID, 'Multi-role wire CT-8');

                const inviteAttempt = await multiClient.MintSpaceLink({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Email: `forged-wire-invite-${stamp}@example.com`,
                    RoleID: clientMemberRole!.ID,
                });
                Assert(!inviteAttempt.Success, 'Multi-role non-staff user MUST NOT mint space invite links over wire (CT-5)');
            } finally {
                if (mintedScopeRuleId) await deleteRowAndConfirm(ctx.Provider, ctx.User, 'MJ: API Key Scopes', mintedScopeRuleId, 'AP6 wire key scope');
                if (mintedKeyId) await deleteRowAndConfirm(ctx.Provider, ctx.User, 'MJ: API Keys', mintedKeyId, 'AP6 wire api key');
                if (teamUploadItemId) {
                    await purgeTestSpaceItemPipelineRows(ctx.Provider, ctx.User, [teamUploadItemId]);
                    await deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${teamUploadItemId}'`, 'AP6 wire share notice');
                    await deleteWhere(ctx.Provider, ctx.User, ITEM_USE_ENTITY, `ItemID = '${teamUploadItemId}'`, 'AP6 wire item use');
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, teamUploadItemId, 'AP6 wire space item');
                }
                if (teamUploadFileId) await deleteRowAndConfirm(ctx.Provider, ctx.User, FILE_ENTITY, teamUploadFileId, 'AP6 wire file');
                if (tempMemberId) await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, tempMemberId, 'AP6 wire seat');
                if (tempPersonId) await deleteRowAndConfirm(ctx.Provider, ctx.User, PERSON_ENTITY, tempPersonId, 'AP6 wire person');
                for (const urId of tempUserRoleIds) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, USER_ROLE_ENTITY, urId, 'AP6 wire user-role');
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
                            Assert(deleted, `AP6 wire temporary role cleanup failed: ${r.LatestResult?.CompleteMessage ?? ''}`);
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
