import { BaseEntity, LogError, RunView, type IMetadataProvider, type RunViewParams, type UserInfo } from '@memberjunction/core';
import {
    agentMayQuote,
    membershipReaches,
    type Band,
    type MemberSnapshot,
    type RoleFlags,
    type SpaceNode,
} from '@mj-biz-apps/collaboration-core';
import { requireSystemUser } from './load-graph.js';
import { parseUuid } from './uuid.js';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const ROLES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';
const ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';

export interface SpaceAgentCandidateItem {
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Name: string;
    Description: string | null;
    Band: Band;
    StoredContentType: string | null;
}

export interface SpaceAgentRetrievalDecision {
    item: SpaceAgentCandidateItem;
    allowed: boolean;
    reason: string;
}

export interface SpaceAgentRetrievalResult {
    spaceId: string;
    askingUserId: string;
    callerCanSeeTeam: boolean;
    searchedSpaceIds: string[];
    candidateItems: SpaceAgentCandidateItem[];
    quotedItems: SpaceAgentCandidateItem[];
    decisions: SpaceAgentRetrievalDecision[];
}

interface SpaceRow {
    ID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    OwnerID: string;
    AgentRetrieval: SpaceNode['agentRetrieval'];
    AllowParentAssignees?: boolean;
}

interface MemberRow {
    SpaceID: string;
    UserID: string;
    Status: string;
    Band: string;
    SpaceRoleTypeID: string;
}

interface RoleRow {
    ID: string;
    Level: number;
    MaxGrantableLevel: number;
    CanInvite: boolean;
    CanPromoteBand: boolean;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
    CanContribute: boolean;
}

interface SpaceItemRow {
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Band: Band;
}

function toSpaceNode(row: SpaceRow): SpaceNode {
    return {
        id: parseUuid(row.ID) ?? row.ID,
        parentId: row.ParentID ? parseUuid(row.ParentID) : null,
        inheritsMembership: !!row.InheritsMembership,
        ownerId: parseUuid(row.OwnerID) ?? row.OwnerID,
        agentRetrieval: row.AgentRetrieval ?? 'Included',
        allowParentAssignees: row.AllowParentAssignees !== undefined ? !!row.AllowParentAssignees : true,
    };
}

function cleanRecordId(raw: string): string {
    const s = String(raw).trim();
    if (s.toLowerCase().startsWith('id|')) return s.slice(3);
    return s;
}

function isAncestorOrSelf(index: Map<string, SpaceNode>, ancestorId: string, nodeId: string): boolean {
    let current = index.get(nodeId.toLowerCase());
    const seen = new Set<string>();
    while (current && !seen.has(current.id.toLowerCase())) {
        if (current.id.toLowerCase() === ancestorId.toLowerCase()) {
            return true;
        }
        seen.add(current.id.toLowerCase());
        current = current.parentId ? index.get(current.parentId.toLowerCase()) : undefined;
    }
    return false;
}

function getReachableSubtreeSpaceIds(
    spaces: readonly SpaceNode[],
    askedFromSpaceId: string,
): string[] {
    const index = new Map<string, SpaceNode>();
    for (const s of spaces) {
        index.set(s.id.toLowerCase(), s);
    }
    const cleanAsked = askedFromSpaceId.toLowerCase();
    const candidateIds: string[] = [];

    for (const s of spaces) {
        const sid = s.id.toLowerCase();
        // Item space must have askedFromSpaceId as an ancestor or self
        if (!isAncestorOrSelf(index, cleanAsked, sid)) {
            continue;
        }
        // Check ExcludedEntirely up to root
        let current: SpaceNode | undefined = s;
        let excludedEntirely = false;
        const seen = new Set<string>();
        while (current && !seen.has(current.id.toLowerCase())) {
            if (current.agentRetrieval === 'ExcludedEntirely') {
                excludedEntirely = true;
                break;
            }
            seen.add(current.id.toLowerCase());
            current = current.parentId ? index.get(current.parentId.toLowerCase()) : undefined;
        }
        if (excludedEntirely) continue;

        // Check ExcludedFromParentScope between s and cleanAsked
        current = s;
        let excludedFromParent = false;
        const between = new Set<string>();
        while (current && current.id.toLowerCase() !== cleanAsked && !between.has(current.id.toLowerCase())) {
            if (current.agentRetrieval === 'ExcludedFromParentScope') {
                excludedFromParent = true;
                break;
            }
            between.add(current.id.toLowerCase());
            current = current.parentId ? index.get(current.parentId.toLowerCase()) : undefined;
        }
        if (excludedFromParent) continue;

        candidateIds.push(s.id);
    }
    return candidateIds;
}

/**
 * Resolves materials that the Collaboration Space Agent is permitted to quote
 * for a specific user asking from a specific space.
 *
 * Rules enforced:
 * 1. User must reach the space where the question is asked.
 * 2. Determines candidate subtree spaces (filtering out parent/sibling spaces and excluded scopes in SQL).
 * 3. Runs candidate query as the asking user (enforcing RLS fnCollaborationAccess & entity permissions).
 * 4. Batches target name and description lookups.
 * 5. Evaluates agentMayQuote for every candidate:
 *    - Must be within the asked space's subtree (no parent or sibling leak).
 *    - Items in Team band are dropped if the user cannot see the Team band.
 *    - Spaces marked ExcludedEntirely are never quoted.
 *    - Spaces marked ExcludedFromParentScope are never quoted from ancestors.
 */
export async function resolveSpaceAgentRetrieval(
    provider: IMetadataProvider,
    user: UserInfo,
    spaceId: string,
    options?: { maxRows?: number; query?: string },
): Promise<SpaceAgentRetrievalResult> {
    const cleanSpaceId = parseUuid(spaceId);
    const cleanUserId = parseUuid(user?.ID);

    if (!cleanSpaceId || !cleanUserId) {
        return {
            spaceId: spaceId ?? '',
            askingUserId: user?.ID ?? '',
            callerCanSeeTeam: false,
            searchedSpaceIds: [],
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    // Load space hierarchy and role definitions as system user so full topological metadata is available
    const probe = await provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, user);
    const system = await requireSystemUser(probe);
    const rvSystem = RunView.FromMetadataProvider(provider);

    const batchRes = await rvSystem.RunViews([
        {
            EntityName: SPACES_ENTITY,
            Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'AllowParentAssignees'],
            MaxRows: 2000,
            ResultType: 'simple',
        },
        {
            EntityName: ROLES_ENTITY,
            Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
            MaxRows: 200,
            ResultType: 'simple',
        },
        {
            EntityName: MEMBERS_ENTITY,
            ExtraFilter: `UserID = '${cleanUserId}' AND Status = 'Active'`,
            Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
            MaxRows: 2000,
            ResultType: 'simple',
        },
    ], system);

    const [spacesRes, rolesRes, membersRes] = batchRes;

    if (!spacesRes?.Success || !rolesRes?.Success || !membersRes?.Success) {
        LogError(`resolveSpaceAgentRetrieval failed to load space context: ${spacesRes?.ErrorMessage || rolesRes?.ErrorMessage || membersRes?.ErrorMessage}`);
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam: false,
            searchedSpaceIds: [],
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    if ((spacesRes.Results?.length ?? 0) >= 2000) {
        throw new Error('Refusing retrieval: spaces page came back full, so the check would be incomplete.');
    }

    const spaceNodes: SpaceNode[] = (spacesRes.Results as SpaceRow[] ?? []).map(toSpaceNode);
    const roleMap = new Map<string, RoleFlags>();
    for (const r of (rolesRes.Results as RoleRow[] ?? [])) {
        const id = parseUuid(r.ID) ?? r.ID;
        roleMap.set(id.toLowerCase(), {
            level: Number(r.Level),
            maxGrantableLevel: Number(r.MaxGrantableLevel),
            canInvite: !!r.CanInvite,
            canPromoteBand: !!r.CanPromoteBand,
            canSeeTeamBand: !!r.CanSeeTeamBand,
            isOwnerRole: !!r.IsOwnerRole,
            canContribute: !!r.CanContribute,
        });
    }

    const memberSnapshots: MemberSnapshot[] = [];
    for (const m of (membersRes.Results as MemberRow[] ?? [])) {
        const roleId = (parseUuid(m.SpaceRoleTypeID) ?? m.SpaceRoleTypeID).toLowerCase();
        const flags = roleMap.get(roleId);
        if (flags) {
            memberSnapshots.push({
                spaceId: parseUuid(m.SpaceID) ?? m.SpaceID,
                userId: parseUuid(m.UserID) ?? m.UserID,
                status: m.Status as MemberSnapshot['status'],
                band: m.Band as Band,
                role: flags,
            });
        }
    }

    // Determine caller's reaching role in the asked space
    const reach = membershipReaches(spaceNodes, memberSnapshots, cleanUserId, cleanSpaceId);
    let isInstanceOwner = user?.Type?.trim() === 'Owner';
    if (!isInstanceOwner) {
        const userRow = await rvSystem.RunView<{ Type: string }>({
            EntityName: 'MJ: Users',
            ExtraFilter: `ID = '${cleanUserId}'`,
            Fields: ['Type'],
            MaxRows: 1,
            ResultType: 'simple',
        }, system);
        isInstanceOwner = userRow.Results?.[0]?.Type?.trim() === 'Owner';
    }
    if (!reach && !isInstanceOwner) {
        // Caller cannot even reach this space
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam: false,
            searchedSpaceIds: [],
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    const callerCanSeeTeam = reach ? reach.role.canSeeTeamBand : isInstanceOwner;

    // Filter to reachable subtree spaces in SQL rather than fetching all items and filtering in memory
    const subtreeSpaceIds = getReachableSubtreeSpaceIds(spaceNodes, cleanSpaceId);
    const searchedSpaceIds = subtreeSpaceIds.filter((spaceId) =>
        isInstanceOwner || !!membershipReaches(spaceNodes, memberSnapshots, cleanUserId, spaceId)
    );
    if (searchedSpaceIds.length === 0) {
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam,
            searchedSpaceIds: [],
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    const inClause = searchedSpaceIds.map((id) => `'${id}'`).join(',');
    const rvUser = RunView.FromMetadataProvider(provider);
    const itemsRes = await rvUser.RunView<SpaceItemRow>({
        EntityName: ITEMS_ENTITY,
        ExtraFilter: `SpaceID IN (${inClause})`,
        Fields: ['ID', 'SpaceID', 'EntityID', 'RecordID', 'Band'],
        MaxRows: options?.maxRows ?? 2000,
        ResultType: 'simple',
    }, user);

    if (!itemsRes.Success) {
        LogError(`resolveSpaceAgentRetrieval items query failed: ${itemsRes.ErrorMessage}`);
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam,
            searchedSpaceIds,
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    if ((itemsRes.Results?.length ?? 0) >= (options?.maxRows ?? 2000)) {
        throw new Error('Refusing retrieval: items page came back full, so the check would be incomplete.');
    }

    const rawItems = itemsRes.Results ?? [];

    // Group record IDs by entity ID to resolve Name & Description from the target records
    const recordIdsByEntity = new Map<string, string[]>();
    for (const item of rawItems) {
        const entityId = (parseUuid(item.EntityID) ?? item.EntityID).toLowerCase();
        const recId = cleanRecordId(item.RecordID);
        const validUuid = parseUuid(recId);
        if (validUuid) {
            const list = recordIdsByEntity.get(entityId) ?? [];
            list.push(validUuid);
            recordIdsByEntity.set(entityId, list);
        }
    }

    const targetNames = new Map<string, { name: string; description: string | null }>();
    const entityEntries = Array.from(recordIdsByEntity.entries());
    const viewParams: RunViewParams[] = [];
    const validEntityIds: string[] = [];

    for (const [entityId, recIds] of entityEntries) {
        const entityInfo = provider.EntityByID(entityId);
        if (!entityInfo) continue;
        const targetInClause = recIds.map((id) => `'${id}'`).join(',');
        viewParams.push({
            EntityName: entityInfo.Name,
            ExtraFilter: `ID IN (${targetInClause})`,
            Fields: ['ID', 'Name', 'Description'],
            MaxRows: 2000,
            ResultType: 'simple',
        });
        validEntityIds.push(entityId);
    }

    if (viewParams.length > 0) {
        try {
            const batchResults = await rvUser.RunViews(viewParams, user);
            for (let i = 0; i < batchResults.length; i++) {
                const res = batchResults[i];
                const entityId = validEntityIds[i];
                if (res.Success && res.Results) {
                    for (const t of res.Results as Array<{ ID: string; Name?: string; Description?: string }>) {
                        const id = (parseUuid(t.ID) ?? t.ID).toLowerCase();
                        targetNames.set(`${entityId}:${id}`, {
                            name: t.Name ?? 'Unnamed item',
                            description: t.Description ?? null,
                        });
                    }
                } else if (!res.Success) {
                    LogError(`Failed to lookup target names for entity ${viewParams[i].EntityName}: ${res.ErrorMessage}`);
                }
            }
        } catch (err) {
            LogError(`resolveSpaceAgentRetrieval batch target lookup failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const candidateItems: SpaceAgentCandidateItem[] = [];
    for (const raw of rawItems) {
        const entityId = (parseUuid(raw.EntityID) ?? raw.EntityID).toLowerCase();
        const recId = cleanRecordId(raw.RecordID).toLowerCase();
        const target = targetNames.get(`${entityId}:${recId}`);
        const name = target?.name ?? `Item ${raw.ID}`;
        if (options?.query && !name.toLowerCase().includes(options.query.toLowerCase())) {
            continue;
        }
        candidateItems.push({
            ID: raw.ID,
            SpaceID: raw.SpaceID,
            EntityID: raw.EntityID,
            RecordID: raw.RecordID,
            Name: name,
            Description: target?.description ?? null,
            Band: raw.Band,
            StoredContentType: null,
        });
    }

    const quotedItems: SpaceAgentCandidateItem[] = [];
    const decisions: SpaceAgentRetrievalDecision[] = [];

    for (const item of candidateItems) {
        const itemSpaceId = parseUuid(item.SpaceID) ?? item.SpaceID;
        const allowed = agentMayQuote({
            callerCanRead: true, // Proven by successful RunView as user
            callerCanSeeTeam,
            itemBand: item.Band,
            itemSpaceId,
            askedFromSpaceId: cleanSpaceId,
            spaces: spaceNodes,
        });

        const reason = allowed
            ? 'Allowed: item is within asked space subtree and readable by caller.'
            : 'Refused: agentMayQuote excluded item based on space subtree, team band, or retrieval policy.';

        decisions.push({ item, allowed, reason });
        if (allowed) {
            quotedItems.push(item);
        }
    }

    return {
        spaceId: cleanSpaceId,
        askingUserId: cleanUserId,
        callerCanSeeTeam,
        searchedSpaceIds,
        candidateItems,
        quotedItems,
        decisions,
    };
}
