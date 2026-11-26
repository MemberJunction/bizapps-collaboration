# Upgrade SpaceNote "Turn into Document" to Native `MJ: Artifacts` (`Markdown Document`) & Docs vs. Notes Rubric

Concise EARS specification and synchronized architecture summary for upgrading `SpaceNote` promotion in `MemberJunction/bizapps-collaboration` (target branch `next`, compiled against pinned `@memberjunction/*@6.3.0-edge.1`) across Slices 1–3.

## 1. Purpose & Motivation

Previously, turning a quick `SpaceNote` into a document uploaded a static `.md` binary blob via `upload-space-file.ts`, losing version history, live collaborative editing, native AI grounding, and delegated `ArtifactPermissionEngine` access control. This epic upgrades **Turn into document** to create a first-class, versioned, editable **`MJ: Artifacts` (`Markdown Document`)** with an initial v1 **`MJ: Artifact Versions`** (`ContentMode: 'Text'`) and a **`SpaceItem`** link bound via `Artifact.DelegateEntityID` / `Artifact.DelegateRecordID` to `'MJ_BizApps_Collaboration: Space Items'`, while preserving backward compatibility on all existing public helper signatures and keeping `upload-space-file.ts` intact for binary/file attachments.

## 2. EARS Requirements

### Core Pure Promotion Rules (`packages/Core/src/notes.ts`)
- **REQ-1**: WHEN a caller transforms a `SpaceNote` into a document specification via `noteToArtifactDocument`, THE SYSTEM SHALL emit a strongly typed `NoteArtifactDocument` (`artifactType: 'Markdown Document'`, `contentMode: 'Text'`, `spaceId`, `band`, `visibility`, `title`, `markdown`) without importing server or file-upload dependencies.
- **REQ-2**: IF a `SpaceNote` has an empty, whitespace-only, or missing title, THEN THE SYSTEM SHALL deterministically fall back to `DEFAULT_NOTE_DOCUMENT_TITLE` (`'Untitled Note'`) while preserving existing `noteDocument` and `noteFileName` public signatures for backward compatibility.
- **REQ-3**: WHEN a `SpaceNote` has `Visibility = 'Private'`, THE SYSTEM SHALL lock the promoted document's `Band` to `'Team'` (never `'Shared'`) and authorize promotion only for the note's author or a space administrator (`noteTurnIntoDocumentVerdict` / `resolveNoteDocumentBand`).

### Server Orchestration & Permission Delegation (`packages/CoreEntitiesServer/src/space-docs.ts` & `packages/Server`)
- **REQ-4**: WHEN `promoteSpaceNoteToDoc` (or GraphQL mutation `PromoteSpaceNoteToDoc`) executes on behalf of an explicit `contextUser`, THE SYSTEM SHALL verify space membership, active seat reach, band visibility (`Team` vs. `Shared`), and `Private`-note ownership fail-closed BEFORE creating any records.
- **REQ-5**: WHEN authorization succeeds, THE SYSTEM SHALL create an `MJ: Artifacts` record (`Type = 'Markdown Document'`, `DelegateEntityID = SpaceItemEntityID`, `DelegateRecordID = SpaceItem.ID`), a v1 `MJ: Artifact Versions` record (`VersionNumber = 1`, `ContentMode = 'Text'`, Markdown content), and a `SpaceItem` (`SpaceID`, `Band`, `ArtifactVersionID`, `ItemType = 'Document'`) without calling `upload-space-file.ts`.
- **REQ-6**: IF any mid-sequence entity save (`MJ: Artifacts`, `MJ: Artifact Versions`, or `SpaceItem`) fails, THEN THE SYSTEM SHALL execute compensating deletes so zero orphaned `MJ: Artifacts`, `MJ: Artifact Versions`, or `SpaceItem` rows remain persisted.
- **REQ-7**: WHEN resolving permissions on the promoted artifact via `ArtifactPermissionEngine`, THE SYSTEM SHALL delegate to `CollaborationSpaceItemArtifactPermissionDelegate` so `Team`-band documents remain strictly isolated from `Shared`-band (`Space Participant`) viewers and unauthorized cross-organization principals are denied fail-closed.
- **REQ-8**: WHILE resolving metadata and space context on the server, THE SYSTEM SHALL cache `'Markdown Document'` artifact type metadata per provider via `SpaceDocMetadataCache` (`BaseSingleton`), batch queries via `RunViews` with `ResultType: 'simple'`, and enforce zero `any`, zero lazy `unknown` casts, and zero `.Get()`/`.Set()` accessors.

### Angular SpaceNotes, Workspace UI & OpenApp v3 Readiness (`packages/Angular`, `packages/AngularWidgets`, `packages/Entities`)
- **REQ-9**: WHEN a user clicks **Turn into document** in `<mjc-space-notes>` inside `CollaborationSectionResource`, THE SYSTEM SHALL invoke `CollaborationClient.PromoteSpaceNoteToDoc` (never `UploadSpaceFile` and never importing server packages), refresh local `libraryRows` / `SpaceItem` state in-place without a full page reload, and route directly to the created editable document via Explorer's `NavigationService.OpenArtifact(...)` (with `OpenEntityRecord('MJ: Artifacts', ...)` and in-place `<mjc-artifact-slideover>` fallback — never `@angular/router`).
- **REQ-10**: WHILE a SpaceNote promotion is in flight (`TurningIntoDocumentNoteId`), THE SYSTEM SHALL disable duplicate **Turn into document** triggers to prevent concurrent duplicate `MJ: Artifacts` creation.
- **REQ-11**: WHERE Angular components render SpaceNotes cards and workspace chrome, THE SYSTEM SHALL enforce `ChangeDetectionStrategy.OnPush`, `@if`/`@for`, `inject()`, `<mj-page-layout>`, deferred `NotifyLoadStarted()` (`queueMicrotask`), `NotifyLoadComplete()`, `UserInfoEngine.Instance` (zero `localStorage`/`sessionStorage`), zero `window.print()`, semantic `--mj-*`/`--mjc-*` CSS tokens (zero raw `#hex`/`rgb`/`rgba`/`hsl`), zero raw Markdown syntax leaks in preview text (`formatNotePreviewText`), and active `BaseFormComponent` + `BaseResourceComponent` ClassFactory registration reachable from `mj-app.json` `startupExport`.

### Governance Rubric & Living Documentation (`CLAUDE.md`, `AGENTS.md`, `README.md`, `.changeset/`)
- **REQ-12**: WHERE developers or AI agents consult `CLAUDE.md`, `AGENTS.md`, or `README.md`, THE SYSTEM SHALL document the concise `'MJ Docs (MJ: Artifacts) vs. MJ: Comments vs. Quick Notes'` rubric referencing `MJ/guides/MJ_DOCS_COMMENTS_AND_NOTES_GUIDE.md` and keep package READMEs, this specification, and Changesets synchronized.

## 3. Architecture Summary (Slices 1–3)

| Slice | Packages & Files | Summary |
|---|---|---|
| **Slice 1** | `packages/Core/src/notes.ts`, `packages/CoreEntitiesServer/src/space-docs.ts`, `packages/IntegrationTests/src/checks/space-note-to-artifact-doc.checks.ts`, `test-harnesses/integration.mjs`, `packages/Core/README.md`, `packages/CoreEntitiesServer/README.md` | Pure `noteToArtifactDocument` / `noteTurnIntoDocumentVerdict` helpers; `promoteSpaceNoteToDoc` + `turnSpaceNoteIntoDocument` with `SpaceDocMetadataCache` (`BaseSingleton`), batched `RunViews`, `DelegateEntityID`/`DelegateRecordID` binding, and compensating cleanup; unit tests and multi-entity cross-stack world integration checks. |
| **Slice 2** | `packages/Server/src/promote-space-note-to-doc.resolver.ts`, `packages/Entities/src/client.ts`, `packages/AngularWidgets/src/lib/space-notes.component.ts`, `packages/Angular/src/lib/logic/note-to-document.ts`, `packages/Angular/src/lib/collaboration-section.component.ts`, `packages/UXGallery/src/frames/frame-10.component.ts`, `e2e/specs/spacenote-turn-into-document.spec.ts`, `packages/Angular/README.md`, `packages/AngularWidgets/README.md` | GraphQL `PromoteSpaceNoteToDoc` resolver & typed `CollaborationClient.PromoteSpaceNoteToDoc`; Angular `<mjc-space-notes>` double-click guard, plain-text preview sanitization, post-promotion document links, `CollaborationSectionResource` `NavigationService` routing; OpenApp v3 registration & CSS token test suite; Playwright Frame 10 responsive Light/Dark E2E visual verification. |
| **Slice 3** | `CLAUDE.md`, `AGENTS.md`, `README.md`, `packages/Entities/README.md`, `packages/Server/README.md`, `.mj/specs/upgrade-spacenote-turn-into-document-to-native-mj-artifacts-mark/spec.md`, `.changeset/spacenote-native-mj-artifact-doc.md` | Concise `'MJ Docs (MJ: Artifacts) vs. MJ: Comments vs. Quick Notes'` rubric referencing `MJ/guides/MJ_DOCS_COMMENTS_AND_NOTES_GUIDE.md`; living documentation & spec sync; Changesets entry covering all 6 modified publishable packages; full monorepo build, test, integration, Playwright E2E, and CI guard verification. |

### Schema & Migrations Note
No SQL DDL migrations (`migrations/**`) or security/auth subsystem edits (`**/auth/**`, `**/security/**`) are required. All underlying tables and columns — `MJ: Artifacts` (`DelegateEntityID`, `DelegateRecordID`), `MJ: Artifact Versions` (`ContentMode`), `SpaceItem` (`ArtifactVersionID`), and `SpaceNote` — already exist in the baseline schema and pinned `@memberjunction/*@6.3.0-edge.1`.

## 4. Critical User Journeys

### CUJ-1 — Space Member in a Team Space
1. Opens a `SpaceNote` in the Angular SpaceNotes view (`<mjc-space-notes>`) within a Team Space.
2. Clicks **Turn into document** (button disables while in flight to prevent duplicate submissions).
3. `CollaborationClient.PromoteSpaceNoteToDoc` -> `PromoteSpaceNoteToDocResolver` -> `promoteSpaceNoteToDoc` creates a native `MJ: Artifacts` (`Markdown Document`) + v1 `MJ: Artifact Versions` + `SpaceItem` inheriting `SpaceID`, `Band = 'Team'`, `Visibility`, and `DelegateEntityID`/`DelegateRecordID`.
4. Local space document rows refresh in-place and `CollaborationSectionResource` routes directly to the newly created editable Markdown Document via `NavigationService.OpenArtifact(...)`.

### CUJ-2 — External / Cross-Org Collaborator in a Shared-Band Space
1. A collaborator promotes a `Shared`-band `SpaceNote` inside a Shared-band Space (while `Private` notes remain locked to the `Team` band and cannot be leaked to `Shared`).
2. `Artifact.DelegateEntityID` and `Artifact.DelegateRecordID` bind the promoted artifact to the `SpaceItem`, evaluated by `CollaborationSpaceItemArtifactPermissionDelegate` inside `ArtifactPermissionEngine`.
3. Authorized Shared-band collaborators open and work with the promoted Markdown Document, while `Team`-band promoted docs and unauthorized cross-organization principals are denied fail-closed.

### CUJ-3 — Developer / AI Agent Choosing Collaboration Primitives
1. Before implementing a new document, discussion, or note workflow, the developer or AI agent consults `CLAUDE.md` or `AGENTS.md`.
2. Follows the `'MJ Docs (MJ: Artifacts) vs. MJ: Comments vs. Quick Notes'` rubric and [`MJ/guides/MJ_DOCS_COMMENTS_AND_NOTES_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/MJ_DOCS_COMMENTS_AND_NOTES_GUIDE.md) to select `MJ: Artifacts` for versioned collaborative docs, `MJ: Comments` for anchored threaded discussions, and `SpaceNote` (+ **Turn into document**) for lightweight ephemeral space notes.

## 5. Verification & CI Quality Gates
- **Full Monorepo Build**: `pnpm run build` (all packages + ExampleSpaceTypes against `@memberjunction/*@6.3.0-edge.1`).
- **Unit & Integration Test Suites**: `pnpm test` (Core, EngineBase, CoreEntitiesServer, IntegrationTests, Server, AngularWidgets, Angular including OpenApp v3 registration & `--mj-*` token compliance, ExampleSpaceTypes) plus `test-harnesses/integration.mjs` syntax and `space-note-to-artifact-doc` world checks.
- **Visual E2E**: `pnpm run test:e2e` (Playwright Chromium Frame 10 across `desktop`/`tablet`/`mobile` × `light`/`dark`, verifying FontAwesome + Inter font loading, zero raw Markdown leaks, zero broken images, zero horizontal overflow, zero console/page errors).
- **CI Static Guard Scripts**: `strip-sync-blocks.mjs --check`, `check-mj-tokens.mjs`, `check-strict-types.mjs`, `check-downstream-names.mjs`, `check-mj-inputs.mjs`, `check-registered-exports.mjs`, `check-row-caps.mjs`, `check-no-role-name-auth.mjs`, `.github/scripts/validate-metadata-directory-order.sh`, `.github/scripts/check-dependency-model.mjs`, `.github/scripts/check-migration-changeset.sh`, and `.github/scripts/check-script-references.sh`.
