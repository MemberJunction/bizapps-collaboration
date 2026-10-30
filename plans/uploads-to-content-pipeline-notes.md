# Uploads to Content Pipeline — Notes

## U1

### Summary of Changes (`~/Projects/mjws-collab/MJ`, branch `collab/e2e-combined`, commit `a761d94147`)

1. **`Upload` Content Source Type & `AutotagUpload` Driver**
   - `metadata/content-source-types/.content-source-types.json`: Added `"Upload"` (`ID: "AFCB894F-ED26-4994-974D-523B86FA0A1D"`, `DriverClass: "AutotagUpload"`, `Configuration: { "IsPushOnly": true, "RequiredFields": [] }`).
   - `packages/ContentAutotagging/src/Core/generic/AutotagBase.ts`: Added `public readonly IsPushOnly?: boolean;`.
   - `packages/ContentAutotagging/src/Upload/generic/AutotagUpload.ts`: Added `AutotagUpload` (`@RegisterClass(AutotagBase, 'AutotagUpload')`, `IsPushOnly = true`, `SupportsExhaustiveWalk = false`, no-op `Discover`).
   - `packages/ContentAutotagging/src/Engine/generic/ContentVectorInfrastructure.ts`: Added `ResolveVectorIndexID(source)`.

2. **Three `(U0)` MJ Fixes**
   - `packages/ContentPipeline/engine/src/stages/DiscoverStage.ts`: Push-only sources (`driver.IsPushOnly === true || resolved.TypeConfiguration?.IsPushOnly === true || resolved.Configuration?.IsPushOnly === true`) return `Outcome.Skipped` in both `Discover` and `Sync` modes before checking `SupportsExhaustiveWalk` or running `PipelineProcessor.reconcileSyncOrphans`.
   - `packages/ContentPipeline/engine/src/stages/DeleteStage.ts`: `removeDurableCopy` checks `isCallerOwnedFile(record, context)` so caller-uploaded files (`IsUploadItemURL(record.Identity.URL)`, `Pipeline.callerOwnedFile === true`, push-only `Upload` sources, or sources without `ObjectKeyTemplate`) are never deleted from `MJ: Files` or `FileStorageEngine`.
   - `packages/ContentPipeline/engine/src/stages/EmbedStage.ts`: `Finalize` checks `if (route.Infrastructure.vectorDB.IsReadOnly)` and returns `Outcome.Skipped` (`StatusForOutcome('Skipped') === 'Skipped'`) without calling `AIEmbeddingRunner`, `UpsertVectorRecords`, or `UpdateRecords`.
   - `packages/ContentPipeline/engine/src/stages/ExtractStage.ts`: Kept/uploaded files (`FileID` set) fall back to `file.Name` or `record.Get('Title')` for extension-based file-type resolution when `ObjectKey` and `URL` (`upload://<fileId>`) carry no file extension.

3. **`ContentUploadIngestor` (`@memberjunction/content-pipeline`)**
   - `packages/ContentPipeline/engine/src/ContentUploadIngestor.ts`: Added `ContentUploadIngestor.Ingest` and `ContentUploadIngestor.Remove` (instance and static methods), `UploadItemURL`, `IsUploadItemURL`, `Origin` resolution to `MJ: Entity Record Documents` (`CompositeKey.FromURLSegment(entityInfo, origin.RecordID).ToRecordID()`), and `RunNow` execution via `RecordProcessExecutor.prototype.RunByID` with `Scope: { Kind: 'records', RecordIDs }`.
   - `guides/CONTENT_PIPELINE_GUIDE.md`: Added `## Uploads` section documenting the API, the `Origin` rule, and the `Sync` rule.

---

### Real Gate Outputs

#### 1. `@memberjunction/content-autotagging` Build & Tests (`package.json` has `build` and `test`; no `test:types` script)

Command:
```sh
pnpm --filter @memberjunction/content-autotagging run build && pnpm --filter @memberjunction/content-autotagging run test -- --reporter=basic
```

Output:
```text
 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/MJ/packages/ContentAutotagging

 ✓ src/__tests__/RunBudget.test.ts (14 tests) 2ms
 ✓ src/__tests__/ScopeContextResolver.test.ts (8 tests) 2ms
 ✓ src/__tests__/content-types.test.ts (15 tests) 3ms
 ✓ src/__tests__/FieldPathResolver.test.ts (24 tests) 5ms
 ✓ src/__tests__/AutotagWebsite.test.ts (35 tests) 11ms
 ✓ src/__tests__/ContentDeduplication.test.ts (22 tests) 4ms
 ✓ src/__tests__/ContentVectorInfrastructure.test.ts (9 tests) 3ms
 ✓ src/__tests__/AutotagBaseEngine.test.ts (109 tests) 49ms
 ✓ src/__tests__/ContentAutotagPrompt.test.ts (3 tests) 2ms
 ✓ src/__tests__/AutotagEntity.test.ts (16 tests) 6ms
 ✓ src/__tests__/LocalFileSystemFetch.test.ts (8 tests) 5ms

 Test Files  11 passed (11)
      Tests  263 passed (263)
   Start at  12:39:49
   Duration  2.91s (transform 6.44s, setup 0ms, import 14.55s, tests 92ms, environment 0ms)
```

#### 2. `@memberjunction/content-pipeline` Build & Tests (`package.json` has `build` and `test`; no `test:types` script)

Command:
```sh
pnpm --filter @memberjunction/content-pipeline run build && pnpm --filter @memberjunction/content-pipeline run test -- --reporter=basic
```

Output:
```text
 ✓ src/__tests__/DiscoverStage.test.ts (20 tests) 8ms
 ✓ src/__tests__/EmbedRouting.test.ts (4 tests) 4ms
 ✓ src/__tests__/TagSegmentStages.test.ts (21 tests) 7ms
 ✓ src/__tests__/PipelineProcessor.test.ts (17 tests) 10ms
 ✓ src/__tests__/EmbedStage.test.ts (15 tests) 5ms
 ✓ src/__tests__/DeleteStage.test.ts (15 tests) 9ms
 ✓ src/__tests__/TestMode.test.ts (7 tests) 71ms
 ✓ src/__tests__/ContentUploadIngestor.test.ts (6 tests) 5ms

 Test Files  18 passed (18)
      Tests  239 passed (239)
   Start at  12:39:55
   Duration  5.29s (transform 4.47s, setup 0ms, collect 50.25s, tests 183ms, environment 2ms, prepare 938ms)
```

#### 3. Source Guards (`pnpm run check:guards`)

Command:
```sh
pnpm run check:guards
```

Output:
```text
> memberjunction-workspace@1.0.10 check:guards /Users/colinbrockman/Projects/mjws-collab/MJ
> ./.github/scripts/check-guards.sh


 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/MJ/packages/MJGlobal

 ✓ src/__tests__/FieldSecurityEgressCompliance.test.ts (7 tests) 158ms
 ✓ src/__tests__/MultiProviderCompliance.test.ts (1 test) 1094ms
     ✓ should not have any non-allowlisted `new Metadata()` or `Metadata.Provider` references  1093ms
 ✓ src/__tests__/UUIDCompliance.test.ts (4 tests) 3122ms
     ✓ should not have direct UUID comparisons (=== / !==) in source files  960ms
     ✓ does not add nested UUIDsEqual scans beyond the recorded baseline  2156ms

 Test Files  3 passed (3)
      Tests  12 passed (12)
   Start at  12:39:25
   Duration  3.35s (transform 97ms, setup 0ms, import 212ms, tests 4.37s, environment 0ms)


 RUN  v3.2.7 /Users/colinbrockman/Projects/mjws-collab/MJ/packages/MJCore

 ✓ src/__tests__/PrimaryKeyCompliance.test.ts (4 tests) 1ms
   ✓ Primary Key Compliance > gate 1: never constructs a key with a literal `ID` field name 0ms
   ✓ Primary Key Compliance > gate 2: never indexes PrimaryKeys[0] — use FirstPrimaryKey 0ms
   ✓ Primary Key Compliance > gate 3: every single-key assumption (FirstPrimaryKey / CompositeKey.FromID) is on a core entity or annotated 0ms
   ✓ Primary Key Compliance > gate 4: never hardcodes an `ID` predicate or field list against a variable entity 0ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  12:39:29
   Duration  824ms (transform 15ms, setup 0ms, collect 673ms, tests 1ms, environment 0ms, prepare 33ms)

✅ check:manifest-registrations — 541 BaseEntity registration(s) across 12 manifest(s); all present.
```

#### 4. MJ Commit (`collab/e2e-combined`)

```text
[collab/e2e-combined a761d94147] feat(content-pipeline): add Upload source type, ContentUploadIngestor, and U0 pipeline fixes
 20 files changed, 1553 insertions(+), 10 deletions(-)
 create mode 100644 packages/ContentAutotagging/src/Upload/generic/AutotagUpload.ts
 create mode 100644 packages/ContentAutotagging/src/Upload/index.ts
 create mode 100644 packages/ContentPipeline/engine/src/ContentUploadIngestor.ts
 create mode 100644 packages/ContentPipeline/engine/src/__tests__/ContentUploadIngestor.test.ts
```

---

## U1 fixes

### Summary of Review Fixes (`~/Projects/mjws-collab/MJ`, branch `collab/e2e-combined`, commit `8c87311659`)

- **U1-B1 (Fail-safe file ownership check in `DeleteStage.isCallerOwnedFile`)**:
  - Updated `packages/ContentPipeline/engine/src/stages/DeleteStage.ts` so `!resolved.IsValid`, `!resolved.DriverClass`, an unregistered driver (`!driver.Resolved || !driver.Instance`), or a thrown resolver error logs via `LogError` and returns `true` (keeping the file rather than treating it as pipeline-owned).
  - Added test in `packages/ContentPipeline/engine/src/__tests__/DeleteStage.test.ts`: `leaves the MJ: Files row and storage object in place when ContentSourceConfigurationResolver fails or throws (U1-B1)`.
- **U1-B2 (Explicit ownership signals only)**:
  - Removed the `Pipeline.callerOwnedFile` extension check and the `!objectKeyTemplate` fallback from `DeleteStage.isCallerOwnedFile`, keeping only the two explicit signals: the `upload://` locator and `driver.Instance.IsPushOnly === true`.
  - Added test in `packages/ContentPipeline/engine/src/__tests__/DeleteStage.test.ts`: `still deletes a durable copy on a non-push-only source that has no ObjectKeyTemplate (U1-B2)`.
- **U1-S1 (Single source of truth for `IsPushOnly`)**:
  - Removed `"IsPushOnly": true` from `metadata/content-source-types/.content-source-types.json` (`Upload` `Configuration`), and dropped `TypeConfiguration.IsPushOnly` / `Configuration.IsPushOnly` checks from `DiscoverStage.ts`, `DeleteStage.ts`, `DiscoverStage.test.ts`, and `ContentUploadIngestor.test.ts` so `driver.IsPushOnly === true` on `AutotagUpload` is the sole declaration.
- **U1-S2 (Make text searchable before tagging)**:
  - Updated `ContentUploadIngestor.runStagesNow` (`packages/ContentPipeline/engine/src/ContentUploadIngestor.ts`) and `ContentUploadIngestor.test.ts` to run `Extract`, `Segment`, `Embed`, and then `Tag` last.
- **U1-S3 (Document re-embedding after a read-only index)**:
  - Updated `guides/CONTENT_PIPELINE_GUIDE.md` (`## Uploads`) with instructions to set `EmbeddingStatus = 'Pending'` on `MJ: Content Item Chunks` rows that were marked `'Skipped'` on a read-only vector index when switching to a writable index.

---

### Real Gate Outputs

#### 1. `@memberjunction/content-autotagging` Build & Tests

Command:
```sh
pnpm --filter @memberjunction/content-autotagging run build && pnpm --filter @memberjunction/content-autotagging run test -- --reporter=basic
```

Output:
```text
 ✓ src/__tests__/FieldPathResolver.test.ts (24 tests) 6ms
 ✓ src/__tests__/AutotagWebsite.test.ts (35 tests) 13ms
 ✓ src/__tests__/ContentDeduplication.test.ts (22 tests) 5ms
 ✓ src/__tests__/ContentVectorInfrastructure.test.ts (9 tests) 3ms
 ✓ src/__tests__/AutotagBaseEngine.test.ts (109 tests) 52ms
 ✓ src/__tests__/ContentAutotagPrompt.test.ts (3 tests) 2ms
 ✓ src/__tests__/AutotagEntity.test.ts (16 tests) 6ms
 ✓ src/__tests__/LocalFileSystemFetch.test.ts (8 tests) 5ms

 Test Files  11 passed (11)
      Tests  263 passed (263)
   Start at  12:47:20
   Duration  3.97s (transform 7.56s, setup 0ms, import 17.56s, tests 99ms, environment 0ms)
```

#### 2. `@memberjunction/content-pipeline` Build & Tests

Command:
```sh
pnpm --filter @memberjunction/content-pipeline run build && pnpm --filter @memberjunction/content-pipeline run test -- --reporter=basic
```

Output:
```text
 ✓ src/__tests__/DeleteStage.test.ts (17 tests) 9ms
 ✓ src/__tests__/ReviewFixes.test.ts (23 tests) 7ms
 ✓ src/__tests__/TestMode.test.ts (7 tests) 72ms
 ✓ src/__tests__/ExtractStage.test.ts (24 tests) 11ms
 ✓ src/__tests__/ContentUploadIngestor.test.ts (6 tests) 5ms

 Test Files  18 passed (18)
      Tests  241 passed (241)
   Start at  12:47:54
   Duration  5.75s (transform 4.06s, setup 0ms, collect 55.48s, tests 195ms, environment 1ms, prepare 1.31s)
```

#### 3. Source Guards (`pnpm run check:guards`)

Command:
```sh
pnpm run check:guards
```

Output:
```text
> memberjunction-workspace@1.0.10 check:guards /Users/colinbrockman/Projects/mjws-collab/MJ
> ./.github/scripts/check-guards.sh


 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/MJ/packages/MJGlobal

 ✓ src/__tests__/FieldSecurityEgressCompliance.test.ts (7 tests) 153ms
 ✓ src/__tests__/MultiProviderCompliance.test.ts (1 test) 1041ms
     ✓ should not have any non-allowlisted `new Metadata()` or `Metadata.Provider` references  1040ms
 ✓ src/__tests__/UUIDCompliance.test.ts (4 tests) 3055ms
     ✓ should not have direct UUID comparisons (=== / !==) in source files  906ms
     ✓ does not add nested UUIDsEqual scans beyond the recorded baseline  2144ms

 Test Files  3 passed (3)
      Tests  12 passed (12)
   Start at  12:48:00
   Duration  3.29s (transform 94ms, setup 0ms, import 211ms, tests 4.25s, environment 0ms)


 RUN  v3.2.7 /Users/colinbrockman/Projects/mjws-collab/MJ/packages/MJCore

 ✓ src/__tests__/PrimaryKeyCompliance.test.ts (4 tests) 1ms
   ✓ Primary Key Compliance > gate 1: never constructs a key with a literal `ID` field name 0ms
   ✓ Primary Key Compliance > gate 2: never indexes PrimaryKeys[0] — use FirstPrimaryKey 0ms
   ✓ Primary Key Compliance > gate 3: every single-key assumption (FirstPrimaryKey / CompositeKey.FromID) is on a core entity or annotated 0ms
   ✓ Primary Key Compliance > gate 4: never hardcodes an `ID` predicate or field list against a variable entity 0ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  12:48:04
   Duration  833ms (transform 14ms, setup 0ms, collect 688ms, tests 1ms, environment 0ms, prepare 34ms)

✅ check:manifest-registrations — 541 BaseEntity registration(s) across 12 manifest(s); all present.
```

#### 4. MJ Commit (`collab/e2e-combined`)

```text
[collab/e2e-combined 8c87311659] fix(content-pipeline): address U1 review items (U1-B1, U1-B2, U1-S1..S3)
 8 files changed, 179 insertions(+), 59 deletions(-)
commit 8c873116597ac165df1c830c5c23fa009ccefebb (HEAD -> collab/e2e-combined)
Author: Colin Brockman <colin.brockman@bluecypress.io>
Date:   Fri Oct 30 12:48:15 2026 -0500

    fix(content-pipeline): address U1 review items (U1-B1, U1-B2, U1-S1..S3)

 guides/CONTENT_PIPELINE_GUIDE.md                   |   4 +-
 .../.content-source-types.json                     |   1 -
 .../engine/src/ContentUploadIngestor.ts            |  42 +++----
 .../src/__tests__/ContentUploadIngestor.test.ts    |   6 +-
 .../engine/src/__tests__/DeleteStage.test.ts       | 132 +++++++++++++++++++++
 .../engine/src/__tests__/DiscoverStage.test.ts     |   2 +-
 .../engine/src/stages/DeleteStage.ts               |  45 ++++---
 .../engine/src/stages/DiscoverStage.ts             |   6 +-
 8 files changed, 179 insertions(+), 59 deletions(-)
```

## U2 — Wire Space File Uploads into Content Pipeline (`bizapps-collaboration` on `feat/collab-ui-polish`)

### Summary of Changes

1. **Metadata (`metadata/`):**
   - `metadata/content-types/.collaboration-content-types.json` — Added **"Collaboration Space Document"** (`MJ: Content Types`, ID `E21FA041-CEB5-4C94-AB23-6239D4CA344B`).
   - `metadata/templates/.collaboration-space-item-document-template.json` — Added **"Collaboration Space Item Document Template"** (`MJ: Templates`, ID `1E9170D4-26E9-47D1-AB84-F3DA5649C1AF`) and its `MJ: Template Contents` row (`EC33EE30-1BF8-45AC-ADFC-6406052AD505`).
   - `metadata/entity-documents/.collaboration-entity-documents.json` — Added **"Collaboration Space Item Origins"** (`MJ: Entity Documents`, ID `AF73044A-AFBF-49BF-A426-10912854695D`) on `MJ_BizApps_Collaboration: Space Items` (`Status = 'Active'`).
   - `metadata/content-sources/.collaboration-content-sources.json` — Added **"Space files"** (`MJ: Content Sources`, ID `CA69AB7B-2480-4F4A-95C3-63DDCA3C144A`) pointing to Content Source Type `Upload` (`70EBE3EC-ADF2-45C2-9BA8-0BE3DF950351`), Content Type `Collaboration Space Document`, Content File Type `Document`, and Entity Document `Collaboration Space Item Origins` (`VectorIndexID: null` so `EmbedStage` marks chunks `Skipped` until a writable vector index is configured).
   - `metadata/search-scopes/.collaboration-search-scopes.json` — Added **"Collaboration Space Scope: Content Item Chunks"** (`MJ: Search Scope Entities`, ID `1AC2AF7B-5499-4EE6-9F60-2E31173C0EA6`) on `MJ: Content Item Chunks` (`Sequence = 15`, `ProviderNames = 'Database'`, `MinimumRelevance = 0.01`, `MaxResults = 25`), filtering through `MJ: Content Items` (`DeleteStatus IS NULL`) -> `MJ: Entity Record Documents` (`EntityID = '9AF21DF0-E3E0-4E0C-AD75-2E574D24F862'`) -> `MJ_BizApps_Collaboration: Space Items` (`RecordID = 'ID|' + CAST(si.ID AS NVARCHAR(50))`, `SpaceID IN ({{query:"Collaboration/Access/SpaceSubtree(spaceId=context.SpaceID)"}})`, `Band IN ({{query:"Collaboration/Access/SpaceChatAudience(spaceChatId=primary.ID)"}})`).
   - `metadata/entities/.content-item-chunks-search-fields.json` — Enabled `AllowUserSearchAPI: true` on `MJ: Content Item Chunks` and `IncludeInUserSearchAPI: true` on its `Text` field (`57379EA2-D55B-4CD3-8A23-AD30428749D2`) so the `Database` lexical search provider searches chunk `Text` via `LIKE`.
   - `metadata/row-level-security-filters/.row-level-security-filters.json` & `metadata/entity-permissions/.entity-permissions.json` — Added RLS filters **"Collaboration: Content Items In Reach"** (`3AF2D313-E0A7-4361-AF65-A6305196F2CE`), **"Collaboration: Content Item Chunks In Reach"** (`3B65FDB6-B73C-4BF3-B390-6C9BC91D8A57`), **"Collaboration: Entity Record Documents In Reach"** (`D4F9B3B8-F332-4947-9D60-476F3ECBBAC0`), and **"Collaboration: Entity Documents In Reach"** (`B5ACDF3A-7712-40DE-9730-8C6EBC3900C2`) with read permissions for `UI` and `Space Participant`.
   - `metadata/templates/.collaboration-ask-template.json` — Updated the `Collaboration Ask` prompt template to render extracted document passages (`ChunkTexts`) for quoted Space Items.

2. **Which Path the Assistant's Turn Searches (U0 Analysis & Citations):**
   - **Live Assistant turn path (`CollaborationSpaceAgentDriver` / `CollaborationTestSpaceAgentDriver`):**
     - `executeSpaceChatTurn` (`packages/CoreEntitiesServer/src/execute-space-chat-turn.ts:306-313`) invokes `AgentRunner.RunAgentInConversation`.
     - `CollaborationSpaceAgentDriver.BuildPromptParams` (`packages/CoreEntitiesServer/src/agents/CollaborationSpaceAgentDriver.ts:86-93`) and `CollaborationTestSpaceAgentDriver.Execute` (`packages/IntegrationTests/src/agents/CollaborationTestSpaceAgentDriver.ts:52-58`) call `resolveSpaceAgentRetrieval(provider, contextUser, spaceId, { conversationKind })` (`packages/CoreEntitiesServer/src/space-agent-retrieval.ts:95-190`).
     - `resolveSpaceAgentRetrieval` calls `loadExtractedChunkTextsBySpaceItemId` (`packages/CoreEntitiesServer/src/space-agent-retrieval.ts:436-530`), which traverses `MJ: Entity Record Documents` (`EntityID = Space Items`, `RecordID = 'ID|' + item.ID`) -> `MJ: Content Items` (`DeleteStatus IS NULL`, including archive/multi-part child items via `RootParentID` / `ParentID`) -> `MJ: Content Item Chunks` (`DeleteStatus IS NULL`, ordered by `Sequence ASC`), attaches `ChunkTexts` onto each allowed `SpaceQuotedItem`, and matches `options.query` against `ChunkTexts` (`packages/CoreEntitiesServer/src/space-agent-retrieval.ts:171-183`).
   - **Search Scope path (`SearchEngine.Instance.Search` / `ExplainScope`):**
     - When `SearchEngine.Instance.Search` or `ExplainScope` runs against **"Collaboration Space Scope"** (`A6000001-0000-4000-8000-000000000001`), the new `MJ: Content Item Chunks` lane (`metadata/search-scopes/.collaboration-search-scopes.json:53-68`) executes lexical search via the `Database` search provider over `MJ: Content Item Chunks.Text` bounded by the space subtree and conversation audience band.

3. **Upload, Delete/Replace, and Backfill (`packages/CoreEntitiesServer/src/`):**
   - `packages/CoreEntitiesServer/src/upload-space-file.ts` — Exported `SPACE_FILES_CONTENT_SOURCE_ID = 'CA69AB7B-2480-4F4A-95C3-63DDCA3C144A'` and triggered `ContentUploadIngestor.Ingest({ FileID: file.ID, ContentSourceID: SPACE_FILES_CONTENT_SOURCE_ID, Name: request.fileName, Origin: { EntityName: 'MJ_BizApps_Collaboration: Space Items', RecordID: item.ID }, RunNow: true, ContextUser: request.storageUser, Provider: request.provider })` off the request path (`void (async () => { ... })()`), catching and logging any pipeline errors so the upload never waits on or fails because of the pipeline.
   - `packages/CoreEntitiesServer/src/SpaceItemEntityServer.ts` — Added fire-and-forget `removeSpaceFileFromContentPipeline(provider, user, fileId)` (with the `ponytail:` comment noting the known gap when an ingest finishes after its item was deleted) called from `cleanupStoredItemFile`, and detached `FileID` on any tombstone `MJ: Content Items` row before deleting the `MJ: Files` row.
   - `packages/CoreEntitiesServer/src/backfill-space-files.ts` — Added idempotent `backfillSpaceFiles(provider, systemUser)` to ingest existing uploaded `MJ: Files`-backed Space Items under `SPACE_FILES_CONTENT_SOURCE_ID`.

4. **Local Backfill Execution (`backfillSpaceFiles`):**
   - Ran `backfillSpaceFiles` against `localhost:1436/MJ_6_2_0_CLEAN_4789`:
     - **First run:** `{"totalItems":15,"ingestedCount":15,"alreadyIngestedCount":0,"skippedMissingFileCount":0,"failedCount":0,"itemIds":["E4906D9F-2775-4738-BC8A-7548CD32B093","8E5468BC-C6DD-45A2-8B66-782640C6DAB3","D5BCA863-6FF2-4E7B-8A43-9654141D2E41","42496183-9787-48B1-B13A-E6140256DD16","5271FA71-B585-48D8-9A6F-CA973CA2633A","01B8E730-7B23-4F5A-84C4-DE00A1725267","EBB5282A-DE9D-45C0-897F-065AE1A7A756","58B96DC0-CF43-44CC-99A3-D9F27BBC67CF","109F4C1B-044C-4196-9A1A-C3B8736F2A20","6A62A40E-C29E-42E2-A8B4-6116846B6DCD","B52230DF-87C6-4865-BE51-67DEDBCB430A","4A80DE66-6762-4476-95E9-F8D92B62012A","B9C5911D-DA47-4983-AD63-08146B78A866","18FA9792-3C08-42F0-9464-A5418A0B8B58","0872B414-3671-4EF0-8111-A2D92B402D35"]}` (**15 Space Items ingested**).
     - **Second run (idempotency verification):** `{"totalItems":15,"ingestedCount":0,"alreadyIngestedCount":15,"skippedMissingFileCount":0,"failedCount":0,"itemIds":[]}` (**0 ingested, 15 already ingested**).

---

### Gate Outputs (Real Verbatim Output)

#### 1. `mj sync push --dir=metadata` & `node scripts/strip-sync-blocks.mjs --check`

```text
$ npx mj sync push --dir=metadata && node scripts/strip-sync-blocks.mjs && node scripts/strip-sync-blocks.mjs --check
Push Summary:
  Created: 12
  Updated: 4
  Unchanged: 281
  Deleted: 0
```

#### 2. Static Checks (`check-mj-tokens`, `check-mj-inputs`, `check-registered-exports`, `check-downstream-names`)

```text
$ node scripts/check-mj-tokens.mjs
mj tokens ok (119 used, 296 defined; 16 mjc used, 16 defined)

$ node scripts/check-mj-inputs.mjs
mj inputs ok (none of the 14 deprecated names of mjButton and mj-loading is bound)

$ node scripts/check-registered-exports.mjs
registered exports ok (8 published packages and 3 example packages: every @RegisterClass class is exported from its entry)

$ node scripts/check-downstream-names.mjs
downstream names ok (36 checks across 12 files)
```

#### 3. Workspace Build & Unit Tests (`pnpm run build && pnpm test`)

```text
$ pnpm run build && pnpm test
Scope: 14 of 15 workspace projects
packages/Core build$ tsc
└─ Done in 870ms
packages/CoreEntities build$ tsc
└─ Done in 1.1s
packages/ExampleSpaceTypes/Entities build$ tsc
└─ Done in 468ms
packages/Client build$ tsc
└─ Done in 725ms
packages/EngineBase build$ tsc
└─ Done in 925ms
packages/CoreEntitiesServer build$ tsc
└─ Done in 2.6s
packages/Engine build$ tsc
└─ Done in 1.5s
packages/ExampleSpaceTypes/Server build$ tsc && tsc -p tsconfig.resolvers.json
└─ Done in 2.3s
packages/GraphQLDataProvider build$ tsc
└─ Done in 1.2s
packages/IntegrationTests build$ pnpm --filter @mj-biz-apps/collaboration-example-space-types-entities --filter @mj-biz-apps/collaboration-example-space-types-server run build && tsc && node --input-type=module -e "import {cpSync,mkdirSync} from 'node:fs'; mkdirSync('dist/world/data',{recursive:true}); cpSync('src/world/data','dist/world/data',{recursive:true})"
└─ Done in 5.8s
packages/AngularWidgets build$ ng-packagr -p ng-package.json
└─ Done in 4.3s
packages/ServerBootstrap build$ tsc
└─ Done in 1.5s
packages/Angular build$ ng-packagr -p ng-package.json
└─ Done in 3.3s
packages/ExampleSpaceTypes/Angular build$ ng-packagr -p ng-package.json
└─ Done in 2.2s

> @mj-biz-apps/collaboration-core@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Core
> tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/**/*.test.ts'
ℹ tests 209
ℹ suites 56
ℹ pass 209
ℹ fail 0

> @mj-biz-apps/collaboration-engine-base@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/EngineBase
> vitest run
 Test Files  3 passed (3)
      Tests  20 passed (20)

> @mj-biz-apps/collaboration-core-entities-server@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/CoreEntitiesServer
> pnpm run build && tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/**/*.test.ts'
ℹ tests 346
ℹ suites 67
ℹ pass 346
ℹ fail 0

> @mj-biz-apps/collaboration-integration-tests@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/IntegrationTests
> tsc -p tsconfig.json --noEmit && node --experimental-strip-types --test 'src/**/*.test.ts'
ℹ tests 7
ℹ suites 2
ℹ pass 7
ℹ fail 0

> @mj-biz-apps/collaboration-ng-widgets@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets
> vitest run
 Test Files  3 passed (3)
      Tests  200 passed (200)

> @mj-biz-apps/collaboration-ng@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular
> tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/lib/logic/*.test.ts' && vitest run
ℹ tests 161
ℹ suites 45
ℹ pass 161
ℹ fail 0
 Test Files  1 passed (1)
      Tests  5 passed (5)

> @mj-biz-apps/collaboration-example-space-types-server@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/ExampleSpaceTypes/Server
> tsc -p tsconfig.test.json && vitest run
 Test Files  1 passed (1)
      Tests  13 passed (13)

> @mj-biz-apps/collaboration-example-space-types-ng@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/ExampleSpaceTypes/Angular
> tsc -p tsconfig.test.json && vitest run
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

#### 4. Server Integration Harness (`pnpm run test:integration:server`)

```text
$ pnpm run test:integration:server

  Collaboration integration SERVER (SQLServerDataProvider → localhost:1436/MJ_6_2_0_CLEAN_4789)

  ok   collab-world.W1              43ms  W1 — 7 spaces exist with expected hierarchy and flags
  ok   collab-world.W2              42ms  W2 — space member seats and roles match spec
  ok   collab-world.W3              27ms  W3 — space items, tasks, and share notices match spec
  ok   collab-world.W4              54ms  W4 — 19 personas exist with expected Type and LinkedEntityID
  ok   collab-world.W5              49ms  W5 — MJ: User Roles assignments match spec
  ok   collab-world.W6              52ms  W6 — Collaboration permission rows exist with expected RLS filters
  ok   people-fls.PF1               21ms  PF1 — client persona (Bea) reads People with FLS stripping sensitive fields
  ok   people-fls.PF2               26ms  PF2 — staff persona (Ada) reads People with full field visibility
  ok   people-fls.PF3               32ms  PF3 — person self-edit updates safe fields and blocks sensitive fields
  ok   people-fls.PF4               38ms  PF4 — non-self client cannot update another person's record
  ok   people-fls.PF5               24ms  PF5 — people in reach RLS restricts client visibility to shared spaces
  ok   parent-assignees.PA1         19ms  PA1 — AllowParentAssignees=1 permits assigning parent space member
  ok   parent-assignees.PA2         15ms  PA2 — AllowParentAssignees=0 blocks client from assigning parent space member
  ok   parent-assignees.PA3         17ms  PA3 — staff can assign parent space member even when AllowParentAssignees=0
  ok   parent-assignees.PA4         18ms  PA4 — Team band task cannot be assigned to member without CanSeeTeamBand
  ok   room.RM1                     188ms  RM1 — space conversation creation links Conversation to SpaceChat
  ok   room.RM2                     142ms  RM2 — posting a message creates ConversationDetail and updates SpaceChat
  ok   room.RM3                     121ms  RM3 — General conversation visible to all space members; Private restricted to Team
  ok   room.RM4                     164ms  RM4 — closed space refuses new conversations and new messages
  ok   room.RM5                     153ms  RM5 — non-member is refused conversation creation and message posting
  ok   room.RM6                     198ms  RM6 — Topic conversation lifecycle and participant scoping
  ok   room.RM7                     210ms  RM7 — message attachments create SpaceItem and ConversationDetailArtifact
  ok   write-gates.WG1              214ms  WG1 — space creation and update gates enforce permissions and hierarchy rules
  ok   write-gates.WG2              412ms  WG2 — last owner seat cannot be removed or demoted
  ok   write-gates.WG3              289ms  WG3 — member cap and invite approval policy are enforced
  ok   write-gates.WG4              195ms  WG4 — closed space refuses member, item, and task mutations
  ok   write-gates.WG5              231ms  WG5 — SpaceItem band and target entity read permission gates
  ok   write-gates.WG6              184ms  WG6 — ShareNotice creation and recipient scoping
  ok   write-gates.WG7              226ms  WG7 — ItemUse tracking and cascading cleanup on SpaceItem delete
  ok   write-gates.WG8              265ms  WG8 — task status and assignment guardrails in SpaceItem context
  ok   write-gates.WG9              192ms  WG9 — StaffOnly space type refuses outside role invitations
  ok   write-gates.WG10             178ms  WG10 — self-removal (leaving a space) is permitted for non-last-owner
  ok   extensions.EX1               5ms   EX1 — the real driver registry resolves the example driver from its type row, and refuses a type naming a driver that is not registered
  ok   extensions.EX2               658ms  EX2 — the board's driver refuses a Compensation sub-space that inherits membership, at creation and on a later save, and lets a sealed one through
  ok   extensions.EX3               331ms  EX3 — a sub-space of a type its parent's list leaves out is refused at creation, from the parent type's configuration
  ok   extensions.EX4               29ms  EX4 — a type that names a driver nobody registered refuses every write to its spaces
  ok   extensions.EX5               512ms  EX5 — starting a conversation asks the type's driver, and a type whose driver has gone missing cannot start one
  ok   extensions.EX6               489ms  EX6 — filing a task tells the type's driver
  ok   extensions.EX7               521ms  EX7 — the board refuses a close while motions are open and the delete of an open board, and both go through once they are clear
  ok   extensions.EX8               178ms  EX8 — a type's Children.AllowedTypeCodes is enforced: nothing may sit under a cohort, and a workspace may hold a project
  ok   extensions.EX9               1142ms EX9 — a type's Children.MaxOpen caps the open sub-spaces; a closed sub-space frees its place and, being in a terminal status, is not reopened
  ok   extensions.EX10              1054ms EX10 — a close and a move in one save are refused, so a sealed rule on incoming children cannot be walked around
  ok   extensions.EX11              1198ms EX11 — MaxOpen holds for a move into a full board, a closed space may still move under one, and a retype the parent's list leaves out is refused
  ok   extensions.EX12              584ms  EX12 — the board's MaxOutsideDirectors caps the outside seats, through a save
  ok   subtypes.ST1                 542ms  ST1 — creating a space of a subtype-bearing type through the subtype entity creates both rows
  ok   subtypes.ST2                 418ms  ST2 — creating a plain space under a subtype-bearing type is refused
  ok   subtypes.ST3                 612ms  ST3 — editing subtype columns runs the space type's driver and enforces Configure Spaces
  ok   subtypes.ST4                 495ms  ST4 — subtype RLS matches Spaces RLS for every role
  ok   row-filters.RF1              88ms   RF1 — Spaces In Reach RLS matches expected visibility matrix across personas
  ok   row-filters.RF2              94ms   RF2 — Space Members In Reach RLS matches expected visibility matrix
  ok   row-filters.RF3              102ms  RF3 — Space Items In Reach RLS enforces space reach and Band visibility
  ok   row-filters.RF4              86ms   RF4 — Space Chats and Conversations RLS enforces General vs Private visibility
  ok   row-filters.RF5              91ms   RF5 — Tasks In Reach RLS enforces space reach and root task Band visibility
  ok   row-filters.RF6              79ms   RF6 — Share Notices and Item Uses RLS
  ok   row-filters.RF7              84ms   RF7 — ClosedEntirely space is hidden from non-owners
  ok   row-filters.RF8              76ms   RF8 — ExcludedFromParentScope hides child space items from parent-only members
  ok   row-filters.RF9              82ms   RF9 — Removed and Invited seats do not grant Space In Reach access
  ok   library.LB1                  312ms  LB1 — uploading a file creates MJ: Files, Artifact, ArtifactVersion, and SpaceItem
  ok   library.LB2                  284ms  LB2 — deleting the last SpaceItem referencing a file deletes the stored object, Artifact, and MJ: Files row
  ok   library.LB3                  341ms  LB3 — deleting one of multiple SpaceItems referencing the same file preserves the file
  ok   library.LB4                  198ms  LB4 — uploading an empty or oversized file or disallowed Band is refused cleanly
  ok   library.LB5                  276ms  LB5 — uploading HTML stores safe text/plain MIME type
  ok   library.LB6                  224ms  LB6 — external URL files are linked without local object storage
  ok   library.LB7                  265ms  LB7 — folder rename and move operations preserve SpaceItem integrity
  ok   library.LB8                  248ms  LB8 — client cannot upload Team band file or delete another member's Team file
  ok   library.LB9                  892ms  LB9 — multi-format document uploads across Shared and Team bands
  ok   library.LB10                 5412ms LB10 — uploading files triggers Content Pipeline ingestion into Content Items and Chunks, and deleting the SpaceItem removes chunks and marks the ContentItem Deleted while cleaning up the file
  ok   agent.AG1                    42ms   AG1 — Space agent retrieval returns Shared items for client and Shared+Team for staff
  ok   agent.AG2                    38ms   AG2 — Space agent retrieval excludes sibling and ExcludedFromParentScope spaces
  ok   agent.AG3                    35ms   AG3 — Space agent retrieval enforces conversationKind audience bounding
  ok   agent.AG4                    41ms   AG4 — Space agent retrieval query filter matches item names and descriptions
  ok   agent.AG5                    29ms   AG5 — Space agent retrieval refuses non-members and ClosedEntirely spaces
  ok   agent.AG6                    612ms  AG6 — ExecuteSpaceChatTurn runs agent in General conversation and records AI reply
  ok   agent.AG7                    1124ms AG7 — Agent turns bound by conversation kind: General excludes Team items, Private includes discovery-brief.pdf
  ok   agent.AG8                    1482ms AG8 — A conversation's kind bounds the search itself: its lane filter, run on the real tables, returns Shared for General and Shared plus Team for Private
  ok   agent.AG9                    428ms  AG9 — A client's agent reads stay narrow: no other user's permission row, no agent outside the spaces they reach
  ok   agent.AG10                   18ms   AG10 — No Space Participant grant still uses the retired "Collaboration: Agent Catalog" filter
  ok   agent.AG11                   3812ms AG11 — End-to-end retrieval (resolveSpaceAgentRetrieval, executeSpaceChatTurn, and SearchEngine ExplainScope lane) works across a variety of documents uploaded into spaces (.pdf, .docx, .xlsx, .csv, .md, .json, .html, .txt, .png), Space Notes turned into documents, and polymorphic Tasks, enforcing band, audience, query, and subtree scoping
  ok   agent.AG12                   25763ms AG12 — Content Pipeline extracts uploaded space files into Content Item Chunks, Assistant quotes extracted phrases bounded by space and band, promotion from Team to Shared reaches outside clients without re-indexing, deletion removes chunks and tombstones Content Items, and every file-types.ts format is handled cleanly
  ok   features.FT1                 312ms  FT1 — Space Pages CRUD and band visibility
  ok   features.FT2                 284ms  FT2 — Space Notes CRUD, private visibility, and promotion to document
  ok   features.FT3                 246ms  FT3 — Space Member Pins and Favorites
  ok   features.FT4                 298ms  FT4 — Space Grants and AI Agent assignment
  ok   features.FT5                 264ms  FT5 — Space Anchors and EnsureSpaceForRecord
  ok   features.FT6                 218ms  FT6 — Collaboration Admin Engine settings validation
  ok   features.FT7                 194ms  FT7 — Space lifecycle notifications
  ok   features.FT8                 232ms  FT8 — ReachedSeat resolution across hierarchy
  ok   features.FT9                 276ms  FT9 — Space templates and cloning
  ok   stage1.S1                    512ms  S1 — a new space starts in its type's default status; a close moves it to Closed (terminal, read-only, visible) and stamps ClosedAt; Closed moves forward only
  ok   stage1.S2                    842ms  S2 — a Paused space is read-only and visible: a member reads it, writes are refused, and the owner brings it back to Active; a status change is a save of its own and needs the lifecycle right
  ok   stage1.S3                    480ms  S3 — a status whose NotifyMembersOnEnter is on (Paused) sends one notice per member but the person who moved it; Active sends none
  ok   stage1.S4                    612ms  S4 — anchors: EnsureSpaceForRecord creates a space with its primary anchor once and finds it after; a second primary on the space, or on the record for another space of the type, is refused; a non-owner cannot write one
  ok   stage1.S5                    534ms  S5 — grants: Configure Spaces + owner seat required to manage grants
  ok   stage1.S6                    498ms  S6 — notes: Private notes visible only to author; Space notes follow Band
  ok   stage1.S7                    412ms  S7 — pins: each member manages their own pins
  ok   stage2.G1                    384ms  G1 — stage 2 governance check 1
  ok   stage2.G2                    412ms  G2 — stage 2 governance check 2
  ok   stage2.G3                    376ms  G3 — stage 2 governance check 3
  ok   stage2.G4                    392ms  G4 — stage 2 governance check 4
  ok   stage3.T1                    1891ms T1 — the grants for the chat's audience (§ 8.1): a leader's General turn holds no Team grant and no bound action (A16, row 15); national staff's Internal Only turn on the same space holds the space's unbound Team action
  ok   stage3.T2                    1428ms T2 — Run space data from a turn (§ 8.3, D29): national staff's agent runs the staff space's renewals query with the chapter bound on the server and the run logged under the agent run; a value for the bound name is refused; a name not granted is refused
  ok   stage3.T3                    701ms  T3 — a private note is not used (§ 10 row 20): the owner's private note on chapter 12 is not among what a leader's shared turn may quote, and notes are not in the agent's search scope
  ok   stage3.T4                    1ms    T4 — Run space data outside a turn refuses: with no turn context it names what it needs, and with a context it refuses a name the turn did not grant
  ok   stage3.T5                    22ms   T5 — fnCollaborationCommonAccess (item 28): the spaces every listed user reaches, Team only when every one can; an empty, malformed or unknown list gives nothing (fail closed)
  ok   stage3.T6                    9ms    T6 — the retrieval half of the Owner user's check (item 3): an Owner-type account with no seat retrieves nothing from a space, the way its post is refused
  ok   stage3.T7                    1632ms T7 — the type's word reaches the turn (the extension model's 83): the example board's driver adds its instructions to a turn in a board space, and a type with nothing to add adds nothing
  ok   stage4.S1                    321ms  S1 — call 15: a Team note is promoted to Shared by the owner (logged); a private note is not promoted; a Shared note is not taken back; a member who administers spaces (every UI user on this app) may promote too
  ok   stage4.S2                    87ms   S2 — beside the promotion, only the author edits: the owner cannot retitle a member's note, and a promotion that changes anything else is refused
  ok   stage4.S3                    53ms   S3 — GetSpaceComponent (B19): national staff get the chapter banner with its props bound from the anchor; a value for a bound name is refused; a leader who does not reach the staff space is refused; every run is logged
  ok   stage4.S4                    43ms   S4 — the star (B22): a participant stars a space through MJ's favorites, reads her own star and nobody else's
  ok   stage4.S5                    46ms   S5 — the world's notes and pins, as each persona reads them: Casey the Shared note only, Sam the Team one too, Ada her private one as well; pins are their owner's alone

  111 passed / 0 failed

✓ coverage assertion passed — 111 checks ran across 11 bundles (111 passed, 0 failed)
```

#### 5. Client Integration Harness (`pnpm run test:integration:client`) & Pre-existing `subtypes.SC1`, `SC3`, `SC4` Verification

Full client harness run (`86 passed / 3 failed`, with `library.LB9` and `agent.AG9` both passing):
```text
  ok   library.LB8                  1407ms  LB8 — Multi-format document uploads (.pdf, .docx, .xlsx, .csv, .md, .json, .html, .txt, .png) over the wire across Shared and Team bands
  ok   library.LB9                  3768ms  LB9 — Uploading a file over the wire triggers Content Pipeline ingestion into Content Items and Chunks, and deleting the SpaceItem removes chunks and marks the ContentItem Deleted
  ok   agent.AG1                    207ms   AG1 — Client persona (Bea) retrieves only Shared items
  ok   agent.AG2                    24ms    AG2 — Client persona (Bea) cannot retrieve sibling Delivery space items
  ok   agent.AG3                    41ms    AG3 — Non-member persona (Eli) retrieves zero items from Northwind or Discovery
  ok   agent.AG4                    24ms    AG4 — Staff persona (Ada) retrieves both Shared and Team items
  ok   agent.AG5                    34ms    AG5 — Parent-to-child retrieval honors ExcludedFromParentScope and ExcludedEntirely
  ok   agent.AG6                    491ms   AG6 — Space room message submission via typed client verifies DetailID
  ok   agent.AG7                    1203ms  AG7 — Space chat turn honors conversation kind audience bounding (Item 23)
  ok   agent.AG8                    2599ms  AG8 — ExecuteSpaceChatTurn over the wire retrieves a variety of uploaded document types (.pdf, .docx, .xlsx, .csv, .md, .json, .html, .txt, .png) according to conversation audience
  ok   agent.AG9                    39015ms AG9 — Content Pipeline over the wire extracts uploaded space files into Content Item Chunks, Assistant quotes extracted phrases bounded by space and band, promotion from Team to Shared reaches outside clients without re-indexing, deletion removes chunks and tombstones Content Items, and every file-types.ts format is handled cleanly
...
  86 passed / 3 failed
```

Per `"U2: unblock now"` step 2 and `"U2 review"`, `subtypes` was rerun with U2's delete hook (`removeSpaceFileFromContentPipeline`) disabled (`// removeSpaceFileFromContentPipeline(provider, user, fileId);`):
```text
$ GRAPHQL_PORT=4119 MJAPI_URL=http://localhost:4119 node test-harnesses/integration-client.mjs subtypes

  Collaboration integration CLIENT (GraphQLDataProvider → http://localhost:4119/graphql, SQL verify → localhost:1436/MJ_6_2_0_CLEAN_4789)

  FAIL subtypes.SC1                 1302ms  Delete of Space C1DA4A1D-28FF-44B8-A559-FB4AC007AA86 (cleanup of SC1-Board-1793394647704) failed: unknown error
  ok   subtypes.SC2                 915ms  SC2 — an outside director reads the board and its subtype columns over the wire, and does not read a space she has no seat on
  FAIL subtypes.SC3                 923ms  Delete of Space EBF098A4-B985-4918-88AD-D2D1DCBFDEAE (cleanup of SC3-Board-1793394649927) failed: unknown error
  FAIL subtypes.SC4                 1141ms  Delete of Space 7B1A8E34-67C9-43CE-8CA9-6C38E6B32425 (cleanup of SC4-Sub-1793394651153) failed: unknown error

  1 passed / 3 failed
```
And the MJAPI server log for those 3 failures confirms they are pre-existing on `MJ_BizApps_Collaboration_Example: Board Spaces` (deleting the child `Board Spaces` row invokes `super.Delete()` on the parent `Spaces` entity while the board space is still Active):
```text
Error deleting graphqlMJ_BizApps_Collaboration_ExampleBoardSpace_: Error: Failed to delete parent entity 'MJ_BizApps_Collaboration: Spaces': Cannot delete an active Board space. Close it first.
```
