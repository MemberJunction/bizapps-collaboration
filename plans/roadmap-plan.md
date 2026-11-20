# The roadmap: from a sound engine to a world-class collaboration product

**What this is.** A plan only. It sets the order of work for Collaboration after PR 10, from making its trust claims true through to running at scale for the BC client portal and the apps that build on `Space`. It adds no code. It sits beside [the plan](plan.md) and [PR 10's plan](pr10-plan.md): those stay the record of what each item means and why; this one decides **what comes next, in what order, and what "done" looks like for each horizon.** Where an item here already has a number in the plan (A5, B6, …), this plan uses that number and doesn't restate it.

**Who does what.**
- **Ian runs it**, as for PR 10: an AI coding agent builds, Ian supervises and decides. The plan PR is assigned to him.
- **Robert** is copied for review, especially on the substrate contract ([§ 4.3](#43-the-substrate-contract)) and the outsider shell ([§ 5.4](#54-a-room-built-for-outsiders)).
- **Amith** settles the open calls in [§ 11](#11-open-calls) and merges.
- **Each horizon is its own pull request (or several),** each with its own plan section, persona test and screenshots, reviewed the way [PR 10's § 13](pr10-plan.md#13-how-reviews-run) describes. Work that belongs in MJ, Tasks, Common or another app goes in that repo's PR and is tracked here.

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

On 2026-11-12 Amith asked for a deep dive on this repo and a roadmap for "making this thing insanely world class", informed by what the BC client portal plans to build on top and by BC's business strategy. Four things were read, and this plan is what they add up to.

### 1.1 This repo, as it stands at `99ae999`

**The engine is sound, and its core idea is the differentiator.** One object, the space, is both the permission boundary and the agent's retrieval boundary:
- a space tree with sealed or inheriting sub-spaces, statuses and close/reopen;
- Team and Shared bands with an audited promotion;
- one published access function, `fnCollaborationAccess`, that other apps filter their own rows with;
- space types as plug-ins (`SpaceType` rows, server and UI drivers, IsA subtypes);
- agent turns that run on the server as the asking user, with grants as tools and band-bounded retrieval.

About 1,000 unit tests, 118 server and 88 client harness checks, and 55 row-level security filters stand behind it.

**What's missing is everything that makes a room feel alive, and a few places where the trust claims aren't yet true.** The repo survey found:
- **No live delivery.** Nothing pushes another person's message, presence, typing or unread state; the rail has an `unread` style that nothing populates.
- **Notifications are in-app only** (share and status change): no mentions, email, digests or preferences (B6, A12).
- **Only room-wide chats.** There are no direct or small-group messages; the only 1:1 is with the assistant.
- **No documents or pages.** The page editor was reverted in `be19c01` / `V202611051155`, two orphan filters (*Visible Pages*, *Pages The Caller May Change*) remain, and notes are plain Markdown rows.
- **No meetings.** The plan is [meetings-plan.md](meetings-plan.md), and the work is in draft PR #31.
- **No phone layout** (two `@media` rules in the whole UI). Outsiders land in the MJ Explorer shell.
- **Empty shells:** the Overview's *Needs you* list and the share check's assistant findings (`collaboration-section.component.ts:4424`, `shareFindings = []`).
- **`SyncSeats` is a stub** (`base-space-type-server-driver.ts:261`). PR #31 implements it.
- **`mint-space-link.ts:40` decides who is staff by role name** (`'ui', 'developer', 'integration'`), against the doctrine of rights by authorization.
- **The agent's bound is the band, not yet the intersection of everyone in a chat,** and no citations are stored. Both wait on MJ core (A4–A7).
- **On MJ `next`, an outside participant's chat draws no messages:** MJ's conversation engine filters with a subquery its client-clause screen refuses for a row-filtered user (PR #38, "Not in this PR").
- **People field-level security** (bizapps-common#186) is still open: without it a client reads every People field of anyone they share a space with ([PR 10 § 4](pr10-plan.md)).
- **The platform pin is a prerelease:** every package pins MJ `6.2.0-edge.7`. CI's build job is red on the runner image (Ubuntu 26.04 against Playwright 1.58.1, per PR #38).
- **`collaboration-section.component.ts` is 5,408 lines,** client lists use hard `MaxRows` caps with no paging, and `fnCollaborationAccess` is a recursive multi-statement function not yet measured at scale.

### 1.2 The open pull requests and issues

| # | What | Where it lands here |
|---|---|---|
| PR #38 | Member photos everywhere a space draws a person | Horizon 0, merge as is |
| PR #31 (draft) | `SyncSeats` plus B23 space meetings with `fnCollaborationMeetingAccess` | Split: `SyncSeats` → Horizon 0; meetings → Horizon 2 once Tasks ships the meeting entities |
| PR #33 (draft) | The reverted UI polish and Space Pages, kept for reference | Not revived. Its rail/header/Home ideas feed the approved UX process in Horizon 1; pages are replaced by MJ Docs (D55) |
| PR #14 | Advisory caret-pin check | Horizon 0 hygiene |
| Issue #37 | Downstream gaps: who owns the `community` type row, child types declaring their parents, a shared open-window helper and `Listed`/`Open` reads, cross-space item mounts | Horizon 0, the substrate contract |
| Issues #25–#27 | Page comments as rows, a participation operation, save concurrency | Closed as superseded by MJ Docs (D55); their lessons carry over as acceptance tests for the Docs integration |

### 1.3 The BC client portal, and BC's strategy

The portal plan (`new-products/bc-client-portal/plan.md`, v0.4, 2026-10-17) says: "the persistent agent is the product; the portal is what makes it possible". Each client organisation gets a perpetual root space, each engagement is a sub-space, and a named BC consultant agent stays after the engagement closes. v0.3 made it the base layer for all BC client services (BCC and Cimatri); v0.4 makes it "Blue Cypress's automated professional-services stack".

Its building starts once Collaboration lands, and it asks a lot of this repo. In its own words, audience-bounded retrieval ("in a chat the Assistant uses only what **every** person in it can see, recomputed each turn") is "the heart of the product". It needs:
- the Team/Shared bands with the audited share check;
- `EnsureSpaceForRecord` from a won deal, and `SyncSeats` from staffing;
- an allowed-agent chain with per-space prompt parts;
- after-close modes (`Closed | ReadOnly | ReadOnlyWithAgent`, gap U1) and "no agents at this level" (gap U2);
- Teams/Slack channel binding (U3) and chat participants for all agents (U4, in MJ);
- answer receipts naming their sources (U5);
- an Approvals Desk with no owner yet;
- digests on any cadence, and meeting transcripts filed to the Team band;
- *Needs you* and agenda providers.

The portal's Phase 0 (dogfood) names one blocker in this repo: "the agent's search scope wired (today `agentMayQuote` is not called and agent retrieval is not enforced)".

**BC's doctrine** (`new-products/market-analysis-2026.md` §10) is to be "the open, hosted system of engagement for the association world… while the PE rollups consolidate the systems of record we deliberately refuse to sell". Collaboration is free (decided 2026-09-22), "not per-seat — not priced at all", and "AI is the product, not an add-on SKU". The competitive frame (`archive/collaboration/plan.md` §2) is client portals (Copilot, Clinked, Moxo, SuiteDash: "file-plus-chat over the vendor's cloud… per-project by construction") and board portals that sell AI as a separate line item. **This is not Slack or Teams** — "a bounded space with outsiders in it" — so world class is measured against what an outsider expects of a room, not against a company chat tool.

### 1.4 The sibling apps

Collaboration is already a substrate, not a leaf app:
- **bizapps-community** extends `Space` (`CommunitySpace` IsA `Space`, ten tables FK'd to `Space`, `fnCommunityForumAccess` built on `fnCollaborationAccess`). **It has already drifted:** it reads post-close settings as columns that are now Configuration JSON (D20/D21), uses `SpaceType` field names that don't exist (`Icon`, `DefaultVisibility`, `Sequence`, …), and rewrites the `community` type row this repo also seeds.
- **bizapps-committees** plans to become IsA `Space` (C4, `COLLABORATION_REBUILD_PLAN.md`), using `SyncSeats`, bands for minutes and space items for papers.
- **bizapps-voting** wants a "space seats" eligibility source and a *Needs you* provider for open ballots.
- **bizapps-caliber** wants to file recordings and transcripts into a space (`EnsureSpaceForRecord`, decision deferred).
- **bizapps-credentialing** describes a reviewer workspace that is a space by another name.
- **bizapps-secure-messaging** runs its own magic links and sessions beside MJ's.

Across them, comments, files, external access, notifications, meetings, anchors and membership are each built three to five times. A world-class substrate unifies them instead of adding a sixth copy.

### 1.5 The conclusion

Collaboration has to be world class at three things, in this order:
1. **A provable boundary.** The agent uses only what everyone in the room may see, and anyone can audit that. This is the differentiator and the portal's whole security story.
2. **A room outsiders come back to.** Client staff judge it on day one against Slack and Notion; liveness, notifications and a clean outsider shell are table stakes.
3. **A stable substrate.** At least six apps build on `Space`. The contract has to be explicit, versioned and tested, so drift like Community's fails CI rather than a host install.

The horizons below follow from that order. Amith agreed to the order and to the four calls in [§ 3](#3-decisions) on 2026-11-12.

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

- **D53 (Amith, 2026-11-12): trust first, then liveness.** Horizon 0 makes the boundary true and freezes the substrate before Horizon 1 adds liveness. The alternative demos better sooner but puts clients in a room whose boundary isn't proven.
- **D54 (Amith, 2026-11-12): the outsider shell is a standalone, brandable host on the widgets package,** not more polish inside Explorer. Staff keep Explorer; outsiders get the shell. The widgets package already runs outside Explorer (`packages/UXGallery` proves it), so this is the L3 surface the UI layering guide expects, not a rewrite.
- **D55 (Amith, 2026-11-12): documents and pages come from MJ Docs, not from this repo.** MJ Docs (documents, including pages) ships in **MJ 6.3**, which is expected to enter LTS candidacy in **about 30 days** (around 2026-12-12). Collaboration adopts it then (Horizon 2, [§ 6.2](#62-documents-and-pages-on-mj-docs)). Until then:
  - **`SpaceNote` stays, and is marked temporary.** Its README line, entity description and Notes tab say it will move to MJ Docs. It gets no new features (no rich text, no comments, no versioning) and no new dependants.
  - **Space Pages are not revived.** Draft PR #33 stays closed as a reference; issues #25–#27 are closed as superseded, and their lessons become acceptance tests for the Docs integration.
  - **The two orphan page filters are removed** in Horizon 0.
- **D56 (Amith, 2026-11-12): the Approvals Desk lives in Collaboration** as a generic, public inbox over three existing sources (share promotions, `TaskDecision`, `MJ: AI Agent Requests`). Policy that is specific to the portal (tiers, flag budgets) stays in the portal. CIT §18.4 calls it "a unification, not an invention", and the portal, CIT, Sales, Certification and Ethics all need it.
- **D57 (this plan): the substrate contract is versioned and tested.** What a downstream app may rely on is listed in one document, carries a contract version in `mj-app.json`, and is pinned by contract tests that downstream repos also run. Changing it is a minor bump with a migration note; removing from it is a major bump, per MJ's publish-then-no-breaking-changes policy.

## 4. Horizon 0: make it true

**Goal:** the boundary is real, the substrate is explicit, and the repo is release-ready. **Exit:** the portal's Phase 0 (dogfood) can start, and Community and Committees can build against a fixed contract.

### 4.1 Unblock the participant

| Item | Detail | Done when |
|---|---|---|
| H0.1 Participant chat on MJ `next` | MJ's conversation engine filters with a subquery over `vwConversationDetails` that the client-clause screen refuses for a row-filtered user (PR #38). Fix it in MJ, per the no-workarounds rule (D49). | The client harness's chat checks pass as a participant (Bea), not only as staff; screenshots of a participant's chat in light and dark |
| H0.2 People field-level security | bizapps-common#186, carried from [PR 10 § 4](pr10-plan.md). PR #38 widens `PhotoURL` deliberately; everything else stays denied. | FLS1–FLS3 pass for every People field a participant may and may not read, server and over the wire |
| H0.3 Merge PR #38 | Member photos | Merged; the plan's wording about what clients see of a person updated |

### 4.2 The bound and its proof

| Item | Detail | Done when |
|---|---|---|
| H0.4 Audience-bounded runs | A5 conversation participants, A6 runs bounded by an audience (intersection via `fnCollaborationCommonAccess` and MJ `SearchParams.Audience.Readers`), A7 sealing on a change of audience, B2 retrieval by audience, B3 conversations in a space. Answers [the plan's § 11](plan.md#11-open-decisions) calls 4, 5 and 6 first. | A consultant joining a client chat re-bounds the next answer; adversarial persona checks (Team-only file, sealed sub-space, private note, another client's space) all refuse |
| H0.5 Provenance and receipts | A1–A4 in MJ, B4 here: each agent answer stores the records it used, and the chat shows them (the portal's U5). | Every agent message in the harness has a receipt; a receipt never names a source a reader in the chat can't open |
| H0.6 Agent scope enforcement | The portal's Phase 0 blocker: `agentMayQuote` called on every retrieval path, and `AgentRetrieval = ExcludedEntirely` honoured | A check that deletes the call fails; an `ExcludedEntirely` space never appears in any agent's sources |
| H0.7 Rights by authorization, everywhere | Replace the role-name staff test in `mint-space-link.ts:40` with an authorization | No role name compared anywhere in shipped code (a guard script fails on it) |

### 4.3 The substrate contract

| Item | Detail | Done when |
|---|---|---|
| H0.8 Write the contract | One document, `docs/SUBSTRATE_CONTRACT.md`: the tables, columns and functions a downstream app may use (`Space`, `SpaceMember`, `SpaceItem`, `fnCollaborationAccess`, …), the driver hooks, `EnsureSpaceForRecord`, `SyncSeats`, UI contributions, the configuration keys, and the rule for who owns which seed row. Brings `EXTENSIBILITY_PLAN.md` up to date with the code. | Reviewed by the Community and Committees builders |
| H0.9 Issue #37 | (1) This repo stops seeding `community`; Community owns it, as Committees owns `committee`. (2) A child type declares `AllowedParentTypeCodes`, merged with the parent's `AllowedTypeCodes`. (3) Export the open-window test as an inline function, and decide `Listed`/`Open` reads for non-members (call 18). (4) Allow one record in more than one space: `UQ_SpaceItem_Entity_Record` becomes `(SpaceID, EntityID, RecordID)`, with a mount operation that checks the target space's rules. | Each item has a test; Community's forum can graduate a thread to a working group with its files |
| H0.10 `SyncSeats` | Taken from PR #31 as its own PR | Committees' C4 can sync a term's seats; the harness covers create, update, remove and the auto-invite path |
| H0.11 After-close modes and "no agents here" | Portal gaps U1 and U2: `Lifecycle.AfterClose` = `Closed`, `ReadOnly` or `ReadOnlyWithAgent` with a duration, as configuration; an explicit setting that no agent may run at a level | The portal driver's interim enforcement can be deleted |
| H0.12 Contract tests | A published test bundle, run here and in each consumer's CI, that fails on a renamed column, a removed hook or a changed function signature (D57) | Community's drift (§ 1.4) would have failed it |
| H0.13 Ship the extension points | Wire what's declared but unused: signal providers, *Needs you*, agenda and header-chip providers, header chips and actions, settings sections, new-space steps, vocabulary (EXTENSIBILITY_PLAN.md) | Each has a working example in `packages/ExampleSpaceTypes` and a harness check |

### 4.4 Hygiene and release readiness

| Item | Detail | Done when |
|---|---|---|
| H0.14 CI green | Pin the runner to `ubuntu-24.04` or bump Playwright; run the client harness in CI | Both jobs green on `next` |
| H0.15 A released MJ | Move off `6.2.0-edge.7` to a published MJ release, then onto 6.3 LTS when it's a candidate (D55) | `mjVersionRange` and every peer pin a release |
| H0.16 Remove leftovers | The two orphan page filters; mark `SpaceNote` temporary (D55); merge PR #14 | No metadata references a table that doesn't exist |
| H0.17 Stage 5 from PR 10 | Owner, licence, clean `mj app install`, the release metadata migration ([PR 10 § 7](pr10-plan.md)) | A host installs from npm and migrations alone, and the persona suite passes there |
| H0.18 Split the page component | `collaboration-section.component.ts` (5,408 lines) becomes a shell over per-tab components, without behaviour changes | No file over 1,000 lines in `packages/Angular`; every existing render test still passes |

## 5. Horizon 1: make it alive

**Goal:** a room people want to be in, for staff and outsiders alike. **Exit:** the portal's Phase 1 (persistence) runs with real clients on phones.

### 5.1 Live delivery

- **Live messages, unread state, presence and typing** (A12), over MJ's pub/sub, scoped to the space's audience. First fix the security item A12 names: today the `cacheInvalidation` subscription sends every saved row to every socket.
- **Unread counts** on the rail, tabs and Home, kept per member.
- **Optimistic sends** with retry, so a slow network never loses a message.
- **Done when:** two browsers see each other's messages, mentions and status changes within a second; a participant's socket never receives a row outside their reach.

### 5.2 One notification system

- **In-app, email and digest channels** through MJ's notification engine, for mentions, replies, shares, status changes, tasks and approvals (B6).
- **Preferences per member and per space,** including for outsiders, with one-click unsubscribe from email.
- **Digests on a cadence** (daily or weekly), the same skill the portal's advisory cadences reuse.
- **Reply by email** posts into the thread as the sender. Community asks for it too.
- **Done when:** no event in the harness is delivered against a member's preference, and a digest never names a record outside the reader's reach.

### 5.3 Conversations people expect

- **Direct and small-group chats** with a chosen set of seats, bounded by that set (they reuse H0.4's audience bound).
- **Threads, reactions, edit and delete** with history, and pinned messages.
- **History-on-add choice** when someone joins (the portal's default is *All* for staff).
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

**Goal:** decisions, documents and meetings happen in the space, not around it. **Exit:** the portal's Phase 2 delivery loop (Plan → Build → Verify → Present → Feedback → Approve → Promote) runs end to end in a space.

### 6.1 The Approvals Desk (D56)

- **One inbox** for share-check promotions, `TaskDecision` sign-offs and `MJ: AI Agent Requests` (A8/B7 proposed posts included), filtered to what the viewer may decide.
- **A deterministic follow-up** for each decision type, through a registered handler (for example: an approved milestone raises the invoice in Orders, via the portal's driver).
- **Delegation, due dates and escalation,** and an audit trail queryable in SQL.
- **The share check's findings** come from the assistant instead of `shareFindings = []`.

### 6.2 Documents and pages on MJ Docs

- **Adopt MJ Docs from MJ 6.3** (D55) as soon as 6.3 is an LTS candidate (around 2026-12-12): a document lives as a space item on a band, with its own reach, comments, versions and concurrency from MJ.
- **Migrate `SpaceNote`** rows into documents with a one-time, idempotent operation, then retire the table and the Notes tab in a later minor release, under the no-breaking-changes policy.
- **Acceptance tests carried from issues #25–#27:** a comment is its own row written by its author; a member may tick a checklist or comment without edit rights; two editors never silently overwrite each other.
- **Agents read and propose edits to documents** within the audience bound; an agent's edit is a proposed change, never a silent write.

### 6.3 Meetings

- **bizapps-tasks ships the meeting entities** (T1, [meetings-plan.md](meetings-plan.md)); then the space Meetings tab, *Coming up* and the meeting chat from PR #31 land here.
- **Notetaker files transcripts** into the Team band, with a Shared summary that goes through the share check.
- **Action items become proposed tasks** on the Approvals Desk.
- **Calendars** (A18) and video providers after.

### 6.4 Files that work like documents

- **Versions, comments and approvals on files,** and **e-signature** through MJ's `eSignature` package, so secure-messaging's signature flow and the portal's acceptance step use one path.
- **File requests** (call 10): ask an outsider for a document, with a due date and a reminder.
- **Per-space storage accounts,** which are validated today but not used on upload.

## 7. Horizon 3: the agent everywhere the client already is

**Goal:** the agent is a teammate the client reaches from where they already work. **Exit:** the portal's Phase 5 target holds: at least a third of conversations happen outside the portal.

- **The agent over MCP** (A9/B5): `AgentTurnHandler` as a server operation MCP calls, never a raw search tool, carrying the same audience bound.
- **Teams and Slack channel binding** (portal U3): the audience is the channel roster, and the binding suspends when an unmapped member joins.
- **Named specialist agents** in a chat (portal U4, in MJ): the fleet becomes visible, each agent bounded by the same audience.
- **Space memory:** a per-space and per-client profile built from MJ agent notes, Team band only, editable by staff.
- **Cadenced advisory:** weekly, monthly and quarterly reports through the digest skill, filed as space items and promoted through the share check.
- **Live sessions:** realtime rooms in a space, with transcripts landing as Team-band items (MJ's realtime and session-capture guides).

## 8. Horizon 4: scale, compliance and the community surface

**Goal:** Collaboration is something a large host and an auditor are both comfortable with.

- **PostgreSQL** (B11) through the release conversion.
- **Performance:** measure `fnCollaborationAccess` in a scale world (10,000 spaces, 100,000 items, 1,000-member spaces); replace it with an inline or materialised reach if p95 budgets fail; add server-side paging everywhere a list has a hard `MaxRows` cap.
- **The admin console:** edit space types, the assistant and grants in screens, not raw records (frame 09); usage and health per space.
- **Compliance:** SOC 2 evidence (audit logs, access reviews, retention), data export and offboarding for a departing client, retention rules per space type.
- **The community surface** for bizapps-community: self-serve join, join requests, directory and member cap (B12), with `Listed`/`Open` reads decided in H0.9.
- **Unify the duplicates** (§ 1.4) as each app is next touched: comments on MJ anchored comments, files as space items, external access on MJ magic links (secure-messaging included), notifications on the engine, anchors on one shape.
- **Multi-organisation people:** one person with seats in two clients' spaces, or a client of both BCC and Cimatri, with one identity.

## 9. What the portal and the sibling apps get, and when

| Need | Asked by | Horizon |
|---|---|---|
| Audience-bounded agent, receipts, scope enforcement | Portal (heart of the product), Committees, Community | 0 |
| `SyncSeats`, `EnsureSpaceForRecord`, after-close modes, no-agents setting | Portal, Committees, Caliber | 0 |
| A versioned substrate contract and contract tests | Community, Committees, Voting | 0 |
| *Needs you* and agenda providers | Portal, Voting | 0 |
| Cross-space item mounts, parent-declared child types | Community, Committees | 0 |
| Live chat, notifications, digests, reply by email | Portal, Community, Credentialing | 1 |
| Outsider shell, phone layout, onboarding | Portal, CIT, Certification, Awards | 1 |
| Approvals Desk | Portal, CIT, Sales, Certification, Ethics, Sonar | 2 |
| Documents and pages (MJ Docs) | Portal, Committees (minutes), Community (co-authoring) | 2 |
| Meetings and transcripts | Portal, Committees, Notetaker | 2 |
| E-signature, file requests | Portal, secure-messaging, Certification | 2 |
| MCP, Teams, Slack | Portal, CIT, Notetaker | 3 |
| PostgreSQL, scale, SOC 2, export | Every host | 4 |

**The portal's own phases map onto this:** its Phase −1 (knowledge) needs nothing here and can start now; Phase 0 (dogfood) gates on Horizon 0; Phase 1 (persistence) on Horizon 1; Phase 2 (delivery loop) on Horizon 2; Phase 5 (Teams, Slack, MCP) on Horizon 3.

## 10. How we know it's working

Each horizon reports these, measured rather than claimed:

| Measure | Target |
|---|---|
| Leaks in the adversarial persona suite | 0, every run, in CI |
| Agent messages with a receipt | 100% |
| Message delivery to another browser | p95 under 1 second |
| Email-to-first-answer for an outsider on a phone | Under 60 seconds |
| p95 per screen in the scale world | Under 1.5 seconds |
| Consumer repos running the contract tests | Community and Committees in Horizon 0; every consumer after |
| The portal's own kill criterion | At least a third of closed-engagement clients using the agent 60 days after close |

## 11. Open calls

New calls for Amith, numbered after [the plan's § 11](plan.md#11-open-decisions):

| # | Call | Needed by |
|---|---|---|
| 17 | Whether the outsider shell is one host per deployment or per client (branding and domain) | Horizon 1 |
| 18 | Whether `Open` spaces are readable by any signed-in user before joining, and `Listed` spaces by name only (issue #37 §3) | H0.9 |
| 19 | Whether a cross-space item mount copies band and rights or takes the target space's | H0.9 |
| 20 | Whether `SpaceNote` rows migrate to MJ Docs automatically or on request per space | Horizon 2 |
| 21 | The Approvals Desk's first follow-up handlers, and who owns their policy | Horizon 2 |
| 22 | The scale world's sizes and p95 budgets | H0.12 onward |

The plan's existing calls 1 (owner), 2 (licence), 4–6 (audience) and 14 (calendars) are still open and gate Horizon 0 and Horizon 2.

## 12. Rules for the work

[PR 10's § 12](pr10-plan.md#12-rules-for-the-work) applies unchanged: no workarounds, metadata never in a migration, no `sync` blocks, test code stays in the harness, and a test calls the code it tests. In addition:

- **Every user-facing change follows the approved UX frames first.** No surface ships outside them (the #24/#32 lesson).
- **Every horizon ends with a persona run,** as a participant and as staff, in light and dark, with screenshots in `docs/screenshots/<horizon>/`.
- **Anything that belongs in MJ goes to MJ `next`,** with the MJ issue tracked here, rather than being patched around in this repo.
- **The substrate contract changes only by a reviewed PR** that updates the contract document, the contract tests and the contract version together (D57).
