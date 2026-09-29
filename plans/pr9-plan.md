# PR 9: finish the chat, then anchors, grants, data reach, notes and pins

**What this is.** The plan for PR 9 and the pull requests after it. #8 merged on 2026-09-29 with the chat built but not finished, and with its planned stages not started (Amith: merge it, and put what's left here). PR 9 finishes the chat, tests the extension model end to end, and ends with a review of what that found. The pull requests after it build what #8 planned, make the app ready for a first host, and then take up the rest of [the plan](plan.md). The reasons and rules are the plan's, v0.6, with its D38 to D48. [#8's plan](pr8-plan.md) keeps the detail of the stages this one reuses.

**Who does what.**
- **Ian runs it,** with an AI coding agent as the builder: the builder writes the code, and Ian supervises it and decides.
- **The plan's author reviews each push** with one numbered punch list, and pushes only document updates, as for #7 and #8. Both sides merge the remote branch before pushing; nobody rebases or force-pushes.
- **It merges by stage.** PR 9 merges when stage 0 is done. Each later stage is its own pull request, opened from `next` when the one before it merges, with the plan's item numbers kept. #7 and #8 each ran long and merged as complete enough; a stage at a time is easier to review and keeps `next` working.

## Contents

1. [Where #8 leaves the app](#1-where-8-leaves-the-app)
2. [The order](#2-the-order)
3. [Stage 0: finish the chat, and learn the app](#3-stage-0-finish-the-chat-and-learn-the-app)
4. [Stages 1 to 4](#4-stages-1-to-4)
5. [Stage 5: ready for a first host](#5-stage-5-ready-for-a-first-host)
6. [After MJ#4789 ships: views and dashboards with properties](#6-after-mj4789-ships-views-and-dashboards-with-properties)
7. [The rest of the plan](#7-the-rest-of-the-plan)
8. [What holds throughout](#8-what-holds-throughout)
9. [Rules for the work](#9-rules-for-the-work)
10. [Day one](#10-day-one)

## 1. Where #8 leaves the app

#8 built the chat, its first job, on MemberJunction's chat area (D25) and MJ `next` (D37):
- **Conversations on request.** A space has none until someone starts one: General, Topic or Internal Only, from the rail's +, the new-conversation dialog or the Overview's ask box, through `CreateSpaceConversation`. Each is a `SpaceChat` row with its kind, and who reads it follows its kind and band.
- **Agent turns on the server.** `ExecuteSpaceChatTurn` checks the saved message again, runs the space agent through MJ's `AgentRunner`, and writes the reply as the system user. The agent's search is bounded by the conversation's audience.
- **Grants, as metadata:** Edit on a space's conversations for each contributing seat, and Space Participant's Create on Conversation Details with its create filter. Clients read only their own agent runs.
- **Host rules** on MJ's chat area: who can start a conversation, the reply mode, the default agent and mentions.
- **Closing a space** archives its conversations, and reopening restores them. A closed space's chat is read-only.

It didn't start [#8's stages 1 to 4](pr8-plan.md#6-stage-1-the-schema), and of the items #7 handed over ([#8's plan § 1](pr8-plan.md#what-7-moved-here)) only the chat's row is done. **At the merge:**
- **CI is red only for D37.** The widgets and the turn use types that exist only on MJ `next`, from [MemberJunction/MJ#4788](https://github.com/MemberJunction/MJ/pull/4788). For now there's no version pin (D39): the work runs on MJ `next` in a local workspace ([§ 3.1](#31-working-on-mj-next)), so CI stays red on those types until a release carrying them is pinned.
- **Tests,** in a clean copy of `b80bab6` on 6.1.3: Core's 116, EngineBase's 4, CoreEntitiesServer's 127 and IntegrationTests' 41 pass. The widgets' and ExampleSpaceTypes' tests need MJ `next`.
- **The chat's defects** are in [#8's final review](https://github.com/MemberJunction/bizapps-collaboration/pull/8#issuecomment-5881431958), of `b80bab6`, and they're stage 0.
- **#8's last commit, `ad5ffef`,** opens documents in Explorer. Amith asked for it after the final review, and it wasn't reviewed; PR 9's first punch list reviews it.

## 2. The order

| Stage | What | Pull request | Starts after |
|---|---|---|---|
| **0** | Finish the chat, on MJ `next` in a local workspace: fix #8's final review first, then walk the UI for what isn't built and test the extension model end to end, with subtypes and their screens (D42), rights by authorization (D40, D41) and Home's query (D45). The core defects it found are fixed in one MemberJunction pull request beside it (D48). It ends with a review of the findings | PR 9 | #8's merge |
| **1** | The schema: B14, B15, B21's and B22's tables, `DataReach`, one baseline, CI against a database | Its own | Stage 0 |
| **2** | The server: B16, B17, B18 and B24, with [#8's plan § 4](pr8-plan.md#4-what-it-depends-on)'s grants closed | Its own | Stage 1 |
| **3** | Agents: B20 | Its own | Stage 2 |
| **4** | The screens (D16): B19, notes, pins, the walkthrough and the documents | Its own | Stage 3 |
| **5** | Ready for a first host | Its own | Stage 4 |
| **Then** | [Views and dashboards with properties](#6-after-mj4789-ships-views-and-dashboards-with-properties), and [the rest of the plan](#7-the-rest-of-the-plan) | Their own | MJ#4789 in MJ's `next`, and stage 5 |

## 3. Stage 0: finish the chat, and learn the app

### 3.1 Working on MJ `next`

For now there's no version pin (Amith, 2026-09-29; the plan's D39). The work runs in a local pnpm workspace where MemberJunction's `next` branch and the app repos sit side by side, so every change builds against MJ's latest source:
1. **A plain parent folder of sibling clones:** MJ on `next`; bizapps-collaboration on this pull request's branch, `claude/hopeful-bell-6ldk4v`; the repos it depends on, bizapps-common and bizapps-tasks; and any other repo you change.
2. **One workspace over them,** made by `mj dev workspace`, as [MJ's quickstart](https://github.com/MemberJunction/MJ/blob/next/guides/DEV_WORKSPACE_QUICKSTART.md) says: build MJ once, run the generator from the parent, and let it remove the members' own installs. Install and build only from the parent. Never install inside a member, and never hand-link packages.
3. **No MJ pin, and no lockfile churn for it.** Leave the `@memberjunction/*` versions in every `package.json` as they are: the workspace links MJ's source whatever they say. When you add or change any other dependency, update the repo's own `pnpm-lock.yaml` from a standalone clone of this repo (`pnpm install --lockfile-only`), so CI's frozen install still passes. A lockfile install inside the workspace writes the parent's lockfile, not this one.
4. **A database of your own.** Two agents migrating or pushing metadata to one database break each other. Apply MJ core's migrations, then bizapps-common's and bizapps-tasks', then this app's (`pnpm run mj:migrate`) and its metadata (`pnpm run mj:push`), and load the world ([the data guide](../docs/reviewing-the-data.md)).

CI installs published packages, so it stays red on the `next`-only types (D37) until a release carrying them is pinned, which is [stage 5](#5-stage-5-ready-for-a-first-host)'s job. Judge each push by the workspace's build, the unit tests (`pnpm test`) and both harnesses (`pnpm run test:integration`; its client half needs MJAPI running with this app loaded).

### 3.2 #8's final review

Its items, with their numbers. Each is done when its last column holds. Do them before 3.3 and 3.4, starting with 27 and 28: until they're fixed, loading the world changes the shipped agent and seats a real account in whatever database it runs against.

| # | What's left | Done when |
|---|---|---|
| 5 | Low: two calls at once for one message both run; a failed final save leaves the reply at `In-Progress`; no test makes the history read fail | One reply per message even when two calls race, a failed final save marks the reply `Error`, and a test covers a failed history read |
| 11 | Three `sync` blocks, and 26 files with no final newline, in `metadata/` | No `sync` block, every file ends in a newline, and `git diff next -- metadata` shows only intended changes |
| 12 | The cleanup helper passes when a read fails or a row doesn't load; RM5, RM9 and WG6 4c clean up outside it; an assert in `finally` hides the check's own error; the harness's user isn't pinned | Every check cleans up through the helper, which fails on a failed read and confirms the rows are gone; a check's first error is the one reported; the harness's user is set and can delete what it must |
| 16 | The loaders write their lists before the selection is checked; a stale load clears the deep link; failed reads are silent | Each loader checks the selection before it writes, a deep link survives a stale load, and every failed read is logged |
| 23 | RM8's restore skips a space with no configuration, so RM9 fails; WG6 4c's reuse branch leaks a seat; screenshot 3 shows the stub; the rail repeats conversations and shows the checks' leftovers, and doesn't highlight the open one; the host-rules tests can't catch a broken default agent; an archived conversation's rules skip the Internal Only check | Both harnesses pass twice in a row from one load of the world; the five screenshots are taken again with the real agent; the rail lists each conversation once and highlights the open one (`UUIDsEqual`); the tests fail when the default agent resolves wrong |
| 24 | The banner uses two names that aren't MemberJunction tokens; a suggested response still sends in a closed space; the composer is hidden through MJ's internal class | The token check passes; MJ has an issue or pull request for a read-only chat area; a screenshot shows a closed space |
| 25 | The People tab lost invited and removed seats; the + border and the badge use hex; the unread states never show; the Overview doesn't follow back and forward; *Settings & Assistant* shows for everyone; the rail and chat tests render no template | People shows every seat and the counts show Active ones; tokens only; unread counts work or their UI goes; the Overview follows the conversation in the URL; the rail's link follows the configure right; tests render the read-only, closed and unread states |
| 27 | The world loader sets the shipped agent's driver to the stub; the stub ships in CoreEntitiesServer; no agent turn runs a search | No test changes a shipped row; the stub lives in IntegrationTests with its own agent row; a turn, or a check on a real search, proves the band on the search itself |
| 28 | The world loader seats a real account as Owner of every space, unchecked | No real account in the loader: the walkthrough's account comes from its environment and is seated by the walkthrough's own setup, or the walkthrough runs as the personas |
| `ad5ffef` | #8's last commit wasn't reviewed | Reviewed in PR 9's first punch list |

### 3.3 A pass through the UI

Much of what's left is found by using the app. Click through every screen, as staff and as a client (Ada and Bea in [the sample world](../docs/reviewing-the-data.md)), in light and dark: a screen that isn't built, a button that does nothing, a missing loading, empty or error state, a label that's wrong for the space's type. Post the list on PR 9, numbered on from the review's, and have the builder fill each gap. A gap that belongs to a later stage's work is marked for that stage instead.

### 3.4 The extension model, end to end

Collaboration's promise is that a new kind of space is configuration and a plug-in, not a fork of the app. Test that it works as intended, starting from the private example types, `example-board` and `example-room` ([the extensibility plan § 10.3](../docs/EXTENSIBILITY_PLAN.md#103-examples-in-collaboration-itself)):
- **Subtypes (IsA):** a type whose spaces are a subtype of `Space`, with its own table and columns, created, edited and loaded through the space's screens ([§ 7](../docs/EXTENSIBILITY_PLAN.md#7-isa-subtypes-and-their-forms)). All of it is in PR 9, the screens included (the plan's D42).
- **Server drivers:** a type's server driver running its rules and lifecycle hooks, such as creating a sub-space, changing a seat, closing and reopening, on the server, where the browser can't skip them ([§ 5](../docs/EXTENSIBILITY_PLAN.md#5-server-drivers)).
- **UI drivers and contributions:** a type adding its own tabs to a space and its own cards to the Overview tab, and another app contributing a tab or a card to a type it doesn't own ([§ 6](../docs/EXTENSIBILITY_PLAN.md#6-ui-drivers-and-contributions)).
- **Configuration:** a type that sets only what differs from the app's defaults, and a space that overrides what its type allows ([§ 4](../docs/EXTENSIBILITY_PLAN.md#4-configuration-one-bag-per-type-and-per-space)).

For each, say whether it works as intended. Fix what's small. What isn't, or what shows the model should go further, becomes an item for the stage it belongs to. `example-chapter` (B24, stage 2) then adds anchors, grants and data reach to the same test.

### 3.5 Findings, before stage 1

When the app runs and the code is familiar, write down what the UI pass, the extension-model test and a read of the code and architecture found, as a comment on PR 9. Go over it with Amith, and with Colin for anything about retrieval ([§ 8](#8-what-holds-throughout)), before stage 1 starts. It can change the stages that follow.

**Stage 0 is done when:**
- in the workspace, on MJ `next`, every package builds, and the token check (`node scripts/check-mj-tokens.mjs`) and the standards (`pnpm run mj:standards`) pass;
- the push's comment gives each package's `pnpm test` count, and both harnesses' tallies after a purge and a fresh load of the world;
- the five screenshots from #8's item 23 are taken again in Explorer, as named users, with the real agent answering. They're committed under `docs/screenshots/pr9/` with the Playwright script that takes them, and embedded in the comment;
- `metadata/` has no `sync` block, every file in it ends in a newline, and `git diff next -- metadata` shows only intended changes;
- the UI pass's gaps are filled or assigned to a stage, and the findings are reviewed;
- D41's authorization has replaced every check on a role's name, an `example-board` space is created, edited, reloaded and deleted through the screens (D42), and D45's query answers Home's counts, each with its tests;
- the MemberJunction pull request of D48 has been built and tested locally, and Amith has reviewed it.

### 3.6 Where stage 0 stands

At `c4903a3`, on 2026-09-29:
- **#8's final review:** every item is closed but the screenshots, which the browser pass takes.
- **The pass through the UI** ([its list](https://github.com/MemberJunction/bizapps-collaboration/pull/9#issuecomment-5883938837), items 42 to 74): most items are closed. Left are the screenshot row (70) and the hand-built controls (73).
- **The extension model** ([its list](https://github.com/MemberJunction/bizapps-collaboration/pull/9#issuecomment-5884125457), items 75 to 104):
  - **server drivers work in part:** every save runs its type's Validate hook, and reactions in the transaction and one resolver are stage 2's (79, 81);
  - **UI drivers' tabs and Overview cards are wired in the section,** contributions only add, and each Overview card declares its side. The page asks a driver before an invite and before a conversation starts, and for the details form; its other hooks (header chips and actions, settings sections, new-space steps, and the checks before a message or a new sub-space) aren't called yet;
  - **configuration works,** with `Admin.RoleNames` removed and `Labels.Bands` left for a type that needs it;
  - **subtypes are built** (D42): the Spaces resolver, a type paired with its subtype, the check on the entity a type names, a change to only a subtype's own columns held to the space's rules (119), the example tables in a schema of their own with their CodeGen output and forms, `CreateSpace` writing a space, its subtype and the owner's seat in one transaction, and the three screens (New space, Settings' Details card and the Overview's About card), each drawing a driver's component, else MJ's form for the subtype showing only the subtype's own sections, else a field for each column. Left: the details form has been rendered only through a stand-in for MJ's form host, which can't mount a real form in jsdom, so the browser pass checks it; a client's save of only a subtype's columns is judged without the space seeing them until [MJ#4870](https://github.com/MemberJunction/MJ/issues/4870), which the drivers' doc comments say; and the delete of a space through its subtype works around [MJ#4850](https://github.com/MemberJunction/MJ/issues/4850).
- **Added in review:** closing and reopening have their own authorization (D40); once a closed space's access has ended, its `OwnerID` keeps it; a close's confirmation reads from the server what the close will do, and only someone who may close the space can ask; ancestor seats honor post-close access at every hop; and the dialogs draw through MJ's `mj-dialog`.
- **Decided on 2026-09-29, and built:** the checks that went by a role's name ask the *Administer Spaces* authorization, and Settings offers agent retrieval only to someone who holds it (D41). Home's counts come from one approved query that only Integration may run, which the server runs as the system user, and Open Tasks and Invitations Waiting open the rows behind them, from two more (D45). `WhoCanStart` is `Anyone` or `Owners` (D43). A space's conversations offer no voice call.
- **Tests:** Core's 146, EngineBase's 18, CoreEntitiesServer's 267, Server's 10, IntegrationTests' 56, the page's 140 and its five rendered tests, the widgets' 151 and the example types' 45 pass in a clean install. The harnesses hold 75 checks on the server and 64 on the client, in eleven bundles each; at `61168bd` the builder ran both twice from a purge and a fresh load, and both passed (`c4903a3` changes only a doc comment and tests on the server side).
- **To finish:**
  - the MemberJunction pull request of D48, with MJ#4836 to MJ#4839, MJ#4850, MJ#4859, MJ#4864 and MJ#4870 in it. Amith gave the go-ahead on 2026-09-29: the builder builds it next and tests it locally, and Amith reviews it too;
  - the browser pass, now that the builder can sign in to Explorer: the details form (D42), the hand-built controls (73) and the screenshots;
  - bizapps-common's pull request 186, which Amith reviews and merges (D46);
  - § 3.5's findings.

  PR 9 merges once these are done and the MemberJunction pull request has been built, tested locally and reviewed by Amith.

## 4. Stages 1 to 4

[#8's plan](pr8-plan.md) holds them, unchanged, in its [§ 6](pr8-plan.md#6-stage-1-the-schema) to [§ 9](pr8-plan.md#9-stage-4-the-screens), each with its acceptance checks, and [its § 1's table](pr8-plan.md#what-7-moved-here) names the stage for each of #7's items. Read "PR #8" there as the stage's own pull request. What changed since it was written:
- **The chat's row is done,** apart from stage 0.
- **Stage 1 starts with the design comment** ([#8's plan § 6](pr8-plan.md#6-stage-1-the-schema), step 1), which settles [its § 13's points](pr8-plan.md#13-design-points-to-settle-in-stage-1s-comment) before any migration.
- **Stage 3 builds on the chat's turn,** `execute-space-chat-turn.ts`, instead of a new one. The grants for the conversation's audience, the tools and *Run space data* go into it.
- **Stage 4's walkthrough** puts its shots under `docs/screenshots/`, in the stage's own folder.

Each stage's pull request merges when that stage's checks pass.

## 5. Stage 5: ready for a first host

- **The adversarial test** over #7, #8 and stages 0 to 4 (#7's item 24).
- **A clean install:** a new database gets the app through `mj app install`, which runs migrations only, and both harnesses pass on it.
- **The release's metadata migration and the PostgreSQL migrations,** made by the build engineer at release from a clean database. Neither is hand-written in a feature pull request.
- **The pin:** a published MemberJunction release that carries everything the app uses, pinned with the lockfile, so CI goes green and a host can install the app.
- **The wrap-up** (#7's item 52): the README, `docs/HOW_THE_SYSTEM_WORKS.md`, the extensibility plan and each package's README, current. They were brought up to date on 2026-09-29, in PR 9, and each stage keeps them so.
- **Amith's calls:** who owns the app, and its license and publish path (the plan's open decisions 1 and 2).

## 6. After MJ#4789 ships: views and dashboards with properties

Colin builds [MemberJunction/MJ#4789](https://github.com/MemberJunction/MJ/pull/4789): A14 to A17, A18 and A19. Its core is **properties on MemberJunction's user views and user dashboards.**
- **A space binds them.** A view's or dashboard's properties take their values from the space: its anchor, its own fields, or who is asking. Neither the person nor an agent can see or change a bound value, and the server sets it on every run.
- **So one native view or dashboard serves every space of a type,** each showing only its own data. A chapter type's *Chapter Members* dashboard, for instance, shows each chapter's space its own members, already filtered, and nothing else.
- **Dashboards embed in a space,** on its data tab or its Overview. These are the user dashboards people build in MemberJunction's Data Explorer. Properties make each one reusable in any context that binds them.
- **Skip's generated components stay an option** beside them, where a view or dashboard isn't enough.

Once MJ#4789 merges into MJ's `next`, a pull request on the workspace opens the grants [#8's plan § 4](pr8-plan.md#4-what-it-depends-on) holds closed (D39). The plan's § 10 rows 13, 15, 16 and 19 then pass open, with row 23's approved side and row 24 on a view. A19 also closes a gap the chat has today: until it ships, someone with a contributing seat can save a message in a space's conversation as someone else, or as the agent.

## 7. The rest of the plan

After stage 5, in [the plan's § 9](plan.md#9-sequencing) order. Most of it needs MemberJunction core work first, as A items in their own pull requests:
- **Provenance:** A1 to A4, and B4, receipts in the UI.
- **Audience:** A5 to A7 and A11; the rest of B2 (B2.3 to B2.6), B3's posting and sealing, B9 (outside participants and identity) and B10 (exposure and hygiene).
- **Reach:** A8 to A10; B5 (the space agent outside the portal, over MCP, Slack and Teams), B6 (digests and subscriptions), B7 (proposed posts), and building `SyncSeats` (#7's item 39).
- **Breadth:** the rest of A12; B11 (PostgreSQL), B12 (embedding and cohorts), B13 (the remaining UX slices) and slice A's data (#7's item 50).
- **Meetings:** workstream T in bizapps-tasks, then B23 (meetings in spaces), then C4 (Committees on Collaboration, in a major version).

## 8. What holds throughout

- **The agent always runs in the scope of the person who asked.** Every turn, from a conversation, the ask box or a tool, has its search, knowledge, tools and every other input bound on the server to what that person may reach, and in a shared conversation to what everyone in it may reach. Nothing the browser or the model supplies widens it. The plan's [§ 5.3](plan.md#53-what-an-agent-may-use) says how. #8's chat does it with a required `Audience` the server derives, and each stage keeps it true for what it adds: grants, bindings and *Run space data*.
- **Retrieval is MemberJunction's to improve.** Search, audience bounding, knowledge sources and the rest of retrieval (RAG) change in MemberJunction core, in MJ's own pull requests, so every MemberJunction app gets the improvement. Colin leads that work. Collaboration uses it, and says what it needs.
- **The UI comes last in each stage** (D16), and MJ's own components are used as they are (D15).

## 9. Rules for the work

[#8's plan § 12](pr8-plan.md#12-rules-for-the-work) holds. #8's reviews found the same mistakes coming back, so these are added, and each push's comment reports on them:
- **No `sync` blocks, and no churn in `metadata/`.** `mj sync push` writes `sync` blocks back and drops each file's final newline. After a push, run `node scripts/strip-sync-blocks.mjs`, restore the newlines, and check that `git diff` shows only the change you meant.
- **Test code stays in the harness.** Nothing in `metadata/`, a shipped package or the world loader changes a shipped row for a test. A test-only agent is its own row, in the harness's metadata, with a `uuidgen` ID.
- **A test calls the code it tests,** and fails when that code is deleted.
- **Every `Save()` and `Delete()` is checked,** in tests and cleanup too, and cleanup asserts that what it removed is gone. A check that leaves rows behind breaks the next run.
- **Only MemberJunction's semantic tokens.** `node scripts/check-mj-tokens.mjs` checks the names, and no hex goes outside a `var()` fallback.
- **Nothing environment-specific** in code, documents or seeds: no real accounts, hosts or database names. The walkthrough's login comes from its environment.
- **Work in the workspace on MJ `next`** ([§ 3.1](#31-working-on-mj-next)): no version pin, no lockfile churn, and a database of your own.
- **Each push's comment reports evidence, not intent:** each package's `pnpm test` count in the workspace, both harnesses' tallies after a purge and a fresh load, and the screenshots committed in the branch. The review checks each claim against the code.

## 10. Day one

1. **Read,** in this order: this plan; [#8's final review](https://github.com/MemberJunction/bizapps-collaboration/pull/8#issuecomment-5881431958); the plan's [§ 3.5](plan.md#35-decided-on-2026-09-27-anchors-grants-data-notes-and-meetings) (D26 to D35), [§ 3.6](plan.md#36-decided-on-2026-09-29-8-merges-after-the-chat) (D38 and D39), [§ 5](plan.md#5-the-security-doctrine) and [§ 9](plan.md#9-sequencing); [the extensibility plan](../docs/EXTENSIBILITY_PLAN.md); [#8's plan](pr8-plan.md) § 4, § 6 and § 12; [how the system works](../docs/HOW_THE_SYSTEM_WORKS.md); and the repo's `CLAUDE.md`.
2. **Set up the workspace** ([§ 3.1](#31-working-on-mj-next)), with PR 9's branch, `claude/hopeful-bell-6ldk4v`, as the collaboration clone.
3. **Load the world** ([the data guide](../docs/reviewing-the-data.md)) from a purge, run both harnesses, and post the tallies and each package's `pnpm test` count as PR 9's first comment. They're the baseline every punch list compares against.
4. **Start stage 0** with #8's final review ([§ 3.2](#32-8s-final-review)). The UI pass and the extension model come once its items are closed.
