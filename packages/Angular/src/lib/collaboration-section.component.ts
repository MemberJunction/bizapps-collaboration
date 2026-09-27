import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegisterClass } from '@memberjunction/global';
import { CompositeKey, LogError, RunView, type UserInfo } from '@memberjunction/core';
import { BaseResourceComponent, SharedService } from '@memberjunction/ng-shared';
import { MJPageLayoutComponent, MJPageBodyComponent, MJButtonDirective } from '@memberjunction/ng-ui-components';
import type { ResourceData, MJFileEntity, MJUserEntity, MJConversationEntity } from '@memberjunction/core-entities';
import {
    CollaborationClient,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationSpaceChatEntity,
} from '@mj-biz-apps/collaboration-entities';
import { TaskEntity } from '@mj-biz-apps/tasks-entities';
import { CollaborationEngineBase } from '@mj-biz-apps/collaboration-engine-base';
import {
    TaskPanelComponent,
    type TaskViewMode,
    MyTasksComponent,
    ApprovalInboxComponent,
} from '@mj-biz-apps/tasks-ng';
import {
    CollabSpaceRailComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceTabsComponent,
    CollabSpaceOverviewComponent,
    CollabSpaceLibraryComponent,
    CollabShareCheckDialogComponent,
    CollabAudiencePillComponent,
    CollabUploadDialogComponent,
    CollabSpaceChatComponent,
    CollabSpacePeopleComponent,
    CollabSpaceSettingsComponent,
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
    type SpaceBand,
    type RecentUseModel,
    type AvatarItem,
    type CollabUploadSubmitPayload,
    type TaskItemModel,
    type SpaceMemberModel,
    type SpaceSettingsModel,
    type RoomMessageItem,
    type SpaceConversationItem,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { CollaborationNoAccessComponent } from './no-access.component';

interface RawSpaceRecord {
    ID: string;
    Name: string;
    Description?: string | null;
    Status?: string | null;
    ParentID?: string | null;
    IconClass?: string | null;
    Color?: string | null;
    BackgroundImageURL?: string | null;
    SpaceType?: string;
    SpaceTypeID: string;
    InheritsMembership?: boolean;
    AgentRetrieval?: string;
    Retention?: string | null;
    ClosedAt?: string | null;
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
        CollabUploadDialogComponent,
        CollabSpaceChatComponent,
        CollabSpacePeopleComponent,
        CollabSpaceSettingsComponent,
        CollaborationNoAccessComponent,
        TaskPanelComponent,
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
        .view-switch-group {
            display: inline-flex;
            border: 1px solid var(--mj-border-default, #cbd5e1);
            border-radius: 6px;
            overflow: hidden;
            background: var(--mj-bg-surface-sunken, #f8fafc);
        }
        .view-switch-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            border: none;
            background: transparent;
            font-size: 12.5px;
            font-weight: 500;
            color: var(--mj-text-secondary, #64748b);
            cursor: pointer;
            transition: all 0.12s ease;
        }
        .view-switch-btn:hover {
            color: var(--mj-text-primary, #0f172a);
            background: var(--mj-bg-surface-hover, #f1f5f9);
        }
        .view-switch-btn.active {
            background: var(--mj-brand-primary, #0284c7);
            color: #ffffff;
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

        .modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(2px);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        }
        .modal-dialog {
            background: var(--mj-bg-surface, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 480px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: modalFadeIn 0.15s ease-out;
        }
        @keyframes modalFadeIn {
            from { opacity: 0; transform: scale(0.97); }
            to { opacity: 1; transform: scale(1); }
        }
        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
        }
        .modal-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 16px;
            font-weight: 700;
            color: var(--mj-text-primary, #0f172a);
        }
        .btn-modal-close {
            background: transparent;
            border: none;
            color: var(--mj-text-muted, #64748b);
            font-size: 16px;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
        }
        .btn-modal-close:hover {
            color: var(--mj-text-primary, #0f172a);
            background: var(--mj-bg-surface-hover, #f1f5f9);
        }
        .modal-body {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .modal-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            padding: 14px 20px;
            border-top: 1px solid var(--mj-border-default, #e2e8f0);
            background: var(--mj-bg-surface-sunken, #f8fafc);
        }
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .form-label {
            font-size: 12.5px;
            font-weight: 600;
            color: var(--mj-text-secondary, #475569);
        }
        .input-prefix-wrap {
            display: flex;
            align-items: center;
            border: 1px solid var(--mj-border-default, #cbd5e1);
            border-radius: 6px;
            background: var(--mj-bg-surface, #ffffff);
            overflow: hidden;
        }
        .input-prefix-wrap:focus-within {
            border-color: var(--mj-brand-primary, #0076b6);
            box-shadow: 0 0 0 2px color-mix(in srgb, var(--mj-brand-primary, #0076b6) 20%, transparent);
        }
        .input-prefix-wrap .prefix {
            padding: 8px 10px 8px 12px;
            color: var(--mj-brand-primary, #0076b6);
            font-weight: 700;
            font-size: 14px;
        }
        .prefix-input {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            padding: 8px 12px 8px 0 !important;
            flex: 1;
            font-size: 13.5px;
            background: transparent;
        }
        .channel-kind-options {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .radio-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--mj-text-primary, #0f172a);
            cursor: pointer;
        }
        .btn-secondary {
            padding: 7px 14px;
            border-radius: 6px;
            border: 1px solid var(--mj-border-default, #cbd5e1);
            background: var(--mj-bg-surface, #ffffff);
            font-size: 13px;
            font-weight: 600;
            color: var(--mj-text-secondary, #475569);
            cursor: pointer;
        }
        .btn-secondary:hover {
            background: var(--mj-bg-surface-hover, #f1f5f9);
        }
        .btn-primary {
            padding: 7px 16px;
            border-radius: 6px;
            border: none;
            background: var(--mj-brand-primary, #0076b6);
            font-size: 13px;
            font-weight: 600;
            color: #ffffff;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-primary:not(:disabled):hover {
            background: var(--mj-brand-primary-hover, #005a8c);
        }
        .collab-loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            height: 100%;
            min-height: 400px;
            color: var(--mj-text-secondary, #64748b);
            font-size: 14px;
        }
    `],
    template: `
        <mj-page-layout>
            <mj-page-body [Padding]="false">
                @if (isLoading) {
                    <div class="collab-loading-state">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <span>Loading workspace...</span>
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
                                                    <span class="stat-val">{{ libraryTotalCount }}</span>
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
                                            <bizapps-approval-inbox
                                                [ApproverPersonID]="currentPersonId"
                                            />
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
                                            <bizapps-my-tasks
                                                [PersonID]="currentPersonId"
                                                [ShowCreateButton]="true"
                                                (TaskDoubleClicked)="onTaskDoubleClicked($event.ID)"
                                            />
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
                                                    [RoomMessages]="overviewRoomMessages"
                                                    [SubSpaces]="overviewSubSpaces"
                                                    (OpenLibraryRequested)="onOpenLibraryRequested()"
                                                    (OpenChatRequested)="onOpenChatRequested()"
                                                    (ItemSelectRequested)="onItemSelected($event)"
                                                    (ShareRequested)="onShareRequested($event)"
                                                    (SubSpaceSelectRequested)="onSpaceOpenRequested($event.id)"
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
                                                />
                                            }
                                            @case ('Work') {
                                                 <div class="work-tab-container">
                                                     <bizapps-task-panel
                                                         [ExtraFilter]="taskScopeFilter"
                                                         [AllowedViewModes]="['list', 'kanban', 'gantt']"
                                                         [ViewMode]="workViewMode"
                                                         (ViewModeChange)="onWorkViewModeChanged($event)"
                                                         [ShowCreateButton]="true"
                                                         [GanttHeight]="'620px'"
                                                         (AfterTaskCreated)="onTaskSavedOrCreated($event)"
                                                         (AfterTaskSaved)="onTaskSavedOrCreated($event)"
                                                         (TaskDoubleClicked)="onTaskDoubleClicked($event)"
                                                     />
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
                                                    [Messages]="spaceRoomMessages"
                                                    (SendMessageRequested)="onSendChatMessage($event)"
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
                                (ApplyFixRequested)="onApplyFix($event)"
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
    public rawSpaces: RawSpaceRecord[] = [];
    private spaceTypeMap = new Map<string, { icon: string; color: string; name: string }>();

    public get activeSpacesCount(): number {
        return this.rawSpaces.filter(s => !s.ClosedAt && (s.Status ?? 'Active').toLowerCase() === 'active').length;
    }

    public get librarySharedCount(): number {
        return this.overviewSharedItems.length;
    }

    public get libraryTeamCount(): number {
        return this.overviewTeamItems.length;
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
    public workViewMode: TaskViewMode = 'list';

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
        const found = this.spaceConversations.find(c => c.id === this.activeConversationId);
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
    public spaceRoomMessages: RoomMessageItem[] = [];
    public activeRoomConvId: string | null = null;
    public spaceAudienceBand: SpaceBand = 'Shared';

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

    private client: CollaborationClient | null = null;

    protected async loadRealData(): Promise<void> {
        try {
            if (CollaborationClient.isAvailable()) {
                this.client = new CollaborationClient();
            }
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

            if (spacesRes?.Success && spacesRes.Results && spacesRes.Results.length > 0) {
                this.hasAccess = true;
                this.rawSpaces = spacesRes.Results;
                this.spaces = this.buildSpaceRailNodes(this.rawSpaces);

                const params = this._pendingQueryParams ?? this.GetQueryParams();
                this._pendingQueryParams = null;
                await this.applyQueryParams(params);
            } else {
                this.hasAccess = false;
            }
        } catch (err) {
            LogError('Error loading collaboration data: ' + (err instanceof Error ? err.message : String(err)));
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
            const children = rawSpaces.filter(other => other.ParentID === space.ID);
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
        const space = this.rawSpaces.find(s => s.ID === spaceId);
        if (!space) return;

        const typeDef = this.spaceTypeMap.get(space.SpaceTypeID);
        const resolvedType = space.SpaceType || typeDef?.name;
        if (!resolvedType) {
            LogError(`Missing space type for space ID: ${space.ID}`);
        }
        this.spaceTitle = space.Name;
        this.spaceSubtitle = space.Description || '';
        this.spaceStatus = space.Status || 'Active';
        this.spaceTypeName = resolvedType || 'Unknown Type';
        this.headerTypeIcon = space.IconClass || typeDef?.icon || 'fa-solid fa-compass';
        this.headerTypeColor = space.Color || typeDef?.color || '#0076b6';
        this.headerBackgroundImageUrl = space.BackgroundImageURL || null;

        // Build breadcrumb lineage
        const lineage: BreadcrumbItem[] = [];
        let curr: RawSpaceRecord | undefined = space;
        while (curr) {
            lineage.unshift({ label: curr.Name, spaceId: curr.ID });
            curr = curr.ParentID ? this.rawSpaces.find(s => s.ID === curr!.ParentID) : undefined;
        }
        this.breadcrumbs = [{ label: 'Spaces' }, ...lineage];

        // Overview sub-spaces
        const children = this.rawSpaces.filter(s => s.ParentID === spaceId);
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
            inheritsMembership: space.InheritsMembership !== false,
            agentRetrieval: (space.AgentRetrieval as 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely') || 'Included',
            retention: (space.Retention as 'Month' | 'Year' | 'Indefinite') || 'Indefinite',
            status: space.Status || 'Active',
        };

        // Load items, conversation, tasks, members
        await this.loadSpaceItems(spaceId);
        await this.loadSpaceConversations(spaceId, this._pendingConvId ?? undefined);
        this._pendingConvId = null;
        await this.loadSpaceTasks(spaceId);
        await this.loadSpaceMembers(spaceId);

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
                this.overviewSharedItems = [];
                this.overviewTeamItems = [];
                this.libraryCollections = [];
                return;
            }

            const fileEntityId = '29248F34-2837-EF11-86D4-6045BDEE16E6';
            const fileItemMap = new Map<string, typeof itemsRes.Results[0]>();
            const fileIds: string[] = [];

            for (const item of itemsRes.Results) {
                if (item.EntityID === fileEntityId || item.Entity === 'MJ: Files') {
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
                        kind,
                        title: name,
                        meta: `${folder} · Shared`,
                        stamp: dateStr,
                    });
                } else {
                    team.push({
                        id: item.ID,
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

            const spaceChatsRes = await rv.RunView<{
                ID: string;
                SpaceID: string;
                ConversationID: string;
                Name: string;
                Subject?: string | null;
                Kind: string;
                Status: string;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                ExtraFilter: `SpaceID = '${spaceId}' AND Status = 'Active'`,
                ResultType: 'simple',
                MaxRows: 50,
            });

            const convsRes = await rv.RunView<{
                ID: string;
                Name: string;
            }>({
                EntityName: 'MJ: Conversations',
                ExtraFilter: `LinkedEntityID = '${spaceEntityId}' AND LinkedRecordID = '${spaceId}'`,
                ResultType: 'simple',
                MaxRows: 50,
            });

            const items: SpaceConversationItem[] = [];
            const seenConvIds = new Set<string>();

            if (spaceChatsRes?.Success && spaceChatsRes.Results) {
                for (const sc of spaceChatsRes.Results) {
                    if (sc.ConversationID && !seenConvIds.has(sc.ConversationID)) {
                        seenConvIds.add(sc.ConversationID);
                        items.push({
                            id: sc.ConversationID,
                            name: sc.Name || 'general-room',
                            kind: sc.Kind || 'General',
                            band: this.spaceAudienceBand,
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
                            band: this.spaceAudienceBand,
                            unreadCount: 0,
                        });
                    }
                }
            }

            if (items.length === 0) {
                const defaultConvId = await this.ensureDefaultSpaceConversation(spaceId);
                if (defaultConvId) {
                    items.push({
                        id: defaultConvId,
                        name: 'general-room',
                        kind: 'General',
                        band: this.spaceAudienceBand,
                        unreadCount: 0,
                    });
                }
            }

            this.spaceConversations = items;

            if (preferredConvId && items.some(i => i.id === preferredConvId)) {
                this.activeConversationId = preferredConvId;
            } else if (items.length > 0) {
                this.activeConversationId = items[0].id;
            } else {
                this.activeConversationId = '';
            }
            this.activeRoomConvId = this.activeConversationId || null;

            if (this.activeConversationId) {
                await this.loadOverviewMessages(this.activeConversationId);
            }
        } catch (err) {
            LogError('Error loading space conversations: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    private async ensureDefaultSpaceConversation(spaceId: string): Promise<string | null> {
        try {
            const md = this.ProviderToUse;
            const spaceEntity = md.EntityByName('MJ_BizApps_Collaboration: Spaces');
            if (!spaceEntity) {
                LogError('Metadata lookup failed for entity MJ_BizApps_Collaboration: Spaces');
                return null;
            }
            const spaceEntityId = spaceEntity.ID;
            const currentUser = md.CurrentUser;
            if (!currentUser) return null;

            const conv = await md.GetEntityObject<MJConversationEntity>('MJ: Conversations');
            conv.NewRecord();
            conv.Name = 'general-room';
            conv.UserID = currentUser.ID;
            conv.LinkedEntityID = spaceEntityId;
            conv.LinkedRecordID = spaceId;
            const saved = await conv.Save();
            if (saved && conv.ID) {
                try {
                    const chat = await md.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>('MJ_BizApps_Collaboration: Space Chats');
                    chat.NewRecord();
                    chat.SpaceID = spaceId;
                    chat.ConversationID = conv.ID;
                    chat.Name = 'general-room';
                    chat.Kind = 'General';
                    chat.Status = 'Active';
                    await chat.Save();
                } catch (chatErr) {
                    LogError('Failed to save Space Chat record: ' + (chatErr instanceof Error ? chatErr.message : String(chatErr)));
                }
                return conv.ID;
            }
            return null;
        } catch (err) {
            LogError('Error ensuring default space conversation: ' + (err instanceof Error ? err.message : String(err)));
            return null;
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
                const mapped: RoomMessageItem[] = chronological.map(d => ({
                    id: d.ID,
                    senderName: d.Role === 'AI' ? 'Assistant' : (d.User || 'Team Member'),
                    senderInitials: d.Role === 'AI' ? 'AI' : (d.User ? d.User.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'TM'),
                    senderColorClass: d.Role === 'AI' ? 'c1' : 'c2',
                    isOutside: false,
                    isAssistant: d.Role === 'AI',
                    timestamp: this.formatDate(d.__mj_CreatedAt),
                    text: d.Message,
                }));
                this.spaceRoomMessages = mapped;
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
                UserEmail?: string | null;
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
                this.spaceMembers = membersRes.Results.map(m => {
                    const name = m.User || 'Member';
                    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    return {
                        id: m.ID,
                        userId: m.UserID,
                        name,
                        email: m.UserEmail || '',
                        initials,
                        roleName: m.SpaceRoleType || 'Member',
                        roleCode: (m.SpaceRoleType || 'member').toLowerCase().replace(/\s+/g, '-'),
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
                people: 'People',
                settings: 'Settings',
            };
            if (tabMap[rawTab]) {
                this.activeTab = tabMap[rawTab];
            }
        }

        if (params['conv'] && isValidUuid(params['conv'])) {
            this._pendingConvId = params['conv'];
            if (this.spaceConversations.some(c => c.id === params['conv'])) {
                this.activeConversationId = params['conv'];
                this.activeRoomConvId = params['conv'];
            }
        }

        const requestedSpace = params['space'] && isValidUuid(params['space']) ? params['space'] : null;
        const targetSpaceId = requestedSpace && this.rawSpaces.some(s => s.ID === requestedSpace)
            ? requestedSpace
            : (this._loadedSpaceId && this.rawSpaces.some(s => s.ID === this._loadedSpaceId)
                ? this._loadedSpaceId
                : this.rawSpaces[0]?.ID);

        if (targetSpaceId && targetSpaceId !== this._loadedSpaceId) {
            await this.selectSpaceInternal(targetSpaceId);
        }

        if (params['item'] && isValidUuid(params['item'])) {
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

    public onWorkViewModeChanged(mode: TaskViewMode): void {
        this.workViewMode = mode;
        this.UpdateQueryParams({ workView: mode });
        this.RefreshView();
    }

    public onTaskDoubleClicked(taskId: string): void {
        if (!taskId) return;
        SharedService.Instance.OpenEntityRecord('MJ_BizApps_Tasks: Tasks', CompositeKey.FromID(taskId));
    }

    public async onTaskSavedOrCreated(taskId: string): Promise<void> {
        try {
            if (!this.activeSpaceId || !taskId || !isValidUuid(this.activeSpaceId) || !isValidUuid(taskId)) return;
            const md = this.ProviderToUse;
            const tasksEntityInfo = md.EntityByName('MJ_BizApps_Tasks: Tasks');
            if (!tasksEntityInfo) return;

            const rv = new RunView(this.RunViewToUse);
            const existingRes = await rv.RunView<{ ID: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Items',
                ExtraFilter: `SpaceID = '${this.activeSpaceId}' AND (RecordID = 'ID|${taskId}' OR RecordID = '${taskId}')`,
                ResultType: 'simple',
                MaxRows: 1,
            });

            if (!existingRes?.Success || !existingRes.Results || existingRes.Results.length === 0) {
                const spaceItem = await md.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>('MJ_BizApps_Collaboration: Space Items');
                spaceItem.NewRecord();
                spaceItem.SpaceID = this.activeSpaceId;
                spaceItem.EntityID = tasksEntityInfo.ID;
                spaceItem.RecordID = 'ID|' + taskId;
                spaceItem.Band = 'Shared';
                spaceItem.PromotedAt = new Date();
                spaceItem.PromotedByUserID = md.CurrentUser?.ID || null;
                const saved = await spaceItem.Save();
                if (!saved) {
                    LogError('Failed to link task to space item: ' + (spaceItem.LatestResult?.CompleteMessage ?? ''));
                }
            }

            await this.loadSpaceTasks(this.activeSpaceId);
            this.RefreshView();
        } catch (err) {
            LogError('Error linking task to space: ' + (err instanceof Error ? err.message : String(err)));
        }
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
        const found = this.spaces.find(s => s.id === node.id);
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
        this.activeRoomConvId = convId;
        this.activeTab = 'Chat';
        this.UpdateQueryParams({ tab: 'chat', conv: convId });
        void this.loadOverviewMessages(convId);
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
            const md = this.ProviderToUse;
            const filesEntity = md.EntityByName('MJ: Files');
            if (!filesEntity) throw new Error('MJ: Files entity not found in metadata');

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

                const client = new CollaborationClient();
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
            } else {
                const fileRecord = await md.GetEntityObject<MJFileEntity>('MJ: Files');
                fileRecord.NewRecord();
                fileRecord.Name = payload.title;
                fileRecord.ProviderID = '93DBCFC9-5B2A-48D6-9D95-E93B319C88E5'; // External URL
                fileRecord.ProviderKey = payload.url || '';
                fileRecord.Status = 'Active';
                fileRecord.ContentType = payload.kind === 'xls' ? 'application/vnd.google-apps.spreadsheet'
                    : payload.kind === 'ppt' ? 'application/vnd.google-apps.presentation'
                    : 'application/vnd.google-apps.document';

                const fileSaved = await fileRecord.Save();
                if (!fileSaved) {
                    throw new Error('Failed to save file record: ' + (fileRecord.LatestResult?.CompleteMessage || 'Unknown error'));
                }

                const itemRecord = await md.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>('MJ_BizApps_Collaboration: Space Items');
                itemRecord.NewRecord();
                itemRecord.SpaceID = this.activeSpaceId;
                itemRecord.EntityID = filesEntity.ID;
                itemRecord.RecordID = 'ID|' + fileRecord.ID;
                itemRecord.Band = payload.band;
                itemRecord.Folder = payload.folder || 'Deliverables';
                if (payload.band === 'Shared') {
                    itemRecord.PromotedAt = new Date();
                    itemRecord.PromotedByUserID = md.CurrentUser?.ID || null;
                } else {
                    itemRecord.PromotedAt = null;
                    itemRecord.PromotedByUserID = null;
                }

                const itemSaved = await itemRecord.Save();
                if (!itemSaved) {
                    throw new Error('Failed to save space item: ' + (itemRecord.LatestResult?.CompleteMessage || 'Unknown error'));
                }
            }

            await this.loadSpaceItems(this.activeSpaceId);
            this.isUploadDialogOpen = false;
        } catch (err) {
            LogError('Error submitting upload: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            this.isUploading = false;
            this.RefreshView();
        }
    }

    public onTaskSelected(task: TaskItemModel): void {
        console.log('Task selected:', task.name);
    }

    public async onTaskToggled(task: TaskItemModel): Promise<void> {
        const isCompleted = task.status === 'Completed';
        const newEntityStatus: TaskEntity['Status'] = isCompleted ? 'InProgress' : 'Completed';
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
                await taskEntity.Save();
            }
        } catch (err) {
            LogError('Error toggling task: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    public async onCreateTask(payload: { name: string; band: SpaceBand; priority: string }): Promise<void> {
        try {
            const md = this.ProviderToUse;
            const taskEntity = await md.GetEntityObject<TaskEntity>('MJ_BizApps_Tasks: Tasks');
            taskEntity.NewRecord();
            taskEntity.Name = payload.name;
            taskEntity.Status = 'Open';
            const priorityMap: Record<string, TaskEntity['Priority']> = {
                Low: 'Low',
                Medium: 'Medium',
                High: 'High',
                Urgent: 'Critical',
                Critical: 'Critical',
            };
            taskEntity.Priority = priorityMap[payload.priority] || 'Medium';
            taskEntity.PercentComplete = 0;
            taskEntity.Sequence = this.spaceTasks.length + 1;

            const rv = new RunView(this.RunViewToUse);
            const typeRes = await rv.RunView<{ ID: string }>({
                EntityName: 'MJ_BizApps_Tasks: Task Types',
                ResultType: 'simple',
                MaxRows: 1,
            });
            if (typeRes?.Success && typeRes.Results?.[0]) {
                taskEntity.TypeID = typeRes.Results[0].ID;
            }
            const saved = await taskEntity.Save();
            if (!saved) {
                LogError('Failed to save task: ' + (taskEntity.LatestResult?.CompleteMessage ?? ''));
                return;
            }

            const tasksEntityInfo = md.EntityByName('MJ_BizApps_Tasks: Tasks');
            const spaceItem = await md.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>('MJ_BizApps_Collaboration: Space Items');
            spaceItem.NewRecord();
            spaceItem.SpaceID = this.activeSpaceId;
            spaceItem.EntityID = tasksEntityInfo!.ID;
            spaceItem.RecordID = 'ID|' + taskEntity.ID;
            spaceItem.Band = payload.band;
            if (payload.band === 'Shared') {
                spaceItem.PromotedAt = new Date();
                spaceItem.PromotedByUserID = md.CurrentUser?.ID || null;
            } else {
                spaceItem.PromotedAt = null;
                spaceItem.PromotedByUserID = null;
            }
            await spaceItem.Save();
            await this.loadSpaceTasks(this.activeSpaceId);
            this.RefreshView();
        } catch (err) {
            LogError('Error creating task: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    public async onSendChatMessage(payload: string | { text: string; executeAgent?: boolean }): Promise<void> {
        const text = typeof payload === 'string' ? payload : payload.text;
        const executeAgent = typeof payload === 'string'
            ? /(@(assistant|agent)|^\/ask)/i.test(payload)
            : (payload.executeAgent ?? /(@(assistant|agent)|^\/ask)/i.test(payload.text));
        try {
            const client = new CollaborationClient();
            const res = await client.PostSpaceMessage({
                SpaceID: this.activeSpaceId,
                Text: text,
                ExecuteAgent: executeAgent,
            });
            if (!res.Success) {
                LogError('Failed to post space message: ' + (res.ErrorMessage ?? ''));
            }
            await this.loadSpaceConversations(this.activeSpaceId, this.activeConversationId);
            this.RefreshView();
        } catch (err) {
            LogError('Error sending message: ' + (err instanceof Error ? err.message : String(err)));
        }
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
                LogError('User not found in system with email: ' + payload.email);
                return;
            }

            const existingMember = await rv.RunView<{ ID: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                ExtraFilter: `SpaceID = '${this.activeSpaceId}' AND UserID = '${userId}'`,
                ResultType: 'simple',
                MaxRows: 1,
            });
            if (existingMember?.Success && existingMember.Results?.[0]) {
                return;
            }

            const roleRes = await rv.RunView<{ ID: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Role Types',
                ExtraFilter: `Code = '${payload.role.toLowerCase()}'`,
                ResultType: 'simple',
                MaxRows: 1,
            });
            const roleId = roleRes?.Success && roleRes.Results?.[0]?.ID;
            if (!roleId || !userId) return;

            const memberEntity = await md.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>('MJ_BizApps_Collaboration: Space Members');
            memberEntity.NewRecord();
            memberEntity.SpaceID = this.activeSpaceId;
            memberEntity.UserID = userId;
            memberEntity.SpaceRoleTypeID = roleId;
            memberEntity.Band = payload.band;
            memberEntity.Status = 'Active';
            await memberEntity.Save();

            await this.loadSpaceMembers(this.activeSpaceId);
            this.RefreshView();
        } catch (err) {
            LogError('Error inviting member: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    public async onSaveSettings(settings: SpaceSettingsModel): Promise<void> {
        this.isSavingSettings = true;
        this.settingsSaveSuccess = '';
        this.RefreshView();
        try {
            const targetId = settings.id || this.activeSpaceId;
            if (!targetId || !isValidUuid(targetId)) {
                LogError('Cannot save space settings: invalid or missing space ID');
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
                await spaceEntity.Save();

                this.spaceTitle = settings.name;
                this.spaceSubtitle = settings.description;
                this.headerTypeIcon = settings.iconClass;
                this.headerTypeColor = settings.color;
                this.headerBackgroundImageUrl = settings.backgroundImageUrl || null;

                const raw = this.rawSpaces.find(s => s.ID === targetId);
                if (raw) {
                    raw.Name = settings.name;
                    raw.Description = settings.description;
                    raw.IconClass = settings.iconClass;
                    raw.Color = settings.color;
                    raw.BackgroundImageURL = settings.backgroundImageUrl || null;
                    raw.InheritsMembership = settings.inheritsMembership;
                    raw.AgentRetrieval = settings.agentRetrieval;
                    raw.Retention = settings.retention;
                    this.spaces = this.buildSpaceRailNodes(this.rawSpaces);
                }

                this.settingsSaveSuccess = 'Space settings saved successfully.';
            }
        } catch (err) {
            LogError('Error saving settings: ' + (err instanceof Error ? err.message : String(err)));
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
