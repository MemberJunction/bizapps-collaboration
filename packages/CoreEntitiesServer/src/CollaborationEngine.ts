/**
 * CollaborationEngine — server-side engine for BizApps Collaboration.
 *
 * Modeled on AIEngine (packages/AI/Engine). Uses composition (BaseSingleton)
 * holding CollaborationEngineBase.Instance as Base and delegating to it.
 *
 * Adds server-only capabilities:
 * - Settings rights authorization checks (Configure Space Types, Configure Spaces)
 * - Storage account resolution and active account fallback validation
 * - The statuses a type declares and the grants the app and the types offer (delegated to the engine bases)
 * - Drivers and lifecycle reactions
 */

import {
    type IMetadataProvider,
    LogError,
    Metadata,
    RunView,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { BaseSingleton, UUIDsEqual } from '@memberjunction/global';
import {
    type CollaborationSettings,
    type GrantKind,
    type ResolvedCollaborationSettings,
    type SpaceStatusReach,
} from '@mj-biz-apps/collaboration-core';
import {
    CollaborationAdminEngineBase,
    CollaborationEngineBase,
    COLLABORATION_APP_ID,
    COLLABORATION_SETTINGS_NAME,
} from '@mj-biz-apps/collaboration-engine-base';
import type {
    mjBizAppsCollaborationSpaceGrantEntity,
    mjBizAppsCollaborationSpaceRoleTypeEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
    mjBizAppsCollaborationSpaceTypeStatusEntity,
} from '@mj-biz-apps/collaboration-entities';
import { FileStorageEngineBase } from '@memberjunction/core-entities';
import type {
    MJApplicationSettingEntity,
    MJAuthorizationEntity,
    MJAuthorizationRoleEntity,
} from '@memberjunction/core-entities';

export class CollaborationEngine extends BaseSingleton<CollaborationEngine> {
    protected constructor() {
        super();
    }

    public static get Instance(): CollaborationEngine {
        return super.getInstance<CollaborationEngine>();
    }

    /** Access to the underlying CollaborationEngineBase instance */
    protected get Base(): CollaborationEngineBase {
        return CollaborationEngineBase.Instance;
    }

    /** The staff-only metadata (the authorization catalog, the app- and type-level grants). */
    protected get Admin(): CollaborationAdminEngineBase {
        return CollaborationAdminEngineBase.Instance;
    }

    // ─── Delegated properties and methods from CollaborationEngineBase ─────────

    public get Loaded(): boolean {
        return this.Base.Loaded && this.Admin.Loaded;
    }

    public async EnsureLoaded(contextUser?: UserInfo, provider?: IMetadataProvider): Promise<void> {
        if (!this.Loaded) {
            await this.Config(false, contextUser, provider);
        }
    }

    public get SpaceTypes(): mjBizAppsCollaborationSpaceTypeEntity[] {
        return this.Base.SpaceTypes;
    }

    public get SpaceRoleTypes(): mjBizAppsCollaborationSpaceRoleTypeEntity[] {
        return this.Base.SpaceRoleTypes;
    }

    public get ApplicationSettings(): MJApplicationSettingEntity[] {
        return this.Base.ApplicationSettings;
    }

    public get Authorizations(): MJAuthorizationEntity[] {
        return this.Admin.Authorizations;
    }

    public get AuthorizationRoles(): MJAuthorizationRoleEntity[] {
        return this.Admin.AuthorizationRoles;
    }

    public get SpaceTypeStatuses(): mjBizAppsCollaborationSpaceTypeStatusEntity[] {
        return this.Base.SpaceTypeStatuses;
    }

    public get AppAndTypeSpaceGrants(): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.Admin.AppAndTypeSpaceGrants;
    }

    public get AppSpaceGrants(): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.Admin.AppSpaceGrants;
    }

    public SpaceTypeById(id: string | null | undefined): mjBizAppsCollaborationSpaceTypeEntity | undefined {
        return this.Base.SpaceTypeById(id);
    }

    public SpaceTypeByCode(code: string | null | undefined): mjBizAppsCollaborationSpaceTypeEntity | undefined {
        return this.Base.SpaceTypeByCode(code);
    }

    public SpaceRoleTypeById(id: string | null | undefined): mjBizAppsCollaborationSpaceRoleTypeEntity | undefined {
        return this.Base.SpaceRoleTypeById(id);
    }

    public SpaceRoleTypeByCode(code: string | null | undefined): mjBizAppsCollaborationSpaceRoleTypeEntity | undefined {
        return this.Base.SpaceRoleTypeByCode(code);
    }

    public GetApplicationSetting(name: string): string | undefined {
        return this.Base.GetApplicationSetting(name);
    }

    public get CollaborationSettings(): CollaborationSettings {
        return this.Base.CollaborationSettings;
    }

    public SpaceGrantsForType(typeId: string): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.Admin.SpaceGrantsForType(typeId);
    }

    public AppGrantsOfKind(kind: GrantKind): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.Admin.AppGrantsOfKind(kind);
    }

    public TypeGrantsOfKind(typeId: string, kind: GrantKind): mjBizAppsCollaborationSpaceGrantEntity[] {
        return this.Admin.TypeGrantsOfKind(typeId, kind);
    }

    // ─── Statuses (delegated) ──────────────────────────────────────────────────

    public StatusById(id: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        return this.Base.StatusById(id);
    }

    public StatusesForType(typeId: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity[] {
        return this.Base.StatusesForType(typeId);
    }

    public StatusByCode(typeId: string | null | undefined, code: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        return this.Base.StatusByCode(typeId, code);
    }

    public DefaultStatusForType(typeId: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        return this.Base.DefaultStatusForType(typeId);
    }

    public FirstTerminalStatusForType(typeId: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        return this.Base.FirstTerminalStatusForType(typeId);
    }

    public EffectiveStatusForSpace(space: { StatusID?: string | null; SpaceTypeID?: string | null; ClosedAt?: string | Date | null }): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        return this.Base.EffectiveStatusForSpace(space);
    }

    public StatusReachForSpace(space: { StatusID?: string | null; SpaceTypeID?: string | null; ClosedAt?: string | Date | null }): SpaceStatusReach | null {
        return this.Base.StatusReachForSpace(space);
    }

    public AuthorizationByName(name: string): MJAuthorizationEntity | undefined {
        return this.Admin.AuthorizationByName(name);
    }

    /** Configures both engines. A user who can't read the admin engine's rows gets it empty and constrained, and the base engine still. */
    public async Config(
        forceRefresh?: boolean,
        contextUser?: UserInfo,
        provider?: IMetadataProvider
    ): Promise<void> {
        await this.Base.Config(forceRefresh, contextUser, provider);
        await this.Admin.Config(forceRefresh, contextUser, provider);
    }

    // ─── Server-Only: Authorization Rights ─────────────────────────────────────


    /**
     * Checks if a user has the "Configure Space Types" authorization under the "Collaboration" root.
     */
    public UserCanConfigureSpaceTypes(user: UserInfo, provider?: IMetadataProvider): boolean {
        return this.Base.UserCanConfigureSpaceTypes(user, provider);
    }

    /**
     * Checks if a user has the "Configure Spaces" authorization under the "Collaboration" root AND
     * holds a role with IsOwnerRole on the specified space (or reaching it via inheritance).
     * If spaceId is null/undefined (e.g. creating new space), authorization alone suffices.
     */
    public async UserCanConfigureSpaces(
        user: UserInfo,
        spaceId?: string | null,
        provider?: IMetadataProvider
    ): Promise<boolean> {
        return this.Base.UserCanConfigureSpaces(user, spaceId, provider);
    }

    /** Whether a user holds the 'Administer Spaces' authorization (see the base engine). */
    public UserMayAdministerSpaces(user: UserInfo, provider?: IMetadataProvider): boolean {
        return this.Base.UserMayAdministerSpaces(user, provider);
    }

    /** Whether a user may change a space's status: the lifecycle authorization and an owner seat, found with the status filter off. */
    public async UserCanChangeSpaceStatus(user: UserInfo, spaceId: string, provider?: IMetadataProvider): Promise<boolean> {
        return this.Base.UserCanChangeSpaceStatus(user, spaceId, provider);
    }

    /** Whether a user may close an open space: the lifecycle authorization and an owner seat (with the status filter applied). */
    public async UserCanCloseSpace(user: UserInfo, spaceId: string, provider?: IMetadataProvider): Promise<boolean> {
        return this.Base.UserCanCloseSpace(user, spaceId, provider);
    }

    /** Whether a user may reopen a space: the lifecycle authorization and an owner seat, found with the status filter off. */
    public async UserCanReopenSpace(user: UserInfo, spaceId: string, provider?: IMetadataProvider): Promise<boolean> {
        return this.Base.UserCanReopenSpace(user, spaceId, provider);
    }

    /** Whether a user holds the 'Close and Reopen Spaces' authorization. The owner seat is checked apart, by the space write rules. */
    public UserHoldsLifecycleAuthorization(user: UserInfo, provider?: IMetadataProvider): boolean {
        return this.Base.UserHoldsLifecycleAuthorization(user, provider);
    }

    /**
     * Validates whether a storage account exists in FileStorageEngineBase and is active.
     */
    public ValidateStorageAccountActive(storageAccountId: string): { valid: boolean; error?: string } {
        const activeAccounts = FileStorageEngineBase.Instance.AccountsWithProviders.filter(
            a => a.provider.IsActive
        );
        const account = activeAccounts.find(a =>
            UUIDsEqual(a.account.ID, storageAccountId)
        );
        if (!account) {
            return {
                valid: false,
                error: `Configured storage account '${storageAccountId}' does not exist or is not active.`
            };
        }
        return { valid: true };
    }
}
