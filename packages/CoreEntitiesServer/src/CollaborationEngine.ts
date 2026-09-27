/**
 * CollaborationEngine — server-side engine for BizApps Collaboration.
 *
 * Modeled on AIEngine (packages/AI/Engine). Uses composition (BaseSingleton)
 * holding CollaborationEngineBase.Instance as Base and delegating to it.
 *
 * Adds server-only capabilities:
 * - Settings rights authorization checks (Configure Space Types, Configure Spaces)
 * - Storage account resolution and active account fallback validation
 * - Space settings validation and stamping on close
 * - Drivers and lifecycle reactions
 */

import {
    AuthorizationEvaluator,
    type AuthorizationInfo,
    type BaseEntity,
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
    DEFAULT_COLLABORATION_SETTINGS,
    type ResolvedCollaborationSettings,
    ValidateCollaborationSettings,
} from '@mj-biz-apps/collaboration-core';
import {
    CollaborationEngineBase,
    COLLABORATION_APP_ID,
    COLLABORATION_SETTINGS_NAME,
} from '@mj-biz-apps/collaboration-engine-base';
import type {
    mjBizAppsCollaborationSpaceAgentEntity,
    mjBizAppsCollaborationSpaceAgentSkillEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceKnowledgeSourceEntity,
    mjBizAppsCollaborationSpaceRoleTypeEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
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

    // ─── Delegated properties and methods from CollaborationEngineBase ─────────

    public get Loaded(): boolean {
        return this.Base.Loaded;
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

    public get TaskTypes(): BaseEntity[] {
        return this.Base.TaskTypes;
    }

    public get ApplicationSettings(): MJApplicationSettingEntity[] {
        return this.Base.ApplicationSettings;
    }

    public get Authorizations(): MJAuthorizationEntity[] {
        return this.Base.Authorizations;
    }

    public get AuthorizationRoles(): MJAuthorizationRoleEntity[] {
        return this.Base.AuthorizationRoles;
    }

    public get AppAndTypeSpaceAgents(): mjBizAppsCollaborationSpaceAgentEntity[] {
        return this.Base.AppAndTypeSpaceAgents;
    }

    public get AppAndTypeSpaceAgentSkills(): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        return this.Base.AppAndTypeSpaceAgentSkills;
    }

    public get AppAndTypeSpaceKnowledgeSources(): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        return this.Base.AppAndTypeSpaceKnowledgeSources;
    }

    public get AppSpaceAgents(): mjBizAppsCollaborationSpaceAgentEntity[] {
        return this.Base.AppSpaceAgents;
    }

    public get AppSpaceAgentSkills(): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        return this.Base.AppSpaceAgentSkills;
    }

    public get AppSpaceKnowledgeSources(): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        return this.Base.AppSpaceKnowledgeSources;
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

    /**
     * Testing hook: populates in-memory space role types without running a full database config (D19).
     */
    public SetSpaceRoleTypesForTesting(roleTypes: mjBizAppsCollaborationSpaceRoleTypeEntity[]): void {
        this.Base.SetSpaceRoleTypesForTesting(roleTypes);
    }

    public GetApplicationSetting(name: string): string | undefined {
        return this.Base.GetApplicationSetting(name);
    }

    public get CollaborationSettings(): CollaborationSettings {
        return this.Base.CollaborationSettings;
    }

    public ResolveSettingsForSpace(
        spaceConfigs: Array<CollaborationSettings | null | undefined>,
        spaceTypeId?: string | null
    ): ResolvedCollaborationSettings {
        return this.Base.ResolveSettingsForSpace(spaceConfigs, spaceTypeId);
    }

    public SpaceAgentsForType(typeId: string): mjBizAppsCollaborationSpaceAgentEntity[] {
        return this.Base.SpaceAgentsForType(typeId);
    }

    public SpaceAgentSkillsForType(typeId: string): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        return this.Base.SpaceAgentSkillsForType(typeId);
    }

    public SpaceKnowledgeSourcesForType(typeId: string): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        return this.Base.SpaceKnowledgeSourcesForType(typeId);
    }

    public AuthorizationByName(name: string): MJAuthorizationEntity | undefined {
        return this.Base.AuthorizationByName(name);
    }

    public async Config(
        forceRefresh?: boolean,
        contextUser?: UserInfo,
        provider?: IMetadataProvider
    ): Promise<void> {
        return await this.Base.Config(forceRefresh, contextUser, provider);
    }

    // ─── Server-Only: Authorization Rights ─────────────────────────────────────

    /**
     * Looks up an authorization specifically under the "Collaboration" root authorization.
     * In MemberJunction, Authorizations are shared across apps, so sub-authorizations
     * must be resolved via ParentID under the "Collaboration" root authorization.
     */
    public FindCollaborationAuthorization(subAuthName: string, provider?: IMetadataProvider): AuthorizationInfo | null {
        const md = provider ?? Metadata.Provider;
        const auths = md.Authorizations ?? [];
        const root = auths.find(a => (a.Name ?? '').trim().toLowerCase() === 'collaboration' && !a.ParentID);
        if (root) {
            const child = auths.find(a =>
                (a.Name ?? '').trim().toLowerCase() === subAuthName.trim().toLowerCase() &&
                UUIDsEqual(a.ParentID, root.ID)
            );
            if (child) {
                return child;
            }
        }
        return null;
    }

    /**
     * Checks if a user has the "Configure Space Types" authorization under the "Collaboration" root.
     * Evaluates via AuthorizationEvaluator.UserCanExecuteWithAncestors.
     */
    public UserCanConfigureSpaceTypes(user: UserInfo, provider?: IMetadataProvider): boolean {
        const md = provider ?? Metadata.Provider;
        const auth = this.FindCollaborationAuthorization('Configure Space Types', md);
        if (!auth) {
            const hasDeveloperRole = user.UserRoles?.some(r => r.Role?.trim().toLowerCase() === 'developer');
            return !!hasDeveloperRole;
        }
        return new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, md.Authorizations ?? []);
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
        const md = provider ?? Metadata.Provider;
        const auth = this.FindCollaborationAuthorization('Configure Spaces', md);
        if (auth && !new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, md.Authorizations ?? [])) {
            return false;
        } else if (!auth) {
            const hasDeveloperRole = user.UserRoles?.some(r => r.Role?.trim().toLowerCase() === 'developer');
            if (!hasDeveloperRole) return false;
        }

        if (!spaceId) {
            return true;
        }

        // Check if user holds an owner role that reaches this space
        try {
            const memberEntity = md.EntityByName('MJ_BizApps_Collaboration: Space Members');
            if (!memberEntity) return false;

            const rv = RunView.FromMetadataProvider(md);
            let currentSpaceId: string | null = spaceId;
            const seen = new Set<string>();

            while (currentSpaceId && !seen.has(currentSpaceId.toLowerCase())) {
                seen.add(currentSpaceId.toLowerCase());
                const memberRes = await rv.RunView<{ SpaceRoleTypeID: string }>({
                    EntityName: 'MJ_BizApps_Collaboration: Space Members',
                    ExtraFilter: `SpaceID = '${currentSpaceId}' AND UserID = '${user.ID}' AND Status = 'Active'`,
                    Fields: ['SpaceRoleTypeID'],
                    ResultType: 'simple',
                    MaxRows: 1,
                }, user);

                if (memberRes.Success && memberRes.Results?.[0]?.SpaceRoleTypeID) {
                    const roleType = this.SpaceRoleTypeById(memberRes.Results[0].SpaceRoleTypeID);
                    return !!roleType?.IsOwnerRole;
                }

                const spaceRes: RunViewResult<{ ParentID: string | null; InheritsMembership: boolean }> = await rv.RunView<{ ParentID: string | null; InheritsMembership: boolean }>({
                    EntityName: 'MJ_BizApps_Collaboration: Spaces',
                    ExtraFilter: `ID = '${currentSpaceId}'`,
                    Fields: ['ParentID', 'InheritsMembership'],
                    ResultType: 'simple',
                    MaxRows: 1,
                }, user);

                if (!spaceRes.Success || !spaceRes.Results?.[0] || !spaceRes.Results[0].InheritsMembership || !spaceRes.Results[0].ParentID) {
                    break;
                }
                currentSpaceId = spaceRes.Results[0].ParentID;
            }
            return false;
        } catch (e) {
            LogError(`Error verifying space owner role for user ${user.ID} on space ${spaceId}: ${e instanceof Error ? e.message : String(e)}`);
            return false;
        }
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

    // ─── Server-Only: Storage Resolution ───────────────────────────────────────

    /**
     * Resolves the storage account for file uploads in a space (Punch list 2 item 6).
     *
     * Walks sub-space -> parent spaces -> space type -> app settings.
     * With none configured, falls back to the host's single active storage account.
     * With multiple active accounts and none configured, throws an actionable error.
     */
    public async ResolveStorageAccount(params: {
        spaceId?: string;
        spaceConfigs?: Array<CollaborationSettings | null | undefined>;
        spaceTypeId?: string | null;
        contextUser?: UserInfo;
        provider?: IMetadataProvider;
    }): Promise<string | null> {
        let resolvedSettings: ResolvedCollaborationSettings;
        if (params.spaceConfigs) {
            resolvedSettings = this.ResolveSettingsForSpace(params.spaceConfigs, params.spaceTypeId);
        } else if (params.spaceId) {
            // Build space config chain
            const md = params.provider ?? Metadata.Provider;
            const spaceChain = await this.LoadSpaceSettingsChain(params.spaceId, md, params.contextUser);
            resolvedSettings = this.ResolveSettingsForSpace(
                spaceChain.configs,
                spaceChain.typeId
            );
        } else {
            resolvedSettings = this.ResolveSettingsForSpace([], params.spaceTypeId);
        }

        // If explicitly set in settings, validate that account exists and is active
        if (resolvedSettings.StorageAccountID) {
            const activeAccounts = FileStorageEngineBase.Instance.AccountsWithProviders.filter(
                a => a.provider.IsActive
            );
            const account = activeAccounts.find(a =>
                UUIDsEqual(a.account.ID, resolvedSettings.StorageAccountID)
            );
            if (!account) {
                throw new Error(
                    `Configured storage account '${resolvedSettings.StorageAccountID}' does not exist or is not active.`
                );
            }
            return account.account.ID;
        }

        // Fallback to active storage accounts from host
        const activeAccounts = FileStorageEngineBase.Instance.AccountsWithProviders.filter(
            a => a.provider.IsActive
        );

        if (activeAccounts.length === 0) {
            return null;
        }

        if (activeAccounts.length === 1) {
            return activeAccounts[0].account.ID;
        }

        const accountNames = activeAccounts
            .map(a => `'${a.account.Name}' (${a.provider.Name})`)
            .join(', ');

        throw new Error(
            `Multiple active file storage accounts detected (${accountNames}) but no StorageAccountID is configured in Collaboration settings.\n` +
            `To fix: Set StorageAccountID on the space, its parent space, the space type, or the Collaboration app settings.`
        );
    }

    /**
     * Resolves PostCloseAccess settings for a space (Punch list 2 item 12).
     */
    public async ResolvePostCloseAccess(
        spaceId: string,
        provider?: IMetadataProvider,
        contextUser?: UserInfo
    ): Promise<{ access: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None'; days: number | null }> {
        return this.ResolvePostCloseAccessForSpace({ spaceId, provider, contextUser });
    }

    /**
     * Resolves PostCloseAccess settings for a space, accounting for in-memory / unsaved configuration
     * and walking ancestor spaces up the hierarchy.
     */
    public async ResolvePostCloseAccessForSpace(params: {
        spaceId?: string | null;
        currentConfig?: CollaborationSettings | null;
        parentId?: string | null;
        spaceTypeId?: string | null;
        provider?: IMetadataProvider;
        contextUser?: UserInfo;
    }): Promise<{ access: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None'; days: number | null }> {
        const md = params.provider ?? Metadata.Provider;
        const parentChain = params.parentId
            ? await this.LoadSpaceSettingsChain(params.parentId, md, params.contextUser)
            : params.spaceId
                ? await this.LoadSpaceSettingsChain(params.spaceId, md, params.contextUser)
                : { configs: [], typeId: null };

        const allConfigs = params.currentConfig
            ? [params.currentConfig, ...parentChain.configs]
            : parentChain.configs;
        const typeId = params.spaceTypeId ?? parentChain.typeId;
        const resolved = this.ResolveSettingsForSpace(allConfigs, typeId);
        return {
            access: resolved.PostCloseAccess,
            days: resolved.PostCloseAccessDays,
        };
    }

    /**
     * Walks the space ancestor tree to collect settings in leaf-to-root order.
     */
    public async LoadSpaceSettingsChain(
        spaceId: string,
        provider?: IMetadataProvider,
        contextUser?: UserInfo
    ): Promise<{
        configs: CollaborationSettings[];
        typeId: string | null;
    }> {
        const md = provider ?? Metadata.Provider;
        const configs: CollaborationSettings[] = [];
        let currentId: string | null = spaceId;
        let targetTypeId: string | null = null;
        const visited = new Set<string>();

        const rv = RunView.FromMetadataProvider(md);
        while (currentId && !visited.has(currentId.toLowerCase())) {
            visited.add(currentId.toLowerCase());
            const spaceRes: RunViewResult<{
                ID: string;
                ParentID: string | null;
                SpaceTypeID: string | null;
                Configuration: string | null;
            }> = await rv.RunView<{
                ID: string;
                ParentID: string | null;
                SpaceTypeID: string | null;
                Configuration: string | null;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                ExtraFilter: `ID = '${currentId}'`,
                Fields: ['ID', 'ParentID', 'SpaceTypeID', 'Configuration'],
                ResultType: 'simple',
                MaxRows: 1,
            }, contextUser);

            if (!spaceRes.Success || !spaceRes.Results?.[0]) {
                break;
            }

            const row = spaceRes.Results[0];
            if (!targetTypeId && row.SpaceTypeID) {
                targetTypeId = row.SpaceTypeID;
            }

            if (row.Configuration) {
                try {
                    const parsed = JSON.parse(row.Configuration) as CollaborationSettings;
                    configs.push(parsed);
                } catch {
                    // Ignore unparseable configs in ancestor chain
                }
            } else {
                configs.push({});
            }

            currentId = row.ParentID;
        }

        return { configs, typeId: targetTypeId };
    }
}
