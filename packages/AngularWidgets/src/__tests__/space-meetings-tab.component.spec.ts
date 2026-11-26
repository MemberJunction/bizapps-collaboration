// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { IRunViewProvider, RunViewParams, RunViewResult } from '@memberjunction/core';
import {
    buildMeetingIcsContent,
    computeMeetingPermissions,
    createDefaultSpaceMeetingDraft,
    filterSpaceMeetings,
    loadSpaceChildSpaces,
    loadSpaceMeetingDetail,
    loadSpaceMeetingsWithRollup,
    meetingVisibilityToSpaceBand,
    type SpaceMeetingCardItem,
    SpaceMeetingsTabComponent,
    toMeetingRow,
    validateNewSpaceMeetingDraft,
} from '../public-api.ts';

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
});

function futureIso(hoursFromNow: number): string {
    return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

function makeMeeting(overrides: Partial<SpaceMeetingCardItem> = {}): SpaceMeetingCardItem {
    return {
        ID: 'M1000001-0000-4000-8000-000000000001',
        Name: 'Quarterly Architecture Review',
        StartsAt: futureIso(24),
        EndsAt: futureIso(25),
        TimeZone: 'America/Chicago',
        Status: 'Scheduled',
        LocationType: 'Virtual',
        Location: 'Zoom Room A',
        VideoJoinURL: 'https://meet.example.com/q4-arch',
        Visibility: 'Standard',
        Description: 'Review system architecture milestones.',
        SpaceID: 'S1000001-0000-4000-8000-000000000001',
        SpaceName: 'Program Hub',
        SpaceChatID: null,
        ConversationID: null,
        AttendeeCount: 4,
        MyAttendeeID: 'A1000001-0000-4000-8000-000000000001',
        MyResponse: 'None',
        IsMine: false,
        ...overrides,
    };
}

function mockRunViewProvider(
    handler: (params: RunViewParams) => RunViewResult<Record<string, unknown>>,
): IRunViewProvider {
    return {
        RunView: vi.fn(async (params: RunViewParams) => handler(params)),
        RunViews: vi.fn(async (batch: RunViewParams[]) => batch.map((p) => handler(p))),
    } as unknown as IRunViewProvider;
}

describe('SpaceMeetingsTabComponent (meetings widget composition, drawer, sub-space rollup, band security)', () => {
    it('enforces strict band & read-only permissions for external viewers vs team contributors', () => {
        const external = computeMeetingPermissions({
            CanSeeTeamSide: false,
            CanSchedule: true,
            IsOrganizer: true,
        });
        expect(external).toEqual({
            canEdit: false,
            canRun: false,
            canInvite: false,
            canWriteNotes: false,
            canAddFollowUps: false,
        });

        const teamContributor = computeMeetingPermissions({
            CanSeeTeamSide: true,
            CanSchedule: true,
            IsOrganizer: false,
        });
        expect(teamContributor).toEqual({
            canEdit: true,
            canRun: true,
            canInvite: true,
            canWriteNotes: true,
            canAddFollowUps: true,
        });

        const teamReadOnly = computeMeetingPermissions({
            CanSeeTeamSide: true,
            CanSchedule: false,
            IsOrganizer: false,
        });
        expect(teamReadOnly.canEdit).toBe(false);
        expect(teamReadOnly.canRun).toBe(false);
    });

    it('filters out Private meetings for !CanSeeTeamSide and supports Upcoming / Past / All + search + sub-space provenance', () => {
        const rootSpaceId = 'S1000001-0000-4000-8000-000000000001';
        const childSpaceId = 'S1000001-0000-4000-8000-000000000002';

        const sharedUpcoming = makeMeeting({
            ID: 'M1000001-0000-4000-8000-000000000001',
            Name: 'Shared Steering Sync',
            Visibility: 'Standard',
            SpaceID: rootSpaceId,
            SpaceName: 'Program Hub',
        });
        const privateUpcoming = makeMeeting({
            ID: 'M1000001-0000-4000-8000-000000000002',
            Name: 'Internal Margin Review',
            Visibility: 'Private',
            SpaceID: rootSpaceId,
            SpaceName: 'Program Hub',
        });
        const childPast = makeMeeting({
            ID: 'M1000001-0000-4000-8000-000000000003',
            Name: 'Discovery Kickoff',
            StartsAt: futureIso(-48),
            EndsAt: futureIso(-47),
            Status: 'Completed',
            Visibility: 'Standard',
            SpaceID: childSpaceId,
            SpaceName: 'Discovery Workstream',
            TypeName: 'Kickoff',
        });

        const all = [sharedUpcoming, privateUpcoming, childPast];

        // External viewer never sees Private
        const extAll = filterSpaceMeetings(all, { CanSeeTeamSide: false, FilterMode: 'all' });
        expect(extAll.map((m) => m.ID)).toEqual([sharedUpcoming.ID, childPast.ID]);

        // Team viewer sees Private and can filter by Team band
        const teamOnly = filterSpaceMeetings(all, {
            CanSeeTeamSide: true,
            FilterMode: 'all',
            BandFilter: 'Team',
        });
        expect(teamOnly.map((m) => m.ID)).toEqual([privateUpcoming.ID]);

        // Search matches child room name
        const byRoom = filterSpaceMeetings(all, {
            CanSeeTeamSide: false,
            FilterMode: 'all',
            SearchQuery: 'discovery workstream',
        });
        expect(byRoom.map((m) => m.ID)).toEqual([childPast.ID]);

        // Child space provenance appears on MeetingRow.typeName
        const row = toMeetingRow(childPast, rootSpaceId);
        expect(row.typeName).toBe('Discovery Workstream · Kickoff');
        const rootRow = toMeetingRow(sharedUpcoming, rootSpaceId);
        expect(rootRow.typeName).toBeNull();
    });

    it('renders <bizapps-meeting-list>, hides Private meetings & Open Form for external viewers, and opens the in-place drawer on row click', async () => {
        const fixture = TestBed.createComponent(SpaceMeetingsTabComponent);
        const comp = fixture.componentInstance;

        const rootSpaceId = 'S1000001-0000-4000-8000-000000000001';
        const childSpaceId = 'S1000001-0000-4000-8000-000000000002';
        const sharedMeeting = makeMeeting({
            ID: 'M1000001-0000-4000-8000-000000000010',
            Name: 'Shared Steering Committee',
            Visibility: 'Standard',
            SpaceID: childSpaceId,
            SpaceName: 'Workstream Alpha',
        });
        const privateMeeting = makeMeeting({
            ID: 'M1000001-0000-4000-8000-000000000011',
            Name: 'Secret Internal Prep',
            Visibility: 'Private',
            SpaceID: rootSpaceId,
            SpaceName: 'Program Hub',
        });

        fixture.componentRef.setInput('SpaceId', rootSpaceId);
        fixture.componentRef.setInput('SpaceName', 'Program Hub');
        fixture.componentRef.setInput('CanSeeTeamSide', false);
        fixture.componentRef.setInput('CanSchedule', true);
        fixture.componentRef.setInput('Meetings', [sharedMeeting, privateMeeting]);
        comp.ChildSpaces = [{ ID: childSpaceId, Name: 'Workstream Alpha', ParentID: rootSpaceId }];
        Object.defineProperty(comp, 'RunViewToUse', {
            value: mockRunViewProvider(() => ({
                Success: true,
                Results: [],
                RowCount: 0,
                TotalRowCount: 0,
                ExecutionTime: 1,
                ErrorMessage: '',
            })),
            configurable: true,
        });

        const chatEvents: SpaceMeetingCardItem[] = [];
        comp.OpenMeetingChatRequested.subscribe((m) => chatEvents.push(m));
        comp.OpenMeetingRequested.subscribe(() => {});

        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('bizapps-meeting-list')).not.toBeNull();
        expect(host.querySelector('[data-testid="include-subspaces-toggle"]')?.textContent).toContain(
            'Include sub-spaces (1)',
        );
        expect(host.textContent).toContain('Shared Steering Committee');
        expect(host.textContent).not.toContain('Secret Internal Prep');

        // External viewer cannot open Private meeting programmatically either
        comp.openMeetingDrawer(privateMeeting);
        fixture.detectChanges();
        expect(host.querySelector('[data-testid="meeting-drawer-sheet"]')).toBeNull();

        // Click Shared meeting row -> opens in-place slide-over drawer
        const rowEl = host.querySelector<HTMLElement>('bizapps-meeting-list .row');
        expect(rowEl).not.toBeNull();
        rowEl!.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const drawer = host.querySelector<HTMLElement>('[data-testid="meeting-drawer-sheet"]');
        expect(drawer).not.toBeNull();
        expect(drawer?.getAttribute('role')).toBe('dialog');
        expect(drawer?.getAttribute('aria-modal')).toBe('true');
        expect(drawer?.querySelector('bizapps-meeting-header')).not.toBeNull();
        expect(drawer?.querySelector('bizapps-meeting-agenda')).not.toBeNull();
        expect(drawer?.querySelector('bizapps-meeting-people')).not.toBeNull();
        expect(drawer?.querySelector('bizapps-meeting-notes')).not.toBeNull();
        expect(drawer?.querySelector('bizapps-meeting-followups')).not.toBeNull();

        // Sub-space provenance pill rendered in drawer header
        expect(drawer?.querySelector('[data-testid="drawer-subspace-pill"]')?.textContent).toContain(
            'Workstream Alpha',
        );

        // External viewer MUST NOT see Run Live Meeting or Open Form buttons
        expect(drawer?.querySelector('[data-testid="drawer-live-toggle-btn"]')).toBeNull();
        expect(drawer?.querySelector('[data-testid="drawer-open-form-btn"]')).toBeNull();

        // External viewer CAN click Open/Start Chat, preserving the child SpaceID
        const chatBtn = drawer?.querySelector<HTMLButtonElement>('[data-testid="drawer-chat-btn"]');
        expect(chatBtn).not.toBeNull();
        chatBtn!.click();
        expect(chatEvents.length).toBe(1);
        expect(chatEvents[0].ID).toBe(sharedMeeting.ID);
        expect(chatEvents[0].SpaceID).toBe(childSpaceId);
    });

    it('allows staff team contributors to view Private meetings, toggle <bizapps-meeting-live>, and see Open Form', async () => {
        const fixture = TestBed.createComponent(SpaceMeetingsTabComponent);
        const comp = fixture.componentInstance;

        const privateMeeting = makeMeeting({
            ID: 'M1000001-0000-4000-8000-000000000020',
            Name: 'Team Delivery Sync',
            Visibility: 'Private',
            Status: 'InProgress',
        });

        fixture.componentRef.setInput('SpaceId', 'S1000001-0000-4000-8000-000000000001');
        fixture.componentRef.setInput('CanSeeTeamSide', true);
        fixture.componentRef.setInput('CanSchedule', true);
        fixture.componentRef.setInput('Meetings', [privateMeeting]);
        Object.defineProperty(comp, 'RunViewToUse', {
            value: mockRunViewProvider(() => ({
                Success: true,
                Results: [],
                RowCount: 0,
                TotalRowCount: 0,
                ExecutionTime: 1,
                ErrorMessage: '',
            })),
            configurable: true,
        });
        comp.OpenMeetingRequested.subscribe(() => {});

        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.textContent).toContain('Team Delivery Sync');

        comp.openMeetingDrawer(privateMeeting);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const liveToggle = host.querySelector<HTMLButtonElement>('[data-testid="drawer-live-toggle-btn"]');
        const openFormBtn = host.querySelector<HTMLButtonElement>('[data-testid="drawer-open-form-btn"]');
        expect(liveToggle).not.toBeNull();
        expect(openFormBtn).not.toBeNull();

        // Enter Live Runner mode inside drawer
        liveToggle!.click();
        fixture.detectChanges();
        expect(host.querySelector('bizapps-meeting-live')).not.toBeNull();
        expect(host.querySelector('[data-testid="drawer-live-indicator"]')).not.toBeNull();

        // Close drawer
        host.querySelector<HTMLButtonElement>('[data-testid="drawer-close-btn"]')!.click();
        fixture.detectChanges();
        expect(host.querySelector('[data-testid="meeting-drawer-sheet"]')).toBeNull();
    });

    it('recursively discovers descendant spaces in loadSpaceChildSpaces and terminates cleanly on cycles', async () => {
        const provider = mockRunViewProvider((params) => {
            const filter = String(params.ExtraFilter ?? '');
            if (filter.includes("'root-1'")) {
                return {
                    Success: true,
                    Results: [
                        { ID: 'child-1', Name: 'Child Alpha', ParentID: 'root-1' },
                        { ID: 'child-2', Name: 'Child Beta', ParentID: 'root-1' },
                    ],
                    RowCount: 2,
                    TotalRowCount: 2,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (filter.includes("'child-1'")) {
                return {
                    Success: true,
                    Results: [
                        { ID: 'grandchild-1', Name: 'Grandchild Gamma', ParentID: 'child-1' },
                        { ID: 'root-1', Name: 'Cycle Back', ParentID: 'child-1' },
                    ],
                    RowCount: 2,
                    TotalRowCount: 2,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            return { Success: true, Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 1, ErrorMessage: '' };
        });

        const children = await loadSpaceChildSpaces('root-1', provider);
        expect(children.map((c) => c.ID)).toEqual(['child-1', 'child-2', 'grandchild-1']);
    });

    it('validates drafts, maps visibility to band, and formats valid RFC 5545 .ics calendar downloads', () => {
        expect(meetingVisibilityToSpaceBand('Standard')).toBe('Shared');
        expect(meetingVisibilityToSpaceBand('Private')).toBe('Team');

        const draft = createDefaultSpaceMeetingDraft(new Date('2026-11-25T14:00:00Z'));
        expect(validateNewSpaceMeetingDraft(draft).valid).toBe(false);
        draft.Name = 'Architecture Sync';
        expect(validateNewSpaceMeetingDraft(draft).valid).toBe(true);

        const ics = buildMeetingIcsContent(makeMeeting({ Name: 'Sync, Q4; Review' }));
        expect(ics).toContain('BEGIN:VCALENDAR');
        expect(ics).toContain('BEGIN:VEVENT');
        expect(ics).toContain('SUMMARY:Sync\\, Q4\\; Review');
        expect(ics).toContain('URL:https://meet.example.com/q4-arch');
        expect(ics).toContain('END:VCALENDAR');
    });

    it('batches independent queries in loadSpaceMeetingsWithRollup and loadSpaceMeetingDetail via single RunViews calls', async () => {
        const rootSpaceId = 'S1000001-0000-4000-8000-000000000001';
        const meetingId = 'M1000001-0000-4000-8000-000000000001';
        const provider = mockRunViewProvider((params) => {
            if (params.EntityName === 'MJ_BizApps_Tasks: Meeting Links') {
                return {
                    Success: true,
                    Results: [{ ID: 'ML-1', MeetingID: meetingId, SeriesID: null, RecordID: rootSpaceId }],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (params.EntityName === 'MJ_BizApps_Tasks: Meetings') {
                return {
                    Success: true,
                    Results: [{
                        ID: meetingId,
                        Name: 'Batched Architecture Sync',
                        StartsAt: futureIso(24),
                        EndsAt: futureIso(25),
                        Status: 'Scheduled',
                        Visibility: 'Standard',
                    }],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (params.EntityName === 'MJ_BizApps_Common: People') {
                return {
                    Success: true,
                    Results: [{ ID: 'P-VIEWER', Name: 'Jane Viewer', LinkedUserID: 'U-VIEWER' }],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            return { Success: true, Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 1, ErrorMessage: '' };
        });

        const rollup = await loadSpaceMeetingsWithRollup(rootSpaceId, provider, {
            CurrentUserId: 'U-VIEWER',
            IncludeSubSpaces: false,
            CanSeeTeamSide: true,
        });
        expect(rollup.Meetings).toHaveLength(1);
        expect(provider.RunViews).toHaveBeenCalledTimes(1);

        const detailProvider = mockRunViewProvider((params) => {
            if (params.EntityName === 'MJ_BizApps_Common: People') {
                return {
                    Success: true,
                    Results: [{ ID: 'P-VIEWER', Name: 'Jane Viewer', LinkedUserID: 'U-VIEWER' }],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            return { Success: true, Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 1, ErrorMessage: '' };
        });

        const detail = await loadSpaceMeetingDetail(makeMeeting({ ID: meetingId }), detailProvider, {
            CurrentUserId: 'U-VIEWER',
            CanSeeTeamSide: true,
        });
        expect(detail.Meeting.ID).toBe(meetingId);
        // All 7 independent detail reads (Agenda, ItemTypes, Attendees, Notes, TaskLinks, People, ViewerPerson) batch into ONE RunViews call
        expect(detailProvider.RunViews).toHaveBeenCalledTimes(1);
        expect(detailProvider.RunView).not.toHaveBeenCalled();
    });
});
