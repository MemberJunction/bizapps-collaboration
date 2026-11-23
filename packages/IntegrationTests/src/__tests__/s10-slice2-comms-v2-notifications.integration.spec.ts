import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    ProviderType,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import {
    NT1_NOTIFICATION_EVENT_TYPES,
    NT1_NOTIFICATION_TYPE_NAMES,
    type CollaborationNotificationEventType,
} from '@mj-biz-apps/collaboration-core';
import {
    CollaborationEngine,
    type CollaborationCommsV2Transport,
    type CommsV2TransportDispatchRequest,
    LoadCollaborationNotificationOperations,
    RegisterCollaborationCommsV2Transport,
    ResetCollaborationCommsV2Transport,
    USER_NOTIFICATION_PREFERENCES_ENTITY,
    USER_NOTIFICATION_TYPES_ENTITY,
    USER_SETTINGS_ENTITY,
    USERS_ENTITY,
} from '@mj-biz-apps/collaboration-core-entities-server';

interface WorldRow {
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

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const ADA_STAFF_ID = 'D2000001-0000-4000-8000-000000000001';
const SAM_STAFF_ID = 'D2000001-0000-4000-8000-000000000002';
const CASEY_EXT_ID = 'D2000001-0000-4000-8000-000000000003';
const BEA_QUIET_ID = 'D2000001-0000-4000-8000-000000000004';
const LEE_MUTED_ID = 'D2000001-0000-4000-8000-000000000005';
const OUTSIDER_ID = 'D2000001-0000-4000-8000-000000000099';

const ROOT_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const CHILD_DELIVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000003';
const SPACE_TYPE_ID = 'B1000001-0000-4000-8000-000000000001';

const ROLE_TEAM_MEMBER_ID = '03AD14E2-341A-4AC6-BA9D-E7AA5B31647B';
const ROLE_EXTERNAL_ID = '7F565CD3-5E5C-4073-AD3D-55EFE85B0D40';
const STATUS_ACTIVE_ID = '33333333-3333-4333-8333-333333333301';

const TARGET_ENTITY_ID = 'E1000001-0000-4000-8000-000000000001';
const MUTED_ITEM_ID = 'F1000001-0000-4000-8000-000000000001';

function makeWorldUser(id: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const u: Partial<UserInfo> = {
        ID: id,
        Name: `WorldUser-${id.slice(-4)}`,
        Email: `world-${id.slice(-4)}@example.com`,
        Type: type,
        IsActive: true,
        UserRoles: [],
    };
    return u as UserInfo;
}

function matchesWorldFilter(row: WorldRow, filterRaw: string | undefined): boolean {
    if (!filterRaw || filterRaw.trim() === '') return true;
    const clauses = filterRaw.split(/\s+AND\s+/i).map((c) => c.trim());
    for (const clause of clauses) {
        if (clause === '1 = 0') return false;
        const eq = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s*=\s*(.+)$/.exec(clause);
        if (eq) {
            const field = eq[1];
            const rawVal = eq[2].trim();
            const val = rawVal.startsWith("'") && rawVal.endsWith("'") ? rawVal.slice(1, -1).replace(/''/g, "'") : rawVal;
            const actual = row[field as keyof WorldRow];
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
            const actual = String(row[field as keyof WorldRow] ?? '').toLowerCase();
            if (!allowed.includes(actual)) return false;
        }
    }
    return true;
}

class WorldSettingEntityProxy implements WorldRow {
    public ID = '';
    public UserID = '';
    public Setting = '';
    public Value: string | null = null;
    public LatestResult: { CompleteMessage?: string; Message?: string } | null = null;

    constructor(
        private readonly rows: WorldRow[],
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
        if (!this.ID) this.ID = this.nextId();
        const row: WorldRow = {
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

describe('S10 Slice 2 World-Data-Model NT-1 Comms v2 Integration', () => {
    let savedGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    const dispatchedPayloads: CommsV2TransportDispatchRequest[] = [];

    beforeEach(() => {
        dispatchedPayloads.length = 0;
        LoadCollaborationNotificationOperations();
        savedGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeWorldUser(SYSTEM_USER_ID, 'Owner');

        const transport: CollaborationCommsV2Transport = {
            Name: 'IntegrationSpyCommsV2Transport',
            Dispatch: async (req) => {
                dispatchedPayloads.push(req);
                return {
                    Success: true,
                    DeliveredChannels: Object.entries(req.Payload.Channels)
                        .filter(([, enabled]) => enabled)
                        .map(([ch]) => ch as 'InApp' | 'Email' | 'SMS' | 'Chat'),
                    InAppNotificationID: req.Payload.Channels.InApp ? `inapp-${req.Payload.RecipientUserID.slice(-4)}` : null,
                    EmailDispatched: req.Payload.Channels.Email,
                    SMSDispatched: req.Payload.Channels.SMS,
                    ChatDispatched: req.Payload.Channels.Chat,
                };
            },
        };
        RegisterCollaborationCommsV2Transport(transport);
    });

    afterEach(() => {
        WellKnownUserSource.Instance.GetSystemUser = savedGetSystemUser;
        ResetCollaborationCommsV2Transport();
    });

    it('routes all 6 NT-1 event types with batched RunView lookups, UserInfoEngine/UserSettings preferences, quiet hours, and muted scopes', async () => {
        const spaces: WorldRow[] = [
            {
                ID: ROOT_SPACE_ID,
                Name: 'Client Advisory',
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ADA_STAFF_ID,
                InheritsMembership: false,
                StatusID: STATUS_ACTIVE_ID,
            },
            {
                ID: CHILD_DELIVERY_SPACE_ID,
                Name: 'Delivery Workstream',
                ParentID: ROOT_SPACE_ID,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ADA_STAFF_ID,
                InheritsMembership: true,
                StatusID: STATUS_ACTIVE_ID,
            },
        ];

        const spaceMembers: WorldRow[] = [
            { ID: '66666666-6666-4666-8666-000000000001', SpaceID: ROOT_SPACE_ID, UserID: SAM_STAFF_ID, SpaceRoleTypeID: ROLE_TEAM_MEMBER_ID, Band: 'Team', Status: 'Active' },
            { ID: '66666666-6666-4666-8666-000000000002', SpaceID: ROOT_SPACE_ID, UserID: CASEY_EXT_ID, SpaceRoleTypeID: ROLE_EXTERNAL_ID, Band: 'Shared', Status: 'Active' },
            { ID: '66666666-6666-4666-8666-000000000003', SpaceID: ROOT_SPACE_ID, UserID: BEA_QUIET_ID, SpaceRoleTypeID: ROLE_EXTERNAL_ID, Band: 'Shared', Status: 'Active' },
            { ID: '66666666-6666-4666-8666-000000000004', SpaceID: ROOT_SPACE_ID, UserID: LEE_MUTED_ID, SpaceRoleTypeID: ROLE_TEAM_MEMBER_ID, Band: 'Team', Status: 'Active' },
        ];

        const users: WorldRow[] = [
            { ID: ADA_STAFF_ID, Name: 'Ada Staff', Email: 'ada@example.com', Type: 'User', IsActive: true },
            { ID: SAM_STAFF_ID, Name: 'Sam Staff', Email: 'sam@example.com', Type: 'User', IsActive: true },
            { ID: CASEY_EXT_ID, Name: 'Casey External', Email: 'casey@example.com', Type: 'User', IsActive: true },
            { ID: BEA_QUIET_ID, Name: 'Bea Quiet', Email: 'bea@example.com', Type: 'User', IsActive: true },
            { ID: LEE_MUTED_ID, Name: 'Lee Muted', Email: 'lee@example.com', Type: 'User', IsActive: true },
            { ID: OUTSIDER_ID, Name: 'Outsider', Email: 'outsider@example.com', Type: 'User', IsActive: true },
        ];

        // Scale to 50+ reachable members to verify zero N+1 query loops during multi-recipient fan-out.
        for (let i = 10; i < 60; i++) {
            const uid = `77777777-7777-4777-8777-${i.toString(16).padStart(12, '0')}`;
            spaceMembers.push({
                ID: `66666666-6666-4666-8666-${i.toString(16).padStart(12, '0')}`,
                SpaceID: ROOT_SPACE_ID,
                UserID: uid,
                SpaceRoleTypeID: ROLE_EXTERNAL_ID,
                Band: 'Shared',
                Status: 'Active',
            });
            users.push({
                ID: uid,
                Name: `WorldBulk-${i}`,
                Email: `bulk-${i}@example.com`,
                Type: 'User',
                IsActive: true,
            });
        }

        const notificationTypes: WorldRow[] = NT1_NOTIFICATION_EVENT_TYPES.map((evt, idx) => ({
            ID: `88888888-8888-4888-8888-${(idx + 1).toString(16).padStart(12, '0')}`,
            Name: NT1_NOTIFICATION_TYPE_NAMES[evt],
            DefaultInApp: true,
            DefaultEmail: evt === 'Mention' || evt === 'Approval',
            DefaultSMS: false,
            AllowUserPreference: true,
        }));

        const notificationPreferences: WorldRow[] = [
            // Casey opts out of Email for Mention
            {
                ID: '91000001-0000-4000-8000-000000000001',
                UserID: CASEY_EXT_ID,
                NotificationTypeID: notificationTypes[0].ID,
                Enabled: true,
                InAppEnabled: true,
                EmailEnabled: false,
                SMSEnabled: false,
            },
        ];

        const userSettings: WorldRow[] = [];
        const capturedQueries: RunViewParams[] = [];
        let seq = 1;

        const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
            ProviderType: ProviderType.Database,
            Entities: [],
            RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
                capturedQueries.push(params);
                let src: WorldRow[] = [];
                switch (params.EntityName) {
                    case 'MJ_BizApps_Collaboration: Spaces':
                        src = spaces;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Members':
                        src = spaceMembers;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Role Types':
                        src = [
                            { ID: ROLE_TEAM_MEMBER_ID, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true },
                            { ID: ROLE_EXTERNAL_ID, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true, IsActive: true },
                        ];
                        break;
                    case 'MJ_BizApps_Collaboration: Space Type Status':
                        src = [{ ID: STATUS_ACTIVE_ID, Visible: true, ReadOnly: false }];
                        break;
                    case USERS_ENTITY:
                        src = users;
                        break;
                    case USER_NOTIFICATION_TYPES_ENTITY:
                        src = notificationTypes;
                        break;
                    case USER_NOTIFICATION_PREFERENCES_ENTITY:
                        src = notificationPreferences;
                        break;
                    case USER_SETTINGS_ENTITY:
                        src = userSettings;
                        break;
                }
                const extraFilterText = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : undefined;
                const filtered = src.filter((r) => matchesWorldFilter(r, extraFilterText));
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
                    return new WorldSettingEntityProxy(
                        userSettings,
                        () => `99999999-9999-4999-8999-${(++seq).toString(16).padStart(12, '0')}`,
                    ) as T;
                }
                throw new Error(`Unexpected entity '${entityName}'`);
            },
        };

        const provider = providerImpl as IMetadataProvider;
        const engine = CollaborationEngine.Instance;
        const ada = makeWorldUser(ADA_STAFF_ID);
        const sam = makeWorldUser(SAM_STAFF_ID);
        const bea = makeWorldUser(BEA_QUIET_ID);
        const lee = makeWorldUser(LEE_MUTED_ID);

        // Configure preferences via BaseRemotableOperation RPCs
        await engine.UpdateUserNotificationPreferences(
            {
                Patch: {
                    Channels: { InApp: true, Email: true, SMS: false, Chat: true },
                    QuietHours: {
                        Enabled: true,
                        StartTime: '22:00',
                        EndTime: '07:00',
                        Timezone: 'America/Chicago',
                        SuppressedChannels: ['Email', 'SMS', 'Chat'],
                    },
                },
            },
            bea,
            provider,
        );

        await engine.UpdateUserNotificationPreferences(
            {
                Patch: {
                    MuteItemKeysToAdd: [`${TARGET_ENTITY_ID}|${MUTED_ITEM_ID}`],
                    EventSubscriptions: { StatusChanged: false },
                },
            },
            lee,
            provider,
        );

        const beaFetched = await engine.GetUserNotificationPreferences({}, bea, provider);
        expect(beaFetched.Preferences.QuietHours?.Timezone).toBe('America/Chicago');

        // 1. Mention event at 04:30 UTC (22:30 America/Chicago) across 55+ members + outsider
        capturedQueries.length = 0;
        dispatchedPayloads.length = 0;
        const mentionResult = await engine.RouteCollaborationNotifications(
            {
                Event: {
                    EventType: 'Mention',
                    SpaceID: CHILD_DELIVERY_SPACE_ID,
                    Band: 'Shared',
                    Title: 'Ada mentioned team on deliverable',
                    TargetEntityID: TARGET_ENTITY_ID,
                    TargetRecordID: MUTED_ITEM_ID,
                },
                IncludeSpaceMembers: true,
                RecipientUserIDs: [OUTSIDER_ID],
                Now: '2026-11-23T04:30:00.000Z',
            },
            ada,
            provider,
        );

        expect(mentionResult.Success).toBe(true);
        expect(mentionResult.TotalCandidateRecipients).toBeGreaterThanOrEqual(55);
        // Zero N+1 loops: constant number of batched queries regardless of 55+ recipients
        expect(mentionResult.BatchedQueryCount).toBeLessThanOrEqual(12);
        expect(capturedQueries.every((q) => q.ResultType === 'simple')).toBe(true);

        const mentionMap = new Map(mentionResult.Deliveries.map((d) => [d.RecipientUserID, d]));
        expect(mentionMap.get(OUTSIDER_ID.toLowerCase())?.Dispatched).toBe(false);
        expect(mentionMap.get(OUTSIDER_ID.toLowerCase())?.SuppressionReasons).toContain('NoSpaceReach');

        // Lee muted this specific target item -> suppressed before Comms v2 dispatch
        expect(mentionMap.get(LEE_MUTED_ID.toLowerCase())?.Dispatched).toBe(false);
        expect(mentionMap.get(LEE_MUTED_ID.toLowerCase())?.SuppressionReasons).toContain('ItemMuted');

        // Bea is in overnight quiet hours (22:30 Chicago) -> Email & Chat suppressed, InApp delivered
        expect(mentionMap.get(BEA_QUIET_ID.toLowerCase())?.QuietHoursActive).toBe(true);
        expect(mentionMap.get(BEA_QUIET_ID.toLowerCase())?.DeliveredChannels).toEqual(['InApp']);

        // Casey opted out of Email in MJ User Notification Preferences -> InApp only
        expect(mentionMap.get(CASEY_EXT_ID.toLowerCase())?.DeliveredChannels).toEqual(['InApp']);

        // Sam has no opt-outs -> InApp + Email
        expect(mentionMap.get(SAM_STAFF_ID.toLowerCase())?.DeliveredChannels).toEqual(['InApp', 'Email']);

        // Verify zero transport invocations for muted/outsider/actor
        expect(dispatchedPayloads.some((p) => p.Payload.RecipientUserID === LEE_MUTED_ID.toLowerCase())).toBe(false);
        expect(dispatchedPayloads.some((p) => p.Payload.RecipientUserID === OUTSIDER_ID.toLowerCase())).toBe(false);
        expect(dispatchedPayloads.some((p) => p.Payload.RecipientUserID === ADA_STAFF_ID.toLowerCase())).toBe(false);

        // 2. Exercise remaining 5 NT-1 event types (Reply, Share, StatusChanged, Task, Approval)
        const remainingTypes: CollaborationNotificationEventType[] = ['Reply', 'Share', 'StatusChanged', 'Task', 'Approval'];
        for (const eventType of remainingTypes) {
            dispatchedPayloads.length = 0;
            const res = await engine.RouteCollaborationNotifications(
                {
                    Event: {
                        EventType: eventType,
                        SpaceID: CHILD_DELIVERY_SPACE_ID,
                        Band: 'Team',
                        Title: `World ${eventType} event`,
                    },
                    RecipientUserIDs: [SAM_STAFF_ID, CASEY_EXT_ID, LEE_MUTED_ID],
                    IncludeSpaceMembers: false,
                    Now: '2026-11-23T18:00:00.000Z',
                },
                ada,
                provider,
            );
            expect(res.Success).toBe(true);
            const map = new Map(res.Deliveries.map((d) => [d.RecipientUserID, d]));
            // Team-band event never reaches Shared-only Casey
            expect(map.get(CASEY_EXT_ID.toLowerCase())?.Dispatched).toBe(false);
            expect(map.get(CASEY_EXT_ID.toLowerCase())?.SuppressionReasons).toContain('NoSpaceReach');
            // Lee unsubscribed from StatusChanged -> suppressed on StatusChanged, delivered on others
            if (eventType === 'StatusChanged') {
                expect(map.get(LEE_MUTED_ID.toLowerCase())?.Dispatched).toBe(false);
                expect(map.get(LEE_MUTED_ID.toLowerCase())?.SuppressionReasons).toContain('EventTypeUnsubscribed');
            } else {
                expect(map.get(LEE_MUTED_ID.toLowerCase())?.Dispatched).toBe(true);
            }
            expect(map.get(SAM_STAFF_ID.toLowerCase())?.Dispatched).toBe(true);
            expect(dispatchedPayloads.some((p) => p.Payload.EventType === eventType)).toBe(true);
        }
    });
});
