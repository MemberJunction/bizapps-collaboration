/**
 * SPDX-License-Identifier: BUSL-1.1
 *
 * Pure isomorphic Angular workspace logic for promoting a `SpaceNote` ("Turn into document")
 * into a native, editable `MJ: Artifacts` (`Markdown Document`) + v1 `MJ: Artifact Versions`
 * + `SpaceItem`, refreshing local workspace document rows without full-page reload, and
 * navigating via MemberJunction's `NavigationService` (never raw Angular Router).
 */
import { CompositeKey } from '@memberjunction/core';
import {
    DEFAULT_NOTE_DOCUMENT_FOLDER,
    DEFAULT_NOTE_DOCUMENT_TITLE,
    MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME,
    NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE,
    noteToArtifactDocument,
    noteTurnIntoDocumentVerdict,
    type Band,
    type NoteTurnIntoDocumentVerdict,
    type NoteTurnIntoDocumentViewer,
    type NoteVisibility,
} from '@mj-biz-apps/collaboration-core';
import type {
    PromoteSpaceNoteToDocGraphQLInput,
    PromoteSpaceNoteToDocGraphQLPayload,
} from '@mj-biz-apps/collaboration-entities';
import type { LibraryRowModel, NoteModel, SpaceArtifactOpenRequest } from '@mj-biz-apps/collaboration-ng-widgets';

const ARTIFACTS_ENTITY_NAME = 'MJ: Artifacts';

export interface PromotedNoteDocumentResult {
    spaceItemId: string;
    artifactId: string;
    versionId: string;
    versionNumber: number;
    title: string;
    band: Band;
    visibility: NoteVisibility;
    folder: string | null;
    delegateEntityId: string;
    delegateRecordId: string;
    artifactTypeName: string;
    contentMode: string;
    sourceNoteId: string | null;
}

export type BuiltPromoteSpaceNoteInput =
    | {
          ok: true;
          input: PromoteSpaceNoteToDocGraphQLInput;
          normalizedTitle: string;
          effectiveBand: Band;
      }
    | {
          ok: false;
          message: string;
      };

export interface ExplorerArtifactNavigationHost {
    OpenArtifact?: (artifactId: string, artifactName?: string) => string;
    OpenEntityRecord?: (entityName: string, recordPkey: CompositeKey) => string;
}

export type PromotedDocumentNavigationMode =
    | 'navigation-artifact'
    | 'navigation-entity'
    | 'slideover'
    | 'none';

/**
 * Evaluates whether the active viewer may turn a `SpaceNote` into a native `MJ: Artifacts`
 * Markdown Document using Core's canonical fail-closed rule.
 */
export function evaluateNoteTurnIntoDocument(
    viewer: NoteTurnIntoDocumentViewer,
    note: Pick<NoteModel, 'band' | 'visibility' | 'authorUserId'>,
): NoteTurnIntoDocumentVerdict {
    return noteTurnIntoDocumentVerdict(viewer, {
        Band: note.band,
        Visibility: note.visibility,
        AuthorUserID: note.authorUserId,
    });
}

/**
 * Builds the strongly-typed `PromoteSpaceNoteToDoc` GraphQL mutation input from an Angular `NoteModel`,
 * normalizing empty/untitled/whitespace note titles & bodies deterministically and locking `Private`
 * notes to the `Team` band via `@mj-biz-apps/collaboration-core`'s `noteToArtifactDocument`.
 */
export function buildPromoteSpaceNoteInput(
    spaceId: string,
    note: Pick<NoteModel, 'id' | 'title' | 'body' | 'band' | 'visibility' | 'authorUserId'>,
    options?: { folder?: string | null },
): BuiltPromoteSpaceNoteInput {
    const cleanSpaceId = (spaceId ?? '').trim();
    if (!cleanSpaceId) {
        return {
            ok: false,
            message: 'Select a space before turning a note into a document.',
        };
    }

    const spec = noteToArtifactDocument(
        {
            ID: note.id,
            SpaceID: cleanSpaceId,
            Title: note.title,
            Body: note.body,
            Band: note.band,
            Visibility: note.visibility,
            AuthorUserID: note.authorUserId,
        },
        options,
    );

    return {
        ok: true,
        normalizedTitle: spec.title,
        effectiveBand: spec.band,
        input: {
            SpaceID: spec.spaceId,
            ...(spec.sourceNoteId ? { NoteID: spec.sourceNoteId } : {}),
            Title: spec.title,
            Body: note.body ?? '',
            Band: spec.band,
            Visibility: spec.visibility,
            Folder: spec.folder,
        },
    };
}

/**
 * Validates and normalizes the GraphQL `PromoteSpaceNoteToDoc` payload into a strict
 * `PromotedNoteDocumentResult`, failing closed when `Success` is false or required IDs are missing.
 */
export function parsePromoteSpaceNotePayload(
    payload: PromoteSpaceNoteToDocGraphQLPayload | null | undefined,
    fallbackTitle: string,
    fallbackBand: Band,
    fallbackVisibility: NoteVisibility,
    fallbackNoteId: string | null,
): { ok: true; data: PromotedNoteDocumentResult } | { ok: false; message: string } {
    if (!payload || !payload.Success) {
        return {
            ok: false,
            message: payload?.ErrorMessage?.trim() || 'The editable document could not be created from this note.',
        };
    }
    const artifactId = (payload.ArtifactID ?? '').trim();
    const spaceItemId = (payload.SpaceItemID ?? '').trim();
    if (!artifactId || !spaceItemId) {
        return {
            ok: false,
            message: 'The server returned an incomplete document response (missing ArtifactID or SpaceItemID).',
        };
    }

    const title = (payload.Title ?? '').trim() || fallbackTitle.trim() || DEFAULT_NOTE_DOCUMENT_TITLE;
    const band: Band = payload.Band === 'Shared' ? 'Shared' : payload.Band === 'Team' ? 'Team' : fallbackBand;
    const visibility: NoteVisibility = payload.Visibility === 'Private'
        ? 'Private'
        : payload.Visibility === 'Space'
          ? 'Space'
          : fallbackVisibility;

    return {
        ok: true,
        data: {
            spaceItemId,
            artifactId,
            versionId: (payload.VersionID ?? '').trim(),
            versionNumber: typeof payload.VersionNumber === 'number' && payload.VersionNumber > 0 ? payload.VersionNumber : 1,
            title,
            band,
            visibility,
            folder: payload.Folder !== undefined ? payload.Folder : DEFAULT_NOTE_DOCUMENT_FOLDER,
            delegateEntityId: (payload.DelegateEntityID ?? '').trim(),
            delegateRecordId: (payload.DelegateRecordID ?? spaceItemId).trim(),
            artifactTypeName: (payload.ArtifactTypeName ?? MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME).trim() || MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME,
            contentMode: (payload.ContentMode ?? NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE).trim() || NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE,
            sourceNoteId: payload.SourceNoteID ?? fallbackNoteId,
        },
    };
}

/**
 * Navigates cleanly to the newly created editable `MJ: Artifacts` Markdown Document using
 * MemberJunction Explorer's canonical `NavigationService` (`OpenArtifact`, falling back to
 * `OpenEntityRecord('MJ: Artifacts', ...)`), or falls back to Collaboration's in-place
 * `<mjc-artifact-slideover>` when running without Explorer's `NavigationService`.
 * Never calls raw Angular `Router`.
 */
export function navigateToPromotedArtifactDocument(
    doc: { artifactId: string; title: string; versionNumber?: number },
    deps: {
        navigationService?: ExplorerArtifactNavigationHost | null;
        openSlideover?: (request: SpaceArtifactOpenRequest) => void;
        canEdit?: boolean;
        canShare?: boolean;
    },
): PromotedDocumentNavigationMode {
    const cleanArtifactId = (doc.artifactId ?? '').trim();
    if (!cleanArtifactId) return 'none';
    const cleanTitle = (doc.title ?? '').trim() || DEFAULT_NOTE_DOCUMENT_TITLE;

    const nav = deps.navigationService;
    if (nav && typeof nav.OpenArtifact === 'function') {
        nav.OpenArtifact(cleanArtifactId, cleanTitle);
        return 'navigation-artifact';
    }
    if (nav && typeof nav.OpenEntityRecord === 'function') {
        nav.OpenEntityRecord(ARTIFACTS_ENTITY_NAME, CompositeKey.FromID(cleanArtifactId));
        return 'navigation-entity';
    }
    if (deps.openSlideover) {
        deps.openSlideover({
            artifactId: cleanArtifactId,
            versionNumber: doc.versionNumber ?? 1,
            title: cleanTitle,
            canEdit: deps.canEdit === true,
            canShare: deps.canShare === true,
        });
        return 'slideover';
    }
    return 'none';
}

/**
 * Builds an optimistic `LibraryRowModel` representing the newly created native `MJ: Artifacts`
 * Markdown Document so local workspace state updates immediately without a full-page reload.
 */
export function buildPromotedDocumentLibraryRow(
    doc: PromotedNoteDocumentResult,
    authorName: string,
    whenLabel: string,
    updatedAtIso: string,
): LibraryRowModel {
    return {
        id: doc.spaceItemId,
        artifactId: doc.artifactId,
        entityName: ARTIFACTS_ENTITY_NAME,
        artifactType: doc.artifactTypeName,
        kind: 'doc',
        name: doc.title,
        folder: doc.folder ?? DEFAULT_NOTE_DOCUMENT_FOLDER,
        band: doc.band,
        who: authorName.trim() || 'Staff team',
        when: whenLabel,
        updatedAt: updatedAtIso,
    };
}

/**
 * Upserts a promoted document row at the top of the workspace's `libraryRows` array immutably
 * (deduplicating by `id` or `artifactId`).
 */
export function upsertPromotedDocumentRow(
    existingRows: readonly LibraryRowModel[],
    promotedRow: LibraryRowModel,
): LibraryRowModel[] {
    const lowerId = promotedRow.id.toLowerCase();
    const lowerArtId = (promotedRow.artifactId ?? '').toLowerCase();
    const filtered = existingRows.filter(
        (row) =>
            row.id.toLowerCase() !== lowerId &&
            (!lowerArtId || (row.artifactId ?? '').toLowerCase() !== lowerArtId),
    );
    return [promotedRow, ...filtered];
}
