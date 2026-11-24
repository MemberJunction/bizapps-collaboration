import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    BaseEntity,
    BaseRemotableOperation,
    EntityFieldInfo,
    EntityInfo,
    EntityPermissionInfo,
    ProviderType,
    ServerOperationScopeManager,
    UserRoleInfo,
    WellKnownUserSource,
    type IEntityDataProvider,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY,
    CollaborationEngine,
    GET_SPACE_NOTICES_OPERATION_KEY,
    GET_SPACE_UNREAD_NOTICE_COUNTS_OPERATION_KEY,
    LoadCollaborationSpaceNoticeOperations,
    LoadSpaceDigestCheckpointEntityServer,
    LoadSpaceNoticeEventEntityServer,
    LoadSpaceNoticeWatermarkEntityServer,
    PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY,
    RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
    SPACE_DIGEST_CHECKPOINT_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
    SPACE_NOTICE_WATERMARK_ENTITY,
    SpaceDigestCheckpointEntityServer,
    SpaceNoticeEventEntityServer,
    SpaceNoticeWatermarkEntityServer,
    UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
} from '../../dist/index.js';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const OWNER_USER_ID = '11111111-1111-4111-8111-111111111201';
const MEMBER_USER_ID = '11111111-1111-4111-8111-111111111202';
const OTHER_USER_ID = '11111111-1111-4111-8111-111111111203';
const SPACE_ID = '22222222-2222-4222-8222-222222222201';
const SPACE_TYPE_ID = '33333333-3333-4333-8333-333333333201';
const ROLE_TEAM_ID = '44444444-4444-4444-8444-444444444201';
const STATUS_OPEN_ID = '55555555-5555-4555-8555-555555555201';
const EXISTING_WATERMARK_ID = '66666666-6666-4666-8666-666666666201';

const TEST_ROLE_ID = '99999999-9999-4999-8999-000000000001';

function makeUser(id: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const userRole = new UserRoleInfo({ UserID: id, RoleID: TEST_ROLE_ID, Role: 'Member' });
    const u: Partial<UserInfo> = {
        ID: id,
        Name: `User-${id.slice(-4)}`,
        Email: `user-${id.slice(-4)}@example.com`,
        Type: type,
        IsActive: true,
        UserRoles: [userRole],
    };
    return u as UserInfo;
}

interface StoredRow {
    ID: string;
    SpaceID?: string;
    ParentID?: string | null;
    SpaceTypeID?: string;
    OwnerID?: string;
    InheritsMembership?: boolean;
    StatusID?: string | null;
    UserID?: string;
    SpaceRoleTypeID?: string;
    Band?: string;
    Status?: string;
    CanSeeTeamBand?: boolean;
    IsOwnerRole?: boolean;
    CanContribute?: boolean;
    IsActive?: boolean;
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
    LastReadEventTimestamp?: string | Date;
    LastReadEventID?: string | null;
    LastReadAt?: string | Date;
    __mj_CreatedAt?: string | Date;
}

class InMemoryServerNoticeEntity implements StoredRow {
    public ID = '';
    public SpaceID = '';
    public ActorUserID: string | null = null;
    public EventKind = '';
    public Band = '';
    public Title = '';
    public Body: string | null = null;
    public TargetEntityID: string | null = null;
    public TargetRecordID: string | null = null;
    public MetadataJSON: string | null = null;
    public EventTimestamp: string | Date = new Date();
    public UserID = '';
    public LastReadEventTimestamp: string | Date = new Date();
    public LastReadEventID: string | null = null;
    public LastReadAt: string | Date = new Date();
    public LatestResult: { CompleteMessage?: string; Message?: string } | null = null;

    private readonly entityName: string;
    private readonly events: StoredRow[];
    private readonly watermarks: StoredRow[];
    private readonly nextId: () => string;

    constructor(
        entityName: string,
        events: StoredRow[],
        watermarks: StoredRow[],
        nextId: () => string,
    ) {
        this.entityName = entityName;
        this.events = events;
        this.watermarks = watermarks;
        this.nextId = nextId;
    }

    public async Load(id: string): Promise<boolean> {
        const list = this.entityName === SPACE_NOTICE_WATERMARK_ENTITY ? this.watermarks : this.events;
        const found = list.find((r) => r.ID.toLowerCase() === id.toLowerCase());
        if (!found) return false;
        Object.assign(this, found);
        return true;
    }

    public async Save(): Promise<boolean> {
        if (!this.ID) this.ID = this.nextId();
        if (this.entityName === SPACE_NOTICE_EVENT_ENTITY) {
            this.events.push({
                ID: this.ID,
                SpaceID: this.SpaceID,
                ActorUserID: this.ActorUserID,
                EventKind: this.EventKind,
                Band: this.Band,
                Title: this.Title,
                Body: this.Body,
                TargetEntityID: this.TargetEntityID,
                TargetRecordID: this.TargetRecordID,
                MetadataJSON: this.MetadataJSON,
                EventTimestamp: this.EventTimestamp,
            });
            return true;
        }
        if (this.entityName === SPACE_NOTICE_WATERMARK_ENTITY) {
            const row: StoredRow = {
                ID: this.ID,
                SpaceID: this.SpaceID,
                UserID: this.UserID,
                LastReadEventTimestamp: this.LastReadEventTimestamp,
                LastReadEventID: this.LastReadEventID,
                LastReadAt: this.LastReadAt,
            };
            const idx = this.watermarks.findIndex((w) => w.ID.toLowerCase() === this.ID.toLowerCase());
            if (idx >= 0) this.watermarks[idx] = row;
            else this.watermarks.push(row);
            return true;
        }
        return false;
    }
}

function makeNoticeEntityInfo(
    id: string,
    name: string,
    fields: Array<{ Name: string; Type?: string; Length?: number; AllowsNull?: boolean; IsPrimaryKey?: boolean; DefaultValue?: string | null }>,
): EntityInfo {
    const info = new EntityInfo({
        ID: id,
        Name: name,
        IncludeInAPI: true,
        AllowCreateAPI: true,
        AllowUpdateAPI: true,
        AllowDeleteAPI: true,
        AllowAllRowsAPI: false,
    });
    const builtFields = fields.map(
        (f, idx) =>
            new EntityFieldInfo({
                EntityID: id,
                Sequence: idx + 1,
                Name: f.Name,
                DisplayName: f.Name,
                Type: f.Type ?? 'uniqueidentifier',
                Length: f.Length ?? 16,
                AllowsNull: f.AllowsNull ?? false,
                IsPrimaryKey: f.IsPrimaryKey ?? false,
                DefaultValue: f.DefaultValue ?? null,
                AllowUpdateAPI: f.Name !== 'ID',
            }),
    );
    const perm = new EntityPermissionInfo({
        EntityID: id,
        RoleID: TEST_ROLE_ID,
        CanRead: true,
        CanCreate: true,
        CanUpdate: true,
        CanDelete: true,
    });
    Object.defineProperty(info, 'Fields', { value: builtFields, writable: true, configurable: true });
    Object.defineProperty(info, 'Permissions', { value: [perm], writable: true, configurable: true });
    return info;
}

describe('S10 Slice 1 CoreEntitiesServer guards and CollaborationEngine delegation', () => {
    let savedGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    const systemUser = makeUser(SYSTEM_USER_ID, 'Owner');

    before(() => {
        LoadSpaceNoticeEventEntityServer();
        LoadSpaceNoticeWatermarkEntityServer();
        LoadSpaceDigestCheckpointEntityServer();
        LoadCollaborationSpaceNoticeOperations();
        savedGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => systemUser;
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = savedGetSystemUser;
    });

    it('registers CS-4 server entity subclasses and BaseRemotableOperation keys via ClassFactory', () => {
        const eventEntityInfo = new EntityInfo({
            ID: 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51',
            Name: SPACE_NOTICE_EVENT_ENTITY,
        });
        const wmEntityInfo = new EntityInfo({
            ID: 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52',
            Name: SPACE_NOTICE_WATERMARK_ENTITY,
        });
        const cpEntityInfo = new EntityInfo({
            ID: 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53',
            Name: SPACE_DIGEST_CHECKPOINT_ENTITY,
        });

        const evObj = MJGlobal.Instance.ClassFactory.CreateInstance<BaseEntity>(
            BaseEntity,
            SPACE_NOTICE_EVENT_ENTITY,
            eventEntityInfo,
        );
        const wmObj = MJGlobal.Instance.ClassFactory.CreateInstance<BaseEntity>(
            BaseEntity,
            SPACE_NOTICE_WATERMARK_ENTITY,
            wmEntityInfo,
        );
        const cpObj = MJGlobal.Instance.ClassFactory.CreateInstance<BaseEntity>(
            BaseEntity,
            SPACE_DIGEST_CHECKPOINT_ENTITY,
            cpEntityInfo,
        );

        assert.ok(evObj instanceof SpaceNoticeEventEntityServer);
        assert.ok(wmObj instanceof SpaceNoticeWatermarkEntityServer);
        assert.ok(cpObj instanceof SpaceDigestCheckpointEntityServer);

        for (const key of [
            PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY,
            GET_SPACE_NOTICES_OPERATION_KEY,
            GET_SPACE_UNREAD_NOTICE_COUNTS_OPERATION_KEY,
            ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY,
        ]) {
            const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation>(BaseRemotableOperation, key);
            assert.ok(op, `Expected BaseRemotableOperation registration for '${key}'`);
        }
    });

    it('blocks direct client SpaceNoticeEvent mutations and allows server authority with valid fields', async () => {
        const entityInfo = makeNoticeEntityInfo('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', SPACE_NOTICE_EVENT_ENTITY, [
            { Name: 'ID', IsPrimaryKey: true, AllowsNull: false, DefaultValue: 'newsequentialid()' },
            { Name: 'SpaceID', AllowsNull: false },
            { Name: 'ActorUserID', AllowsNull: true },
            { Name: 'EventKind', Type: 'nvarchar', Length: 50, AllowsNull: false },
            { Name: 'Band', Type: 'nvarchar', Length: 20, AllowsNull: false, DefaultValue: 'Shared' },
            { Name: 'Title', Type: 'nvarchar', Length: 500, AllowsNull: false },
            { Name: 'Body', Type: 'nvarchar', Length: -1, AllowsNull: true },
            { Name: 'TargetEntityID', AllowsNull: true },
            { Name: 'TargetRecordID', Type: 'nvarchar', Length: 450, AllowsNull: true },
            { Name: 'MetadataJSON', Type: 'nvarchar', Length: -1, AllowsNull: true },
            { Name: 'EventTimestamp', Type: 'datetimeoffset', Length: 10, AllowsNull: false, DefaultValue: 'getutcdate()' },
        ]);
        const provider: Partial<IMetadataProvider & IRunViewProvider & IEntityDataProvider> = {
            ProviderType: ProviderType.Database,
            Entities: [entityInfo],
        };

        const member = makeUser(MEMBER_USER_ID, 'User');
        const directEntity = new SpaceNoticeEventEntityServer(entityInfo, provider as IEntityDataProvider);
        directEntity.ContextCurrentUser = member;
        directEntity.SpaceID = SPACE_ID;
        directEntity.EventKind = 'Announcement';
        directEntity.Band = 'Shared';
        directEntity.Title = 'Bypassed notice';
        directEntity.EventTimestamp = new Date('2026-06-01T10:00:00.000Z');

        const blocked = await ServerOperationScopeManager.Instance.RunInClientCrudBoundary(() =>
            directEntity.ValidateAsync(),
        );
        assert.equal(blocked.Success, false);
        assert.ok(blocked.Errors.some((e) => e.Message.includes('PublishSpaceNoticeEvent')));

        const authorizedResult = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_NOTICE_EVENT_ENTITY],
                userId: member.ID,
            },
            () => directEntity.ValidateAsync(),
        );
        assert.equal(authorizedResult.Success, true);

        directEntity.MetadataJSON = '{not valid json';
        const badJsonResult = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_NOTICE_EVENT_ENTITY],
                userId: member.ID,
            },
            () => directEntity.ValidateAsync(),
        );
        assert.equal(badJsonResult.Success, false);
        assert.ok(badJsonResult.Errors.some((e) => e.Source === 'MetadataJSON'));
    });

    it('enforces self-ownership and monotonic cursor progression in SpaceNoticeWatermarkEntityServer', async () => {
        const entityInfo = makeNoticeEntityInfo('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', SPACE_NOTICE_WATERMARK_ENTITY, [
            { Name: 'ID', IsPrimaryKey: true, AllowsNull: false, DefaultValue: 'newsequentialid()' },
            { Name: 'SpaceID', AllowsNull: false },
            { Name: 'UserID', AllowsNull: false },
            { Name: 'LastReadEventTimestamp', Type: 'datetimeoffset', Length: 10, AllowsNull: false },
            { Name: 'LastReadEventID', AllowsNull: true },
            { Name: 'LastReadAt', Type: 'datetimeoffset', Length: 10, AllowsNull: false, DefaultValue: 'getutcdate()' },
        ]);
        const existingRow: StoredRow = {
            ID: EXISTING_WATERMARK_ID,
            SpaceID: SPACE_ID,
            UserID: MEMBER_USER_ID,
            LastReadEventTimestamp: '2026-06-05T12:00:00.000Z',
            LastReadEventID: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000010',
            LastReadAt: '2026-06-05T12:00:00.000Z',
        };
        const provider: Partial<IMetadataProvider & IRunViewProvider & IEntityDataProvider> = {
            ProviderType: ProviderType.Database,
            Entities: [entityInfo],
            EntityByID: (id: string) => (id.toLowerCase() === entityInfo.ID.toLowerCase() ? entityInfo : undefined),
            GetEntityObject: async <T>(name: string): Promise<T> =>
                new SpaceNoticeWatermarkEntityServer(entityInfo, provider as IEntityDataProvider) as T,
            Load: async () => existingRow,
            RunView: async <T>(_params: RunViewParams): Promise<RunViewResult<T>> => ({
                Success: true,
                Results: [existingRow] as T[],
                UserViewRunID: '',
                RowCount: 1,
                TotalRowCount: 1,
                ExecutionTime: 1,
                ErrorMessage: '',
            }),
        };

        const wm = new SpaceNoticeWatermarkEntityServer(entityInfo, provider as IEntityDataProvider);
        wm.ContextCurrentUser = makeUser(MEMBER_USER_ID, 'User');
        wm.SpaceID = SPACE_ID;
        wm.UserID = OTHER_USER_ID; // cross-user attempt
        wm.LastReadEventTimestamp = new Date('2026-06-06T12:00:00.000Z');
        wm.LastReadAt = new Date('2026-06-06T12:00:00.000Z');

        const crossUserRes = await wm.ValidateAsync();
        assert.equal(crossUserRes.Success, false);
        assert.ok(crossUserRes.Errors.some((e) => e.Source === 'UserID'));

        // Load existing watermark so IsSaved === true and verify monotonic regression refusal
        wm.ContextCurrentUser = systemUser;
        const loaded = await wm.Load(EXISTING_WATERMARK_ID);
        assert.equal(loaded, true);
        wm.ContextCurrentUser = makeUser(MEMBER_USER_ID, 'User');
        wm.UserID = MEMBER_USER_ID;
        wm.LastReadEventTimestamp = new Date('2026-06-04T12:00:00.000Z');
        wm.LastReadEventID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';

        const regressRes = await wm.ValidateAsync();
        assert.equal(regressRes.Success, false);
        assert.ok(regressRes.Errors.some((e) => e.Message.includes('regression')));

        wm.LastReadEventTimestamp = new Date('2026-06-06T12:00:00.000Z');
        wm.LastReadEventID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000011';
        const forwardRes = await wm.ValidateAsync();
        assert.equal(forwardRes.Success, true);
    });

    it('enforces ServerOperationScopeManager write authority, self-ownership, non-negative count, and monotonic cursor progression in SpaceDigestCheckpointEntityServer (CR-2)', async () => {
        const entityInfo = makeNoticeEntityInfo('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', SPACE_DIGEST_CHECKPOINT_ENTITY, [
            { Name: 'ID', IsPrimaryKey: true, AllowsNull: false, DefaultValue: 'newsequentialid()' },
            { Name: 'UserID', AllowsNull: false },
            { Name: 'SpaceID', AllowsNull: true },
            { Name: 'Cadence', Type: 'nvarchar', Length: 20, AllowsNull: false, DefaultValue: 'Daily' },
            { Name: 'LastDeliveredTimestamp', Type: 'datetimeoffset', Length: 10, AllowsNull: false },
            { Name: 'LastDeliveredRecordID', AllowsNull: true },
            { Name: 'LastDeliveredAt', Type: 'datetimeoffset', Length: 10, AllowsNull: false, DefaultValue: 'getutcdate()' },
            { Name: 'ItemsIncludedCount', Type: 'int', Length: 4, AllowsNull: false, DefaultValue: '0' },
            { Name: 'Status', Type: 'nvarchar', Length: 20, AllowsNull: false, DefaultValue: 'Active' },
        ]);
        const existingCheckpointId = '77777777-7777-4777-8777-777777777201';
        const existingRow: StoredRow & {
            Cadence: string;
            LastDeliveredTimestamp: string;
            LastDeliveredRecordID: string;
            LastDeliveredAt: string;
            ItemsIncludedCount: number;
            Status: string;
        } = {
            ID: existingCheckpointId,
            UserID: MEMBER_USER_ID,
            SpaceID: SPACE_ID,
            Cadence: 'Daily',
            LastDeliveredTimestamp: '2026-06-05T12:00:00.000Z',
            LastDeliveredRecordID: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000010',
            LastDeliveredAt: '2026-06-05T12:00:00.000Z',
            ItemsIncludedCount: 2,
            Status: 'Active',
        };
        const provider: Partial<IMetadataProvider & IRunViewProvider & IEntityDataProvider> = {
            ProviderType: ProviderType.Database,
            Entities: [entityInfo],
            EntityByID: (id: string) => (id.toLowerCase() === entityInfo.ID.toLowerCase() ? entityInfo : undefined),
            GetEntityObject: async <T>(_name: string): Promise<T> =>
                new SpaceDigestCheckpointEntityServer(entityInfo, provider as IEntityDataProvider) as T,
            Load: async () => existingRow,
            RunView: async <T>(_params: RunViewParams): Promise<RunViewResult<T>> => ({
                Success: true,
                Results: [existingRow] as T[],
                UserViewRunID: '',
                RowCount: 1,
                TotalRowCount: 1,
                ExecutionTime: 1,
                ErrorMessage: '',
            }),
        };

        const member = makeUser(MEMBER_USER_ID, 'User');
        const cp = new SpaceDigestCheckpointEntityServer(entityInfo, provider as IEntityDataProvider);
        cp.ContextCurrentUser = member;
        cp.UserID = MEMBER_USER_ID;
        cp.SpaceID = SPACE_ID;
        cp.Cadence = 'Daily';
        cp.Status = 'Active';
        cp.ItemsIncludedCount = 3;
        cp.LastDeliveredTimestamp = new Date('2026-06-01T08:00:00.000Z');
        cp.LastDeliveredAt = new Date('2026-06-01T08:00:00.000Z');

        // Direct client CRUD & un-scoped non-Owner calls must be rejected
        const directClientBlocked = await ServerOperationScopeManager.Instance.RunInClientCrudBoundary(() =>
            cp.ValidateAsync(),
        );
        assert.equal(directClientBlocked.Success, false);
        assert.ok(directClientBlocked.Errors.some((e) => e.Message.includes('UpdateSpaceDigestCheckpoint')));

        const unscopedBlocked = await cp.ValidateAsync();
        assert.equal(unscopedBlocked.Success, false);

        // Inside UpdateSpaceDigestCheckpoint scope: cross-user and negative count still fail, valid passes
        cp.UserID = OTHER_USER_ID;
        const wrongUser = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
                userId: member.ID,
            },
            () => cp.ValidateAsync(),
        );
        assert.equal(wrongUser.Success, false);

        cp.UserID = MEMBER_USER_ID;
        cp.ItemsIncludedCount = -1;
        const negativeCount = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
                userId: member.ID,
            },
            () => cp.ValidateAsync(),
        );
        assert.equal(negativeCount.Success, false);
        assert.ok(negativeCount.Errors.some((e) => e.Source === 'ItemsIncludedCount'));

        cp.ItemsIncludedCount = 3;
        const ok = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
                userId: member.ID,
            },
            () => cp.ValidateAsync(),
        );
        assert.equal(ok.Success, true);

        // Inside RunScopedSpaceDigests scope: server can update another member's checkpoint
        cp.UserID = OTHER_USER_ID;
        const runDigestScopeOk = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
                userId: member.ID,
            },
            () => cp.ValidateAsync(),
        );
        assert.equal(runDigestScopeOk.Success, true);

        // Load existing saved checkpoint (IsSaved === true) and verify composite cursor regression refusal
        cp.ContextCurrentUser = systemUser;
        const loaded = await cp.Load(existingCheckpointId);
        assert.equal(loaded, true);
        cp.ContextCurrentUser = member;
        cp.UserID = MEMBER_USER_ID;

        // Earlier timestamp rejected
        cp.LastDeliveredTimestamp = new Date('2026-06-04T12:00:00.000Z');
        cp.LastDeliveredRecordID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000099';
        const regressTs = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
                userId: member.ID,
            },
            () => cp.ValidateAsync(),
        );
        assert.equal(regressTs.Success, false);
        assert.ok(regressTs.Errors.some((e) => e.Message.includes('regression')));

        // Same timestamp with lower LastDeliveredRecordID rejected
        cp.LastDeliveredTimestamp = new Date('2026-06-05T12:00:00.000Z');
        cp.LastDeliveredRecordID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
        const regressId = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
                userId: member.ID,
            },
            () => cp.ValidateAsync(),
        );
        assert.equal(regressId.Success, false);
        assert.ok(regressId.Errors.some((e) => e.Message.includes('regression')));

        // Monotonic forward advance passes
        cp.LastDeliveredTimestamp = new Date('2026-06-05T12:00:00.000Z');
        cp.LastDeliveredRecordID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000011';
        const forwardOk = await ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
                userId: member.ID,
            },
            () => cp.ValidateAsync(),
        );
        assert.equal(forwardOk.Success, true);
    });

    it('delegates CS-4 Publish/Get/UnreadCount/AdvanceWatermark through CollaborationEngine.Instance', async () => {
        const events: StoredRow[] = [];
        const watermarks: StoredRow[] = [];
        let seq = 1;
        const spaces: StoredRow[] = [
            {
                ID: SPACE_ID,
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: OWNER_USER_ID,
                InheritsMembership: false,
                StatusID: STATUS_OPEN_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
        ];
        const members: StoredRow[] = [
            {
                ID: '77777777-7777-4777-8777-777777777201',
                SpaceID: SPACE_ID,
                UserID: MEMBER_USER_ID,
                SpaceRoleTypeID: ROLE_TEAM_ID,
                Band: 'Team',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
        ];
        const roles: StoredRow[] = [
            { ID: ROLE_TEAM_ID, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true },
        ];
        const statuses: StoredRow[] = [{ ID: STATUS_OPEN_ID, Visible: true, ReadOnly: false }];

        const provider: Partial<IMetadataProvider & IRunViewProvider> = {
            ProviderType: ProviderType.Database,
            DatabaseConnection: {},
            Entities: [],
            RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
                let rows: StoredRow[] = [];
                if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') rows = spaces;
                else if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') rows = members;
                else if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') rows = roles;
                else if (params.EntityName === 'MJ_BizApps_Collaboration: Space Type Status') rows = statuses;
                else if (params.EntityName === SPACE_NOTICE_EVENT_ENTITY) rows = events;
                else if (params.EntityName === SPACE_NOTICE_WATERMARK_ENTITY) rows = watermarks;

                return {
                    Success: true,
                    Results: rows.map((r) => ({ ...r }) as T),
                    UserViewRunID: '',
                    RowCount: rows.length,
                    TotalRowCount: rows.length,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            },
            GetEntityObject: async <T>(entityName: string): Promise<T> => {
                const entity = new InMemoryServerNoticeEntity(
                    entityName,
                    events,
                    watermarks,
                    () => `88888888-8888-4888-8888-${(++seq).toString(16).padStart(12, '0')}`,
                );
                return entity as T;
            },
        };

        const engine = CollaborationEngine.Instance;
        const owner = makeUser(OWNER_USER_ID, 'User');
        const member = makeUser(MEMBER_USER_ID, 'User');

        const pub = await engine.PublishSpaceNoticeEvent(
            {
                SpaceID: SPACE_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Server engine broadcast',
            },
            owner,
            provider as IMetadataProvider,
        );
        assert.equal(pub.Success, true);
        assert.equal(pub.NoticeEventRowsWritten, 1);
        assert.equal(pub.PerMemberInboxRowsWritten, 0);

        const unread = await engine.GetSpaceUnreadNoticeCounts({ SpaceIDs: [SPACE_ID] }, member, provider as IMetadataProvider);
        assert.equal(unread.TotalUnreadCount, 1);

        const feed = await engine.GetSpaceNotices({ SpaceID: SPACE_ID }, member, provider as IMetadataProvider);
        assert.equal(feed.Notices.length, 1);
        assert.equal(feed.Notices[0]?.IsUnread, true);

        const adv = await engine.AdvanceSpaceNoticeWatermark(
            { SpaceID: SPACE_ID, EventID: pub.Event?.ID },
            member,
            provider as IMetadataProvider,
        );
        assert.equal(adv.Advanced, true);

        const afterUnread = await engine.GetSpaceUnreadNoticeCounts({ SpaceIDs: [SPACE_ID] }, member, provider as IMetadataProvider);
        assert.equal(afterUnread.TotalUnreadCount, 0);
    });
});
