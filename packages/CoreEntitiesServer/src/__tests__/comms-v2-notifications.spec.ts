import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
    BaseRemotableOperation,
    type IMetadataProvider,
    type IRunViewProvider,
    ProviderType,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    NotificationEngine,
    type NotificationResult,
    type SendNotificationParams,
} from '@memberjunction/notifications';
import { NT1_NOTIFICATION_TYPE_NAMES } from '@mj-biz-apps/collaboration-core';
import {
    CollaborationEngine,
    type CommsV2DirectMessagePayload,
    EnsureCollaborationCommsV2TransportRegistered,
    GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
    GetCollaborationCommsV2Transport,
    GetUserNotificationPreferencesOperation,
    MJCommsV2NotificationTransport,
    RegisterCollaborationCommsV2Transport,
    ResetCollaborationCommsV2DirectMessageDispatcher,
    ResetCollaborationCommsV2Transport,
    ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY,
    RouteCollaborationNotificationsOperation,
    SetCollaborationCommsV2DirectMessageDispatcher,
    UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY,
    UpdateUserNotificationPreferencesOperation,
    USER_NOTIFICATION_PREFERENCES_ENTITY,
    USER_NOTIFICATION_TYPES_ENTITY,
    USER_SETTINGS_ENTITY,
    USERS_ENTITY,
} from '../../dist/index.js';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const ACTOR_USER_ID = '11111111-1111-4111-8111-111111111301';
const TARGET_USER_ID = '11111111-1111-4111-8111-111111111302';
const SPACE_ID = '22222222-2222-4222-8222-222222222301';
const SPACE_TYPE_ID = '33333333-3333-4333-8333-333333333301';
const ROLE_TEAM_ID = '44444444-4444-4444-8444-444444444301';
const STATUS_OPEN_ID = '55555555-5555-4555-8555-555555555301';
const TYPE_APPROVAL_ID = '66666666-6666-4666-8666-666666666304';

interface StoredRow {
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

function makeUser(id: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const u: Partial<UserInfo> = {
        ID: id,
        Name: `User-${id.slice(-4)}`,
        Email: `user-${id.slice(-4)}@example.com`,
        Type: type,
        IsActive: true,
        UserRoles: [],
    };
    return u as UserInfo;
}

function matchesFilter(row: StoredRow, rawFilter: string | undefined): boolean {
    if (!rawFilter || rawFilter.trim() === '') return true;
    const clauses = rawFilter.split(/\s+AND\s+/i).map((c) => c.trim());
    for (const clause of clauses) {
        if (clause === '1 = 0') return false;
        const eq = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s*=\s*(.+)$/.exec(clause);
        if (eq) {
            const field = eq[1];
            const rawVal = eq[2].trim();
            const val = rawVal.startsWith("'") && rawVal.endsWith("'") ? rawVal.slice(1, -1).replace(/''/g, "'") : rawVal;
            const actual = row[field as keyof StoredRow];
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
            const actual = String(row[field as keyof StoredRow] ?? '').toLowerCase();
            if (!allowed.includes(actual)) return false;
        }
    }
    return true;
}

describe('S10 Slice 2 CoreEntitiesServer MJCommsV2NotificationTransport & CollaborationEngine', () => {
    let savedGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let savedConfig: typeof NotificationEngine.Instance.Config;
    let savedSendNotification: typeof NotificationEngine.Instance.SendNotification;

    beforeEach(() => {
        ResetCollaborationCommsV2Transport();
        ResetCollaborationCommsV2DirectMessageDispatcher();
        savedGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        savedConfig = NotificationEngine.Instance.Config.bind(NotificationEngine.Instance);
        savedSendNotification = NotificationEngine.Instance.SendNotification.bind(NotificationEngine.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_USER_ID, 'Owner');
    });

    afterEach(() => {
        WellKnownUserSource.Instance.GetSystemUser = savedGetSystemUser;
        NotificationEngine.Instance.Config = savedConfig;
        NotificationEngine.Instance.SendNotification = savedSendNotification;
        ResetCollaborationCommsV2Transport();
        ResetCollaborationCommsV2DirectMessageDispatcher();
    });

    it('registers default MJCommsV2NotificationTransport and retains BaseRemotableOperation keys', () => {
        EnsureCollaborationCommsV2TransportRegistered();
        const transport = GetCollaborationCommsV2Transport();
        assert.ok(transport instanceof MJCommsV2NotificationTransport);

        for (const [key, ctor] of [
            [ROUTE_COLLABORATION_NOTIFICATIONS_OPERATION_KEY, RouteCollaborationNotificationsOperation],
            [GET_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY, GetUserNotificationPreferencesOperation],
            [UPDATE_USER_NOTIFICATION_PREFERENCES_OPERATION_KEY, UpdateUserNotificationPreferencesOperation],
        ] as const) {
            const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation>(BaseRemotableOperation, key);
            assert.ok(op instanceof ctor, `Expected ${key} to resolve in ClassFactory`);
        }
    });

    it('routes preference-gated notifications through NotificationEngine and Chat direct dispatcher via CollaborationEngine', async () => {
        const sentNotificationCalls: SendNotificationParams[] = [];
        const sentDirectCalls: CommsV2DirectMessagePayload[] = [];

        NotificationEngine.Instance.Config = async () => {};
        NotificationEngine.Instance.SendNotification = async (
            params: SendNotificationParams,
        ): Promise<NotificationResult> => {
            sentNotificationCalls.push(params);
            return {
                success: true,
                inAppNotificationId: 'notif-server-001',
                emailSent: params.forceDeliveryChannels?.email ?? false,
                smsSent: false,
                deliveryChannels: {
                    inApp: params.forceDeliveryChannels?.inApp ?? false,
                    email: params.forceDeliveryChannels?.email ?? false,
                    sms: false,
                },
            };
        };

        SetCollaborationCommsV2DirectMessageDispatcher(async (req) => {
            sentDirectCalls.push(req);
            return true;
        });

        RegisterCollaborationCommsV2Transport(new MJCommsV2NotificationTransport());

        const store = {
            spaces: [
                {
                    ID: SPACE_ID,
                    Name: 'Approval Space',
                    ParentID: null,
                    SpaceTypeID: SPACE_TYPE_ID,
                    OwnerID: ACTOR_USER_ID,
                    InheritsMembership: false,
                    StatusID: STATUS_OPEN_ID,
                },
            ],
            members: [
                {
                    ID: '70000001-0000-4000-8000-000000000301',
                    SpaceID: SPACE_ID,
                    UserID: TARGET_USER_ID,
                    SpaceRoleTypeID: ROLE_TEAM_ID,
                    Band: 'Team',
                    Status: 'Active',
                },
            ],
            roles: [{ ID: ROLE_TEAM_ID, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true }],
            statuses: [{ ID: STATUS_OPEN_ID, Visible: true, ReadOnly: false }],
            users: [
                { ID: ACTOR_USER_ID, Name: 'Actor', Email: 'actor@example.com', Type: 'User', IsActive: true },
                { ID: TARGET_USER_ID, Name: 'Reviewer', Email: 'reviewer@example.com', Type: 'User', IsActive: true },
            ],
            types: [
                {
                    ID: TYPE_APPROVAL_ID,
                    Name: NT1_NOTIFICATION_TYPE_NAMES.Approval,
                    DefaultInApp: true,
                    DefaultEmail: true,
                    DefaultSMS: false,
                    AllowUserPreference: true,
                },
            ],
            mjPrefs: [],
            settings: [
                {
                    ID: '90000001-0000-4000-8000-000000000301',
                    UserID: TARGET_USER_ID,
                    Setting: 'Collaboration.NotificationPreferences',
                    Value: JSON.stringify({
                        Enabled: true,
                        Channels: { InApp: true, Email: true, SMS: false, Chat: true },
                    }),
                },
            ],
        };

        const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
            ProviderType: ProviderType.Database,
            Entities: [],
            RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
                let src: StoredRow[] = [];
                switch (params.EntityName) {
                    case 'MJ_BizApps_Collaboration: Spaces':
                        src = store.spaces;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Members':
                        src = store.members;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Role Types':
                        src = store.roles;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Type Status':
                        src = store.statuses;
                        break;
                    case USERS_ENTITY:
                        src = store.users;
                        break;
                    case USER_NOTIFICATION_TYPES_ENTITY:
                        src = store.types;
                        break;
                    case USER_NOTIFICATION_PREFERENCES_ENTITY:
                        src = store.mjPrefs;
                        break;
                    case USER_SETTINGS_ENTITY:
                        src = store.settings;
                        break;
                }
                const extra = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : undefined;
                const filtered = src.filter((r) => matchesFilter(r, extra));
                const sorted = [...filtered].sort((a, b) => a.ID.toLowerCase().localeCompare(b.ID.toLowerCase()));
                return {
                    Success: true,
                    Results: sorted.map((r) => ({ ...r }) as T),
                    UserViewRunID: '',
                    RowCount: sorted.length,
                    TotalRowCount: sorted.length,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            },
        };

        const actor = makeUser(ACTOR_USER_ID);
        const result = await CollaborationEngine.Instance.RouteCollaborationNotifications(
            {
                Event: {
                    EventType: 'Approval',
                    SpaceID: SPACE_ID,
                    Band: 'Team',
                    Title: 'Draft ready for approval',
                    Body: 'Please review the client brief draft.',
                    Metadata: { ApprovalOutcome: 'Pending' },
                },
                RecipientUserIDs: [TARGET_USER_ID],
                IncludeSpaceMembers: false,
                Now: '2026-11-23T18:00:00.000Z',
            },
            actor,
            providerImpl as IMetadataProvider,
        );

        assert.equal(result.Success, true);
        assert.equal(result.DispatchedCount, 1);
        assert.equal(sentNotificationCalls.length, 1);
        assert.equal(sentNotificationCalls[0].typeNameOrId, NT1_NOTIFICATION_TYPE_NAMES.Approval);
        assert.deepEqual(sentNotificationCalls[0].forceDeliveryChannels, {
            inApp: true,
            email: true,
            sms: false,
        });
        assert.equal(sentDirectCalls.length, 1);
        assert.equal(sentDirectCalls[0].Channel, 'Chat');
        assert.equal(sentDirectCalls[0].To, 'reviewer@example.com');
        assert.deepEqual(result.Deliveries[0].DeliveredChannels, ['InApp', 'Email', 'Chat']);
    });
});
