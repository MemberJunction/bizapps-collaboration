import type {
    TabItem,
    BreadcrumbItem,
    RailSpaceNode,
    AvatarItem,
    NeedsYouItemModel,
    ItemCardModel,
    ItemRowModel,
    RoomMiniMessage,
    SubSpaceSummary,
} from '@mj-biz-apps/collaboration-ng-widgets';

export interface Frame02FixtureData {
    topbar: {
        appName: string;
        workspaceName: string;
        userInitials: string;
        userColorClass: string;
    };
    rail: {
        spaces: RailSpaceNode[];
        inboxCount: number;
        taskCount: number;
    };
    header: {
        crumbs: BreadcrumbItem[];
        typeColor: string;
        typeIconClass: string;
        title: string;
        typeName: string;
        status: 'Active' | 'Closed' | string;
        subtitle: string;
        staffAvatars: AvatarItem[];
        outsideAvatars: AvatarItem[];
        totalPeople: number;
        audienceSummary: string;
        tabs: TabItem[];
        activeTabId: string;
    };
    needsYouItems: NeedsYouItemModel[];
    sharedItems: ItemCardModel[];
    teamItems: ItemRowModel[];
    roomMessages: RoomMiniMessage[];
    subSpaces: SubSpaceSummary[];
}

export const SPACE_TYPE_COLORS: Record<string, string> = {
    rel: '#092340', // Client relationship (Navy)
    eng: '#0076b6', // Engagement (Blue)
    com: '#d97706', // Committee (Amber/Orange)
    coh: '#16a34a', // Cohort (Green)
    wks: '#7c3aed', // Workspace (Purple)
};

export const FRAME_02_FIXTURE: Frame02FixtureData = {
    topbar: {
        appName: 'Collaboration',
        workspaceName: 'Northwind',
        userInitials: 'AL',
        userColorClass: 'c1',
    },
    rail: {
        inboxCount: 4,
        taskCount: 6,
        spaces: [
            { id: 'northwind', name: 'Northwind', color: SPACE_TYPE_COLORS['rel'], iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: true },
            { id: 'discovery', name: 'Discovery', color: SPACE_TYPE_COLORS['eng'], iconClass: 'fa-solid fa-compass', level: 1, hasChildren: true, isExpanded: true, unread: true },
            { id: 'fieldnotes', name: 'Field notes', color: SPACE_TYPE_COLORS['eng'], iconClass: 'fa-solid fa-clipboard', level: 2, hasChildren: false, isExpanded: false },
            { id: 'delivery', name: 'Delivery', color: SPACE_TYPE_COLORS['eng'], iconClass: 'fa-solid fa-truck-fast', level: 1, hasChildren: true, isExpanded: false, isLocked: true },
            { id: 'closed', name: 'Closed', color: SPACE_TYPE_COLORS['eng'], iconClass: 'fa-solid fa-box-archive', level: 1, hasChildren: true, isExpanded: false, meta: '2', isDim: true },
            { id: 'committee', name: 'Audit Committee', color: SPACE_TYPE_COLORS['com'], iconClass: 'fa-solid fa-landmark', level: 0, hasChildren: true, isExpanded: false, unread: true },
            { id: 'cohort', name: 'Spring Leadership Cohort', color: SPACE_TYPE_COLORS['coh'], iconClass: 'fa-solid fa-graduation-cap', level: 0, hasChildren: true, isExpanded: false },
            { id: 'pinecrest', name: 'Pinecrest Health', color: SPACE_TYPE_COLORS['rel'], iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: false },
            { id: 'studio', name: 'Studio', color: SPACE_TYPE_COLORS['wks'], iconClass: 'fa-solid fa-shapes', level: 0, hasChildren: true, isExpanded: false },
        ],
    },
    header: {
        crumbs: [{ label: 'Spaces' }, { label: 'Northwind' }, { label: 'Discovery' }],
        typeColor: SPACE_TYPE_COLORS['eng'],
        typeIconClass: 'fa-solid fa-compass',
        title: 'Discovery',
        typeName: 'Engagement',
        status: 'Active',
        subtitle: 'Supply-chain operating model diagnostic · Week 7 of 10 · Readout Oct 9',
        staffAvatars: [
            { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
            { initials: 'SO', name: 'Sam Okafor', colorClass: 'c9' },
            { initials: 'PS', name: 'Priya Shah', colorClass: 'c6' },
        ],
        outsideAvatars: [
            { initials: 'CM', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
            { initials: 'BT', name: 'Bea Tanaka', colorClass: 'c5', isOutside: true },
            { initials: 'OH', name: 'Omar Haddad', colorClass: 'c3', isOutside: true },
            { initials: 'LF', name: 'Lena Fischer', colorClass: 'c2', isOutside: true },
        ],
        totalPeople: 9,
        audienceSummary: '3 Meridian · 6 Northwind',
        tabs: [
            { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high' },
            { id: 'Library', label: 'Library', iconClass: 'fa-solid fa-folder-open', count: 24 },
            { id: 'Work', label: 'Work', iconClass: 'fa-solid fa-list-check', count: 10 },
            { id: 'Chat', label: 'Chat', iconClass: 'fa-solid fa-comments', count: 3 },
            { id: 'People', label: 'People', iconClass: 'fa-solid fa-user-group', count: 9 },
            { id: 'Settings', label: 'Settings', iconClass: 'fa-solid fa-sliders' },
        ],
        activeTabId: 'Overview',
    },
    needsYouItems: [
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
    ],
    sharedItems: [
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
    ],
    teamItems: [
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
    ],
    roomMessages: [
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
    ],
    subSpaces: [
        {
            id: 'sub-1',
            name: 'Field notes',
            type: 'eng',
            iconClass: 'fa-solid fa-clipboard',
            description: 'Same people as Discovery · 6 Team items',
        },
    ],
};
