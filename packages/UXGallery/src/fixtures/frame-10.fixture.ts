import type { NoteModel, TabItem } from '@mj-biz-apps/collaboration-ng-widgets';
import { FRAME_02_FIXTURE } from './frame-02.fixture';

export interface Frame10DocumentSummary {
  spaceItemId: string;
  artifactId: string;
  title: string;
  band: 'Team' | 'Shared';
  folder: string;
  versionNumber: number;
  delegateLabel: string;
  excerpt: string;
  updatedLabel: string;
}

export interface Frame10FixtureData {
  topbar: typeof FRAME_02_FIXTURE.topbar;
  rail: typeof FRAME_02_FIXTURE.rail;
  header: {
    crumbs: typeof FRAME_02_FIXTURE.header.crumbs;
    typeColor: string;
    typeIconClass: string;
    title: string;
    typeName: string;
    status: string;
    subtitle: string;
    staffAvatars: typeof FRAME_02_FIXTURE.header.staffAvatars;
    outsideAvatars: typeof FRAME_02_FIXTURE.header.outsideAvatars;
    totalPeople: number;
    audienceSummary: string;
    tabs: TabItem[];
  };
  notes: NoteModel[];
  initialDocuments: Frame10DocumentSummary[];
}

export const FRAME_10_FIXTURE: Frame10FixtureData = {
  topbar: FRAME_02_FIXTURE.topbar,
  rail: FRAME_02_FIXTURE.rail,
  header: {
    ...FRAME_02_FIXTURE.header,
    tabs: [
      ...FRAME_02_FIXTURE.header.tabs.slice(0, 3),
      { id: 'Notes', label: 'Notes', iconClass: 'fa-solid fa-note-sticky', count: 4 },
      ...FRAME_02_FIXTURE.header.tabs.slice(3),
    ],
  },
  notes: [
    {
      id: 'note-team-1',
      title: 'Discovery Synthesis & Risk Register',
      body: '### Executive Takeaways\n**Priority finding**: consolidate regional handoffs and bind `DelegateRecordID` to the Team band before review.',
      band: 'Team',
      visibility: 'Space',
      authorUserId: 'user-ada',
      authorName: 'Ada Lovell',
      updatedLabel: '12m ago',
      isMine: true,
      canPromote: true,
      isPinned: true,
    },
    {
      id: 'note-shared-1',
      title: 'Joint Readout Agenda',
      body: '## Agenda Items\nConfirm milestone dates with **Northwind** stakeholders and capture action owners.',
      band: 'Shared',
      visibility: 'Space',
      authorUserId: 'user-casey',
      authorName: 'Casey Morgan',
      updatedLabel: '1h ago',
      isMine: false,
      canPromote: false,
      isPinned: false,
    },
    {
      id: 'note-private-1',
      title: 'Internal Staffing Scratchpad',
      body: '**Private draft**: review analyst capacity for phase two onboarding.',
      band: 'Team',
      visibility: 'Private',
      authorUserId: 'user-ada',
      authorName: 'Ada Lovell',
      updatedLabel: 'Yesterday',
      isMine: true,
      canPromote: false,
      isPinned: false,
    },
    {
      id: 'note-untitled-1',
      title: '   ',
      body: 'Quick follow-up checklist for vendor security questionnaire.',
      band: 'Team',
      visibility: 'Space',
      authorUserId: 'user-sam',
      authorName: 'Sam Okafor',
      updatedLabel: '2d ago',
      isMine: false,
      canPromote: true,
      isPinned: false,
    },
  ],
  initialDocuments: [
    {
      spaceItemId: 'item-doc-1',
      artifactId: 'art-doc-1',
      title: 'Operating Charter v2',
      band: 'Shared',
      folder: 'Deliverables',
      versionNumber: 2,
      delegateLabel: 'Delegated via Space Item (Shared)',
      excerpt: 'Governance milestones and quarterly review cadence agreed across participating teams.',
      updatedLabel: 'Sep 24',
    },
    {
      spaceItemId: 'item-doc-2',
      artifactId: 'art-doc-2',
      title: 'Architecture Tradeoff Memo',
      band: 'Team',
      folder: 'Notes',
      versionNumber: 1,
      delegateLabel: 'Delegated via Space Item (Team)',
      excerpt: 'Comparison of native editable Markdown Documents against static binary uploads.',
      updatedLabel: 'Yesterday',
    },
  ],
};
