# PR #7 Finish Line Completion Plan (Punch List 4)

**Status**: In Progress  
**Reference**: [Reviewer Punch List 4](https://github.com/MemberJunction/bizapps-collaboration/pull/7#issuecomment-5858175690)  
**Tally**: 26 Finish Line Items to achieve 100% completion on PR #7.

---

## 🚀 Execution Checklist

### Group 1: Security in Code #7 Ships
- [ ] **Item 58 (Work Tab Guardrails)**:
  - Remove staff shortcut in `task-entity-server.ts:44` (`!isStaffUser(user)`). Only the seat decides.
  - Update `task-space.test.ts:254` to assert staff without a seat is refused.
  - In `collaboration-section.component.ts:1248`, compute `canContribute` from viewer's space seat & role (`role.canContribute`), not hardcoded role names.
  - Add user-facing message on cancelled drag in Kanban/Gantt.
  - In `isSpaceClosed`, check only `ClosedAt` (remove `Status`).
- [ ] **Item 56 (Authorizations)**:
  - In `CollaborationEngine.ts:201`, remove name-only fallback in `FindCollaborationAuthorization`.
  - In `collaboration-section.component.ts:1134`, align `canConfigureCurrentSpace` with server's `UserCanConfigureSpaces`.
  - In `CollaborationEngine.ts:261`, remove query fallback for role types; read from engine or fail closed.
  - In `SpaceTypeEntityServer.ts:27, 32`, set `CompleteMessage` when type delete is refused.
  - In `metadata/space-types/README.md`, document that sync user must hold `Owner` or `Developer` role.
- [ ] **Item 12 (Closing)**:
  - Add server harness checks for direct writes to close columns.
- [ ] **Item 11 (Sub-spaces InheritsMembership Default 0)**:
  - Author migration setting `Space.InheritsMembership` default to 0 in schema and `spCreateSpace`.
  - Remove `SpaceEntityServer.ts:205-212` (`undefined` check and `defineProperty`).
  - Host reads missing value as false.
- [ ] **Item 28 (Retrieval by Audience Fixes)**:
  - In `effectiveRetrievalScope`: refuse unless exactly one principal in `Private`/`Caller`, drop `Union`.
  - In `ExcludedFromParentScope`: search space only when question originates from that space.
  - In `fnCollaborationCommonAccess`: fail closed on malformed list (add migration).
  - Add unit tests.
- [ ] **Item 40 (Access After Close in TypeScript Walk)**:
  - Bring `membershipReaches` into alignment with `fnCollaborationAccess` for closed spaces.
- [ ] **Item 39 (SyncSeats)**:
  - Make `SyncSeats` in `base-space-type-server-driver.ts` refuse with explicit error until built.
- [ ] **Item 54 (EngineBase Polish)**:
  - EngineBase test runs via `pnpm test` (Done).
  - Clean peers in `EngineBase/package.json` (Done).
  - Remove Config(true) reload from `resolve-allowed-agents.ts` and `resolve-space-agent-context.ts` (Done).
  - In `SpaceEntityServer.ts:70-100`, refuse save if engine cannot load instead of falling back to direct reads.
  - In `CollaborationEngine.ts:246, 264, 441`, validate UUIDs with `parseUuid` before putting in `ExtraFilter`.
- [ ] **Item 3 (Owner Bypass & Test Cleanup)**:
  - Remove duplicate test in `space-agent-retrieval.test.ts:354`.
  - Rename tests by what they check rather than item numbers.

### Group 2: The Chat (Items 57, 8, 59, 60, 61, 62)
- [ ] **Item 59 (Remove Unaudited Browser Conversation Creation)**:
  - Remove *New conversation* dialog, buttons, and `createSpaceConversation` from `collaboration-section.component.ts`.
  - Remove `onConversationCreated` and dead dialog CSS.
- [ ] **Item 60 (Clean Up Chat Types)**:
  - Delete hand-written copies of chat types (`AgentReplyMode`, `AgentTurnRequest`, etc.) from `space-chat.component.ts`.
  - Delete unused `handleAgentTurn` and related inputs.
- [ ] **Item 61 (Old Chat Leftovers)**:
  - Remove unused `CommonModule` and `FormsModule` in `space-chat.component.ts`.
  - Wire overview ask box to room chat or remove.
- [ ] **Item 57 & 8 (Chat Posting & Room Rule Enforcement)**:
  - In `PostSpaceMessage`, strictly validate `ConversationID` belongs to the space and is the space's Room.
  - Fail closed and preserve composer message if post fails, displaying user-facing error.
  - Ensure only Room is readable in *Conversations In Reach* for participants.
  - When switching spaces, clear messages and show "no room yet" if space lacks a room.

### Group 3: Browser Writes and Host Data Layer (Items 4, 50, 9, 5)
- [ ] **Item 4 (Explorer Host Data Layer)**:
  - Display "no Person" state instead of passing empty string to approval inbox / My Tasks.
  - User-facing error notifications on failed post, upload, invite, or settings save.
  - Check `memberEntity.Save()` in invite handler.
  - Remove hand-written `RawSpaceRecord.Status` and `UserEmail` — derive from entity classes.
  - Do not read task links as files / untitled documents in library.
  - Work tab: use `CreateSpaceTask`, open task on click (`onTaskSelected`), verify toggle save.
  - Hide *Add link* button until linked documents are supported.
  - Compare UUIDs with `UUIDsEqual` across host.
- [ ] **Item 50 (Share Dialog)**:
  - Remove or hook up server promotion for sharing.
- [ ] **Item 9 (Library & Overview Metrics)**:
  - Bind `TeamTotalCount` in Overview, remove `|| 15` fallback.
  - Clean up `firmName` / `clientOrgName` display.
  - Ensure library file count counts only files.
- [ ] **Item 5 (Access Restricted Flash & Loading)**:
  - Replace custom spinner with `<mj-loading>`.
  - Reserve *Access Restricted* strictly for users without a seat; show error on load failure.

### Group 4: Tests and Docs (Items 7, 21, 22, 27, 10, 53)
- [ ] **Item 10 (Metadata Hygiene)**:
  - Replace hand-typed UUID in `.entity-permissions.json:64` with random UUID.
- [ ] **Item 53 (Generic Terminology & Icons)**:
  - Replace `fa-calendar-star` with free `fa-calendar-days` in `.space-types.json`.
  - Replace "Client" with generic terms on People tab, Work tab, and roles.
  - Update `package.json` and `mj-app.json` descriptions.
- [ ] **Item 7 (FE1 & FE2)**:
  - Fix FE1 to build required data inside check; take FE2 out.
- [ ] **Item 21 (RM5 Cleanup)**:
  - Ensure `finally` does not skip delete or mask errors.
- [ ] **Item 22 (FLS4 & Acceptance Tests)**:
  - Make FLS4 meaningful or remove; test accepting side of gates.
- [ ] **Item 27 (Doctrine)**:
  - Update `docs/HOW_THE_SYSTEM_WORKS.md` marking built rules.

### Group 5: Document Viewer Integration (User Request)
- [ ] Implement file viewer integration on document click in Library/Overview so documents open real preview/viewer instead of static drawer paragraphs.
