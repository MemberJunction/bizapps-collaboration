import { LoadCollaborationPermissionProvider } from '@mj-biz-apps/collaboration-entities';
import { SpaceWorkspaceComponent } from './lib/space-workspace.component';
import { NoAccessComponent } from './lib/no-access.component';
import { CollaborationSectionResource } from './lib/collaboration-section.component';

export { SpaceWorkspaceComponent };
export type { WorkspaceRole, WorkspaceSpace } from './lib/space-workspace.component';
export { NoAccessComponent };
export { CollaborationSectionResource };

/** Startup export for MJExplorer. Referencing the classes keeps them in the bundle. */
export function LoadBizAppsCollaborationClient(): void {
    LoadCollaborationPermissionProvider();
    void SpaceWorkspaceComponent;
    void NoAccessComponent;
    void CollaborationSectionResource;
}
