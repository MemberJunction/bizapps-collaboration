# Collaboration: the plan

**Version:** v0.4 · 2026-09-26. This is the one plan for this wave. It merges this file's v0.2 with Amith's build plan v0.3 (2026-09-26) and the decisions Amith made on the same day. Where v0.2 and v0.3 disagreed, v0.3 stands.

**Repos:** `MemberJunction/MJ` (branch `next`), `MemberJunction/bizapps-collaboration` (this repo), `MemberJunction/bizapps-committees`.

**Owner:** not named yet ([§ 11](#11-open-decisions), decision 1).

**The detailed designs live in their own documents.** This plan links to them rather than copying them:
- [the extensibility plan](../docs/EXTENSIBILITY_PLAN.md): space types as plug-ins, with chats, history and agents;
- [the UX storyboard](../docs/ux/README.md) and [its implementation plan](../docs/ux/IMPLEMENTATION_PLAN.md);
- [Committees' rebuild plan](https://github.com/MemberJunction/bizapps-committees/blob/next/plans/COLLABORATION_REBUILD_PLAN.md);
- [How Collaboration works](../docs/HOW_THE_SYSTEM_WORKS.md): the rules, each marked built or planned.

## Contents

0. [How to use this plan](#0-how-to-use-this-plan)
1. [What we are building](#1-what-we-are-building)
2. [Where things stand](#2-where-things-stand)
3. [Decisions](#3-decisions)
4. [The model](#4-the-model)
5. [The security doctrine](#5-the-security-doctrine)
6. [Workstream A: MemberJunction core](#6-workstream-a-memberjunction-core)
7. [Workstream B: Collaboration](#7-workstream-b-collaboration)
8. [Workstream C: Committees on Collaboration](#8-workstream-c-committees-on-collaboration)
9. [Sequencing](#9-sequencing)
10. [Verification](#10-verification)
11. [Open decisions](#11-open-decisions)
12. [Risks](#12-risks)
13. [Out of scope](#13-out-of-scope)
- [Appendix: source checks of 2026-09-26](#appendix-source-checks-of-2026-09-26)

## 0. How to use this plan

- **Three workstreams:** A is MemberJunction core, B is Collaboration, C is Committees. [§ 9](#9-sequencing) sets their order. Items are numbered so pull requests and commits can cite them (`A4`, `B2.3`, `D2`).
- **Every item has acceptance criteria.** An item is done when they pass, not when the code compiles.
- **Source wins.** The platform claims here were read from source on 2026-09-26, and the [appendix](#appendix-source-checks-of-2026-09-26) records what was checked. Re-verify on the pin before building on a claim. If source disagrees with this plan, follow the source and say so in the pull request.
- **References.** `E:<line>` is a line of `MJ/packages/MJCoreEntities/src/generated/entities/__mj.ts` on MJ `next` as of 2026-09-25. Those lines move between versions, so search by name. Other core paths are relative to `MJ/packages/`.
- **Nothing firm-specific.** Collaboration is a free, generic engine. Anything that exists only for one firm's practice goes in a private extension built on B8's extension points.
- **One pull request, merged when it's 100% done (D12).** The next pull request doesn't merge stage by stage. PR #3 took 96 review rounds, so keep this one reviewable another way: work [§ 9](#9-sequencing)'s stages in order, cite item numbers in commits and review threads, and let each review round cover one stage.

## 1. What we are building

**A space** is a bounded group of people, some of them from outside the organization, working on a bounded set of material. Spaces form a tree: one perpetual root per relationship, and sub-spaces for the engagements, committees, cohorts and workstreams inside it. The work is bounded; the relationship isn't. Closing a sub-space ends that piece of work, and the root outlives it.

**Three first customers, one code base:**
1. **A client portal** for a professional-services firm, dogfooded first by our own services organization: documents, tasks, issues, meetings, and an agent that works across the client's scoped content. The portal outlives the engagement.
2. **Committees and boards** for associations, with outside directors who aren't staff. BizApps Committees is rebuilt on this engine (workstream C).
3. **Cohorts:** learning cohorts, mastermind groups, chapters, task forces and volunteer crews. Collaboration's widgets must also run inside another Angular app, such as a learning portal, without Explorer.

**Engine versus extension.** The engine stays generic and plain. Anything that sets one adopter apart goes in an extension built on B8's extension points. There will always be pressure to move a feature into the engine because it feels general. The test is whether a second, unrelated adopter would configure it the same way.

**Scope and distribution.**
- **Single-tenant per deployment** (2026-09-21): one association or one firm per deployment. Not multi-tenant SaaS.
- **Free** (2026-09-22): no tiers, no per-seat price, no separate price for the agent. How it's licensed and published is still open. Free also removes the thing that usually forces an owner to exist, which is why naming one stays decision 1.

**Why it's worth building.**
- **Board and committee portals** are priced per seat, with AI sold separately. OnBoard lists $25,385 for 15 users, with AI as a separate $3,500 line; BoardEffect's tier with AI minutes costs 37% more than its Pro tier. Committees already has the governance depth; what it lacks is a way to seat a director who isn't staff.
- **Client portals** such as Copilot, Clinked, Moxo and SuiteDash are file-plus-chat in the vendor's cloud, one per project. None has an agent bounded by the same object that bounds access, and none can answer after the project ends.
- **Cohorts** are the case nobody prices. An association has far more of them than committees, and in this app each is a `SpaceType` row, not a feature.

## 2. Where things stand

### 2.1 Two pull requests

- **PR #3** (`feat/collaboration-phase-0-2`) finishes as it is and then merges whole. Its finish line is [§ 2.3](#23-pr-3s-finish-line). v0.3's B0.9, splitting it, is dropped.
- **The next pull request** carries everything new in this plan and in the extensibility plan.
  - It's opened as a draft stacked on PR #3, with base `feat/collaboration-phase-0-2`, and retargets to `next` when PR #3 merges.
  - The builder moves to it once PR #3 merges, and works directly on its branch, `claude/hopeful-bell-6ldk4v` (D12). Both sides merge the remote branch before pushing, and nobody rebases or force-pushes. The UI work continues there, slices B to I, with whatever changes this plan needs.
  - It merges once, when all of it is 100% done (D12).
  - [§ 9](#9-sequencing) is its order.

### 2.2 What PR #3 has delivered

At `b539790`, reviewed in round 94:

- **The container:** seven entities (`SpaceType`, `Space`, `SpaceMember`, `SpaceRoleType`, `SpaceItem`, `ItemUse` and `ShareNotice`) and three access functions (`fnCollaborationAccess`, `fnCollaborationTasks` and `fnCollaborationAncestorMembers`).
- **Reads:**
  - the `Space Participant` role, with a row-level security filter on every one of its 57 read grants;
  - field rules on People, so a client reads only a person's name and email, with People's field-level flag in bizapps-common#186 (still open);
  - empty reads for the core entities the shell loads, regenerated on every MJ upgrade.
- **Writes:** gates on spaces, seats, items, item uses and share notices, and on bizapps-tasks' tasks, comments, decisions and assignments. The rules they call are pure functions in `collaboration-core`.
- **Features:**
  - invitation by email link;
  - the library: upload, open, promotion with its stamp, share notices, item uses, and delete with file cleanup;
  - tasks filed in spaces, with assignment of people seated above a space behind a staff switch;
  - the room, with `PostSpaceMessage`.
- **The agent's groundwork:** the agent, its prompt, skills and search scope as metadata, and the bounded retrieval module. No model runs yet; the room's reply is a fixed sentence.
- **Metadata out of migrations:** no migration writes metadata, and every metadata ID is a random v4 UUID.
- **Tests:** 191 unit tests; two integration harnesses (38 server checks and 39 client checks, eight bundles each) with a count assertion; `scripts/persona-check.sql`; and the gallery's Playwright test in CI.
- **The new UI's first steps:**
  - the old UI deleted;
  - `collaboration-ng-widgets` with eight L1 widgets and their tests;
  - every package declaring its layer, with MJ's `ui-layers` check locked;
  - the tokens partial, which nothing includes yet (B0.10), and the L0 view models;
  - the UX gallery, and frame 02's chrome at 0 pixels on CI.

**Since then,** rounds 95 to 97 reviewed four pushes. `fc77117` and `c125daf` change no server code, migration or rule this plan cites; `6786bd0` changes the member gate, the room's reply and its mutation:
- **`fc77117` began slice A:** the item card and row, the file icon, the item preview, the needs-you card, the ask box, the share check and its dialog, and the overview and library layouts, with 35 widget tests (209 unit tests in all); frames 03 and 04 in the gallery; and the Milestone task type in `metadata/task-types/`.
- **Round 95 found slice A drawn from the story's data, typed into the code.** The Explorer resource reads and writes nothing and shows the story to every user, six widgets default their inputs to it, and CI measures the full frames at 48,141, 137,911 and 235,685 pixels against budgets of 500. Slice A is rebuilt on real data from the map's second pass ([§ 2.3](#23-pr-3s-finish-line)).
- **`c125daf` dropped Space Participant's application role,** so clients lose the app. Round 95 asks for it back.
- **`6786bd0` answered round 95** (223 unit tests): B0.1's rule, the retrieval's full-page refusal, B0.3's checks, Space Participant's application role back, no `sync` blocks, no `[innerHTML]` in slice A's widgets, the 21 old screenshots deleted, and the first live Explorer shots of frames 02 to 04. It also added five chat widgets, which belong to slice B here ([§ 2.4](#24-what-moves-to-the-next-pull-request)), and raised CI's full-frame budgets from 500 to 80,000, 180,000 and 260,000 pixels.
- **Round 96 found** that B0.2 still leaks through a sealed sub-space and is now reachable over GraphQL, that B0.1's integration checks don't exercise the fix, and that the Explorer resource still shows the story's data typed into the code rather than reading the viewer's.
- **`e18615a` answered round 96** (216 unit tests): B0.2's reply names only the room space's own Shared items and returns `AssistantError`, B0.1's WG2 and unit cases test the fix, WG3 asserts reasons, the tokens are defined on each widget's `:host`, `DefaultForNewUser` is true, the committee row is out of `metadata/`, `next` is merged in, and the five chat widgets are out of PR #3.
- **Round 97 found** that the Explorer resource still reads nothing it shows, that RM5's new sub-space check saves a file item the file gate refuses, that frames 03 and 04 got worse while CI's budgets rose to 145,000 and 245,000, and that frame 04's dialog is taller than the screen in Explorer.
- **`86b48c1` answered round 97** (216 unit tests): the flagged-phrase highlight on the frame's values, which brought frames 03 and 04 down to 115,561 and 190,240 pixels on CI; RM5's sub-space case rebuilt on an uploaded file, with both halves and a checked delete; WG3's exact reasons; and the widgets' own 14px base size. CI's budgets went to 41,500, 130,000 and 200,000.
- **Round 98 found** that the Explorer resource still reads nothing it shows; that three text sizes are wrong (an invalid `.fs12.5` selector, the note box cut to 62px where the frame's is 80px, and MJ's global `p` rule reaching the drawer's preview in Explorer); that frame 04's dialog is still taller than the space it opens in; and that CI's budgets sit thousands of pixels above CI's counts, with frame 04's count varying between runs.
- **`42569e2` answered round 98** (216 unit tests): the three text sizes (the class renamed `fs12-5`, the note box at 80px, and the drawer's paragraphs set to 10.5px against MJ's global `p` rule), and a maximum height for frame 04's dialog inside the host. CI measures the frames at 34,188, 114,954 and 82,115 pixels, frame 04 now repeats, and the budgets went to 40,234, 115,661 and 100,000.
- **Round 99 found** that the Explorer resource still reads nothing it shows, and that slice A's widgets draw their own copies of the MJ components the UI plan's § 6 names: `mjButton`, `mj-dialog`, `mj-switch`, `mj-tab-nav`, `.mj-textarea` and `.mj-input`. That accounts for most of frame 04's count, and it leaves the toggle and the library's band control out of keyboard reach. The widgets' text is also black in Explorer, since their `:host` sets no color, and CI's budgets sit above the new counts again. MJ 6.1.3's `mj-dialog` caps its height at 90% of the window, so frame 04 either takes its differences or keeps its own dialog as a gap recorded in the UI plan.

### 2.3 PR #3's finish line

PR #3 merges when everything here is done. It's round 99's list: slice A, v0.3's B0 with each item's status, and the round 94 tasks that stay. B0's statuses are as checked at `42569e2` on 2026-09-26, and its numbers are v0.3's, so reviews can cite them.

**Slice A:** frames 02, 03 and 04 ([the UI plan's § 11](../docs/ux/IMPLEMENTATION_PLAN.md#11-order-of-work)), passing in the gallery, with live Explorer shots of each in light and dark.
- **Slice A's data lands in PR #3,** not in the next pull request: item versions, share checks and their findings (the UI plan's gap 7), items that hold a set of files (frame 03's 24 photos), the Milestone task type (gap 4, a `metadata/` row), and the columns frames 02 to 04 read.
- It's being designed in PR #3's review now. Each shape is posted there before its migration, and the tables go into B0.7's baseline.
- **The Explorer resource reads the viewer's real data** through `ProviderToUse` and the typed client, and the full-frame budgets go back to what CI measures once the frames match, as tight as frame 02's chrome, or just above a variation that can't be removed.
- **MJ's components** (round 99): the widgets use `mjButton`, `mj-switch`, `mj-tab-nav`, `.mj-textarea` and `.mj-input` where they now draw their own, and set their text color on `:host`. Frame 04's dialog is built on `mj-dialog`, unless a screenshot of both shows it can't draw the frame; then the local dialog stays, as a gap recorded in the UI plan. The frames' text sizes are fixed in `42569e2`, and frame 04's dialog has a maximum height inside the host.
- **Every new user gets the app:** `DefaultForNewUser` is true (D13).

**B0: the fixes to PR #3's own code.**

1. **B0.1. A member can remove someone seated above them.** Fixed: the rule in `6786bd0`, its checks in `002c2c5`.
   - At `b539790`, on an update, `SpaceMemberEntityServer.ValidateAsync` passed `refuseInvite` only the new role, and read the target's current role only for the last-owner check.
   - In the sample world, Casey is client admin on Northwind, with a ceiling (`MaxGrantableLevel`) of 10, and Sam is a member there, at level 20. Casey could remove Sam by saving Sam's seat with role `client-member` and status `Removed`:
     - the new role is within Casey's ceiling, and its flags are within Casey's;
     - the owner-approval check runs only when the row stays Active (`SpaceMemberEntityServer.ts:79–84`);
     - Space Participant can update Space Members, with no update filter.
   - The same path let an admin remove an owner or a peer admin, as long as another owner remains. On a type with `InviteApproval = AutoApprove`, a plain demotion passed too.
   - The seeded ceilings: owner 40, admin 20, member 10, guest 0, client admin 10, client member 0.
   - **Fix:** on an update to someone else's seat, the target's current role must also be within the signer's ceiling: its level at or below `MaxGrantableLevel`, and no flag the signer lacks. It goes in the pure rule, with the current role passed in.
   - **Done in `6786bd0`:** `refuseInvite` takes the current role, and `SpaceMemberEntityServer` passes the saved one. The unit cases for demoting someone above and for a peer admin prove it.
   - **Done in `002c2c5`:** on both harnesses WG2 has Casey save Sam's seat as `client-member` and `Removed` and asserts the rule's exact message; the unit removal case grants `client-member` over `member`, and a unit case covers the signer's own seat through `refuseInvite`.
2. **B0.2. The room's reply names items some readers can't open.** Fixed in `002c2c5`, with its sub-space check rebuilt in `86b48c1`.
   - With `executeAgent`, `postAssistantReply` (`post-space-message.ts:133–139`) lists the items the asker may quote, then saves the reply in the room. `Collaboration: Conversation Details In Reach` shows every room message to everyone who reaches the space, whatever their band.
   - So when Ada asks in Discovery's room, the reply names `discovery-brief.pdf` and `field-notes.txt`, both Team, and Bea can read it.
   - **`6786bd0`** keeps only Shared items in the reply (`filterRoomReplyItems`), but from the room's whole subtree. A sub-space that doesn't inherit membership has its own audience: with a Shared item in Sealed branch, Sam asks in Northwind's room, and Casey, who reads that room with no seat in Sealed branch, learns the item's name. It also made `ExecuteAgent` a public input of `PostSpaceMessage`, and a failed reply comes back as success with its error dropped by the resolver.
   - **The same module failed open on a big host,** loading at most 2,000 spaces and 2,000 items. `6786bd0` refuses when a load comes back full, with unit tests since `002c2c5`.
   - **Done in `002c2c5`:** the reply names only the room space's own Shared items (`SpaceID` and band), with the sub-space unit case, and the resolver and typed client return `AssistantError`.
   - **Done in `86b48c1`:** RM5's sub-space case uploads its own file into Sealed branch as Sam and promotes it to Shared. Casey's read of Sam's Northwind reply doesn't name it, Sealed branch's own room reply does, and a failed delete fails the run. Left (round 98): the cleanup skips the delete silently when the item doesn't load.
   - **`002c2c5` took the first of the two fixes round 96 offered:**
     - v0.3's short-term fix: the room's reply names only items that everyone who reaches the space can read: this space's own Shared items that pass `AgentRetrieval`, filtered on `SpaceID` as well as band. Widen it only with a test that proves the wider set. Return the reply's error as `AssistantError`.
     - Or take `ExecuteAgent` back out of the mutation and the typed client, and keep the path server-only until the next pull request's agent run replaces it.
   - **Tests,** for the first way: a unit test where a sub-space's Shared item is left out, and room checks on both harnesses where Sam asks in Northwind's room with a Shared item in Sealed branch and, as Casey, the reply doesn't name it. RM5's Discovery case, where Bea's read names no Team item, stays.
3. **B0.3. A participant's new subtask.** Not a bug. It needs a check that proves it.
   - MJ 6.1.3 checks the create filter on every new row, before and after the before-save hooks: `CheckCreateRLS`, at `databaseProviderBase.js:1252` and `:1293` in `@memberjunction/core`.
   - Space Participant's create filter on Tasks, `Collaboration: Subtasks Under A Writable Parent`, requires a parent that `fnCollaborationTasks` marks `CanWrite`: one in a space the caller contributes to, and Shared unless the caller sees Team. So the insert is checked against the parent's space and band.
   - The gate itself checks the parent only when a saved task's parent changes (`task-entity-server.ts:27–52`). v0.3's lines (164–170) are from an older file; this one has 67 lines.
   - **The check,** over the wire as Bea: a subtask under a Team task is refused; so is one under a task in a space Bea doesn't reach; one under a writable Shared task is accepted. WG3 has it on both harnesses since `6786bd0`, and asserts MJ's exact refusal since `86b48c1`.
4. **B0.4. The four bizapps-tasks subclasses run async validation.** Holds; no change. MJ 6.1.3's `BaseEntity` runs `ValidateAsync` whenever a subclass overrides it, unless `DefaultSkipAsyncValidation` is overridden (the rule is in MJ since 6.1.0). `CollaborationTaskEntityServer`, `TaskCommentEntityServer`, `TaskDecisionEntityServer` and `TaskAssignmentEntityServer` override it, and neither they nor bizapps-tasks 1.5.0's classes override the flag.
5. **B0.5. CI against a real database.** Open. CI only syntax-checks the two harnesses (`node --check`), so the integration suite and `scripts/persona-check.sql` never run there.
   - Add a job with a SQL Server service. It installs MJ core, bizapps-common and bizapps-tasks at their pinned versions, migrates, pushes `metadata/`, loads the world, runs `pnpm run test:integration:server` and `persona-check.sql`, and fails on any error.
   - The client harness needs MJAPI with PR #3's server package loaded. Run it in the same job if MJAPI can start there, or say what stops it.
6. **B0.6. `mj-standards.yml` runs `npm ci`.** Done: the workflow was deleted in `28e3a86`, and `ci.yml`, on pnpm, runs `pnpm exec mj standards check`.
7. **B0.7. One baseline, plus one migration for the access functions.** Open: 16 files today.
   - v0.1 hasn't shipped, so squash `migrations/` to two files: the baseline (schema, tables and the CodeGen output) and the access functions. Slice A's new tables and columns go into the same baseline.
   - Regenerate the CodeGen output in one run from a clean database, and don't edit inside it. That clears any hand edits in the generated blocks.
   - **The two migrations `next` has and PR #3 doesn't,** `V202609230200__v0.1.x__Staff_Filters_And_Files.sql` and `V202609230300__v0.1.x__File_RecordID_And_Conversation_Writes.sql`, held only metadata: the `Conversation Details In Reach` and `Files In Reach` filters, and permission updates. Task 1 moved those rows to `metadata/` (`row-level-security-filters/`, `entity-permissions/` and `entities/.ui-role-permissions.json`), and `a763b4f` deleted the files. The baseline's header says so, since `next`'s history still has them.
   - Every database that ran the old chain rebuilds from empty.
8. **B0.8. READMEs and screenshots.** Open. The old screenshots went in `6786bd0`, and `next` was merged in `625d24c`. PR #3 took the READMEs in `973c0ea`; the Angular one still calls the host an empty page (round 97).
   - The READMEs for the root and every package are written on the next pull request's branch. Take only those files, with `git checkout origin/claude/hopeful-bell-6ldk4v -- README.md 'packages/*/README.md'`, check each against the code, and keep them current as the B0 fixes and slice A land.
   - Slice A's shots stay under `docs/screenshots/pr3/ux/`.
9. **B0.9. Split the PR.** Dropped (D8): PR #3 merges whole.
10. **B0.10. UX conventions.**
    - **Done:** PascalCase inputs and `…Requested` events; type colors from `SpaceType.Color`, which the gallery's fixture keeps in one map; CI's chrome budget at 100 pixels; and diffs uploaded as a CI artifact, since the spec writes only to `e2e/test-results/`.
    - **`no-access.component.ts` stays.** The old file was deleted with the old UI in `77b36f4` and written again as the new `mjc-no-access`, on MJ's `mj-empty-state`, in `0c7096a`.
    - **The tokens, done in `002c2c5`:** they're defined on each widget's own `:host` from MJ's tokens (`COLLAB_TOKENS_CSS`, listed first in each component's `styles`), `--mjc-warn-bg` and `--mjc-warn-text` included, and the token check covers `--mjc-*` tokens. Until then nothing in a host defined them, so the band chip and the avatar rings drew their hex fallbacks in Explorer, dark mode included.
    - **Left (round 99):** remove the `var(--…, #hex)` fallbacks in the AngularWidgets and Angular sources (102 at `42569e2`, including the ones `COLLAB_TOKENS_CSS` gives each token), and the five widgets' `color: #fff`, which becomes `var(--mj-text-inverse)`; keep one source for the tokens, since `_tokens.scss` is a second copy that nothing includes; and drop the gallery's own copy at `:root` in `bundle.mjs`, so the gallery draws what a host draws.
11. **B0.11. Take the committee specifics out** (task 7's removal half, and the UI plan's gap 10). Partly done in `002c2c5`: the row is out of `metadata/space-types/`, the world has its own type, and the loader no longer looks for `committee`. `GovernancePanel` is left, for B0.7, and `phase0-seed.sql` falls back to the Workspace type silently.
    - `SpaceType.GovernancePanel` leaves the baseline, with its default and extended property, and the regenerated CodeGen output.
    - The `committee` row leaves `metadata/space-types/`. Its ID, `5FABEBE3-0207-4DB2-8B4C-8DAF0178A3C6`, is the one Committees ships in its own metadata (C1), so nothing here reuses it.
    - Keep the world's committee space for Dana's checks: RF3, RF4 and the world check, on both harnesses. Its type moves into the world's `types.csv` as a world-owned type, with a world code and a new ID, the way `world-workshop` is. `load-world.ts` stops looking for `committee`, and `phase0-seed.sql` stops relying on it.

**The tasks that stay,** by round 94's numbers:
- **Task 1,** metadata out of migrations: the rebuild from empty after B0.7, the core-entity list checked on slice A's screens as Bea, and other databases.
- **Task 2,** clients see only a person's name and email: the geocode columns `__mj_Latitude` and `__mj_Longitude`, which field rules can't restrict (an MJ change, A12.21, or a read model); what bizapps-common#186's release does to a host's own roles; and a check of the fields a participant can actually read, rather than of the rows.
- **Task 3,** assigning people seated above a space: done, except the assignee picker, which moves ([§ 2.4](#24-what-moves-to-the-next-pull-request)).
- **Task 4,** proving the room: the wire checks RM1 to RM6, with B0.2's sub-space check.
- **Task 5,** the test scaffolding: RM5's cleanup and the suites' tallies (round 98); the accepting side of every gate and the other gaps round 95 lists; checks that can't fail (FLS4, AG3 and AG5) made able to fail, or deleted; and a Playwright suite that signs in as each persona on slice A's screens.
- **Task 7's removal half:** B0.11.
- **Task 13,** the staff runs and the client harness over the wire, on PR #3's screens.
- **Task 14,** the adversarial test of what PR #3 ships.
- **Task 16,** the smoke suite and the tour, on slice A's screens.
- **Task 17,** the wrap-up: reload the world on a clean database, run everything, and post the tour.

**The order to work it** (round 99's):
1. MJ's components in the widgets, then CI's budgets.
2. Task 15: the slice A map's second pass, then slice A on real data: its data layer, the host and the composites, the widgets' text color, the widget fixes, the frames within tight budgets, and new live shots.
3. Task 5's coverage for PR #3's gates, RM5's cleanup and the suites' tallies, with task 2's leftovers.
4. B0.7's squash, then task 1's rebuild from empty.
5. B0.5, B0.8, B0.10 and B0.11.
6. Tasks 13, 14, 16 and 17.

### 2.4 What moves to the next pull request

Round 95's list, and where each item lands here:
- **Task 6, the agent and chats** (B2 and B3): the real agent run replacing the fixed reply, retrieval by audience, the scope control in private chats, chats in a space, and per-space agents and knowledge. What's done stays in PR #3: the agent's metadata, its bounded scope, and the retrieval module, with B0.2's fix.
- **Task 7's extension points** (B8).
- **Tasks 8 and 9, closure and retention,** become B8.2's `PostCloseAccess` and `PostCloseAccessDays`, with `ReadOnlyWithAgent` as task 9's agent for former clients.
- **Tasks 10 and 12,** starting a plan from a template and what's left of bizapps-tasks#73 (merged), go with the Work tab (slice E).
- **Task 3's assignee picker** goes with the Work tab too. PR #3 has no picker: the old one (`assigneeScope`, in `space-workspace.component.ts`) went with the old UI in `77b36f4`. Build the new one so that:
  - it can offer Ada to Bea. The old walk went up only through the spaces the client had loaded, and `Collaboration: Visible Spaces` doesn't return Northwind to Bea, so it stopped at Discovery. Load those rows for the walk without adding them to Bea's space list, or have the server return who a space can assign;
  - it reads the switch on the task's own space: with Field notes on and Discovery off, a Discovery task mustn't offer Ada.
- **Task 4's last step,** Bea opening the room's own screen with no console errors, goes with slice B.
- **The agent checks AG3 and AG5,** which can't fail as written, are replaced by B2.6's matrix.
- **Task 15's slices B to I** (B13): frames 01 and 05 to 13, with the UI plan's gap 2 (tab labels per type) and gap 9 (the Assistant's settings). The five chat widgets PR #3 added in `6786bd0` (`answer-receipt`, `chat-banner`, `chat-lens`, `chat-list` and `space-chats`) left PR #3 in `002c2c5`. Whether slice B reuses them waits on Amith.
- **v0.3's B1 to B13, and workstreams A and C,** including the extensibility plan's two MJ pull requests (A13).

## 3. Decisions

### 3.1 Standing decisions

- **Single-tenant per deployment** (2026-09-21) and **free** (2026-09-22).
- **An Open App, not a core primitive.** Core can't depend on an app, so a core Space couldn't use bizapps-tasks. Resource types and permission domains are metadata catalogs, so an app loses nothing.
- **Two bands from day one,** Team and Shared. Bands don't nest. An item belongs to exactly one space.
- **One agent people talk to, configured per space** (Amith, 2026-09-25): base instructions, knowledge and skills can be added to a space, so the same agent knows more, or does more, there.
- **Chats** (Amith, 2026-09-25 and 09-26): anyone in a space can start one; an agent answers when tagged, or to every message in a chat that holds one person and one agent; each space has a list of allowed agents. The rules are the [extensibility plan's § 8](../docs/EXTENSIBILITY_PLAN.md#8-chats-history-and-agents).
- **Clients** see only a person's name and email, and may assign people seated above their space, behind a switch staff control (round 94).
- **Committees is a plug-in** on top of Collaboration, built after Collaboration is done (2026-09-26).

### 3.2 The design review of 2026-09-26

These are v0.3's decisions. They change v0.2's doctrine.

**D1. Sub-spaces don't only narrow.** v0.2 said sub-spaces narrow permission and retrieval together and never widen either. That's wrong for real organizations. A board space can have a compensation committee sub-space holding material most directors must not see, while a director who sits on both must be able to work across both.
- **Reach is unchanged.** An active seat reaches its space and every descendant that inherits (`InheritsMembership = 1`). A sealed sub-space (`InheritsMembership = 0`) is reached only by its own seats. That's built: `fnCollaborationAccess` and `membershipReaches`.
- **What a person can read is the union** of everything their seats reach, anywhere in the tree, not the subtree of the page they're on.
- **A parent seat never reaches into a sealed child** through the tree. The union is over seats, not over the tree; otherwise sealing means nothing.
- **Add `SpaceType.DefaultInheritsMembership`,** a column like `DefaultAllowParentAssignees`, so a committee type such as Compensation or Audit can default to sealed. Today `Space.InheritsMembership` defaults to 1, and nothing on the type overrides it.

**D2. The audience of an answer decides the agent's retrieval scope.** The variable isn't where the person is standing. It's who will see the answer.

| Conversation | Retrieval scope | Who can change it |
|---|---|---|
| **Private:** one person, plus agents | The caller's union of reach (D1), optionally narrowed | The person, with a scope control: *this space*, *this space and its sub-spaces*, or *everything I can reach* |
| **Shared:** two or more people | The intersection of what every current participant can read | Nobody, the asker included. It's a property of the room. |

- In both, the agent runs as the asking user, never as a service account. The asker's access is the ceiling.
- In a shared conversation, each candidate must also pass a read check for every other participant. The space bound is a fast pre-filter; the per-participant check is the rule.
- Bands apply per participant: a shared conversation that includes anyone who can't see Team uses Shared material only.
- A space's `AgentRetrieval` still applies (`ExcludedFromParentScope`, `ExcludedEntirely`).
- The agent's own memory follows the same rule. In a shared conversation it doesn't inject the asker's personal notes (A6.4).
- This extends the extensibility plan's subtree bound: a private chat uses the caller's union with a scope control, and a shared chat uses the intersection.

**D3. Provenance is recorded when an answer is generated, on every answer, permanently.** Every agent-produced message and every artifact version records the resources it drew from: entity and record, file, artifact version, content item and search hit. It can't be reconstructed later, so the write path pays for it. Provenance serves three purposes:
- **citations** shown to the reader;
- **sealing** when the audience changes (D4);
- **audit:** "zero cross-band retrievals" is a KPI that can't be measured today.

**D4. Adding a person to a conversation doesn't grant them its history.** When a participant is added, any AI message whose recorded sources the newcomer can't read is sealed for them. They see that the message exists, who wrote it and when, and a *Request access* action routed to the owner of the source space. They don't see the content.
- **Rejected: blanket consent.** Adding someone would silently grant retroactive access to a transcript nobody reviewed.
- **Rejected: silent filtering.** The newcomer would read a transcript with holes and not know it.
- **People's own messages aren't sealed.** Someone who pasted something into the room disclosed it, as they could anywhere. That's a training issue, not something this plan tries to stop.
- **Maybe later:** an explicit *Disclose to this conversation* action on a sealed message, taken by someone who can read its sources, and recorded in the audit log.

**D5. Copying agent output warns when it crosses an audience boundary.** When someone copies or forwards an answer whose provenance includes material the target audience can't read, the UI warns. It's advice, not a block.

**D6. Outside channels carry a real identity or they refuse.** A space-scoped agent exposed through MCP, Slack or Teams must resolve the human to an MJ user and apply D2 for the channel's audience. A channel with several people is a shared conversation. If the identity can't be resolved, the space-scoped agent refuses. Today the messaging adapters fall back to a service account (`MessagingAdapters/src/base/BaseMessagingAdapter.ts:565–596`), and MCP's `mode=none` and the system API key run as the system user (`AI/MCPServer/src/auth/AuthGate.ts:183–200`).

**D7. Proactive agent messages to outside participants go through a person.** The engine provides a generic *proposed post*: an agent drafts a message into a space, a named staff member approves or edits it, and only then is it posted. It's built on AI Agent Requests (A8). Digests a member subscribed to need no approval. Everything else unsolicited does.

### 3.3 Decided after v0.3, on 2026-09-26

**D8. Two pull requests.** PR #3 finishes and merges whole; everything new goes in the next pull request ([§ 2.1](#21-two-pull-requests)).

**D9. Committees extends Space through IsA, in stages.**
- `Committee` and `Term` extend `Space` through IsA, disjoint, with `Committee.ID = Space.ID`, as [Committees' rebuild plan](https://github.com/MemberJunction/bizapps-committees/blob/next/plans/COLLABORATION_REBUILD_PLAN.md) says.
- v0.3's staging holds: C0's fixes first; 1.5 backfills a space per committee with the committee's own ID and syncs the seats; 1.6 adds row-level security and the extension points; 2.0 declares the IsA and drops the duplicated columns ([§ 8](#8-workstream-c-committees-on-collaboration)).
- v0.3's `Committee.SpaceID` is replaced by the shared ID everywhere.

**D10. A chat's people are core participants.**
- **MJ core gains `MJ: Conversation Participants`** (A5). No such table exists in MJ 6.1.3, or on MJ `next` as of 2026-09-25. The nearest things are `MJ: AI Agent Session Bridge Participants` (realtime and meeting bridges), `Conversation.UserID` (the owner) and Resource Permission shares.
- **Collaboration keeps `SpaceChat`:** the space link, `Kind` (`Room` or `Chat`), `Name`, the subject record and `Status`. A chat's people are core participants, and `SpaceChatMember` goes.
- **The adder's history choice** (none, all, or since a time) sets each new participant's window. It's proposed as a `HistoryFrom` column on core's participants, so core row-level security enforces it for everyone, staff included.
- **Inside that window,** D4 and A7 seal the AI messages whose recorded sources the newcomer can't read.
- **`ng-conversations`' `HistoryFrom` input,** a cutoff drawn only on screen, is no longer needed. `AgentHistoryFrom`, the agent's floor, stays, under A6 and A7.
- **Where a chat's agents are recorded** is a detail for the next pull request's first design comment: an `AgentID` on core participants, or a row on Collaboration's side.

**D11. The MJ pull requests wait.** The extensibility plan's two MJ pull requests aren't opened now. They're opened during the next pull request's work, in parallel, once the builder is on it. They're A13 below.

**D12. The next pull request merges once, when it's 100% done.** It doesn't merge stage by stage. After PR #3 merges, it's retargeted to `next`, and the builder works directly on its branch, `claude/hopeful-bell-6ldk4v`. The plan's author pushes only plan and document updates there, and reviews of the builder's code stay comments.

**D13. Every new user gets the Collaboration app.** `DefaultForNewUser` is true in `metadata/applications/`. PR #3 sets it. The app's roles still decide who can open it.

## 4. The model

**What Collaboration composes.** It adds the container and uses what MemberJunction and the sibling apps already have:

| Capability | Substrate | What Collaboration adds |
|---|---|---|
| Messaging | `ng-conversations` over `MJ: Conversations` and `Conversation Details`, threaded by `ParentID` | A space's room and chats (B3) |
| Agents | MJ's agent framework, `@` mentions and Scoped Search | The space's scope, the audience (D2) and per-space settings |
| Work | bizapps-tasks: task links, several assignees, lifecycle hooks, templates, dependencies, board and gantt | Tasks filed in a space |
| Library | `MJ: Files` and the storage drivers | Space scoping through `SpaceItem` |
| Sharing | `MJ: Resource Permissions`, a seeded `Space` resource type, and a permission domain | The roster answers the domain |
| Notifications | `NotificationEngine` | Share notices |
| E-signature | `MJ: Signature Requests`, polymorphic on entity and record | Point it at a `SpaceItem` |

**The entities today** (schema `__mj_BizAppsCollaboration`, entity prefix `MJ_BizApps_Collaboration: `):
- **`SpaceType`:** metadata, not code. Vocabulary, panel flags, defaults for band, retention, agent retrieval and parent assignees, invite approval, member cap, a tile icon and color, and the community axes `Discoverability` (`Hidden`, `Listed`, `Open`) and `JoinMode` (`InviteOnly`, `RequestToJoin`, `SelfServe`).
- **`Space`:** the container. `ParentID` for the tree, `OwnerID`, `InheritsMembership`, `StartedAt`, `PlannedCloseAt`, `ClosedAt`, `Retention`, `AgentRetrieval` and `AllowParentAssignees`.
- **`SpaceMember`:** one roster for staff and outside people. A role, a band from the role, and a status: `Invited`, `Active` or `Removed`.
- **`SpaceRoleType`:** flags the engine reads (`Level`, `MaxGrantableLevel`, `CanInvite`, `CanPromoteBand`, `CanSeeTeamBand`, `IsOwnerRole`, `CanContribute`), never a role name.
- **`SpaceItem`:** `EntityID` and `RecordID`, a band, a promotion stamp and a folder.
- **`ItemUse` and `ShareNotice`:** who opened, uploaded or promoted an item, and who was told about a share.

**Invariants.**
- **An item belongs to exactly one space.** The unique key on `EntityID` and `RecordID` enforces it. Move an item; never copy it.
- **Bands don't nest.** A Team item in a child space is Team.
- **The engine reads flags, never names.**

**What this plan adds** is designed in the extensibility plan and in B8: type drivers and subtypes, configuration bags, chats and allowed agents, `DefaultInheritsMembership`, `PostCloseAccess`, knowledge bindings, `SpaceMember.PersonID`, and the lifecycle and signal contributions.

**Two siblings stay siblings.**
- **`MJ: Collections`** is right for folders and browsing but not for membership. It holds artifact versions only, shares with users only, and writes inheritance into each descendant instead of computing it. `SpaceItem` stays the library's spine. A12.10 is the Collections work.
- **BizApps Secure Messaging** stays a sibling, not a dependency: it's one-to-one by construction and published at 2.0.0. If a space needs its File Requests, lift the fields rather than take the dependency.

## 5. The security doctrine

This section replaces v0.2's § 5 and § 6.

### 5.1 The ceiling

The caller's own access is the ceiling, and nothing exceeds it. The space narrows within it; it never grants. An agent runs as the asking user (D2). An agent running as a service account would make membership itself the grant, and any membership bug a breach.

### 5.2 Reach, seats and bands

- **Reach (D1):** an active seat reaches its space and each descendant that inherits. A sealed sub-space is reached only by its own seats. A person reads the union of what their seats reach.
- **The nearest seat governs** when two paths reach the same space: its role's flags apply.
- **Bands:** Shared items are visible to anyone who reaches the space. Team items need a reaching role with `CanSeeTeamBand`. Moving an item between bands needs `CanPromoteBand`, and a Shared item records who promoted it and when.
- **One walk, three places:** `membershipReaches` in `collaboration-core`, the server's write gates, and `fnCollaborationAccess`. `fnCollaborationTasks` and `fnCollaborationAncestorMembers` build on the same walk. Don't fork the walk again (B2.2).

### 5.3 What an agent may use

> an agent's candidates = the audience's readable set (D2) ∩ each participant's band ∩ `AgentRetrieval` ∩ the scope control (private conversations only)

- **The audience's readable set** is the caller's union of reach in a private conversation, and the intersection over every participant in a shared one.
- **`AgentRetrieval`** is the axis permissions alone can't express: material a person may read that no agent may quote. `ExcludedFromParentScope` drops a space's items when the question comes from above it; `ExcludedEntirely` drops them for every agent.
- **`agentMayQuote`** is called on every candidate, on the server, and every refusal goes to the access log with its reason (B2.5).
- **Knowledge** beyond the space's items comes only from the Content Sources bound to the type or space (B8.2), under A10's classification.

### 5.4 Provenance, sealing and copying

D3 to D5 are built in A4 (provenance on every answer), A7 (sealing on a change of audience) and B4 (receipts, citations, sealed messages and the copy warning).

### 5.5 Where the boundary lives

- **Row-level security on Collaboration's own entities,** not a search scope alone. MJ's full-text lane can't carry a scope filter, but it runs RunViews as the caller, so row-level security applies there. The scope filter then only narrows.
- **One filter per entity** for the participant role, never NULL. A NULL filter on any grant a person holds exempts them from row-level security for that operation.
- **`{{UserID}}`** is read through `TRY_CAST`, so a missing token matches nothing instead of raising a conversion error.
- **The filter text is T-SQL,** with bracketed schema names. A PostgreSQL host needs its own dialect (B11).
- **`fnCollaborationAccess` becomes a published contract** when subtypes filter through it (the extensibility plan's § 11). Changing its name, arguments or columns is then a breaking change.

### 5.6 Writes

- **Writes are checked by `BaseEntity` subclasses,** in `ValidateAsync`. A subclass is the only place a rule reaches MJ's generated mutations, the API and MCP alike.
- **`isNew` is load-bearing.** On an insert, no field is dirty, so a rule keyed on dirtiness misses the forged path.
- **No constructor on a gate.** A throwing constructor makes MJ fall back to the plain class, and the gate vanishes.
- **The rules are pure functions** in `collaboration-core`, testable with no MJ loaded. A refusal names the rule, not the row.
- **The participant role also carries create and update filters,** for tasks and notices. MJ 6.1.3 checks a create filter on every new row, before and after the before-save hooks. Each filter needs a check that proves it (B0.3).

### 5.7 The participant role

- **Never give a participant MJ's `UI` role.** Row-level security fails open: a user is exempt the moment any role they hold has a grant on the entity with a NULL filter, and `UI` carries many of them.
- **One participant role with one filter per entity.** Role filters combine with OR, so a second role can only widen.
- **The shell's startup grants disclose nothing.** MJ's client engines load a fixed set of core entities at startup, all or nothing. The participant gets an empty read (`1 = 0`) on each, regenerated on every MJ upgrade, and its own rows on the six the shell writes.
- **`MJ: Application Roles` is a front door, not a vault.** An application with no role rows is open to everyone, and the check is client-side (A12.8). Treat application access as reachability.
- **Another app's defaults become yours.** Audit every role a participant can hold before the first outside user exists.

### 5.8 Lanes row-level security doesn't reach

- **Root `All<Entity>` queries.** Collaboration generates none: every entity keeps `AllowAllRowsAPI` at 0, and `persona-check.sql` asserts it.
- **`RunQuery`, datasets and reports.** A stored query this app ships carries its scope predicate inside its own SQL.
- **A resolver that reads by a client-supplied id.** That's a gate site, always. MJ's storage routes are one (A12.16).
- **MJAPI's `cacheInvalidation` subscription,** which sends every saved row to every signed-in socket (A12.13).
- **A client filter that calls `fnCollaborationAccess`** can probe another person's reach (A12.9).

### 5.9 Scope guardrails

- **`RequiredMetadataKeys`** names the columns a rendered filter must still mention, so a clause that vanished because a token didn't resolve skips the lane instead of widening it.
- **`restricts: true`** on a scope dimension discards a value the caller supplied, so the model writing the tool call can't choose which space it searches.
- **`ExplainScope`** reports `Unbounded: true` for a scope with no lanes, which is the widest scope there is. Assert it in CI.

### 5.10 Outside participants

| Participant | Door |
|---|---|
| Staff | A normal MJ user with a staff role |
| A recurring outsider: a client team, an outside director | The `Space Participant` role, scoped by row-level security. The default. |
| A one-off reviewer | A magic link of kind `resource-share`. Not built; it needs A12.7. |
| An account-less one-to-one exchange, with no space | BizApps Secure Messaging |

- **Identity is invite-based** (B9). An invitation creates or links an MJ user with the participant role, linked to a Person when one exists.
- **Participants invite participants.** That's a write rule, in `SpaceMemberEntityServer`. The signer is an active member who reaches the space, their role has `CanInvite`, and the granted role's level is at most their `MaxGrantableLevel`, with no flag they don't hold. A change to someone else's seat also needs that seat's current role to pass the same two tests against the signer's ceiling (B0.1).

### 5.11 Test with a persona

A green unit suite won't see these findings; a persona driven through a browser and over GraphQL will. The exit criterion for every stage is each persona in [§ 10](#10-verification) seeing exactly what it should, on every lane.

## 6. Workstream A: MemberJunction core

**What exists today.** Agent runs are richly logged (runs, steps, prompt runs, action logs), but nothing structured records which resources a run read: inputs survive only as text inside a step's `OutputData` and a prompt run's `Messages`. Artifacts and conversation messages have no provenance fields. Conversations have no participants table: the audience is the owner plus Resource Permission shares, applied as a filter in the app layer, not row-level security. Every agent, search and permission path assumes exactly one user (`AI/CorePlus/src/agent-types.ts:1054`).

### A1. Ambient run context

Add a run context based on `AsyncLocalStorage`, carrying `AgentRunID`, `AgentRunStepID`, the acting user and the audience (A6). `BaseAgent` sets it for the life of a run and of each step; sub-agent runs nest.
- Nothing like it exists in `AI/Agents` or `MJCore` today.
- **Accept:** a RunView, entity load, search or file read issued anywhere inside an agent step can read the current run and step IDs, with no change to any call signature. A unit test covers nesting and parallel steps.

### A2. Resource access log

A new entity, **`MJ: AI Agent Run Resource Accesses`**: `AgentRunID`, `AgentRunStepID`, `AccessKind` (`RunView`, `Load`, `Search`, `File`, `Action` or `Query`), `EntityID`, `RecordID`, `FileID`, `ArtifactVersionID`, `ContentItemID`, `SearchExecutionLogID` and `AccessedAt`. Rows are written at the choke points, only when A1's context is present:

| Lane | Hook point |
|---|---|
| RunView | The global `PostRunView` data hook (`MJCore/src/generic/dataHooks.ts:37`, called at `providerBase.ts:1099`, registered in `MJServer/src/index.ts:851`). Log the returned keys, capped per call, with a truncated flag. |
| Entity load | `BaseEntity`'s load path on the server. The generated resolvers log "Record Accessed" (`MJServer/src/generic/ResolverBase.ts:1336`), but an agent's loads on the server skip it. |
| Search | `SearchEngine.Search` after `filterByPermissions` (`SearchEngine/src/generic/SearchEngine.ts:482`). Log each surviving hit. |
| Files | Above the storage drivers. `FileStorageBase.GetObject` and `CreatePreAuthDownloadUrl` (`MJStorage/src/generic/FileStorageBase.ts:739`, `:547`) don't know the user, so log at the MJ Files layer that calls them. |
| Actions | Action execution logs already carry `TargetEntityID` and `TargetRecordID` for entity actions (`E:60723–60736`); link them. |
| RunQuery | Log the query ID, and the returned keys when the query declares a key column. |

- Batch the inserts: no round trip per record. Retention is configuration.
- **Accept:** for a test run that performs a RunView, a load, a search, a file read and an action, the run's access rows list every resource read and nothing it didn't read. Load test: under 5% overhead on a 1,000-row RunView.

### A3. Search execution logs

`MJ: Search Execution Logs` (`E:114281`, written at `SearchEngine.ts:2175–2232`) stores the query, user, agent, counts and scope decision, but no hit IDs and no run ID.
- Add `AgentRunID`, and a child table (or JSON) of the returned hits: `EntityID`, `RecordID`, `SourceType`, `ProviderId` and `Score`. `SearchResultItem` already carries these in memory (`SearchEngine/src/generic/search.types.ts:430–470`).
- **Accept:** a search made inside an agent run can be joined to the run, and its hits listed.

### A4. Provenance on outputs

- **Add `AgentRunID` to `MJ: Conversation Details`.** Today the only link is the reverse one, `AIAgentRun.ConversationDetailID` (`E:42234`).
- **A new `MJ: Conversation Detail Sources`:** `ConversationDetailID`, `EntityID`, `RecordID`, `FileID`, `ArtifactVersionID`, `ContentItemID`, `SourceSpaceHint` (a nullable string for apps), `CitationOrdinal` and `WasQuoted` (cited in the text, versus consulted).
- **A new `MJ: Artifact Version Sources`,** the same shape keyed on `ArtifactVersionID`, plus `DerivedFromArtifactVersionID`, so provenance carries forward when an artifact is built from another.
- **Fill both automatically at the end of a run** from A2's rows, and let an agent mark which sources it actually quoted.
- Artifacts have no run link or source fields today (`E:65118`, `E:64824`); the only path is artifact version, then Conversation Detail Artifacts (`E:75710`), then the detail, then the run. AI Agent Notes already model provenance well (`SourceConversationID`, `SourceAIAgentRunID`, `DerivedFromNoteIDs`, `E:38750`). Copy that idiom.
- **Accept:** every AI conversation detail `AgentRunner` creates has an `AgentRunID` and source rows. An artifact version built from another lists its own sources and its parent version.

### A5. Conversation participants

A new entity, **`MJ: Conversation Participants`:** `ConversationID`, `UserID`, `Role` (`Owner`, `Member` or `Observer`), `AddedByUserID`, `AddedAt`, `RemovedAt` and `HistoryFrom` (D10).
- **It becomes the audience of record** for D2 and D4. The owner and Resource Permission shares keep working, and they write participant rows.
- **Reads of `Conversations` and `Conversation Details` go through row-level security keyed on participants.** Today it's a filter in the app layer (`MJCoreEntities/src/engines/conversations.ts:769–809`), and the only Conversations row-level security belongs to the Widget Guest role.
- **`HistoryFrom` is the first moment of the conversation a participant sees.** The person who adds someone chooses none (the moment they're added), all (empty), or a time. Core row-level security applies it for everyone, staff included, so no screen-side cutoff is needed.
- **Agents in a conversation:** an `AgentID` on this table, or a row on the app's side. Settled in the next pull request's first design comment (D10).
- **Apps can derive participants.** Collaboration's room derives them from the space's roster and band (B3). The only roster-like entity today is `MJ: AI Agent Session Bridge Participants` (`E:43108`), which is for meetings.
- **Also on MJ's list for chats with several people:** editing, deleting and answering forms are allowed to the conversation's owner rather than a message's author.
- **Accept:** someone who isn't a participant can't read a conversation or its details through RunView, GraphQL or the full-text lane, and a participant can't read details from before their `HistoryFrom`.

### A6. Agent runs bounded by an audience

1. **`ExecuteAgentParams.Audience`:** `{ Principals: UserID[], Mode: 'Caller' | 'Union' | 'Intersection', Anchor?: { EntityID, RecordID }, Narrowing?: … }`. `Caller` is today's behavior and the default.
2. **A permission primitive, `CanAllRead(resource, principals)`,** that applies the entity's CanRead plus each principal's effective row filter (`GetEffectiveRowFilterWhereClause`). For RunView, it's an extra predicate. For search, it goes in `filterByPermissions` (`SearchEngine.ts:1918–2030`). Storage hits rely today on the storage lane's own check (`SearchEngine.ts:1924`); under `Intersection`, refuse them until they can be checked per principal.
3. **Search scopes:** `expansionQueryID` binds one user (`search.types.ts:199–203`). Run it per principal and intersect.
4. **Agent memory:** `agent-context-injector.ts:264` injects notes whose `UserID` is empty or the asker's. Under `Intersection`, inject only notes with no user, or with a scope every participant shares.
5. **Resumed runs:** a responded AI Agent Request resumes the run as the responder (`AI/Agents/src/MJAIAgentRequestEntityServer.ts:49–71`). Record the audience on the run, and resume with the same audience.
6. **Realtime, voice and bridge sessions** carry one `ContextUser` (`AI/Agents/src/realtime/realtime-turn-moderator.ts:62`, `AI/RealtimeBridge/Server/src/ai-bridge-engine.ts:198`). With more than one person in the session, the audience is `Intersection` over the bridge's participants.

- **Accept:** user X can read resource R and user Y can't. X alone asks: R is used. X and Y in one conversation ask: R isn't retrieved, isn't quoted, and isn't in the run's access log. The same holds over GraphQL, MCP and a realtime session.

### A7. Sealing on a change of audience

When a participant is added (A5), each AI message inside their `HistoryFrom` window is checked: can the newcomer read every source in its A4 rows? If not, the message comes back as a placeholder: its author and time, "Sealed: uses material you don't have access to", and a *Request access* action.
- **Sealing is worked out when the message is read,** against current permissions. It's not a stored flag, so a later grant unseals the message.
- **Messages with no source rows** (from before A4) are sealed for newcomers when the conversation is linked to a record that declares itself sensitive, and shown otherwise. That's a setting (decision 4).
- **Accept:** D4's scenario works over GraphQL and in `ng-conversations`. Sealed content never reaches the client, including through the full-text lane and a detail's attachments.

### A8. Approval-gated agent posts

A generic *proposed post*, built on AI Agent Requests (`E:40377`; types Approval, Information, Choice, Review and Custom). The agent creates an Approval request holding the draft. On approval, the post is written as the agent into the target conversation. On edit and approve, the edited text is posted, and the edit is recorded.
- **Accept:** an agent can queue a post; nothing reaches the conversation until a named approver acts; the audit shows who approved what.

### A9. Identity on outside channels

- **Messaging adapters:** a per-agent setting, `RequireResolvedUser`. When it's set, a sender who doesn't resolve gets a refusal, not the service account.
- **MCP:** an agent flagged as scoped can't run in a system-user session.
- **Slack and Teams channels with several people** map to a conversation with participants (A5): the channel's roster is the audience. People in the channel with no MJ user make the audience unresolvable, so the agent answers only from knowledge classified as safe for everyone (A10).
- **Accept:** a scoped agent in a mixed channel with an unknown member returns no space material.

### A10. Knowledge-base classification

Content Sources, Content Items and chunks have no access or owner fields (`E:74237`, `E:72340`, `E:71518`). Add a `Classification` on Content Source (`Public`, `Organization` or `Restricted`), and derive a per-item read check from the source record when `EntityID` is set.
- An organization's published knowledge (its methodology, published case studies, a learning library) is `Organization` or `Public` and may be quoted to any audience the agent serves. That's what lets a firm's agent bring its own knowledge into every client space without leaking one client's material to another.
- **Accept:** retrieval under `Intersection` includes `Public` items, and includes `Organization` items only when every principal belongs to the organization.

### A11. Gaps in read auditing

An agent's loads and RunViews on the server skip the "Record Accessed" audit (`GenericDatabaseProvider.ts:2176`, `:4755`; `ResolverBase.ts:1336`). A2 closes that for agent runs. Also make `AuditRecordAccess` apply to server-side loads when the entity asks for it.

### A12. The rest of MJ's list

v0.2's § 8 and round 94's "Not in this PR" list, merged. Items 1 to 12 keep v0.3's numbers; 13 onward are added. The priority says when each is needed.

| # | Item | Priority |
|---|---|---|
| A12.1 | **Search: the storage bypass.** `filterByPermissions` starts from the storage results (`SearchEngine.ts:1926–1930`), so storage hits skip the safety net. Accounts with no permission rows are readable by everyone, and the permission list is cached for the whole process under the first user who configures it. | Fix first (stage 1) |
| A12.2 | **Search: trust and lane filters.** External-index providers declare `SourceType='fulltext'` and are admitted unverified whenever the labelled entity has no row filter. A scope with no provider rows runs every provider, and the full-text, semantic and storage providers ignore the lanes' filters. | Fix first (stage 1) |
| A12.3 | **An @mention notifies the person.** The parser emits `userMentions`, and nothing consumes them. | Stage 5 |
| A12.4 | **Read state per person** on conversations. | Stage 5 |
| A12.5 | **Presence and typing.** | Stage 5 |
| A12.6 | **Live message fan-out** over the LiveKit data channel. The one large build. | Stage 5 |
| A12.7 | **`CreateInvite` accepts a resource ID and an issuer hook,** for the one-off reviewer's `resource-share` link. | Stage 5 |
| A12.8 | **A server-side check of application access.** | Stage 5 |
| A12.9 | **The client filter screen** treats table functions such as `fnCollaborationAccess` as tables, so a client filter can't probe another person's reach. | Stage 5 |
| A12.10 | **Collections:** Role and Team grantees, computed inheritance, and a seeded Resource Type. | Stage 5 |
| A12.11 | **`mj-conversation-chat-area`:** a `composerTools` slot, and a way to draw sealed messages and citations from A4 and A7. Part of A13.1. | With B3 and B4 |
| A12.12 | **The copy warning (D5)** in `ng-conversations`, driven by A4. | With B4 |
| A12.13 | **MJAPI publishes every saved row, whole** (`RecordData`), on the `cacheInvalidation` GraphQL subscription, which has no filter. Every signed-in socket gets every save, which bypasses row-level and field-level security. Round 94's task 14 records it. | **Urgent** (stage 1) |
| A12.14 | **Scoped Search takes its scope from the model's parameters** instead of the run. | Before dogfooding (stage 3) |
| A12.15 | **`RunAIAgent` accepts scope and agent-type settings** from the caller's `data`. | Before dogfooding (stage 3) |
| A12.16 | **The storage routes:** `CreatePreAuthDownloadUrl` and `SearchAcrossAccounts` check only entity-level Read on `MJ: Files`, then act on a storage account and key the client supplies, so the row filter never applies. | Before dogfooding (stage 3) |
| A12.17 | **An `IsPermissionConstrained` check before `AIEngineBase.Instance.Agents`** in `ng-conversations`. A participant's room throws on every agent message until it ships. | With B3 |
| A12.18 | **Opening a custom resource type,** such as a Space, from the notification bell. | Stage 5 |
| A12.19 | **Hiding MJ's chat overlay** for participants. | Stage 5 |
| A12.20 | **The CodeGen `\b` bug.** | Stage 5 |
| A12.21 | **Restricting geocode `__mj_` columns,** if round 94's task 2 goes that way. | With task 2 |
| A12.22 | **An `ItemTemplate` input on `mj-left-nav`, and an avatar component,** to retire two of the UI plan's local builds. | Stage 5 |

### A13. The extensibility plan's MJ pull requests

Opened during the next pull request's work, in parallel (D11). The designs are in the [extensibility plan's § 9](../docs/EXTENSIBILITY_PLAN.md#9-mj-changes).

- **A13.1. `ng-conversations`: host rules for chats with several people.** Redesigned together with A5, A7 and A12.11.
  - **Dropped:** the `HistoryFrom` input. Core participants enforce the window (A5).
  - **Kept:** `AgentReplyMode`, `AllowedAgentIDs`, `MentionPeople`, the reworked `beforeAgentTurn`, `AgentTurnHandler`, `AgentHistoryFrom`, and the composer slot.
  - **Added:** drawing sealed messages (A7) and citations (A4).
- **A13.2. MJ core: knowing a subtype on load.** As written in the extensibility plan's § 9.2.
- **A13.3. The rest of its MJ list:**
  - subtype discovery over GraphQL isn't permission-checked, so any signed-in user can learn which subtype a record has;
  - a parent's read filter doesn't reach its subtypes' views;
  - a loaded record never looks for its subtype again when it's reloaded.

## 7. Workstream B: Collaboration

### B0. Land PR #3

B0 is PR #3's finish line. [§ 2.3](#23-pr-3s-finish-line) lists each item with its status at `b539790`.

### B1. Rewrite the doctrine

This plan and `docs/HOW_THE_SYSTEM_WORKS.md` state D1 to D7: the union of seats and the audience rule, with "sub-spaces never widen" removed. Both are written, in the next pull request's first commits, with each rule in `docs/HOW_THE_SYSTEM_WORKS.md` marked built or planned. The READMEs describe only what's built, and follow each rule when its behavior ships.

### B2. Retrieval by audience

1. **Pure rules** in `collaboration-core`: `effectiveRetrievalScope({ audience, mode, anchor, narrowing })` returns the reachable spaces and the band for each principal. Private is the caller's union; shared is the intersection. Unit-test [§ 10](#10-verification)'s matrix.
2. **SQL:** `fnCollaborationCommonAccess(@UserIDs)` returns the spaces every listed user reaches, with `CanSeeTeam` only when every user can. Keep one walk; don't fork the reach logic again.
3. **Wire it to A6.** The space's agent runs through MJ's agent framework, with `Audience` set by the conversation's participants. A real agent run replaces the room's fixed reply (`post-space-message.ts:136–139`), in whatever form B0.2 leaves it. The agent, prompt, skills and search scope already in `metadata/` start being used.
4. **A scope control in private chats:** *this space*, *this space and its sub-spaces*, *everything I can reach*. The default is *this space and its sub-spaces* when the chat is opened from a space, and *everything* from Home.
5. **`agentMayQuote`** is called on every candidate, on the server, and every refusal is written to the access log with its reason.
6. **Accept:** [§ 10](#10-verification)'s matrix passes on both harnesses. It replaces the agent checks AG3, AG5 and AG6, which can't fail as written.

### B3. Conversations in a space

- **Chats** follow the [extensibility plan's § 8](../docs/EXTENSIBILITY_PLAN.md#8-chats-history-and-agents), with D10: `SpaceChat` holds the space link, kind, name, subject and status, and a chat's people are core participants (A5).
- **The room's participants** are derived from the space's roster and band: everyone who reaches the space, or only those who see Team. The chat banner (`mjc-chat-banner`) shows that audience.
- **A private chat** holds one person and the agent, linked to the space for context.
- **Posting:** members don't post into conversations today, because core's detail gate is wrong (v0.2's § 9). With A5's row-level security, participants can post.
- **A newcomer** to a room or a chat, or a new seat on a space, triggers A7's sealing inside their window.

### B4. Provenance in the UI

- `mjc-answer-receipt` and `mjc-citation-chip` (frames 05, 11 and 12) draw A4's source rows: "Used 3 Shared items", each linked.
- Sealed messages draw as A7 describes, with *Request access*, which creates a request to the owner of the source space.
- The copy warning (D5).

### B5. The space agent outside the portal

- **MCP:** expose the space agent with a scope bound to one space, or to a client's root. The MCP session's user must resolve to a member (A9).
- **Slack and Teams:** bind a channel to a space. The channel is a shared conversation, with its members as participants. Messages are recorded as MJ conversations linked to the space, so they appear in the portal and staff can see them.
- **Accept:** the same question asked in the portal, over MCP and in a bound Teams channel gets answers bounded the same way for the same audience.

### B6. Digests and subscriptions

v0.2's *Summarize*, built generically: a member subscribes to a weekly or monthly digest of what changed within their reach and band. It's delivered through `NotificationEngine`, honoring notification preferences. A digest the member asked for needs no approval (D7).

### B7. Proposed posts

A8 in the space: a staff member sees *Proposed by the Assistant* items in *Needs you*, and can edit, approve or discard each. An approved post appears in the room as the Assistant, with a "reviewed by" line.

### B8. Extension points

The contract for Committees and for private extensions. The design is the [extensibility plan](../docs/EXTENSIBILITY_PLAN.md).

**Today:** `BaseSpaceTab` and `BaseSpaceOverviewCard` (AngularWidgets), and `NeedsYouProvider`, `AgendaProvider` and `SpaceHeaderChipProvider` (`packages/Core/src/view-models.ts`). No code loads any of them yet, and `SpaceHeaderChipProvider.getChips` receives a space and a type code but not the viewer.

1. **Wire them.** Space types name server and UI driver classes. Contributions register with `RegisterClassEx` metadata and are found with `GetAllRegistrationsByMetadata` (the extensibility plan's § 6), not v0.3's `GetAllRegistrations` filtered by type code and ordered by `Sequence`. Every provider receives the space and the viewer.
2. **Add:**
   - **The agent binding is the allowed-agent list.** An extension supplies its agent, or a parent agent with sub-agents, through `SpaceAgent` rows at the type level, with `IsDefault` (the extensibility plan's § 8). There are no `SpaceType.DefaultAgentID` or `Space.AgentID` columns.
   - **Knowledge bindings:** a type or a space lists the Content Sources (A10) its agent may use beyond the space's own items.
   - **Lifecycle events** that any extension can subscribe to: `AfterSpaceClosed`, `AfterMemberAdded`, `AfterMemberRemoved` and `AfterItemPromoted`, on the server. They're a contribution, beside the type's own driver hooks. That's how an extension turns a closed engagement into a case-study draft, or notifies a team.
   - **Access after close:** `SpaceType.PostCloseAccess` (`None`, `ReadOnly` or `ReadOnlyWithAgent`) and `PostCloseAccessDays` (empty means indefinite), each overridable per space. They replace what `DefaultRetention` and `Space.Retention` meant, and round 94's tasks 8 and 9: `ReadOnlyWithAgent` is task 9's agent for former clients. They're enforced in `fnCollaborationAccess` through `ClosedAt`. Today only `fnCollaborationAncestorMembers` honors `ClosedAt`; fix that drift here. How access is priced or granted beyond the window is an extension's business, not the engine's.
   - **Outreach sources:** a server-side `SpaceSignalProvider` base class. An extension registers providers that produce dated observations about a space, such as "a public filing changed". The engine stores them as Team-band items, and only A8 can turn one into a post.
   - **`SpaceType.DefaultInheritsMembership`** (D1).
3. **Accept:** the UX gallery's example plug-in draws frame 08 through these points, and a second example registers an agent, a knowledge binding and a lifecycle subscriber with no engine change.

### B9. Outside participants and identity

- **Identity is invite-based.** An invitation creates or links an MJ user with the participant role, linked to a Person when one exists. This settles v0.2's open decision 7.
- **Add `SpaceMember.PersonID`** (nullable), filled when the user is linked to a Person, so apps keyed on People, such as Committees, can project onto the roster.
- **`mintSpaceLink`:**
  - its replies differ by the state of the account, so the signer can tell whether an account exists (for example `mint-space-link.ts:150` and `:171–174`). Make them indistinguishable;
  - it attaches the participant role to an existing account that isn't staff. Any role with `CanInvite` can do it, and the seeded Member role has it. Decide which roles may attach a host role to an account that already exists.

### B10. Exposure and hygiene

From the review of PR #3, checked on 2026-09-26:
- **Ancestor rosters.** Real. `fnCollaborationAncestorMembers` returns every active seat on every inheriting ancestor of each space the caller reaches, when that space allows parent assignees. It has no band or role condition, so with `People In Reach` a guest in a child space reads every such ancestor seat's name and email. Limit it to what assignment needs (contributors only) and leave Team-band staff out of guests' views.
- **The People field rules.** Not a gap. Space Participant has 11 Allow rows and 24 Deny rows on People. MJ 6.1.3 allows a field only when some row allows it and none denies it, and once People's field-level flag is on (bizapps-common#186), a field with no row is denied. So the Allow rows already act as an allow-list, and a new People column stays hidden. Keep the Deny rows: a Deny wins over another role's Allow, for a participant who also holds one. The geocode columns are task 2's, in PR #3.
- **Dead code in `SpaceItemEntityServer.Delete`.** Partly. The count of other items pointing at the same file (`cleanupStoredFileIfUnreferenced`, about 30 lines) can only find zero: saves store `RecordID` in canonical form, the unique key allows one item per record, and file items come only from the upload. Remove it. The rest of `Delete` removes uses and notices in the item's transaction, and isn't dead.
- **Paged loads.** Real. B0.2 fixes it in PR #3.
- **`{{ScopeResourceID}}`** in the `Visible Spaces` and `Visible Items` filters. MJ 6.1.3 binds it on the server from a verified magic-link token's claims, and substitutes an empty string when there isn't one, which matches nothing. Collaboration's own links are app sessions with no resource. Keep the clause if the one-off reviewer's link (A12.7) is built; otherwise remove it.
- **Root tasks.** Not a gap. The search scope matches tasks on `RootParentID`, and a root task's `RootParentID` is its own ID: the generated root-ID function starts from `COALESCE(@ParentID, @RecordID)`, in MJ's CodeGen and in bizapps-tasks' own migration.

### B11. PostgreSQL

Port `fnCollaborationAccess`, `fnCollaborationTasks`, `fnCollaborationAncestorMembers` and B2's common-access function, and every filter text, to PostgreSQL. Create `migrations-pg/` with the converter's output; never hand-edit it. The filters name schemas directly (two name `[__mj]`, eighteen name `[__mj_BizAppsCollaboration]`, one names `[__mj_BizAppsCommon]`) and 21 of the 26 use `TRY_CAST`. Filter text is metadata, so it needs a dialect answer of its own.

### B12. Embedding and cohorts

- The widgets must run in a host that isn't Explorer, such as a learning portal. The UX gallery proves it; keep it green.
- Cohorts need `JoinMode = SelfServe` or `RequestToJoin` and `Discoverability = Listed` or `Open` to work: a join-request flow, a cohort directory and a cap. The axes are in the schema; build the minimum surface for them. Moderation, reputation and public profiles stay out of scope.

### B13. The remaining UX slices

Slices B to I of the [UI plan's § 11](../docs/ux/IMPLEMENTATION_PLAN.md#11-order-of-work), in the next pull request, with:
- **Slice B (chats):** the scope control (B2.4), sealed messages and receipts (B4), chats on core participants (B3), and Bea opening the room's own screen with no console errors (task 4's last step).
- **Slice C (people):** B9's identity door.
- **Slice E (work):** task 3's assignee picker ([§ 2.4](#24-what-moves-to-the-next-pull-request)), task 10 (start a plan from a template), and task 12 (what's left of bizapps-tasks#73).
- **Slice G (Assistant settings):** the allowed agents and the knowledge bindings (B8.2), which are the UI plan's gap 9.
- **Slice H (new space):** the UI plan's gap 2, tab labels per type.
- **Slice I (extension points):** frame 08 through the example plug-in (B8). The UI plan's gap 10, the committee removal, is done in PR #3 (B0.11).

## 8. Workstream C: Committees on Collaboration

**Committees today (1.4.0):**
- Schema `__mj_BizAppsCommittees`. Membership is keyed on Person, through Term.
- Parent committees exist (`Committee.ParentCommitteeID`).
- No row-level security: any UI user reads every committee. Changes are checked in `CommitteeAuthorization`.
- Ballot sealing is enforced only in the browser.
- Two client entity overrides register under the wrong names (`'Memberships'` and `'Meetings'` instead of `'Committees: Memberships'` and `'Committees: Meetings'`), so their validation likely never runs.

The ActionItem-to-Tasks move dropped a published entity in a 1.0.x patch with no compatibility layer. Don't repeat that: breaking steps take a major version.

The mapping, the drivers and the tests are in [Committees' rebuild plan](https://github.com/MemberJunction/bizapps-committees/blob/next/plans/COLLABORATION_REBUILD_PLAN.md). This section sets the stages (D9).

### C0. Fixes before the refactor (1.4.x)

1. Enforce ballot sealing on the server: while a ballot is open, only the voter can read their vote.
2. Fix the registration names in `packages/GeneratedEntities/src/custom/{Membership,Meeting}Entity.ts`.
3. Decide whether `IsPublic` means anything. Nothing enforces it today.

### C1. 1.5: declare the dependency and backfill

- Declare the dependency on Collaboration, and raise the floors to bizapps-tasks 1.5.0 and bizapps-common 5.46.
- Ship Committees' own `committee` space type in its `metadata/`, with the ID Collaboration seeded before B0.11 removed the row: `5FABEBE3-0207-4DB2-8B4C-8DAF0178A3C6`. A database that already has the row keeps it as the one `committee` row, since type codes are unique, and Collaboration never reuses the ID.
- Add sealed-by-default types, such as Compensation and Audit, with `DefaultInheritsMembership = 0` (D1).
- **Backfill one space per committee, with the committee's own ID** as the space's ID, since an IsA child shares its parent's key:
  - the parent comes from `ParentCommitteeID`;
  - the owner is the chair's linked user, or a designated service owner;
  - sealed types get `InheritsMembership = 0`.
- **Sync the seats** from memberships through the committee driver's `SyncSeats`, with `SyncSource` `committees:membership`, for active seats in the current term, using `SpaceMember.PersonID` (B9). Report the People with no linked user: each needs an invite (B9) before they can act.
- Map each committee role to a space role type: `IsOfficer` means can invite; `IsVotingRole` stays a Committees flag.

### C2. 1.6: dual read and security

- The existing screens keep working. Committee spaces light up with the library, chats, work and the Assistant through Collaboration.
- Row-level security on Committees' entities for Space Participant, through `fnCollaborationAccess`: a committee row passes when its ID is in the caller's reach, since it's the space's ID. Staff roles stay as they are.
- Motions, meetings, minutes and ballots appear through B8's extension points: tabs (*Meetings*, *Motions*), overview cards (the next meeting, an open vote), a header chip (the term), *Needs you* (ballots awaiting my vote) and the agenda (meetings).
- Replace the category-name task matching in `CommitteeTaskService.ts` with tasks filed in the space.

### C3. 2.0: cut over (a major version)

- Declare `Committee` and `Term` as IsA children of `Space` in Committees' `codegen-schema-info.json`.
- Drop the duplicated columns: `Committee.Name`, `Description` and `ParentCommitteeID`, and `Term.Name`. The rebuild plan maps the rest of each table.
- Retire Committees' `Artifact` and `Comment` in favor of space items, MJ Files and space chats. Leave read-only views for old readers.
- **Accept:** an outside director with the Space Participant role can join a committee, read its Shared material and vote on an e-ballot, and can't see a sealed Compensation sub-committee. A director who sits on both sees both, and in a private chat the agent can answer across both. In the full board's room it can't use Compensation material ([§ 10](#10-verification)).

## 9. Sequencing

This is the next pull request's order. Stage 1's B0 is done in PR #3.

| Stage | Core (A) | Collaboration (B) | Committees (C) |
|---|---|---|---|
| **1. Safe foundation** | A12.1, A12.2 (search fixes); A12.13 (urgent) | B0 (in PR #3), B1 | C0 |
| **2. Provenance** | A1, A2, A3, A4 | B4 (receipts from A4) | |
| **3. Audience** | A5, A6, A7, A11; A12.14 to A12.17 | B2, B3, B9, B10 | |
| **4. Reach** | A8, A9, A10; A13 | B5, B6, B7, B8 | C1 |
| **5. Breadth** | The rest of A12 | B11, B12, B13 | C2, then C3 |

- **The UI keeps moving.** The builder continues the UX slices as soon as the next pull request starts. Slices D, E, F and H need no new core work. Slices B, C, G and I land with what they depend on: B with B2 to B4, C with B9, G and I with B8.
- **The extensibility plan's build** (its § 13) maps onto these stages: the schema and the drivers with B8, chats with B3, the starter types' configuration and the example plug-ins with B8's acceptance. The MJ pull requests (A13) are opened in parallel as soon as the builder is on the next pull request (D11).
- **Dogfooding starts after stage 3,** when a real client space can hold both bands and a shared room is provably bounded by its audience. Don't put a real client in a shared room before A6 and B2 pass [§ 10](#10-verification).
- **Within a stage,** core and app items can run in parallel. App items that depend on a core item ship behind a feature check until the core version is pinned.

## 10. Verification

**Personas,** each a real user in a seeded database, driven through a browser and over GraphQL:

| Persona | Holds |
|---|---|
| Director D | A board seat and a Compensation Committee seat |
| Director E | A board seat only |
| Outside director O | The Space Participant role, a board seat, the Shared band |
| Consultant C | Staff, with the Team band on the client space Acme and its engagement sub-space |
| Client K | Space Participant, with the Shared band on Acme |
| Stranger S | No seats |

The sample world (`docs/reviewing-the-data.md`) covers some of these today: Ada and Sam are staff, Casey and Bea are clients, Dana is an outside director, and Nora holds no seat. It gains the rest: a board with a sealed compensation sub-space, and directors D and E.

**The matrix.** Each row passes through the portal, GraphQL and MCP, and from stage 4 a bound Teams channel.

| # | Situation | Expected |
|---|---|---|
| 1 | D, private chat, scope *everything* | Uses Board and Compensation material |
| 2 | D, private chat from the Board, scope *this space* | Board only |
| 3 | D and E in the Board's room | No Compensation material in retrieval, the answer or the access log |
| 4 | E browsing the Board | The Compensation sub-space isn't listed (sealed) |
| 5 | C alone asks about Acme | Team and Shared |
| 6 | C and K in the Acme room | Shared only |
| 7 | K is added to a conversation of C's that used Team material | Those AI messages are sealed for K, with *Request access* |
| 8 | K asks in a mixed Teams channel with an unmapped member | Only `Public` knowledge; no space material |
| 9 | O on the Board demotes E (a higher role) | Refused (B0.1) |
| 10 | S calls any Collaboration or Committees read | Nothing |
| 11 | The agent drafts outreach to K | Nothing is posted until C approves (A8, B7) |
| 12 | The engagement sub-space is closed with `ReadOnlyWithAgent` | K can read and ask, but can't upload or invite |

**KPIs that must be measurable** once A2 and A4 land: zero cross-band retrievals in audit; zero sealed-source quotes; every AI message has an `AgentRunID` and source rows.

**What already runs** (PR #3): the unit tests, the two integration harnesses with their count assertion, `scripts/persona-check.sql`, the gallery's visual test, `mj standards check` and the token check. CI runs the database checks from B0.5 on.

## 11. Open decisions

**Still open:**
1. **Owner** of Collaboration.
2. **License and distribution.** Free is decided; the license and the publish path aren't. `mj-app.json` and the packages say `UNLICENSED` until then.
3. **Retention of access-log rows (A2).** Proposal: 13 months online, then archive.
4. **Messages from before A4 (A7):** shown or sealed for newcomers by default?
5. **Disclose to this conversation (D4):** build it in stage 3, or wait for demand?
6. **Storage hits under `Intersection` (A6.2):** refuse them, or build per-principal storage checks?
7. **When Committees 2.0 ships,** relative to the first association customer.
8. **The default `PostCloseAccess` and `PostCloseAccessDays`** for each starter type (round 94's task 9 asked for a default).
9. **May deleting an item erase its item uses?** Today the item's delete removes its uses and notices in one transaction, and MJ's Record Changes keeps every deleted row. Slice A adds versions, set members, checks and findings to the same question. The choices: keep that; refuse to delete an item that has a promotion; or keep the uses after the item goes. Until it's decided, the delete removes them all in its one transaction.
10. **File Requests** (from v0.2): lift the shape into Collaboration if a space needs it, or revisit Secure Messaging as an optional dependency.

**Reconciled; Amith to confirm in review:**
- **Contributions** use the extensibility plan's `RegisterClassEx` metadata and `GetAllRegistrationsByMetadata`, not v0.3's B8.1 (`GetAllRegistrations` by `Sequence`). v0.3 predates that design.
- **The agent binding is the allowed-agent list:** an extension supplies its agent through `SpaceAgent` rows at the type level, with `IsDefault`. No `DefaultAgentID` or `Space.AgentID` columns.
- **B8.2's additions are all in:** knowledge bindings; lifecycle events any extension can subscribe to, beside the type's driver hooks; `PostCloseAccess` and `PostCloseAccessDays`, replacing `Space.Retention`'s meaning and round 94's tasks 8 and 9, with `ReadOnlyWithAgent` as task 9's agent for former clients; and `SpaceSignalProvider`.
- **D2's scope control extends the subtree bound:** a private chat uses the caller's union with a scope control, and a shared chat the intersection. The extensibility plan's "What an agent sees" says so.
- **`SpaceType.DefaultInheritsMembership` is a column,** like `DefaultAllowParentAssignees`.
- **Lifecycle subscribers run after the commit,** through `provider.RunAfterCommit`, so a subscriber never sees a change that's rolled back. Refusing a change stays with the type's Validate hooks (the extensibility plan's § 5).
- **Knowledge bindings are rows,** proposed as `SpaceKnowledgeSource`, by the extensibility plan's own rule: a setting that points at a record that can be deleted is a row with a foreign key.
- **The UX slices continue right away** in the next pull request ([§ 9](#9-sequencing)), where v0.3 placed B13 in stage 5.
- **A12.13 is in stage 1,** as urgent.
- **`mjc-no-access` stays** (B0.10): it's the new UI's component, not the old UI's.

**Settled since v0.2:**
- Its decision 2 (do `MJ: Artifact Uses` cover plain files?): Collaboration records its own `ItemUse` rows.
- Its decision 4 (Committees adopting Space): Committees is a plug-in, extending Space through IsA (D9).
- Its decision 6 (the deliverable agent after the engagement): `PostCloseAccess = ReadOnlyWithAgent` (B8.2); the defaults are decision 8 above.
- Its decision 7 (the identity door): invite-based (B9).

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| An agent surfaces a promised-anonymous attribution to a client | High | Two bands from day one; retrieval bounded by the audience (D2); promotion is an audited act; provenance and sealing (D3, D4) |
| A scope-only boundary leaks through the full-text lane | High | The boundary is row-level security on Collaboration's entities; the scope only narrows |
| A participant holds a second role with an unfiltered grant, which disables row-level security | High | Never grant `UI`; audit every role a persona holds; `persona-check.sql` drives the narrowest persona |
| A participant forges a write that MJ's generated mutation accepts | High | Gates are `BaseEntity` subclasses; every rule tests `isNew`; no constructor; create filters as a second line |
| A signer changes the seat of someone above them | High | B0.1's fix: the ceiling covers the target's current role |
| bizapps-tasks#67, still open, adds a `TaskAssignmentEntityServer` at priority 2, the same entity and priority as Collaboration's assignee gate. On a tie MJ uses the last registration, so one of the two checks would stop running, silently | High | If #67 merges, extend its class and register at 3 |
| bizapps-tasks#46, still open, takes a decision's decider from `User.LinkedEntityRecordID` and requires `User.LinkedEntityID`. Collaboration links people only through `Person.LinkedUserID`, so a member's decision would be refused | Medium | If #46 merges, set both user fields wherever a Person is linked: in the loader and in `mint-space-link.ts` |
| Every save reaches every signed-in socket through `cacheInvalidation` | High | A12.13, urgent; recorded by round 94's task 14 |
| A shared room answers from material one participant can't read | High | D2's intersection; A6's per-principal check; no real client in a shared room before stage 3 passes |
| Recording provenance slows the write path | Medium | Batched inserts; A2's 5% budget on a 1,000-row RunView |
| Intersection retrieval misses material people expected | Medium | The audience is shown in the chat banner (B3); a private chat is always available |
| An outside channel answers as a service account | High | D6 and A9: an unresolved identity refuses |
| The next pull request grows the way PR #3 did | Medium | It merges once, when done (D12), so it's reviewed by stage: § 9's order, item numbers in commits and review threads, one stage per review round ([§ 0](#0-how-to-use-this-plan)) |
| The computed reach walk stops being fast enough | Medium | Measure at realistic space counts. If it's ever materialized, recompute on both a space's create or move and a seat's change |
| A client's security review asks for SOC 2 evidence we don't have | Medium | Name an owner, and start collecting evidence before the first outside client |

## 13. Out of scope

- Anything specific to one firm's practice: its consultant agent, its body of knowledge, its outreach logic, its price for access after an engagement. Those live in private extensions built on B8.
- The community surface: moderation, reputation, public profiles, activity ranking and content visible to search engines. The two axes are modeled; the surface waits for a customer who wants it.
- Multi-tenant SaaS machinery.
- Competing with Slack or Teams, or becoming a document-management system. Files stay in MJ Storage.
- Reshaping BizApps Secure Messaging into group chat.
- Hand-written PostgreSQL. `migrations-pg/` is converter output (B11).

## Appendix: source checks of 2026-09-26

Collaboration was checked at `b539790`. Round 95 read `fc77117` and `c125daf`, which change none of the code these claims cite. MJ was checked on `origin/next` at `903f1af7da` (2026-09-25), and MJ 6.1.3 from its tag and from the installed packages. v0.3's `E:` line numbers match that `next` exactly.

| Claim | Finding | Evidence |
|---|---|---|
| B0.1: a member can demote or remove someone above them | True, and reachable over GraphQL: Casey (client admin, ceiling 10) removes Sam (member, level 20) by saving Sam's seat as `client-member` and `Removed`; the owner check runs only on Active rows | `rules.ts:577–641`; `SpaceMemberEntityServer.ts:36–51`, `:62–71`, `:79–84`; `metadata/space-role-types/`; Space Participant's update grant on Space Members, with no update filter; the world's `members.csv` |
| B0.2: Team item names leak into the room | True in code; only the server harness's agent check sets `executeAgent`; the module's loads stop at 2,000 rows with no full-page check | `post-space-message.ts:133–139`; `agent.checks.ts:400`; `space-agent-retrieval.ts:206`, `:309`; the `Conversation Details In Reach` filter |
| B0.3: a new subtask's parent isn't checked on insert | Not a bug: MJ checks the participant's create filter on every insert, before and after the before-save hooks; only a check that proves it is missing. v0.3's lines are from an older file | `task-entity-server.ts:21–26`, `:27–52`; `Subtasks Under A Writable Parent` and its Tasks grant; MJ 6.1.3 `databaseProviderBase.js:1252`, `:1293` |
| B0.4: the tasks subclasses run async validation | True, no change needed | MJ `v6.1.2` and `v6.1.3` `baseEntity.ts:4286`; no override of the flag in bizapps-tasks 1.5.0 |
| B0.6: `mj-standards.yml` runs `npm ci` | False now: deleted | `28e3a86`; `ci.yml` runs `pnpm exec mj standards check` (since `0c7096a`) |
| B0.7: two migrations deleted relative to `next` | True; both were metadata-only, and their content is in `metadata/` | `a763b4f`; `row-level-security-filters/`, `entity-permissions/`, `entities/.ui-role-permissions.json` |
| B0.8: stale README; old screenshots | True at `b539790`; 21 old PNGs | `docs/screenshots/pr3/01…21` from `bd33bdc` |
| B0.10: UX conventions | Done: PascalCase, `…Requested`, colors as data, the budget (100) and the artifact upload. Open: the 76 hex fallbacks, and the tokens partial, which nothing includes, so hosts other than the gallery draw the fallbacks. `no-access` is the new component | `AngularWidgets/src/lib/*`; `UXGallery/bundle.mjs:49–62`; `e2e/specs/frame-02-chrome.spec.ts:11–15`, `:195`; `ci.yml`; `77b36f4`, `0c7096a` |
| B0.11: committee specifics | True: `GovernancePanel` and the `committee` row remain; the row's ID is `5FABEBE3-0207-4DB2-8B4C-8DAF0178A3C6` | `V202609222231…Tables.sql:47`; `metadata/space-types/.space-types.json:28` |
| B8: no extension point is loaded; `getChips` has no viewer | True | `view-models.ts:226–280`; no caller in the repo |
| B9: `mintSpaceLink`'s replies and role attach | Partly: only `CanInvite` passes, which includes Member; staff never get the role; replies differ | `mint-space-link.ts:100–111`, `:150`, `:171–174`, `:360–368` |
| Task 3's picker stops at Discovery | No picker exists at `b539790`: the old one went with the old UI | `assigneeScope` at `77b36f4^:packages/Angular/src/lib/space-workspace.component.ts:378` |
| B10: ancestor rosters | True | `V202609240800…Ancestor_Seats.sql:22–50`; the `People In Reach` and `Visible Members` filters |
| B10: People field rules are a deny-list | False: 11 Allow rows make them an allow-list once the flag is on, since no row means denied; the 24 Deny rows still count, because a Deny wins over another role's Allow | `metadata/entity-field-permissions/`; MJ 6.1.3 `entityInfo.ts:647–655` and the `Deny` rule in `entityInfo.js` |
| B10: 150 dead lines in `Delete` | Partly: the file count (about 30 lines) is dead; the rest isn't | `SpaceItemEntityServer.ts:136–325`, `:88–91`; `UQ_SpaceItem_Entity_Record` |
| B10: `MaxRows 2000` in retrieval | True; B0.2 fixes it in PR #3 | `space-agent-retrieval.ts:206`, `:219`, `:309` |
| B10: `{{ScopeResourceID}}` | Bound on the server from a verified token; empty otherwise | MJ 6.1.3 `MJServer/src/context.ts:207–224`, `MJCore/src/generic/securityInfo.ts:574–581`; `mint-space-link.ts:208` |
| B10: root tasks miss the scope | False: a root's `RootParentID` is its own ID | MJ 6.1.3 `SQLServerCodeGenProvider.ts:956–1010`; bizapps-tasks `V202608252210…`; `task-space.ts:19–23` |
| B11: filters hard-code schemas and use `TRY_CAST` | True: 2 name `[__mj]`, 18 `[__mj_BizAppsCollaboration]`, 1 `[__mj_BizAppsCommon]`; 21 of 26 use `TRY_CAST` | `metadata/row-level-security-filters/` |
| A1: no run context | True: no `AsyncLocalStorage` in `AI/Agents` or `MJCore` | It appears only in `Actions/Engine` and `Integration/engine` |
| A2, A3, A6.2: search references | True; the path is `SearchEngine/src/generic/SearchEngine.ts` | `:482`, `:1918`, `:1926–1930` |
| A4: no `AgentRunID` on details | True; the reverse link is `AIAgentRun.ConversationDetailID` | `E:42234` |
| A5: no participants entity | True; the filter is in the app layer | `conversations.ts:758–810` |
| A6.4: notes injected by `UserID` | True | `agent-context-injector.ts:264` |
| A6.5: resumed as the responder | True: the resume uses the saving user | `MJAIAgentRequestEntityServer.ts:49–71` |
| D6: adapter fallback; MCP system user | True | `BaseMessagingAdapter.ts:565–593`; `AuthGate.ts:139–200`, `:292–293` |

Not checked: A2's other hook points and A11's lines, A6.6's bridge engine line, A9's and A10's claims beyond the entity lines, v0.3's § 5 statements about Committees 1.4.0, and whether any migration has hand edits inside its generated block (that needs a CodeGen run against a clean database).
