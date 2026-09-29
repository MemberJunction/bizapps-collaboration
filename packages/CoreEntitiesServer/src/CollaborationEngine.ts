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
    type AuthorizationInfo,
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
                : { configs: [], typeIds: [], typeId: null };

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
        /** The type of each space in `configs`, in the same order, so a link is judged by the type it was saved under. */
        typeIds: (string | null)[];
        typeId: string | null;
    }> {
        const md = provider ?? Metadata.Provider;
        const rv = RunView.FromMetadataProvider(md);
        const configs: CollaborationSettings[] = [];
        const typeIds: (string | null)[] = [];
        let currentId: string | null = spaceId;
        let targetTypeId: string | null = null;
        const visited = new Set<string>();

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        // Configuration fails closed: a chain that can't be read completely, or holds a configuration that doesn't
        // parse, refuses the write or the turn instead of resolving with a link missing (extensibility plan § 4).
        const refuse = (message: string): never => {
            LogError(`LoadSpaceSettingsChain: ${message}`);
            throw new Error(`Space settings refused: ${message}`);
        };
        while (currentId && !visited.has(currentId.toLowerCase())) {
            if (!uuidRegex.test(currentId.trim())) {
                refuse(`'${currentId}' is not a valid space id.`);
            }
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

            if (!spaceRes.Success) {
                refuse(`space ${currentId} could not be read: ${spaceRes.ErrorMessage ?? 'unknown error'}`);
            }
            if (!spaceRes.Results?.[0]) {
                refuse(`space ${currentId} was not found.`);
            }

            const row = spaceRes.Results![0];
            if (!targetTypeId && row.SpaceTypeID) {
                targetTypeId = row.SpaceTypeID;
            }

            typeIds.push(row.SpaceTypeID ?? null);
            if (row.Configuration) {
                try {
                    configs.push(JSON.parse(row.Configuration) as CollaborationSettings);
                } catch (parseError) {
                    refuse(`space ${currentId} has a configuration that does not parse: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                }
            } else {
                configs.push({});
            }

            currentId = row.ParentID;
        }

        return { configs, typeIds, typeId: targetTypeId };
    }
}
