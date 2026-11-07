/**
 * ExampleBoardUIDriver
 * Reference implementation of UI driver for board/committee spaces.
 * Extensibility plan § 6, § 10.3, UX plan Frame 08 (Slice I).
 */

import { RegisterClass } from '@memberjunction/global';
import {
    BaseSpaceTypeUIDriver,
    overlayDescriptors,
    type SpaceUIContext,
    type SpaceTabDescriptor,
    type SpaceOverviewCardDescriptor,
    type SpaceHeaderChipDescriptor,
    type SpaceHeaderActionDescriptor,
    type SpaceSettingsSectionDescriptor,
    type SpaceNewStepDescriptor,
    type SpaceDetailsFormDescriptor,
    type AfterSpaceOpenedEvent,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { ExampleBoardMeetingsTab } from './components/ExampleBoardMeetingsTab.js';
import { ExampleBoardPapersTab } from './components/ExampleBoardPapersTab.js';
import { ExampleBoardMotionsTab } from './components/ExampleBoardMotionsTab.js';
import { ExampleBoardNextMeetingCard } from './components/ExampleBoardNextMeetingCard.js';
import { ExampleBoardAgendaCard } from './components/ExampleBoardAgendaCard.js';
import { ExampleBoardVoteCard } from './components/ExampleBoardVoteCard.js';
import { ExampleBoardMembersCard } from './components/ExampleBoardMembersCard.js';

@RegisterClass(BaseSpaceTypeUIDriver, 'example-board')
export class ExampleBoardUIDriver extends BaseSpaceTypeUIDriver {
    /**
     * Relabels and orders tabs for board governance:
     * Overview, Meetings (4), Papers (18), Motions (1), Members, Chat, then the tabs the app keeps (Library, Work, Settings).
     * The Members tab carries no count of its own: the rail and the header show the real one.
     */
    public override GetTabs(
        _ctx: SpaceUIContext,
        defaultTabs: SpaceTabDescriptor[]
    ): SpaceTabDescriptor[] {
        const own: SpaceTabDescriptor[] = [
            {
                key: 'overview',
                label: 'Overview',
                icon: 'fa-solid fa-gauge-high',
                sortKey: 10,
            },
            {
                key: 'meetings',
                label: 'Meetings',
                icon: 'fa-solid fa-calendar-days',
                badgeCount: 4,
                sortKey: 11,
                component: ExampleBoardMeetingsTab,
            },
            {
                key: 'papers',
                label: 'Papers',
                icon: 'fa-solid fa-folder-open',
                badgeCount: 18,
                sortKey: 12,
                component: ExampleBoardPapersTab,
            },
            {
                key: 'motions',
                label: 'Motions',
                icon: 'fa-solid fa-gavel',
                badgeCount: 1,
                sortKey: 13,
                component: ExampleBoardMotionsTab,
            },
            {
                key: 'people',
                label: 'Members',
                icon: 'fa-solid fa-user-group',
                sortKey: 50,
            },
            {
                key: 'chat',
                label: 'Chat',
                icon: 'fa-solid fa-comments',
                sortKey: 55,
            },
        ];
        // What other apps contributed to boards stays: the board replaces the parts it names, and keeps the rest
        return overlayDescriptors(defaultTabs, own);
    }

    /**
     * Returns board overview cards corresponding to Frame 08: Next meeting, Agenda, Active vote, and Members list. Frame 08 is an
     * outside director's view (on the Shared band), so each card is a Shared card: a board that kept them Team-only would show that
     * director none of them.
     */
    public override GetOverviewCards(
        _ctx: SpaceUIContext,
        defaultCards: SpaceOverviewCardDescriptor[]
    ): SpaceOverviewCardDescriptor[] {
        return overlayDescriptors(defaultCards, [
            {
                key: 'next-meeting',
                title: 'Next Meeting',
                sortKey: 10,
                side: 'Shared',
                component: ExampleBoardNextMeetingCard,
            },
            {
                key: 'agenda',
                title: 'Agenda',
                sortKey: 20,
                side: 'Shared',
                component: ExampleBoardAgendaCard,
            },
            {
                key: 'vote',
                title: 'Active Vote',
                sortKey: 30,
                side: 'Shared',
                component: ExampleBoardVoteCard,
            },
            {
                key: 'members',
                title: 'Members',
                sortKey: 40,
                side: 'Shared',
                component: ExampleBoardMembersCard,
            },
        ]);
    }

    /**
     * Header chips for the board: "Committee", "FY2026 term".
     */
    public override GetHeaderChips(
        _ctx: SpaceUIContext,
        defaultChips: SpaceHeaderChipDescriptor[]
    ): SpaceHeaderChipDescriptor[] {
        return [
            ...defaultChips,
            {
                key: 'committee-chip',
                label: 'Committee',
                variant: 'plain',
                sortKey: 10,
            },
            {
                key: 'term-chip',
                label: 'FY2026 term',
                variant: 'plain',
                sortKey: 20,
            },
        ];
    }

    /**
     * Header actions for board: Add to calendar, Download pack.
     */
    public override GetHeaderActions(
        _ctx: SpaceUIContext,
        defaultActions: SpaceHeaderActionDescriptor[]
    ): SpaceHeaderActionDescriptor[] {
        return [
            ...defaultActions,
            {
                key: 'add-calendar',
                label: 'Add to calendar',
                icon: 'fa-regular fa-calendar-plus',
                action: () => {},
                sortKey: 15,
            },
            {
                key: 'download-pack',
                label: 'Download pack',
                icon: 'fa-regular fa-file-pdf',
                action: () => {},
                sortKey: 25,
            },
        ];
    }

    public override GetSettingsSections(
        _ctx: SpaceUIContext,
        defaultSections: SpaceSettingsSectionDescriptor[]
    ): SpaceSettingsSectionDescriptor[] {
        return [
            ...defaultSections,
            {
                key: 'charter-settings',
                title: 'Committee Charter & Quorum',
                description: 'Manage meeting cadence, quorum percentage, and voting thresholds.',
                sortKey: 50,
            },
        ];
    }

    public override GetNewSpaceSteps(
        _ctx: SpaceUIContext,
        defaultSteps: SpaceNewStepDescriptor[]
    ): SpaceNewStepDescriptor[] {
        return defaultSteps;
    }

    public override GetDetailsForm(
        _ctx: SpaceUIContext,
        _defaultForm?: SpaceDetailsFormDescriptor
    ): SpaceDetailsFormDescriptor | undefined {
        // The board keeps its term, cadence, quorum and charter in its subtype; the next meeting has its own card on the Overview
        return {
            entityName: 'MJ_BizApps_Collaboration_Examples: Example Boards',
            hiddenFieldNames: ['NextMeetingDate', 'NextMeetingLocation'],
        };
    }

    // Closing a board with motions open is refused on the server, from the space's own configuration
    // (ExampleBoardServerDriver.ValidateSpaceChange); the screen has nothing more to add.

    public override AfterSpaceOpened(_event: AfterSpaceOpenedEvent): void {
        // Board space opened hook
    }
}
