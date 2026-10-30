# Collaboration UI polish: direction and work plan

Goal from Colin: the UI should be **timeless, unique, effective, and extendable at any time**. This file turns those four words into rules you can check, then lists the work in three rounds. Read `~/Projects/Betty-MJ/UI-GUIDE.md` sections 0, 2.5, 3 and 8 first; its MJ rules apply here (the Betty-only parts, such as `--betty-cta-*` and the Insights kit, do not).

Review state on 2026-10-29 (uncommitted work in this folder): widget tests pass (183), but `node scripts/check-mj-tokens.mjs` fails with 3 color literals. The widget and section components carry 541 hex fallbacks such as `var(--mj-bg-surface, #ffffff)`: 298 were already in `next`, and this work added 243. Remove them from every file you touch.

---

## 1. What the four words mean here

### Timeless = restraint

1. **Tokens only.** No hex fallbacks: `var(--mj-bg-surface, #ffffff)` becomes `var(--mj-bg-surface)`. No `rgba()` shadows: use `--mj-shadow-*`. Grep `_tokens.scss` before using a name you have not seen defined.
2. **Color means something, or it is not there.** Teal = Shared. Neutral with a lock = Team. `--mj-status-*` = status. A space type's color appears only on its type tile. No decorative gradients, glows, pulsing dots or "comet" effects.
3. **Motion only shows a change of state.** Use `--mj-transition-fast`, and turn it off under `prefers-reduced-motion`. An indeterminate progress bar is fine.
4. **Type does the hierarchy.** Three sizes per screen: title, body, meta. Sentence case everywhere. No ALL-CAPS labels (today: "PAGES", "CONVERSATIONS", "SWITCH SPACE").
5. **One spacing system.** `--mj-space-*` only. Every rail row has the same height and the same icon column. Groups are separated by one consistent gap.
6. **MJ parts first.** `mjButton`, `mj-dropdown`, `mj-dialog`, `mj-empty-state`, `mj-loading`, `mj-tab-nav`, `MJConfirmService`. Never restyle `.mj-btn`.

### Unique = the product's one idea, shown the same way everywhere

Only Collaboration answers "who can see this?" on every screen. Keep one vocabulary for it and put it in the same place on every surface:
- the band chip (`mjc-band-chip`: Team grey with a lock, Shared teal with an eye);
- the teal ring on people from outside the firm (`mjc-avatar` with `IsOutside`);
- the Assistant's mark.

The audience sits at the right end of the header's title row, and on every row that can be on either side. Don't add new audience visuals. The rail's new `band-dot` for custom pages duplicates the band chip: use the chip, or nothing.

### Effective = fewer choices, plain words

- **One navigation system: the rail.** The main area never repeats navigation.
- **Editing belongs to editors and lives next to what it edits,** not in the navigation.
- **Plain words.** No internal terms on screen. Today these reach users: "Evaluating addressee routing…", "Checking speaker attribution & thread context…", "Main Workspace View", "Space Type Cards", "Widget:" labels, "Preferences synced". Write what a client would say: "Deciding whether the Assistant should answer…".
- Every icon-only button has an `aria-label`. Every clickable row is a `<button>` or uses `mjClickable`.

### Extendable = new parts plug in; nothing is hard-wired

The repo already has the model: `docs/EXTENSIBILITY_PLAN.md` §6. Parts are descriptors, registered with `@RegisterClassEx` and mounted with `NgComponentOutlet`. A working example is `packages/ExampleSpaceTypes/Angular/src/ExampleAnySpaceNoticeCard.ts`, assembled by `assembleSpaceContributions(BaseSpaceOverviewCard, …)` in `collaboration-section.component.ts`.

The page builder bypasses this today. `mjc-space-pages` has ten hard-wired `TemplateRef` inputs (`PinnedWidgetTpl` … `MainViewWidgetTpl`), and `collaboration-section` repeats the same `ng-template` set for every tab. Adding a block means editing both files. Round 2 fixes this.

---

## 2. Rules for every round

- Work in `~/Projects/mjws-collab/bizapps-collaboration`. Before round 1, create a local branch `feat/collab-ui-polish` and commit the current work as a baseline. Commit at the end of each round. **Never push. Never run `git stash`.**
- Gates before you call a round done. Paste the real output; don't summarize it:
  - `node scripts/check-mj-tokens.mjs` (0 findings)
  - `node scripts/check-mj-inputs.mjs`
  - `pnpm --filter @mj-biz-apps/collaboration-ng-widgets test`
  - `pnpm --filter @mj-biz-apps/collaboration-ng test`
  - the workspace build of both packages
- Screenshots before and after each round, at 1440×900, light and dark:
  - Home (rail expanded)
  - Discovery overview
  - Field notes (a sub-space)
  - Library
  - Work
  - Chat with a thread open
  - a page in edit mode
  - rail collapsed

  Save them to `plans/space-focused-ux/shots/<round>/<screen>-<theme>.png`.
- Add a section per round to `plans/space-focused-ux/ui-polish-notes.md`: what changed, the files, the gate output and the screenshot list. Name only files and identifiers that exist; they will be checked.
- Change a test only when the behavior changed on purpose, and say which tests changed and why.

---

## 3. Round 1: navigation, header and editing (what Colin flagged)

**Stop after this round and wait for review.**

### The rail: one component, one structure, at Home and inside a space

- **Head: a space switcher.**
  - Inside a space, it shows the type tile, the space name and a chevron. At Home, it shows "All spaces".
  - Clicking it opens a popover with the "Jump to a space" search, "All spaces" (Home), and the full space tree, using the guide lines you already built.
  - It replaces the "All Spaces" back button and the "Switch space" section at the bottom. Delete both.
- **Inside a space,** three groups in this order:
  - **Pages**
  - **Conversations**
  - **Sub-spaces**: direct children only, with "+ Sub-space" for people who may create one.
- **At Home:** Home, Inbox, My tasks, Recent files, then the spaces tree.
- **Group labels:** sentence case, `--mj-text-xs`, semibold, `--mj-text-muted`.
- **Rows:** one height, a fixed icon column, the label, and an optional count at the right.
  - Hover uses `--mj-bg-surface-hover`.
  - The active row has a brand-tinted background and brand text. Use one cue, not a bar plus a fill.
- **Remove:** the footer "Preferences synced", and every edit control in the rail (customize page, add page). The "+" for a new conversation stays.
- **Collapsed:** icons only, the same order, a tooltip and an `aria-label` on each.

### The header: one row, plus a breadcrumb line for sub-spaces

- **Line 1** (only when the space has a parent): the breadcrumb, `--mj-text-sm`, muted.
- **Line 2:** type tile, title, star, and a status chip when the status isn't Active. On the right:
  - the audience pill;
  - at most one primary action;
  - a `⋯` menu holding Invite, New sub-space, Edit page, New page and Space settings, each shown only to people allowed to use it.
- **Remove the sub-space pills** from the header; they now live in the rail. Remove the inline subtitle; the About block shows the description.

### Editing a page

- Viewers see only the page.
- Editors (`canCustomizePages`) open the editor from the header's `⋯ > Edit page`.
- In edit mode, one slim bar sits at the top of the page: "Editing · Draft", then **[Publish] [Discard]**, with Publish on the left (MJ's dialog order). Discarding unsaved changes asks first, through `MJConfirmService`.

---

## 4. Round 2: page blocks become registered parts (extendable)

1. In the widgets package, add `BaseSpacePageBlock` (or extend `BaseSpaceOverviewCard` if its inputs are enough). It takes `SpaceId`, `Config` (the block's saved settings), `ReadOnly`, and the context the host already passes to the overview.
2. Turn each live block into a component registered like `ExampleAnySpaceNoticeCard`:

   ```ts
   @RegisterClassEx(BaseSpacePageBlock, {
       key: 'collab:needs-you',
       metadata: { slot: 'page-block', label: 'Needs you', icon: 'fa-solid fa-bell',
                   description: 'Items waiting for you in this space', side: 'Team',
                   spaceTypes: ['*'], sortKey: 20 },
   })
   ```

   The live blocks are Needs you, Shared files, Team working set, Ask, Discussion, Pinned, Sub-spaces, About, and each tab's main view.
3. The block picker lists the registrations. The page mounts each block with `NgComponentOutlet`.
   - A block whose `side` is `Team` is never offered or shown to someone who can't see the Team band.
   - A saved block whose key is no longer registered renders a quiet "This block is no longer available" for editors and nothing for viewers.
4. Delete the ten `*WidgetTpl` inputs, the matching `ng-template`s in `collaboration-section`, and the catch-all "Space Type Cards" block. Contributed cards, such as the example board's, now appear in the picker by themselves.
5. Add one test. A block registered in the test file appears in the picker and renders on a page, with no change to `space-pages` or `collaboration-section`. That test is the proof of "extendable".

Content blocks (Heading, Text, Callout and the rest) can stay a typed union inside `space-pages` for now.

---

## 5. Round 3: chat

- **The agent indicator:** move it into MJ's `agentPresence` chat slot, instead of a banner in the header template. Use plain words: "Deciding whether the Assistant should answer…", then "Assistant is answering · 0:12".
- **Threads** stay in the `messageExtra` slot, which is sanctioned.
  - Draw thread avatars with `mjc-avatar`, so people from outside the firm keep their teal ring.
  - Stop reading `chatArea.userAvatarMap`; that is the chat area's internal state, not an input.
- **Copy:** remove every engineer term listed in §1.

---

## 6. Decisions

Decided 2026-10-29; the details are in `ui-polish-review.md`:
- Item 1 below becomes **round 2b**: pages get their own table and a server rule.
- Home becomes **round 4**.
- The floating chat bubble is turned off in the local install only.
- Item 2 below is still open.

1. **Who may edit or publish a page is checked only in the browser.**
   - Pages are stored as JSON inside Note bodies (`__collabPage: 1`, `packages/Angular/src/lib/logic/space-pages-storage.ts`), and no server code knows a page exists.
   - So anyone who may edit notes in a space can change a published page through the Notes API.
   - The fix is a server rule: either a page entity with its own permission (a migration), or a check on Note save for page bodies.
2. **Threads and the agent indicator are general chat features.** They work in Collaboration through MJ's slots today. Longer term they belong in `ng-conversations` (an MJ PR), so every MJ app gets them.
