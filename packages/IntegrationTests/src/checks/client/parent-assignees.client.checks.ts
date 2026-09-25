import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { mjBizAppsTasksTaskAssignmentEntity } from '@mj-biz-apps/tasks-entities';
import { SPACE_ENTITY, SPACE_ITEM_ENTITY, SPACE_MEMBER_ENTITY, TASK_ENTITY, TASK_ASSIGNMENT_ENTITY, PERSON_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaContext, View } from '../../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';

async function findDiscoveryTaskId(ctx: IntegrationCheckContext, excludingAssigneePersonId?: string): Promise<string> {
    const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
    Assert(!!taskEntity, 'Task entity found');
    const items = await FindRows<{ ID: string; RecordID: string }>(
        ctx,
        SPACE_ITEM_ENTITY,
        `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${taskEntity?.ID}' AND Band = 'Shared'`,
        ['ID', 'RecordID'],
    );
    Assert(items.length > 0, 'Discovery space has at least one shared task');
    const rootTaskIds = items.map((i) => (i.RecordID.toLowerCase().startsWith('id|') ? i.RecordID.slice(3) : i.RecordID));

    if (excludingAssigneePersonId) {
        const allTasks = await FindRows<{ ID: string; ParentID: string }>(
            ctx,
            TASK_ENTITY,
            `ID IN (${rootTaskIds.map((id) => `'${id}'`).join(',')}) OR ParentID IN (${rootTaskIds.map((id) => `'${id}'`).join(',')})`,
            ['ID', 'ParentID'],
        );
        const existingAssignments = await FindRows<{ TaskID: string }>(
            ctx,
            TASK_ASSIGNMENT_ENTITY,
            `AssigneeRecordID = '${excludingAssigneePersonId}' AND TaskID IN (${allTasks.map((t) => `'${t.ID}'`).join(',')})`,
            ['TaskID'],
        );
        const assignedTaskIds = new Set(existingAssignments.map((a) => a.TaskID.toLowerCase()));
        const available = allTasks.find((t) => !assignedTaskIds.has(t.ID.toLowerCase()));
        if (available) return available.ID;
    }

    const raw = items[0].RecordID;
    return raw.toLowerCase().startsWith('id|') ? raw.slice(3) : raw;
}

const checks: NamedCheck[] = [
    {
        Id: 'parent-assignees.PA1',
        Name: 'PA1 — when AllowParentAssignees is true, participant assigns ancestor member (Ada) over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');

            // 1. Ensure AllowParentAssignees = true on Discovery space (as staff Ada)
            const space = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space');
            space.AllowParentAssignees = true;
            Assert(await space.Save(), 'Set AllowParentAssignees = true');

            // 2. Find Ada's person ID
            const adaPersonRows = await FindRows<{ ID: string }>(
                ctx,
                PERSON_ENTITY,
                `Email = 'ada.owner@collab-world.example'`,
                ['ID'],
            );
            Assert(adaPersonRows.length === 1, 'Ada person found');
            const adaPersonId = adaPersonRows[0].ID;

            // 3. Find a task in Discovery space not already assigned to Ada
            const taskId = await findDiscoveryTaskId(ctx, adaPersonId);

            // 4. Find Person entity ID
            const personEntity = ctx.Provider.EntityByName(PERSON_ENTITY);
            Assert(!!personEntity, 'Person entity info found');
            if (!personEntity) throw new Error('Person entity info found');

            // 5. As participant Bea, create task assignment to Ada over the wire
            const assignment = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(TASK_ASSIGNMENT_ENTITY, beaCtx.User);
            assignment.NewRecord();
            assignment.TaskID = taskId;
            assignment.AssigneeEntityID = personEntity.ID;
            assignment.AssigneeRecordID = adaPersonId;
            assignment.Status = 'Pending';

            let mainError: unknown = null;
            try {
                const saved = await assignment.Save();
                Assert(saved, `Assignment should save when AllowParentAssignees=true, but failed: ${assignment.LatestResult?.CompleteMessage ?? ''}`);
            } catch (e) {
                mainError = e;
            } finally {
                let cleanupError: unknown = null;
                if (assignment.IsSaved) {
                    try {
                        const deleted = await assignment.Delete();
                        if (!deleted) {
                            cleanupError = new Error(`PA1 cleanup failed to delete assignment: ${assignment.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                        }
                    } catch (ce) {
                        cleanupError = ce;
                    }
                }
                if (mainError && cleanupError) {
                    throw new Error(`PA1 test failed: ${mainError instanceof Error ? mainError.message : String(mainError)}\nAND cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
                }
                if (cleanupError) throw cleanupError;
                if (mainError) throw mainError;
            }
        },
    },
    {
        Id: 'parent-assignees.PA2',
        Name: 'PA2 — when AllowParentAssignees is false, participant assigning ancestor member is refused over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');

            const space = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space');

            let mainError: unknown = null;
            try {
                // 1. Set AllowParentAssignees = false on Discovery space (as staff Ada)
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
                const assignment = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(TASK_ASSIGNMENT_ENTITY, beaCtx.User);
                assignment.NewRecord();
                assignment.TaskID = taskId;
                assignment.AssigneeEntityID = personEntity.ID;
                assignment.AssigneeRecordID = adaPersonId;
                assignment.Status = 'Pending';

                const saved = await assignment.Save();
                Assert(!saved, 'Assignment of ancestor member MUST be refused when AllowParentAssignees=false');
                const reason = assignment.LatestResult?.CompleteMessage ?? '';
                Assert(
                    reason.includes('Assignment refused: participants may not assign people seated above this space.'),
                    `Expected ancestor assignment refusal message, got: ${reason}`,
                );
            } catch (e) {
                mainError = e;
            } finally {
                let cleanupError: unknown = null;
                try {
                    space.AllowParentAssignees = true;
                    const saved = await space.Save();
                    if (!saved) {
                        cleanupError = new Error(`PA2 cleanup failed to restore AllowParentAssignees: ${space.LatestResult?.CompleteMessage ?? 'Save returned false'}`);
                    }
                } catch (ce) {
                    cleanupError = ce;
                }
                if (mainError && cleanupError) {
                    throw new Error(`PA2 test failed: ${mainError instanceof Error ? mainError.message : String(mainError)}\nAND cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
                }
                if (cleanupError) throw cleanupError;
                if (mainError) throw mainError;
            }
        },
    },
    {
        Id: 'parent-assignees.PA3',
        Name: 'PA3 — participant assigning same-space member (Bea) succeeds even when AllowParentAssignees is false over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');

            const space = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space');

            let mainError: unknown = null;
            try {
                space.AllowParentAssignees = false;
                Assert(await space.Save(), 'Set AllowParentAssignees = false');

                const taskId = await findDiscoveryTaskId(ctx);

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

                const assignment = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(TASK_ASSIGNMENT_ENTITY, beaCtx.User);
                assignment.NewRecord();
                assignment.TaskID = taskId;
                assignment.AssigneeEntityID = personEntity.ID;
                assignment.AssigneeRecordID = beaPersonId;
                assignment.Status = 'Pending';

                let assignError: unknown = null;
                try {
                    const saved = await assignment.Save();
                    Assert(saved, `Same-space assignment should succeed when switch is false, but failed: ${assignment.LatestResult?.CompleteMessage ?? ''}`);
                } catch (ae) {
                    assignError = ae;
                } finally {
                    let deleteError: unknown = null;
                    if (assignment.IsSaved) {
                        try {
                            const deleted = await assignment.Delete();
                            if (!deleted) {
                                deleteError = new Error(`PA3 cleanup failed to delete assignment: ${assignment.LatestResult?.CompleteMessage ?? 'Delete returned false'}`);
                            }
                        } catch (de) {
                            deleteError = de;
                        }
                    }
                    if (assignError && deleteError) {
                        throw new Error(`PA3 assign failed: ${assignError instanceof Error ? assignError.message : String(assignError)}\nAND delete failed: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
                    }
                    if (deleteError) throw deleteError;
                    if (assignError) throw assignError;
                }
            } catch (e) {
                mainError = e;
            } finally {
                let cleanupError: unknown = null;
                try {
                    space.AllowParentAssignees = true;
                    const saved = await space.Save();
                    if (!saved) {
                        cleanupError = new Error(`PA3 cleanup failed to restore AllowParentAssignees: ${space.LatestResult?.CompleteMessage ?? 'Save returned false'}`);
                    }
                } catch (ce) {
                    cleanupError = ce;
                }
                if (mainError && cleanupError) {
                    throw new Error(`PA3 test failed: ${mainError instanceof Error ? mainError.message : String(mainError)}\nAND cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
                }
                if (cleanupError) throw cleanupError;
                if (mainError) throw mainError;
            }
        },
    },
    {
        Id: 'parent-assignees.PA4',
        Name: 'PA4 — only staff may change AllowParentAssignees; non-staff change is refused over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaContext(ctx, 'bea');

            const space = await beaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, beaCtx.User);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space as Bea');
            space.AllowParentAssignees = !space.AllowParentAssignees;

            const saved = await space.Save();
            Assert(!saved, 'Non-staff participant changing AllowParentAssignees MUST fail save over the wire');
            const reason = space.LatestResult?.CompleteMessage ?? '';
            Assert(
                reason.includes('only staff may change the allow-parent-assignees setting'),
                `Expected staff-only error message, got: ${reason}`,
            );
        },
    },
    {
        Id: 'parent-assignees.PA5',
        Name: "PA5 — with switch on, Bea can read Ada's seat on Northwind and Person record; with switch off, seat is hidden over the wire",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');
            const view = View(beaCtx);

            const space = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space');

            // 1. With switch ON: Bea can read Ada's seat on Northwind and Ada's person record
            space.AllowParentAssignees = true;
            Assert(await space.Save(), 'Set AllowParentAssignees = true');

            const seatsOn = await view.RunView<{ ID: string; SpaceID: string; UserID: string }>({
                EntityName: SPACE_MEMBER_ENTITY,
                ExtraFilter: `SpaceID = '${NORTHWIND_SPACE_ID}' AND UserID = '${adaCtx.User.ID}'`,
                Fields: ['ID', 'SpaceID', 'UserID'],
                ResultType: 'simple',
            });
            Assert(seatsOn.Success, `Bea read seats with switch on: ${seatsOn.ErrorMessage ?? ''}`);
            Assert((seatsOn.Results?.length ?? 0) === 1, `With switch on, Bea should read Ada's seat on Northwind, got ${seatsOn.Results?.length ?? 0}`);

            const peopleOn = await view.RunView<{ ID: string; Email: string }>({
                EntityName: PERSON_ENTITY,
                ExtraFilter: `LinkedUserID = '${adaCtx.User.ID}'`,
                Fields: ['ID', 'Email'],
                ResultType: 'simple',
            });
            Assert(peopleOn.Success, `Bea read People with switch on: ${peopleOn.ErrorMessage ?? ''}`);
            Assert((peopleOn.Results?.length ?? 0) === 1, `With switch on, Bea should read Ada's person record, got ${peopleOn.Results?.length ?? 0}`);

            // 2. With switch OFF: Bea cannot read Ada's Northwind seat
            let mainError: unknown = null;
            try {
                space.AllowParentAssignees = false;
                Assert(await space.Save(), 'Set AllowParentAssignees = false');

                const seatsOff = await view.RunView<{ ID: string; SpaceID: string; UserID: string }>({
                    EntityName: SPACE_MEMBER_ENTITY,
                    ExtraFilter: `SpaceID = '${NORTHWIND_SPACE_ID}' AND UserID = '${adaCtx.User.ID}'`,
                    Fields: ['ID', 'SpaceID', 'UserID'],
                    ResultType: 'simple',
                });
                Assert(seatsOff.Success, `Bea read seats with switch off: ${seatsOff.ErrorMessage ?? ''}`);
                Assert((seatsOff.Results?.length ?? 0) === 0, `With switch off, Bea MUST NOT read Ada's seat on Northwind, got ${seatsOff.Results?.length ?? 0}`);
            } catch (e) {
                mainError = e;
            } finally {
                let cleanupError: unknown = null;
                try {
                    space.AllowParentAssignees = true;
                    const saved = await space.Save();
                    if (!saved) {
                        cleanupError = new Error(`PA5 cleanup failed to restore AllowParentAssignees: ${space.LatestResult?.CompleteMessage ?? 'Save returned false'}`);
                    }
                } catch (ce) {
                    cleanupError = ce;
                }
                if (mainError && cleanupError) {
                    throw new Error(`PA5 test failed: ${mainError instanceof Error ? mainError.message : String(mainError)}\nAND cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
                }
                if (cleanupError) throw cleanupError;
                if (mainError) throw mainError;
            }
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('parent-assignees', {
    Setup: async () => {},
    Teardown: async (ctx: IntegrationCheckContext) => {
        const adaCtx = await getPersonaContext(ctx, 'ada');
        const space = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
        if (await space.Load(DISCOVERY_SPACE_ID)) {
            if (!space.AllowParentAssignees) {
                space.AllowParentAssignees = true;
                const saved = await space.Save();
                if (!saved) {
                    const err = space.LatestResult?.CompleteMessage ?? 'Save returned false';
                    throw new Error(`parent-assignees Teardown failed to restore AllowParentAssignees: ${err}`);
                }
            }
        } else {
            throw new Error(`parent-assignees Teardown could not load Discovery space ${DISCOVERY_SPACE_ID}`);
        }
    },
});
