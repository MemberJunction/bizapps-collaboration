import type {
    TabItem,
    BreadcrumbItem,
    RailSpaceNode,
    AvatarItem,
} from '@mj-biz-apps/collaboration-ng-widgets';

export interface Frame08FixtureData {
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
}

export const FRAME_08_FIXTURE: Frame08FixtureData = {
    topbar: {
        appName: 'Collaboration',
        workspaceName: 'Meridian Advisory',
        userInitials: 'DW',
        userColorClass: 'c10',
    },
    rail: {
        spaces: [
            {
                id: 'audit-committee',
                name: 'Audit Committee',
                color: '#d97706',
                iconClass: 'fa-solid fa-landmark',
                level: 0,
                hasChildren: false,
                isExpanded: false,
                unread: false,
            },
        ],
        inboxCount: 1,
        taskCount: 0,
    },
    header: {
        crumbs: [
            { label: 'Spaces' },
            { label: 'Audit Committee' },
        ],
        typeColor: '#d97706',
        typeIconClass: 'fa-solid fa-landmark',
        title: 'Audit Committee',
        typeName: 'Committee',
        status: 'Active',
        subtitle: 'Financial reporting, internal controls and the external audit · Meets quarterly',
        staffAvatars: [
            { initials: 'MC', name: 'Margaret Cole', colorClass: 'c6' },
            { initials: 'TR', name: 'Tom Reyes', colorClass: 'c3' },
            { initials: 'AL', name: 'Ada Lovell', colorClass: 'c1' },
        ],
        outsideAvatars: [
            { initials: 'DW', name: 'Dana Whitfield', colorClass: 'c10', isOutside: true },
            { initials: 'KM', name: 'Ken Mori', colorClass: 'c2', isOutside: true },
        ],
        totalPeople: 7,
        audienceSummary: '7 members · 2 outside directors',
        tabs: [
            { id: 'overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high' },
            { id: 'meetings', label: 'Meetings', count: 4, iconClass: 'fa-solid fa-calendar-days' },
            { id: 'papers', label: 'Papers', count: 18, iconClass: 'fa-solid fa-folder-open' },
            { id: 'motions', label: 'Motions', count: 1, iconClass: 'fa-solid fa-gavel' },
            { id: 'members', label: 'Members', count: 7, iconClass: 'fa-solid fa-user-group' },
            { id: 'chat', label: 'Chat', iconClass: 'fa-solid fa-comments' },
        ],
        activeTabId: 'overview',
    },
};
