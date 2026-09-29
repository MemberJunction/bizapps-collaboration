import { LoadCollaborationPermissionProvider, LoadSpaceSubtypeResolver } from '@mj-biz-apps/collaboration-entities';
import { CollaborationSectionResource } from './lib/collaboration-section.component.js';
import { CollaborationNoAccessComponent } from './lib/no-access.component.js';

export { SpaceDetailsViewComponent } from './lib/space-details-view.component.js';
export { CollaborationSectionResource, CollaborationNoAccessComponent };

/** Startup export for MJExplorer. Referencing the classes keeps them in the bundle. */
export function LoadBizAppsCollaborationClient(): void {
    LoadCollaborationPermissionProvider();
    LoadSpaceSubtypeResolver();
    void CollaborationSectionResource;
    void CollaborationNoAccessComponent;
}
