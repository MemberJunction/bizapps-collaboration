/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Seeds the Real-World Cross-Stack Enterprise World across:
 *   MJ Core (`Companies`, `Artifacts`, `Conversations`)
 *   -> `bizapps-common` (`Organizations`, `People`, `Relationships`, `Contact Methods`)
 *   -> `bizapps-tasks` (`Tasks` multi-level programs/workstreams, `Task Assignments`, `Task Links`)
 *   -> `bizapps-collaboration` (`EnsureSpaceForRecord` record-bound spaces, dual-band `Team`/`Shared`
 *      chats, `Docs` band internal drafts & shared deliverables, and `Space Notice Events`).
 *
 * Uses three strictly domain-neutral enterprise organizations to prove real cross-tenant isolation:
 *   - Meridian Advisory Group (internal delivery organization: ada, sam, dev)
 *   - Northstar Manufacturing Corp (external client organization A: casey, bea)
 *   - Solstice Logistics Ltd (rival external client organization B: harper)
 */
import { Metadata, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import type { MJCompanyEntity } from '@memberjunction/core-entities';
import {
    type mjBizAppsCommonContactMethodEntity,
    type mjBizAppsCommonContactTypeEntity,
    type mjBizAppsCommonOrganizationEntity,
    type mjBizAppsCommonOrganizationTypeEntity,
    type mjBizAppsCommonRelationshipEntity,
    type mjBizAppsCommonRelationshipTypeEntity,
} from '@mj-biz-apps/common-entities';
import {
    type mjBizAppsTasksTaskAssignmentEntity,
    type mjBizAppsTasksTaskEntity,
    type mjBizAppsTasksTaskLinkEntity,
} from '@mj-biz-apps/tasks-entities';
import { type mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import {
    createSpaceConversation,
    createSpaceDoc,
    EnsureSpaceForRecord,
    listSpaceDocs,
    LoadCollaborationSpaceItemArtifactPermissionDelegate,
    LoadCollaborationSpaceNoticeOperations,
    LoadSpaceDigestCheckpointEntityServer,
    LoadSpaceNoticeEventEntityServer,
    LoadSpaceNoticeWatermarkEntityServer,
    postSpaceMessage,
    runPublishSpaceNoticeEvent,
    syncRoomEditGrantsForSpace,
} from '@mj-biz-apps/collaboration-core-entities-server';
import {
    COMPANY_ENTITY,
    CONTACT_METHOD_ENTITY,
    CONTACT_TYPE_ENTITY,
    ORGANIZATION_ENTITY,
    ORGANIZATION_TYPE_ENTITY,
    PERSON_ENTITY,
    RELATIONSHIP_ENTITY,
    RELATIONSHIP_TYPE_ENTITY,
    SPACE_CHAT_ENTITY,
    SPACE_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    TASK_ASSIGNMENT_ENTITY,
    TASK_ENTITY,
    TASK_LINK_ENTITY,
    TASK_TYPE_ENTITY,
} from '../entity-names.js';
import {
    ENTERPRISE_CONTACT_TYPE_ID,
    ENTERPRISE_DOC_TITLES,
    ENTERPRISE_NOTICE_TITLES,
    ENTERPRISE_ORG_NAMES,
    ENTERPRISE_ORG_TYPE_ID,
    ENTERPRISE_REL_TYPE_ID,
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
} from './enterprise-ids.js';

interface OrganizationSeedSpec {
    id: string;
    companyId: string;
    name: string;
    legalName: string;
    website: string;
    websiteDomain: string;
    acronym: string;
    email: string;
    description: string;
}

interface RelationshipSeedSpec {
    personaKey: string;
    orgId: string;
    title: string;
    email: string;
}

interface TaskSeedSpec {
    id: string;
    name: string;
    description: string;
    orgId: string;
    parentId: string | null;
    createdByKey: string;
    priority: mjBizAppsTasksTaskEntity['Priority'];
    status: mjBizAppsTasksTaskEntity['Status'];
    visibility: mjBizAppsTasksTaskEntity['Visibility'];
}

export interface SeedEnterpriseWorldResult {
    northstarHubSpaceId: string;
    northstarPhase1SpaceId: string;
    solsticeHubSpaceId: string;
}

function escapeSql(value: string): string {
    return value.replace(/'/g, "''");
}

async function findSingleId(
    provider: IMetadataProvider,
    entityName: string,
    extraFilter: string,
    user: UserInfo,
): Promise<string | null> {
    const res = await RunView.FromMetadataProvider(provider).RunView<{ ID: string }>(
        {
            EntityName: entityName,
            ExtraFilter: extraFilter,
            Fields: ['ID'],
            MaxRows: 1,
            ResultType: 'simple',
            BypassCache: true,
        },
        user,
    );
    if (!res.Success) {
        throw new Error(`Enterprise world lookup on ${entityName} failed: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    return res.Results?.[0]?.ID ?? null;
}

async function resolveOrCreateOrgTypeId(provider: IMetadataProvider, system: UserInfo): Promise<string> {
    const existing = await findSingleId(provider, ORGANIZATION_TYPE_ENTITY, 'IsActive = 1', system);
    if (existing) return existing;

    const record = await new Metadata().GetEntityObject<mjBizAppsCommonOrganizationTypeEntity>(
        ORGANIZATION_TYPE_ENTITY,
        system,
    );
    record.NewRecord();
    record.ID = ENTERPRISE_ORG_TYPE_ID;
    record.Name = 'Enterprise Organization';
    record.Description = 'Enterprise world organization type';
    record.DisplayRank = 100;
    record.IsActive = true;
    if (!(await record.Save())) {
        throw new Error(`Enterprise org type save failed: ${record.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    return record.ID;
}

async function resolveOrCreateRelationshipTypeId(provider: IMetadataProvider, system: UserInfo): Promise<string> {
    const existing = await findSingleId(
        provider,
        RELATIONSHIP_TYPE_ENTITY,
        "Category = 'PersonToOrganization' AND IsActive = 1",
        system,
    );
    if (existing) return existing;

    const record = await new Metadata().GetEntityObject<mjBizAppsCommonRelationshipTypeEntity>(
        RELATIONSHIP_TYPE_ENTITY,
        system,
    );
    record.NewRecord();
    record.ID = ENTERPRISE_REL_TYPE_ID;
    record.Name = 'Organization Member';
    record.Description = 'Person holds a role within an organization';
    record.Category = 'PersonToOrganization';
    record.IsDirectional = true;
    record.ForwardLabel = 'Member of';
    record.ReverseLabel = 'Has member';
    record.IsActive = true;
    if (!(await record.Save())) {
        throw new Error(`Enterprise relationship type save failed: ${record.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    return record.ID;
}

async function resolveOrCreateEmailContactTypeId(provider: IMetadataProvider, system: UserInfo): Promise<string> {
    const emailType = await findSingleId(
        provider,
        CONTACT_TYPE_ENTITY,
        "Name LIKE '%Email%' AND IsActive = 1",
        system,
    );
    if (emailType) return emailType;

    const anyActive = await findSingleId(provider, CONTACT_TYPE_ENTITY, 'IsActive = 1', system);
    if (anyActive) return anyActive;

    const record = await new Metadata().GetEntityObject<mjBizAppsCommonContactTypeEntity>(
        CONTACT_TYPE_ENTITY,
        system,
    );
    record.NewRecord();
    record.ID = ENTERPRISE_CONTACT_TYPE_ID;
    record.Name = 'Work Email';
    record.Description = 'Primary business email address';
    record.DisplayRank = 10;
    record.IsActive = true;
    if (!(await record.Save())) {
        throw new Error(`Enterprise contact type save failed: ${record.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    return record.ID;
}

async function ensureCompanyMirror(
    provider: IMetadataProvider,
    system: UserInfo,
    spec: OrganizationSeedSpec,
): Promise<string | null> {
    if (!provider.EntityByName(COMPANY_ENTITY)) {
        return null;
    }
    const existing = await findSingleId(provider, COMPANY_ENTITY, `ID = '${spec.companyId}'`, system);
    if (existing) return existing;

    const company = await new Metadata().GetEntityObject<MJCompanyEntity>(COMPANY_ENTITY, system);
    company.NewRecord();
    company.ID = spec.companyId;
    company.Name = spec.name.slice(0, 50);
    company.Description = spec.description.slice(0, 200);
    company.Website = spec.website.slice(0, 100);
    company.Domain = spec.websiteDomain;
    if (!(await company.Save())) {
        throw new Error(`Enterprise company ${spec.name} save failed: ${company.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    return company.ID;
}

async function ensureOrganization(
    provider: IMetadataProvider,
    system: UserInfo,
    orgTypeId: string,
    spec: OrganizationSeedSpec,
): Promise<string> {
    const linkedCompanyId = await ensureCompanyMirror(provider, system, spec);
    const existing = await findSingleId(provider, ORGANIZATION_ENTITY, `ID = '${spec.id}'`, system);
    const org = await new Metadata().GetEntityObject<mjBizAppsCommonOrganizationEntity>(
        ORGANIZATION_ENTITY,
        system,
    );
    if (existing) {
        if (!(await org.Load(existing))) {
            throw new Error(`Could not load enterprise organization ${spec.name}.`);
        }
    } else {
        org.NewRecord();
        org.ID = spec.id;
    }
    org.Name = spec.name;
    org.LegalName = spec.legalName;
    org.OrganizationTypeID = orgTypeId;
    org.Website = spec.website;
    org.Acronym = spec.acronym;
    org.Email = spec.email;
    org.Description = spec.description;
    org.Status = 'Active';
    if (linkedCompanyId) {
        org.LinkedCompanyID = linkedCompanyId;
    }
    if (!(await org.Save())) {
        throw new Error(`Enterprise organization ${spec.name} save failed: ${org.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    return org.ID;
}

async function ensureRelationship(
    provider: IMetadataProvider,
    system: UserInfo,
    relTypeId: string,
    personId: string,
    spec: RelationshipSeedSpec,
): Promise<void> {
    const existing = await findSingleId(
        provider,
        RELATIONSHIP_ENTITY,
        `FromPersonID = '${personId}' AND ToOrganizationID = '${spec.orgId}'`,
        system,
    );
    if (existing) return;

    const rel = await new Metadata().GetEntityObject<mjBizAppsCommonRelationshipEntity>(
        RELATIONSHIP_ENTITY,
        system,
    );
    rel.NewRecord();
    rel.RelationshipTypeID = relTypeId;
    rel.FromPersonID = personId;
    rel.ToOrganizationID = spec.orgId;
    rel.Title = spec.title;
    rel.Status = 'Active';
    rel.StartDate = new Date(Date.UTC(2025, 0, 15));
    if (!(await rel.Save())) {
        throw new Error(`Enterprise relationship for ${spec.personaKey} failed: ${rel.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
}

async function ensureContactMethod(
    provider: IMetadataProvider,
    system: UserInfo,
    contactTypeId: string,
    target: { personId?: string; orgId?: string },
    value: string,
    label: string,
): Promise<void> {
    const ownerFilter = target.personId
        ? `PersonID = '${target.personId}' AND Value = '${escapeSql(value)}'`
        : `OrganizationID = '${target.orgId}' AND Value = '${escapeSql(value)}'`;
    const existing = await findSingleId(provider, CONTACT_METHOD_ENTITY, ownerFilter, system);
    if (existing) return;

    const cm = await new Metadata().GetEntityObject<mjBizAppsCommonContactMethodEntity>(
        CONTACT_METHOD_ENTITY,
        system,
    );
    cm.NewRecord();
    cm.PersonID = target.personId ?? null;
    cm.OrganizationID = target.orgId ?? null;
    cm.ContactTypeID = contactTypeId;
    cm.Value = value;
    cm.Label = label;
    cm.IsPrimary = true;
    if (!(await cm.Save())) {
        throw new Error(`Enterprise contact method ${value} save failed: ${cm.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
}

async function ensureTask(
    provider: IMetadataProvider,
    system: UserInfo,
    taskTypeId: string,
    personIdByKey: Map<string, string>,
    spec: TaskSeedSpec,
): Promise<string> {
    const existing = await findSingleId(provider, TASK_ENTITY, `ID = '${spec.id}'`, system);
    if (existing) return existing;

    const task = await new Metadata().GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, system);
    task.NewRecord();
    task.ID = spec.id;
    task.Name = spec.name;
    task.Description = spec.description;
    task.TypeID = taskTypeId;
    task.ParentID = spec.parentId;
    task.OrganizationID = spec.orgId;
    task.Status = spec.status;
    task.Priority = spec.priority;
    task.Visibility = spec.visibility;
    task.CreatedByPersonID = personIdByKey.get(spec.createdByKey) ?? null;
    task.StartedAt = new Date(Date.now() - 5 * 86_400_000);
    task.DueAt = new Date(Date.now() + 21 * 86_400_000);
    if (!(await task.Save())) {
        throw new Error(`Enterprise task ${spec.name} save failed: ${task.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    return task.ID;
}

async function ensureTaskAssignment(
    provider: IMetadataProvider,
    system: UserInfo,
    taskId: string,
    peopleEntityId: string,
    personId: string,
): Promise<void> {
    const existing = await findSingleId(
        provider,
        TASK_ASSIGNMENT_ENTITY,
        `TaskID = '${taskId}' AND AssigneeRecordID = '${personId}'`,
        system,
    );
    if (existing) return;

    const assignment = await new Metadata().GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(
        TASK_ASSIGNMENT_ENTITY,
        system,
    );
    assignment.NewRecord();
    assignment.TaskID = taskId;
    assignment.AssigneeEntityID = peopleEntityId;
    assignment.AssigneeRecordID = personId;
    assignment.Status = 'InProgress';
    if (!(await assignment.Save())) {
        throw new Error(`Enterprise task assignment save failed: ${assignment.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
}

async function ensureTaskLink(
    provider: IMetadataProvider,
    system: UserInfo,
    taskId: string,
    entityId: string,
    recordId: string,
    description: string,
): Promise<void> {
    const existing = await findSingleId(
        provider,
        TASK_LINK_ENTITY,
        `TaskID = '${taskId}' AND EntityID = '${entityId}' AND RecordID = '${escapeSql(recordId)}'`,
        system,
    );
    if (existing) return;

    const link = await new Metadata().GetEntityObject<mjBizAppsTasksTaskLinkEntity>(TASK_LINK_ENTITY, system);
    link.NewRecord();
    link.TaskID = taskId;
    link.EntityID = entityId;
    link.RecordID = recordId;
    link.Description = description;
    if (!(await link.Save())) {
        throw new Error(`Enterprise task link (${description}) save failed: ${link.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
}

async function ensureSeat(
    provider: IMetadataProvider,
    owner: UserInfo,
    system: UserInfo,
    spaceId: string,
    targetUserId: string,
    roleId: string,
    band: 'Team' | 'Shared',
): Promise<void> {
    const existing = await findSingleId(
        provider,
        SPACE_MEMBER_ENTITY,
        `SpaceID = '${spaceId}' AND UserID = '${targetUserId}'`,
        system,
    );
    if (existing) return;

    const seat = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
        SPACE_MEMBER_ENTITY,
        owner,
    );
    seat.NewRecord();
    seat.SpaceID = spaceId;
    seat.UserID = targetUserId;
    seat.SpaceRoleTypeID = roleId;
    seat.Band = band;
    seat.Status = 'Active';
    if (!(await seat.Save())) {
        throw new Error(`Enterprise seat save failed for user ${targetUserId}: ${seat.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
}

async function ensureEnterpriseChat(
    provider: IMetadataProvider,
    system: UserInfo,
    creator: UserInfo,
    spaceId: string,
    name: string,
    kind: 'General' | 'Private',
    initialPosts: ReadonlyArray<{ author: UserInfo; text: string }>,
): Promise<void> {
    const existing = await findSingleId(
        provider,
        SPACE_CHAT_ENTITY,
        `SpaceID = '${spaceId}' AND Name = '${escapeSql(name)}' AND Kind = '${kind}' AND Status = 'Active'`,
        system,
    );
    if (existing) return;

    const created = await createSpaceConversation(provider, creator, {
        SpaceID: spaceId,
        Name: name,
        Kind: kind,
    });
    if (!created.ok || !created.conversationId) {
        throw new Error(`Enterprise chat ${name} create failed: ${created.ok ? 'missing id' : created.message}`);
    }
    for (const post of initialPosts) {
        const res = await postSpaceMessage(provider, post.author, {
            spaceId,
            conversationId: created.conversationId,
            text: post.text,
        });
        if (!res.ok) {
            throw new Error(`Enterprise chat post in ${name} failed: ${res.message}`);
        }
    }
}

async function ensureEnterpriseDoc(
    provider: IMetadataProvider,
    author: UserInfo,
    spaceId: string,
    title: string,
    content: string,
    band: 'Team' | 'Shared',
    folder: string,
): Promise<void> {
    const existing = await listSpaceDocs({
        provider,
        callerUser: author,
        spaceId,
    });
    if (existing.ok && existing.data.some((doc) => doc.title === title)) {
        return;
    }
    const created = await createSpaceDoc({
        provider,
        callerUser: author,
        spaceId,
        title,
        content,
        band,
        folder,
    });
    if (!created.ok) {
        throw new Error(`Enterprise doc "${title}" create failed: ${created.message}`);
    }
}

async function ensureEnterpriseNotice(
    provider: IMetadataProvider,
    system: UserInfo,
    actor: UserInfo,
    spaceId: string,
    band: 'Team' | 'Shared',
    title: string,
    body: string,
): Promise<void> {
    const existing = await findSingleId(
        provider,
        SPACE_NOTICE_EVENT_ENTITY,
        `SpaceID = '${spaceId}' AND Title = '${escapeSql(title)}'`,
        system,
    );
    if (existing) return;

    const res = await runPublishSpaceNoticeEvent(provider, actor, {
        SpaceID: spaceId,
        EventKind: 'Share',
        Band: band,
        Title: title,
        Body: body,
    });
    if (!res.Success) {
        throw new Error(`Enterprise notice "${title}" publish failed: ${res.ErrorMessage ?? 'unknown'}`);
    }
}

export async function seedEnterpriseWorld(input: {
    provider: IMetadataProvider;
    system: UserInfo;
    actor: (key: string) => UserInfo;
}): Promise<SeedEnterpriseWorldResult> {
    LoadCollaborationSpaceItemArtifactPermissionDelegate();
    LoadCollaborationSpaceNoticeOperations();
    LoadSpaceNoticeEventEntityServer();
    LoadSpaceNoticeWatermarkEntityServer();
    LoadSpaceDigestCheckpointEntityServer();

    const { provider, system, actor } = input;
    const peopleEntity = provider.EntityByName(PERSON_ENTITY);
    const orgEntity = provider.EntityByName(ORGANIZATION_ENTITY);
    const spaceEntity = provider.EntityByName(SPACE_ENTITY);
    if (!peopleEntity || !orgEntity || !spaceEntity) {
        throw new Error('Common Organizations/People and Collaboration Spaces must be installed before seeding the enterprise world.');
    }

    const ada = actor('ada');
    const sam = actor('sam');
    const dev = actor('dev');
    const casey = actor('casey');
    const bea = actor('bea');
    const harbor = actor('harbor');
    const harper = actor('harper');

    const personIdByKey = new Map<string, string>();
    for (const [key, user] of [
        ['ada', ada],
        ['sam', sam],
        ['dev', dev],
        ['casey', casey],
        ['bea', bea],
        ['harbor', harbor],
        ['harper', harper],
    ] as const) {
        const personId = await findSingleId(provider, PERSON_ENTITY, `LinkedUserID = '${user.ID}'`, system);
        if (!personId) {
            throw new Error(`Missing bizapps-common Person for persona ${key}.`);
        }
        personIdByKey.set(key, personId);
    }

    // 1. bizapps-common layer: Organizations, Company mirrors, Relationships, Contact Methods
    const orgTypeId = await resolveOrCreateOrgTypeId(provider, system);
    const relTypeId = await resolveOrCreateRelationshipTypeId(provider, system);
    const emailContactTypeId = await resolveOrCreateEmailContactTypeId(provider, system);

    const orgSpecs: readonly OrganizationSeedSpec[] = [
        {
            id: MERIDIAN_ORG_ID,
            companyId: MERIDIAN_COMPANY_ID,
            name: ENTERPRISE_ORG_NAMES.meridian,
            legalName: 'Meridian Advisory Group LLC',
            website: 'https://meridian-advisory.example',
            websiteDomain: 'meridian-advisory.example',
            acronym: 'MAG',
            email: 'delivery@meridian-advisory.example',
            description: 'Internal consulting and program delivery organization.',
        },
        {
            id: NORTHSTAR_ORG_ID,
            companyId: NORTHSTAR_COMPANY_ID,
            name: ENTERPRISE_ORG_NAMES.northstar,
            legalName: 'Northstar Manufacturing Corporation',
            website: 'https://northstar-mfg.example',
            websiteDomain: 'northstar-mfg.example',
            acronym: 'NMC',
            email: 'program-office@northstar-mfg.example',
            description: 'External client organization A running ERP modernization.',
        },
        {
            id: SOLSTICE_ORG_ID,
            companyId: SOLSTICE_COMPANY_ID,
            name: ENTERPRISE_ORG_NAMES.solstice,
            legalName: 'Solstice Logistics Limited',
            website: 'https://solstice-logistics.example',
            websiteDomain: 'solstice-logistics.example',
            acronym: 'SLL',
            email: 'operations@solstice-logistics.example',
            description: 'Rival external client organization B running fleet telemetry rollout.',
        },
    ];

    for (const spec of orgSpecs) {
        await ensureOrganization(provider, system, orgTypeId, spec);
        await ensureContactMethod(provider, system, emailContactTypeId, { orgId: spec.id }, spec.email, 'Primary');
    }

    const relSpecs: readonly RelationshipSeedSpec[] = [
        { personaKey: 'ada', orgId: MERIDIAN_ORG_ID, title: 'Engagement Owner', email: ada.Email },
        { personaKey: 'sam', orgId: MERIDIAN_ORG_ID, title: 'Delivery Contributor', email: sam.Email },
        { personaKey: 'dev', orgId: MERIDIAN_ORG_ID, title: 'Engagement Approver', email: dev.Email },
        { personaKey: 'harbor', orgId: MERIDIAN_ORG_ID, title: 'Logistics Account Lead', email: harbor.Email },
        { personaKey: 'casey', orgId: NORTHSTAR_ORG_ID, title: 'Client Sponsor', email: casey.Email },
        { personaKey: 'bea', orgId: NORTHSTAR_ORG_ID, title: 'Operations Lead', email: bea.Email },
        { personaKey: 'harper', orgId: SOLSTICE_ORG_ID, title: 'Logistics Director', email: harper.Email },
    ];

    for (const rel of relSpecs) {
        const personId = personIdByKey.get(rel.personaKey);
        if (!personId) continue;
        await ensureRelationship(provider, system, relTypeId, personId, rel);
        await ensureContactMethod(provider, system, emailContactTypeId, { personId }, rel.email, 'Work');
    }

    // 2. bizapps-tasks layer: Multi-level Programs, Workstreams & Assignments
    const generalTaskTypeId =
        (await findSingleId(provider, TASK_TYPE_ENTITY, "Code = 'GENERAL'", system)) ??
        (await findSingleId(provider, TASK_TYPE_ENTITY, 'IsActive = 1', system));
    if (!generalTaskTypeId) {
        throw new Error('No active TaskType found in bizapps-tasks.');
    }

    const taskSpecs: readonly TaskSeedSpec[] = [
        {
            id: NORTHSTAR_PROGRAM_TASK_ID,
            name: 'Northstar ERP Modernization Program',
            description: 'Multi-quarter ERP modernization program delivered by Meridian Advisory Group for Northstar Manufacturing Corp.',
            orgId: NORTHSTAR_ORG_ID,
            parentId: null,
            createdByKey: 'ada',
            priority: 'High',
            status: 'InProgress',
            visibility: 'Organization',
        },
        {
            id: NORTHSTAR_PHASE1_TASK_ID,
            name: 'Northstar Phase 1 Cutover Readiness',
            description: 'Phase 1 plant cutover checklist, architecture brief, and integration rehearsals.',
            orgId: NORTHSTAR_ORG_ID,
            parentId: NORTHSTAR_PROGRAM_TASK_ID,
            createdByKey: 'ada',
            priority: 'High',
            status: 'InProgress',
            visibility: 'Team',
        },
        {
            id: NORTHSTAR_SIGNOFF_TASK_ID,
            name: 'Warehouse Integration Sign-Off',
            description: 'Verify barcode scanner sync and ERP order handoff prior to cutover.',
            orgId: NORTHSTAR_ORG_ID,
            parentId: NORTHSTAR_PHASE1_TASK_ID,
            createdByKey: 'sam',
            priority: 'Medium',
            status: 'Open',
            visibility: 'Team',
        },
        {
            id: SOLSTICE_PROGRAM_TASK_ID,
            name: 'Solstice Fleet Telemetry Rollout',
            description: 'Cold-chain telemetry rollout delivered for Solstice Logistics Ltd.',
            orgId: SOLSTICE_ORG_ID,
            parentId: null,
            createdByKey: 'harbor',
            priority: 'High',
            status: 'InProgress',
            visibility: 'Organization',
        },
        {
            id: SOLSTICE_CALIBRATION_TASK_ID,
            name: 'Cold-Chain Sensor Calibration',
            description: 'Calibrate temperature probes across regional cold-storage depots.',
            orgId: SOLSTICE_ORG_ID,
            parentId: SOLSTICE_PROGRAM_TASK_ID,
            createdByKey: 'harbor',
            priority: 'Medium',
            status: 'Open',
            visibility: 'Team',
        },
    ];

    for (const spec of taskSpecs) {
        await ensureTask(provider, system, generalTaskTypeId, personIdByKey, spec);
    }

    await ensureTaskAssignment(provider, system, NORTHSTAR_PROGRAM_TASK_ID, peopleEntity.ID, personIdByKey.get('ada')!);
    await ensureTaskAssignment(provider, system, NORTHSTAR_PHASE1_TASK_ID, peopleEntity.ID, personIdByKey.get('sam')!);
    await ensureTaskAssignment(provider, system, NORTHSTAR_SIGNOFF_TASK_ID, peopleEntity.ID, personIdByKey.get('bea')!);
    await ensureTaskAssignment(provider, system, SOLSTICE_PROGRAM_TASK_ID, peopleEntity.ID, personIdByKey.get('harbor')!);
    await ensureTaskAssignment(provider, system, SOLSTICE_CALIBRATION_TASK_ID, peopleEntity.ID, personIdByKey.get('harper')!);

    // 3. bizapps-collaboration layer: EnsureSpaceForRecord bound spaces + seats + polymorphic TaskLinks
    const northstarHub = await EnsureSpaceForRecord({
        typeCode: 'workspace',
        entityName: TASK_ENTITY,
        recordId: NORTHSTAR_PROGRAM_TASK_ID,
        spaceName: ENTERPRISE_SPACE_NAMES.northstarHub,
        inheritsMembership: false,
        contextUser: ada,
        provider,
    });

    const northstarPhase1 = await EnsureSpaceForRecord({
        typeCode: 'workspace',
        entityName: TASK_ENTITY,
        recordId: NORTHSTAR_PHASE1_TASK_ID,
        spaceName: ENTERPRISE_SPACE_NAMES.northstarPhase1,
        parentSpaceId: northstarHub.ID,
        inheritsMembership: true,
        contextUser: ada,
        provider,
    });

    const solsticeHub = await EnsureSpaceForRecord({
        typeCode: 'workspace',
        entityName: TASK_ENTITY,
        recordId: SOLSTICE_PROGRAM_TASK_ID,
        spaceName: ENTERPRISE_SPACE_NAMES.solsticeHub,
        inheritsMembership: false,
        contextUser: harbor,
        provider,
    });

    const roleIds = new Map<string, string>();
    for (const code of ['owner', 'member', 'client-admin', 'client-member'] as const) {
        const id = await findSingleId(provider, SPACE_ROLE_TYPE_ENTITY, `Code = '${code}'`, system);
        if (!id) throw new Error(`Missing SpaceRoleType ${code}.`);
        roleIds.set(code, id);
    }

    // Northstar Hub roster (Meridian internal Team + Northstar external Shared; Solstice NEVER seated)
    await ensureSeat(provider, ada, system, northstarHub.ID, sam.ID, roleIds.get('member')!, 'Team');
    await ensureSeat(provider, ada, system, northstarHub.ID, dev.ID, roleIds.get('owner')!, 'Team');
    await ensureSeat(provider, ada, system, northstarHub.ID, casey.ID, roleIds.get('client-admin')!, 'Shared');
    await ensureSeat(provider, ada, system, northstarHub.ID, bea.ID, roleIds.get('client-member')!, 'Shared');

    // Solstice Hub roster (Harbor internal Team + Harper external Shared; Northstar NEVER seated)
    await ensureSeat(provider, harbor, system, solsticeHub.ID, harper.ID, roleIds.get('client-member')!, 'Shared');

    // Polymorphic TaskLinks connecting Tasks -> Collaboration Spaces and Tasks -> Common Organizations
    await ensureTaskLink(provider, system, NORTHSTAR_PROGRAM_TASK_ID, spaceEntity.ID, `ID|${northstarHub.ID}`, 'Primary Collaboration Hub');
    await ensureTaskLink(provider, system, NORTHSTAR_PROGRAM_TASK_ID, orgEntity.ID, `ID|${NORTHSTAR_ORG_ID}`, 'Client Organization');
    await ensureTaskLink(provider, system, NORTHSTAR_PHASE1_TASK_ID, spaceEntity.ID, `ID|${northstarPhase1.ID}`, 'Phase 1 Subspace');
    await ensureTaskLink(provider, system, SOLSTICE_PROGRAM_TASK_ID, spaceEntity.ID, `ID|${solsticeHub.ID}`, 'Primary Collaboration Hub');
    await ensureTaskLink(provider, system, SOLSTICE_PROGRAM_TASK_ID, orgEntity.ID, `ID|${SOLSTICE_ORG_ID}`, 'Client Organization');

    // Dual-band Space Chats
    await ensureEnterpriseChat(provider, system, ada, northstarHub.ID, 'northstar-hub-general', 'General', [
        { author: ada, text: 'Welcome to the Northstar ERP Modernization Hub. Shared milestones and deliverables live here.' },
        { author: bea, text: 'Northstar operations team confirmed ready for Phase 1 cutover review.' },
    ]);
    await ensureEnterpriseChat(provider, system, ada, northstarHub.ID, 'northstar-hub-internal', 'Private', [
        { author: sam, text: 'Meridian internal note: margin buffer and staffing allocation under review.' },
        { author: ada, text: 'Confirmed. Keep pricing assumptions strictly in this Team-only channel.' },
    ]);
    await ensureEnterpriseChat(provider, system, harbor, solsticeHub.ID, 'solstice-hub-general', 'General', [
        { author: harbor, text: 'Welcome to the Solstice Fleet Telemetry Hub.' },
        { author: harper, text: 'Solstice regional depot schedules uploaded for sensor calibration.' },
    ]);

    for (const spaceId of [northstarHub.ID, northstarPhase1.ID, solsticeHub.ID]) {
        const syncRes = await syncRoomEditGrantsForSpace(provider, spaceId);
        if (!syncRes.ok) {
            throw new Error(`Failed to sync room edit grants for enterprise space ${spaceId}: ${syncRes.message}`);
        }
    }

    // Dual-band Docs (Team internal memo vs Shared published deliverables)
    await ensureEnterpriseDoc(
        provider,
        ada,
        northstarHub.ID,
        ENTERPRISE_DOC_TITLES.northstarInternalMemo,
        '# Northstar Internal Pricing & Risk Memo\n\nMeridian internal contingency reserve: 14% margin buffer.',
        'Team',
        'Internal',
    );
    await ensureEnterpriseDoc(
        provider,
        ada,
        northstarHub.ID,
        ENTERPRISE_DOC_TITLES.northstarSharedBrief,
        '# Northstar Phase 1 Architecture Brief\n\nShared integration contract for warehouse cutover.',
        'Shared',
        'Deliverables',
    );
    await ensureEnterpriseDoc(
        provider,
        harbor,
        solsticeHub.ID,
        ENTERPRISE_DOC_TITLES.solsticeSharedGuide,
        '# Solstice Cold-Chain Calibration Guide\n\nCalibration protocol for refrigerated fleet telemetry units.',
        'Shared',
        'Deliverables',
    );

    // Fan-out-on-read Space Notices across Team and Shared bands
    await ensureEnterpriseNotice(
        provider,
        system,
        ada,
        northstarHub.ID,
        'Team',
        ENTERPRISE_NOTICE_TITLES.northstarTeamNotice,
        'Meridian staffing adjustments posted for internal delivery team review.',
    );
    await ensureEnterpriseNotice(
        provider,
        system,
        ada,
        northstarHub.ID,
        'Shared',
        ENTERPRISE_NOTICE_TITLES.northstarSharedNotice,
        'Northstar Phase 1 Architecture Brief is ready for joint sign-off.',
    );
    await ensureEnterpriseNotice(
        provider,
        system,
        harbor,
        solsticeHub.ID,
        'Shared',
        ENTERPRISE_NOTICE_TITLES.solsticeSharedNotice,
        'Solstice cold-chain calibration schedule is live in the hub.',
    );

    return {
        northstarHubSpaceId: northstarHub.ID,
        northstarPhase1SpaceId: northstarPhase1.ID,
        solsticeHubSpaceId: solsticeHub.ID,
    };
}
