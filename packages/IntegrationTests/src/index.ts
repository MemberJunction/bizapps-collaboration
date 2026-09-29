import { LoadGeneratedEntities as LoadCommonEntities } from '@mj-biz-apps/common-entities';
import { LoadGeneratedEntities as LoadTaskEntities } from '@mj-biz-apps/tasks-entities';
import { loadModule as LoadCollabEntities, LoadCollaborationPermissionProvider } from '@mj-biz-apps/collaboration-entities';
import {
    LoadSpaceEntityServer,
    LoadSpaceMemberEntityServer,
    LoadSpaceItemEntityServer,
    LoadShareNoticeEntityServer,
    LoadItemUseEntityServer,
    LoadCollaborationTaskEntityServer,
} from '@mj-biz-apps/collaboration-core-entities-server';

LoadCommonEntities();
LoadTaskEntities();
LoadCollabEntities();
LoadCollaborationPermissionProvider();
LoadSpaceEntityServer();
LoadSpaceMemberEntityServer();
LoadSpaceItemEntityServer();
LoadShareNoticeEntityServer();
LoadItemUseEntityServer();
LoadCollaborationTaskEntityServer();

import './agents/index.js';
import './checks/collab-world.checks.js';
import './checks/people-fls.checks.js';
import './checks/parent-assignees.checks.js';
import './checks/room.checks.js';
import './checks/write-gates.checks.js';
import './checks/row-filters.checks.js';
import './checks/library.checks.js';
import './checks/agent.checks.js';
import './checks/features.checks.js';

export * from './entity-names.js';
export * from './wire.js';
export { loadWorld } from './world/load-world.js';
export { purgeWorld } from './world/purge-world.js';

export function LoadCollaborationIntegrationTests(): void {}
