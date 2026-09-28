import { type IMetadataProvider, LogError, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import {
    membershipReaches,
    type CollaborationSettings,
    type MemberSnapshot,
    type SpaceNode,
    ValidateCollaborationSettings,
} from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { resolveAllowedAgents } from './resolve-allowed-agents.js';
import { asMetadata, parseUuid } from './uuid.js';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const ROLES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';

export interface SpaceChatHostRulesMentionPerson {
    ID: string;
    Name: string;
    Email?: string | null;
}

export interface SpaceChatHostRulesResult {
    ok: boolean;
    message?: string;
    agentReplyMode: 'Always' | 'MentionOnly';
    allowedAgentIds: string[] | null;
    defaultAgentId: string | null;
    agentHistoryFrom: Date | null;
    mentionPeople: SpaceChatHostRulesMentionPerson[];
}

interface SpaceRow {
    ID: string;
    Name: string;
    ParentID?: string | null;
    InheritsMembership?: boolean | null;
    OwnerID?: string | null;
    ClosedAt?: string | Date | null;
    Configuration?: string | null;
    SpaceTypeID: string;
}

interface MemberRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    User?: string | null;
    SpaceRoleTypeID?: string | null;
    Band?: string | null;
    Status?: string | null;
}

interface RoleRow {
    ID: string;
    Level?: number | null;
    MaxGrantableLevel?: number | null;
    CanInvite?: boolean | null;
    CanPromoteBand?: boolean | null;
    CanSeeTeamBand?: boolean | null;
    IsOwnerRole?: boolean | null;
    CanContribute?: boolean | null;
}

/**
 * Resolves chat host rules for a space from the server's view of the space (D25).
 * - AgentReplyMode: derived from Chats.AgentReplyMode (MentionOrOneToOne and MentionOnly -> MentionOnly, Always -> Always).
 * - AllowedAgentIDs: allowed agents in scope.
 * - DefaultAgentID: default agent in scope.
 * - AgentHistoryFrom: history floor if configured, else null.
 * - MentionPeople: all room members whose seat reaches the space (including inherited seats).
 */
export async function resolveSpaceChatHostRules(
    providerOrObject: IMetadataProvider | object,
    user: UserInfo,
    spaceId: string,
): Promise<SpaceChatHostRulesResult> {
    const provider = asMetadata(providerOrObject);
    if (!provider) {
        return {
            ok: false,
            message: 'Metadata provider is required to resolve space chat host rules.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: null,
            defaultAgentId: null,
            agentHistoryFrom: null,
            mentionPeople: [],
        };
    }

    const systemUser = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!systemUser) {
        return {
            ok: false,
            message: 'System user is required to resolve space chat host rules.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: null,
            defaultAgentId: null,
            agentHistoryFrom: null,
            mentionPeople: [],
        };
    }

    const rv = RunView.FromMetadataProvider(provider);

    // 1. Load target space
    const spaceRes = await rv.RunView<SpaceRow>({
        EntityName: SPACES_ENTITY,
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ID', 'Name', 'ParentID', 'InheritsMembership', 'OwnerID', 'ClosedAt', 'Configuration', 'SpaceTypeID'],
        MaxRows: 1,
    }, systemUser);

    if (!spaceRes.Success || !spaceRes.Results?.[0]) {
        return {
            ok: false,
            message: spaceRes.ErrorMessage || 'The space could not be read.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: null,
            defaultAgentId: null,
            agentHistoryFrom: null,
            mentionPeople: [],
        };
    }

    const targetSpace = spaceRes.Results[0];

    // 2. Resolve settings & reply mode
    await CollaborationEngine.Instance.EnsureLoaded(systemUser, provider);

    let spaceConfig: CollaborationSettings | null = null;
    if (targetSpace.Configuration) {
        try {
            const parsed: unknown = JSON.parse(targetSpace.Configuration);
            const val = ValidateCollaborationSettings(parsed, 'space');
            if (val.valid) {
                spaceConfig = parsed as CollaborationSettings;
            } else {
                LogError(`resolveSpaceChatHostRules: Invalid space configuration for ${spaceId}: ${val.errors.join(', ')}`);
            }
        } catch (err) {
            LogError(`resolveSpaceChatHostRules: Error parsing space configuration for ${spaceId}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const resolvedSettings = CollaborationEngine.Instance.ResolveSettingsForSpace(
        spaceConfig ? [spaceConfig] : [],
        targetSpace.SpaceTypeID
    );

    const rawReplyMode = resolvedSettings?.Chats?.AgentReplyMode ?? 'MentionOrOneToOne';
    const agentReplyMode: 'Always' | 'MentionOnly' = rawReplyMode === 'Always' ? 'Always' : 'MentionOnly';

    // 3. Resolve allowed agents & default agent
    const allowed = await resolveAllowedAgents(provider, spaceId, systemUser);
    const allowedAgentIds = allowed.allowedAgentIds.length > 0 ? allowed.allowedAgentIds : null;
    const defaultAgentId = allowed.defaultAgentId ?? null;

    // 4. Resolve mention people: everyone whose seat reaches the space
    const spaceNodes: SpaceNode[] = [];
    const chainSpaceIds: string[] = [spaceId];
    let currentSpace: SpaceRow = targetSpace;
    const seenAncestors = new Set<string>([spaceId]);

    spaceNodes.push({
        id: spaceId,
        parentId: targetSpace.ParentID ? parseUuid(targetSpace.ParentID) : null,
        inheritsMembership: !!targetSpace.InheritsMembership,
        ownerId: parseUuid(targetSpace.OwnerID) ?? targetSpace.OwnerID ?? '',
        agentRetrieval: 'Included',
        allowParentAssignees: true,
        closedAt: targetSpace.ClosedAt ? String(targetSpace.ClosedAt) : null,
    });

    while (currentSpace.InheritsMembership && currentSpace.ParentID) {
        const parentId = parseUuid(currentSpace.ParentID);
        if (!parentId || seenAncestors.has(parentId)) break;
        seenAncestors.add(parentId);

        const parentRes = await rv.RunView<SpaceRow>({
            EntityName: SPACES_ENTITY,
            ExtraFilter: `ID = '${parentId}'`,
            Fields: ['ID', 'Name', 'ParentID', 'InheritsMembership', 'OwnerID', 'ClosedAt', 'SpaceTypeID'],
            MaxRows: 1,
        }, systemUser);

        if (!parentRes.Success || !parentRes.Results?.[0]) break;

        const parent = parentRes.Results[0];
        spaceNodes.push({
            id: parent.ID,
            parentId: parent.ParentID ? parseUuid(parent.ParentID) : null,
            inheritsMembership: !!parent.InheritsMembership,
            ownerId: parseUuid(parent.OwnerID) ?? parent.OwnerID ?? '',
            agentRetrieval: 'Included',
            allowParentAssignees: true,
            closedAt: parent.ClosedAt ? String(parent.ClosedAt) : null,
        });

        if (parent.ClosedAt) break;

        chainSpaceIds.push(parent.ID);
        currentSpace = parent;
    }

    const membersRes = await rv.RunView<MemberRow>({
        EntityName: SPACE_MEMBERS_ENTITY,
        ExtraFilter: `SpaceID IN (${chainSpaceIds.map((id) => `'${id}'`).join(', ')}) AND Status = 'Active'`,
        Fields: ['ID', 'SpaceID', 'UserID', 'User', 'SpaceRoleTypeID', 'Band'],
        MaxRows: 2000,
    }, systemUser);

    const memberRows = membersRes.Success ? (membersRes.Results ?? []) : [];
    const roleLookup = new Map<string, MemberSnapshot['role']>();

    if (memberRows.length > 0) {
        const roleIds = [...new Set(memberRows.map((m) => parseUuid(m.SpaceRoleTypeID)).filter((id): id is string => !!id))];
        if (roleIds.length > 0) {
            const rolesRes = await rv.RunView<RoleRow>({
                EntityName: ROLES_ENTITY,
                ExtraFilter: `ID IN (${roleIds.map((id) => `'${id}'`).join(', ')})`,
                Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
                MaxRows: roleIds.length,
            }, systemUser);

            if (rolesRes.Success && rolesRes.Results) {
                for (const r of rolesRes.Results) {
                    const rId = parseUuid(r.ID);
                    if (rId) {
                        roleLookup.set(rId, {
                            level: r.Level ?? 0,
                            maxGrantableLevel: r.MaxGrantableLevel ?? 0,
                            canInvite: !!r.CanInvite,
                            canPromoteBand: !!r.CanPromoteBand,
                            canSeeTeamBand: !!r.CanSeeTeamBand,
                            isOwnerRole: !!r.IsOwnerRole,
                            canContribute: !!r.CanContribute,
                        });
                    }
                }
            }
        }
    }

    const memberships: MemberSnapshot[] = memberRows.map((m) => ({
        spaceId: parseUuid(m.SpaceID) ?? m.SpaceID ?? spaceId,
        userId: parseUuid(m.UserID) ?? m.UserID,
        status: 'Active',
        band: m.Band === 'Team' ? 'Team' : 'Shared',
        role: roleLookup.get(parseUuid(m.SpaceRoleTypeID) ?? '') ?? {
            level: 0,
            maxGrantableLevel: 0,
            canInvite: false,
            canPromoteBand: false,
            canSeeTeamBand: false,
            isOwnerRole: false,
            canContribute: false,
        },
    }));

    const reachingUserIds = new Set<string>();
    const userToMemberRow = new Map<string, MemberRow>();
    for (const m of memberRows) {
        const uid = parseUuid(m.UserID);
        if (uid) {
            userToMemberRow.set(uid, m);
            const reach = membershipReaches(spaceNodes, memberships, uid, spaceId);
            if (reach) {
                reachingUserIds.add(uid);
            }
        }
    }

    const mentionPeople: SpaceChatHostRulesMentionPerson[] = [];
    const reachingUserIdsArr = [...reachingUserIds];
    if (reachingUserIdsArr.length > 0) {
        const userFilter = reachingUserIdsArr.map((id) => `'${id}'`).join(', ');
        const usersRes = await rv.RunView<{ ID: string; Name: string; Email: string }>({
            EntityName: 'MJ: Users',
            ExtraFilter: `ID IN (${userFilter})`,
            Fields: ['ID', 'Name', 'Email'],
            MaxRows: reachingUserIdsArr.length,
        }, systemUser);

        if (usersRes.Success && usersRes.Results) {
            for (const u of usersRes.Results) {
                mentionPeople.push({
                    ID: u.ID,
                    Name: u.Name || 'Member',
                    Email: u.Email || null,
                });
            }
        } else {
            // Fallback to member row names
            for (const uid of reachingUserIdsArr) {
                const row = userToMemberRow.get(uid);
                mentionPeople.push({
                    ID: uid,
                    Name: row?.User || 'Member',
                    Email: null,
                });
            }
        }
    }

    return {
        ok: true,
        agentReplyMode,
        allowedAgentIds,
        defaultAgentId,
        agentHistoryFrom: null,
        mentionPeople,
    };
}
