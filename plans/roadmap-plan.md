# The roadmap: from a sound engine to a world-class collaboration product

**What this is.** A plan only. It sets the order of work for Collaboration after PR 10, from making its trust claims true through to running at scale for client portals and downstream Open Apps that build on `Space`. It adds no code. It sits beside [the plan](plan.md) and [PR 10's plan](pr10-plan.md): those stay the record of what each item means and why; this one decides **what comes next, in what order, and what "done" looks like for each horizon.** Where an item here already has a number in the plan (A5, B6, …), this plan uses that number and doesn't restate it.

**Who does what.**
- **Maintainers run each horizon** with AI-assisted builders and reviewers.
- **Platform reviewers** verify the substrate contract ([§ 4.3](#43-the-substrate-contract)) and the outsider shell ([§ 5.4](#54-a-room-built-for-outsiders)).
- **Product leadership** settles the open calls in [§ 11](#11-open-calls) and merges.
- **Each horizon is its own pull request (or several),** each with its own plan section, persona test and screenshots, reviewed the way [PR 10's § 13](pr10-plan.md#13-how-reviews-run) describes. Work that belongs in MJ, `bizapps-tasks`, `bizapps-common`, or a downstream Open App goes in that repo's PR and is tracked here.

## Contents

1. [How we got here](#1-how-we-got-here)
2. [What "world class" means for this product](#2-what-world-class-means-for-this-product)
3. [Decisions](#3-decisions)
4. [Horizon 0: make it true](#4-horizon-0-make-it-true)
5. [Horizon 1: make it alive](#5-horizon-1-make-it-alive)
6. [Horizon 2: where work gets decided](#6-horizon-2-where-work-gets-decided)
7. [Horizon 3: the agent everywhere the client already is](#7-horizon-3-the-agent-everywhere-the-client-already-is)
8. [Horizon 4: scale, compliance and the community surface](#8-horizon-4-scale-compliance-and-the-community-surface)
9. [What the portal and the sibling apps get, and when](#9-what-the-portal-and-the-sibling-apps-get-and-when)
10. [How we know it's working](#10-how-we-know-its-working)
11. [Open calls](#11-open-calls)
12. [Rules for the work](#12-rules-for-the-work)

---

## 1. How we got here

On 2026-11-12 a deep dive on this repo set out a roadmap for making Collaboration a world-class product, informed by client portal requirements and downstream Open App substrate needs.

### 1.1 This repo, as it stands and across Horizon 0 waves

**The engine is sound, and its core idea is the differentiator.** One object, the space, is both the permission boundary and the agent's retrieval boundary:
- a space tree with sealed or inheriting sub-spaces, `SpaceTypeStatus` lifecycles (`Active`, `Paused`, `Closed`, `Archived`), and resumable `Paused` vs terminal `Closed` rules;
- Team and Shared bands with an audited promotion;
- one published access function, `fnCollaborationAccess`, that other apps filter their own rows with;
- space types as plug-ins (`SpaceType` rows, server and UI drivers, IsA subtypes, and `TargetApplicationID` invite routing);
- agent turns that run on the server as the asking user, with grants as tools, **structural chat scope** (`Collaboration Space Scope` via `SearchScopeIDs` + `Audience` intersection), and per-answer **source receipts** (`SpaceAgentSourceReceipt`).

**What started as Horizon 0 gaps (and subsequent wave progress):**
- **No live delivery yet.** Nothing pushes another person's message, presence, typing or unread state; the rail has an `unread` style that nothing populates.
- **Notifications are in-app only** (share, status change, and external IdP sign-in notifications): mentions, email digests, and preferences remain (B6, A12).
- **Only room-wide chats and 1:1 Assistant chats.** Multi-person subset direct/group chats await `MJ: Conversation Participants` (A5).
- **No documents or pages.** The page editor was reverted in `be19c01` / `V202611051155`, and notes (`SpaceNote`) bridge until MJ Docs (D55).
- **Meetings:** `bizapps-tasks` ships meeting entities and `SyncSeats` has landed; full Space Meetings tabs/transcripts follow in Horizon 2.
- **No phone layout** (two `@media` rules in the whole UI). Outsiders currently land in the configured MJ Application shell (now declarable per `SpaceType.TargetApplicationID`, with external IdP invite provisioning when `magicLink.enabled = false`).
- **UI extension points & branding (landed in C4):** dynamic agent display names, active application naming, `NeedsYouProvider`, `BaseSpaceHeaderChipProvider`, `GetHeaderChips`, `GetHeaderActions`, and `GetSettingsSections` are now wired with live `Space` records.
- **Rights by authorization (landed in C2):** role-name staff checks were eliminated (`check-no-role-name-auth.mjs`).
- **Structural chat scope & receipts (landed in C3):** `Collaboration Space Scope` (`ServerDerived` `SpaceID` + `Audience` dimensions with `strictValidation: true`) and `ExecuteAgentParams.Audience: { Mode: 'Intersection', UserIDs }` bound agent turns structurally, and `SpaceAgentSourceReceipt` records and renders bounded citations.
- **Platform & licensing (landed in C4 / OPS-1 Prep):** MJ `6.3.0-edge.1` is pinned, **[MemberJunction/MJ#4789](https://github.com/MemberJunction/MJ/pull/4789) (A14–A19) has landed** in MJ 6.3, dual-dialect SQL Server + PostgreSQL migrations ship for new schema changes, and `BUSL-1.1` license metadata is set across workspace packages and `mj-app.json`.
- **People field-level security** (`bizapps-common`) and **`collaboration-section.component.ts` modularization / paging** remain tracked hygiene items.

### 1.2 The early pull requests and issues

| # | What | Where it lands |
|---|---|---|
| PR #38 | Member photos everywhere a space draws a person | Horizon 0 (landed) |
| PR #31 | `SyncSeats` plus space meetings | `SyncSeats` landed; meetings follow in Horizon 2 on `bizapps-tasks` |
| PR #33 (draft) | Reverted UI polish and Space Pages | Not revived. Rail/header/Home ideas feed the approved UX process in Horizon 1; pages move to MJ Docs (D55) |
| PR #14 | Advisory caret-pin check | Horizon 0 hygiene (landed) |
| Issue #37 | Substrate contract: downstream apps own their own type seed rows, `AllowedParentTypeCodes`, open-window helper, cross-space item mounts | Horizon 0, the substrate contract |
| Issues #25–#27 | Page comments as rows, participation operation, save concurrency | Superseded by MJ Docs (D55); acceptance tests carry over |

### 1.3 Client portal requirements and engagement continuity

Client portal builders rely on Collaboration as the foundational engagement layer ("the persistent agent is the product; the portal is what makes it possible"). Under the **post-close root chat pattern**, each external organization gets a perpetual root space (`ParentID IS NULL`) that stays `Active`, each time-bounded engagement or workstream is a child sub-space under it, and the space's configured agent remains available in the root space after individual child engagements move to `Paused` or terminal `Closed`.

Audience-bounded retrieval ("in a chat the Assistant uses only what **every** person in it can see, recomputed each turn") is the core security property. Portal builders require:
- Team/Shared bands with audited promotion and share checks;
- `EnsureSpaceForRecord` from a won engagement, and `SyncSeats` from staffing rosters;
- an allowed-agent chain (`SpaceGrant` of kind `Agent`) with per-space prompt parts and dynamic agent naming;
- lifecycle statuses (`SpaceTypeStatus`: `Active`, `Paused`, `Closed`, `Archived`) supporting the post-close root chat pattern and `AgentRetrieval` exclusion controls (`ExcludedEntirely`, `ExcludedFromParentScope`);
- Teams/Slack channel binding (U3) and multi-agent chat participants (U4);
- answer receipts naming their bounded sources (U5 — landed in C3);
- an Approvals Desk unifying share promotions, `bizapps-tasks` `TaskDecision` approvals, and `MJ: AI Agent Requests`;
- cadenced digests, meeting transcripts filed to the Team band, and *Needs you* / agenda providers.

Collaboration remains free of per-seat or AI add-on pricing gates at the app layer and ships under `BUSL-1.1` (`OPS-1 Prep`).

### 1.4 Downstream Open Apps using Collaboration as a substrate

Multiple downstream Open Apps build on `Space` without Collaboration knowing about them:
- **Community & member forum apps** extend `Space` (`IsA Space`, space-scoped forum tables filtered with `fnCollaborationAccess`), requiring an explicit, versioned substrate contract so schema or configuration changes (such as `SpaceTypeStatus` and `Configuration` JSON) are caught by contract tests rather than drifting silently.
- **Governance & board apps** extend `Space` for boards and terms (`IsA Space`), use `SyncSeats` for rosters, bands for working vs published minutes, `SpaceItem` for board packets, `bizapps-tasks` for meetings/agendas, and `bizapps-tasks` `TaskDecision` for formal approvals and decisions.
- **Ballot & poll apps** integrate seat-based eligibility sources and *Needs you* providers for open ballots.
- **Recording & transcript apps** file recordings and transcripts into spaces via `EnsureSpaceForRecord`.
- **Accreditation, peer-review, and external messaging apps** share the same bounded rooms, external IdP / magic-link access, anchored comments, notifications, and approvals instead of rebuilding duplicate subsystems.

Across them, comments, files, external access, notifications, meetings, decisions, anchors, and membership unify onto one tested substrate.

### 1.5 The conclusion

Collaboration has to be world class at three things, in this order:
1. **A provable boundary.** The agent uses only what everyone in the room may see, and anyone can audit that. This is the differentiator and the portal's whole security story.
2. **A room outsiders come back to.** Client staff judge it on day one against Slack and Notion; liveness, notifications and a clean outsider shell are table stakes.
3. **A stable substrate.** At least six apps build on `Space`. The contract has to be explicit, versioned and tested, so drift like Community's fails CI rather than a host install.

The horizons below follow from that order, settled in [§ 3](#3-decisions).

## 2. What "world class" means for this product

These are the bars each horizon is judged against, not features:

| Bar | Means | Proven by |
|---|---|---|
| **Provable boundary** | Every agent answer uses only what every person in the chat may read, recomputed each turn, with its sources recorded and shown | An adversarial persona suite that fails on any leak; an answer receipt on every agent message |
| **Live** | Another person's message, a mention or a status change reaches you within a second, with unread state and presence | Two browsers, one change, measured latency in the client harness |
| **Outsider-first** | A client goes from an email to a useful room in under a minute, on a phone, without seeing MJ Explorer | A timed, recorded persona run on a phone viewport |
| **Calm** | People get what matters to them, at the cadence they chose, and can turn it down | Notification preferences honoured in every channel; digest content tests |
| **Decisive** | Approvals, sign-offs and promotions happen in one place, with the follow-up done automatically | Approvals Desk scenarios in the harness |
| **Substrate** | A downstream app builds on a published, versioned contract and is told by CI when it breaks it | Contract tests run here and in each consumer's CI |
| **Fast at scale** | Every screen stays fast at 10,000 spaces, 100,000 items and 1,000 members in a space | A scale world in the harness with p95 budgets per screen |
| **Trusted to buy** | Licence, owner, SOC 2 evidence, clean install, PostgreSQL, export | Release-readiness checks |

## 3. Decisions

Numbering continues from the plan's D52.

- **D53 (2026-11-12): trust first, then liveness.** Horizon 0 makes the boundary true and freezes the substrate before Horizon 1 adds liveness. The alternative demos better sooner but puts clients in a room whose boundary isn't proven.
- **D54 (2026-11-12): the outsider shell is a standalone, brandable host on the widgets package,** not more polish inside Explorer. Staff keep Explorer; outsiders get the shell (and `SpaceType.TargetApplicationID` lets each space type declare the MJ Application invited users land in). The widgets package already runs outside Explorer (`packages/UXGallery` proves it), so this is the L3 surface the UI layering guide expects, not a rewrite.
- **D55 (2026-11-12): documents and pages come from MJ Docs, not from this repo.** MJ Docs (documents, including pages) ships in **MJ 6.3** (alongside **[MemberJunction/MJ#4789](https://github.com/MemberJunction/MJ/pull/4789)**, which has landed in MJ 6.3). Collaboration adopts MJ Docs in Horizon 2 ([§ 6.2](#62-documents-and-pages-on-mj-docs)). Until then:
  - **`SpaceNote` stays, and is marked temporary.** Its README line, entity description and Notes tab say it will move to MJ Docs. It gets no new features (no rich text, no comments, no versioning) and no new dependants.
  - **Space Pages are not revived.** Draft PR #33 stays closed as a reference; issues #25–#27 are closed as superseded, and their lessons become acceptance tests for the Docs integration.
  - **The two orphan page filters are removed** in Horizon 0.
- **D56 (2026-11-12): the Approvals Desk lives in Collaboration** as a generic, public inbox over three existing sources: share promotions, **`bizapps-tasks` `TaskDecision`** (`MJ_BizApps_Tasks: Task Decisions`, with `TaskDecisionEntityServer` attribution), and `MJ: AI Agent Requests`. Downstream policy (such as domain-specific tiers or approval budgets) stays in the owning app, while decisions themselves are recorded uniformly via `bizapps-tasks` rather than duplicating decision tables per app.
- **D57 (this plan): the substrate contract is versioned and tested.** What a downstream app may rely on is listed in one document, carries a contract version in `mj-app.json`, and is pinned by contract tests that downstream repos also run. Changing it is a minor bump with a migration note; removing from it is a major bump, per MJ's publish-then-no-breaking-changes policy.

## 4. Horizon 0: make it true

**Goal:** the boundary is real, the substrate is explicit, and the repo is release-ready. **Exit:** client portals and downstream Open Apps (governance, community forums, anchored rooms) can build against a fixed, verified contract.

### 4.1 Unblock the participant

| Item | Detail | Done when |
|---|---|---|
| H0.1 Participant chat on MJ `next` | MJ's conversation engine filters with a subquery over `vwConversationDetails` that the client-clause screen refuses for a row-filtered user (PR #38). Fix it in MJ, per the no-workarounds rule (D49). | The client harness's chat checks pass as a participant (Bea), not only as staff; screenshots of a participant's chat in light and dark |
| H0.2 People field-level security | bizapps-common#186, carried from [PR 10 § 4](pr10-plan.md). PR #38 widens `PhotoURL` deliberately; everything else stays denied. | FLS1–FLS3 pass for every People field a participant may and may not read, server and over the wire |
| H0.3 Merge PR #38 | Member photos | Merged; the plan's wording about what clients see of a person updated |

### 4.2 The bound and its proof

| Item | Detail | Done when |
|---|---|---|
| H0.4 Audience-bounded runs & structural chat scope | A5 conversation participants, A6 runs bounded by an audience (`fnCollaborationCommonAccess` and `ExecuteAgentParams.Audience: { Mode: 'Intersection', UserIDs }`), **structural chat scope** (`Collaboration Space Scope` via `SearchScopeIDs` with `ServerDerived` `SpaceID` and `Audience` dimensions and `strictValidation: true`), B2 retrieval by audience, B3 conversations in a space. | Structural scope + intersection audience landed (C3); adversarial persona checks refuse any Team/sealed/private/cross-space leak |
| H0.5 Provenance and receipts | `SpaceAgentSourceReceipt` stores and renders bounded sources for every agent answer, filtered by live reader reach. | Landed in C3: every agent message records receipts; never names an out-of-reach source |
| H0.6 Agent scope enforcement | `agentMayQuote` called on every retrieval path, `AgentRetrieval = ExcludedEntirely` / `ExcludedFromParentScope` honoured, and `SpaceTypeStatus.AgentRetrieval` enforced across child and root spaces. | Enforced (C1–C3): an `ExcludedEntirely` space never appears in any agent's sources |
| H0.7 Rights by authorization, everywhere | Replace role-name staff checks with MJ Authorizations (`Administer Spaces`, `Configure Spaces`, `Configure Space Types`, `Close and Reopen Spaces`). | Landed in C2 (`check-no-role-name-auth.mjs` enforces zero role-name auth) |

### 4.3 The substrate contract

| Item | Detail | Done when |
|---|---|---|
| H0.8 Write the contract | One document, `docs/SUBSTRATE_CONTRACT.md`: the tables, columns and functions a downstream app may use (`Space`, `SpaceMember`, `SpaceItem`, `fnCollaborationAccess`, …), the driver hooks, `EnsureSpaceForRecord`, `SyncSeats`, UI contributions, `TargetApplicationID`, `SpaceTypeStatus`, `bizapps-tasks` `TaskDecision`, and the rule for who owns which seed row. `EXTENSIBILITY_PLAN.md` updated to match the code. | Reviewed by downstream app maintainers |
| H0.9 Issue #37 | (1) Downstream apps own their domain space-type seed rows. (2) A child type declares `AllowedParentTypeCodes`, merged with the parent's `AllowedTypeCodes`. (3) Export the open-window test as an inline function, and decide `Listed`/`Open` reads for non-members (call 18). (4) Allow one record in more than one space: `UQ_SpaceItem_Entity_Record` becomes `(SpaceID, EntityID, RecordID)`, with a mount operation that checks the target space's rules. | Each item has a test; downstream apps can mount shared items across spaces |
| H0.10 `SyncSeats` | Taken from PR #31 | Landed: roster-backed apps can sync `SyncSource` seats; harness covers create, update, remove, and invites |
| H0.11 Post-close root chat pattern & status lifecycle | `SpaceTypeStatus` (`Active`, `Paused`, `Closed`, `Archived`) governs `ReadOnly`, `Visible`, `AgentRetrieval`, and terminal `IsTerminal` (`Closed` is terminal; `Paused` resumes to `Active`). Perpetual root spaces remain `Active` for ongoing agent chats while closed child spaces refuse writes/turns (`post-close root chat pattern`). `AgentRetrieval` settings allow level-level exclusion. | Landed across C1–C4 (`Closed` vs `Paused` UI/server parity verified) |
| H0.12 Contract tests | A published test bundle, run here and in each consumer's CI, that fails on a renamed column, a removed hook or a changed function signature (D57) | Downstream schema/API drift fails CI automatically |
| H0.13 Ship the extension points | Wire what's declared: `NeedsYouProvider`, `BaseSpaceHeaderChipProvider`, `GetHeaderChips`, `GetHeaderActions`, `GetSettingsSections` (with live non-null `Space` passed to `GetTabs` / `GetOverviewCards`), plus agenda, new-space steps, and vocabulary | Wired in C4; `packages/ExampleSpaceTypes` and unit/render suites cover them |

### 4.4 Hygiene and release readiness

| Item | Detail | Done when |
|---|---|---|
| H0.14 CI green | Pin the runner to `ubuntu-24.04` or bump Playwright; run the client harness in CI | Both jobs green on `next` |
| H0.15 MJ 6.3 & MJ#4789 | Pin MJ `>=6.3.0-edge.1 <7.0.0` (with **[MJ#4789](https://github.com/MemberJunction/MJ/pull/4789)** A14–A19 landed in MJ 6.3); follow-up lifts pre-MJ#4789 grant guards in `SpaceGrantEntityServer` / `grant-operations.ts` | `mjVersionRange` and package pins target MJ 6.3 |
| H0.16 Remove leftovers | Remove orphan page filters; mark `SpaceNote` temporary (D55); merge PR #14 | No metadata references a missing table |
| H0.17 Release readiness & BUSL-1.1 (`OPS-1 Prep`) | Set `license: "BUSL-1.1"` across root/workspace `package.json` and `mj-app.json`, dual-dialect SQL Server + PostgreSQL migrations, external IdP invites (`magicLink.enabled = false`), clean `mj app install` | Clean-install SQL Server & PostgreSQL migrations and package/manifest checks pass |
| H0.18 Split the page component | Break `collaboration-section.component.ts` into a shell over per-tab components, without behaviour changes | No file over 1,000 lines in `packages/Angular`; every existing render test still passes |

## 5. Horizon 1: make it alive

**Goal:** a room people want to be in, for staff and outsiders alike. **Exit:** client portals run live with external participants on phones.

### 5.1 Live delivery

- **Live messages, unread state, presence and typing** (A12), over MJ's pub/sub, scoped to the space's audience. First fix the security item A12 names: today the `cacheInvalidation` subscription sends every saved row to every socket.
- **Unread counts** on the rail, tabs and Home, kept per member.
- **Optimistic sends** with retry, so a slow network never loses a message.
- **Done when:** two browsers see each other's messages, mentions and status changes within a second; a participant's socket never receives a row outside their reach.

### 5.2 One notification system

- **In-app, email and digest channels** through MJ's notification engine, for mentions, replies, shares, status changes, tasks and approvals (B6).
- **Preferences per member and per space,** including for outsiders, with one-click unsubscribe from email.
- **Digests on a cadence** (daily or weekly), reusable by advisory and portal workflows.
- **Reply by email** posts into the thread as the sender.
- **Done when:** no event in the harness is delivered against a member's preference, and a digest never names a record outside the reader's reach.

### 5.3 Conversations people expect

- **Direct and small-group chats** with a chosen set of seats, bounded by that set (they reuse H0.4's structural chat scope and audience bound).
- **Threads, reactions, edit and delete** with history, and pinned messages.
- **History-on-add choice** when someone joins (configurable per space/type, e.g., *All* for staff).
- **Move the thread and agent-indicator work upstream** into `ng-conversations`, as `ui-polish.md` already intends, so every MJ app gets it.

### 5.4 A room built for outsiders

- **The outsider shell** (D54): a standalone host on the widgets package, brandable per deployment (logo, colours through tokens, domain), with only the space screens an outsider needs.
- **Onboarding** from a magic link to a useful room in under a minute: invite expiry and provenance, delegated invites within the four-clause ceiling, domain rules ("only @client.com, never above Contributor"), and a first-run tour.
- **A phone layout** for every screen, starting with frame 12 of the UX proposal.
- **Done when:** a recorded persona run on a phone viewport goes from email to a first answer from the agent in under a minute.

### 5.5 Finding things

- **A search box for people,** in a space and across spaces the reader can reach, over the same scope the agent uses: messages, files, notes, tasks.
- **An activity feed** per space and on Home, built on the event sources the space already has (`ItemUse`, chats, tasks, status changes).
- **A real *Needs you*** on the Overview and Home, fed by the providers from H0.13.

### 5.6 The UX pass

The approved UX process (`docs/ux/IMPLEMENTATION_PLAN.md`) takes the useful ideas from draft PR #33 (rail switcher with search, starred spaces, the one-row header with the audience pill, Home's *Coming up*) through frames and review before any code. Nothing ships outside the approved frames. That was the lesson of the #24/#32 revert.

## 6. Horizon 2: where work gets decided

**Goal:** decisions, documents and meetings happen in the space, not around it. **Exit:** the full delivery and approval loop (Plan → Build → Verify → Present → Feedback → Approve → Promote) runs end to end in a space.

### 6.1 The Approvals Desk (D56)

- **One inbox** for share-check promotions, **`bizapps-tasks` `TaskDecision`** sign-offs (`MJ_BizApps_Tasks: Task Decisions`, with `TaskDecisionEntityServer` stamping `DecidedByPersonID`), and `MJ: AI Agent Requests` (A8/B7 proposed posts included), filtered to what the viewer may decide.
- **A deterministic follow-up** for each decision type, through a registered handler (for example: an approved deliverable triggers downstream billing or fulfillment via an app driver).
- **Delegation, due dates and escalation,** and an audit trail queryable in SQL.
- **The share check's findings** come from the assistant instead of `shareFindings = []`.

### 6.2 Documents and pages on MJ Docs

- **Adopt MJ Docs from MJ 6.3** (D55): a document lives as a space item on a band, with its own reach, comments, versions and concurrency from MJ.
- **Migrate `SpaceNote`** rows into documents with a one-time, idempotent operation, then retire the table and the Notes tab in a later minor release, under the no-breaking-changes policy.
- **Acceptance tests carried from issues #25–#27:** a comment is its own row written by its author; a member may tick a checklist or comment without edit rights; two editors never silently overwrite each other.
- **Agents read and propose edits to documents** within the audience bound; an agent's edit is a proposed change, never a silent write.

### 6.3 Meetings

- **`bizapps-tasks` ships the meeting entities** (T1, [meetings-plan.md](meetings-plan.md)); then the space Meetings tab, *Coming up* and the meeting chat from PR #31 land here.
- **Automated meeting capture files transcripts** into the Team band, with a Shared summary that goes through the share check.
- **Action items become proposed tasks** on the Approvals Desk.
- **Calendars** (A18, landed in MJ#4789) and video providers after.

### 6.4 Files that work like documents

- **Versions, comments and approvals on files,** and **e-signature** through MJ's `eSignature` package, so external signature flows and client acceptance steps use one path.
- **File requests** (call 10): ask an outsider for a document, with a due date and a reminder.
- **Per-space storage accounts,** which are validated today but not used on upload.

## 7. Horizon 3: the agent everywhere the client already is

**Goal:** the agent is a teammate the client reaches from where they already work. **Exit:** a significant share of client-facing conversations happen outside the primary portal UI with identical boundary guarantees.

- **The agent over MCP** (A9/B5): `AgentTurnHandler` as a server operation MCP calls, never a raw search tool, carrying the same structural chat scope and audience bound.
- **Teams and Slack channel binding** (U3): the audience is the channel roster, and the binding suspends when an unmapped member joins.
- **Named specialist agents** in a chat (U4, in MJ): multiple configured agents become visible, each bounded by the same audience.
- **Space memory:** a per-space and per-client profile built from MJ agent notes, Team band only, editable by staff.
- **Cadenced advisory:** weekly, monthly and quarterly reports through the digest skill, filed as space items and promoted through the share check.
- **Live sessions:** realtime rooms in a space, with transcripts landing as Team-band items (MJ's realtime and session-capture guides).

## 8. Horizon 4: scale, compliance and the community surface

**Goal:** Collaboration is something a large host and an auditor are both comfortable with.

- **PostgreSQL** (B11): dual-dialect schema parity and runtime execution across SQL Server and PostgreSQL.
- **Performance:** measure `fnCollaborationAccess` in a scale world (10,000 spaces, 100,000 items, 1,000-member spaces); replace it with an inline or materialised reach if p95 budgets fail; add server-side paging everywhere a list has a hard `MaxRows` cap.
- **The admin console:** edit space types, the assistant and grants in screens, not raw records (frame 09); usage and health per space.
- **Compliance:** SOC 2 evidence (audit logs, access reviews, retention), data export and offboarding for a departing client, retention rules per space type.
- **The community surface** for forum-backed Open Apps: self-serve join, join requests, directory and member cap (B12), with `Listed`/`Open` reads decided in H0.9.
- **Unify the duplicates** (§ 1.4) as each app is next touched: comments on MJ anchored comments, files as space items, external access on MJ magic links and external IdP flows, notifications on the engine, anchors on one shape.
- **Multi-organisation people:** one person with seats across multiple client or organization spaces with one unified identity.

## 9. What downstream Open Apps get, and when

| Need | Consumer category | Horizon |
|---|---|---|
| Audience-bounded agent, structural chat scope, receipts, scope enforcement | Client portals, governance apps, community apps | 0 |
| `SyncSeats`, `EnsureSpaceForRecord`, post-close root chat pattern, `SpaceTypeStatus`, `TargetApplicationID` | Client portals, governance apps, recording apps | 0 |
| A versioned substrate contract and contract tests | All downstream Open Apps | 0 |
| *Needs you*, header chips/actions, settings sections, and agenda providers | Client portals, ballot/poll apps, governance apps | 0 |
| Cross-space item mounts, parent-declared child types | Community apps, governance apps | 0 |
| Live chat, notifications, digests, reply by email | Client portals, community apps, review/accreditation apps | 1 |
| Outsider shell, phone layout, external IdP onboarding | Client portals, accreditation/peer-review apps | 1 |
| Approvals Desk (`bizapps-tasks` `TaskDecision` + promotions + AI requests) | Client portals, governance, opportunity, review, compliance apps | 2 |
| Documents and pages (MJ Docs) | Client portals, governance apps (minutes), community co-authoring | 2 |
| Meetings and transcripts | Client portals, governance apps, meeting capture apps | 2 |
| E-signature, file requests | Client portals, secure signature apps, accreditation apps | 2 |
| MCP, Teams, Slack | Client portals, meeting capture apps | 3 |
| PostgreSQL, scale, SOC 2, export | Every host | 4 |

**Portal delivery phases map onto this:** knowledge ingestion needs nothing here and can start anytime; dogfood gates on Horizon 0; client persistence on Horizon 1; full delivery loop on Horizon 2; Teams, Slack, and MCP on Horizon 3.

## 10. How we know it's working

Each horizon reports these, measured rather than claimed:

| Measure | Target |
|---|---|
| Leaks in the adversarial persona suite | 0, every run, in CI |
| Agent messages with a receipt | 100% |
| Message delivery to another browser | p95 under 1 second |
| Email-to-first-answer for an outsider on a phone | Under 60 seconds |
| p95 per screen in the scale world | Under 1.5 seconds |
| Consumer repos running the contract tests | Primary downstream Open Apps in Horizon 0; every consumer after |
| Post-close root chat continuity | Ongoing root-space agent engagement after child spaces move to `Closed` |

## 11. Open calls

New calls for product leadership, numbered after [the plan's § 11](plan.md#11-open-decisions):

| # | Call | Needed by |
|---|---|---|
| 17 | Whether the outsider shell is one host per deployment or per client (branding and domain) | Horizon 1 |
| 18 | Whether `Open` spaces are readable by any signed-in user before joining, and `Listed` spaces by name only (issue #37 §3) | H0.9 |
| 19 | Whether a cross-space item mount copies band and rights or takes the target space's | H0.9 |
| 20 | Whether `SpaceNote` rows migrate to MJ Docs automatically or on request per space | Horizon 2 |
| 21 | The Approvals Desk's first follow-up handlers, and who owns their policy | Horizon 2 |
| 22 | The scale world's sizes and p95 budgets | H0.12 onward |

The plan's existing calls 1 (owner), 4–6 (audience) and 14 (calendars) guide remaining Horizon 0/2 work; call 2 (licence) has progressed via `OPS-1 Prep` (`BUSL-1.1` license metadata in `package.json` and `mj-app.json`).

## 12. Rules for the work

[PR 10's § 12](pr10-plan.md#12-rules-for-the-work) applies unchanged: no workarounds, metadata never in a migration, no `sync` blocks, test code stays in the harness, and a test calls the code it tests. In addition:

- **Every user-facing change follows the approved UX frames first.** No surface ships outside them (the #24/#32 lesson).
- **Every horizon ends with a persona run,** as a participant and as staff, in light and dark, with screenshots in `docs/screenshots/<horizon>/`.
- **Anything that belongs in MJ goes to MJ `next`,** with the MJ issue tracked here, rather than being patched around in this repo.
- **The substrate contract changes only by a reviewed PR** that updates the contract document, the contract tests and the contract version together (D57).
