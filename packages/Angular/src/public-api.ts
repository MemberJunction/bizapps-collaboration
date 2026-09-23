export { SpaceWorkspaceComponent } from './lib/space-workspace.component';
export type { WorkspaceRole, WorkspaceSpace } from './lib/space-workspace.component';
export { NoAccessComponent } from './lib/no-access.component';

/** Startup export for MJExplorer. Referencing the classes keeps them in the bundle. */
export function LoadBizAppsCollaborationClient(): void {
    void SpaceWorkspaceComponent;
    void NoAccessComponent;
}
