# @mj-biz-apps/collaboration-core

The rules of Collaboration as pure functions, plus the view models and extension contracts the UI shares.

- **Layer:** `runtime` (L0). No Angular, no database and no MemberJunction imports, so the same functions run in the browser, on the server and under `node:test`.
- **In `mj-app.json`:** shared, `library`.
- **Dependencies:** none at run time.

The server's write gates, the browser and the SQL function `fnCollaborationAccess` all follow this package. A change to a rule here is a change to the security model, and the tests move with it.

## What's in it

**`src/rules.ts`: reach, seats, items and the agent's rule.**
- **Reach:** `membershipReaches` finds the seat that governs a space for a person: a direct seat wins, otherwise the walk goes up while each space inherits membership. `isPostCloseAccessPermitted` and `isAgentPostCloseAccessPermitted` say whether a closed space is still readable, and by an agent. `rosterBySeat` lists everyone who reaches a space, grouped by the space they sit on. `visibleSpaces` filters a list of spaces to the ones a person reaches.
- **Spaces:** `planSpaceWrite`, `chainsForSpaceWrite` and `authorizeSpaceWrite` decide who may create a root, create a child, edit or move a space. `parentCreatesCycle` refuses a move into a space's own subtree.
- **Seats:** `refuseInvite` applies the invitation ceiling: the signer reaches the space, holds `CanInvite`, and grants a role whose level is at most their `MaxGrantableLevel` and whose flags they hold themselves. It also applies the type's member cap, and lets the owner of an empty space seat themselves. `flagExceedsGrantor`, `initialMemberStatus`, `isSelfRemoval`, `strandFromSavedRow`, `wouldStrandLastOwner` and `leavingWouldStrand` cover the rest of a seat change. `rosterActions` and `resourcesFromRoster` turn reach into Read, Update and Share for the permission domain.
- **Items and bands:** `authorizeItemWrite` decides a new, moved or re-banded item, and the promotion stamp. `promotionStamps` does the same for a band change alone. `mayFileRootTask` applies the item rules to a task filed at a space's root.
- **Tasks:** `authorizeTaskAssignment` refuses a Team task for someone who can't see Team, and an assignee seated above the task's space when the space doesn't allow parent assignees and the caller doesn't hold *Administer Spaces* (`callerMayAdminister`).
- **The agent:** `agentMayQuote` narrows what an agent may quote to the asked space's subtree, the caller's band, and each space's `AgentRetrieval`. It never widens the caller's own read.
- **Invitations:** `callerMayReceiveLink`, `magicLinkBlocksAccount`, `linkHandoff`, `inviteEmail`, `handInviteToEngine` and `lockoutMessage`.
- **Retention:** `retentionDeadline` turns `Month`, `Year` or `Indefinite` into a date.

**`src/phase2.ts`: the library.**
- `SPACE_UPLOAD_MAX_BYTES` (10 MB), and `storedContentType` (the stored type never carries script).
- `requestedItemBand` picks a new upload's band from the type's default, and `uploadBandChoice` says which bands the upload dialog offers.
- `authorizeUseWrite` and `authorizeNoticeWrite` gate item uses and share notices, and `shareRecipients` lists who hears about a share.
- `foldersIn` lists a space's folders, and `recordUse` builds an item-use record.

**`src/configuration.ts`: settings.** `CollaborationSettings`, resolved from the app down through the type, the parents and the space (`ResolveCollaborationSettings`), where a type's `SpaceOverridable` names the keys a space may set, and checked by `ValidateCollaborationSettings`. `ResolveSpaceRules` and the type validators cover a type's own rules, and `refuseChildType` its `Children` rules.

**`src/retrieval.ts`: the audience rule.** `effectiveRetrievalScope` works out what an agent may search for a question: the caller's reach, narrowed by a scope, or the intersection of every participant's.

**`src/detail-fields.ts`: a subtype's own fields.** `detailFields` picks, from a subtype entity's columns, the ones it adds to a space (not the key, a column of the space, a view-only column or a `__mj_` column), in the entity's order, and marks those a space can't be saved without as required. `visibleDetailFields` applies a UI driver's hidden fields (never a required one) and `missingDetails` lists the required ones still empty.

**`src/view-models.ts`: view models and extension contracts.**
- `avatarColorClass`, `summarizeAudience` (the audience pill and composer lines) and `computeSpaceProgress` ("Week 7 of 10").
- `mergeAgenda` merges dated items from several sources.
- Abstract classes for other apps to extend: `NeedsYouProvider`, `AgendaProvider` and `SpaceHeaderChipProvider`, and their batch forms `BaseNeedsYouProvider`, `BaseAgendaProvider` and `BaseSpaceHeaderChipProvider`, which take the viewer.

`src/index.ts` exports all of the above. `src/phase0.fixture.ts` is test data and isn't compiled.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-core run build
```

The build is `tsc`, into `dist/`. The tests use `node:test`: `rules`, `phase0`, `view-models`, `configuration`, `detail-fields` and `retrieval`, 140 tests in all. The root `pnpm test` runs all six. This package's own `test` script runs `rules.test.ts` only.

## Not done yet

- Nothing in the app calls the providers yet; only the example board extends them. The [extensibility plan](../../docs/EXTENSIBILITY_PLAN.md) describes where the screens will show them.
- Nothing calls `retentionDeadline` yet. Closing works; retention comes later in the plan.
