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
                                            [FirmName]="firmName"
                                            [ClientOrgName]="clientOrgName"
                                            [AudienceCount]="headerTotalPeople"
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
                                            Message="This space’s tasks will show here."
                                        />
                                    }
                                    @case ('Chat') {
                                        <mj-empty-state
                                            Icon="fa-solid fa-comments"
                                            Title="Room & Conversations"
                                            Message="This space’s discussions and messages will show here."
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
                                [ClientOrgName]="clientOrgName"
                                [RecipientCount]="shareRecipientCount"
                                [AudienceHeader]="shareAudienceHeader"
                                [AudienceStaffSub]="shareAudienceStaffSub"
                                [Recipients]="shareRecipients"
                                [ReviewHeader]="shareReviewHeader"
                                [ReviewSub]="shareReviewSub"
                                [Findings]="shareFindings"
                                [Note]="shareNote"
                                [NotifyRecipients]="true"
                                [AuthorName]="shareAuthorName"
                                [Timestamp]="shareTimestamp"
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
    public hasAccess = false;
    public seats: { spaceName: string; status: string }[] = [];

    // Query parameters state
    public activeView = 'space';
    public activeSpaceId = '';
    public activeTab = 'Overview';
    public selectedItemId: string | null = null;
    public isDrawerOpen = false;
    public isShareDialogOpen = false;

    // Header metadata
    public spaceTitle = '';
    public spaceTypeName = '';
    public spaceStatus = '';
    public spaceSubtitle = '';
    public headerTypeColor = '#0076b6';
    public headerTypeIcon = 'fa-solid fa-compass';
    public headerStaffAvatars: AvatarItem[] = [];
    public headerOutsideAvatars: AvatarItem[] = [];
    public headerTotalPeople = 0;
    public headerAudienceSummary = '';

    public firmName = '';
    public clientOrgName = '';

    public breadcrumbs: BreadcrumbItem[] = [];

    public tabs: TabItem[] = [
        { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high' },
        { id: 'Library', label: 'Library', iconClass: 'fa-solid fa-folder-open' },
        { id: 'Work', label: 'Work', iconClass: 'fa-solid fa-list-check' },
        { id: 'Chat', label: 'Chat', iconClass: 'fa-solid fa-comments' },
        { id: 'People', label: 'People', iconClass: 'fa-solid fa-user-group' },
        { id: 'Settings', label: 'Settings', iconClass: 'fa-solid fa-sliders' },
    ];

    // Navigation Rail data
    public inboxCount = 0;
    public taskCount = 0;
    public spaces: RailSpaceNode[] = [];

    // Overview state data
    public overviewNeedsYou: NeedsYouItemModel[] = [];
    public overviewSharedItems: ItemCardModel[] = [];
    public overviewTeamItems: ItemRowModel[] = [];
    public overviewRoomMessages: RoomMiniMessage[] = [];
    public overviewSubSpaces: SubSpaceSummary[] = [];

    // Library state data
    public libraryTotalCount = 0;
    public libraryCollections: LibraryCollection[] = [];
    public librarySmartViews: LibrarySmartView[] = [];
    public libraryRows: LibraryRowModel[] = [];

    // Preview drawer data
    public previewMeta = '';
    public previewParagraphs: string[] = [];
    public previewBandLabel = '';
    public previewAudienceSub = '';
    public previewStaffAvatars: AvatarItem[] = [];
    public previewFlagTitle = '';
    public previewFlagDescription = '';
    public previewRecentUses: RecentUseModel[] = [];

    // Share check dialog state
    public shareDialogTitle = '';
    public shareDialogItemName = '';
    public shareDialogKind: FileKind = 'doc';
    public shareRecipientCount = 0;
    public shareAudienceHeader = '';
    public shareAudienceStaffSub = '';
    public shareReviewHeader = '';
    public shareReviewSub = '';
    public shareAuthorName = '';
    public shareTimestamp = '';
    public shareNote = '';
    public shareRecipients: RecipientPersonModel[] = [];
    public shareFindings: FindingModel[] = [];

    private client: CollaborationClient | null = null;

    protected async loadRealData(): Promise<void> {
        try {
            if (CollaborationClient.isAvailable()) {
                this.client = new CollaborationClient();
            }
            const rv = new RunView();
            const spacesRes = await rv.RunView<{ ID: string; Name: string; Description?: string; Status?: string; ParentID?: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                ResultType: 'simple',
                MaxRows: 50,
            });
            if (spacesRes?.Success && spacesRes.Results && spacesRes.Results.length > 0) {
                this.hasAccess = true;
                this.spaces = spacesRes.Results.map((s) => ({
                    id: s.ID,
                    name: s.Name,
                    color: '#0076b6',
                    iconClass: 'fa-solid fa-compass',
                    level: s.ParentID ? 1 : 0,
                    hasChildren: false,
                    isExpanded: true,
                }));
                const first = spacesRes.Results[0];
                this.activeSpaceId = first.ID;
                this.spaceTitle = first.Name;
                this.spaceSubtitle = first.Description || '';
                this.spaceStatus = first.Status || 'Active';
                this.breadcrumbs = [{ label: 'Spaces' }, { label: first.Name }];
            } else {
                this.hasAccess = false;
            }
        } catch {
            this.hasAccess = false;
        }
        this.RefreshView();
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
        if (this.selectedItemId) {
            const item = this.libraryRows.find((r) => r.id === this.selectedItemId);
            if (item) {
                item.band = 'Shared';
                item.flagCount = undefined;
            }
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
