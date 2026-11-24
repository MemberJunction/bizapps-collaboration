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
    COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
    COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
    createDefaultCollaborationNotificationPreferences,
    serializeCollaborationNotificationPreferences,
    SPACE_ITEMS_ENTITY_ID,
} from '@mj-biz-apps/collaboration-core';
import {
    CollaborationEngine,
    type CollaborationCommsV2Transport,
    type CommsV2TransportDispatchRequest,
    LoadCollaborationDigestOperations,
    LoadSpaceDigestCheckpointEntityServer,
    RegisterCollaborationCommsV2Transport,
    ResetCollaborationCommsV2Transport,
    SPACE_DIGEST_CHECKPOINT_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
    USER_NOTIFICATION_PREFERENCES_ENTITY,
    USER_NOTIFICATION_TYPES_ENTITY,
    USER_SETTINGS_ENTITY,
    USERS_ENTITY,
} from '@mj-biz-apps/collaboration-core-entities-server';

interface WorldDigestRow {
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
    __mj_CreatedAt?: string | Date;
}

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const ADA_OWNER_ID = 'D3000001-0000-4000-8000-000000000001';
const SAM_STAFF_ID = 'D3000001-0000-4000-8000-000000000002';
const CASEY_EXT_ID = 'D3000001-0000-4000-8000-000000000003';
const REVOKED_EXT_ID = 'D3000001-0000-4000-8000-000000000004';
const QUIET_EXT_ID = 'D3000001-0000-4000-8000-000000000005';

const ROOT_SPACE_ID = 'C2000001-0000-4000-8000-000000000001';
const CHILD_SPACE_ID = 'C2000001-0000-4000-8000-000000000002';
const SPACE_TYPE_ID = 'B2000001-0000-4000-8000-000000000001';
const ROLE_TEAM_ID = '03AD14E2-341A-4AC6-BA9D-E7AA5B31647B';
const ROLE_SHARED_ID = '7F565CD3-5E5C-4073-AD3D-55EFE85B0D40';
const STATUS_ACTIVE_ID = '33333333-3333-4333-8333-333333333301';
const DIGEST_TYPE_ID = '4A6D8B1E-2C3F-4E5A-9B7C-1D2E3F4A5B05';

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

function splitWorldAnd(filter: string): string[] {
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

function matchesWorldFilter(row: WorldDigestRow, rawFilter: string | undefined): boolean {
    if (!rawFilter || rawFilter.trim() === '') return true;
    for (const clause of splitWorldAnd(rawFilter)) {
        if (clause === '1 = 0') return false;

        const keyset =
            /^\(\s*[\["]?EventTimestamp[\]"]?\s*>\s*'([^']+)'\s+OR\s+\(\s*[\["]?EventTimestamp[\]"]?\s*=\s*'([^']+)'\s+AND\s+[\["]?ID[\]"]?\s*>\s*'([^']+)'\s*\)\s*\)$/i.exec(
                clause,
            );
        if (keyset) {
            const cursorMs = Date.parse(keyset[1]);
            const cursorId = keyset[3].toLowerCase();
            const rowMs =
                row.EventTimestamp instanceof Date
                    ? row.EventTimestamp.getTime()
                    : Date.parse(String(row.EventTimestamp ?? ''));
            const rowId = row.ID.toLowerCase();
            if (!(rowMs > cursorMs || (rowMs === cursorMs && rowId > cursorId))) return false;
            continue;
        }

        const lte = /^[\["]?EventTimestamp[\]"]?\s*<=\s*'([^']+)'$/i.exec(clause);
        if (lte) {
            const boundMs = Date.parse(lte[1]);
            const rowMs =
                row.EventTimestamp instanceof Date
                    ? row.EventTimestamp.getTime()
                    : Date.parse(String(row.EventTimestamp ?? ''));
            if (!(rowMs <= boundMs)) return false;
            continue;
        }

        const isNull = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s+IS\s+NULL$/i.exec(clause);
        if (isNull) {
            const actual = row[isNull[1] as keyof WorldDigestRow];
            if (actual !== null && actual !== undefined) return false;
            continue;
        }

        const inMatch = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s+IN\s*\(([^)]+)\)$/i.exec(clause);
        if (inMatch) {
            const field = inMatch[1];
            const allowed = inMatch[2]
                .split(',')
                .map((s) => s.trim().replace(/^'/, '').replace(/'$/, '').toLowerCase());
            const actual = String(row[field as keyof WorldDigestRow] ?? '').toLowerCase();
            if (!allowed.includes(actual)) return false;
            continue;
        }

        const eq = /^[\["]?([A-Za-z0-9_]+)[\]"]?\s*=\s*(.+)$/.exec(clause);
        if (eq) {
            const field = eq[1];
            const rawVal = eq[2].trim();
            const val = rawVal.startsWith("'") && rawVal.endsWith("'") ? rawVal.slice(1, -1).replace(/''/g, "'") : rawVal;
            const actual = row[field as keyof WorldDigestRow];
            if (typeof actual === 'boolean') {
                if ((val === '1' || val.toLowerCase() === 'true') !== actual) return false;
            } else if (String(actual ?? '').toLowerCase() !== val.toLowerCase()) {
                return false;
            }
        }
    }
    return true;
}

class WorldDigestCheckpointProxy implements WorldDigestRow {
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
        private readonly rows: WorldDigestRow[],
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
        const row: WorldDigestRow = {
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

describe('S10 Slice 3 World-Data-Model NT-2 Scoped Digests Integration', () => {
    let savedGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    const dispatched: CommsV2TransportDispatchRequest[] = [];

    beforeEach(() => {
        dispatched.length = 0;
        LoadCollaborationDigestOperations();
        LoadSpaceDigestCheckpointEntityServer();
        savedGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeWorldUser(SYSTEM_USER_ID, 'Owner');

        const spyTransport: CollaborationCommsV2Transport = {
            Name: 'WorldDigestSpyCommsV2Transport',
            Dispatch: async (req) => {
                dispatched.push(req);
                return {
                    Success: true,
                    DeliveredChannels: Object.entries(req.Payload.Channels)
                        .filter(([, on]) => on)
                        .map(([ch]) => ch as 'InApp' | 'Email' | 'SMS' | 'Chat'),
                    InAppNotificationID: req.Payload.Channels.InApp ? `digest-${req.Payload.RecipientUserID.slice(-4)}` : null,
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

    it('traverses 120+ multi-page keyset notice events without truncation, enforces fail-closed revocation exclusion, suppresses empty digests, and advances checkpoints via Comms v2', async () => {
        const spaces: WorldDigestRow[] = [
            {
                ID: ROOT_SPACE_ID,
                Name: 'Client Advisory',
                ParentID: null,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ADA_OWNER_ID,
                InheritsMembership: false,
                StatusID: STATUS_ACTIVE_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
                ID: CHILD_SPACE_ID,
                Name: 'Delivery Track',
                ParentID: ROOT_SPACE_ID,
                SpaceTypeID: SPACE_TYPE_ID,
                OwnerID: ADA_OWNER_ID,
                InheritsMembership: true,
                StatusID: STATUS_ACTIVE_ID,
                __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
            },
        ];

        const spaceMembers: WorldDigestRow[] = [
            { ID: '60000001-0000-4000-8000-000000000001', SpaceID: ROOT_SPACE_ID, UserID: SAM_STAFF_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active', __mj_CreatedAt: '2026-01-01T00:00:00.000Z' },
            { ID: '60000001-0000-4000-8000-000000000002', SpaceID: ROOT_SPACE_ID, UserID: CASEY_EXT_ID, SpaceRoleTypeID: ROLE_SHARED_ID, Band: 'Shared', Status: 'Active', __mj_CreatedAt: '2026-01-01T00:00:00.000Z' },
            { ID: '60000001-0000-4000-8000-000000000003', SpaceID: ROOT_SPACE_ID, UserID: REVOKED_EXT_ID, SpaceRoleTypeID: ROLE_SHARED_ID, Band: 'Shared', Status: 'Removed', __mj_CreatedAt: '2026-01-01T00:00:00.000Z' },
            { ID: '60000001-0000-4000-8000-000000000004', SpaceID: ROOT_SPACE_ID, UserID: QUIET_EXT_ID, SpaceRoleTypeID: ROLE_SHARED_ID, Band: 'Shared', Status: 'Active', __mj_CreatedAt: '2026-01-01T00:00:00.000Z' },
        ];

        const users: WorldDigestRow[] = [
            { ID: ADA_OWNER_ID, Name: 'Ada Owner', Email: 'ada@example.com', Type: 'Owner', IsActive: true },
            { ID: SAM_STAFF_ID, Name: 'Sam Staff', Email: 'sam@example.com', Type: 'User', IsActive: true },
            { ID: CASEY_EXT_ID, Name: 'Casey Ext', Email: 'casey@example.com', Type: 'User', IsActive: true },
            { ID: REVOKED_EXT_ID, Name: 'Revoked Ext', Email: 'revoked@example.com', Type: 'User', IsActive: true },
            { ID: QUIET_EXT_ID, Name: 'Quiet Ext', Email: 'quiet@example.com', Type: 'User', IsActive: true },
        ];

        const sharedItemId = '81000001-0000-4000-8000-000000000001';
        const demotedTeamItemId = '81000001-0000-4000-8000-000000000002';
        const spaceItems: WorldDigestRow[] = [
            { ID: sharedItemId, SpaceID: ROOT_SPACE_ID, Band: 'Shared' },
            // Item whose notice originally published on Shared band, but item was subsequently moved to Team band!
            { ID: demotedTeamItemId, SpaceID: CHILD_SPACE_ID, Band: 'Team' },
        ];

        // 120 notice events across identical-timestamp clusters (20 timestamps x 6 events each)
        const events: WorldDigestRow[] = [];
        for (let i = 1; i <= 120; i++) {
            const minute = Math.floor((i - 1) / 6);
            const isTeam = i % 3 === 0;
            const targetItem = i === 1 ? sharedItemId : i === 2 ? demotedTeamItemId : null;
            events.push({
                ID: `e0000001-0000-4000-8000-${i.toString(16).padStart(12, '0')}`,
                SpaceID: i % 2 === 0 ? CHILD_SPACE_ID : ROOT_SPACE_ID,
                ActorUserID: ADA_OWNER_ID,
                EventKind: 'Share',
                Band: isTeam ? 'Team' : 'Shared',
                Title: `Notice #${i}`,
                Body: `**Summary** for notice #${i}`,
                TargetEntityID: targetItem ? SPACE_ITEMS_ENTITY_ID : null,
                TargetRecordID: targetItem ? `ID|${targetItem}` : null,
                MetadataJSON: null,
                EventTimestamp: `2026-11-23T09:${minute.toString().padStart(2, '0')}:00.000Z`,
            });
        }

        const userSettings: WorldDigestRow[] = [
            {
                ID: '92000001-0000-4000-8000-000000000001',
                UserID: QUIET_EXT_ID,
                Setting: COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
                Value: serializeCollaborationNotificationPreferences({
                    ...createDefaultCollaborationNotificationPreferences(),
                    QuietHours: {
                        Enabled: true,
                        StartTime: '22:00',
                        EndTime: '07:00',
                        Timezone: 'America/Chicago',
                        SuppressedChannels: ['Email', 'SMS', 'Chat'],
                    },
                }),
            },
        ];

        const checkpoints: WorldDigestRow[] = [];
        const capturedQueries: RunViewParams[] = [];
        let seq = 1;

        const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
            ProviderType: ProviderType.Database,
            Entities: [],
            RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
                capturedQueries.push(params);
                let src: WorldDigestRow[] = [];
                switch (params.EntityName) {
                    case 'MJ_BizApps_Collaboration: Spaces':
                        src = spaces;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Members':
                        src = spaceMembers;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Role Types':
                        src = [
                            { ID: ROLE_TEAM_ID, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true, IsActive: true },
                            { ID: ROLE_SHARED_ID, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true, IsActive: true },
                        ];
                        break;
                    case 'MJ_BizApps_Collaboration: Space Type Status':
                        src = [{ ID: STATUS_ACTIVE_ID, Visible: true, ReadOnly: false }];
                        break;
                    case SPACE_NOTICE_EVENT_ENTITY:
                        src = events;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Items':
                        src = spaceItems;
                        break;
                    case 'MJ_BizApps_Collaboration: Space Chats':
                    case 'MJ_BizApps_Collaboration: Space Notes':
                        src = [];
                        break;
                    case SPACE_DIGEST_CHECKPOINT_ENTITY:
                        src = checkpoints;
                        break;
                    case USERS_ENTITY:
                        src = users;
                        break;
                    case USER_NOTIFICATION_TYPES_ENTITY:
                        src = [
                            {
                                ID: DIGEST_TYPE_ID,
                                Name: COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
                                DefaultInApp: true,
                                DefaultEmail: true,
                                DefaultSMS: false,
                                AllowUserPreference: true,
                            },
                        ];
                        break;
                    case USER_NOTIFICATION_PREFERENCES_ENTITY:
                        src = [];
                        break;
                    case USER_SETTINGS_ENTITY:
                        src = userSettings;
                        break;
                }
                const extra = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : undefined;
                const filtered = src.filter((r) => matchesWorldFilter(r, extra));
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
                    return new WorldDigestCheckpointProxy(
                        checkpoints,
                        () => `95000001-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`,
                    ) as T;
                }
                throw new Error(`Unexpected entity '${entityName}'`);
            },
        };

        const provider = providerImpl as IMetadataProvider;
        const ada = makeWorldUser(ADA_OWNER_ID, 'Owner');

        // 04:30 UTC = 22:30 America/Chicago (quiet hours active for QUIET_EXT_ID)
        const result = await CollaborationEngine.Instance.RunScopedSpaceDigests(
            {
                Cadence: 'Daily',
                RecipientUserIDs: [SAM_STAFF_ID, CASEY_EXT_ID, REVOKED_EXT_ID, QUIET_EXT_ID],
                PageSize: 17,
                Now: '2026-11-24T04:30:00.000Z',
            },
            ada,
            provider,
        );

        expect(result.Success).toBe(true);
        // 120 events / pageSize 17 => ceil(120/17) = 8 pages traversed (17*7 + 1)
        expect(result.PagesTraversed).toBe(8);
        expect(result.TotalEventsScanned).toBe(120);
        expect(result.DeliveredCount).toBe(3);
        expect(result.EmptySuppressedCount).toBe(1);
        expect(result.CheckpointsAdvancedCount).toBe(3);
        expect(capturedQueries.every((q) => q.ResultType === 'simple')).toBe(true);

        const byUser = new Map(result.Outcomes.map((o) => [o.RecipientUserID, o]));

        // Sam (Team) sees all 120 events (80 Shared + 40 Team) across ROOT + inherited CHILD
        expect(byUser.get(SAM_STAFF_ID.toLowerCase())?.ItemsIncludedCount).toBe(120);
        expect(byUser.get(SAM_STAFF_ID.toLowerCase())?.DeliveredChannels).toEqual(['InApp', 'Email']);

        // Casey (Shared) sees 80 Shared events MINUS event #2 whose underlying SpaceItem moved to Team = 79!
        expect(byUser.get(CASEY_EXT_ID.toLowerCase())?.ItemsIncludedCount).toBe(79);
        expect(byUser.get(CASEY_EXT_ID.toLowerCase())?.ExcludedItemCount).toBe(41);
        // Zero raw markdown syntax leaked in digest message
        expect(byUser.get(CASEY_EXT_ID.toLowerCase())?.Payload?.Message.includes('**')).toBe(false);

        // Revoked member strictly excluded -> EmptyDigest suppressed, ZERO dispatch calls!
        expect(byUser.get(REVOKED_EXT_ID.toLowerCase())?.Dispatched).toBe(false);
        expect(byUser.get(REVOKED_EXT_ID.toLowerCase())?.SuppressionReason).toBe('EmptyDigest');
        expect(dispatched.some((d) => d.Payload.RecipientUserID === REVOKED_EXT_ID.toLowerCase())).toBe(false);

        // Quiet hours member gets InApp only (Email suppressed)
        expect(byUser.get(QUIET_EXT_ID.toLowerCase())?.QuietHoursActive).toBe(true);
        expect(byUser.get(QUIET_EXT_ID.toLowerCase())?.DeliveredChannels).toEqual(['InApp']);

        // Second run with no new events -> every active member is WindowNotDue (and even with ForceWindow -> EmptyDigest)
        dispatched.length = 0;
        const repeatRun = await CollaborationEngine.Instance.RunScopedSpaceDigests(
            {
                Cadence: 'Daily',
                RecipientUserIDs: [SAM_STAFF_ID, CASEY_EXT_ID],
                ForceWindow: true,
                PageSize: 17,
                Now: '2026-11-24T05:00:00.000Z',
            },
            ada,
            provider,
        );
        expect(repeatRun.Success).toBe(true);
        expect(repeatRun.DeliveredCount).toBe(0);
        expect(repeatRun.EmptySuppressedCount).toBe(2);
        expect(dispatched.length).toBe(0);

        // CR-2 + CR-3 integration check: multi-space SpaceIDs creates per-space checkpoints without mutating SpaceID IS NULL,
        // and UpdateSpaceDigestCheckpoint rejects reachless spaces and cursor regressions.
        const thirdSpaceId = 'C2000001-0000-4000-8000-000000000099';
        spaces.push({
            ID: thirdSpaceId,
            Name: 'Third Restricted Space',
            ParentID: null,
            SpaceTypeID: SPACE_TYPE_ID,
            OwnerID: ADA_OWNER_ID,
            InheritsMembership: false,
            StatusID: STATUS_ACTIVE_ID,
            __mj_CreatedAt: '2026-01-01T00:00:00.000Z',
        });
        events.push({
            ID: 'e0000001-0000-4000-8000-000000000fff',
            SpaceID: ROOT_SPACE_ID,
            ActorUserID: ADA_OWNER_ID,
            EventKind: 'Share',
            Band: 'Shared',
            Title: 'Multi-space root notice',
            EventTimestamp: '2026-11-24T06:00:00.000Z',
        });
        events.push({
            ID: 'e0000001-0000-4000-8000-000000001000',
            SpaceID: CHILD_SPACE_ID,
            ActorUserID: ADA_OWNER_ID,
            EventKind: 'Share',
            Band: 'Shared',
            Title: 'Multi-space child notice',
            EventTimestamp: '2026-11-24T06:05:00.000Z',
        });

        const caseyUser = makeWorldUser(CASEY_EXT_ID);
        await expect(
            CollaborationEngine.Instance.UpdateSpaceDigestCheckpoint(
                { SpaceID: thirdSpaceId, Cadence: 'Daily', Status: 'Paused' },
                caseyUser,
                provider,
            ),
        ).rejects.toThrow(/active reach/i);

        const globalCpBefore = checkpoints.find(
            (c) => (c.UserID ?? '').toLowerCase() === CASEY_EXT_ID.toLowerCase() && c.SpaceID === null,
        );
        const globalTsBefore = globalCpBefore?.LastDeliveredTimestamp;

        const multiSpaceRun = await CollaborationEngine.Instance.RunScopedSpaceDigests(
            {
                Cadence: 'Daily',
                SpaceIDs: [ROOT_SPACE_ID, CHILD_SPACE_ID],
                RecipientUserIDs: [CASEY_EXT_ID],
                ForceWindow: true,
                Now: '2026-11-24T07:00:00.000Z',
            },
            ada,
            provider,
        );
        expect(multiSpaceRun.Success).toBe(true);
        expect(multiSpaceRun.DeliveredCount).toBe(1);
        // 79 historical Shared events + 2 new events across ROOT_SPACE_ID and CHILD_SPACE_ID (independent of global checkpoint)
        expect(multiSpaceRun.Outcomes[0].ItemsIncludedCount).toBe(81);
        // Global SpaceID IS NULL checkpoint remained untouched by the multi-space SpaceIDs run
        const globalCpAfter = checkpoints.find(
            (c) => (c.UserID ?? '').toLowerCase() === CASEY_EXT_ID.toLowerCase() && c.SpaceID === null,
        );
        expect(globalCpAfter?.LastDeliveredTimestamp).toBe(globalTsBefore);
        // Per-space checkpoints were written for ROOT_SPACE_ID and CHILD_SPACE_ID
        const caseySpaceCps = checkpoints.filter(
            (c) => (c.UserID ?? '').toLowerCase() === CASEY_EXT_ID.toLowerCase() && c.SpaceID !== null,
        );
        expect(caseySpaceCps.length).toBe(2);

        // Re-running multi-space SpaceIDs sees per-space checkpoints and suppresses empty digest
        const multiSpaceRepeat = await CollaborationEngine.Instance.RunScopedSpaceDigests(
            {
                Cadence: 'Daily',
                SpaceIDs: [ROOT_SPACE_ID, CHILD_SPACE_ID],
                RecipientUserIDs: [CASEY_EXT_ID],
                ForceWindow: true,
                Now: '2026-11-24T07:30:00.000Z',
            },
            ada,
            provider,
        );
        expect(multiSpaceRepeat.Success).toBe(true);
        expect(multiSpaceRepeat.DeliveredCount).toBe(0);
        expect(multiSpaceRepeat.EmptySuppressedCount).toBe(1);
    });
});
