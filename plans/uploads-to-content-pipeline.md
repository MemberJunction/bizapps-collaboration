# Uploads reach the content pipeline (phase U)

Files uploaded to a space are stored, but they are never extracted, chunked or embedded. So the space Assistant cannot answer from what is inside them. The write-up, with the evidence, is the doc "Collaboration uploads never reach the content pipeline". This file is the build plan.

**Why it's missing:**
- MJ's content pipeline (#4986, merged 2026-10-26) has no way in for a pushed file. Its five source types (Cloud Storage, Entity, Local File System, RSS Feed, Website) all *discover* content.
- Neither #4986's 55 commits nor the #4744 plan mention uploads.
- Betty's "Manual Uploads" works around the gap: it borrows another source's type and writes Content Items itself (`betty.spCreateContentItem`).

This phase adds the missing piece to MJ once, then uses it from Collaboration.

Three steps, **stop for review after each**:
- **U0** is research: is a new source type worth it, or should we just index? No code.
- **U1** is MJ, in `~/Projects/mjws-collab/MJ`, as local commits on `collab/e2e-combined`. Its shape depends on the option Colin picks after U0.
- **U2** is Collaboration, on `feat/collab-ui-polish`.

Never push. Never `git stash`. Don't amend a reviewed commit. Opening an MJ PR is Colin's call.

**Running beside the UI work.** Another Gemini chat is finishing the UI polish in `bizapps-collaboration` at the same time. While U0 and U1 run:
- Touch nothing in `bizapps-collaboration` except your research and notes files (`plans/uploads-to-content-pipeline-research.md`, `plans/uploads-to-content-pipeline-notes.md`).
- Don't run `pnpm install` at the workspace root.
- Don't restart the API or Explorer.
- Add no new dependency without asking.

U1 is proved by package builds and unit tests; it needs no running server. U2 starts only after U1 is reviewed and the UI chat has stopped.

## What already exists (read these before writing anything)

| Piece | Where | What it gives you |
|---|---|---|
| Extract reads a stored file | `ContentPipeline/engine/src/stages/ExtractStage.ts`: `readKeptFile`, used when the item has a `FileID` (hydrated from the column in `WorkingRecordHydrator.ts`) | A Content Item with `FileID` set is extracted from MJ storage, with no URL fetch |
| Stages run by status | `metadata/record-processes/.content-pipeline.json` | Extract, Tag and Segment pick up Content Items whose status is null or `Pending`; Embed picks up chunks |
| On-demand runs | `RecordSetProcessor/engine/src/RecordProcessExecutor.ts` (`RunByID`, a records scope), and the `Run Record Process` action | Run one stage for chosen record IDs |
| Delete | `ContentPipeline/engine/src/ContentPipelineDeleteMarker.ts` and `DeleteStage.ts` | Two-phase delete of an item, its chunks, vectors and stored copy |
| Origin check in search | `SearchEngine/src/generic/SearchEngine.ts` (`VerifyOriginRecords`, `lookupEntityRecordDocuments`) | A result is shown only if the reader can read its origin record, found through the item's Entity Record Document |
| Collaboration read filters | `metadata/row-level-security-filters/.row-level-security-filters.json`: the three "… In Reach" filters | They follow a Content Item through its Entity Record Document (`EntityID` = Space Items, `RecordID` = `ID|<item id>`) to the space and the band |
| Collaboration upload | `packages/CoreEntitiesServer/src/upload-space-file.ts`, `collaboration-file-store.ts` | `FileStorageEngine.UploadFile` gives an `MJ: Files` row; the Space Item targets an artifact whose version holds that `FileID` |
| Local vector index | the local DB: "Default - SVS + gte-small (Local)" | **Read-only (U0):** it can't store chunk vectors. A writable local option is `SQLServerVectorDatabase`. Never hard-code an index |

## U0: research first; decide whether we need a new source type at all

Colin isn't sure a new `Upload` source type is worth it, compared with just getting uploads indexed. Before any code, compare the options below and recommend one. **No code or metadata changes in U0.** Write the result to `plans/uploads-to-content-pipeline-research.md`, then **stop for Colin's decision**.

The options:
- **A. A new `Upload` source type, plus one `Ingest` / `Remove` API in MJ.** This is U1 as written below.
- **B. No new type: extend the Entity source to index a record's linked file.**
  - When a record has an `MJ: File Entity Record Links` row (or a configured file field), Discover sets the Content Item's `FileID`, and Extract reads the file.
  - Collaboration links each stored file to its Space Item on upload, then runs Discover and the stages on demand for that record.
- **C. No MJ change: Collaboration writes the index rows itself.**
  - It writes the Entity Record Document and the Content Item (with `FileID`) under its own source, the way Betty's "Manual Uploads" does (`Betty-MJ/apps/MJAPI/src/resolvers/BettyAdminResolver.ts`, `BettyAdminAddContent`).
  - Then it runs the stages on demand.
- **D. A Cloud Storage source over the folder uploads land in.** Confirm or refute that its items carry no origin link, so Collaboration's read filters would either hide them or leak Team files.

For each option, answer from the code, citing file and line:
1. **What changes:** MJ files, metadata rows, schema. A rough size in lines. Whether it needs an MJ PR.
2. **The origin link:**
   - Does every indexed file get an Entity Record Document that points at its Space Item (`ID|<id>`)?
   - Do the three "… In Reach" read filters and `SearchEngine.VerifyOriginRecords` then work unchanged?
3. **Discover and Sync:**
   - What happens to these items on a Discover run and on a Sync run? (Sync marks unseen items for deletion: `PipelineProcessor.markOrphansForDeletion`.)
   - What has to change so uploads are never orphaned?
4. **Delete and replace:**
   - Deleting a Space Item, or replacing its file: what removes the old chunks and vectors?
   - Is the stored file ever at risk of being deleted by the pipeline?
5. **Time to searchable:** how soon after an upload can the Assistant find the text, with an on-demand run?
6. **Reuse:**
   - Could Betty's "Manual Uploads" move onto it?
   - Could other MJ apps use it, for example conversation attachments, if they're indexed anywhere today?
   - Is `MJ: File Entity Record Links` used anywhere today, and by what?
7. **Fit with MJ:**
   - What `guides/CONTENT_PIPELINE_GUIDE.md` and the #4744 plan (`gh pr diff 4744 --repo MemberJunction/MJ`) say about how sources are meant to work.
   - Whether a new source type is only a metadata row or needs a driver class.
   - Whether `ContentSource.EntityID` and `EntityDocumentID` are honored for non-Entity types.
8. **Risks and open questions.**

The report:
- Open with a one-paragraph recommendation.
- Then a comparison table: options as rows; changes, MJ PR, origin link, Sync-safe, delete handling, time to searchable and reuse as columns.
- Then the evidence for each answer.
- Name only files and identifiers that exist. Check each with `git grep`.

## U0 review (reviewer, 2026-10-30)

**Option A stands. The verified findings make it the clear choice.** But parts of the report were invented: they appear in no tool output in the research chat's own transcript. Treat the report as a lead, not as evidence.

**Verified against the workspace code:**
- The new pipeline's Entity Discover never creates Entity Record Documents. `upsertEntityRecordDocument` is called only from `processSingleRecord`, the legacy `Autotag` path (`AutotagEntity.ts:452`, `:723`). So option B is a much larger change than it looked.
- `FileID` is framework-owned (`WorkingRecordCommitter.ts`, `FRAMEWORK_OWNED_COLUMNS`), so a driver can't set it. `EntityRecordDocumentID` is not in that list, contrary to the report.
- **Delete hazard:** `DeleteStage.removeDurableCopy` deletes the storage object and the `MJ: Files` row for any Content Item with a `FileID`. Indexing Collaboration's uploads naively would let the pipeline delete the user's file.
- A Sync over a driver with `SupportsExhaustiveWalk` false throws a `FatalStageError` (`DiscoverStage.ts`, `resolveWalkSource`). That's safe, but it fails loudly on every run.
- **Local embeddings don't work:** `SimpleVectorServiceProvider.IsReadOnly` is true and `CreateRecords` is unsupported. `EmbedStage` never checks `IsReadOnly`; only `DeleteStage` (line 191) does. So the local index "Default - SVS + gte-small (Local)" can't store chunk vectors, and Embed retries. A writable local option exists: `AI/Vectors/Providers/SQLServer` (`SQLServerVectorDatabase`).
- `SearchEngine` passes content with no origin unconditionally (`SearchEngine.ts:3261`, `:3414`). That confirms option D leaks Team files wherever row filters don't apply.
- Collaboration's Space Item for an upload has `EntityID` = `MJ: Files`, `RecordID` = `ID|<fileId>`, plus `ArtifactVersionID` (`upload-space-file.ts`).

**Not true (invented):**
- There is no `retrieveSpaceContext` and no `enrichContentHits` in `space-agent-retrieval.ts`, on any branch.
- There are not three search scopes covering Content Items and chunks. `metadata/search-scopes/.collaboration-search-scopes.json` has ONE scope, "Collaboration Space Scope". It covers Space Items and Tasks only, with the Database provider only.
- There are no "Web Page" or "API Feed" source types; MJ has five.

So the read side for **search** is not built: chunks are in no scope.

**Changes to U1 and U2, given the above:** see the new items marked (U0) below.

## U1: MJ, an Upload source type and one way in (only if Colin picks option A after U0)

**(U0) Three MJ fixes ride with U1, each with a test:**
- **Sync and Discover skip a push-only source with a `Skipped` outcome**, not a fatal error, and never mark its items as orphans.
- **The pipeline never deletes a file it didn't create.** `removeDurableCopy` deletes only copies the pipeline made itself (Extract's durable copies). An uploaded file belongs to the caller. Test: deleting an uploaded Content Item leaves its `MJ: Files` row and storage object in place.
- **`EmbedStage` honors `IsReadOnly`**, as `DeleteStage` does: no vector write, an outcome that says so, and no retry loop.

1. **An `Upload` content source type.** Add it to `metadata/content-source-types/.content-source-types.json`, following that file's existing rows. Give it a driver in `ContentAutotagging`, beside the others, registered the same way.
   - Its Discover yields nothing, because content is pushed.
2. **The Sync trap.**
   - A Sync run marks every item its Discover didn't return as an orphan to delete (`PipelineProcessor.markOrphansForDeletion`). An Upload source would lose every file on the next Sync.
   - Make Discover and Sync skip push-only source types, through a property of the driver or the type, not a name check.
   - Add a test: a Sync over an Upload source marks nothing.
3. **One server API** in `ContentPipeline/engine`, for example `ContentUploadIngestor`. Read every name you use from the code.
   - `Ingest({ ContentSourceID, FileID, Name, Description?, Origin?: { EntityName, RecordID }, RunNow?, ContextUser, Provider })`:
     - Creates the Content Item. It sets `FileID`, a stable unique `URL` built from the file id, and the type ids from the source. All stage statuses are `Pending`.
     - With an `Origin`, it finds or creates the `MJ: Entity Record Documents` row: `EntityID`, and `RecordID` in the `ID|<id>` form search expects. `EntityDocumentID` comes from the source's own `EntityDocumentID` column. The vector index is resolved the way `ContentVectorInfrastructure` resolves it. The Content Item then points at that Entity Record Document. With no `Origin`, there is no Entity Record Document (Betty's case).
     - With `RunNow`, it runs Extract, Tag, Segment and Embed for that one item through `RecordProcessExecutor` with a records scope, in order. It returns the Content Item id. A stage failure is logged and leaves the item `Failed`; it never throws past the caller.
     - Calling it twice for the same file returns the existing item.
   - `Remove({ ContentItemID | FileID, RunNow?, … })`:
     - Marks the item for deletion with `ContentPipelineDeleteMarker`.
     - With `RunNow`, runs Delete.
     - It never deletes the source file. The caller owns it.
4. **Tests** (vitest, in the packages you touch):
   - an item with a `FileID` extracts the file's text;
   - an origin creates exactly one Entity Record Document in the `ID|<id>` form;
   - a second `Ingest` of the same file is a no-op;
   - `Remove` marks the item and its chunks;
   - the Sync test from step 2.
5. **Docs:** add an "Uploads" section to `guides/CONTENT_PIPELINE_GUIDE.md` with the API, the origin rule and the Sync rule. One short paragraph each.
6. **Gates:**
   - the touched packages' builds and tests;
   - `pnpm run test:types` where a package has it;
   - the source guards (UUID compliance, MultiProvider compliance, `PrimaryKeyCompliance`).
   
   Commit, write "## U1" in `plans/uploads-to-content-pipeline-notes.md` with the real output, then **stop**.

## U2: Collaboration uses it

1. **Metadata** (no hand-made UUIDs; `uuidgen` for any fixed id):
   - an Entity Document "Space Item" on Space Items (template: name and description);
   - one Content Source "Space files" of type `Upload`, with `EntityID` = Space Items and `EntityDocumentID` = that document, and the content type and file type it needs.
   - Push it. Say what you pushed.
2. **On upload,** in `upload-space-file.ts`, once the Space Item is saved:
   - call `Ingest` with the stored `FileID`, the item's name and description, `Origin` = (Space Items, item id) and `RunNow`;
   - run it off the request path, so the upload returns at once;
   - if it fails, log it; the upload still succeeds.
3. **On delete or replace:** where a Space Item is deleted or its stored file is released (`SpaceItemEntityServer.ts`, `releaseStoredFile`), call `Remove` for that file with `RunNow`.
4. **Search (U0: this isn't wired today).**
   - Add `MJ: Content Item Chunks` to "Collaboration Space Scope". Its `ExtraFilter` limits rows to the asked space and audience band, through Content Item → Entity Record Document → Space Item, mirroring the Space Items entry.
   - Find, from the code, which path the Assistant's turn actually searches: the scope, the `KnowledgeSourceIDs` from `resolveSpaceKnowledgeSources`, or both. Make that path reach the chunks, and cite where.
   - Lexical search (Database provider) comes first.
   - Vectors only when a writable index exists. Locally that's a SQL Server vector index (`SQLServerVectorDatabase`) if Colin wants it; the local SVS index is read-only.
   - Confirm with the checks below that an answer in one space never quotes a sibling space's file.
5. **Backfill:** one idempotent function, run once, that ingests existing uploaded Space Items. Say how many it ingested locally.
6. **Integration checks** in `packages/IntegrationTests`, both harnesses, run one job at a time:
   - a staff member uploads a Shared PDF with a unique phrase, and the Assistant in that space quotes it within a minute;
   - an outside client in a General chat asks for a Team document's phrase and doesn't get it;
   - the Assistant asked in one space doesn't quote a file from a sibling space the asker can also open;
   - after the item is deleted, the phrase is no longer found and its chunks and vectors are gone;
   - moving an item from Team to Shared makes its text reachable to outside members without re-indexing;
   - every text format in `packages/Core/src/file-types.ts` extracts. Images, audio and video are skipped or take MJ's media path, and never fail the upload.
7. **Gates:** every gate in `plans/space-focused-ux/ui-polish.md` section 2, plus the integration harnesses. Commit, write "## U2" in the notes with the real output, then **stop**.

## Out of scope

- Moving Betty's "Manual Uploads" onto the Upload type. It's a separate repo; Betty can adopt `Ingest` once the MJ PR lands.
- An Action or GraphQL surface for `Ingest`. Add one when a client outside the server needs it.

## U1 review (reviewer, 2026-10-30, MJ `a761d94147`)

**Verdict: the shape is right. 2 blockers, 3 should-fixes, then U1 is done.** Gates rerun by the reviewer:
- `tsc --noEmit` exits 0 in content-autotagging and content-pipeline;
- 263 and 239 tests pass;
- `pnpm run check:guards` exits 0;
- `PrimaryKeyCompliance` passes (4).

Also confirmed:
- `ToRecordID()` gives `ID|<uuid>`, which matches Collaboration's "… In Reach" filters.
- The six hard-coded record-process IDs all exist in `metadata/record-processes/.content-pipeline.json`.
- `findExistingContentItem` filters on both `ContentSourceID` and `FileID`.

### Blockers

**U1-B1. Deciding whether a file is the caller's must fail safe.** In `DeleteStage.isCallerOwnedFile`, `!resolved.IsValid` and the `catch {}` both return `false`, which means "pipeline-owned". So a resolver error deletes the user's uploaded file. On any doubt, keep the file and log it. Add a test: a resolver error leaves the `MJ: Files` row and the object in place.

**U1-B2. Ownership must be explicit; don't guess it from four rules.**
- In #4986, a Content Item's `FileID` is framework-owned and only ever set to Extract's durable copy.
- So for every existing source, deleting the copy is correct. The rule "a source without `ObjectKeyTemplate` is caller-owned" changes that: remove a template after copies exist, and those copies leak forever.
- `Pipeline.callerOwnedFile` is read but never set anywhere.
- Keep only the two explicit signals: the `upload://` locator (set only by `Ingest`) and a push-only source. Delete the other two.
- Add a test: a durable copy on a source with no template is still deleted.

### Should-fix

**U1-S1. Declare push-only in one place.** Today it's three: the driver's `IsPushOnly`, the type's `Configuration.IsPushOnly`, and the source's `Configuration.IsPushOnly`. Keep the driver property. Drop the two config readings, and the `IsPushOnly` key in the Upload type's metadata `Configuration`.

**U1-S2. Make text searchable before tagging.** `runStagesNow` runs Extract, Tag, Segment, Embed. Tag is an LLM call of several seconds, and Segment doesn't depend on it. Run Extract, Segment, Embed, then Tag last.

**U1-S3. Say how to re-embed after a read-only index.** `EmbedStage` marks chunks `Skipped` on a read-only index. The Embed scope never picks up `Skipped`, so moving to a writable index later re-embeds nothing. Add one sentence to the guide's Uploads section on how to re-queue them (set `EmbeddingStatus` to `Pending`).

**Next:** fix U1-B1, U1-B2 and U1-S1 to S3 as one new commit on `collab/e2e-combined`. Run the U1 gates again, add "## U1 fixes" to the notes with the real output, then stop. **U2 waits until the UI chat finishes round 5**, because both touch `bizapps-collaboration`.

## U1 approved (reviewer, 2026-10-30, MJ `8c87311659`)

U1-B1, U1-B2 and U1-S1 to S3 are all fixed. Gates rerun by the reviewer: `tsc --noEmit` exits 0 in both packages; 263 and 241 tests pass; `check:guards` exits 0. Ownership is now explicit (the `upload://` locator, or a push-only driver), and the check fails safe, with tests for both. The two MJ commits (`a761d94147`, `8c87311659`) together are the content of the future MJ PR; Colin decides when to open it.

**U2 may start once the UI chat's round 5 is committed.** The UI chat may still have fixes queued after round 5's review, so while U2 runs, stage only the files you changed (`git add <paths>`), never `git add -A`.

## U2: unblock now (reviewer, 2026-10-30, time-boxed: Colin is out of time)

State: the server harness passes 111 of 111. The client harness passes 86 of 89. The 3 failures are all "Delete of Space … failed: unknown error" (`subtypes.SC1`, `SC3`, `SC4`). Stop reading MJ's `baseEntity` internals. The likely cause is U2's own delete hook.

**Do this, and nothing more:**
1. **Make the pipeline cleanup on delete fire-and-forget.** In `SpaceItemEntityServer.ts`:
   - `removeSpaceFileFromContentPipeline` only calls `ContentUploadIngestor.Remove({ FileID, ContentSourceID: SPACE_FILES_CONTENT_SOURCE_ID, RunNow: true, … })`, not awaited by the delete. Catch and log everything.
   - Delete the polling loop, `inFlightSpaceFileIngests`, `trackSpaceFileIngest`, `waitForSpaceFileIngest`, `waitForAllSpaceFileIngests`, and the `HandleStartup` call on the delete path.
   - A Space Item delete must never wait on, or fail because of, the pipeline.
   - Mark the known gap with a `ponytail:` comment: if an ingest finishes after its item was deleted, the leftover Content Item's origin is gone, so the read filters and `VerifyOriginRecords` already hide it. A later cleanup can sweep it.
2. **Rerun the client harness's `subtypes` checks.** If SC1, SC3 and SC4 still fail, disable U2's delete hook for one run:
   - If they pass then, it's U2: fix it.
   - If they still fail, they're not U2's: record them as pre-existing in the notes, with the output, and move on.
3. **Commit U2** (stage only U2's files), write "## U2" in the notes with the real gate output, and stop. **Budget: about 30 minutes.**

## U2 review (reviewer, 2026-10-30, ~16:25 CDT): only AG12 matters now

- **`extensions.EX12` and `stage1.S3` are not yours.** The UI chat's new seat rule (`f42666e`) caused them, and it's taking that rule out now. Ignore them.
- **You are the only chat running the integration harness.** One job at a time.
- **`subtypes.SC1`, `SC3`, `SC4`:** they still fail with your simplified hook. Run them once with the hook disabled. If they still fail, they're pre-existing: record them in the notes with the output, and move on.
- **`agent.AG12` is the proof of U2, and it failed after 16 minutes.** In the DB, the Space files items show `ExtractionStatus` and `SegmentationStatus` Complete, but every one is already cleanup-deleted, so check a fresh upload *before* cleanup:
  - (a) its Content Item has chunks, and a chunk's `Text` holds the phrase;
  - (b) "Collaboration Space Scope" includes `MJ: Content Item Chunks`, with an `ExtraFilter` that admits that chunk for the asked space and band;
  - (c) the Database provider searches chunk `Text` (the entity's `AllowUserSearchAPI`, the field's `IncludeInUserSearchAPI`).
- Cap AG12's wait at 60 seconds; the pipeline runs in seconds.
- **Time-box: 30 minutes.** If AG12 still fails then, commit what works with AG12 recorded as failing (and why), and stop. Colin decides.
- Stage only U2's files, commit, write "## U2" in the notes with the real gate output, then keep polling for "## U2 review 2" or "## U2 DONE".
