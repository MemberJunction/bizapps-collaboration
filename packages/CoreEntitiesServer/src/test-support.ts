import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { CollaborationEngine } from './CollaborationEngine.js';

/** The roles that hold 'Administer Spaces' by default (the metadata grants it to them): what a test stands in for. */
const DEFAULT_ADMINISTERS = ['UI', 'Developer', 'Integration'];

/**
 * For tests: makes the engine answer 'Administer Spaces' the way the shipped grants do, by the roles a test user carries, and
 * returns the function that puts the engine back. Production code never looks at a role's name; only this stand-in does.
 */
export function grantAdministerToDefaultRoles(): () => void {
    const engine = CollaborationEngine.Instance;
    const held = engine.UserMayAdministerSpaces.bind(engine);
    engine.UserMayAdministerSpaces = (user: UserInfo, _provider?: IMetadataProvider) =>
        !!user?.UserRoles?.some((role) => !!role.Role && DEFAULT_ADMINISTERS.includes(role.Role));
    return () => { engine.UserMayAdministerSpaces = held; };
}
