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
import { COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME } from '@mj-biz-apps/collaboration-core';
import {
    CollaborationEngine,
    EnsureCollaborationCommsV2TransportRegistered,
    GetCollaborationCommsV2Transport,
    MJCommsV2NotificationTransport,
    PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY,
    PreviewScopedSpaceDigestOperation,
    RegisterCollaborationCommsV2Transport,
    ResetCollaborationCommsV2DirectMessageDispatcher,
    ResetCollaborationCommsV2Transport,
    RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
    RunScopedSpaceDigestsOperation,
    SPACE_DIGEST_CHECKPOINT_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
    UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
    UpdateSpaceDigestCheckpointOperation,
    USER_NOTIFICATION_PREFERENCES_ENTITY,
    USER_NOTIFICATION_TYPES_ENTITY,
    USER_SETTINGS_ENTITY,
    USERS_ENTITY,
} from '../../dist/index.js';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const ADMIN_USER_ID = '11111111-1111-4111-8111-111111111401';
const MEMBER_USER_ID = '11111111-1111-4111-8111-111111111402';
const SPACE_ID = '22222222-2222-4222-8222-222222222401';
const SPACE_TYPE_ID = '33333333-3333-4333-8333-333333333401';
const ROLE_SHARED_ID = '44444444-4444-4444-8444-444444444401';
const STATUS_OPEN_ID = '55555555-5555-4555-8555-555555555401';
const TYPE_DIGEST_ID = '66666666-6666-4666-8666-666666666405';

interface ServerRow {
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
    SpaceID?: string | null;
    UserID?: string;
    SpaceRoleTypeID?: string;
    Band?: string;
    Status?: string;
    CanSeeTeamBand?: boolean;
    IsOwnerRole?: boolean;
    CanContribute?: boolean;
    Visible?: boolean;
    ReadOnly?: boolean;
    ActorUserID?: string | null;
    EventKind?: string;
    Title?: string;
    Body?: string | null;
    TargetEntityID?: string | null;
    TargetRecordID?: string | null;
    MetadataJSON?: string | null;
    EventTimestamp?: string | Date;
    Cadence?: string;
    LastDeliveredTimestamp?: string | Date;
    LastDeliveredRecordID?: string | null;
    LastDeliveredAt?: string | Date;
    ItemsIncludedCount?: number;
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

class ServerCheckpointProxy implements ServerRow {
    public ID = '';
    public UserID = '';
    public SpaceID: string | null = null;
    public Cadence = 'Daily';
    public LastDeliveredTimestamp: Date = new Date(0);
    public LastDeliveredRecordID: string | null = null;
    public LastDeliveredAt: Date = new Date();
    public ItemsIncludedCount = 0;
    public Status = 'Active';
    public LatestResult: { CompleteMessage?: string; Message?: string } | null = null;

    private readonly rows: ServerRow[];
    private readonly nextId: () => string;

    constructor(rows: ServerRow[], nextId: () => string) {
        this.rows = rows;
        this.nextId = nextId;
    }

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
        const row: ServerRow = {
            ID: this.ID,
            UserID: this.UserID,
            SpaceID: this.SpaceID,
            Cadence: this.Cadence,
            LastDeliveredTimestamp: this.LastDeliveredTimestamp,
            LastDeliveredRecordID: this.LastDeliveredRecordID,
            LastDeliveredAt: this.LastDeliveredAt,
            ItemsIncludedCount: this.ItemsIncludedCount,
            Status: this.Status,
        };
        const idx = this.rows.findIndex((r) => r.ID.toLowerCase() === this.ID.toLowerCase());
        if (idx >= 0) this.rows[idx] = row;
        else this.rows.push(row);
        return true;
    }
}

describe('S10 Slice 3 CoreEntitiesServer NT-2 Scoped Digests & CollaborationEngine delegation', () => {
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

    it('registers NT-2 BaseRemotableOperation keys alongside MJCommsV2NotificationTransport', () => {
        EnsureCollaborationCommsV2TransportRegistered();
        assert.ok(GetCollaborationCommsV2Transport() instanceof MJCommsV2NotificationTransport);
        for (const [key, ctor] of [
            [RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY, RunScopedSpaceDigestsOperation],
            [PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY, PreviewScopedSpaceDigestOperation],
            [UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY, UpdateSpaceDigestCheckpointOperation],
        ] as const) {
            const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation>(
                BaseRemotableOperation,
                key,
            );
            assert.ok(op instanceof ctor, `Expected ${key} in ClassFactory`);
        }
    });

    it('dispatches non-empty reach-verified digest via CollaborationEngine -> MJCommsV2NotificationTransport and advances checkpoint', async () => {
        const sentCalls: SendNotificationParams[] = [];
        NotificationEngine.Instance.Config = async () => {};
        NotificationEngine.Instance.SendNotification = async (
            params: SendNotificationParams,
        ): Promise<NotificationResult> => {
            sentCalls.push(params);
            return {
                success: true,
                inAppNotificationId: 'digest-inapp-001',
                emailSent: params.forceDeliveryChannels?.email ?? false,
                smsSent: false,
                deliveryChannels: {
                    inApp: params.forceDeliveryChannels?.inApp ?? false,
                    email: params.forceDeliveryChannels?.email ?? false,
                    sms: false,
                },
            };
        };

        RegisterCollaborationCommsV2Transport(new MJCommsV2NotificationTransport());

        const checkpoints: ServerRow[] = [];
        let seq = 1;

        const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
            ProviderType: ProviderType.Database,
            Entities: [],
            RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
                let src: ServerRow[] = [];
                switch (params.EntityName) {
                    case 'MJ_BizApps_Collaboration: Spaces':
                        src = [
                            {
                                ID: SPACE_ID,
                                Name: 'Client Board',
                                ParentID: null,
                                SpaceTypeID: SPACE_TYPE_ID,
                                OwnerID: ADMIN_USER_ID,
                                InheritsMembership: false,
                                StatusID: STATUS_OPEN_ID,
                            },
                        ];
                        break;
                    case 'MJ_BizApps_Collaboration: Space Members':
                        src = [
                            {
                                ID: '70000001-0000-4000-8000-000000000401',
                                SpaceID: SPACE_ID,
                                UserID: MEMBER_USER_ID,
                                SpaceRoleTypeID: ROLE_SHARED_ID,
                                Band: 'Shared',
                                Status: 'Active',
                            },
                        ];
                        break;
                    case 'MJ_BizApps_Collaboration: Space Role Types':
                        src = [{ ID: ROLE_SHARED_ID, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true, IsActive: true }];
                        break;
                    case 'MJ_BizApps_Collaboration: Space Type Status':
                        src = [{ ID: STATUS_OPEN_ID, Visible: true, ReadOnly: false }];
                        break;
                    case SPACE_NOTICE_EVENT_ENTITY:
                        src = [
                            {
                                ID: '80000001-0000-4000-8000-000000000401',
                                SpaceID: SPACE_ID,
                                ActorUserID: ADMIN_USER_ID,
                                EventKind: 'Share',
                                Band: 'Shared',
                                Title: 'Shared quarterly memo',
                                Body: 'Please review before Friday.',
                                TargetEntityID: null,
                                TargetRecordID: null,
                                MetadataJSON: null,
                                EventTimestamp: '2026-11-23T08:00:00.000Z',
                            },
                            {
                                ID: '80000001-0000-4000-8000-000000000402',
                                SpaceID: SPACE_ID,
                                ActorUserID: ADMIN_USER_ID,
                                EventKind: 'Task',
                                Band: 'Team',
                                Title: 'Internal review task',
                                Body: null,
                                TargetEntityID: null,
                                TargetRecordID: null,
                                MetadataJSON: null,
                                EventTimestamp: '2026-11-23T08:05:00.000Z',
                            },
                        ];
                        break;
                    case SPACE_DIGEST_CHECKPOINT_ENTITY:
                        src = checkpoints;
                        break;
                    case USERS_ENTITY:
                        src = [
                            { ID: ADMIN_USER_ID, Name: 'Admin', Email: 'admin@example.com', Type: 'Owner', IsActive: true },
                            { ID: MEMBER_USER_ID, Name: 'Member', Email: 'member@example.com', Type: 'User', IsActive: true },
                        ];
                        break;
                    case USER_NOTIFICATION_TYPES_ENTITY:
                        src = [
                            {
                                ID: TYPE_DIGEST_ID,
                                Name: COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
                                DefaultInApp: true,
                                DefaultEmail: true,
                                DefaultSMS: false,
                                AllowUserPreference: true,
                            },
                        ];
                        break;
                    case USER_NOTIFICATION_PREFERENCES_ENTITY:
                    case USER_SETTINGS_ENTITY:
                        src = [];
                        break;
                }
                return {
                    Success: true,
                    Results: src.map((r) => ({ ...r }) as T),
                    UserViewRunID: '',
                    RowCount: src.length,
                    TotalRowCount: src.length,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            },
            GetEntityObject: async <T>(entityName: string): Promise<T> => {
                if (entityName === SPACE_DIGEST_CHECKPOINT_ENTITY) {
                    return new ServerCheckpointProxy(
                        checkpoints,
                        () => `90000001-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`,
                    ) as T;
                }
                throw new Error(`Unexpected entity '${entityName}'`);
            },
        };

        const admin = makeUser(ADMIN_USER_ID, 'Owner');
        const result = await CollaborationEngine.Instance.RunScopedSpaceDigests(
            {
                Cadence: 'Daily',
                RecipientUserIDs: [MEMBER_USER_ID],
                Now: '2026-11-23T12:00:00.000Z',
            },
            admin,
            providerImpl as IMetadataProvider,
        );

        assert.equal(result.Success, true);
        assert.equal(result.DeliveredCount, 1);
        assert.equal(result.CheckpointsAdvancedCount, 1);
        assert.equal(sentCalls.length, 1);
        assert.equal(sentCalls[0].typeNameOrId, COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME);
        assert.equal(result.Outcomes[0].ItemsIncludedCount, 1);
        assert.equal(result.Outcomes[0].Items[0].Title, 'Shared quarterly memo');
        assert.equal(checkpoints.length, 1);
        assert.equal(checkpoints[0].ItemsIncludedCount, 1);

        // UpdateSpaceDigestCheckpoint rejects non-reachable space and cursor regression via CollaborationEngine
        const unreachableSpaceId = '22222222-2222-4222-8222-222222222499';
        const memberUser = makeUser(MEMBER_USER_ID, 'User');
        await assert.rejects(
            () =>
                CollaborationEngine.Instance.UpdateSpaceDigestCheckpoint(
                    { SpaceID: unreachableSpaceId, Cadence: 'Daily', Status: 'Paused' },
                    memberUser,
                    providerImpl as IMetadataProvider,
                ),
            /active reach/i,
        );
    });
});
