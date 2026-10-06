import { Component, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NormalizeUUID, RegisterClass, UUIDsEqual } from '@memberjunction/global';
import { type BaseEntity, CompositeKey, LogError, RunView, type UserInfo } from '@memberjunction/core';
import { BaseResourceComponent, SharedService } from '@memberjunction/ng-shared';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { FormResolverService } from '@memberjunction/ng-base-forms';
import { MJAlertComponent, MJPageLayoutComponent, MJPageBodyComponent, MJButtonDirective, MJClickableDirective, MJEmptyStateComponent, MJViewToggleComponent, type ViewToggleOption } from '@memberjunction/ng-ui-components';
import type { ResourceData, MJUserEntity } from '@memberjunction/core-entities';

import { buildConversationEntries, chooseActiveConversation } from './logic/conversation-list.js';
import { rulesForSpace } from './logic/space-rules';
import { spaceTurnFailure, spaceTurnInput, spaceTurnResult } from './logic/agent-turn.js';
import { chatState, type ChatState, type SeatLookup } from './logic/chat-state.js';
import { openSpaceFile, openUseFields } from './logic/open-file.js';
import { applySettingsChanges, buildSettingsModel, DEFAULT_TYPE_COLOR, SettingsSession } from './logic/settings-model.js';
import { DEFAULT_SPACE_RULES, SPACE_UPLOAD_MAX_BYTES, uploadBandChoice } from '@mj-biz-apps/collaboration-core';
import { summarizeSeats } from './logic/seat-summary.js';
import { LatestOnly } from './logic/latest-only.js';
import { formatDate as formatDateLocale, formatDateTime } from './logic/format-date.js';
import { freshSelectionState, LoadingFlag } from './logic/selection-reset.js';
import { runBeforeHookSafely } from './logic/before-hook.js';
import { resolveDriverSafely } from './logic/ui-driver-safe.js';
import { settingsAccess, type SettingsAccess } from './logic/settings-access.js';
import { countLabel, countText, invitationRows, taskRows, type HomeListKind, type HomeRowModel } from './logic/home-lists.js';
import { NewSpaceDraft, SpaceDetails } from './logic/space-details.js';
import { planDetailsView, type DetailsViewModel } from './logic/details-view.js';
import { NewSpacePicks } from './logic/new-space-picks.js';
import { SpaceDetailsViewComponent } from './space-details-view.component';
import { newSpaceKinds, subSpaceKinds, type NewSpaceKind } from './logic/new-space-types.js';
import { closeConsequence, readFromPayload, type CloseConsequenceState } from './logic/close-consequence.js';
import { buildSpaceTabs, buildSpaceTabsSafely, resolveTabId, tabIdFromUrl, type SpaceTabModel } from './logic/space-tabs.js';
import { railFlags, railModeFor } from './logic/rail-flags.js';
import { seatActions } from './logic/seat-actions.js';
import { grantableRoles, type RoleOption } from './logic/grantable-roles.js';
import { accessChain, nearestSeats } from './logic/reached-people.js';
import { shareAudience } from './logic/share-audience.js';
import { toOverviewMessages } from './logic/overview-messages.js';
import { guardedLoad, isSelectionCurrent } from './logic/selection-guard.js';
import {
    CollaborationClient,
    type HomeInvitationGraphQL,
    type HomeOpenTaskGraphQL,
    type GraphQLExecutor,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    type mjBizAppsCollaborationSpaceRoleTypeEntity,
    mjBizAppsCollaborationItemUseEntity,
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
    CollabNewSpaceDialogComponent,
    CollabHomeListComponent,
    type HomeListRow,
    type NewConversationSubmitPayload,
    type NewSpaceSubmitPayload,
    type TabItem,
    assembleSpaceContributions,
    BaseSpaceOverviewCard,
    BaseSpaceTab,
    BaseSpaceTypeUIDriver,
    type BeforeInviteEvent,
    type BeforeStartChatEvent,
    type SpaceOverviewCardDescriptor,
    type SpaceTabDescriptor,
    type SpaceUIContext,
    UIDriverRegistry,
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
    type SpaceBand,
    type RecentUseModel,
    type AvatarItem,
    type CollabUploadSubmitPayload,
    type TaskItemModel,
    type SpaceMemberModel,
    type SpaceSettingsModel,
    type SpaceDetailsFormDescriptor,
    type SpaceConversationItem,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { MentionParser, type MentionPerson } from '@memberjunction/conversations-runtime';
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
    ClosedAt?: mjBizAppsCollaborationSpaceEntity['ClosedAt'];
    StatusID?: mjBizAppsCollaborationSpaceEntity['StatusID'];
    OwnerID?: mjBizAppsCollaborationSpaceEntity['OwnerID'];
    Configuration?: mjBizAppsCollaborationSpaceEntity['Configuration'];
}

/** What the load-error page says: the cause goes to the log, not to the person. */
const LOAD_FAILED_MESSAGE = "Collaboration couldn't load your spaces. Please try again.";

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
        SpaceDetailsViewComponent,
        MJPageLayoutComponent,
        MJPageBodyComponent,
        MJButtonDirective,
        MJAlertComponent,
        MJClickableDirective,
        MJEmptyStateComponent,
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
        CollabNewSpaceDialogComponent,
        CollabHomeListComponent,
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
            background: linear-gradient(135deg, var(--mj-brand-primary) 0%, var(--mj-brand-primary-active) 100%);
            color: var(--mj-text-inverse);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            flex-shrink: 0;
            box-shadow: 0 4px 12px color-mix(in srgb, var(--mj-brand-primary) 25%, transparent);
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
        .stat-pill.active {
            border-color: var(--mj-brand-primary, #0284c7);
            background: var(--mj-bg-surface-hover, #f1f5f9);
        }
        .home-list-wrap {
            padding: 0 32px 8px;
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
        .space-directory-card.closed { opacity: 0.7; }
        .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .space-directory-card:hover {
            border-color: var(--mj-brand-primary, #0284c7);
            box-shadow: var(--mj-shadow-md);
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
            background: var(--mj-brand-primary);
            color: var(--mj-text-inverse);
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
            color: var(--mj-text-inverse);
            flex-shrink: 0;
        }
        .header-icon-box.inbox {
            background: var(--mj-status-warning);
        }
        .header-icon-box.tasks {
            background: var(--mj-status-success);
        }
        .header-icon-box.files {
            background: var(--mj-brand-accent);
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
            box-shadow: var(--mj-shadow-sm);
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
                        <mj-loading Text="Loading workspace..."></mj-loading>
                    </div>
                } @else if (loadErrorMessage) {
                    <div class="collab-error-state">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <h3>Error Loading Workspace</h3>
                        <p>{{ loadErrorMessage }}</p>
                        <button mjButton Variant="primary" Size="md" (click)="onRetryLoad()">Try again</button>
                    </div>
                } @else if (!hasAccess) {
                    <mjc-no-access [Seats]="seats" />
                } @else {
                    <div class="mjc-shell">
                        <mjc-space-rail
                            [Mode]="railMode"
                            [ActiveNav]="activeView"
                            [Spaces]="spaces"
                            [ActiveSpaceId]="activeSpaceId"
                            [SpaceTitle]="spaceTitle"
                            [SpaceIcon]="headerTypeIcon"
                            [SpaceBand]="spaceAudienceBand"
                            [ActiveTab]="activeTab"
                            [Tabs]="tabs"
                            [Conversations]="spaceConversations"
                            [CanConfigure]="showsSettings"
                            [ActiveConversationId]="activeConversationId"
                            [CanStartConversation]="canStartConversation"
                            [LibraryCount]="libraryTotalCount"
                            [TaskCount]="taskCount"
                            [MemberCount]="headerTotalPeople"
                            [InboxCount]="0"
                            [CanCreateSpace]="canCreateSpace"
                            (SpaceCreateRequested)="openNewSpaceDialog()"
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
                                                <div class="stat-pill" [mjClickable]="homeCountLabel('spaces')" (click)="onHomeSpacesRequested()">
                                                    <span class="stat-val">{{ activeSpacesCount }}</span>
                                                    <span class="stat-lbl">Active Spaces</span>
                                                </div>
                                                <div class="stat-pill" [class.active]="homeList === 'tasks'" [mjClickable]="homeCountLabel('tasks')" (click)="onHomeListRequested('tasks')">
                                                    <span class="stat-val">{{ homeCountValue('tasks') }}</span>
                                                    <span class="stat-lbl">Open Tasks</span>
                                                </div>
                                                <div class="stat-pill" [class.active]="homeList === 'approvals'" [mjClickable]="homeCountLabel('approvals')" (click)="onHomeListRequested('approvals')">
                                                    <span class="stat-val">{{ homeCountValue('approvals') }}</span>
                                                    <span class="stat-lbl">Invitations Waiting</span>
                                                </div>
                                                <div class="stat-pill" [mjClickable]="homeCountLabel('files')" (click)="onNavSelectRequested('files')">
                                                    <span class="stat-val">{{ homeCountValue('files') }}</span>
                                                    <span class="stat-lbl">Shared Files</span>
                                                </div>
                                            </div>
                                        </header>

                                        @if (homeList) {
                                            <div class="home-list-wrap">
                                                <mjc-home-list
                                                    [Id]="homeList"
                                                    [Title]="homeListTitle"
                                                    [Rows]="homeListRows"
                                                    [TotalCount]="homeListTotal"
                                                    [IsLoading]="isLoadingHomeList"
                                                    [ErrorMessage]="homeListError"
                                                    [EmptyMessage]="homeListEmpty"
                                                    (RowSelected)="onHomeRowSelected($event)"
                                                    (RetryRequested)="loadHomeLists()"
                                                    (CloseRequested)="closeHomeList()"
                                                />
                                            </div>
                                        }

                                        <div class="home-body">
                                            <section class="home-section">
                                                <div class="section-title-row">
                                                    <div class="section-title">
                                                        <i class="fa-solid fa-layer-group"></i>
                                                        <span>All spaces</span>
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
                                                @if (filteredSpaces.length === 0) {
                                                    @if (spaceSearchQuery) {
                                                        <mj-empty-state Icon="fa-solid fa-magnifying-glass" Title="No spaces match" Message="Try another search."></mj-empty-state>
                                                    } @else {
                                                        <mj-empty-state Icon="fa-solid fa-compass" Title="No spaces yet" Message="Spaces you belong to will appear here."></mj-empty-state>
                                                    }
                                                }
                                                <div class="spaces-directory-grid">
                                                    @for (space of filteredSpaces; track space.id) {
                                                        <div class="space-directory-card" [class.closed]="space.isClosed" [mjClickable]="space.name" (click)="onSpaceOpenRequested(space.id)">
                                                            <div class="card-top">
                                                                <div class="space-icon-box" [style.background-color]="space.color || null">
                                                                    <i [class]="space.iconClass"></i>
                                                                </div>
                                                                <div class="space-type-badge">
                                                                    @if (space.parentName) {
                                                                        <span>{{ space.parentName }} / </span>
                                                                    }
                                                                    {{ space.type }}
                                                                </div>
                                                            </div>
                                                            <h3 class="space-name">
                                                                {{ space.name }}
                                                                @if (space.isClosed) {
                                                                    <i class="fa-solid fa-lock" title="Closed" aria-hidden="true"></i>
                                                                    <span class="visually-hidden">(closed)</span>
                                                                }
                                                            </h3>
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
                                                <h1 class="view-title">Inbox</h1>
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
                                                    [ShowCreateButton]="false"
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
                                                [CanSeeTeamSide]="canSeeTeamSide"
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
                                                [IsOpeningFile]="isOpeningFile"
                                                [OpeningLabel]="openingFileLabel"
                                                (RowSelectRequested)="onRowSelected($event)"
                                                (ShareRequested)="onShareRequested($event)"
                                                (CloseDrawerRequested)="onCloseDrawerRequested()"
                                                (OpenFileRequested)="onOpenFileRequested($event)"
                                            />
                                        </div>
                                    </div>
                                }

                                @default {
                                    @if (seatLookup === 'failed') {
                                        <mj-alert
                                            class="seat-lookup-failed"
                                            Variant="warning"
                                            Role="alert"
                                            Title="We couldn't check what you can do in this space"
                                            Message="Until that's known, posting, uploading, inviting and sharing are hidden. Nothing about your seat has changed.">
                                            <button actions type="button" mjButton Variant="secondary" Size="sm" (click)="onRetrySeatLookup()">Try again</button>
                                        </mj-alert>
                                    }
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
                                                @if (canInviteHere) {
                                                    <button mjButton Variant="secondary" Size="md" (click)="onInviteClicked()">
                                                        <i class="fa-solid fa-user-plus"></i>Invite
                                                    </button>
                                                }
                                                @if (canAddHere && hasTab('Work')) {
                                                    <button mjButton Variant="primary" Size="md" (click)="onNewClicked()">
                                                        <i class="fa-solid fa-plus"></i>New
                                                    </button>
                                                }
                                            } @else if (canAddHere && hasTab('Library') && !contributedTabComponent) {
                                                <button mjButton Variant="primary" Size="md" (click)="onUploadClicked()">
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
                                        @if (isLoadingSpace) {
                                            <mj-loading Text="Loading space..."></mj-loading>
                                        } @else {
                                        @switch (activeTab) {
                                            @case ('Overview') {
                                                <mjc-space-overview
                                                    #spaceOverview
                                                    [SpaceId]="activeSpaceId"
                                                    [ContributedCards]="overviewContributedCards"
                                                    [ShowLibraryLink]="hasTab('Library')"
                                                    [ShowChatLink]="hasTab('Chat')"
                                                    [SpaceName]="spaceTitle"
                                                    [FirmName]="firmName"
                                                    [ClientOrgName]="clientOrgName"
                                                    [AudienceCount]="discussionAudienceCount"
                                                    [SharedAudienceCount]="headerTotalPeople"
                                                    [NeedsYouItems]="overviewNeedsYou"
                                                    [SharedItems]="overviewSharedItems"
                                                    [TeamItems]="overviewTeamItems"
                                                    [TeamTotalCount]="libraryTeamCount"
                                                    [RoomMessages]="overviewRoomMessages"
                                                    [SubSpaces]="overviewSubSpaces"
                                                    [CanAddSubSpace]="canCreateSpace && !isSpaceClosed"
                                                    [CanStartConversation]="canStartConversation && !isSpaceClosed && hasTab('Chat')"
                                                    [CanSeeTeamSide]="canSeeTeamSide"
                                                    [AgentAvailable]="chatDefaultAgentId !== null"
                                                    [IsSubmittingAsk]="isSubmittingAsk"
                                                    [DiscussionBand]="chatAudienceBand"
                                                    [HasAbout]="hasDetails"
                                                    [AboutTitle]="aboutTitle"
                                                    (OpenLibraryRequested)="onOpenLibraryRequested()"
                                                    (OpenChatRequested)="onOpenChatRequested()"
                                                    (ItemSelectRequested)="onItemSelected($event)"
                                                    (ShareRequested)="onShareRequested($event)"
                                                    (SubSpaceSelectRequested)="onSpaceOpenRequested($event.id)"
                                                    (NewSubSpaceRequested)="openNewSpaceDialog(activeSpaceId)"
                                                    (AskRequested)="onOverviewAskRequested($event)"
                                                >
                                                    <div mjcAbout style="display: contents">
                                                        @if (spaceDetails; as details) {
                                                            @if (detailsView; as view) {
                                                                <mjc-space-details-view [Record]="details.Leaf" [Presentation]="view.presentation" [Fields]="view.fields" [Component]="view.component" [FormSections]="view.formSections" [EditMode]="false" />
                                                            }
                                                        }
                                                    </div>
                                                </mjc-space-overview>
                                            }
                                            @case ('Library') {
                                                <mjc-space-library
                                                    [TotalCount]="libraryTotalCount"
                                                    [SharedCount]="librarySharedCount"
                                                    [TeamCount]="libraryTeamCount"
                                                    [Collections]="libraryCollections"
                                                    [SmartViews]="librarySmartViews"
                                                    [CanSeeTeamSide]="canSeeTeamSide"
                                                    [CanShareItems]="canShareItems"
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
                                                    [IsOpeningFile]="isOpeningFile"
                                                    [OpeningLabel]="openingFileLabel"
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
                                                                    [DefaultBand]="bandChoice?.start ?? typeDefaultBand ?? spaceAudienceBand"
                                                                    [CanCreateTask]="!isSpaceClosed && canContribute"
                                                                    [ReadOnly]="isSpaceClosed || !canContribute"
                                                                    [AllowedBands]="bandChoice?.allowed ?? bothBands"
                                                                    [CanSeeTeamSide]="canSeeTeamSide"
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
                                                    [IsReadOnly]="chatStateNow.kind === 'closed' || chatStateNow.kind === 'noSeat' || chatStateNow.kind === 'seatUnknown'"
                                                    [IsPending]="chatStateNow.kind === 'pending'"
                                                    [ReadOnlyNote]="chatReadOnlyNote"
                                                    [OutsideParticipantCount]="outsideParticipantCount"
                                                    [ConversationId]="activeConversationId"
                                                    [ConversationName]="activeConversationName"
                                                    [CurrentUser]="currentUser"
                                                    [SpaceId]="activeSpaceId"
                                                    [SpaceName]="spaceTitle"
                                                    [SpaceEntityId]="spaceEntityId"
                                                    [AudienceBand]="chatAudienceBand"
                                                    [ParticipantCount]="conversationParticipantCount"
                                                    [DefaultAgentId]="chatDefaultAgentId"
                                                    [AgentReplyMode]="chatAgentReplyMode"
                                                    [AllowedAgentIDs]="chatAllowedAgentIds"
                                                    [CanStartConversation]="canStartConversation && !isSpaceClosed"
                                                    [HasConversations]="spaceConversations.length > 0"
                                                    [MentionPeople]="chatMentionPeople"
                                                    [AgentHistoryFrom]="chatAgentHistoryFrom"
                                                    [AgentTurnHandler]="handleAgentTurn"
                                                    [AutoNameConversation]="false"
                                                    [ComposerDraft]="composerDraft"
                                                    (ComposerDraftConsumed)="composerDraft = null"
                                                    [PendingMessage]="pendingChatMessage"
                                                    [PendingMessageConversationId]="pendingChatMessageConversationId"
                                                    (PendingMessageConsumed)="pendingChatMessage = null; pendingChatMessageConversationId = null"
                                                    (NewConversationRequested)="openNewConversationDialog()"
                                                />
                                            }
                                            @case ('People') {
                                                <mjc-space-people
                                                    [Members]="spaceMembers"
                                                    [SpaceName]="spaceTitle"
                                                    [IsSendingInvite]="isSendingInvite"
                                                    [InviteOutcome]="inviteOutcome"
                                                    [RedemptionUrl]="inviteRedemptionUrl"
                                                    [CanInvite]="canInviteHere"
                                                    [CanSeeTeamSide]="canSeeTeamSide"
                                                    [RoleOptions]="grantableRoleOptions"
                                                    [CanManageSeats]="canInviteHere"
                                                    [IsBusy]="isChangingSeat"
                                                    (InviteMemberRequested)="onInviteMember($event)"
                                                    (InviteOutcomeDismissed)="inviteOutcome = null; inviteRedemptionUrl = null"
                                                    (ApproveMemberRequested)="onApproveMember($event)"
                                                    (RemoveMemberRequested)="onRemoveMember($event)"
                                                    (ChangeRoleRequested)="onChangeMemberRole($event)"
                                                />
                                            }
                                            @case ('Settings') {
                                                <mjc-space-settings
                                                    [Settings]="spaceSettings"
                                                    [isSaving]="isSavingSettings"
                                                    [saveSuccessMessage]="settingsSaveSuccess"
                                                    [saveInfoMessage]="settingsInfoMessage"
                                                    [IsRootSpace]="!activeSpaceRecord?.ParentID"
                                                    [IsBusy]="isChangingLifecycle"
                                                    [CanEdit]="settingsAccessNow.canEdit"
                                                    [CanChangeLifecycle]="settingsAccessNow.canChangeLifecycle"
                                                    [CanAdminister]="mayAdministerSpaces"
                                                    [ReadOnlyNote]="settingsAccessNow.readOnlyNote"
                                                    [CloseConsequence]="closeConsequenceText"
                                                    [HasDetails]="hasDetails"
                                                    [DetailsTitle]="detailsTitle"
                                                    [DetailsEditable]="settingsAccessNow.canEdit"
                                                    [DetailsDirty]="!!spaceDetails?.Dirty"
                                                    [DetailsIncomplete]="detailsIncomplete"
                                                    [IsSavingDetails]="isSavingDetails"
                                                    [DetailsMessage]="detailsMessage"
                                                    [DetailsError]="detailsError"
                                                    (SaveDetailsRequested)="onSaveDetails()"
                                                    (DiscardDetailsRequested)="onDiscardDetails()"
                                                    (CloseSpaceRequested)="onChangeSpaceLifecycle(true)"
                                                    (ReopenSpaceRequested)="onChangeSpaceLifecycle(false)"
                                                    (SaveSettingsRequested)="onSaveSettings($event)"
                                                >
                                                    <div mjcSettingsDetails class="details-form" style="display: contents">
                                                        @if (spaceDetails; as details) {
                                                            @if (detailsView; as view) {
                                                                <mjc-space-details-view
                                                                    [Record]="details.Leaf"
                                                                    [Presentation]="view.presentation"
                                                                    [Fields]="view.fields"
                                                                    [Component]="view.component"
                                                                    [FormSections]="view.formSections"
                                                                    [EditMode]="settingsAccessNow.canEdit && !isSavingDetails"
                                                                    (Changed)="onDetailChanged()"
                                                                />
                                                            }
                                                        }
                                                    </div>
                                                </mjc-space-settings>
                                            }
                                            @default {
                                                @if (contributedTabComponent; as tabComponent) {
                                                    <ng-container *ngComponentOutlet="tabComponent; inputs: { SpaceId: activeSpaceId, SpaceTypeCode: activeSpaceTypeCode }"></ng-container>
                                                }
                                            }
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
                                [IsSubmitting]="isUploadingHere"
                                [AllowedBands]="bandChoice?.allowed ?? bothBands"
                                [MaxBytes]="uploadMaxBytes"
                                [FolderSuggestions]="libraryFolderNames"
                                [StartBand]="bandChoice?.start ?? null"
                                (CancelRequested)="onUploadDialogCancel()"
                                (SubmitRequested)="onUploadDialogSubmit($event)"
                            />
                        }

                        @if (isNewSpaceDialogOpen) {
                            <mjc-new-space-dialog
                                [Types]="newSpaceKinds"
                                [SelectedTypeId]="newSpaceTypeId"
                                [HasDetails]="!!newSpaceView"
                                [DetailsTitle]="newSpaceDetailsTitle"
                                [DetailsIncomplete]="newSpaceDetailsIncomplete"
                                [IsSubmitting]="isCreatingSpace"
                                [ErrorMessage]="newSpaceError"
                                [ParentName]="newSpaceParentName"
                                (TypeSelected)="onNewSpaceTypeSelected($event)"
                                (CancelRequested)="closeNewSpaceDialog()"
                                (SubmitRequested)="onSubmitNewSpace($event)"
                            >
                                <div mjcDetails class="new-space-details">
                                    @if (newSpaceDraft; as draft) {
                                        @if (newSpaceView; as view) {
                                            <mjc-space-details-view
                                                [Record]="draft.Leaf"
                                                [Presentation]="view.presentation"
                                                [Fields]="view.fields"
                                                [Component]="view.component"
                                                [FormSections]="view.formSections"
                                                [EditMode]="!isCreatingSpace"
                                                (Changed)="onNewSpaceDetailChanged()"
                                            />
                                        }
                                    }
                                </div>
                            </mjc-new-space-dialog>
                        }

                        @if (isNewConversationDialogOpen) {
                            <mjc-new-conversation-dialog
                                [SpaceName]="spaceTitle"
                                [AllowedKinds]="canStartConversationKinds"
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
    @ViewChild('spaceOverview') public spaceOverviewComponent?: CollabSpaceOverviewComponent;

    public selectedItemId: string | null = null;
    public isDrawerOpen = false;
    public isShareDialogOpen = false;
    public isUploadDialogOpen = false;

    /**
     * The bands the caller's seat on this space may choose for an upload, and the one to start on, from Core's
     * uploadBandChoice. The seat is the one the caller reaches the space through, an inherited seat on an ancestor included.
     * Null until it is resolved, or when it can't be: the dialog then offers both bands, starts on none, and the server
     * applies the space type's default.
     */
    public readonly bothBands: readonly SpaceBand[] = ['Shared', 'Team'];
    /** The largest file the host takes: the default until the host rules say what this host set. */
    public uploadMaxBytes = SPACE_UPLOAD_MAX_BYTES;

    /** The space's own collections, offered as folder suggestions in the upload dialog. */
    public get libraryFolderNames(): string[] {
        return this.libraryCollections.map(c => c.name);
    }
    public bandChoice: { allowed: readonly SpaceBand[]; start: SpaceBand } | null = null;
    /** The seat the caller reaches the current space through, once resolved; null until then or when they have none. */
    private callerSeat: Awaited<ReturnType<CollaborationEngineBase['ReachedSeat']>> = null;
    /**
     * Whether the caller's seat on the current space has been looked up, kept apart from what it is: pending until the lookup
     * returns, known when it did (with a seat or without one), failed when it threw. A failed lookup is not "no seat".
     */
    public seatLookup: SeatLookup = 'pending';
    /** The current space type's default band for new material and tasks: the Work tab's default while the seat is unresolved. */
    public typeDefaultBand: SpaceBand | null = null;
    /** The roles the caller's seat may hand out: the invite form and the role picker offer these, highest first. */
    public grantableRoleOptions: RoleOption[] = [];
    /** The sign-in link the last invite returned when the host has no email channel. */
    public inviteRedemptionUrl: string | null = null;

    private async updateBandChoice(space: RawSpaceRecord, isCurrent: () => boolean): Promise<void> {
        let choice: { allowed: readonly SpaceBand[]; start: SpaceBand } | null = null;
        let resolved: typeof this.callerSeat = null;
        let lookup: SeatLookup = 'known';
        const type = CollaborationEngineBase.Instance.SpaceTypeById(space.SpaceTypeID);
        try {
            const user = this.currentUser;
            resolved = user ? await CollaborationEngineBase.Instance.ReachedSeat(user, space.ID, this.ProviderToUse) : null;
            if (resolved) {
                choice = uploadBandChoice(type?.DefaultBand ?? null, resolved.role.canSeeTeamBand, resolved.role.canPromoteBand);
            }
        } catch (error) {
            // The page couldn't check: that is said as such, with a way to try again, and not as a person who has no seat
            lookup = 'failed';
            LogError(`Failed to resolve the caller's seat on space ${space.ID}: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!isCurrent()) return;
        this.bandChoice = choice;
        this.callerSeat = resolved;
        this.seatLookup = lookup;
        this.typeDefaultBand = type?.DefaultBand ?? null;
        this.grantableRoleOptions = resolved ? grantableRoles(CollaborationEngineBase.Instance.SpaceRoleTypes, resolved.role) : [];
    }

    /** The spaces an upload is in flight for, one entry per upload: two uploads to one space count twice. */
    private readonly uploadingSpaceIds: string[] = [];
    /** True while an upload for the space shown is with the server: the dialog of another space is not held by it. */
    public get isUploadingHere(): boolean {
        return this.uploadingSpaceIds.some((id) => UUIDsEqual(id, this.activeSpaceId));
    }
    public isNewSpaceDialogOpen = false;
    public isCreatingSpace = false;
    public newSpaceKinds: NewSpaceKind[] = [];
    public newSpaceTypeId = '';
    public newSpaceDraft: NewSpaceDraft | null = null;
    public newSpaceError = '';
    /** The required details of the kind chosen that are still empty: Create waits for them. */
    public newSpaceDetailsIncomplete = false;
    /** How the details of the kind chosen are drawn, or null when it has none. */
    public newSpaceView: DetailsViewModel | null = null;
    public newSpaceDetailsTitle = 'Details';
    /** The kinds picked: only the latest pick's draft may reach the screen. */
    private readonly newSpacePicks = new NewSpacePicks(new LatestOnly());
    public isNewConversationDialogOpen = false;
    public isCreatingConversation = false;
    public composerDraft: string | null = null;
    public chatAgentReplyMode: AgentReplyMode = 'MentionOnly';
    public chatAllowedAgentIds: readonly string[] = [];
    public chatDefaultAgentId: string | null = null;
    public chatDefaultAgentName: string | null = null;
    public chatAgentHistoryFrom: Date | null = null;
    public chatMentionPeople: readonly MentionPerson[] = [];
    private hostRulesRequestId = 0;
    private selectSpaceRequestId = 0;

    // Header metadata
    public spaceTitle = '';
    public spaceTypeName = '';
    public spaceStatus = '';
    public spaceSubtitle = '';
    public headerTypeColor = '';
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
    /** An owner may reopen a closed space even when its post-close access has ended and they can no longer configure it. */
    public canReopenCurrentSpace = false;
    /** Closing needs the 'Close and Reopen Spaces' authorization and an owner seat, on a space that is open: not the settings right. */
    public canCloseCurrentSpace = false;
    public loadErrorMessage = '';
    public isSubmittingAsk = false;

    public async updateCanConfigureCurrentSpace(): Promise<void> {
        // The grants can change while the page is open (a host edits them): what the page offers follows them on the next selection
        this.refreshMayAdminister();
        this.refreshCanCreateSpace();
        if (!this.currentUser || !this.activeSpaceId) {
            this.canConfigureCurrentSpace = false;
            this.canReopenCurrentSpace = false;
            this.canCloseCurrentSpace = false;
            return;
        }
        const spaceIdAtStart = this.activeSpaceId;
        let canConfig = false;
        let canReopen = false;
        let canClose = false;
        try {
            canConfig = await CollaborationEngineBase.Instance.UserCanConfigureSpaces(
                this.currentUser,
                spaceIdAtStart,
                this.ProviderToUse
            );
            // Only a closed space is reopened, and only there does the right differ from configuring
            if (this.activeSpaceRecord?.ClosedAt) {
                canReopen = await CollaborationEngineBase.Instance.UserCanReopenSpace(this.currentUser, spaceIdAtStart, this.ProviderToUse);
            } else {
                canClose = await CollaborationEngineBase.Instance.UserCanCloseSpace(this.currentUser, spaceIdAtStart, this.ProviderToUse);
            }
        } catch (e) {
            LogError('Error checking space configuration authorization: ' + (e instanceof Error ? e.message : String(e)));
            canConfig = false;
            canReopen = false;
            canClose = false;
        }
        if (!UUIDsEqual(this.activeSpaceId, spaceIdAtStart)) {
            return;
        }
        this.canConfigureCurrentSpace = canConfig;
        this.canReopenCurrentSpace = canReopen;
        this.canCloseCurrentSpace = canClose;
        // What closing does is read once the person may close: the confirmation says it before the close
        if (canClose) void this.loadCloseConsequence(spaceIdAtStart);
        if (!this.showsSettings && this.activeTab === 'Settings') {
            this.activeTab = 'Overview';
            this.UpdateQueryParams({ tab: 'overview' });
        }
        this.RefreshView();
    }

    /** Where the server's read of what closing the space shown does stands. */
    private closeConsequenceState: CloseConsequenceState = { status: 'loading' };
    private closeConsequenceForSpace: string | null = null;

    /** What closing the space shown does, in words: read from the server, which knows the ancestors and the keeper. */
    public get closeConsequenceText(): string {
        const forThisSpace = !!this.closeConsequenceForSpace && UUIDsEqual(this.closeConsequenceForSpace, this.activeSpaceId);
        return closeConsequence(forThisSpace ? this.closeConsequenceState : { status: 'loading' }, this.currentUser?.ID);
    }

    /** Asks the server what closing the space would do, for the space shown. A later selection's answer is the one kept. */
    private async loadCloseConsequence(spaceId: string): Promise<void> {
        if (!isValidUuid(spaceId)) return;
        this.closeConsequenceForSpace = spaceId;
        this.closeConsequenceState = { status: 'loading' };
        let next: CloseConsequenceState;
        try {
            const res = await new CollaborationClient(this.graphQLExecutor).GetCloseConsequence(spaceId);
            const read = res.Success ? readFromPayload(res) : null;
            if (!read) this.logOnce(`consequence:${spaceId}`, `Could not read what closing space ${spaceId} does: ${res.ErrorMessage ?? 'the answer was incomplete'}`);
            next = read ? { status: 'read', read } : { status: 'unavailable' };
        } catch (err) {
            this.logOnce(`consequence:${spaceId}`, `Could not read what closing space ${spaceId} does: ${err instanceof Error ? err.message : String(err)}`);
            next = { status: 'unavailable' };
        }
        if (!UUIDsEqual(this.activeSpaceId, spaceId)) return;
        this.closeConsequenceState = next;
        this.RefreshView();
    }

    /** Settings is offered to someone who may configure the space, and to one who may only close or reopen it (read-only, with that button). */
    public get showsSettings(): boolean {
        return this.settingsAccessNow.showTab;
    }

    /** What Settings offers the person on the space shown: the form, the close or reopen button, and the note over a read-only view. */
    public get settingsAccessNow(): SettingsAccess {
        return settingsAccess({
            isClosed: !!this.activeSpaceRecord?.ClosedAt,
            isTerminal: !!CollaborationEngineBase.Instance.EffectiveStatusForSpace(this.activeSpaceRecord ?? {})?.IsTerminal,
            canConfigure: this.canConfigureCurrentSpace,
            canClose: this.canCloseCurrentSpace,
            canReopen: this.canReopenCurrentSpace,
        });
    }

    /** The tabs of the space shown: the built-in ones its type's panels allow, plus what the type and other apps contribute. */
    public get tabs(): TabItem[] {
        const model = this.spaceTabModel ?? buildSpaceTabs({
            panels: { MessagingPanel: true, LibraryPanel: true, WorkPanel: true },
            finalize: (defaults) => defaults,
            labelFor: (_key, label) => label,
        });
        return model.tabs.filter(tab => tab.id !== 'Settings' || this.showsSettings);
    }

    /** The tab model of the space shown, built when it is selected. Null until then. */
    private spaceTabModel: SpaceTabModel | null = null;
    /** What the type's UI driver was last asked, so it can be asked again about the space's details. */
    private uiContext: SpaceUIContext | null = null;
    /** The details the space shown keeps of its own (its type names a subtype), or null for a plain space. */
    public spaceDetails: SpaceDetails | null = null;
    /** How those details are drawn, and worked out when they are read: null when the type's UI driver shows none. */
    public detailsView: DetailsViewModel | null = null;
    public hasDetails = false;
    public detailsTitle = 'Details';
    public aboutTitle = 'About';
    /** A required detail is empty: Save waits. Worked out when the details load and when one changes. */
    public detailsIncomplete = false;
    public isSavingDetails = false;
    public detailsMessage = '';
    public detailsError = '';

    private readonly formResolver = inject(FormResolverService);

    /** Whether MemberJunction has a form for an entity, a registered one or an interactive override. */
    private async hasFormFor(entity: BaseEntity): Promise<boolean> {
        const user = this.currentUser;
        if (!user) return false;
        const resolution = await this.formResolver.ResolveFormForEntity(entity.EntityInfo, user, this.ProviderToUse);
        return resolution.kind !== 'none';
    }

    /** The type's UI driver for the space shown. */
    private uiDriver: BaseSpaceTypeUIDriver = UIDriverRegistry.Instance.GetDefaultDriver();
    /** Cards the type and other apps add to the Overview of the space shown. */
    public overviewContributedCards: SpaceOverviewCardDescriptor[] = [];

    /** Runs a type's `Before…` hook. A hook that throws is logged with the space and its type, and reported as false: don't go on. */
    private runBeforeHook(hook: string, spaceId: string, run: () => void): boolean {
        const type = CollaborationEngineBase.Instance.SpaceTypeById(this.activeSpaceRecord?.SpaceTypeID);
        return runBeforeHookSafely(hook, type?.Code, spaceId, run, (message) => LogError(message));
    }

    /** Opens a tab of the space shown. A tab the space doesn't have (its type turned the panel off) opens the Overview instead. */
    private setTab(id: string): void {
        const resolved = this.spaceTabModel ? resolveTabId(this.spaceTabModel, id) : id;
        // Details changed in Settings and not saved are not carried to the Overview's About card
        if (this.activeTab === 'Settings' && resolved !== 'Settings' && this.spaceDetails?.Dirty) {
            this.spaceDetails.Discard();
            this.detailsMessage = '';
            this.detailsError = '';
        }
        this.activeTab = resolved ?? 'Overview';
    }

    /** Whether the space shown has a tab (its type's panel is on, and no driver removed it). */
    public hasTab(id: string): boolean {
        return this.tabs.some(tab => tab.id === id);
    }

    /** The code of the space shown's type. */
    public get activeSpaceTypeCode(): string {
        const space = this.activeSpaceRecord;
        return (space && CollaborationEngineBase.Instance.SpaceTypeById(space.SpaceTypeID)?.Code) || '';
    }

    /** The component of the contributed tab that is open, or null when a built-in tab is. */
    public get contributedTabComponent(): SpaceTabDescriptor['component'] | null {
        return this.spaceTabModel?.contributed.get(this.activeTab) ?? null;
    }

    /** What has been logged already, by key: the tabs and the header are built more than once per selection, and a fault reads once. */
    private readonly loggedOnceKeys = new Set<string>();
    private logOnce(key: string, message: string): void {
        if (this.loggedOnceKeys.has(key)) return;
        this.loggedOnceKeys.add(key);
        LogError(message);
    }

    /** The UI driver a type names. A driver whose constructor throws must not take the screen down: it falls back to the default driver. */
    private uiDriverFor(driverClass: string | null | undefined, typeCode: string, forWhat: string, logKey: string): BaseSpaceTypeUIDriver {
        return resolveDriverSafely(
            () => UIDriverRegistry.Instance.ResolveDriver(driverClass),
            () => UIDriverRegistry.Instance.GetDefaultDriver(),
            (err) => this.logOnce(logKey, `The UI driver of space type '${typeCode}' could not be created for ${forWhat}: ${err instanceof Error ? err.message : String(err)}`),
        );
    }

    /**
     * Resolves the space's type's UI driver and builds what it and other apps contribute: the tabs (each labelled from the
     * type's and the space's Labels.Tabs) and the Overview cards. A type whose driver isn't registered gets the default one.
     */
    private buildSpaceUi(space: RawSpaceRecord): void {
        const engine = CollaborationEngineBase.Instance;
        const type = engine.SpaceTypeById(space.SpaceTypeID);
        const code = type?.Code ?? '';
        this.uiDriver = this.uiDriverFor(type?.UIDriverClass, code, `space ${space.ID}`, `driver:${space.ID}`);
        let ctx: SpaceUIContext = { space: null, type: type ?? null, spaceTypeCode: code, viewer: this.currentUser, rules: structuredClone(DEFAULT_SPACE_RULES) };
        try {
            ctx = { ...ctx, rules: rulesForSpace(space, this.rawSpaces, engine) };
        } catch (err) {
            this.logOnce(`rules:${space.ID}`, `Could not resolve the rules for the tabs of space ${space.ID}: ${err instanceof Error ? err.message : String(err)}`);
        }
        const tabFactory = (reg: { SubClass: unknown }, meta: { contributionKey: string; label?: string; icon?: string; sortKey?: number }): SpaceTabDescriptor => ({
            key: meta.contributionKey,
            label: meta.label ?? meta.contributionKey,
            icon: meta.icon,
            sortKey: meta.sortKey,
            component: reg.SubClass as SpaceTabDescriptor['component'],
        });
        const panels = { MessagingPanel: type?.MessagingPanel ?? true, LibraryPanel: type?.LibraryPanel ?? true, WorkPanel: type?.WorkPanel ?? true };
        // A driver or a contribution that throws must not take the space down: log it, and fall back to the built-in parts
        this.spaceTabModel = buildSpaceTabsSafely({
            panels,
            finalize: (defaults) => this.uiDriver.GetTabs(ctx, assembleSpaceContributions(BaseSpaceTab, code, defaults, tabFactory)),
            labelFor: (key, label) => this.uiDriver.GetTabLabel(ctx, key, label),
            onDropped: (key) => this.logOnce(`dropped:${code}:${key}`, `A tab keyed '${key}' in space type '${code}' names no built-in tab and has no component, so it is dropped (first seen in space ${space.ID}).`),
        }, (err) => this.logOnce(`tabs:${space.ID}`, `The UI driver of space type '${code}' failed building the tabs of space ${space.ID}: ${err instanceof Error ? err.message : String(err)}`),
        // The labels the type's own settings give, which need no driver: a driver that failed doesn't take them away
        (key, label) => new BaseSpaceTypeUIDriver().GetTabLabel(ctx, key, label));
        const cardFactory = (reg: { SubClass: unknown }, meta: { contributionKey: string; title?: string; sortKey?: number; side?: 'Shared' | 'Team' }): SpaceOverviewCardDescriptor => ({
            key: meta.contributionKey,
            title: meta.title ?? meta.contributionKey,
            sortKey: meta.sortKey,
            side: meta.side,
            component: reg.SubClass as SpaceOverviewCardDescriptor['component'],
        });
        this.uiContext = ctx;
        try {
            this.overviewContributedCards = this.uiDriver.GetOverviewCards(ctx, assembleSpaceContributions(BaseSpaceOverviewCard, code, [], cardFactory));
        } catch (err) {
            this.logOnce(`cards:${space.ID}`, `The UI driver of space type '${code}' failed building the Overview cards of space ${space.ID}: ${err instanceof Error ? err.message : String(err)}`);
            this.overviewContributedCards = [];
        }
    }

    // Navigation Rail data
    public taskCount = 0;
    public spaces: RailSpaceNode[] = [];
    public rawSpaces: RawSpaceRecord[] = [];
    private spaceTypeMap = new Map<string, { icon: string; color: string; name: string }>();

    public get activeSpacesCount(): number {
        return this.rawSpaces.filter(s => !s.ClosedAt).length;
    }

    public librarySharedCount = 0;
    public libraryTeamCount = 0;

    /**
     * Whether the person holds 'Administer Spaces': the page offers what only that authorization may do, and the server refuses the rest.
     * Worked out once when the page loads and again when a space is selected, not on every change-detection pass: a missing
     * authorization logs an error each time it is asked.
     */
    public mayAdministerSpaces = false;

    private refreshMayAdminister(): void {
        if (!this.currentUser) {
            this.mayAdministerSpaces = false;
            return;
        }
        try {
            this.mayAdministerSpaces = CollaborationEngineBase.Instance.UserMayAdministerSpaces(this.currentUser, this.ProviderToUse);
        } catch (err) {
            this.logOnce('administer', `Could not check the Administer Spaces authorization: ${err instanceof Error ? err.message : String(err)}`);
            this.mayAdministerSpaces = false;
        }
    }

    /** What Home counts across every space the person reaches, from one approved MJ query the server runs for them. */
    public homeSharedFiles = 0;
    public homeOpenTasks = 0;
    /** Invitations waiting on an owner: approved on a space's People tab, not in the approval inbox. */
    public homeAwaitingApproval = 0;
    /** True when the counts could not be read: the pills say so instead of showing a zero. */
    public homeCountsFailed = false;

    /** The list Home has open under its counts, and the rows the server gave for it. */
    public homeList: HomeListKind | null = null;
    public homeInvitations: HomeInvitationGraphQL[] = [];
    public homeOpenTaskList: HomeOpenTaskGraphQL[] = [];
    public isLoadingHomeList = false;
    public homeListError = '';

    private homeCountOf(which: 'tasks' | 'approvals' | 'files' | 'spaces'): { count: number; singular: string; plural: string } {
        switch (which) {
            case 'tasks': return { count: this.homeOpenTasks, singular: 'open task', plural: 'open tasks' };
            case 'approvals': return { count: this.homeAwaitingApproval, singular: 'invitation waiting', plural: 'invitations waiting' };
            case 'files': return { count: this.homeSharedFiles, singular: 'shared file', plural: 'shared files' };
            default: return { count: this.activeSpacesCount, singular: 'active space', plural: 'active spaces' };
        }
    }

    /** What a pill shows: its number, or a dash while its count could not be read. Active spaces come from the page's own list, so they are always known. */
    public homeCountValue(which: 'tasks' | 'approvals' | 'files'): string {
        return countText(this.homeCountOf(which).count, this.homeCountsFailed);
    }

    /** What a pill says to a screen reader: the number with what it counts, so the label doesn't replace the number. */
    public homeCountLabel(which: 'tasks' | 'approvals' | 'files' | 'spaces'): string {
        const { count, singular, plural } = this.homeCountOf(which);
        return countLabel(count, which !== 'spaces' && this.homeCountsFailed, singular, plural);
    }

    public get homeListTitle(): string {
        return this.homeList === 'approvals' ? 'Invitations waiting on an owner' : 'Open tasks in your spaces';
    }

    public get homeListEmpty(): string {
        return this.homeList === 'approvals' ? 'No invitations are waiting for you to approve.' : 'No open tasks in your spaces.';
    }

    public get homeListTotal(): number {
        return this.homeList === 'approvals' ? this.homeAwaitingApproval : this.homeOpenTasks;
    }

    /** The rows of the list that is open, worked out when the list is opened or read and not on every change-detection pass. */
    public homeListRows: HomeListRow[] = [];

    private refreshHomeListRows(): void {
        const date = (iso: string | null | undefined): string => (iso ? formatDateLocale(iso) : '');
        const rows: HomeRowModel[] = this.homeList === 'approvals' ? invitationRows(this.homeInvitations, date) : taskRows(this.homeOpenTaskList, date);
        this.homeListRows = rows;
    }

    /** Opens (or closes, when it is already open) the list behind a count. */
    public onHomeListRequested(kind: HomeListKind): void {
        if (this.homeList === kind) {
            this.closeHomeList();
            return;
        }
        this.homeList = kind;
        this.refreshHomeListRows();
        void this.loadHomeLists();
    }

    public closeHomeList(): void {
        this.homeList = null;
        this.RefreshView();
    }

    /** Reads the rows behind the counts. A failed read says so in the list, with a way to try again. */
    public async loadHomeLists(): Promise<void> {
        this.isLoadingHomeList = true;
        this.homeListError = '';
        this.RefreshView();
        try {
            const res = await new CollaborationClient(this.graphQLExecutor).GetHomeLists();
            if (!res.Success || !res.Invitations || !res.OpenTasks) {
                this.homeListError = `The list could not be read: ${res.ErrorMessage ?? 'the answer was incomplete'}`;
                this.logOnce('home-lists', this.homeListError);
            } else {
                this.homeInvitations = res.Invitations;
                this.homeOpenTaskList = res.OpenTasks;
                this.refreshHomeListRows();
            }
        } catch (err) {
            this.homeListError = `The list could not be read: ${err instanceof Error ? err.message : String(err)}`;
            this.logOnce('home-lists', this.homeListError);
        } finally {
            this.isLoadingHomeList = false;
            this.RefreshView();
        }
    }

    /** A row of a list opens its space on the tab where the thing is handled: People for an invitation, Work for a task. */
    public onHomeRowSelected(key: string): void {
        if (this.homeList === 'approvals') {
            const invitation = this.homeInvitations.find((i) => UUIDsEqual(i.SeatID, key));
            if (invitation) this.openSpaceOnTab(invitation.SpaceID, 'People');
        } else {
            const task = this.homeOpenTaskList.find((t) => UUIDsEqual(t.TaskID, key));
            if (task) this.openSpaceOnTab(task.SpaceID, 'Work');
        }
    }

    /** Opens a space on one of its tabs. A space that is not in the person's list says so, rather than doing nothing. */
    private openSpaceOnTab(spaceId: string, tab: 'People' | 'Work'): void {
        if (!this.rawSpaces.some((s) => UUIDsEqual(s.ID, spaceId))) {
            SharedService.Instance.CreateSimpleNotification("That space isn't in your list, so it can't be opened here.", 'warning', 5000);
            return;
        }
        this.activeView = 'space';
        this.activeTab = tab;
        void this.selectSpaceInternal(spaceId);
        this.UpdateQueryParams({ view: 'space', space: spaceId, tab: tab.toLowerCase(), conv: null, item: null });
    }

    /** Reads Home's three counts in one round trip. A read that fails shows a dash in each pill, and says so once. */
    private async loadHomeCounts(): Promise<void> {
        try {
            const res = await new CollaborationClient(this.graphQLExecutor).GetHomeCounts();
            if (!res.Success || res.SharedFiles === undefined || res.OpenTasks === undefined || res.AwaitingApproval === undefined) {
                this.logOnce('home-counts', `Home could not read its counts: ${res.ErrorMessage ?? 'the answer was incomplete'}`);
                this.homeCountsFailed = true;
                this.RefreshView();
                return;
            }
            this.homeSharedFiles = res.SharedFiles;
            this.homeOpenTasks = res.OpenTasks;
            this.homeAwaitingApproval = res.AwaitingApproval;
            this.homeCountsFailed = false;
        } catch (err) {
            this.logOnce('home-counts', `Home could not read its counts: ${err instanceof Error ? err.message : String(err)}`);
            this.homeCountsFailed = true;
        }
        this.RefreshView();
    }

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
    public isOpeningFile = false;
    public openingFileLabel = 'Opening...';

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

    /** The people in this space who are on the Shared band only: outside participants. */
    public get outsideParticipantCount(): number {
        return this.spaceMembers.filter(m => m.status === 'Active' && m.band === 'Shared').length;
    }

    /** Whether the seat the caller reaches this space through may see the Team band. Unknown until the seat is resolved: not shown. */
    public get canSeeTeamSide(): boolean {
        return this.callerSeat?.role.canSeeTeamBand ?? false;
    }

    /** Invite is offered to seats whose role may invite, in a space that is open. */
    public get canInviteHere(): boolean {
        return !this.isSpaceClosed && (this.callerSeat?.role.canInvite ?? false);
    }

    /** Share is offered to seats whose role may promote an item to the Shared band, in a space that is open. */
    public get canShareItems(): boolean {
        return !this.isSpaceClosed && (this.callerSeat?.role.canPromoteBand ?? false);
    }

    /** Upload and New are offered to seats that may contribute, in a space that is open. */
    public get canAddHere(): boolean {
        return !this.isSpaceClosed && this.canContribute;
    }

    /**
     * Whether the caller may contribute here. The seat they reach the space through decides, an inherited one on an ancestor
     * included (Ada and Sam reach Discovery through Northwind). Until it is resolved, only a seat on the space itself counts.
     */
    public get canContribute(): boolean {
        if (!this.currentUser) return false;
        if (this.callerSeat) return this.callerSeat.role.canContribute;
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

    /**
     * The Chat tab's state, decided in one place (`logic/chat-state.ts`): closed, pending until the seat is known, no seat that
     * lets them post, or open. The chat's `ReadOnly`, its note and its lock all follow it.
     */
    public get chatStateNow(): ChatState {
        return chatState({ isClosed: this.isSpaceClosed, seat: this.seatLookup, canContribute: this.canContribute, overList: !this.activeConversationId });
    }

    /** Why the conversation can't be posted in, or empty while it can or while the seat is not yet known. */
    public get chatReadOnlyNote(): string {
        const state = this.chatStateNow;
        return state.kind === 'closed' || state.kind === 'noSeat' || state.kind === 'seatUnknown' ? state.note : '';
    }

    private readonly changeDetector = inject(ChangeDetectorRef);

    /** The seat lookup failed and is tried again, for the space still shown. */
    public async onRetrySeatLookup(): Promise<void> {
        const space = this.activeSpaceRecord;
        if (!space) return;
        const spaceId = space.ID;
        this.seatLookup = 'pending';
        await this.updateBandChoice(space, () => UUIDsEqual(this.activeSpaceId, spaceId));
        await this.updateCanConfigureCurrentSpace();
        // The section is OnPush: what the lookup set after its awaits is drawn now, not at the next click
        this.changeDetector.markForCheck();
    }

    public get discussionAudienceCount(): number {
        if (this.chatAudienceBand === 'Team') {
            return this.headerStaffAvatars.length;
        }
        return this.headerTotalPeople;
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
                    color: s.Color || t?.color || '',
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

    public get filteredSpaces(): { id: string; name: string; description: string; type: string; iconClass: string; color: string; parentName?: string; isClosed: boolean }[] {
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
                    isClosed: !!s.ClosedAt,
                    name: s.Name,
                    description: s.Description || '',
                    type: typeName || 'Unknown Type',
                    iconClass: s.IconClass || t?.icon || 'fa-solid fa-compass',
                    color: s.Color || t?.color || '',
                    parentName: parent?.Name,
                };
            });
    }

    // Chat tab state
    public spaceAudienceBand: SpaceBand = 'Shared';
    public chatAudienceBand: SpaceBand = 'Shared';
    public canStartConversation = false;
    public canStartConversationKinds: CollabNewConversationDialogComponent['AllowedKinds'] = [];
    public pendingChatMessage: string | null = null;
    public pendingChatMessageConversationId: string | null = null;
    public shareDialogItemId: string | null = null;

    public get conversationParticipantCount(): number {
        return this.chatMentionPeople?.length ?? 0;
    }

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
        color: DEFAULT_TYPE_COLOR,
        backgroundImageUrl: '',
        inheritsMembership: true,
        agentRetrieval: 'Included',
        status: 'Active',
    };
    /** What the Settings screen shows and what a save is measured against: a save writes only what differs from it. */
    private settingsSession = new SettingsSession(this.spaceSettings);
    public isSavingSettings = false;
    public settingsSaveSuccess = '';
    public settingsInfoMessage = '';

    private get graphQLExecutor(): GraphQLExecutor {
        const p = this.ProviderToUse;
        if (CollaborationClient.isAvailable(p)) {
            return p;
        }
        throw new Error('Current provider does not implement GraphQLExecutor (missing ExecuteGQL)');
    }

    /** With no visible space, the caller's own seats say why: an invite waiting, or a seat that was removed. */
    private async loadOwnSeats(rv: RunView): Promise<void> {
        const userId = this.ProviderToUse.CurrentUser?.ID;
        if (!userId) return;
        try {
            const res = await rv.RunView<{ Space?: string | null; Status: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                ExtraFilter: `UserID = '${userId}'`,
                ResultType: 'simple',
                MaxRows: 50,
            });
            if (!res.Success) {
                LogError(`Failed to load the caller's own seats: ${res.ErrorMessage ?? 'unknown error'}`);
                return;
            }
            this.seats = (res.Results ?? []).map(seat => ({ spaceName: seat.Space ?? '', status: seat.Status }));
        } catch (err) {
            LogError(`Error loading the caller's own seats: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /** The load-error page's Retry: read everything again. */
    public onRetryLoad(): void {
        this.isLoading = true;
        this.loadErrorMessage = '';
        this.RefreshView();
        void this.loadRealData();
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
                LogError('Metadata lookup failed for entity MJ_BizApps_Collaboration: Spaces');
                this.loadErrorMessage = LOAD_FAILED_MESSAGE;
                this.hasAccess = false;
                return;
            }
            this.spaceEntityId = spEntity.ID;
            this.currentUser = md.CurrentUser || null;
            this.refreshMayAdminister();
            this.refreshCanCreateSpace();

            // Load SpaceTypes from CollaborationEngineBase (punch list item 54)
            await CollaborationEngineBase.Instance.Config(false, md.CurrentUser, this.ProviderToUse);
            for (const t of CollaborationEngineBase.Instance.SpaceTypes) {
                this.spaceTypeMap.set(t.ID, {
                    icon: t.IconClass || 'fa-solid fa-compass',
                    color: t.Color || '',
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
                    void this.loadHomeCounts();

                    const params = this._pendingQueryParams ?? this.GetQueryParams();
                    this._pendingQueryParams = null;
                    await this.applyQueryParams(params);
                } else {
                    this.hasAccess = false;
                    await this.loadOwnSeats(rv);
                }
            } else {
                LogError(spacesRes?.ErrorMessage || 'Failed to query collaboration spaces');
                this.loadErrorMessage = LOAD_FAILED_MESSAGE;
                this.hasAccess = false;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error loading collaboration data: ' + msg);
            this.loadErrorMessage = LOAD_FAILED_MESSAGE;
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
                color: space.Color || typeDef?.color || '',
                iconClass: space.IconClass || typeDef?.icon || 'fa-solid fa-compass',
                level,
                hasChildren: children.length > 0,
                isExpanded: true,
                ...railFlags(space),
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

    /** True while a selection reads its space: the content area shows a loader instead of the last space's lists. */
    private readonly selectionLoading = new LoadingFlag();
    public get isLoadingSpace(): boolean {
        return this.selectionLoading.Active;
    }

    /** `quiet` re-reads the space that is already shown without swapping its content for the loader (Settings keeps its form). */
    private async selectSpaceInternal(spaceId: string, quiet = false): Promise<void> {
        const requestId = ++this.selectSpaceRequestId;
        const endLoading = quiet ? () => undefined : this.selectionLoading.Begin();
        this.RefreshView();
        try {
            await this.selectSpaceBody(spaceId, requestId, quiet);
        } finally {
            endLoading();
            this.RefreshView();
        }
    }

    /** The header of the space shown, from a row: its name, type, icon, colour, status and breadcrumbs. Used for the cached row, then the fresh one. */
    private showHeaderFor(space: RawSpaceRecord): void {
        const typeDef = this.spaceTypeMap.get(space.SpaceTypeID);
        const resolvedType = space.SpaceType || typeDef?.name;
        if (!resolvedType) {
            this.logOnce(`type:${space.ID}`, `Missing space type for space ID: ${space.ID}`);
        }
        this.spaceTitle = space.Name;
        this.spaceSubtitle = space.Description || '';
        this.spaceStatus = space.ClosedAt ? 'Closed' : 'Active';
        this.spaceTypeName = resolvedType || 'Unknown Type';
        this.headerTypeIcon = space.IconClass || typeDef?.icon || 'fa-solid fa-compass';
        this.headerTypeColor = space.Color || typeDef?.color || '';
        this.headerBackgroundImageUrl = space.BackgroundImageURL || null;

        // Build breadcrumb lineage
        const lineage: BreadcrumbItem[] = [];
        let curr: RawSpaceRecord | undefined = space;
        while (curr) {
            lineage.unshift({ label: curr.Name, spaceId: curr.ID });
            curr = curr.ParentID ? this.rawSpaces.find(s => UUIDsEqual(s.ID, curr!.ParentID)) : undefined;
        }
        this.breadcrumbs = [{ label: 'Spaces' }, ...lineage];
    }

    /** Everything the last space left on screen goes, and the header shows the new space's own name at once, from what is already loaded. */
    private resetForSelection(spaceId: string): void {
        this.activeConversationId = '';
        this.overviewRoomMessages = [];
        this.spaceConversations = [];
        this.bandChoice = null;
        this.callerSeat = null;
        this.seatLookup = 'pending';
        this.typeDefaultBand = null;
        this.inviteOutcome = null;

        // Reset host rules immediately so previous space's buttons / ask box do not linger
        this.hostRulesRequestId++;
        this.chatAgentReplyMode = 'MentionOnly';
        this.chatAllowedAgentIds = [];
        this.chatDefaultAgentId = null;
        this.chatDefaultAgentName = null;
        this.chatAgentHistoryFrom = null;
        this.chatMentionPeople = [];
        this.canStartConversation = false;
        this.canStartConversationKinds = [];

        // Everything else the previous space left on screen goes too: its people, library, tasks and the right to configure
        this.spaceMembers = [];
        this.headerTotalPeople = 0;
        this.headerStaffAvatars = [];
        this.headerOutsideAvatars = [];
        this.headerAudienceSummary = '';
        this.libraryRows = [];
        this.libraryTotalCount = 0;
        this.librarySharedCount = 0;
        this.libraryTeamCount = 0;
        this.overviewSharedItems = [];
        this.overviewTeamItems = [];
        this.libraryCollections = [];
        this.librarySmartViews = [];
        this.spaceTasks = [];
        this.taskCount = 0;
        this.canConfigureCurrentSpace = false;
        this.canReopenCurrentSpace = false;
        this.canCloseCurrentSpace = false;
        // The last space's save message must not greet the next space's Settings, its drawer is closed, and both bands start narrow
        Object.assign(this, freshSelectionState());
        this.spaceTabModel = null;
        this.overviewContributedCards = [];
        this.uiDriver = UIDriverRegistry.Instance.GetDefaultDriver();
        this.overviewSubSpaces = [];
        this.clearDetails();
        this.detailsMessage = '';
        this.detailsError = '';
        // The header shows the space's own name at once, from what is already loaded
        const cachedSpace = this.rawSpaces.find(sp => UUIDsEqual(sp.ID, spaceId));
        if (cachedSpace) {
            // The tabs come from the cached row too, so the header and the rail don't show the default tabs until the read returns
            this.buildSpaceUi(cachedSpace);
            this.showHeaderFor(cachedSpace);
        }
        this.previewRecentUses = [];
        this.previewMeta = '';
        this.previewBandLabel = '';
        this.previewAudienceSub = '';
    }

    private async selectSpaceBody(spaceId: string, requestId: number, quiet: boolean): Promise<void> {
        this.activeSpaceId = spaceId;
        this._loadedSpaceId = spaceId;
        // A quiet re-read names the conversation that is open as the one to keep, so it doesn't open the newest instead
        if (quiet && this.activeConversationId) this._pendingConvId ??= this.activeConversationId;
        // A quiet re-read of the space already shown (after a close or a reopen) keeps everything on screen until the new reads
        // arrive: Settings stays in the tabs, and the counts don't fall to 0. A new selection starts from nothing.
        if (!quiet) this.resetForSelection(spaceId);

        // Refresh space record from server to ensure ClosedAt and status are completely fresh
        try {
            const rv = new RunView(this.RunViewToUse);
            const freshSpaceRes = await rv.RunView<RawSpaceRecord>({
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                ExtraFilter: `ID = '${spaceId}'`,
                ResultType: 'simple',
                MaxRows: 1,
            });
            if (this.selectSpaceRequestId !== requestId || !UUIDsEqual(this.activeSpaceId, spaceId)) {
                return;
            }
            if (!freshSpaceRes?.Success) {
                LogError(`Failed to refresh space record for ${spaceId}: ${freshSpaceRes?.ErrorMessage || 'Unknown error'}`);
            } else if (freshSpaceRes.Results?.[0]) {
                const fresh = freshSpaceRes.Results[0];
                const idx = this.rawSpaces.findIndex(s => UUIDsEqual(s.ID, spaceId));
                if (idx >= 0) {
                    this.rawSpaces[idx] = { ...this.rawSpaces[idx], ...fresh };
                }
            } else {
                LogError(`Failed to refresh space record for ${spaceId}: space not found`);
            }
        } catch (e) {
            LogError(`Failed to refresh space record for ${spaceId}: ${e}`);
        }

        if (this.selectSpaceRequestId !== requestId || !UUIDsEqual(this.activeSpaceId, spaceId)) {
            return;
        }

        const space = this.rawSpaces.find(s => UUIDsEqual(s.ID, spaceId));
        if (!space) return;

        const typeDef = this.spaceTypeMap.get(space.SpaceTypeID);
        const resolvedType = space.SpaceType || typeDef?.name;
        this.showHeaderFor(space);

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
                color: c.Color || cType?.color || '',
                description: c.Description || '',
            };
        });

        // Initialize space settings model
        this.spaceSettings = buildSettingsModel({ ...space, StatusName: CollaborationEngineBase.Instance.EffectiveStatusForSpace(space)?.Name ?? null }, {
            name: resolvedType || '',
            icon: typeDef?.icon ?? null,
            color: typeDef?.color ?? null,
        });
        this.settingsSession.Open(this.spaceSettings);
        this.spaceSettings = this.settingsSession.Shown;
        // What the type's UI driver and other apps contribute: the tabs and the Overview cards
        this.buildSpaceUi(space);
        // The tabs the space has may differ from the ones the last space's URL asked for
        this.setTab(this.activeTab);

        await this.updateCanConfigureCurrentSpace();
        if (this.selectSpaceRequestId !== requestId || !UUIDsEqual(this.activeSpaceId, spaceId)) return;
        await this.loadSpaceDetails(space, () => isSelectionCurrent(requestId, this.selectSpaceRequestId, spaceId, this.activeSpaceId));
        if (this.selectSpaceRequestId !== requestId || !UUIDsEqual(this.activeSpaceId, spaceId)) return;
        await this.updateBandChoice(space, () => isSelectionCurrent(requestId, this.selectSpaceRequestId, spaceId, this.activeSpaceId));

        // Each loader checks the selection itself, before it writes: a slow read for a space
        // the person has already left must not put its lists under the space they're in now
        const isCurrent = (): boolean => isSelectionCurrent(requestId, this.selectSpaceRequestId, spaceId, this.activeSpaceId);
        const pendingConvId = this._pendingConvId ?? undefined;
        await this.loadSpaceItems(spaceId, isCurrent);
        if (!isCurrent()) return;
        await this.loadSpaceConversations(spaceId, isCurrent, pendingConvId);
        if (!isCurrent()) return;
        // Cleared only once this selection is known to be the current one, and only if it is still the value applied: a deep link
        // that arrived while the load ran is a different one, and waits for its own selection
        if (this._pendingConvId === (pendingConvId ?? null)) this._pendingConvId = null;
        await this.loadSpaceTasks(spaceId, isCurrent);
        if (!isCurrent()) return;
        await this.loadSpaceMembers(spaceId, isCurrent);
        if (!isCurrent()) return;
        await this.loadSpaceChatHostRules(spaceId, this.activeConversationId || undefined);
        if (!isCurrent()) return;

        this.syncStateWithAgent();
        this.RefreshView();
    }

    private clearDetails(): void {
        this.spaceDetails = null;
        this.detailsView = null;
        this.hasDetails = false;
        this.detailsIncomplete = false;
    }

    /**
     * Reads the details a space keeps in its subtype, when its type names one, and asks the type's UI driver how to show them.
     * A quiet re-read keeps the details being edited: they are read again only when nothing was changed.
     */
    private async loadSpaceDetails(space: RawSpaceRecord, isCurrent: () => boolean): Promise<void> {
        const type = CollaborationEngineBase.Instance.SpaceTypeById(space.SpaceTypeID);
        const user = this.currentUser;
        if (!type?.SpaceExtensionEntity || !user) {
            this.clearDetails();
            return;
        }
        if (this.spaceDetails?.Dirty) return;
        try {
            const details = await SpaceDetails.Load(this.ProviderToUse, user, space.ID);
            if (!isCurrent()) return;
            const uiContext = this.uiContext;
            // The driver's hidden columns decide which of the form's sections can be shown alone
            const descriptor = details && uiContext ? this.detailsDescriptor(this.uiDriver, uiContext, details.Leaf.EntityInfo.Name) : undefined;
            const view = details && uiContext
                ? await planDetailsView({
                    fields: details.Fields,
                    formSections: details.FormSectionsHiding(descriptor?.hiddenFieldNames),
                    descriptor,
                    hasForm: () => this.hasFormFor(details.Leaf),
                })
                : null;
            if (!isCurrent()) return;
            this.spaceDetails = view ? details : null;
            this.detailsView = view;
            this.hasDetails = !!view;
            this.detailsTitle = `${type.Name} details`;
            this.aboutTitle = `About this ${type.Name.toLowerCase()}`;
            this.detailsIncomplete = (this.spaceDetails?.MissingDetails().length ?? 0) > 0;
        } catch (err) {
            if (!isCurrent()) return;
            this.clearDetails();
            this.logOnce(`details:${space.ID}`, `The details of space ${space.ID} could not be read: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /** What a type's UI driver makes of its subtype's details. A driver that throws leaves the default: the subtype's form, or a field for each column. */
    private detailsDescriptor(driver: BaseSpaceTypeUIDriver, ctx: SpaceUIContext, entityName: string): SpaceDetailsFormDescriptor | undefined {
        const fallback: SpaceDetailsFormDescriptor = { entityName };
        try {
            return driver.GetDetailsForm(ctx, fallback);
        } catch (err) {
            this.logOnce(`details-form:${ctx.spaceTypeCode}`, `The UI driver of space type '${ctx.spaceTypeCode}' failed building the details form: ${err instanceof Error ? err.message : String(err)}`);
            return fallback;
        }
    }

    public onDetailChanged(): void {
        this.detailsMessage = '';
        this.detailsError = '';
        this.detailsIncomplete = (this.spaceDetails?.MissingDetails().length ?? 0) > 0;
        this.RefreshView();
    }

    public onDiscardDetails(): void {
        this.spaceDetails?.Discard();
        this.detailsIncomplete = (this.spaceDetails?.MissingDetails().length ?? 0) > 0;
        this.detailsMessage = '';
        this.detailsError = '';
        this.RefreshView();
    }

    public async onSaveDetails(): Promise<void> {
        const details = this.spaceDetails;
        if (!details || this.isSavingDetails || !this.settingsAccessNow.canEdit) return;
        const stillShown = this.currentSelection();
        this.isSavingDetails = true;
        this.detailsMessage = '';
        this.detailsError = '';
        this.RefreshView();
        try {
            const outcome = await details.Save();
            if (!stillShown()) return;
            if (outcome.ok) {
                this.detailsMessage = 'Details saved.';
                SharedService.Instance.CreateSimpleNotification('Details saved.', 'info', 3000);
            } else {
                LogError(`Failed to save the details of space ${this.activeSpaceId}: ${outcome.message}`);
                this.detailsError = outcome.message;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError(`Error saving the details of space ${this.activeSpaceId}: ${msg}`);
            if (stillShown()) this.detailsError = `Could not save the details: ${msg}`;
        } finally {
            this.isSavingDetails = false;
            this.RefreshView();
        }
    }

    /** A test that is true only while the space and the selection request in force now are still the ones in force. */
    private currentSelection(): () => boolean {
        const requestId = this.selectSpaceRequestId;
        const spaceId = this.activeSpaceId;
        return () => isSelectionCurrent(requestId, this.selectSpaceRequestId, spaceId, this.activeSpaceId);
    }

    private async loadSpaceItems(spaceId: string, isCurrent: () => boolean): Promise<void> {
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
                __mj_UpdatedAt: string;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Items',
                ExtraFilter: `SpaceID = '${spaceId}'`,
                OrderBy: '__mj_UpdatedAt DESC',
                ResultType: 'simple',
                MaxRows: 100,
            });

            if (!isCurrent()) return;
            if (!itemsRes?.Success) {
                LogError(`Failed to load space items for space ${spaceId}: ${itemsRes?.ErrorMessage ?? 'unknown error'}`);
            }
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
                } else {
                    LogError(`Failed to read the files behind space ${spaceId}'s items: ${filesRes?.ErrorMessage ?? 'unknown error'}`);
                }
            }

            if (!isCurrent()) return;
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
                    updatedAt: item.__mj_UpdatedAt,
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
                        canShare: this.canShareItems,
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
                ...(this.canSeeTeamSide ? [{ id: 'team', name: 'Team only', iconClass: 'fa-solid fa-lock', count: team.length }] : []),
            ];
        } catch (err) {
            LogError('Error loading space items: ' + (err instanceof Error ? err.message : String(err)));
            if (!isCurrent()) return;
            this.libraryRows = [];
            this.libraryTotalCount = 0;
            this.librarySharedCount = 0;
            this.libraryTeamCount = 0;
            this.overviewSharedItems = [];
            this.overviewTeamItems = [];
        }
    }

    private async loadSpaceConversations(spaceId: string, isCurrent: () => boolean, preferredConvId?: string): Promise<void> {
        if (!isValidUuid(spaceId)) return;
        try {
            const rv = new RunView(this.RunViewToUse);
            const filter = this.isSpaceClosed
                ? `SpaceID = '${spaceId}' AND Status IN ('Active', 'Archived')`
                : `SpaceID = '${spaceId}' AND Status = 'Active'`;

            const spaceChatsRes = await rv.RunView<{
                ID: string;
                SpaceID: string;
                ConversationID: string;
                Name: string;
                Subject?: string | null;
                Kind: string;
                Status: string;
                __mj_CreatedAt: string;
                __mj_UpdatedAt: string;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                ExtraFilter: filter,
                OrderBy: '__mj_UpdatedAt DESC',
                Fields: ['ID', 'SpaceID', 'ConversationID', 'Name', 'Subject', 'Kind', 'Status', '__mj_CreatedAt', '__mj_UpdatedAt'],
                ResultType: 'simple',
                MaxRows: 100,
            });

            if (!isCurrent()) return;
            let items: SpaceConversationItem[] = [];
            if (spaceChatsRes?.Success && spaceChatsRes.Results) {
                items = buildConversationEntries(spaceChatsRes.Results);
            } else if (!spaceChatsRes?.Success) {
                LogError(`Failed to load space conversations for space ${spaceId}: ${spaceChatsRes?.ErrorMessage ?? 'unknown error'}`);
            }
            const seenConvIds = new Set(items.map(i => NormalizeUUID(i.id)));

            if (seenConvIds.size > 0) {
                try {
                    const convIds = Array.from(seenConvIds);
                    const convRes = await rv.RunView<{ ID: string; __mj_UpdatedAt: string }>({
                        EntityName: 'MJ: Conversations',
                        ExtraFilter: `ID IN ('${convIds.join("','")}')`,
                        Fields: ['ID', '__mj_UpdatedAt'],
                        OrderBy: '__mj_UpdatedAt DESC',
                        ResultType: 'simple',
                        MaxRows: convIds.length,
                    });
                    if (convRes?.Success && convRes.Results) {
                        const orderMap = new Map<string, number>();
                        convRes.Results.forEach((c, idx) => orderMap.set(c.ID.toLowerCase(), idx));
                        items.sort((a, b) => {
                            const orderA = orderMap.get(a.id.toLowerCase()) ?? 9999;
                            const orderB = orderMap.get(b.id.toLowerCase()) ?? 9999;
                            return orderA - orderB;
                        });
                    } else if (!convRes?.Success) {
                        LogError(`Failed to read conversations for sorting: ${convRes?.ErrorMessage ?? 'unknown error'}`);
                    }
                } catch (sortErr) {
                    LogError('Failed to sort conversations by __mj_UpdatedAt: ' + String(sortErr));
                }
            }

            if (!isCurrent()) return;
            this.spaceConversations = items;

            this.activeConversationId = chooseActiveConversation(items, preferredConvId)?.id ?? '';

            const activeItem = items.find(i => UUIDsEqual(i.id, this.activeConversationId));
            // No conversation to read a band from (or a failed read) claims no audience: Team, the narrowest
            this.chatAudienceBand = activeItem && activeItem.band !== 'Team' ? 'Shared' : 'Team';

            if (this.activeConversationId) {
                await this.loadOverviewMessages(this.activeConversationId, isCurrent);
            } else {
                this.overviewRoomMessages = [];
            }
        } catch (err) {
            LogError('Error loading space conversations: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    private readonly overviewReads = new LatestOnly();

    /**
     * Loads the Overview's latest messages for a conversation. Only the newest read of these may write, and only while the
     * space it was started for is still the one shown; a failed read is logged and clears the messages of the conversation
     * before it, which would otherwise stay under the new one.
     */
    private async loadOverviewMessages(convId: string, isCurrent: () => boolean): Promise<void> {
        if (!isValidUuid(convId)) return;
        const isLatest = this.overviewReads.Begin();
        try {
            const rv = new RunView(this.RunViewToUse);
            await guardedLoad(
                () => isLatest() && isCurrent(),
                async () => {
                    const res = await rv.RunView<{
                        ID: string;
                        Role: string;
                        Message: string;
                        User?: string;
                        UserID?: string | null;
                        __mj_CreatedAt: string;
                    }>({
                        EntityName: 'MJ: Conversation Details',
                        ExtraFilter: `ConversationID = '${convId}'`,
                        OrderBy: '__mj_CreatedAt DESC',
                        ResultType: 'simple',
                        MaxRows: 25,
                    });
                    // Logged here, in the read, so a failed read is reported even when the person has moved on
                    if (!res.Success) LogError(`Failed to load the Overview's messages for conversation ${convId}: ${res.ErrorMessage ?? 'unknown error'}`);
                    return res;
                },
                (detailRes) => {
                    if (!detailRes.Success || !detailRes.Results) {
                        this.overviewRoomMessages = [];
                        return;
                    }
                    const parser = new MentionParser();
                    this.overviewRoomMessages = toOverviewMessages(
                        detailRes.Results,
                        (message) => parser.ToPlainText(message),
                        (userId) => this.isOutsideUser(userId),
                        (iso) => formatDateTime(iso),
                    );
                },
            );
        } catch (err) {
            LogError('Error loading overview messages: ' + (err instanceof Error ? err.message : String(err)));
            if (isLatest() && isCurrent()) this.overviewRoomMessages = [];
        }
    }

    private async loadSpaceTasks(spaceId: string, isCurrent: () => boolean): Promise<void> {
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

            if (!isCurrent()) return;
            if (!itemsRes?.Success) {
                LogError(`Failed to load task items for space ${spaceId}: ${itemsRes?.ErrorMessage ?? 'unknown error'}`);
            }
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

            if (!isCurrent()) return;
            if (!tasksRes?.Success) {
                LogError(`Failed to load tasks for space ${spaceId}: ${tasksRes?.ErrorMessage ?? 'unknown error'}`);
                this.spaceTasks = [];
                this.taskCount = 0;
            } else if (tasksRes.Results) {
                this.spaceTasks = tasksRes.Results.map(t => {
                    const spaceItem = taskItemMap.get(t.ID.toLowerCase());
                    const assigned = t.AssignedTo || undefined;
                    return {
                        id: t.ID,
                        name: t.Name,
                        description: t.Description || undefined,
                        status: t.Status || 'Open',
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
            if (isCurrent()) {
                this.spaceTasks = [];
                this.taskCount = 0;
            }
        }
    }

    /** The person's own Invited or Removed seat on this space, carried beside the seat they reach through, with the actions on it. */
    private ownSeatModel(
        seat: { ID: string; UserID: string; Status: string; SpaceRoleTypeID?: string | null },
        all: ReadonlyArray<{ row: { UserID: string; Status: string; SpaceRoleTypeID?: string | null }; inherited: boolean }>,
    ): NonNullable<SpaceMemberModel['ownSeat']> {
        const roleType = seat.SpaceRoleTypeID ? CollaborationEngineBase.Instance.SpaceRoleTypeById(seat.SpaceRoleTypeID) : undefined;
        const actions = this.actionsFor(seat, roleType, false, all);
        return { id: seat.ID, status: seat.Status, roleName: roleType?.Name ?? 'Member', roleCode: roleType?.Code ?? 'member', canApprove: actions.canApprove, canRemove: actions.canRemove };
    }

    /** The seat actions to offer on one of this space's own seats, by the gate's rules (see `seatActions`). */
    private actionsFor(
        seat: { ID: string; UserID: string; Status: string },
        roleType: mjBizAppsCollaborationSpaceRoleTypeEntity | null | undefined,
        inherited: boolean,
        all: ReadonlyArray<{ row: { UserID: string; Status: string; SpaceRoleTypeID?: string | null }; inherited: boolean }>,
    ): { canApprove: boolean; canRemove: boolean; canChangeRole: boolean } {
        const none = { canApprove: false, canRemove: false, canChangeRole: false };
        const mine = this.callerSeat?.role;
        if (inherited || !mine || !roleType) return none;
        const spaceType = CollaborationEngineBase.Instance.SpaceTypeById(this.activeSpaceRecord?.SpaceTypeID);
        const activeOwners = all.filter(a => !a.inherited && a.row.Status === 'Active'
            && !!a.row.SpaceRoleTypeID && CollaborationEngineBase.Instance.SpaceRoleTypeById(a.row.SpaceRoleTypeID)?.IsOwnerRole);
        const actions = seatActions({
            caller: mine,
            typeApprovesInvites: spaceType?.InviteApproval !== 'AutoApprove',
            target: {
                status: seat.Status,
                role: {
                    level: roleType.Level, maxGrantableLevel: roleType.MaxGrantableLevel, canInvite: roleType.CanInvite, canPromoteBand: roleType.CanPromoteBand,
                    canSeeTeamBand: roleType.CanSeeTeamBand, isOwnerRole: roleType.IsOwnerRole, canContribute: roleType.CanContribute,
                },
                isOnlyActiveOwner: roleType.IsOwnerRole && activeOwners.length === 1 && UUIDsEqual(activeOwners[0].row.UserID, seat.UserID),
            },
        });
        return { canApprove: actions.approve, canRemove: actions.remove, canChangeRole: actions.changeRole };
    }

    private async loadSpaceMembers(spaceId: string, isCurrent: () => boolean): Promise<void> {
        if (!isValidUuid(spaceId)) return;
        try {
            const rv = new RunView(this.RunViewToUse);
            // Everyone who reaches the space: its own seats, then each ancestor's while the chain inherits, the nearest seat per person
            const chain = accessChain(spaceId, this.rawSpaces.map(sp => ({
                ID: sp.ID,
                Name: sp.Name,
                ParentID: sp.ParentID ?? null,
                InheritsMembership: !!sp.InheritsMembership,
                ClosedAt: sp.ClosedAt,
                Status: CollaborationEngineBase.Instance.StatusReachForSpace(sp),
            })));
            if (chain.length === 0) chain.push({ id: spaceId, name: '' });
            const membersRes = await rv.RunView<{
                ID: string;
                SpaceID: string;
                UserID: string;
                User?: string | null;
                UserEmail?: MJUserEntity['Email'];
                SpaceRoleType?: string | null;
                SpaceRoleTypeID?: string | null;
                Space?: string | null;
                Band: SpaceBand;
                Status: string;
                __mj_CreatedAt: string;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                // Every seat, not only Active ones: the People tab shows invited and removed seats, and re-inviting
                // someone needs to find their old one. The header's counts leave the others out (summarizeSeats).
                ExtraFilter: `SpaceID IN (${chain.map(c => `'${c.id}'`).join(',')})`,
                ResultType: 'simple',
                MaxRows: 500,
            });

            if (!isCurrent()) return;
            if (!membersRes?.Success || !membersRes.Results) {
                // The previous space's people must not stay under this one
                LogError(`Failed to load members for space ${spaceId}: ${membersRes?.ErrorMessage ?? 'unknown error'}`);
                this.spaceMembers = [];
                this.headerTotalPeople = 0;
                this.headerStaffAvatars = [];
                this.headerOutsideAvatars = [];
                this.headerAudienceSummary = '';
                this.spaceAudienceBand = 'Team'; // no band is claimed when the seats could not be read
                return;
            }
            if (membersRes.Results) {
                const reached = nearestSeats(membersRes.Results, chain);
                const userIds = [...new Set(reached.map(r => r.row.UserID).filter(Boolean))];
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

                if (!isCurrent()) return;
                this.spaceMembers = reached.map(({ row: m, from, inherited, ownSeat }, _i, all) => {
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
                        inherited,
                        source: inherited ? (m.Space || from.name || 'a parent space') : undefined,
                        ownSeat: ownSeat ? this.ownSeatModel(ownSeat, all) : undefined,
                        ...this.actionsFor(m, roleType, inherited, reached),
                    };
                });

                const seats = summarizeSeats(this.spaceMembers);
                this.headerTotalPeople = seats.totalPeople;
                this.headerStaffAvatars = seats.staffAvatars;
                this.headerOutsideAvatars = seats.outsideAvatars;
                this.headerAudienceSummary = seats.audienceSummary;
                this.spaceAudienceBand = seats.audienceBand;
                // The Discussion card's outside ring needs the seats: map its messages again now that they are here
                if (this.activeConversationId) void this.loadOverviewMessages(this.activeConversationId, isCurrent);
            }
        } catch (err) {
            LogError('Error loading space members: ' + (err instanceof Error ? err.message : String(err)));
            if (isCurrent()) {
                this.spaceMembers = [];
                this.headerTotalPeople = 0;
                this.headerStaffAvatars = [];
                this.headerOutsideAvatars = [];
                this.headerAudienceSummary = '';
            }
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
        return formatDateLocale(isoStr);
    }

    /** Whether the user holds an Active outside (Shared band) seat on the space shown. */
    private isOutsideUser(userId: string): boolean {
        return this.spaceMembers.some((m) => m.status === 'Active' && m.band === 'Shared' && UUIDsEqual(m.userId, userId));
    }

    public onInviteClicked(): void {
        this.onTabSelectRequested('People');
    }

    public onNewClicked(): void {
        if (!this.hasTab('Work')) return;
        this.onTabSelectRequested('Work');
    }

    public override ngOnInit(): void {
        super.ngOnInit();
        const params = this.GetQueryParams();
        if (params['tab']) {
            this.activeTab = tabIdFromUrl(params['tab']);
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
            this.activeTab = tabIdFromUrl(params['tab']);
        }

        if (params['conv'] && isValidUuid(params['conv'])) {
            const prevConvId = this.activeConversationId;
            this._pendingConvId = params['conv'];
            const match = this.spaceConversations.find(c => UUIDsEqual(c.id, params['conv']));
            if (match) {
                // Applied: the next selection must not bring this conversation back
                this._pendingConvId = null;
                this.activeConversationId = params['conv'];
                this.chatAudienceBand = match.band === 'Team' ? 'Team' : 'Shared';
                if (this.activeSpaceId && !UUIDsEqual(prevConvId, params['conv'])) {
                    // Back and forward change the conversation in the URL: the Overview's messages follow it, so the new band
                    // is never shown over the previous conversation's messages
                    void this.loadOverviewMessages(params['conv'], this.currentSelection());
                    void this.loadSpaceChatHostRules(this.activeSpaceId, params['conv']);
                }
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

        // A tab the type or another app contributed can only be resolved once the space's tabs are built
        if (this.spaceTabModel) {
            const named = params['tab'] ? resolveTabId(this.spaceTabModel, params['tab']) : null;
            if (named) this.activeTab = named;
            else if (!resolveTabId(this.spaceTabModel, this.activeTab)) this.activeTab = 'Overview';
            // A link to a tab the space doesn't have: the URL says the tab that opened
            if (params['tab'] && !named) this.UpdateQueryParams({ tab: this.activeTab.toLowerCase() });
        }

        if (params['item'] && isValidUuid(params['item'])) {
            this.selectedItemId = params['item'];
            this.isDrawerOpen = true;
            void this.showPreviewFor(params['item']);
        } else if (this.isDrawerOpen && this.spaceTabModel) {
            // Back to a URL with no item: the drawer closes, and shows nothing of the item it held
            this.isDrawerOpen = false;
            this.selectedItemId = null;
            this.previewRecentUses = [];
        }

        if (this.activeTab === 'Settings' && !this.showsSettings) {
            this.activeTab = 'Overview';
            this.UpdateQueryParams({ tab: 'overview' });
        }

        this.syncStateWithAgent();
        this.RefreshView();
    }

    /** The rail on the page shown: the home rail on Home and the global pages, the space rail on a space. */
    public get railMode(): 'home' | 'space' {
        return railModeFor(this.activeView);
    }

    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

    /** The Active Spaces pill on Home: the directory of spaces is on Home itself, so it takes the person to its search box. */
    public onHomeSpacesRequested(): void {
        const search = (this.elementRef.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.home-search-input');
        search?.scrollIntoView({ block: 'center' });
        search?.focus();
    }

    public onTabSelectRequested(tabId: string): void {
        this.activeView = 'space';
        if (tabId === 'Settings' && !this.showsSettings) {
            tabId = 'Overview';
            SharedService.Instance.CreateSimpleNotification('You do not have permission to configure this space.', 'warning', 3000);
        }
        this.setTab(tabId);
        this.settingsSaveSuccess = '';
        this.settingsInfoMessage = '';
        // The URL names the tab that opened, which is the Overview when the type has no such tab
        this.UpdateQueryParams({ view: 'space', tab: this.activeTab.toLowerCase() });
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
        this.UpdateQueryParams({ view: 'space', space: spaceId, tab: 'overview', conv: null, item: null });
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
        this.setTab('Chat');
        const item = this.spaceConversations.find(c => UUIDsEqual(c.id, this.activeConversationId));
        // With no conversation open the band stays what it was: "no conversation" is not Shared
        if (item) this.chatAudienceBand = item.band === 'Team' ? 'Team' : 'Shared';
        this.UpdateQueryParams({ tab: this.activeTab.toLowerCase(), conv: this.activeConversationId || null });
        this.RefreshView();
    }

    public onSpaceConversationSelected(convId: string): void {
        this.activeView = 'space';
        this.activeConversationId = convId;
        const item = this.spaceConversations.find(c => UUIDsEqual(c.id, convId));
        // A conversation the list doesn't hold says nothing of its band: the band stays what it was
        if (item) this.chatAudienceBand = item.band === 'Team' ? 'Team' : 'Shared';
        this.setTab('Chat');
        this.UpdateQueryParams({ view: 'space', tab: this.activeTab.toLowerCase(), conv: convId });
        void this.loadOverviewMessages(convId, this.currentSelection());
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
        // A space whose type has no Library has no drawer to open
        if (!this.hasTab('Library')) return;
        this.selectedItemId = item.id;
        this.isDrawerOpen = true;
        this.setTab('Library');
        this.UpdateQueryParams({ tab: 'library', item: item.id });
        void this.showPreviewFor(item.id);
        this.RefreshView();
    }

    public onRowSelected(row: LibraryRowModel): void {
        this.selectedItemId = row.id;
        this.isDrawerOpen = true;
        this.UpdateQueryParams({ item: row.id });
        void this.showPreviewFor(row.id);
        this.RefreshView();
    }

    private readonly previewReads = new LatestOnly();

    /** Fills the drawer for one item: what it is, who can see it, and who has used it. Whatever the last item showed is dropped first. */
    private async showPreviewFor(itemId: string): Promise<void> {
        const isLatest = this.previewReads.Begin();
        this.previewRecentUses = [];
        const row = this.libraryRows.find((r) => UUIDsEqual(r.id, itemId));
        this.previewMeta = row ? `${row.folder} · ${row.who}, ${row.when}` : '';
        this.previewBandLabel = row?.band === 'Team' ? 'Team only' : 'Shared';
        this.previewAudienceSub = row?.band === 'Team'
            ? 'Only the team can see this'
            : `${this.headerTotalPeople} ${this.headerTotalPeople === 1 ? 'person' : 'people'} can see this`;
        if (!row || !isValidUuid(itemId)) return;
        try {
            const rv = new RunView(this.RunViewToUse);
            await guardedLoad(
                () => isLatest() && !!this.selectedItemId && UUIDsEqual(this.selectedItemId, itemId),
                async () => {
                    const res = await rv.RunView<{ ID: string; UserID: string; User?: string; UsedAt: string; Kind: string }>({
                        EntityName: 'MJ_BizApps_Collaboration: Item Uses',
                        ExtraFilter: `ItemID = '${itemId}'`,
                        OrderBy: 'UsedAt DESC',
                        ResultType: 'simple',
                        MaxRows: 5,
                    });
                    if (!res.Success) LogError(`Failed to load the recent use of item ${itemId}: ${res.ErrorMessage ?? 'unknown error'}`);
                    return res;
                },
                (res) => {
                    if (!res.Success) return;
                    this.previewRecentUses = (res.Results ?? []).map((use) => ({
                        id: use.ID,
                        text: `${this.currentUser && UUIDsEqual(use.UserID, this.currentUser.ID) ? 'You' : (use.User || 'Someone')} opened this`,
                        timestamp: formatDateTime(use.UsedAt),
                    }));
                    this.RefreshView();
                },
            );
        } catch (err) {
            LogError(`Error loading the recent use of item ${itemId}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    public async onOpenFileRequested(fileId?: string): Promise<void> {
        if (!fileId) return;
        const targetItem = this.libraryRows.find(r => UUIDsEqual(r.id, fileId) || UUIDsEqual(r.fileId, fileId));
        if (!targetItem) {
            SharedService.Instance.CreateSimpleNotification('File not found in this space library.', 'error', 5000);
            return;
        }

        this.isOpeningFile = true;
        this.openingFileLabel = 'Opening…';
        this.RefreshView();
        try {
            const nav = this.navigationService;
            const outcome = await openSpaceFile(
                {
                    open: nav ? (id) => { nav.OpenEntityRecord('MJ: Files', CompositeKey.FromID(id)); } : null,
                    recordOpen: (itemId) => this.recordSpaceItemOpen(itemId),
                },
                { id: targetItem.id, fileId: targetItem.fileId || fileId },
            );
            if (!outcome.ok) {
                LogError(`Opening a space file failed: ${outcome.message}`);
                SharedService.Instance.CreateSimpleNotification(outcome.message, 'error', 5000);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error opening space file: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Error opening file: ' + msg, 'error', 5000);
        } finally {
            this.isOpeningFile = false;
            this.RefreshView();
        }
    }

    /** Records that the person opened the item, once, as them. A refused or failed write is logged, and the open is not shown as recorded. */
    private async recordSpaceItemOpen(itemId: string): Promise<boolean> {
        const fields = openUseFields(itemId, this.activeSpaceRecord?.ID, this.currentUser?.ID, new Date());
        if (!fields) {
            LogError(`The open of item ${itemId} was not recorded: the person or the space is not known.`);
            return false;
        }
        try {
            const use = await this.ProviderToUse.GetEntityObject<mjBizAppsCollaborationItemUseEntity>('MJ_BizApps_Collaboration: Item Uses', this.currentUser ?? undefined);
            use.NewRecord();
            use.ItemID = fields.ItemID;
            use.SpaceID = fields.SpaceID;
            use.UserID = fields.UserID;
            use.UsedAt = fields.UsedAt;
            use.Kind = fields.Kind;
            if (!(await use.Save())) {
                LogError(`The open of item ${itemId} was not recorded: ${use.LatestResult?.CompleteMessage ?? 'the save was refused'}`);
                return false;
            }
            if (this.selectedItemId && UUIDsEqual(this.selectedItemId, itemId)) {
                this.previewRecentUses = [{ id: use.ID, text: 'You opened this', timestamp: formatDateTime(new Date()) }, ...this.previewRecentUses];
            }
            return true;
        } catch (err) {
            LogError(`The open of item ${itemId} was not recorded: ${err instanceof Error ? err.message : String(err)}`);
            return false;
        }
    }

    public onCloseDrawerRequested(): void {
        this.isDrawerOpen = false;
        this.selectedItemId = null;
        this.UpdateQueryParams({ item: null });
        this.RefreshView();
    }

    public onShareRequested(item?: ItemCardModel | ItemRowModel | LibraryRowModel): void {
        if (!this.canShareItems) {
            SharedService.Instance.CreateSimpleNotification('Your role in this space can not share items.', 'warning', 3000);
            return;
        }
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
        this.shareDialogTitle = 'Share with everyone in this space';
        // Who gains access is worked out by one rule: Active outside seats only, and nobody when there are none
        const audience = shareAudience(this.spaceMembers);
        this.shareAudienceHeader = audience.header;
        this.shareAudienceStaffSub = audience.subtitle;
        this.shareRecipients = this.spaceMembers.filter(m => audience.people.some(p => p.id === m.id)).map(m => ({
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
        this.shareTimestamp = formatDateTime(new Date());
        this.shareReviewHeader = 'Policy review';
        this.shareReviewSub = 'A check on what is being shared';
        this.shareFindings = [];
        this.isShareDialogOpen = true;
        this.RefreshView();
    }

    public onShareDialogCancel(): void {
        this.isShareDialogOpen = false;
        this.RefreshView();
    }

    public async onShareCompleted(_result: { applyFixes: boolean; notify: boolean }): Promise<void> {
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
        await this.loadSpaceItems(this.activeSpaceId, this.currentSelection());
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
        // The space and the selection this upload is for, taken before the first await: the person can move to another space while
        // the file is read, and the file, in the band they chose, belongs to the space they chose it for
        const spaceId = this.activeSpaceId;
        const spaceName = this.rawSpaces.find((sp) => UUIDsEqual(sp.ID, spaceId))?.Name ?? 'the space it was for';
        this.uploadingSpaceIds.push(spaceId);
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
                    SpaceID: spaceId,
                    FileName: payload.fileName || payload.title,
                    MimeType: payload.fileType || 'application/octet-stream',
                    Base64Data: base64Data,
                    Folder: payload.folder || 'Deliverables',
                    Band: payload.band ?? undefined,
                });
                if (!uploadRes.Success) {
                    throw new Error(uploadRes.ErrorMessage || 'Failed to upload space file');
                }
                // Judged by the space shown, not the selection: coming back to the same space still shows its library
                const stillHere = UUIDsEqual(this.activeSpaceId, spaceId);
                if (stillHere) {
                    this.isUploadDialogOpen = false;
                    await this.loadSpaceItems(spaceId, () => UUIDsEqual(this.activeSpaceId, spaceId));
                    SharedService.Instance.CreateSimpleNotification('File uploaded successfully.', 'info', 3000);
                } else {
                    // The person has moved on: the file went where they chose it, and the notice says where. Their dialog is theirs.
                    SharedService.Instance.CreateSimpleNotification(`File uploaded to ${spaceName}.`, 'info', 4000);
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error submitting upload: ' + msg);
            SharedService.Instance.CreateSimpleNotification(`Failed to upload file to ${spaceName}: ${msg}`, 'error', 5000);
        } finally {
            // Only this upload's entry goes: another upload still in flight keeps its dialog showing as sending
            const own = this.uploadingSpaceIds.findIndex((id) => UUIDsEqual(id, spaceId));
            if (own >= 0) this.uploadingSpaceIds.splice(own, 1);
            this.RefreshView();
        }
    }

    /** Whether the rail offers New space: who may create a top-level space (Administer Spaces) and may create Space rows at all. Worked out with `mayAdministerSpaces`. */
    public canCreateSpace = false;

    private refreshCanCreateSpace(): void {
        try {
            this.canCreateSpace = !!this.currentUser && this.mayAdministerSpaces
                && !!this.ProviderToUse.EntityByName('MJ_BizApps_Collaboration: Spaces')?.GetUserPermisions(this.currentUser).CanCreate;
        } catch (err) {
            this.logOnce('create-space', `Could not check the right to create a space: ${err instanceof Error ? err.message : String(err)}`);
            this.canCreateSpace = false;
        }
    }

    /** The parent of the space the dialog is making, and its name; null and empty for a top-level space. */
    public newSpaceParentId: string | null = null;
    public newSpaceParentName = '';

    /**
     * Opens the dialog for a top-level space, or, with a parent, for a sub-space of it: the kinds offered are those the parent's
     * type allows under it (Children.AllowedTypeCodes), and the creator chooses whether the sub-space inherits the parent's members (D22).
     */
    public openNewSpaceDialog(parentId: string | null = null): void {
        if (!this.canCreateSpace) {
            SharedService.Instance.CreateSimpleNotification('You do not have permission to create a space.', 'warning', 3000);
            return;
        }
        const kinds = newSpaceKinds(CollaborationEngineBase.Instance.SpaceTypes);
        const parent = parentId ? this.rawSpaces.find((sp) => UUIDsEqual(sp.ID, parentId)) : undefined;
        if (parentId && !parent) {
            SharedService.Instance.CreateSimpleNotification('The parent space could not be read.', 'warning', 3000);
            return;
        }
        const parentType = parent ? CollaborationEngineBase.Instance.SpaceTypeById(parent.SpaceTypeID) : undefined;
        this.newSpaceParentId = parent ? parent.ID : null;
        this.newSpaceParentName = parent ? parent.Name : '';
        this.newSpaceKinds = parent ? subSpaceKinds(kinds, parentType?.Configuration ?? null) : kinds;
        this.resetNewSpace();
        this.isNewSpaceDialogOpen = true;
        this.RefreshView();
    }

    /** Starts the dialog from nothing. A draft still being made from an earlier opening is dropped when it finishes. */
    private resetNewSpace(): void {
        this.newSpacePicks.Reset();
        this.newSpaceTypeId = '';
        this.newSpaceDraft = null;
        this.newSpaceView = null;
        this.newSpaceError = '';
        this.newSpaceDetailsIncomplete = false;
    }

    public closeNewSpaceDialog(): void {
        this.isNewSpaceDialogOpen = false;
        this.newSpaceParentId = null;
        this.newSpaceParentName = '';
        this.resetNewSpace();
        this.RefreshView();
    }

    /**
     * A kind was chosen: the draft is made now, so its subtype's details can be drawn and filled in before Create. Each pick is
     * numbered, and a draft that finishes after a later pick (or after the dialog was closed and opened again) is dropped.
     */
    public async onNewSpaceTypeSelected(typeId: string): Promise<void> {
        const type = CollaborationEngineBase.Instance.SpaceTypeById(typeId);
        const user = this.currentUser;
        if (!type || !user) return;
        this.newSpaceError = '';
        const outcome = await this.newSpacePicks.Pick(async () => {
            const draft = await NewSpaceDraft.Start(this.ProviderToUse, user, type);
            const driver = this.uiDriverFor(type.UIDriverClass, type.Code, `a new ${type.Name} space`, `driver:new:${type.ID}`);
            const ctx: SpaceUIContext = { space: null, type, spaceTypeCode: type.Code, viewer: user, rules: structuredClone(DEFAULT_SPACE_RULES) };
            const descriptor = draft.HasDetails ? this.detailsDescriptor(driver, ctx, draft.Leaf.EntityInfo.Name) : undefined;
            const view = await planDetailsView({
                fields: draft.DetailFields,
                // The driver's hidden columns decide which of the form's sections can be shown alone
                formSections: draft.FormSectionsHiding(descriptor?.hiddenFieldNames),
                descriptor,
                hasForm: () => this.hasFormFor(draft.Leaf),
            });
            return { draft, view };
        });
        if (outcome.status === 'stale') return;
        if (outcome.status === 'failed') {
            const msg = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
            LogError(`Could not start a ${type.Name} space: ${msg}`);
            this.newSpaceError = `Could not start a ${type.Name} space: ${msg}`;
        } else {
            this.newSpaceDraft = outcome.value.draft;
            this.newSpaceView = outcome.value.view;
            this.newSpaceTypeId = type.ID;
            this.newSpaceDetailsTitle = `${type.Name} details`;
            this.newSpaceDetailsIncomplete = outcome.value.draft.MissingDetails().length > 0;
        }
        this.RefreshView();
    }

    public onNewSpaceDetailChanged(): void {
        this.newSpaceDetailsIncomplete = (this.newSpaceDraft?.MissingDetails().length ?? 0) > 0;
        this.RefreshView();
    }

    public async onSubmitNewSpace(payload: NewSpaceSubmitPayload): Promise<void> {
        const draft = this.newSpaceDraft;
        if (!draft || this.isCreatingSpace) return;
        this.isCreatingSpace = true;
        this.newSpaceError = '';
        this.RefreshView();
        try {
            // The server writes the space, its subtype and the owner's seat in one transaction: a refusal leaves nothing behind
            const outcome = await draft.Create(new CollaborationClient(this.graphQLExecutor), {
                name: payload.name,
                description: payload.description,
                parentId: this.newSpaceParentId,
                inheritsMembership: payload.inheritsMembership,
            });
            if (outcome.status === 'refused') {
                LogError(`Could not create the space: ${outcome.message}`);
                this.newSpaceError = outcome.message;
                return;
            }
            const spaceId = outcome.spaceId;
            this.closeNewSpaceDialog();
            try {
                await this.addNewSpaceToRail(spaceId);
            } catch (readErr) {
                // The space is written: the person is told, and a reload of the page shows it
                const why = readErr instanceof Error ? readErr.message : String(readErr);
                LogError(`Could not show the new space: ${why}`);
                SharedService.Instance.CreateSimpleNotification(`${payload.name} was created, but it could not be opened here: ${why}. Reload the page to see it.`, 'warning', 8000);
                return;
            }
            SharedService.Instance.CreateSimpleNotification(`${payload.name} created.`, 'info', 3000);
            this.onSpaceOpenRequested(spaceId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError(`Error creating a space: ${msg}`);
            this.newSpaceError = `Could not create the space: ${msg}`;
        } finally {
            this.isCreatingSpace = false;
            this.RefreshView();
        }
    }

    /** Reads the space that was just made and puts it in the rail, so it can be opened before the next full load. */
    private async addNewSpaceToRail(spaceId: string): Promise<void> {
        const rv = new RunView(this.RunViewToUse);
        const res = await rv.RunView<RawSpaceRecord>({
            EntityName: 'MJ_BizApps_Collaboration: Spaces',
            ExtraFilter: `ID = '${spaceId}'`,
            ResultType: 'simple',
            BypassCache: true,
        });
        if (!res.Success) throw new Error(res.ErrorMessage || 'The new space could not be read back.');
        const [row] = res.Results ?? [];
        if (!row) throw new Error('The new space was created but cannot be read by you yet.');
        this.rawSpaces = [...this.rawSpaces.filter((sp) => !UUIDsEqual(sp.ID, row.ID)), row];
        this.spaces = this.buildSpaceRailNodes(this.rawSpaces);
    }

    public openNewConversationDialog(): void {
        if (!this.hasTab('Chat')) return;
        if (!this.canStartConversation) {
            SharedService.Instance.CreateSimpleNotification('You do not have permission to start conversations in this space.', 'warning', 3000);
            return;
        }
        this.isNewConversationDialogOpen = true;
        this.RefreshView();
    }

    public closeNewConversationDialog(): void {
        this.isNewConversationDialogOpen = false;
        this.RefreshView();
    }

    public async onSubmitNewConversation(payload: NewConversationSubmitPayload): Promise<void> {
        // The space and the selection this conversation is for, taken before the first await: the person may move on while it is created
        const spaceId = this.activeSpaceId;
        const isCurrent = this.currentSelection();
        const beforeStart: BeforeStartChatEvent = { cancel: false, spaceId, name: payload.name, kind: payload.kind };
        if (!this.runBeforeHook('BeforeStartChat', spaceId, () => this.uiDriver.BeforeStartChat(beforeStart))) {
            SharedService.Instance.CreateSimpleNotification("This space's type couldn't check this conversation.", 'error', 5000);
            return;
        }
        if (beforeStart.cancel) {
            SharedService.Instance.CreateSimpleNotification(beforeStart.cancelReason ?? 'This space does not allow a new conversation.', 'warning', 5000);
            return;
        }
        this.isCreatingConversation = true;
        this.RefreshView();
        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            const res = await client.CreateSpaceConversation({
                SpaceID: spaceId,
                Name: payload.name,
                Kind: payload.kind,
            });
            if (!res.Success) {
                const msg = res.ErrorMessage || 'Failed to create conversation';
                LogError('Failed to create space conversation: ' + msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
                return;
            }

            SharedService.Instance.CreateSimpleNotification('Conversation created.', 'info', 3000);
            this.isNewConversationDialogOpen = false; // closed either way: it must not stay open over the next space
            if (!isCurrent()) return; // it belongs to a space no longer shown: nothing else on screen changes

            await this.loadSpaceConversations(spaceId, isCurrent, res.ConversationID ?? undefined);
            if (!isCurrent()) return;
            if (res.ConversationID) {
                this.activeConversationId = res.ConversationID;
                this.setTab('Chat');
                this.UpdateQueryParams({ tab: 'chat', conv: res.ConversationID });
                await this.loadSpaceChatHostRules(spaceId, res.ConversationID);
                if (!isCurrent()) return;
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
        // Rules for a space the person has left must not replace the rules of the one shown now
        if (!UUIDsEqual(spaceId, this.activeSpaceId)) return;
        const requestId = ++this.hostRulesRequestId;
        // Reset to safe defaults first
        this.chatAgentReplyMode = 'MentionOnly';
        this.chatAllowedAgentIds = [];
        this.chatDefaultAgentId = null;
        this.chatDefaultAgentName = null;
        this.chatAgentHistoryFrom = null;
        this.chatMentionPeople = [];
        this.canStartConversation = false;
        this.canStartConversationKinds = [];

        if (!isValidUuid(spaceId)) return;
        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            const res = await client.GetSpaceChatHostRules(spaceId, conversationId);
            if (this.hostRulesRequestId !== requestId) return;
            if (res?.Success) {
                this.chatAgentReplyMode = res.AgentReplyMode ?? 'MentionOnly';
                this.chatAllowedAgentIds = res.AllowedAgentIDs ?? [];
                this.chatDefaultAgentId = res.DefaultAgentID ?? null;
                this.chatDefaultAgentName = res.DefaultAgentName ?? null;
                this.chatAgentHistoryFrom = res.AgentHistoryFrom ? new Date(res.AgentHistoryFrom) : null;
                this.chatMentionPeople = (res.MentionPeople ?? []).map(p => ({
                    ID: p.ID,
                    Name: p.Name,
                    Email: p.Email ?? null,
                }));
                this.canStartConversation = res.CanStartConversation ?? false;
                if (res.UploadMaxBytes && res.UploadMaxBytes > 0) this.uploadMaxBytes = res.UploadMaxBytes;
                this.canStartConversationKinds = (res.AllowedConversationKinds ?? []).filter(
                    (k): k is 'General' | 'Topic' | 'Private' => k === 'General' || k === 'Topic' || k === 'Private'
                );
            } else {
                this.chatAllowedAgentIds = [];
                this.chatDefaultAgentId = null;
                this.chatDefaultAgentName = null;
                this.canStartConversation = false;
                this.canStartConversationKinds = [];
                const refusalMsg = res?.ErrorMessage || 'Space chat host rules refused by server';
                LogError(`loadSpaceChatHostRules: server refused host rules for space ${spaceId}: ${refusalMsg}`);
            }
        } catch (err) {
            if (this.hostRulesRequestId !== requestId) return;
            this.chatAllowedAgentIds = [];
            this.chatDefaultAgentId = null;
            this.chatDefaultAgentName = null;
            this.canStartConversation = false;
            this.canStartConversationKinds = [];
            LogError('Error loading space chat host rules: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    public handleAgentTurn: AgentTurnHandler = async (request: AgentTurnRequest): Promise<AgentTurnResult> => {
        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            return spaceTurnResult(await client.ExecuteSpaceChatTurn(spaceTurnInput(this.activeSpaceId, request)));
        } catch (error) {
            LogError(`Failed to execute space chat turn: ${error instanceof Error ? error.message : String(error)}`);
            return spaceTurnFailure(error);
        }
    };

    public onTaskSelected(task: TaskItemModel): void {
        if (!task?.id) return;
        SharedService.Instance.OpenEntityRecord('MJ_BizApps_Tasks: Tasks', CompositeKey.FromID(task.id));
    }

    public async onTaskToggled(task: TaskItemModel): Promise<void> {
        if (this.isSpaceClosed || !this.canContribute) {
            SharedService.Instance.CreateSimpleNotification(
                this.isSpaceClosed ? 'Cannot change task status in a closed space.' : 'You do not have permission to update tasks in this space.',
                'warning', 3000);
            return;
        }
        const isCompleted = task.status === 'Completed';
        const newEntityStatus: TaskEntity['Status'] = isCompleted ? 'InProgress' : 'Completed';
        const previousStatus = task.status;
        task.status = newEntityStatus;
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

            await this.loadSpaceTasks(this.activeSpaceId, this.currentSelection());
            SharedService.Instance.CreateSimpleNotification('Task created successfully.', 'info', 3000);
            this.RefreshView();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('Error creating task: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Error creating task: ' + msg, 'error', 5000);
        }
    }

    public async onOverviewAskRequested(query: string): Promise<void> {
        const text = query?.trim() ?? '';
        if (!text || this.isSubmittingAsk) return;
        if (!this.canStartConversation || this.isSpaceClosed) {
            SharedService.Instance.CreateSimpleNotification('You do not have permission to start conversations in this space.', 'warning', 3000);
            return;
        }

        const spaceId = this.activeSpaceId;
        const isCurrent = this.currentSelection();
        // The assistant to ask is this space's, so it is read before the await; the person can have moved to another space by then
        const askedMessage = this.askMessage(text);
        const name = text.length > 50 ? `${text.slice(0, 47)}...` : text;
        const beforeAsk: BeforeStartChatEvent = { cancel: false, spaceId, name, kind: 'General' };
        if (!this.runBeforeHook('BeforeStartChat', spaceId, () => this.uiDriver.BeforeStartChat(beforeAsk))) {
            SharedService.Instance.CreateSimpleNotification("This space's type couldn't check this conversation.", 'error', 5000);
            return;
        }
        if (beforeAsk.cancel) {
            SharedService.Instance.CreateSimpleNotification(beforeAsk.cancelReason ?? 'This space does not allow a new conversation.', 'warning', 5000);
            return;
        }
        this.isSubmittingAsk = true;
        this.RefreshView();
        try {
            const client = new CollaborationClient(this.graphQLExecutor);
            const res = await client.CreateSpaceConversation({
                SpaceID: spaceId,
                Name: name,
                Kind: 'General',
            });

            if (res.Success && res.ConversationID && !isCurrent()) {
                // Started in a space the person has left: the conversation exists there, with the question waiting in it
                this.pendingChatMessage = askedMessage;
                this.pendingChatMessageConversationId = res.ConversationID;
                SharedService.Instance.CreateSimpleNotification('Conversation started in the space you left. Your question is waiting there.', 'info', 4000);
            } else if (res.Success && res.ConversationID) {
                this.spaceOverviewComponent?.clearAskBox();
                this.pendingChatMessage = askedMessage;
                this.pendingChatMessageConversationId = res.ConversationID;
                this.activeConversationId = res.ConversationID;
                await this.loadSpaceConversations(spaceId, isCurrent, res.ConversationID);
                await this.loadSpaceChatHostRules(spaceId, res.ConversationID);
                if (!isCurrent()) return;
                this.setTab('Chat');
                this.UpdateQueryParams({ tab: 'chat', conv: res.ConversationID });
                this.RefreshView();
            } else {
                const msg = res.ErrorMessage || 'Failed to start conversation';
                LogError('onOverviewAskRequested error: ' + msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError('onOverviewAskRequested error: ' + msg);
            SharedService.Instance.CreateSimpleNotification('Failed to start conversation: ' + msg, 'error', 5000);
        } finally {
            this.isSubmittingAsk = false;
            this.RefreshView();
        }
    }

    /** The ask box's question as the chat sends it: tagged with the space's default assistant, when it has one. */
    private askMessage(text: string): string {
        const defaultAgentId = this.chatDefaultAgentId;
        if (!defaultAgentId) return text;
        const mention = `@${JSON.stringify({ type: 'agent', id: defaultAgentId, name: this.chatDefaultAgentName ?? 'Assistant' })}`;
        return `${mention} ${text}`;
    }

    /** True while an invite is with the server: the People form stays as it is. */
    public isSendingInvite = false;
    /** What the server said about the last invite: the form clears and closes only when it succeeded. */
    public inviteOutcome: { ok: boolean; message: string } | null = null;

    /**
     * Invites a person through MintSpaceLink, which saves the seat through the member gate and emails a sign-in link.
     * The person needs no account yet, and a client admin (whose role may invite) can do it: the browser reads no other user.
     */
    public async onInviteMember(payload: { email: string; role: string }): Promise<void> {
        // The space and selection are taken before the first await: an invite that finishes after a switch must not
        // show its banner in the next space
        const spaceId = this.activeSpaceId;
        const isCurrent = this.currentSelection();
        const failed = (message: string): void => {
            LogError(`Invite refused: ${message}`);
            if (isCurrent()) this.inviteOutcome = { ok: false, message };
            SharedService.Instance.CreateSimpleNotification(message, 'error', 5000);
        };
        // The type's UI driver may cancel the invite before it is sent; the server's driver still enforces its own rules
        const before: BeforeInviteEvent = { cancel: false, spaceId, email: payload.email, role: payload.role };
        if (!this.runBeforeHook('BeforeInvite', spaceId, () => this.uiDriver.BeforeInvite(before))) {
            failed("This space's type couldn't check this invite.");
            this.RefreshView();
            return;
        }
        if (before.cancel) {
            failed(before.cancelReason ?? 'This space does not allow that invite.');
            this.RefreshView();
            return;
        }
        this.isSendingInvite = true;
        this.inviteOutcome = null;
        this.inviteRedemptionUrl = null;
        this.RefreshView();
        try {
            const roleId = CollaborationEngineBase.Instance.SpaceRoleTypeByCode(payload.role)?.ID;
            if (!roleId) {
                failed(`Invite refused: there is no role called ${payload.role}.`);
                return;
            }
            const client = new CollaborationClient(this.graphQLExecutor);
            const result = await client.MintSpaceLink({ SpaceID: spaceId, Email: payload.email, RoleID: roleId });
            if (!result.Success) {
                failed(result.ErrorMessage || 'Invite refused.');
                return;
            }
            // On success the server's message says what happened: seated, Invited awaiting approval, already seated, and whether a link was sent
            const message = result.Message || 'They are seated.';
            if (isCurrent()) {
                this.inviteOutcome = { ok: true, message };
                this.inviteRedemptionUrl = result.RedemptionUrl ?? null;
            }
            SharedService.Instance.CreateSimpleNotification(message, 'info', 6000);
            await this.loadSpaceMembers(spaceId, isCurrent);
        } catch (error) {
            failed(error instanceof Error ? error.message : String(error));
        } finally {
            this.isSendingInvite = false;
            this.RefreshView();
        }
    }

    /** True while a seat change is with the server. */
    public isChangingSeat = false;

    /** Changes one of this space's own seats, then reads the people again. A refusal is shown as the server worded it. */

    private async changeSeat(member: SpaceMemberModel, change: (seat: mjBizAppsCollaborationSpaceMemberEntity) => void, doing: string): Promise<void> {
        if (this.isChangingSeat) return;
        this.isChangingSeat = true;
        const spaceId = this.activeSpaceId;
        const isCurrent = this.currentSelection();
        try {
            const seat = await this.ProviderToUse.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>('MJ_BizApps_Collaboration: Space Members', this.currentUser ?? undefined);
            if (!(await seat.Load(member.id))) {
                SharedService.Instance.CreateSimpleNotification(`Could not ${doing}: the seat was not found.`, 'error', 5000);
                return;
            }
            change(seat);
            if (!(await seat.Save())) {
                const msg = seat.LatestResult?.CompleteMessage || `Could not ${doing}.`;
                LogError(`Could not ${doing} for ${member.name}: ${msg}`);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 6000);
                return;
            }
            SharedService.Instance.CreateSimpleNotification(`Done: ${doing} for ${member.name}.`, 'info', 3000);
            // A change to the caller's own seat changes what they may do here: resolve the seat (and the right to configure) again
            if (this.currentUser && UUIDsEqual(member.userId, this.currentUser.ID) && isCurrent()) {
                const space = this.activeSpaceRecord;
                if (space) await this.updateBandChoice(space, isCurrent);
                await this.updateCanConfigureCurrentSpace();
            }
            await this.loadSpaceMembers(spaceId, isCurrent);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError(`Could not ${doing}: ${msg}`);
            SharedService.Instance.CreateSimpleNotification(`Could not ${doing}: ${msg}`, 'error', 6000);
        } finally {
            this.isChangingSeat = false;
            this.RefreshView();
        }
    }

    public onApproveMember(member: SpaceMemberModel): Promise<void> {
        return this.changeSeat(member, (seat) => { seat.Status = 'Active'; }, 'approve the seat');
    }

    public onRemoveMember(member: SpaceMemberModel): Promise<void> {
        return this.changeSeat(member, (seat) => { seat.Status = 'Removed'; }, 'remove the seat');
    }

    public onChangeMemberRole(change: { member: SpaceMemberModel; roleCode: string }): Promise<void> {
        const roleId = CollaborationEngineBase.Instance.SpaceRoleTypeByCode(change.roleCode)?.ID;
        if (!roleId) {
            SharedService.Instance.CreateSimpleNotification(`There is no role called ${change.roleCode}.`, 'error', 5000);
            return Promise.resolve();
        }
        return this.changeSeat(change.member, (seat) => { seat.SpaceRoleTypeID = roleId; }, 'change the role');
    }

    /** True while a close or reopen is with the server. */
    public isChangingLifecycle = false;

    /** Closes or reopens the space shown. A reopen carries no other change, so it is saved on its own. */
    public async onChangeSpaceLifecycle(closing: boolean): Promise<void> {
        if (this.isChangingLifecycle) return;
        const verb = closing ? 'close' : 'reopen';
        // The right is checked before the lock is taken, so a refusal can't leave Close and Reopen disabled
        if (!(closing ? this.canCloseCurrentSpace : this.canReopenCurrentSpace)) {
            SharedService.Instance.CreateSimpleNotification(`You do not have permission to ${verb} this space.`, 'warning', 4000);
            return;
        }
        this.isChangingLifecycle = true;
        const spaceId = this.activeSpaceId;
        const isCurrent = this.currentSelection();
        try {
            const spaceEntity = await this.ProviderToUse.GetEntityObject<mjBizAppsCollaborationSpaceEntity>('MJ_BizApps_Collaboration: Spaces');
            if (!isValidUuid(spaceId) || !(await spaceEntity.Load(spaceId))) {
                SharedService.Instance.CreateSimpleNotification(`Could not ${verb} the space: it was not found.`, 'error', 5000);
                return;
            }
            spaceEntity.ClosedAt = closing ? new Date() : null;
            if (!(await spaceEntity.Save())) {
                const msg = spaceEntity.LatestResult?.CompleteMessage || `Could not ${verb} the space.`;
                LogError(`Could not ${verb} space ${spaceId}: ${msg}`);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 6000);
                return;
            }
            const raw = this.rawSpaces.find(sp => UUIDsEqual(sp.ID, spaceId));
            if (raw) {
                raw.ClosedAt = spaceEntity.ClosedAt;
                this.spaces = this.buildSpaceRailNodes(this.rawSpaces);
            }
            if (isCurrent()) {
                // Read the space again as it now is: the header, the caller's seat and bands, the host rules and the conversations
                // (a close archives them) all followed its old state. The re-read is a new selection, counted when it starts, so the
                // check for "still here" is taken right after starting it and before waiting for it.
                const reread = this.selectSpaceInternal(spaceId, true);
                const stillHere = this.currentSelection();
                await reread;
                if (stillHere()) {
                    this.settingsSaveSuccess = closing ? 'The space is closed.' : 'The space is open again.';
                    this.settingsInfoMessage = '';
                }
            }
            SharedService.Instance.CreateSimpleNotification(closing ? 'Space closed.' : 'Space reopened.', 'info', 3000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            LogError(`Error trying to ${verb} space ${spaceId}: ${msg}`);
            SharedService.Instance.CreateSimpleNotification(`Could not ${verb} the space: ${msg}`, 'error', 6000);
        } finally {
            this.isChangingLifecycle = false;
            this.RefreshView();
        }
    }

    public async onSaveSettings(settings: SpaceSettingsModel): Promise<void> {
        if (!this.canConfigureCurrentSpace) {
            const msg = 'Cannot save space settings: user lacks Configure Spaces authorization';
            LogError(msg);
            SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
            return;
        }
        // Everything this save needs from the screen is taken before the first await: the copy that counts as saved (an edit made
        // during the save must not), what changed, and which space and selection it belongs to
        const savedCopy: SpaceSettingsModel = { ...settings };
        const changes = this.settingsSession.Changes(savedCopy);
        const stillShown = this.currentSelection();
        this.isSavingSettings = true;
        this.settingsSaveSuccess = '';
        this.settingsInfoMessage = '';
        this.RefreshView();
        try {
            const targetId = savedCopy.id || this.activeSpaceId;
            if (!targetId || !isValidUuid(targetId)) {
                const msg = 'Cannot save space settings: invalid or missing space ID';
                LogError(msg);
                SharedService.Instance.CreateSimpleNotification(msg, 'error', 5000);
                this.isSavingSettings = false;
                return;
            }
            if (Object.keys(changes).length === 0) {
                this.isSavingSettings = false;
                this.settingsInfoMessage = 'No changes to save.';
                SharedService.Instance.CreateSimpleNotification(this.settingsInfoMessage, 'info', 3000);
                this.RefreshView();
                return;
            }
            const md = this.ProviderToUse;
            const spaceEntity = await md.GetEntityObject<mjBizAppsCollaborationSpaceEntity>('MJ_BizApps_Collaboration: Spaces');
            if (await spaceEntity.Load(targetId)) {
                // Write only what the person changed from what the screen showed them, so a rename can't turn
                // a type-default retention into a chosen one
                applySettingsChanges(spaceEntity, changes);
                const saveOk = await spaceEntity.Save();
                if (!saveOk) {
                    const errMsg = spaceEntity.LatestResult?.CompleteMessage || 'Failed to save space settings.';
                    LogError('Failed to save space settings: ' + errMsg);
                    SharedService.Instance.CreateSimpleNotification('Failed to save space settings: ' + errMsg, 'error', 5000);
                    this.isSavingSettings = false;
                    this.RefreshView();
                    return;
                }

                // The space's own row is what was saved, whichever space is on screen now
                const raw = this.rawSpaces.find(s => UUIDsEqual(s.ID, targetId));
                if (raw) {
                    raw.Name = savedCopy.name;
                    raw.Description = savedCopy.description;
                    raw.IconClass = savedCopy.iconClass;
                    raw.Color = savedCopy.color;
                    raw.BackgroundImageURL = savedCopy.backgroundImageUrl || null;
                    raw.InheritsMembership = savedCopy.inheritsMembership;
                    raw.AgentRetrieval = savedCopy.agentRetrieval as mjBizAppsCollaborationSpaceEntity['AgentRetrieval'];
                    this.spaces = this.buildSpaceRailNodes(this.rawSpaces);
                }

                // The screen, its baseline and the header change only if this space is still the one shown; otherwise they belong to another
                if (stillShown()) {
                    this.settingsSession.Saved(savedCopy);
                    this.spaceSettings = this.settingsSession.Shown;
                    this.spaceTitle = savedCopy.name;
                    this.spaceSubtitle = savedCopy.description;
                    this.headerTypeIcon = savedCopy.iconClass;
                    this.headerTypeColor = savedCopy.color;
                    this.headerBackgroundImageUrl = savedCopy.backgroundImageUrl || null;
                    this.settingsSaveSuccess = 'Space settings saved successfully.';
                }
                SharedService.Instance.CreateSimpleNotification('Space settings saved successfully.', 'info', 3000);
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
