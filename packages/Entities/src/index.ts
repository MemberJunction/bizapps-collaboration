export * from './generated/entity_subclasses.js';
import './space-permission-provider.js';
// The permission provider is exported by name as well: a host's class-registration manifest imports every registered class
export { CollaborationSpacePermissionProvider, LoadCollaborationPermissionProvider } from './space-permission-provider.js';
export * from './client.js';
import './space-subtype-resolver.js';
export { LoadSpaceSubtypeResolver, SpaceSubtypeDirectory, SpaceSubtypeResolver } from './space-subtype-resolver.js';
export * from './detail-fields.js';
