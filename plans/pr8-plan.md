# PR #8: anchors, grants, data reach, notes and pins

**Status: merged.** #8 merged into `next` on 2026-09-29 at `ad5ffef` (Amith, [the plan's D38](plan.md#36-decided-on-2026-09-29-8-merges-after-the-chat)), after the chat, its first job, with CI red only for D37. The chat's remaining defects, [stages 1 to 4](#6-stage-1-the-schema) and the rest of [§ 1's table](#what-7-moved-here) moved to PR 9 and the pull requests after it, in [PR 9's plan](pr9-plan.md)'s order. The stages keep their detail here: read "PR #8" in them as the stage's own pull request.

**What this is.** The build plan for PR #8, the pull request after #7. It's a differential plan: it starts from the app as #7 leaves it, and lists what #8 changes, in order, with each change's acceptance checks. The reasons and the rules are in [the plan](plan.md), v0.5: its decisions D26 to D35 ([§ 3.5](plan.md#35-decided-on-2026-09-27-anchors-grants-data-notes-and-meetings)) and its items B14 to B24 and A14 to A18. This document is the how and the order.

**Version:** 2026-09-27, at #7's head `37e290b`. Amith then decided to finish #7 where it is: [its punch list 4](https://github.com/MemberJunction/bizapps-collaboration/pull/7#issuecomment-5858175690) is #7's finish line, and moved #7's other open items here ([§ 1](#what-7-moved-here)) or to after this pull request. Stage 0 checks this plan against #7's final head. The same day, the plan's D36 moved MJ's part after this pull request. #7 merged on 09-28 at its head `0f0dd3d`, as complete enough (Amith), and [§ 1](#1-where-7-leaves-the-app) is updated to it.

**Who does what.**
- **The builder builds it,** on `claude/hopeful-bell-6ldk4v-pr8`, from #7's merge on 2026-09-28. Until then it was a draft stacked on #7, holding this plan, the plan's v0.5 and the new README.
- **The plan's author reviews it,** with one numbered punch list per push, as for #7, and pushes only document updates. Both sides merge the remote branch before pushing; nobody rebases or force-pushes.
- **It merges once, when it's 100% done,** as #7 does (D12).
- **MJ's part is its own pull request,** [MemberJunction/MJ#4789](https://github.com/MemberJunction/MJ/pull/4789), which the builder builds after this one (the plan's D36). PR #8 builds on MemberJunction as released, with [§ 4](#4-what-it-depends-on)'s grants closed, and a follow-up opens them once a release carries MJ#4789.

## Contents

1. [Where #7 leaves the app](#1-where-7-leaves-the-app)
2. [What PR #8 delivers](#2-what-pr-8-delivers)
3. [What it replaces](#3-what-it-replaces)
4. [What it depends on](#4-what-it-depends-on)
5. [Stage 0: start](#5-stage-0-start)
6. [Stage 1: the schema](#6-stage-1-the-schema)
7. [Stage 2: the server](#7-stage-2-the-server)
8. [Stage 3: agents](#8-stage-3-agents)
9. [Stage 4: the screens](#9-stage-4-the-screens)
10. [Verification](#10-verification)
11. [What isn't in PR #8](#11-what-isnt-in-pr-8)
12. [Rules for the work](#12-rules-for-the-work)
13. [Design points to settle in stage 1's comment](#13-design-points-to-settle-in-stage-1s-comment)

## 1. Where #7 leaves the app

#7 merged on 09-28, as complete enough (Amith), not at its finish line. What was left of punch list 4's finish line moved here with #7's other open items, in [the table below](#what-7-moved-here). The app has:

- **The container:** `SpaceType`, `Space`, `SpaceMember`, `SpaceRoleType`, `SpaceItem`, `ItemUse` and `ShareNotice`, with the access functions `fnCollaborationAccess`, `fnCollaborationTasks` and `fnCollaborationAncestorMembers`, and the Space Participant role with a row-level security filter on every read grant.
- **The extensibility schema,** still as #7's migrations (folding them into one baseline is #7's item 14, now here): the type's `ServerDriverClass`, `UIDriverClass`, `SpaceExtensionEntity` and `Configuration`; `Space.Configuration`, `AnchorEntityID`, `AnchorRecordID`, `PostCloseAccess` and `PostCloseAccessDays`; `SpaceMember.SyncSource` and `PersonID`; and the tables `SpaceChat`, `SpaceAgent`, `SpaceAgentSkill` and `SpaceKnowledgeSource`.
- **The metadata engine** (D19): `CollaborationEngineBase`, in `collaboration-engine-base`, loaded once per process, and the server's `CollaborationEngine`.
- **Settings** (D20 to D23): `CollaborationSettings` and `ResolveCollaborationSettings`, used when a space closes and when a message is posted, beside the older `ResolveSpaceRules` that the drivers, the gates and the allowed-agent resolver still run on (#7's items 36 and 55, now here); the app's defaults as an Application Settings row; closing as a setting; sub-spaces sealed unless their creator asks; and the *Collaboration* authorization tree, held by MJ's `Owner` and `Developer` roles.
- **Seven generic space types** (D18).
- **The extension points** (B8): server and UI drivers, contributions, lifecycle subscribers, a server-only `EnsureSpaceForRecord`, and the private example plug-ins `example-board` and `example-room`. `SyncSeats` is out until it's built.
- **Chats:** a room per space, created by the server, though nothing yet enforces one room. The Overview's ask box posts through `PostSpaceMessage`, the chat call's option B: it saves the message with the system user's rights, in the poster's name, and when the reply mode or an `@assistant` mention calls for it, it answers with the names of the space's items within the poster's reach rather than running the agent. The Chat tab is MJ's chat area on the room. The system user owns the room and no seat has an Edit grant on it, so MJ 6.1.3's write gate refuses anyone else's post there. D25 and D37 put the chat on MJ#4788's host rules, and that's this pull request's first work (#7's items 57, 8 and 61). No chats are created in the browser. The allowed-agent, skill and knowledge resolvers, and retrieval bounded by the room's audience (B2.1, B2.2).
- **Access after close:** the write gates, `fnCollaborationAccess` and the agent's search honor a space's closure. `fnCollaborationAncestorMembers` doesn't yet (#7's item 40).
- **The screens** (D24): Home, the space rail and tabs, the library, chat, people, work and settings. Their open items are in the table, in stage 4, and so is the walkthrough (#7's item 51).
- **The tests:** 334 unit tests, both integration harnesses (43 and 44 checks, in nine bundles each), `persona-check.sql` and the gallery. CI against a real database is here (#7's item 13).

If #7's final head differs from this, stage 0 says how, and this plan follows the code.

**What stage 0 found** ([the builder's note](https://github.com/MemberJunction/bizapps-collaboration/pull/8#issuecomment-5861405271)): two defects in #7's final head, both fixed in `16bac53`.
- A type's defaults overwrote a new space's explicit settings, so a fresh load of the world failed on Delivery's `AgentRetrieval`. MJ treats a field's first set after `NewRecord()` as its initial value, so `Dirty` stayed false. The fix compares each setting with the value `NewRecord()` gave it.
- WG6 4c's cleanup deleted Dev's seat as Ada, and the UI role can't delete Space Members, so the check failed on both harnesses. It now deletes the seat as the harness's own user.
- With both fixed, a clean copy of `16bac53` passes 339 unit tests, and the builder's tallies after a purge and a fresh load are 43 and 44 checks passing.

### What #7 moved here

Punch list 4 moved the first set of #7's items here, by number, and the rest came when #7 merged (*at merge*). Each is done in the stage named, with the rest of that stage's work. **The chat comes first,** before stage 1.

| #7's item | What | Stage |
|---|---|---|
| 57, 8, 61 | *At merge.* **The chat on D25.** The server turn operation: it checks everything again from the saved message, runs the agent under the audience rule, and writes the reply as the system user. Edit grants for contributing seats. Space Participant's Create on Conversation Details, with its create filter, as metadata. No conversation until someone asks for one (Amith, 09-28): `CreateSpaceConversation` behind the rail's +, the chat's New Conversation button and the Overview's ask box, with General, Topic and Internal Only kinds and `Room` retired; the host listing the conversations the viewer can read; the read and create filters and the Edit grants by kind. `PostSpaceMessage`'s `ExecuteAgent` switch and regex retired. The ask box going through the chat area. A conversation and its row saved together. Posting that honors a space's own reply mode and doesn't fail when the app settings row is missing. RM3 flipped on both harnesses. The host-rule bindings go in now, against MJ `next` in the pnpm workspace (Amith, 09-28; [the D25 note](https://github.com/MemberJunction/bizapps-collaboration/pull/7#issuecomment-5860741029) lists them). CI can't pass the chat's build until MJ's first edge release carrying MJ#4788 is out and pinned with the lockfile (D37) | First, then 4 |
| 13 | CI against a real database (B0.5) | 1 |
| 14 | One baseline, regenerated from a clean database, with #7's migrations folded in and D20 to D22's type columns not created | 1 |
| 15 | The extensibility migration's fixes, in the baseline: no hand-written `__mj_` columns, `${mjSchema}`, extended properties, no `Room` kind (D25) | 1 |
| 18 | The committee specifics, with the baseline | 1 |
| 19 | Rebuild from empty, and check the core-entity list on the screens as Bea | 1 |
| 12 | The type dropped from `fnCollaborationAccess`'s fallback, with the type's close columns | 1 |
| 38 | `EnsureSpaceForRecord` on the primary `SpaceAnchor` | 1, 2 |
| 63 | *At merge.* `V202609271300`'s generated block, which was assembled by hand, replaced by the baseline's own CodeGen capture | 1 |
| 40 | *At merge.* `fnCollaborationAncestorMembers` checking every ancestor's closure and `PostCloseAccess`, in the baseline | 1 |
| 64 | *At merge.* The world's storage: the load leaves MJ's shared Box row active, `purge-world.ts` has an empty `catch`, a comment cites a punch list, and the data doc's purge claims are wrong | 1 |
| 6 | Storage as a setting: uploads use the resolved account, a space can set it, each item records its account, and linked documents go through a server operation | 2 |
| 12 | A space setting its own close values | 2 |
| 20 | The fields a participant can read, the geocode columns, and what bizapps-common#186's release does to a host's roles | 2 |
| 29 | Chats with their own people and audience (B3): started through a server operation that applies `Chats.WhoCanStart`, with their kinds recorded, and readable only by their people. Posting on A5 and sealing on A7 wait for those MJ items. The space's own conversations moved to the chat's work (row 57) | 2, 4 |
| 34 | The extension points' leftovers, with `example-chapter`: the examples' migration with its CodeGen output, frame 08 through the points, examples that read their own rows | 2 |
| 35 | React hooks inside the save's transaction | 2 |
| 36 | The drivers on the one configuration | 2 |
| 37 | Subscribers found by metadata, run only after the commit | 2 |
| 41 | The drivers' change kinds | 2 |
| 42 | The resolvers' rules, carried into the grants: one chain loaded once, the context user on every read, fail closed, each parent under its own type, the default agent found by name | 2, 3 |
| 47 | Tests for the driver registry, the subscribers and `EnsureSpaceForRecord` | 2 |
| 53 | Types that set only what differs from the app, nesting enforced on the server, and band names and descriptions from the type | 2 |
| 54 | The engine's unused sets, and its typed-in IDs and names | 2 |
| 55 | The settings model's open points, settled by D30's one resolver | 2 |
| 56 | The app settings row's editor | 2 |
| 40 | *At merge.* The rest of access after close: the reopen bypass skipping closed ancestors, the subtree query and the walk agreeing on closed spaces inside a subtree, unit tests for `isAgentPostCloseAccessPermitted` with a positive case, an entity-level reopen of a space closed with no access, and the read-parity checks on both harnesses | 2 |
| 56 | *At merge.* One owner walk for the gate and the check, with the type's fallback; failed reads that end silently; a clean push proven; a check that refuses an authorized user with no owner seat; WG6 4a on D23's check | 2 |
| 58 | *At merge.* Space Item deletes gated on closure, and tests for the assignment delete and for an assignment update in a closed space | 2 |
| 12 | *At merge.* Checks on both harnesses: a member's write of the close columns refused, an authorized owner's accepted, and the stamp read back. The close time stamped by the server, and an owner without *Configure Spaces* unable to move `ClosedAt` | 2 |
| 11 | *At merge.* Checks on both harnesses that set and read `InheritsMembership` | 2 |
| 54 | *At merge.* The unused imports, and the engine base's header listing *Task Types* | 2 |
| 22 | *At merge.* The rest of WG6: `cleanupTaskAndItem`'s silent skips, the client's skip without a detail ID, D23's owner-seat half, 4a's restore in a `finally`, an undo for the refusal steps 3a and 4b, cleanup errors that hide a check's first error, and `agent.checks.ts`'s stale comment and constants | 2 |
| 28 | *At merge.* `fnCollaborationCommonAccess` tested, `retrieval.ts`'s comment, the walk to the root with a cycle guard, and `effectiveRetrievalScope` honoring closure | 3 |
| 3 | *At merge.* The retrieval half of the MJ `Owner` user's check, on the server harness | 3 |
| 3 | A seat for the account the walkthrough drives | 4 |
| 4 | The host's placeholders, list limits, made-up labels, metadata reads and typed-in IDs | 4 |
| 16 | The READMEs and screenshots | 4 |
| 17 | Tokens | 4 |
| 22 | The accepting side of every other gate, with the plan's § 10 matrix | 4 |
| 23 | The staff runs and the client harness, on the screens | 4 |
| 25 | Uploads end to end | 4 |
| 26 | A sample world with conversations and documents with real content | 4 |
| 49 | The rest of the screens | 4 |
| 50 | The widgets' text color in dark mode, and the controls that misbehaved in Explorer | 4 |
| 51 | The walkthrough | 4 |
| 53 | The tabs' labels from the type | 4 |
| 57 | The chat's colors | 4 |
| 58 | The Work tab on `<bizapps-task-panel>`, once bizapps-tasks 1.6.1 is published, with every bizapps-tasks version moved together | 4 |
| 58 | *At merge.* The browser counting a seat an inheriting sub-space passes down | 4 |
| 4 | *At merge.* The host's failed reads shown as empty data, the users read batched and parameterized, the task band from the type's `DefaultBand`, and the priority save | 4 |
| 9 | *At merge.* Home's library: Shared-only collections and views with no Team tab, Shared items across the viewer's spaces, and no stale collections after a failed read | 4 |
| 50 | *At merge.* The share dialog: the organization's name, the note and the notify choice passed to the server, recipients limited to Active Shared-band seats, the timestamp's format, and the agent's state on an Overview click | 4 |
| 66 | *At merge.* Text shown by the server's `Mode`, and the popup fallback telling the viewer | 4 |
| 7 | *At merge.* The seeded backdrops, which don't resolve, with item 26 | 4 |
| 27 | *At merge.* The docs: `HOW_THE_SYSTEM_WORKS.md:73` and `packages/Server/README.md:27` describe option B, `:4` names a branch, and `:115`, `:22` and `:17` are out of date, as is the Server README's entity count | 4 |
| 24 | The adversarial test, over #7 and this pull request together, before any release | End |
| 52 | The wrap-up | End |

**After this pull request,** in the plan's § 9 order: #7's items 30 to 33 (B4 to B7), 43 to 46 (B9 to B12), B2.3 to B2.6 from item 28, building `SyncSeats` (item 39), and slice A's data (item 50).

## 2. What PR #8 delivers

| Item | What | Stage |
|---|---|---|
| B14 | `SpaceAnchor`: the records a space is about, with roles and one primary | 1 |
| B15 | `SpaceGrant`: what a type, a space or a sub-space offers, with bindings and agent settings | 1 |
| B21 | `SpaceNote`, and its screens | 1, 4 |
| B22 | `SpaceMemberPin`, the *Pinned* strip, *My pins* on Home, and stars | 1, 4 |
| B16 | `ResolveSpaceConfiguration`, which returns `EffectiveSpaceConfiguration` | 2 |
| B17 | The binding resolver, and `RunSpaceView`, `RunSpaceQuery` and `GetSpaceDashboard` | 2 |
| B18 | `DataReach`, and the generated participant filters and field permissions | 2 |
| B24 | `example-chapter`, which exercises all of it | 2, 4 |
| B20 | Agent turns on the effective configuration, and the *Run space data* action | 3 |
| B19 | The data surface: a tab of the space's granted views, dashboards and components | 4 |
| Docs | The README, `HOW_THE_SYSTEM_WORKS.md`, the extensibility plan and each package's README, current at the merge | 4 |

The README is rewritten in this pull request's first commit, as the repo's public face. The builder keeps what it says true as the work lands: nothing it lists as built may be missing at the merge.

## 3. What it replaces

v0.1 hasn't shipped to a host, so these change shape freely (D35). If it has shipped by the time this lands, the schema change is a migration that moves the rows, and the changeset says so.

| #7 has | PR #8 has |
|---|---|
| `Space.AnchorEntityID` and `AnchorRecordID` | `SpaceAnchor` rows, one of them primary |
| `SpaceAgent` | `SpaceGrant` rows of kind `Agent`, with `IsDefault` |
| `SpaceAgentSkill` | An agent grant's settings (D31) |
| `SpaceKnowledgeSource` | `SpaceGrant` rows of kind `KnowledgeSource` |
| `ResolveCollaborationSettings`, any caller still on `ResolveSpaceRules`, and the allowed-agent, skill and knowledge chains | `ResolveSpaceConfiguration`, with the same-type restart (D30) |
| `Agents.ListMode` | A `ListMode` per grant kind, and `Remove` on a single grant |
| The app-wide default agent, as a `SpaceAgent` row or a typed-in ID | An app-wide `SpaceGrant` row, shipped as metadata that finds the agent by name |
| `EnsureSpaceForRecord` on `Space`'s anchor columns | `EnsureSpaceForRecord` on the primary `SpaceAnchor` |

**#7's item 55 moved here,** so B16 settles it: one resolver for every caller, with D30's same-type restart.

## 4. What it depends on

- **#7, merged.**
- **Not the MJ pull request** ([MemberJunction/MJ#4789](https://github.com/MemberJunction/MJ/pull/4789)): the builder builds it after this one (the plan's D36). It brings:
  - **A14,** properties on user views, for `RunSpaceView` and every view grant with a binding;
  - **A15,** properties on dashboards and the component part, for `GetSpaceDashboard` and the data surface;
  - **A16,** bound, hidden action parameters, for B20's granted actions;
  - **A17,** locked query parameters, the server-set context variable, and the approval status D34 reads;
  - **A19,** who a conversation message is from. Until it ships, someone with a contributing seat can save a message in a space's conversation as someone else, or as the agent.
- **So PR #8 merges with these closed,** and a follow-up opens them once an MJ release carries MJ#4789:
  - a view grant with a binding isn't offered before A14, and a view grant with none runs;
  - a dashboard grant isn't offered before A15;
  - an action grant with a bound parameter isn't given to an agent before A16, and one with none is;
  - before A17 there's no approval status, so a query, view, dashboard or component can be granted only to a staff-only type, and a grant to a type that seats participants is refused.
- **Nothing from bizapps-tasks.** Meetings in spaces (B23) wait for workstream T, after this pull request.

## 5. Stage 0: start

1. Merge `next` into this branch, and retarget this pull request to `next`. Done at #7's merge.
2. Check [§ 1](#1-where-7-leaves-the-app) against #7's final head, and post what differs as this pull request's first comment. Done: [the builder's note](https://github.com/MemberJunction/bizapps-collaboration/pull/8#issuecomment-5861405271).
3. Build, test and run both harnesses on the merged head, from a purge and a fresh load of the world, and post the tallies. They're the baseline every later punch list compares against. Done at `16bac53`, after the two fixes § 1 lists.
4. Then the chat, [§ 1](#what-7-moved-here)'s first row, before stage 1.
5. Work #7's other items in the stage each names, with that stage's own work.

## 6. Stage 1: the schema

**Items:** B14, B15, B21's and B22's tables, and `DataReach` in the type's configuration.

1. **The design comment first,** as the extensibility plan's § 3 asks: the DDL for the four tables, the columns and tables that go, the JSONType definitions, the row-level security filters, the entity permissions, and [§ 13](#13-design-points-to-settle-in-stage-1s-comment)'s points. The migration follows once the plan's author has reviewed it.
2. **The tables,** with the plan's B14, B15, B21 and B22 as the column lists:

   | Table | Columns | Keys and checks |
   |---|---|---|
   | `SpaceAnchor` | `ID`, `SpaceID`, `SpaceTypeID` (denormalized, kept in step by the server), `EntityID` (FK to MJ's Entity), `RecordID NVARCHAR(450)` (the shape of `SpaceItem.RecordID`), `Role NVARCHAR(100)`, `IsPrimary BIT`, `Sequence INT` | Unique on `SpaceID`, `EntityID`, `RecordID` and `Role`; filtered unique on `SpaceID` where `IsPrimary = 1`; filtered unique on `SpaceTypeID`, `EntityID` and `RecordID` where `IsPrimary = 1` |
   | `SpaceGrant` | `ID`, `SpaceTypeID` (null), `SpaceID` (null), `Kind`, `TargetEntityID`, `TargetRecordID`, `Label`, `Band`, `IsDefault`, `Bindings` (JSON), `Settings` (JSON), `Mode`, `Sequence` | Not both a type and a space; `Kind` in D27's seven; `Band` in `Team` and `Shared`; `Mode` in `Extend` and `Remove` |
   | `SpaceNote` | `ID`, `SpaceID`, `Title`, `Body` (Markdown), `Band`, `Visibility`, `AuthorUserID` | `Band` in `Team` and `Shared`; `Visibility` in `Space` and `Private` |
   | `SpaceMemberPin` | `ID`, `SpaceID`, `UserID`, `Kind`, `TargetEntityID` and `TargetRecordID`, or `GrantID`, and `Sequence` | Exactly one of the target pair and `GrantID`; one pin per user, space and target |

   The usual rules hold: hardcoded UUIDs where rows are seeded (as metadata, never in the migration), no `__mj_` columns and no foreign-key indexes (CodeGen adds them), `${mjSchema}` for MJ's tables, `SET QUOTED_IDENTIFIER ON` for the filtered indexes, and an extended property on every column.
3. **The columns and tables that go:** `Space.AnchorEntityID`, `Space.AnchorRecordID`, `SpaceAgent`, `SpaceAgentSkill` and `SpaceKnowledgeSource`, with their metadata rows, permissions, filters, the engine's sets for them, and the code that reads them.
4. **The JSONType wiring,** as metadata: `SpaceGrant.Bindings` and `SpaceGrant.Settings` get typed interfaces in `collaboration-core`, and `ISpaceTypeConfiguration` gains `DataReach`:

   ```ts
   /** Where a bound value comes from (D27). A literal is a Value; anything else is resolved on the server. */
   export type BindingExpression =
       | { From: `Anchor:${string}` | `Space.${string}` | `Config:${string}` | 'User.ID' | 'User.Email' | 'User.PersonID' }
       | { Value: string | number | boolean };

   /** A grant's bindings: a parameter or property name of the target, mapped to where its value comes from. */
   export type SpaceGrantBindings = Record<string, BindingExpression>;

   /** An agent grant's settings (D31). Each can only narrow what the agent's own definition allows. */
   export interface AgentGrantSettings {
       /** The skills this space's chats may use: none, or a subset of the agent's AcceptsSkills. Absent means the agent's own. */
       Skills?: 'None' | string[];
       /** Off, allowed or required; only where the agent sets SupportsPlanMode. */
       PlanMode?: 'Off' | 'Allowed' | 'Required';
       EffortLevel?: number;
       /** Whether the agent may write memory notes in this space. */
       MemoryWrites?: boolean;
       /** Per-run limits, each at most the agent's own. The names follow MJ's agent columns. */
       Limits?: Record<string, number>;
   }

   /** One entity a type's participants may read, by a path to an anchor role (D28). */
   export interface DataReachDeclaration {
       Entity: string;        // the MJ entity name
       Path: string;          // a column of Entity, or one foreign-key hop: 'MemberID.ChapterID'
       AnchorRole: string;
       Band: 'Team' | 'Shared';
       Fields: string[];      // the allow-list
   }
   ```

5. **The server classes,** in `CoreEntitiesServer`, each refusing through `ValidateAsync`:
   - **`SpaceAnchor`:** the space exists; the entity exists and the record's key parses for it; at most one primary per space; `SpaceTypeID` matches the space's type, and follows it when the type changes; writes need *Configure Spaces* or come from the type's driver through `EnsureSpaceForRecord` or `SyncSeats`.
   - **`SpaceGrant`:** B15's validation: the target exists; each bound name is a real parameter or property of the target; each expression parses; the target is Canon-approved when the type seats participants (D34, and fail closed before A17); an agent's settings stay inside its definition. Writes need the settings authorizations (D23): *Configure Space Types* for app and type rows, *Configure Spaces* for a space's.
   - **`SpaceNote`:** the author is the caller on create, and only the author edits a note; a caller who can't see Team can't write a Team note; a private note is its author's alone.
   - **`SpaceMemberPin`:** the user is the caller; the caller can read the target.
6. **Reads:**
   - `SpaceAnchor`: the space's own filter (`fnCollaborationAccess`), so a participant sees the anchors of spaces they reach.
   - `SpaceNote`: the item filter's rule, by band, plus `Visibility = 'Private'` rows for their author only.
   - `SpaceMemberPin`: the owner only.
   - `SpaceGrant`: none for Space Participant. A participant's browser gets the space's configuration from the server, cut to what they may see ([§ 7](#7-stage-2-the-server)), so no grant row or bound value reaches it.
7. **Tests:** unit tests for every rule above; server harness checks for each gate's refusing and accepting sides; `persona-check.sql` for the four new tables.

**Accept:** a clean database builds from the migrations and `metadata/`; CodeGen shows no drift; the gates refuse and accept as listed, on both harnesses; `persona-check.sql` passes.

## 7. Stage 2: the server

**Items:** B16, B17, B18, and `example-chapter`'s server side (B24).

### B16: one resolver

- **`ResolveSpaceConfiguration`,** a pure function in `collaboration-core`, takes the app's settings, the type's configuration and grants, and the space's same-type run of ancestors with their configuration and grants, and returns:

  ```ts
  export interface EffectiveSpaceConfiguration {
      Settings: EffectiveSettings;                       // D20's keys, resolved
      Grants: Record<SpaceGrantKind, EffectiveGrant[]>;  // per kind, in Sequence order
      DefaultAgentGrantID: string | null;
      DataReach: DataReachDeclaration[];                 // the type's
  }

  export interface EffectiveGrant {
      GrantID: string;
      Kind: SpaceGrantKind;
      TargetEntityID: string;
      TargetRecordID: string;
      Label: string;
      Band: 'Team' | 'Shared';
      Bindings: SpaceGrantBindings;
      Settings: AgentGrantSettings | null;
      /** Where the grant came from, for the settings screen and the logs. */
      Level: 'App' | 'Type' | 'Space';
      LevelID: string | null;
  }
  ```

- **The chain** is D30's: the app, the type, the same-type run top down, the space. A run stops at the first ancestor of another type. `SpaceOverridable` still limits what a level below the type may set.
- **Grants** combine per kind: `Extend` adds a level's rows, `Replace` uses only them, and a `Remove` row drops one inherited grant by its target.
- **A grant whose target is gone** is left out, with a log. That only narrows.
- **Callers move to it:** the drivers' rules, the item and member gates, the agent turn, the settings screen and the engine. The old resolvers are deleted.
- **The browser** gets a space's configuration from a new server operation, `GetSpaceConfiguration(spaceId)`, which returns it cut to the caller: the grants in force for their band, with each grant's bindings removed. Staff with the settings authorizations get the whole document, for the Settings screen.

**Unit tests:** same-type inheritance; the restart at a type change; a same-type space below a parent of another type; `Extend`, `Replace` and `Remove` per kind; refused overrides; a grant whose target is gone; the cut a participant gets.

### B17: bindings and the grant operations

- **`ResolveBindings`,** on the server, evaluates each expression:
  - `Anchor:<role>` is the record ID of the space's anchor with that role. With no such anchor, or two, it refuses.
  - `Anchor:<role>.<Field>` reads that field of the anchored record on the server, as the system user, since the caller never sees the value.
  - `Space.<Field>` reads a field of the space: `ID`, `Name`, `StartedAt`, `PlannedCloseAt`, `ParentID` or `SpaceTypeID`.
  - `Config:<dotted.path>` reads the effective settings.
  - `User.ID`, `User.Email` and `User.PersonID` describe the caller; `User.PersonID` is the Person linked to them, and refuses when there isn't one.
  - A `Value` is used as it is.
- **Three operations,** in `CoreEntitiesServer`, over GraphQL in `packages/Server`, and in the typed client, `CollaborationClient`:
  - **`RunSpaceView(spaceId, grantId, properties?)`** runs the view as the caller, with the bound properties set through A14, so row-level security applies on top.
  - **`RunSpaceQuery(spaceId, grantId, parameters?)`** is D29's door. It runs the query with the bound values, as the system user, the way a stored procedure runs with its owner's rights, and passes the caller as the server-set context (A17), so the query's own SQL can check who asked. It records the caller and the values in the log.
  - **`GetSpaceDashboard(spaceId, grantId)`** returns the dashboard and its bound property values (A15). How its query parts and components run their queries is a design point ([§ 13](#13-design-points-to-settle-in-stage-1s-comment)).
  - **Until the MJ release** (the plan's D36), each runs only what [§ 4](#4-what-it-depends-on) allows: `RunSpaceView` runs view grants with no binding, `RunSpaceQuery` runs without the server-set context, and `GetSpaceDashboard` has no grant to return.
- **Every operation:**
  - parses its IDs before they reach a filter;
  - checks that the caller reaches the space, and that the grant is in force there for their band;
  - refuses a client value for a bound name, and for a name the target doesn't have;
  - logs the run, with the agent run's ID when an agent made it (A2).

### B18: data reach

- **The declarations** live in the type's configuration, as `DataReach`, validated when the type is saved: the entity exists, the path's columns exist and the hop is a real foreign key, the anchor role is one the type uses, and every field exists.
- **The generator,** `scripts/generate-data-reach-filters.mjs`, follows `generate-core-permissions.mjs`. It reads every type's declarations from `metadata/space-types/`, and writes:
  - one Space Participant row-level security filter per declared entity, which ORs every type's clause for that entity. Each clause keeps rows whose path value is the `RecordID` of an anchor with that role, on a space of that type the caller reaches through `fnCollaborationAccess`, and, for a Team declaration, only where the caller sees Team. The filter text follows the repo's rules: `TRY_CAST` on `{{UserID}}`, and the schema substitutions in bizapps-forms' `migrations/README.md`;
  - the entity field permissions: an Allow row for each listed field. A field with no row is denied only once the entity's field-level flag is on, so the generator warns about an entity whose flag is off; turning it on is the owning app's or the host's call;
  - the read grant itself for Space Participant, with the filter.
- **`--check`** makes it exit non-zero when the committed files differ from what it would write, and CI runs it.
- **`persona-check.sql`** gains a check per declared entity: a participant sees their anchored rows, and nothing else.

### B24: `example-chapter`, server side

In `packages/ExampleSpaceTypes`, with its test-only migration:
- a `Chapter` entity and a `Member` entity with a `ChapterID`;
- the type, with a data reach on Members, and its grants: a *Members* view with a bound `Chapter` property, an aggregate query (*renewals by month*) with a bound `ChapterID`, a dashboard with a bound `Chapter` property, and an action with a bound `ChapterID`;
- the world's chapters 12 and 40, their spaces with a primary anchor each, a same-type sub-space and a sub-space of another type under chapter 12, and the personas L, M and N of the plan's § 10.
- **under the plan's D36,** the chapter type's view, query and dashboard grants are refused on save until the follow-up, which is row 23's refusal. So the example also has a staff-only type, *Chapter staff*, anchored to a chapter the same way, whose space for chapter 12 holds the query with its bound `ChapterID`. The follow-up moves the grants back to the chapter type.

**Accept:** B16's unit tests; the binding resolver's tests, with every source and each refusal; the generator's output for each declaration shape, and its `--check`; and, on both harnesses, the plan's § 10 rows 14, 17, 18 and 21, row 23's refusal, and row 24 on the *Chapter staff* query's binding. Rows 13 and 16 are checked closed: a view grant with a binding, and any query or view granted to L's type, are refused (§ 4).

## 8. Stage 3: agents

**Item:** B20.

1. **The grants for the chat's audience.** The turn's server operation resolves the space's configuration and keeps the grants every participant's band allows: no Team grant when anyone in the chat can't see Team.
2. **Tools:**
   - `actionChanges` that limit the agent to Collaboration's own actions plus the granted ones;
   - `boundActionParams`, from each granted action's bindings (A16). Before A16, an action with a bound parameter isn't given to the agent;
   - `planMode`, `requestedSkillIDs` and `effortLevel` from the agent grant's settings. Memory writes and per-run limits apply the same way.
3. **Run space data,** one Collaboration action, registered as metadata:
   - its `Name` parameter is limited to the granted query and view names, listed in its description for this turn;
   - its other inputs are the named target's unbound parameters only;
   - it calls `RunSpaceQuery` or `RunSpaceView` directly, as code, not through another action.
4. **Knowledge:** the granted knowledge sources join the bounded search, under A10's classification.
5. **The chat area** stays MJ's (D25). The allowed agents it shows come from the configuration's agent grants.

**Accept:** the plan's § 10 row 20 on both harnesses; a unit test that the tool list for a turn with an outsider holds no Team grant; and rows 15 and 19 checked closed: an action with a bound parameter isn't given to an agent, and a dashboard grant isn't offered (§ 4). The check that a model's value for a bound parameter is discarded and logged waits for the follow-up.

## 9. Stage 4: the screens

**Items:** B19, B21's and B22's screens, B24's walkthrough, and the documents. The UI comes last (D16), its style and design are Amith's with the local builder (D24), nothing is typed in (D14), and MJ's components are used as they are (D15).

- **The data surface (B19):** a tab, labelled from the type's `Labels`, that lists the space's granted views, dashboards and components. Views render in MJ's view types, dashboards in MJ's dashboard viewer with their bound properties, and components in MJ's React host with props from their bindings. An L3-only MJ viewer is composed at L3. Its empty state says what the type offers.
- **Notes (B21):** a Notes list, a quick add from anywhere in the space, and *Turn into document*, which creates a file item through the upload path.
- **Pins (B22):** a *Pinned* strip at the top of the overview, *My pins* on Home across spaces, and a star on each space through MJ's User Favorites.
- **Settings:** grants, anchors and the data reach are shown and edited only with the settings authorizations (D23).
- **The walkthrough:** every new screen driven in Explorer with Playwright, as L, M and N and as staff, in light and dark, with the shots under `docs/screenshots/pr8/` and embedded by commit, as #7's are.
- **The documents:** the README, `docs/HOW_THE_SYSTEM_WORKS.md` (each new rule marked built), the extensibility plan, and each package's README, current at the merge.

**Accept:** the walkthrough, reviewed for function and completeness: each screen works on real data, has its loading, empty and error states, and is reachable by the people who should use it.

## 10. Verification

- **The plan's § 10 matrix** on both harnesses: rows 14, 17, 18, 20 and 21, row 23's refusal and row 24 on the *Chapter staff* query's binding; and rows 13, 15, 16 and 19 checked closed (§ 4). Their open side, row 23's approved side and row 24 on a view are the follow-up's (the plan's D36). Row 22 is B23's, after workstream T.
- **Unit tests** for every new rule, resolver and generator, in the packages they live in, run by the root `test` script.
- **`persona-check.sql`** for the new tables and every declared entity.
- **CI:** the build, the unit tests, the token and standards checks, the gallery, the generator's `--check`, and the database job from #7's B0.5 with both harnesses.
- **Each punch list** reports CI's result on the head, and the tallies.

## 11. What isn't in PR #8

- **The MJ pull request, and opening the grants [§ 4](#4-what-it-depends-on) holds closed.** Both come after this pull request (the plan's D36).
- **Meetings in spaces (B23),** which wait for workstream T in bizapps-tasks and for A18.
- **Workstream T and C4,** in their own repos.
- **An approval workflow for the Canon** (the plan's open decision 12). PR #8 reads the approval status A17 adds; it doesn't build the screens that set it.
- **The deal room's shape** (open decision 16).
- **Choosing member-level or aggregate-only** for a real chapter type (open decision 11). The example type does both.

## 12. Rules for the work

- **Punch lists.** Each push gets one numbered list, with the same numbers each time. Put item numbers in commit messages (`feat(B15): …`), and keep them out of code comments.
- **Metadata never goes in a migration.** A migration is DDL, extended properties and the appended CodeGen output. Rows are JSON under `metadata/`, with `uuidgen` IDs and no `sync` blocks. The release's metadata migration is the build engineer's.
- **Data changes are proposed first,** in a comment, before their migration.
- **Nothing that needs an unreleased MJ merges.** [§ 4](#4-what-it-depends-on)'s rules keep those grants refused, and the follow-up wires them once the release lands (the plan's D36).
- **Server first, screens last** (D16), and the screens are reviewed for function and completeness (D24).
- **Everything on the provider you were given:** `ProviderToUse` and `RunViewToUse`, never `new Metadata()` or a zero-argument `new RunView()`; `.Success` checked; `Save()` and `Delete()` checked; no empty `catch`.

## 13. Design points to settle in stage 1's comment

1. **A dashboard's query parts and a component's queries.** A participant holds no right to run queries (D29), so a granted dashboard's query parts, and a granted component that runs queries, have to go through `RunSpaceQuery`. Say how: a runner the dashboard viewer and the React host accept, which Collaboration points at its door (a change to A15 if MJ has no such hook), with each part's query granted in its own right; or dashboards with query parts granted only to staff-only types until then.
2. **Skills by ID in a grant's settings.** The extensibility plan's rule makes a pointer to a record that can be deleted a row. An agent's skills sit in its grant's settings instead, since they only narrow an agent that exists. The resolver drops a skill that's gone or outside `AcceptsSkills`, with a log. Confirm, or keep a skills table.
3. **`SpaceTypeID` on `SpaceAnchor`.** Denormalized, it lets the database enforce one primary anchor per type, entity and record; the server keeps it in step when a space's type changes. Or drop it and enforce the key in the server class only.
4. **Field-level flags on other apps' entities.** The generator can't turn on another app's entity's field-level flag. Say who does, for the example and for a real deployment.
5. **The approval status before A17.** Until MJ has it, a grant to a type that seats participants is refused (§ 4), which under the plan's D36 holds for all of PR #8. Confirm that's the rule, rather than a status of Collaboration's own.
