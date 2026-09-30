# PR 10: the rest of the plan, until it's done

**What this is.** PR 9 merged into `next` on 2026-09-29 (merge commit `96a19b6`), as its builder left it at `67acf8f` (the plan's D50). PR 10 carries **everything left in [the plan](plan.md)**: the rest of stage 0, stages 1 to 5, the work after MemberJunction's view and dashboard properties, meetings, and the rest of the plan's items. The work doesn't stop until every item here is done (Amith, 2026-09-29; the plan's D51). **Its first task is to work on MJ `next` with no workarounds:** [§ 2](#2-first-task-mj-next-and-no-workarounds).

**Who does what.**
- **Ian runs it** (Amith, 2026-09-29), with an AI coding agent as the builder: the builder writes the code, and Ian supervises it and decides. The pull request is assigned to him.
- **The plan's author reviews each push** with one numbered punch list, and pushes only document updates. Both sides merge the remote branch before pushing; nobody rebases or force-pushes.
- **Amith** settles the calls in [§ 11](#11-amiths-calls) and merges.
- **Work that belongs in another repo** goes in that repo's own pull request, reviewed the same way, and this plan tracks it ([§ 3](#3-the-pull-requests-beside-this-one)).
- **It merges once, when every item here is done** (D51). The stages keep their order and their checks inside it, and each review covers what the push touched.

## Contents

1. [Where PR 9 leaves the app](#1-where-pr-9-leaves-the-app)
2. [First task: MJ `next`, and no workarounds](#2-first-task-mj-next-and-no-workarounds)
3. [The pull requests beside this one](#3-the-pull-requests-beside-this-one)
4. [The rest of stage 0](#4-the-rest-of-stage-0)
5. [Stages 1 to 4: anchors, grants, data reach, notes and pins](#5-stages-1-to-4-anchors-grants-data-reach-notes-and-pins)
6. [Meetings: a first-class app in bizapps-tasks](#6-meetings-a-first-class-app-in-bizapps-tasks)
7. [Stage 5: ready for a first host](#7-stage-5-ready-for-a-first-host)
8. [After MJ#4789: views and dashboards with properties](#8-after-mj4789-views-and-dashboards-with-properties)
9. [The rest of the plan](#9-the-rest-of-the-plan)
10. [Verification](#10-verification)
11. [Amith's calls](#11-amiths-calls)
12. [Rules for the work](#12-rules-for-the-work)
13. [How reviews run](#13-how-reviews-run)
14. [Day one](#14-day-one)

## 1. Where PR 9 leaves the app

[PR 9's plan § 3.6](pr9-plan.md#36-where-stage-0-stands) has the detail. In short:
- **The chat is finished,** on MemberJunction's chat area, with agent turns on the server bounded by the conversation's audience, a reply named for its agent with its live status, conversations started on request, and a read-only chat, with a lock that says why, for a closed space and for a reader with no seat that can post.
- **The extension model has been tested end to end,** subtypes and their screens included (D42). What it found for later stages is in [§ 5](#5-stages-1-to-4-anchors-grants-data-reach-notes-and-pins).
- **Rights go by the *Administer Spaces* authorization** (D40, D41), and Home's counts come from one approved query (D45).
- **Tests at `67acf8f`:** Core 146, EngineBase 18, CoreEntitiesServer 269, Server 10, IntegrationTests 56, the page's 140 and five rendered, the widgets' 155 and the example types' 45. Both harnesses (76 server checks, 65 client checks) passed twice from a fresh world.
- **PR 9's open items move here with their numbers** ([its final review](https://github.com/MemberJunction/bizapps-collaboration/pull/9#issuecomment-5900284445)): 🔴 32, 122 and 123; 🟡 120, 121, 124, 125, 73, and the screenshots (23, 25, 29, 38, 70's row and D42's screens). **The next new item is 126.**
- **PR 9 still carries its own handling of MemberJunction defects.** That's D50's one exception to D49, and [§ 2](#2-first-task-mj-next-and-no-workarounds) takes it out first.

## 2. First task: MJ `next`, and no workarounds

### 2.1 Work on MJ `next`

There's no version pin for now (D39). The work runs in a local pnpm workspace where MemberJunction's `next` and the app repos sit side by side, so everything builds against MJ's latest source:
1. **A plain parent folder of sibling clones:** MJ; bizapps-collaboration on this pull request's branch, `claude/hopeful-bell-6ldk4v`; bizapps-common; bizapps-tasks; bizapps-committees when [§ 9](#9-the-rest-of-the-plan)'s Committees work starts; and any other repo you change.
2. **MJ's clone is on the branch of [MJ#4891](https://github.com/MemberJunction/MJ/pull/4891),** `fix/core-defects-4836-4870`, until it merges into MJ `next`, and on `next` after that. Keep it at the branch's latest commit: the branch moves while it's reviewed, so pull it and rebuild MJ from the parent before each step. Any other MemberJunction fix this work needs goes on a branch of its own in the same clone ([§ 2.2](#22-the-rule)).
3. **One workspace over them,** made by `mj dev workspace`, as [MJ's quickstart](https://github.com/MemberJunction/MJ/blob/next/guides/DEV_WORKSPACE_QUICKSTART.md) says: build MJ once, run the generator from the parent, and let it remove the members' own installs. Install and build only from the parent. Never install inside a member, and never hand-link packages.
4. **No MJ pin, and no lockfile churn for it.** Leave the `@memberjunction/*` versions in every `package.json` as they are. When you add or change any other dependency, update this repo's own `pnpm-lock.yaml` from a standalone clone (`pnpm install --lockfile-only`), so CI's frozen install still passes.
5. **A database of your own.** Two agents migrating or pushing metadata to one database break each other. Build it by [the database guide](../docs/building-the-database.md), and load the world by [the data guide](../docs/reviewing-the-data.md).

CI installs published packages, so it stays red on the types that exist only on MJ `next` until [stage 5](#7-stage-5-ready-for-a-first-host) pins a release. Judge each push by the workspace's build, the unit tests (`pnpm test`) and both harnesses (`pnpm run test:integration`; its client half needs MJAPI running with this app loaded).

### 2.2 The rule

**No workarounds** (the plan's D49). The apps are built on MemberJunction's `next`, so a MemberJunction defect is fixed in MemberJunction and never worked around in an app, not even while the fix is on its way:
- no stopgap code, and no comment that excuses a core defect;
- no hand-run step in a doc;
- no reaching into MJ's markup or styles (`::ng-deep` into an MJ component);
- no copy of an MJ component, or of MJ's private code;
- no parallel path beside MJ's own.

When something in MemberJunction doesn't do what a screen or a server path needs: file an MJ issue with a proposed fix, make the fix in an MJ pull request, and work against its branch in the workspace. The app's pull request relies on the fix, and works on MJ `next` once that pull request is in it. A review treats a workaround as blocking (🔴).

### 2.3 Take out PR 9's workarounds (122 and 123)

Each comes out with the MemberJunction fix it waits on. The tests that pinned the workaround are changed to pin the fix. Paths are at `96a19b6`, `W` is `packages/AngularWidgets/src/lib` and `SES` is `packages/CoreEntitiesServer/src/SpaceEntityServer.ts`.

| MJ issue | What the app does today | What replaces it |
|---|---|---|
| [MJ#4836](https://github.com/MemberJunction/MJ/issues/4836) | [The database guide](../docs/building-the-database.md)'s step 6 pushes the metadata one directory at a time | One `mj sync push --dir=metadata`. **Done** in the guide on 2026-09-30, from the day-one baseline |
| [MJ#4837](https://github.com/MemberJunction/MJ/issues/4837) | The guide's step 5 has you grant Developer *Create* on row-level security filters by hand, in SQL | MJ's own metadata carries the grant, so step 5 goes. **Done** in the guide on 2026-09-30, from the day-one baseline |
| [MJ#4838](https://github.com/MemberJunction/MJ/issues/4838) | The chat hides MJ's composer from outside (`::ng-deep .message-input-container-wrapper`, `W/space-chat.component.ts:288`) and binds `!IsReadOnly` into six of the chat area's inputs (`:47-48`, `:51`, `:53-55`) | The chat area's own `ReadOnly` input. The lock (`:82-83`, `:114-115`) and the New buttons (`:93`, `:141`) are the app's own and stay |
| [MJ#4839](https://github.com/MemberJunction/MJ/issues/4839) | `W/dialog-base.ts` does the focus handling for the new-conversation, new-space, share-check and upload dialogs | `mj-dialog`'s own focus handling and `AriaLabel`. `dialog-base.ts` goes |
| [MJ#4850](https://github.com/MemberJunction/MJ/issues/4850) | `SES:677-687`: `Delete()` hands a space with a subtype to the subtype first. `packages/IntegrationTests/src/checks/cleanup-helpers.ts:56-63` deletes through the subtype | A plain `Delete()` |
| [MJ#4864](https://github.com/MemberJunction/MJ/issues/4864) | `cleanup-helpers.ts:64-68` ignores `Delete()`'s `false` over GraphQL and lets a read-back decide | `Delete()`'s answer is checked. The read-back stays, as the confirmation |
| [MJ#4870](https://github.com/MemberJunction/MJ/issues/4870) | `SES:736-744` judges a subtype-only change with no old values when the subtype isn't in reach, and `subtypeOldValues()` (`SES:691-693`) returns none. The driver's doc comments (`base-space-type-server-driver.ts:162-165`, `:179`) tell a type to put its subtype rules in its own entity class | The space sees its subtype on every path: the unseen branch and the doc comments' caveat go, and a check pins that a client's save of a subtype column reaches the driver with its old and new values |
| [MJ#4859](https://github.com/MemberJunction/MJ/issues/4859) | Two comments excuse core's load error (`packages/CoreEntitiesServer/src/create-space.ts:57`, `packages/Angular/src/lib/logic/space-details.ts:45-46`) | The comments go, and a check asserts that creating a space with its subtype logs no load error |
| [MJ#4884](https://github.com/MemberJunction/MJ/issues/4884) (123) | `packages/Server/src/execute-space-chat-turn.resolver.ts` copies `RunAIAgentResolver`'s private status publishing: `SIGNIFICANT_STEPS` (`:7`), `observeTurn` (`:59`), and messages sent under the resolver name `RunAIAgentResolver` (`:64`) | MJ's exported publisher, handed to the turn. The copy goes, and a test pins that the resolver gives the turn MJ's publisher |
| [MJ#4885](https://github.com/MemberJunction/MJ/issues/4885) | Nothing: a turn that finishes before its reply row is shown stays in progress until a reload | A browser check that a fast turn completes without a reload |

**Low, answered:** the widget starts MJ's status subscription through the Angular service's `initialize()` (`W/space-chat.component.ts:319-322`), as MJ's own workspace does (`conversation-workspace.component.ts:894`). That method isn't deprecated; the deprecated call is the runtime's `initialize()`, inside MJ's service. Nothing changes here.

**The order:**
1. **MJ#4891 lands in MJ `next`,** with all ten issues. It holds eight today, and the plan's author asks for [MJ#4884](https://github.com/MemberJunction/MJ/issues/4884) and [MJ#4885](https://github.com/MemberJunction/MJ/issues/4885) in it too (D48). Amith reviews and merges it.
2. **While it's open,** take the workarounds out here against its branch in the workspace, and run both harnesses there.
3. **Once it's in MJ `next`,** run both harnesses again on `next`.

**Done when:**
- none of the sites above is left: `git grep -nE "::ng-deep|dialog-base|CollabDialogBase" -- packages` finds nothing, no comment excuses a MemberJunction defect, and no doc describes a stopgap for one. A test that pins a fix may name its MJ issue;
- the unit tests and both harnesses pass in the workspace on MJ `next` with MJ#4891 in it, and the push's comment gives the counts.

## 3. The pull requests beside this one

| Repo | Pull request | What | Built by | Reviewed and merged by |
|---|---|---|---|---|
| MemberJunction | [MJ#4891](https://github.com/MemberJunction/MJ/pull/4891) | The ten core fixes of D47 and D48 ([§ 2.3](#23-take-out-pr-9s-workarounds-122-and-123)) | The builder of D48 | The plan's author reviews; Amith reviews and merges |
| MemberJunction | [MJ#4789](https://github.com/MemberJunction/MJ/pull/4789) | A14 to A19: properties on views and dashboards, bound action parameters, locked query parameters, calendars, and who a message is from | Colin (D36) | MJ's reviewers; Amith |
| MemberJunction | One per item or group of [the plan's workstream A](plan.md#6-workstream-a-memberjunction-core) not in the two above | A1 to A13 ([§ 9](#9-the-rest-of-the-plan)), the urgent A12.1, A12.2 and A12.13 first | This pull request's builder, unless Amith names someone | The plan's author reviews; Amith merges |
| bizapps-common | [bizapps-common#186](https://github.com/MemberJunction/bizapps-common/pull/186) | People's field-level security (item 32, D46) | Already written | Amith |
| bizapps-tasks | A new pull request | Meetings, a first-class app (workstream T, [§ 6](#6-meetings-a-first-class-app-in-bizapps-tasks)) | This pull request's builder | The plan's author reviews; bizapps-tasks' maintainers and Amith merge |
| bizapps-committees | Two new pull requests: C0, then C4 | Committees' fixes, then Committees rebuilt on Collaboration and on Tasks' meetings ([§ 9](#9-the-rest-of-the-plan)) | This pull request's builder | The plan's author reviews; Committees' maintainers and Amith merge |

Each one follows its own repo's `CLAUDE.md`, gets numbered punch lists, and reports its tests in its description. Link each here when it opens.

## 4. The rest of stage 0

Each item keeps its number. Paths are at `96a19b6`.

**🔴 32: People's field-level security.** [bizapps-common#186](https://github.com/MemberJunction/bizapps-common/pull/186) turns it on (D46), and Amith is reviewing it. Until it's in, FLS3 fails on a fresh database, and a client reads every People field of everyone in their spaces. **Done when:** it's merged, the workspace uses common's `next`, FLS3 passes on a fresh database, and the database guide's *What you need* points at it (the plan's author edits the guide).

**🔴 122 and 123:** [§ 2.3](#23-take-out-pr-9s-workarounds-122-and-123).

**🟡 120: the board's About card shows the next meeting its driver hides.** A form ignores a driver's `hiddenFieldNames` (`packages/Angular/src/lib/logic/details-view.ts:38-40`), and the example board's generated form has one section holding all six of its columns, so the Overview shows the board's real next meeting beside the static next-meeting card, which says something else ([the note](https://github.com/MemberJunction/bizapps-collaboration/pull/9#issuecomment-5897632418)).
- **Fix:** treat a hidden column like one of the space's own: a form section that holds only hidden columns is left out, and a section that mixes hidden and shown columns means the field list. `subtypeFormSections` in Core already has that shape; give it the hidden names once the driver's descriptor is known. A required column is never hidden, as in `visibleDetailFields`. Give the next meeting's two columns a category of their own in `metadata-tests/entity-fields/`, so the board's form shows *Board Details* alone.
- **Done when:** unit tests pin both rules, and the browser pass shows the board's form with its four other columns on New space, Settings' Details card and the About card.

**🟡 121: until the seat is known, the chat tells everyone, owners included, that they can't post.** Opening a space clears the caller's seat, shows the tab, and only then resolves the seat again, so for a moment `canContribute` is false for everyone ([punch list 21](https://github.com/MemberJunction/bizapps-collaboration/pull/9#issuecomment-5897893910)).
- **Fix:** keep whether the seat is known apart from what it is. Decide the chat's state in one function under `logic/`, with a test per case: a closed space gets the closed note; before the seat is known, no composer and no note; a seat that can't post, or none, gets the no-seat note; otherwise the chat is open. Bind MJ's `ReadOnly` input ([§ 2.3](#23-take-out-pr-9s-workarounds-122-and-123)) and the lock to its answer.
- **Lows:** the note says "this conversation", but the lock also shows over the list, where "this space's conversations" fits; name the lock's class for what it is now.
- **Done when:** the function's cases pass, the page uses it, and the browser pass shows an owner switching spaces on the Chat tab with no note, and a reader with no seat seeing it.

**🟡 124: three deletions pass every test** ([the final review](https://github.com/MemberJunction/bizapps-collaboration/pull/9#issuecomment-5900284445)): the guard that keeps an observer's fault out of the turn (`packages/CoreEntitiesServer/src/execute-space-chat-turn.ts:346-352`), whose test runs where the call has already answered; the header lock's reason and label (`W/space-chat.component.ts:83`), since the tests render only the corner lock (`:115`); and the page's `Background: true` (`packages/Angular/src/lib/collaboration-section.component.ts:3820`). **Done when:** a test fails without each, or without what replaces it after 123. **Done** at `911951c`, in `execute-space-chat-turn.test.ts`, `render.test.ts` and `logic/agent-turn.test.ts`.

**🟡 125: only a mouse can read the lock's reason.** It's the lock's `title` and `aria-label`: a screen reader reads it, but keyboard focus shows nothing and a touch screen can't hover, and a focusable `role="img"` gives a keyboard user nothing to act on. **Fix:** keep Amith's small lock, and show its reason on focus and on tap too, for example from a button that toggles it. **Done when:** a test shows the reason after focus and after a click.

**🟡 73: the widgets rebuild MJ components instead of using them, and the same things have different names** ([the UI pass list](https://github.com/MemberJunction/bizapps-collaboration/pull/9#issuecomment-5883938837)). The wording is done. Left:
- spinners drawn with `fa-spinner` instead of `<mj-loading>`; empty states instead of `mj-empty-state`; banners instead of `mj-alert`; native `<select>`s instead of `mj-dropdown`; pill filters instead of `mj-filter-chip`; hand-styled buttons instead of `mjButton`;
- one name for each thing: the rail's and the tabs' labels agree, and the bands' names come from the type (#7's item 53, [stage 2](#5-stages-1-to-4-anchors-grants-data-reach-notes-and-pins));
- dates by locale, with a year where it's needed, and no "Invalid Date";
- two doc comments on the wrong member: `canSeeTeamSide`'s sits on `outsideParticipantCount`, and the rail has two on one member.
- Where an MJ component can't do what a screen needs, the fix goes in MJ ([§ 2.2](#22-the-rule)).
- **Done when:** none of those hand-built controls is left, a unit test covers the date formatter's locale and bad input, and a screenshot shows the rail and the tabs with one set of names.

**Low:** `packages/IntegrationTests/src/world/load-world.ts:344` still says a closed space shows a banner.

**The browser pass and the screenshots.** Amith gives the builder a tester account. Take the screenshots:
- with the workspace's MJ on `next` after MJ#4891 is in it, so they show what merges;
- as named users with seats: staff, and a seated client, with the real agent answering. A Developer who reads every space without a seat sees neither the composer nor Upload and New;
- in light and dark where an item asks;
- committed under `docs/screenshots/pr10/` with the Playwright script that takes them, and embedded in the push's comment.

| Item | What the screenshots show |
|---|---|
| 23 | #8's item 23's five screenshots, taken again with the real agent answering |
| 25 | The UI pass script's rows: People lists every seat and counts the Active ones, the unread states, and the read-only and closed chats. Its rendering assertions go in the script |
| 29 | Opening a file: MJ's viewer, with its tab showing a way back to the space |
| 38 | *Add file* and its band choice: Discovery's default is Team, and Sam's Shared choice is refused |
| 70's row | A type with `LibraryPanel` off |
| D42 | New space, Settings' Details card and the About card, with the example board's form showing only its own section (after 120) |
| 121, 125 | An owner switching spaces on the Chat tab with no note; a reader with no seat seeing it; the lock's reason on focus and on tap |
| MJ#4884, MJ#4885 | A turn's live status, and a fast turn that completes without a reload |

**The findings** ([PR 9's plan § 3.5](pr9-plan.md#35-findings-before-stage-1)). Write down, as a comment on this pull request, what the UI pass, the extension-model test and a read of the code and architecture found, each with its evidence and the stage it belongs to. Go over it with Amith, and with Colin for anything about retrieval ([§ 12](#12-rules-for-the-work)), before stage 1 starts. Already recorded:
- search can't find a library file by name: the Space Items lane matches rows that point at a record, so a search as Bea finds tasks but no file;
- *Agents In Reach* returns whole agent rows, and MJ's agent view includes the owner's name, so an agent a staff member attaches shows their name to every client in reach. The fix is field-level security on a core entity: an MJ issue ([§ 2.2](#22-the-rule));
- a turn's claim on a message holds within one server;
- the extension model's later items, placed in [§ 5](#5-stages-1-to-4-anchors-grants-data-reach-notes-and-pins) and [§ 9](#9-the-rest-of-the-plan).

**Stage 0 is done when** every item above is closed, the screenshots are committed, and the findings are reviewed.

## 5. Stages 1 to 4: anchors, grants, data reach, notes and pins

[#8's plan](pr8-plan.md) holds these stages, each with its acceptance checks, in its [§ 6](pr8-plan.md#6-stage-1-the-schema) to [§ 9](pr8-plan.md#9-stage-4-the-screens), and [its § 1's table](pr8-plan.md#what-7-moved-here) gives the stage of each of #7's items. Read "PR #8" there as this pull request. The plan's [B14 to B24](plan.md#b14-spaceanchor-d26) are their items, and [§ 3.5](plan.md#35-decided-on-2026-09-27-anchors-grants-data-notes-and-meetings) their decisions (D26 to D35).

| Stage | Plan items | #7's items | The extension model's items |
|---|---|---|---|
| **1. The schema** | Starts with the design comment ([#8's plan § 13](pr8-plan.md#13-design-points-to-settle-in-stage-1s-comment)). B14 (`SpaceAnchor`), B15 (`SpaceGrant`), B21's `SpaceNote` and B22's `SpaceMemberPin`, and `DataReach` in the configuration; one baseline regenerated from a clean database; CI against a real database | 12, 13, 14, 15, 18, 19, 38, 40, 63, 64 | 104 (the two `Configuration` columns typed) |
| **2. The server** | B16 (one configuration resolver), B17 (bindings and the grant operations), B18 (data reach and its generated filters), B24 (`example-chapter`), with [#8's plan § 4](pr8-plan.md#4-what-it-depends-on)'s grants closed until MJ#4789 (D36) | 6, 11, 12, 20, 22, 29, 34, 35, 36, 37, 38, 40, 41, 42, 47, 53, 54, 55, 56, 58 | 79 (reactions inside the save), 81 (drivers judge the resolved rules), 85 (`EnsureSpaceForRecord` as an operation), 86 (subscribers by type), 94 (frame 08 through the driver), 101 (types that don't restate the app's defaults), 102 (the storage setting used on upload), 103 (a screen for a space's overrides) |
| **3. Agents** | B20: the grants in force for the chat's audience, tools, *Run space data* and knowledge. It builds on the chat's turn, `execute-space-chat-turn.ts` | 3, 28, 42 | 83 (the turn and messages reach the type's driver; its message hooks wait on A19, D44) |
| **4. The screens** (D16) | B19 (the data surface), B21's and B22's screens, and the walkthrough, checked through end-to-end screenshots | 3, 4, 9, 16, 17, 22, 23, 25, 26, 29, 49, 50, 51, 53, 57, 58, 66 | 97 (the type's vocabulary instead of per-type words) |

#7's items 8, 57 and 61, the chat, are done but for their screens, which stage 4 checks. PR 9 finished some of these along the way, such as ancestor seats honouring access after close; each stage's first push says which are done, with the evidence.

Each stage is done when its checks in #8's plan pass, its items here are closed, and the push's comment shows it. A stage's data change is proposed in a comment before its migration, as the extensibility plan's § 3 asks.

## 6. Meetings: a first-class app in bizapps-tasks

Meetings and agendas are work, so they live in bizapps-tasks, where every app gets them (D33), and they're a first-class app there, not a corner of Committees (Amith, 2026-09-29; the plan's D52). **[The meetings plan](meetings-plan.md) is the design:** the entities down to their columns, the *Meetings* application in Explorer, calendar sync, the AI, the screens, the tests and what's done when. It's built in its own pull request in bizapps-tasks ([§ 3](#3-the-pull-requests-beside-this-one)).

The order, from [the meetings plan § 12](meetings-plan.md#12-order-and-done-when):
1. **T1:** the tables with their CodeGen output, their rules on the server, the services and the metadata.
2. **T4:** the `tasks-ng-widgets` package, and the *Meetings* app's screens, all but the calendar.
3. **T3:** notes from a transcript, proposed tasks and agenda drafting.
4. **Video:** Zoom's driver, and Teams and Meet as the meetings plan settles.
5. **T2:** calendars, once A18 is in MJ `next` ([§ 8](#8-after-mj4789-views-and-dashboards-with-properties)).
6. **B23, meetings in spaces,** here: a space's *Meetings* tab, *Coming up*, a meeting's own conversation, and the agent using a meeting's agenda and notes under the same band rules. In the workspace it's built against bizapps-tasks' branch, so it doesn't wait for a release.
7. **C4,** Committees on Tasks' meetings ([§ 9](#9-the-rest-of-the-plan)).

Nothing in steps 1 to 4 waits on MemberJunction, so they can start as soon as the meetings plan is reviewed.

## 7. Stage 5: ready for a first host

- **The adversarial test** over everything built so far (#7's item 24).
- **A clean install:** a new database gets the app through `mj app install`, which runs migrations only, and both harnesses pass on it.
- **The release's metadata migration and the PostgreSQL migrations,** made by the build engineer at release from a clean database. Neither is hand-written in this pull request.
- **The pin:** a published MemberJunction release that carries everything the app uses, pinned with the lockfile, so CI goes green and a host can install the app.
- **The wrap-up** (#7's item 52): the README, [how the system works](../docs/HOW_THE_SYSTEM_WORKS.md), [the extensibility plan](../docs/EXTENSIBILITY_PLAN.md) and each package's README, current. The plan's author keeps them current as the work lands.
- **Amith's calls** on the owner, the license and the publish path ([§ 11](#11-amiths-calls), decisions 1 and 2).

## 8. After MJ#4789: views and dashboards with properties

Colin builds [MJ#4789](https://github.com/MemberJunction/MJ/pull/4789): A14 to A19 ([PR 9's plan § 6](pr9-plan.md#6-after-mj4789-ships-views-and-dashboards-with-properties) says what they give a space). Once it's in MJ `next`, work on it in the workspace:
- **Open the grants** [#8's plan § 4](pr8-plan.md#4-what-it-depends-on) holds closed. The plan's [§ 10](plan.md#10-verification) rows 13, 15, 16 and 19 then pass open, with row 23's approved side and row 24 on a view.
- **A19, who a message is from:** a type's message hooks (D44, the extension model's item 83), and the rule that only the server writes an agent's reply.
- **A18, calendars:** T2 in bizapps-tasks ([§ 6](#6-meetings-a-first-class-app-in-bizapps-tasks)).
- **Dashboards embed in a space** on its data tab or Overview, bound to the space's properties (B19).

## 9. The rest of the plan

In [the plan's § 9](plan.md#9-sequencing) order: the first row beside stage 1, and the rest after stage 5. Items marked **A** are MemberJunction pull requests ([§ 3](#3-the-pull-requests-beside-this-one)), and the rest are built here unless the row says otherwise. Each item's detail and acceptance are in the plan.

| Theme | MemberJunction (A) | Collaboration (B), here | Elsewhere |
|---|---|---|---|
| **First, beside stage 1** | A12.1 and A12.2 (search's storage bypass, trust and lane filters); A12.13 (`cacheInvalidation` sends every saved row to every signed-in socket: urgent) | | C0 in bizapps-committees: ballot sealing on the server, the misnamed entity overrides, and `IsPublic` |
| **Provenance** | A1 (ambient run context), A2 (resource access log), A3 (search execution logs), A4 (provenance on outputs) | B4 (receipts and citations in the UI, sealed messages, the copy warning) | |
| **Audience** | A5 (conversation participants), A6 (agent runs bounded by an audience), A7 (sealing on a change of audience), A11 (read auditing), A12.14 to A12.17 | B2's rest (B2.3 to B2.6: the agent on A6, the scope control, `agentMayQuote` everywhere, the matrix), B3 (conversations on core participants, posting, sealing for newcomers), B9 (outside participants and identity), B10 (exposure and hygiene) | |
| **Reach** | A8 (approval-gated posts), A9 (identity on outside channels), A10 (knowledge classification), A13.3 (the rest of the extensibility plan's MJ list) | B5 (the space agent over MCP, Slack and Teams), B6 (digests), B7 (proposed posts), B8's rest: outreach sources through `SpaceSignalProvider`, and `SyncSeats` (#7's item 39, the extension model's 89) | |
| **Breadth** | The rest of A12 | B11 (PostgreSQL), B12 (embedding and cohorts), B13 (the remaining UX slices, B to I, last and checked by use, D16), and slice A's data (#7's item 50) | |
| **Meetings** | A18 ([§ 8](#8-after-mj4789-views-and-dashboards-with-properties)) | B23 ([§ 6](#6-meetings-a-first-class-app-in-bizapps-tasks)) | Workstream T in bizapps-tasks; C4 in bizapps-committees, in a major version |

**Committees (C4)** is rebuilt on Collaboration in one step (D35), as [the plan's C4](plan.md#c4-rebuild-committees-in-one-step-d35) and [Committees' rebuild plan](https://github.com/MemberJunction/bizapps-committees/blob/next/plans/COLLABORATION_REBUILD_PLAN.md) say: `Committee` and `Term` as subtypes of `Space`, its meeting tables stripped out in favour of Tasks' meetings, its governance pointed at them, and no data carried over. It needs T1, and C0 comes first.

**Dogfooding** starts only when a real client space can hold both bands and a shared conversation is provably bounded by its audience: A6 and B2 pass the plan's § 10 matrix. No real client goes in a shared conversation before that.

## 10. Verification

The plan's [§ 10](plan.md#10-verification) is the bar for the whole of it:
- **The personas** join the sample world: directors D and E on a board with a sealed compensation sub-space, outside director O, consultant C and client K on Acme, stranger S, and chapter leaders L and M with national staff N on `example-chapter`'s chapters.
- **The matrix's 24 rows** pass through the portal, GraphQL and MCP, and from B5 a bound Teams channel. Rows 13, 15, 16 and 19 pass closed until [§ 8](#8-after-mj4789-views-and-dashboards-with-properties), then open. Row 22 comes with meetings.
- **The KPIs** are measurable once A2 and A4 land: no cross-band retrieval in the audit, no quote from a sealed source, and every AI message with a run and its sources.
- **What already runs** keeps passing: the unit tests, both harnesses with their count assertion, `scripts/persona-check.sql`, the gallery's visual test, `mj standards check` and the token check.

## 11. Amith's calls

Open in [the plan's § 11](plan.md#11-open-decisions), each needed before the work that depends on it:

| # | Decision | Needed by |
|---|---|---|
| 1 | Who owns Collaboration | Stage 5 |
| 2 | Its license and publish path | Stage 5 |
| 3 | How long access-log rows are kept (A2) | Provenance |
| 4 | Messages from before A4: shown or sealed for newcomers | Audience (A7) |
| 5 | *Disclose to this conversation* (D4): now or on demand | Audience |
| 6 | Storage hits under `Intersection`: refuse, or check per principal | Audience (A6) |
| 7 | When Committees 2.0 ships | C4 |
| 9 | Whether deleting an item may erase its uses | Breadth (slice A) |
| 10 | File Requests | Breadth |
| 11 | Member-level or aggregate-only by default, for a chapter-style type | Stage 2 (B18) |
| 12 | Who approves Canon objects, where, and how their tests are kept (D34) | Stage 2 (B15) |
| 13 | Whether spaces project Issues, and whether issues need meetings | Breadth |
| 14 | Whose calendar owns a meeting | Meetings (T2) |
| 15 | Whether a Team note can be promoted to Shared | Stage 4 (B21) |
| 16 | Whether the deal room keeps its subtype | Stage 1 |

The plan's § 11 also lists what Amith is to confirm in review.

## 12. Rules for the work

- **No workarounds** ([§ 2.2](#22-the-rule), D49).
- **Metadata never goes in a migration.** A migration is DDL, extended properties and its appended CodeGen output. Roles, entity permissions, row-level security filters, applications and nav items, resource types, notification types, permission domains, entity-field settings, query permissions and seed rows for lookup tables are JSON under `metadata/`, pushed with `mj sync push`. New primary keys are uppercase v4 values from `uuidgen`. The release's one metadata migration is the build engineer's.
- **No `sync` blocks, and no churn in `metadata/`.** After a push, run `node scripts/strip-sync-blocks.mjs`, restore each file's final newline, and check that `git diff` shows only the change you meant.
- **Test code stays in the harness.** Nothing in `metadata/`, a shipped package or the world loader changes a shipped row for a test.
- **A test calls the code it tests,** and fails when that code is deleted.
- **Every `Save()` and `Delete()` is checked,** in tests and cleanup too, and cleanup asserts that what it removed is gone.
- **Only MemberJunction's semantic tokens** in styles, and MJ's own components as they are (D15).
- **Nothing environment-specific** in code, documents or seeds: no real accounts, hosts or database names.
- **The agent always runs in the scope of the person who asked,** bounded on the server by what everyone in the conversation may reach ([the plan's § 5.3](plan.md#53-what-an-agent-may-use)). **Retrieval is MemberJunction's to improve:** changes to search, audience bounding and knowledge go in MJ's own pull requests, and Colin leads that work.
- **The UI comes last in each stage** (D16), checked through end-to-end screenshots.
- **The repo's `CLAUDE.md`** holds, and in each other repo, that repo's.

## 13. How reviews run

- **One numbered punch list per push burst,** on this pull request. Its first line is `CLAUDE REVIEW — PR #10: punch list N (head <sha>)`. Items keep their numbers across lists, and new items continue from 126.
- **Each push's comment reports evidence, not intent:** each package's `pnpm test` count in the workspace, both harnesses' tallies after a purge and a fresh load, which items it closes, and the screenshots committed in the branch. The review checks each claim against the code, and deletes the code under a new test to see that the test fails.
- **The pull requests in other repos** ([§ 3](#3-the-pull-requests-beside-this-one)) get their own punch lists, on their own threads.
- **The plan's author keeps the docs current:** this plan, [the plan](plan.md), the READMEs and `docs/`. Pull before you push; it's only Markdown.

## 14. Day one

1. **Read,** in this order: this plan; [PR 9's final review](https://github.com/MemberJunction/bizapps-collaboration/pull/9#issuecomment-5900284445); the plan's [§ 3.6](plan.md#36-decided-on-2026-09-29-8-merges-after-the-chat) to [§ 3.8](plan.md#38-decided-on-2026-09-29-pr-10-carries-the-rest) (D38 to D52); [PR 9's plan](pr9-plan.md) § 3; [the extensibility plan](../docs/EXTENSIBILITY_PLAN.md); [how the system works](../docs/HOW_THE_SYSTEM_WORKS.md); [the meetings plan](meetings-plan.md); and the repo's `CLAUDE.md`.
2. **Set up the workspace** ([§ 2.1](#21-work-on-mj-next)), with MJ's clone on MJ#4891's branch at its latest commit.
3. **Build a database, load the world** from a purge, run both harnesses, and post the tallies and each package's `pnpm test` count as this pull request's first comment. They're the baseline every punch list compares against.
4. **Start with [§ 2.3](#23-take-out-pr-9s-workarounds-122-and-123),** then the rest of stage 0.
