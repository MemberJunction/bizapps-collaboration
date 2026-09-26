import type {
    RecipientPersonModel,
    FindingModel,
    FileKind,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { FRAME_03_FIXTURE } from './frame-03.fixture';

export interface Frame04FixtureData {
    topbar: typeof FRAME_03_FIXTURE.topbar;
    rail: typeof FRAME_03_FIXTURE.rail;
    header: typeof FRAME_03_FIXTURE.header;
    library: typeof FRAME_03_FIXTURE;
    dialog: {
        title: string;
        itemName: string;
        kind: FileKind;
        clientOrgName: string;
        recipientCount: number;
        audienceHeader: string;
        audienceStaffSub: string;
        recipients: RecipientPersonModel[];
        reviewHeader: string;
        reviewSub: string;
        findings: FindingModel[];
        note: string;
        notifyRecipients: boolean;
        authorName: string;
        timestamp: string;
    };
}

export const FRAME_04_FIXTURE: Frame04FixtureData = {
    topbar: FRAME_03_FIXTURE.topbar,
    rail: FRAME_03_FIXTURE.rail,
    header: FRAME_03_FIXTURE.header,
    library: FRAME_03_FIXTURE,
    dialog: {
        title: 'Share with Northwind',
        itemName: 'Interview synthesis v3',
        kind: 'doc',
        clientOrgName: 'Northwind',
        recipientCount: 6,
        audienceHeader: '6 people at Northwind will be able to open it',
        audienceStaffSub: 'Meridian’s 3 already can',
        recipients: [
            {
                id: 'rcp-1',
                avatar: { initials: 'CM', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
                name: 'Casey Morgan',
                role: 'VP Operations · Client admin',
            },
            {
                id: 'rcp-2',
                avatar: { initials: 'BT', name: 'Bea Tanaka', colorClass: 'c5', isOutside: true },
                name: 'Bea Tanaka',
                role: 'Operations analyst',
            },
            {
                id: 'rcp-3',
                avatar: { initials: 'OH', name: 'Omar Haddad', colorClass: 'c3', isOutside: true },
                name: 'Omar Haddad',
                role: 'Plant director, Dayton',
            },
            {
                id: 'rcp-4',
                avatar: { initials: 'LF', name: 'Lena Fischer', colorClass: 'c2', isOutside: true },
                name: 'Lena Fischer',
                role: 'CFO · read-only',
            },
            {
                id: 'rcp-more',
                avatar: { initials: '+2', name: '2 more', colorClass: 'c7', isOutside: true },
                name: '2 more',
                role: 'through Northwind',
                isMore: true,
                moreCount: 2,
                moreSubtitle: 'through Northwind',
            },
        ],
        reviewHeader: 'The Assistant checked it first',
        reviewSub: 'Two phrases could identify someone you interviewed under a promise of anonymity.',
        findings: [
            {
                id: 'fnd-1',
                quotation: '“…<mark>as the Dayton plant manager told us</mark>, the current tool can’t see past Tuesday.”',
                originalPhrase: 'as the Dayton plant manager told us',
                suggestedPhrase: 'as one plant leader told us',
                status: 'Flagged',
            },
            {
                id: 'fnd-2',
                quotation: '“Finance reports a nine-day close; <mark>Jim in Finance</mark> described the process as manual.”',
                originalPhrase: 'Jim in Finance',
                suggestedPhrase: 'a finance team member',
                status: 'Flagged',
            },
        ],
        note: 'Synthesis from all 18 interviews — we’ll walk through it together on Thursday.',
        notifyRecipients: true,
        authorName: 'Ada Lovell',
        timestamp: 'today at 10:14 AM',
    },
};
