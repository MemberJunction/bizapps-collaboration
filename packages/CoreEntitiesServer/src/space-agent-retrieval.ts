import { BaseEntity, LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
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

/**
 * Resolves materials that the Collaboration Space Agent is permitted to quote
 * for a specific user asking from a specific space.
 *
 * Rules enforced:
 * 1. User must reach the space where the question is asked.
 * 2. Runs candidate query as the asking user (enforcing RLS fnCollaborationAccess & entity permissions).
 * 3. Evaluates agentMayQuote for every candidate:
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
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    // Load space hierarchy and role definitions as system user so full topological metadata is available
    const probe = await provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, user);
    const system = await requireSystemUser(probe);
    const rvSystem = RunView.FromMetadataProvider(provider);

    const [spacesRes, rolesRes, membersRes] = await Promise.all([
        rvSystem.RunView<SpaceRow>({
            EntityName: SPACES_ENTITY,
            Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'AllowParentAssignees'],
            MaxRows: 2000,
            ResultType: 'simple',
        }, system),
        rvSystem.RunView<RoleRow>({
            EntityName: ROLES_ENTITY,
            Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
            MaxRows: 200,
            ResultType: 'simple',
        }, system),
        rvSystem.RunView<MemberRow>({
            EntityName: MEMBERS_ENTITY,
            ExtraFilter: `UserID = '${cleanUserId}' AND Status = 'Active'`,
            Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
            MaxRows: 2000,
            ResultType: 'simple',
        }, system),
    ]);

    if (!spacesRes.Success || !rolesRes.Success || !membersRes.Success) {
        LogError(`resolveSpaceAgentRetrieval failed to load space context: ${spacesRes.ErrorMessage || rolesRes.ErrorMessage || membersRes.ErrorMessage}`);
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam: false,
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    const spaceNodes: SpaceNode[] = (spacesRes.Results ?? []).map(toSpaceNode);
    const roleMap = new Map<string, RoleFlags>();
    for (const r of rolesRes.Results ?? []) {
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
    for (const m of membersRes.Results ?? []) {
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
    if (!reach) {
        // Caller cannot even reach this space
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam: false,
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    const callerCanSeeTeam = reach.role.canSeeTeamBand;

    // Run candidate item query AS THE CALLING USER so RLS (fnCollaborationAccess) applies
    const rvUser = RunView.FromMetadataProvider(provider);
    const itemsRes = await rvUser.RunView<SpaceItemRow>({
        EntityName: ITEMS_ENTITY,
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
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
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
    for (const [entityId, recIds] of recordIdsByEntity.entries()) {
        const entityInfo = provider.EntityByID(entityId);
        if (!entityInfo) continue;
        const inClause = recIds.map((id) => `'${id}'`).join(',');
        try {
            const targetRes = await rvUser.RunView<{ ID: string; Name?: string; Description?: string }>({
                EntityName: entityInfo.Name,
                ExtraFilter: `ID IN (${inClause})`,
                Fields: ['ID', 'Name'],
                MaxRows: 2000,
                ResultType: 'simple',
            }, user);
            if (targetRes.Success) {
                for (const t of targetRes.Results ?? []) {
                    const id = (parseUuid(t.ID) ?? t.ID).toLowerCase();
                    targetNames.set(`${entityId}:${id}`, {
                        name: t.Name ?? 'Unnamed item',
                        description: t.Description ?? null,
                    });
                }
            }
        } catch {
            // Best effort target name resolution
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
        candidateItems,
        quotedItems,
        decisions,
    };
}
