/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Cross-Stack Real-World Enterprise Integration Checks (`MJ Core` -> `bizapps-common` ->
 * `bizapps-tasks` -> `bizapps-collaboration`) running live against SQL Server.
 *
 * Exercises multi-organization enterprise worlds (`Meridian Advisory Group`,
 * `Northstar Manufacturing Corp`, `Solstice Logistics Ltd`), record-bound subtyped spaces
 * via `EnsureSpaceForRecord`, dual-band `Docs` + `bizapps-tasks` approval promotion,
 * seat sync/sealed boundaries, and an adversarial cross-tenant isolation matrix.
 */
import type { IMetadataProvider } from '@memberjunction/core';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { SHIPPED_STATUSES } from '@mj-biz-apps/collaboration-core';
import { type mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
import {
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceMemberEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
    type mjBizAppsCollaborationSpaceTypeStatusEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    CollaborationEngine,
    CollaborationSpaceItemArtifactPermissionDelegate,
    createSpaceDraftApprovalTask,
    createSpaceTask,
    decideAndPromoteSpaceDraft,
    decideUploadBand,
    EnsureSpaceForRecord,
    getSpaceApprovalTask,
    getSpaceDoc,
    listSpaceApprovalTasks,
    listSpaceDocs,
    mintSpaceLink,
    postSpaceMessage,
    resolveStructuralChatScope,
    uploadSpaceFile,
    collaborationFileStore,
} from '@mj-biz-apps/collaboration-core-entities-server';
import {
    ARTIFACT_ENTITY,
    ARTIFACT_VERSION_ENTITY,
    AUDIT_LOG_ENTITY,
    COMPANY_ENTITY,
    CONTACT_METHOD_ENTITY,
    CONVERSATION_DETAIL_ENTITY,
    ORGANIZATION_ENTITY,
    PERSON_ENTITY,
    RELATIONSHIP_ENTITY,
    SPACE_ANCHOR_ENTITY,
    SPACE_CHAT_ENTITY,
    SPACE_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    SPACE_TYPE_ENTITY,
    SPACE_TYPE_STATUS_ENTITY,
    TASK_ACTIVITY_ENTITY,
    TASK_ASSIGNMENT_ENTITY,
    TASK_DECISION_ENTITY,
    TASK_ENTITY,
    TASK_LINK_ENTITY,
    TASK_TYPE_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser, SameID } from '../wire.js';
import {
    ENTERPRISE_DOC_TITLES,
    ENTERPRISE_ORG_NAMES,
    ENTERPRISE_SPACE_NAMES,
    MERIDIAN_COMPANY_ID,
    MERIDIAN_ORG_ID,
    NORTHSTAR_COMPANY_ID,
    NORTHSTAR_ORG_ID,
    NORTHSTAR_PHASE1_TASK_ID,
    NORTHSTAR_PROGRAM_TASK_ID,
    NORTHSTAR_SIGNOFF_TASK_ID,
    SOLSTICE_CALIBRATION_TASK_ID,
    SOLSTICE_COMPANY_ID,
    SOLSTICE_ORG_ID,
    SOLSTICE_PROGRAM_TASK_ID,
} from '../world/enterprise-ids.js';
import { CHECK_SPACE_PREFIX } from '../world/ids.js';
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount } from '../world/local-storage-account.js';
import { worldStorageRoot } from '../world/seed-files.js';
import { cleanupSpace, cleanupStep, deleteWhere, registerChecks } from './cleanup-helpers.js';

const EXAMPLE_BOARDS_ENTITY = 'MJ_BizApps_Collaboration_Examples: Example Boards';
const MARK = 'COLLAB-CHECK cross-stack';

async function resolveEnterpriseSpaceId(ctx: IntegrationCheckContext, taskRecordId: string, label: string): Promise<string> {
    const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
    Assert(!!taskEntity, 'Task entity metadata must exist');
    const anchors = await FindRows<{ SpaceID: string }>(
        ctx,
        SPACE_ANCHOR_ENTITY,
        `EntityID = '${taskEntity!.ID}' AND (RecordID = '${taskRecordId}' OR RecordID = 'ID|${taskRecordId}') AND IsPrimary = 1`,
        ['SpaceID'],
        undefined,
        { BypassCache: true },
    );
    Assert(anchors.length === 1, `Expected 1 primary SpaceAnchor for ${label} (${taskRecordId}), found ${anchors.length}`);
    return anchors[0].SpaceID;
}

async function resolveGeneralTaskTypeId(ctx: IntegrationCheckContext): Promise<string> {
    const rows = await FindRows<{ ID: string }>(ctx, TASK_TYPE_ENTITY, "Code = 'GENERAL'", ['ID']);
    if (rows.length > 0) return rows[0].ID;
    const fallback = await FindRows<{ ID: string }>(ctx, TASK_TYPE_ENTITY, 'IsActive = 1', ['ID']);
    Assert(fallback.length > 0, 'At least one active TaskType must exist');
    return fallback[0].ID;
}

async function cleanupApprovalArtifacts(
    ctx: IntegrationCheckContext,
    ids: {
        taskId?: string | null;
        taskSpaceItemId?: string | null;
        draftSpaceItemId?: string | null;
        draftArtifactId?: string | null;
        draftVersionId?: string | null;
    },
): Promise<void> {
    if (ids.taskId) {
        await deleteWhere(ctx.Provider, ctx.User, TASK_DECISION_ENTITY, `TaskID = '${ids.taskId}'`, 'approval task decisions');
        await deleteWhere(ctx.Provider, ctx.User, TASK_ACTIVITY_ENTITY, `TaskID = '${ids.taskId}'`, 'approval task activities');
        await deleteWhere(ctx.Provider, ctx.User, TASK_LINK_ENTITY, `TaskID = '${ids.taskId}'`, 'approval task links');
        await deleteWhere(ctx.Provider, ctx.User, TASK_ASSIGNMENT_ENTITY, `TaskID = '${ids.taskId}'`, 'approval task assignments');
    }
    if (ids.taskSpaceItemId) {
        await deleteWhere(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, `ID = '${ids.taskSpaceItemId}'`, 'approval task space item');
    }
    if (ids.draftSpaceItemId) {
        await deleteWhere(ctx.Provider, ctx.User, AUDIT_LOG_ENTITY, `RecordID = '${ids.draftSpaceItemId}'`, 'draft promotion audit logs');
        await deleteWhere(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, `ID = '${ids.draftSpaceItemId}'`, 'draft doc space item');
    }
    if (ids.draftVersionId) {
        await deleteWhere(ctx.Provider, ctx.User, ARTIFACT_VERSION_ENTITY, `ID = '${ids.draftVersionId}'`, 'draft artifact version');
    }
    if (ids.draftArtifactId) {
        await deleteWhere(ctx.Provider, ctx.User, ARTIFACT_ENTITY, `ID = '${ids.draftArtifactId}'`, 'draft artifact');
    }
    if (ids.taskId) {
        await deleteWhere(ctx.Provider, ctx.User, TASK_ENTITY, `ID = '${ids.taskId}'`, 'approval task');
    }
}

const checks: NamedCheck[] = [
    {
        Id: 'cross-stack-enterprise.CE1',
        Name: 'CE1 — Common multi-org enterprise graph, Company mirror, multi-level Tasks hierarchy, and polymorphic TaskLinks exist end to end',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const orgs = await FindRows<{ ID: string; Name: string; Status: string }>(
                ctx,
                ORGANIZATION_ENTITY,
                `ID IN ('${MERIDIAN_ORG_ID}', '${NORTHSTAR_ORG_ID}', '${SOLSTICE_ORG_ID}')`,
                ['ID', 'Name', 'Status'],
                undefined,
                { BypassCache: true },
            );
            Assert(orgs.length === 3, `Expected 3 enterprise organizations, found ${orgs.length}`);
            const byId = new Map(orgs.map((o) => [o.ID.toLowerCase(), o]));
            Assert(byId.get(MERIDIAN_ORG_ID.toLowerCase())?.Name === ENTERPRISE_ORG_NAMES.meridian, 'Meridian Advisory Group exists');
            Assert(byId.get(NORTHSTAR_ORG_ID.toLowerCase())?.Name === ENTERPRISE_ORG_NAMES.northstar, 'Northstar Manufacturing Corp exists');
            Assert(byId.get(SOLSTICE_ORG_ID.toLowerCase())?.Name === ENTERPRISE_ORG_NAMES.solstice, 'Solstice Logistics Ltd exists');

            if (ctx.Provider.EntityByName(COMPANY_ENTITY)) {
                const companies = await FindRows<{ ID: string; Name: string }>(
                    ctx,
                    COMPANY_ENTITY,
                    `ID IN ('${MERIDIAN_COMPANY_ID}', '${NORTHSTAR_COMPANY_ID}', '${SOLSTICE_COMPANY_ID}')`,
                    ['ID', 'Name'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(companies.length === 3, `Expected 3 mirrored MJ: Companies rows, found ${companies.length}`);
                const companyById = new Map(companies.map((c) => [c.ID.toLowerCase(), c]));
                Assert(companyById.get(MERIDIAN_COMPANY_ID.toLowerCase())?.Name === ENTERPRISE_ORG_NAMES.meridian, 'Meridian Company mirror exists');
                Assert(companyById.get(NORTHSTAR_COMPANY_ID.toLowerCase())?.Name === ENTERPRISE_ORG_NAMES.northstar, 'Northstar Company mirror exists');
                Assert(companyById.get(SOLSTICE_COMPANY_ID.toLowerCase())?.Name === ENTERPRISE_ORG_NAMES.solstice, 'Solstice Company mirror exists');
            }

            // Relationships & Contact Methods across all three organizations
            const rels = await FindRows<{ ToOrganizationID: string; Title: string | null; Status: string }>(
                ctx,
                RELATIONSHIP_ENTITY,
                `ToOrganizationID IN ('${MERIDIAN_ORG_ID}', '${NORTHSTAR_ORG_ID}', '${SOLSTICE_ORG_ID}') AND Status = 'Active'`,
                ['ToOrganizationID', 'Title', 'Status'],
                undefined,
                { BypassCache: true },
            );
            Assert(rels.length >= 7, `Expected >= 7 active person-to-organization relationships, found ${rels.length}`);
            const relOrgSet = new Set(rels.map((r) => r.ToOrganizationID.toLowerCase()));
            Assert(relOrgSet.has(MERIDIAN_ORG_ID.toLowerCase()), 'Meridian has active relationships');
            Assert(relOrgSet.has(NORTHSTAR_ORG_ID.toLowerCase()), 'Northstar has active relationships');
            Assert(relOrgSet.has(SOLSTICE_ORG_ID.toLowerCase()), 'Solstice has active relationships');

            const orgContacts = await FindRows<{ OrganizationID: string; Value: string }>(
                ctx,
                CONTACT_METHOD_ENTITY,
                `OrganizationID IN ('${MERIDIAN_ORG_ID}', '${NORTHSTAR_ORG_ID}', '${SOLSTICE_ORG_ID}')`,
                ['OrganizationID', 'Value'],
                undefined,
                { BypassCache: true },
            );
            Assert(orgContacts.length >= 3, `Expected >= 3 organization contact methods, found ${orgContacts.length}`);

            // Multi-level Tasks hierarchy linked to Common Organizations via polymorphic TaskLinks
            const tasks = await FindRows<{ ID: string; ParentID: string | null; Name: string }>(
                ctx,
                TASK_ENTITY,
                `ID IN ('${NORTHSTAR_PROGRAM_TASK_ID}', '${NORTHSTAR_PHASE1_TASK_ID}', '${NORTHSTAR_SIGNOFF_TASK_ID}', '${SOLSTICE_PROGRAM_TASK_ID}', '${SOLSTICE_CALIBRATION_TASK_ID}')`,
                ['ID', 'ParentID', 'Name'],
                undefined,
                { BypassCache: true },
            );
            Assert(tasks.length === 5, `Expected 5 enterprise tasks, found ${tasks.length}`);
            const taskMap = new Map(tasks.map((t) => [t.ID.toLowerCase(), t]));
            Assert(SameID(taskMap.get(NORTHSTAR_PHASE1_TASK_ID.toLowerCase())?.ParentID, NORTHSTAR_PROGRAM_TASK_ID), 'Phase 1 task is child of Northstar Program');
            Assert(SameID(taskMap.get(NORTHSTAR_SIGNOFF_TASK_ID.toLowerCase())?.ParentID, NORTHSTAR_PHASE1_TASK_ID), 'Sign-off task is grandchild of Northstar Program');

            // Polymorphic TaskLinks connecting Tasks -> Collaboration Spaces and Organizations
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const solsticeHubId = await resolveEnterpriseSpaceId(ctx, SOLSTICE_PROGRAM_TASK_ID, 'Solstice Hub');
            const links = await FindRows<{ TaskID: string; EntityID: string; RecordID: string }>(
                ctx,
                TASK_LINK_ENTITY,
                `TaskID IN ('${NORTHSTAR_PROGRAM_TASK_ID}', '${NORTHSTAR_PHASE1_TASK_ID}', '${SOLSTICE_PROGRAM_TASK_ID}')`,
                ['TaskID', 'EntityID', 'RecordID'],
                undefined,
                { BypassCache: true },
            );
            Assert(links.length >= 5, `Expected >= 5 cross-stack TaskLinks, found ${links.length}`);
            Assert(
                links.some((l) => SameID(l.TaskID, NORTHSTAR_PROGRAM_TASK_ID) && l.RecordID.toLowerCase().includes(NORTHSTAR_ORG_ID.toLowerCase())),
                'Northstar Program Task links polymorphically to Northstar Org',
            );
            Assert(
                links.some((l) => SameID(l.TaskID, SOLSTICE_PROGRAM_TASK_ID) && l.RecordID.toLowerCase().includes(SOLSTICE_ORG_ID.toLowerCase())),
                'Solstice Program Task links polymorphically to Solstice Org',
            );
            Assert(
                links.some((l) => SameID(l.TaskID, NORTHSTAR_PROGRAM_TASK_ID) && l.RecordID.toLowerCase().includes(northstarHubId.toLowerCase())),
                'Northstar Program Task links polymorphically to Northstar Collaboration Hub',
            );
            Assert(
                links.some((l) => SameID(l.TaskID, SOLSTICE_PROGRAM_TASK_ID) && l.RecordID.toLowerCase().includes(solsticeHubId.toLowerCase())),
                'Solstice Program Task links polymorphically to Solstice Collaboration Hub',
            );
        },
    },
    {
        Id: 'cross-stack-enterprise.CE2',
        Name: 'CE2 — EnsureSpaceForRecord creates subtyped ExampleBoard space bound to a Tasks record with owner seat, sealed defaults, concurrent idempotency, and rival refusal',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const harper = await GetPersonaUser(ctx, 'harper');
            const taskTypeId = await resolveGeneralTaskTypeId(ctx);
            const [adaPerson] = await FindRows<{ ID: string }>(ctx, PERSON_ENTITY, `LinkedUserID = '${ada.ID}'`, ['ID']);
            Assert(!!adaPerson, 'Ada Person record exists');

            let createdTaskId: string | null = null;
            let createdSpaceId: string | null = null;

            try {
                const task = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, ctx.User);
                task.NewRecord();
                task.Name = `${MARK} Steering Committee Record ${Date.now()}`;
                task.TypeID = taskTypeId;
                task.CreatedByPersonID = adaPerson.ID;
                task.Status = 'Open';
                task.Priority = 'High';
                Assert(await task.Save() && !!task.ID, `Create anchorable task failed: ${task.LatestResult?.CompleteMessage ?? ''}`);
                createdTaskId = task.ID;

                const spaceName = `${CHECK_SPACE_PREFIX}CE2 Steering Board ${Date.now()}`;
                const providerWithFork = ctx.Provider as IMetadataProvider & {
                    CreateIndependentInstance?: () => Promise<IMetadataProvider>;
                };
                const secondProvider =
                    typeof providerWithFork.CreateIndependentInstance === 'function'
                        ? await providerWithFork.CreateIndependentInstance()
                        : ctx.Provider;
                const [first, second] = await Promise.all([
                    EnsureSpaceForRecord({
                        typeCode: 'example-board',
                        entityName: TASK_ENTITY,
                        recordId: createdTaskId,
                        spaceName,
                        details: { TermName: 'FY2026 Steering', QuorumPercentage: 65 },
                        contextUser: ada,
                        provider: ctx.Provider,
                    }),
                    EnsureSpaceForRecord({
                        typeCode: 'example-board',
                        entityName: TASK_ENTITY,
                        recordId: createdTaskId,
                        spaceName,
                        details: { TermName: 'FY2026 Steering', QuorumPercentage: 65 },
                        contextUser: ada,
                        provider: secondProvider,
                    }),
                ]);

                Assert(!!first.ID && SameID(first.ID, second.ID), `Concurrent EnsureSpaceForRecord must converge on one SpaceID (${first.ID} vs ${second.ID})`);
                createdSpaceId = first.ID;
                Assert(first.InheritsMembership === false, 'EnsureSpaceForRecord enforces sealed posture by default (InheritsMembership = false)');

                // Verify subtype row was created atomically with typed details
                const [boardRow] = await FindRows<{ ID: string; TermName: string; QuorumPercentage: number }>(
                    ctx,
                    EXAMPLE_BOARDS_ENTITY,
                    `ID = '${createdSpaceId}'`,
                    ['ID', 'TermName', 'QuorumPercentage'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(
                    !!boardRow && boardRow.TermName === 'FY2026 Steering' && boardRow.QuorumPercentage === 65,
                    `ExampleBoard subtype row must match details: ${JSON.stringify(boardRow)}`,
                );

                // Verify owner seat was auto-provisioned on Team band
                const ownerSeats = await FindRows<{ UserID: string; Band: string; Status: string }>(
                    ctx,
                    SPACE_MEMBER_ENTITY,
                    `SpaceID = '${createdSpaceId}' AND UserID = '${ada.ID}'`,
                    ['UserID', 'Band', 'Status'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(
                    ownerSeats.length === 1 && ownerSeats[0].Band === 'Team' && ownerSeats[0].Status === 'Active',
                    `Owner seat auto-provisioned on Team band: ${JSON.stringify(ownerSeats)}`,
                );

                // Verify exactly 1 primary anchor exists (no duplicate anchors under concurrency)
                const anchors = await FindRows<{ ID: string; IsPrimary: boolean }>(
                    ctx,
                    SPACE_ANCHOR_ENTITY,
                    `SpaceID = '${createdSpaceId}' AND IsPrimary = 1`,
                    ['ID', 'IsPrimary'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(anchors.length === 1, `Expected 1 primary anchor, found ${anchors.length}`);

                // Repeated call as Ada is idempotent
                const repeat = await EnsureSpaceForRecord({
                    typeCode: 'example-board',
                    entityName: TASK_ENTITY,
                    recordId: createdTaskId,
                    contextUser: ada,
                    provider: ctx.Provider,
                });
                Assert(SameID(repeat.ID, createdSpaceId), 'Repeated EnsureSpaceForRecord resolves the existing space');

                // Rival Client B (Harper) calling EnsureSpaceForRecord for the same record is refused
                let rivalRefused = false;
                try {
                    await EnsureSpaceForRecord({
                        typeCode: 'example-board',
                        entityName: TASK_ENTITY,
                        recordId: createdTaskId,
                        contextUser: harper,
                        provider: ctx.Provider,
                    });
                } catch (err) {
                    rivalRefused = /cannot access|denied|refused|permission/i.test(err instanceof Error ? err.message : String(err));
                }
                Assert(rivalRefused, 'Rival external participant Harper MUST be refused access to Northstar anchored space');
            } finally {
                if (createdSpaceId) {
                    // Close ExampleBoard before deleting (board driver blocks deleting an open board)
                    await cleanupStep(async () => {
                        const loaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                        if (await loaded.Load(createdSpaceId!)) {
                            loaded.ClosedAt = new Date(Date.now() - 60_000);
                            await loaded.Save();
                        }
                    });
                    await cleanupSpace(ctx.Provider, ctx.User, createdSpaceId);
                }
                if (createdTaskId) {
                    await deleteWhere(ctx.Provider, ctx.User, TASK_ACTIVITY_ENTITY, `TaskID = '${createdTaskId}'`, 'CE2 anchor task activities');
                    await deleteWhere(ctx.Provider, ctx.User, TASK_ENTITY, `ID = '${createdTaskId}'`, 'CE2 anchor task');
                }
            }
        },
    },
    {
        Id: 'cross-stack-enterprise.CE3',
        Name: 'CE3 — Dual-band Docs draft -> bizapps-tasks APPROVAL_REQUEST Task + TaskLink -> approval promotion unlocks Client A while keeping Rival Client B at zero rows',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');
            const dev = await GetPersonaUser(ctx, 'dev');
            const bea = await GetPersonaUser(ctx, 'bea');
            const harper = await GetPersonaUser(ctx, 'harper');
            const spaceItemsEntity = ctx.Provider.EntityByName(SPACE_ITEM_ENTITY);
            const tasksEntity = ctx.Provider.EntityByName(TASK_ENTITY);
            Assert(!!spaceItemsEntity && !!tasksEntity, 'Space Items and Tasks entity metadata exist');

            const [ownerRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            const [memberRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'member'", ['ID']);
            const [clientMemberRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'client-member'", ['ID']);
            Assert(!!ownerRole && !!memberRole && !!clientMemberRole, 'Required space role types exist');

            let deliveryTypeId: string | null = null;
            let deliverySpaceId: string | null = null;
            let taskId: string | null = null;
            let taskSpaceItemId: string | null = null;
            let draftSpaceItemId: string | null = null;
            let draftArtifactId: string | null = null;
            let draftVersionId: string | null = null;

            try {
                // Create a temporary SpaceType configured with Ada as per-root DeliveryPrincipal (CA-4)
                const st = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, ctx.User);
                st.NewRecord();
                st.Code = `ce3-delivery-${Date.now()}`;
                st.Name = `${MARK} Delivery Hub Type`;
                st.Vocabulary = 'delivery hub';
                st.InviteApproval = 'AutoApprove';
                st.Configuration = JSON.stringify({
                    DeliveryPrincipal: { UserID: ada.ID },
                });
                Assert(await st.Save() && !!st.ID, `Create CE3 delivery SpaceType failed: ${st.LatestResult?.CompleteMessage ?? ''}`);
                deliveryTypeId = st.ID;

                for (const shipped of SHIPPED_STATUSES) {
                    const statusRow = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeStatusEntity>(
                        SPACE_TYPE_STATUS_ENTITY,
                        ctx.User,
                    );
                    statusRow.NewRecord();
                    statusRow.SpaceTypeID = deliveryTypeId;
                    statusRow.Code = shipped.Code;
                    statusRow.Name = shipped.Name;
                    statusRow.Sequence = shipped.Sequence;
                    statusRow.IsDefault = shipped.IsDefault;
                    statusRow.ReadOnly = shipped.ReadOnly;
                    statusRow.Visible = shipped.Visible;
                    statusRow.AgentRetrieval = shipped.AgentRetrieval;
                    statusRow.CanChangeAfter = shipped.CanChangeAfter;
                    statusRow.NotifyMembersOnEnter = shipped.NotifyMembersOnEnter;
                    statusRow.IsTerminal = shipped.IsTerminal;
                    Assert(await statusRow.Save(), `Save CE3 SpaceTypeStatus ${shipped.Code} failed`);
                }
                await CollaborationEngine.Instance.Config(true, ctx.User, ctx.Provider);

                const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                space.NewRecord();
                space.Name = `${CHECK_SPACE_PREFIX}CE3 Delivery Hub ${Date.now()}`;
                space.SpaceTypeID = deliveryTypeId;
                space.OwnerID = ada.ID;
                space.InheritsMembership = false;
                Assert(await space.Save() && !!space.ID, `Create CE3 delivery space failed: ${space.LatestResult?.CompleteMessage ?? ''}`);
                deliverySpaceId = space.ID;

                for (const seatSpec of [
                    { userId: ada.ID, roleId: ownerRole.ID, band: 'Team' as const },
                    { userId: sam.ID, roleId: memberRole.ID, band: 'Team' as const },
                    { userId: dev.ID, roleId: ownerRole.ID, band: 'Team' as const },
                    { userId: bea.ID, roleId: clientMemberRole.ID, band: 'Shared' as const },
                ]) {
                    const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                    seat.NewRecord();
                    seat.SpaceID = deliverySpaceId;
                    seat.UserID = seatSpec.userId;
                    seat.SpaceRoleTypeID = seatSpec.roleId;
                    seat.Band = seatSpec.band;
                    seat.Status = 'Active';
                    Assert(await seat.Save(), `Seat user ${seatSpec.userId} on CE3 space failed: ${seat.LatestResult?.CompleteMessage ?? ''}`);
                }

                // 1. Sam (Meridian internal contributor) creates a Team-band draft Doc + linked Tasks approval request
                const draftTitle = `${MARK} Go-Live Runbook ${Date.now()}`;
                const created = await createSpaceDraftApprovalTask({
                    provider: ctx.Provider,
                    callerUser: sam,
                    spaceId: deliverySpaceId,
                    title: draftTitle,
                    content: '# Northstar Go-Live Runbook\n\nCutover sequence verified by Meridian delivery team.',
                    rootEntityId: tasksEntity!.ID,
                    rootRecordId: `ID|${NORTHSTAR_PHASE1_TASK_ID}`,
                    folder: 'Deliverables',
                });
                Assert(created.ok === true, `createSpaceDraftApprovalTask failed: ${created.ok ? '' : created.message}`);
                if (!created.ok) throw new Error(created.message);

                taskId = created.data.taskId;
                taskSpaceItemId = created.data.taskSpaceItemId;
                draftSpaceItemId = created.data.draftSpaceItemId;
                draftArtifactId = created.data.draftArtifactId;
                draftVersionId = created.data.draftVersionId;

                Assert(created.data.band === 'Team', `Initial draft must be on Team band, got ${created.data.band}`);
                Assert(created.data.taskLinkIds.length >= 3, `Approval task must persist polymorphic TaskLinks to Space, Draft, and Phase 1 Task (${created.data.taskLinkIds.length})`);

                // Verify polymorphic TaskLink to Northstar Phase 1 workstream Task
                const taskLinks = await FindRows<{ EntityID: string; RecordID: string; Description: string | null }>(
                    ctx,
                    TASK_LINK_ENTITY,
                    `TaskID = '${taskId}'`,
                    ['EntityID', 'RecordID', 'Description'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(
                    taskLinks.some((l) => l.RecordID.toLowerCase().includes(NORTHSTAR_PHASE1_TASK_ID.toLowerCase())),
                    'Approval task links polymorphically to Northstar Phase 1 workstream Task',
                );

                // 2. BEFORE APPROVAL: Client A (Bea, Shared) and Rival Client B (Harper) CANNOT read the draft Doc or approval task
                const delegate = new CollaborationSpaceItemArtifactPermissionDelegate();
                const delegateCtx = {
                    ArtifactID: draftArtifactId,
                    ArtifactOwnerUserID: sam.ID,
                    DelegateEntityID: spaceItemsEntity!.ID,
                    DelegateEntityName: SPACE_ITEM_ENTITY,
                    DelegateRecordID: `ID|${draftSpaceItemId}`,
                    Provider: ctx.Provider,
                };
                Assert((await delegate.CanRead(delegateCtx, sam)) === 'Allow', 'Internal Team contributor Sam can read Team draft Doc');
                Assert((await delegate.CanRead(delegateCtx, bea)) === 'Deny', 'Client A Bea MUST be denied Team draft Doc before promotion');
                Assert((await delegate.CanRead(delegateCtx, harper)) === 'Deny', 'Rival Client B Harper MUST be denied Team draft Doc');

                const beaDocBefore = await getSpaceDoc({ provider: ctx.Provider, callerUser: bea, spaceId: deliverySpaceId, spaceItemId: draftSpaceItemId });
                Assert(beaDocBefore.ok === false, 'getSpaceDoc refuses Client A before promotion');

                const beaTasksBefore = await listSpaceApprovalTasks({ provider: ctx.Provider, callerUser: bea, spaceId: deliverySpaceId });
                Assert(beaTasksBefore.ok === false && beaTasksBefore.code === 'PRIVACY_DENIED', 'listSpaceApprovalTasks denies Shared-band Client A');

                const beaApproveAttempt = await decideAndPromoteSpaceDraft({
                    provider: ctx.Provider,
                    approverUser: bea,
                    spaceId: deliverySpaceId,
                    taskId,
                    decision: 'Approved',
                    decisionNotes: 'Unauthorized client self-approval attempt',
                });
                Assert(beaApproveAttempt.ok === false, 'Client A MUST NOT self-approve Team drafts');

                const samTaskCheck = await getSpaceApprovalTask({ provider: ctx.Provider, callerUser: sam, spaceId: deliverySpaceId, taskId });
                Assert(samTaskCheck.ok === true && samTaskCheck.data.band === 'Team', 'Internal Team staff can inspect pending approval task');

                // 3. Dev (Meridian Engagement Approver / owner) approves and promotes the draft to Shared under per-root delivery principal Ada
                const promoted = await decideAndPromoteSpaceDraft({
                    provider: ctx.Provider,
                    approverUser: dev,
                    spaceId: deliverySpaceId,
                    taskId,
                    decision: 'Approved',
                    decisionNotes: 'Verified readiness checklist for Northstar client sharing.',
                });
                Assert(promoted.ok === true, `decideAndPromoteSpaceDraft failed: ${promoted.ok ? '' : promoted.message}`);
                if (!promoted.ok) throw new Error(promoted.message);
                Assert(promoted.data.band === 'Shared', `Promoted draft must be Shared, got ${promoted.data.band}`);
                Assert(promoted.data.taskStatus === 'Completed', `Approval task must be Completed, got ${promoted.data.taskStatus}`);
                Assert(SameID(promoted.data.promotedByPrincipalUserId, ada.ID), 'Promotion executed under resolved per-root delivery principal Ada');

                const decisions = await FindRows<{ ID: string; TaskID: string }>(
                    ctx,
                    TASK_DECISION_ENTITY,
                    `TaskID = '${taskId}'`,
                    ['ID', 'TaskID'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(decisions.length >= 1, 'Approval persisted a TaskDecision record in bizapps-tasks');

                // 4. AFTER APPROVAL: Client A (Bea) CAN read the promoted Shared Doc, while Rival Client B (Harper) STILL sees 0 rows
                Assert((await delegate.CanRead(delegateCtx, bea)) === 'Allow', 'Client A Bea CAN read promoted Shared Doc');
                const beaDocAfter = await getSpaceDoc({ provider: ctx.Provider, callerUser: bea, spaceId: deliverySpaceId, spaceItemId: draftSpaceItemId });
                Assert(beaDocAfter.ok === true && beaDocAfter.data.band === 'Shared' && beaDocAfter.data.title === draftTitle, 'getSpaceDoc returns promoted Shared Doc to Client A');

                const beaListAfter = await listSpaceDocs({ provider: ctx.Provider, callerUser: bea, spaceId: deliverySpaceId });
                Assert(
                    beaListAfter.ok === true && beaListAfter.data.some((d) => SameID(d.spaceItemId, draftSpaceItemId)),
                    'listSpaceDocs exposes promoted Shared Doc to Client A',
                );

                // Rival Client B (Harper) MUST STILL be completely blocked
                Assert((await delegate.CanRead(delegateCtx, harper)) === 'Deny', 'Rival Client B Harper STILL denied after Shared promotion');
                const harperDocAfter = await getSpaceDoc({ provider: ctx.Provider, callerUser: harper, spaceId: deliverySpaceId, spaceItemId: draftSpaceItemId });
                Assert(harperDocAfter.ok === false, 'getSpaceDoc refuses Rival Client B even after Shared promotion');
                const harperSpaceItemRows = await FindRows<{ ID: string }>(
                    ctx,
                    SPACE_ITEM_ENTITY,
                    `ID = '${draftSpaceItemId}'`,
                    ['ID'],
                    harper,
                    { BypassCache: true },
                );
                Assert(harperSpaceItemRows.length === 0, 'SQL RLS returns 0 rows to Rival Client B for promoted SpaceItem');
            } finally {
                await cleanupApprovalArtifacts(ctx, {
                    taskId,
                    taskSpaceItemId,
                    draftSpaceItemId,
                    draftArtifactId,
                    draftVersionId,
                });
                if (deliverySpaceId) {
                    await cleanupSpace(ctx.Provider, ctx.User, deliverySpaceId);
                }
                if (deliveryTypeId) {
                    await deleteWhere(ctx.Provider, ctx.User, SPACE_TYPE_STATUS_ENTITY, `SpaceTypeID = '${deliveryTypeId}' AND IsDefault = 0`, 'CE3 delivery non-default statuses');
                    await deleteWhere(ctx.Provider, ctx.User, SPACE_TYPE_STATUS_ENTITY, `SpaceTypeID = '${deliveryTypeId}' AND IsDefault = 1`, 'CE3 delivery default status');
                    await deleteWhere(ctx.Provider, ctx.User, SPACE_TYPE_ENTITY, `ID = '${deliveryTypeId}'`, 'CE3 delivery space type');
                    await cleanupStep(() => CollaborationEngine.Instance.Config(true, ctx.User, ctx.Provider));
                }
            }
        },
    },
    {
        Id: 'cross-stack-enterprise.CE4',
        Name: 'CE4 — Seeded enterprise spaces enforce dual-band Docs and Chat visibility across Meridian Team, Northstar Client A, and Solstice Rival Client B',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');
            const casey = await GetPersonaUser(ctx, 'casey');
            const bea = await GetPersonaUser(ctx, 'bea');
            const harper = await GetPersonaUser(ctx, 'harper');

            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const northstarPhase1Id = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PHASE1_TASK_ID, 'Northstar Phase 1');
            const solsticeHubId = await resolveEnterpriseSpaceId(ctx, SOLSTICE_PROGRAM_TASK_ID, 'Solstice Hub');

            // Docs visibility matrix
            const adaDocs = await listSpaceDocs({ provider: ctx.Provider, callerUser: ada, spaceId: northstarHubId });
            Assert(adaDocs.ok === true, 'Ada reads Northstar Hub docs');
            if (adaDocs.ok) {
                const titles = new Set(adaDocs.data.map((d) => d.title));
                Assert(titles.has(ENTERPRISE_DOC_TITLES.northstarInternalMemo), 'Ada reads Team internal memo');
                Assert(titles.has(ENTERPRISE_DOC_TITLES.northstarSharedBrief), 'Ada reads Shared brief');
            }

            const beaDocs = await listSpaceDocs({ provider: ctx.Provider, callerUser: bea, spaceId: northstarHubId });
            Assert(beaDocs.ok === true, 'Bea reads Northstar Hub docs');
            if (beaDocs.ok) {
                const titles = new Set(beaDocs.data.map((d) => d.title));
                Assert(titles.has(ENTERPRISE_DOC_TITLES.northstarSharedBrief), 'Client A Bea reads Shared brief');
                Assert(!titles.has(ENTERPRISE_DOC_TITLES.northstarInternalMemo), 'Client A Bea MUST NOT read Team internal memo');
            }

            const harperOnNorthstar = await listSpaceDocs({ provider: ctx.Provider, callerUser: harper, spaceId: northstarHubId });
            Assert(harperOnNorthstar.ok === false, 'Rival Client B Harper refused Northstar Hub docs');

            const harperOnSolstice = await listSpaceDocs({ provider: ctx.Provider, callerUser: harper, spaceId: solsticeHubId });
            Assert(harperOnSolstice.ok === true, 'Rival Client B Harper reads Solstice Hub docs');
            if (harperOnSolstice.ok) {
                Assert(
                    harperOnSolstice.data.some((d) => d.title === ENTERPRISE_DOC_TITLES.solsticeSharedGuide),
                    'Harper reads Solstice Cold-Chain Calibration Guide',
                );
            }

            const caseyOnSolstice = await listSpaceDocs({ provider: ctx.Provider, callerUser: casey, spaceId: solsticeHubId });
            Assert(caseyOnSolstice.ok === false, 'Client A Casey refused Rival Client B Solstice Hub docs');

            // Space & Chat SQL RLS isolation matrix
            const beaSpaces = await FindRows<{ ID: string; Name: string }>(
                ctx,
                SPACE_ENTITY,
                `ID IN ('${northstarHubId}', '${northstarPhase1Id}', '${solsticeHubId}')`,
                ['ID', 'Name'],
                bea,
                { BypassCache: true },
            );
            const beaSpaceIds = new Set(beaSpaces.map((s) => s.ID.toLowerCase()));
            Assert(beaSpaceIds.has(northstarHubId.toLowerCase()), 'Bea reaches Northstar Hub');
            Assert(beaSpaceIds.has(northstarPhase1Id.toLowerCase()), 'Bea inherits reach into Northstar Phase 1 Cutover');
            Assert(!beaSpaceIds.has(solsticeHubId.toLowerCase()), 'Bea sees ZERO Solstice spaces');

            const harperSpaces = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ENTITY,
                `ID IN ('${northstarHubId}', '${northstarPhase1Id}', '${solsticeHubId}')`,
                ['ID'],
                harper,
                { BypassCache: true },
            );
            Assert(
                harperSpaces.length === 1 && SameID(harperSpaces[0].ID, solsticeHubId),
                `Harper sees ONLY Solstice Hub (${harperSpaces.length} spaces)`,
            );

            const samChats = await FindRows<{ Name: string; Kind: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['Name', 'Kind'],
                sam,
                { BypassCache: true },
            );
            Assert(samChats.some((c) => c.Kind === 'Private') && samChats.some((c) => c.Kind === 'General'), 'Sam sees both General and Private Northstar chats');

            const beaChats = await FindRows<{ Name: string; Kind: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['Name', 'Kind'],
                bea,
                { BypassCache: true },
            );
            Assert(beaChats.length === 1 && beaChats[0].Kind === 'General', `Bea sees ONLY General chat in Northstar Hub (saw ${beaChats.map((c) => c.Kind).join(', ')})`);

            const harperNorthstarChats = await FindRows<{ ID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['ID'],
                harper,
                { BypassCache: true },
            );
            Assert(harperNorthstarChats.length === 0, 'Harper sees 0 Northstar chats');
        },
    },
    {
        Id: 'cross-stack-enterprise.CE5',
        Name: 'CE5 — Sealing a child subspace immediately revokes inherited Client A reach and seat removal cuts off access cleanly',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const [hubRow] = await FindRows<{ SpaceTypeID: string }>(ctx, SPACE_ENTITY, `ID = '${northstarHubId}'`, ['SpaceTypeID']);
            const [ownerRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            const [clientMemberRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'client-member'", ['ID']);
            Assert(!!hubRow && !!ownerRole && !!clientMemberRole, 'Northstar Hub type, owner role, and client-member role exist');

            let childSpaceId: string | null = null;
            try {
                const child = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                child.NewRecord();
                child.Name = `${CHECK_SPACE_PREFIX}CE5 Sealed Cutover ${Date.now()}`;
                child.SpaceTypeID = hubRow.SpaceTypeID;
                child.ParentID = northstarHubId;
                child.OwnerID = ada.ID;
                child.InheritsMembership = true;
                Assert(await child.Save() && !!child.ID, `Create inheriting child space failed: ${child.LatestResult?.CompleteMessage ?? ''}`);
                childSpaceId = child.ID;

                // Seat Ada explicitly as owner on the child so she retains owner authority after sealing it
                const adaSeat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                adaSeat.NewRecord();
                adaSeat.SpaceID = childSpaceId;
                adaSeat.UserID = ada.ID;
                adaSeat.SpaceRoleTypeID = ownerRole.ID;
                adaSeat.Band = 'Team';
                adaSeat.Status = 'Active';
                Assert(await adaSeat.Save(), `Seat Ada as owner on child failed: ${adaSeat.LatestResult?.CompleteMessage ?? ''}`);

                // While inheriting, Bea reaches the child space from her seat on Northstar Hub
                const beaInheriting = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${childSpaceId}'`, ['ID'], bea, { BypassCache: true });
                Assert(beaInheriting.length === 1, 'Bea inherits reach into inheriting child space');

                // Seal the child space (InheritsMembership = false) -> Bea loses reach immediately
                const loaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await loaded.Load(childSpaceId), 'Ada reloads child space');
                loaded.InheritsMembership = false;
                Assert(await loaded.Save(), `Ada seals child space: ${loaded.LatestResult?.CompleteMessage ?? ''}`);

                const beaAfterSeal = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${childSpaceId}'`, ['ID'], bea, { BypassCache: true });
                Assert(beaAfterSeal.length === 0, 'Bea loses reach immediately after child space is sealed');

                // Re-seat Bea explicitly on the sealed child, confirm reach, then remove seat -> reach drops back to 0
                const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                seat.NewRecord();
                seat.SpaceID = childSpaceId;
                seat.UserID = bea.ID;
                seat.SpaceRoleTypeID = clientMemberRole.ID;
                seat.Band = 'Shared';
                seat.Status = 'Active';
                Assert(await seat.Save() && !!seat.ID, `Ada explicitly seats Bea on sealed child: ${seat.LatestResult?.CompleteMessage ?? ''}`);

                const beaExplicit = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${childSpaceId}'`, ['ID'], bea, { BypassCache: true });
                Assert(beaExplicit.length === 1, 'Bea regains reach via explicit seat on sealed child');

                const removeSeat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                Assert(await removeSeat.Load(seat.ID), 'Ada reloads Bea seat');
                removeSeat.Status = 'Removed';
                Assert(await removeSeat.Save(), `Ada removes Bea seat: ${removeSeat.LatestResult?.CompleteMessage ?? ''}`);

                const beaAfterRemove = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${childSpaceId}'`, ['ID'], bea, { BypassCache: true });
                Assert(beaAfterRemove.length === 0, 'Bea loses reach immediately after seat removal');
            } finally {
                if (childSpaceId) {
                    await cleanupSpace(ctx.Provider, ctx.User, childSpaceId);
                }
            }
        },
    },
    {
        Id: 'cross-stack-enterprise.CE6',
        Name: 'CE6 — Adversarial multi-org isolation matrix blocks cross-tenant reads, chat posts, file uploads, task creation, search scope, and invite minting',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const harper = await GetPersonaUser(ctx, 'harper');

            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const solsticeHubId = await resolveEnterpriseSpaceId(ctx, SOLSTICE_PROGRAM_TASK_ID, 'Solstice Hub');

            const [northstarGeneral] = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}' AND Kind = 'General'`,
                ['ConversationID'],
                undefined,
                { BypassCache: true },
            );
            const [northstarPrivate] = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}' AND Kind = 'Private'`,
                ['ConversationID'],
                undefined,
                { BypassCache: true },
            );
            Assert(!!northstarGeneral && !!northstarPrivate, 'Northstar Hub General and Private chats exist');

            // 1. Unauthorized message reads on rival/internal conversations
            const harperReadsNorthstarMsgs = await FindRows<{ ID: string }>(
                ctx,
                CONVERSATION_DETAIL_ENTITY,
                `ConversationID IN ('${northstarGeneral.ConversationID}', '${northstarPrivate.ConversationID}')`,
                ['ID'],
                harper,
                { BypassCache: true },
            );
            Assert(harperReadsNorthstarMsgs.length === 0, 'Rival Client B Harper reads 0 messages from Northstar Hub');

            const beaReadsPrivateMsgs = await FindRows<{ ID: string }>(
                ctx,
                CONVERSATION_DETAIL_ENTITY,
                `ConversationID = '${northstarPrivate.ConversationID}'`,
                ['ID'],
                bea,
                { BypassCache: true },
            );
            Assert(beaReadsPrivateMsgs.length === 0, 'Client A Bea reads 0 messages from Meridian Private Team chat');

            // 2. Unauthorized chat writes across tenant & band boundaries
            const harperPost = await postSpaceMessage(ctx.Provider, harper, {
                spaceId: northstarHubId,
                conversationId: northstarGeneral.ConversationID,
                text: 'Adversarial cross-org message injection attempt',
            });
            Assert(harperPost.ok === false, 'Rival Client B Harper refused posting into Northstar Hub General chat');

            const beaPrivatePost = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: northstarHubId,
                conversationId: northstarPrivate.ConversationID,
                text: 'Adversarial Shared->Team private chat injection attempt',
            });
            Assert(beaPrivatePost.ok === false, 'Client A Bea refused posting into Northstar Hub Private Team chat');

            // 3. Unauthorized cross-org file upload & task creation
            await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
            const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
            const harperUpload = await uploadSpaceFile({
                user: harper,
                storageUser: ctx.User,
                provider: ctx.Provider,
                store,
                spaceId: northstarHubId,
                folder: null,
                fileName: 'adversarial-cross-org.txt',
                mimeType: 'text/plain',
                content: Buffer.from('unauthorized payload', 'utf8'),
                gate: () => decideUploadBand(ctx.Provider, harper, northstarHubId, 'Shared'),
            });
            Assert(harperUpload.ok === false, 'Rival Client B Harper refused uploading file into Northstar Hub');

            const harperTask = await createSpaceTask(ctx.Provider, harper, {
                spaceId: northstarHubId,
                name: 'Adversarial cross-org task',
                band: 'Shared',
            });
            Assert(harperTask.ok === false, 'Rival Client B Harper refused creating task in Northstar Hub');

            // 4. Unauthorized invite link minting by external Space Participants
            const [guestRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'guest'", ['ID']);
            Assert(!!guestRole, 'Guest role exists');
            const beaMint = await mintSpaceLink({
                provider: ctx.Provider,
                user: bea,
                spaceId: northstarHubId,
                email: 'unauthorized.guest@collab-invite.example',
                roleId: guestRole.ID,
            });
            Assert(beaMint.ok === false, 'External participant Bea refused mintSpaceLink (no Issue Space Invite Links authorization)');

            const harperMint = await mintSpaceLink({
                provider: ctx.Provider,
                user: harper,
                spaceId: northstarHubId,
                email: 'unauthorized.rival@collab-invite.example',
                roleId: guestRole.ID,
            });
            Assert(harperMint.ok === false, 'Rival external participant Harper refused mintSpaceLink on Northstar Hub');

            // 5. Structural chat scope cross-tenant boundary (fnCollaborationChatScope)
            const harperScopeOnNorthstar = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: northstarHubId,
                userId: harper.ID,
                contextUser: ctx.User,
            });
            Assert(harperScopeOnNorthstar.pairs.length === 0, 'Structural chat scope returns 0 rows for Harper on Northstar Hub');

            const adaScopeOnSolstice = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: solsticeHubId,
                userId: ada.ID,
                contextUser: ctx.User,
            });
            Assert(adaScopeOnSolstice.pairs.length === 0, 'Meridian owner Ada (not seated on Solstice) gets 0 rows from Solstice structural chat scope');

            // Verify enterprise names are intact
            const [hubName] = await FindRows<{ Name: string }>(ctx, SPACE_ENTITY, `ID = '${northstarHubId}'`, ['Name']);
            Assert(hubName?.Name === ENTERPRISE_SPACE_NAMES.northstarHub, `Northstar Hub name intact (${hubName?.Name})`);
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('cross-stack-enterprise', {
    Setup: async () => {},
    Teardown: async () => {},
});
