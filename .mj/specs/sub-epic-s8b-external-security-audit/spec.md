# Sub-Epic S8b: External Participant Role Audits, Grant Filter Inventory, Persona Probe & Ingest Disclosure

## Overview

Sub-Epic S8b hardens external participant and staff security governance and adds upload ingest transparency across MemberJunction/bizapps-collaboration using 100% generic domain-neutral BUSL-1.1 naming and strict TypeScript typing (`0` `any`, `0` lazy `unknown`, `0` `BaseEntity.Get()/Set()`):

1. **XS-1 — Space Participant Role Audit (`SpaceParticipantRoleAuditOperation`)**: Audits active `SpaceMember` assignments, `SpaceRoleType` flags, band alignment, staff-only space boundaries, and polymorphic foreign-key integrity strictly via `EntityField.EntityIDFieldName` metadata and batched `RunView` (`ResultType: 'simple'`) keyset pagination.
2. **XS-7 — Staff Role Audit (`StaffRoleAuditOperation`)**: Audits role overlaps, `Collaboration` root/child authorization grants, excessive entity permissions, and least-privilege boundaries for external participants and staff roles.
3. **XS-2 — Boot Entity Grant Filter Inventory (`BootEntityGrantInventoryOperation`)**: Enumerates every boot-loaded and Collaboration-schema entity in `COLLABORATION_BOOT_ENTITY_REGISTRY`, confirming `AllowAllRowsAPI = 0`, non-null/non-tautological RLS read/write filters for `Space Participant`, staff-only denials, and `COLLABORATION_POLYMORPHIC_FK_SPECS` metadata parity.
4. **XS-3 — Automated Persona Security Probe (`CollaborationPersonaSecurityProbe` / `CollaborationPersonaSecurityVerifier` / `PersonaSecurityProbeOperation`)**: Extends `BaseHealthProbe` / `BaseLiveCrudVerifier` wrapped in `WithRolledBackTransaction` (`BeginEntityTransaction()` + unconditional `Rollback()`) to sweep all five disclosure surfaces (`all-views`, `run-query`, `dataset`, `report`, `direct-id-resolver`) with bounded `MaxRows` and timeout controls and zero persistent side effects.
5. **XS-8 — Upload Ingest Model Disclosure UI (`CollabUploadIngestDisclosureComponent`)**: Renders an inline summary and accessible expandable disclosure panel in `CollabUploadDialogComponent` and `CollabSpaceLibraryComponent` (`CollaborationSectionResource`) using `ChangeDetectionStrategy.OnPush`, sanitized plain-text copy (zero raw Markdown leaks), and exclusive `--mj-*` / `--mjc-*` CSS custom properties.

## Architecture & Key Artifacts

### Backend Security Audits & Operations (`packages/EngineBase`, `packages/CoreEntitiesServer`, `packages/Server`, `packages/IntegrationTests`)
- `packages/EngineBase/src/security-audit-types.ts`: Canonical IDs, dual-dialect (`mssql` / `postgresql`) identifier quoting and `IN (...)` batching, `readEverySimpleRow` keyset pagination, and `authorizeSecurityAuditCaller` (`ContextUser` role/authorization verification rejecting Magic Link and `Space Participant` callers).
- `packages/EngineBase/src/space-participant-role-audit.ts`, `staff-role-audit.ts`, `boot-entity-grant-inventory.ts`, `persona-security-probe.ts`, `security-audit-operations.ts`: `BaseRemotableOperation` subclasses decorated with `@RegisterClass(BaseRemotableOperation, ...)`, plus `CollaborationPersonaSecurityProbe` (`BaseHealthProbe`) and `CollaborationPersonaSecurityVerifier` (`BaseLiveCrudVerifier`).
- `packages/CoreEntitiesServer/src/CollaborationEngine.ts` & `packages/Server/src/index.ts`: Expose typed audit delegation methods on `CollaborationEngine.Instance` and retain registrations via `LoadCollaborationSecurityAuditOperations()` inside `LoadBizAppsCollaborationServer()`.

### Frontend Disclosure UI & Visual Verification (`packages/AngularWidgets`, `packages/Angular`, `packages/UXGallery`, `e2e`, `docs/ux`)
- `packages/AngularWidgets/src/lib/upload-ingest-disclosure.component.ts`: `CollabUploadIngestDisclosureComponent` (`mjc-upload-ingest-disclosure`, aliased as `UploadIngestDisclosureComponent`) and `buildUploadIngestDisclosureModel`.
- `packages/AngularWidgets/src/lib/upload-dialog.component.ts` & `space-library.component.ts`: Wire `<mjc-upload-ingest-disclosure>` into both the upload modal and library surface with zero raw color literals.
- `packages/Angular/src/lib/collaboration-section.component.ts`: Passes `[ShowUploadDisclosure]="canAddHere"` and `[AgentRetrieval]` into `<mjc-space-library>` and `<mjc-upload-dialog>` while preserving `CollaborationSectionResource` (`@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')`), `<mj-page-layout>`, `NotifyLoadComplete()`, `LoadBizAppsCollaborationClient()`, and `DefaultNavItems` parity.
- `docs/ux/mockup/html/14-upload-ingest-disclosure.html`, `packages/UXGallery/src/frames/frame-09.component.ts`, and `e2e/specs/xs8-upload-ingest-disclosure.spec.ts`: Static HTML reference and headless Playwright light/dark + collapsed/expanded verification.

### Documentation, Release & CI (`docs`, `README.md`, `.changeset`, `.github/workflows`)
- `docs/security-audits-and-ingest-disclosure.md`, `docs/HOW_THE_SYSTEM_WORKS.md`, `README.md`: Full security governance, operation runbooks, and upload ingest disclosure documentation.
- `.changeset/s8b-external-security-audit.md`: `minor` release changeset covering `@mj-biz-apps/collaboration-engine-base`, `@mj-biz-apps/collaboration-core-entities-server`, `@mj-biz-apps/collaboration-server`, `@mj-biz-apps/collaboration-ng-widgets`, and `@mj-biz-apps/collaboration-ng`.
- `.github/workflows/ci.yml`: Verified `build`, `test`, static gates, and Playwright `test:e2e` on PRs targeting `next`, with `concurrency` cancellation and explicit job `timeout-minutes`.

## Critical User Journeys & Verification Criteria

1. **Security Administrator Audits & Persona Probe**: Security admins invoke XS-1, XS-7, XS-2, and XS-3 via `BaseRemotableOperation` / `CollaborationEngine.Instance`; external `Space Participant` and Magic Link callers are deterministically rejected; XS-3 rolls back every transaction with zero persistent rows.
2. **External Space Participant Upload Transparency**: An external participant opening the space library or upload dialog sees the inline XS-8 disclosure notice, expands the 4-pillar details panel via keyboard or pointer, observes `--mj-*` themed rendering with zero raw Markdown leaks, and receives zero out-of-grant data.
3. **Automated CI & Token Compliance**: `pnpm run build`, `pnpm test` (including `upload-ingest-disclosure.component.spec.ts`, `css-token-compliance.spec.ts`, `upload-ingest-disclosure.render.test.ts`, and all EngineBase/CoreEntitiesServer/Server/IntegrationTests suites), `pnpm exec mj standards check`, and `pnpm run test:e2e` pass with exit code 0.
