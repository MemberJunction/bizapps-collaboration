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
        footerOrgName: string;
        footerOrgInitial: string;
        footerStatusText: string;
    };
    header: {
        crumbs: BreadcrumbItem[];
        typeCode: string;
        title: string;
        typeLabel: string;
        statusLabel: string;
        statusVariant: 'ok' | 'warn' | 'plain';
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
        userInitials: 'A',
        userColorClass: 'c1',
    },
    rail: {
        spaces: [
            { id: 'northwind', name: 'Northwind', typeCode: 'rel', iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: true },
            { id: 'discovery', name: 'Discovery', typeCode: 'eng', iconClass: 'fa-solid fa-compass', level: 1, unread: true },
            { id: 'delivery', name: 'Delivery', typeCode: 'eng', iconClass: 'fa-solid fa-truck-fast', level: 1, meta: 'Oct 20' },
        ],
        footerOrgName: 'Meridian Advisory',
        footerOrgInitial: 'M',
        footerStatusText: 'Your team is online',
    },
    header: {
        crumbs: [{ label: 'Spaces' }, { label: 'Northwind' }, { label: 'Discovery' }],
        typeCode: 'eng',
        title: 'Discovery',
        typeLabel: 'Engagement',
        statusLabel: 'Active',
        statusVariant: 'ok',
        subtitle: 'Supply-chain operating model diagnostic · Week 7 of 10 · Readout Oct 9',
        staffAvatars: [
            { initials: 'A', name: 'Ada Lovelace', colorClass: 'c1' },
            { initials: 'S', name: 'Sam Taylor', colorClass: 'c2' },
            { initials: 'P', name: 'Priya Patel', colorClass: 'c3' },
        ],
        outsideAvatars: [
            { initials: 'C', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
            { initials: 'B', name: 'Bea Vance', colorClass: 'c5', isOutside: true },
            { initials: 'O', name: 'Omar Ortiz', colorClass: 'c6', isOutside: true },
            { initials: 'L', name: 'Lena Chen', colorClass: 'c7', isOutside: true },
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
