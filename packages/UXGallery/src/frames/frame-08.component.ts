import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    CollabSpaceRailComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceTabsComponent,
    CollabAudiencePillComponent,
} from '@mj-biz-apps/collaboration-ng-widgets';
import {
    ExampleBoardNextMeetingCard,
    ExampleBoardAgendaCard,
    ExampleBoardVoteCard,
    ExampleBoardMembersCard,
    ExampleBoardMeetingsTab,
    ExampleBoardMotionsTab,
    ExampleBoardPapersTab,
} from '@mj-biz-apps/collaboration-example-space-types-ng';
import { FRAME_08_FIXTURE, type Frame08FixtureData } from '../fixtures/frame-08.fixture.js';

@Component({
    selector: 'gallery-frame-08',
    standalone: true,
    imports: [
        CommonModule,
        CollabSpaceRailComponent,
        CollabSpaceHeaderComponent,
        CollabSpaceTabsComponent,
        CollabAudiencePillComponent,
        ExampleBoardNextMeetingCard,
        ExampleBoardAgendaCard,
        ExampleBoardVoteCard,
        ExampleBoardMembersCard,
        ExampleBoardMeetingsTab,
        ExampleBoardMotionsTab,
        ExampleBoardPapersTab,
    ],
    template: `
        <div class="shell">
            <!-- Topbar (56px) -->
            <header class="topbar">
                <span class="mark"></span>
                <span class="app-pill"><i class="fa-solid fa-people-roof"></i>{{ f.topbar.appName }}<i class="fa-solid fa-chevron-down caret"></i></span>
                <span class="spacer"></span>
                <span class="search"><i class="fa-solid fa-magnifying-glass"></i>Search everything…<span class="kbd">⌘K</span></span>
                <span class="icon-btn"><i class="fa-regular fa-bell"></i><span class="dot"></span></span>
                <span class="av c10 md ext" title="Dana Whitfield">{{ f.topbar.userInitials }}</span>
            </header>

            <div class="body">
                <mjc-space-rail
                    [Spaces]="f.rail.spaces"
                    [ActiveSpaceId]="'audit-committee'"
                    [InboxCount]="f.rail.inboxCount"
                    [TaskCount]="f.rail.taskCount"
                ></mjc-space-rail>

                <main class="main">
                    <mjc-space-header
                        [Breadcrumbs]="f.header.crumbs"
                        [TypeColor]="f.header.typeColor"
                        [TypeIconClass]="f.header.typeIconClass"
                        [Title]="f.header.title"
                        [TypeName]="f.header.typeName"
                        [Status]="f.header.status"
                        [Subtitle]="f.header.subtitle"
                    >
                        <div actions class="row gap8">
                            <mjc-audience-pill
                                [StaffAvatars]="f.header.staffAvatars"
                                [OutsideAvatars]="f.header.outsideAvatars"
                                [TotalPeople]="f.header.totalPeople"
                                [Summary]="f.header.audienceSummary"
                            ></mjc-audience-pill>
                        </div>
                        <mjc-space-tabs
                            [Tabs]="f.header.tabs"
                            [ActiveTab]="activeTab"
                            (TabSelectRequested)="activeTab = $event"
                        ></mjc-space-tabs>
                    </mjc-space-header>

                    <!-- Tab Views -->
                    @if (activeTab === 'overview') {
                        <div class="cm">
                            <section class="col">
                                <mjc-example-board-next-meeting-card></mjc-example-board-next-meeting-card>
                                <mjc-example-board-agenda-card></mjc-example-board-agenda-card>
                            </section>
                            <aside class="col">
                                <mjc-example-board-vote-card></mjc-example-board-vote-card>
                                <div class="card ask" style="border: 1px solid var(--mj-border-default); border-radius: 12px; background: var(--mj-bg-surface-card); padding: 16px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 28px; height: 28px; border-radius: 8px; background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); display: grid; place-items: center; font-size: 13px;">
                                            <i class="fa-solid fa-sparkles"></i>
                                        </div>
                                        <div>
                                            <div style="font-weight: 700; font-size: 14px;">Ask about this committee</div>
                                            <div style="font-size: 12px; color: var(--mj-text-muted);">Private to you</div>
                                        </div>
                                    </div>
                                    <div style="margin-top: 12px; height: 40px; border-radius: 10px; border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface); display: flex; align-items: center; padding: 0 12px; font-size: 13px; color: var(--mj-text-muted);">
                                        How does the fee compare to last year?
                                    </div>
                                    <div style="margin-top: 10px; font-size: 12px; color: var(--mj-text-secondary); display: flex; gap: 7px;">
                                        <i class="fa-solid fa-lock" style="margin-top: 2px;"></i>
                                        <span>Uses papers published to members, never unpublished drafts.</span>
                                    </div>
                                </div>
                                <mjc-example-board-members-card></mjc-example-board-members-card>
                            </aside>
                        </div>
                    } @else if (activeTab === 'meetings') {
                        <mjc-example-board-meetings-tab></mjc-example-board-meetings-tab>
                    } @else if (activeTab === 'papers') {
                        <mjc-example-board-papers-tab></mjc-example-board-papers-tab>
                    } @else if (activeTab === 'motions') {
                        <mjc-example-board-motions-tab></mjc-example-board-motions-tab>
                    } @else {
                        <div style="padding: 32px; color: var(--mj-text-muted);">
                            {{ activeTab | titlecase }} view
                        </div>
                    }
                </main>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            width: 1440px;
            height: 900px;
            background: var(--mj-bg-surface);
            color: var(--mj-text-primary);
        }
        .shell {
            display: flex;
            flex-direction: column;
            width: 1440px;
            height: 900px;
            overflow: hidden;
        }
        .topbar {
            height: 56px;
            background: var(--mj-bg-surface);
            border-bottom: 1px solid var(--mj-border-default);
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 16px;
            flex: none;
        }
        .app-pill {
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .spacer {
            flex: 1;
        }
        .search {
            background: var(--mj-bg-surface-card);
            border: 1px solid var(--mj-border-default);
            border-radius: 8px;
            padding: 6px 12px;
            font-size: 13px;
            color: var(--mj-text-muted);
            display: flex;
            align-items: center;
            gap: 8px;
            width: 260px;
        }
        .kbd {
            margin-left: auto;
            font-size: 11px;
            background: var(--mj-bg-surface);
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid var(--mj-border-default);
        }
        .body {
            display: flex;
            flex: 1;
            min-height: 0;
        }
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            overflow-y: auto;
        }
        .cm {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 344px;
            gap: 18px;
            padding: 16px 28px;
            min-height: 0;
        }
        .col {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-width: 0;
        }
        .row {
            display: flex;
            align-items: center;
        }
        .gap8 {
            gap: 8px;
        }
        .av {
            width: 32px;
            height: 32px;
            border-radius: 99px;
            display: grid;
            place-items: center;
            font-size: 12px;
            font-weight: 700;
        }
        .av.c10 {
            background: #fbcfe8;
            color: #9d174d;
        }
        .av.ext {
            border: 2px solid #ec4899;
        }
    `],
})
export class Frame08Component {
    public f: Frame08FixtureData = FRAME_08_FIXTURE;
    public activeTab: string = 'overview';
}
