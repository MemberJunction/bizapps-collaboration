import { type IMetadataProvider, LogError, RunView, type UserInfo } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import {
    type AgendaItem,
    authorizeItemWrite,
    type Band,
    BaseAgendaProvider,
    membershipReaches,
    type SpaceBatchContext,
    spaceIsReadOnly,
} from '@mj-biz-apps/collaboration-core';
import type {
    mjBizAppsTasksMeetingAttendeeEntity,
    mjBizAppsTasksMeetingEntity,
    mjBizAppsTasksMeetingLinkEntity,
} from '@mj-biz-apps/tasks-entities';
import type { AgentContextResult } from './base-space-type-server-driver.js';
import { createSpaceConversation } from './create-space-conversation.js';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { releaseStoredFile, SpaceItemEntityServer, vouchStoredFile } from './SpaceItemEntityServer.js';
import { callerPersonId } from './task-attribution.js';
import { parseUuid } from './uuid.js';

export const COLLABORATION_SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
export const MEETING_SUBJECT_PREFIX = 'meeting:';

export interface SpaceMeetingAgendaItemSummary {
    ID: string;
    Name: string;
    Sequence: number;
    DurationMinutes: number | null;
    Status: string;
    Outcome: string | null;
}

export interface SpaceMeetingNoteSummary {
    ID: string;
    Kind: string;
    Title: string | null;
    Body: string;
    Status: string;
    Source: string;
}

export interface SpaceMeetingSummary {
    ID: string;
    Name: string;
    Description: string | null;
    SeriesID: string | null;
    StartsAt: string;
    EndsAt: string;
    TimeZone: string;
    Status: string;
    LocationType: string;
    Location: string | null;
    VideoJoinURL: string | null;
    Visibility: 'Standard' | 'Private';
    SpaceID: string;
    SpaceChatID?: string | null;
    ConversationID?: string | null;
    AgendaItems?: SpaceMeetingAgendaItemSummary[];
    Notes?: SpaceMeetingNoteSummary[];
}

export interface SpaceMeetingsResult {
    meetings: SpaceMeetingSummary[];
    upcoming: SpaceMeetingSummary[];
    past: SpaceMeetingSummary[];
}

export function meetingChatSubject(meetingId: string): string {
    const clean = parseUuid(meetingId) ?? meetingId.trim();
    return `${MEETING_SUBJECT_PREFIX}${clean}`;
}

export function parseMeetingIdFromSubject(subject: string | null | undefined): string | null {
    if (!subject) return null;
    const trimmed = subject.trim();
    if (!trimmed.toLowerCase().startsWith(MEETING_SUBJECT_PREFIX)) return null;
    const rawId = trimmed.slice(MEETING_SUBJECT_PREFIX.length).trim();
    return parseUuid(rawId) ?? (rawId || null);
}

/**
 * Loads meetings linked to `spaceId` (and optionally its child spaces) via `MeetingLink`,
 * resolving linked `SpaceChat` threads (`Subject = 'meeting:<MeetingID>'`) and optional
 * agenda items and notes.
 */
export async function loadSpaceMeetings(
    provider: IMetadataProvider,
    spaceId: string,
    contextUser?: UserInfo,
    options?: {
        includeSubSpaces?: boolean;
        includeDetails?: boolean;
        now?: Date;
    }
): Promise<SpaceMeetingsResult> {
    const cleanSpaceId = parseUuid(spaceId);
    if (!cleanSpaceId) {
        return { meetings: [], upcoming: [], past: [] };
    }

    const view = RunView.FromMetadataProvider(provider);
    const targetSpaceIds = [cleanSpaceId];

    if (options?.includeSubSpaces) {
        const subSpacesRes = await view.RunView<{ ID: string }>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                ExtraFilter: `ParentID = '${cleanSpaceId}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            },
            contextUser
        );
        if (subSpacesRes.Success) {
            for (const sub of subSpacesRes.Results ?? []) {
                const subId = parseUuid(sub.ID);
                if (subId && !targetSpaceIds.includes(subId)) {
                    targetSpaceIds.push(subId);
                }
            }
        }
    }

    const recordKeyCandidates = targetSpaceIds.flatMap((id) => [
        `'${id}'`,
        `'${id.toUpperCase()}'`,
        `'ID|${id}'`,
        `'ID|${id.toUpperCase()}'`,
    ]);

    const linksRes = await view.RunView<{
        ID: string;
        MeetingID: string | null;
        SeriesID: string | null;
        RecordID: string;
    }>(
        {
            EntityName: 'MJ_BizApps_Tasks: Meeting Links',
            ExtraFilter: `EntityID = '${COLLABORATION_SPACES_ENTITY_ID}' AND RecordID IN (${recordKeyCandidates.join(', ')})`,
            ResultType: 'simple',
        },
        contextUser
    );
    if (!linksRes.Success || (linksRes.Results?.length ?? 0) === 0) {
        return { meetings: [], upcoming: [], past: [] };
    }

    const meetingToSpace = new Map<string, string>();
    const seriesToSpace = new Map<string, string>();

    for (const link of linksRes.Results ?? []) {
        const rawSpaceKey = link.RecordID.startsWith('ID|') ? link.RecordID.slice(3) : link.RecordID;
        const linkedSpaceId = parseUuid(rawSpaceKey) ?? cleanSpaceId;
        const mId = parseUuid(link.MeetingID);
        if (mId) {
            meetingToSpace.set(mId, linkedSpaceId);
        }
        const sId = parseUuid(link.SeriesID);
        if (sId) {
            seriesToSpace.set(sId, linkedSpaceId);
        }
    }

    const filterClauses: string[] = [];
    if (meetingToSpace.size > 0) {
        const mList = [...meetingToSpace.keys()].map((id) => `'${id}'`).join(', ');
        filterClauses.push(`ID IN (${mList})`);
    }
    if (seriesToSpace.size > 0) {
        const sList = [...seriesToSpace.keys()].map((id) => `'${id}'`).join(', ');
        filterClauses.push(`SeriesID IN (${sList})`);
    }

    if (filterClauses.length === 0) {
        return { meetings: [], upcoming: [], past: [] };
    }

    const meetingsRes = await view.RunView<{
        ID: string;
        Name: string;
        Description?: string | null;
        SeriesID?: string | null;
        StartsAt: string | Date;
        EndsAt: string | Date;
        TimeZone: string;
        Status: string;
        LocationType: string;
        Location?: string | null;
        VideoJoinURL?: string | null;
        Visibility?: 'Standard' | 'Private';
    }>(
        {
            EntityName: 'MJ_BizApps_Tasks: Meetings',
            ExtraFilter: filterClauses.join(' OR '),
            OrderBy: 'StartsAt ASC',
            ResultType: 'simple',
        },
        contextUser
    );
    if (!meetingsRes.Success || (meetingsRes.Results?.length ?? 0) === 0) {
        return { meetings: [], upcoming: [], past: [] };
    }

    const spaceIdQuoted = targetSpaceIds.map((id) => `'${id}'`).join(', ');
    const chatsRes = await view.RunView<{
        ID: string;
        ConversationID: string;
        Subject?: string | null;
    }>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Space Chats',
            ExtraFilter: `SpaceID IN (${spaceIdQuoted}) AND Status = 'Active' AND Subject LIKE 'meeting:%'`,
            Fields: ['ID', 'ConversationID', 'Subject'],
            ResultType: 'simple',
        },
        contextUser
    );

    const chatByMeetingId = new Map<string, { spaceChatId: string; conversationId: string }>();
    if (chatsRes.Success) {
        for (const c of chatsRes.Results ?? []) {
            const mId = parseMeetingIdFromSubject(c.Subject);
            if (mId) {
                chatByMeetingId.set(mId, { spaceChatId: c.ID, conversationId: c.ConversationID });
            }
        }
    }

    const agendaByMeetingId = new Map<string, SpaceMeetingAgendaItemSummary[]>();
    const notesByMeetingId = new Map<string, SpaceMeetingNoteSummary[]>();

    if (options?.includeDetails) {
        const allMeetingIds = (meetingsRes.Results ?? [])
            .map((m) => parseUuid(m.ID))
            .filter((id): id is string => !!id);

        if (allMeetingIds.length > 0) {
            const quotedMeetingIds = allMeetingIds.map((id) => `'${id}'`).join(', ');
            const [agendaRes, notesRes] = await Promise.all([
                view.RunView<{
                    ID: string;
                    MeetingID: string;
                    Name: string;
                    Sequence: number;
                    DurationMinutes?: number | null;
                    Status: string;
                    Outcome?: string | null;
                }>(
                    {
                        EntityName: 'MJ_BizApps_Tasks: Meeting Agenda Items',
                        ExtraFilter: `MeetingID IN (${quotedMeetingIds})`,
                        OrderBy: 'Sequence ASC',
                        ResultType: 'simple',
                    },
                    contextUser
                ),
                view.RunView<{
                    ID: string;
                    MeetingID: string;
                    Kind: string;
                    Title?: string | null;
                    Body: string;
                    Status: string;
                    Source: string;
                }>(
                    {
                        EntityName: 'MJ_BizApps_Tasks: Meeting Notes',
                        ExtraFilter: `MeetingID IN (${quotedMeetingIds})`,
                        ResultType: 'simple',
                    },
                    contextUser
                ),
            ]);

            if (agendaRes.Success) {
                for (const item of agendaRes.Results ?? []) {
                    const mId = parseUuid(item.MeetingID);
                    if (!mId) continue;
                    const list = agendaByMeetingId.get(mId) ?? [];
                    list.push({
                        ID: item.ID,
                        Name: item.Name,
                        Sequence: item.Sequence ?? 100,
                        DurationMinutes: item.DurationMinutes ?? null,
                        Status: item.Status ?? 'Planned',
                        Outcome: item.Outcome ?? null,
                    });
                    agendaByMeetingId.set(mId, list);
                }
            }

            if (notesRes.Success) {
                for (const note of notesRes.Results ?? []) {
                    const mId = parseUuid(note.MeetingID);
                    if (!mId) continue;
                    const list = notesByMeetingId.get(mId) ?? [];
                    list.push({
                        ID: note.ID,
                        Kind: note.Kind ?? 'Notes',
                        Title: note.Title ?? null,
                        Body: note.Body ?? '',
                        Status: note.Status ?? 'Draft',
                        Source: note.Source ?? 'Manual',
                    });
                    notesByMeetingId.set(mId, list);
                }
            }
        }
    }

    const nowMs = (options?.now ?? new Date()).getTime();
    const meetings: SpaceMeetingSummary[] = [];
    const upcoming: SpaceMeetingSummary[] = [];
    const past: SpaceMeetingSummary[] = [];

    for (const row of meetingsRes.Results ?? []) {
        const mId = parseUuid(row.ID) ?? row.ID;
        const sId = parseUuid(row.SeriesID);
        const ownerSpaceId =
            meetingToSpace.get(mId) ?? (sId ? seriesToSpace.get(sId) : undefined) ?? cleanSpaceId;
        const chatInfo = chatByMeetingId.get(mId);
        const startsAtIso =
            row.StartsAt instanceof Date ? row.StartsAt.toISOString() : String(row.StartsAt);
        const endsAtIso =
            row.EndsAt instanceof Date ? row.EndsAt.toISOString() : String(row.EndsAt);

        const summary: SpaceMeetingSummary = {
            ID: row.ID,
            Name: row.Name,
            Description: row.Description ?? null,
            SeriesID: row.SeriesID ?? null,
            StartsAt: startsAtIso,
            EndsAt: endsAtIso,
            TimeZone: row.TimeZone ?? 'UTC',
            Status: row.Status ?? 'Scheduled',
            LocationType: row.LocationType ?? 'Virtual',
            Location: row.Location ?? null,
            VideoJoinURL: row.VideoJoinURL ?? null,
            Visibility: row.Visibility === 'Private' ? 'Private' : 'Standard',
            SpaceID: ownerSpaceId,
            SpaceChatID: chatInfo?.spaceChatId ?? null,
            ConversationID: chatInfo?.conversationId ?? null,
            ...(options?.includeDetails
                ? {
                      AgendaItems: agendaByMeetingId.get(mId) ?? [],
                      Notes: notesByMeetingId.get(mId) ?? [],
                  }
                : {}),
        };

        meetings.push(summary);
        const endMs = new Date(endsAtIso).getTime();
        const isCancelledOrDone = summary.Status === 'Cancelled' || summary.Status === 'Completed';
        if (!isCancelledOrDone && endMs >= nowMs) {
            upcoming.push(summary);
        } else {
            past.push(summary);
        }
    }

    upcoming.sort((a, b) => new Date(a.StartsAt).getTime() - new Date(b.StartsAt).getTime());
    past.sort((a, b) => new Date(b.StartsAt).getTime() - new Date(a.StartsAt).getTime());

    return { meetings, upcoming, past };
}

export interface CreateSpaceMeetingInput {
    spaceId: string;
    name: string;
    startsAt: string | Date;
    endsAt: string | Date;
    timeZone: string;
    description?: string | null;
    typeId?: string | null;
    locationType?: 'Virtual' | 'InPerson' | 'Hybrid' | 'Phone';
    location?: string | null;
    videoJoinUrl?: string | null;
    visibility?: 'Standard' | 'Private';
}

export type CreateSpaceMeetingResult =
    | {
          ok: true;
          meetingId: string;
          linkId: string;
          itemId: string | null;
          band: Band;
      }
    | {
          ok: false;
          message: string;
      };

/**
 * Schedules a meeting in a space (`MJ_BizApps_Tasks: Meetings` + `MJ_BizApps_Tasks: Meeting Links`)
 * as the system user after verifying the caller reaches the space with `canContribute`,
 * lets `MeetingEntityServer` create the organizer's `MeetingAttendee` row, and files a
 * non-fatal `MJ_BizApps_Collaboration: Space Items` row as the caller on `Shared` (`Standard`)
 * or `Team` (`Private`).
 */
export async function createSpaceMeeting(
    provider: IMetadataProvider,
    user: UserInfo,
    input: CreateSpaceMeetingInput
): Promise<CreateSpaceMeetingResult> {
    const spaceId = parseUuid(input.spaceId);
    if (!spaceId) {
        return { ok: false, message: 'Meeting scheduling refused: a valid space ID is required.' };
    }
    const name = (input.name ?? '').trim();
    if (!name) {
        return { ok: false, message: 'Meeting scheduling refused: a meeting title is required.' };
    }
    const timeZone = (input.timeZone ?? '').trim();
    if (!timeZone) {
        return { ok: false, message: 'Meeting scheduling refused: a time zone is required.' };
    }
    const startsAt = input.startsAt instanceof Date ? input.startsAt : new Date(input.startsAt);
    const endsAt = input.endsAt instanceof Date ? input.endsAt : new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        return { ok: false, message: 'Meeting scheduling refused: start and end times must be valid dates.' };
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
        return { ok: false, message: 'Meeting scheduling refused: end time must be after start time.' };
    }

    const locationType = input.locationType ?? 'Virtual';
    if (
        locationType !== 'Virtual' &&
        locationType !== 'InPerson' &&
        locationType !== 'Hybrid' &&
        locationType !== 'Phone'
    ) {
        return { ok: false, message: 'Meeting scheduling refused: invalid location type.' };
    }

    const visibility = input.visibility ?? 'Standard';
    if (visibility !== 'Standard' && visibility !== 'Private') {
        return { ok: false, message: 'Meeting scheduling refused: visibility must be Standard or Private.' };
    }

    const meetingsInfo = provider.EntityByName('MJ_BizApps_Tasks: Meetings');
    const spacesInfo = provider.EntityByName('MJ_BizApps_Collaboration: Spaces');
    if (!meetingsInfo || !spacesInfo) {
        return { ok: false, message: 'Meeting scheduling refused: the meeting or space entity is not installed.' };
    }

    const probe = await provider.GetEntityObject<SpaceItemEntityServer>(
        'MJ_BizApps_Collaboration: Space Items',
        user
    );
    let context;
    try {
        context = await loadWriteContext(probe, user, spaceId, null);
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Meeting scheduling refused: the space could not be read.',
        };
    }

    const targetSpace = context.spaces.find((s) => s.id === spaceId);
    if (!targetSpace) {
        return {
            ok: false,
            message: 'Meeting scheduling refused: space not found or caller cannot access this space.',
        };
    }
    if (spaceIsReadOnly(targetSpace)) {
        return {
            ok: false,
            message: targetSpace.closedAt
                ? 'Meeting scheduling refused: cannot schedule a meeting in a closed space.'
                : 'Meeting scheduling refused: cannot schedule a meeting in a read-only space.',
        };
    }

    const reach = membershipReaches(context.spaces, context.memberships, user.ID, spaceId);
    if (!reach) {
        return { ok: false, message: 'Meeting scheduling refused: the signer does not reach this space.' };
    }
    if (!reach.role.canContribute) {
        return {
            ok: false,
            message: 'Meeting scheduling refused: this role cannot schedule meetings in this space.',
        };
    }
    if (visibility === 'Private' && !reach.role.canSeeTeamBand) {
        return {
            ok: false,
            message: 'Meeting scheduling refused: only team members can schedule a private meeting.',
        };
    }

    const requestedBand: Band = visibility === 'Private' ? 'Team' : 'Shared';
    const bandDecision = authorizeItemWrite({
        callerUserId: user.ID,
        previousSpaceId: null,
        nextSpaceId: spaceId,
        previousBand: null,
        nextBand: requestedBand,
        now: new Date(),
        spaces: context.spaces,
        memberships: context.memberships,
    });
    if (!bandDecision.ok) {
        return { ok: false, message: bandDecision.message };
    }
    const band = bandDecision.band;

    const system = await requireSystemUser(probe);
    const organizerPersonId = await callerPersonId(probe, user);
    if (!organizerPersonId) {
        return { ok: false, message: 'Meeting scheduling refused: the signer has no person record.' };
    }

    const meeting = await provider.GetEntityObject<mjBizAppsTasksMeetingEntity>(
        'MJ_BizApps_Tasks: Meetings',
        system
    );
    meeting.NewRecord();
    meeting.Name = name;
    meeting.Description = input.description?.trim() ? input.description.trim() : null;
    meeting.TypeID = input.typeId ? (parseUuid(input.typeId) ?? input.typeId) : null;
    meeting.StartsAt = startsAt;
    meeting.EndsAt = endsAt;
    meeting.TimeZone = timeZone;
    meeting.Status = 'Scheduled';
    meeting.LocationType = locationType;
    meeting.Location = input.location?.trim() ? input.location.trim() : null;
    meeting.VideoJoinURL = input.videoJoinUrl?.trim() ? input.videoJoinUrl.trim() : null;
    meeting.Visibility = visibility;
    meeting.OrganizerPersonID = organizerPersonId;
    meeting.CreatedByPersonID = organizerPersonId;

    if (!(await meeting.Save()) || !meeting.ID) {
        return {
            ok: false,
            message:
                meeting.LatestResult?.CompleteMessage ??
                'Meeting scheduling refused: the meeting could not be saved.',
        };
    }

    const link = await provider.GetEntityObject<mjBizAppsTasksMeetingLinkEntity>(
        'MJ_BizApps_Tasks: Meeting Links',
        system
    );
    link.NewRecord();
    link.MeetingID = meeting.ID;
    link.EntityID = spacesInfo.ID || COLLABORATION_SPACES_ENTITY_ID;
    link.RecordID = spaceId;
    link.Description = 'Space';

    if (!(await link.Save()) || !link.ID) {
        await removeUnfiledMeeting(provider, system, meeting.ID);
        return {
            ok: false,
            message:
                link.LatestResult?.CompleteMessage ??
                'Meeting scheduling refused: the meeting link could not be saved.',
        };
    }

    const item = await provider.GetEntityObject<SpaceItemEntityServer>(
        'MJ_BizApps_Collaboration: Space Items',
        user
    );
    vouchStoredFile(item);
    let itemSaved = false;
    let itemRefusalMessage: string | undefined;
    try {
        item.NewRecord();
        item.SpaceID = spaceId;
        item.EntityID = meetingsInfo.ID;
        item.RecordID = meeting.ID;
        item.Band = band;
        itemSaved = await item.Save();
        if (!itemSaved) {
            itemRefusalMessage = item.LatestResult?.CompleteMessage;
        }
    } finally {
        releaseStoredFile(item);
    }

    if (!itemSaved || !item.ID) {
        try {
            await link.Delete();
        } catch (linkDelErr) {
            LogError(
                `createSpaceMeeting link cleanup failed for meeting ${meeting.ID}: ${
                    linkDelErr instanceof Error ? linkDelErr.message : String(linkDelErr)
                }`
            );
        }
        await removeUnfiledMeeting(provider, system, meeting.ID);
        return {
            ok: false,
            message:
                itemRefusalMessage ??
                'Meeting scheduling refused: the space item could not be saved.',
        };
    }

    return {
        ok: true,
        meetingId: meeting.ID,
        linkId: link.ID,
        itemId: item.ID,
        band,
    };
}

/**
 * Removes any attendee rows created for an unfiled meeting (such as the organizer row
 * written by `MeetingEntityServer`) and then deletes the meeting itself.
 */
export async function removeUnfiledMeeting(
    provider: IMetadataProvider,
    actor: UserInfo,
    meetingId: string
): Promise<boolean> {
    const id = parseUuid(meetingId) ?? meetingId;
    if (!id) return false;
    try {
        const view = RunView.FromMetadataProvider(provider);
        const rows = await view.RunView<{ ID: string }>(
            {
                EntityName: 'MJ_BizApps_Tasks: Meeting Attendees',
                ExtraFilter: `MeetingID = '${id}'`,
                Fields: ['ID'],
                MaxRows: 200,
                ResultType: 'simple',
            },
            actor
        );
        if (rows.Success) {
            for (const row of rows.Results ?? []) {
                const attendeeKey = parseUuid(row.ID) ?? row.ID;
                if (!attendeeKey) continue;
                const attendee = await provider.GetEntityObject<mjBizAppsTasksMeetingAttendeeEntity>(
                    'MJ_BizApps_Tasks: Meeting Attendees',
                    actor
                );
                if (attendee && (await attendee.Load(attendeeKey))) {
                    await attendee.Delete();
                }
            }
        }
    } catch (attErr) {
        LogError(
            `removeUnfiledMeeting attendee cleanup failed for meeting ${id}: ${
                attErr instanceof Error ? attErr.message : String(attErr)
            }`
        );
    }

    try {
        const meeting = await provider.GetEntityObject<mjBizAppsTasksMeetingEntity>(
            'MJ_BizApps_Tasks: Meetings',
            actor
        );
        if (!meeting) return false;
        if (typeof meeting.Load === 'function') {
            if (!(await meeting.Load(id))) return false;
        }
        return typeof meeting.Delete === 'function' ? await meeting.Delete() : false;
    } catch (delErr) {
        LogError(
            `removeUnfiledMeeting failed for meeting ${id}: ${
                delErr instanceof Error ? delErr.message : String(delErr)
            }`
        );
        return false;
    }
}

/**
 * Finds or creates a `SpaceChat` bound to a meeting via `Subject = 'meeting:<MeetingID>'`.
 * Verifies the meeting belongs to `spaceId` via `Meeting Links`, and routes creation
 * through `createSpaceConversation` so the space type driver's `ValidateChatChange` hook,
 * `Chats.WhoCanStart` setting, and room edit grants are enforced.
 */
export async function ensureMeetingSpaceChat(
    provider: IMetadataProvider,
    params: {
        spaceId: string;
        meetingId: string;
        meetingName: string;
        visibility?: 'Standard' | 'Private';
        contextUser: UserInfo;
        createConversation?: typeof createSpaceConversation;
    }
): Promise<
    | { ok: true; spaceChatId: string; conversationId: string; created: boolean }
    | { ok: false; message: string }
> {
    const cleanSpaceId = parseUuid(params.spaceId);
    const cleanMeetingId = parseUuid(params.meetingId);
    if (!cleanSpaceId || !cleanMeetingId) {
        return { ok: false, message: 'A valid space ID and meeting ID are required.' };
    }

    const view = RunView.FromMetadataProvider(provider);
    const recordKeyCandidates = [
        `'${cleanSpaceId}'`,
        `'${cleanSpaceId.toUpperCase()}'`,
        `'ID|${cleanSpaceId}'`,
        `'ID|${cleanSpaceId.toUpperCase()}'`,
    ];
    const linksRes = await view.RunView<{
        ID: string;
        MeetingID: string | null;
        SeriesID: string | null;
        RecordID: string;
    }>(
        {
            EntityName: 'MJ_BizApps_Tasks: Meeting Links',
            ExtraFilter: `EntityID = '${COLLABORATION_SPACES_ENTITY_ID}' AND RecordID IN (${recordKeyCandidates.join(', ')})`,
            ResultType: 'simple',
        },
        params.contextUser
    );
    if (!linksRes.Success) {
        return { ok: false, message: 'Meeting chat refused: meeting links could not be read.' };
    }

    const directLinked = (linksRes.Results ?? []).some(
        (l) => parseUuid(l.MeetingID) === cleanMeetingId
    );
    let seriesLinked = false;
    if (!directLinked) {
        const linkedSeriesIds = new Set(
            (linksRes.Results ?? [])
                .map((l) => parseUuid(l.SeriesID))
                .filter((id): id is string => id !== null)
        );
        if (linkedSeriesIds.size > 0) {
            const meetingRes = await view.RunView<{ ID: string; SeriesID?: string | null }>(
                {
                    EntityName: 'MJ_BizApps_Tasks: Meetings',
                    ExtraFilter: `ID = '${cleanMeetingId}'`,
                    Fields: ['ID', 'SeriesID'],
                    MaxRows: 1,
                    ResultType: 'simple',
                },
                params.contextUser
            );
            const seriesId = meetingRes.Success
                ? parseUuid(meetingRes.Results?.[0]?.SeriesID)
                : null;
            seriesLinked = seriesId !== null && linkedSeriesIds.has(seriesId);
        }
    }

    if (!directLinked && !seriesLinked) {
        return {
            ok: false,
            message: 'Meeting chat refused: this meeting does not belong to this space.',
        };
    }

    const subject = meetingChatSubject(cleanMeetingId);
    const existingRes = await view.RunView<{ ID: string; ConversationID: string }>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Space Chats',
            ExtraFilter: `SpaceID = '${cleanSpaceId}' AND Subject = '${subject}' AND Status = 'Active'`,
            Fields: ['ID', 'ConversationID'],
            MaxRows: 1,
            ResultType: 'simple',
        },
        params.contextUser
    );
    if (existingRes.Success && existingRes.Results?.[0]) {
        return {
            ok: true,
            spaceChatId: existingRes.Results[0].ID,
            conversationId: existingRes.Results[0].ConversationID,
            created: false,
        };
    }

    try {
        const createFn = params.createConversation ?? createSpaceConversation;
        const created = await createFn(provider, params.contextUser, {
            SpaceID: cleanSpaceId,
            Name: params.meetingName.trim() || 'Meeting Discussion',
            Kind: params.visibility === 'Private' ? 'Private' : 'Topic',
            Subject: subject,
        });
        if (!created.ok || !created.spaceChatId || !created.conversationId) {
            return {
                ok: false,
                message:
                    created.message ??
                    'Could not create the space chat for this meeting.',
            };
        }

        return {
            ok: true,
            spaceChatId: created.spaceChatId,
            conversationId: created.conversationId,
            created: true,
        };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        LogError(`ensureMeetingSpaceChat failed for meeting ${cleanMeetingId}: ${msg}`);
        return { ok: false, message: msg };
    }
}

/**
 * Builds space meeting context for `executeSpaceChatTurn` (Decision A4):
 * - Runs as the acting `contextUser` so row-level security applies.
 * - `Standard` meetings are visible to all space participants.
 * - `Private` meetings are included ONLY when every viewer in `viewerBands` is on the
 *   `Team` band AND every viewer in `viewerBands` is an attendee of that `Private` meeting.
 */
export async function buildSpaceMeetingsAgentContext(
    provider: IMetadataProvider,
    spaceId: string,
    viewerBands: Record<string, 'Team' | 'Shared'>,
    contextUser: UserInfo
): Promise<AgentContextResult> {
    const viewerUserIds = Object.keys(viewerBands).map((id) => (parseUuid(id) ?? id.trim()).toUpperCase());
    const bandValues = Object.values(viewerBands);
    const allViewersOnTeam = bandValues.length > 0 && bandValues.every((band) => band === 'Team');

    const loaded = await loadSpaceMeetings(provider, spaceId, contextUser, {
        includeDetails: true,
    });

    const privateMeetings = loaded.meetings.filter((m) => m.Visibility === 'Private');
    const attendeesByMeetingId = new Map<string, Set<string>>();

    if (allViewersOnTeam && privateMeetings.length > 0) {
        const view = RunView.FromMetadataProvider(provider);
        const quotedIds = privateMeetings
            .map((m) => parseUuid(m.ID) ?? m.ID)
            .map((id) => `'${id}'`)
            .join(', ');
        const attendeesRes = await view.RunView<{
            MeetingID: string;
            UserID?: string | null;
        }>(
            {
                EntityName: 'MJ_BizApps_Tasks: Meeting Attendees',
                ExtraFilter: `MeetingID IN (${quotedIds})`,
                Fields: ['MeetingID', 'UserID'],
                ResultType: 'simple',
            },
            contextUser
        );
        if (attendeesRes.Success) {
            for (const row of attendeesRes.Results ?? []) {
                const mId = (parseUuid(row.MeetingID) ?? row.MeetingID).toUpperCase();
                const uId = row.UserID ? (parseUuid(row.UserID) ?? row.UserID.trim()).toUpperCase() : null;
                if (!uId) continue;
                const set = attendeesByMeetingId.get(mId) ?? new Set<string>();
                set.add(uId);
                attendeesByMeetingId.set(mId, set);
            }
        }
    }

    const visibleMeetings = loaded.meetings.filter((m) => {
        if (m.Visibility === 'Standard') return true;
        if (!allViewersOnTeam || viewerUserIds.length === 0) return false;
        const mKey = (parseUuid(m.ID) ?? m.ID).toUpperCase();
        const attendees = attendeesByMeetingId.get(mKey);
        if (!attendees) return false;
        return viewerUserIds.every((uid) => attendees.has(uid));
    });

    if (visibleMeetings.length === 0) {
        return { instructions: [], contextData: {} };
    }

    const lines = visibleMeetings.map((m) => {
        const agendaNames = (m.AgendaItems ?? []).map((a) => a.Name).join(', ');
        const agendaPart = agendaNames ? ` | Agenda: ${agendaNames}` : '';
        return `- ${m.Name} (${m.StartsAt} to ${m.EndsAt}, Status: ${m.Status})${agendaPart}`;
    });

    return {
        instructions: [
            `Space Meetings (${visibleMeetings.length}):\n${lines.join('\n')}`,
        ],
        contextData: {
            spaceMeetings: visibleMeetings,
        },
    };
}

@RegisterClassEx(BaseAgendaProvider, {
    key: 'collaboration:meetings-agenda-provider',
    metadata: { spaceTypes: ['*'] },
})
export class SpaceMeetingsAgendaProvider extends BaseAgendaProvider {
    public override async getItemsForSpaces(context: SpaceBatchContext): Promise<AgendaItem[]> {
        const provider = context.provider as IMetadataProvider | undefined;
        if (!provider || typeof (provider as { RunView?: unknown }).RunView !== 'function') {
            return [];
        }
        const items: AgendaItem[] = [];
        for (const spaceId of context.spaceIds) {
            const loaded = await loadSpaceMeetings(provider, spaceId, undefined, {
                includeDetails: false,
            });
            for (const m of loaded.upcoming) {
                items.push({
                    id: `meeting:${m.ID}`,
                    spaceId: m.SpaceID,
                    title: m.Name,
                    context: m.Location ?? m.LocationType,
                    date: new Date(m.StartsAt),
                    typeIcon: 'fa-solid fa-calendar-check',
                    sourceProvider: 'SpaceMeetingsAgendaProvider',
                    metadata: {
                        meetingId: m.ID,
                        status: m.Status,
                        videoJoinUrl: m.VideoJoinURL ?? null,
                    },
                });
            }
        }
        return items;
    }
}

export function LoadSpaceMeetingsAgendaProvider(): void {
    void SpaceMeetingsAgendaProvider;
}
