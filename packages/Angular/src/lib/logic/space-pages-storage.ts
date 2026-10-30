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

export interface StoredPageEnvelope {
    __collabPage: 1;
    builtInTabId?: string | null;
    iconClass: string;
    pageType: CollabPageType;
    status: 'Published' | 'Draft';
    sequence: number;
    collaborative: boolean;
    widgetsInitialized?: boolean;
    summary: string;
    body: string;
    draftTitle?: string | null;
    draftBody?: string | null;
    blocks: CollabPageBlock[];
    comments: CollabPageComment[];
}

export function isCollabPageNoteBody(body: string | null | undefined): boolean {
    if (!body || !body.trim().startsWith('{')) return false;
    try {
        const parsed = JSON.parse(body) as Partial<StoredPageEnvelope>;
        return parsed.__collabPage === 1;
    } catch {
        return false;
    }
}

export function serializeCollabPageBody(page: CollabPageModel): string {
    const envelope: StoredPageEnvelope = {
        __collabPage: 1,
        builtInTabId: page.builtInTabId ?? null,
        iconClass: page.iconClass || 'fa-solid fa-compass',
        pageType: page.pageType || 'Overview',
        status: page.status || 'Published',
        sequence: page.sequence ?? 0,
        collaborative: page.collaborative ?? true,
        widgetsInitialized: page.widgetsInitialized ?? true,
        summary: page.summary || '',
        body: page.body || '',
        draftTitle: page.draftTitle ?? null,
        draftBody: page.draftBody ?? null,
        blocks: page.blocks || [],
        comments: page.comments || [],
    };
    return JSON.stringify(envelope);
}

export function parseCollabPageFromNote(input: {
    id: string;
    title: string;
    body: string | null;
    band: SpaceBand;
    authorName: string;
    updatedLabel: string;
    canPromote: boolean;
}): CollabPageModel | null {
    if (!isCollabPageNoteBody(input.body)) return null;
    try {
        const env = JSON.parse(input.body!) as StoredPageEnvelope;
        return {
            id: input.id,
            builtInTabId: env.builtInTabId ?? null,
            title: input.title,
            iconClass: env.iconClass || 'fa-solid fa-compass',
            pageType: env.pageType || 'Overview',
            band: input.band,
            status: env.status || 'Published',
            sequence: typeof env.sequence === 'number' ? env.sequence : 0,
            collaborative: env.collaborative ?? true,
            widgetsInitialized: Boolean(env.widgetsInitialized),
            summary: env.summary || '',
            body: env.body || '',
            draftTitle: env.draftTitle ?? null,
            draftBody: env.draftBody ?? null,
            blocks: Array.isArray(env.blocks) ? env.blocks : [],
            comments: Array.isArray(env.comments) ? env.comments : [],
            updatedLabel: input.updatedLabel,
            authorName: input.authorName,
            canPromote: input.canPromote,
            isSeed: false,
        };
    } catch {
        return null;
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
