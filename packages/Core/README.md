# @mj-biz-apps/collaboration-core

The rules of Collaboration as pure functions, plus the view models and extension contracts the UI shares.

- **Layer:** `runtime` (L0). No Angular, no database and no MemberJunction imports, so the same functions run in the browser, on the server and under `node:test`.
- **In `mj-app.json`:** shared, `library`.
- **Dependencies:** none at run time.

The server's write gates, the browser and the SQL function `fnCollaborationAccess` all follow this package. A change to a rule here is a change to the security model, and the tests move with it.

## What's in it

**`src/rules.ts`: reach, seats, items and the agent's rule.**
- **Reach:** `membershipReaches` finds the seat that governs a space for a person: a direct seat wins, otherwise the walk goes up while each space inherits membership. `rosterBySeat` lists everyone who reaches a space, grouped by the space they sit on. `visibleSpaces` filters a list of spaces to the ones a person reaches.
- **Spaces:** `planSpaceWrite`, `chainsForSpaceWrite` and `authorizeSpaceWrite` decide who may create a root, create a child, edit or move a space. `parentCreatesCycle` refuses a move into a space's own subtree.
- **Seats:** `refuseInvite` applies the invitation ceiling: the signer reaches the space, holds `CanInvite`, and grants a role whose level is at most their `MaxGrantableLevel` and whose flags they hold themselves. It also applies the type's member cap, and lets the owner of an empty space seat themselves. `flagExceedsGrantor`, `initialMemberStatus`, `isSelfRemoval`, `strandFromSavedRow`, `wouldStrandLastOwner` and `leavingWouldStrand` cover the rest of a seat change. `rosterActions` and `resourcesFromRoster` turn reach into Read, Update and Share for the permission domain.
- **Items and bands:** `authorizeItemWrite` decides a new, moved or re-banded item, and the promotion stamp. `promotionStamps` does the same for a band change alone. `mayFileRootTask` applies the item rules to a task filed at a space's root.
- **Tasks:** `authorizeTaskAssignment` refuses a Team task for someone who can't see Team, and an assignee seated above the task's space when the space doesn't allow parent assignees and the caller isn't staff.
- **The agent:** `agentMayQuote` narrows what an agent may quote to the asked space's subtree, the caller's band, and each space's `AgentRetrieval`. It never widens the caller's own read.
- **Invitations:** `callerMayReceiveLink`, `magicLinkBlocksAccount`, `linkHandoff`, `inviteEmail`, `handInviteToEngine` and `lockoutMessage`.
- **Retention:** `retentionDeadline` turns `Month`, `Year` or `Indefinite` into a date.

**`src/phase2.ts`: the library.**
- `SPACE_UPLOAD_MAX_BYTES` (10 MB), `storedContentType` (the stored type never carries script) and `openMode` (inline, text or download).
- `requestedItemBand` picks a new upload's band from the type's default.
- `authorizeUseWrite` and `authorizeNoticeWrite` gate item uses and share notices, and `shareRecipients` lists who hears about a share.
- `foldersIn` lists a space's folders, and `recordUse` builds an item-use record.

**`src/view-models.ts`: view models and extension contracts.**
- `avatarColorClass`, `summarizeAudience` (the audience pill and composer lines) and `computeSpaceProgress` ("Week 7 of 10").
- `mergeAgenda` merges dated items from several sources.
- Three abstract classes for other apps to extend: `NeedsYouProvider`, `AgendaProvider` and `SpaceHeaderChipProvider`.

`src/index.ts` exports all of the above. `src/phase0.fixture.ts` is test data and isn't compiled.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-core run build
```

The build is `tsc`, into `dist/`. The tests use `node:test`: `rules.test.ts`, `phase0.test.ts` and `view-models.test.ts`, 89 tests in all. The root `pnpm test` runs all three. This package's own `test` script runs `rules.test.ts` only.

## Not done yet

- No code loads the three provider classes yet, and `SpaceHeaderChipProvider.getChips` takes a space and a type code but not the viewer. The [extensibility plan](../../docs/EXTENSIBILITY_PLAN.md) replaces them.
- Nothing calls `retentionDeadline` yet. Closure and retention come later in the plan.
