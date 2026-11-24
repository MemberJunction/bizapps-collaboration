/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Cross-Stack Enterprise Client Checks over GraphQL wire (no `*Server` classes loaded).
 *
 * Exercises multi-organization `bizapps-common` + `bizapps-tasks` + `bizapps-collaboration`
 * data visibility, `CollaborationClient.EnsureSpaceForRecord` over GraphQL, and adversarial
 * cross-tenant write/invite refusals using minted persona API keys.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    CollaborationClient,
    type mjBizAppsCollaborationSpaceEntity,
} from '@mj-biz-apps/collaboration-entities';
import { type mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
import {
    COMPANY_ENTITY,
    CONTACT_METHOD_ENTITY,
    ORGANIZATION_ENTITY,
    PERSON_ENTITY,
    RELATIONSHIP_ENTITY,
    SPACE_ANCHOR_ENTITY,
    SPACE_CHAT_ENTITY,
    SPACE_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    TASK_ACTIVITY_ENTITY,
    TASK_ENTITY,
    TASK_LINK_ENTITY,
    TASK_TYPE_ENTITY,
} from '../../entity-names.js';
import { FindRows, getPersonaClientContext, SameID } from '../../wire.js';
import {
    ENTERPRISE_ORG_NAMES,
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
} from '../../world/enterprise-ids.js';
import { CHECK_SPACE_PREFIX } from '../../world/ids.js';
import { cleanupSpace, cleanupStep, deleteWhere, registerChecks } from '../cleanup-helpers.js';

type ClientPersona = Awaited<ReturnType<typeof getPersonaClientContext>>;

function asPersona(ctx: IntegrationCheckContext, persona: ClientPersona): IntegrationCheckContext {
    return { ...ctx, Provider: persona.Provider, User: persona.User };
}

function clientOf(persona: ClientPersona): CollaborationClient {
    return new CollaborationClient(persona.GraphQLProvider);
}

async function resolveEnterpriseSpaceId(ctx: IntegrationCheckContext, taskRecordId: string, label: string): Promise<string> {
    const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
    Assert(!!taskEntity, 'Task entity metadata exists');
    const anchors = await FindRows<{ SpaceID: string }>(
        ctx,
        SPACE_ANCHOR_ENTITY,
        `EntityID = '${taskEntity!.ID}' AND (RecordID = '${taskRecordId}' OR RecordID = 'ID|${taskRecordId}') AND IsPrimary = 1`,
        ['SpaceID'],
        undefined,
        { BypassCache: true },
    );
    Assert(anchors.length === 1, `Expected 1 primary SpaceAnchor for ${label}`);
    return anchors[0].SpaceID;
}

const checks: NamedCheck[] = [
    {
        Id: 'cross-stack-enterprise.CEC1',
        Name: 'CEC1 — over the wire: Common multi-org enterprise graph, Company mirrors, multi-level Tasks, and TaskLinks read cleanly through GraphQL',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const orgs = await FindRows<{ ID: string; Name: string; LinkedCompanyID: string | null }>(
                ctx,
                ORGANIZATION_ENTITY,
                `ID IN ('${MERIDIAN_ORG_ID}', '${NORTHSTAR_ORG_ID}', '${SOLSTICE_ORG_ID}')`,
                ['ID', 'Name', 'LinkedCompanyID'],
                undefined,
                { BypassCache: true },
            );
            Assert(orgs.length === 3, `Expected 3 enterprise organizations over GraphQL, found ${orgs.length}`);
            const names = new Set(orgs.map((o) => o.Name));
            Assert(names.has(ENTERPRISE_ORG_NAMES.meridian), 'Meridian Advisory Group present');
            Assert(names.has(ENTERPRISE_ORG_NAMES.northstar), 'Northstar Manufacturing Corp present');
            Assert(names.has(ENTERPRISE_ORG_NAMES.solstice), 'Solstice Logistics Ltd present');

            if (ctx.Provider.EntityByName(COMPANY_ENTITY)) {
                const companies = await FindRows<{ ID: string }>(
                    ctx,
                    COMPANY_ENTITY,
                    `ID IN ('${MERIDIAN_COMPANY_ID}', '${NORTHSTAR_COMPANY_ID}', '${SOLSTICE_COMPANY_ID}')`,
                    ['ID'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(companies.length === 3, `Expected 3 mirrored Companies over GraphQL, found ${companies.length}`);
            }

            const rels = await FindRows<{ ID: string }>(
                ctx,
                RELATIONSHIP_ENTITY,
                `ToOrganizationID IN ('${MERIDIAN_ORG_ID}', '${NORTHSTAR_ORG_ID}', '${SOLSTICE_ORG_ID}') AND Status = 'Active'`,
                ['ID'],
                undefined,
                { BypassCache: true },
            );
            Assert(rels.length >= 7, `Expected >= 7 active org relationships over GraphQL, found ${rels.length}`);

            const contacts = await FindRows<{ ID: string }>(
                ctx,
                CONTACT_METHOD_ENTITY,
                `OrganizationID IN ('${MERIDIAN_ORG_ID}', '${NORTHSTAR_ORG_ID}', '${SOLSTICE_ORG_ID}')`,
                ['ID'],
                undefined,
                { BypassCache: true },
            );
            Assert(contacts.length >= 3, `Expected >= 3 organization contact methods over GraphQL, found ${contacts.length}`);

            const tasks = await FindRows<{ ID: string; ParentID: string | null }>(
                ctx,
                TASK_ENTITY,
                `ID IN ('${NORTHSTAR_PROGRAM_TASK_ID}', '${NORTHSTAR_PHASE1_TASK_ID}', '${NORTHSTAR_SIGNOFF_TASK_ID}', '${SOLSTICE_PROGRAM_TASK_ID}', '${SOLSTICE_CALIBRATION_TASK_ID}')`,
                ['ID', 'ParentID'],
                undefined,
                { BypassCache: true },
            );
            Assert(tasks.length === 5, `Expected 5 enterprise tasks over GraphQL, found ${tasks.length}`);

            const links = await FindRows<{ ID: string }>(
                ctx,
                TASK_LINK_ENTITY,
                `TaskID IN ('${NORTHSTAR_PROGRAM_TASK_ID}', '${NORTHSTAR_PHASE1_TASK_ID}', '${SOLSTICE_PROGRAM_TASK_ID}')`,
                ['ID'],
                undefined,
                { BypassCache: true },
            );
            Assert(links.length >= 5, `Expected >= 5 polymorphic TaskLinks over GraphQL, found ${links.length}`);
        },
    },
    {
        Id: 'cross-stack-enterprise.CEC2',
        Name: 'CEC2 — over the wire: EnsureSpaceForRecord creates a subtyped ExampleBoard space anchored to a Tasks record idempotently and refuses rival Client B',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const [taskType] = await FindRows<{ ID: string }>(ctx, TASK_TYPE_ENTITY, "Code = 'GENERAL'", ['ID']);
            const [adaPerson] = await FindRows<{ ID: string }>(ctx, PERSON_ENTITY, `LinkedUserID = '${ada.User.ID}'`, ['ID']);
            Assert(!!taskType && !!adaPerson, 'General task type and Ada Person exist');

            let taskId: string | null = null;
            let spaceId: string | null = null;

            try {
                const task = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, ctx.User);
                task.NewRecord();
                task.Name = `COLLAB-CHECK wire anchor task ${Date.now()}`;
                task.TypeID = taskType.ID;
                task.OrganizationID = NORTHSTAR_ORG_ID;
                task.CreatedByPersonID = adaPerson.ID;
                task.Status = 'Open';
                task.Priority = 'Medium';
                Assert(await task.Save() && !!task.ID, `Create anchor task over GraphQL failed: ${task.LatestResult?.CompleteMessage ?? ''}`);
                taskId = task.ID;

                const first = await clientOf(ada).EnsureSpaceForRecord({
                    TypeCode: 'example-board',
                    EntityName: TASK_ENTITY,
                    RecordID: taskId,
                    SpaceName: `${CHECK_SPACE_PREFIX}CEC2 Board ${Date.now()}`,
                    Details: JSON.stringify({ TermName: 'FY2026 Wire Steering', QuorumPercentage: 70 }),
                });
                Assert(first.Success === true && !!first.SpaceID, `EnsureSpaceForRecord over GraphQL failed: ${first.ErrorMessage ?? ''}`);
                spaceId = first.SpaceID!;

                const second = await clientOf(ada).EnsureSpaceForRecord({
                    TypeCode: 'example-board',
                    EntityName: TASK_ENTITY,
                    RecordID: taskId,
                });
                Assert(second.Success === true && SameID(second.SpaceID, spaceId), 'Repeat EnsureSpaceForRecord over GraphQL returns identical SpaceID');

                const rival = await clientOf(harper).EnsureSpaceForRecord({
                    TypeCode: 'example-board',
                    EntityName: TASK_ENTITY,
                    RecordID: taskId,
                });
                Assert(rival.Success === false, 'Rival Client B Harper refused EnsureSpaceForRecord over GraphQL');
            } finally {
                if (spaceId) {
                    await cleanupStep(async () => {
                        const loaded = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada.User);
                        if (await loaded.Load(spaceId!)) {
                            loaded.ClosedAt = new Date(Date.now() - 60_000);
                            await loaded.Save();
                        }
                    });
                    await cleanupSpace(ctx.Provider, ctx.User, spaceId);
                }
                if (taskId) {
                    await deleteWhere(ctx.Provider, ctx.User, TASK_ACTIVITY_ENTITY, `TaskID = '${taskId}'`, 'CEC2 anchor task activities');
                    await deleteWhere(ctx.Provider, ctx.User, TASK_ENTITY, `ID = '${taskId}'`, 'CEC2 anchor task');
                }
            }
        },
    },
    {
        Id: 'cross-stack-enterprise.CEC3',
        Name: 'CEC3 — over the wire: multi-org RLS isolates Northstar Hub vs Solstice Hub across Spaces, Space Items (Team vs Shared), and Space Chats',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const bea = await getPersonaClientContext(ctx, 'bea');
            const harper = await getPersonaClientContext(ctx, 'harper');

            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const northstarPhase1Id = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PHASE1_TASK_ID, 'Northstar Phase 1');
            const solsticeHubId = await resolveEnterpriseSpaceId(ctx, SOLSTICE_PROGRAM_TASK_ID, 'Solstice Hub');

            const beaSpaces = await FindRows<{ ID: string }>(
                asPersona(ctx, bea),
                SPACE_ENTITY,
                `ID IN ('${northstarHubId}', '${northstarPhase1Id}', '${solsticeHubId}')`,
                ['ID'],
                bea.User,
                { BypassCache: true },
            );
            Assert(beaSpaces.length === 2 && !beaSpaces.some((s) => SameID(s.ID, solsticeHubId)), `Bea sees Northstar Hub + Phase 1 only (${beaSpaces.length})`);

            const harperSpaces = await FindRows<{ ID: string }>(
                asPersona(ctx, harper),
                SPACE_ENTITY,
                `ID IN ('${northstarHubId}', '${northstarPhase1Id}', '${solsticeHubId}')`,
                ['ID'],
                harper.User,
                { BypassCache: true },
            );
            Assert(harperSpaces.length === 1 && SameID(harperSpaces[0].ID, solsticeHubId), `Harper sees Solstice Hub only (${harperSpaces.length})`);

            const adaItems = await FindRows<{ Band: string }>(
                asPersona(ctx, ada),
                SPACE_ITEM_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['Band'],
                ada.User,
                { BypassCache: true },
            );
            Assert(adaItems.some((i) => i.Band === 'Team') && adaItems.some((i) => i.Band === 'Shared'), 'Ada sees both Team and Shared items in Northstar Hub over GraphQL');

            const beaItems = await FindRows<{ Band: string }>(
                asPersona(ctx, bea),
                SPACE_ITEM_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['Band'],
                bea.User,
                { BypassCache: true },
            );
            Assert(beaItems.length >= 1 && beaItems.every((i) => i.Band === 'Shared'), 'Bea sees ONLY Shared items in Northstar Hub over GraphQL');

            const harperNorthstarItems = await FindRows<{ ID: string }>(
                asPersona(ctx, harper),
                SPACE_ITEM_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['ID'],
                harper.User,
                { BypassCache: true },
            );
            Assert(harperNorthstarItems.length === 0, 'Harper sees 0 Northstar items over GraphQL');

            const beaChats = await FindRows<{ Kind: string }>(
                asPersona(ctx, bea),
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['Kind'],
                bea.User,
                { BypassCache: true },
            );
            Assert(beaChats.length === 1 && beaChats[0].Kind === 'General', 'Bea sees ONLY General chat over GraphQL');
        },
    },
    {
        Id: 'cross-stack-enterprise.CEC4',
        Name: 'CEC4 — over the wire: adversarial cross-org writes (post message, upload file, create task, mint invite link) by Rival Client B are refused over GraphQL',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harper = await getPersonaClientContext(ctx, 'harper');
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const [generalChat] = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}' AND Kind = 'General'`,
                ['ConversationID'],
            );
            const [guestRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'guest'", ['ID']);
            Assert(!!generalChat && !!guestRole, 'Northstar General chat and guest role exist');

            const postRes = await clientOf(harper).PostSpaceMessage({
                SpaceID: northstarHubId,
                ConversationID: generalChat.ConversationID,
                Text: 'Wire adversarial cross-org post attempt',
            });
            Assert(postRes.Success === false, 'Harper refused PostSpaceMessage into Northstar Hub over GraphQL');

            const uploadRes = await clientOf(harper).UploadSpaceFile({
                SpaceID: northstarHubId,
                FileName: 'wire-adversarial.txt',
                MimeType: 'text/plain',
                Base64Data: Buffer.from('unauthorized', 'utf8').toString('base64'),
                Band: 'Shared',
            });
            Assert(uploadRes.Success === false, 'Harper refused UploadSpaceFile into Northstar Hub over GraphQL');

            const taskRes = await clientOf(harper).CreateSpaceTask({
                SpaceID: northstarHubId,
                Name: 'Wire adversarial cross-org task',
                Band: 'Shared',
            });
            Assert(taskRes.Success === false, 'Harper refused CreateSpaceTask into Northstar Hub over GraphQL');

            const mintRes = await clientOf(harper).MintSpaceLink({
                SpaceID: northstarHubId,
                Email: 'wire.rival@collab-invite.example',
                RoleID: guestRole.ID,
            });
            Assert(mintRes.Success === false, 'Harper refused MintSpaceLink on Northstar Hub over GraphQL');
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('cross-stack-enterprise', {
    Setup: async () => {},
    Teardown: async () => {},
});
