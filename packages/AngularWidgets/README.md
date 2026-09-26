# @mj-biz-apps/collaboration-ng-widgets

Collaboration's Angular widgets. They take plain values, emit events, and work in any Angular app, not only in Explorer.

- **Layer:** `widgets` (L1 and L2).
- **In `mj-app.json`:** client, `library`.
- **Depends on:** `collaboration-core` and `collaboration-entities`. Peers: Angular 21 (`animations`, `common`, `core`, `forms`) and MJ's `core`, `core-entities`, `global`, `ng-base-forms`, `ng-base-types`, `ng-conversations`, `ng-entity-viewer`, `ng-shared-generic` and `ng-ui-components`.
- **Never imports** `@angular/router`, `@memberjunction/ng-shared` or an Explorer package, and never navigates. MJ's `ui-layers` check enforces the layer.

## What's in it

**Eight standalone widgets** (L1). Inputs are PascalCase, and every event is a request named `…Requested`, which the host decides whether to act on.

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

**Types** (`src/lib/types.ts`): `AvatarItem`, `TabItem`, `BreadcrumbItem`, `RailSpaceNode` and `SpaceBand`.

**Two extension base classes** for other apps to extend: `BaseSpaceTab` (inputs `SpaceId`, `SpaceTypeCode` and `Sequence`) and `BaseSpaceOverviewCard` (`SpaceId` and `Sequence`).

**Tokens** (`src/lib/_tokens.scss`): the app's `--mjc-*` tokens (the Shared and Team colors, the Assistant's gradient, the widgets' line height and font features), each an expression of an MJ semantic token. The mixin applies them at `:host`. A space type's color is data: it comes in through an input, not from a stylesheet.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-ng-widgets run build
pnpm --filter @mj-biz-apps/collaboration-ng-widgets test
```

The build is `ngc`, into `dist/`. The tests use Vitest: 17 tests in `widgets.test.ts`, which exercise the component classes without rendering them. The root `pnpm test` runs them too. The UX gallery renders the widgets for the visual test.

## Not done yet

- **The L2 composites,** which load data through `ProviderToUse` and emit intent: `mjc-space-page`, `mjc-space-overview`, `mjc-space-library` and `mjc-share-check-dialog` come with slice A of [the UI plan](../../docs/ux/IMPLEMENTATION_PLAN.md), with the widgets they need.
- **The extension classes** aren't loaded by any code yet. The [extensibility plan](../../docs/EXTENSIBILITY_PLAN.md) replaces them.
