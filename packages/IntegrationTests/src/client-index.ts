/**
 * Client-safe entry. Do NOT import the main barrel — it loads *Server classes.
 */
import { LoadGeneratedEntities as LoadCommonEntities } from '@mj-biz-apps/common-entities';
import { LoadGeneratedEntities as LoadTaskEntities } from '@mj-biz-apps/tasks-entities';
import { loadModule as LoadCollabEntities, LoadCollaborationPermissionProvider } from '@mj-biz-apps/collaboration-entities';

LoadCommonEntities();
LoadTaskEntities();
LoadCollabEntities();
LoadCollaborationPermissionProvider();

import './checks/client/collab-world.client.checks.js';
import './checks/client/people-fls.client.checks.js';
import './checks/client/parent-assignees.client.checks.js';
import './checks/client/room.client.checks.js';
import './checks/client/write-gates.client.checks.js';
import './checks/client/row-filters.client.checks.js';
import './checks/client/library.client.checks.js';
import './checks/client/agent.client.checks.js';

export * from './entity-names.js';
export * from './wire.js';

export function LoadCollaborationClientIntegrationTests(): void {}
