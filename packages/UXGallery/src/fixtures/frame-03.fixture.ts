import type {
    TabItem,
    BreadcrumbItem,
    RailSpaceNode,
    AvatarItem,
    LibraryRowModel,
    RecentUseModel,
    LibraryCollection,
    LibrarySmartView,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { FRAME_02_FIXTURE, SPACE_TYPE_COLORS } from './frame-02.fixture';

export interface Frame03FixtureData {
    topbar: typeof FRAME_02_FIXTURE.topbar;
    rail: typeof FRAME_02_FIXTURE.rail;
    header: typeof FRAME_02_FIXTURE.header;
    collections: LibraryCollection[];
    smartViews: LibrarySmartView[];
    allMaterialCount: number;
    rows: LibraryRowModel[];
    selectedItem: {
        id: string;
        title: string;
        meta: string;
        kind: string;
        band: 'Team' | 'Shared';
        bandLabel: string;
        bandSubtitle: string;
        bandAvatars: AvatarItem[];
        snippets: string[];
        flagCount: number;
        flagTitle: string;
        flagDescription: string;
        recentUses: RecentUseModel[];
    };
}

export const FRAME_03_FIXTURE: Frame03FixtureData = {
    topbar: FRAME_02_FIXTURE.topbar,
    rail: FRAME_02_FIXTURE.rail,
    header: {
        ...FRAME_02_FIXTURE.header,
        activeTabId: 'Library',
    },
    allMaterialCount: 24,
    collections: [
        { id: 'deliv', name: 'Deliverables', band: 'Shared', count: 5 },
        { id: 'maps', name: 'Process maps', band: 'Shared', count: 3 },
        { id: 'interviews', name: 'Interviews', band: 'Team', count: 9 },
        { id: 'vendor', name: 'Vendor scoring', band: 'Team', count: 3 },
        { id: 'contracts', name: 'Contracts', band: 'Team', count: 2 },
    ],
    smartViews: [
        { id: 'northwind', name: 'From Northwind', iconClass: 'fa-solid fa-inbox', count: 4 },
        { id: 'flagged', name: 'Flagged', iconClass: 'fa-solid fa-triangle-exclamation', count: 1 },
        { id: 'shared-week', name: 'Shared this week', iconClass: 'fa-regular fa-clock', count: 2 },
    ],
    rows: [
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
    ],
    selectedItem: {
        id: 'row-3',
        title: 'Interview synthesis v3',
        meta: 'Word · 18 pages · version 3',
        kind: 'doc',
        band: 'Team',
        bandLabel: 'Team only',
        bandSubtitle: 'Meridian staff',
        bandAvatars: [
            { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
            { initials: 'SO', name: 'Sam Okafor', colorClass: 'c9' },
            { initials: 'PS', name: 'Priya Shah', colorClass: 'c6' },
        ],
        snippets: [
            'Across 18 interviews, scheduling came up more than any other theme. <mark>As the Dayton plant manager told us</mark>, the current tool “can’t see past Tuesday.”',
            'Finance reports a nine-day close on inventory reconciliation; <mark>Jim in Finance</mark> described the process as manual.',
        ],
        flagCount: 2,
        flagTitle: '2 people could be identified',
        flagDescription: 'Checked when Sam asked to share it. Review the highlighted phrases before Northwind sees them.',
        recentUses: [
            {
                id: 'use-1',
                isSpark: true,
                text: 'Cited in <b>Meridian team</b> chat',
                timestamp: '2h',
            },
            {
                id: 'use-2',
                avatar: { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
                text: 'Ada opened it',
                timestamp: '1h',
            },
            {
                id: 'use-3',
                avatar: { initials: 'SO', name: 'Sam Okafor', colorClass: 'c9' },
                text: 'Sam uploaded version 3',
                timestamp: '2h',
            },
        ],
    },
};
