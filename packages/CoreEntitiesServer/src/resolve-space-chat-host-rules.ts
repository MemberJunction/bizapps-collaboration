import { type IMetadataProvider, LogError, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import {
    membershipReaches,
    type MemberSnapshot,
    type SpaceNode,
} from '@mj-biz-apps/collaboration-core';
import { resolveAllowedAgents } from './resolve-allowed-agents.js';
import { resolveSpaceChatSettings } from './resolve-space-chat-settings.js';
import { evaluateCanStartSpaceConversation } from './create-space-conversation.js';
import { asMetadata, parseUuid } from './uuid.js';
import { CollaborationEngine } from './CollaborationEngine.js';
import { spaceWriteRefusal } from './space-status-gate.js';

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
    allowedAgentIds: string[];
    defaultAgentId: string | null;
    defaultAgentName?: string | null;
    agentHistoryFrom: Date | null;
    mentionPeople: SpaceChatHostRulesMentionPerson[];
    canStartConversation: boolean;
    allowedConversationKinds: string[];
}

interface SpaceRow {
    ID: string;
    Name: string;
    ParentID?: string | null;
    InheritsMembership?: boolean | null;
    OwnerID?: string | null;
    ClosedAt?: string | Date | null;
    StatusID?: string | null;
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
    __mj_CreatedAt?: string | Date | null;
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
 * - AgentReplyMode: derived from Chats.AgentReplyMode via unified resolveSpaceChatSettings.
 * - AllowedAgentIDs: allowed agents in scope.
 * - DefaultAgentID: default agent in scope.
 * - AgentHistoryFrom: viewer's history floor from Chats.HistoryOnAdd.
 * - MentionPeople: all room members whose seat reaches the space (including inherited seats).
 * Refuses unless caller reaches the space (Item 20).
 */
export async function resolveSpaceChatHostRules(
    providerOrObject: IMetadataProvider | object,
    user: UserInfo,
    spaceId: string,
    conversationId?: string,
): Promise<SpaceChatHostRulesResult> {
    const provider = asMetadata(providerOrObject);
    if (!provider) {
        return {
            ok: false,
            message: 'Metadata provider is required to resolve space chat host rules.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: [],
            defaultAgentId: null,
            defaultAgentName: null,
            agentHistoryFrom: null,
            mentionPeople: [],
            canStartConversation: false,
            allowedConversationKinds: [],
        };
    }

    const systemUser = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!systemUser) {
        return {
            ok: false,
            message: 'System user is required to resolve space chat host rules.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: [],
            defaultAgentId: null,
            defaultAgentName: null,
            agentHistoryFrom: null,
            mentionPeople: [],
            canStartConversation: false,
            allowedConversationKinds: [],
        };
    }

    const rv = RunView.FromMetadataProvider(provider);

    // 1. Load target space
    const spaceRes = await rv.RunView<SpaceRow>({
        EntityName: SPACES_ENTITY,
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ID', 'Name', 'ParentID', 'InheritsMembership', 'OwnerID', 'ClosedAt', 'StatusID', 'Configuration', 'SpaceTypeID'],
        MaxRows: 1,
    }, systemUser);

    if (!spaceRes.Success || !spaceRes.Results?.[0]) {
        return {
            ok: false,
            message: spaceRes.ErrorMessage || 'The space could not be read.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: [],
            defaultAgentId: null,
            defaultAgentName: null,
            agentHistoryFrom: null,
            mentionPeople: [],
            canStartConversation: false,
            allowedConversationKinds: [],
        };
    }

    const targetSpace = spaceRes.Results[0];

    // 2. Resolve settings & reply mode using unified function (Item 16)
    let chatSettings: Awaited<ReturnType<typeof resolveSpaceChatSettings>>;
    try {
        chatSettings = await resolveSpaceChatSettings(provider, spaceId, systemUser);
    } catch (settingsError) {
        return {
            ok: false,
            message: settingsError instanceof Error ? settingsError.message : 'Space settings refused.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: [],
            defaultAgentId: null,
            defaultAgentName: null,
            agentHistoryFrom: null,
            mentionPeople: [],
            canStartConversation: false,
            allowedConversationKinds: [],
        };
    }
    const agentReplyMode = chatSettings.agentReplyMode;

    // 3. Resolve allowed agents & default agent
    let allowed: Awaited<ReturnType<typeof resolveAllowedAgents>>;
    try {
        allowed = await resolveAllowedAgents(provider, spaceId, systemUser);
    } catch (agentsError) {
        return {
            ok: false,
            message: agentsError instanceof Error ? agentsError.message : 'Allowed agents refused.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: [],
            defaultAgentId: null,
            defaultAgentName: null,
            agentHistoryFrom: null,
            mentionPeople: [],
            canStartConversation: false,
            allowedConversationKinds: [],
        };
    }
    const allowedAgentIds = allowed.allowedAgentIds;
    const defaultAgentId = allowed.defaultAgentId ?? null;
    let defaultAgentName: string | null = null;
    if (defaultAgentId) {
        try {
            const agentRes = await rv.RunView<{ ID: string; Name: string }>({
                EntityName: 'MJ: AI Agents',
                ExtraFilter: `ID = '${defaultAgentId}'`,
                Fields: ['ID', 'Name'],
                MaxRows: 1,
                ResultType: 'simple',
            }, systemUser);
            if (agentRes.Success && agentRes.Results?.[0]?.Name) {
                defaultAgentName = agentRes.Results[0].Name;
            } else if (!agentRes.Success) {
                LogError(`[resolveSpaceChatHostRules] Failed to load agent name for defaultAgentId ${defaultAgentId}: ${agentRes.ErrorMessage}`);
            }
        } catch (e) {
            LogError(`[resolveSpaceChatHostRules] Exception loading agent name for defaultAgentId ${defaultAgentId}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // 4. Build ancestor chain and memberships to verify reach and resolve mention people
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
        status: CollaborationEngine.Instance.StatusReachForSpace(targetSpace),
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
        Fields: ['ID', 'SpaceID', 'UserID', 'User', 'SpaceRoleTypeID', 'Band', '__mj_CreatedAt'],
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
    const userReachMap = new Map<string, NonNullable<ReturnType<typeof membershipReaches>>>();
    for (const m of memberRows) {
        const uid = parseUuid(m.UserID);
        if (uid) {
            userToMemberRow.set(uid, m);
            const reach = membershipReaches(spaceNodes, memberships, uid, spaceId, new Date(), true);
            if (reach) {
                userReachMap.set(uid, reach);
                reachingUserIds.add(uid);
            }
        }
    }

    // 5. Item 20: Refuse unless caller reaches the space
    const callerId = parseUuid(user?.ID);
    if (!callerId || !reachingUserIds.has(callerId)) {
        return {
            ok: false,
            message: 'Caller does not reach this space.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: [],
            defaultAgentId: null,
            defaultAgentName: null,
            agentHistoryFrom: null,
            mentionPeople: [],
            canStartConversation: false,
            allowedConversationKinds: [],
        };
    }
    const callerReach = userReachMap.get(callerId);

    // If conversationId is specified, check conversation access
    let targetChatKind: string = 'General';
    let targetChatArchived = false;
    if (conversationId) {
        const parsedConvId = parseUuid(conversationId);
        if (!parsedConvId) {
            return {
                ok: false,
                message: 'The conversation ID is invalid.',
                agentReplyMode: 'MentionOnly',
                allowedAgentIds: [],
                defaultAgentId: null,
                defaultAgentName: null,
                agentHistoryFrom: null,
                mentionPeople: [],
                canStartConversation: false,
                allowedConversationKinds: [],
            };
        }
        const chatCheck = await rv.RunView<{ ID: string; Kind: string; Status: string }>({
            EntityName: 'MJ_BizApps_Collaboration: Space Chats',
            ExtraFilter: `SpaceID = '${spaceId}' AND ConversationID = '${parsedConvId}'`,
            Fields: ['ID', 'Kind', 'Status'],
            MaxRows: 1,
            ResultType: 'simple',
        }, systemUser);
        if (!chatCheck.Success) {
            return {
                ok: false,
                message: chatCheck.ErrorMessage || 'Failed to read space chat.',
                agentReplyMode: 'MentionOnly',
                allowedAgentIds: [],
                defaultAgentId: null,
                defaultAgentName: null,
                agentHistoryFrom: null,
                mentionPeople: [],
                canStartConversation: false,
                allowedConversationKinds: [],
            };
        }
        if (!chatCheck.Results?.[0]) {
            return {
                ok: false,
                message: 'The conversation does not belong to this space.',
                agentReplyMode: 'MentionOnly',
                allowedAgentIds: [],
                defaultAgentId: null,
                defaultAgentName: null,
                agentHistoryFrom: null,
                mentionPeople: [],
                canStartConversation: false,
                allowedConversationKinds: [],
            };
        }
        targetChatKind = chatCheck.Results[0].Kind;
        targetChatArchived = chatCheck.Results[0].Status === 'Archived';
    }

    if (targetChatKind === 'Private') {
        if (!callerReach?.role.canSeeTeamBand) {
            return {
                ok: false,
                message: 'Caller does not have access to this internal conversation.',
                agentReplyMode: 'MentionOnly',
                allowedAgentIds: [],
                defaultAgentId: null,
                defaultAgentName: null,
                agentHistoryFrom: null,
                mentionPeople: [],
                canStartConversation: false,
                allowedConversationKinds: [],
            };
        }
    }

    // After the Internal Only check, so a caller who can't see Team never learns that an internal conversation is archived
    if (targetChatArchived) {
        return {
            ok: true,
            message: 'The conversation is archived.',
            agentReplyMode: 'MentionOnly',
            allowedAgentIds: [],
            defaultAgentId: null,
            defaultAgentName: null,
            agentHistoryFrom: null,
            mentionPeople: [],
            canStartConversation: false,
            allowedConversationKinds: [],
        };
    }

    // 6. Item 16: Compute viewer's floor from Chats.HistoryOnAdd
    let agentHistoryFrom: Date | null = null;
    if (chatSettings.historyOnAdd !== 'All' && callerId && callerReach) {
        const seatRes = await rv.RunView<{ __mj_CreatedAt: string | Date | null }>({
            EntityName: SPACE_MEMBERS_ENTITY,
            ExtraFilter: `SpaceID = '${callerReach.spaceId}' AND UserID = '${callerId}' AND Status = 'Active'`,
            Fields: ['__mj_CreatedAt'],
            MaxRows: 1,
            ResultType: 'simple',
        }, systemUser);
        if (seatRes.Success && seatRes.Results?.[0]?.__mj_CreatedAt) {
            agentHistoryFrom = new Date(seatRes.Results[0].__mj_CreatedAt);
        }
    }

    // 7. Resolve mention people for this conversation
    const mentionPeople: SpaceChatHostRulesMentionPerson[] = [];
    const mentionUserIds = [...reachingUserIds].filter((uid) => {
        if (targetChatKind === 'Private') {
            return userReachMap.get(uid)?.role.canSeeTeamBand === true;
        }
        return true;
    });

    if (mentionUserIds.length > 0) {
        const userFilter = mentionUserIds.map((id) => `'${id}'`).join(', ');
        const usersRes = await rv.RunView<{ ID: string; Name: string; Email: string }>({
            EntityName: 'MJ: Users',
            ExtraFilter: `ID IN (${userFilter})`,
            Fields: ['ID', 'Name', 'Email'],
            MaxRows: mentionUserIds.length,
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
            for (const uid of mentionUserIds) {
                const row = userToMemberRow.get(uid);
                mentionPeople.push({
                    ID: uid,
                    Name: row?.User || 'Member',
                    Email: null,
                });
            }
        }
    }

    const whoCanStart = chatSettings.resolvedSettings.Chats?.WhoCanStart ?? 'Anyone';
    // A read-only status (Paused, Closed) locks the composer as a close did
    const startPerms = evaluateCanStartSpaceConversation(
        spaceWriteRefusal(targetSpace).readOnly,
        whoCanStart,
        callerReach?.role
    );

    return {
        ok: true,
        agentReplyMode,
        allowedAgentIds,
        defaultAgentId,
        defaultAgentName,
        agentHistoryFrom,
        mentionPeople,
        canStartConversation: startPerms.canStartConversation,
        allowedConversationKinds: startPerms.allowedConversationKinds,
    };
}
