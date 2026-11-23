/**
 * CS-3: Rule-Based Chat Write Permission Provider.
 *
 * Evaluates writes (`create`, `update`, `delete`) on `MJ: Conversation Details`
 * for Collaboration space chats against:
 *  - SpaceChat membership & status (`Active`, `General`/`Topic`/`Private`/`Assistant`),
 *  - Space visibility, status (`ReadOnly` / `ClosedAt`), and sealed state (`InheritsMembership`),
 *  - Active seat roles (`CanContribute`, `CanSeeTeamBand`, `IsOwnerRole`) and bands (`Team` | `Shared`),
 *  - Non-loosening `Chats.WhoCanWrite` rules across `App -> SpaceType -> SameTypeRun -> Space`,
 *  - Fail-closed defaults on missing/unparseable metadata, unregistered drivers, or failed DB reads.
 *
 * Uses `RunView.RunView(...)` with `ResultType: 'simple'` and batched `ExtraFilter` `IN` clauses
 * (zero N+1 entity hydration). Integrates dynamically with `@memberjunction/core-entities-server`'s
 * `ConversationDetailWritePermissionRegistry` when present in the host runtime.
 */

import { createRequire } from 'node:module';
import {
    LogError,
    RunView,
    WellKnownUserSource,
    type IMetadataProvider,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { BaseSingleton, MJGlobal } from '@memberjunction/global';
import {
    evaluateSpaceChatWriteRules,
    sameTypeRun,
    type ChatWriteOperation,
    type ChatWriteSpaceChatSummary,
    type ChatWriteVerdict,
    type CollaborationSettings,
    type MemberSnapshot,
    type RoleFlags,
    type SpaceLevelInput,
    type SpaceNode,
} from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { BaseSpaceTypeServerDriver } from './base-space-type-server-driver.js';
import { CollaborationEngine } from './CollaborationEngine.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { asMetadata, parseUuid } from './uuid.js';

const SPACE_CHATS_ENTITY = 'MJ_BizApps_Collaboration: Space Chats';
const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const SPACE_ROLES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';
const SPACE_TYPES_ENTITY = 'MJ_BizApps_Collaboration: Space Types';

const MAX_CHAIN_DEPTH = 32;
const MAX_MEMBER_ROWS = 2000;
const MAX_ROLE_ROWS = 200;

export interface ChatWriteDetailSnapshot {
    UserID?: string | null;
    Role?: string | null;
}

export interface ChatWritePermissionContext {
    Provider: IMetadataProvider;
    ContextUser: UserInfo;
    Operation: ChatWriteOperation;
    ConversationID: string;
    ConversationDetail?: ChatWriteDetailSnapshot | null;
    IsServerAuthoredReply?: boolean;
}

interface SpaceChatRow {
    ID: string;
    SpaceID: string;
    ConversationID: string;
    Kind: string;
    Status: string;
    OwnerUserID?: string | null;
}

interface SpaceChainDbRow {
    ID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    OwnerID: string;
    AgentRetrieval: SpaceNode['agentRetrieval'];
    AllowParentAssignees?: boolean;
    ClosedAt?: string | Date | null;
    StatusID?: string | null;
    SpaceTypeID: string;
    Configuration?: string | null;
}

interface SpaceTypeLookupRow {
    ID: string;
    Code: string;
    Name: string;
    ServerDriverClass?: string | null;
    Configuration?: string | null;
}

interface MemberSimpleRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    SpaceRoleTypeID: string;
    Band?: string | null;
    Status: string;
}

interface RoleSimpleRow {
    ID: string;
    Level?: number | null;
    MaxGrantableLevel?: number | null;
    CanInvite?: boolean | null;
    CanPromoteBand?: boolean | null;
    CanSeeTeamBand?: boolean | null;
    IsOwnerRole?: boolean | null;
    CanContribute?: boolean | null;
}

interface HostWritePermissionRegistryLike {
    Register(
        key: string,
        provider: {
            readonly Priority: number;
            EvaluateWritePermission(context: ChatWritePermissionContext): Promise<ChatWriteVerdict>;
        },
        priority?: number,
    ): void;
}

interface CoreEntitiesServerModuleLike {
    ConversationDetailWritePermissionProvider?: abstract new () => {
        readonly Priority: number;
        EvaluateWritePermission(context: ChatWritePermissionContext): Promise<ChatWriteVerdict>;
    };
    ConversationDetailWritePermissionRegistry?: {
        Instance?: HostWritePermissionRegistryLike;
    };
}

function emptyRole(): RoleFlags {
    return {
        level: 0,
        maxGrantableLevel: 0,
        canInvite: false,
        canPromoteBand: false,
        canSeeTeamBand: false,
        isOwnerRole: false,
        canContribute: false,
    };
}

function parseSettingsJson(raw: string | null | undefined): { ok: true; value: CollaborationSettings | null } | { ok: false } {
    if (!raw || !raw.trim()) {
        return { ok: true, value: null };
    }
    try {
        const parsed = JSON.parse(raw) as CollaborationSettings | null;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false };
        }
        return { ok: true, value: parsed };
    } catch {
        return { ok: false };
    }
}

export class CollaborationChatWritePermissionProvider extends BaseSingleton<CollaborationChatWritePermissionProvider> {
    public readonly Priority = 50;

    protected constructor() {
        super();
    }

    public static get Instance(): CollaborationChatWritePermissionProvider {
        return super.getInstance<CollaborationChatWritePermissionProvider>();
    }

    /**
     * Evaluates whether `context.ContextUser` may perform `context.Operation` on a
     * `MJ: Conversation Details` row belonging to a Collaboration space chat.
     *
     * Returns `{ Decision: 'Abstain' }` when the conversation is not a Collaboration space chat
     * or when executing as the system user; otherwise returns an authoritative `Allow` or `Deny`.
     */
    public async EvaluateWritePermission(context: ChatWritePermissionContext): Promise<ChatWriteVerdict> {
        const user = context.ContextUser;
        if (user && WellKnownUserSource.Instance.IsSystemUser(user)) {
            return { Decision: 'Abstain' };
        }

        const callerId = parseUuid(user?.ID);
        const conversationId = parseUuid(context.ConversationID);
        if (!callerId || !conversationId) {
            return {
                Decision: 'Deny',
                Reason: 'Chat write denied: valid user and conversation IDs are required.',
            };
        }

        const md = asMetadata(context.Provider);
        if (!md) {
            return {
                Decision: 'Deny',
                Reason: 'Chat write denied: metadata provider is unavailable.',
            };
        }

        let system: UserInfo;
        try {
            const resolvedSystem = await WellKnownUserSource.Instance.GetSystemUser(md);
            if (!resolvedSystem) {
                return { Decision: 'Deny', Reason: 'Chat write denied: system user is unavailable.' };
            }
            system = resolvedSystem;
        } catch (err) {
            LogError(`CollaborationChatWritePermissionProvider: failed resolving system user: ${err instanceof Error ? err.message : String(err)}`);
            return { Decision: 'Deny', Reason: 'Unable to verify space chat permissions.' };
        }

        const rv = RunView.FromMetadataProvider(md);

        // 1. Check whether this conversation belongs to Collaboration Space Chats
        const chatRes = await rv.RunView<SpaceChatRow>({
            EntityName: SPACE_CHATS_ENTITY,
            ExtraFilter: `ConversationID = '${conversationId}'`,
            Fields: ['ID', 'SpaceID', 'ConversationID', 'Kind', 'Status', 'OwnerUserID'],
            MaxRows: 1,
            ResultType: 'simple',
        }, system);

        if (!chatRes.Success) {
            LogError(`CollaborationChatWritePermissionProvider: failed reading SpaceChat for ${conversationId}: ${chatRes.ErrorMessage ?? 'unknown error'}`);
            return { Decision: 'Deny', Reason: 'Unable to verify space chat permissions.' };
        }

        const chatRow = chatRes.Results?.[0];
        if (!chatRow) {
            return { Decision: 'Abstain' };
        }

        const spaceId = parseUuid(chatRow.SpaceID);
        if (!spaceId) {
            return { Decision: 'Deny', Reason: 'Chat write denied: space chat is missing a valid space reference.' };
        }

        // 2. Ensure CollaborationEngine metadata (SpaceTypes, Statuses, App Settings) is loaded
        try {
            await CollaborationEngine.Instance.EnsureLoaded(system, md);
        } catch (err) {
            LogError(`CollaborationChatWritePermissionProvider: failed loading CollaborationEngine: ${err instanceof Error ? err.message : String(err)}`);
            return { Decision: 'Deny', Reason: 'Unable to verify space type rules.' };
        }

        // 3. Load space and ancestor chain (both for sealed-membership walk and sameTypeRun rules)
        const chainRows: SpaceChainDbRow[] = [];
        const seenSpaceIds = new Set<string>();
        let currentSpaceId: string | null = spaceId;
        let depth = 0;

        while (currentSpaceId && !seenSpaceIds.has(currentSpaceId) && depth < MAX_CHAIN_DEPTH) {
            seenSpaceIds.add(currentSpaceId);
            depth += 1;
            const spaceRes: RunViewResult<SpaceChainDbRow> = await rv.RunView<SpaceChainDbRow>({
                EntityName: SPACES_ENTITY,
                ExtraFilter: `ID = '${currentSpaceId}'`,
                Fields: [
                    'ID',
                    'ParentID',
                    'InheritsMembership',
                    'OwnerID',
                    'AgentRetrieval',
                    'AllowParentAssignees',
                    'ClosedAt',
                    'StatusID',
                    'SpaceTypeID',
                    'Configuration',
                ],
                MaxRows: 1,
                ResultType: 'simple',
            }, system);

            if (!spaceRes.Success) {
                LogError(`CollaborationChatWritePermissionProvider: failed reading space ${currentSpaceId}: ${spaceRes.ErrorMessage ?? 'unknown error'}`);
                return { Decision: 'Deny', Reason: 'Unable to verify space hierarchy permissions.' };
            }
            const row: SpaceChainDbRow | undefined = spaceRes.Results?.[0];
            if (!row) {
                break;
            }
            chainRows.push(row);
            currentSpaceId = row.ParentID ? parseUuid(row.ParentID) : null;
        }

        if (chainRows.length === 0) {
            return { Decision: 'Deny', Reason: 'Chat write denied: target space could not be found.' };
        }

        const targetRow = chainRows[0];
        const targetTypeId = parseUuid(targetRow.SpaceTypeID);
        if (!targetTypeId) {
            return { Decision: 'Deny', Reason: 'Chat write denied: space type could not be verified.' };
        }

        // 4. Resolve SpaceType + Driver verification (fail closed if missing or unregistered)
        let spaceTypeConfigRaw: string | null | undefined = null;
        let driverValidated = true;
        const cachedType = CollaborationEngine.Instance.SpaceTypeById(targetTypeId);
        if (cachedType) {
            spaceTypeConfigRaw = cachedType.Configuration;
            try {
                ServerDriverRegistry.Instance.GetDriverForType(cachedType);
            } catch {
                driverValidated = false;
            }
        } else {
            const typeRes = await rv.RunView<SpaceTypeLookupRow>({
                EntityName: SPACE_TYPES_ENTITY,
                ExtraFilter: `ID = '${targetTypeId}'`,
                Fields: ['ID', 'Code', 'Name', 'ServerDriverClass', 'Configuration'],
                MaxRows: 1,
                ResultType: 'simple',
            }, system);
            if (!typeRes.Success || !typeRes.Results?.[0]) {
                return { Decision: 'Deny', Reason: 'Chat write denied: space type could not be read.' };
            }
            const row = typeRes.Results[0];
            spaceTypeConfigRaw = row.Configuration;
            const driverKey = row.ServerDriverClass?.trim();
            if (driverKey) {
                const probeDriver = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseSpaceTypeServerDriver>(
                    BaseSpaceTypeServerDriver,
                    driverKey,
                );
                if (!probeDriver?.Resolved) {
                    const typeEntity = await md.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPES_ENTITY, system);
                    if (!(await typeEntity.Load(targetTypeId))) {
                        driverValidated = false;
                    } else {
                        try {
                            ServerDriverRegistry.Instance.GetDriverForType(typeEntity);
                        } catch {
                            driverValidated = false;
                        }
                    }
                }
            }
        }

        // 5. Parse non-loosening policy chain: App -> SpaceType -> SameTypeRun spaces (top-down)
        const typeSettingsParsed = parseSettingsJson(spaceTypeConfigRaw);
        if (!typeSettingsParsed.ok) {
            return { Decision: 'Deny', Reason: 'Chat write denied: space type configuration is malformed.' };
        }

        let appWhoCanWrite: string | null | undefined = null;
        try {
            appWhoCanWrite = CollaborationEngine.Instance.CollaborationSettings.Chats?.WhoCanWrite ?? null;
        } catch {
            // App settings row may not be cached in isolated test environments; fail closed only on malformed JSON
            appWhoCanWrite = null;
        }

        const sameTypeChain: SpaceLevelInput[] = [];
        for (const row of chainRows) {
            const parsedSpaceCfg = parseSettingsJson(row.Configuration);
            if (!parsedSpaceCfg.ok) {
                return { Decision: 'Deny', Reason: 'Chat write denied: space configuration is malformed.' };
            }
            sameTypeChain.push({
                ID: row.ID,
                TypeID: row.SpaceTypeID,
                Settings: parsedSpaceCfg.value,
                Grants: [],
            });
        }
        const activeRun = sameTypeRun(sameTypeChain);
        const policyChain: Array<string | null | undefined> = [
            appWhoCanWrite,
            typeSettingsParsed.value?.Chats?.WhoCanWrite,
            ...[...activeRun].reverse().map((node) => node.Settings?.Chats?.WhoCanWrite),
        ];

        // 6. Build SpaceNode list and collect reachable space IDs (halting at sealed boundaries)
        const spaceNodes: SpaceNode[] = [];
        const membershipSearchSpaceIds: string[] = [];
        let stopMembershipWalk = false;
        for (const row of chainRows) {
            const normId = parseUuid(row.ID) ?? row.ID;
            spaceNodes.push({
                id: normId,
                parentId: row.ParentID ? parseUuid(row.ParentID) : null,
                inheritsMembership: !!row.InheritsMembership,
                ownerId: parseUuid(row.OwnerID) ?? row.OwnerID,
                agentRetrieval: row.AgentRetrieval,
                allowParentAssignees: row.AllowParentAssignees !== undefined ? !!row.AllowParentAssignees : true,
                closedAt: row.ClosedAt ? String(row.ClosedAt) : null,
                status: CollaborationEngine.Instance.StatusReachForSpace(row),
            });
            if (!stopMembershipWalk) {
                membershipSearchSpaceIds.push(normId);
                if (!row.InheritsMembership) {
                    stopMembershipWalk = true;
                }
            }
        }

        // 7. Batched RunView (ResultType: 'simple' + IN clause) for active caller seats
        const inSpacesClause = membershipSearchSpaceIds.map((id) => `'${id}'`).join(', ');
        const membersRes = await rv.RunView<MemberSimpleRow>({
            EntityName: SPACE_MEMBERS_ENTITY,
            ExtraFilter: `SpaceID IN (${inSpacesClause}) AND UserID = '${callerId}' AND Status = 'Active'`,
            Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Band', 'Status'],
            ResultType: 'simple',
            // row-cap-ok: bounded by caller seats along space ancestor chain; refuses on full page
            MaxRows: MAX_MEMBER_ROWS,
        }, system);

        if (!membersRes.Success || (membersRes.Results?.length ?? 0) >= MAX_MEMBER_ROWS) {
            return { Decision: 'Deny', Reason: 'Unable to verify caller space seats.' };
        }

        const memberRows = membersRes.Results ?? [];
        const roleIds = [
            ...new Set(
                memberRows
                    .map((m) => parseUuid(m.SpaceRoleTypeID))
                    .filter((id): id is string => Boolean(id)),
            ),
        ];

        const roleLookup = new Map<string, RoleFlags>();
        if (roleIds.length > 0) {
            const inRolesClause = roleIds.map((id) => `'${id}'`).join(', ');
            const rolesRes = await rv.RunView<RoleSimpleRow>({
                EntityName: SPACE_ROLES_ENTITY,
                ExtraFilter: `ID IN (${inRolesClause})`,
                Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
                ResultType: 'simple',
                // row-cap-ok: bounded by distinct role IDs from caller's active seats
                MaxRows: MAX_ROLE_ROWS,
            }, system);

            if (!rolesRes.Success) {
                return { Decision: 'Deny', Reason: 'Unable to verify caller space role permissions.' };
            }

            for (const roleRow of rolesRes.Results ?? []) {
                const roleId = parseUuid(roleRow.ID);
                if (!roleId) continue;
                roleLookup.set(roleId.toLowerCase(), {
                    level: roleRow.Level ?? 0,
                    maxGrantableLevel: roleRow.MaxGrantableLevel ?? 0,
                    canInvite: !!roleRow.CanInvite,
                    canPromoteBand: !!roleRow.CanPromoteBand,
                    canSeeTeamBand: !!roleRow.CanSeeTeamBand,
                    isOwnerRole: !!roleRow.IsOwnerRole,
                    canContribute: !!roleRow.CanContribute,
                });
            }
        }

        const memberships: MemberSnapshot[] = memberRows.map((row) => ({
            spaceId: parseUuid(row.SpaceID) ?? row.SpaceID,
            userId: parseUuid(row.UserID) ?? row.UserID,
            status: 'Active',
            band: row.Band === 'Team' ? 'Team' : 'Shared',
            role: roleLookup.get((parseUuid(row.SpaceRoleTypeID) ?? '').toLowerCase()) ?? emptyRole(),
        }));

        const spaceChat: ChatWriteSpaceChatSummary = {
            id: chatRow.ID,
            spaceId,
            kind: chatRow.Kind,
            status: chatRow.Status,
            ownerUserId: chatRow.OwnerUserID ?? null,
        };

        return evaluateSpaceChatWriteRules({
            callerUserId: callerId,
            operation: context.Operation,
            spaceId,
            spaceChat,
            spaces: spaceNodes,
            memberships,
            policyChain,
            driverValidated,
            detailAuthorUserId: context.ConversationDetail?.UserID ?? null,
            detailRole: context.ConversationDetail?.Role ?? null,
            isServerAuthoredReply: context.IsServerAuthoredReply,
        });
    }
}

let hostRegistered = false;

/**
 * Registers `CollaborationChatWritePermissionProvider` into `@memberjunction/core-entities-server`'s
 * `ConversationDetailWritePermissionRegistry` when available in the host runtime.
 * Safe no-op when running against older MJ packages without pluggable write providers.
 */
export function RegisterCollaborationChatWritePermissionProvider(): boolean {
    if (hostRegistered) {
        return true;
    }
    try {
        const localRequire = createRequire(import.meta.url);
        let mod: CoreEntitiesServerModuleLike | null = null;
        try {
            mod = localRequire('@memberjunction/core-entities-server') as CoreEntitiesServerModuleLike;
        } catch {
            try {
                const mjServerEntry = localRequire.resolve('@memberjunction/server');
                const mjServerRequire = createRequire(mjServerEntry);
                mod = mjServerRequire('@memberjunction/core-entities-server') as CoreEntitiesServerModuleLike;
            } catch {
                mod = null;
            }
        }
        const registry = mod?.ConversationDetailWritePermissionRegistry?.Instance;
        if (!registry || typeof registry.Register !== 'function') {
            return false;
        }
        const instance = CollaborationChatWritePermissionProvider.Instance;
        registry.Register(
            'collaboration-space-chat',
            {
                Priority: instance.Priority,
                EvaluateWritePermission: (ctx: ChatWritePermissionContext) => instance.EvaluateWritePermission(ctx),
            },
            instance.Priority,
        );
        hostRegistered = true;
        return true;
    } catch {
        return false;
    }
}

export function ResetCollaborationChatWritePermissionRegistrationForTests(): void {
    hostRegistered = false;
}

export function LoadCollaborationChatWritePermissionProvider(): void {
    void CollaborationChatWritePermissionProvider;
    RegisterCollaborationChatWritePermissionProvider();
}
