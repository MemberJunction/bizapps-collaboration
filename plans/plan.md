# Collaboration Spaces — Secure Client & Committee Collaboration on MemberJunction

**Status:** `idea` — Draft v0.2 · Owner: TBD · Mockups: pending
**Working repo name:** `bizapps-collaboration` · **Posture:** free Open App (§3)

---

## 1. Executive summary

A professional-services engagement, an association committee and a certification cohort are the same object. A bounded group of people — **some of them outsiders** — works on a bounded set of material, usually toward a decision. What differs is vocabulary and lifecycle, which is metadata, not code.

**The work is bounded; the relationship is not.** An engagement ends and the client does not, so a space is a **tree**: one perpetual root per relationship, with sub-spaces for the engagements, workstreams and cycles inside it. Closure, retention and archival belong to the sub-space; the root outlives all of them. That is also what makes a deliverable agent still answerable two years later — the space never closed.

Three MJ apps have each invented a private version of that container and **none of them can invite an outsider into a group**. Committees has real governance depth — motions, ballots, quorum, minutes — and requires every participant to be a staff user with a linked MJ account. Tasks has no project entity, so committees joins the two by *matching a category name to a committee name*. Secure-messaging can reach an outsider, but exactly one at a time.

Meanwhile three MJ core mechanisms — `MJ: Resource Permissions`, magic-link `Kind:'resource-share'`, and the `{{ScopeResourceID}}` RLS token — are each parameterised on a **resource id that no current app supplies**.

**Collaboration** is a thin Open App that defines that resource. Five entities; everything else composes what already ships.

> **The one idea:** a Space is simultaneously the **permission boundary** and the **agent's retrieval boundary**, defined once. An agent cannot answer from a document the person asking is not allowed to open — not as a policy someone must remember, as a property of the data model. Sub-spaces narrow both together and can never widen either.

**Scope decision (2026-09-21):** this is **single-tenant per deployment** — one association running it for member and committee collaboration, or one firm running it for client work. It is **not** multi-tenant SaaS. MJ core's roles, row-level security, and application roles are sufficient.

## 2. Strategic context

Two buyers, three motions, one build.

**Association — board and committee portals.** Board and committee portals are structurally unserved: per-seat products are mispriced, and association-management modules are shallow. Published anchors: OnBoard lists **$25,385 for 15 users** with AI a **separate $3,500 line item**; BoardEffect Pro is **$9,000/yr**, and the tier carrying AI minutes is **$12,300 — a 37% premium**; Boardable runs $79–329/mo; Diligent, Boardvantage and Govenda are quote-only, with implementation and per-seat scaling inflating real spend 40–60%. Committees already has the governance depth these products sell and lacks exactly one thing: the ability to invite a director who is not a staff user.

**Professional services — client portals.** Copilot $39–89/user/mo, Clinked $77–297/mo (Premium $383), Moxo from $99/mo, SuiteDash $19–99 flat. All are file-plus-chat over the vendor's cloud. None sits on the firm's own data, none has an agent whose retrieval is bounded by the same object that bounds access, and all are **per-project by construction** — which is why none of them can offer an assistant that still answers two years after delivery.

**Association — cohorts, outside committees.** The motion nobody prices for: leadership classes, mentoring circles, certification cohorts, chapters, task forces, volunteer crews. An association has an order of magnitude more of these than it has committees, they are short-lived, and every one of them today lives in a Google Drive folder and a group email. They are the same object with different vocabulary — a `SpaceType` row, not a feature. This is the strongest evidence that the metadata-not-code claim is real, because it costs nothing to add.

### The wedge

1. **The boundary is one object.** Permission and retrieval are defined once and cannot drift apart.
2. **Not per-seat — not priced at all.** Every incumbent above charges by seat, which is what makes them unaffordable at hundred-committee, thousand-volunteer scale and what makes a firm ration client access to three named contacts. A free app does not undercut that model; it removes the question (§3).
3. **AI is the product, not an add-on SKU.** Every incumbent above prices it separately.
4. **It runs on the customer's own instance and data.** No vendor cloud holding the engagement file.
5. **It composes.** Conversations, Tasks, Files, Committees and Caliber keep their domains; Collaboration supplies the container each was missing.
6. **The relationship outlives the project.** One perpetual tree per client or per cohort family, not a folder per engagement — which is what makes the post-delivery agent possible at all.

### What we are explicitly NOT doing

- Not competing with Slack or Teams. This is a bounded space with outsiders in it, not org-wide chat.
- Not a document management system. Files live in MJStorage; we own the container and who may see it.
- Not reshaping `bizapps-secure-messaging` into group chat (§4).
- Not a core framework primitive — it stays an app (§4).
- Not multi-tenant SaaS. One deployment, one organization.
- **Not building the community surface in v1.** The two axes that make an open community expressible are modelled from day one (§4); moderation queues, reporting, reputation, public profiles, activity ranking and SEO-visible content are **not built** and are a later release, not a second app.

## 3. Distribution — a free Open App

**Decided 2026-09-22: this ships free.** No tiers, no per-seat line, no AI add-on SKU. The incumbents' pricing *is* the opening (§2), and a free app does not undercut that model — it removes the question. It is also what makes the association motion coherent for the first time: a portal priced per seat can never cover a hundred committees and a thousand volunteers, and one that costs nothing can.

Two consequences, stated rather than discovered:

- **Retention and post-engagement access stay configuration, not a code path.** Record-level grants already carry `ExpiresAt`, so *"access lasts a month / a year / indefinitely"* is a `SpaceType` default. Free changes who decides that; it does not change the mechanism.
- **Free is not unowned.** Removing revenue removes the thing that usually forces an owner to exist. §11 keeps naming an owner as decision #1.

The **license and distribution posture** — source-available in the manner of `bizapps-forms`, or another free distribution — is genuinely undecided and is §11 decision #5.

## 4. Architecture (composition-first)

| Capability | Substrate | New work |
|---|---|---|
| **Messaging backbone** — multi-human, multi-agent, threaded | `ng-conversations` over `MJ: Conversations` / `Conversation Details`. `Role` is User/AI/Error with **`UserID` and `AgentID` both nullable per message**; `ParentID` threads. Router-free, so it embeds outside Explorer. | Bind via `LinkedEntityID` / `LinkedRecordID` |
| **Agents in the thread** | `@` mention routing (agent · user · entity · query · skill) with permission-filtered autocomplete. Realtime voice is a third agent type with LiveKit, meeting bridges and consent-gated capture. | Scope binding only |
| **Work / light project management** | **`bizapps-tasks`** — `TaskLink(EntityID, RecordID)`, multi-assignee (an assignee may be an AI agent), 8 lifecycle action hooks, templates, dependencies, gantt, approval inbox | Declared dependency + a thin projection service |
| **Resource library** | `MJ: Files`, hierarchical `File Categories`, polymorphic `File Entity Record Links`, 7 storage drivers, Range streaming, capability-token media delivery. `MJ: Collections` for foldering (§4a). | Space scoping via `SpaceItem` |
| **Membership & sharing** | `MJ: Resource Permissions` (View/Edit/Owner, time-bounded) + a seeded `MJ: Resource Types` row for Spaces | `SpaceMember` projects into it |
| **Space hierarchy** | **CodeGen generates it.** `IsHierarchy: true` on a self-referencing FK emits `RootParentID`, `ParentIDPath`, `ParentIDDepth`, `ParentIDIsLeaf`, `ParentIDChildCount` on the base view **plus four traversal functions** — descendants, ancestors, root-id, hierarchy-meta — on SQL Server *and* PostgreSQL (`sql_codegen.ts:1742`). Requires a single-column PK, which `Space` has. | Set one flag |
| **External participants** | **One** narrow named MJ role + row-level security; `MJ: Application Roles` for reachability (not a boundary — §5); magic links for one-off access | Delegated invitation, §5 |
| **Governance vocabulary** | `bizapps-committees` — motions, ballots, quorum, minutes, terms | Committees refactors onto Space |
| **Notifications** | `NotificationEngine` — in-app / email / SMS through templates and per-user preferences, already wired to resource sharing | Reuse the share handler |
| **E-signature** | `MJ: Signature Requests`, polymorphic on EntityID/RecordID | Point at `SpaceItem` |
| **Usage tracking** | `MJ: Artifact Uses` (`UsageType`, `UsageContext`) | Confirm it covers plain files, not only artifacts |

**The five new entities** (`__mj_BizAppsCollaboration`):

- **`SpaceType`** — metadata, not code: vocabulary, which panels are live, lifecycle, retention default, agent policy, band defaults, and the two axes that make an open community expressible without a second permission model — **`Discoverability`** (`Hidden | Listed | Open`) and **`JoinMode`** (`InviteOnly | RequestToJoin | SelfServe`). *"Just messaging"* is a type with one panel on. A special case in code here is a missing config field.
- **`Space`** — the container, and the record the three core mechanisms have been waiting for. Single-column PK, a designated Name field, an `OwnerID` FK to `MJ: Users`, and a **self-referencing `ParentID` with `IsHierarchy: true`**. Carries its own lifecycle (`StartedAt` / `ClosedAt` / retention) so closure lives on the sub-space and never on the root, an `InheritsMembership` flag so a sub-space can seal itself, and **`AgentRetrieval`** (`Included | ExcludedFromParentScope | ExcludedEntirely`) so a space readable by a human can still be invisible to every agent.
- **`SpaceMember`** — internal users and external participants in **one** roster, with a `SpaceRoleTypeID`, a visibility band and a `Status`. The row that fixes committees' missing outsiders.
- **`SpaceRoleType`** — the fifth entity, and the one that makes delegated invitation safe. Behaviour flags the engine reads — `CanInvite`, `MaxGrantableLevel`, `CanPromoteBand`, `CanSeeTeamBand`, `IsOwnerRole` — never a role *name* the engine compares. Same idiom as `DealRole.IsOwnerRole` in `bizapps-sales`.
- **`SpaceItem`** — `EntityID + RecordID` plus the band. A file, artifact, conversation, task, committee, deal or meeting. The same polymorphic idiom `TaskLink` and `File Entity Record Links` already use.

Two model invariants, cheap now and expensive later:

- **An item belongs to exactly one space.** Move it, never copy it — the moment an item has two parents the permission answer is a union nobody can reason about, and the agent's retrieval bound stops being a tree.
- **Bands do not nest.** Team/Shared stay globally two-valued. A Team-band item in a child space is Team, full stop; a band-per-space matrix is the special case a better design makes unnecessary.

**Naming:** app **Collaboration**, table `Space`, entity `MJ_BizApps_Collaboration: Spaces`. Not `CollaborationSpace` — the schema and entity prefix already say Collaboration, and the doubled form reads *"Collaboration: Collaboration Spaces"*. Compare `Task` → `MJ_BizApps_Tasks: Tasks`.

**Why an app and not a core primitive.** Core declares **zero** dependencies on any app package, so a core `Space` could never consume `bizapps-tasks` — it would be stuck with core `MJ: Tasks`, which is shaped for agent orchestration rather than human work. An Open App simply declares it, exactly as committees already declares both common and tasks. And nothing is given up: `MJ: Resource Types` and `MJ: Permission Domains` are both metadata-seeded catalogs resolved by `@RegisterClass` name, so an app can register Space as a first-class shareable resource and ship its own permission domain **with zero core changes**. `bizapps-forms` already ships an app-schema entity + app role + app RLS filter from its own repo; we follow it.

### 4a. On `MJ: Collections` — right skeleton, wrong membership

Collections is a real, shipped, Router-free, hierarchical, individually-shareable folder tree with a registered permission provider, a seeded permission domain, generated hierarchy columns, and a ~3,600-line drag-and-drop browser with multi-select, breadcrumbs and a staging shelf. **The Angular components are the strongest asset and are genuinely drop-in.**

Four gaps decide how we use it:

1. **Membership is Artifact-Versions-only, and version-pinned.** Every document must be wrapped as `Artifact` → `ArtifactVersion` (`ContentMode='File'`), and the join pins a *specific version* that nothing auto-advances — so editing a document silently leaves the library showing the old one.
2. **Sharing is `User`-only.** `CollectionPermission.UserID` is NOT NULL and the provider declares `SupportedGranteeTypes: ['User']`. **"Shared with all Space members" is not expressible.** This is the structurally awkward one.
3. **Hierarchy inheritance is materialized, not computed** — the domain seed claims `SupportsHierarchyInheritance: true`, but the provider reports direct grants only and the Angular layer writes physical permission rows into every descendant. A folder created *after* a share inherits nothing.
4. **No search/RAG wiring at all**, and `Preload` / `ContextDescription` are a realtime **media-kit** manifest, not retrieval.

**So:** `SpaceItem` is the library's membership spine; Collections provides *foldering and the browsing UX inside a space*. Contributing a Role/Team grantee and computed inheritance to Collections (§6) is what makes it fully usable — both are generally useful, neither is ours alone.

### 4b. On `bizapps-secure-messaging` — it stays exactly as it is

Six tables implementing a one-org-to-one-contact secure channel with structured file requests and e-signature. It is **strictly 1:1 by construction** — a single non-null `ContactID`, no participant table, and read/star/archive stored as global per-record flags that are wrong the moment a second participant exists. It is published at 2.0.0, and changing that 1:1 shape would be a breaking change.

It is therefore a **sibling, not a dependency**. Its e-signature routing is core and reachable without it; the only thing it uniquely owns is the File Request lifecycle, which is welded to its thread. If that shape proves needed inside a space, lift it (Title · Instructions · Status · DueAt · FulfilledAt) rather than taking the dependency.

## 5. External participants — four doors

| Participant | Door |
|---|---|
| Internal staff | Normal MJ user + staff role |
| **Recurring external** — client team, outside director | **Restricted-scope login.** One narrow named MJ role (`Space Participant`) with a small grant set, scoped by RLS. The default for spaces. |
| One-off / view-once reviewer | Magic link, `Kind: 'resource-share'`, anonymous or email identity |
| Account-less 1:1 exchange, no space | `bizapps-secure-messaging` |

`Space Participant` is one narrow named role: `SQLName: null`, a small grant set, and **none** of MJ's built-in `UI`, `Developer`, or `Integration` roles.

> **Never give a space participant the `UI` role.** MJ's RLS **fails open**: `UserExemptFromRowLevelSecurity` returns true the moment **any** role the user holds has a permission row on that entity with a NULL RLS filter, and `UI` carries a large set of unfiltered rows. Before adding any RLS filter, audit every role those users hold.

- **One participant role with one filter, if it can possibly be done.** Role RLS **OR**-composes every filter a user holds on an entity, so a second role can only ever widen. (MJ's API-key row-filter lane does the opposite — AND-composed, most-restrictive-wins, fail-closed on an unresolved token and on a dangling filter.) On the 5.51 line, multiple filters were joined as `AND (f1) OR (f2)` without wrapping the group, which returned the wrong record (MJ#4078). On the 6.1 line, `GetEffectiveRowFilterWhereClause` parenthesises the role clause. Verify that on the pin rather than porting a workaround — and still prefer one role, because *"which of their roles is unfiltered here?"* is then an audit nobody has to run.
- **The shell's boot grants disclose nothing.** MJ's client engines load a fixed set of `MJ: *` entities at boot, all-or-nothing, so a missing grant stops the shell rather than hiding a panel. Those grants are a `1 = 0` filter with `CanRead: true` — present, readable, empty. That inventory is the difference between a locked-down persona that boots and one that hangs.
- **Sign-up is not access, and the no-access page ships first.** A *branded* no-access page must exist **before** the lockdown, or closing a hole becomes a permanent lockout that reads as an outage.
- **`MJ: Application Roles` is a front door, not a vault.** Zero role rows on an application means **open to everyone** by design (`UserInfoEngine.UserHasApplicationAccess`), and MJ ships **no server-side application predicate at all** — the check is client-side. Treat app access as reachability; the boundary is §6. And do **not** copy MJ's shipped `Magic Link: Own Application Roles` filter onto participants — narrowing what they read *from that table* is exactly what makes the gate fail open for them.
- **There is no column-level redaction.** `IncludeInAPI` is entity-level: the whole row or nothing. If only part of a record is safe for the client band, that is a server-side projection, not a permission.
- **Another app's shipped defaults become yours.** Any role this deployment auto-assigns, especially one with grants and no RLS, is in force for space participants too. Audit those roles before the first external user exists.

**Participants invite participants, and that is a write rule.** A client admin must be able to bring their own team in at read-only, read/write or admin without a ticket to the operator — that is most of the product's felt value. The ceiling is four clauses, and all four live in `SpaceMemberEntityServer.Save()` because write-side RLS is unused in practice (§6):

1. The grantor is an **active member** of the target space.
2. The grantor's `SpaceRoleType` carries **`CanInvite`**.
3. The granted level is **≤ the grantor's own** on that space (`MaxGrantableLevel`).
4. The target space is **inside the grantor's own subtree**.

The consequence is that the identity door stops being a Phase 4 question. It is no longer *"we invite people"* — it is **our customers' customers trigger provisioning**, so a `SpaceType` needs an approve-vs-auto-approve policy and a per-space cap before the first external admin exists, not after.

**Multi-tenant machinery is out of scope.** What holds under an adversarial read is RLS, `BaseEntity` subclasses, and closing the `All<Entity>` lane — all MJ core. A Space is a flatter scope object than a tenant subtree, so this app does not build a person/org hierarchy, a per-request scope resolver, or an org switcher (§6).

## 6. The security model

**The rule:** the caller's own access is the **ceiling** and is never exceeded; the Space **narrows** within it and never grants. The tempting wrong shape is an agent running as a service account with access to the space's documents — then membership *becomes* the grant, and any membership bug is a breach. The agent queries **as the asking user**; the space filter intersects.

**Where the boundary lives: row-level security on our own entities, not only the search scope.** The full-text lane structurally cannot carry a scope filter — `FullTextSearchParams` is `{ SearchText, EntityNames?, MaxRowsPerEntity? }` with no filter field — so a scope-only boundary leaks there. That lane *does* thread the caller through RunViews, so RLS applies. Put `SpaceID` in an RLS filter and every RunView-based lane is bounded by construction; the scope filter becomes narrowing, performance, and the only control available on the vector and external-index lanes.

**The scoping rule for a tree**, which is the same ceiling rule applied downward:

> retrieval = **requested subtree** ∩ **what this caller can read** ∩ **band** ∩ **`AgentRetrieval`**

Ask from the root and you get everything beneath it *that you can read*; ask from a child and you get that child's subtree only. **Downward-inclusive, never upward** — narrowing by choice is always available, widening never is. Membership inherits down by default, and a sub-space with `InheritsMembership = 0` seals itself for the partner-only or client-exec-only workstream.

`AgentRetrieval` is the axis a permission model alone cannot express: engagement economics, privileged legal, a partner's notes on the client's own executives are all things a human member may read and **no agent may ever quote**. One flag on the space, one more predicate in the scope filter.

**One column, one meaning, one filter shape.** Every space-scoped table carries a real `SpaceID`, `NOT NULL`, meaning the same thing on every table. Then one filter covers the whole app — and because `IsHierarchy` gives us a generated `ParentIDPath`, it covers the tree too:

```sql
SpaceID IN (
    SELECT s.ID FROM <schema>.vwSpaces s
    WHERE EXISTS (
        SELECT 1 FROM <schema>.vwSpaceMembers m
        JOIN <schema>.vwSpaces ms ON ms.ID = m.SpaceID
        WHERE m.UserID = '{{UserID}}' AND m.Status = 'Active'
          AND (m.SpaceID = s.ID
               OR (ms.InheritsMembership = 1 AND s.ParentIDPath LIKE ms.ParentIDPath + '%'))
    )
)
```

No identity hop and no per-request middleware cascade — the tree lives in a generated column rather than in a filter that has to walk it. `SpaceID` means one thing on every table. A column that sometimes means owner, sometimes subject, and sometimes actor decides several security outcomes with one value, and any table that omits the column falls out of the filter entirely. Three properties make this shape the right one:

- **`{{UserID}}` is a token MJ's unresolved-token guard covers** (`/\{\{(?:User|Acting)\w+\}\}/`), and a null value is not substituted at all — *"Undefined is unresolved, period."* Contrast `{{ScopeResourceID}}`, which that guard does **not** cover.
- **It needs no scope token**, so it is correct on every lane that threads the caller, whether or not a search scope was supplied.
- **It is equality/`IN` form.** Never write `NOT IN` / `<>` / `NOT LIKE` against a token. On the 5.51 line an unresolved token substituted as a literal and a negation became a predicate matching everything; 6.1 leaves the token in place, so it fails closed by SQL error instead — louder, still a failure. The discipline costs nothing, and the 5.51 failure mode is silent on exactly the branch you would most want loud.

One cost to price in deliberately rather than discover: the resolved clause participates in the RunView cache fingerprint, so a per-user membership subquery means per-user cache entries.

**Implementation (2026-09-23).** The shipped walk is `fnCollaborationAccess`, not `ParentIDPath LIKE`. A filter cannot hold a `WITH` clause, and `ParentIDPath` is a CodeGen view column a host never regenerates. The function is the computed form: active memberships, then children with `InheritsMembership = 1`, the row with the fewest steps when two paths meet, and a visited path so a cycle ends instead of hitting `MAXRECURSION`. The same nearest-membership rule is `membershipReaches` in `packages/Core`. The `ParentIDPath` sketch above is the design we did not ship, for that reason.

**Decided: start computed, measure, materialize only if it stops being fast enough.** The alternative is a maintained `SpaceMemberEffective` table, and Collections is the cautionary tale — but read it precisely: *materialization is not the bug; materializing on only one of the two events is.* Collections writes rows into descendants when you **share** and never revisits on **create**, so a folder made after a share inherits nothing (§4a). If we ever materialize, both `SpaceEntityServer.Save()` (create **and** move) and `SpaceMemberEntityServer.Save()` recompute their subtree, or we have shipped the same defect. The honest cost of the computed form is that `s.ParentIDPath LIKE ms.ParentIDPath + '%'` cannot seek on a non-constant pattern — fine at hundreds of spaces, worth re-measuring at hundreds of thousands.

A non-obvious payoff: because the filter is a **subquery over membership** rather than a column comparison, inherited membership and an explicit sealed-child grant both resolve inside **one** filter. The simpler column form would have needed two filters on one entity and walked straight into the MJ#4078 shape §5 warns about. The subquery is what lets "one role, one filter" survive the tree.

**The magic-link door has its own filter.** Where a one-off reviewer arrives by link rather than login, the predicate pins the resource instead of the roster: `(CAST(ID AS NVARCHAR(450)) = '{{ScopeResourceID}}')`. MJ core's comment claims an absent scope *"matches NO rows"*; against a `uniqueidentifier` column an empty string is a **conversion error**, not a non-match — `bizapps-forms` hit exactly this and ships the cast for that reason. Both fail closed; the cast is what makes it fail closed *cleanly* instead of erroring the whole view. Write **one filter record per entity** — a same-entity invariant is enforced on save.

**Writes are not RLS — they are `BaseEntity` subclasses.** The write-side slots exist on the entity-permission row and are, in practice, unused; a subclass is the only place a rule reaches MJ's auto-generated CRUD mutations, and it covers the API and MCP alike. Three rules come with that:

- **`isNew` is load-bearing.** On an INSERT every field's `.Dirty` is `false`, so a predicate written only on dirtiness ignores exactly the forged path.
- **No constructor on the subclass.** A throwing constructor makes MJ fall back to plain `BaseEntity` — the guard vanishes, leaving one log line.
- **Split the predicate into a file with zero runtime imports**, so it is unit-testable with no MJ loaded. Refuse with a string that names the door, not the row.

**Three lanes RLS does not reach.** Name them now:

- **Root `All<Entity>`** — an unfiltered grant on this lane reads every row. Fixed by **closing the lane** at the GraphQL route, not by adding another filter.
- **`RunQuery` / datasets / reports** — a documented MJ bypass. Any stored query we ship carries its scope predicate *inside* the query SQL.
- **A bespoke resolver reading by a client-supplied id.** Authenticated-only, with no ownership predicate, it returns the record — and any pre-authorized storage URL — for an id the caller names. **A read-by-client-supplied-id is a gate site, always.** In MemberJunction 6.1.3, `CreatePreAuthDownloadUrl` and `SearchAcrossAccounts` check only entity-level Read on `MJ: Files` and then act on a client-supplied storage account id and object key, so the row filter never applies. A participant holds that Read grant. Not knowing an account id is all that stops them. This is core behavior; this app does not grant create on `MJ: Files` and does not call those routes.

Three scope guardrails, all shipped, all worth turning on deliberately:

- **`RequiredMetadataKeys`** names the columns a rendered filter must still mention, so a clause that vanished because a token did not resolve **skips the lane** instead of widening it. (Undocumented in the MJ guide; shipped and enforced.)
- **`restricts: true`** on a scope dimension forces `trust: 'ServerDerived'` and **discards** a caller-supplied value — which is what stops a model writing the tool call from choosing which space it searches.
- **`ExplainScope`** reports `Unbounded: true` when a scope has no lanes, because a scope with nothing in it is the *widest* scope MJ has. Assert it in CI.

**Test it with a persona, not a suite.** A green unit suite will not see the findings above; a persona-driven browser probe will. Ours is a member of exactly one space, holding exactly the participant role, and the exit criterion for every phase is that persona seeing exactly what it should — no more, and no less.

**Two bands, from day one.** Consulting interview notes carry candid, frequently promised-anonymous attributions. An agent with retrieval over *everything the team knows* will, on a good day, answer *"who identified the biggest obstacle?"* correctly, to the client, in writing. **Team band** — the engagement team's working material, never in the client-facing agent's scope. **Shared band** — promoted deliberately, with an actor and a timestamp. A band on `SpaceItem` fails loudly at promotion time, when a human is present; a folder convention fails silently the first time someone files a transcript wrong.

## 7. The agent — one, not four

**A user talks to exactly one agent, and it is smart enough to do whatever.** An earlier draft listed four (client-facing, internal, promotion, summarizer); that was an org chart, not a UX, and it was also the weaker security design. Four agents means **four places the retrieval boundary gets configured**. Two implementations are only safe with a test that drives both and asserts one answer. One agent means one code path and one boundary.

The client-versus-team distinction does not need two agents because **the band filter on the caller already makes it**. The same agent, asked the same question by a client contact and by the engagement lead, answers from different material because the *caller* differs — not because someone wired up a different agent. That is the §6 doctrine doing its job.

| Capability | What it is | KPI |
|---|---|---|
| Ask | Answers from the caller's own effective scope — subtree ∩ readable ∩ band ∩ `AgentRetrieval` | Questions answered without a human; **zero cross-band retrievals in audit** |
| Promote | Proposes Team→Shared promotions and flags attribution risk in candidates | Promotion review time; attributions caught pre-share |
| Summarize | Per-member digest of what changed, honoring band and notification preferences | Digest open rate; reduction in status-chasing |
| Find & act | Locates material, opens a task, routes a signature — through the existing Action layer | Actions completed in-thread |

Promotion and summarization are **skills it invokes**, not agents you choose between. Internally it may well be a supervisor with sub-agents — MJ's agent framework supports that and it is invisible to the user; "one agent" is a statement about the UX and the boundary, not about delegation.

**Naming.** *Space* is the right word for the table; **workspace** is the term of art for humans, and it already is — the human-facing noun comes from `SpaceType.Vocabulary` (workspace for consulting, committee for governance, cohort for a class, community for open), so this is the design working rather than a change. `ng-conversations`' own shell is already `conversation-workspace.component.ts`. The agent's own name is deployment configuration with a plain default; **"Space Agent" does not ship**.

## 8. What we contribute back to core

The app stays an app; the platform gaps it exposes get fixed in the platform.

| Contribution | Why core, not the app | Size |
|---|---|---|
| **Presence / typing indicators** | Core cannot depend on an app, so presence anywhere else means the core conversations component can never show it. It belongs beside `MJ: Conversations` and the push it rides. | Small — ephemeral, lossy-tolerant |
| **Live message fan-out** | Same transport, different reliability bar: a dropped message leaves the thread wrong. Push today is filtered per session *and* per tab by design. | **The one real build.** Route via the LiveKit data channel, which already does multi-party |
| **@mention → human notification** | The parser already emits `userMentions` with **zero consumers** — mentioning a person notifies nobody. Every conversations consumer needs this. | Small — copy the share handler |
| **Threading as an opt-in capability** | ⚠️ **Correction: the threading itself already ships.** `ParentID` exists on `MJ: Conversation Details`, `thread-panel.component.ts:91` loads replies by it, and `message-input.component.ts` threads agent responses under their delegation message in eight places. What is missing is exactly the optionality: **a capability flag on `MJ: Conversations`** and **an `@Input() AllowThreading`** that can force it off regardless, with the reply affordance hidden when either says no. The nearest thing today is `showThread` in `realtime-ui-config.ts:208`, which is a responsive width ratchet in the realtime plane — chrome, not a capability. | Small |
| **Per-user read state** | Nothing in Conversations, Committees, or Secure Messaging has it; all three store read/star/archive as global per-record flags. | Small |
| **Collections: Role/Team grantee + computed inheritance** | Makes Collections usable for group-owned libraries (§4a). Generally useful, not ours alone. | Medium |
| **Collections as a seeded `MJ: Resource Type`** | Absent today, so share notifications carry a null `ResourceTypeID` and cannot deep-link. | Trivial — one seed row + a driver class |
| **Application access has no server-side predicate** | `UserHasApplicationAccess` is a client-side check, and zero role rows on an application reads as *open to everyone*. Every portal-shaped app inherits this, and an Open App install can add applications the same way CodeGen does. | Medium — the server check, plus a ruling on the backwards-compatible default |
| **Search: the storage bypass** | `filterByPermissions` opens with `[...storageResults]`, so storage hits skip the safety net; accounts with no permission rows are world-readable and the permission list is cached process-wide under the first configuring user. | **Fix first** |
| **Search: the `fulltext` trust allowlist** | All four shipped external-index providers declare `SourceType='fulltext'` while querying someone else's index, so they are admitted unverified whenever the labelled entity has no row filter. The covering test uses a SourceType no provider emits. | **Fix first** |
| **Search: vector permission push-down** | The documented role→metadata-filter translation does not exist. The post-fusion net catches it, at a recall cost. | Larger; can follow |

The two search items marked *fix first* are small and are the ones that would bite a client portal. **They are worth doing in this wave regardless of what happens to the rest of this plan.**

## 9. Roadmap

**Phase 0 — three spaces, one week.** One space on a real client engagement — **with a sub-space**, so the tree is exercised on day one (actual deliverables, both bands, the space id wired to the agent's scope, one agent); one on a real committee (same code, a SpaceType with governance panels on, one external director invited); and one cohort, because it is the motion with the most instances and the least code. Adversarial test: a partner actively tries to make the scope leak, from the child and from the root.
*Kill criterion:* the committee or cohort space needs code the engagement space did not — then this is a one-engagement services build, not a product. Stop.

**Member posting is deferred.** Core's conversation-detail gate allows a write when the parent conversation does not load for the caller, and it requires a resource-permission grant when it does. Granting participants `CanCreate` on details would let them post into conversations they cannot see. Members do not post from this app until core grows a gate keyed on `LinkedEntityID`. The space's conversation is created as the system user, owned by the space owner.

**Phase 2 core contributions stay in MemberJunction.** Presence, @mention notifications, and per-user read state are core work. They are not in this repository. Amith decides when they land in MJ. Phase 2 in this app is the library, the task projection, share notices, and item uses.

**Shipped instead of the Phase 1 sketch (2026-09-23).** `ParentID` does not carry the `IsHierarchy` flag (set in one migration, cleared in the next), so CodeGen emits no path columns or traversal functions. The walk is `fnCollaborationAccess`, which is T-SQL and needs a PostgreSQL port. `ExplainScope` is not wired. `agentMayQuote` is the retrieval rule and is not called on save. Reach and band are what the filters enforce. The persona check is `scripts/persona-check.sql`.

**Invitation door (2026-09-23).** Item 15 is the roster invitation, not the one-off reviewer link. An email saves a seat through the member gate, so the ceiling, approval, and member cap apply. The sign-in link is a plain app session and does not outlive the seat. Anyone who can invite may send one, within their ceiling. The raw URL goes to the address when the host has an email channel, and otherwise only to a caller who passes MemberJunction's issuer rule. A space owner who does not is refused the URL. The one-off `resource-share` reviewer door is a later item. Giving `CreateInvite` a resource id and an issuer hook is MemberJunction work, on the list in §8, and is Amith's call.

**Phase 1 — the container.** Five entities, each scoped table carrying a `NOT NULL` `SpaceID`; `Space.ParentID` with `IsHierarchy: true`; `SpaceType`'s `Discoverability` / `JoinMode` axes modelled (community *surface* deferred, §2); delegated invitation with the four-clause ceiling and the identity door settled; Resource Type and Permission Domain registration; one membership RLS filter per entity; the `Space Participant` role with its zero-row shell grants; the write-gate subclasses; conversations bound by `LinkedEntityID`; magic-link invitation and the single roster; band promotion with actor and timestamp. Three things ship **with** it, not after: the **external-participant test persona**, the **branded no-access page**, and the **`All<Entity>` lane audit and guard**. `ExplainScope` assertion in CI.
*Kill criterion:* membership cannot be expressed without derived permission rows that drift — if the permission provider cannot answer from the roster directly, the seam is wrong.
*Exit criterion:* the participant persona, driven through a browser, sees exactly one space's material and nothing else on every lane in §6.

**Phase 2 — library, work, notification.** Resource library over MJ Files with space scoping and Collections foldering; external upload; `bizapps-tasks` declared and projected for light project planning; notification-on-share; usage tracking for people and agents. Core contributions land: presence, @mention notification, per-user read state.
*Kill criterion:* none — this is assembly. If it is not assembly, §4 is wrong.

**Phase 3 — governance and scale.** Committees refactors onto Space, following its own `ActionItem`→tasks precedent (polymorphic links in the shared app, a thin projection service, drop the local table). Live message fan-out lands in core.
*Kill criterion:* committees cannot adopt Space without breaking its published schema — then the container shape is wrong for governance and needs redesign before more consumers.

**Phase 4 — adoption and hardening.** Retention and entitlement as SpaceType configuration; the deliverable-agent offer for former clients, which the perpetual root is what makes possible; SOC 2 evidence collection underway **before** the first external client sees a space; license and distribution settled (§11). **Community is a later release, not a phase here** — the axes ship in Phase 1 and the surface waits for a customer who wants it.

## 10. Risks

| Risk | Sev | Mitigation |
|---|---|---|
| An agent surfaces a promised-anonymous attribution to a client | High | Two bands from day one; retrieval bounded by the caller; promotion is an audited act; Promotion Assistant flags attribution risk |
| Scope-only boundary leaks through the full-text lane | High | Boundary lives in RLS on our entities; the scope filter is narrowing, not the control |
| A participant holds a second role with an unfiltered grant, making RLS inert | High | Audit every role a persona holds before adding a filter; never grant `UI`; pin with a test that drives the narrowest persona |
| A participant forges a write MJ's generated CRUD mutation happily accepts | High | Write gates are `BaseEntity` subclasses, not RLS — the write-side RLS slots are unused in practice; every predicate tests `isNew`; no constructor on the subclass |
| Becomes a one-engagement services build rather than a product | Med | Phase 0's committee space is the test; the kill criterion is explicit |
| Live message fan-out is larger than estimated | Med | Route through the LiveKit data channel; presence ships independently |
| Client security review asks for SOC 2 we do not have | Med | Name an owner and start evidence collection before the first external space; the evidence window is twelve months |
| The computed subtree predicate stops being fast enough | Med | It is a prefix match that cannot seek; measure at realistic space counts before Phase 2. Materialization is the documented fallback and must recompute on **both** space-move and membership change, or it reproduces Collections' defect |
| A client admin grants access they do not themselves hold | High | The four-clause ceiling in `SpaceMemberEntityServer.Save()`, `isNew` tested; a persona that tries all four violations is part of the Phase 1 exit criterion |
| First app to seed a Resource Type and ship a Permission Domain | Low | Both are data-driven paths with no hardcoded core list; fixture-test both |

## 11. Open decisions

1. **Owner.** Unnamed.
2. **Does `MJ: Artifact Uses` cover plain files, or only artifacts?** Decides whether agent-usage tracking is free or a small build.
3. **File Requests** — lift the shape into Collaboration, or revisit `bizapps-secure-messaging` as an optional dependency later?
4. **Does committees adopt Space in Phase 3, or is that forked into its own decision?** It is the strongest proof and the largest refactor.
5. **License and distribution posture** — source-available in the manner of `bizapps-forms`, or another free distribution? Free is decided (§3); *how* it is distributed is not, and it sets the repo's license header and publish path.
6. **Does the deliverable-agent offer outlive the engagement, and on what entitlement?** The perpetual root makes it *possible*; grants carry `ExpiresAt`. The business rule is unwritten.
7. **Which door creates an external participant's identity?** Invite-based (an IdP invitation, or a pre-created account plus a password-set link) versus open self-signup. For outside directors and client teams, invite is almost certainly right — but it decides the provisioning service's shape, so settle it before writing one.

---

*Every platform claim in this plan was read from MJ v6.1.2 source or the app repositories rather than from guides — several guides are stale in ways noted inline. Where something is documented but not implemented, this plan says so. **Two behaviours are version-sensitive and are labelled as such**: on the 5.51 line, multi-filter RLS was joined without wrapping the group (MJ#4078), and an unresolved token in a negation could match everything. Both behave differently on the 6.1 line this app builds on. Re-verify on the pin; do not port a 5.51 workaround.*
