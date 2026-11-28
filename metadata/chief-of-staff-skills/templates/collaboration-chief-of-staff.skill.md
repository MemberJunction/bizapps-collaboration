# Collaboration Spaces Skill

Use this skill whenever the user asks about their **BizApps Collaboration** spaces, shared workspaces, team vs external participants, filed documents or artifacts, space notes, space chats, share notices, pinned items, or space activity digests.

BizApps Collaboration is installed in this environment. Every personal Chief of Staff instance inherits this skill automatically alongside `Promote`, `Summarize`, and `Find & act`.

## 1. Core Entities & Domain Model

Always read through MemberJunction `RunView` (or strongly typed Collaboration actions) as the calling user — **never run raw SQL**. Row-Level Security (`fnCollaborationAccess` and per-band predicates) enforces exactly which spaces, members, items, notes, chats, and notices the caller can see.

| Entity Name | Purpose | Key Fields |
| --- | --- | --- |
| `MJ_BizApps_Collaboration: Spaces` | Core permission and agent-retrieval boundary (hierarchical via `ParentID`). | `ID`, `Name`, `Description`, `SpaceTypeID`, `StatusID`, `OwnerID`, `ParentID`, `InheritsMembership`, `AgentRetrieval`, `StartedAt`, `ClosedAt` |
| `MJ_BizApps_Collaboration: Space Members` | Active, invited, or removed seats in a space with band and role assignment. | `ID`, `SpaceID`, `UserID`, `PersonID`, `SpaceRoleTypeID`, `Band`, `Status`, `SyncSource` |
| `MJ_BizApps_Collaboration: Space Role Types` | Role capability flags governing what a seat may view or do. | `ID`, `Code`, `Name`, `Level`, `CanSeeTeamBand`, `CanPromoteBand`, `CanInvite`, `CanContribute`, `IsOwnerRole` |
| `MJ_BizApps_Collaboration: Space Items` | Records, files, documents, and artifacts filed into a space under a visibility band. | `ID`, `SpaceID`, `EntityID`, `RecordID`, `Band`, `Folder`, `ArtifactVersionID`, `PromotedAt`, `PromotedByUserID` |
| `MJ_BizApps_Collaboration: Space Notes` | Team, Shared, or author-private notes attached to a space. | `ID`, `SpaceID`, `Title`, `Body`, `Band`, `Visibility`, `AuthorUserID` |
| `MJ_BizApps_Collaboration: Space Chats` | Conversations bound to a space (`Kind` distinguishes Shared, Private/Team, and Assistant chats). | `ID`, `SpaceID`, `ConversationID`, `Name`, `Subject`, `Kind`, `Status`, `OwnerUserID` |
| `MJ_BizApps_Collaboration: Space Notice Events` | Chronological activity feed events in a space filtered by `Band`. | `ID`, `SpaceID`, `ActorUserID`, `EventKind`, `Band`, `Title`, `Body`, `EventTimestamp` |
| `MJ_BizApps_Collaboration: Space Notice Watermarks` | Per-member unread cursor for space notices. | `ID`, `SpaceID`, `UserID`, `LastReadEventTimestamp`, `LastReadAt` |
| `MJ_BizApps_Collaboration: Share Notices` | Direct share alerts addressed to a specific `RecipientUserID`. | `ID`, `SpaceID`, `ItemID`, `RecipientUserID` |
| `MJ_BizApps_Collaboration: Space Member Pins` | Items and resources pinned by the calling member for quick Home access. | `ID`, `SpaceID`, `UserID`, `Kind`, `TargetEntityID`, `TargetRecordID`, `Sequence` |
| `MJ_BizApps_Collaboration: Space Anchors` | Domain records anchored to a space (`IsPrimary`, `Role`). | `ID`, `SpaceID`, `SpaceTypeID`, `EntityID`, `RecordID`, `Role`, `IsPrimary` |
| `MJ_BizApps_Collaboration: Space Types` & `Space Type Status` | Space type configuration, panels, defaults, and lifecycle statuses (`ReadOnly`, `IsTerminal`). | `Code`, `Name`, `Vocabulary`, `DefaultBand`, `ReadOnly`, `Visible`, `IsTerminal` |
| `MJ_BizApps_Collaboration: Space Grants` | Knowledge source, query, and bound-action grants attached at app, type, or space scope. | `SpaceTypeID`, `SpaceID`, `Kind`, `Band`, `Label`, `Mode`, `TargetEntityID`, `TargetRecordID` |

## 2. Team Band vs Shared Band & RLS Guardrails

- **Strict band boundary**: Every `Space Member` seat carries a `SpaceRoleTypeID` whose `CanSeeTeamBand` flag determines whether the caller may see `Team`-band items, notes, chats, and notices. Callers without `CanSeeTeamBand` can only see `Shared`-band records (plus their own author-private notes).
- **Never cross space or band boundaries**: Never summarize, cite, or hint at `Team`-band drafts, internal discussions, or other spaces the caller does not reach. Because all reads execute via `RunView` under the caller's `UserInfo`, RLS (`Collaboration: Visible Spaces`, `Collaboration: Visible Items`, `Collaboration: Visible Notes`, `Collaboration: Space Chats In Reach`, `Collaboration: Space Notice Events In Reach`) automatically filters out unreachable rows.
- **Promotion requires governance**: Moving a draft from `Team` to `Shared` requires a seat with `CanPromoteBand` (or space owner) and, where configured, an approving `TaskDecision` on the linked Team-private approval task via `Collaboration: Propose Audience Output` -> `Collaboration: Promote Draft To Shared`. Never silently promote or publish to the `Shared` band without explicit human approval.

## 3. Common Chief of Staff Workflows

1. **"What spaces am I in / what needs my attention?"**: Query `MJ_BizApps_Collaboration: Spaces` (active spaces where `ClosedAt IS NULL`) alongside `MJ_BizApps_Collaboration: Space Notice Events` newer than the user's `MJ_BizApps_Collaboration: Space Notice Watermarks`, plus `MJ_BizApps_Collaboration: Share Notices` and `MJ_BizApps_Collaboration: Space Member Pins`.
2. **"Summarize what happened in space X"**: Resolve the space via `MJ_BizApps_Collaboration: Spaces`, then inspect its visible `Space Items`, `Space Notes`, `Space Chats`, `Space Notice Events`, and linked tasks in reach. Distinguish `Team` vs `Shared` items clearly when the caller has `CanSeeTeamBand`.
3. **"Find a document, note, or task in my spaces"**: Query `MJ_BizApps_Collaboration: Space Items` and `MJ_BizApps_Collaboration: Space Notes` via `RunView` (never raw SQL), surfacing the space name, folder, band, and promotion status.
4. **Preparing Shared updates**: Draft content in the `Team` band first (`Collaboration: Propose Audience Output` / `Collaboration: Manage Space Document`), confirm review with the space owner or authorized approver, and only promote to `Shared` (`Collaboration: Promote Draft To Shared` / `Collaboration: Publish Shared Space Update`) after explicit approval.
