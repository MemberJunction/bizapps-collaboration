import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClass } from '@memberjunction/global';
import { Metadata, RunView } from '@memberjunction/core';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { MJPageLayoutComponent, MJPageBodyComponent, MJButtonDirective, MJEmptyStateComponent } from '@memberjunction/ng-ui-components';
import type { ResourceData } from '@memberjunction/core-entities';
import { CollaborationClient } from '@mj-biz-apps/collaboration-entities';
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
        MJEmptyStateComponent,
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
            font-family: var(--mj-font-family, Inter, sans-serif);
            font-size: 14px;
        }
        .mjc-shell {
            display: grid;
            grid-template-columns: 252px 1fr;
            width: 100%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            position: relative;
            font-family: var(--mj-font-family, Inter, sans-serif);
            font-size: 14px;
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
                                        <button mjButton variant="secondary" size="md" (click)="onInviteClicked()">
                                            <i class="fa-solid fa-user-plus"></i>Invite
                                        </button>
                                        <button mjButton variant="primary" size="md" (click)="onNewClicked()">
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
                                        <mj-empty-state
                                            Icon="fa-solid fa-list-check"
                                            Title="Work & Tasks"
                                            [Message]="'Tasks for ' + spaceTitle + ' will display here via bizapps-tasks integration.'"
                                        />
                                    }
                                    @case ('Chat') {
                                        <mj-empty-state
                                            Icon="fa-solid fa-comments"
                                            Title="Room & Conversations"
                                            [Message]="'Space discussions and agent interactions for ' + spaceTitle + '.'"
                                        />
                                    }
                                    @case ('People') {
                                        <mj-empty-state
                                            Icon="fa-solid fa-user-group"
                                            Title="People & Access"
                                            Message="Team members, outside client participants, and permission levels."
                                        />
                                    }
                                    @case ('Settings') {
                                        <mj-empty-state
                                            Icon="fa-solid fa-sliders"
                                            Title="Space Settings"
                                            Message="Configuration, Assistant retrieval rules, and space lifecycle controls."
                                        />
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
    public spaceSubtitle = 'Supply-chain operating model diagnostic · Week 7 of 10 · Readout Oct 9';
    public headerTypeColor = '#0076b6';
    public headerTypeIcon = 'fa-solid fa-compass';
    public headerStaffAvatars: AvatarItem[] = [
        { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
        { initials: 'SO', name: 'Sam Okafor', colorClass: 'c9' },
        { initials: 'PS', name: 'Priya Shah', colorClass: 'c6' },
    ];
    public headerOutsideAvatars: AvatarItem[] = [
        { initials: 'CM', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
        { initials: 'BT', name: 'Bea Tanaka', colorClass: 'c5', isOutside: true },
        { initials: 'OH', name: 'Omar Haddad', colorClass: 'c3', isOutside: true },
        { initials: 'LF', name: 'Lena Fischer', colorClass: 'c2', isOutside: true },
    ];
    public headerTotalPeople = 9;
    public headerAudienceSummary = '3 Meridian · 6 Northwind';

    public breadcrumbs: BreadcrumbItem[] = [
        { label: 'Spaces' },
        { label: 'Northwind' },
        { label: 'Discovery' },
    ];

    public tabs: TabItem[] = [
        { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high' },
        { id: 'Library', label: 'Library', iconClass: 'fa-solid fa-folder-open', count: 24 },
        { id: 'Work', label: 'Work', iconClass: 'fa-solid fa-list-check', count: 10 },
        { id: 'Chat', label: 'Chat', iconClass: 'fa-solid fa-comments', count: 3 },
        { id: 'People', label: 'People', iconClass: 'fa-solid fa-user-group', count: 9 },
        { id: 'Settings', label: 'Settings', iconClass: 'fa-solid fa-sliders' },
    ];

    // Navigation Rail data
    public inboxCount = 4;
    public taskCount = 6;
    public spaces: RailSpaceNode[] = [
        { id: 'northwind', name: 'Northwind', color: '#092340', iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: true },
        { id: 'discovery', name: 'Discovery', color: '#0076b6', iconClass: 'fa-solid fa-compass', level: 1, hasChildren: true, isExpanded: true, unread: true },
        { id: 'fieldnotes', name: 'Field notes', color: '#0076b6', iconClass: 'fa-solid fa-clipboard', level: 2, hasChildren: false, isExpanded: false },
        { id: 'delivery', name: 'Delivery', color: '#0076b6', iconClass: 'fa-solid fa-truck-fast', level: 1, hasChildren: true, isExpanded: false, isLocked: true },
        { id: 'closed', name: 'Closed', color: '#0076b6', iconClass: 'fa-solid fa-box-archive', level: 1, hasChildren: true, isExpanded: false, meta: '2', isDim: true },
        { id: 'committee', name: 'Audit Committee', color: '#d97706', iconClass: 'fa-solid fa-landmark', level: 0, hasChildren: true, isExpanded: false, unread: true },
        { id: 'cohort', name: 'Spring Leadership Cohort', color: '#16a34a', iconClass: 'fa-solid fa-graduation-cap', level: 0, hasChildren: true, isExpanded: false },
        { id: 'pinecrest', name: 'Pinecrest Health', color: '#092340', iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: false },
        { id: 'studio', name: 'Studio', color: '#7c3aed', iconClass: 'fa-solid fa-shapes', level: 0, hasChildren: true, isExpanded: false },
    ];

    // Overview state data
    public overviewNeedsYou: NeedsYouItemModel[] = [
        {
            id: 'need-1',
            variant: 'blue',
            iconClass: 'fa-solid fa-comment-dots',
            title: 'Casey asked',
            subtitle: 'Room · 12m ago',
            actionLabel: 'Reply',
        },
        {
            id: 'need-2',
            variant: 'warn',
            isSpark: true,
            title: '2 names flagged',
            subtitle: 'Synthesis v3',
            actionLabel: 'Review',
        },
        {
            id: 'need-3',
            variant: 'red',
            iconClass: 'fa-solid fa-clock',
            title: 'Q2 extract is late',
            subtitle: 'Bea · due Sep 24',
            actionLabel: 'Nudge',
        },
    ];

    public overviewSharedItems: ItemCardModel[] = [
        {
            id: 'sh-1',
            kind: 'pdf',
            title: 'Discovery readout — draft for review',
            meta: 'PDF · v4 · 34 pages',
            stamp: 'Shared by Ada · Sep 24',
            openers: [
                { initials: 'CM', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
                { initials: 'LF', name: 'Lena Fischer', colorClass: 'c2', isOutside: true },
            ],
        },
        {
            id: 'sh-2',
            kind: 'pdf',
            title: 'Current-state process map',
            meta: 'PDF · v2 · 6 pages',
            stamp: 'Shared by Ada · Sep 18',
            citationCount: 6,
        },
        {
            id: 'sh-3',
            kind: 'img',
            title: 'Site visit photos — Dayton',
            meta: '24 photos',
            stamp: 'Added by Bea · Sep 16',
            isImage: true,
            openers: [
                { initials: 'OH', name: 'Omar Haddad', colorClass: 'c3', isOutside: true },
            ],
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
            canShare: true,
        },
        {
            id: 'tm-2',
            kind: 'xls',
            title: 'Vendor scoring model',
            author: 'Priya Shah',
            timestamp: 'yesterday',
            statusLabel: 'In progress',
            canShare: true,
        },
        {
            id: 'tm-3',
            kind: 'ppt',
            title: 'Readout storyline',
            author: 'Ada Lovell',
            timestamp: 'Sep 23',
            canShare: true,
        },
    ];

    public overviewRoomMessages: RoomMiniMessage[] = [
        {
            id: 'rm-1',
            senderName: 'Casey Morgan',
            senderInitials: 'CM',
            senderColorClass: 'c4',
            isOutside: true,
            timestamp: '9:41',
            text: 'Before Thursday — can someone summarize where vendor scoring landed?',
        },
        {
            id: 'rm-2',
            senderName: 'Ada Lovell',
            senderInitials: 'AL',
            senderColorClass: 'c1',
            isOutside: false,
            timestamp: '9:44',
            hasMention: true,
            mentionText: '@Assistant',
            text: 'can you pull that together from what we’ve shared?',
        },
        {
            id: 'rm-3',
            senderName: 'Assistant',
            isAssistant: true,
            timestamp: '9:44',
            text: 'Three vendors remain after the second screen: Kestrel, Lumen WMS and Haulbridge…',
        },
    ];

    public overviewSubSpaces: SubSpaceSummary[] = [
        {
            id: 'sub-1',
            name: 'Field notes',
            type: 'eng',
            iconClass: 'fa-solid fa-clipboard',
            description: 'Same people as Discovery · 6 Team items',
        },
    ];

    // Library state data
    public libraryTotalCount = 24;
    public libraryCollections: LibraryCollection[] = [
        { id: 'deliv', name: 'Deliverables', band: 'Shared', count: 5 },
        { id: 'maps', name: 'Process maps', band: 'Shared', count: 3 },
        { id: 'interviews', name: 'Interviews', band: 'Team', count: 9 },
        { id: 'vendor', name: 'Vendor scoring', band: 'Team', count: 3 },
        { id: 'contracts', name: 'Contracts', band: 'Team', count: 2 },
    ];

    public librarySmartViews: LibrarySmartView[] = [
        { id: 'northwind', name: 'From Northwind', iconClass: 'fa-solid fa-inbox', count: 4 },
        { id: 'flagged', name: 'Flagged', iconClass: 'fa-solid fa-triangle-exclamation', count: 1 },
        { id: 'shared-week', name: 'Shared this week', iconClass: 'fa-regular fa-clock', count: 2 },
    ];

    public libraryRows: LibraryRowModel[] = [
        {
            id: 'row-1',
            kind: 'pdf',
            name: 'Discovery readout — draft for review',
            folder: 'Deliverables',
            band: 'Shared',
            when: 'Sep 24',
            who: 'Ada Lovell',
            openers: [
                { initials: 'CM', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
                { initials: 'LF', name: 'Lena Fischer', colorClass: 'c2', isOutside: true },
            ],
            aiSeenCount: 4,
        },
        {
            id: 'row-2',
            kind: 'pdf',
            name: 'Current-state process map',
            folder: 'Process maps',
            band: 'Shared',
            when: 'Sep 18',
            who: 'Ada Lovell',
            openers: [
                { initials: 'CM', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
                { initials: 'BT', name: 'Bea Tanaka', colorClass: 'c5', isOutside: true },
                { initials: 'OH', name: 'Omar Haddad', colorClass: 'c3', isOutside: true },
            ],
            aiSeenCount: 6,
        },
        {
            id: 'row-3',
            kind: 'doc',
            name: 'Interview synthesis v3',
            folder: 'Interviews',
            band: 'Team',
            flagCount: 2,
            when: '2h ago',
            who: 'Sam Okafor',
            openers: [
                { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
            ],
            aiSeenCount: 2,
            selected: true,
        },
        {
            id: 'row-4',
            kind: 'xls',
            name: 'Vendor scoring model',
            folder: 'Vendor scoring',
            band: 'Team',
            when: 'Yesterday',
            who: 'Priya Shah',
            openers: [
                { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
                { initials: 'SO', name: 'Sam Okafor', colorClass: 'c9' },
            ],
        },
        {
            id: 'row-5',
            kind: 'xls',
            name: 'Q2 inventory extract',
            folder: 'From Northwind',
            band: 'Shared',
            when: 'Sep 22',
            who: 'Bea Tanaka',
            openers: [
                { initials: 'PS', name: 'Priya Shah', colorClass: 'c6' },
            ],
            aiSeenCount: 1,
        },
        {
            id: 'row-6',
            kind: 'img',
            name: 'Site visit photos — Dayton',
            folder: '24 photos',
            band: 'Shared',
            when: 'Sep 16',
            who: 'Bea Tanaka',
            openers: [
                { initials: 'OH', name: 'Omar Haddad', colorClass: 'c3', isOutside: true },
                { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
            ],
        },
        {
            id: 'row-7',
            kind: 'doc',
            name: 'Interview notes — Dayton plant',
            folder: 'Interviews',
            band: 'Team',
            when: 'Sep 12',
            who: 'Sam Okafor',
            openers: [
                { initials: 'PS', name: 'Priya Shah', colorClass: 'c6' },
            ],
            aiSeenCount: 3,
        },
        {
            id: 'row-8',
            kind: 'pdf',
            name: 'Statement of work — Discovery',
            folder: 'Contracts & SOW',
            band: 'Team',
            when: 'Aug 1',
            who: 'Ada Lovell',
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
        { initials: 'PS', name: 'Priya Shah', colorClass: 'c6' },
    ];
    public previewFlagTitle = '2 people could be identified';
    public previewFlagDescription = 'Checked when Sam asked to share it. Review the highlighted phrases before Northwind sees them.';
    public previewRecentUses: RecentUseModel[] = [
        { id: 'use-1', isSpark: true, text: 'Cited in <b>Meridian team</b> chat', timestamp: '2h' },
        { id: 'use-2', avatar: { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' }, text: 'Ada opened it', timestamp: '1h' },
        { id: 'use-3', avatar: { initials: 'SO', name: 'Sam Okafor', colorClass: 'c9' }, text: 'Sam uploaded version 3', timestamp: '2h' },
    ];

    // Share check dialog state
    public shareDialogTitle = 'Share with Northwind';
    public shareDialogItemName = 'Interview synthesis v3';
    public shareDialogKind: FileKind = 'doc';
    public shareNote = 'Synthesis from all 18 interviews — we’ll walk through it together on Thursday.';

    public shareRecipients: RecipientPersonModel[] = [
        {
            id: 'rcp-1',
            name: 'Casey Morgan',
            role: 'VP Operations · Client admin',
            avatar: { initials: 'CM', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
        },
        {
            id: 'rcp-2',
            name: 'Bea Tanaka',
            role: 'Operations analyst',
            avatar: { initials: 'BT', name: 'Bea Tanaka', colorClass: 'c5', isOutside: true },
        },
        {
            id: 'rcp-3',
            name: 'Omar Haddad',
            role: 'Plant director, Dayton',
            avatar: { initials: 'OH', name: 'Omar Haddad', colorClass: 'c3', isOutside: true },
        },
        {
            id: 'rcp-4',
            name: 'Lena Fischer',
            role: 'CFO · read-only',
            avatar: { initials: 'LF', name: 'Lena Fischer', colorClass: 'c2', isOutside: true },
        },
        {
            id: 'rcp-more',
            name: '2 more',
            role: 'through Northwind',
            avatar: { initials: '+2', name: '2 more', colorClass: 'c7', isOutside: true },
            isMore: true,
            moreCount: 2,
            moreSubtitle: 'through Northwind',
        },
    ];

    public shareFindings: FindingModel[] = [
        {
            id: 'fnd-1',
            quotation: '“…<mark>as the Dayton plant manager told us</mark>, the current tool can’t see past Tuesday.”',
            originalPhrase: 'as the Dayton plant manager told us',
            suggestedPhrase: 'as one plant leader told us',
            status: 'Flagged',
        },
        {
            id: 'fnd-2',
            quotation: '“Finance reports a nine-day close; <mark>Jim in Finance</mark> described the process as manual.”',
            originalPhrase: 'Jim in Finance',
            suggestedPhrase: 'a finance team member',
            status: 'Flagged',
        },
    ];

    private client: CollaborationClient | null = null;

    protected async loadRealData(): Promise<void> {
        try {
            if (CollaborationClient.isAvailable()) {
                this.client = new CollaborationClient();
            }
            const rv = new RunView();
            const spacesRes = await rv.RunView<{ ID: string; Name: string; Description: string; Status: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                ResultType: 'simple',
                MaxRows: 50,
            });
            if (spacesRes?.Success && spacesRes.Results && spacesRes.Results.length > 0) {
                this.hasAccess = true;
            }
        } catch {
            // Graceful fallback to canonical story representation
        }
    }

    public onInviteClicked(): void {
        // Invite member dialog / flow
    }

    public onNewClicked(): void {
        // Create sub-space / resource flow
    }

    public override ngOnInit(): void {
        super.ngOnInit();
        this.syncStateWithAgent();
        void this.loadRealData();
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
