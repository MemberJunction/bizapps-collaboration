<p align="center">
  <img src="https://raw.githubusercontent.com/MemberJunction/MJ/main/logo.png" alt="MemberJunction" width="120" />
</p>

<h1 align="center">BizApps Collaboration</h1>

<p align="center">
  <strong>The shared container for client, committee, and cohort work — a Space that is both the permission boundary and the agent's retrieval boundary — for the <a href="https://github.com/MemberJunction/MJ">MemberJunction</a> platform</strong>
</p>

<p align="center">
  <a href="#what-this-is--and-is-not">What this is</a> &middot;
  <a href="#the-five-entities">Entities</a> &middot;
  <a href="#how-it-composes">Composition</a> &middot;
  <a href="#external-participants">Outsiders</a> &middot;
  <a href="#security-model">Security</a> &middot;
  <a href="#the-agent">The agent</a> &middot;
  <a href="#roadmap">Roadmap</a> &middot;
  <a href="plans/plan.md">Plan</a>
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/Status-Draft%20v0.2-blue?style=flat-square" />
  <img alt="MJ Version" src="https://img.shields.io/badge/MemberJunction-6.1-blue?style=flat-square" />
  <img alt="Angular" src="https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="SQL Server" src="https://img.shields.io/badge/SQL%20Server-2019%2B-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-336791?style=flat-square&logo=postgresql&logoColor=white" />
</p>

---

> **The plan:** [`plans/plan.md`](plans/plan.md) (draft v0.2). This README is a tour. The plan is the decision log — entity shape, security rules, roadmap, and the open questions. This repository does not yet contain an Open App manifest, schema, or packages.

A professional-services engagement, an association committee, and a certification cohort are the same object. A bounded group of people — **some of them outsiders** — works on a bounded set of material, usually toward a decision. Vocabulary and lifecycle are metadata, not code.

**The work is bounded; the relationship is not.** An engagement ends and the client does not, so a Space is a **tree**: one perpetual root per relationship, with sub-spaces for the engagements, workstreams, and cycles inside it. Closure, retention, and archival belong to the sub-space. The root outlives all of them. That is what makes a deliverable agent still answerable two years later.

> **The one idea:** a Space is simultaneously the **permission boundary** and the **agent's retrieval boundary**, defined once. An agent cannot answer from a document the person asking is not allowed to open. Sub-spaces narrow both together and can never widen either.

**Scope (2026-09-21):** single-tenant per deployment. One association running it for member and committee collaboration, or one firm running it for client work. It is not multi-tenant SaaS. **Distribution (2026-09-22):** it ships free. No tiers, no per-seat line, no AI add-on SKU. How that free app is licensed and published is still open ([plan §11](plans/plan.md)).

---

## What This Is — and Is Not

| ✅ This is | ❌ This is not |
|---|---|
| A thin Open App: five entities in `__mj_BizAppsCollaboration`, everything else composed from what already ships | A second copy of conversations, tasks, files, or governance |
| The resource id those mechanisms have been missing — `MJ: Resource Permissions`, magic-link `Kind:'resource-share'`, and the `{{ScopeResourceID}}` token are each parameterised on a resource nothing else supplies | A core framework primitive (core declares zero dependencies on any app, so a core Space could never consume BizApps Tasks) |
| A tree: perpetual root per relationship, sub-spaces for the work inside it | A folder per project that dies when the engagement does |
| The place an outsider joins a group — one roster for staff and external participants | Org-wide chat (Slack / Teams), or a rewrite of [BizApps Secure Messaging](https://github.com/MemberJunction/bizapps-secure-messaging) into group chat |
| The container Committees, Tasks, Files, and Caliber were each missing | A document-management system (files stay in MJ Storage) or the community surface (discoverability and join mode are modelled in v1; moderation, reputation, and public profiles are a later release) |

---

## The Five Entities

Schema `__mj_BizAppsCollaboration`. Entity names use the prefix `MJ_BizApps_Collaboration: ` — the table is `Space`, so the entity is `MJ_BizApps_Collaboration: Spaces`. The doubled form `CollaborationSpace` would read "Collaboration: Collaboration Spaces". Compare `Task` → `MJ_BizApps_Tasks: Tasks`.

| Entity | What it is |
|---|---|
| **`SpaceType`** | Metadata, not code. Vocabulary, which panels are live, lifecycle, retention default, agent policy, band defaults, and the two axes that make an open community expressible later: `Discoverability` (`Hidden \| Listed \| Open`) and `JoinMode` (`InviteOnly \| RequestToJoin \| SelfServe`). *"Just messaging"* is a type with one panel on. |
| **`Space`** | The container. Single-column PK, a Name field, `OwnerID` → `MJ: Users`, and a self-referencing `ParentID` with `IsHierarchy: true`. CodeGen then emits `RootParentID`, `ParentIDPath`, `ParentIDDepth`, `ParentIDIsLeaf`, `ParentIDChildCount`, plus the four traversal functions, on SQL Server and PostgreSQL. Lifecycle (`StartedAt` / `ClosedAt` / retention) lives on the space so closure never sits on the root. `InheritsMembership` lets a sub-space seal itself. `AgentRetrieval` (`Included \| ExcludedFromParentScope \| ExcludedEntirely`) lets a space a human may read stay invisible to every agent. |
| **`SpaceMember`** | Internal users and external participants in **one** roster. `SpaceRoleTypeID`, a visibility band, and a `Status`. This is the row that lets a director who is not a staff user sit on a committee. |
| **`SpaceRoleType`** | Behaviour flags the engine reads — `CanInvite`, `MaxGrantableLevel`, `CanPromoteBand`, `CanSeeTeamBand`, `IsOwnerRole` — never a role *name* the engine compares. Same idiom as `DealRole.IsOwnerRole` in BizApps Sales. This is what makes delegated invitation safe. |
| **`SpaceItem`** | `EntityID + RecordID` plus the band. A file, artifact, conversation, task, committee, deal, or meeting. The same polymorphic idiom `TaskLink` and `File Entity Record Links` already use. |

Two invariants, cheap now and expensive later:

- **An item belongs to exactly one space.** Move it, never copy it. Two parents make the permission answer a union nobody can reason about, and the agent's retrieval bound stops being a tree.
- **Bands do not nest.** Team and Shared stay globally two-valued. A Team-band item in a child space is Team. A band-per-space matrix is the special case a better design makes unnecessary.

---

## How It Composes

Collaboration declares dependencies. It does not reimplement the domains next to it.

| Capability | Substrate | What this app adds |
|---|---|---|
| Messaging — multi-human, multi-agent, threaded | `ng-conversations` over `MJ: Conversations` / `Conversation Details`. `ParentID` already threads. | Bind via `LinkedEntityID` / `LinkedRecordID` |
| Agents in the thread | `@` mention routing (agent, user, entity, query, skill), permission-filtered | Scope binding only |
| Work | [BizApps Tasks](https://github.com/MemberJunction/bizapps-tasks) — `TaskLink(EntityID, RecordID)`, multi-assignee, lifecycle hooks, templates, dependencies | A declared dependency and a thin projection |
| Resource library | `MJ: Files`, `File Categories`, `File Entity Record Links`, storage drivers | Space scoping via `SpaceItem` |
| Foldering and browse UX | `MJ: Collections` — hierarchical, shareable, drop-in Angular browser | Membership stays `SpaceItem`. Collections is foldering inside a space, not the library's spine. See [plan §4a](plans/plan.md) for the four gaps (artifact-version pinning, User-only grants, materialized inheritance, no retrieval wiring) |
| Membership and sharing | `MJ: Resource Permissions` (View / Edit / Owner, time-bounded) plus a seeded `MJ: Resource Types` row | `SpaceMember` projects into it. An app can register Space as a shareable resource and ship a permission domain with zero core changes |
| Governance vocabulary | [BizApps Committees](https://github.com/MemberJunction/bizapps-committees) — motions, ballots, quorum, minutes | Committees refactors onto Space in a later phase. Collaboration does not import Committees |
| Notifications, e-signature, usage | `NotificationEngine`, `MJ: Signature Requests` (polymorphic on EntityID/RecordID), `MJ: Artifact Uses` | Reuse. Point signatures at `SpaceItem` |

[BizApps Secure Messaging](https://github.com/MemberJunction/bizapps-secure-messaging) stays a **sibling, not a dependency**. It is strictly 1:1 and published at 2.0.0. Its e-signature routing is core and reachable without it. The File Request lifecycle is the only thing it uniquely owns; if a space needs that shape, lift the fields rather than take the dependency ([plan §4b](plans/plan.md)).

### Why an app, not a core primitive

Core declares zero dependencies on any app package. A core Space could never consume `bizapps-tasks` and would be stuck with core `MJ: Tasks`, which is shaped for agent orchestration rather than human work. An Open App simply declares the dependency, the way Committees already declares Common and Tasks. `MJ: Resource Types` and `MJ: Permission Domains` are metadata-seeded catalogs resolved by `@RegisterClass` name, so nothing is given up by staying an app. `bizapps-forms` already ships an app-schema entity, an app role, and an app RLS filter from its own repo. Collaboration follows that path.

---

## External Participants

Committees can govern, and it requires every participant to be a staff user. Secure Messaging can reach an outsider, exactly one at a time. Tasks has no project entity, so Committees joins the two by matching a category name to a committee name. Collaboration is the container those three were each missing.

| Participant | Door |
|---|---|
| Internal staff | Normal MJ user + staff role |
| Recurring external — client team, outside director | **Restricted-scope login.** One narrow named role, `Space Participant`, scoped by row-level security. The default |
| One-off / view-once reviewer | Magic link, `Kind: 'resource-share'` |
| Account-less 1:1 exchange, no space | BizApps Secure Messaging |

**Never give a space participant the `UI` role.** MJ's RLS fails open — `UserExemptFromRowLevelSecurity` returns true the moment any role the user holds has a permission row on that entity with a NULL filter, and `UI` carries a large set of unfiltered rows. Before adding any RLS filter, audit every role those users hold. Prefer **one participant role with one filter**. Role RLS OR-composes every filter a user holds, so a second role can only widen.

A participant must be able to invite their own team. The ceiling is four clauses, all of them in `SpaceMemberEntityServer.Save()`:

1. The grantor is an **active member** of the target space.
2. The grantor's `SpaceRoleType` carries **`CanInvite`**.
3. The granted level is **≤ the grantor's own** (`MaxGrantableLevel`).
4. The target space is **inside the grantor's own subtree**.

`MJ: Application Roles` is a front door, not a vault. Zero role rows on an application means open to everyone, and the check is client-side. Treat application access as reachability. The boundary is the security model below.

The rest of the door — shell grants that disclose nothing, the branded no-access page shipping before lockdown, and the cast on `{{ScopeResourceID}}` — is [plan §5](plans/plan.md).

---

## Security Model

**The caller's own access is the ceiling and is never exceeded. The Space narrows within it and never grants.** The agent queries **as the asking user**. An agent running as a service account would make membership itself the grant.

The boundary lives in **row-level security on Collaboration's own entities**, not only in a search scope. The full-text lane cannot carry a scope filter, and it does thread the caller through RunViews, so RLS applies there. Put `SpaceID` in the filter and every RunView lane is bounded. The scope filter then only narrows.

Retrieval for a tree:

> **requested subtree** ∩ **what this caller can read** ∩ **band** ∩ **`AgentRetrieval`**

Downward-inclusive, never upward. Ask from the root and you get everything beneath it that you can read. Ask from a child and you get that child's subtree only. A sub-space with `InheritsMembership = 0` seals itself.

Every space-scoped table carries a real `SpaceID`, `NOT NULL`, meaning the same thing on every table. Because `IsHierarchy` emits `ParentIDPath`, one membership subquery covers the tree. `{{UserID}}` is a token MJ's unresolved-token guard covers. The filter is equality / `IN` form — never `NOT IN`, `<>`, or `NOT LIKE` against a token. Start computed; materialize only if it stops being fast, and if you materialize, recompute on **both** space create/move and membership change. Collections writes descendant grants on share and never revisits them on create. That is the defect not to copy.

**Writes are not RLS.** They are `BaseEntity` subclasses. The write-side RLS slots exist and, in practice, go unused. A subclass is where a rule reaches MJ's generated CRUD mutations, API and MCP alike. `isNew` is load-bearing: on an INSERT every field's `.Dirty` is false. No constructor on the subclass — a throwing constructor makes MJ fall back to plain `BaseEntity` and the guard vanishes.

**Two bands, from day one.** Team is the engagement team's working material and is never in the client-facing agent's scope. Shared is promoted deliberately, with an actor and a timestamp. A band on `SpaceItem` fails loudly at promotion time. A folder convention fails silently the first time someone files a transcript in the wrong place.

Three lanes RLS does not reach, each of them a measured incident elsewhere: root `All<Entity>`, `RunQuery` / datasets / reports, and a bespoke resolver that reads by a client-supplied id. A read-by-client-supplied-id is a gate site. The exit criterion for every phase is a persona — a member of exactly one space, holding exactly the participant role — seeing exactly what it should, in a browser, on every lane. Details, the filter SQL, and the search fixes that should land regardless of the rest of this plan are [plan §6](plans/plan.md) and [plan §8](plans/plan.md).

---

## The Agent

A user talks to **exactly one agent**, and it is smart enough to do whatever. Four agents would be four places the retrieval boundary gets configured. The client-versus-team distinction does not need two agents, because the band filter on the caller already makes it. The same agent, asked the same question by a client contact and by the engagement lead, answers from different material because the caller differs.

| Capability | What it is |
|---|---|
| **Ask** | Answers from the caller's effective scope. KPI: questions answered without a human, and zero cross-band retrievals in audit |
| **Promote** | Proposes Team → Shared promotions and flags attribution risk. A skill, not an agent you choose |
| **Summarize** | Per-member digest of what changed, honoring band and notification preferences |
| **Find & act** | Locates material, opens a task, routes a signature, through the existing Action layer |

*Space* is the table. The human-facing noun comes from `SpaceType.Vocabulary` — workspace, committee, cohort, community. **"Space Agent" does not ship.** The agent's name is deployment configuration with a plain default.

---

## Installation

BizApps Collaboration will be a [MemberJunction Open App](https://github.com/MemberJunction/MJ/tree/main/packages/OpenApp), installed with the [MJ CLI](https://github.com/MemberJunction/MJ/tree/main/packages/MJCLI) the same way the other BizApps are:

```bash
mj app install https://github.com/MemberJunction/bizapps-collaboration
```

That command does nothing useful yet. This commit has no `mj-app.json`, no migrations, and no packages. When the manifest exists, the app id will be `mj-bizapps-collaboration`, the schema `__mj_BizAppsCollaboration`, and the dependency it declares is [BizApps Tasks](https://github.com/MemberJunction/bizapps-tasks). Committees consumes Space later; it is not a dependency. Secure Messaging is not a dependency.

The host shells are MemberJunction's own `MJAPI` and `MJExplorer`. A BizApps repo ships libraries (`packages/`), migrations, and metadata. It does not ship a private API or Explorer app.

### Packages this repo will grow

The set matches the other BizApps Open Apps. None of these exist in this commit.

| Package | NPM name | Role |
|---|---|---|
| **Entities** | `@mj-biz-apps/collaboration-entities` | Generated entity classes for the five tables |
| **Actions** | `@mj-biz-apps/collaboration-actions` | Server-side action handlers |
| **Server** | `@mj-biz-apps/collaboration-server` | Bootstrap (`LoadBizAppsCollaborationServer`), resolvers, the projection onto Tasks and Files |
| **Core Entities Server** | `@mj-biz-apps/collaboration-core-entities-server` | Server-only subclasses — `SpaceEntityServer` and `SpaceMemberEntityServer` hold the write gates |
| **Angular** | `@mj-biz-apps/collaboration-ng` | Bootstrap (`LoadBizAppsCollaborationClient`) and Explorer UI |

SQL Server is the source of truth for migrations. PostgreSQL comes from `@memberjunction/sql-converter`, the same toolchain Orders uses. `IsHierarchy` codegen emits the tree functions for both dialects, which is why the hierarchy is a flag rather than hand-written SQL.

---

## Entity Model

```
 MJ: Users                         bizapps-tasks              MJ: Files / Conversations
 OwnerID, SpaceMember.UserID       Task ──TaskLink──►         File, Conversation, …
      │                            EntityID + RecordID              │
      ▼                                  ▲                          │ EntityID + RecordID
 ┌─────────────┐  ParentID (IsHierarchy) │                          │
 │  SpaceType  │                         │                          │
 │ vocabulary, │ 1 → N ┌─────────────┐   │     ┌──────────────┐     │
 │ panels,     │──────►│    Space    │───┴────►│  SpaceItem   │◄────┘
 │ Discoverability,    │ the tree,   │         │ one parent,  │
 │ JoinMode    │       │ the boundary│         │ Team | Shared│
 └─────────────┘       └──────┬──────┘         └──────────────┘
                              │ 1 → N
                       ┌──────┴──────┐
                       │ SpaceMember │──► SpaceRoleType
                       │ one roster  │    CanInvite, MaxGrantableLevel,
                       │ staff +     │    CanPromoteBand, IsOwnerRole
                       │ outsider    │
                       └─────────────┘

 Retrieval = requested subtree ∩ caller's rows ∩ band ∩ AgentRetrieval
 Writes    = SpaceMemberEntityServer.Save()  (four-clause invite ceiling)
```

An item's `EntityID + RecordID` may point at a Task, a File, a Conversation, a Committee, a Deal, or a Meeting. Collaboration does not take a dependency on the app that owns the pointed-at record. The pointed-at app does not learn about Spaces. That is the same primitive Committees, Tasks, and Files already use.

---

## Roadmap

From [plan §9](plans/plan.md). Each phase has a kill criterion. Phase 0's is the one that decides whether this is a product.

| Phase | What lands | Kill criterion |
|---|---|---|
| **0 — three spaces, one week** | One space on a real engagement, **with a sub-space**; one on a real committee with one external director; one cohort. Same code, different `SpaceType`. A partner tries to make the scope leak, from the child and from the root | The committee or cohort space needs code the engagement space did not. Then this is a services accelerant; fold it into delivery and stop |
| **1 — the container** | The five entities, `NOT NULL SpaceID` on every scoped table, hierarchy, delegated invitation, Resource Type and Permission Domain, one membership RLS filter per entity, the `Space Participant` role, write-gate subclasses, conversations bound to the space, magic links, band promotion. Ships with the external-participant persona, the branded no-access page, and the `All<Entity>` lane guard | Membership cannot be expressed without derived permission rows that drift |
| **2 — library, work, notification** | Files with space scoping and Collections foldering, external upload, Tasks projected in, notification-on-share. Core contributions: presence, @mention notification, per-user read state | None expected — this phase is assembly. If it is not assembly, §4 is wrong |
| **3 — governance and scale** | Committees refactors onto Space (polymorphic links in the shared app, a thin projection, drop the local table). Live message fan-out lands in core | Committees cannot adopt Space without breaking its published schema |
| **4 — adoption** | Retention and entitlement as `SpaceType` configuration, the deliverable-agent offer the perpetual root makes possible, SOC 2 evidence before the first external client, license settled | Community is a later release, not a phase here. The axes ship in Phase 1; the surface waits for a customer who wants it |

---

## Repository

This commit:

```
bizapps-collaboration/
├── README.md
└── plans/
    └── plan.md                 # draft v0.2, byte-identical to the source plan
```

The Open App layout it will grow into is the one [BizApps Orders](https://github.com/MemberJunction/bizapps-orders) and the other BizApps use:

```
bizapps-collaboration/
├── mj-app.json                 # manifest: mj-bizapps-collaboration, schema __mj_BizAppsCollaboration
├── mj.config.cjs               # CodeGen scope, entity prefix, build commands
├── packages/
│   ├── Entities/               # @mj-biz-apps/collaboration-entities
│   ├── Actions/                # @mj-biz-apps/collaboration-actions
│   ├── Server/                 # @mj-biz-apps/collaboration-server
│   ├── CoreEntitiesServer/     # write-gate subclasses
│   └── Angular/                # @mj-biz-apps/collaboration-ng
├── migrations/                 # T-SQL, source of truth
├── migrations-pg/              # PostgreSQL, converter output
├── metadata/                   # SpaceType seed, Resource Type, application roles
└── plans/
    └── plan.md
```

Generated entity classes come from CodeGen. Hand-written `EntityField` DML does not go in a migration.

---

## What Is Still Open

[Plan §11](plans/plan.md). None of these are decided by this README.

1. **Owner.** Still unnamed.
2. **`MJ: Artifact Uses`** — does it cover plain files, or only artifacts?
3. **File Requests** — lift the shape into Collaboration, or revisit Secure Messaging as an optional dependency later?
4. **Committees adopting Space** — Phase 3 as written, or a separate decision?
5. **License and distribution** — free is decided; source-available in the manner of `bizapps-forms`, or another free distribution, is not. This repo has no `LICENSE` file until that is settled.
6. **The deliverable agent after the engagement ends** — the perpetual root makes it possible; the business rule is unwritten.
7. **Which door creates an external participant's identity** — invite, or open self-signup? Settle it before writing a provisioning service.

---

## Documentation

| Document | Description |
|---|---|
| [Collaboration Spaces plan](plans/plan.md) | Draft v0.2. Architecture, security model, roadmap, risks, open decisions |
| [BizApps Tasks](https://github.com/MemberJunction/bizapps-tasks) | The work substrate a Space projects |
| [BizApps Committees](https://github.com/MemberJunction/bizapps-committees) | Governance depth that later sits on a Space |
| [BizApps Secure Messaging](https://github.com/MemberJunction/bizapps-secure-messaging) | The 1:1 sibling. Not a dependency |
| [MemberJunction Open App](https://github.com/MemberJunction/MJ/tree/main/packages/OpenApp) | How an app manifest is installed |

---

## Tech Stack

The platform the other BizApps are built on. Nothing here is installed yet.

| Layer | Technology | Version |
|---|---|---|
| **Platform** | [MemberJunction](https://github.com/MemberJunction/MJ) | 6.1 (the line the plan was read against; 5.51 workarounds are not ported) |
| **Runtime** | Node.js | 18+ |
| **Language** | TypeScript | 5.9 (strict) |
| **Database (primary)** | SQL Server / Azure SQL | 2019+ |
| **Database (secondary)** | PostgreSQL | 17 |
| **API** | GraphQL (Apollo Server) | — |
| **UI** | Angular | 21 |
| **Build** | Turborepo + pnpm | pnpm 10 |

---

## License

Not chosen. Free distribution is decided; the license and the publish path are [plan §11 decision 5](plans/plan.md). No `LICENSE` file ships in this commit.

---

<p align="center">
  Built on <a href="https://github.com/MemberJunction/MJ">MemberJunction</a> — the metadata-driven application platform.
</p>
