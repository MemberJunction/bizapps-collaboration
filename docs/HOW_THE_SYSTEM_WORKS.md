# How Collaboration works

This page states the rules Collaboration enforces. Each rule is marked:
- **built:** in the code on PR #8's head (`claude/hopeful-bell-6ldk4v-pr8`), which carries everything PR #7 merged;
- **planned:** with the item in [the plan](../plans/plan.md) that builds it (PR #8 or later).

D1 to D7 are the plan's decisions of 2026-09-26 ([its § 3.2](../plans/plan.md#32-the-design-review-of-2026-09-26)), extended by D18 to D23 for PR #7.

## Spaces and reach

A space is a tree. The root is a relationship: a client, a board, a cohort. The children are the pieces of work inside it. Closing a child sets `ClosedAt`; the root stays.

- **Reach (D1). Built.** An active seat on a space reaches that space and every descendant whose `InheritsMembership` is 1. A space with `InheritsMembership = 0` is sealed: only its own seats reach it, and a seat above it never does.
- **A person reads the union of what their seats reach (D1). Built.** That's everything any of their seats reaches, anywhere in the tree, not the subtree of the page they're on. So sub-spaces don't only narrow: a director seated on a board and on its sealed compensation committee reads both, and a director seated only on the board doesn't reach the committee.
- **The nearest seat governs. Built.** When several seats reach the same space, the one the fewest steps above it decides the role's flags there.
- **One walk, in three places. Built.** `membershipReaches` in `packages/Core/src/rules.ts`, the server's write gates, and `fnCollaborationAccess` in the database. `fnCollaborationTasks` and `fnCollaborationAncestorMembers` build on the same walk. `Space.ParentID` doesn't carry MJ's `IsHierarchy` flag, so CodeGen emits no path columns or traversal functions for it.
- **Sub-spaces inherit only when explicitly chosen (D22). Built.** `Space.InheritsMembership` defaults to 0 (sealed). Physical removal of `SpaceType.DefaultInheritsMembership` is scheduled for the single-baseline migration in PR #8 (items 14 and 38).
- **Access after close (D21). Built.** `PostCloseAccess` (`None`, `ReadOnly` or `ReadOnlyWithAgent`) and `PostCloseAccessDays`, on the space and falling back to type, are enforced by `fnCollaborationAccess` for SQL reads and in `membershipReaches` for in-memory graph resolution. Full write gating after close and reopen rules are enforced in space and task write gates. Agent retrieval scoping post-close is enforced in PR #7 (item 40).
- **Generic space types (D18). Built.** Only generic space types ship with the app: Workspace, Team, Project, Working Group, Event, Community, and Cohort; role types include generic Outside Admin and Outside Member.
- **Closing stamp. Built.** Closing a space stamps `ClosedAt`, resolving and stamping `PostCloseAccess` and `PostCloseAccessDays` from the space's configuration or its type. Reopening clears `ClosedAt`.
- **One metadata engine (D19). Built.** `CollaborationEngineBase` and `CollaborationEngine` cache space types, role types, and authorizations, providing synchronous, strongly-typed lookups without per-request roundtrips.
- **Settings rights: authorization tree (D23). Built.** Settings tabs and space-type management are gated by the `Configure Spaces` authorization hierarchy via `CollaborationEngine.UserCanConfigureSpaces`.

## Bands

**Built.**
- Shared items are visible to anyone who reaches the space. Team items need a reaching role with `CanSeeTeamBand`. A seat's band follows its role.
- Bands don't nest: a Team item in a child space is Team.
- Moving an item between bands needs `CanPromoteBand`. `SpaceItemEntityServer` writes the promotion stamp: a Team item has none, and a Shared item records who promoted it and when.

## Seats and invitations

**Built.** `SpaceMemberEntityServer.ValidateAsync` calls `refuseInvite` before a seat is written.
- The signer must reach the target space, with a role that has `CanInvite`.
- The granted role's `Level` must be at or below the signer's `MaxGrantableLevel`, and it can't carry a flag the signer's role lacks: seeing Team, promoting, inviting, owning or contributing.
- The type's `MemberCap` counts every seat that isn't `Removed`.
- A new seat is `Active` when the type's `InviteApproval` is `AutoApprove`, or when the signer is an owner. Otherwise it's `Invited`. Under `Approve`, saving a seat as `Active` needs an owner, and the invited person can't activate their own seat.
- The owner of a space with no seats may seat themselves in the owner role. An owner may grant the owner role, so a space can have more than one owner.
- Anyone may leave their own seat, except the last owner, who must seat another owner first.

**Fixed in PR #3 (B0.1, `6786bd0`):** a change to someone else's seat was checked against the role being saved, not the seat's current role, so a signer could remove someone above them by lowering the role and setting `Removed` in one save. Now the target's current role must also fit within the signer's ceiling. PR #3's unit cases and its WG2 checks test it since `002c2c5`.

The engine reads role flags. It never compares role names.

## Items

**Built.**
- An item is `EntityID` + `RecordID` in exactly one space. The unique key is `(EntityID, RecordID)`. Move an item; never copy it.
- A file, a conversation or a task is an item. This app doesn't copy those tables: an item points at the record that already exists.
- A file item comes only from the upload (`UploadSpaceFile`). Opening a file records an item use.
- A task is filed in a space by its root: the root task is a space item, and its subtasks follow it through `RootParentID`.

## Who can read

**Built.**
- **`fnCollaborationAccess(@UserID)`** is the reach walk in SQL. It returns each reachable space with `CanSeeTeam`, `CanInvite` and `CanContribute` from the nearest seat. Its current definition is in `migrations/V202609262200__v0.1.x__Extensibility_Schema_And_Tables.sql`.
- **Row-level security filters** are metadata: `metadata/row-level-security-filters/`, bound to the **Space Participant** role in `metadata/entity-permissions/`.
  - Every one of the role's 57 read grants carries a filter, and none is NULL. A NULL filter on a grant a person holds exempts them from row-level security for that operation.
  - A share notice is readable only by the member it's addressed to, inside a space they reach. An item use is the caller's own row, inside a space they reach. Creating either carries a create filter, and the server subclass is the rest of the gate.
  - MJ 6.1.3 checks a create filter on every new row, before and after the before-save hooks.
- **People:** Space Participant's field rules on People allow reading a person's name fields, email and linked user, and nothing else, once People's field-level flag is on (bizapps-common#186, still open). Its Deny rows also hold for a participant who has another role.
- **A space's conversations** are MJ conversations owned by the system user, each with a `SpaceChat` row that holds its space, kind and status. There's no room: a space has no conversation until someone starts one through `CreateSpaceConversation`, which applies `Chats.WhoCanStart` and needs a seat that can post in the kind chosen (D25).
  - **General and Topic** conversations are read by everyone who reaches the space, whatever their band. **Internal Only** ones (kind `Private`) are read only by those who see the Team band.
  - Row-level security filters *Conversations In Reach* and *Conversation Details In Reach* apply those rules by kind. A create filter lets a contributing seat post its own `User` messages in an active conversation.
  - Contributing seats get an Edit grant on each conversation they may post in, which is what MJ's own write gate checks. The server writes and revokes the grants with the seats. Closing a space archives its conversations; revoking their grants with the close is planned (PR #8).
  - The space's Chat tab renders MJ's chat area, and the Overview's ask box starts a General conversation.
- **The `Space` resource type** and the `Collaboration Spaces` permission domain are metadata too. `CollaborationSpacePermissionProvider` answers the domain from the roster. An email invitation doesn't use them: access comes from the seat.
- **The owner of a space** can read it before its first seat exists. A magic-link scope (`{{ScopeResourceID}}`) could read one space, but this app's invitations are app sessions, not resource shares, so a removed seat takes effect at once.

**Never give a participant MJ's `UI` role.** `UI` carries unfiltered grants, and one unfiltered grant exempts the user from every filter on that entity.

## What an agent may use

**Built:**
- **`agentMayQuote`** in `rules.ts` is the rule an agent calls before it quotes an item. The caller must be able to read it, a Team item needs `CanSeeTeam`, and the item must be in the subtree of the space the question was asked in. `ExcludedEntirely` on the item's space or any ancestor drops it for every agent; `ExcludedFromParentScope` drops it when the question comes from above that space.
- **The retrieval module** (`space-agent-retrieval.ts`) calls `agentMayQuote` on every candidate, as the asking user. The agent, its prompt, skills and search scope are metadata.
- **Agent turns.** An agent answers in a space's conversation through `ExecuteSpaceChatTurn`, which checks again from the saved message that the caller can post in the conversation, that the agent is allowed and, under `MentionOnly`, tagged in the message. Bounding the agent's search by the conversation's audience is planned for PR #8 (D2, B2).

**Planned: the audience of an answer decides what the agent may use (D2; A6, B2 in PR #8 and later).**
- **In a private conversation** (one person, plus agents), the agent uses the caller's union of reach, narrowed by a scope control: *this space*, *this space and its sub-spaces*, or *everything I can reach*.
- **In a shared conversation** (two or more people), it uses the intersection of what every current participant can read, with each participant's band. Nobody can change it, the asker included.
- In both, the agent runs as the asking user, never as a service account, and the space's `AgentRetrieval` still applies. Its own memory follows the same rule.

## Provenance, sealing and copying

**Planned.**
- **Provenance (D3; A2 to A4):** every agent answer and every artifact version records the resources it drew from, when it's generated. It serves citations, sealing and audit.
- **Sealing (D4; A5, A7):** adding a person to a conversation doesn't grant them its history. The person who adds them chooses how much history they get (none, all, or since a time), and core's conversation participants enforce that window with row-level security. Inside the window, an AI message whose recorded sources the newcomer can't read is sealed: they see who wrote it and when, and can request access. People's own messages aren't sealed.
- **Copying (D5; A12.12, B4):** copying or forwarding an answer whose sources the target audience can't read shows a warning. It advises; it doesn't block.

## Outside channels and proactive posts

**Planned.**
- **Identity (D6; A9, B5):** a space's agent over MCP, Slack or Teams must resolve the person to an MJ user and apply D2 for the channel's audience, or refuse. Today the messaging adapters fall back to a service account, and MCP's `mode=none` and its system API key run as the system user.
- **Proposed posts (D7; A8, B7):** an unsolicited agent message to outside participants is a draft until a named staff member approves or edits it. A digest a member subscribed to needs no approval.

## Data a space doesn't own, and what it grants

**Planned: PR #8** (the plan's D26 to D34; B14 to B20). The parts that need MJ's A14 to A17 open in a follow-up, once an MJ release carries them (D36). Until then a type that seats participants is granted no query, view, dashboard or component, and its participants read other apps' data only through data reach.
- **Anchors (D26; B14).** A space can be anchored to one or more records it's about, each with a role, at most one primary. An anchor grants nothing by itself.
- **Data reach (D28; B18).** A type declares which other apps' entities its participants may read, by a path to an anchor role, with a band and a field allow-list. A script turns the declarations into the Space Participant role's row-level security filters, one per entity, reviewed in `metadata/`. Reads stay in SQL, and a type that declares no reach on an entity gives its participants nothing from it.
- **Grants (D27, D31; B15, B20).** A type, a space or a sub-space grants agents, actions, queries, views, dashboards, components and knowledge sources. A grant's bindings are filled in by the server from the space, its anchors and the caller: the model never sees a bound parameter, a client value for one is refused and logged, and a binding that doesn't resolve refuses the run. A grant on the Team band isn't offered in a chat where anyone can't see Team.
- **Granted queries (D29; B17, A17).** A participant never holds MJ's general right to run queries. They run one only through `RunSpaceQuery`, which checks reach and band, binds and locks the scope parameters, and logs the run.
- **The Canon (D34).** Anything granted to a type that seats outsiders is approved and tested first.
- **One configuration (D30; B16).** Settings, grants and agent settings resolve through the space's same-type run of ancestors, restarting where the type changes.

## The All query

CodeGen emits an `All…` query only when `AllowAllRowsAPI` is 1. Every Collaboration entity leaves that flag at 0, so this app generates no `All…` route. MemberJunction 6.1.3 still ships `All…` queries for metadata entities such as Users and Roles; each appends the caller's read filter. None covers Conversations, Conversation Details or Files, and BizApps Tasks generates none. The lane is as safe as the grants: a NULL filter on a Space Participant read row would open it, and `scripts/persona-check.sql` asserts there's no such row and that every Collaboration entity keeps `AllowAllRowsAPI` at 0.

## What isn't built yet

Each of these is an item in the plan.
- **PostgreSQL (B11).** `fnCollaborationAccess`, the other access functions and the filter text are T-SQL (`TRY_CAST`, bracketed schema names). A PostgreSQL host needs its own dialect of each.
- **The one-off reviewer's link (A12.7).** MJ's `CreateInvite` doesn't accept a resource ID, so this app writes no resource share. An email invitation saves a seat through the seat gate, and the sign-in link is an app session for Space Participant.
  - It's emailed when the host sets `magicLink.communicationProvider`. Otherwise the raw URL is returned only to a user whose MJ user type is `Owner`, or who holds a role in `magicLink.inviteIssuerRoleNames`. A space owner who is neither gets the seat and no URL.
  - The host must set `magicLink.enabled` and list `Space Participant` in `grantableRoleNames`. Don't change `restrictedRoleName`: it's the host's default for every app.
- **Committees on Collaboration (workstream C).** Committees extends `Space` through MJ's IsA, in stages.
- **Platform work in MemberJunction (workstream A):** presence, @mention notifications, read state per person, live message fan-out, conversation participants, and the search fixes.
- **A license.** Distribution is free; the license is still an open decision.

## Tests

```bash
pnpm test                    # the unit tests
pnpm run test:integration    # both integration harnesses, against a database
```

- `pnpm test` runs 326 unit tests across all packages: 116 in `collaboration-core`, 4 in `collaboration-engine-base`, 82 in `collaboration-core-entities-server`, 41 in `collaboration-integration-tests`, 56 in `collaboration-ng-widgets`, and 27 in `collaboration-example-space-types`.
- The integration harnesses run 43 server checks and 44 client checks, in nine bundles each, and a count assertion fails a run that ran fewer. They need a database with the migrations, the metadata and the sample world; the client harness also needs a running MJAPI.
- `scripts/persona-check.sql` checks the Space Participant role's grants against a database.

