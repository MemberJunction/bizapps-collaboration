import { LoadCollaborationPermissionProvider, LoadSpaceSubtypeResolver } from '@mj-biz-apps/collaboration-entities';
import { CollaborationSectionResource } from './lib/collaboration-section.component.js';
import { CollaborationNoAccessComponent } from './lib/no-access.component.js';

export { SpaceDetailsViewComponent } from './lib/space-details-view.component.js';
export { CollabContributedTabHostDirective } from './lib/contributed-tab-host.directive.js';
export {
    CollabSpaceWorkWorkspaceComponent,
    type SpaceWorkBandFilter,
    type SpaceWorkBandMap,
    type SpaceWorkBandOption,
    type SpaceWorkQuickAddEvent,
} from './lib/space-work-workspace.component.js';
export { CollaborationSectionResource, CollaborationNoAccessComponent };
import { GeneratedFormsModule } from './lib/generated/generated-forms.module';
// The generated forms: exported so Explorer's class-registration manifest keeps them, and their @RegisterClass runs (as common-ng does)
export { GeneratedFormsModule };
export { mjBizAppsCollaborationSpaceAgentSourceReceiptFormComponent } from './lib/generated/Entities/mjBizAppsCollaborationSpaceAgentSourceReceipt/mjbizappscollaborationspaceagentsourcereceipt.form.component';
export { mjBizAppsCollaborationSpaceNoticeEventFormComponent } from './lib/generated/Entities/mjBizAppsCollaborationSpaceNoticeEvent/mjbizappscollaborationspacenoticeevent.form.component';
export { mjBizAppsCollaborationSpaceNoticeWatermarkFormComponent } from './lib/generated/Entities/mjBizAppsCollaborationSpaceNoticeWatermark/mjbizappscollaborationspacenoticewatermark.form.component';
export { mjBizAppsCollaborationSpaceDigestCheckpointFormComponent } from './lib/generated/Entities/mjBizAppsCollaborationSpaceDigestCheckpoint/mjbizappscollaborationspacedigestcheckpoint.form.component';

/** Startup export for MJExplorer. Referencing the classes keeps them in the bundle. */
export function LoadBizAppsCollaborationClient(): void {
    LoadCollaborationPermissionProvider();
    LoadSpaceSubtypeResolver();
    void GeneratedFormsModule;
    void CollaborationSectionResource;
    void CollaborationNoAccessComponent;
}
