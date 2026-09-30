# @mj-biz-apps/collaboration-ng

Collaboration's Explorer surface: the client bootstrap, the Explorer resource behind the app's nav item, and the generated entity forms.

- **Layer:** `surface` (L3), the only layer that touches Explorer.
- **In `mj-app.json`:** client, `bootstrap`, with `startupExport` `LoadBizAppsCollaborationClient`.
- **Depends on:** `collaboration-core`, `collaboration-engine-base`, `collaboration-entities` and `collaboration-ng-widgets`. Peers: Angular 21 (`common`, `core`, `forms`), MJ's `conversations-runtime`, `core`, `core-entities`, `global`, `ng-base-application`, `ng-base-forms`, `ng-conversations`, `ng-entity-viewer`, `ng-link-directives`, `ng-shared`, `ng-shared-generic` and `ng-ui-components`, and bizapps-tasks' `tasks-entities` and `tasks-ng`.

## What's in it

**`LoadBizAppsCollaborationClient()`** (`src/public-api.ts`) is what MJExplorer calls at startup. It registers the permission provider from `collaboration-entities` and references the two components below, so the bundler keeps them.

**`CollaborationSectionResource`** (`src/lib/collaboration-section.component.ts`, selector `mjc-collaboration-section`) is the Explorer resource behind the app's one nav item.
- It's registered with `@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')`, the `DriverClass` that `metadata/applications/` names.
- Its tab shows the open space's name, or "Spaces", with the `fa-people-group` icon.
- It's the whole Explorer surface:
  - Home (the spaces you reach, with the counts `GetHomeCounts` reads; Open Tasks and Invitations Waiting open the rows behind them, from `GetHomeLists`), Inbox, My Tasks and Files;
  - a space's page, with Overview, Library, Work (list, board and timeline), Chat, People, Settings, and any tabs a type or another app contributes;
  - the share, upload, new-conversation and New space dialogs. New space is offered from the rail's + to someone who holds *Administer Spaces* and may create Space rows: it lists the active types, draws a type's details when the type names a subtype, and asks the server's `CreateSpace` to write the space, its subtype and the person's owner seat in one transaction. When kinds are picked in quick succession, only the latest pick's draft reaches the screen (`NewSpacePicks`, over `LatestOnly`).
- A space whose type names a subtype shows its details in a Details card in Settings, editable by someone who may change settings, and read-only in an About card on the Overview (`src/lib/logic/space-details.ts`).
- One component draws those details on all three screens (`SpaceDetailsViewComponent`, `src/lib/space-details-view.component.ts`): a component the type's UI driver gives; else MJ's form for the subtype through `mj-entity-form-host` (no toolbar, no related entities, no record links), when the subtype's own columns sit in sections of it that hold none of the space's, showing only those sections (`VisibleSectionKeys`); else a field for each column the subtype adds. `planDetailsView` (`src/lib/logic/details-view.ts`) decides which, and `ownFormSections` in `collaboration-entities` finds the sections.
- Settings closes and reopens a space, and the confirmation shows what `GetCloseConsequence` says a close will do.
- The query parameters are `view`, `space`, `tab`, `item`, `conv` and `workView`, and back and forward restore them. It calls `SetAgentContext` and `NotifyLoadComplete()`.
- The page's decisions that don't need Angular live in `src/lib/logic/`, as plain functions with their own tests.

**`CollaborationNoAccessComponent`** (`src/lib/no-access.component.ts`, selector `mjc-no-access`) is the branded page for someone with no seat on a space. It uses MJ's `mj-empty-state`, and its text comes from `lockoutMessage` in `collaboration-core`: a pending invite, a removed seat, or how to get one. Its inputs are `Seats` and `CustomMessage`.

**Generated forms** (`src/lib/generated/`, from CodeGen) for the eleven entities, in `generated-forms.module.ts`. Never edit them by hand.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-ng run build
```

The build is `ngc`, into `dist/`. Its `test` script typechecks, runs every `node:test` file in `src/lib/logic/` through a glob (`'src/lib/logic/*.test.ts'`, 148 tests), then runs Vitest on the rendered tests (`*.render.test.ts`, in jsdom: five of the details view, with stand-ins for MJ's form host and fields). The root `pnpm test` runs them too.

## Not done yet

- A sub-space made through the New space dialog.
- Header chips, needs-you items and agenda items from contributions.
