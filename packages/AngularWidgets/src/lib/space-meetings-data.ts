import {
    type BaseEntity,
    type IMetadataProvider,
    type IRunViewProvider,
    Metadata,
    RunView,
} from '@memberjunction/core';
import type {
    AgendaItemDraft,
    AgendaItemModel,
    AgendaItemStatus,
    AgendaItemTypeOption,
    AttendanceStatus,
    AttendeeModel,
    AttendeeRole,
    FollowUpDraft,
    FollowUpModel,
    MeetingLocationType,
    MeetingPermissions,
    MeetingRow,
    MeetingStatus,
    MeetingVisibility,
    NoteDraft,
    NoteKind,
    NoteModel,
    PersonOption,
    ProposedTaskModel,
    ResponseStatus,
} from '@mj-biz-apps/tasks-ng-widgets';

export const COLLABORATION_SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
export const TASKS_MEETINGS_ENTITY_ID = 'D8B37817-4EB1-414C-9273-5977AB80DB63';
export const TASKS_MEETING_AGENDA_ITEMS_ENTITY_ID = '9C171F1D-86F9-4630-8548-1DC6163272CA';

export interface SpaceChildSummary {
    ID: string;
    Name: string;
    ParentID: string | null;
}

export interface SpaceMeetingCardItem {
    ID: string;
    Name: string;
    StartsAt: string;
    EndsAt: string;
    TimeZone?: string;
    Status: string;
    LocationType?: string;
    Location?: string | null;
    VideoJoinURL?: string | null;
    Visibility?: 'Standard' | 'Private';
    Description?: string | null;
    SeriesID?: string | null;
    TypeName?: string | null;
    TypeIcon?: string | null;
    OrganizerPersonID?: string | null;
    OrganizerName?: string | null;
    CancellationReason?: string | null;
    ActualStartedAt?: string | null;
    SpaceID?: string | null;
    SpaceName?: string | null;
    SpaceChatID?: string | null;
    ConversationID?: string | null;
    AgendaCount?: number;
    NoteCount?: number;
    AttendeeCount?: number;
    MyAttendeeID?: string | null;
    MyResponse?: ResponseStatus | null;
    IsMine?: boolean;
}

export interface SpaceMeetingDetailBundle {
    Meeting: SpaceMeetingCardItem;
    MeetingRow: MeetingRow;
    AgendaItems: AgendaItemModel[];
    AgendaItemTypes: AgendaItemTypeOption[];
    Attendees: AttendeeModel[];
    Notes: NoteModel[];
    FollowUps: FollowUpModel[];
    People: PersonOption[];
    CancellationReason: string | null;
    ActualStartedAt: Date | null;
}

export type SpaceMeetingsFilterMode = 'upcoming' | 'past' | 'all';
export type SpaceMeetingsBandFilter = 'all' | 'Shared' | 'Team';

export interface SpaceMeetingsLoadOptions {
    IncludeSubSpaces?: boolean;
    CurrentUserId?: string | null;
    CurrentPersonId?: string | null;
    CanSeeTeamSide?: boolean;
    RootSpaceName?: string | null;
}

export interface SpaceMeetingsLoadResult {
    Meetings: SpaceMeetingCardItem[];
    ChildSpaces: SpaceChildSummary[];
}

export interface EditableMeetingEntity extends BaseEntity {
    ID: string;
    Status: MeetingStatus;
    ActualStartedAt: Date | null;
    ActualEndedAt: Date | null;
    CancelledAt: Date | null;
    CancellationReason: string | null;
    Load(id: string): Promise<boolean>;
}

export interface EditableAttendeeEntity extends BaseEntity {
    ID: string;
    MeetingID: string;
    PersonID: string | null;
    UserID: string | null;
    Email: string | null;
    DisplayName: string | null;
    Role: AttendeeRole;
    ResponseStatus: ResponseStatus;
    RespondedAt: Date | null;
    AttendanceStatus: AttendanceStatus;
    Load(id: string): Promise<boolean>;
}

export interface EditableAgendaItemEntity extends BaseEntity {
    ID: string;
    MeetingID: string;
    ParentID: string | null;
    Sequence: number;
    Name: string;
    Description: string | null;
    TypeID: string | null;
    PresenterPersonID: string | null;
    DurationMinutes: number | null;
    Status: AgendaItemStatus;
    StartedAt: Date | null;
    EndedAt: Date | null;
    Outcome: string | null;
    Load(id: string): Promise<boolean>;
}

export interface EditableNoteEntity extends BaseEntity {
    ID: string;
    MeetingID: string;
    AgendaItemID: string | null;
    Kind: NoteKind;
    Title: string | null;
    Body: string;
    Source: 'Manual' | 'AI';
    Status: 'Draft' | 'Final';
    AuthorPersonID: string | null;
    Load(id: string): Promise<boolean>;
}

export interface EditableTaskEntity extends BaseEntity {
    ID: string;
    Name: string;
    Status: string;
    DueAt: Date | null;
    CreatedByPersonID: string | null;
}

export interface EditableTaskLinkEntity extends BaseEntity {
    ID: string;
    TaskID: string;
    EntityID: string;
    RecordID: string;
    Description: string | null;
}

interface RawMeetingRow {
    ID: string;
    Name: string;
    Description?: string | null;
    SeriesID?: string | null;
    StartsAt: string | Date;
    EndsAt: string | Date;
    TimeZone?: string | null;
    Status?: string | null;
    LocationType?: string | null;
    Location?: string | null;
    VideoJoinURL?: string | null;
    Visibility?: string | null;
    OrganizerPersonID?: string | null;
    OrganizerPerson?: string | null;
    Type?: string | null;
    CancellationReason?: string | null;
    ActualStartedAt?: string | Date | null;
}

interface RawAttendeeRow {
    ID: string;
    MeetingID: string;
    PersonID?: string | null;
    UserID?: string | null;
    Email?: string | null;
    DisplayName?: string | null;
    Role?: string | null;
    ResponseStatus?: string | null;
    AttendanceStatus?: string | null;
    Person?: string | null;
    User?: string | null;
}

interface RawAgendaRow {
    ID: string;
    MeetingID: string;
    ParentID?: string | null;
    Sequence?: number | null;
    Name: string;
    Description?: string | null;
    TypeID?: string | null;
    Type?: string | null;
    PresenterPersonID?: string | null;
    PresenterPerson?: string | null;
    DurationMinutes?: number | null;
    Status?: string | null;
    Outcome?: string | null;
    StartedAt?: string | Date | null;
    EndedAt?: string | Date | null;
}

interface RawNoteRow {
    ID: string;
    MeetingID: string;
    AgendaItemID?: string | null;
    Kind?: string | null;
    Title?: string | null;
    Body?: string | null;
    Source?: string | null;
    Status?: string | null;
    AuthorPersonID?: string | null;
    AuthorPerson?: string | null;
    ProposedTasks?: string | null;
    __mj_UpdatedAt?: string | Date | null;
}

interface RawTaskLinkRow {
    ID: string;
    TaskID: string;
    EntityID: string;
    RecordID: string;
}

interface RawTaskRow {
    ID: string;
    Name: string;
    Status?: string | null;
    Priority?: string | null;
    DueAt?: string | Date | null;
}

interface RawPersonRow {
    ID: string;
    Name?: string | null;
    FirstName?: string | null;
    LastName?: string | null;
    Email?: string | null;
    LinkedUserID?: string | null;
}

const VALID_MEETING_STATUSES: ReadonlySet<MeetingStatus> = new Set([
    'Draft',
    'Scheduled',
    'Postponed',
    'InProgress',
    'Completed',
    'Cancelled',
]);

const VALID_LOCATION_TYPES: ReadonlySet<MeetingLocationType> = new Set([
    'Virtual',
    'InPerson',
    'Hybrid',
    'Phone',
]);

const VALID_ATTENDEE_ROLES: ReadonlySet<AttendeeRole> = new Set([
    'Organizer',
    'Required',
    'Optional',
]);

const VALID_RESPONSES: ReadonlySet<ResponseStatus> = new Set([
    'None',
    'Accepted',
    'Tentative',
    'Declined',
]);

const VALID_ATTENDANCE: ReadonlySet<AttendanceStatus> = new Set([
    'Unknown',
    'Present',
    'Late',
    'LeftEarly',
    'Absent',
    'Excused',
]);

const VALID_AGENDA_STATUSES: ReadonlySet<AgendaItemStatus> = new Set([
    'Planned',
    'InProgress',
    'Done',
    'Deferred',
    'Skipped',
]);

const VALID_NOTE_KINDS: ReadonlySet<NoteKind> = new Set(['Notes', 'Summary', 'Decision']);

function normalizeId(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function escapeSqlLiteral(value: string): string {
    return value.replace(/'/g, "''");
}

function toIso(value: string | Date | null | undefined): string {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

function toDateOrNull(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
}

function coerceMeetingStatus(value: string | null | undefined): MeetingStatus {
    const trimmed = (value ?? '').trim() as MeetingStatus;
    return VALID_MEETING_STATUSES.has(trimmed) ? trimmed : 'Scheduled';
}

function coerceLocationType(value: string | null | undefined): MeetingLocationType {
    const trimmed = (value ?? '').trim() as MeetingLocationType;
    return VALID_LOCATION_TYPES.has(trimmed) ? trimmed : 'Virtual';
}

function coerceAttendeeRole(value: string | null | undefined): AttendeeRole {
    const trimmed = (value ?? '').trim() as AttendeeRole;
    return VALID_ATTENDEE_ROLES.has(trimmed) ? trimmed : 'Required';
}

function coerceResponseStatus(value: string | null | undefined): ResponseStatus {
    const trimmed = (value ?? '').trim() as ResponseStatus;
    return VALID_RESPONSES.has(trimmed) ? trimmed : 'None';
}

function coerceAttendanceStatus(value: string | null | undefined): AttendanceStatus {
    const trimmed = (value ?? '').trim() as AttendanceStatus;
    return VALID_ATTENDANCE.has(trimmed) ? trimmed : 'Unknown';
}

function coerceAgendaStatus(value: string | null | undefined): AgendaItemStatus {
    const trimmed = (value ?? '').trim() as AgendaItemStatus;
    return VALID_AGENDA_STATUSES.has(trimmed) ? trimmed : 'Planned';
}

function coerceNoteKind(value: string | null | undefined): NoteKind {
    const trimmed = (value ?? '').trim() as NoteKind;
    return VALID_NOTE_KINDS.has(trimmed) ? trimmed : 'Notes';
}

function bareRecordId(recordId: string): string {
    const trimmed = (recordId ?? '').trim();
    return trimmed.toLowerCase().startsWith('id|') ? trimmed.slice(3).trim() : trimmed;
}

function recordCandidatesSql(ids: readonly string[]): string {
    const set = new Set<string>();
    for (const raw of ids) {
        const clean = escapeSqlLiteral(raw.trim());
        if (!clean) continue;
        set.add(`'${clean}'`);
        set.add(`'${clean.toUpperCase()}'`);
        set.add(`'ID|${clean}'`);
        set.add(`'ID|${clean.toUpperCase()}'`);
    }
    return [...set].join(', ');
}

function parseProposedTasks(raw: string | null | undefined): ProposedTaskModel[] | undefined {
    if (!raw || !raw.trim()) return undefined;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return undefined;
        const out: ProposedTaskModel[] = [];
        for (let i = 0; i < parsed.length; i += 1) {
            const item = parsed[i];
            if (!item || typeof item !== 'object') continue;
            const rec = item as Record<string, unknown>;
            const title = typeof rec['title'] === 'string' ? rec['title'].trim() : '';
            if (!title) continue;
            const status =
                rec['status'] === 'Accepted' || rec['status'] === 'Dismissed'
                    ? rec['status']
                    : 'Pending';
            out.push({
                id: typeof rec['id'] === 'string' && rec['id'] ? rec['id'] : `prop-${i + 1}`,
                title,
                description: typeof rec['description'] === 'string' ? rec['description'] : null,
                assigneePersonId:
                    typeof rec['assigneePersonId'] === 'string' ? rec['assigneePersonId'] : null,
                assigneeName: typeof rec['assigneeName'] === 'string' ? rec['assigneeName'] : null,
                dueAt: typeof rec['dueAt'] === 'string' ? rec['dueAt'] : null,
                agendaItemId: typeof rec['agendaItemId'] === 'string' ? rec['agendaItemId'] : null,
                status,
                taskId: typeof rec['taskId'] === 'string' ? rec['taskId'] : null,
            });
        }
        return out.length > 0 ? out : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Computes strict Band & ReadOnly permissions for the meeting slide-over drawer.
 * External `!CanSeeTeamSide` viewers always receive read-only inspection (`canEdit: false`, `canRun: false`),
 * while still being able to RSVP when invited and jump into Shared meeting chat.
 */
export function computeMeetingPermissions(params: {
    CanSeeTeamSide: boolean;
    CanSchedule: boolean;
    IsOrganizer?: boolean;
}): MeetingPermissions {
    if (!params.CanSeeTeamSide) {
        return {
            canEdit: false,
            canRun: false,
            canInvite: false,
            canWriteNotes: false,
            canAddFollowUps: false,
        };
    }
    const canContribute = Boolean(params.CanSchedule || params.IsOrganizer);
    return {
        canEdit: canContribute,
        canRun: canContribute,
        canInvite: canContribute,
        canWriteNotes: canContribute,
        canAddFollowUps: canContribute,
    };
}

/**
 * Converts a Collaboration `SpaceMeetingCardItem` into a `@mj-biz-apps/tasks-ng-widgets` `MeetingRow`.
 * When `rootSpaceId` differs from `card.SpaceID`, includes the child space name in `typeName` so
 * rolled-up sub-space meetings clearly display their room provenance inside `<bizapps-meeting-list>`.
 */
export function toMeetingRow(
    card: SpaceMeetingCardItem,
    rootSpaceId?: string | null,
): MeetingRow {
    const startsAt = toDateOrNull(card.StartsAt) ?? new Date();
    const endsAt = toDateOrNull(card.EndsAt) ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
    const isSubSpace =
        Boolean(card.SpaceID) &&
        Boolean(rootSpaceId) &&
        normalizeId(card.SpaceID) !== normalizeId(rootSpaceId);
    const roomLabel = isSubSpace && card.SpaceName ? card.SpaceName : null;
    const combinedType =
        roomLabel && card.TypeName
            ? `${roomLabel} · ${card.TypeName}`
            : roomLabel ?? card.TypeName ?? null;
    const visibility: MeetingVisibility = card.Visibility === 'Private' ? 'Private' : 'Standard';

    return {
        id: card.ID,
        name: card.Name,
        status: coerceMeetingStatus(card.Status),
        visibility,
        typeName: combinedType,
        typeIcon: card.TypeIcon ?? null,
        startsAt,
        endsAt,
        timeZone: card.TimeZone ?? 'UTC',
        locationType: coerceLocationType(card.LocationType),
        location: card.Location ?? null,
        joinUrl: card.VideoJoinURL ?? null,
        organizerName: card.OrganizerName ?? null,
        seriesId: card.SeriesID ?? null,
        myResponse: card.MyResponse ?? null,
        isMine: Boolean(card.IsMine),
        attendeeCount: card.AttendeeCount,
    };
}

/**
 * Determines whether a meeting belongs in the Upcoming bucket (not Completed/Cancelled and end >= now).
 */
export function isUpcomingMeeting(meeting: SpaceMeetingCardItem, nowMs: number = Date.now()): boolean {
    const done = meeting.Status === 'Completed' || meeting.Status === 'Cancelled';
    if (done) return false;
    const end = new Date(meeting.EndsAt).getTime();
    return !Number.isFinite(end) || end >= nowMs;
}

/**
 * Applies strict band security (`!canSeeTeamSide` hides `Visibility === 'Private'`),
 * time range (`upcoming` | `past` | `all`), band filter (`all` | `Shared` | `Team`),
 * optional space filter, and search query to a list of space meetings.
 */
export function filterSpaceMeetings(
    meetings: readonly SpaceMeetingCardItem[],
    params: {
        CanSeeTeamSide: boolean;
        FilterMode: SpaceMeetingsFilterMode;
        BandFilter?: SpaceMeetingsBandFilter;
        SearchQuery?: string;
        SpaceFilterId?: string | null;
        NowMs?: number;
    },
): SpaceMeetingCardItem[] {
    const nowMs = params.NowMs ?? Date.now();
    const q = (params.SearchQuery ?? '').trim().toLowerCase();
    const spaceFilter = normalizeId(params.SpaceFilterId);
    const bandFilter = params.BandFilter ?? 'all';

    return meetings.filter((m) => {
        if (!params.CanSeeTeamSide && m.Visibility === 'Private') {
            return false;
        }
        if (bandFilter === 'Team' && m.Visibility !== 'Private') {
            return false;
        }
        if (bandFilter === 'Shared' && m.Visibility === 'Private') {
            return false;
        }
        if (spaceFilter && normalizeId(m.SpaceID) !== spaceFilter) {
            return false;
        }
        if (params.FilterMode === 'upcoming' && !isUpcomingMeeting(m, nowMs)) {
            return false;
        }
        if (params.FilterMode === 'past' && isUpcomingMeeting(m, nowMs)) {
            return false;
        }
        if (q) {
            const haystack = [
                m.Name,
                m.Description ?? '',
                m.Location ?? '',
                m.OrganizerName ?? '',
                m.SpaceName ?? '',
                m.TypeName ?? '',
            ]
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });
}

/**
 * Recursively loads descendant spaces in reach under `spaceId` (bounded by visited set and depth <= 6).
 */
export async function loadSpaceChildSpaces(
    spaceId: string,
    provider?: IRunViewProvider | null,
): Promise<SpaceChildSummary[]> {
    const cleanRoot = (spaceId ?? '').trim();
    if (!cleanRoot) return [];

    const rv = new RunView(provider ?? undefined);
    const visited = new Set<string>([cleanRoot.toLowerCase()]);
    const descendants: SpaceChildSummary[] = [];
    let frontier: string[] = [cleanRoot];

    for (let depth = 0; depth < 6 && frontier.length > 0; depth += 1) {
        const quoted = frontier.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ');
        const res = await rv.RunView<{ ID: string; Name: string; ParentID: string | null }>({
            EntityName: 'MJ_BizApps_Collaboration: Spaces',
            ExtraFilter: `ParentID IN (${quoted})`,
            Fields: ['ID', 'Name', 'ParentID'],
            OrderBy: 'Name ASC',
            ResultType: 'simple',
        });
        if (!res.Success || !(res.Results?.length)) {
            break;
        }
        const nextFrontier: string[] = [];
        for (const row of res.Results) {
            const key = normalizeId(row.ID);
            if (!key || visited.has(key)) continue;
            visited.add(key);
            descendants.push({
                ID: row.ID,
                Name: row.Name,
                ParentID: row.ParentID ?? null,
            });
            nextFrontier.push(row.ID);
        }
        frontier = nextFrontier;
    }

    return descendants;
}

/**
 * Resolves the current viewer's PersonID from `MJ_BizApps_Common: People` by `LinkedUserID`.
 */
export async function resolveViewerPersonId(
    userId: string | null | undefined,
    provider?: IRunViewProvider | null,
): Promise<string | null> {
    const cleanUserId = (userId ?? '').trim();
    if (!cleanUserId) return null;
    try {
        const rv = new RunView(provider ?? undefined);
        const res = await rv.RunView<{ ID: string }>({
            EntityName: 'MJ_BizApps_Common: People',
            ExtraFilter: `LinkedUserID = '${escapeSqlLiteral(cleanUserId)}'`,
            Fields: ['ID'],
            MaxRows: 1,
            ResultType: 'simple',
        });
        return res.Success && res.Results?.[0]?.ID ? res.Results[0].ID : null;
    } catch {
        return null;
    }
}

/**
 * Loads meetings linked to `spaceId` (and optionally its reachable descendant sub-spaces) via
 * `MJ_BizApps_Tasks: Meeting Links`, enriches each with bound `SpaceChat` threads, attendee counts,
 * and the viewer's own RSVP row (`MyAttendeeID`, `MyResponse`, `IsMine`).
 */
export async function loadSpaceMeetingsWithRollup(
    spaceId: string,
    provider?: IRunViewProvider | null,
    options?: SpaceMeetingsLoadOptions,
): Promise<SpaceMeetingsLoadResult> {
    const cleanSpaceId = (spaceId ?? '').trim();
    if (!cleanSpaceId) {
        return { Meetings: [], ChildSpaces: [] };
    }

    try {
        const rv = new RunView(provider ?? undefined);
        const childSpaces = await loadSpaceChildSpaces(cleanSpaceId, provider);
        const spaceNameById = new Map<string, string>();
        if (options?.RootSpaceName) {
            spaceNameById.set(cleanSpaceId.toLowerCase(), options.RootSpaceName);
        }
        for (const child of childSpaces) {
            spaceNameById.set(child.ID.toLowerCase(), child.Name);
        }

        const includeSubSpaces = options?.IncludeSubSpaces !== false;
        const targetSpaceIds = includeSubSpaces
            ? [cleanSpaceId, ...childSpaces.map((c) => c.ID)]
            : [cleanSpaceId];

        const candidates = recordCandidatesSql(targetSpaceIds);
        const linksRes = await rv.RunView<{
            ID: string;
            MeetingID: string | null;
            SeriesID: string | null;
            RecordID: string;
        }>({
            EntityName: 'MJ_BizApps_Tasks: Meeting Links',
            ExtraFilter: `EntityID = '${COLLABORATION_SPACES_ENTITY_ID}' AND RecordID IN (${candidates})`,
            Fields: ['ID', 'MeetingID', 'SeriesID', 'RecordID'],
            ResultType: 'simple',
        });
        if (!linksRes.Success || (linksRes.Results?.length ?? 0) === 0) {
            return { Meetings: [], ChildSpaces: childSpaces };
        }

        const meetingToSpace = new Map<string, string>();
        const seriesToSpace = new Map<string, string>();
        for (const link of linksRes.Results ?? []) {
            const linkedSpace = bareRecordId(link.RecordID) || cleanSpaceId;
            if (link.MeetingID?.trim()) {
                const key = link.MeetingID.trim().toLowerCase();
                if (!meetingToSpace.has(key) || linkedSpace.toLowerCase() === cleanSpaceId.toLowerCase()) {
                    meetingToSpace.set(key, linkedSpace);
                }
            }
            if (link.SeriesID?.trim()) {
                const key = link.SeriesID.trim().toLowerCase();
                if (!seriesToSpace.has(key) || linkedSpace.toLowerCase() === cleanSpaceId.toLowerCase()) {
                    seriesToSpace.set(key, linkedSpace);
                }
            }
        }

        const clauses: string[] = [];
        if (meetingToSpace.size > 0) {
            clauses.push(`ID IN (${[...meetingToSpace.keys()].map((id) => `'${escapeSqlLiteral(id)}'`).join(', ')})`);
        }
        if (seriesToSpace.size > 0) {
            clauses.push(`SeriesID IN (${[...seriesToSpace.keys()].map((id) => `'${escapeSqlLiteral(id)}'`).join(', ')})`);
        }
        if (clauses.length === 0) {
            return { Meetings: [], ChildSpaces: childSpaces };
        }

        const spaceInSql = targetSpaceIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ');
        const viewerUserId = (options?.CurrentUserId ?? Metadata.Provider?.CurrentUser?.ID ?? '').trim();

        const [meetingsRes, chatsRes, viewerPersonId] = await Promise.all([
            rv.RunView<RawMeetingRow>({
                EntityName: 'MJ_BizApps_Tasks: Meetings',
                ExtraFilter: clauses.join(' OR '),
                OrderBy: 'StartsAt ASC',
                ResultType: 'simple',
            }),
            rv.RunView<{ ID: string; ConversationID: string; Subject?: string | null }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                ExtraFilter: `SpaceID IN (${spaceInSql}) AND Status = 'Active' AND Subject LIKE 'meeting:%'`,
                Fields: ['ID', 'ConversationID', 'Subject'],
                ResultType: 'simple',
            }),
            options?.CurrentPersonId
                ? Promise.resolve(options.CurrentPersonId)
                : resolveViewerPersonId(viewerUserId, provider),
        ]);

        if (!meetingsRes.Success || (meetingsRes.Results?.length ?? 0) === 0) {
            return { Meetings: [], ChildSpaces: childSpaces };
        }

        const loadedMeetingIds = (meetingsRes.Results ?? []).map((m) => m.ID);
        const attendeesRes =
            loadedMeetingIds.length > 0
                ? await rv.RunView<RawAttendeeRow>({
                      EntityName: 'MJ_BizApps_Tasks: Meeting Attendees',
                      ExtraFilter: `MeetingID IN (${loadedMeetingIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ')})`,
                      Fields: ['ID', 'MeetingID', 'PersonID', 'UserID', 'Role', 'ResponseStatus'],
                      ResultType: 'simple',
                  })
                : { Success: true, Results: [] as RawAttendeeRow[] };

        const chatByMeetingId = new Map<string, { spaceChatId: string; conversationId: string }>();
        if (chatsRes.Success) {
            for (const c of chatsRes.Results ?? []) {
                const sub = (c.Subject ?? '').trim();
                if (sub.toLowerCase().startsWith('meeting:')) {
                    const mId = sub.slice('meeting:'.length).trim().toLowerCase();
                    if (mId) {
                        chatByMeetingId.set(mId, { spaceChatId: c.ID, conversationId: c.ConversationID });
                    }
                }
            }
        }

        const attendeeCountByMeeting = new Map<string, number>();
        const myAttendeeByMeeting = new Map<
            string,
            { id: string; response: ResponseStatus; isOrganizer: boolean }
        >();
        const viewerUserLower = viewerUserId.toLowerCase();
        const viewerPersonLower = (viewerPersonId ?? '').trim().toLowerCase();

        if (attendeesRes.Success) {
            for (const att of attendeesRes.Results ?? []) {
                const mKey = normalizeId(att.MeetingID);
                if (!mKey) continue;
                attendeeCountByMeeting.set(mKey, (attendeeCountByMeeting.get(mKey) ?? 0) + 1);
                const matchesUser =
                    Boolean(viewerUserLower) && normalizeId(att.UserID) === viewerUserLower;
                const matchesPerson =
                    Boolean(viewerPersonLower) && normalizeId(att.PersonID) === viewerPersonLower;
                if (matchesUser || matchesPerson) {
                    myAttendeeByMeeting.set(mKey, {
                        id: att.ID,
                        response: coerceResponseStatus(att.ResponseStatus),
                        isOrganizer: coerceAttendeeRole(att.Role) === 'Organizer',
                    });
                }
            }
        }

        const canSeeTeam = options?.CanSeeTeamSide !== false;
        const cards: SpaceMeetingCardItem[] = [];

        for (const row of meetingsRes.Results ?? []) {
            const visibility: MeetingVisibility =
                row.Visibility === 'Private' ? 'Private' : 'Standard';
            if (!canSeeTeam && visibility === 'Private') {
                continue;
            }
            const mKey = normalizeId(row.ID);
            const sKey = normalizeId(row.SeriesID);
            const ownerSpaceId =
                meetingToSpace.get(mKey) ?? (sKey ? seriesToSpace.get(sKey) : undefined) ?? cleanSpaceId;
            const chat = chatByMeetingId.get(mKey);
            const myAtt = myAttendeeByMeeting.get(mKey);
            const isMine =
                Boolean(myAtt?.isOrganizer) ||
                (Boolean(viewerPersonLower) &&
                    normalizeId(row.OrganizerPersonID) === viewerPersonLower);

            cards.push({
                ID: row.ID,
                Name: row.Name,
                Description: row.Description ?? null,
                SeriesID: row.SeriesID ?? null,
                StartsAt: toIso(row.StartsAt),
                EndsAt: toIso(row.EndsAt),
                TimeZone: row.TimeZone ?? 'UTC',
                Status: row.Status ?? 'Scheduled',
                LocationType: row.LocationType ?? 'Virtual',
                Location: row.Location ?? null,
                VideoJoinURL: row.VideoJoinURL ?? null,
                Visibility: visibility,
                TypeName: row.Type ?? null,
                OrganizerPersonID: row.OrganizerPersonID ?? null,
                OrganizerName: row.OrganizerPerson ?? null,
                CancellationReason: row.CancellationReason ?? null,
                ActualStartedAt: row.ActualStartedAt ? toIso(row.ActualStartedAt) : null,
                SpaceID: ownerSpaceId,
                SpaceName: spaceNameById.get(ownerSpaceId.toLowerCase()) ?? null,
                SpaceChatID: chat?.spaceChatId ?? null,
                ConversationID: chat?.conversationId ?? null,
                AttendeeCount: attendeeCountByMeeting.get(mKey),
                MyAttendeeID: myAtt?.id ?? null,
                MyResponse: myAtt?.response ?? null,
                IsMine: isMine,
            });
        }

        return { Meetings: cards, ChildSpaces: childSpaces };
    } catch {
        return { Meetings: [], ChildSpaces: [] };
    }
}

/**
 * Loads the full detail bundle for one meeting to render inside the in-place slide-over drawer:
 * timed hierarchical agenda, agenda item types, attendees & RSVP statuses, meeting notes,
 * linked follow-up tasks (strictly band-safe via Tasks RLS + `!CanSeeTeamSide` defense-in-depth),
 * and selectable people in reach.
 */
export async function loadSpaceMeetingDetail(
    meeting: SpaceMeetingCardItem,
    provider?: IRunViewProvider | null,
    options?: {
        CurrentUserId?: string | null;
        CurrentPersonId?: string | null;
        CanSeeTeamSide?: boolean;
        RootSpaceId?: string | null;
    },
): Promise<SpaceMeetingDetailBundle> {
    const rv = new RunView(provider ?? undefined);
    const cleanMeetingId = escapeSqlLiteral(meeting.ID.trim());
    const viewerUserId = (options?.CurrentUserId ?? Metadata.Provider?.CurrentUser?.ID ?? '').trim();
    const canSeeTeam = options?.CanSeeTeamSide === true;

    const viewerPersonId =
        options?.CurrentPersonId ?? (await resolveViewerPersonId(viewerUserId, provider));
    const viewerUserLower = viewerUserId.toLowerCase();
    const viewerPersonLower = (viewerPersonId ?? '').trim().toLowerCase();

    const [agendaRes, itemTypesRes, attendeesRes, notesRes, peopleRes, meetingTaskLinksRes] =
        await Promise.all([
            rv.RunView<RawAgendaRow>({
                EntityName: 'MJ_BizApps_Tasks: Meeting Agenda Items',
                ExtraFilter: `MeetingID = '${cleanMeetingId}'`,
                OrderBy: 'Sequence ASC',
                ResultType: 'simple',
            }),
            rv.RunView<{
                ID: string;
                Name: string;
                Code?: string | null;
                DefaultDurationMinutes?: number | null;
            }>({
                EntityName: 'MJ_BizApps_Tasks: Meeting Agenda Item Types',
                ExtraFilter: 'IsActive = 1',
                OrderBy: 'Sequence ASC',
                Fields: ['ID', 'Name', 'Code', 'DefaultDurationMinutes'],
                ResultType: 'simple',
            }),
            rv.RunView<RawAttendeeRow>({
                EntityName: 'MJ_BizApps_Tasks: Meeting Attendees',
                ExtraFilter: `MeetingID = '${cleanMeetingId}'`,
                ResultType: 'simple',
            }),
            rv.RunView<RawNoteRow>({
                EntityName: 'MJ_BizApps_Tasks: Meeting Notes',
                ExtraFilter: `MeetingID = '${cleanMeetingId}'`,
                OrderBy: '__mj_UpdatedAt DESC',
                ResultType: 'simple',
            }),
            canSeeTeam
                ? rv.RunView<RawPersonRow>({
                      EntityName: 'MJ_BizApps_Common: People',
                      Fields: ['ID', 'Name', 'FirstName', 'LastName', 'Email', 'LinkedUserID'],
                      OrderBy: 'Name ASC',
                      // row-cap-ok: UI picker dropdown bounded to 250 people in reach
                      MaxRows: 250,
                      ResultType: 'simple',
                  })
                : Promise.resolve({ Success: true, Results: [] as RawPersonRow[] }),
            rv.RunView<RawTaskLinkRow>({
                EntityName: 'MJ_BizApps_Tasks: Task Links',
                ExtraFilter: `EntityID = '${TASKS_MEETINGS_ENTITY_ID}' AND RecordID IN (${recordCandidatesSql([meeting.ID])})`,
                Fields: ['ID', 'TaskID', 'EntityID', 'RecordID'],
                ResultType: 'simple',
            }),
        ]);

    const agendaItemTypes: AgendaItemTypeOption[] = (itemTypesRes.Success ? itemTypesRes.Results ?? [] : []).map(
        (t) => ({
            id: t.ID,
            name: t.Name,
            code: t.Code ?? t.Name,
            defaultDurationMinutes: t.DefaultDurationMinutes ?? null,
        }),
    );
    const typeCodeById = new Map(agendaItemTypes.map((t) => [t.id.toLowerCase(), t.code]));

    const agendaItems: AgendaItemModel[] = (agendaRes.Success ? agendaRes.Results ?? [] : []).map(
        (row) => ({
            id: row.ID,
            parentId: row.ParentID ?? null,
            sequence: row.Sequence ?? 100,
            name: row.Name,
            description: row.Description ?? null,
            typeId: row.TypeID ?? null,
            typeName: row.Type ?? null,
            typeCode: row.TypeID ? (typeCodeById.get(row.TypeID.toLowerCase()) ?? null) : null,
            presenterPersonId: row.PresenterPersonID ?? null,
            presenterName: row.PresenterPerson ?? null,
            durationMinutes: row.DurationMinutes ?? null,
            status: coerceAgendaStatus(row.Status),
            outcome: row.Outcome ?? null,
            startedAt: toDateOrNull(row.StartedAt),
            endedAt: toDateOrNull(row.EndedAt),
        }),
    );

    const attendees: AttendeeModel[] = (attendeesRes.Success ? attendeesRes.Results ?? [] : []).map(
        (row) => {
            const isMe =
                (Boolean(viewerUserLower) && normalizeId(row.UserID) === viewerUserLower) ||
                (Boolean(viewerPersonLower) && normalizeId(row.PersonID) === viewerPersonLower);
            const displayName =
                row.DisplayName?.trim() ||
                row.Person?.trim() ||
                row.User?.trim() ||
                row.Email?.trim() ||
                'Attendee';
            return {
                id: row.ID,
                personId: row.PersonID ?? null,
                userId: row.UserID ?? null,
                email: row.Email ?? null,
                name: displayName,
                role: coerceAttendeeRole(row.Role),
                responseStatus: coerceResponseStatus(row.ResponseStatus),
                attendanceStatus: coerceAttendanceStatus(row.AttendanceStatus),
                isMe,
            };
        },
    );

    const myAtt = attendees.find((a) => a.isMe);
    const updatedMeeting: SpaceMeetingCardItem = {
        ...meeting,
        AttendeeCount: attendees.length,
        MyAttendeeID: myAtt?.id ?? meeting.MyAttendeeID ?? null,
        MyResponse: myAtt?.responseStatus ?? meeting.MyResponse ?? null,
        IsMine: myAtt?.role === 'Organizer' || meeting.IsMine,
    };

    const notes: NoteModel[] = (notesRes.Success ? notesRes.Results ?? [] : []).map((row) => {
        const updatedDate = toDateOrNull(row.__mj_UpdatedAt);
        const updatedLabel = updatedDate
            ? updatedDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
              })
            : '';
        return {
            id: row.ID,
            agendaItemId: row.AgendaItemID ?? null,
            kind: coerceNoteKind(row.Kind),
            title: row.Title ?? null,
            body: row.Body ?? '',
            source: row.Source === 'AI' ? 'AI' : 'Manual',
            status: row.Status === 'Final' ? 'Final' : 'Draft',
            authorName: row.AuthorPerson ?? null,
            updatedLabel,
            isMine:
                Boolean(viewerPersonLower) &&
                normalizeId(row.AuthorPersonID) === viewerPersonLower,
            proposedTasks: parseProposedTasks(row.ProposedTasks),
        };
    });

    // Gather linked follow-up tasks on the meeting AND any of its agenda items
    const taskAgendaMap = new Map<string, string | null>();
    if (meetingTaskLinksRes.Success) {
        for (const link of meetingTaskLinksRes.Results ?? []) {
            if (link.TaskID?.trim()) {
                taskAgendaMap.set(link.TaskID.trim().toLowerCase(), null);
            }
        }
    }
    if (agendaItems.length > 0) {
        const agendaCandidates = recordCandidatesSql(agendaItems.map((i) => i.id));
        const agendaLinksRes = await rv.RunView<RawTaskLinkRow>({
            EntityName: 'MJ_BizApps_Tasks: Task Links',
            ExtraFilter: `EntityID = '${TASKS_MEETING_AGENDA_ITEMS_ENTITY_ID}' AND RecordID IN (${agendaCandidates})`,
            Fields: ['ID', 'TaskID', 'EntityID', 'RecordID'],
            ResultType: 'simple',
        });
        if (agendaLinksRes.Success) {
            for (const link of agendaLinksRes.Results ?? []) {
                if (link.TaskID?.trim()) {
                    taskAgendaMap.set(link.TaskID.trim().toLowerCase(), bareRecordId(link.RecordID));
                }
            }
        }
    }

    const followUps: FollowUpModel[] = [];
    const taskIds = [...taskAgendaMap.keys()];
    if (taskIds.length > 0) {
        const tasksRes = await rv.RunView<RawTaskRow>({
            EntityName: 'MJ_BizApps_Tasks: Tasks',
            ExtraFilter: `ID IN (${taskIds.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ')})`,
            Fields: ['ID', 'Name', 'Status', 'Priority', 'DueAt'],
            OrderBy: 'DueAt ASC',
            ResultType: 'simple',
        });
        if (tasksRes.Success) {
            for (const t of tasksRes.Results ?? []) {
                followUps.push({
                    id: t.ID,
                    name: t.Name,
                    status: t.Status ?? 'Open',
                    priority: t.Priority ?? null,
                    dueAt: toDateOrNull(t.DueAt),
                    assigneeNames: [],
                    agendaItemId: taskAgendaMap.get(t.ID.toLowerCase()) ?? null,
                });
            }
        }
    }

    const people: PersonOption[] = (peopleRes.Success ? peopleRes.Results ?? [] : []).map((p) => {
        const fullName =
            p.Name?.trim() ||
            [p.FirstName, p.LastName].filter(Boolean).join(' ').trim() ||
            p.Email?.trim() ||
            'Person';
        return {
            id: p.ID,
            name: fullName,
            email: p.Email ?? null,
        };
    });

    return {
        Meeting: updatedMeeting,
        MeetingRow: toMeetingRow(updatedMeeting, options?.RootSpaceId),
        AgendaItems: agendaItems,
        AgendaItemTypes: agendaItemTypes,
        Attendees: attendees,
        Notes: notes,
        FollowUps: followUps,
        People: people,
        CancellationReason: updatedMeeting.CancellationReason ?? null,
        ActualStartedAt: toDateOrNull(updatedMeeting.ActualStartedAt),
    };
}

/**
 * Generates an RFC 5545 `.ics` calendar payload for a space meeting (client-side download).
 */
export function buildMeetingIcsContent(meeting: SpaceMeetingCardItem): string {
    const fmt = (iso: string): string => {
        const d = toDateOrNull(iso) ?? new Date();
        return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    };
    const esc = (text: string): string =>
        text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MemberJunction//Collaboration Meetings//EN',
        'BEGIN:VEVENT',
        `UID:${meeting.ID}@memberjunction.local`,
        `DTSTAMP:${fmt(new Date().toISOString())}`,
        `DTSTART:${fmt(meeting.StartsAt)}`,
        `DTEND:${fmt(meeting.EndsAt)}`,
        `SUMMARY:${esc(meeting.Name)}`,
    ];
    if (meeting.Description) {
        lines.push(`DESCRIPTION:${esc(meeting.Description)}`);
    }
    const loc = meeting.Location || meeting.VideoJoinURL || '';
    if (loc) {
        lines.push(`LOCATION:${esc(loc)}`);
    }
    if (meeting.VideoJoinURL) {
        lines.push(`URL:${meeting.VideoJoinURL}`);
    }
    lines.push('END:VEVENT', 'END:VCALENDAR', '');
    return lines.join('\r\n');
}

/**
 * Persists a viewer's RSVP response (`ResponseStatus`) on their `MJ_BizApps_Tasks: Meeting Attendees` row.
 */
export async function saveAttendeeResponse(
    attendeeId: string,
    response: ResponseStatus,
    provider?: IMetadataProvider | null,
): Promise<{ ok: boolean; error?: string }> {
    const md = provider ?? Metadata.Provider;
    if (!md || !attendeeId.trim()) {
        return { ok: false, error: 'Unable to update RSVP without an attendee record.' };
    }
    const entity = await md.GetEntityObject<EditableAttendeeEntity>(
        'MJ_BizApps_Tasks: Meeting Attendees',
    );
    if (!(await entity.Load(attendeeId.trim()))) {
        return { ok: false, error: 'Attendee record could not be loaded.' };
    }
    entity.ResponseStatus = response;
    entity.RespondedAt = new Date();
    const ok = await entity.Save();
    return ok
        ? { ok: true }
        : { ok: false, error: entity.LatestResult?.CompleteMessage || 'Could not save RSVP.' };
}

/**
 * Persists a meeting status transition (`InProgress`, `Completed`, `Cancelled`).
 */
export async function saveMeetingStatusTransition(
    meetingId: string,
    status: 'InProgress' | 'Completed' | 'Cancelled',
    provider?: IMetadataProvider | null,
): Promise<{ ok: boolean; error?: string }> {
    const md = provider ?? Metadata.Provider;
    if (!md || !meetingId.trim()) {
        return { ok: false, error: 'Meeting provider unavailable.' };
    }
    const entity = await md.GetEntityObject<EditableMeetingEntity>('MJ_BizApps_Tasks: Meetings');
    if (!(await entity.Load(meetingId.trim()))) {
        return { ok: false, error: 'Meeting record could not be loaded.' };
    }
    entity.Status = status;
    const now = new Date();
    if (status === 'InProgress' && !entity.ActualStartedAt) {
        entity.ActualStartedAt = now;
    } else if (status === 'Completed') {
        entity.ActualEndedAt = now;
    } else if (status === 'Cancelled') {
        entity.CancelledAt = now;
    }
    const ok = await entity.Save();
    return ok
        ? { ok: true }
        : { ok: false, error: entity.LatestResult?.CompleteMessage || 'Could not update meeting status.' };
}

/**
 * Creates or updates an agenda item on `MJ_BizApps_Tasks: Meeting Agenda Items`.
 */
export async function saveAgendaItemDraft(
    meetingId: string,
    draft: AgendaItemDraft,
    nextSequence: number,
    provider?: IMetadataProvider | null,
): Promise<{ ok: boolean; error?: string }> {
    const md = provider ?? Metadata.Provider;
    if (!md) return { ok: false, error: 'Metadata provider unavailable.' };
    const entity = await md.GetEntityObject<EditableAgendaItemEntity>(
        'MJ_BizApps_Tasks: Meeting Agenda Items',
    );
    if (draft.id) {
        if (!(await entity.Load(draft.id))) {
            return { ok: false, error: 'Agenda item could not be loaded.' };
        }
    } else {
        entity.NewRecord();
        entity.MeetingID = meetingId;
        entity.Sequence = nextSequence;
        entity.Status = 'Planned';
    }
    entity.ParentID = draft.parentId;
    entity.Name = draft.name.trim();
    entity.Description = draft.description.trim() || null;
    entity.TypeID = draft.typeId;
    entity.PresenterPersonID = draft.presenterPersonId;
    entity.DurationMinutes = draft.durationMinutes;
    const ok = await entity.Save();
    return ok
        ? { ok: true }
        : { ok: false, error: entity.LatestResult?.CompleteMessage || 'Could not save agenda item.' };
}

/**
 * Updates an agenda item's live status and optional outcome.
 */
export async function updateAgendaItemLiveState(
    itemId: string,
    status: AgendaItemStatus,
    outcome?: string | null,
    provider?: IMetadataProvider | null,
): Promise<{ ok: boolean; error?: string }> {
    const md = provider ?? Metadata.Provider;
    if (!md) return { ok: false, error: 'Metadata provider unavailable.' };
    const entity = await md.GetEntityObject<EditableAgendaItemEntity>(
        'MJ_BizApps_Tasks: Meeting Agenda Items',
    );
    if (!(await entity.Load(itemId))) {
        return { ok: false, error: 'Agenda item could not be loaded.' };
    }
    entity.Status = status;
    if (outcome !== undefined) {
        entity.Outcome = outcome;
    }
    const now = new Date();
    if (status === 'InProgress' && !entity.StartedAt) {
        entity.StartedAt = now;
    } else if (status === 'Done' || status === 'Deferred' || status === 'Skipped') {
        entity.EndedAt = now;
    }
    const ok = await entity.Save();
    return ok
        ? { ok: true }
        : { ok: false, error: entity.LatestResult?.CompleteMessage || 'Could not update agenda item.' };
}

/**
 * Creates or updates a meeting note on `MJ_BizApps_Tasks: Meeting Notes`.
 */
export async function saveMeetingNoteDraft(
    meetingId: string,
    draft: NoteDraft,
    authorPersonId: string | null,
    provider?: IMetadataProvider | null,
): Promise<{ ok: boolean; error?: string }> {
    const md = provider ?? Metadata.Provider;
    if (!md) return { ok: false, error: 'Metadata provider unavailable.' };
    const entity = await md.GetEntityObject<EditableNoteEntity>('MJ_BizApps_Tasks: Meeting Notes');
    if (draft.id) {
        if (!(await entity.Load(draft.id))) {
            return { ok: false, error: 'Note could not be loaded.' };
        }
    } else {
        entity.NewRecord();
        entity.MeetingID = meetingId;
        entity.Source = 'Manual';
        entity.AuthorPersonID = authorPersonId;
    }
    entity.AgendaItemID = draft.agendaItemId;
    entity.Kind = draft.kind;
    entity.Title = draft.title.trim() || null;
    entity.Body = draft.body.trim();
    entity.Status = draft.status;
    const ok = await entity.Save();
    return ok
        ? { ok: true }
        : { ok: false, error: entity.LatestResult?.CompleteMessage || 'Could not save meeting note.' };
}

/**
 * Creates a follow-up task and links it to the meeting (or agenda item) via `MJ_BizApps_Tasks: Task Links`.
 */
export async function saveMeetingFollowUpDraft(
    meetingId: string,
    draft: FollowUpDraft,
    authorPersonId: string | null,
    provider?: IMetadataProvider | null,
): Promise<{ ok: boolean; taskId?: string; error?: string }> {
    const md = provider ?? Metadata.Provider;
    if (!md) return { ok: false, error: 'Metadata provider unavailable.' };
    const task = await md.GetEntityObject<EditableTaskEntity>('MJ_BizApps_Tasks: Tasks');
    task.NewRecord();
    task.Name = draft.name.trim();
    task.Status = 'Open';
    task.DueAt = draft.dueAt;
    task.CreatedByPersonID = authorPersonId;
    if (!(await task.Save()) || !task.ID) {
        return {
            ok: false,
            error: task.LatestResult?.CompleteMessage || 'Could not create follow-up task.',
        };
    }

    const link = await md.GetEntityObject<EditableTaskLinkEntity>('MJ_BizApps_Tasks: Task Links');
    link.NewRecord();
    link.TaskID = task.ID;
    link.EntityID = draft.agendaItemId
        ? TASKS_MEETING_AGENDA_ITEMS_ENTITY_ID
        : TASKS_MEETINGS_ENTITY_ID;
    link.RecordID = draft.agendaItemId ?? meetingId;
    link.Description = draft.agendaItemId ? 'Meeting agenda follow-up' : 'Meeting follow-up';
    if (!(await link.Save())) {
        return {
            ok: false,
            taskId: task.ID,
            error: link.LatestResult?.CompleteMessage || 'Task created, but meeting link could not be saved.',
        };
    }
    return { ok: true, taskId: task.ID };
}
