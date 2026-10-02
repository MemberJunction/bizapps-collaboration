# @mj-biz-apps/collaboration-ng-widgets

Collaboration's Angular widgets. They take plain values, emit events, and work in any Angular app, not only in Explorer.

- **Layer:** `widgets` (L1 and L2).
- **In `mj-app.json`:** client, `library`.
- **Depends on:** `collaboration-core` and `collaboration-entities`. Peers: Angular 21 (`animations`, `common`, `core`, `forms`) and MJ's `conversations-runtime`, `core`, `core-entities`, `global`, `ng-base-forms`, `ng-base-types`, `ng-conversations`, `ng-entity-viewer`, `ng-shared-generic` and `ng-ui-components`.
- **Never imports** `@angular/router`, `@memberjunction/ng-shared` or an Explorer package, and never navigates. MJ's `ui-layers` check enforces the layer.

## What's in it

**Widgets and Composites** (L1 and L2). Inputs are PascalCase. Most events are requests named `…Requested`, which the host decides whether to act on; the rest report something the widget used up, such as `ComposerDraftConsumed`.

| Selector | Class | What it draws |
|---|---|---|
| `mjc-avatar` | `CollabAvatarComponent` | A person's initials or photo, a stable color from their ID, and outside or online marks |
| `mjc-avatar-stack` | `CollabAvatarStackComponent` | Overlapping avatars with a "+N" count |
| `mjc-type-tile` | `CollabTypeTileComponent` | A space type's icon on its color, in the disabled color when the space is closed |
| `mjc-band-chip` | `CollabBandChipComponent` | The Team or Shared chip |
| `mjc-audience-pill` | `CollabAudiencePillComponent` | Staff and outside avatars with the audience summary, such as "9 people · 3 Meridian · 6 Northwind" |
| `mjc-space-header` | `CollabSpaceHeaderComponent` | The breadcrumb, type tile, title, type and status chips, and subtitle |
| `mjc-space-tabs` | `CollabSpaceTabsComponent` | The space's tabs with counts, on MJ's tab list. Emits `TabSelectRequested`; the host sets `ActiveTab`. |
| `mjc-space-rail` | `CollabSpaceRailComponent` | The left rail: on Home, the nav and the space tree with keyboard access; in a space, its tabs and conversations. It resizes and collapses, and remembers both per person (`mjc.spaceNav.state`, through `UserInfoEngine`). Its events include `NavSelectRequested`, `SpaceOpenRequested`, `TabSelectRequested`, `ConversationSelectRequested`, `NewConversationRequested` and `BackToSpacesRequested`. |
| `mjc-file-icon` | `CollabFileIconComponent` | File type icon for PDF, Word, Excel, PowerPoint, Image, Text |
| `mjc-item-card` | `CollabItemCardComponent` | Shared grid card with type icon, name, meta, audience avatar, and status |
| `mjc-item-row` | `CollabItemRowComponent` | Library table row with type icon, name, version, band chip, share button, and menu |
| `mjc-ask-box` | `CollabAskBoxComponent` | Room assistant input with suggestions and ask button |
| `mjc-needs-you-card` | `CollabNeedsYouCardComponent` | Overview attention strip card for requests, reviews, and overdue tasks |
| `mjc-item-preview` | `CollabItemPreviewComponent` | Right drawer preview with doc page snippet, marked text, audience stack, and recent uses |
| `mjc-share-check` | `CollabShareCheckComponent` | Pre-share finding review panel with recipient cards and finding resolution controls |
| `mjc-space-overview` | `CollabSpaceOverviewComponent` | Frame 02 Overview page composite (needs-you strip, cards grid, mini room, sub-spaces), with a read-only About card for the details a space's type keeps of its own, which the host draws in the `[mjcAbout]` slot |
| `mjc-space-library` | `CollabSpaceLibraryComponent` | Frame 03 Library page composite (collections, files table, item preview drawer) |
| `mjc-share-check-dialog` | `CollabShareCheckDialogComponent` | Frame 04 Share check modal dialog composite. It opens with the focus on its content, not on a button, so Enter right after it opens shares nothing |
| `mjc-upload-dialog` | `CollabUploadDialogComponent` | Uploads a file to a space, in a band the seat may choose |
| `mjc-new-conversation-dialog` | `CollabNewConversationDialogComponent` | Starts a conversation: its name and kind (General, Topic or Internal Only) |
| `mjc-home-list` | `CollabHomeListComponent` | The rows behind one of Home's counts, how many there are in all when the list is cut short, and a failed read with a way to try again |
| `mjc-new-space-dialog` | `CollabNewSpaceDialogComponent` | Starts a space: its kind, its name and description, and the kind's own details, which the host draws in the `[mjcDetails]` slot and holds Create for until the required ones are filled in |
| `mjc-space-work` | `CollabSpaceWorkComponent` | The Work tab's task list |
| `mjc-space-chat` | `CollabSpaceChatComponent` | MJ's chat area for a space's conversation, with the host rules from the server and no voice call. `IsReadOnly` sets the chat area's own `ReadOnly`, which puts `ReadOnlyNote` where the composer was, and shows a lock in the chat's header, a button whose note shows on focus and toggles on a tap, a click, Enter or Space; Escape or a tap elsewhere closes it. The host sets the note: a closed space, a reader with no seat that can post, or a seat the page couldn't check. Until the host knows the reader's seat (`IsPending`), it shows a loading mark and neither the chat area nor a note. A reply is named for the agent that made it. It starts MJ's status subscription, so a reply shows its live status |
| `mjc-space-people` | `CollabSpacePeopleComponent` | The People tab: who reaches the space, and invitations |
| `mjc-space-settings` | `CollabSpaceSettingsComponent` | The Settings tab, including close and reopen, and a Details card for the type's own details, which the host draws in the `[mjcSettingsDetails]` slot, with a Save and Discard of its own |

The four dialogs draw through MJ's `mj-dialog`, which also gives them their first focus, keeps Tab inside and returns focus on close. The New conversation and New space dialogs only add one thing of their own: when a submit ends, the name field takes the focus again.

**The extension model's browser half:** `BaseSpaceTypeUIDriver` (a type's UI driver) and `UIDriverRegistry`, the contribution bases `BaseSpaceTab`, `BaseSpaceOverviewCard` and `BaseSpaceSettingsSection`, and `assembleSpaceContributions` and `overlayDescriptors`, which merge what a type and other apps contribute. A driver's `GetDetailsForm` says how a type's details are drawn: `undefined` for none, `hiddenFieldNames` to leave optional fields out of the field list, or `component` for a component of its own, mounted with `Record` and `EditMode`.

**Tokens** (`src/lib/tokens.ts` and `src/lib/_tokens.scss`): the app's `--mjc-*` tokens (the Shared and Team colors, the Assistant's gradient, warning colors, line height and font features), each an expression of an MJ semantic token. `COLLAB_TOKENS_CSS` is exported and bound to `:host` in the widgets' styles, so the tokens resolve in any host; a widget drawn inside another inherits them.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-ng-widgets run build
pnpm --filter @mj-biz-apps/collaboration-ng-widgets test
```

The build is `ngc`, into `dist/`. The tests use Vitest, 161 in all: `widgets.test.ts` and `ui-driver.test.ts` exercise the classes, and `render.test.ts` renders the dialogs, the rail, Settings with its Details card, the Overview's About card and contributed cards, Home's lists and a space's conversation, read-only with its note too (with a stand-in for MJ's chat area), in jsdom. The root `pnpm test` runs them too. They build against MemberJunction's `next`. The UX gallery renders the widgets for its own specs.

