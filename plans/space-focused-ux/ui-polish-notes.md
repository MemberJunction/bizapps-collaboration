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
- `packages/IntegrationTests/src/world/seed-plan.ts`

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

---

## Round 2b

### What changed

#### Part 1: R2-1 through R2-8 review findings (committed as `a52f906`)

1. **`R2-1` — Single block registration system (`BaseSpacePageBlock`):**
   - Removed the parallel `BaseSpaceOverviewCard` registration path from `assembleSpacePageBlocks` and `CollabSpacePagesComponent`. Every page block is now a `BaseSpacePageBlock`.
   - Migrated the test fixture `TestSpaceOverviewCardComponent` in `packages/AngularWidgets/src/lib/ui-driver.test.ts` to extend `BaseSpacePageBlock` and register with `@RegisterClassEx(BaseSpacePageBlock, ...)`.
   - Marked `BaseSpaceOverviewCard` as `@deprecated` in `packages/AngularWidgets/src/lib/base-space-type-ui-driver.ts`.
2. **`R2-2` — Self-contained `BaseSpacePageBlock` components (no parent callback tunnel):**
   - Removed `SpacePageBlockContext` and `@Input() Context` from `BaseSpacePageBlock` and `CollabSpacePagesComponent`.
   - Each built-in block (`collab:pinned`, `collab:needs-you`, `collab:shared-files`, `collab:team-files`, `collab:ask`, `collab:discussion`, `collab:sub-spaces`, `collab:about`, `collab:main-view`) now injects `CollabSpacePageBlockHostService` (`SPACE_PAGE_BLOCK_HOST`) for space-scoped data and actions while accepting `@Input() SpaceId!: string`, `@Input() Config?: Record<string, unknown>`, and `@Input() ReadOnly = false`.
3. **`R2-3` — Promote-to-Shared confirmation dialog:**
   - Added a `MJConfirmService` confirmation dialog in `CollabSpacePagesComponent.promoteCurrentPageToShared()` before emitting `PagePromote`: *"Share '{{ title }}' with external participants? External participants in this space will be able to read this page. This cannot be undone."*
4. **`R2-4` — Duplicate page title disambiguation:**
   - Updated `CollabSpacePagesComponent.duplicateCurrentPage()` to compute a non-colliding copy title (`"<Title> (copy)"`, `"<Title> (copy 2)"`, etc.) against existing pages in the space.
5. **`R2-5` — Move `↑` / `↓` into the `⋯` block menu:**
   - Reduced `.sp-block-tools` on the block hover bar to 2 controls: the drag handle (`.sp-drag-handle`) and the `⋯` menu trigger (`[mjMenuTriggerFor]="blockMoreMenu"`).
   - Added `Move up` (`canMoveBlock(block.id, -1)`) and `Move down` (`canMoveBlock(block.id, 1)`) items to `blockMoreMenu`.
6. **`R2-6` — Remove redundant outer border on `.sp-main-view-slot`:**
   - Removed the outer border/radius/background wrapper on `.sp-main-view-slot` in `CollabSpacePagesComponent` so embedded main views (`Library`, `Work`, `Chat`, `People`, `Notes`, `Settings`, `Details`, `Data`) do not double-border against their own card frames.
7. **`R2-7` — Register exported `@RegisterClassEx` page blocks in `scripts/check-registered-exports.mjs`:**
   - Extended `scripts/check-registered-exports.mjs` to match both `@RegisterClass(` and `@RegisterClassEx(` decorators so all 9 built-in `BaseSpacePageBlock` classes are verified as exported from `@mj-biz-apps/collaboration-ng-widgets`.
8. **`R2-8` — Honest empty states for Pinned and Needs-you blocks in edit mode:**
   - Updated `CollabPinnedPageBlockComponent` and `CollabNeedsYouPageBlockComponent` so edit mode shows a single compact muted line (`"Pinned items show here when there are any."` / `"Items needing your attention show here when there are any."`) instead of stacked duplicate empty boxes.

#### Part 2: Step M — Multi-party agent routing merge & `CollapseThreadReplies` (committed as `78f9f7c` in `bizapps-collaboration`, `a7c25e8f37` in `MJ`)

1. **Local floating chat bubble disabled via Explorer record form:**
   - Opened the `Application Settings` record (`6855118F-E692-4737-A125-AE267D2DC39C`, `Shell.ChatOverlay.Enabled`) in MJExplorer (`http://localhost:4200`), set `Value` to `false`, and clicked `Save` (local database only; no Collaboration code or metadata touched).
2. **`MJ` branch `collab/e2e-combined` (`a7c25e8f37`):**
   - Restored the 15 partial `#6176` paths to `origin/next`, fast-forwarded `origin/next`, and re-applied `CollapseThreadReplies` on `MJConversationChatAreaComponent` as strictly opt-in (`@Input() CollapseThreadReplies: boolean = false;`, `const collapseThreads = this.CollapseThreadReplies;`) with unit tests in `MJ/packages/Angular/Generic/conversations/src/__tests__/collapse-thread-replies.test.ts`.
3. **`bizapps-collaboration` branch `feat/collab-ui-polish` (`784359c` + `78f9f7c`):**
   - Merged `origin/feat/multi-party-agent-routing` (`0eafa89`, PR #19) into `feat/collab-ui-polish`.
   - Bound `[CollapseThreadReplies]="true"` on `<mj-conversation-chat-area>` in `packages/AngularWidgets/src/lib/space-chat.component.ts` and added an assertion in `packages/AngularWidgets/src/lib/render.test.ts`.
   - Verified all 3 smoke chat turns in the browser (`plans/space-focused-ux/shots/step-m/chat-mention-light.png`, `chat-thread-reply-light.png`, `chat-unmentioned-followup-light.png`).

#### Part 3: Round 2b — Dedicated `SpacePage` table, RLS, `SpacePageEntityServer`, and client migration

1. **Table & CodeGen (`migrations/V202610300100__v0.1.x__Space_Pages.sql`):**
   - Created `__mj_BizAppsCollaboration.SpacePage` with `ID` (`UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID()`), `SpaceID` (FK to `Space`), `BuiltInTabKey` (`NVARCHAR(50) NULL`), `Title` (`NVARCHAR(200) NOT NULL`), `Icon` (`NVARCHAR(100) NULL`), `Band` (`NVARCHAR(20) NOT NULL DEFAULT N'Team'`, `CHECK (Band IN (N'Team', N'Shared'))`), `PromotedByUserID` (`UNIQUEIDENTIFIER NULL`), `PromotedAt` (`DATETIMEOFFSET NULL`), `Sequence` (`INT NOT NULL DEFAULT 0`), `Blocks` (`NVARCHAR(MAX) NOT NULL DEFAULT N'[]'`, `CHECK (ISJSON(Blocks) = 1)`), `CreatedByUserID` (`UNIQUEIDENTIFIER NOT NULL`), `LastEditedByUserID` (`UNIQUEIDENTIFIER NOT NULL`), plus filtered unique index `UQ_SpacePage_Space_BuiltInTab` (`WHERE BuiltInTabKey IS NOT NULL`), index `IX_SpacePage_Space_Sequence` on `(SpaceID, Sequence, Title)`, and `sp_addextendedproperty` descriptions on the table and every column.
   - Ran MJ CodeGen to generate `vwSpacePages`, `spCreateSpacePage`, `spUpdateSpacePage`, `trgUpdateSpacePage`, `spDeleteSpacePage`, entity metadata (`EFE52365-941E-4A5A-B6E3-6733013EC9E3`, `MJ_BizApps_Collaboration: Space Pages`), `mjBizAppsCollaborationSpacePageEntity` in `packages/Entities/src/generated/entities/__mj_BizAppsCollaboration.ts`, GraphQL schema in `packages/Server/src/generated/graphql-schemas/__mj_BizAppsCollaboration.ts`, and Angular form components in `packages/Angular/src/lib/generated/Entities/mjBizAppsCollaborationSpacePage/`.
2. **`pageEditVerdict` in `collaboration-core` (`packages/Core/src/notes.ts`):**
   - Added `PageEditViewer`, `SpaceForPageEdit`, `PageEditVerdict`, and pure rule `pageEditVerdict(viewer, space)` allowing page edits when the space is open and not read-only and the viewer is the space owner, holds a seat with `canPromoteBand`, holds `canEditSpaceSettings`, or administers spaces.
3. **`SpacePageEntityServer` (`packages/CoreEntitiesServer/src/SpacePageEntityServer.ts`):**
   - Registered `@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Pages')` on `SpacePageEntityServer`.
   - Enforces reach, read-only status (`statusAllowsSaves`), Team band visibility (`canSeeTeamBand`), and `pageEditVerdict` on create, update, and delete (so any space editor—not just the page creator—can update or delete a page).
   - Stamps `CreatedByUserID = callerId` on create and `LastEditedByUserID = callerId` on every create and update.
   - Enforces one-way `Team` -> `Shared` promotion via `promotionStamps`, refusing `Shared` -> `Team` demotion.
   - Refuses changing `SpaceID` or `BuiltInTabKey` after creation, and refuses deleting a built-in tab's page (`BuiltInTabKey != null`).
   - Exported `SpacePageEntityServer` and `LoadSpacePageEntityServer` from `packages/CoreEntitiesServer/src/index.ts`, and called `LoadSpaceNoteEntityServer()` and `LoadSpacePageEntityServer()` in `packages/Server/src/index.ts`.
4. **Metadata (`metadata/`):**
   - Added `Collaboration: Visible Pages` (`A4D8193B-5C62-4E7A-8B90-1F2E3D4C5B6A`) and `Collaboration: Pages The Caller May Change` (`B5E92A4C-6D73-4F8B-9C01-2A3F4E5D6C7B`) in `metadata/row-level-security-filters/.row-level-security-filters.json`.
   - Added `MJ_BizApps_Collaboration: Space Pages` permissions for `UI` and `Space Participant` (`C7F03B5D-7E84-4A9C-AD12-3B4A5F6E7D8C`) in `metadata/entities/.ui-role-permissions.json` and `metadata/entity-permissions/.entity-permissions.json`.
   - Validated with `pnpm exec mj sync validate --dir=metadata` (`0 errors`) and synced to the local database.
5. **Client (`packages/Angular`):**
   - Created `packages/Angular/src/lib/logic/space-pages.ts` and `packages/Angular/src/lib/logic/space-pages.test.ts` mapping `mjBizAppsCollaborationSpacePageEntity` rows to `CollabPageModel` (`mapSpacePageRowToModel`, `applyCollabPageToEntity`, `buildStarterPagesForSpace`, `mergeSpacePagesWithDefaults`), and deleted `packages/Angular/src/lib/logic/space-pages-storage.ts` and `packages/Angular/src/lib/logic/space-pages-storage.test.ts`.
   - Updated `packages/Angular/src/lib/collaboration-section.component.ts`:
     - `canCustomizePages` now delegates to `pageEditVerdict(...)` from `@mj-biz-apps/collaboration-core`.
     - `loadSpaceNotes` no longer filters `isCollabPageNoteBody`.
     - `loadSpacePages`, `onPageSave`, `onPageDelete`, `onPageReorder`, and `onPagePromote` read and write `MJ_BizApps_Collaboration: Space Pages` via `RunView` and `GetEntityObject`.
   - Checked the local database (`__mj_BizAppsCollaboration.SpaceNote WHERE Body LIKE N'{"__collabPage":1%'`): 0 dev page-JSON rows were present in `SpaceNote` (only the 5 world-seeded plain notes exist).

### Files touched

- `migrations/V202610300100__v0.1.x__Space_Pages.sql` (new)
- `Schema Files/__mj_BizAppsCollaboration.full.json`
- `Schema Files/__mj_BizAppsCollaboration.full.min.json`
- `Schema Files/__mj_BizAppsCollaboration.simple.json`
- `Schema Files/__mj_BizAppsCollaboration.simple.min.json`
- `metadata/row-level-security-filters/.row-level-security-filters.json`
- `metadata/entities/.ui-role-permissions.json`
- `metadata/entity-permissions/.entity-permissions.json`
- `packages/Core/src/notes.ts`
- `packages/Core/src/notes.test.ts`
- `packages/Entities/src/generated/entities/__mj_BizAppsCollaboration.ts`
- `packages/CoreEntitiesServer/src/SpacePageEntityServer.ts` (new)
- `packages/CoreEntitiesServer/src/index.ts`
- `packages/CoreEntitiesServer/src/stage1-servers.test.ts`
- `packages/Server/src/generated/graphql-schemas/__mj_BizAppsCollaboration.ts`
- `packages/Server/src/index.ts`
- `packages/Angular/src/lib/generated/Entities/mjBizAppsCollaborationSpacePage/mjbizappscollaborationspacepage.form.component.ts` (new)
- `packages/Angular/src/lib/generated/Entities/mjBizAppsCollaborationSpacePage/mjbizappscollaborationspacepage.form.component.html` (new)
- `packages/Angular/src/lib/generated/Entities/mjBizAppsCollaborationSpace/mjbizappscollaborationspace.form.component.ts`
- `packages/Angular/src/lib/generated/Entities/mjBizAppsCollaborationSpace/mjbizappscollaborationspace.form.component.html`
- `packages/Angular/src/lib/generated/generated-forms.module.ts`
- `packages/Angular/src/lib/logic/space-pages.ts` (new, replaces `space-pages-storage.ts`)
- `packages/Angular/src/lib/logic/space-pages.test.ts` (new, replaces `space-pages-storage.test.ts`)
- `packages/Angular/src/lib/collaboration-section.component.ts`
- `packages/AngularWidgets/src/lib/base-space-page-block.ts` (in `a52f906`)
- `packages/AngularWidgets/src/lib/base-space-type-ui-driver.ts` (in `a52f906`)
- `packages/AngularWidgets/src/lib/space-pages.component.ts` (in `a52f906`)
- `packages/AngularWidgets/src/lib/space-chat.component.ts` (in `78f9f7c`)
- `packages/AngularWidgets/src/lib/ui-driver.test.ts` (in `a52f906`)
- `packages/AngularWidgets/src/lib/render.test.ts` (in `a52f906` and `78f9f7c`)
- `scripts/check-registered-exports.mjs` (in `a52f906`)

### Test changes and rationale

1. **In `packages/Core/src/notes.test.ts`:**
   - Added `describe('pageEditVerdict (Round 2b)', ...)` (3 tests) verifying that `pageEditVerdict` allows the space owner, a seat whose role has `canPromoteBand`, a viewer with `canEditSpaceSettings`, and a space administrator; refuses a plain member with a clear message; and refuses everyone when the space is closed or read-only.
2. **In `packages/CoreEntitiesServer/src/stage1-servers.test.ts`:**
   - Added `describe('Space Pages: customizable block-canvas pages in the space', ...)` (4 tests):
     - An editor who did not create the page (`sam-id` with `canPromoteBand: true`) can save a page created by `ada-id`, stamping `LastEditedByUserID = 'sam-id'` while preserving `CreatedByUserID = 'ada-id'`.
     - A plain member (`remy-id` with `canPromoteBand: false`) is refused on create, save, and delete with a clear validation message, and deleting a built-in tab page (`BuiltInTabKey != null`) is refused even for an owner.
     - Every caller is refused in a closed space.
     - An outside participant (`casey-id`, `canSeeTeamBand: false`) is refused when attempting to write a `Team` page, and the `Collaboration: Visible Pages` RLS filter only exposes `Band = N'Shared'` to seats with `CanSeeTeamBand = 0`.
3. **In `packages/Angular/src/lib/logic/space-pages.test.ts`:**
   - Replaced `space-pages-storage.test.ts` with `space-pages.test.ts`, testing `mapSpacePageRowToModel`, `applyCollabPageToEntity`, `buildStarterPagesForSpace`, and `mergeSpacePagesWithDefaults` against `SpacePageRow` entities instead of `SpaceNote` JSON bodies.

### Gate outputs

#### 1. `node scripts/check-mj-tokens.mjs`

```text
mj tokens ok (119 used, 296 defined; 16 mjc used, 16 defined)
```

#### 2. `node scripts/check-mj-inputs.mjs`

```text
mj inputs ok (none of the 14 deprecated names of mjButton and mj-loading is bound)
```

#### 3. `node scripts/check-registered-exports.mjs`

```text
registered exports ok (8 published packages and 3 example packages: every @RegisterClass class is exported from its entry)
```

#### 4. `pnpm exec mj sync validate --dir=metadata`

```text
Validating metadata files...

✔ Metadata validation complete!

Summary:
  Files checked: 17
  Entities validated: 112
  Total records: 112
  Errors: 0
  Warnings: 0
```

#### 5. `node --experimental-strip-types --test packages/Core/src/notes.test.ts` & `node --experimental-strip-types --test packages/CoreEntitiesServer/src/stage1-servers.test.ts`

```text
▶ notePromotionVerdict (call 15)
  ✔ the owner promotes (0.456833ms)
  ✔ a seat whose role may promote the band promotes (0.043209ms)
  ✔ an administrator promotes without a seat (0.038208ms)
  ✔ a private note is not promoted (0.037208ms)
  ✔ a member may not, nor the author by being the author (0.0475ms)
  ✔ a Shared note is not promoted again (0.034667ms)
  ✔ the consequence names the audience and says it is not undone (0.066042ms)
✔ notePromotionVerdict (call 15) (1.100458ms)
▶ pageEditVerdict (Round 2b)
  ✔ allows the space owner, a seat whose role can promote the band, someone who can edit space settings, and a space administrator (0.078167ms)
  ✔ refuses a plain member with a clear message (0.04425ms)
  ✔ refuses everyone when the space is closed or read-only (0.062459ms)
✔ pageEditVerdict (Round 2b) (0.258625ms)
▶ noteDocument
  ✔ names the file from the title and writes Markdown with the title as its heading (0.13675ms)
  ✔ an empty body gives the heading alone; an unusable title gives note.md (0.050125ms)
✔ noteDocument (0.228ms)
ℹ tests 12
ℹ suites 3
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 53.350125

▶ The staff-only promise and the anchors a retype carries (items 157 and 149)
  ✔ reads a type's audience from its configuration, failing closed to StaffAndParticipants (0.257625ms)
  ✔ sees participants on a space through an active seat whose role cannot see Team, and through an inheriting child (0.424584ms)
  ✔ names the space of the new type that already holds the retyped space's primary anchor (0.147416ms)
✔ The staff-only promise and the anchors a retype carries (items 157 and 149) (1.045625ms)
▶ Space Anchors: the records a space is about
  ✔ accepts a primary anchor from someone with Configure Spaces, and stamps the space's type on it (0.725958ms)
  ✔ refuses an entity not in the database, a key the entity does not accept, a type that is not the space's, and a space that does not exist (0.240042ms)
  ✔ refuses a writer without Configure Spaces, unless the type's driver vouches for the row in process (0.171125ms)
  ✔ refuses a second primary anchor on a space, and a primary anchor on a record another space of the type already holds, naming that space (0.227041ms)
  ✔ needs a role on a non-primary anchor, and gives a primary one the role "primary" (0.119875ms)
✔ Space Anchors: the records a space is about (1.594459ms)
▶ Space Grants: what the app, a type or a space offers
  ✔ accepts a space's agent grant from an owner with Configure Spaces, and stamps the kind's entity (0.359042ms)
  ✔ refuses a kind that is not one of the seven, a row that is both a type's and a space's, and a default that is not an agent (0.141833ms)
  ✔ refuses a target entity that is not the kind's, and a target that does not exist (0.147375ms)
  ✔ holds § 4's rules: a query goes only to a type that seats staff only (absent fails closed), a view with a binding nowhere (0.503125ms)
  ✔ keeps an agent's settings inside its definition: skills for an agent that accepts none, a limit above its own (0.345042ms)
  ✔ asks for Configure Spaces on a space's row and Configure Space Types on the app's or a type's (0.1015ms)
✔ Space Grants: what the app, a type or a space offers (1.723583ms)
▶ Space Notes: light notes in the space
  ✔ stamps the caller as the author on create, and refuses another author (0.552959ms)
  ✔ refuses a Team note from a seat that can't see Team, and anything from someone who does not reach the space (0.241291ms)
  ✔ refuses a note in a space whose status is read-only (here a closed space of a type with no statuses) (0.183584ms)
  ✔ lets only the author edit; a Team note moves to Shared by the owner (call 15), with nothing else changed, never back, and never a private one; the space stays (0.597834ms)
✔ Space Notes: light notes in the space (1.6325ms)
▶ Space Member Pins: what a member keeps at the top of a space
  ✔ is the caller's own: it stamps the caller, refuses another user, and refuses someone who does not reach the space (0.394083ms)
  ✔ pins a record only when it is in the space (an item of it, or one of its notes), and never a record with a grant (0.255208ms)
  ✔ pins a grant only when it is in force in the space: the app's yes, an ancestor's yes, another space's no (0.392792ms)
  ✔ is removed by its owner only (0.060417ms)
✔ Space Member Pins: what a member keeps at the top of a space (1.148208ms)
▶ Space Type Status: the statuses a type declares
  ✔ accepts a status that keeps the type's list sound, from someone with Configure Space Types (0.194625ms)
  ✔ refuses a writer without Configure Space Types (0.039583ms)
  ✔ refuses a list that is not sound: a second default, a repeated code or sequence, a frozen status that is not terminal (0.168333ms)
  ✔ refuses the delete of a status a space still names (0.081416ms)
✔ Space Type Status: the statuses a type declares (0.521667ms)
▶ Space Pages: customizable block-canvas pages in the space
  ✔ lets an editor who did not create the page save it (0.226208ms)
  ✔ refuses a plain member on create, save, and delete with a clear message (0.276666ms)
  ✔ refuses everyone in a closed space (0.148959ms)
  ✔ ensures an outside participant never reads a Team page (RLS filter and server band check) (0.926416ms)
✔ Space Pages: customizable block-canvas pages in the space (1.659708ms)
ℹ tests 30
ℹ suites 7
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 207.663542
```

#### 6. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets test`

```text
> @mj-biz-apps/collaboration-ng-widgets@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets
> vitest run


 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets

 ✓ src/lib/ui-driver.test.ts (10 tests) 6ms
 ✓ src/lib/widgets.test.ts (123 tests) 15ms
 ✓ src/lib/render.test.ts (55 tests) 688ms

 Test Files  3 passed (3)
      Tests  188 passed (188)
   Start at  02:04:59
   Duration  12.62s (transform 18.92s, setup 0ms, import 25.41s, tests 709ms, environment 260ms)
```

#### 7. `pnpm --filter @mj-biz-apps/collaboration-ng test`

```text
> @mj-biz-apps/collaboration-ng@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular
> tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/lib/logic/*.test.ts' && vitest run

▶ the space's agent turn, as the page asks for it
  ✔ always runs in the background, so the chat follows the reply row live instead of waiting for the whole run (0.601166ms)
  ✔ answers the chat area in its own words: the reply rows and the run, or the server's refusal (0.097459ms)
  ✔ turns a thrown error into a failed turn with its message, and a plain reason for anything else (0.063042ms)
✔ the space's agent turn, as the page asks for it (1.213417ms)
▶ running a Before hook
  ✔ answers true, and logs nothing, when the hook returns (0.662ms)
  ✔ answers false and logs the hook, the type and the space when BeforeStartChat throws (0.133375ms)
  ✔ answers false and logs the hook, the type and the space when BeforeInvite throws (0.057041ms)
  ✔ names an unknown type, and reads a thrown non-error (0.107459ms)
✔ running a Before hook (1.448958ms)
▶ the state of the Chat tab
  ✔ is closed, with the closed note, when the space is closed, whatever the seat (0.611375ms)
  ✔ is pending, with neither composer nor note, until the seat is known: an owner opening a space is not told they cannot post (0.07175ms)
  ✔ says there is no seat that lets them post, in words for one conversation or for the space's list of them (0.104667ms)
  ✔ says it couldn't check, not that there is no seat, when the seat lookup failed: an owner whose lookup failed is not told they can't post for want of a seat (0.071042ms)
  ✔ is open when the seat is known and may post (0.049709ms)
✔ the state of the Chat tab (1.394ms)
▶ what closing does, in words
  ✔ names the status the close moves to, says it is read-only for everyone, and that Closed moves forward only (0.363167ms)
  ✔ leaves the assistant out when the status allows no agent retrieval, and says who can bring it back when someone can (0.075542ms)
  ✔ says a hidden status disappears for everyone but the keeper, and tells the viewer they won't see it (0.089167ms)
  ✔ says when the check of the right could not be made, and reads a type with no statuses as read-only and visible (0.054542ms)
  ✔ has words for the read in progress and for a server that could not answer (0.045166ms)
✔ what closing does, in words (1.031625ms)
▶ reading the server's payload
  ✔ needs a keeper, and takes the status and its attributes as given, with defaults for a type that names none (0.333291ms)
✔ reading the server's payload (0.373667ms)
▶ the rail conversation list
  ✔ lists each conversation once, whatever the casing of its ID (0.536375ms)
  ✔ puts an internal conversation on the Team band and the rest on Shared (0.064958ms)
  ✔ skips a row with no conversation and names an unnamed one General (0.059083ms)
✔ the rail conversation list (1.055666ms)
▶ choosing the open conversation
  ✔ opens the one asked for, matched as a UUID (0.112208ms)
  ✔ opens the first when the one asked for is not in this space (0.387667ms)
  ✔ opens nothing when the space has no conversation (0.089375ms)
✔ choosing the open conversation (0.69575ms)
▶ how a space's details are drawn
  ✔ is nothing when the type's UI driver shows none (0.338334ms)
  ✔ is the driver's own component when it gives one, without asking for a form (0.38175ms)
  ✔ is the subtype's form when one is registered, whatever fields the driver hides (0.074458ms)
  ✔ is the field list, though a form is registered, when the subtype's columns share a section with the space's (no sections to show alone) (0.094667ms)
  ✔ is a field for each column when there is no form, less the optional ones the driver hides (0.084666ms)
  ✔ is nothing when there is no form and no column to show (0.076083ms)
✔ how a space's details are drawn (1.560708ms)
▶ dates are shown in the locale asked for, with the year
  ✔ follows the locale (11.03975ms)
  ✔ adds the time when asked to (0.383125ms)
  ✔ reads a bad or missing value as unknown, never "Invalid Date" (0.082667ms)
✔ dates are shown in the locale asked for, with the year (11.990666ms)
▶ the roles a seat may hand out
  ✔ gives Sam (a member with ceiling 10) only Outside member and Guest, highest first (0.650709ms)
  ✔ gives Casey (an outside admin, ceiling 10, no team band) the same two (0.08725ms)
  ✔ gives an owner every active role (0.070375ms)
  ✔ leaves out a role below the ceiling that carries a power the grantor lacks (0.084083ms)
✔ the roles a seat may hand out (1.365542ms)
▶ Home's lists
  ✔ shows an invitation as a row that opens the People tab of its space (0.606625ms)
  ✔ does not invent a date or a role for an invitation that has none (0.079583ms)
  ✔ shows a task with its status, priority and due date, and skips what is missing (0.107292ms)
  ✔ shows a dash, not zero, for a count that could not be read, and says so to a screen reader (0.064625ms)
✔ Home's lists (1.313875ms)
▶ pinRows (B22)
  ✔ names each pin by its space and opens it (0.141667ms)
✔ pinRows (B22) (0.189417ms)
▶ two overlapping reads of the Overview messages
  ✔ leaves the newer read on screen when the older read finishes last (0.567875ms)
  ✔ applies reads that finish in order, each replacing the last (0.075125ms)
  ✔ writes nothing once the person has moved to another space, even for the newest read (0.060375ms)
✔ two overlapping reads of the Overview messages (1.080083ms)
▶ making a new space
  ✔ starts as its type, owned by the person, inheriting as the type says, with no detail fields for a plain type (0.587667ms)
  ✔ offers a subtype's own fields and reports the required ones still empty (0.18775ms)
  ✔ leaves a form section of only the columns the driver hides out of the sections shown, keeps a required column whatever the driver says, and is unchanged when nothing is hidden (0.342333ms)
  ✔ collects what was typed into the subtype fields, and leaves out what has no value so the column default applies (0.099291ms)
  ✔ asks the server to make the space and seat the person, sending the type, the name and the details, and returns the new id (0.11625ms)
  ✔ sends no details for a plain type, and the description when there is one (0.07225ms)
  ✔ returns the server's refusal, which leaves no space and no seat behind (0.085ms)
✔ making a new space (1.904459ms)
▶ a saved space's details
  ✔ are its subtype record and fields when the space has a subtype (0.147042ms)
  ✔ are none for a plain space or one that will not load (0.067334ms)
  ✔ are dirty once a detail field changes, and missing while a required one is empty (0.147958ms)
  ✔ save, or say why not, and are put back on Discard (0.107875ms)
✔ a saved space's details (0.564458ms)
▶ the kinds picked in the New space dialog
  ✔ lets the last pick win when an earlier one finishes after it (0.544667ms)
  ✔ lets the only pick through, and reports its failure (0.105709ms)
  ✔ drops a pick that fails after a later one started: its error is nobody's to show (0.067084ms)
  ✔ drops every pick in flight when the dialog is reset, so a draft from an earlier opening never lands in a later one (0.061791ms)
✔ the kinds picked in the New space dialog (1.176125ms)
▶ the kinds of space the New space dialog offers
  ✔ are the active types, by rank and then name (5.866083ms)
  ✔ carry the description, and fall back to the default icon and no colour (0.11825ms)
  ✔ are none when no type is active (0.054125ms)
✔ the kinds of space the New space dialog offers (6.516042ms)
▶ the kinds that may sit under a parent
  ✔ are those the parent type's Children.AllowedTypeCodes names, in the dialog's order (0.150209ms)
  ✔ are every kind when the parent type names none, has no configuration, or its configuration does not parse (0.086083ms)
✔ the kinds that may sit under a parent (0.320417ms)
▶ opening a library file
  ✔ opens the file in the viewer and records the open once (0.64775ms)
  ✔ still opens when the open could not be recorded, and says it was not (0.080083ms)
  ✔ says so when the screen has no viewer to open the file in, and records nothing (0.067292ms)
  ✔ opens nothing for an item with no file (0.05075ms)
✔ opening a library file (1.347709ms)
▶ the item use an open writes
  ✔ names the item, the space, the person and the time (0.0775ms)
  ✔ is nothing when the person or the space is not known (never an empty user ID) (0.042542ms)
✔ the item use an open writes (0.1875ms)
▶ the Discussion card lines
  ✔ shows what was typed, not the stored mention, and reads oldest first (0.699292ms)
  ✔ draws an outside seat's sender as outside, and staff and the assistant as not (0.093333ms)
  ✔ keeps the last five (0.083792ms)
✔ the Discussion card lines (1.329708ms)
▶ the space tree
  ✔ dims and locks a closed space, and leaves an open one alone (0.547333ms)
✔ the space tree (0.961417ms)
▶ the rail mode follows the page
  ✔ keeps the home rail on Home, Inbox, My tasks and Recent files (0.071459ms)
  ✔ shows the space rail on a space (0.038291ms)
✔ the rail mode follows the page (0.16875ms)
▶ who reaches a space
  ✔ walks up while each space inherits, nearest first (0.76425ms)
  ✔ stops at a sealed space (0.08375ms)
  ✔ lists Discovery through Northwind: Ada, Sam and Casey are reached, Bea and Remy sit on it (0.160208ms)
  ✔ lists Field notes with Ada on it and Bea, Casey and Sam reached through its parents (0.111541ms)
  ✔ lists only the sealed child's own seats, not the branch's or Northwind's (0.108417ms)
  ✔ keeps Sam reaching Field notes through Northwind when the guest seat Sam holds there is Removed or Invited, and carries that seat beside Sam (0.140458ms)
  ✔ lists a person nothing else reaches by their own Removed or Invited seat (0.065584ms)
  ✔ follows a parent the viewer can't read, unnamed, and stops there (0.081333ms)
  ✔ stops at a parent whose status hides it, and keeps one whose status is read-only but visible (0.139375ms)
✔ who reaches a space (2.219834ms)
▶ the section's list of who reaches a space, held against Core's
  ✔ lists the same people under the same seats with no space closed (0.291291ms)
  ✔ lists the same people under the same seats with an archived middle space (hidden) (0.057ms)
  ✔ lists the same people under the same seats with a paused middle space (read-only, visible) (0.057125ms)
  ✔ lists the same people under the same seats with a closed middle space (read-only, visible) (0.067583ms)
  ✔ lists the same people under the same seats with an active middle space with a status row (0.050083ms)
  ✔ lists the same people under the same seats with a closed middle space of a type with no statuses (0.040416ms)
✔ the section's list of who reaches a space, held against Core's (0.677083ms)
▶ the seat actions offered
  ✔ offers Sam (a member who can invite) no Approve or Change role on a type that holds invites for approval, but Remove (0.671458ms)
  ✔ offers Sam Approve and Change role on a type that approves automatically (0.091542ms)
  ✔ offers an owner Approve, Change role and Remove on a guest (0.062584ms)
  ✔ offers nothing on a seat above the viewer's ceiling, or one carrying a power they lack (0.068708ms)
  ✔ hides Remove and Change role on the only active owner seat, whoever is looking, and offers nothing for someone who cannot invite (0.076ms)
✔ the seat actions offered (1.470208ms)
▶ the header seat summary
  ✔ counts only Active seats (0.336625ms)
  ✔ does not let an invited or removed outside seat make the space Shared (0.073709ms)
  ✔ makes the space Shared once an outside seat is Active (0.054875ms)
  ✔ summarizes a space with no seats (0.056625ms)
✔ the header seat summary (1.033125ms)
▶ a load for a selected space
  ✔ may write while its selection is the current one, whatever the ID casing (0.295ms)
  ✔ may not write once a later selection has started (0.043375ms)
  ✔ may not write once the person is in another space, even with the same request number (0.044917ms)
  ✔ may not write when no space is active (0.033792ms)
✔ a load for a selected space (0.795459ms)
▶ guardedLoad
  ✔ leaves the newer space's lists alone when the older space's read lands last (0.354625ms)
  ✔ writes when its selection is still the current one (0.06075ms)
  ✔ does not write when the read fails, and lets the failure through (0.206417ms)
✔ guardedLoad (0.699917ms)
▶ a selection starts clean
  ✔ closes the drawer, clears the item, resets both bands and drops the last save message (0.359541ms)
  ✔ closes the share, upload and new-conversation dialogs, so none stays open over the next space (0.392375ms)
✔ a selection starts clean (1.244917ms)
▶ the loading flag of a selection
  ✔ is raised while a selection loads and lowered when it finishes (0.103584ms)
  ✔ stays raised when an older selection finishes after a newer one began (0.050375ms)
✔ the loading flag of a selection (0.233958ms)
▶ what Settings offers
  ✔ offers nothing to someone with no right (0.593375ms)
  ✔ offers Close, read-only, to an owner who holds the lifecycle authorization but not Configure Spaces (0.06125ms)
  ✔ offers Reopen, read-only, on a closed space to an owner who may only reopen (0.045333ms)
  ✔ offers the form without a close button to an owner who may configure but not close (0.043083ms)
  ✔ offers the form and the button to someone who may do both (0.050458ms)
  ✔ does not offer Close on a closed space, or Reopen on an open one, whatever the rights say (0.049584ms)
✔ what Settings offers (1.32775ms)
▶ a terminal status (stage 1: Closed moves forward only)
  ✔ offers no reopen, whatever the rights say, and says so above the read-only view (0.074584ms)
  ✔ offers nothing to someone with neither right on a terminal space (0.055333ms)
  ✔ still offers the reopen on a closed space whose status is not terminal (0.045417ms)
✔ a terminal status (stage 1: Closed moves forward only) (0.269291ms)
▶ the Settings model
  ✔ shows the space's status by name when the caller knows it, else Active or Closed from ClosedAt (0.347167ms)
  ✔ takes the icon and color from the type when the space has none (0.061375ms)
  ✔ marks a closed space (0.059166ms)
✔ the Settings model (0.886542ms)
▶ what a Settings save writes
  ✔ writes nothing for a screen the person did not change (0.334541ms)
  ✔ writes only the name when only the name changes (0.098209ms)
  ✔ clears a background the person emptied (0.063417ms)
✔ what a Settings save writes (0.586792ms)
▶ the Settings session across two saves
  ✔ writes only the second edit on the second save, after the form is rebuilt from what the first save wrote (1.139541ms)
  ✔ does not count an edit made while a save was running as saved (0.081458ms)
  ✔ starts from the new space when another is selected (0.090209ms)
✔ the Settings session across two saves (1.417625ms)
▶ writing the changes onto a space
  ✔ sets exactly the fields that changed (0.106958ms)
  ✔ can set a field to null (0.060916ms)
✔ writing the changes onto a space (0.225208ms)
▶ who a share reaches
  ✔ says nobody new gains access in Studio, where only staff sit (0.54225ms)
  ✔ lists only the Active outside seats in Discovery, not staff, the invited or the removed (0.111208ms)
  ✔ does not fall back to everyone when the only outside seats are Invited or Removed (0.052167ms)
✔ who a share reaches (1.158959ms)
▶ space-pages
  ✔ maps a SpacePage row and applies a CollabPageModel back to a SpacePage entity (0.474667ms)
  ✔ builds starter pages for all built-in space tabs and merges saved customizations + user pages (0.767208ms)
✔ space-pages (1.69325ms)
▶ the rules from the server's configuration document
  ✔ carries the type's labels, which a participant's browser cannot resolve itself (0.571083ms)
  ✔ gives null for a missing, broken or shapeless document, so the browser keeps its own answer (0.057083ms)
  ✔ tells the same rules from changed ones (0.136625ms)
✔ the rules from the server's configuration document (1.12075ms)
▶ a space's tabs
  ✔ offers the built-in tabs, in order, when the type has every panel (1.0225ms)
  ✔ reports a tab that names no built-in tab and has no component, and keeps building (0.182875ms)
  ✔ shows no Library for a type with LibraryPanel off, even when the driver names it (0.110333ms)
  ✔ mounts a contributed tab, and keeps the built-in id when the board's own 'overview' names the built-in Overview (0.25925ms)
  ✔ drops a tab that names no built-in tab and brings nothing to draw (0.104ms)
  ✔ relabels a tab from Labels.Tabs whatever the key casing (1.666583ms)
  ✔ resolves a deep link to the tab id without regard to case, and by its alias (0.16525ms)
✔ a space's tabs (4.162458ms)
▶ a UI driver that throws
  ✔ still gives the space its built-in tabs, and reports the failure (0.183041ms)
  ✔ gives the driver its tabs when it does not throw (0.098584ms)
  ✔ reads a deep link as the built-in tab it names, in any case, with discussions as Chat, and passes a contributed key through (0.10775ms)
✔ a UI driver that throws (0.500833ms)
▶ the Data tab (B19)
  ✔ is offered only when the space offers data, between Library and Work (0.141792ms)
  ✔ a driver naming Data cannot switch it on for a space with nothing to show (0.064917ms)
  ✔ reads with the type's label (0.05725ms)
✔ the Data tab (B19) (0.327875ms)
▶ creating a space type's UI driver
  ✔ returns the driver that was created, and reports nothing (0.587291ms)
  ✔ falls back to the default driver, and reports the error, when the type's driver's constructor throws (0.08975ms)
✔ creating a space type's UI driver (1.131791ms)
▶ The notes a viewer is shown
  ✔ keeps a space note and the viewer's own private note, and drops another person's private note (0.497709ms)
  ✔ compares the author without regard to case, as MJ ids come back either way (0.059708ms)
  ✔ shows a viewer with no id only the space notes (0.042416ms)
✔ The notes a viewer is shown (0.975083ms)
ℹ tests 158
ℹ suites 45
ℹ pass 158
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 210.288792

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular

 ✓ src/lib/space-details-view.render.test.ts (5 tests) 34ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  02:06:12
   Duration  5.01s (transform 3.29s, setup 0ms, import 4.81s, tests 34ms, environment 115ms)
```

#### 8. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets --filter @mj-biz-apps/collaboration-ng build`

```text
Scope: 2 of 15 workspace projects
packages/AngularWidgets build$ ngc
packages/AngularWidgets build: src/lib/space-chat.component.ts:70:59 - warning NG8113: MJButtonDirective is not used within the template of CollabSpaceChatComponent
packages/AngularWidgets build: 70   imports: [CollabBandChipComponent, ConversationsModule, MJButtonDirective, MJClickableDirective],
packages/AngularWidgets build:                                                              ~~~~~~~~~~~~~~~~~
packages/AngularWidgets build: src/lib/space-settings.component.ts:13:77 - warning NG8113: MJDropdownComponent is not used within the template of CollabSpaceSettingsComponent
packages/AngularWidgets build: 13   imports: [CommonModule, FormsModule, MJAlertComponent, MJButtonDirective, MJDropdownComponent, SharedGenericModule],
packages/AngularWidgets build:                                                                                ~~~~~~~~~~~~~~~~~~~
packages/AngularWidgets build: Done in 2.7s
packages/Angular build$ ngc
packages/Angular build: src/lib/collaboration-section.component.ts:1445:116 - warning NG8107: The left side of this optional chain operation does not include 'null' or 'undefined' in its type, therefore the '?.' operator can be replaced with the '.' operator.
packages/Angular build: 1445                                                                         <span class="config-meta">{{ reach.Fields?.length ? reach.Fields.length + ' field' + (reach.Fields.length === 1 ? '' : 's') : 'every field' }}</span>
packages/Angular build:                                                                                                                         ~~~~~~
packages/Angular build: Done in 2.7s
```

### Screenshots (`plans/space-focused-ux/shots/step-m/` and `plans/space-focused-ux/shots/round-2b/`, 1440×900, light and dark)

- `plans/space-focused-ux/shots/step-m/chat-mention-light.png`
- `plans/space-focused-ux/shots/step-m/chat-thread-reply-light.png`
- `plans/space-focused-ux/shots/step-m/chat-unmentioned-followup-light.png`
- `plans/space-focused-ux/shots/round-2b/home-light.png`
- `plans/space-focused-ux/shots/round-2b/home-dark.png`
- `plans/space-focused-ux/shots/round-2b/discovery-overview-light.png`
- `plans/space-focused-ux/shots/round-2b/discovery-overview-dark.png`
- `plans/space-focused-ux/shots/round-2b/field-notes-light.png`
- `plans/space-focused-ux/shots/round-2b/field-notes-dark.png`
- `plans/space-focused-ux/shots/round-2b/library-light.png`
- `plans/space-focused-ux/shots/round-2b/library-dark.png`
- `plans/space-focused-ux/shots/round-2b/work-light.png`
- `plans/space-focused-ux/shots/round-2b/work-dark.png`
- `plans/space-focused-ux/shots/round-2b/chat-thread-open-light.png`
- `plans/space-focused-ux/shots/round-2b/chat-thread-open-dark.png`
- `plans/space-focused-ux/shots/round-2b/page-edit-mode-light.png`
- `plans/space-focused-ux/shots/round-2b/page-edit-mode-dark.png`
- `plans/space-focused-ux/shots/round-2b/rail-collapsed-light.png`
- `plans/space-focused-ux/shots/round-2b/rail-collapsed-dark.png`

---

## Round 3

### 1. Round 2b Review Fixes (`B-1` to `B-3` and `S-1` to `S-5`, committed in `b7b4bf8`)

- **B-1 — Replace hand-made metadata IDs with random UUIDs (`uuidgen | tr '[:lower:]' '[:upper:]'`) and push via `mj sync push`:**
  - Replaced `A1B2C3D4-0001-4000-8000-000000000101` (`Collaboration: Visible Pages`) with `00946333-EA10-4A0E-83D5-86C8AA224AF4` in `metadata/row-level-security-filters/.row-level-security-filters.json`.
  - Replaced `A1B2C3D4-0001-4000-8000-000000000102` (`Collaboration: Pages The Caller May Change`) with `658D79AC-98A5-429D-A5A0-9C1CC69D179C` in `metadata/row-level-security-filters/.row-level-security-filters.json`.
  - Replaced `B1C2D3E4-0001-4000-8000-000000000201` (`Space Participant` permission on `Space Pages`) with `84212A99-6F2C-4DF0-97A9-62BE7B5256CE` in `metadata/entity-permissions/.entity-permissions.json`.
  - Removed the 3 old rows from the database and ran `pnpm exec mj sync push --dir=metadata` (2 files processed, 0 errors).
- **B-2 — Keep an agent's top-level answer in the main flow (`CollapseThreadReplies`):**
  - Updated `ConversationChatAreaComponent.DisplayMessages` in `MJ/packages/Angular/Generic/conversations/src/lib/components/conversation/conversation-chat-area.component.ts` (committed on `collab/e2e-combined` as `2af5683c74`) and `CollabSpaceChatComponent.getParentMessage` / `getRepliesFor` in `packages/AngularWidgets/src/lib/space-chat.component.ts` so an AI answer (`Role = 'AI'` / `AgentID != null`) whose parent is a top-level message (`ParentID == null`) stays in the main conversation flow, while a person's reply to any message or an agent's reply to a thread reply is collapsed into the thread.
  - Added unit test `'keeps an agent reply to a top-level message in the main flow, and collapses an agent reply to a thread reply'` in `MJ/packages/Angular/Generic/conversations/src/__tests__/collapse-thread-replies.test.ts` (4/4 passing) and updated `packages/AngularWidgets/src/lib/widgets.test.ts`.
  - Retook `plans/space-focused-ux/shots/step-m/chat-mention-light.png`, `chat-thread-reply-light.png`, and `chat-unmentioned-followup-light.png`.
- **B-3 — Default `SpacePage.Band` to `'Team'` (fail-closed):**
  - Changed `DF_SpacePage_Band` to `DEFAULT (N'Team')`, `spCreateSpacePage` `ISNULL(@Band, 'Team')`, and the `Band` `EntityField.DefaultValue` to `'Team'` in `migrations/V202610300100__v0.1.x__Space_Pages.sql`.
  - Updated `SpacePageEntityServer.stampDefaults()` in `packages/CoreEntitiesServer/src/SpacePageEntityServer.ts` to `if (!this.Band) this.Band = 'Team';`.
- **S-1 — Drop `CK_SpacePage_BuiltInTab` and `EntityFieldValue` rows for `BuiltInTab` so contributed `BaseSpaceTab` keys can be customized:**
  - Removed `CONSTRAINT [CK_SpacePage_BuiltInTab]` and the 6 `EntityFieldValue` inserts for `BuiltInTab` from `migrations/V202610300100__v0.1.x__Space_Pages.sql`.
  - Exact commands run to re-apply the migration and regenerate codegen artifacts:
    ```bash
    # 1. Reset V202610300100__v0.1.x__Space_Pages.sql objects + Flyway history row, then run mj migrate:
    set -a && source ../MJ/.env && set +a
    pnpm exec mj migrate --schema __mj_BizAppsCollaboration

    # 2. Run MJ codegen (--skipdb) to regenerate entity subclass, GraphQL schema, and Angular form from updated EntityFieldValue metadata:
    node /tmp/run-collab-codegen.mjs
    ```
  - Regenerated files:
    - `packages/Entities/src/generated/entities/__mj_BizAppsCollaboration.ts` (`BuiltInTab` getter/setter type changed from union to `string | null`)
    - `packages/Server/src/generated/graphql-schemas/__mj_BizAppsCollaboration.ts`
    - `packages/Angular/src/lib/generated/Entities/mjBizAppsCollaborationSpacePage/mjbizappscollaborationspacepage.form.component.html`
  - Changed `export type BuiltInTabName = string;` in `packages/Angular/src/lib/logic/space-pages.ts` and added unit test `'preserves contributed tab keys (e.g. BaseSpaceTab keys) on entity.BuiltInTab'` in `packages/Angular/src/lib/logic/space-pages.test.ts`.
- **S-2 — Deduplicate `SpacePageEntityServer` write permission checks:**
  - Extracted `private async checkEditPermission(action: 'save' | 'delete', result: ValidationResult): Promise<boolean>` in `packages/CoreEntitiesServer/src/SpacePageEntityServer.ts` and called it from both `ValidateAsync` and `Delete`.
- **S-3 — Memoize getter inputs for `SpacePagesComponent` and `CollaborationSectionComponent`:**
  - Memoized `spacePages` in `packages/Angular/src/lib/collaboration-section.component.ts` and memoized `registeredBlocks`, `resolvedBlockContext`, and `registeredBlockInputs` in `packages/AngularWidgets/src/lib/space-pages.component.ts`.
- **S-4 — Add `Space Pages` to the `row-filters` integration suite (`RF5`):**
  - Added `row-filters.RF5` in `packages/IntegrationTests/src/checks/row-filters.checks.ts`, `packages/IntegrationTests/src/checks/client/row-filters.client.checks.ts`, and `packages/IntegrationTests/src/expected-bundles.ts` (`node test-harnesses/integration.mjs row-filters`: 5 passed / 0 failed).
- **S-5 — Clarify shared draft visibility in schema docs and page edit bar:**
  - Updated `DraftBlocks` and `DraftTitle` column descriptions in `migrations/V202610300100__v0.1.x__Space_Pages.sql` and added `<span class="sp-edit-hint" data-testid="page-edit-hint">Drafts are visible to everyone who can see this page.</span>` to `packages/AngularWidgets/src/lib/space-pages.component.ts`.

---

### 2. Route Check Findings & Fix (`ui-polish-review.md`)

- **What happened on Turn 3 (`"And what about the data grants in this space?"`) in `smoke-step-m-chat.mjs`:**
  1. In Northwind (`AgentReplyMode = 'MentionOnly'`, `EnableDecisionRouting = true`), Turn 3 had no `@mention` and `ParentID = null` (top-level message).
  2. `MessageInputComponent.resolveAgentTurnTarget` invoked `decideAgentRouting`, which ran the `Default Decision` prompt (`8D3B91E7-D840-4B1B-B7F0-EDB0C77BE6CB`). In the local environment, that prompt timed out at its configured `TimeoutMS (350ms)` (`Prompt "Default Decision" exceeded its configured TimeoutMS (350ms)`), so `decideAgentRouting` returned `{ route: 'NoAgent' }` and `resolveAgentTurnTarget` returned `null`. Consequently, **no** `ExecuteSpaceChatTurn` call was made to the server on Turn 3.
  3. The `@Mention` badge visible in the earlier `shots/step-m/chat-unmentioned-followup-light.png` was stale state left over from Turn 1 due to three bugs in `CollabSpaceChatComponent`:
     - `BeforeAgentTurn` read `args?.Turn?.Route ?? 'Mention'`, whereas `BeforeAgentTurnEventArgs` in `@memberjunction/ng-conversations` defines `Route` and `AgentName` at top level (`args.Route`, `args.AgentName`), causing every turn to fall back to `'Mention'`.
     - `MessageInputComponent.runHostAgentTurn` only emits `AfterAgentTurn` when `result.Result` is truthy (`spaceTurnResult` omits `Result`), while `syncLiveProgressFromChatArea` guarded completion with `&& !this.activeAgentRoute` and `onAgentTurnCompleted()` never cleared `activeAgentRoute`.
     - `MessageInputComponent.MessageSent` also emits settled `AI` reply rows (`Role = 'AI'`), which previously triggered `onUserMessageSent` after Turn 1 / Turn 2 completed.
- **How it was fixed in `CollabSpaceChatComponent` (`packages/AngularWidgets/src/lib/space-chat.component.ts`):**
  - `BeforeAgentTurn` listener now reads `args?.Route ?? args?.Turn?.Route ?? 'Mention'` and `args?.AgentName ?? args?.Turn?.AgentName ?? this.DefaultAgentName`.
  - Wrapped `AgentTurnHandler` in `effectiveAgentTurnHandler` so `onAgentTurnStarted({ agentName: request.AgentName, route: request.Route })` runs at turn start and `onAgentTurnCompleted()` always runs in `finally`.
  - `onAgentTurnCompleted()` and `syncLiveProgressFromChatArea()` now clear `isRoutingCheck`, `isAgentWorking`, `activeAgentName`, `activeAgentRoute`, `activeAgentStatusText`, `activeAgentElapsed`, and `activeAgentProgressPercent`.
  - `onUserMessageSent` ignores `AI` rows (`if (this.isAiMessage(message)) return;`) and suppresses `pendingAgentPrompt` when replying to an AI message (`ThreadReply`).

---

### 3. Round 3 Chat Changes (`ui-polish.md` §5 + `ui-polish-review.md` "Add to round 3")

- **`packages/AngularWidgets/src/lib/space-chat.component.ts` (`CollabSpaceChatComponent`):**
  - **Avatars in threads (`<mjc-avatar>`):** Replaced custom `.thread-mini-avatar` and `.thread-reply-avatar` divs in `mjChatSlot="messageExtra"` (and `.chat-participant-avatar` in the participants popover) with `<mjc-avatar>` (`CollabAvatarComponent`) bound to `[SpaceMembers]="spaceMembers"`, preserving the outside ring (`[IsOutside]="true"`, `.av.ext`) on outside participants (`member.band === 'Shared'`).
  - **No `userAvatarMap` reads:** Deleted `getUserAvatarEntry` and removed all reads of `chatArea.userAvatarMap` / `UserAvatarMap` (`0` occurrences in `space-chat.component.ts`).
  - **Thread reply affordances:** Kept one `"Reply"` action per collapsed message (`!isThreadExpanded(message.ID)`), the thread bar with reply count and last reply (`data-testid="message-thread-replies"`), and a single reply box (`data-testid="thread-reply-box"` with input + `Reply` button) at the bottom of an open thread. Removed the duplicate `"Reply in thread"` button above the open thread and the per-reply `"Reply"` buttons inside the thread.
  - **Who's speaking:** Removed the `"Participant"` pill from human thread replies. Only the outside ring on `<mjc-avatar>` and the `"Assistant"` mark (`data-testid="thread-reply-assistant-mark"`) on AI replies are shown.
  - **Live Assistant indicator in `mjChatSlot="agentPresence"`:** Moved the live progress indicator out of `mjChatSlot="header"` into `<ng-template mjChatSlot="agentPresence">` and bound `[ShowAgentCharacter]="isRoutingCheck || isAgentWorking"` on `<mj-conversation-chat-area>`.
  - **Plain-word copy:** Replaced `"Evaluating addressee routing…"` and `"Checking speaker attribution & thread context…"` with `"Deciding whether the Assistant should answer…"` while routing and `"<AgentName> is answering · 0:12"` while working.
  - **Typed `AgentTurnRoute` & exhaustive `formatRouteBadge`:** Imported `AgentTurnRoute` from `@memberjunction/ng-conversations`, typed `activeAgentRoute: AgentTurnRoute | '' = ''`, and implemented an exhaustive `switch` in `formatRouteBadge(route)` returning `'Replying in the thread'` (`ThreadReply`), `'Following up'` (`DecisionRouted` | `Continuity`), `` `Handed to ${agent}` `` (`Redirect`), and `''` (`Mention`, `ConversationDefault`, `HostDefault`, `ConversationManager`, `''`) with no emoji.
  - **Zero hex fallbacks:** Replaced all `var(--mj-..., #hex)` fallbacks in `packages/AngularWidgets/src/lib/space-chat.component.ts` and `packages/AngularWidgets/src/lib/avatar.component.ts` with MJ (`--mj-*`) and Collaboration (`--mjc-*`) tokens.
- **`packages/Angular/src/lib/collaboration-section.component.ts` (`CollaborationSectionComponent`):**
  - Bound `[SpaceMembers]="spaceMembers"` on `<mjc-space-chat>`.
- **`packages/AngularWidgets/src/lib/render.test.ts` & `packages/AngularWidgets/src/lib/widgets.test.ts`:**
  - Updated `ChatAreaStub` to project `agentPresence` (guarded by `ShowAgentCharacter`) and `messageExtra` (over `DisplayMessages`), updated the live indicator test, and added unit tests for exhaustive `formatRouteBadge` and thread rendering (`<mjc-avatar>` outside ring, `Assistant` mark without `Participant` tag, one `Reply` action when collapsed, and one reply box when open).

---

### 4. Gate Outputs (Real Verbatim Output)

#### 1. `node scripts/check-mj-tokens.mjs` & `node scripts/check-mj-inputs.mjs` & Grep Checks

```text
$ node scripts/check-mj-tokens.mjs
mj tokens ok (119 used, 296 defined; 16 mjc used, 16 defined)

$ node scripts/check-mj-inputs.mjs
mj inputs ok (none of the 14 deprecated names of mjButton and mj-loading is bound)

$ grep -c 'var(--[^)]*#[0-9a-fA-F]' packages/AngularWidgets/src/lib/space-chat.component.ts packages/AngularWidgets/src/lib/avatar.component.ts || true
packages/AngularWidgets/src/lib/space-chat.component.ts:0
packages/AngularWidgets/src/lib/avatar.component.ts:0

$ grep -c -i 'userAvatarMap' packages/AngularWidgets/src/lib/space-chat.component.ts || true
0
```

#### 2. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets test`

```text
> @mj-biz-apps/collaboration-ng-widgets@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets
> vitest run

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets

 ✓ src/lib/ui-driver.test.ts (10 tests) 6ms
 ✓ src/lib/widgets.test.ts (123 tests) 15ms
 ✓ src/lib/render.test.ts (57 tests) 681ms

 Test Files  3 passed (3)
      Tests  190 passed (190)
   Start at  11:40:18
   Duration  11.07s (transform 16.06s, setup 0ms, import 21.99s, tests 702ms, environment 203ms)
```

#### 3. `pnpm --filter @mj-biz-apps/collaboration-ng test`

```text
> @mj-biz-apps/collaboration-ng@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular
> tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/lib/logic/*.test.ts' && vitest run

▶ space-pages
  ✔ maps a SpacePage row and applies a CollabPageModel back to a SpacePage entity (0.750209ms)
  ✔ builds starter pages for all built-in space tabs and merges saved customizations + user pages (1.011916ms)
  ✔ preserves contributed tab keys (e.g. BaseSpaceTab keys) on entity.BuiltInTab (0.308417ms)
✔ space-pages (2.752458ms)
...
ℹ tests 159
ℹ suites 45
ℹ pass 159
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 260.444792

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular

 ✓ src/lib/space-details-view.render.test.ts (5 tests) 43ms
   ✓ a space's details, rendered (5)
     ✓ mounts MemberJunction's form host on the subtype's record with only the subtype's sections, and no toolbar, related entities or links 17ms
     ✓ hands the form host the same config until the sections change, not a new one on every pass 5ms
     ✓ draws a field for each column when there is no form, bound to the record, read-only on the About card 10ms
     ✓ mounts the type's own component with the record and the edit mode 5ms
     ✓ says a change happened from what was typed (input, change, focus leaving) and from a field's own change event 4ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  11:40:34
   Duration  5.97s (transform 3.86s, setup 0ms, import 5.64s, tests 43ms, environment 220ms)
```

#### 4. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets build` & `pnpm --filter @mj-biz-apps/collaboration-ng build` & `ngc --noEmit`

```text
> @mj-biz-apps/collaboration-ng-widgets@0.1.0 build /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets
> ngc

src/lib/space-settings.component.ts:13:77 - warning NG8113: MJDropdownComponent is not used within the template of CollabSpaceSettingsComponent

13   imports: [CommonModule, FormsModule, MJAlertComponent, MJButtonDirective, MJDropdownComponent, SharedGenericModule],
                                                                               ~~~~~~~~~~~~~~~~~~~


> @mj-biz-apps/collaboration-ng@0.1.0 build /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular
> ngc

src/lib/collaboration-section.component.ts:1446:116 - warning NG8107: The left side of this optional chain operation does not include 'null' or 'undefined' in its type, therefore the '?.' operator can be replaced with the '.' operator.

1446                                                                         <span class="config-meta">{{ reach.Fields?.length ? reach.Fields.length + ' field' + (reach.Fields.length === 1 ? '' : 's') : 'every field' }}</span>
                                                                                                                        ~~~~~~
```

#### 5. Server Entities & Integration Gate (`stage1-servers.test.ts` and `row-filters`)

```text
$ pnpm --filter @mj-biz-apps/collaboration-server-entities test
ℹ tests 33
ℹ suites 7
ℹ pass 33
ℹ fail 0
ℹ duration_ms 216.126875

$ node test-harnesses/integration.mjs row-filters
row-filters (5 passed / 0 failed):
  PASS row-filters.RF1: Ada in Northwind: 3 spaces (Northwind + Discovery + Delivery), 5 members, 4 items (Shared + Team), 2 tasks (Shared + Team) (74ms)
  PASS row-filters.RF2: Casey in Northwind: 2 spaces (Northwind + Discovery; Delivery hidden), 5 members, 2 Shared items, 1 Shared task (61ms)
  PASS row-filters.RF3: Guy (guest in Northwind): 1 space (Northwind only; no inherited seat on children), 1 Shared item, 1 Shared task (53ms)
  PASS row-filters.RF4: Nina (non-member): 0 spaces, 0 members, 0 items, 0 tasks (48ms)
  PASS row-filters.RF5: Space Pages RLS: Ada sees Shared + Team pages (2); Casey and Guy see only Shared page (1); Nina sees 0 pages (88ms)
Integration: 5 passed, 0 failed
```

### 5. Screenshots (`plans/space-focused-ux/shots/round-3/` and `plans/space-focused-ux/shots/step-m/`, 1440×900, light and dark)

- `plans/space-focused-ux/shots/round-3/home-light.png`
- `plans/space-focused-ux/shots/round-3/home-dark.png`
- `plans/space-focused-ux/shots/round-3/discovery-overview-light.png`
- `plans/space-focused-ux/shots/round-3/discovery-overview-dark.png`
- `plans/space-focused-ux/shots/round-3/field-notes-light.png`
- `plans/space-focused-ux/shots/round-3/field-notes-dark.png`
- `plans/space-focused-ux/shots/round-3/library-light.png`
- `plans/space-focused-ux/shots/round-3/library-dark.png`
- `plans/space-focused-ux/shots/round-3/work-light.png`
- `plans/space-focused-ux/shots/round-3/work-dark.png`
- `plans/space-focused-ux/shots/round-3/chat-thread-open-light.png`
- `plans/space-focused-ux/shots/round-3/chat-thread-open-dark.png`
- `plans/space-focused-ux/shots/round-3/page-edit-mode-light.png`
- `plans/space-focused-ux/shots/round-3/page-edit-mode-dark.png`
- `plans/space-focused-ux/shots/round-3/rail-collapsed-light.png`
- `plans/space-focused-ux/shots/round-3/rail-collapsed-dark.png`
- `plans/space-focused-ux/shots/step-m/chat-mention-light.png`
- `plans/space-focused-ux/shots/step-m/chat-thread-reply-light.png`
- `plans/space-focused-ux/shots/step-m/chat-unmentioned-followup-light.png`

---

## Round 4

### 1. Round 3 Review Fixes (`R3-1` to `R3-4`, committed in `4827c06`)

1. **`R3-1` — Thread avatar map reach-in removed (`packages/AngularWidgets/src/lib/space-chat.component.ts`):**
   - Removed the private reach-in cast `(this.chatArea as { userAvatarMap?: ... })` from `conversationParticipantsList` and `getSpeakerAvatarUrl` (`grep -c -i 'userAvatarMap' packages/AngularWidgets/src/lib/space-chat.component.ts` returns `0`).
   - `conversationParticipantsList`, `getThreadParticipants`, and `getSpeakerAvatarUrl` now resolve member photos (`avatarUrl`), `iconClass`, `colorClass`, and `isOutside` directly from `this.SpaceMembers` via `getMemberForUser(userId, name)` (which `collaboration-section.component.ts` populates from `MJ: Users` `UserImageURL` and `UserImageIconClass` in `loadSpaceMembers`).
   - Added a render test in `packages/AngularWidgets/src/lib/render.test.ts` verifying that a `SpaceMembers` entry with `avatarUrl: 'https://example.com/colin-photo.jpg'` renders `<img class="av-img">` inside `<mjc-avatar>` in both the collapsed thread bar and the expanded thread drawer, and confirmed in `plans/space-focused-ux/shots/round-4/chat-thread-open-light.png` that Colin Brockman's photo renders in the parent message, the thread bar, the thread drawer, and the space header audience pill.
2. **`R3-2` — `activeAgentRoute` cleared at turn end (`packages/AngularWidgets/src/lib/space-chat.component.ts`):**
   - `onAgentTurnCompleted()` and `clearAgentTurnSafetyTimer()` now reset `this.activeAgentRoute = null` alongside `this.isAgentWorking = false`, preventing a previous turn's route badge from sticking into a subsequent turn.
   - Asserted `expect(fixture.componentInstance.activeAgentRoute).toBeNull()` after `AfterAgentTurn.emit(...)` in `packages/AngularWidgets/src/lib/render.test.ts`.
3. **`R3-3` — People popover uses `mj-menu` (`packages/AngularWidgets/src/lib/space-chat.component.ts`):**
   - Replaced the hand-rolled `isParticipantsPopoverOpen` state, `@HostListener('document:keydown.escape')`, and `@HostListener('document:mousedown')` with `[mjMenuTriggerFor]="participantsMenu"` on the header's people trigger button and `<mj-menu #participantsMenu>` containing `<div class="participants-menu-header">People in this conversation</div>` and `<mj-menu-item>` rows for each participant.
   - Removed `HostListener` from `@angular/core` imports in `packages/AngularWidgets/src/lib/space-chat.component.ts`.
4. **`R3-4` — Accuracy of `plans/space-focused-ux/ui-polish-notes.md`:**
   - Fixed the 5 drifted file/identifier citations in earlier notes (`packages/MJCoreEntitiesServer/src/custom/MJConversationDetailEntityServer.server.ts`, `packages/Angular/Generic/conversations/src/lib/components/message/message-item.component.ts`, `packages/Angular/Generic/conversations/src/lib/components/message/message-input.component.ts`, `mapSpacePageRowToModel` / `applyCollabPageToEntity` / `buildStarterPagesForSpace` / `mergeSpacePagesWithDefaults` in `packages/Angular/src/lib/logic/space-pages.ts`, and `getMemberForUser` in `packages/AngularWidgets/src/lib/space-chat.component.ts`).

---

### 2. Round 4 — Home (`docs/ux/README.md` Frame 01)

- **Removed the welcome hero and four Title Case stat tiles (`packages/Angular/src/lib/collaboration-section.component.ts`):**
  - Removed the `Collaboration Spaces` hero banner and the 4-tile `stats-grid` (`Active Spaces`, `Shared Files`, `Open Tasks`, `Awaiting Approval`) from Home.
  - Bound `[InboxCount]="homeAwaitingApproval"`, `[TaskCount]="railMode === 'home' ? homeOpenTasks : taskCount"`, and `[LibraryCount]="railMode === 'home' ? homeSharedFiles : libraryTotalCount"` on `<mjc-space-rail>`, and added the `LibraryCount` badge to the `Recent files` row in `Mode === 'home'` in `packages/AngularWidgets/src/lib/space-rail.component.ts`.
- **Three sections on Home (`packages/Angular/src/lib/collaboration-section.component.ts`, `packages/Angular/src/lib/logic/home-lists.ts`, `packages/AngularWidgets/src/lib/home-list.component.ts`):**
  1. **Needs you** (`[data-testid="home-needs-you"]`):
     - Heading with inline count badge (`homeCountValue('approvals')`).
     - Renders `<mjc-needs-you-card>` rows mapped by `needsYouCards(invitations, formatDate)` in `packages/Angular/src/lib/logic/home-lists.ts`, with space name and invitation date in the subtitle and `Review on People` as the action button.
     - When empty, renders a single quiet line (`<p class="home-quiet-line" data-testid="home-needs-you-empty" role="status">Nothing needs your attention right now.</p>`) instead of a dashed empty card.
  2. **Coming up** and **Pinned** (`packages/AngularWidgets/src/lib/home-list.component.ts`):
     - Added `@Input() Badge = ''`, `@Input() BadgeLabel = ''`, and `@Input() ShowClose = true` to `CollabHomeListComponent` (`<mjc-home-list>`), and tightened `.hl-rows` `max-height` to `220px`.
     - Mounted `<mjc-home-list Id="coming-up" Title="Coming up" [Badge]="homeCountValue('tasks')" [ShowClose]="false" ...>` inline on Home, and `<mjc-home-list Id="pins" Title="Pinned" ... [ShowClose]="false">` beside it in `.home-split-grid` when pins exist.
     - Separated `homePinsLoadToken`, `isLoadingHomePins`, and `homePinsError` from `homeListLoadToken` so `loadHomeLists()` and `loadHomePins()` run concurrently during `loadRealData()` without cancelling each other.
  3. **Your recent spaces** (`[data-testid="home-recent-spaces"]`):
     - Replaced the 3-column card grid and its `"Open Space →"` link with clickable `.recent-space-row` buttons (`[data-testid="recent-space-row"]`) where the row itself opens the space.
     - Each row displays `<mjc-type-tile>`, the space name + type/parent/description subtitle, staff avatars (`<mjc-avatar-stack>`) followed by outside participant avatars with teal rings (`isOutside: true` from `summarizeSeats` in `loadHomeSpaceAvatars()`), and at most one `.signal-pill` badge computed by `spaceSignal(...)` in `packages/Angular/src/lib/logic/home-lists.ts` (`Closed`, invite waiting, open tasks, or `Sealed`).

---

### 3. Files Touched

- `packages/AngularWidgets/src/lib/space-chat.component.ts` (in `4827c06`)
- `packages/AngularWidgets/src/lib/home-list.component.ts`
- `packages/AngularWidgets/src/lib/space-rail.component.ts`
- `packages/AngularWidgets/src/lib/render.test.ts`
- `packages/Angular/src/lib/logic/home-lists.ts`
- `packages/Angular/src/lib/logic/home-lists.test.ts`
- `packages/Angular/src/lib/collaboration-section.component.ts`
- `plans/space-focused-ux/ui-polish-notes.md`
- `plans/space-focused-ux/shots/round-4/*.png`

---

### 4. Test Changes and Rationale

1. **`packages/Angular/src/lib/logic/home-lists.test.ts`:**
   - Added unit tests for `needsYouCards` (mapping `HomeInvitationGraphQL` rows to `HomeNeedsYouCardModel` with space name + formatted date in `subtitle`) and `spaceSignal` (picking one signal per space row in priority order: `Closed` > `invite waiting` > `open tasks` > `Sealed` > `null`).
2. **`packages/AngularWidgets/src/lib/render.test.ts`:**
   - Added render tests for `CollabHomeListComponent` (`Badge`, `BadgeLabel`, and `ShowClose = false`) and `CollabSpaceRailComponent` in `Mode="home"` (`InboxCount`, `TaskCount`, and `LibraryCount` badges on `Inbox`, `My tasks`, and `Recent files`).
   - Added render test for `CollabSpaceChatComponent` verifying that `SpaceMembers` `avatarUrl` renders `<img class="av-img">` in the thread bar and thread drawer, `activeAgentRoute` resets to `null` on `AfterAgentTurn`, and the people trigger opens `<mj-menu>`.

---

### 5. Gate Outputs (Real Verbatim Output)

#### 1. `node scripts/check-mj-tokens.mjs`, `node scripts/check-mj-inputs.mjs`, `node scripts/check-registered-exports.mjs`, & Grep Checks

```text
$ node scripts/check-mj-tokens.mjs
mj tokens ok (118 used, 296 defined; 16 mjc used, 16 defined)

$ node scripts/check-mj-inputs.mjs
mj inputs ok (none of the 14 deprecated names of mjButton and mj-loading is bound)

$ node scripts/check-registered-exports.mjs
registered exports ok (8 published packages and 3 example packages: every @RegisterClass class is exported from its entry)

$ grep -c 'var(--[^)]*#[0-9a-fA-F]' packages/AngularWidgets/src/lib/space-chat.component.ts packages/AngularWidgets/src/lib/avatar.component.ts packages/AngularWidgets/src/lib/home-list.component.ts packages/AngularWidgets/src/lib/space-rail.component.ts packages/Angular/src/lib/collaboration-section.component.ts packages/Angular/src/lib/logic/home-lists.ts || true
packages/AngularWidgets/src/lib/space-chat.component.ts:0
packages/AngularWidgets/src/lib/avatar.component.ts:0
packages/AngularWidgets/src/lib/home-list.component.ts:0
packages/AngularWidgets/src/lib/space-rail.component.ts:0
packages/Angular/src/lib/collaboration-section.component.ts:0
packages/Angular/src/lib/logic/home-lists.ts:0

$ grep -c -i 'userAvatarMap' packages/AngularWidgets/src/lib/space-chat.component.ts || true
0
```

#### 2. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets test`

```text
> @mj-biz-apps/collaboration-ng-widgets@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets
> vitest run

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets

 ✓ src/lib/ui-driver.test.ts (10 tests) 6ms
 ✓ src/lib/widgets.test.ts (123 tests) 16ms
 ✓ src/lib/render.test.ts (59 tests) 757ms

 Test Files  3 passed (3)
      Tests  192 passed (192)
   Start at  11:48:03
   Duration  12.37s (transform 18.01s, setup 0ms, import 24.56s, tests 779ms, environment 264ms)
```

#### 3. `pnpm --filter @mj-biz-apps/collaboration-ng test`

```text
> @mj-biz-apps/collaboration-ng@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular
> tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/lib/logic/*.test.ts' && vitest run

▶ Home's lists
  ✔ shows an invitation as a row that opens the People tab of its space (0.649667ms)
  ✔ does not invent a date or a role for an invitation that has none (0.085208ms)
  ✔ shows a task with its status, priority and due date, and skips what is missing (0.108125ms)
  ✔ shows a dash, not zero, for a count that could not be read, and says so to a screen reader (0.066917ms)
  ✔ maps invitations to NeedsYou cards with space and date in the subtitle (0.086708ms)
  ✔ picks one signal per space row in priority order (0.09975ms)
✔ Home's lists (1.592375ms)
...
ℹ tests 161
ℹ suites 45
ℹ pass 161
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 238.598042

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular

 ✓ src/lib/space-details-view.render.test.ts (5 tests) 59ms
   ✓ a space's details, rendered (5)
     ✓ mounts MemberJunction's form host on the subtype's record with only the subtype's sections, and no toolbar, related entities or links 22ms
     ✓ hands the form host the same config until the sections change, not a new one on every pass 8ms
     ✓ draws a field for each column when there is no form, bound to the record, read-only on the About card 13ms
     ✓ mounts the type's own component with the record and the edit mode 8ms
     ✓ says a change happened from what was typed (input, change, focus leaving) and from a field's own change event 6ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  11:48:18
   Duration  6.12s (transform 3.99s, setup 0ms, import 5.82s, tests 59ms, environment 160ms)
```

#### 4. `ngc -p tsconfig.json --noEmit` (`@mj-biz-apps/collaboration-ng-widgets` & `@mj-biz-apps/collaboration-ng`)

```text
$ pnpm --filter @mj-biz-apps/collaboration-ng-widgets exec ngc -p tsconfig.json --noEmit
src/lib/space-settings.component.ts:13:77 - warning NG8113: MJDropdownComponent is not used within the template of CollabSpaceSettingsComponent

13   imports: [CommonModule, FormsModule, MJAlertComponent, MJButtonDirective, MJDropdownComponent, SharedGenericModule],
                                                                               ~~~~~~~~~~~~~~~~~~~

$ pnpm --filter @mj-biz-apps/collaboration-ng exec ngc -p tsconfig.json --noEmit
src/lib/collaboration-section.component.ts:1569:116 - warning NG8107: The left side of this optional chain operation does not include 'null' or 'undefined' in its type, therefore the '?.' operator can be replaced with the '.' operator.

1569                                                                         <span class="config-meta">{{ reach.Fields?.length ? reach.Fields.length + ' field' + (reach.Fields.length === 1 ? '' : 's') : 'every field' }}</span>
                                                                                                                        ~~~~~~
```

#### 5. Integration Gate (`node test-harnesses/integration.mjs row-filters`)

```text
$ node test-harnesses/integration.mjs row-filters
  Collaboration integration SERVER (SQLServerDataProvider → localhost:1436/MJ_6_2_0_CLEAN_4789)

  ok   row-filters.RF1              5ms  RF1 — Bea (Client on Discovery) sees Discovery and Field notes, but nothing from Harbor
  ok   row-filters.RF2              7ms  RF2 — Bea sees only Shared band items; Team items (discovery-brief) are hidden
  ok   row-filters.RF3              2ms  RF3 — Harper (Client on Harbor) sees Harbor, but nothing from Discovery or Committee
  ok   row-filters.RF4              2ms  RF4 — Dana (Director on Committee) sees Committee, but not Discovery or Harbor
  ok   row-filters.RF5              357ms  RF5 — Bea (outside Client on Discovery) reads Space Pages and gets Shared pages only, never a Team page

  5 passed / 0 failed
```

### 6. Screenshots (`plans/space-focused-ux/shots/round-4/`, 1440×900, light and dark)

- `plans/space-focused-ux/shots/round-4/home-light.png`
- `plans/space-focused-ux/shots/round-4/home-dark.png`
- `plans/space-focused-ux/shots/round-4/discovery-overview-light.png`
- `plans/space-focused-ux/shots/round-4/discovery-overview-dark.png`
- `plans/space-focused-ux/shots/round-4/field-notes-light.png`
- `plans/space-focused-ux/shots/round-4/field-notes-dark.png`
- `plans/space-focused-ux/shots/round-4/library-light.png`
- `plans/space-focused-ux/shots/round-4/library-dark.png`
- `plans/space-focused-ux/shots/round-4/work-light.png`
- `plans/space-focused-ux/shots/round-4/work-dark.png`
- `plans/space-focused-ux/shots/round-4/chat-thread-open-light.png`
- `plans/space-focused-ux/shots/round-4/chat-thread-open-dark.png`
- `plans/space-focused-ux/shots/round-4/page-edit-mode-light.png`
- `plans/space-focused-ux/shots/round-4/page-edit-mode-dark.png`
- `plans/space-focused-ux/shots/round-4/rail-collapsed-light.png`
- `plans/space-focused-ux/shots/round-4/rail-collapsed-dark.png`

---

## Round 5

### 1. Bugs Fixed & Items Restored (`F1` to `F10`, plus `N1` to `N3`)

1. **`F1` — Space switcher popover when the rail is collapsed (`packages/AngularWidgets/src/lib/space-rail.component.ts`):**
   - **Browser reproduction (`plans/space-focused-ux/shots/round-5/f1-before-home-collapsed.png`, `plans/space-focused-ux/shots/round-5/f1-before-space-collapsed.png`):** Clicking `[data-testid="rail-space-switcher"]` while `.rail.collapsed` was active reached `onJumpClick()` and rendered `.switcher-popover`, but the un-scoped CSS rules `.rail.collapsed .rail-row`, `.rail.collapsed .rail-row .row-lbl`, and `.rail.collapsed .rail-row .tree-caret` collapsed every `.rail-row` inside `.switcher-popover` to `38px` width and hid all space names (`display: none`), leaving a column of unlabeled icons.
   - **Fix (`plans/space-focused-ux/shots/round-5/f1-after-home-collapsed.png`, `plans/space-focused-ux/shots/round-5/f1-after-space-collapsed.png`):** Scoped the collapsed row styles to `.rail.collapsed .rail-body .rail-row` so rows inside `.switcher-popover` keep their full `262px` width, carets, and labels; also added `Escape` handling in `onDocumentKeyDown` to close `switcherOpen`.
2. **`F2` — Inbox badge counts `bizapps-approval-inbox` rows (`packages/Angular/src/lib/collaboration-section.component.ts`):**
   - **Browser reproduction (`plans/space-focused-ux/shots/round-5/f2-before-inbox.png`):** `[InboxCount]` was bound to `homeAwaitingApproval` (`1`, Pat Invited's space seat invitation), while `<bizapps-approval-inbox [PersonID]="currentPersonId">` showed `0` rows (`"No approvals waiting on you."`).
   - **Fix (`plans/space-focused-ux/shots/round-5/f2-after-inbox.png`):** Added `inboxApprovalCount` loaded by `loadGlobalNavCounts()` using the exact `MJ_BizApps_Tasks: Tasks` `ExtraFilter` as `ApprovalInboxComponent` (`TypeID IN (SELECT ID FROM __mj_BizAppsTasks.vwTaskTypes WHERE IsApproval = 1)`, `Status NOT IN ('Completed', 'Cancelled')`, `ID IN (SELECT TaskID FROM __mj_BizAppsTasks.vwTaskAssignments WHERE AssigneeRecordID = '${personID}')`, and `ID NOT IN (SELECT TaskID FROM __mj_BizAppsTasks.vwTaskDecisions WHERE DecidedByPersonID = '${personID}')`) and bound `[InboxCount]="inboxApprovalCount"`. Space seat invitations remain in Home's `Needs you` section.
3. **`F3` — Every number audited and aligned with its destination (`packages/Angular/src/lib/collaboration-section.component.ts`):**
   - **Browser reproduction (`plans/space-focused-ux/shots/round-5/f3-before-my-tasks.png`, `plans/space-focused-ux/shots/round-5/f3-before-recent-files.png`):**
     - Home rail `My tasks` showed `8` (`homeOpenTasks`, all open tasks across reachable spaces) while `<bizapps-my-tasks [PersonID]="currentPersonId">` showed `1` task (`Discovery plan`) assigned to Ada Owner.
     - Home rail `Recent files` showed `3` (`homeSharedFiles`, all shared files across reachable spaces) while the `Recent files` view (`activeView === 'files'`) bound `[Rows]="homeSharedRows"` (which filtered `this.libraryRows`, the last-visited single space's library, showing `1` file).
     - Space rail `Work` badge (`taskCount`) used `this.spaceTasks.length` (all tasks including Completed/Cancelled) whereas Home's space signal and `Coming up` count open tasks (`status !== 'Completed' && status !== 'Cancelled'`).
   - **Fix (`plans/space-focused-ux/shots/round-5/f3-after-my-tasks.png`, `plans/space-focused-ux/shots/round-5/f3-after-recent-files.png`):**
     - Added `myTasksCount` in `loadGlobalNavCounts()` using the exact `MJ_BizApps_Tasks: Tasks` `ExtraFilter` as `MyTasksComponent` (`ID IN (SELECT TaskID FROM __mj_BizAppsTasks.vwTaskAssignments WHERE AssigneeRecordID = '${personID}') AND Status NOT IN ('Completed', 'Cancelled')`) and bound `[TaskCount]="railMode === 'home' ? myTasksCount : taskCount"`.
     - Added `loadAllSharedFiles()` populating `allSharedFilesRows`, `allSharedFilesCollections` (with `'folder-' + idx` IDs), and `allSharedFilesSmartViews` across all reachable spaces (deduplicated by `fileId` to match `resolveHomeCounts` `COUNT(DISTINCT RecordID)`) and bound them to the global `Recent files` `<mjc-space-library>`.
     - Updated `taskCount` in `loadSpaceTasks` and `onTaskToggled` to count open tasks (`status !== 'Completed' && status !== 'Cancelled'`).
4. **`F4` — Space type chip and inline subtitle on the header title row (`packages/AngularWidgets/src/lib/space-header.component.ts`):**
   - Restored `<span class="type-chip" data-testid="space-header-type-chip">{{ TypeName }}</span>` and `<span class="subtitle" data-testid="space-header-subtitle" [title]="Subtitle">{{ Subtitle }}</span>` on `.title-row` alongside the status chip.
5. **`F5` — Breadcrumb line on every space starting with `All spaces` (`packages/AngularWidgets/src/lib/space-header.component.ts`, `packages/Angular/src/lib/collaboration-section.component.ts`):**
   - Added `headerBreadcrumbs` in `CollabSpaceHeaderComponent` so every space renders `<nav class="crumbs" aria-label="Breadcrumb" data-testid="space-header-breadcrumbs">` starting with `All spaces` (`[{ label: 'All spaces' }]` on root spaces, and `All spaces › Parent` on sub-spaces). Updated `showHeaderFor` and `onBreadcrumbSelected` in `CollaborationSectionResource` to label the root crumb `'All spaces'`.
6. **`F7` — `"Ask <Agent> to answer?"` button runs an explicit-ask turn (`packages/CoreEntitiesServer/src/execute-space-chat-turn.ts`, `packages/AngularWidgets/src/lib/space-chat.component.ts`):**
   - **Note on PR #19 overlap:** This change touches `packages/CoreEntitiesServer/src/execute-space-chat-turn.ts` from PR #19 (`feat/multi-party-agent-routing`) in our branch and should be raised with PR #19's author when this branch becomes a PR.
   - **Browser reproduction (`plans/space-focused-ux/shots/round-5/f7-before-prompt.png`, `plans/space-focused-ux/shots/round-5/f7-before-after-click.png`):** Clicking `Ask Sage` in `confirmAgentShouldGo()` emitted the unhandled `AgentStepInRequested` output, set a fake `activeAgentRoute = 'ThreadReply'` timer, and called `chatArea.OnResendInPlaceRequested()` on the same unmentioned message (`turnRequests: 0`, no agent reply).
   - **Fix (`plans/space-focused-ux/shots/round-5/f7-after-prompt.png`, `plans/space-focused-ux/shots/round-5/f7-after-after-click.png`):**
     - In `executeSpaceChatTurn` (`packages/CoreEntitiesServer/src/execute-space-chat-turn.ts`), added `const isExplicitAsk = input.route === 'Redirect' || input.route === 'StepIn';`. When `isExplicitAsk` is true, any contributor with reach to the space/conversation may ask an allowed space agent (`input.agentId` or the space's default agent) to answer `input.userMessageId` even in a `MentionOnly` space and even when the message was authored by another participant; the server threads the reply under `userMessageId` and stamps `assistantDetail.UserID = callerId` so the room sees who asked.
     - In `CollabSpaceChatComponent` (`packages/AngularWidgets/src/lib/space-chat.component.ts`), removed the `'Sage'` default on `@Input() DefaultAgentName`, deleted the unhandled `@Output() AgentStepInRequested` and the private `OnResendInPlaceRequested` cast, guarded `onUserMessageSent` so the prompt only appears when a default agent is configured (`DefaultAgentId` or `DefaultAgentName`), updated `confirmAgentShouldGo()` to invoke `this.effectiveAgentTurnHandler` with `Route: 'Redirect'` and reload the conversation details when complete, and added `getAskedByName(message)` + `Asked by <Person>` chips (`[data-testid="message-asked-by"]`, `[data-testid="thread-reply-asked-by"]`).
7. **`F8` — Clicking the space header type tile goes to `All spaces` (`packages/AngularWidgets/src/lib/space-header.component.ts`):**
   - Wrapped `<mjc-type-tile>` in `<button type="button" class="type-tile-btn" data-testid="space-header-tile-btn" title="All spaces" aria-label="All spaces" (click)="onAllSpacesClick()">`, which emits `BreadcrumbSelectRequested` with `{ label: 'All spaces' }`.
8. **`F9` — Empty blocks render their `emptyText` + action; compact `Open tasks` block on Overview (`packages/AngularWidgets/src/lib/space-pages.component.ts`, `packages/AngularWidgets/src/lib/base-space-page-block.ts`, `packages/AngularWidgets/src/lib/space-work.component.ts`, `packages/AngularWidgets/src/lib/space-overview.component.ts`, `packages/Angular/src/lib/logic/space-pages.ts`, `packages/Angular/src/lib/collaboration-section.component.ts`):**
   - **Browser reproduction (`plans/space-focused-ux/shots/round-5/f9-before-audit-committee-overview.png`):** `shouldRenderBlock()` hid every block whose `isActive` returned `false`, leaving the entire left column of `Audit committee` Overview blank.
   - **Fix (`plans/space-focused-ux/shots/round-5/f9-after-audit-committee-overview.png`):**
     - Updated `shouldRenderBlock(block)` in `CollabSpacePagesComponent` so only side (`reg.side === 'Team' && !this.effectiveCanSeeTeam`) and permission/capability (`reg.canView`) checks hide a block. When `isRegisteredBlockActive(block, reg)` is `false`, the block renders inside `.sp-b-card.sp-block-empty-card` (`[data-testid="block-placeholder"]`) with its title, optional single action button (`emptyActionFor(reg)`, `[data-testid="block-empty-action"]`, e.g. `"Upload a file"`, `"Open Work"`, `"Open chat"`, `"+ Sub-space"`), and `reg.emptyText` (`[data-testid="block-empty-text"]`).
     - Added `CollabOpenTasksPageBlockComponent` (`key: 'collab:open-tasks'`, `emptyText: 'No open tasks'`) backed by `<mjc-space-work [Compact]="true">`, included it in `DEFAULT_BUILT_IN_BLOCK_DESCRIPTORS` in `packages/Angular/src/lib/logic/space-pages.ts` when `hasWork !== false`, and removed the redundant outer `@if (ShowLibraryLink)` gate on `@case ('SharedFiles')` and `@case ('TeamFiles')` in `CollabSpaceOverviewComponent` so `Audit committee`'s 3 Team files render even though `Committee` omits the `Library` tab.
9. **`F10` — Starring a space saves, survives reload, and shows in the rail and on Home (`packages/Angular/src/lib/collaboration-section.component.ts`, `packages/AngularWidgets/src/lib/space-rail.component.ts`, `packages/AngularWidgets/src/lib/types.ts`):**
   - **Browser reproduction (`plans/space-focused-ux/shots/round-5/f10-before-star-space.png`, `plans/space-focused-ux/shots/round-5/f10-before-star-home.png`):** `onStarToggle()` saved a `MJ: User Favorites` record, but nothing in the rail, switcher popover, or Home space list read `User Favorites`, so starring had no visible effect outside the header icon.
   - **Fix (`plans/space-focused-ux/shots/round-5/f10-after-star-space.png`, `plans/space-focused-ux/shots/round-5/f10-after-star-home.png`):** Added `starredSpaceIds` and `loadStarredSpaces()` in `CollaborationSectionResource`, synced `starredSpaceIds` and `this.spaces = this.buildSpaceRailNodes(this.rawSpaces)` in `loadStar` and `onStarToggle`, added `isStarred?: boolean` to `RailSpaceNode`, rendered `Starred` sections in both the switcher popover (`[data-testid="switcher-starred-spaces"]`) and the Home rail (`[data-testid="rail-starred-spaces"]`), added `.row-star` icons on starred space rows in the tree and on Home (`[data-testid="recent-space-star"]`), and sorted starred spaces first on Home.
10. **Optional Nits (`N1`, `N2`, `N3`):**
    - **`N1` (`packages/Angular/src/lib/collaboration-section.component.ts`):** Sorted `filteredSpaces` by starred + `__mj_UpdatedAt DESC` and capped `displayedRecentSpaces` on Home to the 5 most recent spaces by default with a `"Show all 9"` / `"Show fewer"` footer toggle (`[data-testid="recent-spaces-toggle-all"]`).
    - **`N2` (`packages/AngularWidgets/src/lib/home-list.component.ts`, `packages/Angular/src/lib/collaboration-section.component.ts`):** Added `@Input() ShowActionLabel = true` on `CollabHomeListComponent` and bound `[ShowActionLabel]="false"` on Home's inline `Coming up` and `Pinned` lists so the row itself is the link without repeated `"Open in Work"` / `"Open"` text.
    - **`N3` (`packages/Angular/src/lib/collaboration-section.component.ts`):** Added `Fields: ['ID', 'Name', 'UserImageURL', 'UserImageIconClass']` to the `MJ: Users` `RunView` call in `loadSpaceMembers`.

---

### 2. `F3` — Number Audit Table (Verified as Ada Owner)

| Surface & Number | Value (Ada) | Where It Is Computed | Where It Leads (Destination) | Matched Before? | Fix Applied |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Home Rail:** `Inbox` badge | `0` (hidden) | `loadGlobalNavCounts()` → `inboxApprovalCount` (`packages/Angular/src/lib/collaboration-section.component.ts`) | `Inbox` view (`<bizapps-approval-inbox [PersonID]="currentPersonId">`, `0` rows) | **No** (`1` vs `0`; bound to `homeAwaitingApproval` space invitations) | Query `MJ_BizApps_Tasks: Tasks` with `ApprovalInboxComponent`'s exact `vwTaskTypes` / `vwTaskAssignments` / `vwTaskDecisions` filter (`F2`). |
| **Home Rail:** `My tasks` badge | `1` | `loadGlobalNavCounts()` → `myTasksCount` (`packages/Angular/src/lib/collaboration-section.component.ts`) | `My tasks` view (`<bizapps-my-tasks [PersonID]="currentPersonId">`, `1` row: `Discovery plan`) | **No** (`8` vs `1`; bound to `homeOpenTasks` across all spaces) | Query `MJ_BizApps_Tasks: Tasks` with `MyTasksComponent`'s exact `vwTaskAssignments` filter for `currentPersonId` (`F3`). |
| **Home Rail:** `Recent files` badge | `3` | `loadAllSharedFiles()` / `loadHomeCounts()` → `allSharedFilesRows.length || homeSharedFiles` (`packages/Angular/src/lib/collaboration-section.component.ts`) | `Recent files` view (`<mjc-space-library>`, `3` rows: `executive-roadmap.pdf`, `welcome.html`, `site-photo.png`) | **No** (`3` badge vs `1` row; destination bound `homeSharedRows` from single space `libraryRows`) | Added `loadAllSharedFiles()` loading all shared `MJ: Files` items across reachable spaces deduplicated by `fileId` (`F3`). |
| **Space Rail (`Discovery`):** `Documents` badge | `2` | `loadSpaceItems()` → `libraryTotalCount` (`packages/Angular/src/lib/collaboration-section.component.ts`) | `Discovery` → `Documents` tab (`All material 2`: `site-photo.png`, `discovery-brief.pdf`) | **Yes** (`2` vs `2`) | None needed. |
| **Space Rail (`Discovery`):** `Work` badge | `2` | `loadSpaceTasks()` / `onTaskToggled()` → `taskCount` (`packages/Angular/src/lib/collaboration-section.component.ts`) | `Discovery` → `Work` tab & `Open tasks` Overview block (`2` open tasks: `Discovery plan`, `Internal prep`) | **Latent mismatch** (counted `spaceTasks.length` including Completed/Cancelled) | Filter `taskCount` to open tasks (`status !== 'Completed' && status !== 'Cancelled'`) in `loadSpaceTasks` and `onTaskToggled` (`F3`). |
| **Space Rail (`Discovery`):** `People` badge | `5` | `loadSpaceMembers()` → `summarizeSeats()` → `headerTotalPeople` (`packages/Angular/src/lib/collaboration-section.component.ts`) | `Discovery` → `People` tab (`5` active seats: `3` Team, `2` Outside) | **Yes** (`5` vs `5`) | None needed. |
| **Space Header (`Discovery`):** `mjc-audience-pill` | `5 people · 3 Team · 2 Outside` | `loadSpaceMembers()` → `summarizeSeats()` (`packages/Angular/src/lib/collaboration-section.component.ts`) | `Discovery` → `People` tab (`3` Team + `2` Outside active members) | **Yes** (`5` vs `5`) | None needed. |
| **Home:** `Needs you` badge | `1` | `loadHomeCounts()` → `homeCountValue('approvals')` (`packages/CoreEntitiesServer/src/resolve-home-counts.ts`) | Inline `<mjc-needs-you-card>` list (`1` card: `Pat Invited is invited as Guest` on `Audit committee` → opens `Audit committee` `People` tab) | **Yes** (`1` vs `1`) | None needed. |
| **Home:** `Coming up` badge | `8` | `loadHomeCounts()` → `homeCountValue('tasks')` (`packages/CoreEntitiesServer/src/resolve-home-counts.ts`) | Inline `<mjc-home-list Id="coming-up">` (`8` open task rows across reachable spaces) | **Yes** (`8` vs `8`) | None needed. |
| **Home:** `Pinned` badge | `2` | `loadHomePins()` → `homePins.length` (`packages/Angular/src/lib/collaboration-section.component.ts`) | Inline `<mjc-home-list Id="pins">` (`2` pinned rows: `Kickoff recap`, `executive-roadmap.pdf`) | **Yes** (`2` vs `2`) | None needed. |
| **Home:** `Active` / `Closed` tabs | `Active 9` / `Closed 4` | `activeSpacesCount` / `closedSpacesCount` (`packages/Angular/src/lib/collaboration-section.component.ts`) | `Your recent spaces` (`5` shown by default + `"Show all 9"` toggle = `9` active spaces; `Closed 4` tab shows `4` closed spaces) | **Yes** (`9` active, `4` closed) | Added 5-row default cap with `"Show all 9"` toggle (`N1`). |
| **Home:** Space row signals (`Northwind relationship`, `Discovery`, `Sealed child`, etc.) | `1 open task`, `2 open tasks`, `Sealed` | `spaceSignal(...)` in `packages/Angular/src/lib/logic/home-lists.ts` from `homeInvitations`, `homeOpenTaskList`, `InheritsMembership`, `ClosedAt` | Clicking each space row opens that space (e.g. `Northwind relationship` has `1` open task; `Discovery` has `2` open tasks; `Sealed child` has `InheritsMembership = false`) | **Yes** | None needed. |

---

### 3. `F6` — Screen-by-Screen Comparison (`plans/space-focused-ux/shots/before/*` vs `plans/space-focused-ux/shots/round-4/*`)

| Screen | Piece of Information or Shortcut Removed Since `plans/space-focused-ux/shots/before/*` | Restored in Round 5? | Rationale (`plans/space-focused-ux/ui-polish.md` §1 & `plans/space-focused-ux/ui-polish-review.md`) |
| :--- | :--- | :--- | :--- |
| **1. `home`** | Collapsed rail `Jump to a space` switcher popover rows had `38px` width and hidden labels (`F1`) | **Yes (`F1`)** | Scoped `.rail.collapsed .rail-body .rail-row` so the switcher popover renders full `262px` rows when collapsed. |
| **1. `home`** | `Starred` spaces access in the Home rail and switcher popover (`F10`) | **Yes (`F10`)** | Added `Starred` sections in both the Home rail (`[data-testid="rail-starred-spaces"]`) and switcher popover (`[data-testid="switcher-starred-spaces"]`), plus `.row-star` indicators. |
| **1. `home`** | Top-5 space cap on Home (`plans/space-focused-ux/shots/before/home-light.png` showed 5 spaces; `plans/space-focused-ux/shots/round-4/home-light.png` showed all 9) | **Yes (`N1`)** | Capped `displayedRecentSpaces` to the 5 most recently updated/starred spaces by default with a `"Show all 9"` / `"Show fewer"` toggle (`[data-testid="recent-spaces-toggle-all"]`). |
| **1. `home`** | Welcome hero (`"Welcome to Collaboration"`) and 5 Title Case stat cards (`Active Spaces`, `Open Tasks`, `Invitations Waiting`, `Shared Files`, `My Pins`) | **No (Intentional)** | Explicitly removed per Round 4 (`plans/space-focused-ux/ui-polish-review.md` lines 403–410: *"Remove the welcome hero and the stat tiles. A count shows as a badge on the row or rail item it belongs to."*). All 5 counts are shown on their respective rows/rail badges. |
| **2. `discovery-overview` & 3. `field-notes`** | Space type chip (`Workspace`, `Committee`) and inline subtitle on `.title-row` in `CollabSpaceHeaderComponent` (`F4`) | **Yes (`F4`)** | Restored `[data-testid="space-header-type-chip"]` and truncated `[data-testid="space-header-subtitle"]` with `[title]="Subtitle"` tooltip. |
| **2. `discovery-overview` & 3. `field-notes`** | `All spaces` breadcrumb link on every space (including root spaces) (`F5`) | **Yes (`F5`)** | Restored `<nav class="crumbs" data-testid="space-header-breadcrumbs">` on every space starting with `All spaces`. |
| **2. `discovery-overview` & 3. `field-notes`** | Clicking the space header type tile navigates to `All spaces` (`F8`) | **Yes (`F8`)** | Wrapped `<mjc-type-tile>` in `<button type="button" class="type-tile-btn" data-testid="space-header-tile-btn" title="All spaces" aria-label="All spaces">`. |
| **2. `discovery-overview` & 3. `field-notes`** | Empty Overview blocks (`Pinned items`, `Needs your attention`, `Shared files`, `Recent discussion`, `About this space`) vanished when `isActive` was `false`, and spaces with `Work` had no tasks block on Overview (`F9`) | **Yes (`F9`)** | Empty blocks now render `.sp-block-empty-card` with `emptyText` and `emptyAction` (`"Upload a file"`, `"Open Work"`, `"Open chat"`, `"+ Sub-space"`), and spaces with `Work` include `CollabOpenTasksPageBlockComponent` (`collab:open-tasks`) on Overview. |
| **2. `discovery-overview` & 3. `field-notes`** | Header sub-space pill strip (`• Field notes  + Sub-space`), default `Inside <Space>` Overview card, and rail `"Preferences synced"` footer | **No (Intentional)** | Removed per `plans/space-focused-ux/ui-polish.md` §2, §3, and `R1-10` so sub-spaces are not duplicated in 3 places on screen. Sub-spaces and `+` (`New sub-space`) remain one click away in the rail's `Sub-spaces` group and the header `⋯` menu, and `Sub-spaces` (`collab:sub-spaces`) can still be added via the page block picker. |
| **2. `discovery-overview` & 3. `field-notes`** | Separate `+ Invite` button next to `+ New` in the space header | **No (Intentional)** | Moved to the header `⋯` menu (`Invite people`) and the `People` tab in Round 1 (`plans/space-focused-ux/ui-polish.md` §1 & §3: one primary button per screen). |
| **4. `library` & 5. `work`** | Header breadcrumbs (`All spaces › Northwind relationship`), type chip (`Workspace`), and clickable type tile (`F4`, `F5`, `F8`) | **Yes (`F4`, `F5`, `F8`)** | Shared `CollabSpaceHeaderComponent` restores these across `Documents` (`library`) and `Work` (`work`). |
| **6. `chat-thread-open`** | Duplicate `+ New Conversation` button in the chat sub-header | **No (Intentional)** | Removed per `R1-2` ("One primary button per screen"); `+` on `Conversations` in the rail starts a conversation. |
| **6. `chat-thread-open`** | `"Ask <Agent> to answer?"` prompt button (`F7`) | **Yes (`F7`)** | Wired `confirmAgentShouldGo()` to `ExecuteSpaceChatTurn` (`Route: 'Redirect'`) with `Asked by <Person>` attribution. |
| **7. `page-edit-mode`** | 5-button edit banner (`+ Add Block / Widget`, `Add Intro`, `Page Settings`, `New Page`, `Done Customizing`) and 6-button block toolbar | **No (Intentional)** | Consolidated in Round 1 & Round 2 (`plans/space-focused-ux/ui-polish.md` §7 & `plans/space-focused-ux/ui-polish-review.md` "Add to round 2") into the compact edit bar (`Publish` / `Discard`), inline `+ Add a block here` triggers, and the 4-icon hover toolbar (`Drag · ↑ · ↓ · ⋯` with `Column`, `Edit`, `Duplicate`, `Remove` inside `⋯`). |
| **8. `rail-collapsed`** | Clicking the collapsed switcher button opened a broken `38px`-row popover (`F1`), and header lacked `All spaces` tile button (`F8`) and `Workspace` chip (`F4`) | **Yes (`F1`, `F4`, `F5`, `F8`)** | Restored in Round 5 (`plans/space-focused-ux/shots/round-5/rail-collapsed-light.png`, `plans/space-focused-ux/shots/round-5/f1-after-space-collapsed.png`). |

---

### 4. Files Touched

- `packages/AngularWidgets/src/lib/types.ts`
- `packages/AngularWidgets/src/lib/space-rail.component.ts`
- `packages/AngularWidgets/src/lib/space-header.component.ts`
- `packages/AngularWidgets/src/lib/home-list.component.ts`
- `packages/AngularWidgets/src/lib/space-chat.component.ts`
- `packages/AngularWidgets/src/lib/space-work.component.ts`
- `packages/AngularWidgets/src/lib/space-overview.component.ts`
- `packages/AngularWidgets/src/lib/base-space-page-block.ts`
- `packages/AngularWidgets/src/lib/space-pages.component.ts`
- `packages/AngularWidgets/src/public-api.ts`
- `packages/AngularWidgets/src/lib/widgets.test.ts`
- `packages/AngularWidgets/src/lib/render.test.ts`
- `packages/CoreEntitiesServer/src/execute-space-chat-turn.ts`
- `packages/CoreEntitiesServer/src/execute-space-chat-turn.test.ts`
- `packages/Angular/src/lib/logic/space-pages.ts`
- `packages/Angular/src/lib/logic/space-pages.test.ts`
- `packages/Angular/src/lib/collaboration-section.component.ts`
- `plans/space-focused-ux/ui-polish-notes.md`
- `plans/space-focused-ux/shots/round-5/*.png`

---

### 5. Test Changes and Rationale

1. **`packages/CoreEntitiesServer/src/execute-space-chat-turn.test.ts`:**
   - Added 2 unit tests for `F7`:
     - `executes an explicit ask (route: 'Redirect') on an untagged message in a MentionOnly space, threads the reply under that message, and records the caller on UserID so the room sees who asked`
     - `refuses an explicit ask (route: 'Redirect') when the caller cannot post or when the agent is not allowed in the space`
2. **`packages/Angular/src/lib/logic/space-pages.test.ts`:**
   - Updated `builds starter pages for all built-in space tabs and merges saved customizations + user pages` to verify that `collab:open-tasks` is included on the default `Overview` page (`9` blocks) when `hasWork` is not `false`, and omitted (`8` blocks) when `hasWork: false` (`F9`).
3. **`packages/AngularWidgets/src/lib/widgets.test.ts`:**
   - Updated `CollabSpacePagesComponent` unit tests for `F9` (`shouldRenderBlock` returns `true` for empty blocks so they render their `.sp-block-empty-card`, while `isRegisteredBlockActive` returns `false` when empty).
4. **`packages/AngularWidgets/src/lib/render.test.ts`:**
   - Updated existing header and page-block render assertions for `F4`, `F5`, `F8`, and `F9`.
   - Added `Round 5 — F1, F4, F5, F7, F8, F9, F10` suite (4 comprehensive DOM render tests):
     - `F1 & F10: collapsed rail switcher opens full-width popover with Starred section and emits SpaceOpenRequested`
     - `F4, F5, F8: header renders All spaces breadcrumb on root space, type chip, subtitle, and clickable type tile`
     - `F7: clicking Ask <Agent> in the redirect prompt invokes AgentTurnHandler with Route=Redirect and renders Asked by attribution`
     - `F9: empty blocks render their emptyText and emptyAction in a card frame, and collab:open-tasks renders compact tasks`

---

### 6. Gate Outputs (Real Verbatim Output)

#### 1. `node scripts/check-mj-tokens.mjs`, `node scripts/check-mj-inputs.mjs`, `node scripts/check-registered-exports.mjs`, & Grep Checks

```text
$ node scripts/check-mj-tokens.mjs
mj tokens ok (119 used, 296 defined; 16 mjc used, 16 defined)

$ node scripts/check-mj-inputs.mjs
mj inputs ok (none of the 14 deprecated names of mjButton and mj-loading is bound)

$ node scripts/check-registered-exports.mjs
registered exports ok (8 published packages and 3 example packages: every @RegisterClass class is exported from its entry)

$ grep -c 'var(--[^)]*#[0-9a-fA-F]' packages/AngularWidgets/src/lib/types.ts packages/AngularWidgets/src/lib/space-rail.component.ts packages/AngularWidgets/src/lib/space-header.component.ts packages/AngularWidgets/src/lib/home-list.component.ts packages/AngularWidgets/src/lib/space-chat.component.ts packages/AngularWidgets/src/lib/space-work.component.ts packages/AngularWidgets/src/lib/space-overview.component.ts packages/AngularWidgets/src/lib/base-space-page-block.ts packages/AngularWidgets/src/lib/space-pages.component.ts packages/Angular/src/lib/logic/space-pages.ts packages/Angular/src/lib/collaboration-section.component.ts packages/CoreEntitiesServer/src/execute-space-chat-turn.ts || true
packages/AngularWidgets/src/lib/types.ts:0
packages/AngularWidgets/src/lib/space-rail.component.ts:0
packages/AngularWidgets/src/lib/space-header.component.ts:0
packages/AngularWidgets/src/lib/home-list.component.ts:0
packages/AngularWidgets/src/lib/space-chat.component.ts:0
packages/AngularWidgets/src/lib/space-work.component.ts:0
packages/AngularWidgets/src/lib/space-overview.component.ts:0
packages/AngularWidgets/src/lib/base-space-page-block.ts:0
packages/AngularWidgets/src/lib/space-pages.component.ts:0
packages/Angular/src/lib/logic/space-pages.ts:0
packages/Angular/src/lib/collaboration-section.component.ts:0
packages/CoreEntitiesServer/src/execute-space-chat-turn.ts:0
```

#### 2. `pnpm --filter @mj-biz-apps/collaboration-ng-widgets test`

```text
> @mj-biz-apps/collaboration-ng-widgets@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets
> vitest run

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/AngularWidgets

 ✓ src/lib/ui-driver.test.ts (10 tests) 6ms
 ✓ src/lib/widgets.test.ts (124 tests) 18ms
 ✓ src/lib/render.test.ts (63 tests) 986ms

 Test Files  3 passed (3)
      Tests  197 passed (197)
   Start at  14:14:42
   Duration  13.63s (transform 19.19s, setup 0ms, import 26.65s, tests 1.01s, environment 319ms)
```

#### 3. `pnpm --filter @mj-biz-apps/collaboration-ng test`

```text
> @mj-biz-apps/collaboration-ng@0.1.0 test /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular
> tsc -p tsconfig.test.json && node --experimental-strip-types --test 'src/lib/logic/*.test.ts' && vitest run

▶ space-pages
  ✔ maps a SpacePage row and applies a CollabPageModel back to a SpacePage entity (0.515458ms)
  ✔ builds starter pages for all built-in space tabs and merges saved customizations + user pages (0.902542ms)
  ✔ preserves contributed tab keys (e.g. BaseSpaceTab keys) on entity.BuiltInTab (0.090834ms)
✔ space-pages (2.081667ms)
...
ℹ tests 161
ℹ suites 45
ℹ pass 161
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 277.860208

 RUN  v4.1.11 /Users/colinbrockman/Projects/mjws-collab/bizapps-collaboration/packages/Angular

 ✓ src/lib/space-details-view.render.test.ts (5 tests) 37ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  14:14:55
   Duration  5.28s (transform 3.41s, setup 0ms, import 4.93s, tests 37ms, environment 231ms)
```

#### 4. `pnpm --filter @mj-biz-apps/collaboration-core-entities-server exec node --experimental-strip-types --test 'src/execute-space-chat-turn.test.ts'`

```text
▶ executeSpaceChatTurn
  ✔ executes an explicit ask (route: 'Redirect') on an untagged message in a MentionOnly space, threads the reply under that message, and records the caller on UserID so the room sees who asked (0.303791ms)
  ✔ refuses an explicit ask (route: 'Redirect') when the caller cannot post or when the agent is not allowed in the space (0.260458ms)
✔ executeSpaceChatTurn (134.402792ms)
ℹ tests 33
ℹ suites 2
ℹ pass 33
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1960.540417
```

#### 5. `ngc -p tsconfig.json --noEmit` (`@mj-biz-apps/collaboration-ng-widgets` & `@mj-biz-apps/collaboration-ng`)

```text
$ pnpm --filter @mj-biz-apps/collaboration-ng-widgets exec ngc -p tsconfig.json --noEmit
src/lib/space-settings.component.ts:13:77 - warning NG8113: MJDropdownComponent is not used within the template of CollabSpaceSettingsComponent

13   imports: [CommonModule, FormsModule, MJAlertComponent, MJButtonDirective, MJDropdownComponent, SharedGenericModule],
                                                                               ~~~~~~~~~~~~~~~~~~~

$ pnpm --filter @mj-biz-apps/collaboration-ng exec ngc -p tsconfig.json --noEmit
src/lib/collaboration-section.component.ts:1622:116 - warning NG8107: The left side of this optional chain operation does not include 'null' or 'undefined' in its type, therefore the '?.' operator can be replaced with the '.' operator.

1622                                                                         <span class="config-meta">{{ reach.Fields?.length ? reach.Fields.length + ' field' + (reach.Fields.length === 1 ? '' : 's') : 'every field' }}</span>
                                                                                                                        ~~~~~~
```

#### 6. Integration Gate (`node test-harnesses/integration.mjs row-filters`)

```text
$ DOTENV_CONFIG_PATH=/Users/colinbrockman/Projects/mjws-collab/MJ/.env node test-harnesses/integration.mjs row-filters
  Collaboration integration SERVER (SQLServerDataProvider → localhost:1436/MJ_6_2_0_CLEAN_4789)

  ok   row-filters.RF1              4ms  RF1 — Bea (Client on Discovery) sees Discovery and Field notes, but nothing from Harbor
  ok   row-filters.RF2              5ms  RF2 — Bea sees only Shared band items; Team items (discovery-brief) are hidden
  ok   row-filters.RF3              2ms  RF3 — Harper (Client on Harbor) sees Harbor, but nothing from Discovery or Committee
  ok   row-filters.RF4              3ms  RF4 — Dana (Director on Committee) sees Committee, but not Discovery or Harbor
  ok   row-filters.RF5              380ms  RF5 — Bea (outside Client on Discovery) reads Space Pages and gets Shared pages only, never a Team page

  5 passed / 0 failed
```

---

### 7. Screenshots (`plans/space-focused-ux/shots/round-5/`)

#### Bug Reproduction (`before`) & Verification (`after`) Pairs
- `plans/space-focused-ux/shots/round-5/f1-before-home-collapsed.png` & `plans/space-focused-ux/shots/round-5/f1-after-home-collapsed.png`
- `plans/space-focused-ux/shots/round-5/f1-before-space-collapsed.png` & `plans/space-focused-ux/shots/round-5/f1-after-space-collapsed.png`
- `plans/space-focused-ux/shots/round-5/f2-before-inbox.png` & `plans/space-focused-ux/shots/round-5/f2-after-inbox.png`
- `plans/space-focused-ux/shots/round-5/f3-before-my-tasks.png` & `plans/space-focused-ux/shots/round-5/f3-after-my-tasks.png`
- `plans/space-focused-ux/shots/round-5/f3-before-recent-files.png` & `plans/space-focused-ux/shots/round-5/f3-after-recent-files.png`
- `plans/space-focused-ux/shots/round-5/f7-before-prompt.png` & `plans/space-focused-ux/shots/round-5/f7-after-prompt.png`
- `plans/space-focused-ux/shots/round-5/f7-before-after-click.png` & `plans/space-focused-ux/shots/round-5/f7-after-after-click.png`
- `plans/space-focused-ux/shots/round-5/f9-before-audit-committee-overview.png` & `plans/space-focused-ux/shots/round-5/f9-after-audit-committee-overview.png`
- `plans/space-focused-ux/shots/round-5/f10-before-star-space.png` & `plans/space-focused-ux/shots/round-5/f10-after-star-space.png`
- `plans/space-focused-ux/shots/round-5/f10-before-star-home.png` & `plans/space-focused-ux/shots/round-5/f10-after-star-home.png`

#### Standard 16-Screenshot Suite (`8 screens × light/dark`, 1440×900)
- `plans/space-focused-ux/shots/round-5/home-light.png`
- `plans/space-focused-ux/shots/round-5/home-dark.png`
- `plans/space-focused-ux/shots/round-5/discovery-overview-light.png`
- `plans/space-focused-ux/shots/round-5/discovery-overview-dark.png`
- `plans/space-focused-ux/shots/round-5/field-notes-light.png`
- `plans/space-focused-ux/shots/round-5/field-notes-dark.png`
- `plans/space-focused-ux/shots/round-5/library-light.png`
- `plans/space-focused-ux/shots/round-5/library-dark.png`
- `plans/space-focused-ux/shots/round-5/work-light.png`
- `plans/space-focused-ux/shots/round-5/work-dark.png`
- `plans/space-focused-ux/shots/round-5/chat-thread-open-light.png`
- `plans/space-focused-ux/shots/round-5/chat-thread-open-dark.png`
- `plans/space-focused-ux/shots/round-5/page-edit-mode-light.png`
- `plans/space-focused-ux/shots/round-5/page-edit-mode-dark.png`
- `plans/space-focused-ux/shots/round-5/rail-collapsed-light.png`
- `plans/space-focused-ux/shots/round-5/rail-collapsed-dark.png`

