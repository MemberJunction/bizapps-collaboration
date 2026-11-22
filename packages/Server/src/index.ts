/**
 * Server bootstrap. Imported by MJAPI's dynamic package loader.
 * The entity package registers the generated classes first. The server
 * subclasses imported below replace them, because @RegisterClass keeps
 * the higher priority.
 */
import { Metadata } from '@memberjunction/core';
import { LoadSpaceSubtypeResolver } from '@mj-biz-apps/collaboration-entities';
import '@mj-biz-apps/collaboration-actions';
import {
    ensurePostgresReceiptContextHook,
    ensurePostgresReceiptContextPrototypeHook,
    LoadItemUseEntityServer,
    LoadShareNoticeEntityServer,
    LoadSpaceAgentSourceReceiptEntityServer,
    LoadSpaceEntityServer,
    LoadSpaceItemEntityServer,
    LoadSpaceMemberEntityServer,
    LoadSpaceNoteEntityServer,
    LoadCollaborationTaskEntityServer,
    LoadTaskAttributionEntityServer,
    LoadSpaceMeetingsAgendaProvider,
    LoadCollaborationAIRunLockdown,
} from '@mj-biz-apps/collaboration-core-entities-server';
import './generated/generated.js';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Passed to the host schema builder. Importing the resolvers is not enough. */
export const RESOLVER_PATHS = [
    resolve(here, 'generated/generated.{js,ts}'),
    resolve(here, 'upload-space-file.resolver.{js,ts}'),
    resolve(here, 'mint-space-link.resolver.{js,ts}'),
    resolve(here, 'create-space-task.resolver.{js,ts}'),
    resolve(here, 'post-space-message.resolver.{js,ts}'),
    resolve(here, 'execute-space-chat-turn.resolver.{js,ts}'),
    resolve(here, 'space-chat-host-rules.resolver.{js,ts}'),
    resolve(here, 'close-consequence.resolver.{js,ts}'),
    resolve(here, 'home-counts.resolver.{js,ts}'),
    resolve(here, 'home-lists.resolver.{js,ts}'),
    resolve(here, 'create-space-conversation.resolver.{js,ts}'),
    resolve(here, 'create-space.resolver.{js,ts}'),
    resolve(here, 'get-space-configuration.resolver.{js,ts}'),
    resolve(here, 'ensure-space-for-record.resolver.{js,ts}'),
    resolve(here, 'grant-operations.resolver.{js,ts}'),
    resolve(here, 'create-space-meeting.resolver.{js,ts}'),
    resolve(here, 'ensure-meeting-space-chat.resolver.{js,ts}'),
];

export { mintSpaceLink } from './mint-space-link.js';

function installPostgresProviderPrototypeHookFromServer(): void {
    try {
        const localRequire = createRequire(import.meta.url);
        const mjServerEntry = localRequire.resolve('@memberjunction/server');
        const mjServerRequire = createRequire(mjServerEntry);
        const pgMod = mjServerRequire('@memberjunction/postgresql-dataprovider') as {
            PostgreSQLDataProvider?: { prototype?: object };
        };
        if (pgMod?.PostgreSQLDataProvider?.prototype) {
            ensurePostgresReceiptContextPrototypeHook(pgMod.PostgreSQLDataProvider.prototype);
        }
    } catch {
        // Optional when @memberjunction/postgresql-dataprovider is absent in SQL Server-only hosts
    }
}

export function LoadBizAppsCollaborationServer(): void {
    LoadSpaceSubtypeResolver();
    LoadItemUseEntityServer();
    LoadShareNoticeEntityServer();
    LoadSpaceAgentSourceReceiptEntityServer();
    LoadSpaceEntityServer();
    LoadSpaceItemEntityServer();
    LoadSpaceMemberEntityServer();
    LoadSpaceNoteEntityServer();
    LoadTaskAttributionEntityServer();
    LoadCollaborationTaskEntityServer();
    LoadSpaceMeetingsAgendaProvider();
    LoadCollaborationAIRunLockdown();
    installPostgresProviderPrototypeHookFromServer();
    try {
        ensurePostgresReceiptContextHook(Metadata.Provider);
    } catch {
        // Metadata.Provider may not be configured yet when LoadBizAppsCollaborationServer runs during early test setup
    }
}
