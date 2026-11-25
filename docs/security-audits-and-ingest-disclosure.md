# Security Audits, Persona Probe, and Upload Ingest Disclosure

This document describes the security governance audits, transactional cross-surface persona probe, and upload ingest model disclosure shipped for **BizApps Collaboration**.

All diagnostics, operations, and UI surfaces use 100% generic, domain-neutral terminology and MemberJunction's declarative authorization and row-level security primitives.

---

## 1. Server-Side Execution & Authorization Model

Every security audit and persona probe is exposed through a `@RegisterClass(BaseRemotableOperation, ...)` subclass in `@mj-biz-apps/collaboration-engine-base`, retained at startup by `LoadCollaborationSecurityAuditOperations()` (invoked by `LoadBizAppsCollaborationServer()`), and delegated from `CollaborationEngine.Instance`:

| Capability | Operation Key | Operation Class | `CollaborationEngine` Method |
|---|---|---|---|
| **XS-1** Space Participant Role Audit | `Collaboration.SpaceParticipantRoleAudit` | `SpaceParticipantRoleAuditOperation` | `RunSpaceParticipantRoleAudit(input, contextUser, provider)` |
| **XS-7** Staff Role Audit | `Collaboration.StaffRoleAudit` | `StaffRoleAuditOperation` | `RunStaffRoleAudit(input, contextUser, provider)` |
| **XS-2** Boot Entity Grant Filter Inventory | `Collaboration.BootEntityGrantInventory` | `BootEntityGrantInventoryOperation` | `RunBootEntityGrantInventory(input, contextUser, provider)` |
| **XS-3** Cross-Surface Persona Security Probe | `Collaboration.PersonaSecurityProbe` | `PersonaSecurityProbeOperation` | `RunPersonaSecurityProbe(input, contextUser, provider)` |

### Caller Authorization Gate (`authorizeSecurityAuditCaller`)

Before running any audit or probe:
1. Requires an authenticated `UserInfo` with a valid UUID.
2. Rejects Magic Link sessions (`IsMagicLinkAnonymous` or `MagicLinkScope`).
3. Rejects users holding the external `Space Participant` role (`PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B'`, checked strictly by `RoleID`, never by role name).
4. Verifies the caller holds either `Administer Spaces` or `Configure Space Types` under the `Collaboration` root authorization (`CollaborationEngineBase.Instance.UserMayAdministerSpaces` / `UserCanConfigureSpaceTypes`).

Unauthorized callers receive a deterministic `RemoteOperationError` (`FORBIDDEN`) before any audit or probe query runs.

---

## 2. XS-1: Space Participant Role Audit (`space-participant-role-audit.ts`)

Audits active `SpaceMember` rows, `SpaceRoleType` capabilities, user accounts, space boundaries, and polymorphic entity foreign keys:

- **Batched Keyset Reads**: Uses `readEverySimpleRow` (`RunView` with `ResultType: 'simple'`, `OrderBy: 'ID ASC'`, `AfterKey`) and `chunkDistinctIds` + `buildBatchedInFilter` (dual-dialect `[Col]` for SQL Server and `"Col"` for PostgreSQL).
- **Polymorphic FK Resolution via Metadata**: Resolves polymorphic entity targets strictly via `EntityField.EntityIDFieldName` metadata (`SpaceAnchors`, `SpaceGrants`, `SpaceItems`, `SpaceMemberPins`, `SpaceAgentSourceReceipts`) rather than hardcoded column-name assumptions.
- **Finding Codes**:
  - `ELEVATED_EXTERNAL_ROLE`
  - `EXTERNAL_TEAM_BAND_EXPOSURE`
  - `EXTERNAL_ON_STAFF_ONLY_SPACE`
  - `CROSS_SPACE_ROLE_LEAK`
  - `EXTERNAL_SPACE_OWNER`
  - `BAND_ROLE_MISMATCH`
  - `INVALID_SPACE_BINDING` / `ORPHANED_SPACE_BINDING`
  - `INACTIVE_MEMBER_ACCOUNT` / `INACTIVE_SPACE_ROLE_TYPE`
  - `INVALID_POLYMORPHIC_METADATA` / `INVALID_POLYMORPHIC_LINK` / `ORPHANED_POLYMORPHIC_LINK` / `CROSS_SPACE_POLYMORPHIC_LINK`

---

## 3. XS-7: Staff Role Audit (`staff-role-audit.ts`)

Audits MJ role bindings, application assignments, entity permissions, and Collaboration authorization grants:

- Verifies external `Space Participant` accounts (`PARTICIPANT_ROLE_ID`) do not overlap with staff roles, do not receive Collaboration staff authorizations (`Administer Spaces`, `Issue Space Invite Links`, `Configure Spaces`, `Configure Space Types`), and are never granted the root `Collaboration` authorization or excessive entity permissions.
- Audits high-privilege admin authorizations (`Administer Spaces`, `Configure Space Types`) against an explicit `AllowedAdminRoleIDs` allow-list when supplied.
- Detects `GLOBAL_ADMIN_ESCALATION`, `OVERLAPPING_EXTERNAL_STAFF_ROLE`, `PARTICIPANT_GRANTED_STAFF_AUTHORIZATION`, `ROOT_AUTHORIZATION_GRANTED`, `EXTERNAL_ROLE_ADMIN_APP_ACCESS`, `EXTERNAL_ROLE_EXCESSIVE_ENTITY_PERMISSION`, `INACTIVE_STAFF_ROLE_BINDING`, and `LEAST_PRIVILEGE_BOUNDARY_VIOLATION`.

---

## 4. XS-2: Boot Entity Grant Filter Inventory (`boot-entity-grant-inventory.ts`)

Enumerates `COLLABORATION_BOOT_ENTITY_REGISTRY` (100% of boot-loaded `CollaborationEngineBase` / `CollaborationAdminEngineBase` entities, all 14 `__mj_BizAppsCollaboration` schema entities, and cross-schema `ParticipantGrant` / `ExplorerShellBoot` entities) and verifies:

- Every Collaboration schema entity keeps `AllowAllRowsAPI = 0`.
- Every readable `Space Participant` entity permission carries a non-null, non-tautological (`1 = 1` / `TRUE`) `ReadRLSFilterID`, and every writable permission matches its `RequireWriteRlsWhenWritable` policy.
- Staff-only entities (`MJ: Authorizations`, `MJ: Authorization Roles`, `Space Grants`) are never readable by `Space Participant`.
- Shell boot entities (`MJ: Application Settings`) enforce deny-all (`1 = 0`) for external participants.
- `COLLABORATION_POLYMORPHIC_FK_SPECS` matches `EntityField.EntityIDFieldName` metadata across all five polymorphic Collaboration entities.

---

## 5. XS-3: Transactional Persona Security Probe (`persona-security-probe.ts`)

Implemented by `CollaborationPersonaSecurityProbe` (`@RegisterClass(BaseHealthProbe, 'BIZAPPS.COLLAB.LIVE.PERSONA_SECURITY_PROBE')`) and `CollaborationPersonaSecurityVerifier` (`@RegisterClass(BaseLiveCrudVerifier, 'BIZAPPS.COLLAB.LIVE.PERSONA_SECURITY_VERIFIER')`):

- **Rolled-Back Isolation**: Executes inside `WithRolledBackTransaction` (`provider.BeginEntityTransaction()` -> `try { ... } finally { await tx.Rollback() }`), guaranteeing zero persistent synthetic test data on pass, failure, or timeout. Supports both `synthetic` and `world-provided` fixture modes.
- **Bounded Execution**: Enforces `MaxRows` caps (`DEFAULT_PROBE_MAX_ROWS = 10`, `MAX_PROBE_ROW_CAP = 50`) and per-persona timeout budgets (`DEFAULT_PROBE_TIMEOUT_MS = 15000`).
- **Five Disclosure Surfaces Verified (`DISCLOSURE_SURFACES`)**:
  1. `all-views`: `RunView` sweeps with `ResultType: 'simple'` across Collaboration entities and `All...` catalog views.
  2. `run-query`: `RunQuery` execution sweeps for out-of-reach space data.
  3. `dataset`: `GetDatasetByName` sweeps across Collaboration datasets.
  4. `report`: Report execution sweeps for restricted/external personas.
  5. `direct-id-resolver`: Direct primary-key (`ID` / `CompositeKey`) lookups for out-of-space records (`Space B` vs `Space A`) and `Team`-band items.

---

## 6. XS-8: Upload Ingest Model Disclosure UI (`upload-ingest-disclosure.component.ts`)

`CollabUploadIngestDisclosureComponent` (`<mjc-upload-ingest-disclosure>`, also exported as `UploadIngestDisclosureComponent`) in `@mj-biz-apps/collaboration-ng-widgets` renders transparent, domain-neutral upload governance copy:

- **Where It Appears**:
  - Embedded inside `CollabUploadDialogComponent` (`<mjc-upload-dialog>`) above the submit actions so every contributor sees the active ingest, indexing, band visibility, and retention rules before uploading or linking a document.
  - Displayed inline in `CollabSpaceLibraryComponent` (`<mjc-space-library [ShowUploadDisclosure]="canAddHere">`) inside `CollaborationSectionResource` for users with upload/contribution permissions.
- **Four Disclosure Pillars**:
  1. **Ingest and storage**: Explains MemberJunction Storage persistence (`upload` mode) vs. URL-only reference recording (`link` mode), including the space's `MaxBytes` limit.
  2. **Extraction and indexing**: Explains Content Pipeline (`Space files` source) text extraction and chunking, reflecting the space's `AgentRetrieval` setting (`Included`, `ExcludedFromParentScope`, or `ExcludedEntirely`).
  3. **Participant visibility scope**: Dynamically reflects the selected band (`Shared`, `Team`, or `Space default band`) and explains who can view or cite the item.
  4. **Retention and removal boundaries**: Explains immediate revocation when a participant seat is removed and automatic chunk cleanup / content-item tombstoning when the last space item referencing an uploaded file is deleted.
- **Engineering Standards**:
  - `ChangeDetectionStrategy.OnPush`, strict TypeScript typing, keyboard-accessible native `<button type="button">` toggle with `aria-expanded` and `aria-controls`.
  - Sanitized plain text via `stripCitationMarkdown` with zero raw Markdown syntax in the rendered DOM.
  - Styled exclusively with semantic MemberJunction `--mj-*` and `--mjc-*` CSS custom properties (verified by `css-token-compliance.spec.ts` and `scripts/check-mj-tokens.mjs`).

---

## 7. Running Security Audits & Verification Suites

```bash
# Build all packages
pnpm run build

# Run static gates, unit tests, world-data-model security tests, and CSS token compliance
pnpm test

# Run Playwright visual verification (including XS-8 upload ingest disclosure in light & dark themes)
pnpm --filter @mj-biz-apps/collaboration-ux-gallery run build
pnpm run test:e2e

# Run world-model database persona check (against a migrated test database)
node scripts/run-sql-file.mjs scripts/persona-check.sql
```

## Artifact Row-Level Security for `Space Participant` and `UI`

When Collaboration opens documents, presentations, PDFs, or pinned records inside `<mjc-artifact-slideover>` (`<mj-artifact-viewer-panel>`), every core artifact entity queried by the viewer is governed by fail-closed Row-Level Security filters registered in `metadata/row-level-security-filters/.row-level-security-filters.json`, `metadata/entity-permissions/.entity-permissions.json`, `metadata/entity-permissions/.core-entity-permissions.json`, `metadata/entities/.ui-role-permissions.json`, and `COLLABORATION_BOOT_ENTITY_REGISTRY`:

| Entity | Role | Policy Kind | RLS Filter |
| --- | --- | --- | --- |
| `MJ: Artifact Types` | `Space Participant` | `active-catalog` | `Collaboration: Artifact Type Catalog` (`(IsEnabled = 1)`) so viewer plugins (`Markdown Document`, `Presentation`, `PDF`, etc.) resolve without exposing record data |
| `MJ: Artifacts` | `Space Participant` | `reach-scoped` (read-only) | `Collaboration: Artifacts In Reach` — caller-owned (`UserID`) or linked to a reachable `SpaceItem` (direct `MJ: Artifacts` `RecordID` or `SpaceItem.ArtifactVersionID`) with `CanSeeTeam = 1 OR Band = 'Shared'` |
| `MJ: Artifact Versions` | `Space Participant` | `reach-scoped` (read-only) | `Collaboration: Artifact Versions In Reach` — same reach boundary on `ArtifactID` |
| `MJ: Artifact Version Attributes` | `Space Participant` | `reach-scoped` (read-only) | `Collaboration: Artifact Version Attributes In Reach` — same reach boundary on `ArtifactVersionID` |
| `MJ: Artifact Permissions` | `Space Participant` | `reach-scoped` (read-only) | `Collaboration: Own Artifact Permissions` (`UserID = caller`) |
| `MJ: Artifact Uses` | `Space Participant` | `reach-scoped` (read + create) | `Collaboration: Own Artifact Uses` (`UserID = caller` AND `ArtifactVersionID` in reach) |
| `MJ: Conversation Detail Artifacts` | `Space Participant` | `reach-scoped` (read-only) | `Collaboration: Conversation Detail Artifacts In Reach` (scoped to reachable `SpaceChat` conversations) |
| `MJ: Collection Artifacts` / `MJ: Conversation Artifacts` | `Space Participant` | `shell-deny-all` | `Collaboration: Shell Empty` (`(1 = 0)`) |
| `MJ: Artifacts` / `MJ: Artifact Versions` | `UI` | `reach-scoped` (read-only) | `Collaboration: Artifacts In Reach Or Outside Collaboration` / `Collaboration: Artifact Versions In Reach Or Outside Collaboration` — keeps artifacts outside Collaboration readable while enforcing space/band isolation on artifacts filed in a space |

## `<mjc-space-meetings-tab>` Containment over `@mj-biz-apps/tasks-ng-widgets`

`SpaceMeetingsTabComponent` (`<mjc-space-meetings-tab>`) composes the reusable meeting widgets from `@mj-biz-apps/tasks-ng-widgets` directly inside Collaboration spaces and any host application embedding Collaboration widgets:

- **List & Rollup (`<bizapps-meeting-list>`):** Grouped-by-day meeting list with `Upcoming` / `Past` / `All` segmented filter, search input, `Shared` vs `Private` (`<mjc-band-chip Band="Team">`) visibility filters, inline RSVP (`ResponseChanged` saving to `MJ_BizApps_Tasks: Meeting Attendees` under `Collaboration: Own Meeting Attendee Row`), `Join` video links, and bound `SpaceChat` (`Subject = 'meeting:<MeetingID>'`) discussion launchers.
- **Recursive Sub-Space Rollup (`IncludeSubSpaces`):** When a space has descendant spaces in reach, `IncludeSubSpaces` defaults to enabled (`Include sub-spaces (N)` toggle), labels rolled-up meetings with their child room name, provides room filter pills, and routes meeting chat creation to the meeting's owning space.
- **In-Place Slide-Over Detail & Live Runner Drawer:** Clicking any meeting row opens an accessible right-hand slide-over sheet (`100% --mj-*` tokens) composing `<bizapps-meeting-header>`, `<bizapps-meeting-agenda>`, `<bizapps-meeting-people>`, `<bizapps-meeting-notes>`, `<bizapps-meeting-followups>`, and (for contributors with `CanSeeTeamSide && CanSchedule`) `<bizapps-meeting-live>`.
- **Strict Band & Read-Only External Isolation:** When `CanSeeTeamSide === false`, `Visibility === 'Private'` meetings are filtered out from both list and drawer, `DrawerPermissions` locks all write/run controls (`canEdit: false`, `canRun: false`, `canInvite: false`, `canWriteNotes: false`, `canAddFollowUps: false`), and raw `"Open form"` Explorer navigation is hidden — while invited participants can still RSVP, download `.ics`, join video, and open `Shared` meeting discussions.

