import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCollabPageNoteBody,
  serializeCollabPageBody,
  parseCollabPageFromNote,
  buildStarterPagesForSpace,
  mergeSpacePagesWithDefaults,
} from './space-pages-storage.ts';
import type { CollabPageModel, SpaceOverviewCardDescriptor } from '@mj-biz-apps/collaboration-ng-widgets';

describe('space-pages-storage', () => {
  it('identifies serialized custom page JSON vs plain markdown note body', () => {
    assert.equal(isCollabPageNoteBody(null), false);
    assert.equal(isCollabPageNoteBody('Just a regular markdown note.'), false);
    assert.equal(isCollabPageNoteBody('{"hello":"world"}'), false);

    const samplePage: CollabPageModel = {
      id: 'page-123',
      builtInTabId: 'Library',
      title: 'Documents & Library',
      iconClass: 'fa-solid fa-compass',
      pageType: 'Overview',
      band: 'Shared',
      status: 'Published',
      sequence: 0,
      collaborative: true,
      summary: 'Welcome guide',
      body: 'Introductory text',
      updatedLabel: 'Just now',
      authorName: 'Colin Brockman',
      blocks: [
        { id: 'b1', type: 'Heading', title: 'Welcome', subtitle: 'Start here' },
      ],
      comments: [],
    };

    const body = serializeCollabPageBody(samplePage);
    assert.equal(isCollabPageNoteBody(body), true);

    const parsed = parseCollabPageFromNote({
      id: 'note-row-1',
      title: 'Documents & Library',
      body,
      band: 'Shared',
      authorName: 'Colin Brockman',
      updatedLabel: '2m ago',
      canPromote: true,
    });

    assert.ok(parsed);
    assert.equal(parsed.id, 'note-row-1');
    assert.equal(parsed.builtInTabId, 'Library');
    assert.equal(parsed.title, 'Documents & Library');
    assert.equal(parsed.iconClass, 'fa-solid fa-compass');
    assert.equal(parsed.blocks.length, 1);
    assert.equal(parsed.blocks[0].title, 'Welcome');
    assert.equal(parsed.canPromote, true);
  });

  it('builds starter pages for all built-in space tabs and merges saved customizations + user pages', () => {
    const DummyCard = class {} as unknown as SpaceOverviewCardDescriptor['component'];
    const pages = buildStarterPagesForSpace({
      spaceId: 's-1',
      spaceTitle: 'Board of Directors',
      spaceSubtitle: 'Quarterly governance and packets',
      spaceTypeName: 'Board',
      spaceTypeCode: 'board',
      contributedCards: [
        { key: 'board:motions', title: 'Motions & Votes', side: 'Shared', sortKey: 45, component: DummyCard },
      ],
      defaultBand: 'Shared',
      libraryRows: [
        { id: 'doc-1', kind: 'pdf', name: 'Q3 Financial Packet.pdf', folder: 'Packets', band: 'Shared', who: 'Ada', when: 'Today' },
      ],
      spaceMembers: [
        { id: 'm1', userId: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', initials: 'AL', roleName: 'Chair', roleCode: 'owner', band: 'Shared', status: 'Active' },
      ],
    });

    assert.equal(pages.length, 6);
    assert.deepEqual(pages.map((p) => p.builtInTabId), ['Overview', 'Library', 'Data', 'Work', 'Notes', 'People']);
    assert.equal(pages[0].band, 'Shared');
    assert.equal(pages[0].isSeed, true);
    // Overview contains the registered blocks whose defaultTabs include 'Overview' plus contributed cards
    assert.equal(pages[0].blocks.find((b) => b.type === 'collab:pinned')?.width, 'full');
    assert.equal(pages[0].blocks.find((b) => b.type === 'collab:needs-you')?.width, 'main');
    assert.equal(pages[0].blocks.find((b) => b.type === 'collab:shared-files')?.width, 'main');
    assert.equal(pages[0].blocks.find((b) => b.type === 'collab:team-files')?.width, 'main');
    assert.equal(pages[0].blocks.find((b) => b.type === 'collab:ask-box')?.width, 'side');
    assert.equal(pages[0].blocks.find((b) => b.type === 'collab:discussion')?.width, 'side');
    assert.equal(pages[0].blocks.find((b) => b.type === 'board:motions')?.width, 'side');
    assert.equal(pages[0].blocks.find((b) => b.type === 'collab:about')?.width, 'side');
    assert.equal(pages[0].blocks.some((b) => b.type === 'collab:sub-spaces'), false);
    assert.equal(pages[1].blocks.some((b) => b.type === 'collab:main-view'), true);

    const savedCustomOverview: CollabPageModel = {
      ...pages[0],
      id: 'saved-overview-1',
      isSeed: false,
      title: 'Custom Board Overview',
      widgetsInitialized: true,
      blocks: [
        { id: 'seed-blk-shared-files', type: 'collab:shared-files', title: '', width: 'main' },
        { id: 'seed-blk-ask-box', type: 'collab:ask-box', title: '', width: 'side' },
      ],
    };
    const legacySavedLibrary: CollabPageModel = {
      ...pages[1],
      id: 'saved-library-legacy',
      isSeed: false,
      widgetsInitialized: false,
      blocks: [{ id: 'custom-callout', type: 'Callout', title: 'Upload Guidelines', body: 'PDF only' }],
    };
    const extraCustomPage: CollabPageModel = {
      id: 'custom-roadmap-1',
      builtInTabId: null,
      title: '2026 Strategic Roadmap',
      iconClass: 'fa-solid fa-road',
      pageType: 'Roadmap',
      band: 'Shared',
      status: 'Published',
      sequence: 10,
      collaborative: true,
      summary: 'Quarter-by-quarter plan',
      body: '',
      blocks: [],
      comments: [],
      updatedLabel: 'Just now',
      authorName: 'Ada',
      isSeed: false,
    };

    const merged = mergeSpacePagesWithDefaults([savedCustomOverview, legacySavedLibrary, extraCustomPage], pages);
    assert.equal(merged.length, 7);
    assert.equal(merged[0].id, 'saved-overview-1');
    assert.equal(merged[0].title, 'Custom Board Overview');
    assert.equal(merged[0].blocks.find((b) => b.type === 'collab:shared-files')?.width, 'main');
    assert.equal(merged[0].blocks.find((b) => b.type === 'collab:ask-box')?.width, 'side');
    // Respects intentional removal of collab:about when widgetsInitialized is true
    assert.equal(merged[0].blocks.some((b) => b.type === 'collab:about'), false);
    // Upgrades legacy saved Library page by appending missing collab:main-view
    assert.equal(merged[1].id, 'saved-library-legacy');
    assert.equal(merged[1].blocks.length, 2);
    assert.equal(merged[1].blocks[0].id, 'custom-callout');
    assert.equal(merged[1].blocks[1].type, 'collab:main-view');
    assert.equal(merged[6].id, 'custom-roadmap-1');
    assert.equal(merged[6].builtInTabId, null);
  });
});
