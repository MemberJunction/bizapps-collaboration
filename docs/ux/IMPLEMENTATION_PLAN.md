# Building the Collaboration UI from the frames

This was the plan for building the UI. Read the [storyboard](README.md) first: it explains what each frame shows and why. This document says how to build it the MemberJunction way.

**Where it stands:** it's a record of how the UI was planned. Each package's README describes what was built; where the two differ, the READMEs are current.

The rule behind every section below comes from MJ's [UI Layering Guide](https://github.com/MemberJunction/MJ/blob/next/guides/UI_LAYERING_GUIDE.md) (`guides/UI_LAYERING_GUIDE.md` in the MJ repo):

- Every piece is an **embeddable, reusable widget**.
- Widgets are **composed into full dashboards**.
- **Only the top layer touches Explorer.** `NavigationService`, `BaseResourceComponent` and the query-param round-trip live there.
- Everything below it works in **any Angular app**.

---

## 1. What "done" means

**For the next pull request (D16, Amith, 2026-09-27):** the screens come last, and the bar is function and overall form, not pixels. The builder walks every screen in Explorer with Playwright and posts the shots in the pull request. Items 2 to 4 below still hold. Item 1's match to each PNG, and the "pixel perfect" paragraph after the list, were slice A's bar.

**Since D24 (Amith, 2026-09-27):** the UI's style and design are Amith's, with the local builder, and the frames here are retired as the reference. They no longer set layout and content, and a difference from them isn't a regression. What still holds from this plan is the layering, MJ's components as they are (D15), and nothing typed in (D14).

1. **All fourteen frames are covered, in light and dark.**
   - Frames 01–13 are built in Explorer and run on real data.
   - Frame 00 is a concept diagram, not a screen, so it is not built.
   - Each built frame matches its PNG in [`screens/`](screens/), verified by the automated screenshot comparison in [§ 10](#10-visual-tests-how-pixel-perfect-is-checked).
2. **Packages follow the four layers** in [§ 3](#3-packages-and-layers), and MJ's `ui-layers` gate passes with every Angular package declared.
3. **The current UI is gone** ([§ 2](#2-what-to-delete-and-what-to-keep)).
4. **Builds, unit tests and `mj standards check` pass.** The PR shows screenshots of every frame from Explorer, in light and dark.

"Pixel perfect" is literal. The frames already use MJ's real tokens, fonts, Font Awesome version and component metrics, so a faithful build matches them. The rules for anything that can't match:

- **If a frame and an MJ component disagree, keep MJ's look** (Amith, 2026-09-26). Don't restyle the component: list the difference as a known difference in the PR. Where one matters, we adjust the frame or improve MJ.
- **Don't guess where a frame is ambiguous.** Open the matching page in [`mockup/html/`](mockup/html/); it has every size, color and spacing value.

## 2. What to delete, and what to keep

This section is done: the old UI is gone, and the new resource and the no-access page reuse two of these file names.

**Delete:**
- `packages/Angular/src/lib/collaboration-section.component.ts`
- `packages/Angular/src/lib/space-workspace.component.ts`, `.html` and `.css`
- `packages/Angular/src/lib/no-access.component.ts`
- `plans/ux-mockup/`, which this folder replaces

**Keep:**
- `packages/Angular/src/lib/generated/`, the CodeGen entity forms.
- The bootstrap export `LoadBizAppsCollaborationClient`, which `mj-app.json` names as the client `startupExport`.
- The application's one nav item. `metadata/applications/.applications.json` points it at DriverClass `CollaborationSectionResource`; keep that DriverClass and replace the component behind it.
- Every server package, the entities and actions, the core rules and the permission model. The UI sits on top of them.

## 3. Packages and layers

| Layer | Package (folder) | `mjUILayer` | Holds |
|---|---|---|---|
| **L0 runtime** | `@mj-biz-apps/collaboration-entities` (`packages/Entities`) | `runtime` | CodeGen entities, which already exist |
| **L0 runtime** | `@mj-biz-apps/collaboration-core` (`packages/Core`) | `runtime` | Pure TypeScript view models and rules, plus the non-visual extension contracts ([§ 5.1](#51-l0--collaboration-core)) |
| **L0 runtime** | `@mj-biz-apps/collaboration-engine-base` (`packages/EngineBase`) | `runtime` | The metadata engine: space types, role types, the app's settings and the Collaboration authorizations, cached once, for the browser and the server |
| **L1 + L2 widgets** | **new** `@mj-biz-apps/collaboration-ng-widgets` (`packages/AngularWidgets`) | `widgets` | Every widget and composite in [§ 5.2](#52-l1--widgets-props-in-events-out) and [§ 5.3](#53-l2--composites-load-through-providertouse-emit-intent) |
| **L3 Explorer surface** | `@mj-biz-apps/collaboration-ng` (`packages/Angular`) | `surface` | The Explorer resource, the generated forms, the Work tab and the bizapps-tasks panels ([§ 4](#4-how-explorer-hosts-it-l3)) |
| shell | **new, private** `packages/UXGallery` | `shell` (it is an app) | A plain Angular app with no Explorer that renders every frame from fixtures. It proves the widgets work in any Angular app and hosts the visual tests ([§ 10](#10-visual-tests-how-pixel-perfect-is-checked)). |

**Allowed dependencies** (guide § 7):

- **`collaboration-ng-widgets`** may depend on:
  - the L0 packages;
  - `@angular/{core,common,forms,animations}`;
  - `@memberjunction/ng-base-types`, `ng-ui-components`, `ng-shared-generic`, `ng-base-forms`, `ng-entity-viewer`;
  - any `Generic/**` package. For this work that means `ng-conversations`, which declares itself `widgets`.
- **`collaboration-ng-widgets` must never import or depend on** `@angular/router`, `@memberjunction/ng-shared` or any `@memberjunction/ng-explorer-*` package.
- **`collaboration-ng`** adds `@memberjunction/ng-shared`, and it is also where `@mj-biz-apps/tasks-ng` goes. `tasks-ng` is one package that depends on `ng-shared`: its panels open Explorer tabs through `OpenTaskRecord()`. That makes it an L3 dependency, so a widgets package can't use it until bizapps-tasks splits out its own widgets package.
- **No cross-package re-exports.** Consumers import widgets from `collaboration-ng-widgets` itself.

**Wiring:**

- Add `{ "name": "@mj-biz-apps/collaboration-ng-widgets", "role": "library" }` to the `client` list in `mj-app.json`.
- Match MJ's package conventions:
  - `"main": "./dist/public-api.js"` and `"typings": "./dist/public-api.d.ts"`;
  - `@angular/*` peer dependencies as caret ranges.
- Turn on the gate:
  ```bash
  # The MJ CLI 6.1.3 ships @memberjunction/standards 6.1.3; the ui-layers check has existed since 6.0.0.
  npx -p @memberjunction/cli@6.1.3 mj standards adopt --ci github --declare-compliant
  npx -p @memberjunction/cli@6.1.3 mj standards check
  ```
  Then lock it so an undeclared package fails rather than skips:
  ```jsonc
  "ui-layers": { "Severity": "error", "Roots": ["packages"], "Options": { "requireDeclaredIn": ["packages"] } }
  ```
- A reviewed exception is a `mj-ui-layers-allow` comment, with a reason, on the offending line or the line directly above it.

## 4. How Explorer hosts it (L3)

- **Explorer draws the top bar** in every frame: the logo, app switcher, search, bell and avatar. Don't build it.
  - The frames show that bar with the app nav hidden.
  - A default deployment also shows the app's one nav pill ("Spaces") next to the switcher. That difference is expected and is not a mismatch.
- **One resource, `CollaborationSectionResource`.** It extends `BaseResourceComponent` and is registered with `@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')`, plus a `Load…()` function to stop tree-shaking. It owns:
  - **Everything under the top bar.** It renders a `<mj-page-layout>` / `<mj-page-body [Padding]="false">` holding the rail and the current view.
  - **Where the user is, as query params**, so every view deep-links:
    - `view` = `home`, `inbox`, `tasks` or `files`;
    - `space` = `<id>`;
    - `tab` = `overview`, `library`, `work`, `chat`, `people`, `settings`, or an extension key;
    - `item` = `<id>`;
    - `conv` = `<id>`, the open conversation;
    - `workView` = `list`, `kanban` or `gantt`.

    Override `OnQueryParamsChanged`, and call `UpdateQueryParams` when an L2 composite emits `SpaceOpenRequested`, `TabChangeRequested`, `ChatOpenRequested` and similar.
  - **Opening a record in its own Explorer tab.** A file's or task's *Open* calls `NavigationService.OpenEntityRecord`. This is the only place that happens.
  - **`NotifyLoadComplete()`**, called once the first view's data is in. Also call `super.ngOnInit()` and `super.ngOnDestroy()`.
  - **`SetAgentContext(...)`** with the current space and chat, so Explorer's own agent knows where the user is. MJ's dashboard rules require it.
- **Outside participants** use the same resource, not a separate app. The view model decides the portal from the viewer's membership (frames 07 and 12): no Team side, no settings, only their spaces. A magic-link session already locks app switching (`appSwitchingLocked`).
- **The Work tab** (frame 10) is composed here, because it reuses bizapps-tasks' own components (Amith, 2026-09-23).
  - `<bizapps-task-kanban>`, `<bizapps-task-list>` and `<bizapps-task-gantt>` from `tasks-ng` draw *Board*, *List* and *Timeline*. (As built, *List* is Collaboration's own `mjc-space-work`, *Board* and *Timeline* are bizapps-tasks' kanban and gantt, and there is no `mjc-work-toolbar` or `mjc-task-card`.)
  - Each gets the space's task set through `ExtraFilter`: the tasks linked to the space through `SpaceItem`. What a viewer may read is still decided by the server's permissions, never by this filter.
  - The toolbar above them is the L1 `mjc-work-toolbar`.
  - The board's cards are Collaboration's `mjc-task-card`, passed in as the board's card template ([§ 6](#6-mj-components-to-use-and-the-five-gaps), gap 3).
- **The task detail panel.** When the user clicks a task anywhere, L3 opens `<bizapps-task-detail-panel>` from `tasks-ng` in an `mj-slide-panel`. Edits happen there, with `<bizapps-task-edit-panel>`.

## 5. Component inventory

Selectors use the prefix `mjc-`; MJ's guide asks for an app-scoped prefix of 3–4 characters, and the family precedent is `mjt-` for tasks and `mjf-` for forms. Class names start with `Collab`, for example `CollabSpaceHeaderComponent`. Public members are PascalCase. Events follow guide § 6:

- A cancellable action is a `Before<Verb><Noun>` / `After<Verb><Noun>` pair whose args class carries `Cancel`.
- An intent the host acts on is `<Noun><Verb>Requested`.

### 5.1 L0 · `collaboration-core`

Pure functions and classes with no Angular, each covered by unit tests:

| Piece | Does | Frames |
|---|---|---|
| `AudienceSummary` | Members → "9 people · 3 Meridian · 6 Northwind", the composer line "9 people will see this, 6 at Northwind", and the upload line | all |
| `BandVisibility` | A set of chat participants → which sides the Assistant may use, and the sentence that explains it | 05, 09, 11 |
| `SpaceProgress` | Start date, planned close and milestones → "Week 7 of 10", the next milestone, and the milestone track | 01, 02, 07 |
| `AvatarColor` | A person's ID → a stable index into the avatar palette ([§ 7](#7-tokens-and-styling)) | all |
| `NeedsYouItem`, `AgendaItem` + `mergeAgenda()` | Models for *Needs you* and *Coming up*; merging, sorting and deduplicating items from all providers | 01, 02, 07 |
| Extension contracts | `NeedsYouProvider`, `AgendaProvider`, `SpaceHeaderChipProvider` base classes ([§ 9](#9-extension-points-for-apps-on-top)) | 01, 08 |

### 5.2 L1 · widgets (props in, events out)

L1 widgets take plain models (not entities), do no data access, and inject nothing beyond Angular itself.

| Widget | Frames | Built from |
|---|---|---|
| `mjc-avatar`, `mjc-avatar-stack` | all | Its own markup, because MJ has no avatar component (`@memberjunction/ng-user-avatar` only provides `UserAvatarService`, used here for image URLs). An outside person gets the teal ring and online people get the presence dot. |
| `mjc-type-tile` | all | The icon and color come from `SpaceType` data ([§ 8](#8-data-the-frames-need)) |
| `mjc-band-chip` | all | Team (lock) or Shared (eye) |
| `mjc-audience-pill` | 02–06, 09–11 | Staff stack, outside stack, and the summary from `AudienceSummary` |
| `mjc-space-header` | 02–06, 08–11 | Tile, title, type and status chips, extension chips, subtitle, and an `[actions]` slot. **Reviewed exception:** `mj-page-header` has a 40px icon and a 20px title, so it can't draw this header. |
| `mjc-space-tabs` | 02–06, 08–11 | An underline tab strip with icon, label and count. Apply MJ's `mjTabList` directive for the ARIA keyboard contract. |
| `mjc-space-rail` | 01–03, 05, 06, 09–11 | Its own tree, drawn to `mj-left-nav`'s metrics. **Reviewed exception:** `mj-left-nav` and `mj-tree` have no item template, and the rail needs type tiles, unread dots, locks and counts. Hand the rail's ARIA and collapse behavior to `mj-left-nav` once it has an item template ([§ 6](#6-mj-components-to-use-and-the-five-gaps)). |
| `mjc-needs-you-list` | 01, 02, 07 | Rows or cards with an action; buttons are `mjButton` `size="sm"` |
| `mjc-coming-up-list` | 01, 07 | A date block, title, context and type tile |
| `mjc-space-list` | 01 | Rows with a progress bar (`mj-progress-bar`) and the audience; the *Active / Closed* switch is `mj-tab-nav` |
| `mjc-digest` | 01 | Bullets plus the "built from what you can see" footer |
| `mjc-ask-box` | 01, 02, 07, 08 | An `.mj-input`, submit button, scope line and suggestion chips |
| `mjc-item-card`, `mjc-item-row`, `mjc-file-icon` | 02, 03, 07 | The band chip, used-by stack, citation count and flags |
| `mjc-item-preview` | 03 | Preview, band and audience, the check warning, the share action, and recent use |
| `mjc-share-check` | 04 | The dialog body: audience grid, the Assistant's findings with *Apply*, the note (`.mj-textarea`), the effects (`mj-switch`), and the record line |
| `mjc-chat-list` | 05, 11 | The space's chats with each audience and unread count |
| `mjc-chat-banner` | 05, 11 | The audience banner, projected into chat-area's `header` slot |
| `mjc-answer-receipt`, `mjc-citation-chip` | 05, 11, 12 | The "Used 3 Shared items…" line and file citations, projected into chat-area's `messageExtra` slot |
| `mjc-chat-lens` | 05, 11 | *What it can use here*, members by organization, and pinned items |
| `mjc-member-table` | 06 | Organization groups; role pickers are `mj-dropdown`; the pending-approval and removed rows |
| `mjc-invite-card`, `mjc-join-rules` | 06 | `.mj-input`, `mj-dropdown`, `mj-datepicker`, `mj-switch` |
| `mjc-milestone-track`, `mjc-activity-feed`, `mjc-team-card` | 07 | |
| `mjc-assistant-notes`, `mjc-skill-list`, `mjc-scope-picker`, `mjc-try-it` | 09 | `.mj-textarea`, `mj-switch`, radio cards. The settings sub-nav is plain `mj-left-nav`. |
| `mjc-work-toolbar`, `mjc-task-card` | 10 | The toolbar holds the view switch (`mj-tab-nav`), the filters (`mj-filter-chip`) and the "Northwind sees 5 of these 10" line. The card is what bizapps-tasks' board renders through its card template (gap 3). |
| `mjc-type-picker`, `mjc-membership-picker`, `mjc-space-placement` | 13 | Type cards from `SpaceType` rows, radio cards, and a preview of the tree |

### 5.3 L2 · composites (load through `ProviderToUse`, emit intent)

Each composite:

- extends `BaseAngularComponent`;
- reads through `this.ProviderToUse`, using `RunView.FromMetadataProvider(this.ProviderToUse)` and never a bare `new RunView()`;
- checks `.Success`;
- **never navigates**.

A composite can take a key (a space ID) or an already-loaded model. The session-owning ones may write: the share check promotes the item, and the new-space dialog creates the space.

| Composite | Frame | Loads | Emits |
|---|---|---|---|
| `mjc-home` | 01 | The viewer's spaces, needs-you and agenda providers, digest | `SpaceOpenRequested`, `ItemOpenRequested`, `ChatOpenRequested`, `NewSpaceRequested` |
| `mjc-space-page` | 02–06, 08–11 | The space, type, members, and extension tabs; hosts the tab composites below | `TabChangeRequested`, `InviteRequested` |
| `mjc-space-overview` | 02 | Items by band, the room preview, sub-spaces | `ShareRequested`, `PreviewAsRequested` |
| `mjc-space-library` | 03 | Files through `SpaceItem`, collections, smart views, `ItemUse` | `ShareRequested`, `RecordOpenRequested` |
| `mjc-share-check-dialog` | 04 | The item, the audience, the Assistant's findings | `BeforeItemPromoted` / `AfterItemPromoted` |
| `mjc-space-chats` | 05, 11 | The space's conversations; hosts `mj-conversation-chat-area` | `ChatOpenRequested`, `TaskCreateRequested` |
| `mjc-space-people` | 06 | Members, roles, invites, join rules | `BeforeMemberApproved` / `AfterMemberApproved`, `BeforeMemberRemoved` / `AfterMemberRemoved` |
| `mjc-participant-home` | 07, 12 | An outside participant's Shared view | `ItemOpenRequested`, `ChatOpenRequested` |
| `mjc-space-assistant-settings` | 09 | The per-space Assistant configuration (the task 6 design) | `Before…` / `After…` save pair |
| `mjc-new-space-dialog` | 13 | Space types, the parent tree, notes to carry | `BeforeSpaceCreated` / `AfterSpaceCreated` |

The Work tab (frame 10) is not an L2 composite. It hosts bizapps-tasks' own components, which are an L3 dependency, so L3 composes it ([§ 4](#4-how-explorer-hosts-it-l3)).

**The chat (frames 05 and 11)** is `mj-conversation-chat-area` from `@memberjunction/ng-conversations`, as MemberJunction's `next` has it since [MJ#4788](https://github.com/MemberJunction/MJ/pull/4788): the host rules come from `GetSpaceChatHostRules`, and agent turns go through its `AgentTurnHandler` to `ExecuteSpaceChatTurn`. What follows was written for 6.1.3. It is `standalone: false`, so import `ConversationsModule`, and its inputs are camelCase. Set these inputs:

- `environmentId`, `currentUser`, `conversationId`;
- `applicationScope="Application"` with `applicationId`;
- `linkedEntityId` and `linkedRecordId` set to the space, so new chats belong to it;
- `defaultAgentId` set to the firm's agent;
- `assistantDisplayName="Assistant"`.

Project four slots with `<ng-template mjChatSlot="…">`:

- `header`: the room name, audience chip and `mjc-chat-banner`;
- `headerActions`: search, pin and more, using `mjButton variant="icon" size="sm"`;
- `messageExtra`: `mjc-answer-receipt` and the citations;
- `emptyState`.

Use the `beforeAgentTurn` / `afterAgentTurn` pair where the host needs to know a turn is happening. The band rule itself is enforced on the server (task 6), not in the browser.

## 6. MJ components to use, and the five gaps

Use MJ's piece wherever one exists. The frames are drawn to these components' exact metrics.

| Need | Use | Notes |
|---|---|---|
| Page frame | `mj-page-layout`, `mj-page-body` | Inside the resource |
| Buttons | `mjButton` | A grey button in the frames is `variant="secondary"`, blue is `primary`, borderless is `flat`, and icon-only is `icon`. With no size class a button is `md` (44px); in rows and cards it is `size="sm"` (32px). |
| Text, textareas, selects, dates, toggles | `.mj-input`, `.mj-textarea`, `mj-dropdown`, `mj-datepicker`, `mj-switch` | Role pickers (frame 06) are `mj-dropdown` |
| Segmented tabs | `mj-tab-nav` | Library *All / Shared / Team*, Home *Active / Closed*, Work *Board / List / Timeline* |
| Filter chips | `mj-filter-chip` | Work *Everyone's / Mine / Northwind's* |
| Dialogs, panels, sheets | `mj-dialog`, `mj-slide-panel`, `mj-bottom-sheet` | Confirm on the left, cancel on the right (frames 04 and 13). The phone upload in frame 12 is `mj-bottom-sheet`. |
| Progress | `mj-progress-bar` | |
| Tooltips, loading, empty, alerts | `[mjTip]`, `<mj-loading>`, `mj-empty-state`, `mj-alert` | Every list needs a loading state and an empty state |
| Work tab: board, list, timeline | bizapps-tasks' `bizapps-task-kanban`, `bizapps-task-list`, `bizapps-task-gantt` | Amith's decision of 2026-09-23. They are an L3 dependency, so the Work tab is composed at L3 ([§ 4](#4-how-explorer-hosts-it-l3)). |
| Chat | `mj-conversation-chat-area` | See [§ 5.3](#53-l2--composites-load-through-providertouse-emit-intent) |

**The five gaps.** In each, the component we should use can't draw the frame today. Four are built locally as reviewed exceptions, and the small upstream change noted in each removes the gap later. The fifth, the board, is fixed where it lives, in bizapps-tasks.

1. **Space header.** `mj-page-header` has a 40px tinted icon, a 20px title, and meta chips under the subtitle. Build `mjc-space-header`.
2. **Rail items.** `mj-left-nav` and `mj-tree` have no item template. Build `mjc-space-rail` to `mj-left-nav`'s metrics. Upstream: an `ItemTemplate` input on `mj-left-nav`.
3. **Board cards and column labels.** `bizapps-task-kanban` draws its own fixed cards under its fixed status names (Open, InProgress, Blocked, Completed). Frame 10 needs two things it can't do:
   - Collaboration's card, `mjc-task-card`, which shows band, provenance, progress, attachment and lateness.
   - Space-worded column labels: *To do*, *In progress*, *Waiting on Northwind* (Blocked, in a client space) and *Done*.

   Add two optional inputs to `bizapps-task-kanban` in bizapps-tasks: `CardTemplate` (an `ng-template` given the task row) and `ColumnLabels` (status → label). This is not a local copy of the board. Until the inputs ship, the board shows bizapps-tasks' standard cards, and frame 10 is a known difference.
4. **The composer's audience line.** `mj-conversation-chat-area` 6.1.3 has no slot inside the composer. Until MJ adds one, render the line directly under the composer; the visual test masks that strip. Upstream: a `composerTools` slot.
5. **Avatars.** MJ ships no avatar component. Build `mjc-avatar`.

## 7. Tokens and styling

**Colors** are MJ semantic tokens only: never primitives (`--mj-color-*`) and never hex. The app adds these tokens. Each one is an expression of MJ semantic tokens, so each works in light and dark with no theme block. They are copied exactly from [`mockup/base.css`](mockup/base.css).

| Token | Value | Used for |
|---|---|---|
| `--mjc-shared` | `var(--mj-brand-tertiary-active)` | Shared text and icons |
| `--mjc-shared-strong` | `var(--mj-brand-tertiary-hover)` | Shared fills, outside-person rings, dots |
| `--mjc-shared-bg` | `var(--mj-brand-tertiary-subtle)` | Shared chips and panels |
| `--mjc-shared-border` | `color-mix(in srgb, var(--mj-brand-tertiary) 35%, transparent)` | Shared borders |
| `--mjc-team` | `var(--mj-text-secondary)` | Team text |
| `--mjc-team-strong` | `var(--mj-text-secondary)` | Team fills |
| `--mjc-team-bg` | `color-mix(in srgb, var(--mj-text-muted) 12%, transparent)` | Team chips |
| `--mjc-team-border` | `var(--mj-border-strong)` | Team borders |
| `--mjc-on-strong` | `var(--mj-text-inverse)` | Glyphs on Shared and Team fills |
| `--mjc-ai-from` / `--mjc-ai-to` | `var(--mj-brand-primary)` / `var(--mj-brand-accent)` | The Assistant's gradient |
| `--mjc-type-color` | **data** | A space type's color |

**Where the tokens live:**

- Put the app tokens in one SCSS partial in the widgets package and include it at the `:host` of each composite. Custom properties inherit, so the L1 widgets inside see them. This is the pattern `conversation-list` uses; never declare them on `:root`.
- Set `--mjc-type-color` inline from data: `[style.--mjc-type-color]="type.Color"`.

**Categorical exceptions** (data, not theme):

- A space type's color. It lives in `SpaceType.Color`, the way MJ Applications carry `Color`.
- The ten-color avatar palette. It is an L0 constant; `AvatarColor` picks from it by a stable hash of the person's ID. The values are in `base.css` (`.av.c1`–`.c10`).
- File-type colors: PDF, Word, Excel, PowerPoint, images.

**Spacing, radius and type:** use `--mj-space-*`, `--mj-radius-*` and `--mj-text-*` wherever the frame's value is on the scale, and px otherwise. The HTML pages carry the exact values.

**Fonts:** use `--mj-font-family` (Inter) and `--mj-font-family-mono`. Explorer names Inter but doesn't load it, so the visual tests load Inter 5.3.0 themselves to render deterministically.

**Icons:** Font Awesome 6.5.2, the version Explorer loads. Every icon in the frames exists in it.

**Dark mode needs no extra work.** Frame 11 is the check.

## 8. Data the frames need

**Already in place** when this plan was written:

- `Space`, with parent, `InheritsMembership`, `StartedAt` / `ClosedAt` and retention.
- `SpaceType`, with vocabulary, panel flags, defaults, invite approval and member cap.
- `SpaceMember`, with band and status.
- `SpaceRoleType`.
- `SpaceItem`, with band, promotion stamp and folder, pointing at any record through `EntityID` + `RecordID`.
- `ItemUse` and `ShareNotice`.
- MJ Files and Conversations, and bizapps-tasks.

**Gaps.** Gaps 1 to 4 are built: `SpaceType.IconClass` and `Color`, `Labels.Tabs`, `Space.PlannedCloseAt`, and the Milestone task type. The rest are proposals, each confirmed before its migration. Schema changes are a migration plus CodeGen; seed and lookup rows are `metadata/` JSON, never a migration.

| # | Gap | Frames | Proposal |
|---|---|---|---|
| 1 | A type's tile | all | `SpaceType.IconClass` (Font Awesome class) and `SpaceType.Color` (hex), like MJ Applications |
| 2 | Relabeled tabs | 08 | Per-type tab labels, for example `Library` → "Papers" and `People` → "Members", in the type's `Configuration.Labels`, with no new column. The type's UI driver can also rename or replace tabs ([extensibility plan § 4](../EXTENSIBILITY_PLAN.md#4-configuration-one-bag-per-type-and-per-space)). |
| 3 | Planned close | 01, 02, 06, 07, 13 | `Space.PlannedCloseAt`. It drives "Week 7 of 10", *Close-out*, "Access ends when Discovery closes" and *Closes on*. `ClosedAt` stays the actual close. |
| 4 | Milestones | 01, 02, 07 | A *Milestone* task type seeded by Collaboration's `metadata/` (a `MJ_BizApps_Tasks: Task Types` row) |
| 5 | Invite provenance and removal | 06 | On `SpaceMember`: `InvitedByUserID`, `ExpiresAt`, `RemovedAt` |
| 6 | Delegated invites | 06 | Per space: who may invite, allowed domain, highest role, cap. Check what already exists first. `SpaceType.InviteApproval` and `MemberCap` cover part of it. |
| 7 | Share-check findings | 02–04 | A per-item record of what the Assistant flagged and suggested, and whether each suggestion was applied |
| 8 | Unread | 01, 05 | Per-member last-visited on a space. Chats use Conversations' own read state. |
| 9 | Assistant per space | 09 | Instructions, skills, allowed agents and the chat rules, from [extensibility plan § 8](../EXTENSIBILITY_PLAN.md#8-chats-history-and-agents). Build this screen with it. |
| 10 | Committee specifics | 08, 13 | Drop `SpaceType.GovernancePanel` and the `committee` seed row. The Committees app adds its own type, plug-ins and subtype ([the extensibility plan](../EXTENSIBILITY_PLAN.md)). |

## 9. Extension points for apps on top

[The extensibility plan](../EXTENSIBILITY_PLAN.md) replaces this section. An app on top adds a **space type**, which names a server plug-in class, a browser plug-in class and, optionally, its own table extending `Space` through MJ's IsA. Tabs, cards, chips, needs-you rows and dated items come from those plug-ins and from contributions registered with metadata.

Build nothing of the earlier shape: provider classes resolved with `ClassFactory.GetAllRegistrations`, filtered by type code and ordered by `Sequence`.

**Proof for frame 08** is still a stand-in that Collaboration never ships: an example plug-in in a private package draws frame 08 in the gallery ([extensibility plan § 10](../EXTENSIBILITY_PLAN.md#103-examples-in-collaboration-itself)).

## 10. Visual tests: how "pixel perfect" is checked

Since D16 this is a regression check for the frames it covers, not the bar for the slices still to come. Since D24 the comparisons with the frames are retired or re-baselined on the new design, and the gallery's functional tests stay.

**The gallery app.** `packages/UXGallery` is private and never published. It is a plain Angular app that imports only `collaboration-ng-widgets` and MJ Generic packages, with no Explorer.

- Routes `/frame/01` … `/frame/13` render each frame from TypeScript fixtures that mirror the story's data. Take the fixtures from the `.mjs` sources in [`mockup/`](mockup/).
- `?theme=dark` sets `data-theme="dark"` on `<html>`.

**The comparison.** A Playwright test runs:

- Chromium at 1440×900 and `deviceScaleFactor: 2`;
- Inter 5.3.0 and Font Awesome 6.5.2, pinned;
- a compare of each route against `docs/ux/screens/NN-*.png` with `pixelmatch`: threshold 0.1 and a small total-difference budget, with a diff PNG saved as a CI artifact on failure.

Frame 10 is compared in Explorer, not in the gallery, because its board is bizapps-tasks' component: an L3 dependency the gallery doesn't load.

**What the comparison masks:**

- the Explorer top bar, the first 56px, which the gallery draws as a static stand-in;
- in frame 12, everything outside the three phone screens, which are compared individually;
- the composer audience strip, until MJ ships the composer slot (gap 4 in [§ 6](#6-mj-components-to-use-and-the-five-gaps)).

**Real data in Explorer.** A dev-only loader under `scripts/` seeds the story's data. It is not a migration and not shipped metadata. Each slice's PR attaches Explorer screenshots of its frames, light and dark.

## 11. Order of work

Work in vertical slices. Slice A ended with its frames passing in the gallery and its Explorer screenshots in the PR. Slices B to I end with their screens working in Explorer and the builder's end-to-end screenshots in the pull request (D16).

1. **Scaffold:**
   - Delete the old UI.
   - Create `packages/AngularWidgets` and `packages/UXGallery`.
   - Declare `mjUILayer` everywhere and adopt and lock the `ui-layers` gate.
   - Add the tokens partial.
   - Build the Playwright harness, with frame 02's chrome as its first test.
2. **Foundations (L1):** avatar and stack, type tile, band chip, audience pill and line, space header, space tabs, rail. Includes data gaps 1 and 3.
3. **Slice A: Discovery.** Frames 02, 03 and 04, plus gap 7.
4. **Slice B: chats.** Frames 05 and 11.
5. **Slice C: people.** Frame 06, plus gaps 5 and 6.
6. **Slice D: home.** Frame 01, plus gaps 4 and 8, from Collaboration's own data. Its needs-you and agenda rows move onto the extensibility plan's providers when that plan is built ([its § 13](../EXTENSIBILITY_PLAN.md#13-order-of-work)).
7. **Slice E: work.** Frame 10, plus the `CardTemplate` and `ColumnLabels` inputs on `bizapps-task-kanban` (a small PR in bizapps-tasks).
8. **Slice F: outside participants.** Frames 07 and 12.
9. **Slice G: Assistant settings.** Frame 09, built with [extensibility plan § 8](../EXTENSIBILITY_PLAN.md#8-chats-history-and-agents), after the other slices.
10. **Slice H: new space.** Frame 13, plus gap 2.
11. **Slice I: extension points.** Frame 08, through the extensibility plan's example plug-in, plus gap 10, after the other slices.

Each slice is its own commit series and review. Don't do this as one big sweep: one slice finished properly, with tests, teaches the pattern for the rest.
