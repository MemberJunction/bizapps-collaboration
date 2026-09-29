/**
 * CollaborationEngineBase — browser-safe metadata engine for BizApps Collaboration
 * (modeled on AIEngineBase and AccountingEngineBase, punch list 2 item 54).
 *
 * Caches all Collaboration metadata with CacheLocal: true:
 * - Space Types
 * - Space Role Types
 * - Task Types
 * - Application Settings
 * - Authorizations & Authorization Roles
 * - App- and type-level Space Agents, Skills, and Knowledge Sources
 *
 * Provides typed getters and O(1) lookups by ID and code, reset on reload.
 */

import {
    AuthorizationEvaluator,
    type AuthorizationInfo,
    type BaseEntity,
    BaseEngine,
    type BaseEnginePropertyConfig,
    type IMetadataProvider,
    LogError,
    Metadata,
    RegisterForStartup,
    RunView,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import {
    type AgentRetrieval,
    type CollaborationSettings,
    type MemberSnapshot,
    membershipReaches,
    MissingAppSettingsError,
    type ResolvedCollaborationSettings,
    ResolveCollaborationSettings,
    type SpaceNode,
    ValidateCollaborationSettings,
} from '@mj-biz-apps/collaboration-core';
import type {
    mjBizAppsCollaborationSpaceAgentEntity,
    mjBizAppsCollaborationSpaceAgentSkillEntity,
    mjBizAppsCollaborationSpaceKnowledgeSourceEntity,
    mjBizAppsCollaborationSpaceRoleTypeEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import type {
    MJApplicationSettingEntity,
    MJAuthorizationEntity,
    MJAuthorizationRoleEntity,
} from '@memberjunction/core-entities';

const normalizeKey = (key: string | null | undefined): string => (key ?? '').trim().toLowerCase();

export const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';
export const COLLABORATION_SETTINGS_NAME = 'CollaborationSettings';

/** The application's settings row exists but doesn't validate. Settings-dependent writes and turns refuse until it is fixed. */
export class InvalidAppSettingsError extends Error {
    constructor(public readonly Errors: readonly string[]) {
        super(`The application's CollaborationSettings are invalid: ${Errors.join('; ')}`);
        this.name = 'InvalidAppSettingsError';
    }
}

/** The parts of a role type the seat rules read. The engine's own role types satisfy it; a test can pass plain values. */
export interface RoleTypeFlags {
    Level: number;
    MaxGrantableLevel: number;
    CanInvite: boolean;
    CanPromoteBand: boolean;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
    CanContribute: boolean;
}

@RegisterForStartup()
export class CollaborationEngineBase extends BaseEngine<CollaborationEngineBase> {
    private _spaceTypes: mjBizAppsCollaborationSpaceTypeEntity[] = [];
    private _spaceRoleTypes: mjBizAppsCollaborationSpaceRoleTypeEntity[] = [];
    private _applicationSettings: MJApplicationSettingEntity[] = [];
    private _authorizations: MJAuthorizationEntity[] = [];
    private _authorizationRoles: MJAuthorizationRoleEntity[] = [];
    private _appAndTypeSpaceAgents: mjBizAppsCollaborationSpaceAgentEntity[] = [];
    private _appAndTypeSpaceAgentSkills: mjBizAppsCollaborationSpaceAgentSkillEntity[] = [];
    private _appAndTypeSpaceKnowledgeSources: mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] = [];

    // O(1) memoized lookup indexes, reset on reload in AdditionalLoading()
    private _spaceTypesById: Map<string, mjBizAppsCollaborationSpaceTypeEntity> | null = null;
    private _spaceTypesByCode: Map<string, mjBizAppsCollaborationSpaceTypeEntity> | null = null;
    private _spaceRoleTypesById: Map<string, mjBizAppsCollaborationSpaceRoleTypeEntity> | null = null;
    private _spaceRoleTypesByCode: Map<string, mjBizAppsCollaborationSpaceRoleTypeEntity> | null = null;
    private _authorizationsByName: Map<string, MJAuthorizationEntity> | null = null;
    private _cachedParsedSettings: CollaborationSettings | null | undefined = undefined;

    public static get Instance(): CollaborationEngineBase {
        return super.getInstance<CollaborationEngineBase>();
    }

    public async Config(
        forceRefresh?: boolean,
        contextUser?: UserInfo,
        provider?: IMetadataProvider
    ): Promise<void> {
        const md = provider ?? Metadata.Provider;
        const params: Array<Partial<BaseEnginePropertyConfig>> = [
            {
                PropertyName: '_spaceTypes',
                EntityName: 'MJ_BizApps_Collaboration: Space Types',
                CacheLocal: true,
            },
            {
                PropertyName: '_spaceRoleTypes',
                EntityName: 'MJ_BizApps_Collaboration: Space Role Types',
                CacheLocal: true,
                OrderBy: 'Level DESC',
            },
            {
                PropertyName: '_applicationSettings',
                EntityName: 'MJ: Application Settings',
                CacheLocal: true,
            },
            {
                PropertyName: '_authorizations',
                EntityName: 'MJ: Authorizations',
                CacheLocal: true,
            },
            {
                PropertyName: '_authorizationRoles',
                EntityName: 'MJ: Authorization Roles',
                CacheLocal: true,
            },
            {
                PropertyName: '_appAndTypeSpaceAgents',
                EntityName: 'MJ_BizApps_Collaboration: Space Agents',
                CacheLocal: true,
                Filter: 'SpaceID IS NULL',
            },
            {
                PropertyName: '_appAndTypeSpaceAgentSkills',
                EntityName: 'MJ_BizApps_Collaboration: Space Agent Skills',
                CacheLocal: true,
                Filter: 'SpaceID IS NULL',
            },
            {
                PropertyName: '_appAndTypeSpaceKnowledgeSources',
                EntityName: 'MJ_BizApps_Collaboration: Space Knowledge Sources',
                CacheLocal: true,
                Filter: 'SpaceID IS NULL',
            },
        ];

        return await this.Load(params, md, forceRefresh ?? false, contextUser);
    }

    protected override async AdditionalLoading(contextUser?: UserInfo): Promise<void> {
        // Invalidate memoized lookup indexes on initial load and any reload
        this._spaceTypesById = null;
        this._spaceTypesByCode = null;
        this._spaceRoleTypesById = null;
        this._spaceRoleTypesByCode = null;
        this._authorizationsByName = null;
        this._cachedParsedSettings = undefined;
        this._settingsError = null;
    }

    // ─── Collections ───────────────────────────────────────────────────────────

    public get SpaceTypes(): mjBizAppsCollaborationSpaceTypeEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceTypeEntity>('_spaceTypes');
    }

    public get SpaceRoleTypes(): mjBizAppsCollaborationSpaceRoleTypeEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceRoleTypeEntity>('_spaceRoleTypes');
    }

    public get ApplicationSettings(): MJApplicationSettingEntity[] {
        return this.GetConfigData<MJApplicationSettingEntity>('_applicationSettings');
    }

    public get Authorizations(): MJAuthorizationEntity[] {
        return this.GetConfigData<MJAuthorizationEntity>('_authorizations');
    }

    public get AuthorizationRoles(): MJAuthorizationRoleEntity[] {
        return this.GetConfigData<MJAuthorizationRoleEntity>('_authorizationRoles');
    }

    public get AppAndTypeSpaceAgents(): mjBizAppsCollaborationSpaceAgentEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceAgentEntity>('_appAndTypeSpaceAgents');
    }

    public get AppAndTypeSpaceAgentSkills(): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceAgentSkillEntity>('_appAndTypeSpaceAgentSkills');
    }

    public get AppAndTypeSpaceKnowledgeSources(): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceKnowledgeSourceEntity>('_appAndTypeSpaceKnowledgeSources');
    }

    // ─── Lookups by ID and Code ────────────────────────────────────────────────

    private ensureSpaceTypeMaps(): void {
        if (!this._spaceTypesById || !this._spaceTypesByCode) {
            const byId = new Map<string, mjBizAppsCollaborationSpaceTypeEntity>();
            const byCode = new Map<string, mjBizAppsCollaborationSpaceTypeEntity>();
            for (const t of this.SpaceTypes) {
                if (t.ID) byId.set(normalizeKey(t.ID), t);
                if (t.Code) byCode.set(normalizeKey(t.Code), t);
            }
            this._spaceTypesById = byId;
            this._spaceTypesByCode = byCode;
        }
    }

    public SpaceTypeById(id: string | null | undefined): mjBizAppsCollaborationSpaceTypeEntity | undefined {
        if (!id) return undefined;
        this.ensureSpaceTypeMaps();
        return this._spaceTypesById?.get(normalizeKey(id));
    }

    public SpaceTypeByCode(code: string | null | undefined): mjBizAppsCollaborationSpaceTypeEntity | undefined {
        if (!code) return undefined;
        this.ensureSpaceTypeMaps();
        return this._spaceTypesByCode?.get(normalizeKey(code));
    }

    private ensureSpaceRoleTypeMaps(): void {
        if (!this._spaceRoleTypesById || !this._spaceRoleTypesByCode) {
            const byId = new Map<string, mjBizAppsCollaborationSpaceRoleTypeEntity>();
            const byCode = new Map<string, mjBizAppsCollaborationSpaceRoleTypeEntity>();
            for (const r of this.SpaceRoleTypes) {
                if (r.ID) byId.set(normalizeKey(r.ID), r);
                if (r.Code) byCode.set(normalizeKey(r.Code), r);
            }
            this._spaceRoleTypesById = byId;
            this._spaceRoleTypesByCode = byCode;
        }
    }

    public SpaceRoleTypeById(id: string | null | undefined): mjBizAppsCollaborationSpaceRoleTypeEntity | undefined {
        if (!id) return undefined;
        this.ensureSpaceRoleTypeMaps();
        return this._spaceRoleTypesById?.get(normalizeKey(id));
    }

    public SpaceRoleTypeByCode(code: string | null | undefined): mjBizAppsCollaborationSpaceRoleTypeEntity | undefined {
        if (!code) return undefined;
        this.ensureSpaceRoleTypeMaps();
        return this._spaceRoleTypesByCode?.get(normalizeKey(code));
    }

    // ─── Settings ──────────────────────────────────────────────────────────────

    public GetApplicationSetting(name: string): string | undefined {
        const needle = normalizeKey(name);
        const match = this.ApplicationSettings.find(
            s =>
                (UUIDsEqual(s.ApplicationID, COLLABORATION_APP_ID) ||
                    normalizeKey(s.Application) === 'collaboration') &&
                normalizeKey(s.Name) === needle
        );
        return match?.Value ?? undefined;
    }

    /** Whichever error the first read of the row threw, so every later read says the same thing until a reload clears it */
    private _settingsError: MissingAppSettingsError | InvalidAppSettingsError | null = null;

    public get CollaborationSettings(): CollaborationSettings {
        if (this._cachedParsedSettings !== undefined) {
            if (this._cachedParsedSettings === null) {
                throw this._settingsError ?? new MissingAppSettingsError();
            }
            return this._cachedParsedSettings;
        }

        const raw =
            this.GetApplicationSetting(COLLABORATION_SETTINGS_NAME) ??
            this.GetApplicationSetting('Settings');

        if (!raw) {
            return this.refuseSettings(new MissingAppSettingsError());
        }

        let parsed: unknown;
        try {
            parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
            const message = `Failed to parse CollaborationSettings JSON: ${e instanceof Error ? e.message : String(e)}`;
            LogError(message);
            return this.refuseSettings(new MissingAppSettingsError(message));
        }

        const validation = ValidateCollaborationSettings(parsed, 'app');
        if (!validation.valid) {
            // Fail closed: a row that doesn't validate is not a configuration, and resolving with it would let a typo
            // ('Owner' for 'Owners') quietly widen who may start a conversation
            LogError(`Invalid CollaborationSettings in Application Settings: ${validation.errors.join(', ')}`);
            return this.refuseSettings(new InvalidAppSettingsError(validation.errors));
        }
        this._cachedParsedSettings = parsed as CollaborationSettings;
        return this._cachedParsedSettings;
    }

    private refuseSettings(error: MissingAppSettingsError | InvalidAppSettingsError): never {
        this._cachedParsedSettings = null;
        this._settingsError = error;
        throw error;
    }

    public ResolveSettingsForSpace(
        spaceConfigs: Array<CollaborationSettings | null | undefined>,
        spaceTypeId?: string | null
    ): ResolvedCollaborationSettings {
        const typeEntity = spaceTypeId ? this.SpaceTypeById(spaceTypeId) : undefined;
        let typeConfig: CollaborationSettings | undefined;
        if (typeEntity?.Configuration) {
            try {
                typeConfig =
                    typeof typeEntity.Configuration === 'string'
                        ? (JSON.parse(typeEntity.Configuration) as CollaborationSettings)
                        : (typeEntity.Configuration as CollaborationSettings);
            } catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                LogError(`ResolveSettingsForSpace: Failed to parse type configuration for space type ${spaceTypeId}: ${detail}`);
                // Fails closed: resolving without the type's narrowing would loosen what it restricts
                throw new Error(`Space settings refused: the space type ${spaceTypeId} has a configuration that does not parse: ${detail}`);
            }
        }

        // A missing app settings row throws MissingAppSettingsError: the app's defaults are not a silent stand-in for it
        const appConfig: CollaborationSettings = this.CollaborationSettings;

        return ResolveCollaborationSettings({
            spaces: spaceConfigs,
            type: typeConfig,
            app: appConfig,
        });
    }

    // ─── Agents, Skills, Knowledge ─────────────────────────────────────────────

    public get AppSpaceAgents(): mjBizAppsCollaborationSpaceAgentEntity[] {
        return this.AppAndTypeSpaceAgents.filter(
            a => !a.SpaceTypeID && !a.SpaceID
        );
    }

    public SpaceAgentsForType(typeId: string): mjBizAppsCollaborationSpaceAgentEntity[] {
        const key = normalizeKey(typeId);
        return this.AppAndTypeSpaceAgents.filter(
            a => a.SpaceTypeID && normalizeKey(a.SpaceTypeID) === key && !a.SpaceID
        );
    }

    public get AppSpaceAgentSkills(): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        return this.AppAndTypeSpaceAgentSkills.filter(
            s => !s.SpaceTypeID && !s.SpaceID
        );
    }

    public SpaceAgentSkillsForType(typeId: string): mjBizAppsCollaborationSpaceAgentSkillEntity[] {
        const key = normalizeKey(typeId);
        return this.AppAndTypeSpaceAgentSkills.filter(
            s => s.SpaceTypeID && normalizeKey(s.SpaceTypeID) === key && !s.SpaceID
        );
    }

    public get AppSpaceKnowledgeSources(): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        return this.AppAndTypeSpaceKnowledgeSources.filter(
            k => !k.SpaceTypeID && !k.SpaceID
        );
    }

    public SpaceKnowledgeSourcesForType(typeId: string): mjBizAppsCollaborationSpaceKnowledgeSourceEntity[] {
        const key = normalizeKey(typeId);
        return this.AppAndTypeSpaceKnowledgeSources.filter(
            k => k.SpaceTypeID && normalizeKey(k.SpaceTypeID) === key && !k.SpaceID
        );
    }

    // ─── Authorizations ────────────────────────────────────────────────────────

    public AuthorizationByName(name: string): MJAuthorizationEntity | undefined {
        if (!this._authorizationsByName) {
            const map = new Map<string, MJAuthorizationEntity>();
            for (const a of this.Authorizations) {
                if (a.Name) map.set(normalizeKey(a.Name), a);
            }
            this._authorizationsByName = map;
        }
        return this._authorizationsByName.get(normalizeKey(name));
    }

    /**
     * Resolves a child authorization under the "Collaboration" root authorization strictly.
     * Refuses name-only matches outside the Collaboration hierarchy.
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
     */
    public UserCanConfigureSpaceTypes(user: UserInfo, provider?: IMetadataProvider): boolean {
        const md = provider ?? Metadata.Provider;
        const auth = this.FindCollaborationAuthorization('Configure Space Types', md);
        if (!auth) {
            LogError("Missing authorization: 'Configure Space Types'");
            return false;
        }
        return new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, md.Authorizations ?? []);
    }

    /**
     * Checks if a user has the "Configure Spaces" authorization under the "Collaboration" root AND
     * holds a role with IsOwnerRole on the specified space (or reaching it via inheritance).
     * If spaceId is null/undefined, authorization alone suffices.
     */
    public async UserCanConfigureSpaces(
        user: UserInfo,
        spaceId?: string | null,
        provider?: IMetadataProvider,
        roleTypeOf: (id: string) => RoleTypeFlags | undefined = (id) => this.SpaceRoleTypeById(id)
    ): Promise<boolean> {
        const md = provider ?? Metadata.Provider;
        const auth = this.FindCollaborationAuthorization('Configure Spaces', md);
        if (!auth) {
            LogError("Missing authorization: 'Configure Spaces'");
            return false;
        }
        if (!new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, md.Authorizations ?? [])) {
            return false;
        }

        if (!spaceId) {
            return true;
        }

        // The post-close filter applies: on a space closed with its access ended, the server refuses every change but a reopen
        const reached = await this.ReachedSeat(user, spaceId, md, roleTypeOf);
        return !!reached?.role.isOwnerRole;
    }

    /** Whether a user holds the 'Close and Reopen Spaces' authorization. It is granted apart from 'Configure Spaces', which changes settings. */
    public UserHoldsLifecycleAuthorization(user: UserInfo, provider?: IMetadataProvider): boolean {
        const md = provider ?? Metadata.Provider;
        const auth = this.FindCollaborationAuthorization('Close and Reopen Spaces', md);
        if (!auth) {
            LogError("Missing authorization: 'Close and Reopen Spaces'");
            return false;
        }
        return new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, md.Authorizations ?? []);
    }

    /**
     * Whether a user may close an open space: the 'Close and Reopen Spaces' authorization AND an owner seat on the space (or on
     * an ancestor it inherits from), with the post-close filter applied.
     */
    public async UserCanCloseSpace(
        user: UserInfo,
        spaceId: string,
        provider?: IMetadataProvider,
        roleTypeOf: (id: string) => RoleTypeFlags | undefined = (id) => this.SpaceRoleTypeById(id)
    ): Promise<boolean> {
        const md = provider ?? Metadata.Provider;
        if (!this.UserHoldsLifecycleAuthorization(user, md)) return false;
        const reached = await this.ReachedSeat(user, spaceId, md, roleTypeOf);
        return !!reached?.role.isOwnerRole;
    }

    /**
     * Whether a user may reopen a closed space: the 'Close and Reopen Spaces' authorization AND an owner seat on the space or on an
     * ancestor it inherits from, reached even when the space's post-close access has ended. `UserCanConfigureSpaces` keeps the
     * post-close filter, so on such a space an owner may reopen but not configure.
     */
    public async UserCanReopenSpace(
        user: UserInfo,
        spaceId: string,
        provider?: IMetadataProvider,
        roleTypeOf: (id: string) => RoleTypeFlags | undefined = (id) => this.SpaceRoleTypeById(id)
    ): Promise<boolean> {
        const md = provider ?? Metadata.Provider;
        if (!this.UserHoldsLifecycleAuthorization(user, md)) return false;
        const reached = await this.ReachedSeat(user, spaceId, md, roleTypeOf, true);
        return !!reached?.role.isOwnerRole;
    }

    /**
     * The seat through which a user reaches a space: their own seat on it, or one on an ancestor it inherits from.
     * Null when they don't reach it, or when the tree or the seats can't be read.
     */
    public async ReachedSeat(
        user: UserInfo,
        spaceId: string,
        provider?: IMetadataProvider,
        roleTypeOf: (id: string) => RoleTypeFlags | undefined = (id) => this.SpaceRoleTypeById(id),
        ignorePostCloseFilter: boolean = false
    ): Promise<ReturnType<typeof membershipReaches>> {
        const md = provider ?? Metadata.Provider;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(spaceId.trim()) || !user?.ID || !uuidRegex.test(user.ID.trim())) {
            return null;
        }

        try {
            const memberEntity = md.EntityByName('MJ_BizApps_Collaboration: Space Members');
            if (!memberEntity) return null;

            const rv = RunView.FromMetadataProvider(md);
            const spaces: SpaceNode[] = [];
            let currentSpaceId: string | null = spaceId;
            const seen = new Set<string>();

            while (currentSpaceId && !seen.has(currentSpaceId.toLowerCase())) {
                if (!uuidRegex.test(currentSpaceId.trim())) {
                    break;
                }
                seen.add(currentSpaceId.toLowerCase());
                const spaceRes: RunViewResult<{
                    ID: string;
                    ParentID: string | null;
                    SpaceTypeID: string | null;
                    InheritsMembership: boolean;
                    OwnerID: string;
                    AgentRetrieval?: AgentRetrieval;
                    AllowParentAssignees?: boolean;
                    ClosedAt: string | null;
                    PostCloseAccess: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None' | null;
                    PostCloseAccessDays: number | null;
                }> = await rv.RunView<{
                    ID: string;
                    ParentID: string | null;
                    SpaceTypeID: string | null;
                    InheritsMembership: boolean;
                    OwnerID: string;
                    AgentRetrieval?: AgentRetrieval;
                    AllowParentAssignees?: boolean;
                    ClosedAt: string | null;
                    PostCloseAccess: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None' | null;
                    PostCloseAccessDays: number | null;
                }>({
                    EntityName: 'MJ_BizApps_Collaboration: Spaces',
                    ExtraFilter: `ID = '${currentSpaceId}'`,
                    Fields: ['ID', 'ParentID', 'SpaceTypeID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'AllowParentAssignees', 'ClosedAt', 'PostCloseAccess', 'PostCloseAccessDays'],
                    ResultType: 'simple',
                    MaxRows: 1,
                }, user);

                if (!spaceRes.Success) {
                    LogError(`ReachedSeat: space ${currentSpaceId} could not be read: ${spaceRes.ErrorMessage ?? 'unknown error'}`);
                    break;
                }
                if (!spaceRes.Results?.[0]) {
                    break;
                }
                const s = spaceRes.Results[0];
                spaces.push({
                    id: s.ID,
                    parentId: s.ParentID,
                    inheritsMembership: !!s.InheritsMembership,
                    ownerId: s.OwnerID,
                    agentRetrieval: s.AgentRetrieval ?? 'Included',
                    allowParentAssignees: s.AllowParentAssignees !== undefined ? !!s.AllowParentAssignees : true,
                    closedAt: s.ClosedAt,
                    postCloseAccess: s.PostCloseAccess,
                    postCloseAccessDays: s.PostCloseAccessDays,
                    spaceTypePostCloseAccess: this.SpaceTypeById(s.SpaceTypeID)?.PostCloseAccess ?? null,
                    spaceTypePostCloseAccessDays: this.SpaceTypeById(s.SpaceTypeID)?.PostCloseAccessDays ?? null,
                });
                if (!s.InheritsMembership || !s.ParentID) {
                    break;
                }
                currentSpaceId = s.ParentID;
            }

            if (spaces.length === 0) {
                return null;
            }

            const spaceFilter = spaces.map(sp => `'${sp.id}'`).join(',');
            const memberRes = await rv.RunView<{
                SpaceID: string;
                UserID: string;
                Status: MemberSnapshot['status'];
                Band: MemberSnapshot['band'];
                SpaceRoleTypeID: string;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                ExtraFilter: `UserID = '${user.ID}' AND Status = 'Active' AND SpaceID IN (${spaceFilter})`,
                Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
                ResultType: 'simple',
                MaxRows: 100,
            }, user);

            if (!memberRes.Success || !memberRes.Results) {
                LogError(`ReachedSeat: the seats of ${user.ID} could not be read: ${memberRes.ErrorMessage ?? 'unknown error'}`);
                return null;
            }

            const memberships: MemberSnapshot[] = memberRes.Results.map(m => {
                const roleType = roleTypeOf(m.SpaceRoleTypeID);
                return {
                    spaceId: m.SpaceID,
                    userId: m.UserID,
                    status: m.Status,
                    band: m.Band,
                    role: {
                        level: roleType?.Level ?? 0,
                        maxGrantableLevel: roleType?.MaxGrantableLevel ?? 0,
                        canInvite: !!roleType?.CanInvite,
                        canPromoteBand: !!roleType?.CanPromoteBand,
                        canSeeTeamBand: !!roleType?.CanSeeTeamBand,
                        isOwnerRole: !!roleType?.IsOwnerRole,
                        canContribute: !!roleType?.CanContribute,
                    },
                };
            });

            return membershipReaches(spaces, memberships, user.ID, spaceId, new Date(), ignorePostCloseFilter);
        } catch (e) {
            LogError(`Error resolving the seat of user ${user.ID} on space ${spaceId}: ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
    }
}

