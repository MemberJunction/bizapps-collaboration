# Sub-Epic S9: Acting From Chat

Unified engineering specification for Sub-Epic S9 in `MemberJunction/bizapps-collaboration` across Slice 1 and Slice 2.

## Scope & Architecture

### Slice 1 — Subtyped Space Substrate, Rule-Based Chat Writes & Scoped Prompt Parts
1. **CX-1 — Subtyped `EnsureSpaceForRecord` & Space Subtype `Details` Substrate**:
   - Unified subtype property discovery (`discoverSubtypeProperties`), IsA child validation & application (`buildIsaDetailsPayload`, `subtype-details.ts`), atomic `EnsureSpaceForRecord` creation with sealed default (`InheritsMembership = false`), owner seat provisioning (`SpaceMember`), and race-winner idempotency backed by `UQ_SpaceAnchor_PrimaryPerType`.
   - GraphQL resolver exports (`EnsureSpaceForRecord`, `CreateSpace`) in `@mj-biz-apps/collaboration-server`.
2. **CS-3 — Rule-Based Chat Write Permission Provider**:
   - Pure evaluation rules (`evaluateSpaceChatWriteRules`) and server provider (`CollaborationChatWritePermissionProvider`) enforcing SpaceChat status/kind, space visibility/read-only state, seat role/band reach, and non-loosening `Chats.WhoCanWrite` rules across `App -> SpaceType -> SameTypeRun -> Space`.
   - Uses batched `RunView` (`ResultType: 'simple'` + `IN` clauses, zero N+1 hydration) and integrates with `@memberjunction/core-entities-server`'s `ConversationDetailWritePermissionRegistry`.
3. **CX-4 — Scoped Prompt Parts Resolution**:
   - Pure resolution (`resolveScopedPromptParts`) and server resolver (`resolveSpaceScopedPromptParts`, `CollaborationPromptComponentResolver`) along `SpaceType -> Root -> Space` with deterministic override specificity and zero cross-scope leakage.
4. **CX-10 — Exported Substrate Contract Bundle**:
   - Runnable test harness exported from `@mj-biz-apps/collaboration-core` and exercised by `@mj-biz-apps/collaboration-core-entities-server` against live server adapters (`createCollaborationServerSubstrate`).

### Slice 2 — Bound Space Agent Actions, `SupportsAudience` Actions, Approval Promotion & Team/Shared Docs
5. **CX-3 — Server-Bound Action Grants for Space Agents (Hidden Bound Parameters)**:
   - Pure schema redaction & anti-spoof parameter injection (`redactBoundActionParamsForAgent`, `enforceBoundActionParameters`, `buildBoundActionGrantBindings`) in `@mj-biz-apps/collaboration-core`.
   - Server registry & invocation wrapper (`CollaborationBoundActionGrantRegistry`, `ResolveForTurn`, `InvokeBoundAction`) wired into `executeSpaceChatTurn` (via `enableBoundActionGrants` / `Agents.EnableBoundActionGrants`) passing `ExecuteAgentParams.boundActionParams`.
   - Strips server-bound parameters (`SpaceID`, `RootSpaceID`, `RootEntityID`, `RootRecordID`, `Band`, `DeliveryPrincipalID`, and explicit grant `Bindings`) from agent-visible schemas/prompts and rejects/audits caller spoofing (`BOUND_PARAM_SPOOF_REJECTED`).
6. **CA-1 — Standard `SupportsAudience` Space Actions**:
   - Strongly typed `@RegisterClass(BaseAction, ...)` subclasses in `packages/CoreEntitiesServer/src/space-audience-actions.ts` and `metadata/actions/.actions.json`:
     - `Collaboration: Propose Audience Output` (`ProposeSpaceAudienceOutputAction`)
     - `Collaboration: Promote Draft To Shared` (`PromoteSpaceDraftToSharedAction`)
     - `Collaboration: Publish Shared Space Update` (`PublishSpaceSharedUpdateAction`)
     - `Collaboration: Manage Space Document` (`ManageSpaceDocAction`)
   - All actions declare `SupportsAudience = true`, expose an explicit `SupportsAudienceContract`, validate audience/band rules fail-closed, and reject hidden bound-parameter spoofing.
7. **CA-2 & CA-3 — Promotion via Approval Task (`@mj-biz-apps/tasks-entities`) & Team-Band Privacy**:
   - Reuses `@mj-biz-apps/tasks-entities` (`MJ_BizApps_Tasks: Tasks` with `ParentID`, `Task Links`, `Task Decisions`, `Task Activities`) instead of creating bespoke approval tables (`approval-promotion.ts`).
   - Enforces strict Team-band privacy (`assertApprovalDraftReadable`) on unapproved draft payloads and linked approval tasks so Shared-band users and outsiders cannot enumerate or inspect unapproved drafts prior to approval, then atomically promotes the draft (`Band = 'Shared'`) upon `Approved` outcome.
8. **CA-4 — Per-Root Delivery Principal**:
   - Configured per SpaceType / Space (`DeliveryPrincipal.UserID`, `AllowedPrincipalUserIDs`, `AllowFallbackToCaller?: false`) with non-loosening validation (`mergeDeliveryPrincipalConfigs`, `resolveEffectiveDeliveryPrincipal`, `resolvePerRootDeliveryPrincipal`).
   - Outbound `SupportsAudience` and Shared-band promotion actions execute attributed to the configured per-root delivery principal and never silently fall back to the approving user's personal identity.
9. **CX-13 — MJ Docs Integration on Team & Shared Bands**:
   - Registers `CollaborationSpaceItemArtifactPermissionDelegate` (`BaseArtifactPermissionDelegate` for `'MJ_BizApps_Collaboration: Space Items'`) so MJ `ArtifactPermissionEngine` enforces Team (`Team + Shared`) vs. Shared (`Shared` only) visibility isolation.
   - Provides fail-closed CRUD and delivery-principal-attributed promotion (`createSpaceDoc`, `listSpaceDocs`, `getSpaceDoc`, `updateSpaceDoc`, `promoteSpaceDocToShared`) backed by `MJ: Artifacts` (`Markdown Document`), `MJ: Artifact Versions`, and `SpaceItem.ArtifactVersionID`.

## Schema & Migrations Note
No additional SQL DDL migrations were needed for Slice 1 or Slice 2:
- `IsA` space subtyping, `SpaceItem.ArtifactVersionID` (`MJ: Artifact Versions`), `SpaceGrant`, `SpaceType.Configuration` / `Space.Configuration` JSON columns, `MJ: Artifacts.DelegateEntityID` / `DelegateRecordID`, and `@mj-biz-apps/tasks-entities` (`fnCollaborationTasks`) already exist in the baseline schema (`B202610012101__v0.1.x__Baseline.sql`).

## Static Quality Gates
- Strict zero-`any` / zero-`unknown` enforcement: `node scripts/check-strict-types.mjs --self-test && node scripts/check-strict-types.mjs`
- Registered `@RegisterClass` exports, row caps, no role-name auth, downstream domain-neutral naming, and `--mj-*` CSS design tokens: all enforced in `pnpm test`.
