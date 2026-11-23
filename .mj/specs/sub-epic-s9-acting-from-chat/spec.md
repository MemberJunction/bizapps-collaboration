# Sub-Epic S9 (Slice 1): Subtyped EnsureSpaceForRecord, Rule-Based Chat Writes, Scoped Prompt Parts & Substrate Contract

- **Epic Task**: `72E226FD-A642-4F4F-A9DF-FC94F6088EC2`
- **Slice 1 Plan**: `7A13A451-BD4F-4221-AB0B-1BDA13B61805`
- **License**: BUSL-1.1 (100% domain-neutral collaboration substrate: `Space`, `SpaceType`, `Root`, `Seat`, `Band`, `PromptPart`, `Rule`)

## Scope Implemented in Slice 1

1. **CX-1 — Unified Subtyped `EnsureSpaceForRecord`** (`packages/CoreEntitiesServer/src/ensure-space-for-record.ts`, `packages/CoreEntitiesServer/src/subtype-details.ts`, `packages/Server/src/ensure-space-for-record.resolver.ts`, `packages/Entities/src/client.ts`):
   - Supports IsA subtype creation (`EnsureISAChild()` + typed `Details` validation/coercion onto the subtype leaf entity).
   - Assigns the caller an active `owner` `SpaceMember` seat on the `'Team'` band.
   - Defaults newly created spaces to sealed membership (`InheritsMembership = false`) while preserving explicit `inheritsMembership` and `anchorRole` (`'primary'`) overrides for backward compatibility.
   - Guarantees distributed concurrent race-winner idempotency backed by database uniqueness (`UQ_SpaceAnchor_PrimaryPerType` on `Space Anchors`), transaction rollback / compensating orphan cleanup, and deterministic conflict-read recovery (`findExistingPrimaryAnchorSpaceId`). No in-memory mutex is used.

2. **CS-3 — Rule-Based Chat Write Permission Provider** (`packages/Core/src/chat-write-rules.ts`, `packages/CoreEntitiesServer/src/chat-write-permission-provider.ts`):
   - Implements `CollaborationChatWritePermissionProvider` with fail-closed evaluation across:
     - `Space Chats` lookup (`General` / `Topic` / `Private` / `Assistant`),
     - Space & ancestor chain status/read-only checks and sealed boundary halt (`InheritsMembership = false`),
     - Seat role capabilities (`CanContribute`, `CanSeeTeamBand`, `IsOwnerRole`) and bands (`Team` | `Shared`),
     - Non-loosening `Chats.WhoCanWrite` policy rules across `App -> SpaceType -> SameTypeRun -> Space` (`Owners > TeamOnly > Contributors`),
     - Author/owner enforcement for `update`/`delete`, plus `Abstain` for system user or non-collaboration conversations, and fail-closed `Deny` on malformed JSON, unregistered server drivers, or failed queries.
   - Uses `RunView.RunView(...)` with `ResultType: 'simple'` and batched `ExtraFilter` `IN` clauses (zero N+1 entity hydration).
   - Dynamically registers into `@memberjunction/core-entities-server`'s `ConversationDetailWritePermissionRegistry` when present in the host runtime.

3. **CX-4 — Scoped Prompt Parts Hierarchy** (`packages/Core/src/scoped-prompt-parts.ts`, `packages/CoreEntitiesServer/src/scoped-prompt-parts.ts`, `packages/CoreEntitiesServer/src/execute-space-chat-turn.ts`):
   - Traverses `SpaceType -> Root -> Space` using both `MJ: Scoped Prompt Parts` (single batched `RunView` with `ResultType: 'simple'` and `PrimaryScopeRecordID IN (...)`) and `Configuration.PromptParts`.
   - Enforces `Override` (most specific scope wins: `Space > Root > SpaceType`, then `Priority`, `Active > Provisional`) and `Append` (deterministic `SpaceType -> Root -> Space` ordering, then `Sort`, `Priority`, `ID`).
   - Enforces zero cross-type, cross-root, cross-space, `Archived`, or `Team`-into-`Shared` leakage.
   - Registers `@RegisterClass(PromptComponentResolver, 'CollaborationPromptComponentResolver')` and wires resolved instructions into `executeSpaceChatTurn`.

4. **CX-10 — Substrate Contract & Reusable Contract-Test Bundle** (`packages/Core/src/substrate-contract.ts`, `packages/CoreEntitiesServer/src/substrate-adapter.ts`):
   - Exports `SUBSTRATE_CONTRACT_VERSION` (`'1.0.0'`), `CollaborationSubstrateContract`, `COLLABORATION_SUBSTRATE_CONTRACT_SCENARIOS`, `runCollaborationSubstrateContractTests`, `assertSubstrateContractPassed`, `registerCollaborationSubstrateContractTests`, and `createCollaborationServerSubstrate`.
   - Consumer applications can validate their substrate wiring by supplying a `SubstrateContractFactory` to `runCollaborationSubstrateContractTests` or `registerCollaborationSubstrateContractTests`.

## Schema & Migrations

- Existing baseline DDL in `migrations/B202610012101__v0.1.x__Baseline.sql` already defines `UQ_SpaceAnchor_PrimaryPerType` (`UNIQUE NONCLUSTERED ([SpaceTypeID], [EntityID], [RecordID]) WHERE ([IsPrimary] = 1)`), `Space.InheritsMembership` default `0`, and `Configuration` JSON columns on `Space Type` / `Space`; `MJ: Scoped Prompt Parts` is provided by MJ Core. No new schema DDL migrations are required for Slice 1.

## Static & Verification Gates

- `node scripts/check-strict-types.mjs`: zero explicit `any`, zero `unknown`, zero `BaseEntity.Get()/Set()`.
- `pnpm run build`: builds all publishable & example packages cleanly.
- `pnpm test`: executes all repo static checks, Core unit tests (`chat-write-rules.test.ts`, `scoped-prompt-parts.test.ts`, `substrate-contract.test.ts`), `CoreEntitiesServer` unit & CX-10 contract specs (`packages/CoreEntitiesServer/src/__tests__/*.spec.ts`), and downstream workspace tests.
