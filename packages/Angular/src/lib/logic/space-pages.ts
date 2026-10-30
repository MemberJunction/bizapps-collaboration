import type {
    CollabPageBlock,
    CollabPageComment,
    CollabPageModel,
    CollabPageType,
    LibraryRowModel,
    SpaceBand,
    SpaceMemberModel,
    SpaceOverviewCardDescriptor,
    SpacePageBlockDescriptor,
} from '@mj-biz-apps/collaboration-ng-widgets';

export type BuiltInTabName = string;

export type StarterBlockDescriptor = Pick<
    SpacePageBlockDescriptor,
    'key' | 'defaultZone' | 'defaultTabs' | 'sortKey'
>;

const DEFAULT_BUILT_IN_BLOCK_DESCRIPTORS: readonly StarterBlockDescriptor[] = [
    { key: 'collab:pinned', defaultZone: 'full', defaultTabs: ['Overview'], sortKey: 10 },
    { key: 'collab:needs-you', defaultZone: 'main', defaultTabs: ['Overview'], sortKey: 20 },
    { key: 'collab:shared-files', defaultZone: 'main', defaultTabs: ['Overview'], sortKey: 30 },
    { key: 'collab:team-files', defaultZone: 'main', defaultTabs: ['Overview'], sortKey: 40 },
    { key: 'collab:ask-box', defaultZone: 'side', defaultTabs: ['Overview'], sortKey: 50 },
    { key: 'collab:discussion', defaultZone: 'side', defaultTabs: ['Overview'], sortKey: 60 },
    { key: 'collab:about', defaultZone: 'side', defaultTabs: ['Overview'], sortKey: 70 },
    { key: 'collab:sub-spaces', defaultZone: 'side', defaultTabs: [], sortKey: 80 },
    {
        key: 'collab:main-view',
        defaultZone: 'full',
        defaultTabs: ['Library', 'Data', 'Work', 'Notes', 'People'],
        sortKey: 90,
    },
];

export function starterBlocksForTab(
    builtInTabId: string,
    descriptors: readonly StarterBlockDescriptor[],
): CollabPageBlock[] {
    return [...descriptors]
        .filter((d) => d.defaultTabs?.includes(builtInTabId))
        .sort((a, b) => a.sortKey - b.sortKey)
        .map((d) => ({
            id: `seed-blk-${d.key.replace(/[^a-z0-9-]+/gi, '-')}`,
            type: d.key,
            title: '',
            width: d.defaultZone,
        }));
}

export interface SpacePagePayload {
    blocks: CollabPageBlock[];
    pageType?: CollabPageType;
    collaborative?: boolean;
    widgetsInitialized?: boolean;
    summary?: string;
    body?: string;
    comments?: CollabPageComment[];
}

export interface SpacePageRow {
    ID: string;
    SpaceID: string;
    BuiltInTab: BuiltInTabName | null;
    Title: string;
    IconClass: string | null;
    Band: SpaceBand;
    Status: 'Draft' | 'Published';
    Sequence: number;
    PublishedBlocks: string | null;
    DraftBlocks: string | null;
    DraftTitle: string | null;
    PublishedByUserID: string | null;
    PublishedByUser?: string | null;
    PublishedAt: string | Date | null;
    __mj_UpdatedAt?: string;
}

export interface SpacePageEntityTarget {
    SpaceID: string;
    BuiltInTab: BuiltInTabName | null;
    Title: string;
    IconClass: string | null;
    Band: SpaceBand;
    Status: 'Draft' | 'Published';
    Sequence: number;
    PublishedBlocks: string | null;
    DraftBlocks: string | null;
    DraftTitle: string | null;
    PublishedByUserID: string | null;
    PublishedAt: Date | null;
}

export function serializePagePayload(input: {
    blocks: CollabPageBlock[];
    pageType?: CollabPageType;
    collaborative?: boolean;
    widgetsInitialized?: boolean;
    summary?: string;
    body?: string;
    comments?: CollabPageComment[];
}): string {
    const payload: SpacePagePayload = {
        blocks: input.blocks ?? [],
        pageType: input.pageType ?? 'Overview',
        collaborative: input.collaborative ?? true,
        widgetsInitialized: input.widgetsInitialized ?? true,
        summary: input.summary ?? '',
        body: input.body ?? '',
        comments: input.comments ?? [],
    };
    return JSON.stringify(payload);
}

export function parsePagePayload(raw: string | null | undefined): Required<SpacePagePayload> {
    const empty: Required<SpacePagePayload> = {
        blocks: [],
        pageType: 'Overview',
        collaborative: true,
        widgetsInitialized: true,
        summary: '',
        body: '',
        comments: [],
    };
    if (!raw || !raw.trim()) return empty;
    try {
        const parsed = JSON.parse(raw) as CollabPageBlock[] | SpacePagePayload;
        if (Array.isArray(parsed)) {
            return { ...empty, blocks: parsed };
        }
        if (parsed && typeof parsed === 'object') {
            return {
                blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
                pageType: parsed.pageType ?? 'Overview',
                collaborative: parsed.collaborative ?? true,
                widgetsInitialized: parsed.widgetsInitialized ?? true,
                summary: parsed.summary ?? '',
                body: parsed.body ?? '',
                comments: Array.isArray(parsed.comments) ? parsed.comments : [],
            };
        }
        return empty;
    } catch {
        return empty;
    }
}

export function mapSpacePageRowToModel(
    row: SpacePageRow,
    opts: { authorName: string; updatedLabel: string; canPromote: boolean },
): CollabPageModel {
    const published = parsePagePayload(row.PublishedBlocks);
    const draft = row.DraftBlocks ? parsePagePayload(row.DraftBlocks) : null;
    const active = row.Status === 'Draft' && draft ? draft : published;
    return {
        id: row.ID,
        builtInTabId: row.BuiltInTab ?? null,
        title: row.Title,
        iconClass: row.IconClass || 'fa-solid fa-compass',
        pageType: active.pageType,
        band: row.Band,
        status: row.Status || 'Published',
        sequence: typeof row.Sequence === 'number' ? row.Sequence : 0,
        collaborative: active.collaborative,
        widgetsInitialized: active.widgetsInitialized,
        summary: active.summary,
        body: published.body,
        draftTitle: row.DraftTitle ?? null,
        draftBody: draft ? draft.body : null,
        blocks: active.blocks,
        comments: active.comments,
        updatedLabel: opts.updatedLabel,
        authorName: opts.authorName,
        canPromote: opts.canPromote,
        isSeed: false,
    };
}

export function applyCollabPageToEntity(
    entity: SpacePageEntityTarget,
    page: CollabPageModel,
    currentUserId: string | null | undefined,
): void {
    const builtInTab = page.builtInTabId?.trim() || null;
    entity.BuiltInTab = builtInTab;
    entity.Title = page.title.trim() || 'Untitled Page';
    entity.IconClass = page.iconClass || 'fa-solid fa-compass';
    entity.Band = page.band;
    entity.Status = page.status || 'Published';
    entity.Sequence = page.sequence ?? 0;

    if (entity.Status === 'Draft') {
        if (!entity.PublishedBlocks) {
            entity.PublishedBlocks = serializePagePayload({
                blocks: page.blocks,
                pageType: page.pageType,
                collaborative: page.collaborative,
                widgetsInitialized: page.widgetsInitialized ?? true,
                summary: page.summary,
                body: page.body,
                comments: page.comments,
            });
        }
        entity.DraftTitle = page.draftTitle ?? page.title;
        entity.DraftBlocks = serializePagePayload({
            blocks: page.blocks,
            pageType: page.pageType,
            collaborative: page.collaborative,
            widgetsInitialized: page.widgetsInitialized ?? true,
            summary: page.summary,
            body: page.draftBody ?? page.body,
            comments: page.comments,
        });
    } else {
        entity.PublishedBlocks = serializePagePayload({
            blocks: page.blocks,
            pageType: page.pageType,
            collaborative: page.collaborative,
            widgetsInitialized: page.widgetsInitialized ?? true,
            summary: page.summary,
            body: page.body,
            comments: page.comments,
        });
        entity.DraftTitle = null;
        entity.DraftBlocks = null;
        if (currentUserId) {
            entity.PublishedByUserID = currentUserId;
        }
        entity.PublishedAt = new Date();
    }
}

export function buildStarterPagesForSpace(opts: {
    spaceId: string;
    spaceTitle: string;
    spaceSubtitle: string;
    spaceTypeName: string;
    spaceTypeCode?: string;
    contributedCards?: readonly SpaceOverviewCardDescriptor[];
    descriptors?: readonly StarterBlockDescriptor[];
    libraryRows: LibraryRowModel[];
    spaceMembers: SpaceMemberModel[];
    defaultBand: SpaceBand;
}): CollabPageModel[] {
    const descriptors: readonly StarterBlockDescriptor[] =
        opts.descriptors ?? [
            ...DEFAULT_BUILT_IN_BLOCK_DESCRIPTORS,
            ...(opts.contributedCards ?? []).map((card) => ({
                key: card.key,
                defaultZone: 'side' as const,
                defaultTabs: ['Overview'] as const,
                sortKey: card.sortKey ?? 55,
            })),
        ];

    const overviewPage: CollabPageModel = {
        id: `seed-overview-${opts.spaceId}`,
        builtInTabId: 'Overview',
        title: 'Overview',
        iconClass: 'fa-solid fa-house',
        pageType: 'Overview',
        band: 'Shared',
        status: 'Published',
        sequence: 0,
        collaborative: true,
        widgetsInitialized: true,
        summary: opts.spaceSubtitle || `Overview and live workspace activity for ${opts.spaceTitle}.`,
        body: '',
        blocks: starterBlocksForTab('Overview', descriptors),
        comments: [],
        updatedLabel: 'Today',
        authorName: 'Space Team',
        isSeed: true,
    };

    const libraryPage: CollabPageModel = {
        id: `seed-library-${opts.spaceId}`,
        builtInTabId: 'Library',
        title: 'Library & Documents',
        iconClass: 'fa-regular fa-folder-open',
        pageType: 'Guide',
        band: 'Shared',
        status: 'Published',
        sequence: 1,
        collaborative: true,
        widgetsInitialized: true,
        summary: 'Shared and internal files, folders, version history, and customizable document guidance.',
        body: '',
        blocks: starterBlocksForTab('Library', descriptors),
        comments: [],
        updatedLabel: 'Today',
        authorName: 'Space Team',
        isSeed: true,
    };

    const dataPage: CollabPageModel = {
        id: `seed-data-${opts.spaceId}`,
        builtInTabId: 'Data',
        title: 'Bound Data',
        iconClass: 'fa-solid fa-database',
        pageType: 'Custom',
        band: 'Shared',
        status: 'Published',
        sequence: 2,
        collaborative: true,
        widgetsInitialized: true,
        summary: 'MemberJunction records, views, and queries bound to this space.',
        body: '',
        blocks: starterBlocksForTab('Data', descriptors),
        comments: [],
        updatedLabel: 'Today',
        authorName: 'Space Team',
        isSeed: true,
    };

    const workPage: CollabPageModel = {
        id: `seed-work-${opts.spaceId}`,
        builtInTabId: 'Work',
        title: 'Work & Decisions',
        iconClass: 'fa-solid fa-list-check',
        pageType: 'Roadmap',
        band: 'Shared',
        status: 'Published',
        sequence: 3,
        collaborative: true,
        widgetsInitialized: true,
        summary: 'Action items, formal motions, votes, and customizable roadmap blocks.',
        body: '',
        blocks: starterBlocksForTab('Work', descriptors),
        comments: [],
        updatedLabel: 'Today',
        authorName: 'Space Team',
        isSeed: true,
    };

    const notesPage: CollabPageModel = {
        id: `seed-notes-${opts.spaceId}`,
        builtInTabId: 'Notes',
        title: 'Shared Notes',
        iconClass: 'fa-regular fa-note-sticky',
        pageType: 'Guide',
        band: 'Shared',
        status: 'Published',
        sequence: 4,
        collaborative: true,
        widgetsInitialized: true,
        summary: 'Collaborative working notes, meeting agendas, and pinned takeaways.',
        body: '',
        blocks: starterBlocksForTab('Notes', descriptors),
        comments: [],
        updatedLabel: 'Today',
        authorName: 'Space Team',
        isSeed: true,
    };

    const peoplePage: CollabPageModel = {
        id: `seed-people-${opts.spaceId}`,
        builtInTabId: 'People',
        title: 'People & Access',
        iconClass: 'fa-solid fa-users',
        pageType: 'Overview',
        band: 'Shared',
        status: 'Published',
        sequence: 5,
        collaborative: true,
        widgetsInitialized: true,
        summary: 'Space members, roles, external guest magic links, and team directory.',
        body: '',
        blocks: starterBlocksForTab('People', descriptors),
        comments: [],
        updatedLabel: 'Today',
        authorName: 'Space Team',
        isSeed: true,
    };

    return [overviewPage, libraryPage, dataPage, workPage, notesPage, peoplePage];
}

export function mergeSpacePagesWithDefaults(
    savedPages: CollabPageModel[],
    starterPages: CollabPageModel[],
): CollabPageModel[] {
    const savedByBuiltIn = new Map<string, CollabPageModel>();
    const customPages: CollabPageModel[] = [];

    for (const p of savedPages) {
        if (p.builtInTabId) {
            savedByBuiltIn.set(p.builtInTabId, p);
        } else {
            customPages.push(p);
        }
    }

    const builtInMerged = starterPages.map((starter) => {
        if (starter.builtInTabId && savedByBuiltIn.has(starter.builtInTabId)) {
            const saved = savedByBuiltIn.get(starter.builtInTabId)!;
            if (!saved.widgetsInitialized) {
                const existingTypes = new Set(saved.blocks.map((b) => b.type));
                const missingBlocks = starter.blocks.filter((b) => !existingTypes.has(b.type));
                return {
                    ...saved,
                    widgetsInitialized: true,
                    blocks: [...saved.blocks, ...missingBlocks],
                };
            }
            return saved;
        }
        return starter;
    });

    customPages.sort((a, b) => a.sequence - b.sequence);
    return [...builtInMerged, ...customPages];
}
