import type {
    CollabPageBlock,
    CollabPageComment,
    CollabPageModel,
    CollabPageType,
    LibraryRowModel,
    SpaceBand,
    SpaceMemberModel,
} from '@mj-biz-apps/collaboration-ng-widgets';

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

const LEGACY_SYNTHETIC_SEED_BLOCK_IDS = new Set([
    'seed-blk-callout',
    'seed-blk-facts',
    'seed-blk-checklist',
    'seed-blk-resources',
    'seed-blk-contacts',
]);

function normalizeOverviewWidgetBlock(block: CollabPageBlock): CollabPageBlock {
    if (!block.id.startsWith('seed-blk-widget-') || block.width !== 'half') {
        return block;
    }
    switch (block.type) {
        case 'Widget:NeedsYou':
        case 'Widget:SharedFiles':
        case 'Widget:TeamFiles':
            return { ...block, width: 'main' };
        case 'Widget:AskBox':
        case 'Widget:Discussion':
        case 'Widget:ContributedCards':
        case 'Widget:About':
        case 'Widget:SubSpaces':
            return { ...block, width: 'side' };
        default:
            return block;
    }
}

export function buildStarterPagesForSpace(opts: {
    spaceId: string;
    spaceTitle: string;
    spaceSubtitle: string;
    spaceTypeName: string;
    libraryRows: LibraryRowModel[];
    spaceMembers: SpaceMemberModel[];
    defaultBand: SpaceBand;
}): CollabPageModel[] {
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
        blocks: [
            {
                id: 'seed-blk-widget-pinned',
                type: 'Widget:Pinned',
                title: '',
                width: 'full',
            },
            {
                id: 'seed-blk-widget-needs-you',
                type: 'Widget:NeedsYou',
                title: '',
                width: 'main',
            },
            {
                id: 'seed-blk-widget-shared-files',
                type: 'Widget:SharedFiles',
                title: '',
                width: 'main',
            },
            {
                id: 'seed-blk-widget-team-files',
                type: 'Widget:TeamFiles',
                title: '',
                width: 'main',
            },
            {
                id: 'seed-blk-widget-ask-box',
                type: 'Widget:AskBox',
                title: '',
                width: 'side',
            },
            {
                id: 'seed-blk-widget-discussion',
                type: 'Widget:Discussion',
                title: '',
                width: 'side',
            },
            {
                id: 'seed-blk-widget-contributed',
                type: 'Widget:ContributedCards',
                title: '',
                width: 'side',
            },
            {
                id: 'seed-blk-widget-about',
                type: 'Widget:About',
                title: '',
                width: 'side',
            },
            {
                id: 'seed-blk-widget-subspaces',
                type: 'Widget:SubSpaces',
                title: '',
                width: 'side',
            },
        ],
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
        blocks: [
            {
                id: 'seed-blk-main-library',
                type: 'Widget:MainView',
                title: '',
                width: 'full',
            },
        ],
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
        blocks: [
            {
                id: 'seed-blk-main-data',
                type: 'Widget:MainView',
                title: '',
                width: 'full',
            },
        ],
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
        blocks: [
            {
                id: 'seed-blk-main-work',
                type: 'Widget:MainView',
                title: '',
                width: 'full',
            },
        ],
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
        blocks: [
            {
                id: 'seed-blk-main-notes',
                type: 'Widget:MainView',
                title: '',
                width: 'full',
            },
        ],
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
        blocks: [
            {
                id: 'seed-blk-main-people',
                type: 'Widget:MainView',
                title: '',
                width: 'full',
            },
        ],
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
            const rawSaved = savedByBuiltIn.get(starter.builtInTabId)!;
            const cleanedBlocks = rawSaved.blocks
                .filter((b) => !LEGACY_SYNTHETIC_SEED_BLOCK_IDS.has(b.id))
                .map(normalizeOverviewWidgetBlock);
            const saved: CollabPageModel = {
                ...rawSaved,
                blocks: cleanedBlocks,
            };
            if (!saved.widgetsInitialized) {
                const existingTypes = new Set(saved.blocks.map((b) => b.type));
                const missingWidgets = starter.blocks.filter(
                    (b) => b.type.startsWith('Widget:') && !existingTypes.has(b.type),
                );
                return {
                    ...saved,
                    widgetsInitialized: true,
                    blocks: [...saved.blocks, ...missingWidgets],
                };
            }
            return saved;
        }
        return starter;
    });

    customPages.sort((a, b) => a.sequence - b.sequence);
    return [...builtInMerged, ...customPages];
}
