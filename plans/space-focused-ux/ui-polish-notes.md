# Collaboration UI Polish Notes

## Round 1

### What changed

1. **Unified Left Rail (`CollabSpaceRailComponent` in `packages/AngularWidgets/src/lib/space-rail.component.ts`):**
   - Replaced the top `"All Spaces"` back button and bottom `"Switch space"` section with a single space switcher in the rail header (`button.rail-switcher[data-testid="rail-space-switcher"]`).
   - Inside a space (`Mode === 'space'`), the switcher displays `<mjc-type-tile>`, `SpaceTitle`, and a chevron. At Home (`Mode === 'home'`), it displays `"All spaces"` with a chevron.
   - Clicking the switcher opens `.switcher-popover[data-testid="rail-switcher-popover"]` with the `"Jump to a space"` search input (`input.jump-input`), `"All spaces"` (Home) row (`button.switcher-all-spaces[data-testid="switcher-all-spaces"]`), the full space tree (`visibleSpaces` with `treeGuidesFor` guide lines), and `"New space"` when `CanCreateSpace` is true.
   - Inside a space (`Mode === 'space'`), the rail renders three groups in order: **Pages**, **Conversations** (with `+` new conversation button when `CanStartConversation` is true), and **Sub-spaces** (`SubSpaces` direct children only, with `+ Sub-space` when `CanAddSubSpace` is true).
   - At Home (`Mode === 'home'`), the rail renders **Home**, **Inbox**, **My tasks**, **Recent files**, and then the **Spaces** tree.
   - Group labels use sentence case (`--mj-text-xs`, `--mj-font-semibold`, `--mj-text-muted`).
   - Rows share a consistent height (`var(--mj-space-9)` / `36px`), a fixed icon column (`18px`), `--mj-bg-surface-hover` hover state, and a single active cue (brand-tinted background fill + `--mj-brand-primary` text, removing `.active::before` and `.band-dot`).
   - Removed the `"Preferences synced"` footer and all page-editing controls from the rail (`NewPageRequested` and `CustomizePagesToggleRequested` buttons in the rail).
   - Collapsed rail renders icons only in the same group order with `title` and `aria-label` on each row.

2. **Space Header (`CollabSpaceHeaderComponent` in `packages/AngularWidgets/src/lib/space-header.component.ts`):**
   - **Line 1** renders the breadcrumb (`nav.crumbs`) in `--mj-text-sm` and `--mj-text-muted` only when the space has a parent (`hasParentSpace` / `Breadcrumbs.length >= 3`).
   - **Line 2** renders `<mjc-type-tile>`, `Title`, the favorite star (`ShowStar`), and the status chip when `Status && Status !== 'Active'`.
   - Removed the inline `Subtitle`, `TypeName` chip, and sub-space pills from the header (sub-spaces now live in the rail, and the description lives in the About block).
   - Right side of Line 2 (`.actions`) renders `<ng-content select="[actions]"></ng-content>` (audience pill and at most one primary action) followed by the `⋯` menu (`button.more-btn[data-testid="space-header-more-btn"]`, `aria-label="More actions"`) containing `Invite` (`CanInvite`), `New sub-space` (`CanAddSubSpace`), `Edit page` (`CanEditPages && CanEditCurrentPage`, `data-testid="header-menu-edit-page"`), `New page` (`CanEditPages`), and `Space settings` (`CanConfigure`).

3. **Page Editing (`CollabSpacePagesComponent` in `packages/AngularWidgets/src/lib/space-pages.component.ts`):**
   - Viewers see only the page; the top bar is completely hidden unless `isCustomizing` is true for an editable page (`activePage && canEditPage(activePage) && isCustomizing`).
   - Editors (`canCustomizePages`) enter edit mode from the header's `⋯ > Edit page` menu item (`EditPageRequested` wired to `onToggleCustomizePages()` in `CollaborationSectionComponent`).
   - In edit mode, a single slim bar (`header.sp-tabbar[data-testid="page-edit-bar"]`) sits at the top of the page showing `"Editing · Draft"` (`[data-testid="page-edit-status"]`) on the left and **[Publish] [Discard]** (`[data-testid="page-edit-publish-btn"]`, `[data-testid="page-edit-discard-btn"]`, with Publish on the left) on the right.
   - Discarding unsaved changes (`hasPendingDraftChanges(activePage.id)`) prompts first via `MJConfirmService.Confirm(...)` from `@memberjunction/ng-ui-components`.
   - Replaced engineer-facing widget picker labels in `COLLAB_WIDGET_BLOCK_OPTIONS` with plain words (`"Page content"`, `"Space cards"`).

4. **Design Tokens, Audience Pill, Motion & Host Wiring:**
   - Stripped all hex color fallbacks and `rgba()` shadow literals from every touched file (`packages/AngularWidgets/src/lib/tokens.ts`, `packages/AngularWidgets/src/lib/audience-pill.component.ts`, `packages/AngularWidgets/src/lib/space-chat.component.ts`, `packages/AngularWidgets/src/lib/space-rail.component.ts`, `packages/AngularWidgets/src/lib/space-header.component.ts`, `packages/AngularWidgets/src/lib/space-pages.component.ts`, and `packages/Angular/src/lib/collaboration-section.component.ts`).
   - Updated `CollabAudiencePillComponent` (`packages/AngularWidgets/src/lib/audience-pill.component.ts`) popover rows to render `<mjc-avatar>` with `[IsOutside]="person.band === 'Outside'"` so outside participants carry the teal ring (`--mjc-shared-strong`), and changed popover group titles to sentence case.
   - Added `@media (prefers-reduced-motion: reduce)` rules to disable transitions when reduced motion is requested.
   - Wired `[SpaceColor]` and `[SpaceIsClosed]` on `<mjc-space-rail>` and `[CanInvite]`, `[CanAddSubSpace]`, `[CanEditPages]`, `[CanEditCurrentPage]`, `[CanConfigure]`, `(InviteRequested)`, `(NewSubSpaceRequested)`, `(EditPageRequested)`, `(NewPageRequested)`, and `(SpaceSettingsRequested)` on `<mjc-space-header>` in `CollaborationSectionComponent` (`packages/Angular/src/lib/collaboration-section.component.ts`), removing the duplicate `Invite` button from `<div actions>`.

### Files touched

- `packages/AngularWidgets/src/lib/tokens.ts`
- `packages/AngularWidgets/src/lib/audience-pill.component.ts`
- `packages/AngularWidgets/src/lib/space-chat.component.ts`
- `packages/AngularWidgets/src/lib/space-rail.component.ts`
- `packages/AngularWidgets/src/lib/space-header.component.ts`
- `packages/AngularWidgets/src/lib/space-pages.component.ts`
- `packages/AngularWidgets/src/lib/render.test.ts`
- `packages/Angular/src/lib/collaboration-section.component.ts`

### Test changes and rationale

In `packages/AngularWidgets/src/lib/render.test.ts`:
1. **`CollabSpaceRailComponent — conversation list rendering` (`hides the Conversations section when the space type does not include the Chat tab`):**
   - Updated the section label assertion from `'CONVERSATIONS'` to `'Conversations'` because Round 1 §1.4 and §3 specify sentence-case group labels in the rail instead of ALL-CAPS.
2. **`CollabSpaceRailComponent — collapsed rail navigation` (`renders the back-to-spaces button when collapsed inside a space` -> `renders the space switcher when collapsed inside a space and can return to All spaces`):**
   - Updated because Round 1 §3 deletes the `"All Spaces"` back button from the rail and replaces it with the top space switcher (`button.rail-switcher`), which opens the switcher popover containing `button[data-testid="switcher-all-spaces"]` (`"All spaces"`) to emit `BackToSpacesRequested`.
3. **Added `CollabSpaceHeaderComponent — Round 1 header layout and menu`:**
   - Verifies that breadcrumbs (`nav.crumbs`) render only for sub-spaces (`Breadcrumbs.length >= 3`) and that the `⋯` menu (`[data-testid="space-header-more-btn"]`) surfaces `Invite`, `New sub-space`, `Edit page`, `New page`, and `Space settings` according to caller permissions.
4. **Added `CollabSpacePagesComponent — Round 1 slim edit bar`:**
   - Verifies that viewers see no edit bar (`[data-testid="page-edit-bar"]` is absent when `IsCustomizing` is false), editors in edit mode see `"Editing · Draft"` with `Publish` to the left of `Discard`, and clicking `Discard` with unsaved draft changes invokes `MJConfirmService.Confirm` before discarding.

### Gate outputs

#### 1. `node scripts/check-mj-tokens.mjs`

```text
mj tokens ok (118 used, 294 defined; 16 mjc used, 16 defined)
```

#### 2. `node scripts/check-mj-inputs.mjs`

```text
mj inputs ok (none of the 14 deprecated names of mjButton and mj-loading is bound)
```

#### 3. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets test`

```text
> @mj-biz-apps/collaboration-ng-widgets@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets
> vitest run


 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets

 ✓ src/lib/ui-driver.test.ts (10 tests) 6ms
 ✓ src/lib/widgets.test.ts (123 tests) 19ms
 ✓ src/lib/render.test.ts (52 tests) 548ms

 Test Files  3 passed (3)
      Tests  185 passed (185)
   Start at  21:55:57
   Duration  11.94s (transform 17.83s, setup 0ms, import 24.06s, tests 572ms, environment 390ms)
```

#### 4. `pnpm --filter @mj-biz-apps/collaboration-ng test`

```text
> @mj-biz-apps/collaboration-ng@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular
> tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/lib/logic/*.test.ts' && vitest run

▶ the space's agent turn, as the page asks for it
  ✔ always runs in the background, so the chat follows the reply row live instead of waiting for the whole run (0.651959ms)
  ✔ answers the chat area in its own words: the reply rows and the run, or the server's refusal (0.108334ms)
  ✔ turns a thrown error into a failed turn with its message, and a plain reason for anything else (0.073791ms)
✔ the space's agent turn, as the page asks for it (1.3055ms)
▶ running a Before hook
  ✔ answers true, and logs nothing, when the hook returns (0.537583ms)
  ✔ answers false and logs the hook, the type and the space when BeforeStartChat throws (0.107708ms)
  ✔ answers false and logs the hook, the type and the space when BeforeInvite throws (0.040458ms)
  ✔ names an unknown type, and reads a thrown non-error (0.084208ms)
✔ running a Before hook (1.212208ms)
▶ the state of the Chat tab
  ✔ is closed, with the closed note, when the space is closed, whatever the seat (0.743792ms)
  ✔ is pending, with neither composer nor note, until the seat is known: an owner opening a space is not told they cannot post (0.094459ms)
  ✔ says there is no seat that lets them post, in words for one conversation or for the space's list of them (0.120625ms)
  ✔ says it couldn't check, not that there is no seat, when the seat lookup failed: an owner whose lookup failed is not told they can't post for want of a seat (0.07525ms)
  ✔ is open when the seat is known and may post (0.052959ms)
✔ the state of the Chat tab (1.727791ms)
▶ what closing does, in words
  ✔ names the status the close moves to, says it is read-only for everyone, and that Closed moves forward only (0.474833ms)
  ✔ leaves the assistant out when the status allows no agent retrieval, and says who can bring it back when someone can (0.114875ms)
  ✔ says a hidden status disappears for everyone but the keeper, and tells the viewer they won't see it (0.097209ms)
  ✔ says when the check of the right could not be made, and reads a type with no statuses as read-only and visible (0.068583ms)
  ✔ has words for the read in progress and for a server that could not answer (0.052417ms)
✔ what closing does, in words (1.5355ms)
▶ reading the server's payload
  ✔ needs a keeper, and takes the status and its attributes as given, with defaults for a type that names none (0.383042ms)
✔ reading the server's payload (0.436ms)
▶ the rail conversation list
  ✔ lists each conversation once, whatever the casing of its ID (0.607166ms)
  ✔ puts an internal conversation on the Team band and the rest on Shared (0.081459ms)
  ✔ skips a row with no conversation and names an unnamed one General (0.06375ms)
✔ the rail conversation list (1.193208ms)
▶ choosing the open conversation
  ✔ opens the one asked for, matched as a UUID (0.136292ms)
  ✔ opens the first when the one asked for is not in this space (0.048291ms)
  ✔ opens nothing when the space has no conversation (0.041208ms)
✔ choosing the open conversation (0.309083ms)
▶ how a space's details are drawn
  ✔ is nothing when the type's UI driver shows none (0.363458ms)
  ✔ is the driver's own component when it gives one, without asking for a form (0.40775ms)
  ✔ is the subtype's form when one is registered, whatever fields the driver hides (0.076916ms)
  ✔ is the field list, though a form is registered, when the subtype's columns share a section with the space's (no sections to show alone) (0.098583ms)
  ✔ is a field for each column when there is no form, less the optional ones the driver hides (0.090542ms)
  ✔ is nothing when there is no form and no column to show (0.094833ms)
✔ how a space's details are drawn (1.643417ms)
▶ dates are shown in the locale asked for, with the year
  ✔ follows the locale (12.314459ms)
  ✔ adds the time when asked to (0.197334ms)
  ✔ reads a bad or missing value as unknown, never "Invalid Date" (0.055875ms)
✔ dates are shown in the locale asked for, with the year (12.985917ms)
▶ the roles a seat may hand out
  ✔ gives Sam (a member with ceiling 10) only Outside member and Guest, highest first (0.74ms)
  ✔ gives Casey (an outside admin, ceiling 10, no team band) the same two (0.07825ms)
  ✔ gives an owner every active role (0.069584ms)
  ✔ leaves out a role below the ceiling that carries a power the grantor lacks (0.0695ms)
✔ the roles a seat may hand out (1.411291ms)
▶ Home's lists
  ✔ shows an invitation as a row that opens the People tab of its space (0.6925ms)
  ✔ does not invent a date or a role for an invitation that has none (0.100125ms)
  ✔ shows a task with its status, priority and due date, and skips what is missing (0.116417ms)
  ✔ shows a dash, not zero, for a count that could not be read, and says so to a screen reader (0.232958ms)
✔ Home's lists (1.804125ms)
▶ pinRows (B22)
  ✔ names each pin by its space and opens it (0.233334ms)
✔ pinRows (B22) (0.375792ms)
▶ two overlapping reads of the Overview messages
  ✔ leaves the newer read on screen when the older read finishes last (25.160583ms)
  ✔ applies reads that finish in order, each replacing the last (0.142625ms)
  ✔ writes nothing once the person has moved to another space, even for the newest read (0.083625ms)
✔ two overlapping reads of the Overview messages (25.914125ms)
▶ making a new space
  ✔ starts as its type, owned by the person, inheriting as the type says, with no detail fields for a plain type (0.641958ms)
  ✔ offers a subtype's own fields and reports the required ones still empty (0.197959ms)
  ✔ leaves a form section of only the columns the driver hides out of the sections shown, keeps a required column whatever the driver says, and is unchanged when nothing is hidden (0.345833ms)
  ✔ collects what was typed into the subtype fields, and leaves out what has no value so the column default applies (0.101375ms)
  ✔ asks the server to make the space and seat the person, sending the type, the name and the details, and returns the new id (0.113125ms)
  ✔ sends no details for a plain type, and the description when there is one (0.07425ms)
  ✔ returns the server's refusal, which leaves no space and no seat behind (0.070166ms)
✔ making a new space (1.965667ms)
▶ a saved space's details
  ✔ are its subtype record and fields when the space has a subtype (0.207208ms)
  ✔ are none for a plain space or one that will not load (0.147875ms)
  ✔ are dirty once a detail field changes, and missing while a required one is empty (0.188875ms)
  ✔ save, or say why not, and are put back on Discard (0.20125ms)
✔ a saved space's details (0.89075ms)
▶ the kinds picked in the New space dialog
  ✔ lets the last pick win when an earlier one finishes after it (0.670583ms)
  ✔ lets the only pick through, and reports its failure (0.137541ms)
  ✔ drops a pick that fails after a later one started: its error is nobody's to show (0.088958ms)
  ✔ drops every pick in flight when the dialog is reset, so a draft from an earlier opening never lands in a later one (0.081291ms)
✔ the kinds picked in the New space dialog (1.486042ms)
▶ the kinds of space the New space dialog offers
  ✔ are the active types, by rank and then name (5.967458ms)
  ✔ carry the description, and fall back to the default icon and no colour (0.117625ms)
  ✔ are none when no type is active (0.053625ms)
✔ the kinds of space the New space dialog offers (6.624458ms)
▶ the kinds that may sit under a parent
  ✔ are those the parent type's Children.AllowedTypeCodes names, in the dialog's order (0.1395ms)
  ✔ are every kind when the parent type names none, has no configuration, or its configuration does not parse (0.096792ms)
✔ the kinds that may sit under a parent (0.317667ms)
▶ opening a library file
  ✔ opens the file in the viewer and records the open once (0.622ms)
  ✔ still opens when the open could not be recorded, and says it was not (0.130625ms)
  ✔ says so when the screen has no viewer to open the file in, and records nothing (0.084375ms)
  ✔ opens nothing for an item with no file (0.081416ms)
✔ opening a library file (1.586833ms)
▶ the item use an open writes
  ✔ names the item, the space, the person and the time (0.090708ms)
  ✔ is nothing when the person or the space is not known (never an empty user ID) (0.04575ms)
✔ the item use an open writes (0.207417ms)
▶ the Discussion card lines
  ✔ shows what was typed, not the stored mention, and reads oldest first (1.019583ms)
  ✔ draws an outside seat's sender as outside, and staff and the assistant as not (0.124083ms)
  ✔ keeps the last five (0.094417ms)
✔ the Discussion card lines (1.815ms)
▶ the space tree
  ✔ dims and locks a closed space, and leaves an open one alone (0.846708ms)
✔ the space tree (1.311208ms)
▶ the rail mode follows the page
  ✔ keeps the home rail on Home, Inbox, My tasks and Recent files (0.107ms)
  ✔ shows the space rail on a space (0.053416ms)
✔ the rail mode follows the page (0.252792ms)
▶ who reaches a space
  ✔ lists Studio with only Ada on it and staff reached through it (1.035291ms)
  ✔ lists Northwind with Ada on it, Bea and Sam as team members, and Casey as an outside member (0.119042ms)
  ✔ lists Discovery with no seats of its own, and everyone from Northwind reached through its parent (0.093916ms)
  ✔ lists Field notes with Ada on it and Bea, Casey and Sam reached through its parents (0.114833ms)
  ✔ lists only the sealed child's own seats, not the branch's or Northwind's (0.151708ms)
  ✔ keeps Sam reaching Field notes through Northwind when the guest seat Sam holds there is Removed or Invited, and carries that seat beside Sam (0.175834ms)
  ✔ lists a person nothing else reaches by their own Removed or Invited seat (0.082875ms)
  ✔ follows a parent the viewer can't read, unnamed, and stops there (0.099416ms)
  ✔ stops at a parent whose status hides it, and keeps one whose status is read-only but visible (0.128291ms)
✔ who reaches a space (2.411708ms)
▶ the section's list of who reaches a space, held against Core's
  ✔ lists the same people under the same seats with no space closed (0.293625ms)
  ✔ lists the same people under the same seats with an archived middle space (hidden) (0.05625ms)
  ✔ lists the same people under the same seats with a paused middle space (read-only, visible) (0.059ms)
  ✔ lists the same people under the same seats with a closed middle space (read-only, visible) (0.065334ms)
  ✔ lists the same people under the same seats with an active middle space with a status row (0.050291ms)
  ✔ lists the same people under the same seats with a closed middle space of a type with no statuses (0.043458ms)
✔ the section's list of who reaches a space, held against Core's (0.683125ms)
▶ the seat actions offered
  ✔ offers Sam (a member who can invite) no Approve or Change role on a type that holds invites for approval, but Remove (1.250917ms)
  ✔ offers Sam Approve and Change role on a type that approves automatically (0.372417ms)
  ✔ offers an owner Approve, Change role and Remove on a guest (0.077125ms)
  ✔ offers nothing on a seat above the viewer's ceiling, or one carrying a power they lack (0.064542ms)
  ✔ hides Remove and Change role on the only active owner seat, whoever is looking, and offers nothing for someone who cannot invite (0.122042ms)
✔ the seat actions offered (2.594333ms)
▶ the header seat summary
  ✔ counts only Active seats (0.410875ms)
  ✔ does not let an invited or removed outside seat make the space Shared (0.089792ms)
  ✔ makes the space Shared once an outside seat is Active (0.259375ms)
  ✔ summarizes a space with no seats (0.055209ms)
✔ the header seat summary (1.388541ms)
▶ a load for a selected space
  ✔ may write while its selection is the current one, whatever the ID casing (0.279333ms)
  ✔ may not write once a later selection has started (0.040583ms)
  ✔ may not write once the person is in another space, even with the same request number (0.037834ms)
  ✔ may not write when no space is active (0.030458ms)
✔ a load for a selected space (0.763708ms)
▶ guardedLoad
  ✔ leaves the newer space's lists alone when the older space's read lands last (0.413375ms)
  ✔ writes when its selection is still the current one (0.059333ms)
  ✔ does not write when the read fails, and lets the failure through (0.238833ms)
✔ guardedLoad (0.837875ms)
▶ a selection starts clean
  ✔ closes the drawer, clears the item, resets both bands and drops the last save message (0.258083ms)
  ✔ closes the share, upload and new-conversation dialogs, so none stays open over the next space (0.317209ms)
✔ a selection starts clean (0.975792ms)
▶ the loading flag of a selection
  ✔ is raised while a selection loads and lowered when it finishes (0.074542ms)
  ✔ stays raised when an older selection finishes after a newer one began (0.038709ms)
✔ the loading flag of a selection (0.177ms)
▶ what Settings offers
  ✔ offers nothing to someone with no right (0.67975ms)
  ✔ offers Close, read-only, to an owner who holds the lifecycle authorization but not Configure Spaces (0.073375ms)
  ✔ offers Reopen, read-only, on a closed space to an owner who may only reopen (0.056083ms)
  ✔ offers the form without a close button to an owner who may configure but not close (0.05225ms)
  ✔ offers the form and the button to someone who may do both (0.060541ms)
  ✔ does not offer Close on a closed space, or Reopen on an open one, whatever the rights say (0.057833ms)
✔ what Settings offers (1.52425ms)
▶ a terminal status (stage 1: Closed moves forward only)
  ✔ offers no reopen, whatever the rights say, and says so above the read-only view (0.094959ms)
  ✔ offers nothing to someone with neither right on a terminal space (0.063708ms)
  ✔ still offers the reopen on a closed space whose status is not terminal (0.060125ms)
✔ a terminal status (stage 1: Closed moves forward only) (0.32875ms)
▶ the Settings model
  ✔ shows the space's status by name when the caller knows it, else Active or Closed from ClosedAt (0.367708ms)
  ✔ takes the icon and color from the type when the space has none (0.066667ms)
  ✔ marks a closed space (0.063125ms)
✔ the Settings model (0.947667ms)
▶ what a Settings save writes
  ✔ writes nothing for a screen the person did not change (0.3725ms)
  ✔ writes only the name when only the name changes (0.089666ms)
  ✔ clears a background the person emptied (0.061041ms)
✔ what a Settings save writes (0.613333ms)
▶ the Settings session across two saves
  ✔ writes only the second edit on the second save, after the form is rebuilt from what the first save wrote (0.844667ms)
  ✔ does not count an edit made while a save was running as saved (0.075042ms)
  ✔ starts from the new space when another is selected (0.086708ms)
✔ the Settings session across two saves (1.117ms)
▶ writing the changes onto a space
  ✔ sets exactly the fields that changed (0.1085ms)
  ✔ can set a field to null (0.065666ms)
✔ writing the changes onto a space (0.224458ms)
▶ who a share reaches
  ✔ says nobody new gains access in Studio, where only staff sit (0.628959ms)
  ✔ lists only the Active outside seats in Discovery, not staff, the invited or the removed (0.137167ms)
  ✔ does not fall back to everyone when the only outside seats are Invited or Removed (0.055416ms)
✔ who a share reaches (1.299792ms)
▶ space-pages-storage
  ✔ identifies serialized custom page JSON vs plain markdown note body (0.48125ms)
  ✔ builds starter pages for all built-in space tabs and merges saved customizations + user pages (0.66625ms)
✔ space-pages-storage (1.5915ms)
▶ the rules from the server's configuration document
  ✔ carries the type's labels, which a participant's browser cannot resolve itself (0.569709ms)
  ✔ gives null for a missing, broken or shapeless document, so the browser keeps its own answer (0.059375ms)
  ✔ tells the same rules from changed ones (0.144583ms)
✔ the rules from the server's configuration document (1.131875ms)
▶ a space's tabs
  ✔ offers the built-in tabs, in order, when the type has every panel (0.816417ms)
  ✔ reports a tab that names no built-in tab and has no component, and keeps building (0.145042ms)
  ✔ shows no Library for a type with LibraryPanel off, even when the driver names it (0.085292ms)
  ✔ mounts a contributed tab, and keeps the built-in id when the board's own 'overview' names the built-in Overview (0.110125ms)
  ✔ drops a tab that names no built-in tab and brings nothing to draw (0.078916ms)
  ✔ relabels a tab from Labels.Tabs whatever the key casing (0.065583ms)
  ✔ resolves a deep link to the tab id without regard to case, and by its alias (0.09225ms)
✔ a space's tabs (1.912334ms)
▶ a UI driver that throws
  ✔ still gives the space its built-in tabs, and reports the failure (0.141584ms)
  ✔ gives the driver its tabs when it does not throw (0.078375ms)
  ✔ reads a deep link as the built-in tab it names, in any case, with discussions as Chat, and passes a contributed key through (0.103ms)
✔ a UI driver that throws (0.423125ms)
▶ the Data tab (B19)
  ✔ is offered only when the space offers data, between Library and Work (0.140417ms)
  ✔ a driver naming Data cannot switch it on for a space with nothing to show (0.075667ms)
  ✔ reads with the type's label (0.058459ms)
✔ the Data tab (B19) (0.345542ms)
▶ creating a space type's UI driver
  ✔ returns the driver that was created, and reports nothing (0.5505ms)
  ✔ falls back to the default driver, and reports the error, when the type's driver's constructor throws (0.099ms)
✔ creating a space type's UI driver (1.127125ms)
▶ The notes a viewer is shown
  ✔ keeps a space note and the viewer's own private note, and drops another person's private note (0.640333ms)
  ✔ compares the author without regard to case, as MJ ids come back either way (0.0915ms)
  ✔ shows a viewer with no id only the space notes (0.055333ms)
✔ The notes a viewer is shown (1.299291ms)
ℹ tests 158
ℹ suites 45
ℹ pass 158
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 265.726208

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular

 ✓ src/lib/space-details-view.render.test.ts (5 tests) 36ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  21:56:11
   Duration  5.25s (transform 3.41s, setup 0ms, import 4.94s, tests 36ms, environment 212ms)
```

#### 5. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets --filter @mj-biz-apps/collaboration-ng build`

```text
Scope: 2 of 15 workspace projects
packages/AngularWidgets build$ ngc
packages/AngularWidgets build: src/lib/space-settings.component.ts:13:77 - warning NG8113: MJDropdownComponent is not used within the template of CollabSpaceSettingsComponent
packages/AngularWidgets build: 13   imports: [CommonModule, FormsModule, MJAlertComponent, MJButtonDirective, MJDropdownComponent, SharedGenericModule],
packages/AngularWidgets build:                                                                                ~~~~~~~~~~~~~~~~~~~
packages/AngularWidgets build: Done
packages/Angular build$ ngc
packages/Angular build: src/lib/collaboration-section.component.ts:1548:116 - warning NG8107: The left side of this optional chain operation does not include 'null' or 'undefined' in its type, therefore the '?.' operator can be replaced with the '.' operator.
packages/Angular build: 1548                                                                         <span class="config-meta">{{ reach.Fields?.length ? reach.Fields.length + ' field' + (reach.Fields.length === 1 ? '' : 's') : 'every field' }}</span>
packages/Angular build:                                                                                                                         ~~~~~~
packages/Angular build: Done
```

### Screenshots (1440×900, light and dark)

#### Before (`plans/space-focused-ux/shots/before/`)
- `plans/space-focused-ux/shots/before/home-light.png`
- `plans/space-focused-ux/shots/before/home-dark.png`
- `plans/space-focused-ux/shots/before/discovery-overview-light.png`
- `plans/space-focused-ux/shots/before/discovery-overview-dark.png`
- `plans/space-focused-ux/shots/before/field-notes-light.png`
- `plans/space-focused-ux/shots/before/field-notes-dark.png`
- `plans/space-focused-ux/shots/before/library-light.png`
- `plans/space-focused-ux/shots/before/library-dark.png`
- `plans/space-focused-ux/shots/before/work-light.png`
- `plans/space-focused-ux/shots/before/work-dark.png`
- `plans/space-focused-ux/shots/before/chat-thread-open-light.png`
- `plans/space-focused-ux/shots/before/chat-thread-open-dark.png`
- `plans/space-focused-ux/shots/before/page-edit-mode-light.png`
- `plans/space-focused-ux/shots/before/page-edit-mode-dark.png`
- `plans/space-focused-ux/shots/before/rail-collapsed-light.png`
- `plans/space-focused-ux/shots/before/rail-collapsed-dark.png`

#### After Round 1 (`plans/space-focused-ux/shots/round-1/`)
- `plans/space-focused-ux/shots/round-1/home-light.png`
- `plans/space-focused-ux/shots/round-1/home-dark.png`
- `plans/space-focused-ux/shots/round-1/discovery-overview-light.png`
- `plans/space-focused-ux/shots/round-1/discovery-overview-dark.png`
- `plans/space-focused-ux/shots/round-1/field-notes-light.png`
- `plans/space-focused-ux/shots/round-1/field-notes-dark.png`
- `plans/space-focused-ux/shots/round-1/library-light.png`
- `plans/space-focused-ux/shots/round-1/library-dark.png`
- `plans/space-focused-ux/shots/round-1/work-light.png`
- `plans/space-focused-ux/shots/round-1/work-dark.png`
- `plans/space-focused-ux/shots/round-1/chat-thread-open-light.png`
- `plans/space-focused-ux/shots/round-1/chat-thread-open-dark.png`
- `plans/space-focused-ux/shots/round-1/page-edit-mode-light.png`
- `plans/space-focused-ux/shots/round-1/page-edit-mode-dark.png`
- `plans/space-focused-ux/shots/round-1/rail-collapsed-light.png`
- `plans/space-focused-ux/shots/round-1/rail-collapsed-dark.png`

## Round 2

### What changed

#### Round 1 Review Fixes (`R1-1` to `R1-10`, committed in `3a08972`)
1. **`R1-1` — Use MJ's menu for the header `⋯` (`CollabSpaceHeaderComponent`):**
   - Replaced the hand-rolled `.more-menu-popover` and its `document:click` / `document:keydown.escape` listeners with `<mj-menu>`, `<mj-menu-item>`, `<mj-menu-divider>`, and `[mjMenuTriggerFor]` from `@memberjunction/ng-ui-components`.
2. **`R1-2` — One primary button per screen (`CollabSpaceChatComponent` & `CollaborationSectionComponent`):**
   - Removed the duplicate `"New Conversation"` button from the chat sub-header and omitted the header primary CTA on the Chat tab so the screen has at most one primary button.
3. **`R1-3` — One style for the `+` buttons on rail groups (`CollabSpaceRailComponent`):**
   - Unified the `+` button on `Conversations`, `Sub-spaces`, and `Spaces` to use the same icon button (`mjButton Variant="icon" Size="sm" class="section-add-btn"`) with explicit `aria-label`s.
4. **`R1-4` — Closed and sub-space rows match the tree (`CollabSpaceRailComponent`):**
   - Rendered sub-space rows with `<mjc-type-tile Size="sm">`, dimmed closed sub-spaces with a lock icon, and folded closed sub-spaces under a single `"Closed (n)"` disclosure row.
5. **`R1-5` — Hide the Sub-spaces group when there are none (`CollabSpaceRailComponent`):**
   - Hid the `Sub-spaces` group in the rail when `SubSpaces.length === 0` (`"New sub-space"` remains in the header `⋯` menu).
6. **`R1-6` — Collapsed rail: remove the two unlabeled `+` rows (`CollabSpaceRailComponent`):**
   - Removed the bare `+` buttons from the collapsed rail while keeping icon rows for Pages, Conversations, and open Sub-spaces.
7. **`R1-7` — One active cue at a time (`CollabSpaceRailComponent`):**
   - At Home (`Mode === 'home'`), only the current Home nav item (`Home`, `Inbox`, `My tasks`, `Recent files`) is highlighted; tree nodes in the Spaces list do not show an active highlight while on Home.
8. **`R1-8` — Audience pill avatar clipping (`CollabAvatarStackComponent` & `CollabAudiencePillComponent`):**
   - Fixed the avatar stack padding/overlap so the leftmost avatar in `<mjc-audience-pill>` renders in full without clipping.
9. **`R1-9` — Breadcrumb ends at the parent (`CollabSpaceHeaderComponent`):**
   - Sliced off the current space from `Breadcrumbs` (`parentBreadcrumbs = Breadcrumbs.slice(0, -1)`) so Line 1 ends at the parent space and does not repeat the space title shown on Line 2.
10. **`R1-10` — Overview doesn't repeat the rail (`space-pages-storage.ts` & `CollabSpaceOverviewComponent`):**
    - Removed `Widget:SubSpaces` (`Inside <space>`) from the default starter Overview layout while keeping `Sub-spaces` (`collab:sub-spaces` / `Widget:SubSpaces`) available in the block picker for editors who want it.
11. **Local install — Floating chat bubble (`MJ: Instance Configurations`):**
    - Opened `MJ: Instance Configurations` record `6855118F-E692-4737-A125-AE267D2DC39C` (`Shell.ChatOverlay.Enabled`) in Explorer, set `Value` to `false`, and saved through the Explorer record form (local DB only; no Collaboration code or metadata changes).

#### Round 2 — Registered Page Blocks (`BaseSpacePageBlock`) & Edit-Mode Polish
1. **Registered Page Block Contract (`packages/AngularWidgets/src/lib/base-space-page-block.ts` & `packages/AngularWidgets/src/public-api.ts`):**
   - Created `BaseSpacePageBlock` with `@Input() SpaceId!: string`, `@Input() Config?: Record<string, unknown>`, `@Input() ReadOnly = false`, and `@Input() Context?: SpacePageBlockContext`, plus `SpacePageBlockMetadata` (`label`, `description`, `icon`, `category`, `defaultZone`, `side`, `builtInTabIds`, `singleton`, `emptyText`) and `SpacePageBlockDescriptor`.
   - Registered all 9 built-in live page block components with `@RegisterClassEx(BaseSpacePageBlock, { key: 'collab:...', metadata: { ... } })`:
     - `CollabPinnedPageBlockComponent` (`collab:pinned` / `Widget:Pinned`, `side: 'Shared'`)
     - `CollabNeedsYouPageBlockComponent` (`collab:needs-you` / `Widget:NeedsYou`, `side: 'Shared'`)
     - `CollabSharedFilesPageBlockComponent` (`collab:shared-files` / `Widget:SharedFiles`, `side: 'Shared'`)
     - `CollabTeamFilesPageBlockComponent` (`collab:team-files` / `Widget:TeamFiles`, `side: 'Team'`)
     - `CollabAskPageBlockComponent` (`collab:ask` / `Widget:AskBox`, `side: 'Shared'`)
     - `CollabDiscussionPageBlockComponent` (`collab:discussion` / `Widget:Discussion`, `side: 'Shared'`)
     - `CollabSubSpacesPageBlockComponent` (`collab:sub-spaces` / `Widget:SubSpaces`, `side: 'Shared'`)
     - `CollabAboutPageBlockComponent` (`collab:about` / `Widget:About`, `side: 'Shared'`)
     - `CollabMainViewPageBlockComponent` (`collab:main-view` / `Widget:MainView`, `side: 'Shared'`)
   - Implemented `assembleSpacePageBlocks(spaceTypeCode, contributedCards)` resolving both `BaseSpacePageBlock` and `BaseSpaceOverviewCard` registrations from `MJGlobal.Instance.ClassFactory` (plus driver-supplied `contributedCards`).
   - Exported `BaseSpacePageBlock`, `assembleSpacePageBlocks`, `BUILT_IN_SPACE_PAGE_BLOCKS`, the 9 block components, and types from `packages/AngularWidgets/src/public-api.ts`.
2. **Removed `*WidgetTpl` Inputs & `<ng-template>` Blocks (`CollabSpacePagesComponent` & `CollaborationSectionComponent`):**
   - Deleted all 10 `*WidgetTpl` `@Input()` properties (`PinnedWidgetTpl`, `NeedsYouWidgetTpl`, `SharedFilesWidgetTpl`, `TeamFilesWidgetTpl`, `AskBoxWidgetTpl`, `DiscussionWidgetTpl`, `SubSpacesWidgetTpl`, `AboutWidgetTpl`, `ContributedCardsWidgetTpl`, `MainViewWidgetTpl`) from `CollabSpacePagesComponent`.
   - Deleted all `<ng-template #...WidgetTpl>` and `<ng-template #...MainTpl>` blocks and `[*WidgetTpl]` bindings from `CollaborationSectionComponent`.
   - Deleted the `'seed-blk-widget-contributed'` (`Widget:ContributedCards`) catch-all block from `buildStarterPagesForSpace` in `packages/Angular/src/lib/logic/space-pages-storage.ts` and added `'seed-blk-widget-contributed'` to `LEGACY_SYNTHETIC_SEED_BLOCK_IDS` so contributed cards and blocks are individually placed and movable.
   - `CollabSpacePagesComponent` now resolves each saved block's key through `assembleSpacePageBlocks`, mounts its component via `NgComponentOutlet` with `SpaceId`, `Config`, `ReadOnly`, and `Context`, filters both the block picker (`availableWidgetBlockOptions`) and rendered page (`shouldRenderBlock`) by `side` (`'Team'` blocks are hidden when `!CanSeeTeam`), and renders a muted `"This block is no longer available"` card (`data-testid="block-unavailable-notice"`) in edit mode and nothing for viewers when a saved block's key is unregistered.
3. **Edit-Mode Polish ("Add to round 2" from `ui-polish-review.md`):**
   - Replaced verbose empty block placeholder banners with compact muted one-liners (`"Pinned items show here when there are any."`, `"Items needing your attention show here when there are any."`, etc.).
   - Styled `.sp-block-type-tag` in edit mode as a single-line sentence-case header (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, no `uppercase` or `letter-spacing`).
   - Reduced the block toolbar (`.sp-block-tools`) to 4 compact icon buttons shown on `:hover` / `:focus-within`: `Drag` · `↑` · `↓` · `⋯`, moving `Column (Full / Main / Side / Half)`, `Edit`, `Duplicate`, and `Remove` into the `⋯` `<mj-menu>` (wrapped in `<ng-template #blockMoreMenu>` and `<ng-template #blockColumnMenu>`), and confirming `Remove` via `MJConfirmService`.

### Files touched

- `packages/AngularWidgets/src/lib/base-space-page-block.ts` (new)
- `packages/AngularWidgets/src/public-api.ts`
- `packages/AngularWidgets/src/lib/space-pages.component.ts`
- `packages/AngularWidgets/src/lib/space-rail.component.ts`
- `packages/AngularWidgets/src/lib/space-header.component.ts`
- `packages/AngularWidgets/src/lib/audience-pill.component.ts`
- `packages/AngularWidgets/src/lib/space-chat.component.ts`
- `packages/AngularWidgets/src/lib/render.test.ts`
- `packages/Angular/src/lib/collaboration-section.component.ts`
- `packages/Angular/src/lib/logic/space-pages-storage.ts`
- `packages/Angular/src/lib/logic/space-pages-storage.test.ts`
- `packages/IntegrationTests/src/world/seed.ts`

### Test changes and rationale

1. **In `packages/AngularWidgets/src/lib/render.test.ts`:**
   - Updated `CollabSpaceHeaderComponent — Round 1 header layout and menu` to query the CDK overlay (`document.body.querySelectorAll('[data-testid^="header-menu-"]')`) because `R1-2` replaced the inline custom menu with `<mj-menu>` and `[mjMenuTriggerFor]`.
   - Added `Registered page blocks (BaseSpacePageBlock), rendered` (3 tests):
     - Registers a dummy `BaseSpacePageBlock` subclass (`TestCustomMetricBlockComponent`) via `@RegisterClassEx(BaseSpacePageBlock, ...)`, verifies it appears in the block picker, selects it, and asserts it mounts via `NgComponentOutlet` with `SpaceId` and `ReadOnly` inputs.
     - Registers a Team-only `BaseSpacePageBlock` (`TestTeamAuditBlockComponent` with `side: 'Team'`) and verifies that when `CanSeeTeam === false` it is excluded from both the block picker and the rendered page, and when `CanSeeTeam === true` it is included and rendered.
     - Verifies that an unregistered block key (`custom:retired-widget`) renders nothing for viewers (`IsCustomizing === false`), renders the muted `"This block is no longer available"` card (`[data-testid="block-unavailable-notice"]`) in edit mode (`IsCustomizing === true`), and prompts via `MJConfirmService.Confirm` when `deleteBlock` is called.
2. **In `packages/Angular/src/lib/logic/space-pages-storage.test.ts`:**
   - Updated the starter Overview block count assertion from `9` to `8` because Round 2 §4 removed the `seed-blk-widget-contributed` (`Widget:ContributedCards`) catch-all block so contributed cards and blocks are individually registered and placed.

### Gate outputs

#### 1. `node scripts/check-mj-tokens.mjs`

```text
mj tokens ok (119 used, 294 defined; 16 mjc used, 16 defined)
```

#### 2. `node scripts/check-mj-inputs.mjs`

```text
mj inputs ok (none of the 14 deprecated names of mjButton and mj-loading is bound)
```

#### 3. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets test`

```text
> @mj-biz-apps/collaboration-ng-widgets@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets
> vitest run


 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets

 ✓ src/lib/ui-driver.test.ts (10 tests) 6ms
 ✓ src/lib/widgets.test.ts (123 tests) 19ms
 ✓ src/lib/render.test.ts (55 tests) 645ms

 Test Files  3 passed (3)
      Tests  188 passed (188)
   Start at  23:07:57
   Duration  10.74s (transform 15.60s, setup 0ms, import 21.34s, tests 665ms, environment 227ms)
```

#### 4. `pnpm --filter @mj-biz-apps/collaboration-ng test`

```text
> @mj-biz-apps/collaboration-ng@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular
> tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/lib/logic/*.test.ts' && vitest run

▶ the space's agent turn, as the page asks for it
  ✔ always runs in the background, so the chat follows the reply row live instead of waiting for the whole run (0.630583ms)
  ✔ answers the chat area in its own words: the reply rows and the run, or the server's refusal (0.106667ms)
  ✔ turns a thrown error into a failed turn with its message, and a plain reason for anything else (0.070625ms)
✔ the space's agent turn, as the page asks for it (1.281ms)
▶ running a Before hook
  ✔ answers true, and logs nothing, when the hook returns (0.501542ms)
  ✔ answers false and logs the hook, the type and the space when BeforeStartChat throws (0.103083ms)
  ✔ answers false and logs the hook, the type and the space when BeforeInvite throws (0.041958ms)
  ✔ names an unknown type, and reads a thrown non-error (0.080708ms)
✔ running a Before hook (1.168458ms)
▶ the state of the Chat tab
  ✔ is closed, with the closed note, when the space is closed, whatever the seat (0.710917ms)
  ✔ is pending, with neither composer nor note, until the seat is known: an owner opening a space is not told they cannot post (0.091333ms)
  ✔ says there is no seat that lets them post, in words for one conversation or for the space's list of them (0.11675ms)
  ✔ says it couldn't check, not that there is no seat, when the seat lookup failed: an owner whose lookup failed is not told they can't post for want of a seat (0.0725ms)
  ✔ is open when the seat is known and may post (0.051042ms)
✔ the state of the Chat tab (1.682042ms)
▶ what closing does, in words
  ✔ names the status the close moves to, says it is read-only for everyone, and that Closed moves forward only (0.461125ms)
  ✔ leaves the assistant out when the status allows no agent retrieval, and says who can bring it back when someone can (0.110333ms)
  ✔ says a hidden status disappears for everyone but the keeper, and tells the viewer they won't see it (0.0945ms)
  ✔ says when the check of the right could not be made, and reads a type with no statuses as read-only and visible (0.066375ms)
  ✔ has words for the read in progress and for a server that could not answer (0.050792ms)
✔ what closing does, in words (1.501208ms)
▶ reading the server's payload
  ✔ needs a keeper, and takes the status and its attributes as given, with defaults for a type that names none (0.371208ms)
✔ reading the server's payload (0.422ms)
▶ the rail conversation list
  ✔ lists each conversation once, whatever the casing of its ID (0.592083ms)
  ✔ puts an internal conversation on the Team band and the rest on Shared (0.07925ms)
  ✔ skips a row with no conversation and names an unnamed one General (0.061542ms)
✔ the rail conversation list (1.1605ms)
▶ choosing the open conversation
  ✔ opens the one asked for, matched as a UUID (0.132125ms)
  ✔ opens the first when the one asked for is not in this space (0.046875ms)
  ✔ opens nothing when the space has no conversation (0.040125ms)
✔ choosing the open conversation (0.301083ms)
▶ how a space's details are drawn
  ✔ is nothing when the type's UI driver shows none (0.354125ms)
  ✔ is the driver's own component when it gives one, without asking for a form (0.398208ms)
  ✔ is the subtype's form when one is registered, whatever fields the driver hides (0.075125ms)
  ✔ is the field list, though a form is registered, when the subtype's columns share a section with the space's (no sections to show alone) (0.096208ms)
  ✔ is a field for each column when there is no form, less the optional ones the driver hides (0.088417ms)
  ✔ is nothing when there is no form and no column to show (0.092625ms)
✔ how a space's details are drawn (1.60525ms)
▶ dates are shown in the locale asked for, with the year
  ✔ follows the locale (9.812417ms)
  ✔ adds the time when asked to (0.18125ms)
  ✔ reads a bad or missing value as unknown, never "Invalid Date" (0.052125ms)
✔ dates are shown in the locale asked for, with the year (10.451208ms)
▶ the roles a seat may hand out
  ✔ gives Sam (a member with ceiling 10) only Outside member and Guest, highest first (0.715ms)
  ✔ gives Casey (an outside admin, ceiling 10, no team band) the same two (0.075625ms)
  ✔ gives an owner every active role (0.06725ms)
  ✔ leaves out a role below the ceiling that carries a power the grantor lacks (0.067167ms)
✔ the roles a seat may hand out (1.3635ms)
▶ Home's lists
  ✔ shows an invitation as a row that opens the People tab of its space (0.67125ms)
  ✔ does not invent a date or a role for an invitation that has none (0.097042ms)
  ✔ shows a task with its status, priority and due date, and skips what is missing (0.112833ms)
  ✔ shows a dash, not zero, for a count that could not be read, and says so to a screen reader (0.225792ms)
✔ Home's lists (1.7485ms)
▶ pinRows (B22)
  ✔ names each pin by its space and opens it (0.226125ms)
✔ pinRows (B22) (0.364167ms)
▶ two overlapping reads of the Overview messages
  ✔ leaves the newer read on screen when the older read finishes last (25.120417ms)
  ✔ applies reads that finish in order, each replacing the last (0.138208ms)
  ✔ writes nothing once the person has moved to another space, even for the newest read (0.081042ms)
✔ two overlapping reads of the Overview messages (25.85125ms)
▶ making a new space
  ✔ starts as its type, owned by the person, inheriting as the type says, with no detail fields for a plain type (0.622125ms)
  ✔ offers a subtype's own fields and reports the required ones still empty (0.191833ms)
  ✔ leaves a form section of only the columns the driver hides out of the sections shown, keeps a required column whatever the driver says, and is unchanged when nothing is hidden (0.335125ms)
  ✔ collects what was typed into the subtype fields, and leaves out what has no value so the column default applies (0.09825ms)
  ✔ asks the server to make the space and seat the person, sending the type, the name and the details, and returns the new id (0.109625ms)
  ✔ sends no details for a plain type, and the description when there is one (0.071958ms)
  ✔ returns the server's refusal, which leaves no space and no seat behind (0.068ms)
✔ making a new space (1.904833ms)
▶ a saved space's details
  ✔ are its subtype record and fields when the space has a subtype (0.200792ms)
  ✔ are none for a plain space or one that will not load (0.143292ms)
  ✔ are dirty once a detail field changes, and missing while a required one is empty (0.183042ms)
  ✔ save, or say why not, and are put back on Discard (0.195ms)
✔ a saved space's details (0.863167ms)
▶ the kinds picked in the New space dialog
  ✔ lets the last pick win when an earlier one finishes after it (0.649833ms)
  ✔ lets the only pick through, and reports its failure (0.133292ms)
  ✔ drops a pick that fails after a later one started: its error is nobody's to show (0.086208ms)
  ✔ drops every pick in flight when the dialog is reset, so a draft from an earlier opening never lands in a later one (0.078792ms)
✔ the kinds picked in the New space dialog (1.440125ms)
▶ the kinds of space the New space dialog offers
  ✔ are the active types, by rank and then name (4.812458ms)
  ✔ carry the description, and fall back to the default icon and no colour (0.114ms)
  ✔ are none when no type is active (0.051958ms)
✔ the kinds of space the New space dialog offers (5.45125ms)
▶ the kinds that may sit under a parent
  ✔ are those the parent type's Children.AllowedTypeCodes names, in the dialog's order (0.135167ms)
  ✔ are every kind when the parent type names none, has no configuration, or its configuration does not parse (0.093792ms)
✔ the kinds that may sit under a parent (0.307833ms)
▶ opening a library file
  ✔ opens the file in the viewer and records the open once (0.60275ms)
  ✔ still opens when the open could not be recorded, and says it was not (0.126583ms)
  ✔ says so when the screen has no viewer to open the file in, and records nothing (0.08175ms)
  ✔ opens nothing for an item with no file (0.078917ms)
✔ opening a library file (1.53775ms)
▶ the item use an open writes
  ✔ names the item, the space, the person and the time (0.087917ms)
  ✔ is nothing when the person or the space is not known (never an empty user ID) (0.044333ms)
✔ the item use an open writes (0.201ms)
▶ the Discussion card lines
  ✔ shows what was typed, not the stored mention, and reads oldest first (0.988042ms)
  ✔ draws an outside seat's sender as outside, and staff and the assistant as not (0.12025ms)
  ✔ keeps the last five (0.0915ms)
✔ the Discussion card lines (1.758833ms)
▶ the space tree
  ✔ dims and locks a closed space, and leaves an open one alone (0.8205ms)
✔ the space tree (1.270625ms)
▶ the rail mode follows the page
  ✔ keeps the home rail on Home, Inbox, My tasks and Recent files (0.103708ms)
  ✔ shows the space rail on a space (0.05175ms)
✔ the rail mode follows the page (0.244958ms)
▶ who reaches a space
  ✔ lists Studio with only Ada on it and staff reached through it (1.00325ms)
  ✔ lists Northwind with Ada on it, Bea and Sam as team members, and Casey as an outside member (0.115375ms)
  ✔ lists Discovery with no seats of its own, and everyone from Northwind reached through its parent (0.091ms)
  ✔ lists Field notes with Ada on it and Bea, Casey and Sam reached through its parents (0.111292ms)
  ✔ lists only the sealed child's own seats, not the branch's or Northwind's (0.147ms)
  ✔ keeps Sam reaching Field notes through Northwind when the guest seat Sam holds there is Removed or Invited, and carries that seat beside Sam (0.170417ms)
  ✔ lists a person nothing else reaches by their own Removed or Invited seat (0.080333ms)
  ✔ follows a parent the viewer can't read, unnamed, and stops there (0.096333ms)
  ✔ stops at a parent whose status hides it, and keeps one whose status is read-only but visible (0.124333ms)
✔ who reaches a space (2.337083ms)
▶ the section's list of who reaches a space, held against Core's
  ✔ lists the same people under the same seats with no space closed (0.284542ms)
  ✔ lists the same people under the same seats with an archived middle space (hidden) (0.0545ms)
  ✔ lists the same people under the same seats with a paused middle space (read-only, visible) (0.057167ms)
  ✔ lists the same people under the same seats with a closed middle space (read-only, visible) (0.063333ms)
  ✔ lists the same people under the same seats with an active middle space with a status row (0.04875ms)
  ✔ lists the same people under the same seats with a closed middle space of a type with no statuses (0.042125ms)
✔ the section's list of who reaches a space, held against Core's (0.662ms)
▶ the seat actions offered
  ✔ offers Sam (a member who can invite) no Approve or Change role on a type that holds invites for approval, but Remove (1.212208ms)
  ✔ offers Sam Approve and Change role on a type that approves automatically (0.360917ms)
  ✔ offers an owner Approve, Change role and Remove on a guest (0.07475ms)
  ✔ offers nothing on a seat above the viewer's ceiling, or one carrying a power they lack (0.062542ms)
  ✔ hides Remove and Change role on the only active owner seat, whoever is looking, and offers nothing for someone who cannot invite (0.118292ms)
✔ the seat actions offered (2.514042ms)
▶ the header seat summary
  ✔ counts only Active seats (0.398167ms)
  ✔ does not let an invited or removed outside seat make the space Shared (0.087042ms)
  ✔ makes the space Shared once an outside seat is Active (0.251333ms)
  ✔ summarizes a space with no seats (0.0535ms)
✔ the header seat summary (1.345583ms)
▶ a load for a selected space
  ✔ may write while its selection is the current one, whatever the ID casing (0.270708ms)
  ✔ may not write once a later selection has started (0.039333ms)
  ✔ may not write once the person is in another space, even with the same request number (0.036667ms)
  ✔ may not write when no space is active (0.033459ms)
✔ a load for a selected space (0.945708ms)
▶ guardedLoad
  ✔ leaves the newer space's lists alone when the older space's read lands last (0.476541ms)
  ✔ writes when its selection is still the current one (0.082209ms)
  ✔ does not write when the read fails, and lets the failure through (0.413125ms)
✔ guardedLoad (1.108125ms)
▶ a selection starts clean
  ✔ closes the drawer, clears the item, resets both bands and drops the last save message (0.354375ms)
  ✔ closes the share, upload and new-conversation dialogs, so none stays open over the next space (0.439792ms)
✔ a selection starts clean (1.317ms)
▶ the loading flag of a selection
  ✔ is raised while a selection loads and lowered when it finishes (0.102625ms)
  ✔ stays raised when an older selection finishes after a newer one began (0.122125ms)
✔ the loading flag of a selection (0.3575ms)
▶ what Settings offers
  ✔ offers nothing to someone with no right (0.674875ms)
  ✔ offers Close, read-only, to an owner who holds the lifecycle authorization but not Configure Spaces (0.119084ms)
  ✔ offers Reopen, read-only, on a closed space to an owner who may only reopen (0.068292ms)
  ✔ offers the form without a close button to an owner who may configure but not close (0.058125ms)
  ✔ offers the form and the button to someone who may do both (0.0615ms)
  ✔ does not offer Close on a closed space, or Reopen on an open one, whatever the rights say (0.064709ms)
✔ what Settings offers (1.702666ms)
▶ a terminal status (stage 1: Closed moves forward only)
  ✔ offers no reopen, whatever the rights say, and says so above the read-only view (0.098833ms)
  ✔ offers nothing to someone with neither right on a terminal space (0.064042ms)
  ✔ still offers the reopen on a closed space whose status is not terminal (0.053ms)
✔ a terminal status (stage 1: Closed moves forward only) (0.319542ms)
▶ the Settings model
  ✔ shows the space's status by name when the caller knows it, else Active or Closed from ClosedAt (0.380584ms)
  ✔ takes the icon and color from the type when the space has none (0.070292ms)
  ✔ marks a closed space (0.062667ms)
✔ the Settings model (0.958792ms)
▶ what a Settings save writes
  ✔ writes nothing for a screen the person did not change (0.362708ms)
  ✔ writes only the name when only the name changes (0.093959ms)
  ✔ clears a background the person emptied (0.061042ms)
✔ what a Settings save writes (0.611292ms)
▶ the Settings session across two saves
  ✔ writes only the second edit on the second save, after the form is rebuilt from what the first save wrote (0.784125ms)
  ✔ does not count an edit made while a save was running as saved (0.072834ms)
  ✔ starts from the new space when another is selected (0.086125ms)
✔ the Settings session across two saves (1.050875ms)
▶ writing the changes onto a space
  ✔ sets exactly the fields that changed (0.107625ms)
  ✔ can set a field to null (0.048583ms)
✔ writing the changes onto a space (0.203084ms)
▶ who a share reaches
  ✔ says nobody new gains access in Studio, where only staff sit (0.599625ms)
  ✔ lists only the Active outside seats in Discovery, not staff, the invited or the removed (0.125083ms)
  ✔ does not fall back to everyone when the only outside seats are Invited or Removed (0.05625ms)
✔ who a share reaches (1.236125ms)
▶ space-pages-storage
  ✔ identifies serialized custom page JSON vs plain markdown note body (0.395708ms)
  ✔ builds starter pages for all built-in space tabs and merges saved customizations + user pages (0.584542ms)
✔ space-pages-storage (1.376458ms)
▶ the rules from the server's configuration document
  ✔ carries the type's labels, which a participant's browser cannot resolve itself (0.588542ms)
  ✔ gives null for a missing, broken or shapeless document, so the browser keeps its own answer (0.063917ms)
  ✔ tells the same rules from changed ones (0.151084ms)
✔ the rules from the server's configuration document (1.175625ms)
▶ a space's tabs
  ✔ offers the built-in tabs, in order, when the type has every panel (0.760541ms)
  ✔ reports a tab that names no built-in tab and has no component, and keeps building (0.135708ms)
  ✔ shows no Library for a type with LibraryPanel off, even when the driver names it (0.082333ms)
  ✔ mounts a contributed tab, and keeps the built-in id when the board's own 'overview' names the built-in Overview (0.10875ms)
  ✔ drops a tab that names no built-in tab and brings nothing to draw (0.065625ms)
  ✔ relabels a tab from Labels.Tabs whatever the key casing (0.064709ms)
  ✔ resolves a deep link to the tab id without regard to case, and by its alias (0.08925ms)
✔ a space's tabs (1.798458ms)
▶ a UI driver that throws
  ✔ still gives the space its built-in tabs, and reports the failure (0.142584ms)
  ✔ gives the driver its tabs when it does not throw (0.088875ms)
  ✔ reads a deep link as the built-in tab it names, in any case, with discussions as Chat, and passes a contributed key through (0.103458ms)
✔ a UI driver that throws (0.433416ms)
▶ the Data tab (B19)
  ✔ is offered only when the space offers data, between Library and Work (0.134375ms)
  ✔ a driver naming Data cannot switch it on for a space with nothing to show (0.083333ms)
  ✔ reads with the type's label (0.06225ms)
✔ the Data tab (B19) (0.349375ms)
▶ creating a space type's UI driver
  ✔ returns the driver that was created, and reports nothing (0.667917ms)
  ✔ falls back to the default driver, and reports the error, when the type's driver's constructor throws (0.098333ms)
✔ creating a space type's UI driver (1.61ms)
▶ The notes a viewer is shown
  ✔ keeps a space note and the viewer's own private note, and drops another person's private note (0.624459ms)
  ✔ compares the author without regard to case, as MJ ids come back either way (0.074583ms)
  ✔ shows a viewer with no id only the space notes (0.057ms)
✔ The notes a viewer is shown (1.230583ms)
ℹ tests 158
ℹ suites 45
ℹ pass 158
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 203.877458

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular

 ✓ src/lib/space-details-view.render.test.ts (5 tests) 36ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  23:08:09
   Duration  4.97s (transform 3.22s, setup 0ms, import 4.69s, tests 36ms, environment 189ms)
```

#### 5. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets --filter @mj-biz-apps/collaboration-ng build`

```text
Scope: 2 of 15 workspace projects
packages/AngularWidgets build$ ngc
packages/AngularWidgets build: src/lib/space-chat.component.ts:70:59 - warning NG8113: MJButtonDirective is not used within the template of CollabSpaceChatComponent
packages/AngularWidgets build: 70   imports: [CollabBandChipComponent, ConversationsModule, MJButtonDirective, MJClickableDirective],
packages/AngularWidgets build:                                                              ~~~~~~~~~~~~~~~~~
packages/AngularWidgets build: src/lib/space-settings.component.ts:13:77 - warning NG8113: MJDropdownComponent is not used within the template of CollabSpaceSettingsComponent
packages/AngularWidgets build: 13   imports: [CommonModule, FormsModule, MJAlertComponent, MJButtonDirective, MJDropdownComponent, SharedGenericModule],
packages/AngularWidgets build:                                                                                ~~~~~~~~~~~~~~~~~~~
packages/AngularWidgets build: Done
packages/Angular build$ ngc
packages/Angular build: src/lib/collaboration-section.component.ts:1450:116 - warning NG8107: The left side of this optional chain operation does not include 'null' or 'undefined' in its type, therefore the '?.' operator can be replaced with the '.' operator.
packages/Angular build: 1450                                                                         <span class="config-meta">{{ reach.Fields?.length ? reach.Fields.length + ' field' + (reach.Fields.length === 1 ? '' : 's') : 'every field' }}</span>
packages/Angular build:                                                                                                                         ~~~~~~
packages/Angular build: Done
```

### Screenshots (`plans/space-focused-ux/shots/round-2/`, 1440×900, light and dark)

- `plans/space-focused-ux/shots/round-2/home-light.png`
- `plans/space-focused-ux/shots/round-2/home-dark.png`
- `plans/space-focused-ux/shots/round-2/discovery-overview-light.png`
- `plans/space-focused-ux/shots/round-2/discovery-overview-dark.png`
- `plans/space-focused-ux/shots/round-2/field-notes-light.png`
- `plans/space-focused-ux/shots/round-2/field-notes-dark.png`
- `plans/space-focused-ux/shots/round-2/library-light.png`
- `plans/space-focused-ux/shots/round-2/library-dark.png`
- `plans/space-focused-ux/shots/round-2/work-light.png`
- `plans/space-focused-ux/shots/round-2/work-dark.png`
- `plans/space-focused-ux/shots/round-2/chat-thread-open-light.png`
- `plans/space-focused-ux/shots/round-2/chat-thread-open-dark.png`
- `plans/space-focused-ux/shots/round-2/page-edit-mode-light.png`
- `plans/space-focused-ux/shots/round-2/page-edit-mode-dark.png`
- `plans/space-focused-ux/shots/round-2/rail-collapsed-light.png`
- `plans/space-focused-ux/shots/round-2/rail-collapsed-dark.png`
