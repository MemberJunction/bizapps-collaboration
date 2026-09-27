import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outputFile = resolve(repoRoot, 'metadata/entity-permissions/.core-entity-permissions.json');

/**
 * Explicit core entities that Space Participant screens and active engines load at boot.
 * Rather than a blanket grant on all 370 core entities, Space Participant only receives
 * the Shell Empty (1 = 0) read grant on these specific entities.
 *
 * Entities with bespoke RLS filters (Users, User Roles, User Applications, User Settings,
 * Application Roles, Conversations, Conversation Details, Files, Workspaces, Workspace Items,
 * User Favorites, User Record Logs, User Notification Preferences, User Notifications) live in .entity-permissions.json.
 */
export const CORE_ENTITIES_FOR_PARTICIPANT = [
  // UserInfoEngine
  'MJ: User Notification Types',

  // ApplicationSettingEngine & Applications
  'MJ: Applications',
  'MJ: Application Settings',

  // Conversations & Artifacts
  'MJ: Artifact Types',

  // ResourceTypeEngine & Permissions
  'MJ: Resource Types',
  'MJ: Resource Permissions',

  // Views & Display Components
  'MJ: User Views',
  'MJ: View Types',
  'MJ: Entity Relationship Display Components',

  // DashboardEngine (registered for startup)
  'MJ: Dashboards',
  'MJ: Dashboard Part Types',
  'MJ: Dashboard User Preferences',
  'MJ: Dashboard User States',
  'MJ: Dashboard Categories',
  'MJ: Dashboard Permissions',
  'MJ: Dashboard Category Permissions',
  'MJ: Dashboard Category Links',
];

// Deterministic UUID generation from entity name
function nameToUuid(name) {
  const hash = createHash('md5').update('MJ_CORE_PERM:' + name).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32)
  ].join('-').toUpperCase();
}

console.log(`Generating Space Participant read grants for ${CORE_ENTITIES_FOR_PARTICIPANT.length} core entities...`);

const records = CORE_ENTITIES_FOR_PARTICIPANT.map(name => ({
  primaryKey: {
    ID: nameToUuid(name)
  },
  fields: {
    EntityID: `@lookup:MJ: Entities.Name=${name}`,
    RoleID: '@lookup:MJ: Roles.Name=Space Participant',
    Type: 'Allow',
    CanCreate: 0,
    CanRead: 1,
    CanUpdate: 0,
    CanDelete: 0,
    ReadRLSFilterID: '@lookup:MJ: Row Level Security Filters.Name=Collaboration: Shell Empty'
  }
}));

writeFileSync(outputFile, JSON.stringify(records, null, 2) + '\n', 'utf8');
console.log(`Wrote ${records.length} entity permissions to ${outputFile}`);
