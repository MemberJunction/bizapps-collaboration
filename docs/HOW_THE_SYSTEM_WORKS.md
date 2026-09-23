# How Collaboration works

A space is a tree. The root is a relationship (a client, a committee, a cohort). The children are the pieces of work inside it. Closing a child sets `ClosedAt`. The root stays.

Two rules decide what a person can see, and they are the same rules in three places: `packages/Core/src/rules.ts`, the server subclasses, and `fnCollaborationAccess` in the database.

1. **Reach.** An active membership on a space reaches that space and every descendant whose `InheritsMembership` is true. A space with `InheritsMembership = 0` is sealed. A parent member does not enter it.
2. **Band.** Shared items are visible to anyone who reaches the space. Team items are visible only when the reaching role has `CanSeeTeamBand`. `agentMayQuote` is the rule an agent must call before it quotes an item. Nothing in the save path calls it yet. Row-level security enforces reach and band. Agent retrieval is not enforced until a search scope is wired.

The caller's own grants are the ceiling. These rules only narrow.

## Invitation

`SpaceMemberEntityServer.ValidateAsync` calls `refuseInvite` before a roster row is written.

- The signer must reach the target space.
- Their role must have `CanInvite`.
- The granted role's `Level` must be at or below the signer's `MaxGrantableLevel`.
- The type's `MemberCap` counts every row that is not `Removed`.
- `InviteApproval = AutoApprove` stores the new row as `Active`. Otherwise it is `Invited`.
- The owner of a space with an empty roster may seat themselves in the owner role. An owner may also grant the owner role, so a space can have more than one owner.
- `InviteApproval = Approve` stays `Invited` until an owner sets the row `Active`. The invited person does not activate themselves. `AutoApprove` stores the new row as `Active`.

The engine reads role flags. It does not compare role names.

## Items

An item is `EntityID` + `RecordID` in exactly one space. The unique key is `(EntityID, RecordID)`. `SpaceItemEntityServer` writes the promotion stamp: a Team item has none, a Shared item records the signer and the time. Promoting requires `CanPromoteBand`.

A file, a conversation, or a task is an item. This app does not copy those tables. Point `EntityID` and `RecordID` at the record that already exists.

## Who can read

`migrations/V202609230010__v0.1.x__Access.sql` creates:

- `fnCollaborationAccess(@UserID)`, the SQL form of the reach walk, plus whether that reach may see the team band.
- Row-level security filters, attached to the **Space Participant** role. The filters are never NULL. A NULL filter on a grant the person holds exempts them from row-level security for that operation. A share notice is readable only by the member it is addressed to, inside a space they reach. An item use is the caller's own row, inside a space they reach. Creating either row carries a create filter, and the server subclass is the rest of the gate.
- A `ResourceType` named `Space`, so a magic link of kind `resource-share` can name a space.

The owner of a space can read it before the first roster row exists. A magic-link scope (`{{ScopeResourceID}}`) can read that one space and its Shared items.

Do not also grant Space Participant the `UI` role. `UI` carries unfiltered permissions, and one unfiltered permission exempts the user from every filter.

## The workspace

`mj-collaboration-workspace` is the screen: the tree, the roster, the material, and an invite form. The form calls `refuseInvite` with the same inputs the server will, and shows the refusal before the save. `mj-collaboration-no-access` is the page a person sees when they are signed in and not on the roster. The components do not load data. The host passes the rows in.

## What this repo does not contain

These are named in the plan and belong in other repositories. They are not implemented here, and the live checkouts of those repositories are not modified by this work.

- Hierarchy path columns and traversal functions. `ParentID` does not carry the `IsHierarchy` flag (set in one migration, cleared in the next), so CodeGen emits no path columns or traversal functions. Access uses `fnCollaborationAccess`, which is T-SQL and needs a PostgreSQL port.
- Minting a magic-link token. That stays in MemberJunction's magic-link API. This app registers the `Space` resource type and accepts `{{ScopeResourceID}}`. A host mints `Kind: resource-share` with that space id and the Space Participant role.
- The filter text is T-SQL (`TRY_CAST`, bracketed names). A PostgreSQL host needs a dialect of the same function before the filters run.
- Committees moving its membership onto Space.
- Platform work in MemberJunction itself: presence, @mention notifications, per-user read state, live message fan-out, and the search fixes.
- A license. Distribution is free. The license text is still an open decision.

## The All query

CodeGen emits an `All…` query only when `AllowAllRowsAPI` is 1. Every Collaboration entity leaves that flag at 0, so this app generates no `All…` route. MemberJunction 6.1.3 still ships `All…` queries for metadata entities such as Users and Roles. Each of those appends the caller's read filter. None of them covers Conversations, Conversation Details, or Files, and BizApps Tasks generates none. The lane is as safe as the grants: a NULL filter on a Space Participant read row would open it, and `scripts/persona-check.sql` asserts there is no such row and that every Collaboration entity keeps `AllowAllRowsAPI` at 0.

## Tests

```bash
npm test
```

That runs `packages/Core/src/rules.test.ts`. The tests cover reach, the seal, the invitation ceiling, the owner seating themselves, the member cap, promotion stamps, agent retrieval, and retention dates.
