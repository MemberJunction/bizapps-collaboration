import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegisterClass, UUIDsEqual } from '@memberjunction/global';
import { CompositeKey, LogError, RunView, type UserInfo } from '@memberjunction/core';
import { BaseResourceComponent, SharedService } from '@memberjunction/ng-shared';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { MJPageLayoutComponent, MJPageBodyComponent, MJButtonDirective, MJViewToggleComponent, type ViewToggleOption } from '@memberjunction/ng-ui-components';
import type { ResourceData, MJUserEntity } from '@memberjunction/core-entities';

import {
    CollaborationClient,
    type GraphQLExecutor,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceItemEntity,
} from '@mj-biz-apps/collaboration-entities';
import { TaskEntity } from '@mj-biz-apps/tasks-entities';
import { CollaborationEngineBase } from '@mj-biz-apps/collaboration-engine-base';
import {
    TaskKanbanComponent,
    TaskGanttComponent,
    MyTasksComponent,
    ApprovalInboxComponent,
    type BeforeKanbanStatusChangeEvent,
} from '@mj-biz-apps/tasks-ng';
import type {
    AgentReplyMode,
    AgentTurnHandler,
    AgentTurnRequest,
    AgentTurnResult,
} from '@memberjunction/ng-conversations';
import {
    CollabSpaceRailComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceTabsComponent,
    CollabSpaceOverviewComponent,
    CollabSpaceLibraryComponent,
    CollabShareCheckDialogComponent,
    CollabAudiencePillComponent,
    CollabUploadDialogComponent,
    CollabSpaceWorkComponent,
    CollabSpaceChatComponent,
    CollabSpacePeopleComponent,
    CollabSpaceSettingsComponent,
    CollabNewConversationDialogComponent,
    type NewConversationSubmitPayload,
    type TabItem,
    type RailSpaceNode,
    type BreadcrumbItem,
    type NeedsYouItemModel,
    type ItemCardModel,
    type ChatMentionPerson,
    type ItemRowModel,
    type LibraryRowModel,
    type RoomMiniMessage,
    type SubSpaceSummary,
    type LibraryCollection,
    type LibrarySmartView,
    type FindingModel,
    type RecipientPersonModel,
    type FileKind,
    type SpaceBand,
    type RecentUseModel,
    type AvatarItem,
    type CollabUploadSubmitPayload,
    type TaskItemModel,
    type SpaceMemberModel,
    type SpaceSettingsModel,
    type SpaceConversationItem,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { CollaborationNoAccessComponent } from './no-access.component';

interface RawSpaceRecord {
    ID: mjBizAppsCollaborationSpaceEntity['ID'];
    Name: mjBizAppsCollaborationSpaceEntity['Name'];
    Description?: mjBizAppsCollaborationSpaceEntity['Description'];
    ParentID?: mjBizAppsCollaborationSpaceEntity['ParentID'];
    IconClass?: mjBizAppsCollaborationSpaceEntity['IconClass'];
    Color?: mjBizAppsCollaborationSpaceEntity['Color'];
    BackgroundImageURL?: mjBizAppsCollaborationSpaceEntity['BackgroundImageURL'];
    SpaceType?: string;
    SpaceTypeID: mjBizAppsCollaborationSpaceEntity['SpaceTypeID'];
    InheritsMembership?: mjBizAppsCollaborationSpaceEntity['InheritsMembership'];
    AgentRetrieval?: mjBizAppsCollaborationSpaceEntity['AgentRetrieval'];
    Retention?: mjBizAppsCollaborationSpaceEntity['Retention'];
    ClosedAt?: mjBizAppsCollaborationSpaceEntity['ClosedAt'];
    OwnerID?: mjBizAppsCollaborationSpaceEntity['OwnerID'];
}

interface RawSpaceTypeRecord {
    ID: string;
    Name: string;
    Code?: string;
    IconClass?: string | null;
    Color?: string | null;
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function isValidUuid(id?: string | null): boolean {
    return !!id && UUID_REGEX.test(id.trim());
}

export type WorkViewMode = 'list' | 'kanban' | 'gantt';

/**
 * Collaboration section resource host for MemberJunction Explorer (L3).
 * Owns NavigationService, deep-linking query parameters, and tab/record routing.
 */
@Component({
    selector: 'mjc-collaboration-section',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SharedGenericModule,
        MJPageLayoutComponent,
        MJPageBodyComponent,
        MJButtonDirective,
        MJViewToggleComponent,
        CollabSpaceRailComponent,
        CollabSpaceHeaderComponent,
        CollabSpaceTabsComponent,
        CollabSpaceOverviewComponent,
        CollabSpaceLibraryComponent,
        CollabShareCheckDialogComponent,
        CollabAudiencePillComponent,
        CollabUploadDialogComponent,
        CollabSpaceWorkComponent,
        CollabSpaceChatComponent,
        CollabSpacePeopleComponent,
        CollabSpaceSettingsComponent,
        CollabNewConversationDialogComponent,
        CollaborationNoAccessComponent,
        TaskKanbanComponent,
        TaskGanttComponent,
        MyTasksComponent,
        ApprovalInboxComponent,
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
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            position: relative;
            font-family: var(--mj-font-family, Inter, sans-serif);
            font-size: 14px;
        }
        .main {
            flex: 1 1 0;
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

        .collab-home-view {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow-y: auto;
            background: var(--mj-bg-surface-sunken, #f8fafc);
            padding: 24px;
            box-sizing: border-box;
        }
        .home-header {
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .home-greeting {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .home-hero-icon {
            width: 52px;
            height: 52px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
        }
        .home-title {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: var(--mj-text-primary, #0f172a);
        }
        .home-subtitle {
            margin: 4px 0 0;
            font-size: 13.5px;
            color: var(--mj-text-secondary, #64748b);
        }
        .home-quick-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
        }
        .stat-pill {
            background: var(--mj-bg-surface-sunken, #f8fafc);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: 8px;
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .stat-pill:hover {
            background: var(--mj-bg-surface-hover, #f1f5f9);
            border-color: var(--mj-brand-primary, #0284c7);
            transform: translateY(-1px);
        }
        .stat-val {
            font-size: 20px;
            font-weight: 700;
            color: var(--mj-brand-primary, #0284c7);
        }
        .stat-lbl {
            font-size: 12px;
            color: var(--mj-text-secondary, #64748b);
            font-weight: 500;
        }
        .spaces-directory-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
        }
        .space-directory-card {
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: 10px;
            padding: 18px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .space-directory-card:hover {
            border-color: var(--mj-brand-primary, #0284c7);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
            transform: translateY(-2px);
        }
        .card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .space-icon-box {
            width: 38px;
            height: 38px;
            border-radius: 8px;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }
        .space-type-badge {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 999px;
            background: var(--mj-bg-surface-sunken, #f1f5f9);
            color: var(--mj-text-secondary, #475569);
        }
        .space-name {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: var(--mj-text-primary, #0f172a);
        }
        .space-desc {
            margin: 0;
            font-size: 12.5px;
            color: var(--mj-text-secondary, #64748b);
            line-height: 1.4;
            flex: 1;
        }
        .space-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            border-top: 1px solid var(--mj-border-default, #f1f5f9);
            padding-top: 8px;
        }
        .open-link {
            font-size: 12px;
            font-weight: 600;
            color: var(--mj-brand-primary, #0284c7);
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .section-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
        }
        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 16px;
            font-weight: 700;
            color: var(--mj-text-primary, #0f172a);
        }
        .section-badge {
            font-size: 12px;
            color: var(--mj-text-muted, #64748b);
        }
        .collab-inbox-view, .collab-tasks-view, .collab-files-view {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow-y: auto;
            padding: 20px 24px;
            box-sizing: border-box;
            background: var(--mj-bg-surface-sunken, #f8fafc);
            gap: 16px;
        }
        .section-view-header {
            display: flex;
            align-items: center;
            gap: 14px;
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: 10px;
            padding: 16px 20px;
        }
        .header-icon-box {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: #ffffff;
            flex-shrink: 0;
        }
        .header-icon-box.inbox {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
        .header-icon-box.tasks {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        .header-icon-box.files {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        }
        .view-title {
            margin: 0;
            font-size: 19px;
            font-weight: 700;
            color: var(--mj-text-primary, #0f172a);
        }
        .view-subtitle {
            margin: 3px 0 0;
            font-size: 13px;
            color: var(--mj-text-secondary, #64748b);
        }
        .inbox-content, .tasks-content, .files-content {
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: 10px;
            padding: 16px;
            min-height: 480px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            flex: 1;
        }
        .work-tab-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
            flex: 1;
        }
        .work-view-toolbar {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding: 8px 16px;
            border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
            background: var(--mj-bg-surface, #ffffff);
        }
        .work-view-body {
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
            display: flex;
            flex-direction: column;
        }
        .work-kanban-pane, .work-gantt-pane {
            padding: 16px;
            height: 100%;
            box-sizing: border-box;
            flex: 1;
        }

        .home-search-bar {
            margin-bottom: 16px;
            position: relative;
        }
        .home-search-input {
            width: 100%;
            padding: 10px 14px 10px 38px;
            border-radius: 8px;
            border: 1px solid var(--mj-border-default, #e2e8f0);
            background: var(--mj-bg-surface, #ffffff);
            font-size: 13.5px;
            color: var(--mj-text-primary, #0f172a);
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.15s ease;
        }
        .home-search-input:focus {
            border-color: var(--mj-brand-primary, #0076b6);
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--mj-brand-primary, #0076b6) 20%, transparent);
        }
        .home-search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--mj-text-muted, #94a3b8);
            font-size: 14px;
        }

        .collab-loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 400px;
        }
        .collab-error-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 400px;
            gap: 12px;
            color: var(--mj-text-secondary, #64748b);
            padding: 40px;
            text-align: center;
        }
        .collab-error-state i {
            font-size: 32px;
            color: var(--mj-status-warning, #f59e0b);
        }
        .collab-error-state h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--mj-text-primary, #0f172a);
        }
        .collab-error-state p {
            margin: 0;
            font-size: 13.5px;
            max-width: 480px;
        }
        .no-person-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px 24px;
            text-align: center;
            color: var(--mj-text-muted, #64748b);
            gap: 8px;
        }
        .no-person-state i {
            font-size: 28px;
            color: var(--mj-text-muted, #94a3b8);
            margin-bottom: 8px;
        }
        .no-person-state h3 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: var(--mj-text-primary, #0f172a);
        }
        .no-person-state p {
            margin: 0;
            font-size: 13px;
            max-width: 360px;
        }
    `],
    template: `
        <mj-page-layout>
            <mj-page-body [Padding]="false">
                @if (isLoading) {
                    <div class="collab-loading-state">
                        <mj-loading text="Loading workspace..."></mj-loading>
                    </div>
                } @else if (loadErrorMessage) {
                    <div class="collab-error-state">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <h3>Error Loading Workspace</h3>
                        <p>{{ loadErrorMessage }}</p>
                    </div>
                } @else if (!hasAccess) {
                    <mjc-no-access [Seats]="seats" />
                } @else {
                    <div class="mjc-shell">
                        <mjc-space-rail
                            [Mode]="activeView === 'home' ? 'home' : 'space'"
                            [ActiveNav]="activeView"
                            [Spaces]="spaces"
                            [ActiveSpaceId]="activeSpaceId"
                            [SpaceTitle]="spaceTitle"
                            [SpaceIcon]="headerTypeIcon"
                            [SpaceBand]="spaceAudienceBand"
                            [ActiveTab]="activeTab"
                            [Conversations]="spaceConversations"
                            [ActiveConversationId]="activeConversationId"
                            [LibraryCount]="libraryTotalCount"
                            [TaskCount]="taskCount"
                            [MemberCount]="headerTotalPeople"
                            [InboxCount]="inboxCount"
                            (SpaceOpenRequested)="onSpaceOpenRequested($event)"
                            (SpaceToggleRequested)="onSpaceToggleRequested($event)"
                            (NavSelectRequested)="onNavSelectRequested($event)"
                            (TabSelectRequested)="onTabSelectRequested($event)"
                            (ConversationSelectRequested)="onSpaceConversationSelected($event)"
                            (NewConversationRequested)="openNewConversationDialog()"
                            (BackToSpacesRequested)="onBackToSpacesRequested()"
                        />

                        <main class="main">
                            @switch (activeView) {
                                @case ('home') {
                                    <div class="collab-home-view">
                                        <header class="home-header">
                                            <div class="home-greeting">
                                                <div class="home-hero-icon">
                                                    <i class="fa-solid fa-shapes"></i>
                                                </div>
                                                <div class="home-hero-text">
                                                    <h1 class="home-title">Welcome to Collaboration</h1>
                                                    <p class="home-subtitle">Unified spaces, documents, tasks, and communications across your teams and collaborators.</p>
                                                </div>
                                            </div>
                                            <div class="home-quick-stats">
                                                <div class="stat-pill" (click)="activeTab = 'Overview'; activeView = 'space'">
                                                    <span class="stat-val">{{ activeSpacesCount }}</span>
                                                    <span class="stat-lbl">Active Spaces</span>
                                                </div>
                                                <div class="stat-pill" (click)="onNavSelectRequested('tasks')">
                                                    <span class="stat-val">{{ taskCount }}</span>
                                                    <span class="stat-lbl">My Tasks</span>
                                                </div>
                                                <div class="stat-pill" (click)="onNavSelectRequested('inbox')">
                                                    <span class="stat-val">{{ inboxCount }}</span>
                                                    <span class="stat-lbl">Pending Approvals</span>
                                                </div>
                                                <div class="stat-pill" (click)="onNavSelectRequested('files')">
                                                    <span class="stat-val">{{ librarySharedCount }}</span>
                                                    <span class="stat-lbl">Shared Files</span>
                                                </div>
                                            </div>
                                        </header>

                                        <div class="home-body">
                                            <section class="home-section">
                                                <div class="section-title-row">
                                                    <div class="section-title">
                                                        <i class="fa-solid fa-layer-group"></i>
                                                        <span>Spaces Directory &amp; Explorer</span>
                                                    </div>
                                                    <span class="section-badge">{{ filteredSpaces.length }} spaces</span>
                                                </div>
                                                <div class="home-search-bar">
                                                    <i class="fa-solid fa-magnifying-glass home-search-icon"></i>
                                                    <input
                                                        type="text"
                                                        class="home-search-input"
                                                        [(ngModel)]="spaceSearchQuery"
                                                        placeholder="Search spaces by name, description, or type..."
                                                    />
                                                </div>
                                                <div class="spaces-directory-grid">
                                                    @for (space of filteredSpaces; track space.id) {
                                                        <div class="space-directory-card" (click)="onSpaceOpenRequested(space.id)">
                                                            <div class="card-top">
                                                                <div class="space-icon-box" [style.background-color]="space.color">
                                                                    <i [class]="space.iconClass"></i>
                                                                </div>
                                                                <div class="space-type-badge">
                                                                    @if (space.parentName) {
                                                                        <span>{{ space.parentName }} / </span>
                                                                    }
                                                                    {{ space.type }}
                                                                </div>
                                                            </div>
                                                            <h3 class="space-name">{{ space.name }}</h3>
                                                            @if (space.description) {
                                                                <p class="space-desc">{{ space.description }}</p>
                                                            }
                                                            <div class="space-footer">
                                                                <span class="open-link">
                                                                    <span>Open Space</span>
                                                                    <i class="fa-solid fa-arrow-right"></i>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    }
                                                </div>
                                            </section>
                                        </div>
                                    </div>
                                }

                                @case ('inbox') {
                                    <div class="collab-inbox-view">
                                        <header class="section-view-header">
                                            <div class="header-icon-box inbox">
                                                <i class="fa-solid fa-inbox"></i>
                                            </div>
                                            <div>
                                                <h1 class="view-title">Approval Inbox</h1>
                                                <p class="view-subtitle">Review and sign off on tasks and deliverables awaiting your approval.</p>
                                            </div>
                                        </header>
                                        <div class="inbox-content">
                                            @if (currentPersonId) {
                                                <bizapps-approval-inbox
                                                    [ApproverPersonID]="currentPersonId"
                                                />
                                            } @else {
                                                <div class="no-person-state">
                                                    <i class="fa-solid fa-user-slash"></i>
                                                    <h3>No Person Profile Linked</h3>
                                                    <p>Your user account is not linked to a Person profile in the system. Approval requests cannot be queried.</p>
                                                </div>
                                            }
                                        </div>
                                    </div>
                                }

                                @case ('tasks') {
                                    <div class="collab-tasks-view">
                                        <header class="section-view-header">
                                            <div class="header-icon-box tasks">
                                                <i class="fa-solid fa-list-check"></i>
                                            </div>
                                            <div>
                                                <h1 class="view-title">My Tasks &amp; Deliverables</h1>
                                                <p class="view-subtitle">Tasks assigned to you across all collaboration spaces and projects.</p>
                                            </div>
                                        </header>
                                        <div class="tasks-content">
                                            @if (currentPersonId) {
                                                <bizapps-my-tasks
                                                    [PersonID]="currentPersonId"
                                                    [ShowCreateButton]="true"
                                                    (TaskDoubleClicked)="onTaskDoubleClicked($event.ID)"
                                                />
                                            } @else {
                                                <div class="no-person-state">
                                                    <i class="fa-solid fa-user-slash"></i>
                                                    <h3>No Person Profile Linked</h3>
                                                    <p>Your user account is not linked to a Person profile in the system. Assigned tasks cannot be queried.</p>
                                                </div>
                                            }
                                        </div>
                                    </div>
                                }

                                @case ('files') {
                                    <div class="collab-files-view">
                                        <header class="section-view-header">
                                            <div class="header-icon-box files">
                                                <i class="fa-solid fa-folder-open"></i>
                                            </div>
                                            <div>
                                                <h1 class="view-title">Recent Files &amp; Documents</h1>
                                                <p class="view-subtitle">Access files, working papers, and reports shared across all spaces.</p>
                                            </div>
                                        </header>
                                        <div class="files-content">
                                            <mjc-space-library
                                                [TotalCount]="librarySharedCount"
                                                [SharedCount]="librarySharedCount"
                                                [TeamCount]="0"
                                                [Collections]="libraryCollections"
                                                [SmartViews]="librarySmartViews"
                                                [Rows]="homeSharedRows"
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
                                                (OpenFileRequested)="onOpenFileRequested($event)"
                                            />
                                        </div>
                                    </div>
                                }

                                @default {
                                    <mjc-space-header
                                        [Breadcrumbs]="breadcrumbs"
                                        [TypeColor]="headerTypeColor"
                                        [TypeIconClass]="headerTypeIcon"
                                        [Title]="spaceTitle"
                                        [TypeName]="spaceTypeName"
                                        [Status]="spaceStatus"
                                        [Subtitle]="spaceSubtitle"
                                        [BackgroundImageUrl]="headerBackgroundImageUrl"
                                        (BreadcrumbSelectRequested)="onBreadcrumbSelected($event)"
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
                                                    [TeamTotalCount]="libraryTeamCount"
                                                    [RoomMessages]="overviewRoomMessages"
                                                    [SubSpaces]="overviewSubSpaces"
                                                    (OpenLibraryRequested)="onOpenLibraryRequested()"
                                                    (OpenChatRequested)="onOpenChatRequested()"
                                                    (ItemSelectRequested)="onItemSelected($event)"
                                                    (ShareRequested)="onShareRequested($event)"
                                                    (SubSpaceSelectRequested)="onSpaceOpenRequested($event.id)"
                                                    (AskRequested)="onOverviewAskRequested($event)"
                                                />
                                            }
                                            @case ('Library') {
                                                <mjc-space-library
                                                    [TotalCount]="libraryTotalCount"
                                                    [SharedCount]="librarySharedCount"
                                                    [TeamCount]="libraryTeamCount"
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
                                                    (OpenFileRequested)="onOpenFileRequested($event)"
                                                />
                                            }
                                            @case ('Work') {
                                                <div class="work-tab-container">
                                                    <div class="work-view-toolbar">
                                                        <mj-view-toggle
                                                            [Options]="workViewOptions"
                                                            [ActiveKey]="workViewMode"
                                                            (KeyChange)="onWorkViewModeChanged($event)"
                                                        />
                                                    </div>
                                                    <div class="work-view-body">
                                                        @switch (workViewMode) {
                                                            @case ('list') {
                                                                <mjc-space-work
                                                                    [Tasks]="spaceTasks"
                                                                    [SpaceName]="spaceTitle"
                                                                    [DefaultBand]="spaceAudienceBand"
                                                                    [CanCreateTask]="!isSpaceClosed && canContribute"
                                                                    (TaskSelectRequested)="onTaskSelected($event)"
                                                                    (TaskToggleRequested)="onTaskToggled($event)"
                                                                    (CreateTaskRequested)="onCreateTask($event)"
                                                                />
                                                            }
                                                            @case ('kanban') {
                                                                <div class="work-kanban-pane">
                                                                    <bizapps-task-kanban
                                                                        [ExtraFilter]="taskScopeFilter"
                                                                        [ReadOnly]="isSpaceClosed || !canContribute"
                                                                        (BeforeStatusChange)="onBeforeKanbanStatusChange($event)"
                                                                        (TaskClicked)="onTaskDoubleClicked($event)"
                                                                        (TaskDoubleClicked)="onTaskDoubleClicked($event)"
                                                                    />
                                                                </div>
                                                            }
                                                            @case ('gantt') {
                                                                <div class="work-gantt-pane">
                                                                    <bizapps-task-gantt
                                                                        [ExtraFilter]="taskScopeFilter"
                                                                        [Height]="'620px'"
                                                                        [ReadOnly]="isSpaceClosed || !canContribute"
                                                                        (TaskClicked)="onTaskDoubleClicked($event)"
                                                                        (TaskDoubleClicked)="onTaskDoubleClicked($event)"
                                                                    />
                                                                </div>
                                                            }
                                                        }
                                                    </div>
                                                </div>
                                            }
                                            @case ('Chat') {
                                                <mjc-space-chat
                                                    [ConversationId]="activeConversationId"
                                                    [ConversationName]="activeConversationName"
                                                    [CurrentUser]="currentUser"
                                                    [SpaceId]="activeSpaceId"
                                                    [SpaceName]="spaceTitle"
                                                    [SpaceEntityId]="spaceEntityId"
                                                    [AudienceBand]="spaceAudienceBand"
                                                    [ParticipantCount]="headerTotalPeople"
                                                    [DefaultAgentId]="chatDefaultAgentId"
                                                    [AgentReplyMode]="chatAgentReplyMode"
                                                    [AllowedAgentIDs]="chatAllowedAgentIds"
                                                    [MentionPeople]="chatMentionPeople"
                                                    [AgentHistoryFrom]="chatAgentHistoryFrom"
                                                    [AgentTurnHandler]="handleAgentTurn"
                                                    [AutoNameConversation]="false"
                                                    [ComposerDraft]="composerDraft"
                                                    (ComposerDraftConsumed)="composerDraft = null"
                                                    (NewConversationRequested)="openNewConversationDialog()"
                                                />
                                            }
                                            @case ('People') {
                                                <mjc-space-people
                                                    [Members]="spaceMembers"
                                                    [SpaceName]="spaceTitle"
                                                    (InviteMemberRequested)="onInviteMember($event)"
                                                />
                                            }
                                            @case ('Settings') {
                                                <mjc-space-settings
                                                    [Settings]="spaceSettings"
                                                    [isSaving]="isSavingSettings"
                                                    [saveSuccessMessage]="settingsSaveSuccess"
                                                    (SaveSettingsRequested)="onSaveSettings($event)"
                                                />
                                            }
                                        }
                                    </div>
                                }
                            }
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
                                (ShareRequested)="onShareCompleted($event)"
                                (CancelRequested)="onShareDialogCancel()"
                            />
                        }

                        @if (isUploadDialogOpen) {
                            <mjc-upload-dialog
                                [SpaceName]="spaceTitle"
                                [SpaceId]="activeSpaceId"
                                [ClientOrgName]="clientOrgName"
                                [IsSubmitting]="isUploading"
                                (CancelRequested)="onUploadDialogCancel()"
                                (SubmitRequested)="onUploadDialogSubmit($event)"
                            />
                        }

                        @if (isNewConversationDialogOpen) {
                            <mjc-new-conversation-dialog
                                [SpaceName]="spaceTitle"
                                [CanSeeTeam]="canSeeTeam"
                                [IsSubmitting]="isCreatingConversation"
                                (CancelRequested)="closeNewConversationDialog()"
                                (SubmitRequested)="onSubmitNewConversation($event)"
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
    public isLoading = true;
    public hasAccess = false;
    public seats: { spaceName: string; status: string }[] = [];

    // Query parameters state
    public activeView = 'space';
    public activeSpaceId = '';
    public activeTab = 'Overview';
    public selectedItemId: string | null = null;
    public isDrawerOpen = false;
    public isShareDialogOpen = false;
    public isUploadDialogOpen = false;
    public isUploading = false;
    public isNewConversationDialogOpen = false;
    public isCreatingConversation = false;
    public composerDraft: string | null = null;
    public chatAgentReplyMode: AgentReplyMode = 'MentionOnly';
    public chatAllowedAgentIds: readonly string[] | null = null;
    public chatDefaultAgentId: string | null = null;
    public chatAgentHistoryFrom: Date | null = null;
    public chatMentionPeople: readonly ChatMentionPerson[] = [];

    // Header metadata
    public spaceTitle = '';
    public spaceTypeName = '';
    public spaceStatus = '';
    public spaceSubtitle = '';
    public headerTypeColor = '#0076b6';
    public headerTypeIcon = 'fa-solid fa-compass';
    public headerBackgroundImageUrl: string | null = null;
    public headerStaffAvatars: AvatarItem[] = [];
    public headerOutsideAvatars: AvatarItem[] = [];
    public headerTotalPeople = 0;
    public headerAudienceSummary = '';

    public firmName = '';
    public clientOrgName = '';

    public breadcrumbs: BreadcrumbItem[] = [];

    public canConfigureCurrentSpace = false;
    public loadErrorMessage = '';

    public async updateCanConfigureCurrentSpace(): Promise<void> {
        if (!this.currentUser || !this.activeSpaceId) {
            this.canConfigureCurrentSpace = false;
            return;
        }
        const spaceIdAtStart = this.activeSpaceId;
        let canConfig = false;
        try {
            canConfig = await CollaborationEngineBase.Instance.UserCanConfigureSpaces(
                this.currentUser,
                spaceIdAtStart,
                this.ProviderToUse
            );
        } catch (e) {
            LogError('Error checking space configuration authorization: ' + (e instanceof Error ? e.message : String(e)));
            canConfig = false;
        }
        if (!UUIDsEqual(this.activeSpaceId, spaceIdAtStart)) {
            return;
        }
        this.canConfigureCurrentSpace = canConfig;
        if (!this.canConfigureCurrentSpace && this.activeTab === 'Settings') {
            this.activeTab = 'Overview';
            this.UpdateQueryParams({ tab: 'overview' });
        }
        this.RefreshView();
    }

    public get tabs(): TabItem[] {
        const list: TabItem[] = [
            { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high' },
            { id: 'Library', label: 'Library', iconClass: 'fa-solid fa-folder-open' },
            { id: 'Work', label: 'Work', iconClass: 'fa-solid fa-list-check' },
            { id: 'Chat', label: 'Chat', iconClass: 'fa-solid fa-comments' },
            { id: 'People', label: 'People', iconClass: 'fa-solid fa-user-group' },
        ];
        if (this.canConfigureCurrentSpace) {
            list.push({ id: 'Settings', label: 'Settings', iconClass: 'fa-solid fa-sliders' });
        }
        return list;
    }

    // Navigation Rail data
    public inboxCount = 0;
    public taskCount = 0;
    public spaces: RailSpaceNode[] = [];
    public rawSpaces: RawSpaceRecord[] = [];
    private spaceTypeMap = new Map<string, { icon: string; color: string; name: string }>();

    public get activeSpacesCount(): number {
        return this.rawSpaces.filter(s => !s.ClosedAt).length;
    }

    public librarySharedCount = 0;
    public libraryTeamCount = 0;

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

    // Work tab state
    public spaceTasks: TaskItemModel[] = [];
    public workViewMode: WorkViewMode = 'list';
    public workViewOptions: ViewToggleOption[] = [
        { key: 'list', icon: 'fa-solid fa-list', label: 'List', title: 'List View' },
        { key: 'kanban', icon: 'fa-solid fa-table-columns', label: 'Board', title: 'Kanban Board View' },
        { key: 'gantt', icon: 'fa-solid fa-chart-gantt', label: 'Timeline', title: 'Timeline / Gantt View' },
    ];

    public get activeSpaceRecord(): RawSpaceRecord | undefined {
        return this.rawSpaces.find(s => UUIDsEqual(s.ID, this.activeSpaceId));
    }

    public get isSpaceClosed(): boolean {
        const space = this.activeSpaceRecord;
        return !!space?.ClosedAt;
    }

    public get canContribute(): boolean {
        if (!this.currentUser) return false;
        const currentUserId = this.currentUser.ID;
        const member = this.spaceMembers.find(m => UUIDsEqual(m.userId, currentUserId));
        if (!member || member.status !== 'Active') {
            return false;
        }
        if (member.canContribute !== undefined) {
            return member.canContribute;
        }
        const roleType = member.roleId
            ? CollaborationEngineBase.Instance.SpaceRoleTypeById(member.roleId)
            : CollaborationEngineBase.Instance.SpaceRoleTypeByCode(member.roleCode);
        return roleType ? roleType.CanContribute : false;
    }

    public get canSeeTeam(): boolean {
        if (!this.currentUser) return false;
        const currentUserId = this.currentUser.ID;
        const member = this.spaceMembers.find(m => UUIDsEqual(m.userId, currentUserId));
        if (!member || member.status !== 'Active') {
            return false;
        }
        const roleType = member.roleId
            ? CollaborationEngineBase.Instance.SpaceRoleTypeById(member.roleId)
            : CollaborationEngineBase.Instance.SpaceRoleTypeByCode(member.roleCode);
        return !!roleType?.CanSeeTeamBand;
    }

    public onBeforeKanbanStatusChange(event: BeforeKanbanStatusChangeEvent): void {
        if (this.isSpaceClosed) {
            event.Cancel = true;
            SharedService.Instance.CreateSimpleNotification('Cannot change task status in a closed space.', 'warning', 3000);
            return;
        }
        if (!this.canContribute) {
            event.Cancel = true;
            SharedService.Instance.CreateSimpleNotification('You do not have permission to update tasks in this space.', 'warning', 3000);
            return;
        }
    }

    public currentPersonId = '';

    public get taskScopeFilter(): string {
        if (!this.spaceTasks || this.spaceTasks.length === 0) {
            return '1 = 0';
        }
        const ids = this.spaceTasks.map(t => `'${t.id}'`).join(',');
        return `(ID IN (${ids}) OR RootParentID IN (${ids}))`;
    }

    public get rootSpaces(): { id: string; name: string; description: string; type: string; iconClass: string; color: string }[] {
        return this.rawSpaces
            .filter(s => !s.ParentID)
            .map(s => {
                const t = this.spaceTypeMap.get(s.SpaceTypeID);
                const typeName = s.SpaceType || t?.name;
                if (!typeName) {
                    LogError(`Missing space type for space ID: ${s.ID}`);
                }
                return {
                    id: s.ID,
                    name: s.Name,
                    description: s.Description || '',
                    type: typeName || 'Unknown Type',
                    iconClass: s.IconClass || t?.icon || 'fa-solid fa-compass',
                    color: s.Color || t?.color || '#0076b6',
                };
            });
    }

    // Current signed-in user and space entity ID
    public currentUser: UserInfo | null = null;
    public spaceEntityId = '';

    // Conversations state
    public spaceConversations: SpaceConversationItem[] = [];
    public activeConversationId = '';
    public _pendingConvId: string | null = null;

    // Home spaces search
    public spaceSearchQuery = '';

    public get activeConversationName(): string {
        const found = this.spaceConversations.find(c => UUIDsEqual(c.id, this.activeConversationId));
        return found ? found.name : '';
    }

    public get filteredSpaces(): { id: string; name: string; description: string; type: string; iconClass: string; color: string; parentName?: string }[] {
        const query = this.spaceSearchQuery.trim().toLowerCase();
        const spaceMap = new Map<string, RawSpaceRecord>();
        this.rawSpaces.forEach(s => spaceMap.set(s.ID, s));

        return this.rawSpaces
            .filter(s => {
                if (!query) return !s.ParentID;
                const matchesName = s.Name.toLowerCase().includes(query);
                const matchesDesc = (s.Description || '').toLowerCase().includes(query);
                const matchesType = (s.SpaceType || '').toLowerCase().includes(query);
                return matchesName || matchesDesc || matchesType;
            })
            .map(s => {
                const t = this.spaceTypeMap.get(s.SpaceTypeID);
                const parent = s.ParentID ? spaceMap.get(s.ParentID) : undefined;
                const typeName = s.SpaceType || t?.name;
                if (!typeName) {
                    LogError(`Missing space type for space ID: ${s.ID}`);
                }
                return {
                    id: s.ID,
                    name: s.Name,
                    description: s.Description || '',
                    type: typeName || 'Unknown Type',
                    iconClass: s.IconClass || t?.icon || 'fa-solid fa-compass',
                    color: s.Color || t?.color || '#0076b6',
                    parentName: parent?.Name,
                };
            });
    }

    // Chat tab state
    public spaceAudienceBand: SpaceBand = 'Shared';
    public shareDialogItemId: string | null = null;

    public get homeSharedRows(): LibraryRowModel[] {
        return this.libraryRows.filter(r => r.band === 'Shared');
    }


    // People tab state
    public spaceMembers: SpaceMemberModel[] = [];

    // Settings tab state
    public spaceSettings: SpaceSettingsModel = {
        id: '',
        name: '',
        description: '',
        spaceType: '',
        spaceTypeId: '',
        iconClass: 'fa-solid fa-compass',
        color: '#0076b6',
        backgroundImageUrl: '',
        inheritsMembership: true,
        agentRetrieval: 'Included',
        retention: 'Indefinite',
        status: 'Active',
    };
    public isSavingSettings = false;
    public settingsSaveSuccess = '';

    private get graphQLExecutor(): GraphQLExecutor {
        const p = this.ProviderToUse;
        if (CollaborationClient.isAvailable(p)) {
            return p;
        }
        throw new Error('Current provider does not implement GraphQLExecutor (missing ExecuteGQL)');
    }

    protected async loadRealData(): Promise<void> {
        try {
            const md = this.ProviderToUse;
            const rv = new RunView(this.RunViewToUse);
            const peopleEntity = md.EntityByName('MJ_BizApps_Common: People');
            if (peopleEntity && md.CurrentUser?.ID) {
                try {
                    const personRes = await rv.RunView<{ ID: string }>({
                        EntityName: 'MJ_BizApps_Common: People',
                        ExtraFilter: `LinkedUserID = '${md.CurrentUser.ID}'`,
                        ResultType: 'simple',
                        MaxRows: 1,
                    });
                    if (personRes?.Success && personRes.Results?.[0]) {
                        this.currentPersonId = personRes.Results[0].ID;
                    } else {
                        this.currentPersonId = '';
                    }
                } catch (err) {
                    LogError('Failed to load Person for CurrentUser: ' + (err instanceof Error ? err.message : String(err)));
                    this.currentPersonId = '';
                }
            } else {
                this.currentPersonId = '';
            }

            const spEntity = md.EntityByName('MJ_BizApps_Collaboration: Spaces');
            if (!spEntity) {
                const msg = 'Metadata lookup failed for entity MJ_BizApps_Collaboration: Spaces';
                LogError(msg);
                this.loadErrorMessage = msg;
                this.hasAccess = false;
                return;
            }
            this.spaceEntityId = spEntity.ID;
            this.currentUser = md.CurrentUser || null;

            // Load SpaceTypes from CollaborationEngineBase (punch list item 54)
            await CollaborationEngineBase.Instance.Config(false, md.CurrentUser, this.ProviderToUse);
            for (const t of CollaborationEngineBase.Instance.SpaceTypes) {
                this.spaceTypeMap.set(t.ID, {
                    icon: t.IconClass || 'fa-solid fa-compass',
                    color: t.Color || '#0076b6',
                    name: t.Name,
                });
            }

            // Load Spaces
            const spacesRes = await rv.RunView<RawSpaceRecord>({
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                ResultType: 'simple',
                MaxRows: 100,
            });

            if (spacesRes?.Success) {
                if (spacesRes.Results && spacesRes.Results.length > 0) {
                    this.hasAccess = true;
                    this.loadErrorMessage = '';
                    this.rawSpaces = spacesRes.Results;
                    this.spaces = this.buildSpaceRailNodes(this.rawSpaces);

                    const params = this._pendingQueryParams ?? this.GetQueryParams();
                    this._pendingQueryParams = null;
                    await this.applyQueryParams(params);
                } else {
                    this.hasAccess = false;
                }
            } else {
                const msg = spacesRes?.ErrorMessage || 'Failed to query collaboration spaces';
                LogError(msg);
                this.loadErrorMessage = msg;
                this.hasAccess = false;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error loading collaboration data: ' + msg);
            this.loadErrorMessage = 'Error loading collaboration data: ' + msg;
            this.hasAccess = false;
        } finally {
            this.isLoading = false;
            this.NotifyLoadComplete();
            this.RefreshView();
        }
    }

    private buildSpaceRailNodes(rawSpaces: RawSpaceRecord[]): RailSpaceNode[] {
        const nodes: RailSpaceNode[] = [];
        const spaceMap = new Map<string, RawSpaceRecord>();
        rawSpaces.forEach(s => spaceMap.set(s.ID, s));

        const roots = rawSpaces.filter(s => !s.ParentID || !spaceMap.has(s.ParentID));

        const visit = (space: RawSpaceRecord, level: 0 | 1 | 2) => {
            const children = rawSpaces.filter(other => other.ParentID && UUIDsEqual(other.ParentID, space.ID));
            const typeDef = this.spaceTypeMap.get(space.SpaceTypeID);
            nodes.push({
                id: space.ID,
                name: space.Name,
                color: space.Color || typeDef?.color || '#0076b6',
                iconClass: space.IconClass || typeDef?.icon || 'fa-solid fa-compass',
                level,
                hasChildren: children.length > 0,
                isExpanded: true,
            });
            for (const child of children) {
                visit(child, Math.min(level + 1, 2) as 0 | 1 | 2);
            }
        };

        for (const root of roots) {
            visit(root, 0);
        }
        return nodes;
    }

    private _loadedSpaceId: string | null = null;

    private async selectSpaceInternal(spaceId: string): Promise<void> {
        this.activeSpaceId = spaceId;
        this._loadedSpaceId = spaceId;
        this.activeConversationId = '';
        this.overviewRoomMessages = [];
        this.spaceConversations = [];
        const space = this.rawSpaces.find(s => UUIDsEqual(s.ID, spaceId));
        if (!space) return;

        const typeDef = this.spaceTypeMap.get(space.SpaceTypeID);
        const resolvedType = space.SpaceType || typeDef?.name;
        if (!resolvedType) {
            LogError(`Missing space type for space ID: ${space.ID}`);
        }
        this.spaceTitle = space.Name;
        this.spaceSubtitle = space.Description || '';
        this.spaceStatus = space.ClosedAt ? 'Closed' : 'Active';
        this.spaceTypeName = resolvedType || 'Unknown Type';
        this.headerTypeIcon = space.IconClass || typeDef?.icon || 'fa-solid fa-compass';
        this.headerTypeColor = space.Color || typeDef?.color || '#0076b6';
        this.headerBackgroundImageUrl = space.BackgroundImageURL || null;

        // Build breadcrumb lineage
        const lineage: BreadcrumbItem[] = [];
        let curr: RawSpaceRecord | undefined = space;
        while (curr) {
            lineage.unshift({ label: curr.Name, spaceId: curr.ID });
            curr = curr.ParentID ? this.rawSpaces.find(s => UUIDsEqual(s.ID, curr!.ParentID)) : undefined;
        }
        this.breadcrumbs = [{ label: 'Spaces' }, ...lineage];

        // Overview sub-spaces
        const children = this.rawSpaces.filter(s => UUIDsEqual(s.ParentID, spaceId));
        this.overviewSubSpaces = children.map(c => {
            const cType = this.spaceTypeMap.get(c.SpaceTypeID);
            const subType = c.SpaceType || cType?.name;
            if (!subType) {
                LogError(`Missing space type for sub-space ID: ${c.ID}`);
            }
            return {
                id: c.ID,
                name: c.Name,
                type: subType || 'Unknown Type',
                iconClass: c.IconClass || cType?.icon || 'fa-solid fa-compass',
                color: c.Color || cType?.color || '#0076b6',
                description: c.Description || '',
            };
        });

        // Initialize space settings model
        this.spaceSettings = {
            id: space.ID,
            name: space.Name,
            description: space.Description || '',
            spaceType: resolvedType || 'Unknown Type',
            spaceTypeId: space.SpaceTypeID,
            iconClass: space.IconClass || typeDef?.icon || 'fa-solid fa-compass',
            color: space.Color || typeDef?.color || '#0076b6',
            backgroundImageUrl: space.BackgroundImageURL || '',
            inheritsMembership: space.InheritsMembership === true,
            agentRetrieval: (space.AgentRetrieval as 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely') || 'Included',
            retention: (space.Retention as 'Month' | 'Year' | 'Indefinite') || 'Indefinite',
            status: space.ClosedAt ? 'Closed' : 'Active',
        };

        await this.updateCanConfigureCurrentSpace();

        // Load items, conversation, tasks, members
        await this.loadSpaceItems(spaceId);
        await this.loadSpaceConversations(spaceId, this._pendingConvId ?? undefined);
        this._pendingConvId = null;
        await this.loadSpaceTasks(spaceId);
        await this.loadSpaceMembers(spaceId);
        await this.loadSpaceChatHostRules(spaceId, this.activeConversationId || undefined);

        this.syncStateWithAgent();
        this.RefreshView();
    }

    private async loadSpaceItems(spaceId: string): Promise<void> {
        if (!isValidUuid(spaceId)) return;
        try {
            const rv = new RunView(this.RunViewToUse);
            const itemsRes = await rv.RunView<{
                ID: string;
                SpaceID: string;
                EntityID: string;
                Entity?: string;
                RecordID: string;
                Band: SpaceBand;
                Folder?: string | null;
                PromotedAt?: string | null;
                PromotedByUser?: string | null;
                __mj_CreatedAt: string;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Items',
                ExtraFilter: `SpaceID = '${spaceId}'`,
                ResultType: 'simple',
                MaxRows: 100,
            });

            if (!itemsRes?.Success || !itemsRes.Results || itemsRes.Results.length === 0) {
                this.libraryRows = [];
                this.libraryTotalCount = 0;
                this.librarySharedCount = 0;
                this.libraryTeamCount = 0;
                this.overviewSharedItems = [];
                this.overviewTeamItems = [];
                this.libraryCollections = [];
                this.librarySmartViews = [];
                return;
            }

            const fileEntityId = '29248F34-2837-EF11-86D4-6045BDEE16E6';
            const fileItemMap = new Map<string, typeof itemsRes.Results[0]>();
            const fileIds: string[] = [];

            for (const item of itemsRes.Results) {
                if (UUIDsEqual(item.EntityID, fileEntityId) || item.Entity === 'MJ: Files') {
                    const fileId = item.RecordID.replace(/^ID\|/, '');
                    if (isValidUuid(fileId)) {
                        fileIds.push(fileId);
                        fileItemMap.set(fileId, item);
                    }
                }
            }

            const filesMap = new Map<string, { ID: string; Name: string; ProviderID: string; ProviderKey?: string; ContentType?: string }>();
            if (fileIds.length > 0) {
                const filesRes = await rv.RunView<{
                    ID: string;
                    Name: string;
                    ProviderID: string;
                    ProviderKey?: string;
                    ContentType?: string;
                }>({
                    EntityName: 'MJ: Files',
                    ExtraFilter: `ID IN ('${fileIds.join("','")}')`,
                    ResultType: 'simple',
                    MaxRows: 100,
                });
                if (filesRes?.Success && filesRes.Results) {
                    filesRes.Results.forEach(f => filesMap.set(f.ID, f));
                }
            }

            const rows: LibraryRowModel[] = [];
            const shared: ItemCardModel[] = [];
            const team: ItemRowModel[] = [];
            const folderCounts = new Map<string, { count: number; band: SpaceBand }>();

            for (const item of itemsRes.Results) {
                if (!UUIDsEqual(item.EntityID, fileEntityId) && item.Entity !== 'MJ: Files') {
                    continue;
                }
                const fileId = item.RecordID.replace(/^ID\|/, '');
                const file = filesMap.get(fileId);
                if (!file?.Name) {
                    LogError(`File record could not be read for item ID ${item.ID} (fileId ${fileId})`);
                }
                const name = file?.Name || '[Untitled Document]';
                const folder = item.Folder || 'General';
                const kind = this.detectFileKind(name, file?.ProviderKey, file?.ContentType);
                const dateStr = this.formatDate(item.__mj_CreatedAt);
                const author = item.PromotedByUser || 'Staff team';

                rows.push({
                    id: item.ID,
                    fileId,
                    name,
                    folder,
                    band: item.Band,
                    who: author,
                    when: dateStr,
                    kind,
                });

                if (item.Band === 'Shared') {
                    shared.push({
                        id: item.ID,
                        fileId,
                        kind,
                        title: name,
                        meta: `${folder} · Shared`,
                        stamp: dateStr,
                    });
                } else {
                    team.push({
                        id: item.ID,
                        fileId,
                        kind,
                        title: name,
                        author,
                        timestamp: dateStr,
                        canShare: true,
                    });
                }

                const cur = folderCounts.get(folder) || { count: 0, band: item.Band };
                cur.count++;
                folderCounts.set(folder, cur);
            }

            this.libraryRows = rows;
            this.libraryTotalCount = rows.length;
            this.librarySharedCount = shared.length;
            this.libraryTeamCount = team.length;
            this.overviewSharedItems = shared;
            this.overviewTeamItems = team;

            this.libraryCollections = Array.from(folderCounts.entries()).map(([folder, info], idx) => ({
                id: 'folder-' + idx,
                name: folder,
                band: info.band,
                count: info.count,
            }));

            this.librarySmartViews = [
                { id: 'recent', name: 'Recently updated', iconClass: 'fa-solid fa-clock-rotate-left', count: rows.length },
                { id: 'shared', name: 'Shared', iconClass: 'fa-solid fa-eye', count: shared.length },
                { id: 'team', name: 'Staff internal', iconClass: 'fa-solid fa-lock', count: team.length },
            ];
        } catch (err) {
            LogError('Error loading space items: ' + (err instanceof Error ? err.message : String(err)));
            this.libraryRows = [];
            this.libraryTotalCount = 0;
            this.librarySharedCount = 0;
            this.libraryTeamCount = 0;
            this.overviewSharedItems = [];
            this.overviewTeamItems = [];
        }
    }

    private async loadSpaceConversations(spaceId: string, preferredConvId?: string): Promise<void> {
        if (!isValidUuid(spaceId)) return;
        try {
            const rv = new RunView(this.RunViewToUse);
            const md = this.ProviderToUse;
            const spaceEntity = md.EntityByName('MJ_BizApps_Collaboration: Spaces');
            if (!spaceEntity) {
                LogError('Metadata lookup failed for entity MJ_BizApps_Collaboration: Spaces');
                return;
            }
            const spaceEntityId = spaceEntity.ID;

            const batchRes = await rv.RunViews([
                {
                    EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                    ExtraFilter: `SpaceID = '${spaceId}' AND Status = 'Active'`,
                    ResultType: 'simple',
                    MaxRows: 50,
                },
                {
                    EntityName: 'MJ: Conversations',
                    ExtraFilter: `LinkedEntityID = '${spaceEntityId}' AND LinkedRecordID = '${spaceId}'`,
                    ResultType: 'simple',
                    MaxRows: 50,
                },
            ]);

            const spaceChatsRes = batchRes?.[0] as {
                Success: boolean;
                Results?: Array<{
                    ID: string;
                    SpaceID: string;
                    ConversationID: string;
                    Name: string;
                    Subject?: string | null;
                    Kind: string;
                    Status: string;
                }>;
            };

            const convsRes = batchRes?.[1] as {
                Success: boolean;
                Results?: Array<{
                    ID: string;
                    Name: string;
                }>;
            };

            const items: SpaceConversationItem[] = [];
            const seenConvIds = new Set<string>();

            if (spaceChatsRes?.Success && spaceChatsRes.Results) {
                for (const sc of spaceChatsRes.Results) {
                    if (sc.ConversationID && !seenConvIds.has(sc.ConversationID)) {
                        seenConvIds.add(sc.ConversationID);
                        const isPrivate = sc.Kind === 'Private';
                        items.push({
                            id: sc.ConversationID,
                            name: sc.Name || 'general-room',
                            kind: sc.Kind || 'General',
                            band: isPrivate ? 'Team' : 'Shared',
                            unreadCount: 0,
                        });
                    }
                }
            }

            if (convsRes?.Success && convsRes.Results) {
                for (const c of convsRes.Results) {
                    if (!seenConvIds.has(c.ID)) {
                        seenConvIds.add(c.ID);
                        items.push({
                            id: c.ID,
                            name: c.Name || 'general-room',
                            kind: 'General',
                            band: 'Shared',
                            unreadCount: 0,
                        });
                    }
                }
            }

            items.sort((a, b) => {
                if (a.kind === 'Room' && b.kind !== 'Room') return -1;
                if (b.kind === 'Room' && a.kind !== 'Room') return 1;
                return a.name.localeCompare(b.name);
            });

            this.spaceConversations = items;

            if (preferredConvId && items.some(i => UUIDsEqual(i.id, preferredConvId))) {
                this.activeConversationId = preferredConvId;
            } else if (items.length > 0) {
                this.activeConversationId = items[0].id;
            } else {
                this.activeConversationId = '';
            }

            if (this.activeConversationId) {
                await this.loadOverviewMessages(this.activeConversationId);
            } else {
                this.overviewRoomMessages = [];
            }
        } catch (err) {
            LogError('Error loading space conversations: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    private async loadOverviewMessages(convId: string): Promise<void> {
        if (!isValidUuid(convId)) return;
        try {
            const rv = new RunView(this.RunViewToUse);
            const detailRes = await rv.RunView<{
                ID: string;
                Role: string;
                Message: string;
                User?: string;
                __mj_CreatedAt: string;
            }>({
                EntityName: 'MJ: Conversation Details',
                ExtraFilter: `ConversationID = '${convId}'`,
                OrderBy: '__mj_CreatedAt DESC',
                ResultType: 'simple',
                MaxRows: 25,
            });
            if (detailRes?.Success && detailRes.Results) {
                const chronological = [...detailRes.Results].reverse();
                const mapped: RoomMiniMessage[] = chronological.map(d => ({
                    id: d.ID,
                    senderName: d.Role === 'AI' ? 'Assistant' : (d.User || 'Team Member'),
                    senderInitials: d.Role === 'AI' ? 'AI' : (d.User ? d.User.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'TM'),
                    senderColorClass: d.Role === 'AI' ? 'c1' : 'c2',
                    isOutside: false,
                    isAssistant: d.Role === 'AI',
                    timestamp: this.formatDate(d.__mj_CreatedAt),
                    text: d.Message,
                }));
                this.overviewRoomMessages = mapped.slice(-5);
            }
        } catch (err) {
            LogError('Error loading overview messages: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    private async loadSpaceTasks(spaceId: string): Promise<void> {
        if (!isValidUuid(spaceId)) return;
        try {
            const rv = new RunView(this.RunViewToUse);
            const md = this.ProviderToUse;
            const tasksEntityInfo = md.EntityByName('MJ_BizApps_Tasks: Tasks');
            if (!tasksEntityInfo) return;

            const itemsRes = await rv.RunView<{
                ID: string;
                SpaceID: string;
                EntityID: string;
                Entity?: string;
                RecordID: string;
                Band: SpaceBand;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Items',
                ExtraFilter: `SpaceID = '${spaceId}' AND (EntityID = '${tasksEntityInfo.ID}' OR Entity = 'MJ_BizApps_Tasks: Tasks')`,
                ResultType: 'simple',
                MaxRows: 100,
            });

            if (!itemsRes?.Success || !itemsRes.Results || itemsRes.Results.length === 0) {
                this.spaceTasks = [];
                this.taskCount = 0;
                return;
            }

            const taskItemMap = new Map<string, typeof itemsRes.Results[0]>();
            const taskIds: string[] = [];
            for (const item of itemsRes.Results) {
                const rawId = (item.RecordID ?? '').replace(/^ID\|/i, '');
                if (rawId && isValidUuid(rawId)) {
                    taskIds.push(rawId);
                    taskItemMap.set(rawId.toLowerCase(), item);
                }
            }

            if (taskIds.length === 0) {
                this.spaceTasks = [];
                this.taskCount = 0;
                return;
            }

            const tasksRes = await rv.RunView<{
                ID: string;
                Name: string;
                Description?: string | null;
                Status?: string | null;
                Priority?: string | null;
                PercentComplete?: number | null;
                TargetEndDate?: string | null;
                AssignedTo?: string | null;
            }>({
                EntityName: 'MJ_BizApps_Tasks: Tasks',
                ExtraFilter: `ID IN (${taskIds.map(id => `'${id}'`).join(',')})`,
                ResultType: 'simple',
                MaxRows: 100,
            });

            if (tasksRes?.Success && tasksRes.Results) {
                this.spaceTasks = tasksRes.Results.map(t => {
                    const spaceItem = taskItemMap.get(t.ID.toLowerCase());
                    const assigned = t.AssignedTo || undefined;
                    return {
                        id: t.ID,
                        name: t.Name,
                        description: t.Description || undefined,
                        status: t.Status || 'Not Started',
                        priority: t.Priority || 'Medium',
                        band: spaceItem?.Band || 'Shared',
                        assigneeName: assigned,
                        assigneeInitials: assigned ? assigned.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : undefined,
                        dueDate: t.TargetEndDate ? this.formatDate(t.TargetEndDate) : undefined,
                        percentComplete: t.PercentComplete || 0,
                    };
                });
                this.taskCount = this.spaceTasks.filter(t => t.status !== 'Completed').length;
            }
        } catch (err) {
            LogError('Error loading space tasks: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    private async loadSpaceMembers(spaceId: string): Promise<void> {
        if (!isValidUuid(spaceId)) return;
        try {
            const rv = new RunView(this.RunViewToUse);
            const membersRes = await rv.RunView<{
                ID: string;
                SpaceID: string;
                UserID: string;
                User?: string | null;
                UserEmail?: MJUserEntity['Email'];
                SpaceRoleType?: string | null;
                SpaceRoleTypeID?: string | null;
                Band: SpaceBand;
                Status: string;
                __mj_CreatedAt: string;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                ExtraFilter: `SpaceID = '${spaceId}'`,
                ResultType: 'simple',
                MaxRows: 100,
            });

            if (membersRes?.Success && membersRes.Results) {
                const userIds = [...new Set(membersRes.Results.map(m => m.UserID).filter(Boolean))];
                const userEmailMap = new Map<string, string>();
                if (userIds.length > 0) {
                    try {
                        const userFilter = userIds.map(id => `'${id}'`).join(',');
                        const userRes = await rv.RunView<{ ID: string; Email: string }>({
                            EntityName: 'MJ: Users',
                            ExtraFilter: `ID IN (${userFilter})`,
                            ResultType: 'simple',
                            MaxRows: userIds.length,
                        });
                        if (userRes?.Success && userRes.Results) {
                            for (const u of userRes.Results) {
                                userEmailMap.set(u.ID, u.Email || '');
                            }
                        }
                    } catch (userErr) {
                        LogError('Error loading user emails for space members: ' + (userErr instanceof Error ? userErr.message : String(userErr)));
                    }
                }

                this.spaceMembers = membersRes.Results.map(m => {
                    const name = m.User || 'Member';
                    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    const roleType = m.SpaceRoleTypeID
                        ? CollaborationEngineBase.Instance.SpaceRoleTypeById(m.SpaceRoleTypeID)
                        : null;
                    const roleCode = roleType?.Code || 'member';
                    const canContribute = roleType ? roleType.CanContribute : false;
                    return {
                        id: m.ID,
                        userId: m.UserID,
                        name,
                        email: userEmailMap.get(m.UserID) || '',
                        initials,
                        roleName: roleType?.Name || m.SpaceRoleType || 'Member',
                        roleCode,
                        roleId: m.SpaceRoleTypeID || undefined,
                        canContribute,
                        band: m.Band || 'Team',
                        status: m.Status || 'Active',
                        joinedDate: this.formatDate(m.__mj_CreatedAt),
                    };
                });

                this.headerTotalPeople = this.spaceMembers.length;
                this.headerStaffAvatars = this.spaceMembers
                    .filter(m => m.band === 'Team')
                    .map(m => ({ initials: m.initials, name: m.name, colorClass: 'c1' }));
                this.headerOutsideAvatars = this.spaceMembers
                    .filter(m => m.band === 'Shared')
                    .map(m => ({ initials: m.initials, name: m.name, isOutside: true, colorClass: 'c2' }));
                this.headerAudienceSummary = `${this.headerStaffAvatars.length} Team Staff · ${this.headerOutsideAvatars.length} Outside`;
            }
        } catch (err) {
            LogError('Error loading space members: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    private detectFileKind(name: string, providerKey?: string, contentType?: string): FileKind {
        const url = (providerKey || '').toLowerCase();
        const lowerName = name.toLowerCase();
        if (url.includes('docs.google.com/document') || url.includes('word') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'doc';
        if (url.includes('docs.google.com/spreadsheets') || url.includes('excel') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) return 'xls';
        if (url.includes('docs.google.com/presentation') || url.includes('powerpoint') || lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')) return 'ppt';
        if (lowerName.endsWith('.pdf')) return 'pdf';
        if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.svg') || (contentType && contentType.startsWith('image/'))) return 'img';
        if (lowerName.endsWith('.zip') || lowerName.endsWith('.tar') || lowerName.endsWith('.gz')) return 'zip';
        return 'doc';
    }

    private formatDate(isoStr: string): string {
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return 'Recently';
        }
    }

    public onInviteClicked(): void {
        this.onTabSelectRequested('People');
    }

    public onNewClicked(): void {
        this.onTabSelectRequested('Work');
    }

    public override ngOnInit(): void {
        super.ngOnInit();
        const params = this.GetQueryParams();
        if (params['tab']) {
            const rawTab = params['tab'].toLowerCase();
            const tabMap: Record<string, string> = {
                overview: 'Overview',
                library: 'Library',
                work: 'Work',
                chat: 'Chat',
                discussions: 'Chat',
                people: 'People',
                settings: 'Settings',
            };
            if (tabMap[rawTab]) {
                this.activeTab = tabMap[rawTab];
            }
        }
        this.syncStateWithAgent();
        void this.loadRealData();
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

    private _pendingQueryParams: Record<string, string> | null = null;

    /**
     * Reacts to query param updates from back/forward or external deep links.
     */
    protected override OnQueryParamsChanged(params: Record<string, string>, _source: 'popstate' | 'deeplink'): void {
        if (this.rawSpaces.length === 0) {
            this._pendingQueryParams = params;
            this.RefreshView();
            return;
        }

        void this.applyQueryParams(params);
    }

    private async applyQueryParams(params: Record<string, string>): Promise<void> {
        if (params['view']) {
            this.activeView = params['view'];
        }

        if (params['workView'] === 'list' || params['workView'] === 'kanban' || params['workView'] === 'gantt') {
            this.workViewMode = params['workView'];
        }

        if (params['tab']) {
            const rawTab = params['tab'].toLowerCase();
            const tabMap: Record<string, string> = {
                overview: 'Overview',
                library: 'Library',
                work: 'Work',
                chat: 'Chat',
                discussions: 'Chat',
                people: 'People',
                settings: 'Settings',
            };
            if (tabMap[rawTab]) {
                this.activeTab = tabMap[rawTab];
            }
        }

        if (params['conv'] && isValidUuid(params['conv'])) {
            this._pendingConvId = params['conv'];
            if (this.spaceConversations.some(c => UUIDsEqual(c.id, params['conv']))) {
                this.activeConversationId = params['conv'];
            }
        }

        const requestedSpace = params['space'] && isValidUuid(params['space']) ? params['space'] : null;
        const targetSpaceId = requestedSpace && this.rawSpaces.some(s => UUIDsEqual(s.ID, requestedSpace))
            ? requestedSpace
            : (this._loadedSpaceId && this.rawSpaces.some(s => UUIDsEqual(s.ID, this._loadedSpaceId))
                ? this._loadedSpaceId
                : this.rawSpaces[0]?.ID);

        if (targetSpaceId && !UUIDsEqual(targetSpaceId, this._loadedSpaceId)) {
            await this.selectSpaceInternal(targetSpaceId);
        }

        if (params['item'] && isValidUuid(params['item'])) {
            this.selectedItemId = params['item'];
            this.isDrawerOpen = true;
        }

        if (this.activeTab === 'Settings' && !this.canConfigureCurrentSpace) {
            this.activeTab = 'Overview';
            this.UpdateQueryParams({ tab: 'overview' });
        }

        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onTabSelectRequested(tabId: string): void {
        if (tabId === 'Settings' && !this.canConfigureCurrentSpace) {
            tabId = 'Overview';
            SharedService.Instance.CreateSimpleNotification('You do not have permission to configure this space.', 'warning', 3000);
        }
        this.activeTab = tabId;
        this.UpdateQueryParams({ tab: tabId.toLowerCase() });
        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onWorkViewModeChanged(mode: string): void {
        if (mode === 'list' || mode === 'kanban' || mode === 'gantt') {
            this.workViewMode = mode;
            this.UpdateQueryParams({ workView: mode });
            this.RefreshView();
        }
    }

    public onTaskDoubleClicked(taskId: string): void {
        if (!taskId) return;
        SharedService.Instance.OpenEntityRecord('MJ_BizApps_Tasks: Tasks', CompositeKey.FromID(taskId));
    }

    public onSpaceOpenRequested(spaceId: string): void {
        this.activeView = 'space';
        this.activeTab = 'Overview';
        void this.selectSpaceInternal(spaceId);
        this.UpdateQueryParams({ view: 'space', space: spaceId, tab: 'overview', conv: null });
    }

    public onBreadcrumbSelected(crumb: BreadcrumbItem): void {
        if (crumb.spaceId) {
            this.onSpaceOpenRequested(crumb.spaceId);
        } else if (crumb.label === 'Spaces') {
            this.onBackToSpacesRequested();
        }
    }

    public onSpaceToggleRequested(node: RailSpaceNode): void {
        const found = this.spaces.find(s => UUIDsEqual(s.id, node.id));
        if (found) {
            found.isExpanded = !found.isExpanded;
            this.RefreshView();
        }
    }

    public onNavSelectRequested(view: string): void {
        this.activeView = view;
        this.UpdateQueryParams({ view, space: view === 'space' ? this.activeSpaceId : null });
        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onOpenLibraryRequested(): void {
        this.onTabSelectRequested('Library');
    }

    public onOpenChatRequested(): void {
        this.activeTab = 'Chat';
        this.UpdateQueryParams({ tab: 'chat', conv: this.activeConversationId || null });
        this.RefreshView();
    }

    public onSpaceConversationSelected(convId: string): void {
        this.activeConversationId = convId;
        this.activeTab = 'Chat';
        this.UpdateQueryParams({ tab: 'chat', conv: convId });
        void this.loadOverviewMessages(convId);
        void this.loadSpaceChatHostRules(this.activeSpaceId, convId);
        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onBackToSpacesRequested(): void {
        this.activeView = 'home';
        this.UpdateQueryParams({ view: 'home', conv: null });
        this.syncStateWithAgent();
        this.RefreshView();
    }

    public onItemSelected(item: ItemCardModel | ItemRowModel): void {
        this.selectedItemId = item.id;
        this.isDrawerOpen = true;
        this.activeTab = 'Library';
        this.UpdateQueryParams({ tab: 'library', item: item.id });
        this.RefreshView();
    }

    public onRowSelected(row: LibraryRowModel): void {
        this.selectedItemId = row.id;
        this.isDrawerOpen = true;
        this.UpdateQueryParams({ item: row.id });
        this.RefreshView();
    }

    public async onOpenFileRequested(fileId?: string): Promise<void> {
        if (!fileId) return;
        const targetItemId = this.libraryRows.find(r => UUIDsEqual(r.id, fileId) || UUIDsEqual(r.fileId, fileId))?.id;
        if (!targetItemId) {
            SharedService.Instance.CreateSimpleNotification('File not found in this space library.', 'error', 5000);
            return;
        }

        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            const res = await client.OpenSpaceFile(targetItemId);
            if (!res.Success || !res.Base64) {
                const msg = res.ErrorMessage || 'Failed to open file';
                LogError('OpenSpaceFile failed: ' + msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
                return;
            }

            const mimeType = res.MimeType || 'application/octet-stream';
            const fileName = res.Name || 'download';
            const byteCharacters = atob(res.Base64);
            const byteNumbers = new Array<number>(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const url = URL.createObjectURL(blob);

            const isInline = res.Mode === 'inline' || (res.Mode !== 'download' && (mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/')));
            if (isInline) {
                const newWin = window.open(url, '_blank');
                if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error opening space file: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Error opening file: ' + msg, 'error', 5000);
        }
    }

    public onCloseDrawerRequested(): void {
        this.isDrawerOpen = false;
        this.selectedItemId = null;
        this.UpdateQueryParams({ item: null });
        this.RefreshView();
    }

    public onShareRequested(item?: ItemCardModel | ItemRowModel | LibraryRowModel): void {
        if (item) {
            this.shareDialogItemId = item.id;
            this.shareDialogItemName = 'name' in item ? item.name : item.title;
            this.shareDialogKind = item.kind;
        } else if (this.selectedItemId) {
            this.shareDialogItemId = this.selectedItemId;
            const found = this.libraryRows.find(r => UUIDsEqual(r.id, this.selectedItemId));
            if (found) {
                this.shareDialogItemName = found.name;
                this.shareDialogKind = found.kind;
            }
        } else {
            SharedService.Instance.CreateSimpleNotification('No item selected to share.', 'warning', 3000);
            return;
        }
        this.shareDialogTitle = 'Share with Shared Band';
        const outsideMembers = this.spaceMembers.filter(m => m.band === 'Shared');
        this.shareAudienceHeader = 'Participants who will gain access';
        this.shareAudienceStaffSub = outsideMembers.length > 0
            ? `${outsideMembers.length} outside participant${outsideMembers.length === 1 ? '' : 's'}`
            : `${this.spaceMembers.length} space participant${this.spaceMembers.length === 1 ? '' : 's'}`;
        this.shareRecipients = (outsideMembers.length > 0 ? outsideMembers : this.spaceMembers).map(m => ({
            id: m.id,
            name: m.name,
            role: m.roleName || m.roleCode || '',
            avatar: {
                id: m.id,
                initials: m.initials || m.name?.slice(0, 2).toUpperCase() || '??',
                name: m.name,
                avatarUrl: m.avatarUrl,
                colorClass: m.colorClass,
            },
        }));
        this.shareRecipientCount = this.shareRecipients.length;
        this.shareAuthorName = this.currentUser?.FirstLast || this.currentUser?.Name || 'Current User';
        this.shareTimestamp = new Date().toISOString();
        this.shareReviewHeader = 'Policy Review';
        this.shareReviewSub = 'Automated policy check on shared items';
        this.shareFindings = [];
        this.isShareDialogOpen = true;
        this.RefreshView();
    }

    public onShareDialogCancel(): void {
        this.isShareDialogOpen = false;
        this.RefreshView();
    }

    public async onShareCompleted(_result: { applyFixes: boolean; note: string; notify: boolean }): Promise<void> {
        this.isShareDialogOpen = false;
        const targetItemId = this.shareDialogItemId;
        if (!targetItemId) {
            this.RefreshView();
            return;
        }
        try {
            const md = this.ProviderToUse;
            const spaceItem = await md.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>('MJ_BizApps_Collaboration: Space Items', this.currentUser || undefined);
            if (await spaceItem.Load(targetItemId)) {
                spaceItem.Band = 'Shared';
                spaceItem.PromotedAt = new Date();
                spaceItem.PromotedByUserID = md.CurrentUser?.ID || null;
                const saved = await spaceItem.Save();
                if (!saved) {
                    const err = spaceItem.LatestResult?.CompleteMessage || 'Failed to promote item to shared';
                    LogError('Failed to promote space item: ' + err);
                    SharedService.Instance.CreateSimpleNotification(err, 'error', 5000);
                    return;
                }
            } else {
                const err = 'Failed to load space item to promote to shared';
                LogError(err);
                SharedService.Instance.CreateSimpleNotification(err, 'error', 5000);
                return;
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            LogError('Error promoting space item: ' + errMsg);
            SharedService.Instance.CreateSimpleNotification('Failed to share item: ' + errMsg, 'error', 5000);
            return;
        }

        const item = this.libraryRows.find((r) => UUIDsEqual(r.id, targetItemId));
        if (item) {
            item.band = 'Shared';
            item.flagCount = undefined;
        }
        await this.loadSpaceItems(this.activeSpaceId);
        this.RefreshView();
    }

    public onUploadClicked(): void {
        this.isUploadDialogOpen = true;
        this.RefreshView();
    }

    public onUploadDialogCancel(): void {
        this.isUploadDialogOpen = false;
        this.RefreshView();
    }

    public async onUploadDialogSubmit(payload: CollabUploadSubmitPayload): Promise<void> {
        this.isUploading = true;
        this.RefreshView();
        try {
            if (payload.mode === 'upload' && payload.file) {
                const reader = new FileReader();
                const base64Data = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => {
                        const result = reader.result as string;
                        const base64 = result.includes(',') ? result.split(',')[1] : result;
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(payload.file!);
                });

                const client = new CollaborationClient(this.graphQLExecutor);
                const uploadRes = await client.UploadSpaceFile({
                    SpaceID: this.activeSpaceId,
                    FileName: payload.fileName || payload.title,
                    MimeType: payload.fileType || 'application/octet-stream',
                    Base64Data: base64Data,
                    Folder: payload.folder || 'Deliverables',
                });
                if (!uploadRes.Success) {
                    throw new Error(uploadRes.ErrorMessage || 'Failed to upload space file');
                }
                await this.loadSpaceItems(this.activeSpaceId);
                this.isUploadDialogOpen = false;
                SharedService.Instance.CreateSimpleNotification('File uploaded successfully.', 'info', 3000);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error submitting upload: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Failed to upload file: ' + msg, 'error', 5000);
        } finally {
            this.isUploading = false;
            this.RefreshView();
        }
    }

    public openNewConversationDialog(): void {
        this.isNewConversationDialogOpen = true;
        this.RefreshView();
    }

    public closeNewConversationDialog(): void {
        this.isNewConversationDialogOpen = false;
        this.RefreshView();
    }

    public async onSubmitNewConversation(payload: NewConversationSubmitPayload): Promise<void> {
        this.isCreatingConversation = true;
        this.RefreshView();
        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            const res = await client.CreateSpaceConversation({
                SpaceID: this.activeSpaceId,
                Name: payload.name,
                Kind: payload.kind,
            });
            if (!res.Success) {
                const msg = res.ErrorMessage || 'Failed to create conversation';
                LogError('Failed to create space conversation: ' + msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
                return;
            }

            this.isNewConversationDialogOpen = false;
            SharedService.Instance.CreateSimpleNotification('Conversation created.', 'info', 3000);

            await this.loadSpaceConversations(this.activeSpaceId, res.ConversationID ?? undefined);
            if (res.ConversationID) {
                this.activeConversationId = res.ConversationID;
                this.activeTab = 'Chat';
                this.UpdateQueryParams({ tab: 'chat', conv: res.ConversationID });
                await this.loadSpaceChatHostRules(this.activeSpaceId, res.ConversationID);
            }
            this.syncStateWithAgent();
            this.RefreshView();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error creating conversation: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Failed to create conversation: ' + msg, 'error', 5000);
        } finally {
            this.isCreatingConversation = false;
            this.RefreshView();
        }
    }

    private async loadSpaceChatHostRules(spaceId: string, conversationId?: string): Promise<void> {
        // Reset to safe defaults first
        this.chatAgentReplyMode = 'MentionOnly';
        this.chatAllowedAgentIds = null;
        this.chatDefaultAgentId = null;
        this.chatAgentHistoryFrom = null;
        this.chatMentionPeople = [];

        if (!isValidUuid(spaceId)) return;
        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            const res = await client.GetSpaceChatHostRules(spaceId, conversationId);
            if (res?.Success) {
                this.chatAgentReplyMode = res.AgentReplyMode as AgentReplyMode;
                this.chatAllowedAgentIds = res.AllowedAgentIDs ?? null;
                this.chatDefaultAgentId = res.DefaultAgentID ?? null;
                this.chatAgentHistoryFrom = res.AgentHistoryFrom ? new Date(res.AgentHistoryFrom) : null;
                this.chatMentionPeople = (res.MentionPeople ?? []).map(p => ({
                    ID: p.ID,
                    Name: p.Name,
                    Email: p.Email ?? null,
                }));
            }
        } catch (err) {
            LogError('Error loading space chat host rules: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    public handleAgentTurn: AgentTurnHandler = async (request: AgentTurnRequest): Promise<AgentTurnResult> => {
        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            const res = await client.ExecuteSpaceChatTurn({
                SpaceID: this.activeSpaceId,
                ConversationID: request.ConversationId,
                UserMessageID: request.UserMessageId,
                AgentID: request.AgentId,
            });
            return {
                Success: res.Success,
                ErrorMessage: res.ErrorMessage,
                ReplyDetailIds: res.ReplyDetailIDs,
                AgentRunId: res.AgentRunID,
            };
        } catch (error) {
            LogError(`Failed to execute space chat turn: ${error instanceof Error ? error.message : String(error)}`);
            return {
                Success: false,
                ErrorMessage: error instanceof Error ? error.message : 'The chat turn failed.',
            };
        }
    };

    public onTaskSelected(task: TaskItemModel): void {
        if (!task?.id) return;
        SharedService.Instance.OpenEntityRecord('MJ_BizApps_Tasks: Tasks', CompositeKey.FromID(task.id));
    }

    public async onTaskToggled(task: TaskItemModel): Promise<void> {
        const isCompleted = task.status === 'Completed';
        const newEntityStatus: TaskEntity['Status'] = isCompleted ? 'InProgress' : 'Completed';
        const previousStatus = task.status;
        task.status = isCompleted ? 'In Progress' : 'Completed';
        this.RefreshView();
        try {
            const md = this.ProviderToUse;
            const taskEntity = await md.GetEntityObject<TaskEntity>('MJ_BizApps_Tasks: Tasks');
            if (await taskEntity.Load(task.id)) {
                taskEntity.Status = newEntityStatus;
                if (newEntityStatus === 'Completed') {
                    taskEntity.PercentComplete = 100;
                }
                const saved = await taskEntity.Save();
                if (!saved) {
                    task.status = previousStatus;
                    this.RefreshView();
                    SharedService.Instance.CreateSimpleNotification('Failed to update task: ' + (taskEntity.LatestResult?.CompleteMessage ?? ''), 'error', 5000);
                }
            } else {
                task.status = previousStatus;
                this.RefreshView();
                SharedService.Instance.CreateSimpleNotification('Failed to load task for status update.', 'error', 5000);
            }
        } catch (err) {
            task.status = previousStatus;
            this.RefreshView();
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error toggling task: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Error updating task: ' + msg, 'error', 5000);
        }
    }

    public async onCreateTask(payload: { name: string; band: SpaceBand; priority: string }): Promise<void> {
        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            const res = await client.CreateSpaceTask({
                SpaceID: this.activeSpaceId,
                Name: payload.name,
                Band: payload.band,
            });
            if (!res.Success) {
                const msg = res.ErrorMessage || 'Failed to create task';
                LogError('Failed to create space task: ' + msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
                return;
            }

            if (res.TaskID && payload.priority) {
                const priorityMap: Record<string, TaskEntity['Priority']> = {
                    Low: 'Low',
                    Medium: 'Medium',
                    High: 'High',
                    Urgent: 'Critical',
                    Critical: 'Critical',
                };
                const mappedPriority = priorityMap[payload.priority];
                if (mappedPriority) {
                    const md = this.ProviderToUse;
                    const taskEntity = await md.GetEntityObject<TaskEntity>('MJ_BizApps_Tasks: Tasks');
                    if (await taskEntity.Load(res.TaskID)) {
                        taskEntity.Priority = mappedPriority;
                        const saved = await taskEntity.Save();
                        if (!saved) {
                            LogError('Failed to save task priority: ' + (taskEntity.LatestResult?.CompleteMessage || ''));
                        }
                    }
                }
            }

            await this.loadSpaceTasks(this.activeSpaceId);
            SharedService.Instance.CreateSimpleNotification('Task created successfully.', 'info', 3000);
            this.RefreshView();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error creating task: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Error creating task: ' + msg, 'error', 5000);
        }
    }

    public async onOverviewAskRequested(query: string): Promise<void> {
        const room = this.spaceConversations.find(c => c.kind === 'Room');
        if (room) {
            this.activeConversationId = room.id;
            this.UpdateQueryParams({ tab: 'chat', conv: room.id });
        } else {
            this.activeConversationId = '';
            this.UpdateQueryParams({ tab: 'chat' });
        }
        this.composerDraft = query?.trim() ?? '';
        this.activeTab = 'Chat';
        this.RefreshView();
    }

    public async onInviteMember(payload: { email: string; role: string; band: SpaceBand }): Promise<void> {
        try {
            const md = this.ProviderToUse;
            const rv = new RunView(this.RunViewToUse);
            let userId: string | null = null;
            const userRes = await rv.RunView<{ ID: string }>({
                EntityName: 'MJ: Users',
                ExtraFilter: `Email = '${payload.email.replace(/'/g, "''")}'`,
                ResultType: 'simple',
                MaxRows: 1,
            });
            if (userRes?.Success && userRes.Results?.[0]) {
                userId = userRes.Results[0].ID;
            } else {
                const msg = 'User not found in system with email: ' + payload.email;
                LogError(msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
                return;
            }

            const existingMember = await rv.RunView<{ ID: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                ExtraFilter: `SpaceID = '${this.activeSpaceId}' AND UserID = '${userId}'`,
                ResultType: 'simple',
                MaxRows: 1,
            });
            if (existingMember?.Success && existingMember.Results?.[0]) {
                SharedService.Instance.CreateSimpleNotification('User is already a member of this space.', 'warning', 4000);
                return;
            }

            const roleRes = await rv.RunView<{ ID: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Role Types',
                ExtraFilter: `Code = '${payload.role.toLowerCase()}'`,
                ResultType: 'simple',
                MaxRows: 1,
            });
            const roleId = roleRes?.Success && roleRes.Results?.[0]?.ID;
            if (!roleId || !userId) {
                const msg = 'Could not find space role type: ' + payload.role;
                LogError(msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
                return;
            }

            const memberEntity = await md.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>('MJ_BizApps_Collaboration: Space Members');
            memberEntity.NewRecord();
            memberEntity.SpaceID = this.activeSpaceId;
            memberEntity.UserID = userId;
            memberEntity.SpaceRoleTypeID = roleId;
            memberEntity.Band = payload.band;
            memberEntity.Status = 'Active';
            const saved = await memberEntity.Save();
            if (!saved) {
                const errMsg = memberEntity.LatestResult?.CompleteMessage || 'Failed to save member.';
                LogError('Failed to invite member: ' + errMsg);
                SharedService.Instance.CreateSimpleNotification('Failed to invite member: ' + errMsg, 'error', 5000);
                return;
            }

            await this.loadSpaceMembers(this.activeSpaceId);
            SharedService.Instance.CreateSimpleNotification('Member invited successfully.', 'info', 3000);
            this.RefreshView();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error inviting member: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Error inviting member: ' + msg, 'error', 5000);
        }
    }

    public async onSaveSettings(settings: SpaceSettingsModel): Promise<void> {
        if (!this.canConfigureCurrentSpace) {
            const msg = 'Cannot save space settings: user lacks Configure Spaces authorization';
            LogError(msg);
            SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
            return;
        }
        this.isSavingSettings = true;
        this.settingsSaveSuccess = '';
        this.RefreshView();
        try {
            const targetId = settings.id || this.activeSpaceId;
            if (!targetId || !isValidUuid(targetId)) {
                const msg = 'Cannot save space settings: invalid or missing space ID';
                LogError(msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
                this.isSavingSettings = false;
                return;
            }
            const md = this.ProviderToUse;
            const spaceEntity = await md.GetEntityObject<mjBizAppsCollaborationSpaceEntity>('MJ_BizApps_Collaboration: Spaces');
            if (await spaceEntity.Load(targetId)) {
                spaceEntity.Name = settings.name;
                spaceEntity.Description = settings.description;
                spaceEntity.IconClass = settings.iconClass;
                spaceEntity.Color = settings.color;
                spaceEntity.BackgroundImageURL = settings.backgroundImageUrl || null;
                spaceEntity.InheritsMembership = settings.inheritsMembership;
                spaceEntity.AgentRetrieval = settings.agentRetrieval as 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
                spaceEntity.Retention = (settings.retention || null) as 'Month' | 'Year' | 'Indefinite' | null;
                const saveOk = await spaceEntity.Save();
                if (!saveOk) {
                    const errMsg = spaceEntity.LatestResult?.CompleteMessage || 'Failed to save space settings.';
                    LogError('Failed to save space settings: ' + errMsg);
                    SharedService.Instance.CreateSimpleNotification('Failed to save space settings: ' + errMsg, 'error', 5000);
                    this.isSavingSettings = false;
                    this.RefreshView();
                    return;
                }

                this.spaceTitle = settings.name;
                this.spaceSubtitle = settings.description;
                this.headerTypeIcon = settings.iconClass;
                this.headerTypeColor = settings.color;
                this.headerBackgroundImageUrl = settings.backgroundImageUrl || null;

                const raw = this.rawSpaces.find(s => UUIDsEqual(s.ID, targetId));
                if (raw) {
                    raw.Name = settings.name;
                    raw.Description = settings.description;
                    raw.IconClass = settings.iconClass;
                    raw.Color = settings.color;
                    raw.BackgroundImageURL = settings.backgroundImageUrl || null;
                    raw.InheritsMembership = settings.inheritsMembership;
                    raw.AgentRetrieval = settings.agentRetrieval as mjBizAppsCollaborationSpaceEntity['AgentRetrieval'];
                    raw.Retention = (settings.retention || null) as mjBizAppsCollaborationSpaceEntity['Retention'];
                    this.spaces = this.buildSpaceRailNodes(this.rawSpaces);
                }

                this.settingsSaveSuccess = 'Space settings saved successfully.';
                SharedService.Instance.CreateSimpleNotification(this.settingsSaveSuccess, 'info', 3000);
            } else {
                const msg = 'Failed to load space to save settings.';
                LogError(msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error saving settings: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Error saving settings: ' + msg, 'error', 5000);
        } finally {
            this.isSavingSettings = false;
            this.RefreshView();
        }
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
