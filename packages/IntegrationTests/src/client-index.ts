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

import './checks/collab-world.checks.js';
import './checks/people-fls.checks.js';
import './checks/parent-assignees.checks.js';
import './checks/room.checks.js';
import './checks/write-gates.checks.js';
import './checks/row-filters.checks.js';
import './checks/library.checks.js';
import './checks/agent.checks.js';

export * from './entity-names.js';
export * from './wire.js';

export function LoadCollaborationClientIntegrationTests(): void {}
