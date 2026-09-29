import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';

/** The roles that hold 'Administer Spaces' by default (the metadata grants it to them). */
export const DEFAULT_ADMINISTER_ROLES: readonly string[] = ['UI', 'Developer', 'Integration'];

/**
 * For tests: makes the engine answer 'Administer Spaces' the way a host's grants would, by the roles a test user carries: it is held
 * by a user with any of the roles given. Returns the function that puts the engine back. Production code never looks at a role's
 * name, so a test can hand the grant to a role no code knows and see the same gate pass, and the shipped roles fail once they lose it.
 */
export function grantAdministerTo(roles: readonly string[]): () => void {
    const engine = CollaborationEngine.Instance;
    const held = engine.UserMayAdministerSpaces.bind(engine);
    engine.UserMayAdministerSpaces = (user: UserInfo, _provider?: IMetadataProvider) =>
        !!user?.UserRoles?.some((role) => !!role.Role && roles.includes(role.Role));
    return () => { engine.UserMayAdministerSpaces = held; };
}

/** The shipped grants: UI, Developer and Integration. */
export function grantAdministerToDefaultRoles(): () => void {
    return grantAdministerTo(DEFAULT_ADMINISTER_ROLES);
}
