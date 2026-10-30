# Collaboration UI polish: reviews

## Round 1 review (commit `3b99fcd`, 2026-10-29)

**Verdict: good direction, 10 fixes before round 2.** The rail switcher, the one-row header, sentence case, the edit bar and the token cleanup are what the brief asked for.

The gates were rerun by the reviewer, not copied from the notes:
- `check-mj-tokens` and `check-mj-inputs` pass.
- Widgets: 185 tests pass. Section: 5 vitest and 158 node tests pass.
- `ngc --noEmit` is clean in both packages.
- The touched files have 0 hex fallbacks.

### Fix before round 2

**R1-1. Use MJ's menu for the header `⋯`.** `@memberjunction/ng-ui-components` ships `mj-menu`, `mj-menu-item` (`Icon`, `(Triggered)`) and `mj-menu-divider`, opened by `[mjMenuTriggerFor]` (`MJ/packages/Angular/Generic/ui-components/src/lib/menu/menu.component.ts`, usage in its header comment). It is built on the CDK menu, so it brings arrow keys, Escape and focus return. Delete the hand-rolled `.more-menu-popover` and its `document:click` and `document:keydown.escape` listeners in `space-header.component.ts`. UI guide rule 4: check the MJ catalog before building.

**R1-2. One primary button per screen.** The Chat screen shows two: the header's "Upload" and the chat's "New Conversation". The chat's "New Conversation" also repeats the rail's `+`. Remove it from the chat sub-header.

**R1-3. One style for the `+` buttons on rail groups.** Sub-spaces uses a text button ("+ Sub-space"), while Conversations and Spaces use an icon `+`. Make all three icon buttons with an `aria-label`.

**R1-4. Closed and sub-space rows match the tree.**
- In the rail's Sub-spaces group, closed sub-spaces look like open ones ("Closed this month", "Closed last year", "Closed indefinite" on Northwind). Dim them and show the lock, as the tree does, and fold them under one "Closed (n)" row (the storyboard's rail does this).
- Draw sub-space rows with `mjc-type-tile` `Size="sm"`, as the tree does. Today the group shows plain icons and the tree shows colored tiles.

**R1-5. Hide the Sub-spaces group when there are none.** "New sub-space" is in the `⋯` menu. On Field notes, the rail shows a "Sub-spaces" heading with nothing under it.

**R1-6. Collapsed rail: remove the two unlabeled `+` rows.** Two bare `+` icons with nothing to say what they add read as noise. Adding is available from the expanded rail and the `⋯` menu.

**R1-7. One active cue at a time.** At Home, both "Home" and "Northwind relationship" are highlighted. Only the current location is active; an expanded tree node is not.

**R1-8. The audience pill clips its first avatar.** In every header shot, the left avatar is cut off ("CB", "CE"). Fix the stack's overlap and padding so each avatar shows in full.

**R1-9. The breadcrumb ends at the parent.** Its last crumb repeats the title on the line below ("… › Discovery" above "Discovery").

**R1-10. The overview doesn't repeat the rail.** The "Inside <space>" card lists the same sub-spaces as the rail's group, and on Field notes it says "No sub-spaces yet". Remove it from the default overview layout. Keep it in the block picker for editors who want it.

### Add to round 2 (page blocks)

In edit mode (`shots/round-1/page-edit-mode-light.png`), every block carries a full toolbar at all times: Full/Main/Right Rail, up, down, `+`, Edit and delete. The labels are in all caps, and in the right column they wrap ("ASK / ABOUT / THIS / SPACE" on four lines, "Right / Rail" on two). When the blocks become registered parts:
- Block labels: sentence case, one line, ellipsis.
- The toolbar shows on hover or focus of the block, as icon buttons with `aria-label`s: a drag handle, move up, move down, and a `⋯` `mj-menu` holding Column (Full / Main / Side), Edit and Remove. Remove asks first, through `MJConfirmService`.
- Placeholder copy names the block: "Pinned items show here when there are any," not "Appears automatically on the page when items or data are present."

### Add to round 3 (chat)

On `shots/round-1/chat-thread-open-light.png`, there are three ways to reply to the same thread: the thread bar's "Reply in thread", a dashed "Reply in thread" inside the open thread, and "Reply" on every message. Each reply also carries a "Participant" tag.
- One "Reply" action per message.
- The thread bar shows the reply count and the last reply.
- The open thread ends with a single reply box.
- Drop the "Participant" tag. Show only roles that tell the reader something: the outside ring and the Assistant mark.

**Build on #6176 as merged, not on guesses.**
- Type routes as MJ's `AgentTurnRoute` (exported from `@memberjunction/ng-conversations`, defined in `lib/models/agent-turn.model.ts`), so the compiler catches invented values.
  - Today `formatRouteBadge` handles `'Pinned'` and `'Default'`, which don't exist.
  - It misses `ConversationDefault`, `HostDefault`, `ConversationManager` and `Redirect`.
- Show a reason only when it isn't obvious, in plain words with no emoji. Read each route's doc comment in that file.
  - `ThreadReply`: "Replying in the thread".
  - `DecisionRouted` and `Continuity`: "Following up".
  - `Redirect`: "Handed to <agent>".
  - `Mention` and the default routes: no label.
- Remove "Evaluating addressee routing…" and "Checking speaker attribution & thread context…".
- Collapsed threads use the opt-in `CollapseThreadReplies` from step M, set explicitly by `CollabSpaceChatComponent`.

## Round 2 review (commits `3a08972` and `792b272`, 2026-10-29)

**Verdict: R1-1 to R1-10 are all fixed, and the registry is the right shape. Fix R2-1 to R2-8 before step M.**

Gates, rerun by the reviewer:
- tokens and inputs pass;
- widgets: 188 tests pass; section: 5 vitest and 158 node tests pass;
- `ngc --noEmit` exits 0 in both packages;
- the changed files have 0 hex fallbacks.

What's right:
- the nine built-in blocks are `@RegisterClassEx(BaseSpacePageBlock, …)` classes, mounted with `NgComponentOutlet`;
- the ten `*WidgetTpl` inputs are gone;
- an unknown key shows "This block is no longer available" to editors;
- Team blocks are hidden from people who can't see Team;
- the test at `render.test.ts:1137` proves that a new block needs no core edit.

Not done: the chat bubble still shows in every round-2 screenshot, and the notes don't mention it. Do it with step M (see below).

### Blockers

**R2-1. A block that doesn't name its side must default to Team.** `assembleSpacePageBlocks` (`base-space-page-block.ts`) does `raw['side'] === 'Team' ? 'Team' : 'Shared'`, so a plug-in block that forgets `side` is shown to outside participants. `docs/EXTENSIBILITY_PLAN.md` §6 says the opposite: a part that doesn't say is a Team part. Flip the default, and add a test: a block registered with no `side` is hidden from a viewer who can't see Team.

**R2-2. The UI driver has the final say on cards.** After taking the host's `contributedCards` (already the type driver's final list), `assembleSpacePageBlocks` reads the `BaseSpaceOverviewCard` registrations again from the ClassFactory. A card the driver removed comes back. Use only the `contributedCards` passed in.

**R2-3. Reuse `assembleSpaceContributions`; don't write a second assembler.**
- `base-space-type-ui-driver.ts` already dedupes contributions by `contributionKey`. It refuses a contribution that clashes with a built-in part, and it logs both cases.
- The new assembler drops that rule. Any installed app that registers `contributionKey: 'collab:team-files'` with a higher priority silently replaces the Team files block in every space.
- Call `assembleSpaceContributions(BaseSpacePageBlock, code, builtIns, factory)` with the built-in blocks as its `defaultItems`, so contributions only add.

**R2-4. Regression: plug-in cards dropped off the default overview.**
- `buildStarterPagesForSpace` (`packages/Angular/src/lib/logic/space-pages-storage.ts`) hard-codes the built-in blocks, under the legacy `Widget:*` names, and no contributed cards.
- Before round 2, the overview showed every contributed card ("Notice from another app" is gone from `shots/round-2/discovery-overview-light.png`).
- Derive the default layout from the descriptors instead. A descriptor says which built-in tabs it appears on by default, and in which zone. Contributed cards default to the Overview's side column.
- Then a new built-in or a new plug-in appears by default without anyone editing a seed list.

**R2-5. Remove the remaining hard-wired lists.** Today "one class + one decorator" still isn't true for built-ins, because space-pages keeps five parallel lists:
- `COLLAB_WIDGET_BLOCK_OPTIONS` copies the registrations' labels, icons and hints.
- `CollabPageBlockType` lists every built-in key plus every legacy `Widget:*` name.
- `CollabWidgetVisibility`, with a boolean per built-in.
- The `switch` over built-in keys in `space-pages.component.ts`, around line 3060.
- `legacyType` and every `Widget:*` mapping.

The fixes:
- The picker reads the descriptors.
- Whether a block has anything to show lives in that block's static `isActive`.
- A block's type is a `string` key.
- Delete `legacyType` and the `Widget:*` mappings. Round 2b moves pages to a new table with no stored data to translate.

### Should-fix

**R2-6. One name per thing in `SpacePageBlockContext`.**
- Remove the aliases: `pins`/`pinnedItems`, `pinnedLabel`/`pinnedTitle`, `canSeeTeam`/`canSeeTeamSide`, `onUnpin`/`onPinUnpin`.
- Replace the three `any` parameters (`onItemSelected`, `onShareRequested`, `onSubSpaceSelected`) with the real models.
- Callbacks in the context are fine, because `NgComponentOutlet` can't bind outputs. Say so in the base class's doc comment.

**R2-7. One metadata name per field, typed as `SpacePageBlockMetadata`.** The assembler accepts `title` or `label`, `hint` or `description`, and `defaultZone` or `defaultWidth`.

**R2-8. Plain copy.** "Insert full-width banner or strip at top" becomes "Add a block here".

**Next:** fix R2-1 to R2-8 and commit. Then step M, including the chat bubble. Then round 2b. Stop after round 2b.

## Round 2b review: R2 fixes, step M and round 2b (`a52f906`, `784359c`, `78f9f7c`, `737044b`; MJ `a7c25e8f37`; 2026-10-30)

**Verdict: R2-1 to R2-8 are fixed, step M is done, and round 2b has the right design. 3 blockers and 5 should-fixes, then on to round 3.**

Verified by the reviewer:
- The full `pnpm test` passes (exit 0); `check-mj-tokens` and `check-mj-inputs` pass; `ngc --noEmit` exits 0 in both packages.
- The local DB (read-only query) shows:
  - `Shell.ChatOverlay.Enabled` = `false`;
  - MJ migration `202610281836` applied;
  - the `SpacePage` table present.
- Workspace MJ is on `next`, plus one opt-in commit with a test.
- PR #19 is merged in, and its `EnableDecisionRouting` and route forwarding survived.
- The four requested page tests are in `stage1-servers.test.ts`. No `__collabPage` code is left.

Process note: the round 2 commit `792b272` was rewritten as `4cc903c`. The code is identical, but don't amend or rewrite a reviewed commit; add a new one.

### Blockers

**B-1. Replace the three hand-made metadata IDs.**
- They are invented patterns, not random UUIDs: `A4D8193B-5C62-4E7A-8B90-1F2E3D4C5B6A` and `B5E92A4C-6D73-4F8B-9C01-2A3F4E5D6C7B` (the two row filters), and `C7F03B5D-7E84-4A9C-AD12-3B4A5F6E7D8C`.
- Generate each with `uuidgen | tr '[:lower:]' '[:upper:]'`.
- Push the metadata again, and remove the old rows from the local DB, so it matches.

**B-2. Collapsed threads hide every agent answer (step M).**
- Collaboration's server sets each agent reply's `ParentID` to the user's message (`execute-space-chat-turn.ts:457`, and the lookup at line 239 depends on it).
- With `[CollapseThreadReplies]="true"`, every answer drops into a "1 reply" thread under its question. See `shots/step-m/chat-unmentioned-followup-light.png`.
- Fix it in the MJ commit, where "thread reply" is defined:
  - a person's message with a loaded parent is a thread reply;
  - any message whose parent is itself a thread reply stays in that thread;
  - an agent's answer to a top-level message stays in the main flow.
- Tests cover all three cases. Take the step M chat screenshots again.

**B-3. A page that doesn't name its band is a Team page.**
- Change both places from Shared to Team: the migration's `DF_SpacePage_Band` and `stampDefaults()` in `SpacePageEntityServer.ts`.
- This is the same fail-closed rule as R2-1.

### Should-fix

**S-1. Let any tab have a layout.**
- `CK_SpacePage_BuiltInTab` hard-codes six tab ids, so a tab a space type contributes (a `BaseSpaceTab`, like a committee's Meetings) can never get a page layout. Drop the CHECK, and drop the six-tab list from the column description.
- The migration hasn't shipped, so edit it. Bring the local DB in line by dropping the constraint and repairing the Flyway checksum, then run CodeGen. Say exactly what you ran.

**S-2. One method for the edit check.** `SpacePageEntityServer.ValidateAsync` and `Delete` repeat the same context load and `pageEditVerdict` call (about 35 lines each). Move it into one private method that both call.

**S-3. Compute pages when the data changes, not on every check.**
- `spacePages` in `collaboration-section.component.ts` is a getter that rebuilds the starter pages and scans the ClassFactory. It is bound 7 times, so it reruns on every change detection.
- Compute it when the space, the saved pages or the contributions change.
- Keep `registeredBlockInputs()` and the block context stable between checks, so `NgComponentOutlet` doesn't reset every block's inputs each time.

**S-4. Prove the Team-page read rule with a real read.** The current test re-implements the filter in JavaScript and pattern-matches the filter text. Add a check to `test-harnesses/integration.mjs`: an outside persona reads a space's pages and gets Shared pages only. Run one integration job at a time.

**S-5. Say who can see drafts.**
- `DraftBlocks` and `DraftTitle` can be read by anyone who can read the page; a row filter can't hide a column. That's acceptable, because a draft never leaves the page's band.
- Say so in both column descriptions. In the editor's bar, show a quiet hint: "Drafts are visible to everyone who can see this page."

**Next:** fix B-1 to B-3 and S-1 to S-5, and commit. Then do round 3 (chat). Also check the route in the step M "unmentioned follow-up" shot. Its banner says `@Mention` for a message with no mention: find the route the server actually received for that turn, and make sure the label resets each turn. Run every gate, write "## Round 3" in the notes, save screenshots to `shots/round-3/`, commit, then stop.

## Round 3 review: round 2b fixes and chat (`b7b4bf8`, `89fb77f`; MJ `2af5683c74`; 2026-10-30)

**Verdict: every round 2b item is fixed, and the chat is much calmer. 1 blocker and 3 should-fixes, then round 4.**

Verified by the reviewer:
- The full `pnpm test` passes; `check-mj-tokens` and `check-mj-inputs` pass; `ngc --noEmit` exits 0 in both packages.
- `node test-harnesses/integration.mjs row-filters`, rerun: 5 passed, including RF5 (an outside client gets Shared pages only).
- Local DB (read-only):
  - the new filter and permission IDs are present, and the patterned ones are gone;
  - the tab CHECK is dropped;
  - `DF_SpacePage_Band` is `N'Team'`.
- MJ `2af5683c74` keeps an agent's answer to a top-level message in the main flow, with tests.
- In the chat:
  - routes are typed as `AgentTurnRoute` and labeled in plain words;
  - the indicator sits in `agentPresence`;
  - there's one Reply per message and one reply box per thread;
  - the "Participant" tag is gone.

### Blocker

**R3-1. Thread avatars went back to initials, and Colin asked for photos on 10-29.**
- `shots/round-3/chat-thread-open-light.png` shows "CB" where the earlier round showed his photo.
- Root cause: the member model's `avatarUrl` is never set. Nothing loads the MJ user's `UserImageURL` (MJ's chat reads `UserImageURL` and `UserImageIconClass`, `conversation-chat-area.component.ts:4529`). So the audience pill, People, the share dialog and now threads all fall back to initials.
- Fill `avatarUrl` (and the icon class, when set) once, where space members are loaded. Then every surface shows the same picture.
- Add a test: a member with a `UserImageURL` renders an `<img>` in the thread bar.

### Should-fix

**R3-2. Bind the chat area's typed outputs; don't cast and subscribe.**
- Use `(BeforeAgentTurn)="onBeforeAgentTurn($event)"` with `BeforeAgentTurnEventArgs` (exported from `@memberjunction/ng-conversations`, `lib/events/chat-events.ts:55`). Do the same for `AfterAgentTurn`.
- Read `args.Route` and `args.AgentName`. A null route shows no label.
- Delete:
  - the structural cast of `this.chatArea`;
  - the invented `Turn` field;
  - the `'Mention'` fallback.

**R3-3. Notes must name real paths.**
- The S-4 notes say `src/suites/row-filters.checks.ts` and `src/world/expected-bundles.ts`. The files are `src/checks/row-filters.checks.ts` and `src/expected-bundles.ts`.
- Check every backticked path and identifier in the notes against `git ls-files` and `git grep` before committing.

**R3-4. Use `mj-menu` for the people popover.**
- The chat header's participant popover is hand-rolled, with its own document-click listener.
- Make each person an `mj-menu-item` (avatar inside, `(Triggered)` mentions them), opened by `[mjMenuTriggerFor]`. That brings outside-click, Escape and focus return, like the header's `⋯` menu (R1-1).

**Next:** fix R3-1 to R3-4 and commit. Then do round 4 (Home) as written above. Run every gate, write "## Round 4" in the notes, save screenshots to `shots/round-4/`, commit, then stop.

## Round 4 review: round 3 fixes and Home (`4827c06`, `fc7f6f7`, 2026-10-30)

**Verdict: approved. The UI polish plan is done.** The three nits below are optional and can ride along with any later UI change.

Verified by the reviewer:
- The full `pnpm test` passes (192 widget tests, 161 section node tests); `check-mj-tokens` and `check-mj-inputs` pass; `ngc --noEmit` exits 0 in both packages.
- All 35 paths named in the round 4 notes exist. Three are MJ-repo paths, named relative to MJ.
- R3-1: member photos load from `UserImageURL` / `UserImageIconClass`, and the thread bar, replies and people pill show them (`shots/round-4/chat-thread-open-light.png`).
- R3-2: `(BeforeAgentTurn)` / `(AfterAgentTurn)` are bound with `BeforeAgentTurnEventArgs`.
- R3-4: the people list is an `mj-menu`.
- Home: Needs you, Coming up, Pinned, then spaces with one signal each. The hero and the stat tiles are gone.

### Optional nits

**N1.** "Your recent spaces" lists every space, in no recency order, so it repeats the rail's tree. Show the five most recently active, newest first, and leave the full list to the rail.

**N2.** Rows in Coming up and Pinned each carry an "Open in Work" or "Open" link. Make the row itself the link (`mjClickable`) and drop the repeated text, as the space rows already do.

**N3.** The second `MJ: Users` load (a space's people, in `collaboration-section.component.ts`) has no `Fields` list. Name the four fields, as the Home load does.

## Round 5: restore what helped, fix the bugs (Colin's click test, 2026-10-30)

Colin: "it's slicker and nice, but we lost some key things, and there's some bug fixing." The restored items must still follow `ui-polish.md` §1. **Reproduce each bug in the browser before fixing it, and take a before and after screenshot of each.**

### Bugs

**F1. The space switcher doesn't work when the rail is collapsed.**
- Reproduce it first, collapsed, at Home and inside a space.
- The rail (`.rail`) and the shell (`.mjc-shell`, `.main`) don't clip the popover in CSS, so look at what actually happens in the browser:
  - is the popover drawn off-screen or under something?
  - does the click reach `onJumpClick()`?
  - does the list render?
- Fix the cause, not the symptom. Add a render test: with the rail collapsed, clicking the switcher shows the popover, and picking a space emits.

**F2. The Inbox badge counts the wrong thing.**
- Round 4 (`fc7f6f7`) bound `[InboxCount]="homeAwaitingApproval"`. That field's own comment says it counts invitations waiting on an owner, "not in the approval inbox". The Inbox page lists `bizapps-approval-inbox` for `currentPersonId`.
- So the badge said 1 (Pat's invite) while the Inbox was empty.
- The badge must count exactly the rows the Inbox shows, from the same source and filter as `bizapps-approval-inbox`. Invitations stay in "Needs you". Add a test.

**F3. Audit every number.**
- Check each count and signal:
  - **rail:** Inbox, My tasks, Recent files, and the page badges (Documents, Work, People);
  - **Home:** Needs you, Coming up, Pinned, the Active and Closed tabs, and each space row's signal;
  - **header:** the people pill.
- Each must equal the rows its destination shows to the same user.
- Put a table in the notes: number, where it's computed, where it leads, whether they match, and the fix. Add a test for each one you fix.

### Restore

**F4. Show what kind of space this is.**
- Put back the type name chip and the inline subtitle on the title row, as at the baseline: `8e64f22`'s `space-header.component.ts` template, around lines 74 to 86. The `TypeName` and `Subtitle` inputs still exist; the template stopped rendering them.
- Keep the status chip.
- The subtitle is one quiet line, truncated, with the full text in a tooltip.

**F5. One click back to All spaces, from every space.**
- Show the breadcrumb line on every space, not only on sub-spaces, starting with an "All spaces" link. A sub-space's breadcrumb continues through its parents.
- It stays one quiet line above the title. The rail's switcher stays as it is.

**F6. Sweep for anything else we lost.**
- Compare `shots/before/*` with `shots/round-4/*`, screen by screen.
- List every piece of information or shortcut that was removed, not just moved: what it was, where it was, and whether you restored it.
- Restore the ones a person needs, within §1. For any you leave out, say why, so Colin can decide.

**F7 (bug). "Ask Sage to answer?" → clicking the button does nothing.**

The cause, in `confirmAgentShouldGo()` in `space-chat.component.ts`:
- It emits `AgentStepInRequested`, which nothing in Collaboration listens to.
- It calls the chat area's internal `OnResendInPlaceRequested` through a cast. That resends the same unmentioned message, so routing decides "no agent" again.
- It shows a made-up "working" state labelled `ThreadReply`.
- The agent name falls back to a hard-coded `'Sage'`.

What it must do: **one click, and that agent answers that message.**
- Turns run on Collaboration's server (`executeSpaceChatTurn`, with PR #19's routing). Add an explicit "the person asked this agent to answer this message" case there.
- Allow it only when the caller may post in that conversation and the agent is allowed in the space, the same checks as a mention.
- The reply threads under that message. The room can see who asked, so everyone knows why the agent spoke.
- Call it through the same turn path the chat already uses. No private MJ methods, and no unhandled outputs: delete `AgentStepInRequested`, or handle it.
- Use the space's resolved default agent's name. When there is no agent, don't show the prompt.
- Add a test: clicking the button sends one turn request for that message and agent, and the server refuses it for someone who can't post.

This touches #19's routing code in our branch. Say so in the notes, so it can be raised with its author when this becomes a PR.

**F8 (restore, Colin). The space icon goes to All spaces.**
- In the header, clicking the type tile next to the space name goes to All spaces. This is on top of the breadcrumb (F5).
- It's a real button, with the tooltip and `aria-label` "All spaces".
- The rail's switcher stays as it is.

**F9 (restore, Colin). An empty block says it's empty; it doesn't vanish.**
- Today, `shouldRenderBlock()` (`space-pages.component.ts`, around line 3135) hides any block whose `isActive` is false. A quiet space such as Audit committee shows an Overview that is mostly blank space.
- New rule: a block on the page always renders for a viewer who may see it. When it has nothing, it shows its own `emptyText` inside the same card frame:
  - one muted line;
  - plus the one action the viewer can take, when there is one (for example "Upload a file" on Shared files).
- Only the side and permission checks hide a block. `isActive` now only chooses between the content and the empty line.
- **Tasks:** when the space has Work, the default Overview gets a compact "Open tasks" block, registered like the others. It reuses the Work data the host already loads (`mjc-space-work`), with "No open tasks" when empty.
- Screenshot the Audit committee Overview before and after.

**F10 (bug, Colin, raised in the chat). Starring a space does nothing.**
- Reproduce it. Trace the header's `StarToggleRequested` to the host and find where it stops.
- Fix it so the star saves, survives a reload, and shows in the rail and on Home.
- Add a test.

**Next:** do F1 to F10 and commit. Run every gate, write "## Round 5" in the notes (with the F3 table and the F6 list), save screenshots to `shots/round-5/`, commit, then stop.

## Round 5 review (`a764518`, 2026-10-30)

**Verdict: F1 to F6, F8 to F10 and N1 to N3 are approved. F7 needs one more pass.**

Verified by the reviewer:
- tokens and inputs pass; `ngc --noEmit` exits 0 in both Angular packages;
- 197 widget tests and 161 section node tests pass. CoreEntitiesServer's suite waits for U2's commit, because U2's uncommitted files are in the same tree.

The screenshots show each fix:
- the collapsed switcher works (F1);
- the "Committee" and "Workspace" chips and the "All spaces" breadcrumb are back (F4, F5);
- Audit committee shows every block, with its empty line (F9);
- starring sticks (F10).

The F3 table found and fixed four wrong numbers: Inbox, My tasks (8 vs 1), Recent files, and the Work badge.

### F7 blockers

`shots/round-5/f7-after-after-click.png` shows Sage answering Colin's "hi", labelled "Asked by Ada Owner".

**R5-B1. The agent's reply must stay the server's.**
- `execute-space-chat-turn.ts` (around line 461) sets `assistantDetail.UserID = isExplicitAsk ? callerId : system.ID`. That records the agent's reply as the asking person's own message. It breaks A19 (only the server writes an agent's reply), and an author-based rule could let that person edit or delete it.
- Keep `UserID = system.ID` for every reply.
- Show "Asked by" from the author of the message it answers (its `ParentID`). With R5-B2, that's always the person who asked.

**R5-B2. Only a message's author can ask an agent to answer it.**
- `isExplicitAsk` skips the check that the message belongs to the caller. So any member can make the agent answer someone else's message, for example a client's.
- The prompt only ever appears to the author, so put the author check back for explicit asks too.
- Add a test: another member's ask is refused.

**R5-S1. One route, and a real one.** `'StepIn'` isn't an MJ `AgentTurnRoute`. Keep `'Redirect'` only, and say in a comment why it fits: the person redirects a "no agent" turn to the agent they picked.

**Next (UI chat):**
- Fix R5-B1, R5-B2 and R5-S1, and add tests.
- **U2 is in progress in this same tree** in the other chat. Stage only the files you change (`git add <paths>`), never `git add -A`. Don't touch U2's files: `upload-space-file.ts`, `SpaceItemEntityServer.ts`, `space-agent-retrieval.ts`, `packages/IntegrationTests/**`, `metadata/**`, `packages/CoreEntitiesServer/package.json`.
- Run the Angular gates plus `execute-space-chat-turn.test.ts`, write "## Round 5 fixes" in the notes, commit, then stop.

### Now: turn off the floating chat bubble in the local install (Colin, 2026-10-29)

MJ's floating chat bubble sits on top of the chat composer's controls.
- `Shell.ChatOverlay.Enabled` is an **instance-wide** MJ setting (`MJ: Instance Configurations`, record `6855118F-E692-4737-A125-AE267D2DC39C`). It belongs to whoever hosts MJ, not to Collaboration, so **don't ship it in Collaboration's metadata or code**, and don't register a `BaseShellChromePolicy` (that hook is the host's).
- Set it in the local install only: open that record in Explorer, set `Value` to `false`, and save it through the form, so MJ's caches hear about it. No raw SQL.
- Reload Explorer and confirm the bubble is gone. Restart the API you host if it isn't.

### Step M: bring in MJ #6176 and Collaboration PR #19 (Colin, 2026-10-29)

MJ #6176 (multi-party speaker attribution and addressee routing) merged into MJ `next` as `6c7f8665b8` on 2026-10-30 03:31Z. Collaboration's half is Ian's open PR #19 (`feat/multi-party-agent-routing`, head `11baad3`). It routes turns on the server and sets `[EnableDecisionRouting]` on the chat area. Its two failing checks are the expected kind: CI installs published MJ, which doesn't have #6176 yet.

State of the workspace MJ (`~/Projects/mjws-collab/MJ`, branch `collab/e2e-combined`, at `2543e1462a`):
- It has **no commits of its own**. It is an older `next`.
- **14 of #6176's 19 files are staged as an older, partial copy** of the PR. `base-agent.ts`, `catalog-narrowing.ts`, `RunAIAgentResolver.ts` and two tests are missing.
- Two uncommitted edits:
  - `mj.config.cjs`: workspace config. Keep it. `next` doesn't touch it.
  - `conversation-chat-area.component.ts`: the `CollapseThreadReplies` input the collapsed threads depend on. It applies cleanly on current `next`.
- `next` is ahead by 1 migration (`V202610281836__v6.2.x__RecordChange_RecycleBin_Covering_Index.sql`, an index) and 2 `package.json` changes.

**Do, in this order. No `git stash`. Nothing is pushed.**
1. **Save the chat-area edit as its own commit.**
   - Copy `git diff -- <chat-area path>` to a file outside the repo.
   - Discard both that edit and the staged partial #6176 copy: `git restore --staged --worktree` on exactly the 14 staged paths plus the chat-area file. List the paths in the notes.
   - Leave `mj.config.cjs` alone.
2. **Catch up:** `git merge --ff-only origin/next` (after `git fetch origin next`). Confirm `HEAD` contains `6c7f8665b8`.
3. **Re-apply the chat-area change as one local commit** on `collab/e2e-combined`: `feat(conversations): opt-in CollapseThreadReplies`. Fix it first:
   - **It must be opt-in only.** Delete `|| this.SlotTemplate('messageExtra') !== null`. Betty and other hosts already project `messageExtra`, and as written their replies would start disappearing.
   - Add a test: with the input off, a reply stays in the list; with it on, a reply whose parent is loaded leaves the top level.
   - This commit is the content of a future MJ PR. Colin decides whether and when to open it.
4. **Rebuild and migrate.**
   - From `~/Projects/mjws-collab`, run `pnpm install`, then the workspace build.
   - Apply the new MJ migration to the local DB with the repo's CLI, not the global `mj`: `node MJ/packages/MJCLI/bin/run.js migrate`, with the workspace's `MJ/.env` (`MJ_6_2_0_CLEAN_4789`). An index needs no CodeGen.
   - Restart the API and Explorer you host.
5. **Collaboration: include PR #19.**
   - `git fetch origin feat/multi-party-agent-routing`, then merge it into `feat/collab-ui-polish`.
   - Resolve the overlap in `space-chat.component.ts` and `render.test.ts`, keeping #19's `EnableDecisionRouting` and route forwarding.
   - Note: when our branch becomes a PR, rebase it after #19 merges, so #19's changes aren't carried twice.
6. Run every gate. Smoke the chat once: mention, reply in a thread, and an unmentioned follow-up after the agent has answered. Take screenshots.

Then go straight on to round 2b without stopping.

### Round 2b: pages get their own table and a server rule (Colin's decision, 2026-10-29)

Do this after step M and before round 3. Round 2 changes the block format, so the new table stores round 2's shape.

**Why:** pages are stored as JSON in Space Note bodies (`__collabPage: 1`, `packages/Angular/src/lib/logic/space-pages-storage.ts`), and the server's note rule fights them:
- `SpaceNoteEntityServer` lets **only a note's author edit it**, so a second editor can't save a page someone else made.
- Any member who may write notes can create a note that shows up as a page.
- Every note reader has to filter page JSON out.

The editor rule `canCustomizePages` exists only in the browser.

**What to build:**
1. **A `SpacePage` table**, in a new `V…` migration that follows this repo's `CLAUDE.md` § Metadata and MJ's Schema and Code Authoring Guide.
   - Columns: the space, the built-in tab it lays out (null for a custom page), title, icon, band (Team or Shared, with a CHECK), status (Draft or Published), sequence, published blocks (JSON), draft blocks and draft title, and who published it and when.
   - Keep only what the page component actually reads. Run CodeGen.
2. **One shared rule in `collaboration-core`**, beside `notePromotionVerdict` in `packages/Core/src/notes.ts`: `pageEditVerdict(viewer, space)`. It says who may create, edit, publish or delete a page: the space owner, a seat whose role can promote the band, someone who can edit the space's settings, or someone who administers spaces.
   - A closed or read-only space refuses everyone.
   - The browser's `canCustomizePages` calls this rule instead of its own copy.
3. **`SpacePageEntityServer`**, modeled on `SpaceNoteEntityServer`. It enforces `pageEditVerdict` on every save and delete. A Team page needs a seat that can see Team. A page stays in its space.
4. **Metadata:** entity permissions and read and write row filters, modeled on `Collaboration: Visible Notes` and `Collaboration: Own Notes`. Members read Shared pages; Team pages are for those who can see Team. Writes go through the server rule.
5. **Client:** save and load pages through the new entity. Delete `space-pages-storage.ts` and every `isCollabPageNoteBody` filter. Page notes on the local DB are dev data, so no data migration is needed; say which rows you removed.
6. **Tests**, beside `stage1-servers.test.ts`:
   - an editor who didn't create the page can save it;
   - a plain member's create, save and delete are refused with a clear message;
   - a closed space refuses everyone;
   - an outside participant never reads a Team page.

**Stop after round 2b for review** before running round 3.

### Round 4: Home (approved by Colin, 2026-10-29)

Home (`shots/round-1/home-light.png`) doesn't yet answer the storyboard's first question, "what needs me?":
- It opens with marketing copy ("Welcome to Collaboration / Unified spaces, documents, tasks, and communications…").
- Its stat tiles are in Title Case. "9 Active Spaces" sits above a "5 spaces" grid.
- The grid repeats the rail's tree, with an "Open Space →" link on every card.

Build Home as Needs you, then Coming up, then your recent spaces, each with one signal (`docs/ux/README.md`, frame 01). Each card is the link itself, with no separate "Open Space" link.
- Reuse what exists: `mjc-home-list`, `needs-you-card.component.ts` and the server's `resolve-home-lists.ts` / `resolve-home-counts.ts`.
- Remove the welcome hero and the stat tiles. A count shows as a badge on the row or rail item it belongs to.
- When nothing needs you, show one quiet line, not an empty card.

Order of the remaining work: **round 3 fixes + 4, Home (stop)**. That is the last planned round.
