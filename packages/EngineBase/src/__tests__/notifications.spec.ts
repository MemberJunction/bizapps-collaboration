import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    BaseRemotableOperation,
    type IMetadataProvider,
    type IRunViewProvider,
    ProviderType,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
    NT1_NOTIFICATION_EVENT_TYPES,
    NT1_NOTIFICATION_TYPE_NAMES,
    serializeCollaborationNotificationPreferences,
    createDefaultCollaborationNotificationPreferences,
} from '@mj-biz-apps/collaboration-core';
import {
    type CollaborationCommsV2Transport,
    CollaborationEngineBase,
    type CommsV2TransportDispatchRequest,
    GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
    GetUserNotificationPreferencesOperation,
    LoadCollaborationNotificationOperations,
    readCollaborationPreferencesFromUserInfoEngine,
    RegisterCollaborationCommsV2Transport,
    ResetCollaborationCommsV2Transport,
    ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY,
    RouteCollaborationNotificationsOperation,
    runGetUserNotificationPreferences,
    runRouteCollaborationNotifications,
    runUpdateUserNotificationPreferences,
    UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
    UpdateUserNotificationPreferencesOperation,
    USER_NOTIFICATION_PREFERENCES_ENTITY,
    USER_NOTIFICATION_TYPES_ENTITY,
    USER_SETTINGS_ENTITY,
    type UserInfoEnginePreferenceBridge,
    USERS_ENTITY,
    writeCollaborationPreferencesToUserInfoEngine,
} from '../index.js';

interface MockRow {
    ID: string;
    Name?: string | null;
    Email?: string | null;
    Type?: string | null;
    IsActive?: boolean;
    ParentID?: string | null;
    SpaceTypeID?: string;
    OwnerID?: string;
    InheritsMembership?: boolean;
    StatusID?: string | null;
    SpaceID?: string;
    UserID?: string;
    SpaceRoleTypeID?: string;
    Band?: string;
    Status?: string;
    CanSeeTeamBand?: boolean;
    IsOwnerRole?: boolean;
    CanContribute?: boolean;
    Visible?: boolean;
    ReadOnly?: boolean;
    Setting?: string;
    Value?: string | null;
    NotificationTypeID?: string;
    Enabled?: boolean | null;
    InAppEnabled?: boolean | null;
    EmailEnabled?: boolean | null;
    SMSEnabled?: boolean | null;
    DefaultInApp?: boolean;
    DefaultEmail?: boolean;
    DefaultSMS?: boolean;
    AllowUserPreference?: boolean;
}

const ACTOR_ID = '11111111-1111-4111-8111-111111111101';
const TEAM_USER_ID = '11111111-1111-4111-8111-111111111102';
const SHARED_USER_ID = '11111111-1111-4111-8111-111111111103';
const QUIET_USER_ID = '11111111-1111-4111-8111-111111111104';
const MUTED_USER_ID = '11111111-1111-4111-8111-111111111105';
const OUTSIDER_ID = '11111111-1111-4111-8111-111111111199';

const ROLE_TEAM_ID = '22222222-2222-4222-8222-222222222201';
const ROLE_SHARED_ID = '22222222-2222-4222-8222-222222222202';
const STATUS_OPEN_ID = '33333333-3333-4333-8333-333333333301';
const SPACE_ROOT_ID = '44444444-4444-4444-8444-444444444401';
const SPACE_CHILD_ID = '44444444-4444-4444-8444-444444444402';
const SPACE_TYPE_ID = '55555555-5555-4555-8555-555555555501';

const TYPE_MENTION_ID = '66666666-6666-4666-8666-666666666601';
const TYPE_STATUS_ID = '66666666-6666-4666-8666-666666666604';

function makeUser(id: string, opts?: { isMagicLinkAnonymous?: boolean; type?: string }): UserInfo {
    const u: Partial<UserInfo> = {
        ID: id,
        Name: `User-${id.slice(-4)}`,
        Email: `user-${id.slice(-4)}@example.com`,
        Type: opts?.type ?? 'User',
        IsActive: true,
        IsMagicLinkAnonymous: opts?.isMagicLinkAnonymous ?? false,
        UserRoles: [],
    };
    return u as UserInfo;
}

function matchesFilter(row: MockRow, rawFilter: string | undefined): boolean {
    if (!rawFilter || rawFilter.trim() === '') return true;
    const clauses = rawFilter.split(/\s+AND\s+/i).map((c) => c.trim());
    for (const clause of clauses) {
        if (clause === '1 = 0') return false;
        const eq = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s*=\s*(.+)$/.exec(clause);
        if (eq) {
            const field = eq[1];
            const rawVal = eq[2].trim();
            const val = rawVal.startsWith("'") && rawVal.endsWith("'") ? rawVal.slice(1, -1).replace(/''/g, "'") : rawVal;
            const actual = row[field as keyof MockRow];
            if (typeof actual === 'boolean') {
                if ((val === '1' || val === 'true') !== actual) return false;
            } else if (String(actual ?? '').toLowerCase() !== val.toLowerCase()) {
                return false;
            }
            continue;
        }
        const inMatch = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s+IN\s*\(([^)]+)\)$/i.exec(clause);
        if (inMatch) {
            const field = inMatch[1];
            const allowed = inMatch[2]
                .split(',')
                .map((s) => s.trim().replace(/^'/, '').replace(/'$/, '').toLowerCase());
            const actual = String(row[field as keyof MockRow] ?? '').toLowerCase();
            if (!allowed.includes(actual)) return false;
        }
    }
    return true;
}

class MockUserSettingEntity implements MockRow {
    public ID = '';
    public UserID = '';
    public Setting = '';
    public Value: string | null = null;
    public LatestResult: { CompleteMessage?: string; Message?: string } | null = null;

    constructor(
        private readonly rows: MockRow[],
        private readonly nextId: () => string,
    ) {}

    public NewRecord(): void {
        this.ID = '';
    }

    public async Load(id: string): Promise<boolean> {
        const found = this.rows.find((r) => r.ID.toLowerCase() === id.toLowerCase());
        if (!found) return false;
        Object.assign(this, found);
        return true;
    }

    public async Save(): Promise<boolean> {
        if (!this.ID) {
            this.ID = this.nextId();
        }
        const row: MockRow = {
            ID: this.ID,
            UserID: this.UserID,
            Setting: this.Setting,
            Value: this.Value,
        };
        const idx = this.rows.findIndex((r) => r.ID.toLowerCase() === this.ID.toLowerCase());
        if (idx >= 0) this.rows[idx] = row;
        else this.rows.push(row);
        return true;
    }
}

interface NotificationStore {
    spaces: MockRow[];
    spaceMembers: MockRow[];
    spaceRoleTypes: MockRow[];
    spaceTypeStatuses: MockRow[];
    users: MockRow[];
    notificationTypes: MockRow[];
    notificationPreferences: MockRow[];
    userSettings: MockRow[];
    runViewCalls: RunViewParams[];
}

function createNotificationStore(): NotificationStore {
    return {
        spaces: [
            {
                ID: SPACE_ROOT_ID,
                Name: 'Root Engagement',
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ACTOR_ID,
                InheritsMembership: false,
                StatusID: STATUS_OPEN_ID,
            },
            {
                ID: SPACE_CHILD_ID,
                Name: 'Inherited Child',
                ParentID: SPACE_ROOT_ID,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ACTOR_ID,
                InheritsMembership: true,
                StatusID: STATUS_OPEN_ID,
            },
        ],
        spaceMembers: [
            { ID: '70000001-0000-4000-8000-000000000001', SpaceID: SPACE_ROOT_ID, UserID: TEAM_USER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
            { ID: '70000001-0000-4000-8000-000000000002', SpaceID: SPACE_ROOT_ID, UserID: SHARED_USER_ID, SpaceRoleTypeID: ROLE_SHARED_ID, Band: 'Shared', Status: 'Active' },
            { ID: '70000001-0000-4000-8000-000000000003', SpaceID: SPACE_ROOT_ID, UserID: QUIET_USER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
            { ID: '70000001-0000-4000-8000-000000000004', SpaceID: SPACE_ROOT_ID, UserID: MUTED_USER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
        ],
        spaceRoleTypes: [
            { ID: ROLE_TEAM_ID, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true },
            { ID: ROLE_SHARED_ID, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true, IsActive: true },
        ],
        spaceTypeStatuses: [
            { ID: STATUS_OPEN_ID, Visible: true, ReadOnly: false },
        ],
        users: [
            { ID: ACTOR_ID, Name: 'Actor', Email: 'actor@example.com', Type: 'User', IsActive: true },
            { ID: TEAM_USER_ID, Name: 'Team Member', Email: 'team@example.com', Type: 'User', IsActive: true },
            { ID: SHARED_USER_ID, Name: 'Shared Member', Email: 'shared@example.com', Type: 'User', IsActive: true },
            { ID: QUIET_USER_ID, Name: 'Quiet Member', Email: 'quiet@example.com', Type: 'User', IsActive: true },
            { ID: MUTED_USER_ID, Name: 'Muted Member', Email: 'muted@example.com', Type: 'User', IsActive: true },
            { ID: OUTSIDER_ID, Name: 'Outsider', Email: 'outsider@example.com', Type: 'User', IsActive: true },
        ],
        notificationTypes: [
            { ID: TYPE_MENTION_ID, Name: NT1_NOTIFICATION_TYPE_NAMES.Mention, DefaultInApp: true, DefaultEmail: true, DefaultSMS: false, AllowUserPreference: true },
            { ID: TYPE_STATUS_ID, Name: NT1_NOTIFICATION_TYPE_NAMES.StatusChanged, DefaultInApp: true, DefaultEmail: false, DefaultSMS: false, AllowUserPreference: true },
        ],
        notificationPreferences: [
            // Shared member opted out of email for Mention in MJ User Notification Preferences
            {
                ID: '80000001-0000-4000-8000-000000000001',
                UserID: SHARED_USER_ID,
                NotificationTypeID: TYPE_MENTION_ID,
                Enabled: true,
                InAppEnabled: true,
                EmailEnabled: false,
                SMSEnabled: false,
            },
        ],
        userSettings: [
            {
                ID: '90000001-0000-4000-8000-000000000001',
                UserID: QUIET_USER_ID,
                Setting: COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
                Value: serializeCollaborationNotificationPreferences({
                    ...createDefaultCollaborationNotificationPreferences(),
                    Channels: { InApp: true, Email: true, SMS: false, Chat: true },
                    QuietHours: {
                        Enabled: true,
                        StartTime: '22:00',
                        EndTime: '07:00',
                        Timezone: 'America/Chicago',
                        SuppressedChannels: ['Email', 'SMS', 'Chat'],
                    },
                }),
            },
            {
                ID: '90000001-0000-4000-8000-000000000002',
                UserID: MUTED_USER_ID,
                Setting: COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
                Value: serializeCollaborationNotificationPreferences({
                    ...createDefaultCollaborationNotificationPreferences(),
                    MutedSpaceIDs: [SPACE_ROOT_ID],
                }),
            },
        ],
        runViewCalls: [],
    };
}

function createProvider(store: NotificationStore): IMetadataProvider {
    let seq = 1;
    const impl: Partial<IMetadataProvider & IRunViewProvider> = {
        ProviderType: ProviderType.Database,
        Entities: [],
        RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
            store.runViewCalls.push(params);
            let src: MockRow[] = [];
            switch (params.EntityName) {
                case 'MJ_BizApps_Collaboration: Spaces':
                    src = store.spaces;
                    break;
                case 'MJ_BizApps_Collaboration: Space Members':
                    src = store.spaceMembers;
                    break;
                case 'MJ_BizApps_Collaboration: Space Role Types':
                    src = store.spaceRoleTypes;
                    break;
                case 'MJ_BizApps_Collaboration: Space Type Status':
                    src = store.spaceTypeStatuses;
                    break;
                case USERS_ENTITY:
                    src = store.users;
                    break;
                case USER_NOTIFICATION_TYPES_ENTITY:
                    src = store.notificationTypes;
                    break;
                case USER_NOTIFICATION_PREFERENCES_ENTITY:
                    src = store.notificationPreferences;
                    break;
                case USER_SETTINGS_ENTITY:
                    src = store.userSettings;
                    break;
            }
            const extra = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : undefined;
            const filtered = src.filter((r) => matchesFilter(r, extra));
            const sorted = [...filtered].sort((a, b) => a.ID.toLowerCase().localeCompare(b.ID.toLowerCase()));
            const limited = typeof params.MaxRows === 'number' && params.MaxRows > 0 ? sorted.slice(0, params.MaxRows) : sorted;
            return {
                Success: true,
                Results: limited.map((r) => ({ ...r }) as T),
                UserViewRunID: '',
                RowCount: limited.length,
                TotalRowCount: filtered.length,
                ExecutionTime: 1,
                ErrorMessage: '',
            };
        },
        GetEntityObject: async <T>(entityName: string): Promise<T> => {
            if (entityName === USER_SETTINGS_ENTITY) {
                return new MockUserSettingEntity(
                    store.userSettings,
                    () => `99999999-9999-4999-8999-${(++seq).toString(16).padStart(12, '0')}`,
                ) as T;
            }
            throw new Error(`Unexpected entity '${entityName}'`);
        },
    };
    return impl as IMetadataProvider;
}

describe('NT-1 Comms v2 EngineBase routing & UserInfoEngine preference enforcement', () => {
    const dispatchedRequests: CommsV2TransportDispatchRequest[] = [];

    beforeEach(() => {
        dispatchedRequests.length = 0;
        LoadCollaborationNotificationOperations();
        const spyTransport: CollaborationCommsV2Transport = {
            Name: 'UnitTestSpyCommsV2Transport',
            Dispatch: async (req) => {
                dispatchedRequests.push(req);
                return {
                    Success: true,
                    DeliveredChannels: Object.entries(req.Payload.Channels)
                        .filter(([, enabled]) => enabled)
                        .map(([ch]) => ch as 'InApp' | 'Email' | 'SMS' | 'Chat'),
                    InAppNotificationID: req.Payload.Channels.InApp ? `notif-${req.Payload.RecipientUserID.slice(-4)}` : null,
                    EmailDispatched: req.Payload.Channels.Email,
                    SMSDispatched: req.Payload.Channels.SMS,
                    ChatDispatched: req.Payload.Channels.Chat,
                };
            },
        };
        RegisterCollaborationCommsV2Transport(spyTransport);
    });

    afterEach(() => {
        ResetCollaborationCommsV2Transport();
    });

    it('registers NT-1 BaseRemotableOperation subclasses and rejects anonymous magic-link sessions', async () => {
        for (const key of [
            ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY,
            GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
            UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
        ]) {
            const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation>(
                BaseRemotableOperation,
                key,
            );
            expect(op).toBeDefined();
        }
        expect(
            MJGlobal.Instance.ClassFactory.CreateInstance(BaseRemotableOperation, ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY),
        ).toBeInstanceOf(RouteCollaborationNotificationsOperation);
        expect(
            MJGlobal.Instance.ClassFactory.CreateInstance(BaseRemotableOperation, GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY),
        ).toBeInstanceOf(GetUserNotificationPreferencesOperation);
        expect(
            MJGlobal.Instance.ClassFactory.CreateInstance(BaseRemotableOperation, UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY),
        ).toBeInstanceOf(UpdateUserNotificationPreferencesOperation);

        const store = createNotificationStore();
        const provider = createProvider(store);
        const anon = makeUser(TEAM_USER_ID, { isMagicLinkAnonymous: true });
        await expect(
            CollaborationEngineBase.Instance.GetUserNotificationPreferences(anon, {}, provider),
        ).rejects.toThrow(/magic-link/i);
    });

    it('reads and updates preferences via UserInfoEngine debounced settings without localStorage', async () => {
        const settingsMap = new Map<string, string>();
        let pendingCalls = 0;
        let flushCalls = 0;
        const bridge: UserInfoEnginePreferenceBridge = {
            LoadedForUserId: TEAM_USER_ID,
            GetSetting: (k) => settingsMap.get(k),
            SetSettingDebounced: (k, v) => {
                pendingCalls += 1;
                settingsMap.set(k, v);
            },
            FlushPendingSettings: async () => {
                flushCalls += 1;
            },
        };

        const initial = readCollaborationPreferencesFromUserInfoEngine(bridge);
        expect(initial.Enabled).toBe(true);

        const updated = await writeCollaborationPreferencesToUserInfoEngine(
            {
                Channels: { InApp: true, Email: false },
                EventSubscriptions: { StatusChanged: false },
                QuietHours: {
                    Enabled: true,
                    StartTime: '22:00',
                    EndTime: '06:30',
                    Timezone: 'America/New_York',
                },
            },
            { contextUser: makeUser(TEAM_USER_ID), flush: true, userInfoEngine: bridge },
        );

        expect(pendingCalls).toBe(1);
        expect(flushCalls).toBe(1);
        expect(updated.Channels.Email).toBe(false);
        expect(updated.EventSubscriptions.StatusChanged).toBe(false);

        const store = createNotificationStore();
        const provider = createProvider(store);
        const fetched = await runGetUserNotificationPreferences(provider, makeUser(TEAM_USER_ID), {}, bridge);
        expect(fetched.Source).toBe('user-info-engine');
        expect(fetched.Preferences.QuietHours?.Timezone).toBe('America/New_York');

        // Multi-user server update for another user (not loaded in bridge) falls back cleanly to MJ: User Settings entity save
        const otherRes = await runUpdateUserNotificationPreferences(
            provider,
            makeUser(SHARED_USER_ID),
            {
                Patch: { MuteSpaceIDsToAdd: [SPACE_CHILD_ID] },
            },
            bridge,
        );
        expect(otherRes.SavedVia).toBe('entity-save');
        expect(otherRes.Preferences.MutedSpaceIDs).toEqual([SPACE_CHILD_ID]);
    });

    it('batches multi-recipient lookups with ResultType=simple and enforces preferences before Comms v2 dispatch', async () => {
        const store = createNotificationStore();
        // Add 25 extra active members on SPACE_ROOT to prove zero N+1 query scaling
        for (let i = 10; i < 35; i++) {
            const extraUid = `11111111-1111-4111-8111-1111111100${i}`;
            store.spaceMembers.push({
                ID: `70000001-0000-4000-8000-0000000000${i}`,
                SpaceID: SPACE_ROOT_ID,
                UserID: extraUid,
                SpaceRoleTypeID: ROLE_SHARED_ID,
                Band: 'Shared',
                Status: 'Active',
            });
            store.users.push({
                ID: extraUid,
                Name: `Bulk User ${i}`,
                Email: `bulk-${i}@example.com`,
                Type: 'User',
                IsActive: true,
            });
        }

        const provider = createProvider(store);
        const actor = makeUser(ACTOR_ID);

        // 04:30 UTC = 22:30 America/Chicago -> QUIET_USER_ID has quiet hours active (suppresses Email/Chat, keeps InApp)
        const result = await runRouteCollaborationNotifications(provider, actor, {
            Event: {
                EventType: 'Mention',
                SpaceID: SPACE_CHILD_ID,
                Band: 'Shared',
                Title: 'Team review needed',
                Body: 'Please review the milestone notes.',
            },
            IncludeSpaceMembers: true,
            RecipientUserIDs: [OUTSIDER_ID],
            Now: '2026-11-23T04:30:00.000Z',
        });

        expect(result.Success).toBe(true);
        // Zero N+1: total RunView calls must be constant (~8 batched calls) regardless of 30+ recipients
        expect(result.BatchedQueryCount).toBeLessThanOrEqual(12);
        expect(store.runViewCalls.every((c) => c.ResultType === 'simple')).toBe(true);

        // Excluded actor + outsider (NoSpaceReach) + muted space user -> never dispatched
        const byUser = new Map(result.Deliveries.map((d) => [d.RecipientUserID, d]));
        expect(byUser.get(OUTSIDER_ID)?.Dispatched).toBe(false);
        expect(byUser.get(OUTSIDER_ID)?.SuppressionReasons).toContain('NoSpaceReach');

        expect(byUser.get(MUTED_USER_ID)?.Dispatched).toBe(false);
        expect(byUser.get(MUTED_USER_ID)?.SuppressionReasons).toContain('SpaceMuted');

        // Shared user opted out of Email in MJ User Notification Preferences -> InApp only
        expect(byUser.get(SHARED_USER_ID)?.Dispatched).toBe(true);
        expect(byUser.get(SHARED_USER_ID)?.DeliveredChannels).toEqual(['InApp']);

        // Quiet hours user during 22:30 Chicago -> Email & Chat suppressed, InApp delivered
        expect(byUser.get(QUIET_USER_ID)?.QuietHoursActive).toBe(true);
        expect(byUser.get(QUIET_USER_ID)?.DeliveredChannels).toEqual(['InApp']);

        // Team user receives both InApp and Email (from Mention type defaults)
        expect(byUser.get(TEAM_USER_ID)?.DeliveredChannels).toEqual(['InApp', 'Email']);

        // Verify transport was NEVER invoked for muted user or outsider
        expect(dispatchedRequests.some((r) => r.Payload.RecipientUserID === MUTED_USER_ID)).toBe(false);
        expect(dispatchedRequests.some((r) => r.Payload.RecipientUserID === OUTSIDER_ID)).toBe(false);
    });

    it('isolates Team-band notifications from Shared-only members and supports all 6 event types', async () => {
        const store = createNotificationStore();
        const provider = createProvider(store);
        const actor = makeUser(ACTOR_ID);

        for (const eventType of NT1_NOTIFICATION_EVENT_TYPES) {
            dispatchedRequests.length = 0;
            const res = await CollaborationEngineBase.Instance.RouteCollaborationNotifications(
                {
                    Event: {
                        EventType: eventType,
                        SpaceID: SPACE_ROOT_ID,
                        Band: 'Team',
                        Title: `Team ${eventType}`,
                    },
                    RecipientUserIDs: [TEAM_USER_ID, SHARED_USER_ID],
                    IncludeSpaceMembers: false,
                    Now: '2026-11-23T18:00:00.000Z',
                },
                actor,
                provider,
            );
            expect(res.Success).toBe(true);
            const sharedOutcome = res.Deliveries.find((d) => d.RecipientUserID === SHARED_USER_ID);
            const teamOutcome = res.Deliveries.find((d) => d.RecipientUserID === TEAM_USER_ID);
            expect(sharedOutcome?.Dispatched).toBe(false);
            expect(sharedOutcome?.SuppressionReasons).toContain('NoSpaceReach');
            expect(teamOutcome?.Dispatched).toBe(true);
            expect(dispatchedRequests.every((r) => r.Payload.RecipientUserID !== SHARED_USER_ID)).toBe(true);
            expect(dispatchedRequests.some((r) => r.Payload.EventType === eventType)).toBe(true);
        }
    });
});
