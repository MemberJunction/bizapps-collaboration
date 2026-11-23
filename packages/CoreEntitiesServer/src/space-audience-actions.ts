/**
 * CA-1 Standard `SupportsAudience` Space Actions (`@RegisterClass(BaseAction, ...)`):
 * - ProposeSpaceAudienceOutputAction (`Collaboration: Propose Audience Output`)
 * - PromoteSpaceDraftToSharedAction (`Collaboration: Promote Draft To Shared`)
 * - PublishSpaceSharedUpdateAction (`Collaboration: Publish Shared Space Update`)
 * - ManageSpaceDocAction (`Collaboration: Manage Space Document`)
 *
 * Every action declares `SupportsAudience = true` and a strict `SupportsAudienceContract`,
 * enforces hidden server-bound parameters (rejecting caller/LLM spoofing), evaluates
 * audience/band rules fail-closed, and executes outbound/Shared actions under the resolved
 * per-root delivery principal (CA-4).
 */
import { BaseAction } from '@memberjunction/actions';
import {
    type ActionParam,
    type ActionResultSimple,
    type RunActionParams,
} from '@memberjunction/actions-base';
import { type IMetadataProvider, Metadata, RunView, type UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    type Band,
    type BoundParamValuesMap,
    enforceBoundActionParameters,
    membershipReaches,
    spaceIsReadOnly,
} from '@mj-biz-apps/collaboration-core';
import {
    createSpaceDraftApprovalTask,
    decideAndPromoteSpaceDraft,
} from './approval-promotion.js';
import { CollaborationChatWritePermissionProvider } from './chat-write-permission-provider.js';
import { CollaborationEngine } from './CollaborationEngine.js';
import { resolvePerRootDeliveryPrincipal } from './delivery-principal.js';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { postSpaceMessage } from './post-space-message.js';
import {
    createSpaceDoc,
    getSpaceDoc,
    listSpaceDocs,
    promoteSpaceDocToShared,
    updateSpaceDoc,
} from './space-docs.js';
import { parseUuid } from './uuid.js';

export const PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION = 'Collaboration: Propose Audience Output';
export const PROMOTE_SPACE_DRAFT_TO_SHARED_ACTION = 'Collaboration: Promote Draft To Shared';
export const PUBLISH_SPACE_SHARED_UPDATE_ACTION = 'Collaboration: Publish Shared Space Update';
export const MANAGE_SPACE_DOC_ACTION = 'Collaboration: Manage Space Document';

/** Structural audience-contract types matching MJ's `SupportsAudienceContract` so compilation works against both 6.3.0-edge.1 and next. */
export type SpaceActionAudienceMode = 'Caller' | 'Intersection' | 'ScopeCommonReach';

export interface SpaceHiddenScopeParamSpec {
    ParamName: string;
    Source: 'RunScope.PrimaryScopeRecordID' | 'ExplicitServerBinding';
    Required?: boolean;
    OverridePolicy?: 'Reject' | 'StripAndInject';
}

export interface SpaceActionAudienceContract {
    SupportsAudience: boolean;
    SupportedModes?: SpaceActionAudienceMode[];
    HiddenScopeParams?: SpaceHiddenScopeParamSpec[];
}

export type SpaceServerBoundScopeValue = string | number | boolean | null;
export type SpaceServerBoundScopeMap = Record<string, SpaceServerBoundScopeValue>;
export type SpaceRunActionParams = RunActionParams & {
    ServerBoundScopeParams?: SpaceServerBoundScopeMap;
};

function extractParamString(params: ActionParam[], name: string): string | null {
    const raw = params.find((p) => p.Name.trim().toLowerCase() === name.trim().toLowerCase())?.Value;
    if (raw === null || raw === undefined) return null;
    const str = String(raw).trim();
    return str === '' ? null : str;
}

function setOutput(params: ActionParam[], name: string, value: string | number | boolean | null | object): void {
    const existing = params.find((p) => p.Name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) {
        existing.Value = value;
        return;
    }
    params.push({ Name: name, Type: 'Output', Value: value });
}

function validateBoundHiddenParamsForDirectCall(
    params: RunActionParams,
    actionName: string,
    hiddenNames: readonly string[],
): { ok: true; boundValues: Record<string, string | null> } | { ok: false; result: ActionResultSimple } {
    const callerArgs: BoundParamValuesMap = {};
    const serverBound: BoundParamValuesMap = {};
    const resolved: Record<string, string | null> = {};

    const scopeMap = (params as SpaceRunActionParams).ServerBoundScopeParams ?? {};
    const hasServerBoundScopeMap = Object.keys(scopeMap).length > 0;
    const hasAuthoritativeRunScope = params.RunScope !== undefined && params.RunScope !== null;

    for (const hName of hiddenNames) {
        const scopeEntry = Object.entries(scopeMap).find(
            ([k]) => k.trim().toLowerCase() === hName.trim().toLowerCase(),
        );
        if (scopeEntry && scopeEntry[1] !== undefined) {
            const val = scopeEntry[1] === null ? null : String(scopeEntry[1]);
            serverBound[hName] = val;
            resolved[hName] = val;
        }
    }

    // Check hidden input params: accept params marked Bound: true, or injected by an MJ AgentRunner
    // run (RunScope present and no separate ServerBoundScopeParams override) when ActionParam.Bound
    // is omitted by the host runner. Reject explicit Bound: false or un-Bound direct-call args.
    for (const p of params.Params) {
        if (p.Type !== 'Input' && p.Type !== 'Both') continue;
        const canonicalName = hiddenNames.find((h) => h.toLowerCase() === p.Name.trim().toLowerCase());
        if (!canonicalName) continue;

        const isServerInjected =
            p.Bound === true ||
            (p.Bound !== false && hasAuthoritativeRunScope && !hasServerBoundScopeMap);

        if (isServerInjected && p.Value !== undefined && p.Value !== null) {
            if (!(canonicalName in serverBound)) {
                const valStr = String(p.Value);
                serverBound[canonicalName] = valStr;
                resolved[canonicalName] = valStr;
            }
        } else if (p.Value !== undefined) {
            callerArgs[canonicalName] =
                typeof p.Value === 'string' || typeof p.Value === 'number' || typeof p.Value === 'boolean' || p.Value === null
                    ? p.Value
                    : String(p.Value);
        }
    }

    const enforcement = enforceBoundActionParameters({
        actionName,
        callerArgs,
        serverBoundValues: serverBound,
        allParams: hiddenNames.map((n) => ({ Name: n, Type: 'Input', IsRequired: false })),
        extraHiddenParamNames: hiddenNames,
        overridePolicy: 'Reject',
    });

    if (!enforcement.allowed) {
        return {
            ok: false,
            result: {
                Success: false,
                ResultCode: enforcement.resultCode,
                Message: enforcement.message,
            },
        };
    }

    return { ok: true, boundValues: resolved };
}

async function verifyAudienceReadersReach(
    provider: IMetadataProvider,
    spaceId: string,
    requiredBand: Band,
    readers: readonly UserInfo[] | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!readers || readers.length === 0) return { ok: true };
    const probe = await provider.GetEntityObject('MJ_BizApps_Collaboration: Spaces', readers[0]);
    for (const reader of readers) {
        const rid = parseUuid(reader?.ID);
        if (!rid) return { ok: false, message: 'Audience validation failed: invalid reader UserID.' };
        const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(reader, provider);
        if (isAdmin) continue;
        const ctx = await loadWriteContext(probe, reader, spaceId, null);
        const reach = membershipReaches(ctx.spaces, ctx.memberships, rid, spaceId);
        if (!reach) {
            return { ok: false, message: `Audience validation failed: reader ${reader.ID} does not reach space ${spaceId}.` };
        }
        if (requiredBand === 'Team' && !reach.role.canSeeTeamBand) {
            return {
                ok: false,
                message: `Audience validation failed: reader ${reader.ID} lacks Team-band clearance for Team action.`,
            };
        }
    }
    return { ok: true };
}

/**
 * CA-1 / CA-2 / CA-3: Proposes a Team-band draft communication/document and creates a linked
 * Team-private `@mj-biz-apps/tasks-entities` approval Task + TaskLinks.
 */
@RegisterClass(BaseAction, PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION)
export class ProposeSpaceAudienceOutputAction extends BaseAction {
    public get SupportsAudience(): boolean {
        return true;
    }

    public get AudienceContract(): SpaceActionAudienceContract {
        return {
            SupportsAudience: true,
            SupportedModes: ['Intersection', 'ScopeCommonReach'],
            HiddenScopeParams: [
                { ParamName: 'SpaceID', Source: 'RunScope.PrimaryScopeRecordID', Required: true, OverridePolicy: 'Reject' },
                { ParamName: 'RootEntityID', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
                { ParamName: 'RootRecordID', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
                { ParamName: 'Band', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
                { ParamName: 'DeliveryPrincipalID', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
            ],
        };
    }

    protected override async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        const user = params.ContextUser;
        if (!user) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'ContextUser is required.' };
        }

        const boundCheck = validateBoundHiddenParamsForDirectCall(params, PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION, [
            'SpaceID',
            'RootEntityID',
            'RootRecordID',
            'Band',
            'DeliveryPrincipalID',
        ]);
        if (!boundCheck.ok) return boundCheck.result;

        const spaceId =
            parseUuid(boundCheck.boundValues['SpaceID']) ??
            parseUuid((params.Context as { spaceId?: string } | undefined)?.spaceId);
        if (!spaceId) {
            return {
                Success: false,
                ResultCode: 'SERVER_BOUND_SCOPE_MISSING',
                Message: 'ProposeSpaceAudienceOutputAction requires a server-bound SpaceID.',
            };
        }

        const requestedBand = boundCheck.boundValues['Band'];
        if (requestedBand && requestedBand !== 'Team') {
            return {
                Success: false,
                ResultCode: 'BAND_VIOLATION',
                Message: 'Unapproved audience output drafts must remain on the Team band until promoted via approval task.',
            };
        }

        const title = extractParamString(params.Params, 'Title');
        const content = extractParamString(params.Params, 'Content');
        const folder = extractParamString(params.Params, 'Folder');
        const parentTaskId = extractParamString(params.Params, 'ParentTaskID');
        if (!title || !content) {
            return {
                Success: false,
                ResultCode: 'VALIDATION_ERROR',
                Message: 'Title and Content are required parameters.',
            };
        }

        const provider = params.Provider ?? Metadata.Provider;
        const audienceCheck = await verifyAudienceReadersReach(
            provider,
            spaceId,
            'Team',
            params.Audience?.Readers,
        );
        if (!audienceCheck.ok) {
            return { Success: false, ResultCode: 'AUDIENCE_VALIDATION_FAILED', Message: audienceCheck.message };
        }

        const outcome = await createSpaceDraftApprovalTask({
            provider,
            callerUser: user,
            spaceId,
            title,
            content,
            parentTaskId,
            rootEntityId: boundCheck.boundValues['RootEntityID'],
            rootRecordId: boundCheck.boundValues['RootRecordID'],
            folder,
        });

        if (!outcome.ok) {
            return { Success: false, ResultCode: outcome.code, Message: outcome.message };
        }

        setOutput(params.Params, 'TaskID', outcome.data.taskId);
        setOutput(params.Params, 'DraftSpaceItemID', outcome.data.draftSpaceItemId);
        setOutput(params.Params, 'DraftArtifactID', outcome.data.draftArtifactId);
        setOutput(params.Params, 'Band', outcome.data.band);
        return {
            Success: true,
            ResultCode: 'SUCCESS',
            Message: `Created Team-band draft and approval Task ${outcome.data.taskId} in space ${spaceId}.`,
        };
    }
}

/**
 * CA-1 / CA-2 / CA-3 / CA-4: Approves (or rejects) an `APPROVAL_REQUEST` Task and atomically
 * promotes the linked Team-band draft to the Shared band under the per-root delivery principal.
 */
@RegisterClass(BaseAction, PROMOTE_SPACE_DRAFT_TO_SHARED_ACTION)
export class PromoteSpaceDraftToSharedAction extends BaseAction {
    public get SupportsAudience(): boolean {
        return true;
    }

    public get AudienceContract(): SpaceActionAudienceContract {
        return {
            SupportsAudience: true,
            SupportedModes: ['Intersection', 'ScopeCommonReach'],
            HiddenScopeParams: [
                { ParamName: 'SpaceID', Source: 'RunScope.PrimaryScopeRecordID', Required: true, OverridePolicy: 'Reject' },
                { ParamName: 'DeliveryPrincipalID', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
            ],
        };
    }

    protected override async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        const user = params.ContextUser;
        if (!user) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'ContextUser is required.' };
        }

        const boundCheck = validateBoundHiddenParamsForDirectCall(params, PROMOTE_SPACE_DRAFT_TO_SHARED_ACTION, [
            'SpaceID',
            'DeliveryPrincipalID',
        ]);
        if (!boundCheck.ok) return boundCheck.result;

        const spaceId =
            parseUuid(boundCheck.boundValues['SpaceID']) ??
            parseUuid((params.Context as { spaceId?: string } | undefined)?.spaceId);
        const taskId = parseUuid(extractParamString(params.Params, 'TaskID'));
        const decisionRaw = extractParamString(params.Params, 'Decision') ?? 'Approved';
        const decision = decisionRaw === 'Rejected' ? 'Rejected' : decisionRaw === 'Approved' ? 'Approved' : null;
        if (!spaceId || !taskId || !decision) {
            return {
                Success: false,
                ResultCode: 'VALIDATION_ERROR',
                Message: 'Valid server-bound SpaceID, TaskID, and Decision (Approved | Rejected) are required.',
            };
        }

        const provider = params.Provider ?? Metadata.Provider;
        const audienceCheck = await verifyAudienceReadersReach(provider, spaceId, 'Team', params.Audience?.Readers);
        if (!audienceCheck.ok) {
            return { Success: false, ResultCode: 'AUDIENCE_VALIDATION_FAILED', Message: audienceCheck.message };
        }

        const outcome = await decideAndPromoteSpaceDraft({
            provider,
            approverUser: user,
            spaceId,
            taskId,
            decision,
            decisionNotes: extractParamString(params.Params, 'DecisionNotes') ?? undefined,
        });
        if (!outcome.ok) {
            return { Success: false, ResultCode: outcome.code, Message: outcome.message };
        }

        setOutput(params.Params, 'TaskID', outcome.data.taskId);
        setOutput(params.Params, 'DraftSpaceItemID', outcome.data.draftSpaceItemId);
        setOutput(params.Params, 'Band', outcome.data.band);
        setOutput(params.Params, 'DeliveryPrincipalUserID', outcome.data.promotedByPrincipalUserId ?? null);
        return {
            Success: true,
            ResultCode: 'SUCCESS',
            Message:
                decision === 'Approved'
                    ? `Promoted draft ${outcome.data.draftSpaceItemId} to Shared under principal ${outcome.data.promotedByPrincipalUserId}.`
                    : `Rejected draft promotion task ${outcome.data.taskId}; draft remains private on Team band.`,
        };
    }
}

/**
 * CA-1 & CA-4: Publishes a Shared-band audience message into a Space's General/Topic conversation
 * attributed to the resolved per-root delivery principal after verifying CS-3 chat write rules
 * and audience reach (fail-closed).
 */
@RegisterClass(BaseAction, PUBLISH_SPACE_SHARED_UPDATE_ACTION)
export class PublishSpaceSharedUpdateAction extends BaseAction {
    public get SupportsAudience(): boolean {
        return true;
    }

    public get AudienceContract(): SpaceActionAudienceContract {
        return {
            SupportsAudience: true,
            SupportedModes: ['Intersection', 'ScopeCommonReach'],
            HiddenScopeParams: [
                { ParamName: 'SpaceID', Source: 'RunScope.PrimaryScopeRecordID', Required: true, OverridePolicy: 'Reject' },
                { ParamName: 'Band', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
                { ParamName: 'DeliveryPrincipalID', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
            ],
        };
    }

    protected override async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        const user = params.ContextUser;
        if (!user) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'ContextUser is required.' };
        }

        const boundCheck = validateBoundHiddenParamsForDirectCall(params, PUBLISH_SPACE_SHARED_UPDATE_ACTION, [
            'SpaceID',
            'Band',
            'DeliveryPrincipalID',
        ]);
        if (!boundCheck.ok) return boundCheck.result;

        const spaceId =
            parseUuid(boundCheck.boundValues['SpaceID']) ??
            parseUuid((params.Context as { spaceId?: string } | undefined)?.spaceId);
        const messageText = extractParamString(params.Params, 'Message');
        const conversationId = extractParamString(params.Params, 'ConversationID');
        if (!spaceId || !messageText) {
            return {
                Success: false,
                ResultCode: 'VALIDATION_ERROR',
                Message: 'Valid server-bound SpaceID and Message are required.',
            };
        }

        const provider = params.Provider ?? Metadata.Provider;
        const audienceCheck = await verifyAudienceReadersReach(provider, spaceId, 'Shared', params.Audience?.Readers);
        if (!audienceCheck.ok) {
            return { Success: false, ResultCode: 'AUDIENCE_VALIDATION_FAILED', Message: audienceCheck.message };
        }

        const probe = await provider.GetEntityObject('MJ_BizApps_Collaboration: Spaces', user);
        const system = await requireSystemUser(probe);
        const principalOutcome = await resolvePerRootDeliveryPrincipal({
            provider,
            systemUser: system,
            spaceId,
        });
        if (!principalOutcome.ok) {
            return { Success: false, ResultCode: 'MISSING_PRINCIPAL', Message: principalOutcome.message };
        }

        // Verify caller has promote/publish authority on the space
        const callerId = parseUuid(user.ID);
        if (!callerId) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'Invalid caller ID.' };
        }
        const writeContext = await loadWriteContext(probe, user, spaceId, null);
        const spaceNode = writeContext.spaces.find((s) => s.id.toLowerCase() === spaceId.toLowerCase());
        if (!spaceNode || spaceIsReadOnly(spaceNode)) {
            return { Success: false, ResultCode: 'READ_ONLY', Message: 'Space is not found or is read-only.' };
        }
        const isAdmin = CollaborationEngine.Instance.UserMayAdministerSpaces(user, provider);
        const reach = membershipReaches(writeContext.spaces, writeContext.memberships, callerId, spaceId);
        if (!isAdmin && !reach?.role.canPromoteBand && spaceNode.ownerId.toLowerCase() !== callerId.toLowerCase()) {
            return {
                Success: false,
                ResultCode: 'UNAUTHORIZED',
                Message: 'Publish refused: caller lacks CanPromoteBand or owner authority for Shared updates.',
            };
        }

        // Verify per-root delivery principal also satisfies CS-3 rule-based chat write check when conversationId is provided
        if (conversationId) {
            const parsedConversationId = parseUuid(conversationId);
            if (!parsedConversationId) {
                return { Success: false, ResultCode: 'VALIDATION_ERROR', Message: 'Valid ConversationID is required.' };
            }
            const rv = RunView.FromMetadataProvider(provider);
            const chatRes = await rv.RunView<{ ID: string; Kind: string; Status: string; OwnerUserID?: string | null }>(
                {
                    EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                    ExtraFilter: `SpaceID = '${spaceId}' AND ConversationID = '${parsedConversationId}'`,
                    Fields: ['ID', 'Kind', 'Status', 'OwnerUserID'],
                    ResultType: 'simple',
                    MaxRows: 1,
                },
                system,
            );
            const chat = chatRes.Success ? chatRes.Results?.[0] : undefined;
            if (!chat) {
                return { Success: false, ResultCode: 'NOT_FOUND', Message: 'Target Space Chat was not found.' };
            }
            const writeVerdict = await CollaborationChatWritePermissionProvider.Instance.EvaluateWritePermission({
                Provider: provider,
                ContextUser: principalOutcome.principalUser,
                Operation: 'create',
                ConversationID: parsedConversationId,
            });
            if (writeVerdict.Decision === 'Deny') {
                return { Success: false, ResultCode: 'UNAUTHORIZED', Message: writeVerdict.Reason };
            }
            if (writeVerdict.Decision !== 'Allow') {
                return {
                    Success: false,
                    ResultCode: 'UNAUTHORIZED',
                    Message: 'Publish refused: chat write permission check did not allow write.',
                };
            }
        }

        // Attribute delivery strictly to the per-root delivery principal (CA-4)
        const postResult = await postSpaceMessage(provider, principalOutcome.principalUser, {
            spaceId,
            text: messageText,
            conversationId: conversationId ?? undefined,
        });
        if (!postResult.ok) {
            return { Success: false, ResultCode: 'FAILED', Message: postResult.message };
        }

        setOutput(params.Params, 'DetailID', postResult.detailId);
        setOutput(params.Params, 'DeliveryPrincipalUserID', principalOutcome.principalUserId);
        return {
            Success: true,
            ResultCode: 'SUCCESS',
            Message: `Published Shared update (${postResult.detailId}) under per-root delivery principal ${principalOutcome.principalUserId}.`,
        };
    }
}

/**
 * CA-1 & CX-13: Standard `SupportsAudience` action for MJ Docs CRUD and Team->Shared promotion
 * inside subtyped spaces with strict Team vs. Shared band isolation.
 */
@RegisterClass(BaseAction, MANAGE_SPACE_DOC_ACTION)
export class ManageSpaceDocAction extends BaseAction {
    public get SupportsAudience(): boolean {
        return true;
    }

    public get AudienceContract(): SpaceActionAudienceContract {
        return {
            SupportsAudience: true,
            SupportedModes: ['Intersection', 'ScopeCommonReach'],
            HiddenScopeParams: [
                { ParamName: 'SpaceID', Source: 'RunScope.PrimaryScopeRecordID', Required: true, OverridePolicy: 'Reject' },
                { ParamName: 'Band', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
                { ParamName: 'DeliveryPrincipalID', Source: 'ExplicitServerBinding', Required: false, OverridePolicy: 'Reject' },
            ],
        };
    }

    protected override async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        const user = params.ContextUser;
        if (!user) {
            return { Success: false, ResultCode: 'UNAUTHORIZED', Message: 'ContextUser is required.' };
        }

        const boundCheck = validateBoundHiddenParamsForDirectCall(params, MANAGE_SPACE_DOC_ACTION, [
            'SpaceID',
            'Band',
            'DeliveryPrincipalID',
        ]);
        if (!boundCheck.ok) return boundCheck.result;

        const spaceId =
            parseUuid(boundCheck.boundValues['SpaceID']) ??
            parseUuid((params.Context as { spaceId?: string } | undefined)?.spaceId);
        if (!spaceId) {
            return {
                Success: false,
                ResultCode: 'SERVER_BOUND_SCOPE_MISSING',
                Message: 'ManageSpaceDocAction requires a server-bound SpaceID.',
            };
        }

        const operation = (extractParamString(params.Params, 'Operation') ?? 'list').toLowerCase();
        const boundBand = boundCheck.boundValues['Band'] as Band | null;
        const effectiveBand: Band = boundBand === 'Team' || boundBand === 'Shared' ? boundBand : 'Shared';
        const provider = params.Provider ?? Metadata.Provider;

        const audienceCheck = await verifyAudienceReadersReach(
            provider,
            spaceId,
            effectiveBand,
            params.Audience?.Readers,
        );
        if (!audienceCheck.ok) {
            return { Success: false, ResultCode: 'AUDIENCE_VALIDATION_FAILED', Message: audienceCheck.message };
        }

        if (operation === 'create') {
            const title = extractParamString(params.Params, 'Title');
            const content = extractParamString(params.Params, 'Content') ?? '';
            if (!title) {
                return { Success: false, ResultCode: 'VALIDATION_ERROR', Message: 'Title is required for create.' };
            }
            const res = await createSpaceDoc({
                provider,
                callerUser: user,
                spaceId,
                title,
                content,
                band: effectiveBand,
                folder: extractParamString(params.Params, 'Folder'),
            });
            if (!res.ok) return { Success: false, ResultCode: res.code, Message: res.message };
            setOutput(params.Params, 'SpaceItemID', res.data.spaceItemId);
            setOutput(params.Params, 'ArtifactID', res.data.artifactId);
            setOutput(params.Params, 'VersionID', res.data.versionId);
            setOutput(params.Params, 'Band', res.data.band);
            return { Success: true, ResultCode: 'SUCCESS', Message: `Created ${res.data.band} doc "${res.data.title}".` };
        }

        if (operation === 'get') {
            const res = await getSpaceDoc({
                provider,
                callerUser: user,
                spaceId,
                spaceItemId: extractParamString(params.Params, 'SpaceItemID') ?? undefined,
                artifactId: extractParamString(params.Params, 'ArtifactID') ?? undefined,
            });
            if (!res.ok) return { Success: false, ResultCode: res.code, Message: res.message };
            setOutput(params.Params, 'Document', res.data);
            return { Success: true, ResultCode: 'SUCCESS', Message: `Loaded ${res.data.band} doc "${res.data.title}".` };
        }

        if (operation === 'update') {
            const spaceItemId = extractParamString(params.Params, 'SpaceItemID');
            const content = extractParamString(params.Params, 'Content');
            if (!spaceItemId || content === null) {
                return { Success: false, ResultCode: 'VALIDATION_ERROR', Message: 'SpaceItemID and Content are required for update.' };
            }
            const res = await updateSpaceDoc({
                provider,
                callerUser: user,
                spaceId,
                spaceItemId,
                content,
                title: extractParamString(params.Params, 'Title') ?? undefined,
            });
            if (!res.ok) return { Success: false, ResultCode: res.code, Message: res.message };
            setOutput(params.Params, 'VersionID', res.data.versionId);
            setOutput(params.Params, 'VersionNumber', res.data.versionNumber);
            return { Success: true, ResultCode: 'SUCCESS', Message: `Updated doc to version ${res.data.versionNumber}.` };
        }

        if (operation === 'promote') {
            const spaceItemId = extractParamString(params.Params, 'SpaceItemID');
            if (!spaceItemId) {
                return { Success: false, ResultCode: 'VALIDATION_ERROR', Message: 'SpaceItemID is required for promote.' };
            }
            const res = await promoteSpaceDocToShared({
                provider,
                callerUser: user,
                spaceId,
                spaceItemId,
            });
            if (!res.ok) return { Success: false, ResultCode: res.code, Message: res.message };
            setOutput(params.Params, 'Band', res.data.band);
            setOutput(params.Params, 'PromotedByUserID', res.data.promotedByUserId);
            return { Success: true, ResultCode: 'SUCCESS', Message: `Promoted doc ${res.data.spaceItemId} to Shared.` };
        }

        const listRes = await listSpaceDocs({
            provider,
            callerUser: user,
            spaceId,
            requestedBand: boundBand ?? undefined,
        });
        if (!listRes.ok) return { Success: false, ResultCode: listRes.code, Message: listRes.message };
        setOutput(params.Params, 'Documents', listRes.data);
        return { Success: true, ResultCode: 'SUCCESS', Message: `Listed ${listRes.data.length} document(s).` };
    }
}

export function LoadSpaceAudienceActions(): void {
    void ProposeSpaceAudienceOutputAction;
    void PromoteSpaceDraftToSharedAction;
    void PublishSpaceSharedUpdateAction;
    void ManageSpaceDocAction;
}
