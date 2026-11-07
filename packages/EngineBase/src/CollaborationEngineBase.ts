/**
 * CollaborationEngineBase — browser-safe metadata engine for BizApps Collaboration
 * (modeled on AIEngineBase and AccountingEngineBase, punch list 2 item 54).
 *
 * Caches, with CacheLocal: true, the Collaboration metadata every seated person can read:
 * - Space Types
 * - Space Type Statuses (stage 1: the statuses each type declares; a participant reads the active types' rows)
 * - Space Role Types
 * - Application Settings
 *
 * MemberJunction's BaseEngine loads an engine's entities all or nothing, so what a Space Participant has no read on (the
 * authorization catalog, the app- and type-level grants) lives in CollaborationAdminEngineBase:
 * a guest's workspace must not fail because an engine also wanted a staff-only row.
 *
 * Provides typed getters and O(1) lookups by ID and code, reset on reload. The rights checks read MemberJunction's metadata.
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
    defaultStatus,
    type MemberSnapshot,
    membershipReaches,
    MissingAppSettingsError,
    type ResolvedCollaborationSettings,
    type SpaceNode,
    type SpaceStatusReach,
    ValidateCollaborationSettings,
} from '@mj-biz-apps/collaboration-core';
import type {
    mjBizAppsCollaborationSpaceRoleTypeEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
    mjBizAppsCollaborationSpaceTypeStatusEntity,
} from '@mj-biz-apps/collaboration-entities';
import { SpaceSubtypeDirectory } from '@mj-biz-apps/collaboration-entities';
import type { MJApplicationSettingEntity } from '@memberjunction/core-entities';

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
    private _spaceTypeStatuses: mjBizAppsCollaborationSpaceTypeStatusEntity[] = [];
    private _spaceRoleTypes: mjBizAppsCollaborationSpaceRoleTypeEntity[] = [];
    private _applicationSettings: MJApplicationSettingEntity[] = [];

    // O(1) memoized lookup indexes, reset on reload in AdditionalLoading()
    private _spaceTypesById: Map<string, mjBizAppsCollaborationSpaceTypeEntity> | null = null;
    private _spaceTypesByCode: Map<string, mjBizAppsCollaborationSpaceTypeEntity> | null = null;
    private _spaceRoleTypesById: Map<string, mjBizAppsCollaborationSpaceRoleTypeEntity> | null = null;
    private _spaceRoleTypesByCode: Map<string, mjBizAppsCollaborationSpaceRoleTypeEntity> | null = null;
    private _statusesById: Map<string, mjBizAppsCollaborationSpaceTypeStatusEntity> | null = null;
    private _statusesByType: Map<string, mjBizAppsCollaborationSpaceTypeStatusEntity[]> | null = null;
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
                PropertyName: '_spaceTypeStatuses',
                EntityName: 'MJ_BizApps_Collaboration: Space Type Status',
                CacheLocal: true,
                OrderBy: 'Sequence',
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
        ];

        return await this.Load(params, md, forceRefresh ?? false, contextUser);
    }

    protected override async AdditionalLoading(contextUser?: UserInfo): Promise<void> {
        // Invalidate memoized lookup indexes on initial load and any reload
        this._spaceTypesById = null;
        this._spaceTypesByCode = null;
        this._spaceRoleTypesById = null;
        this._spaceRoleTypesByCode = null;
        this._statusesById = null;
        this._statusesByType = null;
        this._cachedParsedSettings = undefined;
        this._settingsError = null;
        // The subtype each space type names, for the Spaces subtype resolver: it answers a load's hint from memory, never by a read
        SpaceSubtypeDirectory.Instance.Replace(this.SpaceTypes.map((type) => ({ ID: type.ID, SpaceExtensionEntity: type.SpaceExtensionEntity })));
    }

    // ─── Collections ───────────────────────────────────────────────────────────

    public get SpaceTypes(): mjBizAppsCollaborationSpaceTypeEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceTypeEntity>('_spaceTypes');
    }

    public get SpaceTypeStatuses(): mjBizAppsCollaborationSpaceTypeStatusEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceTypeStatusEntity>('_spaceTypeStatuses');
    }

    public get SpaceRoleTypes(): mjBizAppsCollaborationSpaceRoleTypeEntity[] {
        return this.GetConfigData<mjBizAppsCollaborationSpaceRoleTypeEntity>('_spaceRoleTypes');
    }

    public get ApplicationSettings(): MJApplicationSettingEntity[] {
        return this.GetConfigData<MJApplicationSettingEntity>('_applicationSettings');
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

    // ─── Statuses ──────────────────────────────────────────────────────────────

    private ensureStatusMaps(): void {
        if (!this._statusesById || !this._statusesByType) {
            const byId = new Map<string, mjBizAppsCollaborationSpaceTypeStatusEntity>();
            const byType = new Map<string, mjBizAppsCollaborationSpaceTypeStatusEntity[]>();
            for (const status of this.SpaceTypeStatuses) {
                if (status.ID) byId.set(normalizeKey(status.ID), status);
                const typeKey = normalizeKey(status.SpaceTypeID);
                const list = byType.get(typeKey) ?? [];
                list.push(status);
                byType.set(typeKey, list);
            }
            for (const list of byType.values()) list.sort((a, b) => a.Sequence - b.Sequence);
            this._statusesById = byId;
            this._statusesByType = byType;
        }
    }

    public StatusById(id: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        if (!id) return undefined;
        this.ensureStatusMaps();
        return this._statusesById?.get(normalizeKey(id));
    }

    /** One type's statuses, in sequence order. Empty for a type that declares none yet. */
    public StatusesForType(typeId: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity[] {
        if (!typeId) return [];
        this.ensureStatusMaps();
        return this._statusesByType?.get(normalizeKey(typeId)) ?? [];
    }

    /** One type's status by code, as the shipped metadata names them ('active', 'paused', 'closed', 'archived'). */
    public StatusByCode(typeId: string | null | undefined, code: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        if (!code) return undefined;
        const key = normalizeKey(code);
        return this.StatusesForType(typeId).find((status) => normalizeKey(status.Code) === key);
    }

    /** Where a new space of the type starts: the status marked default, else the lowest in sequence; undefined for a type with none. */
    public DefaultStatusForType(typeId: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        return defaultStatus(this.StatusesForType(typeId)) ?? undefined;
    }

    /** The type's first terminal status in sequence order: what a close moves a space to. */
    public FirstTerminalStatusForType(typeId: string | null | undefined): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        return this.StatusesForType(typeId).find((status) => status.IsTerminal);
    }

    /**
     * The status a space is effectively in, as `fnCollaborationSpaceStatuses` works it out: the one it names, else (while it is
     * unstamped) its type's default when open and its type's first terminal status when ClosedAt is set. Undefined for a space
     * whose type declares no statuses, which the rules then read from ClosedAt alone.
     */
    public EffectiveStatusForSpace(space: { StatusID?: string | null; SpaceTypeID?: string | null; ClosedAt?: string | Date | null }): mjBizAppsCollaborationSpaceTypeStatusEntity | undefined {
        const named = this.StatusById(space.StatusID);
        if (named) return named;
        return space.ClosedAt ? this.FirstTerminalStatusForType(space.SpaceTypeID) : this.DefaultStatusForType(space.SpaceTypeID);
    }

    /** The reach of a space's effective status, for a `SpaceNode`; null when its type has no statuses yet. */
    public StatusReachForSpace(space: { StatusID?: string | null; SpaceTypeID?: string | null; ClosedAt?: string | Date | null }): SpaceStatusReach | null {
        const status = this.EffectiveStatusForSpace(space);
        return status ? { ReadOnly: !!status.ReadOnly, Visible: !!status.Visible, AgentRetrieval: !!status.AgentRetrieval } : null;
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

    // ─── Authorizations ────────────────────────────────────────────────────────

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

        // The status filter applies: on a hidden space the server refuses every change but a status change
        const reached = await this.ReachedSeat(user, spaceId, md, roleTypeOf);
        return !!reached?.role.isOwnerRole;
    }

    /**
     * Whether a user holds the 'Administer Spaces' authorization: the rights beyond an owner's (create or move to a top level,
     * the allow-parent-assignees and agent-retrieval settings, a task for someone seated above its space, backdating a close).
     * Granted by default to the UI, Developer and Integration roles, so nothing changes until a host edits the grants; no check
     * looks at a role's name.
     */
    public UserMayAdministerSpaces(user: UserInfo, provider?: IMetadataProvider): boolean {
        const md = provider ?? Metadata.Provider;
        const auth = this.FindCollaborationAuthorization('Administer Spaces', md);
        if (!auth) {
            LogError("Missing authorization: 'Administer Spaces'");
            return false;
        }
        return new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, md.Authorizations ?? []);
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
     * Whether a user may change a space's status (stage 1): the 'Close and Reopen Spaces' authorization AND an owner seat on the
     * space or on an ancestor it inherits from, found with the status filter off, so the owner of a hidden or read-only space is
     * still its owner. Which statuses the space may move to is the type's statuses' business (`statusChangeRefusal`).
     */
    public async UserCanChangeSpaceStatus(
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
     * Whether a user may close an open space: the 'Close and Reopen Spaces' authorization AND an owner seat on the space (or on
     * an ancestor it inherits from), with the status filter applied.
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
     * Whether a user may reopen a space (move it from a read-only status back to a writable one): the same right as any status
     * change, found with the status filter off. `UserCanConfigureSpaces` keeps the filter, so on a hidden space an owner may change
     * its status but not configure it.
     *
     * The row filter decides who can read a hidden space: only its `OwnerID`. So in practice this answers true, for the person who
     * asks, only for the `OwnerID` (an owner by seat who isn't it reads no row, and their seat read finds nothing). `OwnerID` gives
     * no write right by itself: it must still hold an owner seat and the authorization.
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
        ignoreStatusFilter: boolean = false
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
                interface SpaceReachRow {
                    ID: string;
                    ParentID: string | null;
                    SpaceTypeID: string | null;
                    InheritsMembership: boolean;
                    OwnerID: string;
                    AgentRetrieval?: AgentRetrieval;
                    AllowParentAssignees?: boolean;
                    ClosedAt: string | null;
                    StatusID: string | null;
                }
                const spaceRes: RunViewResult<SpaceReachRow> = await rv.RunView<SpaceReachRow>({
                    EntityName: 'MJ_BizApps_Collaboration: Spaces',
                    ExtraFilter: `ID = '${currentSpaceId}'`,
                    Fields: ['ID', 'ParentID', 'SpaceTypeID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'AllowParentAssignees', 'ClosedAt', 'StatusID'],
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
                    status: this.StatusReachForSpace(s),
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

            return membershipReaches(spaces, memberships, user.ID, spaceId, new Date(), ignoreStatusFilter);
        } catch (e) {
            LogError(`Error resolving the seat of user ${user.ID} on space ${spaceId}: ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
    }
}

