/**
 * CA-4 Server Resolution: Per-Root Delivery Principal.
 *
 * Resolves the configured delivery principal across App -> SpaceType -> RootSpace -> SubSpace
 * with strict non-loosening validation, hydrates the principal's `UserInfo` + roles from
 * `MJ: Users` / `MJ: User Roles`, and fails closed if missing or inactive (never silently
 * falling back to the approving user's personal identity).
 */
import {
    type IMetadataProvider,
    RunView,
    UserInfo,
    UserRoleInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import {
    type CollaborationSettings,
    type DeliveryPrincipalLevelInput,
    resolveNonLooseningDeliveryPrincipal,
} from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { loadSpaceConfiguration, type LoadedSpaceConfiguration } from './space-configuration.js';
import { parseUuid } from './uuid.js';

const ANCHORS = 'MJ_BizApps_Collaboration: Space Anchors';
const USERS = 'MJ: Users';
const USER_ROLES = 'MJ: User Roles';

export interface ResolvedPerRootDeliveryPrincipal {
    ok: true;
    principalUserId: string;
    principalUser: UserInfo;
    sourceLevel: 'App' | 'SpaceType' | 'RootSpace' | 'SubSpace';
    rootSpaceId: string;
    rootEntityId: string | null;
    rootRecordId: string | null;
}

export interface PerRootDeliveryPrincipalFailure {
    ok: false;
    message: string;
}

export type PerRootDeliveryPrincipalOutcome =
    | ResolvedPerRootDeliveryPrincipal
    | PerRootDeliveryPrincipalFailure;

interface RawUserRow {
    ID: string;
    Name: string | null;
    Email: string | null;
    Type: 'Owner' | 'User' | null;
    IsActive: boolean | null;
}

interface RawUserRoleRow {
    ID: string;
    UserID: string;
    RoleID: string;
    Role: string | null;
}

interface PrimaryAnchorRow {
    EntityID: string;
    RecordID: string;
}

function parseOptionalSettings(raw: string | null | undefined): CollaborationSettings | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CollaborationSettings;
    } catch {
        return null;
    }
}

function stripCompositeKeyPrefix(recordId: string): string {
    const trimmed = recordId.trim();
    const pipeIdx = trimmed.indexOf('|');
    if (pipeIdx > 0 && !trimmed.includes('||')) {
        return trimmed.slice(pipeIdx + 1).trim();
    }
    return trimmed;
}

/**
 * Resolves the active per-root delivery principal for `spaceId` without ever falling back to
 * the approving caller's personal identity.
 */
export async function resolvePerRootDeliveryPrincipal(params: {
    provider: IMetadataProvider;
    systemUser?: UserInfo;
    spaceId: string;
    loadedConfiguration?: LoadedSpaceConfiguration;
}): Promise<PerRootDeliveryPrincipalOutcome> {
    const cleanSpaceId = parseUuid(params.spaceId);
    if (!cleanSpaceId) {
        return { ok: false, message: 'Per-root delivery principal refused: invalid SpaceID.' };
    }

    const system = params.systemUser ?? (await WellKnownUserSource.Instance.GetSystemUser(params.provider));
    if (!system) {
        return { ok: false, message: 'Per-root delivery principal refused: system user is unavailable.' };
    }

    let loaded = params.loadedConfiguration;
    if (!loaded) {
        try {
            loaded = await loadSpaceConfiguration(params.provider, cleanSpaceId, { reader: system });
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : 'Space configuration could not be loaded.',
            };
        }
    }

    const chain = loaded.chain;
    if (chain.length === 0) {
        return { ok: false, message: `Space ${cleanSpaceId} was not found in configuration chain.` };
    }
    const leafRow = chain[0];
    const rootRow = chain[chain.length - 1];
    const rootSpaceId = parseUuid(rootRow.ID) ?? cleanSpaceId;

    await CollaborationEngine.Instance.EnsureLoaded(system, params.provider);
    const appSettings = CollaborationEngine.Instance.CollaborationSettings;
    const typeSettings = loaded.typeSettings;
    const overridable = new Set(typeSettings?.SpaceOverridable ?? []);
    const allowSubSpaceOverride = overridable.has('DeliveryPrincipal') || overridable.has('DeliveryPrincipal.UserID');

    const rootSettings = parseOptionalSettings(rootRow.Configuration);
    const leafSettings = leafRow.ID.toLowerCase() !== rootRow.ID.toLowerCase()
        ? parseOptionalSettings(leafRow.Configuration)
        : null;

    const levels: DeliveryPrincipalLevelInput[] = [
        { level: 'App', config: appSettings.DeliveryPrincipal ?? null },
        { level: 'SpaceType', config: typeSettings?.DeliveryPrincipal ?? null },
        { level: 'RootSpace', config: rootSettings?.DeliveryPrincipal ?? null },
        ...(leafSettings
            ? [{ level: 'SubSpace' as const, config: leafSettings.DeliveryPrincipal ?? null, allowOverride: allowSubSpaceOverride }]
            : []),
    ];

    const verdict = resolveNonLooseningDeliveryPrincipal(levels);
    if (!verdict.ok) {
        return { ok: false, message: verdict.message };
    }

    const principalId = parseUuid(verdict.principalUserId);
    if (!principalId) {
        return { ok: false, message: 'Resolved delivery principal UserID is not a valid UUID.' };
    }

    const rv = RunView.FromMetadataProvider(params.provider);

    // Load primary anchor for the root space (for RootEntityID / RootRecordID context)
    const [anchorRes, userRes, roleRes] = await Promise.all([
        rv.RunView<PrimaryAnchorRow>(
            {
                EntityName: ANCHORS,
                ExtraFilter: `SpaceID = '${rootSpaceId}' AND IsPrimary = 1`,
                Fields: ['EntityID', 'RecordID'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            system,
        ),
        rv.RunView<RawUserRow>(
            {
                EntityName: USERS,
                ExtraFilter: `ID = '${principalId}'`,
                Fields: ['ID', 'Name', 'Email', 'Type', 'IsActive'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            system,
        ),
        rv.RunView<RawUserRoleRow>(
            {
                EntityName: USER_ROLES,
                ExtraFilter: `UserID = '${principalId}'`,
                Fields: ['ID', 'UserID', 'RoleID', 'Role'],
                ResultType: 'simple',
                MaxRows: 200, // row-cap-ok: single principal user holds far fewer than 200 role assignments
            },
            system,
        ),
    ]);

    if (!userRes.Success || !userRes.Results?.[0]) {
        return {
            ok: false,
            message: `Configured per-root delivery principal user '${principalId}' does not exist or could not be loaded.`,
        };
    }

    const userRow = userRes.Results[0];
    if (userRow.IsActive === false) {
        return {
            ok: false,
            message: `Configured per-root delivery principal user '${principalId}' is inactive.`,
        };
    }

    const roles = (roleRes.Success ? (roleRes.Results ?? []) : []).map(
        (r) =>
            new UserRoleInfo({
                ID: r.ID,
                UserID: r.UserID,
                RoleID: r.RoleID,
                Role: r.Role ?? undefined,
            }),
    );

    const principalUser = new UserInfo(params.provider, {
        ID: userRow.ID,
        Name: userRow.Name ?? undefined,
        Email: userRow.Email ?? undefined,
        Type: userRow.Type ?? 'User',
        IsActive: userRow.IsActive ?? true,
        UserRoles: roles,
    });

    const primaryAnchor = anchorRes.Success ? anchorRes.Results?.[0] : undefined;

    return {
        ok: true,
        principalUserId: userRow.ID,
        principalUser,
        sourceLevel: verdict.sourceLevel,
        rootSpaceId,
        rootEntityId: primaryAnchor ? parseUuid(primaryAnchor.EntityID) : null,
        rootRecordId: primaryAnchor?.RecordID ? stripCompositeKeyPrefix(primaryAnchor.RecordID) : null,
    };
}
