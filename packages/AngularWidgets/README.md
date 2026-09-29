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
| `mjc-space-overview` | `CollabSpaceOverviewComponent` | Frame 02 Overview page composite (needs-you strip, cards grid, mini room, sub-spaces) |
| `mjc-space-library` | `CollabSpaceLibraryComponent` | Frame 03 Library page composite (collections, files table, item preview drawer) |
| `mjc-share-check-dialog` | `CollabShareCheckDialogComponent` | Frame 04 Share check modal dialog composite |
| `mjc-upload-dialog` | `CollabUploadDialogComponent` | Uploads a file to a space, in a band the seat may choose |
| `mjc-new-conversation-dialog` | `CollabNewConversationDialogComponent` | Starts a conversation: its name and kind (General, Topic or Internal Only) |
| `mjc-space-work` | `CollabSpaceWorkComponent` | The Work tab's task list |
| `mjc-space-chat` | `CollabSpaceChatComponent` | MJ's chat area for a space's conversation, with the host rules from the server and no voice call |
| `mjc-space-people` | `CollabSpacePeopleComponent` | The People tab: who reaches the space, and invitations |
| `mjc-space-settings` | `CollabSpaceSettingsComponent` | The Settings tab, including close and reopen |

The three dialogs draw through MJ's `mj-dialog`. `CollabDialogBase` (`dialog-base.ts`) adds their first focus, a Tab trap and the return of focus.

**The extension model's browser half:** `BaseSpaceTypeUIDriver` (a type's UI driver) and `UIDriverRegistry`, the contribution bases `BaseSpaceTab`, `BaseSpaceOverviewCard` and `BaseSpaceSettingsSection`, and `assembleSpaceContributions` and `overlayDescriptors`, which merge what a type and other apps contribute.

**Tokens** (`src/lib/tokens.ts` and `src/lib/_tokens.scss`): the app's `--mjc-*` tokens (the Shared and Team colors, the Assistant's gradient, warning colors, line height and font features), each an expression of an MJ semantic token. `COLLAB_TOKENS_CSS` is exported and bound to `:host` in the widgets' styles, so the tokens resolve in any host; a widget drawn inside another inherits them.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-ng-widgets run build
pnpm --filter @mj-biz-apps/collaboration-ng-widgets test
```

The build is `ngc`, into `dist/`. The tests use Vitest, 131 in all: `widgets.test.ts` and `ui-driver.test.ts` exercise the classes, and `render.test.ts` renders the dialogs, the rail, Settings and a space's conversation (with a stand-in for MJ's chat area) in jsdom. The root `pnpm test` runs them too. They build against MemberJunction's `next`. The UX gallery renders the widgets for its own specs.

