/**
 * Server bootstrap. Imported by MJAPI's dynamic package loader.
 * The entity package registers the generated classes first. The server
 * subclasses imported below replace them, because @RegisterClass keeps
 * the higher priority.
 */
import '@mj-biz-apps/collaboration-entities';
import '@mj-biz-apps/collaboration-actions';
import {
    LoadSpaceEntityServer,
    LoadSpaceItemEntityServer,
    LoadSpaceMemberEntityServer,
} from '@mj-biz-apps/collaboration-core-entities-server';

export function LoadBizAppsCollaborationServer(): void {
    LoadSpaceEntityServer();
    LoadSpaceItemEntityServer();
    LoadSpaceMemberEntityServer();
}
