import { describe, expect, it } from 'vitest';
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
    ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY,
    AdvanceSpaceNoticeWatermarkOperation,
    CollaborationEngineBase,
    GET_SPACE_NOTICES_OPERATION_KEY,
    GET_SPACE_UNREAD_NOTICE_COUNTS_OPERATION_KEY,
    GetSpaceNoticesOperation,
    GetSpaceUnreadNoticeCountsOperation,
    LoadCollaborationSpaceNoticeOperations,
    PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY,
    PublishSpaceNoticeEventOperation,
    runAdvanceSpaceNoticeWatermark,
    runGetSpaceNotices,
    runGetSpaceUnreadNoticeCounts,
    runPublishSpaceNoticeEvent,
    SPACE_NOTICE_EVENT_ENTITY,
    SPACE_NOTICE_WATERMARK_ENTITY,
} from '../index.js';

interface TestRecord {
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

const OWNER_ID = '11111111-1111-4111-8111-111111111101';
const TEAM_MEMBER_ID = '11111111-1111-4111-8111-111111111102';
const EXT_MEMBER_ID = '11111111-1111-4111-8111-111111111103';
const NEW_JOINER_ID = '11111111-1111-4111-8111-111111111104';
const OBSERVER_ID = '11111111-1111-4111-8111-111111111105';
const OUTSIDER_ID = '11111111-1111-4111-8111-111111111199';

const ROLE_TEAM_ID = '22222222-2222-4222-8222-222222222201';
const ROLE_SHARED_ID = '22222222-2222-4222-8222-222222222202';
const ROLE_OBSERVER_ID = '22222222-2222-4222-8222-222222222203';

const STATUS_OPEN_ID = '33333333-3333-4333-8333-333333333301';
const STATUS_HIDDEN_ID = '33333333-3333-4333-8333-333333333302';
const STATUS_READONLY_ID = '33333333-3333-4333-8333-333333333303';

const SPACE_ROOT_ID = '44444444-4444-4444-8444-444444444401';
const SPACE_CHILD_INHERIT_ID = '44444444-4444-4444-8444-444444444402';
const SPACE_HIDDEN_ID = '44444444-4444-4444-8444-444444444403';
const SPACE_READONLY_ID = '44444444-4444-4444-8444-444444444404';
const SPACE_TYPE_ID = '55555555-5555-4555-8555-555555555501';

function makeUser(id: string, opts?: { isMagicLinkAnonymous?: boolean }): UserInfo {
    const user: Partial<UserInfo> = {
        ID: id,
        Name: `User-${id.slice(-4)}`,
        Email: `user-${id.slice(-4)}@example.com`,
        Type: 'User',
        IsActive: true,
        IsMagicLinkAnonymous: opts?.isMagicLinkAnonymous ?? false,
        UserRoles: [],
    };
    return user as UserInfo;
}

function deterministicUuid(index: number): string {
    const hex = index.toString(16).padStart(12, '0');
    return `99999999-9999-4999-8999-${hex}`;
}

interface NoticeTestStore {
    spaces: TestRecord[];
    spaceMembers: TestRecord[];
    spaceRoleTypes: TestRecord[];
    spaceTypeStatuses: TestRecord[];
    noticeEvents: TestRecord[];
    noticeWatermarks: TestRecord[];
    capturedRunViewCalls: RunViewParams[];
    savedEntities: string[];
    simulateFirstWatermarkInsertRace: boolean;
}

function createInitialStore(): NoticeTestStore {
    return {
        spaces: [
            {
                ID: SPACE_ROOT_ID,
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: OWNER_ID,
                InheritsMembership: false,
                StatusID: STATUS_OPEN_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: SPACE_CHILD_INHERIT_ID,
                ParentID: SPACE_ROOT_ID,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: OWNER_ID,
                InheritsMembership: true,
                StatusID: STATUS_OPEN_ID,
                __mj_CreatedAt: '2026-01-02T00:00:00.000Z',
            },
            {
                ID: SPACE_HIDDEN_ID,
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: OWNER_ID,
                InheritsMembership: false,
                StatusID: STATUS_HIDDEN_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: SPACE_READONLY_ID,
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: OWNER_ID,
                InheritsMembership: false,
                StatusID: STATUS_READONLY_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
        ],
        spaceRoleTypes: [
            { ID: ROLE_TEAM_ID, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true },
            { ID: ROLE_SHARED_ID, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true, IsActive: true },
            { ID: ROLE_OBSERVER_ID, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: false, IsActive: true },
        ],
        spaceTypeStatuses: [
            { ID: STATUS_OPEN_ID, Visible: true, ReadOnly: false },
            { ID: STATUS_HIDDEN_ID, Visible: false, ReadOnly: false },
            { ID: STATUS_READONLY_ID, Visible: true, ReadOnly: true },
        ],
        spaceMembers: [
            {
                ID: '66666666-6666-4666-8666-666666666601',
                SpaceID: SPACE_ROOT_ID,
                UserID: TEAM_MEMBER_ID,
                SpaceRoleTypeID: ROLE_TEAM_ID,
                Band: 'Team',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '66666666-6666-4666-8666-666666666602',
                SpaceID: SPACE_ROOT_ID,
                UserID: EXT_MEMBER_ID,
                SpaceRoleTypeID: ROLE_SHARED_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '66666666-6666-4666-8666-666666666603',
                SpaceID: SPACE_ROOT_ID,
                UserID: NEW_JOINER_ID,
                SpaceRoleTypeID: ROLE_SHARED_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-05-01T12:00:00.000Z',
            },
            {
                ID: '66666666-6666-4666-8666-666666666604',
                SpaceID: SPACE_ROOT_ID,
                UserID: OBSERVER_ID,
                SpaceRoleTypeID: ROLE_OBSERVER_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '66666666-6666-4666-8666-666666666605',
                SpaceID: SPACE_HIDDEN_ID,
                UserID: TEAM_MEMBER_ID,
                SpaceRoleTypeID: ROLE_TEAM_ID,
                Band: 'Team',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '66666666-6666-4666-8666-666666666606',
                SpaceID: SPACE_READONLY_ID,
                UserID: TEAM_MEMBER_ID,
                SpaceRoleTypeID: ROLE_TEAM_ID,
                Band: 'Team',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
        ],
        noticeEvents: [],
        noticeWatermarks: [],
        capturedRunViewCalls: [],
        savedEntities: [],
        simulateFirstWatermarkInsertRace: false,
    };
}

function matchesSimpleFilter(row: TestRecord, filterRaw: string | undefined): boolean {
    if (!filterRaw || filterRaw.trim() === '') return true;
    const clauses = filterRaw.split(/\s+AND\s+/i).map((c) => c.trim());
    for (const clause of clauses) {
        if (clause === '1 = 0') return false;
        const eqMatch = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s*=\s*(.+)$/.exec(clause);
        if (eqMatch) {
            const field = eqMatch[1];
            const rawVal = eqMatch[2].trim();
            const val = rawVal.startsWith("'") && rawVal.endsWith("'") ? rawVal.slice(1, -1) : rawVal;
            const actual = field === 'ID' ? row.ID : (row[field as keyof TestRecord] as string | boolean | null | undefined);
            if (typeof actual === 'boolean') {
                if ((val === '1' || val.toLowerCase() === 'true') !== actual) return false;
            } else if ((actual ?? '').toString().toLowerCase() !== val.toLowerCase()) {
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
            const actual = String(row[field as keyof TestRecord] ?? '').toLowerCase();
            if (!allowed.includes(actual)) return false;
            continue;
        }
    }
    return true;
}

class MockNoticeEntity implements TestRecord {
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
    public LastReadEventTimestamp: string | Date = new Date();
    public LastReadEventID: string | null = null;
    public LastReadAt: string | Date = new Date();
    public LatestResult: { CompleteMessage?: string; Message?: string } | null = null;

    private isSaved = false;

    constructor(
        private readonly entityName: string,
        private readonly store: NoticeTestStore,
        private readonly nextId: () => string,
    ) {}

    public async Load(id: string): Promise<boolean> {
        const list = this.entityName === SPACE_NOTICE_WATERMARK_ENTITY ? this.store.noticeWatermarks : this.store.noticeEvents;
        const found = list.find((r) => r.ID.toLowerCase() === id.toLowerCase());
        if (!found) return false;
        Object.assign(this, found);
        this.isSaved = true;
        return true;
    }

    public async Save(): Promise<boolean> {
        this.store.savedEntities.push(this.entityName);
        if (this.entityName === SPACE_NOTICE_EVENT_ENTITY) {
            if (!this.ID) this.ID = this.nextId();
            this.store.noticeEvents.push({
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
            this.isSaved = true;
            return true;
        }

        if (this.entityName === SPACE_NOTICE_WATERMARK_ENTITY) {
            if (!this.isSaved && this.store.simulateFirstWatermarkInsertRace) {
                this.store.simulateFirstWatermarkInsertRace = false;
                // Concurrent writer inserted a newer watermark first
                this.store.noticeWatermarks.push({
                    ID: this.nextId(),
                    SpaceID: this.SpaceID,
                    UserID: this.UserID ?? EXT_MEMBER_ID,
                    LastReadEventTimestamp: '2026-06-10T10:00:00.000Z',
                    LastReadEventID: '99999999-9999-4999-8999-000000000999',
                    LastReadAt: new Date().toISOString(),
                });
                this.LatestResult = {
                    Message: 'UQ_SpaceNoticeWatermark_Space_User unique constraint violation',
                };
                return false;
            }
            if (!this.ID) this.ID = this.nextId();
            const row: TestRecord = {
                ID: this.ID,
                SpaceID: this.SpaceID,
                UserID: this.UserID,
                LastReadEventTimestamp: this.LastReadEventTimestamp,
                LastReadEventID: this.LastReadEventID,
                LastReadAt: this.LastReadAt,
            };
            const idx = this.store.noticeWatermarks.findIndex((w) => w.ID.toLowerCase() === this.ID.toLowerCase());
            if (idx >= 0) {
                this.store.noticeWatermarks[idx] = row;
            } else {
                this.store.noticeWatermarks.push(row);
            }
            this.isSaved = true;
            return true;
        }

        return false;
    }

    public UserID = '';
}

function createMockProvider(store: NoticeTestStore): IMetadataProvider {
    let seq = 10;
    const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
        ProviderType: ProviderType.Database,
        DatabaseConnection: {},
        Entities: [],
        RunView: async <T>(params: RunViewParams, _contextUser?: UserInfo): Promise<RunViewResult<T>> => {
            store.capturedRunViewCalls.push(params);
            let source: TestRecord[] = [];
            switch (params.EntityName) {
                case 'MJ_BizApps_Collaboration: Spaces':
                    source = store.spaces;
                    break;
                case 'MJ_BizApps_Collaboration: Space Members':
                    source = store.spaceMembers;
                    break;
                case 'MJ_BizApps_Collaboration: Space Role Types':
                    source = store.spaceRoleTypes;
                    break;
                case 'MJ_BizApps_Collaboration: Space Type Status':
                    source = store.spaceTypeStatuses;
                    break;
                case SPACE_NOTICE_EVENT_ENTITY:
                    source = store.noticeEvents;
                    break;
                case SPACE_NOTICE_WATERMARK_ENTITY:
                    source = store.noticeWatermarks;
                    break;
                default:
                    source = [];
            }

            let filtered = source.filter((r) => matchesSimpleFilter(r, params.ExtraFilter));
            filtered = [...filtered].sort((a, b) => a.ID.toLowerCase().localeCompare(b.ID.toLowerCase()));
            const afterKeyId = params.AfterKey?.GetValueByIndex(0);
            if (typeof afterKeyId === 'string' && afterKeyId) {
                filtered = filtered.filter((r) => r.ID.toLowerCase() > afterKeyId.toLowerCase());
            }
            const limited = typeof params.MaxRows === 'number' && params.MaxRows > 0 ? filtered.slice(0, params.MaxRows) : filtered;
            const rows: T[] = limited.map((row) => ({ ...row }) as T);
            return {
                Success: true,
                Results: rows,
                UserViewRunID: '',
                RowCount: rows.length,
                TotalRowCount: filtered.length,
                ExecutionTime: 1,
                ErrorMessage: '',
            };
        },
        RunViews: async <T>(params: RunViewParams[], contextUser?: UserInfo): Promise<RunViewResult<T>[]> => {
            const out: RunViewResult<T>[] = [];
            for (const p of params) {
                out.push(await (providerImpl.RunView as NonNullable<IRunViewProvider['RunView']>)(p, contextUser));
            }
            return out;
        },
        GetEntityObject: async <T>(entityName: string): Promise<T> => {
            const entityObj = new MockNoticeEntity(entityName, store, () => deterministicUuid(++seq));
            return entityObj as T;
        },
    };
    return providerImpl as IMetadataProvider;
}

describe('CS-4 Fan-Out-on-Read Space Notices Engine', () => {
    it('writes exactly 1 SpaceNoticeEvent row and 0 per-member inbox rows when publishing to a 500-member space (O(1) write)', async () => {
        const store = createInitialStore();
        for (let i = 100; i < 600; i++) {
            store.spaceMembers.push({
                ID: `66666666-6666-4666-8666-${i.toString(16).padStart(12, '0')}`,
                SpaceID: SPACE_ROOT_ID,
                UserID: `77777777-7777-4777-8777-${i.toString(16).padStart(12, '0')}`,
                SpaceRoleTypeID: ROLE_SHARED_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            });
        }
        const provider = createMockProvider(store);
        const owner = makeUser(OWNER_ID);

        const res = await runPublishSpaceNoticeEvent(provider, owner, {
            SpaceID: SPACE_ROOT_ID,
            EventKind: 'Announcement',
            Band: 'Shared',
            Title: 'Quarterly roadmap uploaded',
            EventTimestamp: '2026-06-01T09:00:00.000Z',
        });

        expect(res.Success).toBe(true);
        expect(res.NoticeEventRowsWritten).toBe(1);
        expect(res.PerMemberInboxRowsWritten).toBe(0);
        expect(store.noticeEvents.length).toBe(1);
        expect(store.savedEntities).toEqual([SPACE_NOTICE_EVENT_ENTITY]);
        expect(res.Event?.ActorUserID).toBe(OWNER_ID);
    });

    it('uses batched RunView (ResultType: simple) and enforces Team vs Shared band visibility', async () => {
        const store = createInitialStore();
        const provider = createMockProvider(store);
        const teamUser = makeUser(TEAM_MEMBER_ID);
        const extUser = makeUser(EXT_MEMBER_ID);

        await runPublishSpaceNoticeEvent(provider, teamUser, {
            SpaceID: SPACE_ROOT_ID,
            EventKind: 'Share',
            Band: 'Shared',
            Title: 'Shared budget posted',
            EventTimestamp: '2026-06-01T10:00:00.000Z',
        });
        await runPublishSpaceNoticeEvent(provider, teamUser, {
            SpaceID: SPACE_ROOT_ID,
            EventKind: 'Task',
            Band: 'Team',
            Title: 'Internal escalation review',
            EventTimestamp: '2026-06-01T10:05:00.000Z',
        });

        await expect(
            runPublishSpaceNoticeEvent(provider, extUser, {
                SpaceID: SPACE_ROOT_ID,
                EventKind: 'Task',
                Band: 'Team',
                Title: 'Should be forbidden for Shared-band caller',
            }),
        ).rejects.toThrow(/Shared-band callers/);

        store.capturedRunViewCalls.length = 0;
        const teamFeed = await runGetSpaceNotices(provider, teamUser, { SpaceID: SPACE_ROOT_ID });
        const extFeed = await runGetSpaceNotices(provider, extUser, { SpaceID: SPACE_ROOT_ID });

        expect(teamFeed.TotalUnreadCount).toBe(2);
        expect(teamFeed.Notices.map((n) => n.Title)).toEqual(['Internal escalation review', 'Shared budget posted']);

        expect(extFeed.TotalUnreadCount).toBe(1);
        expect(extFeed.Notices.map((n) => n.Title)).toEqual(['Shared budget posted']);

        // Every RunView issued during notice reads used ResultType: 'simple' (zero BaseEntity hydration).
        expect(store.capturedRunViewCalls.length).toBeGreaterThan(0);
        expect(store.capturedRunViewCalls.every((c) => c.ResultType === 'simple')).toBe(true);
    });

    it('resolves identical-timestamp tie-breaking deterministically using composite (EventTimestamp, ID)', async () => {
        const store = createInitialStore();
        const ts = '2026-06-02T12:00:00.000Z';
        store.noticeEvents.push(
            {
                ID: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
                SpaceID: SPACE_ROOT_ID,
                ActorUserID: OWNER_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Event Lower ID',
                EventTimestamp: ts,
            },
            {
                ID: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
                SpaceID: SPACE_ROOT_ID,
                ActorUserID: OWNER_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Event Higher ID',
                EventTimestamp: ts,
            },
        );
        const provider = createMockProvider(store);
        const extUser = makeUser(EXT_MEMBER_ID);

        const adv = await runAdvanceSpaceNoticeWatermark(provider, extUser, {
            SpaceID: SPACE_ROOT_ID,
            EventID: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
        });
        expect(adv.Success).toBe(true);
        expect(adv.Advanced).toBe(true);

        const feed = await runGetSpaceNotices(provider, extUser, { SpaceID: SPACE_ROOT_ID });
        expect(feed.TotalUnreadCount).toBe(1);
        const lower = feed.Notices.find((n) => n.ID === 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001');
        const higher = feed.Notices.find((n) => n.ID === 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002');
        expect(lower?.IsUnread).toBe(false);
        expect(higher?.IsUnread).toBe(true);
    });

    it('applies member join baseline for newly joined members without watermarks', async () => {
        const store = createInitialStore();
        store.noticeEvents.push(
            {
                ID: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
                SpaceID: SPACE_ROOT_ID,
                ActorUserID: OWNER_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Pre-join notice',
                EventTimestamp: '2026-04-01T10:00:00.000Z',
            },
            {
                ID: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',
                SpaceID: SPACE_ROOT_ID,
                ActorUserID: OWNER_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Post-join notice',
                EventTimestamp: '2026-05-02T10:00:00.000Z',
            },
        );
        const provider = createMockProvider(store);
        const newJoiner = makeUser(NEW_JOINER_ID);

        const counts = await runGetSpaceUnreadNoticeCounts(provider, newJoiner, { SpaceIDs: [SPACE_ROOT_ID] });
        expect(counts.TotalUnreadCount).toBe(1);
        expect(counts.UnreadCountBySpace[SPACE_ROOT_ID]).toBe(1);

        const feed = await runGetSpaceNotices(provider, newJoiner, { SpaceID: SPACE_ROOT_ID });
        const preJoin = feed.Notices.find((n) => n.Title === 'Pre-join notice');
        const postJoin = feed.Notices.find((n) => n.Title === 'Post-join notice');
        expect(preJoin?.IsUnread).toBe(false);
        expect(postJoin?.IsUnread).toBe(true);
    });

    it('propagates inherited parent membership to InheritsMembership children and hides Visible=false spaces from non-owners', async () => {
        const store = createInitialStore();
        const provider = createMockProvider(store);
        const owner = makeUser(OWNER_ID);
        const teamUser = makeUser(TEAM_MEMBER_ID);

        await runPublishSpaceNoticeEvent(provider, owner, {
            SpaceID: SPACE_CHILD_INHERIT_ID,
            EventKind: 'Approval',
            Band: 'Shared',
            Title: 'Inherited child milestone approved',
            EventTimestamp: '2026-06-03T10:00:00.000Z',
        });
        await runPublishSpaceNoticeEvent(provider, owner, {
            SpaceID: SPACE_HIDDEN_ID,
            EventKind: 'System',
            Band: 'Shared',
            Title: 'Hidden status owner-only notice',
            EventTimestamp: '2026-06-03T11:00:00.000Z',
        });

        const teamCounts = await runGetSpaceUnreadNoticeCounts(provider, teamUser);
        expect(teamCounts.UnreadCountBySpace[SPACE_CHILD_INHERIT_ID]).toBe(1);
        expect(teamCounts.UnreadCountBySpace[SPACE_HIDDEN_ID]).toBeUndefined();

        const ownerCounts = await runGetSpaceUnreadNoticeCounts(provider, owner);
        expect(ownerCounts.UnreadCountBySpace[SPACE_HIDDEN_ID]).toBe(1);
    });

    it('advances watermarks monotonically/idempotently and handles concurrent insert collisions safely', async () => {
        const store = createInitialStore();
        store.noticeEvents.push(
            {
                ID: 'cccccccc-cccc-4ccc-8ccc-000000000001',
                SpaceID: SPACE_ROOT_ID,
                ActorUserID: OWNER_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Older notice',
                EventTimestamp: '2026-06-05T10:00:00.000Z',
            },
            {
                ID: 'cccccccc-cccc-4ccc-8ccc-000000000002',
                SpaceID: SPACE_ROOT_ID,
                ActorUserID: OWNER_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Newer notice',
                EventTimestamp: '2026-06-06T10:00:00.000Z',
            },
        );
        const provider = createMockProvider(store);
        const extUser = makeUser(EXT_MEMBER_ID);

        // Step 1: Advance to newer notice
        const first = await runAdvanceSpaceNoticeWatermark(provider, extUser, {
            SpaceID: SPACE_ROOT_ID,
            EventID: 'cccccccc-cccc-4ccc-8ccc-000000000002',
        });
        expect(first.Advanced).toBe(true);
        expect(store.noticeWatermarks.length).toBe(1);

        // Step 2: Re-advancing to older notice must NOT regress watermark
        const backward = await runAdvanceSpaceNoticeWatermark(provider, extUser, {
            SpaceID: SPACE_ROOT_ID,
            EventID: 'cccccccc-cccc-4ccc-8ccc-000000000001',
        });
        expect(backward.Success).toBe(true);
        expect(backward.Advanced).toBe(false);
        expect(backward.Watermark?.LastReadEventID).toBe('cccccccc-cccc-4ccc-8ccc-000000000002');

        // Step 3: Concurrent insert collision simulation
        store.noticeWatermarks.length = 0;
        store.simulateFirstWatermarkInsertRace = true;
        const raced = await runAdvanceSpaceNoticeWatermark(provider, extUser, {
            SpaceID: SPACE_ROOT_ID,
            EventID: 'cccccccc-cccc-4ccc-8ccc-000000000001',
        });
        expect(raced.Success).toBe(true);
        expect(raced.Advanced).toBe(false);
        expect(raced.Watermark?.LastReadEventID).toBe('99999999-9999-4999-8999-000000000999');
    });

    it('rejects outsiders, read-only observers, read-only status spaces, and anonymous magic-link callers', async () => {
        const store = createInitialStore();
        const provider = createMockProvider(store);

        await expect(
            runPublishSpaceNoticeEvent(provider, makeUser(OUTSIDER_ID), {
                SpaceID: SPACE_ROOT_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Outsider attempt',
            }),
        ).rejects.toThrow(/active reach/);

        await expect(
            runPublishSpaceNoticeEvent(provider, makeUser(OBSERVER_ID), {
                SpaceID: SPACE_ROOT_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Observer write attempt',
            }),
        ).rejects.toThrow(/contribution permission/);

        await expect(
            runPublishSpaceNoticeEvent(provider, makeUser(TEAM_MEMBER_ID), {
                SpaceID: SPACE_READONLY_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Read-only status write attempt',
            }),
        ).rejects.toThrow(/read-only status/);

        await expect(
            runGetSpaceNotices(provider, makeUser(OWNER_ID, { isMagicLinkAnonymous: true }), {
                SpaceID: SPACE_ROOT_ID,
            }),
        ).rejects.toThrow(/Anonymous magic-link/);
    });

    it('registers BaseRemotableOperation subclasses and routes CollaborationEngineBase notice methods cleanly', async () => {
        LoadCollaborationSpaceNoticeOperations();
        const store = createInitialStore();
        const provider = createMockProvider(store);
        const owner = makeUser(OWNER_ID);

        const pubOp = MJGlobal.Instance.ClassFactory.CreateInstance<PublishSpaceNoticeEventOperation>(
            BaseRemotableOperation,
            PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY,
        );
        const getOp = MJGlobal.Instance.ClassFactory.CreateInstance<GetSpaceNoticesOperation>(
            BaseRemotableOperation,
            GET_SPACE_NOTICES_OPERATION_KEY,
        );
        const countOp = MJGlobal.Instance.ClassFactory.CreateInstance<GetSpaceUnreadNoticeCountsOperation>(
            BaseRemotableOperation,
            GET_SPACE_UNREAD_NOTICE_COUNTS_OPERATION_KEY,
        );
        const wmOp = MJGlobal.Instance.ClassFactory.CreateInstance<AdvanceSpaceNoticeWatermarkOperation>(
            BaseRemotableOperation,
            ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY,
        );

        expect(pubOp).toBeInstanceOf(PublishSpaceNoticeEventOperation);
        expect(getOp).toBeInstanceOf(GetSpaceNoticesOperation);
        expect(countOp).toBeInstanceOf(GetSpaceUnreadNoticeCountsOperation);
        expect(wmOp).toBeInstanceOf(AdvanceSpaceNoticeWatermarkOperation);
        expect(pubOp?.DisallowMagicLinkScope).toBe(true);
        expect(pubOp?.GrantsServerWriteAuthority).toBe(true);
        expect(getOp?.GrantsServerWriteAuthority).toBe(false);

        const engine = CollaborationEngineBase.Instance;
        const published = await engine.PublishSpaceNoticeEvent(
            {
                SpaceID: SPACE_ROOT_ID,
                EventKind: 'Mention',
                Band: 'Shared',
                Title: 'Engine wrapper notice',
            },
            owner,
            provider,
        );
        expect(published.Success).toBe(true);
        expect(published.NoticeEventRowsWritten).toBe(1);

        const notices = await engine.GetSpaceNotices({ SpaceID: SPACE_ROOT_ID }, makeUser(EXT_MEMBER_ID), provider);
        expect(notices.TotalUnreadCount).toBe(1);

        const counts = await engine.GetSpaceUnreadNoticeCounts({}, makeUser(EXT_MEMBER_ID), provider);
        expect(counts.TotalUnreadCount).toBe(1);

        const marked = await engine.AdvanceSpaceNoticeWatermark(
            { SpaceID: SPACE_ROOT_ID, EventID: published.Event?.ID },
            makeUser(EXT_MEMBER_ID),
            provider,
        );
        expect(marked.Advanced).toBe(true);
    });

    it('marks sub-millisecond DATETIMEOFFSET(7) events read after watermark advance and quotes PostgreSQL ExtraFilters cleanly', async () => {
        const store = createInitialStore();
        const subMsEventId = 'dddddddd-dddd-4ddd-8ddd-000000000001';
        const laterSubMsEventId = 'dddddddd-dddd-4ddd-8ddd-000000000002';
        store.noticeEvents.push(
            {
                ID: subMsEventId,
                SpaceID: SPACE_ROOT_ID,
                ActorUserID: OWNER_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Sub-ms precision notice',
                EventTimestamp: '2026-06-15T14:00:00.1234567Z',
            },
            {
                ID: laterSubMsEventId,
                SpaceID: SPACE_ROOT_ID,
                ActorUserID: OWNER_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Later same-ms notice',
                EventTimestamp: '2026-06-15T14:00:00.1239999Z',
            },
        );
        const provider = createMockProvider(store);
        const extUser = makeUser(EXT_MEMBER_ID);

        const adv = await runAdvanceSpaceNoticeWatermark(provider, extUser, {
            SpaceID: SPACE_ROOT_ID,
            EventID: subMsEventId,
            Dialect: 'postgresql',
        });
        expect(adv.Success).toBe(true);
        expect(adv.Advanced).toBe(true);

        store.capturedRunViewCalls.length = 0;
        const feed = await runGetSpaceNotices(provider, extUser, {
            SpaceID: SPACE_ROOT_ID,
            Dialect: 'postgresql',
        });
        const firstNotice = feed.Notices.find((n) => n.ID === subMsEventId);
        const secondNotice = feed.Notices.find((n) => n.ID === laterSubMsEventId);
        expect(firstNotice?.IsUnread).toBe(false);
        expect(secondNotice?.IsUnread).toBe(true);
        expect(feed.TotalUnreadCount).toBe(1);

        const counts = await runGetSpaceUnreadNoticeCounts(provider, extUser, { Dialect: 'postgresql' });
        expect(counts.UnreadCountBySpace[SPACE_ROOT_ID]).toBe(1);

        const filters = store.capturedRunViewCalls
            .map((c) => c.ExtraFilter ?? '')
            .filter((f) => f.length > 0);
        expect(filters.some((f) => f.includes('"InheritsMembership" = TRUE'))).toBe(true);
        expect(filters.every((f) => !f.includes('InheritsMembership = 1'))).toBe(true);
        expect(filters.every((f) => !/\[[A-Za-z0-9_]+\]/.test(f))).toBe(true);
        expect(filters.every((f) => !/(^|[^"])\b(?:UserID|OwnerID|SpaceID|Status|ParentID|InheritsMembership|ID)\b/.test(f))).toBe(true);
    });
});
