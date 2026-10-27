import { BaseEntity, LogError, RunView, type IMetadataProvider, type RunViewParams, type UserInfo } from '@memberjunction/core';
import {
    agentMayQuote,
    agentMayQuoteCandidate,
    audienceOfConversationKind,
    effectiveRetrievalScope,
    membershipReaches,
    spaceAllowsAgentRetrieval,
    type Band,
    type MemberSnapshot,
    type PrincipalReach,
    type RoleFlags,
    type ScopeNarrowing,
    type SpaceNode,
} from '@mj-biz-apps/collaboration-core';
import { requireSystemUser, toNode, type SpaceRow } from './load-graph.js';
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

export interface SpaceAgentRetrievalOptions {
    maxRows?: number;
    query?: string;
    /**
     * Explicit user IDs in the conversation's audience (B2.3). When provided (or when `conversationKind`
     * is provided), retrieval is bounded to the intersection of what every audience member may reach and see.
     */
    audienceUserIds?: readonly string[];
    /**
     * Conversation kind (`'General'`, `'Topic'`, `'Private'`). When provided without `audienceUserIds`,
     * the room's active participants are resolved from the space roster, and `'General'`/`'Topic'`
     * further bound the allowed band to `'Shared'`.
     */
    conversationKind?: string;
    narrowing?: ScopeNarrowing;
}

export interface SpaceAgentRetrievalResult {
    spaceId: string;
    askingUserId: string;
    callerCanSeeTeam: boolean;
    audienceUserIds: string[];
    searchedSpaceIds: string[];
    candidateItems: SpaceAgentCandidateItem[];
    quotedItems: SpaceAgentCandidateItem[];
    decisions: SpaceAgentRetrievalDecision[];
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
        // A status that allows no agent retrieval (Archived) keeps the space out
        if (!spaceAllowsAgentRetrieval(s)) {
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
 * for a specific user (and optional room audience) asking from a specific space.
 *
 * Rules enforced:
 * 1. User must reach the space where the question is asked.
 * 2. Determines candidate subtree spaces (filtering out parent/sibling spaces and excluded scopes in SQL),
 *    intersected across all participants in the room's audience when `audienceUserIds` or `conversationKind` is given (B2.3).
 * 3. Runs candidate query as the asking user (enforcing RLS fnCollaborationAccess & entity permissions).
 * 4. Batches target name and description lookups.
 * 5. Evaluates agentMayQuote and agentMayQuoteCandidate for every candidate:
 *    - Must be within the asked space's subtree (no parent or sibling leak) and reachable by every audience member.
 *    - Items in Team band are dropped if any audience member cannot see the Team band or if the conversation is Shared-audience.
 *    - Spaces marked ExcludedEntirely are never quoted.
 *    - Spaces marked ExcludedFromParentScope are never quoted from ancestors.
 */
export async function resolveSpaceAgentRetrieval(
    provider: IMetadataProvider,
    user: UserInfo,
    spaceId: string,
    options?: SpaceAgentRetrievalOptions,
): Promise<SpaceAgentRetrievalResult> {
    const cleanSpaceId = parseUuid(spaceId);
    const cleanUserId = parseUuid(user?.ID);

    if (!cleanSpaceId || !cleanUserId) {
        return {
            spaceId: spaceId ?? '',
            askingUserId: user?.ID ?? '',
            callerCanSeeTeam: false,
            audienceUserIds: [],
            searchedSpaceIds: [],
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    const explicitAudienceIds: string[] = [cleanUserId];
    if (options?.audienceUserIds?.length) {
        const seen = new Set<string>([cleanUserId.toLowerCase()]);
        for (const rawId of options.audienceUserIds) {
            const uid = parseUuid(rawId);
            if (uid && !seen.has(uid.toLowerCase())) {
                seen.add(uid.toLowerCase());
                explicitAudienceIds.push(uid);
            }
        }
    }

    const loadRoomRoster = !!options?.conversationKind && !options?.audienceUserIds?.length;
    const memberQueries: RunViewParams[] = loadRoomRoster
        ? [
              {
                  EntityName: MEMBERS_ENTITY,
                  ExtraFilter: `Status = 'Active'`,
                  Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
                  MaxRows: 5000,
                  ResultType: 'simple',
              },
          ]
        : explicitAudienceIds.map((uid) => ({
              EntityName: MEMBERS_ENTITY,
              ExtraFilter: `UserID = '${uid}' AND Status = 'Active'`,
              Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
              MaxRows: 2000,
              ResultType: 'simple',
          }));

    // Load space hierarchy and role definitions as system user so full topological metadata is available
    const probe = await provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, user);
    const system = await requireSystemUser(probe);
    const rvSystem = RunView.FromMetadataProvider(provider);

    const batchRes = await rvSystem.RunViews([
        {
            EntityName: SPACES_ENTITY,
            Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'AllowParentAssignees', 'ClosedAt', 'StatusID', 'SpaceTypeID'],
            MaxRows: 2000,
            ResultType: 'simple',
        },
        {
            EntityName: ROLES_ENTITY,
            Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
            MaxRows: 200,
            ResultType: 'simple',
        },
        ...memberQueries,
    ], system);

    const [spacesRes, rolesRes, ...memberResults] = batchRes;
    const failedMemberRes = memberResults.find((r) => !r?.Success);

    if (!spacesRes?.Success || !rolesRes?.Success || failedMemberRes) {
        LogError(`resolveSpaceAgentRetrieval failed to load space context: ${spacesRes?.ErrorMessage || rolesRes?.ErrorMessage || failedMemberRes?.ErrorMessage}`);
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam: false,
            audienceUserIds: [cleanUserId],
            searchedSpaceIds: [],
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    if ((spacesRes.Results?.length ?? 0) >= 2000) {
        throw new Error('Refusing retrieval: spaces page came back full, so the check would be incomplete.');
    }

    const spaceNodes: SpaceNode[] = (spacesRes.Results as SpaceRow[] ?? []).map(toNode);
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
    for (const membersRes of memberResults) {
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
    }

    // Determine caller's reaching role in the asked space
    const reach = membershipReaches(spaceNodes, memberSnapshots, cleanUserId, cleanSpaceId);
    if (!reach) {
        // Caller cannot even reach this space
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam: false,
            audienceUserIds: [],
            searchedSpaceIds: [],
            candidateItems: [],
            quotedItems: [],
            decisions: [],
        };
    }

    const callerCanSeeTeam = reach.role.canSeeTeamBand;
    const roomBand = options?.conversationKind ? audienceOfConversationKind(options.conversationKind) : null;

    let principalIds: string[];
    if (options?.audienceUserIds?.length) {
        principalIds = explicitAudienceIds;
    } else if (loadRoomRoster) {
        const seen = new Set<string>([cleanUserId.toLowerCase()]);
        principalIds = [cleanUserId];
        const candidateUsers = new Set<string>(memberSnapshots.map((m) => m.userId));
        for (const uid of candidateUsers) {
            if (seen.has(uid.toLowerCase())) continue;
            const memberReach = membershipReaches(spaceNodes, memberSnapshots, uid, cleanSpaceId);
            if (!memberReach) continue;
            if (roomBand === 'Team' && !memberReach.role.canSeeTeamBand) continue;
            seen.add(uid.toLowerCase());
            principalIds.push(uid);
        }
    } else {
        principalIds = [cleanUserId];
    }

    const principalReaches: PrincipalReach[] = principalIds.map((uid) => {
        const reachableSpaceIds: string[] = [];
        const canSeeTeamSpaceIds: string[] = [];
        for (const s of spaceNodes) {
            const r = membershipReaches(spaceNodes, memberSnapshots, uid, s.id);
            if (r) {
                reachableSpaceIds.push(s.id);
                if (r.role.canSeeTeamBand) {
                    canSeeTeamSpaceIds.push(s.id);
                }
            }
        }
        return {
            userId: uid,
            reachableSpaceIds,
            canSeeTeamSpaceIds,
            isInternalOrg: true,
        };
    });

    const scope = effectiveRetrievalScope({
        audience: {
            principals: principalIds,
            mode: principalIds.length > 1 ? 'Intersection' : 'Caller',
            anchorSpaceId: cleanSpaceId,
            narrowing: options?.narrowing ?? 'ThisSpaceAndSubspaces',
        },
        spaces: spaceNodes,
        principalReaches,
    });
    if (roomBand === 'Shared') {
        scope.allowedBand = 'Shared';
        for (const key of scope.spaceBands.keys()) {
            scope.spaceBands.set(key, 'Shared');
        }
    }

    // Filter to reachable subtree spaces in SQL rather than fetching all items and filtering in memory
    const subtreeSpaceIds = getReachableSubtreeSpaceIds(spaceNodes, cleanSpaceId);
    const allowedSpaceSet = new Set(scope.allowedSpaceIds.map((id) => id.toLowerCase()));
    const searchedSpaceIds = subtreeSpaceIds.filter((sid) =>
        !!membershipReaches(spaceNodes, memberSnapshots, cleanUserId, sid) &&
        allowedSpaceSet.has(sid.toLowerCase())
    );
    if (searchedSpaceIds.length === 0) {
        return {
            spaceId: cleanSpaceId,
            askingUserId: cleanUserId,
            callerCanSeeTeam,
            audienceUserIds: principalIds,
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
            audienceUserIds: principalIds,
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

    const targetNames = new Map<string, { name: string; description: string | null; contentType: string | null }>();
    const entityEntries = Array.from(recordIdsByEntity.entries());
    const viewParams: RunViewParams[] = [];
    const validEntityIds: string[] = [];

    for (const [entityId, recIds] of entityEntries) {
        const entityInfo = provider.EntityByID(entityId);
        if (!entityInfo) continue;
        const targetInClause = recIds.map((id) => `'${id}'`).join(',');
        const fields =
            entityInfo.Name === 'MJ: Files'
                ? ['ID', 'Name', 'Description', 'ContentType']
                : ['ID', 'Name', 'Description'];
        viewParams.push({
            EntityName: entityInfo.Name,
            ExtraFilter: `ID IN (${targetInClause})`,
            Fields: fields,
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
                    for (const t of res.Results as Array<{
                        ID: string;
                        Name?: string;
                        Description?: string;
                        ContentType?: string;
                    }>) {
                        const id = (parseUuid(t.ID) ?? t.ID).toLowerCase();
                        targetNames.set(`${entityId}:${id}`, {
                            name: t.Name ?? 'Unnamed item',
                            description: t.Description ?? null,
                            contentType: t.ContentType ?? null,
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
        const description = target?.description ?? null;
        if (options?.query) {
            const q = options.query.toLowerCase();
            if (!name.toLowerCase().includes(q) && !(description && description.toLowerCase().includes(q))) {
                continue;
            }
        }
        candidateItems.push({
            ID: raw.ID,
            SpaceID: raw.SpaceID,
            EntityID: raw.EntityID,
            RecordID: raw.RecordID,
            Name: name,
            Description: description,
            Band: raw.Band,
            StoredContentType: target?.contentType ?? null,
        });
    }

    const quotedItems: SpaceAgentCandidateItem[] = [];
    const decisions: SpaceAgentRetrievalDecision[] = [];

    for (const item of candidateItems) {
        const itemSpaceId = parseUuid(item.SpaceID) ?? item.SpaceID;
        const callerAllowed = agentMayQuote({
            callerCanRead: true, // Proven by successful RunView as user
            callerCanSeeTeam,
            itemBand: item.Band,
            itemSpaceId,
            askedFromSpaceId: cleanSpaceId,
            spaces: spaceNodes,
        });
        const audienceDecision = agentMayQuoteCandidate(
            {
                id: item.ID,
                spaceId: itemSpaceId,
                band: item.Band,
                title: item.Name,
            },
            scope,
        );
        const allowed = callerAllowed && audienceDecision.allowed;

        const reason = allowed
            ? 'Allowed: item is within asked space subtree and readable by caller.'
            : audienceDecision.reason ?? 'Refused: agentMayQuote excluded item based on space subtree, team band, or retrieval policy.';

        decisions.push({ item, allowed, reason });
        if (allowed) {
            quotedItems.push(item);
        }
    }

    return {
        spaceId: cleanSpaceId,
        askingUserId: cleanUserId,
        callerCanSeeTeam,
        audienceUserIds: principalIds,
        searchedSpaceIds,
        candidateItems,
        quotedItems,
        decisions,
    };
}
