/**
 * ExampleBoardUIDriver
 * Reference implementation of UI driver for board/committee spaces.
 * Extensibility plan § 6, § 10.3, UX plan Frame 08 (Slice I).
 */

import { RegisterClass } from '@memberjunction/global';
import {
    BaseSpaceTypeUIDriver,
    type SpaceUIContext,
    type SpaceTabDescriptor,
    type SpaceOverviewCardDescriptor,
    type SpaceHeaderChipDescriptor,
    type SpaceHeaderActionDescriptor,
    type SpaceSettingsSectionDescriptor,
    type SpaceNewStepDescriptor,
    type SpaceDetailsFormDescriptor,
    type BeforeCloseSpaceEvent,
    type BeforeCreateChildSpaceEvent,
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
     * Overview, Meetings (4), Papers (18), Motions (1), Members (7), Chat.
     */
    public override GetTabs(
        _ctx: SpaceUIContext,
        _defaultTabs: SpaceTabDescriptor[]
    ): SpaceTabDescriptor[] {
        const result: SpaceTabDescriptor[] = [
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
                sortKey: 20,
                component: ExampleBoardMeetingsTab,
            },
            {
                key: 'papers',
                label: 'Papers',
                icon: 'fa-solid fa-folder-open',
                badgeCount: 18,
                sortKey: 30,
                component: ExampleBoardPapersTab,
            },
            {
                key: 'motions',
                label: 'Motions',
                icon: 'fa-solid fa-gavel',
                badgeCount: 1,
                sortKey: 40,
                component: ExampleBoardMotionsTab,
            },
            {
                key: 'members',
                label: 'Members',
                icon: 'fa-solid fa-user-group',
                badgeCount: 7,
                sortKey: 50,
            },
            {
                key: 'chat',
                label: 'Chat',
                icon: 'fa-solid fa-comments',
                sortKey: 60,
            },
        ];
        return result;
    }

    /**
     * Returns board overview cards corresponding to Frame 08:
     * Next meeting, Agenda, Active vote, and Members list.
     */
    public override GetOverviewCards(
        _ctx: SpaceUIContext,
        _defaultCards: SpaceOverviewCardDescriptor[]
    ): SpaceOverviewCardDescriptor[] {
        return [
            {
                key: 'next-meeting',
                title: 'Next Meeting',
                sortKey: 10,
                component: ExampleBoardNextMeetingCard,
            },
            {
                key: 'agenda',
                title: 'Agenda',
                sortKey: 20,
                component: ExampleBoardAgendaCard,
            },
            {
                key: 'vote',
                title: 'Active Vote',
                sortKey: 30,
                component: ExampleBoardVoteCard,
            },
            {
                key: 'members',
                title: 'Members',
                sortKey: 40,
                component: ExampleBoardMembersCard,
            },
        ];
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
        return {
            entityName: 'ExampleBoard',
            hiddenSectionKeys: ['SpaceCore'],
        };
    }

    /**
     * Cancels space close if there are active votes/motions.
     */
    public override BeforeCloseSpace(
        event: BeforeCloseSpaceEvent
    ): void {
        if (event.spaceId.includes('active-vote')) {
            event.cancel = true;
            event.cancelReason = 'Cannot close Board space while motions are open for voting.';
        }
    }

    public override BeforeCreateChildSpace(
        event: BeforeCreateChildSpaceEvent
    ): void {
        if (event.childTypeCode === 'deal-room') {
            event.cancel = true;
            event.cancelReason = 'Boards cannot contain Deal Rooms.';
        }
    }

    public override AfterSpaceOpened(_event: AfterSpaceOpenedEvent): void {
        // Board space opened hook
    }
}
