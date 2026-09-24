/**
 * Server bootstrap. Imported by MJAPI's dynamic package loader.
 * The entity package registers the generated classes first. The server
 * subclasses imported below replace them, because @RegisterClass keeps
 * the higher priority.
 */
import '@mj-biz-apps/collaboration-entities';
import '@mj-biz-apps/collaboration-actions';
import {
    LoadItemUseEntityServer,
    LoadShareNoticeEntityServer,
    LoadSpaceEntityServer,
    LoadSpaceItemEntityServer,
    LoadSpaceMemberEntityServer,
    LoadTaskAttributionEntityServer,
} from '@mj-biz-apps/collaboration-core-entities-server';
import './generated/generated.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Passed to the host schema builder. Importing the resolvers is not enough. */
export const RESOLVER_PATHS = [
    resolve(here, 'generated/generated.{js,ts}'),
    resolve(here, 'upload-space-file.resolver.{js,ts}'),
    resolve(here, 'mint-space-link.resolver.{js,ts}'),
];

export { mintSpaceLink } from './mint-space-link.js';

export function LoadBizAppsCollaborationServer(): void {
    LoadItemUseEntityServer();
    LoadShareNoticeEntityServer();
    LoadSpaceEntityServer();
    LoadSpaceItemEntityServer();
    LoadSpaceMemberEntityServer();
    LoadTaskAttributionEntityServer();
}
