import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
    COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
    createDefaultCollaborationNotificationPreferences,
    serializeCollaborationNotificationPreferences,
    SPACE_CHATS_ENTITY_ID,
    SPACE_ITEMS_ENTITY_ID,
    SPACE_NOTES_ENTITY_ID,
} from '@mj-biz-apps/collaboration-core';
import {
    type CollaborationCommsV2Transport,
    CollaborationEngineBase,
    type CommsV2TransportDispatchRequest,
    LoadCollaborationDigestOperations,
    PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY,
    PreviewScopedSpaceDigestOperation,
    RegisterCollaborationCommsV2Transport,
    ResetCollaborationCommsV2Transport,
    RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
    RunScopedSpaceDigestsOperation,
    runPreviewScopedSpaceDigest,
    runRunScopedSpaceDigests,
    runUpdateSpaceDigestCheckpoint,
    SPACE_DIGEST_CHECKPOINT_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
    UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
    UpdateSpaceDigestCheckpointOperation,
    USER_NOTIFICATION_PREFERENCES_ENTITY,
    USER_NOTIFICATION_TYPES_ENTITY,
    USER_SETTINGS_ENTITY,
    type UserInfoEnginePreferenceBridge,
    USERS_ENTITY,
} from '../index.js';

interface DigestMockRow {
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
    EntityID?: string | null;
    RecordID?: string | null;
    ConversationID?: string | null;
    Kind?: string;
    OwnerUserID?: string | null;
    Visibility?: string;
    AuthorUserID?: string;
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
    __mj_CreatedAt?: string | Date;
}

const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
const ADMIN_ID = '11111111-1111-4111-8111-111111111201';
const TEAM_MEMBER_ID = '11111111-1111-4111-8111-111111111202';
const SHARED_MEMBER_ID = '11111111-1111-4111-8111-111111111203';
const REVOKED_MEMBER_ID = '11111111-1111-4111-8111-111111111204';
const OPTED_OUT_MEMBER_ID = '11111111-1111-4111-8111-111111111205';

const SPACE_ROOT_ID = '22222222-2222-4222-8222-222222222201';
const SPACE_CHILD_ID = '22222222-2222-4222-8222-222222222202';
const SPACE_TYPE_ID = '33333333-3333-4333-8333-333333333201';
const ROLE_TEAM_ID = '44444444-4444-4444-8444-444444444201';
const ROLE_SHARED_ID = '44444444-4444-4444-8444-444444444202';
const STATUS_OPEN_ID = '55555555-5555-4555-8555-555555555201';
const DIGEST_TYPE_ID = '66666666-6666-4666-8666-666666666205';

function makeUser(id: string, opts?: { type?: string; isMagicLinkAnonymous?: boolean }): UserInfo {
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

function splitTopLevelAnd(filter: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let inQuote = false;
    let start = 0;
    for (let i = 0; i < filter.length; i++) {
        const ch = filter[i];
        if (ch === "'") {
            inQuote = !inQuote;
            continue;
        }
        if (inQuote) continue;
        if (ch === '(') depth += 1;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        else if (depth === 0 && /^\s+AND\s+/i.test(filter.slice(i))) {
            const match = /^\s+AND\s+/i.exec(filter.slice(i))!;
            parts.push(filter.slice(start, i).trim());
            i += match[0].length - 1;
            start = i + 1;
        }
    }
    const tail = filter.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
}

function matchesDigestMockFilter(row: DigestMockRow, rawFilter: string | undefined): boolean {
    if (!rawFilter || rawFilter.trim() === '') return true;
    const clauses = splitTopLevelAnd(rawFilter);
    for (const clause of clauses) {
        if (clause === '1 = 0') return false;

        // Composite keyset predicate: ([EventTimestamp] > '...' OR ([EventTimestamp] = '...' AND [ID] > '...'))
        const keysetMatch =
            /^\(\s*[\["]?EventTimestamp[\]"]?\s*>\s*'([^']+)'\s+OR\s+\(\s*[\["]?EventTimestamp[\]"]?\s*=\s*'([^']+)'\s+AND\s+[\["]?ID[\]"]?\s*>\s*'([^']+)'\s*\)\s*\)$/i.exec(
                clause,
            );
        if (keysetMatch) {
            const cursorMs = Date.parse(keysetMatch[1]);
            const cursorId = keysetMatch[3].toLowerCase();
            const rowMs =
                row.EventTimestamp instanceof Date
                    ? row.EventTimestamp.getTime()
                    : Date.parse(String(row.EventTimestamp ?? ''));
            const rowId = row.ID.toLowerCase();
            if (!(rowMs > cursorMs || (rowMs === cursorMs && rowId > cursorId))) {
                return false;
            }
            continue;
        }

        // Upper bound: [EventTimestamp] <= '...'
        const lteMatch = /^[\["]?EventTimestamp[\]"]?\s*<=\s*'([^']+)'$/i.exec(clause);
        if (lteMatch) {
            const boundMs = Date.parse(lteMatch[1]);
            const rowMs =
                row.EventTimestamp instanceof Date
                    ? row.EventTimestamp.getTime()
                    : Date.parse(String(row.EventTimestamp ?? ''));
            if (!(rowMs <= boundMs)) return false;
            continue;
        }

        // IS NULL check
        const nullMatch = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s+IS\s+NULL$/i.exec(clause);
        if (nullMatch) {
            const val = row[nullMatch[1] as keyof DigestMockRow];
            if (val !== null && val !== undefined) return false;
            continue;
        }

        // IN (...) predicate
        const inMatch = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s+IN\s*\(([^)]+)\)$/i.exec(clause);
        if (inMatch) {
            const field = inMatch[1];
            const allowed = inMatch[2]
                .split(',')
                .map((s) => s.trim().replace(/^'/, '').replace(/'$/, '').toLowerCase());
            const actual = String(row[field as keyof DigestMockRow] ?? '').toLowerCase();
            if (!allowed.includes(actual)) return false;
            continue;
        }

        // Equality predicate
        const eqMatch = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s*=\s*(.+)$/.exec(clause);
        if (eqMatch) {
            const field = eqMatch[1];
            const rawVal = eqMatch[2].trim();
            const val = rawVal.startsWith("'") && rawVal.endsWith("'") ? rawVal.slice(1, -1).replace(/''/g, "'") : rawVal;
            const actual = row[field as keyof DigestMockRow];
            if (typeof actual === 'boolean') {
                if ((val === '1' || val === 'true') !== actual) return false;
            } else if (String(actual ?? '').toLowerCase() !== val.toLowerCase()) {
                return false;
            }
        }
    }
    return true;
}

class MockCheckpointEntityProxy implements DigestMockRow {
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

    constructor(
        private readonly rows: DigestMockRow[],
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
        const row: DigestMockRow = {
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

function createDigestMockHarness(seed?: {
    events?: DigestMockRow[];
    items?: DigestMockRow[];
    chats?: DigestMockRow[];
    notes?: DigestMockRow[];
    checkpoints?: DigestMockRow[];
    settings?: DigestMockRow[];
    mjPrefs?: DigestMockRow[];
    onPageQuery?: (pageIndex: number, params: RunViewParams) => void;
}) {
    const store = {
        spaces: [
            {
                ID: SPACE_ROOT_ID,
                Name: 'Advisory Engagement',
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ADMIN_ID,
                InheritsMembership: false,
                StatusID: STATUS_OPEN_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: SPACE_CHILD_ID,
                Name: 'Delivery Workstream',
                ParentID: SPACE_ROOT_ID,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ADMIN_ID,
                InheritsMembership: true,
                StatusID: STATUS_OPEN_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
        ] as DigestMockRow[],
        members: [
            {
                ID: '77777777-0000-4000-8000-000000000001',
                SpaceID: SPACE_ROOT_ID,
                UserID: TEAM_MEMBER_ID,
                SpaceRoleTypeID: ROLE_TEAM_ID,
                Band: 'Team',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '77777777-0000-4000-8000-000000000002',
                SpaceID: SPACE_ROOT_ID,
                UserID: SHARED_MEMBER_ID,
                SpaceRoleTypeID: ROLE_SHARED_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '77777777-0000-4000-8000-000000000003',
                SpaceID: SPACE_ROOT_ID,
                UserID: REVOKED_MEMBER_ID,
                SpaceRoleTypeID: ROLE_SHARED_ID,
                Band: 'Shared',
                Status: 'Removed',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '77777777-0000-4000-8000-000000000004',
                SpaceID: SPACE_ROOT_ID,
                UserID: OPTED_OUT_MEMBER_ID,
                SpaceRoleTypeID: ROLE_SHARED_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
        ] as DigestMockRow[],
        roles: [
            { ID: ROLE_TEAM_ID, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true },
            { ID: ROLE_SHARED_ID, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true, IsActive: true },
        ] as DigestMockRow[],
        statuses: [{ ID: STATUS_OPEN_ID, Visible: true, ReadOnly: false }] as DigestMockRow[],
        users: [
            { ID: ADMIN_ID, Name: 'Admin', Email: 'admin@example.com', Type: 'Owner', IsActive: true },
            { ID: TEAM_MEMBER_ID, Name: 'Team User', Email: 'team@example.com', Type: 'User', IsActive: true },
            { ID: SHARED_MEMBER_ID, Name: 'Shared User', Email: 'shared@example.com', Type: 'User', IsActive: true },
            { ID: REVOKED_MEMBER_ID, Name: 'Revoked User', Email: 'revoked@example.com', Type: 'User', IsActive: true },
            { ID: OPTED_OUT_MEMBER_ID, Name: 'Opted Out', Email: 'optout@example.com', Type: 'User', IsActive: true },
        ] as DigestMockRow[],
        types: [
            {
                ID: DIGEST_TYPE_ID,
                Name: COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
                DefaultInApp: true,
                DefaultEmail: true,
                DefaultSMS: false,
                AllowUserPreference: true,
            },
        ] as DigestMockRow[],
        mjPrefs: seed?.mjPrefs ?? ([] as DigestMockRow[]),
        settings: seed?.settings ?? ([] as DigestMockRow[]),
        events: seed?.events ?? ([] as DigestMockRow[]),
        items: seed?.items ?? ([] as DigestMockRow[]),
        chats: seed?.chats ?? ([] as DigestMockRow[]),
        notes: seed?.notes ?? ([] as DigestMockRow[]),
        checkpoints: seed?.checkpoints ?? ([] as DigestMockRow[]),
    };

    const queries: RunViewParams[] = [];
    let eventPageCalls = 0;
    let seq = 1;

    const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
        ProviderType: ProviderType.Database,
        Entities: [],
        Authorizations: [],
        RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
            queries.push(params);
            let src: DigestMockRow[] = [];
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
                case SPACE_NOTICE_EVENT_ENTITY:
                    eventPageCalls += 1;
                    seed?.onPageQuery?.(eventPageCalls, params);
                    src = store.events;
                    break;
                case 'MJ_BizApps_Collaboration: Space Items':
                    src = store.items;
                    break;
                case 'MJ_BizApps_Collaboration: Space Chats':
                    src = store.chats;
                    break;
                case 'MJ_BizApps_Collaboration: Space Notes':
                    src = store.notes;
                    break;
                case SPACE_DIGEST_CHECKPOINT_ENTITY:
                    src = store.checkpoints;
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
            const filtered = src.filter((r) => matchesDigestMockFilter(r, extra));

            const orderBy = String(params.OrderBy ?? '').toLowerCase();
            const sorted = [...filtered].sort((a, b) => {
                if (orderBy.includes('eventtimestamp')) {
                    const msA =
                        a.EventTimestamp instanceof Date
                            ? a.EventTimestamp.getTime()
                            : Date.parse(String(a.EventTimestamp ?? ''));
                    const msB =
                        b.EventTimestamp instanceof Date
                            ? b.EventTimestamp.getTime()
                            : Date.parse(String(b.EventTimestamp ?? ''));
                    if (msA !== msB) return msA - msB;
                }
                return a.ID.toLowerCase().localeCompare(b.ID.toLowerCase());
            });

            const afterId = params.AfterKey?.GetValueByIndex(0);
            const afterApplied =
                typeof afterId === 'string'
                    ? sorted.filter((r) => r.ID.toLowerCase() > afterId.toLowerCase())
                    : sorted;

            const limited =
                typeof params.MaxRows === 'number' && params.MaxRows > 0
                    ? afterApplied.slice(0, params.MaxRows)
                    : afterApplied;

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
            if (entityName === SPACE_DIGEST_CHECKPOINT_ENTITY) {
                return new MockCheckpointEntityProxy(
                    store.checkpoints,
                    () => `99999999-9999-4999-8999-${(++seq).toString(16).padStart(12, '0')}`,
                ) as T;
            }
            throw new Error(`Unexpected GetEntityObject entity '${entityName}'`);
        },
    };

    return { provider: providerImpl as IMetadataProvider, store, queries };
}

describe('NT-2 EngineBase Scoped Digests, Composite Keyset Pagination & Fail-Closed Reach', () => {
    let savedGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    const dispatched: CommsV2TransportDispatchRequest[] = [];

    beforeEach(() => {
        dispatched.length = 0;
        LoadCollaborationDigestOperations();
        savedGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_ID, { type: 'Owner' });

        const spyTransport: CollaborationCommsV2Transport = {
            Name: 'DigestUnitTestSpyTransport',
            Dispatch: async (req) => {
                dispatched.push(req);
                return {
                    Success: true,
                    DeliveredChannels: Object.entries(req.Payload.Channels)
                        .filter(([, on]) => on)
                        .map(([ch]) => ch as 'InApp' | 'Email' | 'SMS' | 'Chat'),
                    InAppNotificationID: req.Payload.Channels.InApp ? 'inapp-digest-1' : null,
                    EmailDispatched: req.Payload.Channels.Email,
                };
            },
        };
        RegisterCollaborationCommsV2Transport(spyTransport);
    });

    afterEach(() => {
        WellKnownUserSource.Instance.GetSystemUser = savedGetSystemUser;
        ResetCollaborationCommsV2Transport();
    });

    it('registers RunScopedSpaceDigests, PreviewScopedSpaceDigest, and UpdateSpaceDigestCheckpoint in ClassFactory', () => {
        for (const [key, ctor] of [
            [RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY, RunScopedSpaceDigestsOperation],
            [PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY, PreviewScopedSpaceDigestOperation],
            [UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY, UpdateSpaceDigestCheckpointOperation],
        ] as const) {
            const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation>(
                BaseRemotableOperation,
                key,
            );
            expect(op).toBeInstanceOf(ctor);
        }
    });

    it('traverses multi-page composite (EventTimestamp, ID) keyset windows with identical timestamps and concurrent insertions without truncation or OFFSET', async () => {
        const events: DigestMockRow[] = [];
        // 14 initial events across 4 timestamps (some identical timestamps spanning page boundaries of size 4)
        for (let i = 1; i <= 14; i++) {
            const minute = Math.floor((i - 1) / 4); // 4 events per identical timestamp!
            events.push({
                ID: `aaaaaaaa-0000-4000-8000-${i.toString(16).padStart(12, '0')}`,
                SpaceID: i % 2 === 0 ? SPACE_CHILD_ID : SPACE_ROOT_ID,
                ActorUserID: ADMIN_ID,
                EventKind: 'Share',
                Band: 'Shared',
                Title: `Event ${i}`,
                Body: `Details ${i}`,
                TargetEntityID: null,
                TargetRecordID: null,
                MetadataJSON: null,
                EventTimestamp: `2026-11-23T10:0${minute}:00.000Z`,
            });
        }

        let injectedConcurrent = false;
        const { provider, queries, store } = createDigestMockHarness({
            events,
            onPageQuery: (pageIndex) => {
                if (pageIndex === 2 && !injectedConcurrent) {
                    injectedConcurrent = true;
                    // Concurrent insertion within the digest window at the identical timestamp + higher tie-breaker ID
                    events.push({
                        ID: 'aaaaaaaa-0000-4000-8000-fffffffffff1',
                        SpaceID: SPACE_ROOT_ID,
                        ActorUserID: ADMIN_ID,
                        EventKind: 'Mention',
                        Band: 'Shared',
                        Title: 'Concurrent mid-window insert',
                        Body: null,
                        TargetEntityID: null,
                        TargetRecordID: null,
                        MetadataJSON: null,
                        EventTimestamp: '2026-11-23T10:03:00.000Z',
                    });
                    // Concurrent insertion AFTER WindowEnd -> excluded cleanly from current snapshot window
                    events.push({
                        ID: 'aaaaaaaa-0000-4000-8000-fffffffffff2',
                        SpaceID: SPACE_ROOT_ID,
                        ActorUserID: ADMIN_ID,
                        EventKind: 'Share',
                        Band: 'Shared',
                        Title: 'Future post-window event',
                        Body: null,
                        TargetEntityID: null,
                        TargetRecordID: null,
                        MetadataJSON: null,
                        EventTimestamp: '2026-11-23T12:00:00.000Z',
                    });
                }
            },
        });

        const adminUser = makeUser(ADMIN_ID, { type: 'Owner' });
        const result = await runRunScopedSpaceDigests(provider, adminUser, {
            Cadence: 'Daily',
            RecipientUserIDs: [SHARED_MEMBER_ID],
            PageSize: 4,
            Now: '2026-11-23T11:00:00.000Z',
        });

        expect(result.Success).toBe(true);
        expect(result.PagesTraversed).toBeGreaterThanOrEqual(4);
        // All 14 initial + 1 mid-window concurrent insert = 15 traversed, future event excluded
        expect(result.TotalEventsScanned).toBe(15);
        expect(result.DeliveredCount).toBe(1);
        expect(result.CheckpointsAdvancedCount).toBe(1);
        expect(result.Outcomes[0].ItemsIncludedCount).toBe(15);

        // Zero OFFSET anywhere in queries, all RunView queries use ResultType: 'simple'
        expect(queries.every((q) => q.ResultType === 'simple')).toBe(true);
        const eventQueries = queries.filter((q) => q.EntityName === SPACE_NOTICE_EVENT_ENTITY);
        expect(eventQueries.every((q) => !String(q.ExtraFilter ?? '').toUpperCase().includes('OFFSET'))).toBe(true);
        expect(eventQueries.every((q) => q.OrderBy === 'EventTimestamp ASC, ID ASC')).toBe(true);

        // Second incremental run picks up the post-window event cleanly with zero duplicates!
        const secondRun = await runRunScopedSpaceDigests(provider, adminUser, {
            Cadence: 'Daily',
            RecipientUserIDs: [SHARED_MEMBER_ID],
            PageSize: 4,
            ForceWindow: true,
            Now: '2026-11-23T13:00:00.000Z',
        });
        expect(secondRun.Success).toBe(true);
        expect(secondRun.Outcomes[0].ItemsIncludedCount).toBe(1);
        expect(secondRun.Outcomes[0].Items[0].Title).toBe('Future post-window event');
        expect(store.checkpoints.length).toBe(1);
        expect(store.checkpoints[0].ItemsIncludedCount).toBe(1);
    });

    it('enforces fail-closed reach verification, empty-digest suppression, and preference controls', async () => {
        const itemSharedId = '88888888-0000-4000-8000-000000000001';
        const itemEscalatedToTeamId = '88888888-0000-4000-8000-000000000002';
        const itemDeletedId = '88888888-0000-4000-8000-000000000099';
        const chatPrivateId = '88888888-0000-4000-8000-000000000003';
        const notePrivateId = '88888888-0000-4000-8000-000000000004';

        const { provider } = createDigestMockHarness({
            events: [
                {
                    ID: 'bbbbbbbb-0000-4000-8000-000000000001',
                    SpaceID: SPACE_ROOT_ID,
                    ActorUserID: ADMIN_ID,
                    EventKind: 'Share',
                    Band: 'Shared',
                    Title: 'Shared deliverable',
                    TargetEntityID: SPACE_ITEMS_ENTITY_ID,
                    TargetRecordID: `ID|${itemSharedId}`,
                    EventTimestamp: '2026-11-23T09:00:00.000Z',
                },
                {
                    ID: 'bbbbbbbb-0000-4000-8000-000000000002',
                    SpaceID: SPACE_ROOT_ID,
                    ActorUserID: ADMIN_ID,
                    EventKind: 'Share',
                    Band: 'Shared',
                    Title: 'Moved to Team band',
                    TargetEntityID: SPACE_ITEMS_ENTITY_ID,
                    TargetRecordID: itemEscalatedToTeamId,
                    EventTimestamp: '2026-11-23T09:01:00.000Z',
                },
                {
                    ID: 'bbbbbbbb-0000-4000-8000-000000000003',
                    SpaceID: SPACE_ROOT_ID,
                    ActorUserID: ADMIN_ID,
                    EventKind: 'Share',
                    Band: 'Shared',
                    Title: 'Deleted item',
                    TargetEntityID: SPACE_ITEMS_ENTITY_ID,
                    TargetRecordID: itemDeletedId,
                    EventTimestamp: '2026-11-23T09:02:00.000Z',
                },
                {
                    ID: 'bbbbbbbb-0000-4000-8000-000000000004',
                    SpaceID: SPACE_ROOT_ID,
                    ActorUserID: ADMIN_ID,
                    EventKind: 'Reply',
                    Band: 'Shared',
                    Title: 'Chat became Private',
                    TargetEntityID: SPACE_CHATS_ENTITY_ID,
                    TargetRecordID: chatPrivateId,
                    EventTimestamp: '2026-11-23T09:03:00.000Z',
                },
                {
                    ID: 'bbbbbbbb-0000-4000-8000-000000000005',
                    SpaceID: SPACE_ROOT_ID,
                    ActorUserID: ADMIN_ID,
                    EventKind: 'Mention',
                    Band: 'Shared',
                    Title: 'Private author note',
                    TargetEntityID: SPACE_NOTES_ENTITY_ID,
                    TargetRecordID: notePrivateId,
                    EventTimestamp: '2026-11-23T09:04:00.000Z',
                },
            ],
            items: [
                { ID: itemSharedId, SpaceID: SPACE_ROOT_ID, Band: 'Shared' },
                { ID: itemEscalatedToTeamId, SpaceID: SPACE_ROOT_ID, Band: 'Team' },
            ],
            chats: [
                { ID: chatPrivateId, SpaceID: SPACE_ROOT_ID, Kind: 'Private', Status: 'Active', OwnerUserID: null },
            ],
            notes: [
                { ID: notePrivateId, SpaceID: SPACE_ROOT_ID, Band: 'Team', Visibility: 'Private', AuthorUserID: ADMIN_ID },
            ],
            settings: [
                {
                    ID: '90000000-0000-4000-8000-000000000001',
                    UserID: OPTED_OUT_MEMBER_ID,
                    Setting: COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
                    Value: serializeCollaborationNotificationPreferences({
                        ...createDefaultCollaborationNotificationPreferences(),
                        Digest: { Enabled: false, Cadence: 'Daily' },
                    }),
                },
            ],
        });

        const adminUser = makeUser(ADMIN_ID, { type: 'Owner' });
        const result = await runRunScopedSpaceDigests(provider, adminUser, {
            Cadence: 'Daily',
            RecipientUserIDs: [TEAM_MEMBER_ID, SHARED_MEMBER_ID, REVOKED_MEMBER_ID, OPTED_OUT_MEMBER_ID],
            Now: '2026-11-23T12:00:00.000Z',
        });

        expect(result.Success).toBe(true);
        const byUser = new Map(result.Outcomes.map((o) => [o.RecipientUserID, o]));

        // Team member sees Shared + Team item + Private chat (still excludes deleted item and another author's Private note)
        const teamOutcome = byUser.get(TEAM_MEMBER_ID)!;
        expect(teamOutcome.Dispatched).toBe(true);
        expect(teamOutcome.ItemsIncludedCount).toBe(3);

        // Shared member sees ONLY the 1 Shared item (Team item, deleted item, Private chat, Private note all excluded!)
        const sharedOutcome = byUser.get(SHARED_MEMBER_ID)!;
        expect(sharedOutcome.Dispatched).toBe(true);
        expect(sharedOutcome.ItemsIncludedCount).toBe(1);
        expect(sharedOutcome.ExcludedItemCount).toBe(4);

        // Revoked member has all items excluded -> strictly suppressed EmptyDigest, ZERO dispatch calls!
        const revokedOutcome = byUser.get(REVOKED_MEMBER_ID)!;
        expect(revokedOutcome.Dispatched).toBe(false);
        expect(revokedOutcome.SuppressionReason).toBe('EmptyDigest');

        // Opted-out member suppressed via DigestOptedOut
        const optedOutOutcome = byUser.get(OPTED_OUT_MEMBER_ID)!;
        expect(optedOutOutcome.Dispatched).toBe(false);
        expect(optedOutOutcome.SuppressionReason).toBe('DigestOptedOut');

        expect(dispatched.length).toBe(2);
    });

    it('reads live UserInfoEngine preference overrides, enforces caller auth, and supports Preview & UpdateCheckpoint', async () => {
        const { provider, store } = createDigestMockHarness({
            events: [
                {
                    ID: 'cccccccc-0000-4000-8000-000000000001',
                    SpaceID: SPACE_ROOT_ID,
                    ActorUserID: ADMIN_ID,
                    EventKind: 'Task',
                    Band: 'Shared',
                    Title: 'Task due tomorrow',
                    EventTimestamp: '2026-11-23T09:00:00.000Z',
                },
            ],
        });

        const sharedUser = makeUser(SHARED_MEMBER_ID);
        const anonUser = makeUser(SHARED_MEMBER_ID, { isMagicLinkAnonymous: true });

        await expect(runPreviewScopedSpaceDigest(provider, anonUser, {})).rejects.toThrow(/magic-link/i);
        await expect(
            runRunScopedSpaceDigests(provider, sharedUser, { RecipientUserIDs: [TEAM_MEMBER_ID] }),
        ).rejects.toThrow(/Administer Spaces/i);

        // Live UserInfoEngine quiet-hours overlay suppresses Email while keeping InApp
        const fakeUserInfoEngine: UserInfoEnginePreferenceBridge = {
            LoadedForUserId: SHARED_MEMBER_ID,
            GetSetting: (key: string) =>
                key === COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY
                    ? serializeCollaborationNotificationPreferences({
                          ...createDefaultCollaborationNotificationPreferences(),
                          QuietHours: {
                              Enabled: true,
                              StartTime: '22:00',
                              EndTime: '07:00',
                              Timezone: 'UTC',
                              SuppressedChannels: ['Email', 'SMS', 'Chat'],
                          },
                      })
                    : undefined,
            SetSettingDebounced: () => {},
            FlushPendingSettings: async () => {},
        };

        const preview = await runPreviewScopedSpaceDigest(
            provider,
            sharedUser,
            { Now: '2026-11-23T23:30:00.000Z' },
            fakeUserInfoEngine,
        );
        expect(preview.Success).toBe(true);
        expect(preview.Outcome?.ShouldDeliver).toBe(true);
        expect(preview.Outcome?.QuietHoursActive).toBe(true);
        expect(preview.Outcome?.PermittedChannels).toEqual(['InApp']);
        expect(dispatched.length).toBe(0);
        expect(store.checkpoints.length).toBe(0);

        // Pause checkpoint via UpdateSpaceDigestCheckpoint -> subsequent run skips delivery
        const paused = await runUpdateSpaceDigestCheckpoint(provider, sharedUser, {
            Cadence: 'Daily',
            Status: 'Paused',
        });
        expect(paused.Success).toBe(true);
        expect(paused.Checkpoint?.Status).toBe('Paused');

        const afterPause = await CollaborationEngineBase.Instance.RunScopedSpaceDigests(
            { Cadence: 'Daily', TargetUserID: SHARED_MEMBER_ID },
            sharedUser,
            provider,
        );
        expect(afterPause.Outcomes[0].SuppressionReason).toBe('CheckpointPaused');
        expect(dispatched.length).toBe(0);
    });
});
