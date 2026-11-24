/**
 * NT-1 Comms v2 Notification Routing Engine, UserInfoEngine Preference Bridge,
 * batched RunView recipient/preference resolution, and BaseRemotableOperation RPCs.
 *
 * Browser-safe (`@mj-biz-apps/collaboration-engine-base`): server-side Comms v2 delivery
 * plugs in via {@link CollaborationCommsV2TransportRegistry}.
 */

import {
    BaseRemotableOperation,
    type IMetadataProvider,
    type IRemoteOperationProvider,
    type RemoteOpServerContext,
    RemoteOperationError,
    RunView,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { type MJUserSettingEntity, UserInfoEngine } from '@memberjunction/core-entities';
import { BaseSingleton, MJGlobal, RegisterClass } from '@memberjunction/global';
import {
    COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
    type CollaborationNotificationChannel,
    type CollaborationNotificationEvent,
    type CollaborationNotificationEventType,
    type CollaborationRecipientCandidate,
    type CollaborationUserNotificationPreferences,
    type CollaborationUserNotificationPreferencesPatch,
    type CommsV2NotificationPayload,
    type CommsV2SuppressedChannel,
    createDefaultCollaborationNotificationPreferences,
    evaluateNotificationPreferencesForRecipient,
    isCollaborationNotificationEventType,
    isSpaceNoticeBand,
    mergeCollaborationNotificationPreferences,
    type MJNotificationTypeDefaultSnapshot,
    type MJUserNotificationPreferenceSnapshot,
    normalizeCollaborationNotificationPreferences,
    type NotificationSuppressionReason,
    normalizeNoticeUuid,
    NT1_NOTIFICATION_TYPE_NAMES,
    parseCollaborationNotificationPreferences,
    serializeCollaborationNotificationPreferences,
} from '@mj-biz-apps/collaboration-core';
import {
    buildBatchedInFilter,
    buildStringEqualsFilter,
    buildUuidEqualsFilter,
    chunkDistinctIds,
    detectAuditSqlDialect,
    isExternalParticipantUser,
    quoteAuditIdentifier,
    readEverySimpleRow,
    type SqlDialect,
} from './security-audit-types.js';

export const USER_SETTINGS_ENTITY = 'MJ: User Settings';
export const USER_NOTIFICATION_TYPES_ENTITY = 'MJ: User Notification Types';
export const USER_NOTIFICATION_PREFERENCES_ENTITY = 'MJ: User Notification Preferences';
export const USERS_ENTITY = 'MJ: Users';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const SPACE_ROLE_TYPES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';
const SPACE_TYPE_STATUS_ENTITY = 'MJ_BizApps_Collaboration: Space Type Status';

export const ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY = 'Collaboration.RouteNotifications';
export const GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY = 'Collaboration.GetNotificationPreferences';
export const UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY = 'Collaboration.UpdateNotificationPreferences';

const MAX_SPACE_CHAIN_DEPTH = 32;

export interface UserInfoEnginePreferenceBridge {
    GetSetting(settingKey: string): string | undefined;
    SetSettingDebounced(settingKey: string, value: string, contextUser?: UserInfo): void;
    FlushPendingSettings(): Promise<void>;
    readonly LoadedForUserId?: string | null;
    readonly NotificationPreferences?: ReadonlyArray<MJUserNotificationPreferenceSnapshot>;
    readonly NotificationTypes?: ReadonlyArray<{
        ID: string;
        Name: string;
        DefaultInApp: boolean | null;
        DefaultEmail: boolean | null;
        DefaultSMS: boolean | null;
        AllowUserPreference: boolean | null;
    }>;
}

export interface CommsV2TransportDispatchRequest {
    Payload: CommsV2NotificationPayload;
    NotificationTypeDefault: MJNotificationTypeDefaultSnapshot | null;
    Provider: IMetadataProvider;
    ActingUser: UserInfo;
    SystemUser: UserInfo;
}

export interface CommsV2TransportDispatchResult {
    Success: boolean;
    DeliveredChannels: CollaborationNotificationChannel[];
    InAppNotificationID?: string | null;
    EmailDispatched?: boolean;
    SMSDispatched?: boolean;
    ChatDispatched?: boolean;
    ErrorMessage?: string;
}

export interface CollaborationCommsV2Transport {
    readonly Name: string;
    Dispatch(request: CommsV2TransportDispatchRequest): Promise<CommsV2TransportDispatchResult>;
}

/**
 * Global singleton registry holding the active Comms v2 delivery transport.
 * Server bootstrap registers the live MJ Comms v2 (`NotificationEngine` + `CommunicationEngine`)
 * adapter; unit and world-data-model tests can inject a deterministic spy transport.
 */
export class CollaborationCommsV2TransportRegistry extends BaseSingleton<CollaborationCommsV2TransportRegistry> {
    private transport: CollaborationCommsV2Transport | null = null;

    protected constructor() {
        super();
    }

    public static get Instance(): CollaborationCommsV2TransportRegistry {
        return super.getInstance<CollaborationCommsV2TransportRegistry>();
    }

    public RegisterTransport(transport: CollaborationCommsV2Transport | null): void {
        this.transport = transport;
    }

    public GetTransport(): CollaborationCommsV2Transport | null {
        return this.transport;
    }

    public ResetTransport(): void {
        this.transport = null;
    }
}

export function RegisterCollaborationCommsV2Transport(transport: CollaborationCommsV2Transport | null): void {
    CollaborationCommsV2TransportRegistry.Instance.RegisterTransport(transport);
}

export function GetCollaborationCommsV2Transport(): CollaborationCommsV2Transport | null {
    return CollaborationCommsV2TransportRegistry.Instance.GetTransport();
}

export function ResetCollaborationCommsV2Transport(): void {
    CollaborationCommsV2TransportRegistry.Instance.ResetTransport();
}

export interface RouteCollaborationNotificationsInput {
    Event: CollaborationNotificationEvent;
    RecipientUserIDs?: readonly string[];
    IncludeSpaceMembers?: boolean;
    IncludeActor?: boolean;
    DryRun?: boolean;
    Now?: string;
    Dialect?: SqlDialect;
}

export interface CollaborationRecipientDeliveryOutcome {
    RecipientUserID: string;
    Permitted: boolean;
    PermittedChannels: CollaborationNotificationChannel[];
    SuppressedChannels: CommsV2SuppressedChannel[];
    SuppressionReasons: NotificationSuppressionReason[];
    QuietHoursActive: boolean;
    Dispatched: boolean;
    DeliveredChannels: CollaborationNotificationChannel[];
    InAppNotificationID: string | null;
    Payload: CommsV2NotificationPayload | null;
    ErrorMessage?: string;
}

export interface RouteCollaborationNotificationsResult {
    Success: boolean;
    EventType: CollaborationNotificationEventType;
    TotalCandidateRecipients: number;
    DispatchedCount: number;
    SuppressedCount: number;
    FailedCount: number;
    BatchedQueryCount: number;
    Deliveries: CollaborationRecipientDeliveryOutcome[];
    ErrorMessage?: string;
}

export interface GetUserNotificationPreferencesInput {
    IncludeTypeDefaults?: boolean;
}

export interface GetUserNotificationPreferencesResult {
    Success: boolean;
    UserID: string;
    Preferences: CollaborationUserNotificationPreferences;
    MJPreferences: MJUserNotificationPreferenceSnapshot[];
    NotificationTypes: MJNotificationTypeDefaultSnapshot[];
    Source: 'user-info-engine' | 'run-view' | 'default';
    ErrorMessage?: string;
}

export interface UpdateUserNotificationPreferencesInput {
    Patch: CollaborationUserNotificationPreferencesPatch;
    Flush?: boolean;
}

export interface UpdateUserNotificationPreferencesResult {
    Success: boolean;
    UserID: string;
    Preferences: CollaborationUserNotificationPreferences;
    SavedVia: 'user-info-engine' | 'entity-save';
    ErrorMessage?: string;
}

interface SimpleSpaceRow {
    ID: string;
    Name?: string | null;
    ParentID: string | null;
    SpaceTypeID: string;
    OwnerID: string;
    InheritsMembership: boolean;
    StatusID?: string | null;
}

interface SimpleSpaceMemberRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    SpaceRoleTypeID: string;
    Band: string;
    Status: string;
}

interface SimpleSpaceRoleTypeRow {
    ID: string;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
    CanContribute: boolean;
    IsActive: boolean;
}

interface SimpleSpaceTypeStatusRow {
    ID: string;
    Visible: boolean;
    ReadOnly: boolean;
}

interface SimpleUserRow {
    ID: string;
    Name?: string | null;
    Email?: string | null;
    Type?: string | null;
    IsActive?: boolean | null;
}

interface SimpleUserNotificationTypeRow {
    ID: string;
    Name: string;
    DefaultInApp: boolean;
    DefaultEmail: boolean;
    DefaultSMS: boolean;
    AllowUserPreference: boolean;
}

interface SimpleUserNotificationPreferenceRow {
    ID: string;
    UserID: string;
    NotificationTypeID: string;
    Enabled: boolean | null;
    InAppEnabled: boolean | null;
    EmailEnabled: boolean | null;
    SMSEnabled: boolean | null;
}

interface SimpleUserSettingRow {
    ID: string;
    UserID: string;
    Setting: string;
    Value: string | null;
}

function isRemoteOperationCapableProvider(
    provider: IMetadataProvider | undefined,
): provider is IMetadataProvider & IRemoteOperationProvider {
    return Boolean(provider && 'RouteOperation' in provider && typeof provider.RouteOperation === 'function');
}

function validateAuthenticatedMemberCaller(
    user: UserInfo | undefined,
): { ok: true; userId: string } | { ok: false; reason: string } {
    if (!user) {
        return { ok: false, reason: 'Authentication required: no acting user context.' };
    }
    if (user.IsMagicLinkAnonymous === true) {
        return { ok: false, reason: 'Anonymous magic-link sessions cannot access or route collaboration notifications.' };
    }
    const cleanId = normalizeNoticeUuid(user.ID);
    if (!cleanId) {
        return { ok: false, reason: 'Authenticated user context does not carry a valid user ID.' };
    }
    return { ok: true, userId: cleanId };
}

async function resolvePrivilegedContextUser(provider: IMetadataProvider, fallbackUser: UserInfo): Promise<UserInfo> {
    try {
        const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
        return system ?? fallbackUser;
    } catch {
        return fallbackUser;
    }
}

/**
 * Reads the current user's Collaboration notification preferences from `UserInfoEngine`
 * without touching browser storage (`localStorage`/`sessionStorage`).
 */
export function readCollaborationPreferencesFromUserInfoEngine(
    bridge: UserInfoEnginePreferenceBridge = UserInfoEngine.Instance,
): CollaborationUserNotificationPreferences {
    try {
        const raw = bridge.GetSetting(COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY);
        return parseCollaborationNotificationPreferences(raw);
    } catch {
        return createDefaultCollaborationNotificationPreferences();
    }
}

/**
 * Updates the current user's Collaboration notification preferences through `UserInfoEngine.SetSettingDebounced`
 * (and optionally flushes immediately). Never uses `localStorage` or `sessionStorage`.
 */
export async function writeCollaborationPreferencesToUserInfoEngine(
    patch: CollaborationUserNotificationPreferencesPatch,
    options?: {
        contextUser?: UserInfo;
        flush?: boolean;
        userInfoEngine?: UserInfoEnginePreferenceBridge;
    },
): Promise<CollaborationUserNotificationPreferences> {
    const bridge = options?.userInfoEngine ?? UserInfoEngine.Instance;
    const current = readCollaborationPreferencesFromUserInfoEngine(bridge);
    const merged = mergeCollaborationNotificationPreferences(current, patch);
    const serialized = serializeCollaborationNotificationPreferences(merged);
    bridge.SetSettingDebounced(COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY, serialized, options?.contextUser);
    if (options?.flush !== false) {
        await bridge.FlushPendingSettings();
    }
    return merged;
}

function escapeSqlLiteralValue(value: string): string {
    return value.replace(/'/g, "''");
}

function isUserInfoEngineLoadedForUser(
    bridge: UserInfoEnginePreferenceBridge,
    userId: string,
): boolean {
    const loadedId = normalizeNoticeUuid(bridge.LoadedForUserId);
    return loadedId !== null && loadedId === userId;
}

/**
 * Resolves the authenticated caller's Collaboration notification preferences using `UserInfoEngine`
 * (when loaded for the caller) and/or batched `RunView` (`ResultType: 'simple'`) over `MJ: User Settings`,
 * `MJ: User Notification Preferences`, and `MJ: User Notification Types`.
 */
export async function runGetUserNotificationPreferences(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: GetUserNotificationPreferencesInput = {},
    userInfoEngine: UserInfoEnginePreferenceBridge = UserInfoEngine.Instance,
): Promise<GetUserNotificationPreferencesResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }

    const dialect = detectAuditSqlDialect(provider);
    const rv = RunView.FromMetadataProvider(provider);
    let source: 'user-info-engine' | 'run-view' | 'default' = 'default';
    let preferences = createDefaultCollaborationNotificationPreferences();

    if (isUserInfoEngineLoadedForUser(userInfoEngine, auth.userId)) {
        const rawFromEngine = userInfoEngine.GetSetting(COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY);
        if (rawFromEngine !== undefined) {
            preferences = parseCollaborationNotificationPreferences(rawFromEngine);
            source = 'user-info-engine';
        }
    }

    if (source === 'default') {
        const settingsRes = await rv.RunView<SimpleUserSettingRow>(
            {
                EntityName: USER_SETTINGS_ENTITY,
                ExtraFilter: `${buildUuidEqualsFilter('UserID', auth.userId, dialect)} AND ${buildStringEqualsFilter('Setting', COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY, dialect)}`,
                Fields: ['ID', 'UserID', 'Setting', 'Value'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            actingUser,
        );
        if (!settingsRes.Success) {
            throw new RemoteOperationError(
                'EXECUTION_ERROR',
                `Failed to load user notification preferences: ${settingsRes.ErrorMessage ?? 'unknown error'}`,
            );
        }
        const row = settingsRes.Results?.[0];
        if (row?.Value) {
            preferences = parseCollaborationNotificationPreferences(row.Value);
            source = 'run-view';
        }
    }

    const mjPrefsRes = await readEverySimpleRow<SimpleUserNotificationPreferenceRow>(
        rv,
        {
            EntityName: USER_NOTIFICATION_PREFERENCES_ENTITY,
            ExtraFilter: buildUuidEqualsFilter('UserID', auth.userId, dialect),
            Fields: ['ID', 'UserID', 'NotificationTypeID', 'Enabled', 'InAppEnabled', 'EmailEnabled', 'SMSEnabled'],
        },
        actingUser,
    );
    if (!mjPrefsRes.ok) {
        throw new RemoteOperationError(
            'EXECUTION_ERROR',
            `Failed to load MJ user notification preferences: ${mjPrefsRes.error}`,
        );
    }

    let notificationTypes: MJNotificationTypeDefaultSnapshot[] = [];
    if (input.IncludeTypeDefaults !== false) {
        const typesRes = await readEverySimpleRow<SimpleUserNotificationTypeRow>(
            rv,
            {
                EntityName: USER_NOTIFICATION_TYPES_ENTITY,
                Fields: ['ID', 'Name', 'DefaultInApp', 'DefaultEmail', 'DefaultSMS', 'AllowUserPreference'],
            },
            actingUser,
        );
        if (!typesRes.ok) {
            throw new RemoteOperationError(
                'EXECUTION_ERROR',
                `Failed to load notification types: ${typesRes.error}`,
            );
        }
        notificationTypes = typesRes.rows.map((t) => ({
            ID: normalizeNoticeUuid(t.ID) ?? t.ID,
            Name: t.Name,
            DefaultInApp: Boolean(t.DefaultInApp),
            DefaultEmail: Boolean(t.DefaultEmail),
            DefaultSMS: Boolean(t.DefaultSMS),
            AllowUserPreference: t.AllowUserPreference !== false,
        }));
    }

    return {
        Success: true,
        UserID: auth.userId,
        Preferences: normalizeCollaborationNotificationPreferences(preferences),
        MJPreferences: mjPrefsRes.rows.map((p) => ({
            UserID: normalizeNoticeUuid(p.UserID) ?? p.UserID,
            NotificationTypeID: normalizeNoticeUuid(p.NotificationTypeID) ?? p.NotificationTypeID,
            Enabled: p.Enabled ?? null,
            InAppEnabled: p.InAppEnabled ?? null,
            EmailEnabled: p.EmailEnabled ?? null,
            SMSEnabled: p.SMSEnabled ?? null,
        })),
        NotificationTypes: notificationTypes,
        Source: source,
    };
}

/**
 * Updates the authenticated caller's Collaboration notification preferences.
 * Uses `UserInfoEngine.SetSettingDebounced` + `FlushPendingSettings()` when `UserInfoEngine`
 * is active for the caller, and persists to `MJ: User Settings` via `GetEntityObject` on the
 * server provider otherwise so multi-user server requests never overwrite another user's singleton state.
 */
export async function runUpdateUserNotificationPreferences(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: UpdateUserNotificationPreferencesInput,
    userInfoEngine: UserInfoEnginePreferenceBridge = UserInfoEngine.Instance,
): Promise<UpdateUserNotificationPreferencesResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }
    if (!input || !input.Patch) {
        return {
            Success: false,
            UserID: auth.userId,
            Preferences: createDefaultCollaborationNotificationPreferences(),
            SavedVia: 'entity-save',
            ErrorMessage: 'Preference Patch payload is required.',
        };
    }

    const currentResult = await runGetUserNotificationPreferences(
        provider,
        actingUser,
        { IncludeTypeDefaults: false },
        userInfoEngine,
    );
    const merged = mergeCollaborationNotificationPreferences(currentResult.Preferences, input.Patch);
    const serialized = serializeCollaborationNotificationPreferences(merged);

    if (isUserInfoEngineLoadedForUser(userInfoEngine, auth.userId)) {
        userInfoEngine.SetSettingDebounced(
            COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
            serialized,
            actingUser,
        );
        if (input.Flush !== false) {
            await userInfoEngine.FlushPendingSettings();
        }
        return {
            Success: true,
            UserID: auth.userId,
            Preferences: merged,
            SavedVia: 'user-info-engine',
        };
    }

    const dialect = detectAuditSqlDialect(provider);
    const rv = RunView.FromMetadataProvider(provider);
    const existingRes = await rv.RunView<SimpleUserSettingRow>(
        {
            EntityName: USER_SETTINGS_ENTITY,
            ExtraFilter: `${buildUuidEqualsFilter('UserID', auth.userId, dialect)} AND ${buildStringEqualsFilter('Setting', COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY, dialect)}`,
            Fields: ['ID', 'UserID', 'Setting', 'Value'],
            ResultType: 'simple',
            MaxRows: 1,
        },
        actingUser,
    );
    if (!existingRes.Success) {
        throw new RemoteOperationError(
            'EXECUTION_ERROR',
            `Failed to query existing user setting: ${existingRes.ErrorMessage ?? 'unknown error'}`,
        );
    }

    const existingRow = existingRes.Results?.[0];
    const entity = await provider.GetEntityObject<MJUserSettingEntity>(USER_SETTINGS_ENTITY, actingUser);
    if (existingRow) {
        const loaded = await entity.Load(existingRow.ID);
        if (!loaded) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load user setting ${existingRow.ID}.`);
        }
    } else {
        entity.NewRecord();
        entity.UserID = auth.userId;
        entity.Setting = COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY;
    }
    entity.Value = serialized;

    const saved = await entity.Save();
    if (!saved) {
        const msg = entity.LatestResult?.CompleteMessage || entity.LatestResult?.Message || 'Failed to save user setting.';
        throw new RemoteOperationError('EXECUTION_ERROR', msg);
    }

    return {
        Success: true,
        UserID: auth.userId,
        Preferences: merged,
        SavedVia: 'entity-save',
    };
}

interface SpaceChainResolution {
    spacesInChain: SimpleSpaceRow[];
    targetSpace: SimpleSpaceRow;
    isVisibleStatus: boolean;
    isReadOnlyStatus: boolean;
    batchedQueryCount: number;
}

async function loadSpaceChainForNotifications(
    rv: RunView,
    spaceId: string,
    readUser: UserInfo,
    dialect: SqlDialect,
): Promise<SpaceChainResolution | null> {
    let batchedQueryCount = 0;
    const spacesInChain: SimpleSpaceRow[] = [];
    const seen = new Set<string>();
    let currentId: string | null = spaceId;

    while (currentId && !seen.has(currentId) && spacesInChain.length < MAX_SPACE_CHAIN_DEPTH) {
        seen.add(currentId);
        batchedQueryCount += 1;
        const res = await rv.RunView<SimpleSpaceRow>(
            {
                EntityName: SPACES_ENTITY,
                ExtraFilter: buildUuidEqualsFilter('ID', currentId, dialect),
                Fields: ['ID', 'Name', 'ParentID', 'SpaceTypeID', 'OwnerID', 'InheritsMembership', 'StatusID'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            readUser,
        );
        if (!res.Success) {
            throw new RemoteOperationError(
                'EXECUTION_ERROR',
                `Failed to load space ${currentId}: ${res.ErrorMessage ?? 'unknown error'}`,
            );
        }
        const space = res.Results?.[0];
        if (!space) {
            break;
        }
        spacesInChain.push(space);
        if (!space.InheritsMembership || !space.ParentID) {
            break;
        }
        currentId = normalizeNoticeUuid(space.ParentID);
    }

    if (spacesInChain.length === 0) {
        return null;
    }

    const targetSpace = spacesInChain[0];
    const targetStatusId = normalizeNoticeUuid(targetSpace.StatusID);
    let isVisibleStatus = true;
    let isReadOnlyStatus = false;

    if (targetStatusId) {
        const statusRes = await rv.RunView<SimpleSpaceTypeStatusRow>(
            {
                EntityName: SPACE_TYPE_STATUS_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', [targetStatusId], dialect),
                Fields: ['ID', 'Visible', 'ReadOnly'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            readUser,
        );
        batchedQueryCount += 1;
        if (!statusRes.Success) {
            throw new RemoteOperationError(
                'EXECUTION_ERROR',
                `Failed to load space status ${targetStatusId}: ${statusRes.ErrorMessage ?? 'unknown error'}`,
            );
        }
        const statusRow = statusRes.Results?.[0];
        if (statusRow) {
            isVisibleStatus = statusRow.Visible !== false;
            isReadOnlyStatus = statusRow.ReadOnly === true;
        }
    }

    return {
        spacesInChain,
        targetSpace,
        isVisibleStatus,
        isReadOnlyStatus,
        batchedQueryCount,
    };
}

/**
 * NT-1 Comms v2 Notification Routing Engine:
 * - Validates event payload and acting user reach
 * - Batches ALL SpaceMember, SpaceRoleType, User, NotificationType, UserNotificationPreference,
 *   and UserSetting lookups via `RunView` (`ResultType: 'simple'`, `ID IN (...)` / `UserID IN (...)`)
 *   with ZERO N+1 query loops
 * - Enforces User Notification Preferences (opt-outs, event subscriptions, muted spaces/items,
 *   timezone-aware quiet hours) strictly BEFORE any Comms v2 dispatch
 * - Dispatches permitted notifications through the registered {@link CollaborationCommsV2Transport}.
 */
export async function runRouteCollaborationNotifications(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: RouteCollaborationNotificationsInput,
    userInfoEngine: UserInfoEnginePreferenceBridge = UserInfoEngine.Instance,
): Promise<RouteCollaborationNotificationsResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }

    if (!input || !input.Event) {
        throw new RemoteOperationError('VALIDATION_ERROR', 'Notification Event payload is required.');
    }

    const event = input.Event;
    if (!isCollaborationNotificationEventType(event.EventType)) {
        return {
            Success: false,
            EventType: 'Mention',
            TotalCandidateRecipients: 0,
            DispatchedCount: 0,
            SuppressedCount: 0,
            FailedCount: 0,
            BatchedQueryCount: 0,
            Deliveries: [],
            ErrorMessage: `Unsupported NT-1 notification EventType '${String(event.EventType)}'.`,
        };
    }

    const spaceId = normalizeNoticeUuid(event.SpaceID);
    if (!spaceId) {
        return {
            Success: false,
            EventType: event.EventType,
            TotalCandidateRecipients: 0,
            DispatchedCount: 0,
            SuppressedCount: 0,
            FailedCount: 0,
            BatchedQueryCount: 0,
            Deliveries: [],
            ErrorMessage: 'Event.SpaceID must be a valid UUID.',
        };
    }

    if (!isSpaceNoticeBand(event.Band)) {
        return {
            Success: false,
            EventType: event.EventType,
            TotalCandidateRecipients: 0,
            DispatchedCount: 0,
            SuppressedCount: 0,
            FailedCount: 0,
            BatchedQueryCount: 0,
            Deliveries: [],
            ErrorMessage: `Unsupported notification Band '${String(event.Band)}'.`,
        };
    }

    const cleanTitle = (event.Title ?? '').trim();
    if (!cleanTitle || cleanTitle.length > 400) {
        return {
            Success: false,
            EventType: event.EventType,
            TotalCandidateRecipients: 0,
            DispatchedCount: 0,
            SuppressedCount: 0,
            FailedCount: 0,
            BatchedQueryCount: 0,
            Deliveries: [],
            ErrorMessage: 'Event.Title is required and must be at most 400 characters.',
        };
    }

    const nowUtc = input.Now ? new Date(input.Now) : new Date();
    if (Number.isNaN(nowUtc.getTime())) {
        return {
            Success: false,
            EventType: event.EventType,
            TotalCandidateRecipients: 0,
            DispatchedCount: 0,
            SuppressedCount: 0,
            FailedCount: 0,
            BatchedQueryCount: 0,
            Deliveries: [],
            ErrorMessage: 'Now must be a valid ISO timestamp when provided.',
        };
    }

    const dialect = input.Dialect ?? detectAuditSqlDialect(provider);
    const privilegedUser = await resolvePrivilegedContextUser(provider, actingUser);
    const rv = RunView.FromMetadataProvider(provider);

    const chain = await loadSpaceChainForNotifications(rv, spaceId, privilegedUser, dialect);
    if (!chain) {
        return {
            Success: false,
            EventType: event.EventType,
            TotalCandidateRecipients: 0,
            DispatchedCount: 0,
            SuppressedCount: 0,
            FailedCount: 0,
            BatchedQueryCount: 1,
            Deliveries: [],
            ErrorMessage: `Space '${spaceId}' was not found.`,
        };
    }

    let batchedQueryCount = chain.batchedQueryCount;
    const chainSpaceIds = chain.spacesInChain
        .map((s) => normalizeNoticeUuid(s.ID))
        .filter((id): id is string => id !== null);

    const explicitRecipients: string[] = [];
    const seenExplicit = new Set<string>();
    for (const rawId of input.RecipientUserIDs ?? []) {
        const clean = normalizeNoticeUuid(rawId);
        if (clean && !seenExplicit.has(clean)) {
            seenExplicit.add(clean);
            explicitRecipients.push(clean);
        }
    }

    const includeSpaceMembers =
        input.IncludeSpaceMembers === true || (input.IncludeSpaceMembers !== false && explicitRecipients.length === 0);

    // Load active SpaceMembers across the inherited space chain in batched RunView calls.
    const memberRows: SimpleSpaceMemberRow[] = [];
    const spaceFilter = buildBatchedInFilter('SpaceID', chainSpaceIds, dialect);
    const activeStatusFilter = buildStringEqualsFilter('Status', 'Active', dialect);

    if (includeSpaceMembers) {
        const res = await readEverySimpleRow<SimpleSpaceMemberRow>(
            rv,
            {
                EntityName: SPACE_MEMBERS_ENTITY,
                ExtraFilter: `${spaceFilter} AND ${activeStatusFilter}`,
                Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Band', 'Status'],
            },
            privilegedUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space members: ${res.error}`);
        }
        memberRows.push(...res.rows);
    } else {
        // Query only the explicit recipients + acting caller in batched UserID IN (...) calls.
        const memberLookupIds = [...new Set([auth.userId, ...explicitRecipients])];
        for (const batch of chunkDistinctIds(memberLookupIds)) {
            const res = await readEverySimpleRow<SimpleSpaceMemberRow>(
                rv,
                {
                    EntityName: SPACE_MEMBERS_ENTITY,
                    ExtraFilter: `${spaceFilter} AND ${activeStatusFilter} AND ${buildBatchedInFilter('UserID', batch, dialect)}`,
                    Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Band', 'Status'],
                },
                privilegedUser,
            );
            batchedQueryCount += res.queryCount;
            if (!res.ok) {
                throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space member seats: ${res.error}`);
            }
            memberRows.push(...res.rows);
        }
    }

    const roleIds = memberRows
        .map((m) => normalizeNoticeUuid(m.SpaceRoleTypeID))
        .filter((id): id is string => id !== null);
    const roleById = new Map<string, SimpleSpaceRoleTypeRow>();
    for (const batch of chunkDistinctIds(roleIds)) {
        const res = await readEverySimpleRow<SimpleSpaceRoleTypeRow>(
            rv,
            {
                EntityName: SPACE_ROLE_TYPES_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute', 'IsActive'],
            },
            privilegedUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space role types: ${res.error}`);
        }
        for (const role of res.rows) {
            const rid = normalizeNoticeUuid(role.ID);
            if (rid) roleById.set(rid, role);
        }
    }

    // Build per-user reach across the space chain in memory.
    const reachByUser = new Map<string, { hasReach: boolean; canSeeTeam: boolean; canContribute: boolean; isOwner: boolean }>();
    const grantReach = (uid: string, opts: { canSeeTeam: boolean; canContribute: boolean; isOwner: boolean }) => {
        const existing = reachByUser.get(uid) ?? { hasReach: false, canSeeTeam: false, canContribute: false, isOwner: false };
        existing.hasReach = true;
        if (opts.canSeeTeam || opts.isOwner) existing.canSeeTeam = true;
        if (opts.canContribute || opts.isOwner) existing.canContribute = true;
        if (opts.isOwner) existing.isOwner = true;
        reachByUser.set(uid, existing);
    };

    for (const sp of chain.spacesInChain) {
        const ownerId = normalizeNoticeUuid(sp.OwnerID);
        if (ownerId) {
            grantReach(ownerId, { canSeeTeam: true, canContribute: true, isOwner: true });
        }
    }

    for (const m of memberRows) {
        const uid = normalizeNoticeUuid(m.UserID);
        if (!uid) continue;
        const rid = normalizeNoticeUuid(m.SpaceRoleTypeID);
        const role = rid ? roleById.get(rid) : undefined;
        if (role && role.IsActive === false) continue;
        const canSeeTeam = role ? role.CanSeeTeamBand === true : m.Band === 'Team';
        const isOwner = role ? role.IsOwnerRole === true : false;
        const canContribute = role ? role.CanContribute === true : true;
        grantReach(uid, { canSeeTeam, canContribute, isOwner });
    }

    // Verify caller authorization: acting user must be Owner/System or hold active contribution reach in the space.
    const isSystemCaller = actingUser.Type?.trim() === 'Owner' && !isExternalParticipantUser(actingUser);
    const callerReach = reachByUser.get(auth.userId);
    if (!isSystemCaller) {
        if (!callerReach || !callerReach.hasReach || (!chain.isVisibleStatus && !callerReach.isOwner)) {
            throw new RemoteOperationError('FORBIDDEN', `Caller does not have active reach in space ${spaceId}.`);
        }
        if (chain.isReadOnlyStatus && !callerReach.isOwner) {
            throw new RemoteOperationError('FORBIDDEN', `Space ${spaceId} is currently in a read-only status.`);
        }
        if (!callerReach.isOwner && !callerReach.canContribute) {
            throw new RemoteOperationError('FORBIDDEN', 'Caller role does not have contribution permission in this space.');
        }
        if (event.Band === 'Team' && !callerReach.canSeeTeam) {
            throw new RemoteOperationError('FORBIDDEN', 'Shared-band callers cannot route Team-band notifications.');
        }
    }

    // Candidate recipients: explicit recipients if provided (union space members if IncludeSpaceMembers), else all reachable members.
    const candidateRecipientIds = new Set<string>(explicitRecipients);
    if (includeSpaceMembers) {
        for (const [uid, r] of reachByUser.entries()) {
            if (r.hasReach) {
                candidateRecipientIds.add(uid);
            }
        }
    }

    const orderedCandidateIds = [...candidateRecipientIds];
    if (orderedCandidateIds.length === 0) {
        return {
            Success: true,
            EventType: event.EventType,
            TotalCandidateRecipients: 0,
            DispatchedCount: 0,
            SuppressedCount: 0,
            FailedCount: 0,
            BatchedQueryCount: batchedQueryCount,
            Deliveries: [],
        };
    }

    // Batch-load MJ: Users for all candidates via ID IN (...).
    const userById = new Map<string, SimpleUserRow>();
    for (const batch of chunkDistinctIds(orderedCandidateIds)) {
        const res = await readEverySimpleRow<SimpleUserRow>(
            rv,
            {
                EntityName: USERS_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'Name', 'Email', 'Type', 'IsActive'],
            },
            privilegedUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load recipient users: ${res.error}`);
        }
        for (const u of res.rows) {
            const uid = normalizeNoticeUuid(u.ID);
            if (uid) userById.set(uid, u);
        }
    }

    // Load MJ: User Notification Types once and match the NT-1 event's notification type name.
    const targetTypeName = (event.NotificationTypeNameOverride?.trim() || NT1_NOTIFICATION_TYPE_NAMES[event.EventType]).toLowerCase();
    const typesRes = await readEverySimpleRow<SimpleUserNotificationTypeRow>(
        rv,
        {
            EntityName: USER_NOTIFICATION_TYPES_ENTITY,
            Fields: ['ID', 'Name', 'DefaultInApp', 'DefaultEmail', 'DefaultSMS', 'AllowUserPreference'],
        },
        privilegedUser,
    );
    batchedQueryCount += typesRes.queryCount;
    if (!typesRes.ok) {
        throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load user notification types: ${typesRes.error}`);
    }

    let matchedNotificationType: MJNotificationTypeDefaultSnapshot | null = null;
    for (const row of typesRes.rows) {
        if ((row.Name ?? '').trim().toLowerCase() === targetTypeName) {
            matchedNotificationType = {
                ID: normalizeNoticeUuid(row.ID) ?? row.ID,
                Name: row.Name,
                DefaultInApp: Boolean(row.DefaultInApp),
                DefaultEmail: Boolean(row.DefaultEmail),
                DefaultSMS: Boolean(row.DefaultSMS),
                AllowUserPreference: row.AllowUserPreference !== false,
            };
            break;
        }
    }

    // Batch-load MJ: User Notification Preferences for all candidates via UserID IN (...).
    const mjPrefByUser = new Map<string, MJUserNotificationPreferenceSnapshot>();
    if (matchedNotificationType) {
        for (const batch of chunkDistinctIds(orderedCandidateIds)) {
            const res = await readEverySimpleRow<SimpleUserNotificationPreferenceRow>(
                rv,
                {
                    EntityName: USER_NOTIFICATION_PREFERENCES_ENTITY,
                    ExtraFilter: `${buildBatchedInFilter('UserID', batch, dialect)} AND ${buildUuidEqualsFilter('NotificationTypeID', matchedNotificationType.ID, dialect)}`,
                    Fields: ['ID', 'UserID', 'NotificationTypeID', 'Enabled', 'InAppEnabled', 'EmailEnabled', 'SMSEnabled'],
                },
                privilegedUser,
            );
            batchedQueryCount += res.queryCount;
            if (!res.ok) {
                throw new RemoteOperationError(
                    'EXECUTION_ERROR',
                    `Failed to batch-load user notification preferences: ${res.error}`,
                );
            }
            for (const p of res.rows) {
                const uid = normalizeNoticeUuid(p.UserID);
                if (uid) {
                    mjPrefByUser.set(uid, {
                        UserID: uid,
                        NotificationTypeID: normalizeNoticeUuid(p.NotificationTypeID) ?? p.NotificationTypeID,
                        Enabled: p.Enabled ?? null,
                        InAppEnabled: p.InAppEnabled ?? null,
                        EmailEnabled: p.EmailEnabled ?? null,
                        SMSEnabled: p.SMSEnabled ?? null,
                    });
                }
            }
        }
    }

    // Batch-load MJ: User Settings for Collaboration.NotificationPreferences via UserID IN (...).
    const settingPrefByUser = new Map<string, CollaborationUserNotificationPreferences>();
    for (const batch of chunkDistinctIds(orderedCandidateIds)) {
        const res = await readEverySimpleRow<SimpleUserSettingRow>(
            rv,
            {
                EntityName: USER_SETTINGS_ENTITY,
                ExtraFilter: `${buildBatchedInFilter('UserID', batch, dialect)} AND ${buildStringEqualsFilter('Setting', COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY, dialect)}`,
                Fields: ['ID', 'UserID', 'Setting', 'Value'],
            },
            privilegedUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load user settings: ${res.error}`);
        }
        for (const s of res.rows) {
            const uid = normalizeNoticeUuid(s.UserID);
            if (uid && s.Value) {
                settingPrefByUser.set(uid, parseCollaborationNotificationPreferences(s.Value));
            }
        }
    }

    // Overlay live UserInfoEngine pending/cached setting when loaded for a matching recipient.
    for (const uid of orderedCandidateIds) {
        if (isUserInfoEngineLoadedForUser(userInfoEngine, uid)) {
            const liveRaw = userInfoEngine.GetSetting(COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY);
            if (liveRaw !== undefined) {
                settingPrefByUser.set(uid, parseCollaborationNotificationPreferences(liveRaw));
            }
        }
    }

    const serverActorName = actingUser.Name ?? actingUser.Email ?? null;
    const effectiveEvent: CollaborationNotificationEvent = {
        ...event,
        SpaceID: spaceId,
        SpaceName: event.SpaceName ?? chain.targetSpace.Name ?? null,
        ActorUserID: isSystemCaller ? (normalizeNoticeUuid(event.ActorUserID) ?? auth.userId) : auth.userId,
        ActorName: isSystemCaller ? (event.ActorName ?? serverActorName) : serverActorName,
    };

    const transport = input.DryRun ? null : GetCollaborationCommsV2Transport();
    const deliveries: CollaborationRecipientDeliveryOutcome[] = [];
    let dispatchedCount = 0;
    let suppressedCount = 0;
    let failedCount = 0;

    for (const recipientId of orderedCandidateIds) {
        const userRow = userById.get(recipientId);
        const reach = reachByUser.get(recipientId);
        const isActiveUser = userRow ? userRow.IsActive !== false : false;
        const isHiddenBlocked = !chain.isVisibleStatus && !(reach?.isOwner ?? false);
        const hasSpaceReach = Boolean(isActiveUser && reach?.hasReach && !isHiddenBlocked);

        const candidate: CollaborationRecipientCandidate = {
            UserID: recipientId,
            Name: userRow?.Name ?? null,
            Email: userRow?.Email ?? null,
            HasSpaceReach: hasSpaceReach,
            CanSeeTeamBand: Boolean(reach?.canSeeTeam),
            Preferences: settingPrefByUser.get(recipientId) ?? null,
            MJPreferenceRow: mjPrefByUser.get(recipientId) ?? null,
        };

        const evaluation = evaluateNotificationPreferencesForRecipient({
            Event: effectiveEvent,
            Recipient: candidate,
            NotificationTypeDefault: matchedNotificationType,
            AncestorSpaceIDs: chainSpaceIds.slice(1),
            NowUtc: nowUtc,
            IncludeActor: input.IncludeActor === true,
        });

        if (!evaluation.Permitted || !evaluation.Payload) {
            suppressedCount += 1;
            deliveries.push({
                RecipientUserID: recipientId,
                Permitted: false,
                PermittedChannels: [],
                SuppressedChannels: evaluation.SuppressedChannels,
                SuppressionReasons: evaluation.SuppressionReasons,
                QuietHoursActive: evaluation.QuietHoursActive,
                Dispatched: false,
                DeliveredChannels: [],
                InAppNotificationID: null,
                Payload: null,
            });
            continue;
        }

        if (input.DryRun) {
            deliveries.push({
                RecipientUserID: recipientId,
                Permitted: true,
                PermittedChannels: evaluation.PermittedChannels,
                SuppressedChannels: evaluation.SuppressedChannels,
                SuppressionReasons: evaluation.SuppressionReasons,
                QuietHoursActive: evaluation.QuietHoursActive,
                Dispatched: false,
                DeliveredChannels: [],
                InAppNotificationID: null,
                Payload: evaluation.Payload,
            });
            continue;
        }

        if (!transport) {
            failedCount += 1;
            deliveries.push({
                RecipientUserID: recipientId,
                Permitted: true,
                PermittedChannels: evaluation.PermittedChannels,
                SuppressedChannels: evaluation.SuppressedChannels,
                SuppressionReasons: evaluation.SuppressionReasons,
                QuietHoursActive: evaluation.QuietHoursActive,
                Dispatched: false,
                DeliveredChannels: [],
                InAppNotificationID: null,
                Payload: evaluation.Payload,
                ErrorMessage: 'No Collaboration Comms v2 notification transport is registered.',
            });
            continue;
        }

        try {
            const dispatchResult = await transport.Dispatch({
                Payload: evaluation.Payload,
                NotificationTypeDefault: matchedNotificationType,
                Provider: provider,
                ActingUser: actingUser,
                SystemUser: privilegedUser,
            });
            if (dispatchResult.Success) {
                dispatchedCount += 1;
            } else {
                failedCount += 1;
            }
            deliveries.push({
                RecipientUserID: recipientId,
                Permitted: true,
                PermittedChannels: evaluation.PermittedChannels,
                SuppressedChannels: evaluation.SuppressedChannels,
                SuppressionReasons: evaluation.SuppressionReasons,
                QuietHoursActive: evaluation.QuietHoursActive,
                Dispatched: dispatchResult.Success,
                DeliveredChannels: dispatchResult.DeliveredChannels,
                InAppNotificationID: dispatchResult.InAppNotificationID ?? null,
                Payload: evaluation.Payload,
                ...(dispatchResult.ErrorMessage ? { ErrorMessage: dispatchResult.ErrorMessage } : {}),
            });
        } catch (error) {
            failedCount += 1;
            deliveries.push({
                RecipientUserID: recipientId,
                Permitted: true,
                PermittedChannels: evaluation.PermittedChannels,
                SuppressedChannels: evaluation.SuppressedChannels,
                SuppressionReasons: evaluation.SuppressionReasons,
                QuietHoursActive: evaluation.QuietHoursActive,
                Dispatched: false,
                DeliveredChannels: [],
                InAppNotificationID: null,
                Payload: evaluation.Payload,
                ErrorMessage: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return {
        Success: failedCount === 0,
        EventType: event.EventType,
        TotalCandidateRecipients: orderedCandidateIds.length,
        DispatchedCount: dispatchedCount,
        SuppressedCount: suppressedCount,
        FailedCount: failedCount,
        BatchedQueryCount: batchedQueryCount,
        Deliveries: deliveries,
    };
}

/**
 * Invokes a registered NT-1 {@link BaseRemotableOperation} seamlessly across both server
 * in-process callers (`ExecuteServer`) and GraphQL remote-operation providers (`RouteOperation`).
 */
export async function invokeCollaborationNotificationOperation<TInput, TOutput>(
    operationKey: string,
    input: TInput,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<TOutput> {
    LoadCollaborationNotificationOperations();
    const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation<TInput, TOutput>>(
        BaseRemotableOperation,
        operationKey,
    );
    if (!op) {
        throw new RemoteOperationError('EXECUTION_ERROR', `Operation '${operationKey}' is not registered.`);
    }

    const result = isRemoteOperationCapableProvider(provider)
        ? await op.Execute(input, { provider, user })
        : await op.ExecuteServer(input, { provider, user, emitProgress: () => {} });

    if (!result.Success || result.Output === undefined) {
        throw new RemoteOperationError(
            result.ResultCode ?? 'EXECUTION_ERROR',
            result.ErrorMessage ?? `Operation '${operationKey}' failed.`,
        );
    }
    return result.Output;
}

@RegisterClass(BaseRemotableOperation, ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY)
export class RouteCollaborationNotificationsOperation extends BaseRemotableOperation<
    RouteCollaborationNotificationsInput,
    RouteCollaborationNotificationsResult
> {
    public override readonly OperationKey = ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: RouteCollaborationNotificationsInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: RouteCollaborationNotificationsInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<RouteCollaborationNotificationsResult> {
        return runRouteCollaborationNotifications(provider, user, input);
    }
}

@RegisterClass(BaseRemotableOperation, GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY)
export class GetUserNotificationPreferencesOperation extends BaseRemotableOperation<
    GetUserNotificationPreferencesInput,
    GetUserNotificationPreferencesResult
> {
    public override readonly OperationKey = GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: GetUserNotificationPreferencesInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: GetUserNotificationPreferencesInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<GetUserNotificationPreferencesResult> {
        return runGetUserNotificationPreferences(provider, user, input ?? {});
    }
}

@RegisterClass(BaseRemotableOperation, UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY)
export class UpdateUserNotificationPreferencesOperation extends BaseRemotableOperation<
    UpdateUserNotificationPreferencesInput,
    UpdateUserNotificationPreferencesResult
> {
    public override readonly OperationKey = UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: UpdateUserNotificationPreferencesInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: UpdateUserNotificationPreferencesInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<UpdateUserNotificationPreferencesResult> {
        return runUpdateUserNotificationPreferences(provider, user, input);
    }
}

/**
 * Retains all NT-1 Comms v2 Notification `@RegisterClass(BaseRemotableOperation, ...)`
 * subclasses against bundler tree-shaking on server and client startup.
 */
export function LoadCollaborationNotificationOperations(): void {
    void RouteCollaborationNotificationsOperation;
    void GetUserNotificationPreferencesOperation;
    void UpdateUserNotificationPreferencesOperation;
}
