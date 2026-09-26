# @mj-biz-apps/collaboration-ng

Collaboration's Explorer surface: the client bootstrap, the Explorer resource behind the app's nav item, and the generated entity forms.

- **Layer:** `surface` (L3), the only layer that touches Explorer.
- **In `mj-app.json`:** client, `bootstrap`, with `startupExport` `LoadBizAppsCollaborationClient`.
- **Depends on:** `collaboration-core`, `collaboration-entities` and `collaboration-ng-widgets`. Peers: Angular 21 (`common`, `core`, `forms`), MJ's `core`, `core-entities`, `global`, `ng-base-application`, `ng-base-forms`, `ng-conversations`, `ng-entity-viewer`, `ng-link-directives`, `ng-shared` and `ng-ui-components`, and bizapps-tasks' `tasks-entities` and `tasks-ng`.

## What's in it

**`LoadBizAppsCollaborationClient()`** (`src/public-api.ts`) is what MJExplorer calls at startup. It registers the permission provider from `collaboration-entities` and references the two components below, so the bundler keeps them.

**`CollaborationSectionResource`** (`src/lib/collaboration-section.component.ts`, selector `mjc-collaboration-section`) is the Explorer resource behind the app's one nav item.
- It's registered with `@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')`, the `DriverClass` that `metadata/applications/` names.
- Its tab is named "Spaces", with the `fa-people-group` icon.
- Today it's an empty page: `mj-page-layout` and `mj-page-body` around a placeholder, and it calls `NotifyLoadComplete()` when it starts.

**`CollaborationNoAccessComponent`** (`src/lib/no-access.component.ts`, selector `mjc-no-access`) is the branded page for someone with no seat on a space. It uses MJ's `mj-empty-state`, and its text comes from `lockoutMessage` in `collaboration-core`: a pending invite, a removed seat, or how to get one. Its inputs are `Seats` and `CustomMessage`.

**Generated forms** (`src/lib/generated/`, from CodeGen) for the seven entities, in `generated-forms.module.ts`. Never edit them by hand.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-ng run build
```

The build is `ngc`, into `dist/`. There are no tests yet.

## Not done yet

The space page itself. Slice A of [the UI plan](../../docs/ux/IMPLEMENTATION_PLAN.md) builds it here:
- the page hosted by `CollaborationSectionResource`, with `NavigationService` and the query parameters `view`, `space`, `tab` and `item`;
- `SetAgentContext(...)`, and `mjc-no-access` for a viewer with no seat;
- the Work tab, on bizapps-tasks' own components, comes in a later slice.
