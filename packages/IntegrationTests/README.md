# @mj-biz-apps/collaboration-integration-tests

Collaboration's cross-stack integration checks and the deterministic real-world sample dataset (`COLLAB-WORLD` + Cross-Stack Enterprise World) they execute against.

- **Private.** Never published, and `mj-app.json` does not list it.
- **Layer:** `runtime`.
- **Depends on:** Collaboration's `core`, `entities`, `engine-base`, and `core-entities-server` packages, and the example types' `-entities` and `-server` packages from the workspace; MJ's `core`, `core-entities`, `global`, `generic-database-provider`, `graphql-dataprovider`, `sqlserver-dataprovider`, `api-keys`, `storage`, `testing-integration`, `ai-agents`, `ai-core-plus`, `ai-engine-base`, and `search-engine`; `bizapps-common`'s and `bizapps-tasks`' entity packages; and `mssql`.

## Check bundles

Each check registers on MJ's `IntegrationCheckRegistry`, and each bundle registers a `Setup` and a `Teardown`. A `Teardown` removes everything its checks created and fails the run if any row remains behind.

| Bundle | Server checks | Client checks | What it covers |
|---|---|---|---|
| `collab-world` | 4 | 4 | Base catalog spaces, seats, items, and Sage agent grant (`CW1`–`CW4`) |
| `people-fls` | 3 | 3 | `MJ_BizApps_Common: People` field-level security allow-list for `Space Participant` (`FLS1`–`FLS3`) |
| `parent-assignees` | 6 | 6 | Assigning people seated above a space with `AllowParentAssignees` on and off |
| `room` | 12 | 11 | Space conversations: reading, starting, posting, agent replies, close/reopen |
| `write-gates` | 10 | 8 | Write gates on spaces, seats, items, share notices, item uses, invitations, and retyping |
| `extensions` | 12 | none | Example space type server drivers and `Children` rules (`EX1`–`EX12`) |
| `subtypes` | 7 | 4 | IsA child subtype spaces (`ExampleBoard`), `CreateSpace`, `EnsureISAChild`, and quorum rules |
| `row-filters` | 6 | 4 | Persona row-level security isolation across spaces, items, files, indexed chunks, and chats |
| `library` | 7 | 9 | Seeded library items, uploads, content pipeline ingestion, and deletes |
| `agent` | 17 | 10 | Bounded agent retrieval, search scopes, source receipts, and stub agent turns |
| `features` | 5 | 5 | Space styling, tasks as items, message history, and nesting |
| `lifecycle` | none | 6 | Close/archive visibility, `GetCloseConsequence`, Home counts/lists, and participant query guards |
| `stage1` | 11 | 8 | Statuses, anchors, grants, notes, pins, staff-only types, and retype anchor migration |
| `stage2` | 5 | 4 | DataReach generated RLS filters, allow-listed columns, and chapter views/queries |
| `stage3` | 7 | 3 | Audience-cut turn tools, `RunSpaceData`, and common-reach checks |
| `stage4` | 5 | 4 | Note promotion + audit logging, author-only edits, `GetSpaceComponent`, favorites, and pins |
| `space-meetings` | 2 | 2 | Space meetings creation, attendee sync, and meeting chats |
| `adversarial-persona` | 7 | 6 | Adversarial disclosure probes across personas, AI run lockdown, and multi-role confinement |
| `cross-stack-enterprise` | 6 | 4 | Full `MJ Core` → `bizapps-common` → `bizapps-tasks` → `bizapps-collaboration` real-world multi-org enterprise lifecycle, `EnsureSpaceForRecord` subtyped concurrency/idempotency, dual-band `Docs` + `APPROVAL_REQUEST` `Task`/`TaskLink`/`TaskDecision` promotion, sealed subspace revocation, and adversarial multi-org isolation (`CE1`–`CE6` / `CEC1`–`CEC4`) |
| `round2-substrate` | 6 | 3 | Live SQL Server & GraphQL verification of Round-2 Collaboration v1 Substrate: `CollaborationChatWritePermissionProvider` (`Chats.WhoCanWrite` + `Paused` lockdown), live `fnCollaborationChatScope` TVF (`StructuralChatScope`), hierarchical `SpaceType -> Root -> Space` Scoped Prompt Parts, `SupportsAudience` bound action grants & anti-spoofing, O(1) fan-out-on-read `Space Notices` + per-persona watermarks, Comms v2 notification routing, and reach-verified idempotent scoped digests (`R2_1`–`R2_6` / `R2C1`–`R2C3`) |

- **Server bundles** (`src/checks/`, entry `src/index.ts`, **138 checks across 19 bundles**) run in-process over `SQLServerDataProvider` with Collaboration's server classes and Round-2 substrate providers loaded.
- **Client bundles** (`src/checks/client/`, entry `src/client-index.ts`, exported as `./client`, **114 checks across 19 bundles**) run over GraphQL without loading any `*Server` package. `src/persona-provider.ts` signs in as each persona using minted per-persona user API keys.
- `src/expected-bundles.ts` holds the single source of truth for expected bundle check counts, enforced by `scripts/assert-check-count.mjs`, `registry-parity.test.ts`, and `client-parity.test.ts`.
- `src/agents/` registers **Space Chat Test Stub** so agent turn checks require no external LLM key.

## Cross-Stack World Architecture

`load-world.ts` loads two layered, idempotent, deterministic worlds through the real entity gates and server services, and `purge-world.ts` cleanly reverses every seeded row in strict FK-safe order (while keeping base `MJ: Users` accounts):

### 1. Base Catalog (`COLLAB-WORLD`, `src/world/data/*.csv`)
- 16 personas (`personas.csv`), 19 spaces (`spaces.csv`), 35 seats (`members.csv`), 15 files (`files.csv`), notes (`notes.csv`), pins (`pins.csv`), anchors (`anchors.csv`), example chapters (`chapters.csv`, `chapter-members.csv`), one agent grant (`Sage` on Northwind), and task plans (`seed-plan.ts`).

### 2. Cross-Stack Enterprise World (`src/world/enterprise-ids.ts`, `src/world/seed-enterprise-world.ts`)

Establishes a realistic three-organization consulting/client topology spanning all four stack layers:

| Stack Layer | Seeded Entities & Records |
|---|---|
| **MJ Core** | Mirrored `MJ: Companies` (`Meridian Advisory Group`, `Northstar Manufacturing Corp`, `Solstice Logistics Ltd`), `MJ: Artifacts` & `MJ: Artifact Versions` (Markdown Docs), `MJ: Conversations` & `MJ: Conversation Details` |
| **`bizapps-common`** | Three `Organizations` linked via `LinkedCompanyID`, active Person-to-Organization `Relationships` with job titles, and primary work email `Contact Methods` |
| **`bizapps-tasks`** | Multi-level `Tasks` hierarchies (`Northstar ERP Modernization Program` → `Phase 1 Cutover Readiness` → `Warehouse Integration Sign-Off`; `Solstice Fleet Telemetry Rollout` → `Cold-Chain Sensor Calibration`), `OrganizationID` scoping, `Task Assignments`, and polymorphic `Task Links` to Collaboration Spaces & Common Organizations |
| **`bizapps-collaboration`** | Record-bound spaces created via `EnsureSpaceForRecord` (`Northstar ERP Modernization Hub`, child `Northstar Phase 1 Cutover`, rival `Solstice Fleet Telemetry Hub`), dual-band `General` (`Shared`) & `Private` (`Team`) chats, dual-band `Docs` (`Team` internal memo vs. `Shared` deliverables), and fan-out-on-read `Space Notice Events` |

#### Seeded Enterprise Personas & Isolation Matrix

| Persona | Organization (`bizapps-common`) | Role / Title | Collaboration Posture | Isolation Guarantee |
|---|---|---|---|---|
| `ada` | Meridian Advisory Group (Internal) | Engagement Owner (`UI`) | Northstar Hub `owner` (`Team`) | Full `Team` + `Shared` access on Northstar; `0` rows on Solstice structural scope |
| `sam` | Meridian Advisory Group (Internal) | Delivery Contributor (`UI`) | Northstar Hub `member` (`Team`) | Authors `Team` drafts & approval tasks; reads `Team` + `Shared` notices & digests |
| `dev` | Meridian Advisory Group (Internal) | Engagement Approver (`Developer`) | Northstar Hub `owner` (`Team`) | Holds `Configure Spaces`; approves & promotes `Team` drafts to `Shared` |
| `casey` | Northstar Manufacturing Corp (Client A) | Client Sponsor (`Space Participant`) | Northstar Hub `client-admin` (`Shared`) | Reads Northstar `Shared` only; `0` Team drafts/chats/notices; `0` Solstice rows |
| `bea` | Northstar Manufacturing Corp (Client A) | Operations Lead (`Space Participant`) | Northstar Hub `client-member` (`Shared`) | Reads Northstar `Shared` only; unlocks promoted Docs after approval; `0` Solstice rows |
| `harbor` | Meridian Advisory Group (Internal) | Logistics Account Lead (`UI`) | Solstice Hub `owner` (`Team`) | Owns Solstice Hub; isolated from Northstar |
| `harper` | Solstice Logistics Ltd (Rival Client B) | Logistics Director (`Space Participant`) | Solstice Hub `client-member` (`Shared`) | Reads Solstice `Shared` only; **ZERO** Northstar spaces, docs, tasks, chats, notices, anchors, or digests |

## Build and test

```bash
# Build IntegrationTests (and example space types)
pnpm --filter @mj-biz-apps/collaboration-integration-tests run build

# Run unit, parity, cleanup-reporting, and purge-SQL ordering tests (Vitest)
pnpm --filter @mj-biz-apps/collaboration-integration-tests test
```

## Running the live integration harnesses

Both harnesses require an isolated database bootstrapped with MJ Core, `bizapps-common` (with `EnableFieldLevelSecurity` on `People`), `bizapps-tasks`, Collaboration migrations + metadata, example space types + test metadata, and the world loaded (see [`docs/building-the-database.md`](../../docs/building-the-database.md)). Never run against a shared live application database.

```bash
# Purge and load the deterministic world (base + cross-stack enterprise)
pnpm --filter @mj-biz-apps/collaboration-integration-tests run purge
pnpm --filter @mj-biz-apps/collaboration-integration-tests run load

# Run every server bundle + check-count assertion (138 checks across 19 bundles)
pnpm run test:integration:server

# Run a single server bundle (e.g., cross-stack or Round-2 substrate)
node test-harnesses/integration.mjs cross-stack-enterprise
node test-harnesses/integration.mjs round2-substrate

# Run every client bundle over GraphQL + check-count assertion (114 checks across 19 bundles)
# Requires a running MJAPI pointed at the same isolated database with MJ_API_KEY and MJAPI_URL
pnpm run test:integration:client

# Run both suites
pnpm run test:integration
```
