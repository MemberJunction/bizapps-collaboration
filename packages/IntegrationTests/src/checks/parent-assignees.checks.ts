import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { mjBizAppsTasksTaskAssignmentEntity, mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
import { SPACE_ENTITY, SPACE_ITEM_ENTITY, TASK_ENTITY, TASK_ASSIGNMENT_ENTITY, PERSON_ENTITY } from '../entity-names.js';
import { FindId, FindRows, GetPersonaUser, Quote, View } from '../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';

async function findDiscoveryTaskId(ctx: IntegrationCheckContext): Promise<string> {
    const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
    Assert(!!taskEntity, 'Task entity found');
    const items = await FindRows<{ ID: string; RecordID: string }>(
        ctx,
        SPACE_ITEM_ENTITY,
        `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${taskEntity?.ID}' AND Band = 'Shared'`,
        ['ID', 'RecordID'],
    );
    Assert(items.length > 0, 'Discovery space has at least one shared task');
    const raw = items[0].RecordID;
    return raw.toLowerCase().startsWith('id|') ? raw.slice(3) : raw;
}

const checks: NamedCheck[] = [
    {
        Id: 'parent-assignees.PA1',
        Name: 'PA1 — when AllowParentAssignees is true, participant assigns ancestor member (Ada)',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            // 1. Ensure AllowParentAssignees = true on Discovery space (as staff Ada)
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space');
            space.AllowParentAssignees = true;
            Assert(await space.Save(), 'Set AllowParentAssignees = true');

            // 2. Find a task in Discovery space
            const taskId = await findDiscoveryTaskId(ctx);

            // 3. Find Ada's person ID
            const adaPersonRows = await FindRows<{ ID: string }>(
                ctx,
                PERSON_ENTITY,
                `Email = 'ada.owner@collab-world.example'`,
                ['ID'],
            );
            Assert(adaPersonRows.length === 1, 'Ada person found');
            const adaPersonId = adaPersonRows[0].ID;

            // 4. Find Person entity ID
            const personEntity = ctx.Provider.EntityByName(PERSON_ENTITY);
            Assert(!!personEntity, 'Person entity info found');
            if (!personEntity) throw new Error('Person entity info found');

            // 5. As participant Bea, create task assignment to Ada
            const assignment = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(TASK_ASSIGNMENT_ENTITY, bea);
            assignment.NewRecord();
            assignment.TaskID = taskId;
            assignment.AssigneeEntityID = personEntity.ID;
            assignment.AssigneeRecordID = adaPersonId;
            assignment.Status = 'Pending';

            const validation = await assignment.ValidateAsync();
            Assert(validation.Success, `Assignment should be allowed when AllowParentAssignees=true, but failed: ${validation.Errors.map((e) => e.Message).join('; ')}`);
        },
    },
    {
        Id: 'parent-assignees.PA2',
        Name: 'PA2 — when AllowParentAssignees is false, participant assigning ancestor member is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            // 1. Set AllowParentAssignees = false on Discovery space (as staff Ada)
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space');
            space.AllowParentAssignees = false;
            Assert(await space.Save(), 'Set AllowParentAssignees = false');

            // 2. Find a task in Discovery space
            const taskId = await findDiscoveryTaskId(ctx);

            // 3. Find Ada's person ID
            const adaPersonRows = await FindRows<{ ID: string }>(
                ctx,
                PERSON_ENTITY,
                `Email = 'ada.owner@collab-world.example'`,
                ['ID'],
            );
            Assert(adaPersonRows.length === 1, 'Ada person found');
            const adaPersonId = adaPersonRows[0].ID;

            const personEntity = ctx.Provider.EntityByName(PERSON_ENTITY);
            Assert(!!personEntity, 'Person entity info found');
            if (!personEntity) throw new Error('Person entity info found');

            // 4. As participant Bea, attempt to assign Ada
            const assignment = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(TASK_ASSIGNMENT_ENTITY, bea);
            assignment.NewRecord();
            assignment.TaskID = taskId;
            assignment.AssigneeEntityID = personEntity.ID;
            assignment.AssigneeRecordID = adaPersonId;
            assignment.Status = 'Pending';

            const validation = await assignment.ValidateAsync();
            Assert(!validation.Success, 'Assignment of ancestor member MUST be refused when AllowParentAssignees=false');

            // Restore AllowParentAssignees = true for subsequent checks
            space.AllowParentAssignees = true;
            await space.Save();
        },
    },
    {
        Id: 'parent-assignees.PA3',
        Name: 'PA3 — participant assigning same-space member (Bea) succeeds even when AllowParentAssignees is false',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            // Set AllowParentAssignees = false
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space');
            space.AllowParentAssignees = false;
            Assert(await space.Save(), 'Set AllowParentAssignees = false');

            const taskId = await findDiscoveryTaskId(ctx);

            // Find Bea's person ID
            const beaPersonRows = await FindRows<{ ID: string }>(
                ctx,
                PERSON_ENTITY,
                `Email = 'bea.member@collab-world.example'`,
                ['ID'],
            );
            Assert(beaPersonRows.length === 1, 'Bea person found');
            const beaPersonId = beaPersonRows[0].ID;

            const personEntity = ctx.Provider.EntityByName(PERSON_ENTITY);
            Assert(!!personEntity, 'Person entity info found');
            if (!personEntity) throw new Error('Person entity info found');

            // Assign Bea to task in Discovery
            const assignment = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(TASK_ASSIGNMENT_ENTITY, bea);
            assignment.NewRecord();
            assignment.TaskID = taskId;
            assignment.AssigneeEntityID = personEntity.ID;
            assignment.AssigneeRecordID = beaPersonId;
            assignment.Status = 'Pending';

            const validation = await assignment.ValidateAsync();
            Assert(validation.Success, `Same-space assignment should succeed when switch is false, but failed: ${validation.Errors.map((e) => e.Message).join('; ')}`);

            // Restore
            space.AllowParentAssignees = true;
            await space.Save();
        },
    },
    {
        Id: 'parent-assignees.PA4',
        Name: 'PA4 — only staff may change AllowParentAssignees; non-staff change is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');

            // As non-staff participant Bea, attempt to toggle AllowParentAssignees
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space as Bea');
            space.AllowParentAssignees = !space.AllowParentAssignees;

            const validation = await space.ValidateAsync();
            Assert(!validation.Success, 'Non-staff participant changing AllowParentAssignees MUST fail validation');
            Assert(
                validation.Errors.some((e) => e.Message.includes('only staff may change the allow-parent-assignees setting')),
                `Expected staff-only error message, got: ${validation.Errors.map((e) => e.Message).join('; ')}`,
            );
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('parent-assignees', {
    Setup: async () => {},
    Teardown: async () => {},
});
