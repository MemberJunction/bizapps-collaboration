import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { MJPageLayoutComponent, MJPageBodyComponent, MJButtonDirective } from '@memberjunction/ng-ui-components';
import type { ResourceData } from '@memberjunction/core-entities';
import {
    CollabSpaceRailComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceTabsComponent,
    CollabSpaceOverviewComponent,
    CollabSpaceLibraryComponent,
    CollabShareCheckDialogComponent,
    CollabAudiencePillComponent,
    type TabItem,
    type RailSpaceNode,
    type BreadcrumbItem,
    type NeedsYouItemModel,
    type ItemCardModel,
    type ItemRowModel,
    type LibraryRowModel,
    type RoomMiniMessage,
    type SubSpaceSummary,
    type LibraryCollection,
    type LibrarySmartView,
    type FindingModel,
    type RecipientPersonModel,
    type FileKind,
    type RecentUseModel,
    type AvatarItem,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { CollaborationNoAccessComponent } from './no-access.component';

/**
 * Collaboration section resource host for MemberJunction Explorer (L3).
 * Owns NavigationService, deep-linking query parameters, and tab/record routing.
 */
@Component({
    selector: 'mjc-collaboration-section',
    standalone: true,
    imports: [
        CommonModule,
        MJPageLayoutComponent,
        MJPageBodyComponent,
        MJButtonDirective,
        CollabSpaceRailComponent,
        CollabSpaceHeaderComponent,
        CollabSpaceTabsComponent,
        CollabSpaceOverviewComponent,
        CollabSpaceLibraryComponent,
        CollabShareCheckDialogComponent,
        CollabAudiencePillComponent,
        CollaborationNoAccessComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        .mjc-shell {
            display: grid;
            grid-template-columns: 252px 1fr;
            width: 100%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }
        .main {
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--mj-bg-page, #ffffff);
        }
        .content-area {
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
            display: flex;
            flex-direction: column;
        }
        .tab-placeholder {
            padding: 32px;
            color: var(--mj-text-secondary, #64748b);
            font-size: 14px;
        }
        .row { display: flex; align-items: center; }
        .gap8 { gap: 8px; }
    `],
    template: `
        <mj-page-layout>
            <mj-page-body [Padding]="false">
                @if (!hasAccess) {
                    <mjc-no-access [Seats]="seats" />
                } @else {
                    <div class="mjc-shell">
                        <mjc-space-rail
                            [Spaces]="spaces"
                            [ActiveSpaceId]="activeSpaceId"
                            [InboxCount]="inboxCount"
                            [TaskCount]="taskCount"
                            (SpaceOpenRequested)="onSpaceOpenRequested($event)"
                            (NavSelectRequested)="onNavSelectRequested($event)"
                        />

                        <main class="main">
                            <mjc-space-header
                                [Breadcrumbs]="breadcrumbs"
                                [TypeColor]="headerTypeColor"
                                [TypeIconClass]="headerTypeIcon"
                                [Title]="spaceTitle"
                                [TypeName]="spaceTypeName"
                                [Status]="spaceStatus"
                                [Subtitle]="spaceSubtitle"
                            >
                                <div actions class="row gap8">
                                    <mjc-audience-pill
                                        [StaffAvatars]="headerStaffAvatars"
                                        [OutsideAvatars]="headerOutsideAvatars"
                                        [TotalPeople]="headerTotalPeople"
                                        [Summary]="headerAudienceSummary"
                                    />
                                    @if (activeTab === 'Overview') {
                                        <button mjButton variant="secondary" size="md">
                                            <i class="fa-solid fa-user-plus"></i>Invite
                                        </button>
                                        <button mjButton variant="primary" size="md">
                                            <i class="fa-solid fa-plus"></i>New
                                        </button>
                                    } @else {
                                        <button mjButton variant="primary" size="md" (click)="onUploadClicked()">
                                            <i class="fa-solid fa-arrow-up-from-bracket"></i>Upload
                                        </button>
                                    }
                                </div>
                                <mjc-space-tabs
                                    [Tabs]="tabs"
                                    [ActiveTab]="activeTab"
                                    (TabSelectRequested)="onTabSelectRequested($event)"
                                />
                            </mjc-space-header>

                            <div class="content-area">
                                @switch (activeTab) {
                                    @case ('Overview') {
                                        <mjc-space-overview
                                            [SpaceName]="spaceTitle"
                                            [FirmName]="'Meridian'"
                                            [ClientOrgName]="'Northwind'"
                                            [AudienceCount]="9"
                                            [NeedsYouItems]="overviewNeedsYou"
                                            [SharedItems]="overviewSharedItems"
                                            [TeamItems]="overviewTeamItems"
                                            [RoomMessages]="overviewRoomMessages"
                                            [SubSpaces]="overviewSubSpaces"
                                            (OpenLibraryRequested)="onOpenLibraryRequested()"
                                            (OpenChatRequested)="onOpenChatRequested()"
                                            (ItemSelectRequested)="onItemSelected($event)"
                                            (ShareRequested)="onShareRequested($event)"
                                        />
                                    }
                                    @case ('Library') {
                                        <mjc-space-library
                                            [TotalCount]="libraryTotalCount"
                                            [Collections]="libraryCollections"
                                            [SmartViews]="librarySmartViews"
                                            [Rows]="libraryRows"
                                            [SelectedRowId]="selectedItemId || ''"
                                            [ShowDrawer]="isDrawerOpen"
                                            [PreviewMeta]="previewMeta"
                                            [PreviewParagraphs]="previewParagraphs"
                                            [PreviewBandLabel]="previewBandLabel"
                                            [PreviewAudienceSub]="previewAudienceSub"
                                            [PreviewStaffAvatars]="previewStaffAvatars"
                                            [PreviewFlagTitle]="previewFlagTitle"
                                            [PreviewFlagDescription]="previewFlagDescription"
                                            [PreviewRecentUses]="previewRecentUses"
                                            (RowSelectRequested)="onRowSelected($event)"
                                            (ShareRequested)="onShareRequested($event)"
                                            (CloseDrawerRequested)="onCloseDrawerRequested()"
                                        />
                                    }
                                    @case ('Work') {
                                        <div class="tab-placeholder">
                                            <h3>Work & Tasks</h3>
                                            <p>Tasks for {{ spaceTitle }} will display here via bizapps-tasks integration.</p>
                                        </div>
                                    }
                                    @case ('Chat') {
                                        <div class="tab-placeholder">
                                            <h3>Room & Conversations</h3>
                                            <p>Space discussions and agent interactions for {{ spaceTitle }}.</p>
                                        </div>
                                    }
                                    @case ('People') {
                                        <div class="tab-placeholder">
                                            <h3>People & Access</h3>
                                            <p>Team members, outside client participants, and permission levels.</p>
                                        </div>
                                    }
                                    @case ('Settings') {
                                        <div class="tab-placeholder">
                                            <h3>Space Settings</h3>
                                            <p>Configuration, Assistant retrieval rules, and space lifecycle controls.</p>
                                        </div>
                                    }
                                }
                            </div>
                        </main>

                        @if (isShareDialogOpen) {
                            <mjc-share-check-dialog
                                [Title]="shareDialogTitle"
                                [ItemName]="shareDialogItemName"
                                [Kind]="shareDialogKind"
                                [ClientOrgName]="'Northwind'"
                                [RecipientCount]="6"
                                [AudienceHeader]="'6 people at Northwind will be able to open it'"
                                [AudienceStaffSub]="'Meridian’s 3 already can'"
                                [Recipients]="shareRecipients"
                                [ReviewHeader]="'The Assistant checked it first'"
                                [ReviewSub]="'Two phrases could identify someone you interviewed under a promise of anonymity.'"
                                [Findings]="shareFindings"
                                [Note]="shareNote"
                                [NotifyRecipients]="true"
                                [AuthorName]="'Ada Lovell'"
                                [Timestamp]="'10:14 AM'"
                                (ApplyFixRequested)="onApplyFix($event)"
                                (ShareRequested)="onShareCompleted($event)"
                                (CancelRequested)="onShareDialogCancel()"
                            />
                        }
                    </div>
                }
            </mj-page-body>
        </mj-page-layout>
    `,
})
@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')
export class CollaborationSectionResource extends BaseResourceComponent implements OnInit, OnDestroy {
    public hasAccess = true;
    public seats: { spaceName: string; status: string }[] = [];

    // Query parameters state
    public activeView = 'space';
    public activeSpaceId = 'discovery';
    public activeTab = 'Overview';
    public selectedItemId: string | null = 'row-3';
    public isDrawerOpen = true;
    public isShareDialogOpen = false;

    // Header metadata
    public spaceTitle = 'Discovery';
    public spaceTypeName = 'Engagement';
    public spaceStatus = 'Active';
    public spaceSubtitle = 'in Northwind · Week 7 of 10 · Readout Oct 9';
    public headerTypeColor = 'var(--mjc-type-eng, #0ea5e9)';
    public headerTypeIcon = 'fa-compass';
    public headerStaffAvatars: AvatarItem[] = [
        { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
        { initials: 'SO', name: 'Sam Okafor', colorClass: 'c2' },
        { initials: 'PS', name: 'Priya Shah', colorClass: 'c3' },
    ];
    public headerOutsideAvatars: AvatarItem[] = [
        { initials: 'CM', name: 'Casey Miller', colorClass: 'c4' },
        { initials: 'BT', name: 'Bea Tanaka', colorClass: 'c5' },
        { initials: 'OH', name: 'Omar Hassan', colorClass: 'c6' },
        { initials: 'LF', name: 'Lisa Flores', colorClass: 'c7' },
    ];
    public headerTotalPeople = 9;
    public headerAudienceSummary = '3 Meridian · 6 Northwind';

    public breadcrumbs: BreadcrumbItem[] = [
        { label: 'Northwind' },
        { label: 'Discovery' },
    ];

    public tabs: TabItem[] = [
        { id: 'Overview', label: 'Overview', iconClass: 'fa-gauge-high' },
        { id: 'Library', label: 'Library', iconClass: 'fa-folder-open', count: 24 },
        { id: 'Work', label: 'Work', iconClass: 'fa-list-check', count: 10 },
        { id: 'Chat', label: 'Chat', iconClass: 'fa-comments', count: 3 },
        { id: 'People', label: 'People', iconClass: 'fa-user-group', count: 9 },
        { id: 'Settings', label: 'Settings', iconClass: 'fa-sliders' },
    ];

    // Navigation Rail data
    public inboxCount = 4;
    public taskCount = 10;
    public spaces: RailSpaceNode[] = [
        {
            id: 'northwind',
            name: 'Northwind',
            iconClass: 'fa-building',
            color: 'var(--mjc-type-rel, #6366f1)',
            isExpanded: true,
            hasChildren: true,
            level: 0,
        },
        {
            id: 'discovery',
            name: 'Discovery',
            iconClass: 'fa-compass',
            color: 'var(--mjc-type-eng, #0ea5e9)',
            level: 1,
            meta: '3 new',
        },
        {
            id: 'delivery',
            name: 'Delivery',
            iconClass: 'fa-truck-fast',
            color: 'var(--mjc-type-eng, #0ea5e9)',
            level: 1,
            isLocked: true,
        },
        {
            id: 'audit-committee',
            name: 'Audit Committee',
            iconClass: 'fa-landmark',
            color: 'var(--mjc-type-com, #d97706)',
            level: 0,
            meta: 'Vote open',
        },
        {
            id: 'spring-cohort',
            name: 'Spring Leadership Cohort',
            iconClass: 'fa-graduation-cap',
            color: 'var(--mjc-type-coh, #10b981)',
            level: 0,
            meta: '14 of 18 in',
        },
    ];

    // Overview state data
    public overviewNeedsYou: NeedsYouItemModel[] = [
        {
            id: 'ny-1',
            variant: 'blue',
            iconClass: 'fa-comments',
            title: 'Casey Morgan asked in Discovery · Room',
            subtitle: '“Can someone summarize where vendor scoring landed? Our CFO will ask.”',
            actionLabel: 'Reply',
        },
        {
            id: 'ny-2',
            variant: 'warn',
            isSpark: true,
            title: 'Review before sharing · Interview synthesis v3',
            subtitle: 'The Assistant found 2 people who could be identified in a file Sam wants to share.',
            actionLabel: 'Review',
        },
        {
            id: 'ny-3',
            variant: 'blue',
            iconClass: 'fa-landmark',
            title: 'Audit Committee meets Thu, Oct 2 at 4:00 PM',
            subtitle: 'The board pack is ready but not published. 7 members are waiting on it.',
            actionLabel: 'Publish pack',
        },
        {
            id: 'ny-4',
            variant: 'blue',
            iconClass: 'fa-user-check',
            title: 'Dana Whitfield invited Pat Rivera to Audit Committee',
            subtitle: 'Outside director · new outside members need staff approval',
            actionLabel: 'Approve',
        },
    ];

    public overviewSharedItems: ItemCardModel[] = [
        {
            id: 'sh-1',
            kind: 'doc',
            title: 'Discovery findings draft',
            meta: 'Shared by Ada · Sep 24',
            stamp: 'Casey, Lena opened',
            citationCount: 6,
        },
        {
            id: 'sh-2',
            kind: 'sheet',
            title: 'Vendor scoring model',
            meta: 'Shared by Sam · Sep 22',
            stamp: 'Bea, Omar opened',
            citationCount: 4,
        },
        {
            id: 'sh-3',
            kind: 'deck',
            title: 'Readout outline',
            meta: 'Shared by Ada · Sep 20',
            stamp: 'Casey opened',
        },
    ];

    public overviewTeamItems: ItemRowModel[] = [
        {
            id: 'tm-1',
            kind: 'doc',
            title: 'Interview synthesis v3',
            author: 'Sam Okafor',
            timestamp: '2h ago',
            flagCount: 2,
            statusLabel: 'In progress',
            canShare: true,
        },
        {
            id: 'tm-2',
            kind: 'doc',
            title: 'Plant manager interview notes',
            author: 'Ada Lovell',
            timestamp: 'Yesterday',
            canShare: true,
        },
        {
            id: 'tm-3',
            kind: 'sheet',
            title: 'Raw vendor quotes',
            author: 'Priya Patel',
            timestamp: 'Sep 21',
            canShare: true,
        },
    ];

    public overviewRoomMessages: RoomMiniMessage[] = [
        {
            id: 'msg-1',
            senderName: 'Casey Morgan',
            senderInitials: 'CM',
            senderColorClass: 'c4',
            isOutside: true,
            timestamp: '12m ago',
            text: 'Can someone summarize where vendor scoring landed? Our CFO will ask.',
        },
        {
            id: 'msg-2',
            senderName: 'Ada Lovell',
            senderInitials: 'AL',
            senderColorClass: 'c1',
            timestamp: '8m ago',
            text: 'Pulling that together now with Sam. We’ll post the excerpt here.',
        },
        {
            id: 'msg-3',
            senderName: 'Assistant',
            isAssistant: true,
            timestamp: '5m ago',
            text: 'Vendor scoring model shows Vendor B leading on reliability (4.8/5) and cost.',
        },
    ];

    public overviewSubSpaces: SubSpaceSummary[] = [
        {
            id: 'sp-field-notes',
            name: 'Field notes',
            type: 'eng',
            iconClass: 'fa-compass',
            color: 'var(--mjc-type-eng, #0ea5e9)',
            description: '6 Team items',
        },
    ];

    // Library state data
    public libraryTotalCount = 24;
    public libraryCollections: LibraryCollection[] = [
        { id: 'deliv', name: 'Deliverables', band: 'Shared', count: 5 },
        { id: 'maps', name: 'Process maps', band: 'Shared', count: 3 },
        { id: 'interviews', name: 'Interviews', band: 'Team', count: 9 },
        { id: 'scoring', name: 'Vendor scoring', band: 'Shared', count: 3 },
        { id: 'contracts', name: 'Contracts', band: 'Shared', count: 2 },
    ];

    public librarySmartViews: LibrarySmartView[] = [
        { id: 'from-northwind', name: 'From Northwind', iconClass: 'fa-circle-arrow-down', count: 4 },
        { id: 'flagged', name: 'Flagged', iconClass: 'fa-triangle-exclamation', count: 1 },
        { id: 'shared-this-week', name: 'Shared this week', iconClass: 'fa-clock', count: 2 },
    ];

    public libraryRows: LibraryRowModel[] = [
        {
            id: 'row-1',
            kind: 'pdf',
            name: 'Discovery readout — draft for review',
            folder: 'Deliverables',
            who: 'Ada Lovell',
            when: '10:42 AM',
            band: 'Shared',
            aiSeenCount: 4,
            openers: [{ initials: 'CM', colorClass: 'c4' }, { initials: 'LF', colorClass: 'c2' }],
        },
        {
            id: 'row-2',
            kind: 'sheet',
            name: 'Vendor evaluation matrix v2',
            folder: 'Vendor scoring',
            who: 'Sam Okafor',
            when: 'Yesterday',
            band: 'Shared',
            aiSeenCount: 6,
            openers: [{ initials: 'BT', colorClass: 'c5' }],
        },
        {
            id: 'row-3',
            kind: 'doc',
            name: 'Interview synthesis v3',
            folder: 'Interviews',
            who: 'Sam Okafor',
            when: '2h ago',
            band: 'Team',
            flagCount: 2,
            selected: true,
        },
        {
            id: 'row-4',
            kind: 'doc',
            name: 'Plant manager interview notes — Dayton',
            folder: 'Interviews',
            who: 'Ada Lovell',
            when: 'Sep 23',
            band: 'Team',
        },
        {
            id: 'row-5',
            kind: 'pdf',
            name: 'Statement of work — Discovery phase',
            folder: 'Contracts & SOW',
            who: 'Ada Lovell',
            when: 'Sep 2',
            band: 'Shared',
            openers: [{ initials: 'CM', colorClass: 'c4' }],
        },
        {
            id: 'row-6',
            kind: 'sheet',
            name: 'Plant equipment list & serials',
            folder: 'From Northwind',
            who: 'Bea Tanaka',
            when: 'Sep 16',
            band: 'Shared',
        },
        {
            id: 'row-7',
            kind: 'deck',
            name: 'Kickoff deck & governance model',
            folder: 'Deliverables',
            who: 'Ada Lovell',
            when: 'Sep 4',
            band: 'Shared',
            aiSeenCount: 2,
            openers: [{ initials: 'CM', colorClass: 'c4' }, { initials: 'OH', colorClass: 'c3' }],
        },
        {
            id: 'row-8',
            kind: 'img',
            name: 'Site visit photos — Dayton',
            folder: '24 photos',
            who: 'Priya Patel',
            when: 'Sep 18',
            band: 'Team',
        },
    ];

    // Preview drawer data
    public previewMeta = 'Word · 18 pages · version 3';
    public previewParagraphs: string[] = [
        'Across 18 interviews, scheduling came up more than any other theme. <mark>As the Dayton plant manager told us</mark>, the current tool “can’t see past Tuesday.”',
        'Finance reports a nine-day close on inventory reconciliation; <mark>Jim in Finance</mark> described the process as manual.',
    ];
    public previewBandLabel = 'Team only';
    public previewAudienceSub = 'Meridian staff';
    public previewStaffAvatars: AvatarItem[] = [
        { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
        { initials: 'SO', name: 'Sam Okafor', colorClass: 'c9' },
        { initials: 'PP', name: 'Priya Patel', colorClass: 'c3' },
    ];
    public previewFlagTitle = '2 people could be identified';
    public previewFlagDescription = 'Checked when Sam asked to share it. Review the highlighted phrases before Northwind sees them.';
    public previewRecentUses: RecentUseModel[] = [
        { id: 'ru-1', isSpark: true, text: 'Cited in <b>Meridian team</b> chat', timestamp: '2h' },
        { id: 'ru-2', avatar: { initials: 'AL', colorClass: 'c1' }, text: 'Ada opened it', timestamp: '1h' },
        { id: 'ru-3', avatar: { initials: 'SO', colorClass: 'c9' }, text: 'Sam uploaded version 3', timestamp: '2h' },
    ];

    // Share check dialog state
    public shareDialogTitle = 'Share with Northwind';
    public shareDialogItemName = 'Interview synthesis v3';
    public shareDialogKind: FileKind = 'doc';
    public shareNote = 'Synthesis from all 18 interviews — we’ll walk through it together on Thursday.';

    public shareRecipients: RecipientPersonModel[] = [
        {
            id: 'casey',
            name: 'Casey Morgan',
            role: 'VP Operations · Client admin',
            avatar: { initials: 'CM', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
        },
        {
            id: 'bea',
            name: 'Bea Tanaka',
            role: 'Operations analyst',
            avatar: { initials: 'BT', name: 'Bea Tanaka', colorClass: 'c5', isOutside: true },
        },
        {
            id: 'omar',
            name: 'Omar Haddad',
            role: 'Plant director, Dayton',
            avatar: { initials: 'OH', name: 'Omar Haddad', colorClass: 'c3', isOutside: true },
        },
        {
            id: 'lena',
            name: 'Lena Fischer',
            role: 'CFO · read-only',
            avatar: { initials: 'LF', name: 'Lena Fischer', colorClass: 'c2', isOutside: true },
        },
        {
            id: 'more',
            name: '2 more',
            role: 'through Northwind',
            avatar: { initials: '+2', name: '2 more', colorClass: 'c7', isOutside: true },
            isMore: true,
            moreCount: 2,
        },
    ];

    public shareFindings: FindingModel[] = [
        {
            id: 'f-1',
            quotation: '“…<mark>as the Dayton plant manager told us</mark>, the current tool can’t see past Tuesday.”',
            originalPhrase: 'as the Dayton plant manager told us',
            suggestedPhrase: 'as one plant leader told us',
            status: 'Flagged',
        },
        {
            id: 'f-2',
            quotation: '“Finance reports a nine-day close; <mark>Jim in Finance</mark> described the process as manual.”',
            originalPhrase: 'Jim in Finance',
            suggestedPhrase: 'a finance team member',
            status: 'Flagged',
        },
    ];

    public override ngOnInit(): void {
        super.ngOnInit();
        this.syncStateWithAgent();
        this.NotifyLoadComplete();
    }

    public override ngOnDestroy(): void {
        super.ngOnDestroy();
    }

    public async GetResourceDisplayName(_data?: ResourceData): Promise<string> {
        return this.spaceTitle || 'Spaces';
    }

    public async GetResourceIconClass(_data?: ResourceData): Promise<string> {
        return 'fa-solid fa-people-group';
    }

    /**
     * Reacts to query param updates from back/forward or external deep links.
     */
    protected override OnQueryParamsChanged(params: Record<string, string>, _source: 'popstate' | 'deeplink'): void {
        if (params['view']) {
            this.activeView = params['view'];
        }
        if (params['space']) {
            this.activeSpaceId = params['space'];
        }
        if (params['tab']) {
            const rawTab = params['tab'].toLowerCase();
            const tabMap: Record<string, string> = {
                overview: 'Overview',
                library: 'Library',
                work: 'Work',
                chat: 'Chat',
                people: 'People',
                settings: 'Settings',
            };
            if (tabMap[rawTab]) {
                this.activeTab = tabMap[rawTab];
            }
        }
        if (params['item']) {
            this.selectedItemId = params['item'];
            this.isDrawerOpen = true;
        }

        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onTabSelectRequested(tabId: string): void {
        this.activeTab = tabId;
        this.UpdateQueryParams({ tab: tabId.toLowerCase() });
        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onSpaceOpenRequested(spaceId: string): void {
        this.activeSpaceId = spaceId;
        const space = this.spaces.find((s) => s.id === spaceId);
        if (space) {
            this.spaceTitle = space.name;
        }
        this.activeTab = 'Overview';
        this.UpdateQueryParams({ space: spaceId, tab: 'overview' });
        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onNavSelectRequested(view: string): void {
        this.activeView = view;
        this.UpdateQueryParams({ view });
        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onOpenLibraryRequested(): void {
        this.onTabSelectRequested('Library');
    }

    public onOpenChatRequested(): void {
        this.onTabSelectRequested('Chat');
    }

    public onItemSelected(item: ItemCardModel | ItemRowModel): void {
        this.selectedItemId = item.id;
        this.isDrawerOpen = true;
        this.UpdateQueryParams({ item: item.id });
        this.RefreshView();
    }

    public onRowSelected(row: LibraryRowModel): void {
        this.selectedItemId = row.id;
        this.isDrawerOpen = true;
        this.UpdateQueryParams({ item: row.id });
        this.RefreshView();
    }

    public onCloseDrawerRequested(): void {
        this.isDrawerOpen = false;
        this.selectedItemId = null;
        this.UpdateQueryParams({ item: null });
        this.RefreshView();
    }

    public onShareRequested(item?: ItemCardModel | ItemRowModel | LibraryRowModel): void {
        if (item) {
            this.shareDialogItemName = 'name' in item ? item.name : item.title;
            this.shareDialogKind = item.kind;
        }
        this.isShareDialogOpen = true;
        this.RefreshView();
    }

    public onShareDialogCancel(): void {
        this.isShareDialogOpen = false;
        this.RefreshView();
    }

    public onApplyFix(finding: FindingModel): void {
        finding.status = 'Applied';
        this.RefreshView();
    }

    public onShareCompleted(_result: { applyFixes: boolean; note: string; notify: boolean }): void {
        this.isShareDialogOpen = false;
        // In Slice A preview, update row-3 to Shared
        const row3 = this.libraryRows.find((r) => r.id === 'row-3');
        if (row3) {
            row3.band = 'Shared';
            row3.flagCount = undefined;
        }
        this.RefreshView();
    }

    public onUploadClicked(): void {
        // Triggers upload workflow
    }

    private syncStateWithAgent(): void {
        this.navigationService?.SetAgentContext(this, {
            view: this.activeView,
            spaceId: this.activeSpaceId,
            spaceTitle: this.spaceTitle,
            tab: this.activeTab,
            selectedItemId: this.selectedItemId,
        });
    }
}
