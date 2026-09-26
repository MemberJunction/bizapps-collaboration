import type { TabItem, BreadcrumbItem, RailSpaceNode, AvatarItem } from '@mj-biz-apps/collaboration-ng-widgets';

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
        typeCode: string;
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
}

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
            { id: 'northwind', name: 'Northwind', typeCode: 'rel', iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: true },
            { id: 'discovery', name: 'Discovery', typeCode: 'eng', iconClass: 'fa-solid fa-compass', level: 1, hasChildren: true, isExpanded: true, unread: true },
            { id: 'fieldnotes', name: 'Field notes', typeCode: 'eng', iconClass: 'fa-solid fa-clipboard', level: 2, hasChildren: false, isExpanded: false },
            { id: 'delivery', name: 'Delivery', typeCode: 'eng', iconClass: 'fa-solid fa-truck-fast', level: 1, hasChildren: true, isExpanded: false, isLocked: true },
            { id: 'closed', name: 'Closed', typeCode: 'eng', iconClass: 'fa-solid fa-box-archive', level: 1, hasChildren: true, isExpanded: false, meta: '2', isDim: true },
            { id: 'committee', name: 'Audit Committee', typeCode: 'com', iconClass: 'fa-solid fa-landmark', level: 0, hasChildren: true, isExpanded: false, unread: true },
            { id: 'cohort', name: 'Spring Leadership Cohort', typeCode: 'coh', iconClass: 'fa-solid fa-graduation-cap', level: 0, hasChildren: true, isExpanded: false },
            { id: 'pinecrest', name: 'Pinecrest Health', typeCode: 'rel', iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: false },
            { id: 'studio', name: 'Studio', typeCode: 'wks', iconClass: 'fa-solid fa-shapes', level: 0, hasChildren: true, isExpanded: false },
        ],
    },
    header: {
        crumbs: [{ label: 'Spaces' }, { label: 'Northwind' }, { label: 'Discovery' }],
        typeCode: 'eng',
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
};
