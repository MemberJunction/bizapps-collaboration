---
"@mj-biz-apps/collaboration-engine-base": minor
"@mj-biz-apps/collaboration-core-entities-server": minor
"@mj-biz-apps/collaboration-server": minor
"@mj-biz-apps/collaboration-ng-widgets": minor
"@mj-biz-apps/collaboration-ng": minor
---

Implement Sub-Epic S8b external participant role audits, boot entity grant filter inventory, transactional persona security probe, and upload ingest model disclosure:

- **XS-1 & XS-7 Role Audits (`@mj-biz-apps/collaboration-engine-base`, `@mj-biz-apps/collaboration-core-entities-server`, `@mj-biz-apps/collaboration-server`)**: Add `SpaceParticipantRoleAuditOperation` and `StaffRoleAuditOperation` (`BaseRemotableOperation`) with server-side `ContextUser` authorization checks, batched `RunView` (`ResultType: 'simple'`) keyset pagination, dual-dialect SQL filters, and metadata-driven `EntityField.EntityIDFieldName` polymorphic FK validation.
- **XS-2 Boot Entity Grant Filter Inventory**: Add `BootEntityGrantInventoryOperation` enumerating `COLLABORATION_BOOT_ENTITY_REGISTRY` and `COLLABORATION_POLYMORPHIC_FK_SPECS` to prove zero unfiltered `Space Participant` reads, `AllowAllRowsAPI = 0`, and staff-only entity isolation.
- **XS-3 Automated Persona Security Probe**: Add `CollaborationPersonaSecurityProbe` (`BaseHealthProbe`), `CollaborationPersonaSecurityVerifier` (`BaseLiveCrudVerifier`), and `PersonaSecurityProbeOperation` wrapped in `WithRolledBackTransaction` to sweep `all-views`, `run-query`, `dataset`, `report`, and `direct-id-resolver` surfaces with bounded row caps and zero persistent side effects.
- **XS-8 Upload Ingest Model Disclosure (`@mj-biz-apps/collaboration-ng-widgets`, `@mj-biz-apps/collaboration-ng`)**: Add `CollabUploadIngestDisclosureComponent` (`mjc-upload-ingest-disclosure`) using `ChangeDetectionStrategy.OnPush`, plain-text domain-neutral copy, and semantic `--mj-*` CSS custom properties, wired into `CollabUploadDialogComponent`, `CollabSpaceLibraryComponent`, and `CollaborationSectionResource` with Vitest unit/CSS-token tests and multi-view Playwright verification.
