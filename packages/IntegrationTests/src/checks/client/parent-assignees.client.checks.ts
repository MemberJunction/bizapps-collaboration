import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient, mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { mjBizAppsTasksTaskActivityEntity, mjBizAppsTasksTaskAssignmentEntity, mjBizAppsTasksTaskEntity, mjBizAppsTasksTaskLinkEntity } from '@mj-biz-apps/tasks-entities';
import { PERSON_ENTITY, SPACE_ENTITY, SPACE_ITEM_ENTITY, SPACE_MEMBER_ENTITY, TASK_ACTIVITY_ENTITY, TASK_ASSIGNMENT_ENTITY, TASK_ENTITY, TASK_LINK_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext, getPersonaContext, View } from '../../wire.js';
import { registerChecks } from '../cleanup-helpers.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const FIELD_NOTES_SPACE_ID = 'C1000001-0000-4000-8000-000000000011';

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
                BypassCache: true,
            });
            Assert(seatsOn.Success, `Bea read seats with switch on: ${seatsOn.ErrorMessage ?? ''}`);
            Assert((seatsOn.Results?.length ?? 0) === 1, `With switch on, Bea should read Ada's seat on Northwind, got ${seatsOn.Results?.length ?? 0}`);

            const peopleOn = await view.RunView<{ ID: string; Email: string }>({
                EntityName: PERSON_ENTITY,
                ExtraFilter: `LinkedUserID = '${adaCtx.User.ID}'`,
                Fields: ['ID', 'Email'],
                ResultType: 'simple',
                BypassCache: true,
            });
            Assert(peopleOn.Success, `Bea read People with switch on: ${peopleOn.ErrorMessage ?? ''}`);
            Assert((peopleOn.Results?.length ?? 0) === 1, `With switch on, Bea should read Ada's person record, got ${peopleOn.Results?.length ?? 0}`);

            // 2. With switch OFF: Bea cannot read Ada's Northwind seat.
            // Under the leaf-space rule, any reached space with AllowParentAssignees=true
            // opens ancestor seats. Since Bea reaches both Discovery and Field notes, both
            // must have the switch off to hide Ada's Northwind seat.
            const fieldNotes = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await fieldNotes.Load(FIELD_NOTES_SPACE_ID), 'Load Field notes space over wire');

            let mainError: unknown = null;
            try {
                space.AllowParentAssignees = false;
                Assert(await space.Save(), 'Set Discovery AllowParentAssignees = false');
                fieldNotes.AllowParentAssignees = false;
                Assert(await fieldNotes.Save(), 'Set Field notes AllowParentAssignees = false');

                const seatsOff = await view.RunView<{ ID: string; SpaceID: string; UserID: string }>({
                    EntityName: SPACE_MEMBER_ENTITY,
                    ExtraFilter: `SpaceID = '${NORTHWIND_SPACE_ID}' AND UserID = '${adaCtx.User.ID}'`,
                    Fields: ['ID', 'SpaceID', 'UserID'],
                    ResultType: 'simple',
                    BypassCache: true,
                });
                Assert(seatsOff.Success, `Bea read seats with switch off: ${seatsOff.ErrorMessage ?? ''}`);
                Assert((seatsOff.Results?.length ?? 0) === 0, `With switch off, Bea MUST NOT read Ada's seat on Northwind, got ${seatsOff.Results?.length ?? 0}`);
            } catch (e) {
                mainError = e;
            } finally {
                let cleanupError: unknown = null;
                try {
                    // Restore switches to true
                    space.AllowParentAssignees = true;
                    const saved1 = await space.Save();
                    if (!saved1) throw new Error(`PA5 cleanup failed to restore AllowParentAssignees on Discovery: ${space.LatestResult?.CompleteMessage ?? 'Save returned false'}`);
                } catch (ce) {
                    cleanupError = ce;
                }
                try {
                    fieldNotes.AllowParentAssignees = true;
                    const saved2 = await fieldNotes.Save();
                    if (!saved2) throw new Error(`PA5 cleanup failed to restore AllowParentAssignees on Field notes: ${fieldNotes.LatestResult?.CompleteMessage ?? 'Save returned false'}`);
                } catch (ce) {
                    if (!cleanupError) cleanupError = ce;
                }
                if (mainError && cleanupError) {
                    throw new Error(`PA5 test failed: ${mainError instanceof Error ? mainError.message : String(mainError)}\nAND cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
                }
                if (cleanupError) throw cleanupError;
                if (mainError) throw mainError;
            }
        },
    },
    {
        Id: 'parent-assignees.PA6',
        Name: 'PA6 — when middle space (Discovery) switch is off but leaf space (Field notes) switch is on, participant in leaf space can assign ancestor member (Ada) over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');

            // 1. Setup switches:
            //    Discovery (middle space) -> AllowParentAssignees = false
            //    Field notes (leaf space) -> AllowParentAssignees = true
            const discoverySpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await discoverySpace.Load(DISCOVERY_SPACE_ID), 'Load Discovery space over the wire');
            discoverySpace.AllowParentAssignees = false;
            Assert(await discoverySpace.Save(), 'Set Discovery AllowParentAssignees = false over the wire');

            const fieldNotesSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await fieldNotesSpace.Load(FIELD_NOTES_SPACE_ID), 'Load Field notes space over the wire');
            fieldNotesSpace.AllowParentAssignees = true;
            Assert(await fieldNotesSpace.Save(), 'Set Field notes AllowParentAssignees = true over the wire');

            // 2. Find Ada's person ID
            const adaPersonRows = await FindRows<{ ID: string }>(
                ctx,
                PERSON_ENTITY,
                `Email = 'ada.owner@collab-world.example'`,
                ['ID'],
            );
            Assert(adaPersonRows.length === 1, 'Ada person found');
            const adaPersonId = adaPersonRows[0].ID;

            const personEntity = ctx.Provider.EntityByName(PERSON_ENTITY);
            Assert(!!personEntity, 'Person entity found');
            if (!personEntity) throw new Error('Person entity found');

            // 3. File a task in Field notes as staff Ada via CollaborationClient
            const adaClientCtx = await getPersonaClientContext(ctx, 'ada');
            const adaClient = new CollaborationClient(adaClientCtx.GraphQLProvider);
            const createRes = await adaClient.CreateSpaceTask({
                SpaceID: FIELD_NOTES_SPACE_ID,
                Name: 'Field notes inspection task over wire',
                Band: 'Shared',
            });
            Assert(createRes.Success === true && !!createRes.TaskID && !!createRes.ItemID, `Create task in Field notes over wire: ${createRes.ErrorMessage ?? ''}`);
            const taskId = createRes.TaskID!;
            const itemId = createRes.ItemID!;

            // 4. As participant Bea, create task assignment to ancestor member Ada over the wire
            const assignment = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(TASK_ASSIGNMENT_ENTITY, beaCtx.User);
            assignment.NewRecord();
            assignment.TaskID = taskId;
            assignment.AssigneeEntityID = personEntity.ID;
            assignment.AssigneeRecordID = adaPersonId;
            assignment.Status = 'Pending';

            let mainError: unknown = null;
            try {
                const saved = await assignment.Save();
                Assert(saved, `Assignment in Field notes should succeed over the wire when Field notes AllowParentAssignees=true even if Discovery switch is false: ${assignment.LatestResult?.CompleteMessage ?? ''}`);

                // Also assert Bea reads Ada via People In Reach / ancestor members
                const view = View(beaCtx);
                const peopleRes = await view.RunView<{ ID: string }>({
                    EntityName: PERSON_ENTITY,
                    ExtraFilter: `Email = 'ada.owner@collab-world.example'`,
                    Fields: ['ID'],
                    MaxRows: 1,
                    ResultType: 'simple',
                }, beaCtx.User);
                Assert(peopleRes.Success, `Bea read People with Field notes switch on over wire: ${peopleRes.ErrorMessage ?? ''}`);
                Assert((peopleRes.Results?.length ?? 0) === 1, 'Bea can read Ada person through Field notes ancestor seat reach over wire');
            } catch (e) {
                mainError = e;
            } finally {
                let cleanupError: unknown = null;
                try {
                    if (assignment.IsSaved) {
                        const delAssignment = await assignment.Delete();
                        if (!delAssignment) {
                            cleanupError = new Error(`PA6 cleanup failed to delete assignment: ${assignment.LatestResult?.CompleteMessage ?? ''}`);
                        }
                    }
                    const item = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
                    if (await item.Load(itemId)) {
                        const delItem = await item.Delete();
                        if (!delItem && !cleanupError) {
                            cleanupError = new Error(`PA6 cleanup failed to delete item: ${item.LatestResult?.CompleteMessage ?? ''}`);
                        }
                    }
                    const rv = View(ctx);
                    const linkRows = await rv.RunView<{ ID: string }>({
                        EntityName: TASK_LINK_ENTITY,
                        ExtraFilter: `TaskID = '${taskId}'`,
                        Fields: ['ID'],
                        ResultType: 'simple',
                    }, ctx.User);
                    if (linkRows.Success && linkRows.Results) {
                        for (const r of linkRows.Results) {
                            const link = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskLinkEntity>(TASK_LINK_ENTITY, ctx.User);
                            if (await link.Load(r.ID)) {
                                const delLink = await link.Delete();
                                if (!delLink && !cleanupError) {
                                    cleanupError = new Error(`PA6 cleanup failed to delete task link: ${link.LatestResult?.CompleteMessage ?? ''}`);
                                }
                            }
                        }
                    }
                    const actRows = await rv.RunView<{ ID: string }>({
                        EntityName: TASK_ACTIVITY_ENTITY,
                        ExtraFilter: `TaskID = '${taskId}'`,
                        Fields: ['ID'],
                        ResultType: 'simple',
                    }, ctx.User);
                    if (actRows.Success && actRows.Results) {
                        for (const r of actRows.Results) {
                            const act = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskActivityEntity>(TASK_ACTIVITY_ENTITY, ctx.User);
                            if (await act.Load(r.ID)) {
                                const delAct = await act.Delete();
                                if (!delAct && !cleanupError) {
                                    cleanupError = new Error(`PA6 cleanup failed to delete task activity: ${act.LatestResult?.CompleteMessage ?? ''}`);
                                }
                            }
                        }
                    }
                    const task = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, ctx.User);
                    if (await task.Load(taskId)) {
                        const delTask = await task.Delete();
                        if (!delTask && !cleanupError) {
                            cleanupError = new Error(`PA6 cleanup failed to delete task: ${task.LatestResult?.CompleteMessage ?? ''}`);
                        }
                    }
                } catch (ce) {
                    cleanupError = ce;
                } finally {
                    try {
                        discoverySpace.AllowParentAssignees = true;
                        const saved = await discoverySpace.Save();
                        if (!saved && !cleanupError) {
                            cleanupError = new Error(`PA6 cleanup failed to restore Discovery space: ${discoverySpace.LatestResult?.CompleteMessage ?? ''}`);
                        }
                    } catch (de) {
                        if (!cleanupError) cleanupError = de;
                    }
                }

                if (mainError && cleanupError) {
                    throw new Error(`PA6 failed: ${mainError instanceof Error ? mainError.message : String(mainError)}\nAND cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
                }
                if (cleanupError) throw cleanupError;
                if (mainError) throw mainError;
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('parent-assignees', {
    Setup: async () => {},
    Teardown: async (ctx: IntegrationCheckContext) => {
        const adaCtx = await getPersonaContext(ctx, 'ada');
        const space = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
        if (!(await space.Load(DISCOVERY_SPACE_ID))) {
            throw new Error('parent-assignees Teardown failed to load Discovery space');
        }
        if (!space.AllowParentAssignees) {
            space.AllowParentAssignees = true;
            const saved = await space.Save();
            if (!saved) {
                const err = space.LatestResult?.CompleteMessage ?? 'Save returned false';
                throw new Error(`parent-assignees Teardown failed to restore AllowParentAssignees on Discovery: ${err}`);
            }
        }
        const fnSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
        if (!(await fnSpace.Load(FIELD_NOTES_SPACE_ID))) {
            throw new Error('parent-assignees Teardown failed to load Field notes space');
        }
        if (!fnSpace.AllowParentAssignees) {
            fnSpace.AllowParentAssignees = true;
            const saved = await fnSpace.Save();
            if (!saved) {
                const err = fnSpace.LatestResult?.CompleteMessage ?? 'Save returned false';
                throw new Error(`parent-assignees Teardown failed to restore AllowParentAssignees on Field notes: ${err}`);
            }
        }
    },
});
