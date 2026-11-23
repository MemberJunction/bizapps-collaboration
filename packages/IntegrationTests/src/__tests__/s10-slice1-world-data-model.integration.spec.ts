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
    CollaborationEngine,
    LoadCollaborationSpaceNoticeOperations,
    LoadSpaceDigestCheckpointEntityServer,
    LoadSpaceNoticeEventEntityServer,
    LoadSpaceNoticeWatermarkEntityServer,
    SPACE_NOTICE_EVENT_ENTITY,
    SPACE_NOTICE_WATERMARK_ENTITY,
} from '@mj-biz-apps/collaboration-core-entities-server';

interface WorldRow {
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

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const ADA_STAFF_ID = 'D2000001-0000-4000-8000-000000000001';
const SAM_STAFF_ID = 'D2000001-0000-4000-8000-000000000002';
const CASEY_EXT_ID = 'D2000001-0000-4000-8000-000000000003';
const BEA_EXT_NEW_ID = 'D2000001-0000-4000-8000-000000000004';

const ROOT_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const CHILD_DELIVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000003';
const SPACE_TYPE_ID = 'B1000001-0000-4000-8000-000000000001';

const ROLE_TEAM_MEMBER_ID = '03AD14E2-341A-4AC6-BA9D-E7AA5B31647B';
const ROLE_EXTERNAL_ID = '7F565CD3-5E5C-4073-AD3D-55EFE85B0D40';
const STATUS_ACTIVE_ID = '33333333-3333-4333-8333-333333333301';

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
            const val = rawVal.startsWith("'") && rawVal.endsWith("'") ? rawVal.slice(1, -1) : rawVal;
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

class WorldEntityProxy implements WorldRow {
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

    constructor(
        private readonly entityName: string,
        private readonly store: { events: WorldRow[]; watermarks: WorldRow[] },
        private readonly nextId: () => string,
    ) {}

    public async Load(id: string): Promise<boolean> {
        const list = this.entityName === SPACE_NOTICE_WATERMARK_ENTITY ? this.store.watermarks : this.store.events;
        const found = list.find((r) => r.ID.toLowerCase() === id.toLowerCase());
        if (!found) return false;
        Object.assign(this, found);
        return true;
    }

    public async Save(): Promise<boolean> {
        if (!this.ID) this.ID = this.nextId();
        if (this.entityName === SPACE_NOTICE_EVENT_ENTITY) {
            this.store.events.push({
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
            const row: WorldRow = {
                ID: this.ID,
                SpaceID: this.SpaceID,
                UserID: this.UserID,
                LastReadEventTimestamp: this.LastReadEventTimestamp,
                LastReadEventID: this.LastReadEventID,
                LastReadAt: this.LastReadAt,
            };
            const idx = this.store.watermarks.findIndex((w) => w.ID.toLowerCase() === this.ID.toLowerCase());
            if (idx >= 0) this.store.watermarks[idx] = row;
            else this.store.watermarks.push(row);
            return true;
        }
        return false;
    }
}

describe('S10 Slice 1 World-Data-Model CS-4 Integration', () => {
    let savedGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;

    beforeEach(() => {
        LoadCollaborationSpaceNoticeOperations();
        LoadSpaceNoticeEventEntityServer();
        LoadSpaceNoticeWatermarkEntityServer();
        LoadSpaceDigestCheckpointEntityServer();
        savedGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeWorldUser(SYSTEM_USER_ID, 'Owner');
    });

    afterEach(() => {
        WellKnownUserSource.Instance.GetSystemUser = savedGetSystemUser;
    });

    it('executes O(1) notice fan-out-on-read across multi-member inherited hierarchy with concurrent watermark isolation', async () => {
        const spaces: WorldRow[] = [
            {
                ID: ROOT_SPACE_ID,
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ADA_STAFF_ID,
                InheritsMembership: false,
                StatusID: STATUS_ACTIVE_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: CHILD_DELIVERY_SPACE_ID,
                ParentID: ROOT_SPACE_ID,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ADA_STAFF_ID,
                InheritsMembership: true,
                StatusID: STATUS_ACTIVE_ID,
                __mj_CreatedAt: '2026-02-01T00:00:00.000Z',
            },
        ];

        const spaceMembers: WorldRow[] = [
            {
                ID: '66666666-6666-4666-8666-000000000001',
                SpaceID: ROOT_SPACE_ID,
                UserID: SAM_STAFF_ID,
                SpaceRoleTypeID: ROLE_TEAM_MEMBER_ID,
                Band: 'Team',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '66666666-6666-4666-8666-000000000002',
                SpaceID: ROOT_SPACE_ID,
                UserID: CASEY_EXT_ID,
                SpaceRoleTypeID: ROLE_EXTERNAL_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: '66666666-6666-4666-8666-000000000003',
                SpaceID: ROOT_SPACE_ID,
                UserID: BEA_EXT_NEW_ID,
                SpaceRoleTypeID: ROLE_EXTERNAL_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-06-02T00:00:00.000Z',
            },
        ];

        // Scale out to 100+ total members on ROOT_SPACE to verify O(1) notice write amplification.
        for (let i = 10; i <= 115; i++) {
            spaceMembers.push({
                ID: `66666666-6666-4666-8666-${i.toString(16).padStart(12, '0')}`,
                SpaceID: ROOT_SPACE_ID,
                UserID: `77777777-7777-4777-8777-${i.toString(16).padStart(12, '0')}`,
                SpaceRoleTypeID: ROLE_EXTERNAL_ID,
                Band: 'Shared',
                Status: 'Active',
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            });
        }

        const store = { events: [] as WorldRow[], watermarks: [] as WorldRow[] };
        const capturedQueries: RunViewParams[] = [];
        let seq = 1;

        const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
            ProviderType: ProviderType.Database,
            DatabaseConnection: {},
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
                    case SPACE_NOTICE_EVENT_ENTITY:
                        src = store.events;
                        break;
                    case SPACE_NOTICE_WATERMARK_ENTITY:
                        src = store.watermarks;
                        break;
                    default:
                        src = [];
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
                const entity = new WorldEntityProxy(
                    entityName,
                    store,
                    () => `99999999-9999-4999-8999-${(++seq).toString(16).padStart(12, '0')}`,
                );
                return entity as T;
            },
        };

        const provider = providerImpl as IMetadataProvider;
        const engine = CollaborationEngine.Instance;
        const ada = makeWorldUser(ADA_STAFF_ID);
        const sam = makeWorldUser(SAM_STAFF_ID);
        const casey = makeWorldUser(CASEY_EXT_ID);
        const beaNew = makeWorldUser(BEA_EXT_NEW_ID);

        // 1. Pre-join Shared event on ROOT (2026-06-01), Team event on CHILD (2026-06-03), Post-join Shared event on CHILD (2026-06-04)
        const e1 = await engine.PublishSpaceNoticeEvent(
            {
                SpaceID: ROOT_SPACE_ID,
                EventKind: 'Announcement',
                Band: 'Shared',
                Title: 'Engagement kicked off',
                EventTimestamp: '2026-06-01T09:00:00.000Z',
            },
            ada,
            provider,
        );
        const e2 = await engine.PublishSpaceNoticeEvent(
            {
                SpaceID: CHILD_DELIVERY_SPACE_ID,
                EventKind: 'Task',
                Band: 'Team',
                Title: 'Internal staffing assignment',
                EventTimestamp: '2026-06-03T10:00:00.000Z',
            },
            sam,
            provider,
        );
        const e3 = await engine.PublishSpaceNoticeEvent(
            {
                SpaceID: CHILD_DELIVERY_SPACE_ID,
                EventKind: 'Share',
                Band: 'Shared',
                Title: 'Deliverable package shared',
                EventTimestamp: '2026-06-04T15:00:00.000Z',
            },
            sam,
            provider,
        );

        expect(e1.NoticeEventRowsWritten).toBe(1);
        expect(e2.NoticeEventRowsWritten).toBe(1);
        expect(e3.NoticeEventRowsWritten).toBe(1);
        // 3 events published to 108+ reachable members -> exactly 3 notice rows, 0 inbox rows
        expect(store.events.length).toBe(3);

        capturedQueries.length = 0;
        const [samCounts, caseyCounts, beaCounts] = await Promise.all([
            engine.GetSpaceUnreadNoticeCounts({}, sam, provider),
            engine.GetSpaceUnreadNoticeCounts({}, casey, provider),
            engine.GetSpaceUnreadNoticeCounts({}, beaNew, provider),
        ]);

        // Sam sees Shared + Team across root & inherited child = 3 unread
        expect(samCounts.TotalUnreadCount).toBe(3);
        // Casey sees only Shared across root & child = 2 unread
        expect(caseyCounts.TotalUnreadCount).toBe(2);
        // Bea joined 2026-06-02 -> e1 (2026-06-01) is before join baseline; e2 is Team; only e3 (2026-06-04) is unread
        expect(beaCounts.TotalUnreadCount).toBe(1);
        expect(capturedQueries.every((q) => q.ResultType === 'simple')).toBe(true);

        // Concurrent watermark advances for Sam & Casey remain completely isolated per member
        await Promise.all([
            engine.AdvanceSpaceNoticeWatermark({ SpaceID: ROOT_SPACE_ID, EventID: e1.Event?.ID }, sam, provider),
            engine.AdvanceSpaceNoticeWatermark({ SpaceID: CHILD_DELIVERY_SPACE_ID, EventID: e3.Event?.ID }, casey, provider),
        ]);

        const [samAfter, caseyAfter] = await Promise.all([
            engine.GetSpaceUnreadNoticeCounts({}, sam, provider),
            engine.GetSpaceUnreadNoticeCounts({}, casey, provider),
        ]);

        expect(samAfter.UnreadCountBySpace[ROOT_SPACE_ID.toLowerCase()]).toBe(0);
        expect(samAfter.UnreadCountBySpace[CHILD_DELIVERY_SPACE_ID.toLowerCase()]).toBe(2);
        expect(caseyAfter.UnreadCountBySpace[ROOT_SPACE_ID.toLowerCase()]).toBe(1);
        expect(caseyAfter.UnreadCountBySpace[CHILD_DELIVERY_SPACE_ID.toLowerCase()]).toBe(0);
    });
});
