/**
 * SPDX-License-Identifier: BUSL-1.1
 *
 * Unit & jsdom component tests verifying Angular SpaceNotes "Turn into document" wiring:
 * - Promotes SpaceNotes via the native `MJ: Artifacts` (`Markdown Document`) mutation (`PromoteSpaceNoteToDoc`)
 *   rather than uploading a raw `.md` file via `UploadSpaceFile` / `upload-space-file.ts`.
 * - Refreshes local `libraryRows` and SpaceItems cleanly without full-page reload.
 * - Routes cleanly to the newly created editable Markdown Document via `NavigationService`.
 * - Handles empty/untitled notes, Private-band locking, double-click concurrency, and server errors gracefully.
 * - Strips raw Markdown formatting in rendered `<mjc-space-notes>` card previews.
 */
// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { CompositeKey, type IMetadataProvider, type IRunViewProvider, type RunViewParams, type RunViewResult, UserInfo } from '@memberjunction/core';
import { SharedService } from '@memberjunction/ng-shared';
import {
    CollabSpaceNotesComponent,
    type LibraryRowModel,
    type NoteModel,
    type PromotedNoteDocLink,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { CollaborationSectionResource } from '../lib/collaboration-section.component.ts';
import type { PromotedNoteDocumentResult } from '../lib/logic/note-to-document.ts';

beforeAll(() => {
    const testBed = getTestBed();
    if (!testBed.platform) {
        testBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    }
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

const SPACE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';
const NOTE_ID = '44444444-4444-4444-8444-444444444444';
const ARTIFACT_ID = '55555555-5555-4555-8555-555555555555';
const SPACE_ITEM_ID = '66666666-6666-4666-8666-666666666666';
const VERSION_ID = '77777777-7777-4777-8777-777777777777';
const ITEMS_ENTITY_ID = '88888888-8888-4888-8888-888888888888';

interface SectionTurnIntoDocInternals {
    ProviderToUse: IMetadataProvider & {
        ExecuteGQL: (query: string, variables?: Record<string, string | number | boolean | null | undefined | object>) => Promise<Record<string, object | null | undefined>>;
    };
    navigationService?: {
        OpenArtifact?: (artifactId: string, artifactName?: string) => string;
        OpenEntityRecord?: (entityName: string, recordPkey: CompositeKey) => string;
    } | null;
    currentUser: UserInfo | null;
    activeSpaceId: string;
    activeSpaceRecord?: { ID: string; OwnerID?: string | null };
    callerSeat: { role: { canSeeTeamBand: boolean; canContribute: boolean; canPromoteBand: boolean } } | null;
    mayAdministerSpaces: boolean;
    canSeeTeamSide: boolean;
    canShareItems: boolean;
    canContribute: boolean;
    isSpaceClosed: boolean;
    libraryRows: LibraryRowModel[];
    libraryTotalCount: number;
    librarySharedCount: number;
    libraryTeamCount: number;
    isSavingNote: boolean;
    noteSaveError: string;
    turningIntoDocumentNoteId: string | null;
    promotedDocsByNoteId: Readonly<Record<string, PromotedNoteDocLink>>;
    isArtifactSlideoverOpen: boolean;
    activeArtifactSlideoverId: string | null;
    activeArtifactSlideoverCanEdit: boolean;
    RefreshView: () => void;
    loadSpaceItems: (spaceId: string, isCurrent: () => boolean) => Promise<void>;
    onNoteTurnIntoDocument: (note: NoteModel) => Promise<PromotedNoteDocumentResult | null>;
    onOpenPromotedNoteDocument: (doc: PromotedNoteDocLink) => void;
    openArtifactSlideover: (request: { artifactId: string; title?: string; versionNumber?: number; canEdit?: boolean; canShare?: boolean }) => void;
}

function makeNote(overrides: Partial<NoteModel> = {}): NoteModel {
    return {
        id: NOTE_ID,
        title: 'Discovery Readout Draft',
        body: '### Summary\n**Key decision**: adopt native MJ: Artifacts.',
        band: 'Team',
        visibility: 'Space',
        authorUserId: USER_ID,
        authorName: 'Ada Lovell',
        updatedLabel: 'Today',
        isMine: true,
        canPromote: true,
        isPinned: false,
        ...overrides,
    };
}

function createHarness(options?: {
    executeGql?: (query: string, variables?: Record<string, string | number | boolean | null | undefined | object>) => Promise<Record<string, object | null | undefined>>;
    navigationService?: SectionTurnIntoDocInternals['navigationService'];
    canSeeTeamBand?: boolean;
    canContribute?: boolean;
    isSpaceClosed?: boolean;
}) {
    const executedQueries: Array<{ query: string; variables?: Record<string, string | number | boolean | null | undefined | object> }> = [];
    const executeGql = options?.executeGql ?? (async (query, variables) => {
        executedQueries.push({ query, variables });
        const input = (variables?.['input'] ?? {}) as { Title?: string; Band?: 'Team' | 'Shared'; Visibility?: 'Space' | 'Private'; Folder?: string | null; NoteID?: string | null };
        return {
            PromoteSpaceNoteToDoc: {
                Success: true,
                SpaceItemID: SPACE_ITEM_ID,
                ArtifactID: ARTIFACT_ID,
                VersionID: VERSION_ID,
                VersionNumber: 1,
                Title: input.Title || 'Untitled Note',
                Band: input.Band || 'Team',
                Visibility: input.Visibility || 'Space',
                Folder: input.Folder ?? 'Notes',
                DelegateEntityID: ITEMS_ENTITY_ID,
                DelegateRecordID: SPACE_ITEM_ID,
                ArtifactTypeName: 'Markdown Document',
                ContentMode: 'Text',
                SourceNoteID: input.NoteID ?? NOTE_ID,
            },
        };
    });

    const provider = {
        ExecuteGQL: async (query: string, variables?: Record<string, string | number | boolean | null | undefined | object>) => {
            if (options?.executeGql) {
                executedQueries.push({ query, variables });
            }
            return executeGql(query, variables);
        },
    } as Partial<SectionTurnIntoDocInternals['ProviderToUse']> as SectionTurnIntoDocInternals['ProviderToUse'];

    const openArtifact = vi.fn().mockReturnValue('tab-artifact-1');
    const openEntityRecord = vi.fn().mockReturnValue('tab-entity-1');
    const defaultNav = { OpenArtifact: openArtifact, OpenEntityRecord: openEntityRecord };
    const loadSpaceItems = vi.fn().mockResolvedValue(undefined);
    const refreshView = vi.fn();
    const notify = vi.fn();

    vi.spyOn(SharedService, 'Instance', 'get').mockReturnValue({
        CreateSimpleNotification: notify,
        OpenEntityRecord: vi.fn(),
    } as Partial<SharedService> as SharedService);

    const instance = Object.create(CollaborationSectionResource.prototype) as SectionTurnIntoDocInternals;
    Object.defineProperty(instance, 'ProviderToUse', { value: provider, configurable: true });
    Object.defineProperty(instance, 'navigationService', {
        value: options && 'navigationService' in options ? options.navigationService : defaultNav,
        configurable: true,
    });
    Object.defineProperty(instance, 'isSpaceClosed', {
        value: options?.isSpaceClosed ?? false,
        configurable: true,
    });
    Object.defineProperty(instance, 'canContribute', {
        value: options?.canContribute ?? true,
        configurable: true,
    });
    Object.defineProperty(instance, 'canSeeTeamSide', {
        value: options?.canSeeTeamBand ?? true,
        configurable: true,
    });
    Object.defineProperty(instance, 'canShareItems', {
        value: options?.canSeeTeamBand ?? true,
        configurable: true,
    });

    instance.currentUser = Object.assign(new UserInfo(), { ID: USER_ID, Name: 'Ada Lovell' });
    instance.activeSpaceId = SPACE_ID;
    Object.defineProperty(instance, 'activeSpaceRecord', {
        value: { ID: SPACE_ID, OwnerID: USER_ID },
        configurable: true,
    });
    instance.callerSeat = {
        role: {
            canSeeTeamBand: options?.canSeeTeamBand ?? true,
            canContribute: options?.canContribute ?? true,
            canPromoteBand: options?.canSeeTeamBand ?? true,
        },
    };
    instance.mayAdministerSpaces = false;
    instance.libraryRows = [];
    instance.libraryTotalCount = 0;
    instance.librarySharedCount = 0;
    instance.libraryTeamCount = 0;
    instance.isSavingNote = false;
    instance.noteSaveError = '';
    instance.turningIntoDocumentNoteId = null;
    instance.promotedDocsByNoteId = {};
    instance.isArtifactSlideoverOpen = false;
    instance.activeArtifactSlideoverId = null;
    instance.activeArtifactSlideoverCanEdit = false;
    instance.RefreshView = refreshView;
    instance.loadSpaceItems = loadSpaceItems;

    return {
        instance,
        executedQueries,
        openArtifact,
        openEntityRecord,
        loadSpaceItems,
        refreshView,
        notify,
    };
}

describe('Angular SpaceNotes "Turn into document" native MJ: Artifacts wiring', () => {
    it('promotes a Team SpaceNote via PromoteSpaceNoteToDoc (never UploadSpaceFile), refreshes local SpaceItems without page reload, and routes via NavigationService.OpenArtifact', async () => {
        const { instance, executedQueries, openArtifact, loadSpaceItems, notify } = createHarness();
        const note = makeNote({ band: 'Team', visibility: 'Space' });

        const result = await instance.onNoteTurnIntoDocument(note);

        expect(result).not.toBeNull();
        expect(result?.artifactId).toBe(ARTIFACT_ID);
        expect(result?.spaceItemId).toBe(SPACE_ITEM_ID);
        expect(result?.artifactTypeName).toBe('Markdown Document');
        expect(result?.contentMode).toBe('Text');
        expect(result?.delegateEntityId).toBe(ITEMS_ENTITY_ID);
        expect(result?.delegateRecordId).toBe(SPACE_ITEM_ID);

        // Must invoke PromoteSpaceNoteToDoc and NEVER UploadSpaceFile
        expect(executedQueries).toHaveLength(1);
        expect(executedQueries[0].query).toContain('PromoteSpaceNoteToDoc');
        expect(executedQueries[0].query).not.toContain('UploadSpaceFile');

        // Local workspace libraryRows updated optimistically + loadSpaceItems called cleanly
        expect(instance.libraryRows).toHaveLength(1);
        expect(instance.libraryRows[0]).toMatchObject({
            id: SPACE_ITEM_ID,
            artifactId: ARTIFACT_ID,
            entityName: 'MJ: Artifacts',
            artifactType: 'Markdown Document',
            name: 'Discovery Readout Draft',
            band: 'Team',
            folder: 'Notes',
        });
        expect(loadSpaceItems).toHaveBeenCalledTimes(1);
        expect(instance.promotedDocsByNoteId[NOTE_ID]).toMatchObject({
            artifactId: ARTIFACT_ID,
            title: 'Discovery Readout Draft',
        });

        // Routes cleanly via NavigationService.OpenArtifact
        expect(openArtifact).toHaveBeenCalledTimes(1);
        expect(openArtifact).toHaveBeenCalledWith(ARTIFACT_ID, 'Discovery Readout Draft');
        expect(notify).toHaveBeenCalledWith('"Discovery Readout Draft" is now an editable document.', 'success', 4000);
        expect(instance.turningIntoDocumentNoteId).toBeNull();
        expect(instance.isSavingNote).toBe(false);
    });

    it('handles empty/untitled notes deterministically and locks Private notes to Team band', async () => {
        const { instance, executedQueries, openArtifact } = createHarness();
        const untitledPrivateNote = makeNote({
            title: '   ',
            body: '',
            band: 'Shared',
            visibility: 'Private',
            authorUserId: USER_ID,
        });

        const result = await instance.onNoteTurnIntoDocument(untitledPrivateNote);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Untitled Note');
        expect(result?.band).toBe('Team');
        expect(result?.visibility).toBe('Private');
        const sentInput = executedQueries[0].variables?.['input'] as { Title?: string; Band?: string; Visibility?: string };
        expect(sentInput.Title).toBe('Untitled Note');
        expect(sentInput.Band).toBe('Team');
        expect(sentInput.Visibility).toBe('Private');
        expect(openArtifact).toHaveBeenCalledWith(ARTIFACT_ID, 'Untitled Note');
    });

    it('refuses Private notes authored by another user and Shared-band participants attempting Team notes fail-closed', async () => {
        const { instance, executedQueries } = createHarness();
        const otherPrivateNote = makeNote({
            band: 'Team',
            visibility: 'Private',
            authorUserId: OTHER_USER_ID,
        });

        const denied = await instance.onNoteTurnIntoDocument(otherPrivateNote);
        expect(denied).toBeNull();
        expect(executedQueries).toHaveLength(0);
        expect(instance.noteSaveError).toMatch(/author/i);

        const sharedParticipant = createHarness({ canSeeTeamBand: false, canContribute: true });
        const teamNoteAttempt = await sharedParticipant.instance.onNoteTurnIntoDocument(makeNote({ band: 'Team', visibility: 'Space' }));
        expect(teamNoteAttempt).toBeNull();
        expect(sharedParticipant.executedQueries).toHaveLength(0);
        expect(sharedParticipant.instance.noteSaveError).toMatch(/Team-band/i);
    });

    it('guards against concurrent double-click submissions while promotion is in flight', async () => {
        let resolveGql!: (value: Record<string, object | null | undefined>) => void;
        const pendingGql = new Promise<Record<string, object | null | undefined>>((resolve) => {
            resolveGql = resolve;
        });
        const { instance, executedQueries } = createHarness({
            executeGql: () => pendingGql,
        });

        const note = makeNote();
        const firstCall = instance.onNoteTurnIntoDocument(note);
        expect(instance.turningIntoDocumentNoteId).toBe(NOTE_ID);

        // Concurrent second click while in-flight must be ignored
        const secondCall = await instance.onNoteTurnIntoDocument(note);
        expect(secondCall).toBeNull();
        expect(executedQueries).toHaveLength(1);

        resolveGql({
            PromoteSpaceNoteToDoc: {
                Success: true,
                SpaceItemID: SPACE_ITEM_ID,
                ArtifactID: ARTIFACT_ID,
                VersionID: VERSION_ID,
                VersionNumber: 1,
                Title: note.title,
                Band: 'Team',
                Visibility: 'Space',
                Folder: 'Notes',
                DelegateEntityID: ITEMS_ENTITY_ID,
                DelegateRecordID: SPACE_ITEM_ID,
                ArtifactTypeName: 'Markdown Document',
                ContentMode: 'Text',
            },
        });
        const firstResult = await firstCall;
        expect(firstResult?.artifactId).toBe(ARTIFACT_ID);
        expect(instance.turningIntoDocumentNoteId).toBeNull();
    });

    it('surfaces server errors cleanly and resets in-flight state so retry succeeds', async () => {
        const { instance, notify } = createHarness({
            executeGql: async () => ({
                PromoteSpaceNoteToDoc: {
                    Success: false,
                    ErrorCode: 'READ_ONLY',
                    ErrorMessage: 'Document creation refused: the space is read-only or closed.',
                },
            }),
        });

        const failed = await instance.onNoteTurnIntoDocument(makeNote());
        expect(failed).toBeNull();
        expect(instance.noteSaveError).toContain('read-only or closed');
        expect(instance.turningIntoDocumentNoteId).toBeNull();
        expect(instance.isSavingNote).toBe(false);
        expect(notify).toHaveBeenCalledWith(expect.stringContaining('read-only'), 'error', 5000);
    });

    it('falls back to NavigationService.OpenEntityRecord or in-place artifact slideover when OpenArtifact is unavailable', async () => {
        const entityOnlyNav = { OpenEntityRecord: vi.fn().mockReturnValue('tab-entity') };
        const h1 = createHarness({ navigationService: entityOnlyNav });
        await h1.instance.onNoteTurnIntoDocument(makeNote());
        expect(entityOnlyNav.OpenEntityRecord).toHaveBeenCalledWith('MJ: Artifacts', expect.any(CompositeKey));

        const h2 = createHarness({ navigationService: null });
        await h2.instance.onNoteTurnIntoDocument(makeNote());
        expect(h2.instance.isArtifactSlideoverOpen).toBe(true);
        expect(h2.instance.activeArtifactSlideoverId).toBe(ARTIFACT_ID);
        expect(h2.instance.activeArtifactSlideoverCanEdit).toBe(true);
    });

    it('renders <mjc-space-notes> with Turn into document CTA, double-click disablement, promoted badge, and zero raw Markdown leaks', () => {
        TestBed.configureTestingModule({
            imports: [CollabSpaceNotesComponent],
        });
        const fixture = TestBed.createComponent(CollabSpaceNotesComponent);
        const comp = fixture.componentInstance;
        comp.CanWrite = true;
        comp.CanSeeTeam = true;
        comp.IsReadOnly = false;
        comp.Notes = [
            makeNote({
                id: NOTE_ID,
                title: 'Architecture Notes',
                body: '### Decisions\n**Native MJ: Artifacts** with `DelegateRecordID` support.',
            }),
        ];
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        const bodyText = root.querySelector('.note-body')?.textContent ?? '';
        expect(bodyText).not.toContain('###');
        expect(bodyText).not.toContain('**');
        expect(bodyText).not.toContain('`');
        expect(bodyText).toContain('Decisions');
        expect(bodyText).toContain('Native MJ: Artifacts');

        const emitted: NoteModel[] = [];
        comp.TurnIntoDocumentRequested.subscribe((n) => emitted.push(n));

        const btn = root.querySelector<HTMLButtonElement>('[data-testid="turn-into-document-btn"]')!;
        expect(btn).not.toBeNull();
        expect(btn.disabled).toBe(false);
        btn.click();
        expect(emitted).toHaveLength(1);
        expect(emitted[0].body).toContain('### Decisions');

        // While in-flight, button disables and shows progress label
        fixture.componentRef.setInput('TurningIntoDocumentNoteId', NOTE_ID);
        fixture.detectChanges();
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toContain('Creating document');

        // After promotion, promoted banner appears and emits OpenDocumentRequested
        fixture.componentRef.setInput('TurningIntoDocumentNoteId', null);
        fixture.componentRef.setInput('PromotedDocsByNoteId', {
            [NOTE_ID]: { artifactId: ARTIFACT_ID, title: 'Architecture Notes', versionNumber: 1 },
        });
        fixture.detectChanges();

        const opened: PromotedNoteDocLink[] = [];
        comp.OpenDocumentRequested.subscribe((doc) => opened.push(doc));
        const openBtn = root.querySelector<HTMLButtonElement>('[data-testid="open-promoted-document-btn"]')!;
        expect(openBtn).not.toBeNull();
        openBtn.click();
        expect(opened).toEqual([{ artifactId: ARTIFACT_ID, title: 'Architecture Notes', versionNumber: 1 }]);
    });

    it('rejects invalid spaceId values in loadSpaceNotes without executing an unsafe ExtraFilter and matches pins with NormalizeUUID', async () => {
        const SECOND_NOTE_ID = '99999999-9999-4999-8999-999999999999';
        const NOTES_ENTITY_ID = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
        const runViewCalls: RunViewParams[] = [];

        const runViewProvider: IRunViewProvider = {
            RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
                runViewCalls.push(params);
                return {
                    Success: true,
                    Results: [
                        {
                            ID: NOTE_ID.toUpperCase(),
                            SpaceID: SPACE_ID,
                            Title: 'Pinned Case-Variant Note',
                            Body: 'Body text',
                            Band: 'Team',
                            Visibility: 'Space',
                            AuthorUserID: USER_ID,
                            AuthorUser: 'Ada Lovell',
                            __mj_UpdatedAt: '2026-11-26T12:00:00.000Z',
                        },
                        {
                            ID: SECOND_NOTE_ID,
                            SpaceID: SPACE_ID,
                            Title: 'Unpinned Note',
                            Body: 'More text',
                            Band: 'Shared',
                            Visibility: 'Space',
                            AuthorUserID: USER_ID,
                            AuthorUser: 'Ada Lovell',
                            __mj_UpdatedAt: '2026-11-26T11:00:00.000Z',
                        },
                    ] as object as T[],
                    RowCount: 2,
                    TotalRowCount: 2,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            },
            RunViews: async <T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> =>
                Promise.all(paramsList.map((p) => runViewProvider.RunView<T>(p))),
        };

        interface NotesLoadInternals extends SectionTurnIntoDocInternals {
            RunViewToUse: IRunViewProvider;
            spaceNotes: NoteModel[];
            isLoadingNotes: boolean;
            notesError: string;
            rawPins: Array<{ ID: string; Kind: string; TargetEntityID: string | null; TargetRecordID: string | null; GrantID: string | null }>;
            loadSpaceNotes: (spaceId: string, isCurrent: () => boolean) => Promise<void>;
            onNotePinToggle: (note: NoteModel) => Promise<void>;
            removePin: (pinId: string) => Promise<void>;
            addPin: (payload: { Kind: string; TargetEntityID: string; TargetRecordID: string; GrantID: null }) => Promise<void>;
        }

        const { instance } = createHarness();
        const notesHost = instance as NotesLoadInternals;
        Object.defineProperty(notesHost, 'RunViewToUse', { value: runViewProvider, configurable: true });
        Object.defineProperty(notesHost, 'ProviderToUse', {
            value: {
                ...instance.ProviderToUse,
                EntityByName: (name: string) => (name === 'MJ_BizApps_Collaboration: Space Notes' ? { ID: NOTES_ENTITY_ID } : undefined),
            },
            configurable: true,
        });
        notesHost.spaceNotes = [];
        notesHost.isLoadingNotes = false;
        notesHost.notesError = '';
        notesHost.rawPins = [
            {
                ID: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
                Kind: 'Record',
                TargetEntityID: NOTES_ENTITY_ID.toLowerCase(),
                TargetRecordID: `ID|${NOTE_ID.toLowerCase()}`,
                GrantID: null,
            },
        ];

        // Reject empty, malformed, and SQL-injection spaceId values cleanly without calling RunView
        await notesHost.loadSpaceNotes('', () => true);
        await notesHost.loadSpaceNotes('not-a-valid-uuid', () => true);
        await notesHost.loadSpaceNotes(`${SPACE_ID}' OR '1'='1`, () => true);
        expect(runViewCalls).toHaveLength(0);
        expect(notesHost.spaceNotes).toEqual([]);

        // Valid canonical UUID runs the query and resolves pinned state case-insensitively via NormalizeUUID/UUIDsEqual
        await notesHost.loadSpaceNotes(`  ${SPACE_ID}  `, () => true);
        expect(runViewCalls).toHaveLength(1);
        expect(runViewCalls[0].ExtraFilter).toBe(`SpaceID = '${SPACE_ID}'`);
        expect(notesHost.spaceNotes).toHaveLength(2);
        expect(notesHost.spaceNotes[0].isPinned).toBe(true);
        expect(notesHost.spaceNotes[1].isPinned).toBe(false);

        // Pin toggle removes matching case-variant pin via UUIDsEqual
        const removePin = vi.fn().mockResolvedValue(undefined);
        const addPin = vi.fn().mockResolvedValue(undefined);
        notesHost.removePin = removePin;
        notesHost.addPin = addPin;
        await notesHost.onNotePinToggle(notesHost.spaceNotes[0]);
        expect(removePin).toHaveBeenCalledWith('BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB');
        expect(addPin).not.toHaveBeenCalled();
    });

    it('invokes loadSpaceNotes on ?tab=notes initial load and when switching spaces while on the Notes tab', async () => {
        const SPACE_A = '11111111-1111-4111-8111-111111111111';
        const SPACE_B = '22222222-2222-4222-8222-222222222222';
        const TYPE_ID = '33333333-3333-4333-8333-333333333333';

        interface SpaceSelectInternals {
            activeSpaceId: string;
            _loadedSpaceId: string;
            activeTab: string;
            activeView: string;
            activeConversationId: string;
            selectSpaceRequestId: number;
            isSpaceClosed: boolean;
            currentUser: UserInfo | null;
            rawSpaces: Array<{
                ID: string;
                Name: string;
                SpaceTypeID: string;
                SpaceType?: string;
                OwnerID: string;
                ParentID?: string | null;
                InheritsMembership?: boolean;
                ClosedAt?: string | null;
                IconClass?: string | null;
                Color?: string | null;
                ImageURL?: string | null;
                Description?: string | null;
            }>;
            spaceTypeMap: Map<string, { name: string; icon: string | null; color: string | null }>;
            spaceTabModel: {
                tabs: Array<{ id: string; label: string; iconClass?: string }>;
                contributed: ReadonlyMap<string, object>;
            } | null;
            settingsSession: { Open: (model: object) => void; Shown: object };
            spaceSettings: object | null;
            spaceNotes: NoteModel[];
            overviewSubSpaces: object[];
            rawPins: object[];
            spacePinArtifacts: Map<string, { name: string; type: string | null }>;
            spaceConversations: object[];
            chatAudienceBand: 'Team' | 'Shared';
            _pendingConvId: string | null;
            cachedOverviewDetails: null;
            overviewRoomMessages: object[];
            ProviderToUse: { EntityByName: (name: string) => { ID: string } | undefined };
            RunViewToUse: IRunViewProvider;
            resetForSelection: (spaceId: string) => void;
            loadActiveSpaceEntity: (space: object, isCurrent: () => boolean, quiet: boolean) => Promise<void>;
            showHeaderFor: (space: object) => void;
            effectiveStatusOf: (space: object) => undefined;
            isSpaceTerminal: (space: object) => boolean;
            buildSpaceUi: (space: object, keepTab?: boolean) => void;
            updateCanConfigureCurrentSpace: () => Promise<void>;
            loadSpaceDetails: (space: object, isCurrent: () => boolean) => Promise<void>;
            updateBandChoice: (space: object, isCurrent: () => boolean) => Promise<void>;
            loadStar: (spaceId: string, isCurrent: () => boolean) => Promise<void>;
            artifactsEntityId: () => string;
            applySpaceMembersResult: () => void;
            applySpaceItemsResult: () => void;
            refreshPinModels: () => void;
            refreshDataEntries: (spaceId: string) => void;
            applyLightweightTasks: () => void;
            clearConversationSourceReceipts: () => void;
            ensureTabDataLoaded: (tabId: string) => void;
            loadSpaceNeedsYou: () => Promise<void>;
            loadSpaceHeaderChips: () => Promise<void>;
            loadSpaceNotes: (spaceId: string, isCurrent: () => boolean) => Promise<void>;
            syncStateWithAgent: () => void;
            RefreshView: () => void;
            UpdateQueryParams: (params: Record<string, string>) => void;
            selectSpaceInternal: (spaceId: string) => Promise<void>;
            selectSpaceBody: (spaceId: string, requestId: number, quiet: boolean) => Promise<void>;
            applyQueryParams: (params: Record<string, string>) => Promise<void>;
        }

        const emptyRunViewResult = <T>(): RunViewResult<T> => ({
            Success: true,
            Results: [],
            RowCount: 0,
            TotalRowCount: 0,
            ExecutionTime: 1,
            ErrorMessage: '',
        });
        const stubRunView: IRunViewProvider = {
            RunView: async <T>() => emptyRunViewResult<T>(),
            RunViews: async <T>(list: RunViewParams[]) => list.map(() => emptyRunViewResult<T>()),
        };

        const loadSpaceNotesSpy = vi.fn().mockResolvedValue(undefined);
        const host = Object.create(CollaborationSectionResource.prototype) as SpaceSelectInternals;
        Object.defineProperty(host, 'ProviderToUse', {
            value: { EntityByName: () => undefined },
            configurable: true,
        });
        Object.defineProperty(host, 'RunViewToUse', { value: stubRunView, configurable: true });
        Object.defineProperty(host, 'isSpaceClosed', { value: false, configurable: true });
        Object.defineProperty(host, 'showsSettings', { value: false, configurable: true });

        host.currentUser = Object.assign(new UserInfo(), { ID: USER_ID, Name: 'Ada Lovell' });
        host.activeSpaceId = '';
        host._loadedSpaceId = '';
        host.activeTab = 'Notes';
        host.activeView = 'space';
        host.activeConversationId = '';
        host.selectSpaceRequestId = 1;
        host.rawSpaces = [
            { ID: SPACE_A, Name: 'Space Alpha', SpaceTypeID: TYPE_ID, SpaceType: 'Workspace', OwnerID: USER_ID },
            { ID: SPACE_B, Name: 'Space Beta', SpaceTypeID: TYPE_ID, SpaceType: 'Workspace', OwnerID: USER_ID },
        ];
        host.spaceTypeMap = new Map([[TYPE_ID, { name: 'Workspace', icon: 'fa-solid fa-compass', color: null }]]);
        const tabsModel = {
            tabs: [
                { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high' },
                { id: 'Notes', label: 'Notes', iconClass: 'fa-solid fa-note-sticky' },
            ],
            contributed: new Map<string, object>(),
        };
        host.spaceTabModel = tabsModel;
        host.settingsSession = { Open: vi.fn(), Shown: {} };
        host.spaceSettings = null;
        host.spaceNotes = [makeNote()];
        host.overviewSubSpaces = [];
        host.rawPins = [];
        host.spacePinArtifacts = new Map();
        host.spaceConversations = [];
        host.chatAudienceBand = 'Team';
        host._pendingConvId = null;
        host.cachedOverviewDetails = null;
        host.overviewRoomMessages = [];
        host.resetForSelection = vi.fn(() => {
            host.spaceNotes = [];
            host.spaceTabModel = null;
        });
        host.loadActiveSpaceEntity = vi.fn().mockResolvedValue(undefined);
        host.showHeaderFor = vi.fn();
        host.effectiveStatusOf = vi.fn().mockReturnValue(undefined);
        host.isSpaceTerminal = vi.fn().mockReturnValue(false);
        host.buildSpaceUi = vi.fn(() => {
            host.spaceTabModel = tabsModel;
        });
        host.updateCanConfigureCurrentSpace = vi.fn().mockResolvedValue(undefined);
        host.loadSpaceDetails = vi.fn().mockResolvedValue(undefined);
        host.updateBandChoice = vi.fn().mockResolvedValue(undefined);
        host.loadStar = vi.fn().mockResolvedValue(undefined);
        host.artifactsEntityId = vi.fn().mockReturnValue('');
        host.applySpaceMembersResult = vi.fn();
        host.applySpaceItemsResult = vi.fn();
        host.refreshPinModels = vi.fn();
        host.refreshDataEntries = vi.fn();
        host.applyLightweightTasks = vi.fn();
        host.clearConversationSourceReceipts = vi.fn();
        host.ensureTabDataLoaded = vi.fn();
        host.loadSpaceNeedsYou = vi.fn().mockResolvedValue(undefined);
        host.loadSpaceHeaderChips = vi.fn().mockResolvedValue(undefined);
        host.loadSpaceNotes = loadSpaceNotesSpy;
        host.syncStateWithAgent = vi.fn();
        host.RefreshView = vi.fn();
        host.UpdateQueryParams = vi.fn();
        host.selectSpaceInternal = vi.fn(async (spaceId: string) => {
            host.selectSpaceRequestId += 1;
            await host.selectSpaceBody(spaceId, host.selectSpaceRequestId, false);
        });

        // 1. Deep-link initial load with ?tab=notes selects Space A and triggers loadSpaceNotes(SPACE_A, ...)
        await host.applyQueryParams({ tab: 'notes', space: SPACE_A });
        expect(host.activeTab).toBe('Notes');
        expect(loadSpaceNotesSpy).toHaveBeenCalledTimes(1);
        expect(loadSpaceNotesSpy).toHaveBeenNthCalledWith(1, SPACE_A, expect.any(Function));

        // 2. Switching to Space B in the rail while on the Notes tab clears stale notes and triggers loadSpaceNotes(SPACE_B, ...)
        host.selectSpaceRequestId += 1;
        await host.selectSpaceBody(SPACE_B, host.selectSpaceRequestId, false);
        expect(host.resetForSelection).toHaveBeenCalledWith(SPACE_B);
        expect(loadSpaceNotesSpy).toHaveBeenCalledTimes(2);
        expect(loadSpaceNotesSpy).toHaveBeenNthCalledWith(2, SPACE_B, expect.any(Function));

        // 3. Deep-link/popstate switching to ?tab=notes on an already-loaded space also triggers loadSpaceNotes
        host.activeTab = 'Overview';
        await host.applyQueryParams({ tab: 'notes', space: SPACE_B });
        expect(host.activeTab).toBe('Notes');
        expect(loadSpaceNotesSpy).toHaveBeenCalledTimes(3);
        expect(loadSpaceNotesSpy).toHaveBeenNthCalledWith(3, SPACE_B, expect.any(Function));
    });
});
