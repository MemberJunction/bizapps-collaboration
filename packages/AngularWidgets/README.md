# @mj-biz-apps/collaboration-ng-widgets

Collaboration's Angular widgets. They take plain values, emit events, and work in any Angular app, not only in Explorer.

- **Layer:** `widgets` (L1 and L2).
- **In `mj-app.json`:** client, `library`.
- **Depends on:** `collaboration-core` and `collaboration-entities`. Peers: Angular 21 (`animations`, `common`, `core`, `forms`) and MJ's `core`, `core-entities`, `global`, `ng-base-forms`, `ng-base-types`, `ng-conversations`, `ng-entity-viewer`, `ng-shared-generic` and `ng-ui-components`.
- **Never imports** `@angular/router`, `@memberjunction/ng-shared` or an Explorer package, and never navigates. MJ's `ui-layers` check enforces the layer.

## What's in it

**Widgets and Composites** (L1 and L2). Inputs are PascalCase, and every event is a request named `…Requested`, which the host decides whether to act on.

| Selector | Class | What it draws |
|---|---|---|
| `mjc-avatar` | `CollabAvatarComponent` | A person's initials or photo, a stable color from their ID, and outside or online marks |
| `mjc-avatar-stack` | `CollabAvatarStackComponent` | Overlapping avatars with a "+N" count |
| `mjc-type-tile` | `CollabTypeTileComponent` | A space type's icon on its color, in the disabled color when the space is closed |
| `mjc-band-chip` | `CollabBandChipComponent` | The Team or Shared chip |
| `mjc-audience-pill` | `CollabAudiencePillComponent` | Staff and outside avatars with the audience summary, such as "9 people · 3 Meridian · 6 Northwind" |
| `mjc-space-header` | `CollabSpaceHeaderComponent` | The breadcrumb, type tile, title, type and status chips, and subtitle |
| `mjc-space-tabs` | `CollabSpaceTabsComponent` | The space's tabs with counts, on MJ's tab list. Emits `TabSelectRequested`; the host sets `ActiveTab`. |
| `mjc-space-rail` | `CollabSpaceRailComponent` | The left rail: nav, jump, and the space tree with keyboard access. Emits `NavSelectRequested`, `SpaceOpenRequested`, `SpaceToggleRequested`, `SpaceCreateRequested` and `JumpOpenRequested`. |
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

**Tokens** (`src/lib/tokens.ts` and `src/lib/_tokens.scss`): the app's `--mjc-*` tokens (the Shared and Team colors, the Assistant's gradient, warning colors, line height and font features), each an expression of an MJ semantic token. `COLLAB_TOKENS_CSS` is exported and bound to `:host` in every widget's styles, ensuring tokens resolve in any host environment.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-ng-widgets run build
pnpm --filter @mj-biz-apps/collaboration-ng-widgets test
```

The build is `ngc`, into `dist/`. The tests use Vitest: 37 tests in `widgets.test.ts`, which exercise the component classes without rendering them. The root `pnpm test` runs them too. The UX gallery renders the widgets for the visual test.

