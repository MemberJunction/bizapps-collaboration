import { type IMetadataProvider, LogError, RunView, type UserInfo } from '@memberjunction/core';
import type { MJConversationEntity } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { type AgendaItem, BaseAgendaProvider, type SpaceBatchContext } from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceChatEntity } from '@mj-biz-apps/collaboration-entities';
import type { AgentContextResult } from './base-space-type-server-driver.js';
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

/**
 * Finds or creates a `SpaceChat` bound to a meeting via `Subject = 'meeting:<MeetingID>'`.
 * A `Private` meeting creates a `Private` SpaceChat (visible only to Team-band members);
 * a `Standard` meeting creates a `Topic` SpaceChat.
 */
export async function ensureMeetingSpaceChat(
    provider: IMetadataProvider,
    params: {
        spaceId: string;
        meetingId: string;
        meetingName: string;
        visibility?: 'Standard' | 'Private';
        contextUser: UserInfo;
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

    const subject = meetingChatSubject(cleanMeetingId);
    const view = RunView.FromMetadataProvider(provider);
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
        const conversation = await provider.GetEntityObject<MJConversationEntity>(
            'MJ: Conversations',
            params.contextUser
        );
        conversation.NewRecord();
        conversation.Name = params.meetingName.trim() || 'Meeting Discussion';
        conversation.UserID = params.contextUser.ID;
        conversation.Status = 'Available';
        if (!(await conversation.Save()) || !conversation.ID) {
            return {
                ok: false,
                message:
                    conversation.LatestResult?.CompleteMessage ??
                    'Could not create the conversation for this meeting.',
            };
        }

        const spaceChat = await provider.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>(
            'MJ_BizApps_Collaboration: Space Chats',
            params.contextUser
        );
        spaceChat.NewRecord();
        spaceChat.SpaceID = params.spaceId;
        spaceChat.ConversationID = conversation.ID;
        spaceChat.Name = params.meetingName.trim() || 'Meeting Discussion';
        spaceChat.Subject = subject;
        spaceChat.Kind = params.visibility === 'Private' ? 'Private' : 'Topic';
        spaceChat.Status = 'Active';
        if (!(await spaceChat.Save()) || !spaceChat.ID) {
            return {
                ok: false,
                message:
                    spaceChat.LatestResult?.CompleteMessage ??
                    'Could not create the space chat for this meeting.',
            };
        }

        return {
            ok: true,
            spaceChatId: spaceChat.ID,
            conversationId: conversation.ID,
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
 * Whenever any chat participant in `viewerBands` is on the `Shared` band,
 * `Private` meetings are completely hidden from the agent's instructions and contextData.
 */
export async function buildSpaceMeetingsAgentContext(
    provider: IMetadataProvider,
    spaceId: string,
    viewerBands: Record<string, 'Team' | 'Shared'>,
    contextUser: UserInfo
): Promise<AgentContextResult> {
    const bandValues = Object.values(viewerBands);
    const allViewersOnTeam = bandValues.length > 0 && bandValues.every((band) => band === 'Team');

    const loaded = await loadSpaceMeetings(provider, spaceId, contextUser, {
        includeDetails: true,
    });

    const visibleMeetings = loaded.meetings.filter(
        (m) => m.Visibility === 'Standard' || (m.Visibility === 'Private' && allViewersOnTeam)
    );

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

@RegisterClass(BaseAgendaProvider, 'SpaceMeetingsAgendaProvider')
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
