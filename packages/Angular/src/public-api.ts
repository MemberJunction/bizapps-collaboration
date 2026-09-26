import { LoadCollaborationPermissionProvider } from '@mj-biz-apps/collaboration-entities';
import { CollaborationSectionResource } from './lib/collaboration-section.component.js';

export { CollaborationSectionResource };

/** Startup export for MJExplorer. Referencing the classes keeps them in the bundle. */
export function LoadBizAppsCollaborationClient(): void {
    LoadCollaborationPermissionProvider();
    void CollaborationSectionResource;
}
