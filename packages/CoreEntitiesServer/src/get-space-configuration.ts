/**
 * `GetSpaceConfiguration(spaceId)` (B16): a space's effective configuration, cut to the caller. A member gets the grants in force
 * for their band with each grant's bindings removed; staff holding the settings authorizations get the whole document, for the
 * Settings screen. Someone who does not reach the space gets a refusal, and no document.
 */
import { type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { CutConfigurationForViewer, type EffectiveSpaceConfiguration, membershipReaches } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { loadReach } from './space-reach.js';
import { loadSpaceConfiguration } from './space-configuration.js';
import { parseUuid } from './uuid.js';

/** Flat, since a caller compiled without strictNullChecks cannot narrow a discriminated union. `configuration` is set when `ok`. */
export interface GetSpaceConfigurationOutcome {
    ok: boolean;
    message?: string;
    configuration?: EffectiveSpaceConfiguration;
    canSeeTeam: boolean;
    full: boolean;
}

export async function getSpaceConfigurationForUser(provider: IMetadataProvider, user: UserInfo, spaceId: string): Promise<GetSpaceConfigurationOutcome> {
    const space = parseUuid(spaceId);
    const caller = parseUuid(user?.ID);
    if (!space || !caller) return { ok: false, message: 'Configuration refused: the space id is not valid.', canSeeTeam: false, full: false };

    const engine = CollaborationEngine.Instance;
    const administers = engine.UserMayAdministerSpaces(user, provider);
    const reach = await loadReach(provider, user, space);
    const seat = membershipReaches(reach.spaces, reach.memberships, caller, space);
    if (!seat && !administers) return { ok: false, message: 'Configuration refused: you do not reach this space.', canSeeTeam: false, full: false };

    const full = administers || (await engine.UserCanConfigureSpaces(user, space, provider));
    const canSeeTeam = administers || !!seat?.role.canSeeTeamBand;
    try {
        const { configuration } = await loadSpaceConfiguration(provider, space);
        return { ok: true, configuration: CutConfigurationForViewer(configuration, { canSeeTeam, full }), canSeeTeam, full };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Configuration refused.', canSeeTeam, full };
    }
}
