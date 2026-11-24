/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Round-2 Collaboration v1 Substrate Live SQL Server Integration Checks:
 *   - R2_1: Rule-based chat write permissions (`CollaborationChatWritePermissionProvider`)
 *   - R2_2: Dual-dialect `StructuralChatScope` (`fnCollaborationChatScope` live TVF)
 *   - R2_3: Hierarchical Scoped Prompt Parts (`SpaceType -> Root -> Space` + band isolation)
 *   - R2_4: `SupportsAudience` server-bound agent action grants & anti-spoofing enforcement
 *   - R2_5: Fan-out-on-read `Space Notices` & per-persona watermarks
 *   - R2_6: Comms v2 notification routing & reach-verified scoped digests
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { BaseAction } from '@memberjunction/actions';
import { type ActionParam, type ActionResultSimple } from '@memberjunction/actions-base';
import { MJGlobal } from '@memberjunction/global';
import { type MJActionEntity, type MJActionParamEntity } from '@memberjunction/core-entities';
import { SHIPPED_STATUSES } from '@mj-biz-apps/collaboration-core';
import {
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceGrantEntity,
    type mjBizAppsCollaborationSpaceMemberEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
    type mjBizAppsCollaborationSpaceTypeStatusEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    CollaborationBoundActionGrantRegistry,
    CollaborationChatWritePermissionProvider,
    CollaborationEngine,
    createSpaceConversation,
    GetCollaborationCommsV2Transport,
    loadSpaceConfiguration,
    LoadSpaceAudienceActions,
    PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION,
    RegisterCollaborationCommsV2Transport,
    ResetCollaborationCommsV2Transport,
    resolveSpaceScopedPromptParts,
    resolveStructuralChatScope,
    runAdvanceSpaceNoticeWatermark,
    runGetSpaceNotices,
    runGetSpaceUnreadNoticeCounts,
    runPreviewScopedSpaceDigest,
    runPublishSpaceNoticeEvent,
    runRouteCollaborationNotifications,
    runRunScopedSpaceDigests,
    type CollaborationCommsV2Transport,
    type CommsV2TransportDispatchRequest,
    type SpaceRunActionParams,
} from '@mj-biz-apps/collaboration-core-entities-server';
import {
    ACTION_ENTITY,
    ACTION_PARAM_ENTITY,
    SPACE_ANCHOR_ENTITY,
    SPACE_CHAT_ENTITY,
    SPACE_DIGEST_CHECKPOINT_ENTITY,
    SPACE_ENTITY,
    SPACE_GRANT_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
    SPACE_NOTICE_WATERMARK_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    SPACE_TYPE_ENTITY,
    SPACE_TYPE_STATUS_ENTITY,
    TASK_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser, SameID } from '../wire.js';
import {
    NORTHSTAR_PHASE1_TASK_ID,
    NORTHSTAR_PROGRAM_TASK_ID,
    SOLSTICE_PROGRAM_TASK_ID,
} from '../world/enterprise-ids.js';
import { CHECK_SPACE_PREFIX } from '../world/ids.js';
import { cleanupSpace, cleanupStep, deleteWhere, registerChecks } from './cleanup-helpers.js';

const MARK = 'COLLAB-CHECK r2';

async function resolveEnterpriseSpaceId(ctx: IntegrationCheckContext, taskRecordId: string, label: string): Promise<string> {
    const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
    Assert(!!taskEntity, 'Task entity metadata exists');
    const anchors = await FindRows<{ SpaceID: string }>(
        ctx,
        SPACE_ANCHOR_ENTITY,
        `EntityID = '${taskEntity!.ID}' AND (RecordID = '${taskRecordId}' OR RecordID = 'ID|${taskRecordId}') AND IsPrimary = 1`,
        ['SpaceID'],
        undefined,
        { BypassCache: true },
    );
    Assert(anchors.length === 1, `Expected 1 primary anchor for ${label}`);
    return anchors[0].SpaceID;
}

async function createConfigurableTestSpaceType(
    ctx: IntegrationCheckContext,
    code: string,
    name: string,
    configuration: Record<string, object | string | number | boolean | null>,
): Promise<string> {
    const st = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, ctx.User);
    st.NewRecord();
    st.Code = code;
    st.Name = name;
    st.Vocabulary = 'policy space';
    st.InviteApproval = 'AutoApprove';
    st.Configuration = JSON.stringify(configuration);
    Assert(await st.Save() && !!st.ID, `Create configurable SpaceType ${code} failed: ${st.LatestResult?.CompleteMessage ?? ''}`);

    for (const shipped of SHIPPED_STATUSES) {
        const statusRow = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeStatusEntity>(
            SPACE_TYPE_STATUS_ENTITY,
            ctx.User,
        );
        statusRow.NewRecord();
        statusRow.SpaceTypeID = st.ID;
        statusRow.Code = shipped.Code;
        statusRow.Name = shipped.Name;
        statusRow.Sequence = shipped.Sequence;
        statusRow.IsDefault = shipped.IsDefault;
        statusRow.ReadOnly = shipped.ReadOnly;
        statusRow.Visible = shipped.Visible;
        statusRow.AgentRetrieval = shipped.AgentRetrieval;
        statusRow.CanChangeAfter = shipped.CanChangeAfter;
        statusRow.NotifyMembersOnEnter = shipped.NotifyMembersOnEnter;
        statusRow.IsTerminal = shipped.IsTerminal;
        Assert(await statusRow.Save(), `Save SpaceTypeStatus ${shipped.Code} for ${code} failed`);
    }
    await CollaborationEngine.Instance.Config(true, ctx.User, ctx.Provider);
    return st.ID;
}

async function cleanupConfigurableTestSpaceType(ctx: IntegrationCheckContext, typeId: string | null): Promise<void> {
    if (!typeId) return;
    await deleteWhere(ctx.Provider, ctx.User, SPACE_TYPE_STATUS_ENTITY, `SpaceTypeID = '${typeId}' AND IsDefault = 0`, 'configurable test space type non-default statuses');
    await deleteWhere(ctx.Provider, ctx.User, SPACE_TYPE_STATUS_ENTITY, `SpaceTypeID = '${typeId}' AND IsDefault = 1`, 'configurable test space type default status');
    await deleteWhere(ctx.Provider, ctx.User, SPACE_TYPE_ENTITY, `ID = '${typeId}'`, 'configurable test space type');
    await cleanupStep(() => CollaborationEngine.Instance.Config(true, ctx.User, ctx.Provider));
}

const checks: NamedCheck[] = [
    {
        Id: 'round2-substrate.R2_1',
        Name: 'R2_1 — CollaborationChatWritePermissionProvider enforces band rules, non-loosening Chats.WhoCanWrite policies, and Paused read-only lockdown',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');
            const bea = await GetPersonaUser(ctx, 'bea');
            const harper = await GetPersonaUser(ctx, 'harper');
            const dev = await GetPersonaUser(ctx, 'dev');

            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const [generalChat] = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}' AND Kind = 'General'`,
                ['ConversationID'],
                undefined,
                { BypassCache: true },
            );
            const [privateChat] = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}' AND Kind = 'Private'`,
                ['ConversationID'],
                undefined,
                { BypassCache: true },
            );
            Assert(!!generalChat && !!privateChat, 'Northstar Hub General and Private chats exist');

            const provider = CollaborationChatWritePermissionProvider.Instance;

            // Active Northstar Hub: Ada & Sam allowed on General and Private; Bea allowed on General, denied on Private; Harper denied on both
            const adaGeneral = await provider.EvaluateWritePermission({
                Provider: ctx.Provider,
                ContextUser: ada,
                Operation: 'create',
                ConversationID: generalChat.ConversationID,
            });
            Assert(adaGeneral.Decision === 'Allow', `Ada allowed on General: ${JSON.stringify(adaGeneral)}`);

            const samPrivate = await provider.EvaluateWritePermission({
                Provider: ctx.Provider,
                ContextUser: sam,
                Operation: 'create',
                ConversationID: privateChat.ConversationID,
            });
            Assert(samPrivate.Decision === 'Allow', `Sam allowed on Private: ${JSON.stringify(samPrivate)}`);

            const beaGeneral = await provider.EvaluateWritePermission({
                Provider: ctx.Provider,
                ContextUser: bea,
                Operation: 'create',
                ConversationID: generalChat.ConversationID,
            });
            Assert(beaGeneral.Decision === 'Allow', `Client A Bea allowed on General: ${JSON.stringify(beaGeneral)}`);

            const beaPrivate = await provider.EvaluateWritePermission({
                Provider: ctx.Provider,
                ContextUser: bea,
                Operation: 'create',
                ConversationID: privateChat.ConversationID,
            });
            Assert(beaPrivate.Decision === 'Deny', `Client A Bea MUST be denied on Private Team chat: ${JSON.stringify(beaPrivate)}`);

            const harperGeneral = await provider.EvaluateWritePermission({
                Provider: ctx.Provider,
                ContextUser: harper,
                Operation: 'create',
                ConversationID: generalChat.ConversationID,
            });
            Assert(harperGeneral.Decision === 'Deny', `Rival Client B Harper MUST be denied on Northstar General chat: ${JSON.stringify(harperGeneral)}`);

            // Create a SpaceType permitting space-level Chats.WhoCanWrite tightening, create a space with TeamOnly, then pause it
            const [ownerRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            const [memberRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'member'", ['ID']);
            const [clientMemberRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'client-member'", ['ID']);
            Assert(!!ownerRole && !!memberRole && !!clientMemberRole, 'Space roles exist');

            let policyTypeId: string | null = null;
            let policySpaceId: string | null = null;
            try {
                policyTypeId = await createConfigurableTestSpaceType(
                    ctx,
                    `r2-1-policy-${Date.now()}`,
                    `${MARK} Chat Write Policy Type`,
                    {
                        Chats: { WhoCanWrite: 'Contributors' },
                        SpaceOverridable: ['Chats.WhoCanWrite'],
                    },
                );
                const [pausedStatus] = await FindRows<{ ID: string }>(
                    ctx,
                    SPACE_TYPE_STATUS_ENTITY,
                    `SpaceTypeID = '${policyTypeId}' AND Code = 'paused'`,
                    ['ID'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(!!pausedStatus, 'Policy SpaceType declares paused status');

                const policySpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                policySpace.NewRecord();
                policySpace.Name = `${CHECK_SPACE_PREFIX}R2_1 WritePolicy ${Date.now()}`;
                policySpace.SpaceTypeID = policyTypeId;
                policySpace.OwnerID = dev.ID;
                policySpace.InheritsMembership = false;
                policySpace.Configuration = JSON.stringify({ Chats: { WhoCanWrite: 'TeamOnly' } });
                Assert(await policySpace.Save() && !!policySpace.ID, `Save TeamOnly policy space failed: ${policySpace.LatestResult?.CompleteMessage ?? ''}`);
                policySpaceId = policySpace.ID;

                for (const seatSpec of [
                    { userId: dev.ID, roleId: ownerRole.ID, band: 'Team' as const },
                    { userId: sam.ID, roleId: memberRole.ID, band: 'Team' as const },
                    { userId: bea.ID, roleId: clientMemberRole.ID, band: 'Shared' as const },
                ]) {
                    const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, dev);
                    seat.NewRecord();
                    seat.SpaceID = policySpaceId;
                    seat.UserID = seatSpec.userId;
                    seat.SpaceRoleTypeID = seatSpec.roleId;
                    seat.Band = seatSpec.band;
                    seat.Status = 'Active';
                    Assert(await seat.Save(), `Seat user ${seatSpec.userId} on R2_1 space failed`);
                }

                const policyChat = await createSpaceConversation(ctx.Provider, dev, {
                    SpaceID: policySpaceId,
                    Name: `r2-1-general-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(policyChat.ok === true && !!policyChat.conversationId, `Create General chat in TeamOnly space: ${policyChat.ok ? '' : policyChat.message}`);
                if (!policyChat.ok || !policyChat.conversationId) throw new Error('missing conversation');

                // Under TeamOnly write rule, Shared-band Bea is DENIED even on General, while Team-band Sam is ALLOWED
                const beaTeamOnly = await provider.EvaluateWritePermission({
                    Provider: ctx.Provider,
                    ContextUser: bea,
                    Operation: 'create',
                    ConversationID: policyChat.conversationId,
                });
                Assert(beaTeamOnly.Decision === 'Deny', `TeamOnly policy MUST deny Shared-band Bea: ${JSON.stringify(beaTeamOnly)}`);

                const samTeamOnly = await provider.EvaluateWritePermission({
                    Provider: ctx.Provider,
                    ContextUser: sam,
                    Operation: 'create',
                    ConversationID: policyChat.conversationId,
                });
                Assert(samTeamOnly.Decision === 'Allow', `TeamOnly policy allows Team-band Sam: ${JSON.stringify(samTeamOnly)}`);

                // Pause space -> even owner Dev is DENIED writes on read-only space
                const toPause = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await toPause.Load(policySpaceId), 'Dev loads policy space');
                toPause.StatusID = pausedStatus.ID;
                Assert(await toPause.Save(), `Dev pauses policy space: ${toPause.LatestResult?.CompleteMessage ?? ''}`);

                const devPaused = await provider.EvaluateWritePermission({
                    Provider: ctx.Provider,
                    ContextUser: dev,
                    Operation: 'create',
                    ConversationID: policyChat.conversationId,
                });
                Assert(devPaused.Decision === 'Deny', `Paused space MUST deny writes even for owner: ${JSON.stringify(devPaused)}`);
            } finally {
                if (policySpaceId) {
                    await cleanupSpace(ctx.Provider, ctx.User, policySpaceId);
                }
                await cleanupConfigurableTestSpaceType(ctx, policyTypeId);
            }
        },
    },
    {
        Id: 'round2-substrate.R2_2',
        Name: 'R2_2 — StructuralChatScope (live SQL Server fnCollaborationChatScope TVF) returns chat-aware (SpaceID, Band) reach for Private, General, and Space anchors and fails closed',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const harper = await GetPersonaUser(ctx, 'harper');

            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const northstarPhase1Id = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PHASE1_TASK_ID, 'Northstar Phase 1');
            const solsticeHubId = await resolveEnterpriseSpaceId(ctx, SOLSTICE_PROGRAM_TASK_ID, 'Solstice Hub');

            const [privateChat] = await FindRows<{ ID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}' AND Kind = 'Private'`,
                ['ID'],
                undefined,
                { BypassCache: true },
            );
            const [generalChat] = await FindRows<{ ID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${northstarHubId}' AND Kind = 'General'`,
                ['ID'],
                undefined,
                { BypassCache: true },
            );
            Assert(!!privateChat && !!generalChat, 'Northstar Hub Private and General SpaceChats exist');

            // 1. Private SpaceChat anchor: Team owner Ada gets Team + Shared across Hub + Phase 1; Bea & Harper get 0 rows!
            const adaPrivateScope = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: privateChat.ID,
                userId: ada.ID,
                contextUser: ctx.User,
            });
            Assert(
                adaPrivateScope.pairs.some((r) => SameID(r.SpaceID, northstarHubId) && r.Band === 'Team') &&
                    adaPrivateScope.pairs.some((r) => SameID(r.SpaceID, northstarHubId) && r.Band === 'Shared') &&
                    adaPrivateScope.pairs.some((r) => SameID(r.SpaceID, northstarPhase1Id) && r.Band === 'Team'),
                `Ada Private chat scope includes Hub + Phase 1 across Team & Shared: ${JSON.stringify(adaPrivateScope.pairs)}`,
            );
            Assert(
                !adaPrivateScope.pairs.some((r) => SameID(r.SpaceID, solsticeHubId)),
                'Ada Private chat scope for Northstar NEVER includes Solstice Hub',
            );

            const beaPrivateScope = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: privateChat.ID,
                userId: bea.ID,
                contextUser: ctx.User,
            });
            Assert(beaPrivateScope.pairs.length === 0, `Client A Bea gets 0 rows for Private Team chat (got ${beaPrivateScope.pairs.length})`);

            // 2. General SpaceChat anchor: BOTH Ada and Bea are confined to Shared band ONLY (no Team leakage into Shared chat!)
            const adaGeneralScope = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: generalChat.ID,
                userId: ada.ID,
                contextUser: ctx.User,
            });
            Assert(
                adaGeneralScope.pairs.length >= 2 && adaGeneralScope.pairs.every((r) => r.Band === 'Shared'),
                `Ada on General chat is confined to Shared band only: ${JSON.stringify(adaGeneralScope.pairs)}`,
            );

            const beaGeneralScope = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: generalChat.ID,
                userId: bea.ID,
                contextUser: ctx.User,
            });
            Assert(
                beaGeneralScope.pairs.length >= 2 &&
                    beaGeneralScope.pairs.every((r) => r.Band === 'Shared') &&
                    !beaGeneralScope.pairs.some((r) => SameID(r.SpaceID, solsticeHubId)),
                `Bea on General chat reaches Hub + Phase 1 Shared only: ${JSON.stringify(beaGeneralScope.pairs)}`,
            );

            // 3. Raw SpaceID anchor: fails closed to Shared-only for seated members, 0 for rival Client B Harper
            const adaSpaceScope = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: northstarHubId,
                userId: ada.ID,
                contextUser: ctx.User,
            });
            Assert(
                adaSpaceScope.pairs.length >= 2 && adaSpaceScope.pairs.every((r) => r.Band === 'Shared'),
                `Raw SpaceID anchor fails closed to Shared band: ${JSON.stringify(adaSpaceScope.pairs)}`,
            );

            const harperScope = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: generalChat.ID,
                userId: harper.ID,
                contextUser: ctx.User,
            });
            Assert(harperScope.pairs.length === 0, `Rival Client B Harper gets 0 structural scope rows on Northstar (got ${harperScope.pairs.length})`);

            // 4. Invalid UUID fails closed
            const invalidScope = await resolveStructuralChatScope({
                provider: ctx.Provider,
                primaryScopeRecordId: 'not-a-valid-uuid',
                userId: ada.ID,
                contextUser: ctx.User,
            });
            Assert(invalidScope.pairs.length === 0, 'Malformed primaryScopeRecordId fails closed with 0 rows');
        },
    },
    {
        Id: 'round2-substrate.R2_3',
        Name: 'R2_3 — Hierarchical Scoped Prompt Parts merge across SpaceType -> Root -> Space with Override/Append semantics and strict Team/Shared audience isolation',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const dev = await GetPersonaUser(ctx, 'dev');
            const [ownerRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            Assert(!!ownerRole, 'Owner role exists');

            let promptTypeId: string | null = null;
            let rootSpaceId: string | null = null;
            let childSpaceId: string | null = null;

            try {
                // 3-tier hierarchy: SpaceType -> Root Space -> Child Space
                promptTypeId = await createConfigurableTestSpaceType(
                    ctx,
                    `r2-3-prompts-${Date.now()}`,
                    `${MARK} Scoped Prompt Parts Type`,
                    {
                        SpaceOverridable: ['PromptParts'],
                        PromptParts: [
                            {
                                Name: 'TypeBaseline',
                                Role: 'System',
                                Text: 'Type baseline: always cite verified enterprise records.',
                                Sort: 5,
                                Priority: 5,
                                MergeBehavior: 'Append',
                                Status: 'Active',
                                Band: 'Shared',
                            },
                            {
                                Name: 'EngagementTone',
                                Role: 'System',
                                Text: 'Type default tone: formal consulting cadence.',
                                Sort: 10,
                                Priority: 5,
                                MergeBehavior: 'Override',
                                Status: 'Active',
                                Band: 'Shared',
                            },
                        ],
                    },
                );

                const root = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                root.NewRecord();
                root.Name = `${CHECK_SPACE_PREFIX}R2_3 Root ${Date.now()}`;
                root.SpaceTypeID = promptTypeId;
                root.OwnerID = dev.ID;
                root.InheritsMembership = false;
                root.Configuration = JSON.stringify({
                    PromptParts: [
                        {
                            Name: 'EngagementTone',
                            Role: 'System',
                            Text: 'Root instruction: communicate with Northstar executive clarity.',
                            Sort: 10,
                            Priority: 10,
                            MergeBehavior: 'Override',
                            Status: 'Active',
                            Band: 'Shared',
                        },
                        {
                            Name: 'MarginGuardrail',
                            Role: 'System',
                            Text: 'TEAM-SECRET-MARGIN: protect 14% internal Meridian margin buffer.',
                            Sort: 20,
                            Priority: 10,
                            MergeBehavior: 'Append',
                            Status: 'Active',
                            Band: 'Team',
                        },
                    ],
                });
                Assert(await root.Save() && !!root.ID, `Save Root PromptParts space failed: ${root.LatestResult?.CompleteMessage ?? ''}`);
                rootSpaceId = root.ID;

                const devRootSeat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, dev);
                devRootSeat.NewRecord();
                devRootSeat.SpaceID = rootSpaceId;
                devRootSeat.UserID = dev.ID;
                devRootSeat.SpaceRoleTypeID = ownerRole.ID;
                devRootSeat.Band = 'Team';
                devRootSeat.Status = 'Active';
                Assert(await devRootSeat.Save(), 'Seat Dev on R2_3 Root space failed');

                const child = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                child.NewRecord();
                child.Name = `${CHECK_SPACE_PREFIX}R2_3 Child ${Date.now()}`;
                child.SpaceTypeID = promptTypeId;
                child.ParentID = rootSpaceId;
                child.OwnerID = dev.ID;
                child.InheritsMembership = true;
                child.Configuration = JSON.stringify({
                    PromptParts: [
                        {
                            Name: 'EngagementTone',
                            Role: 'System',
                            Text: 'Child override: focus responses on Phase 1 warehouse cutover readiness.',
                            Sort: 10,
                            Priority: 20,
                            MergeBehavior: 'Override',
                            Status: 'Active',
                            Band: 'Shared',
                        },
                        {
                            Name: 'CutoverChecklist',
                            Role: 'System',
                            Text: 'Shared checklist: confirm barcode scanner latency under 150ms.',
                            Sort: 30,
                            Priority: 10,
                            MergeBehavior: 'Append',
                            Status: 'Active',
                            Band: 'Shared',
                        },
                    ],
                });
                Assert(await child.Save() && !!child.ID, `Save Child PromptParts space failed: ${child.LatestResult?.CompleteMessage ?? ''}`);
                childSpaceId = child.ID;

                // Team audience receives Type baseline + Space Override for EngagementTone + Root Team secret + Space Shared checklist
                const teamResolved = await resolveSpaceScopedPromptParts({
                    provider: ctx.Provider,
                    systemUser: ctx.User,
                    spaceId: childSpaceId,
                    audience: 'Team',
                });
                const teamJoined = teamResolved.instructions.join('\n');
                Assert(teamJoined.includes('Type baseline: always cite verified enterprise records.'), 'SpaceType-level Append part flows down to child space');
                Assert(teamJoined.includes('Child override: focus responses on Phase 1 warehouse cutover readiness.'), 'Child Space Override wins over SpaceType and Root for EngagementTone');
                Assert(!teamJoined.includes('Root instruction: communicate with Northstar executive clarity.'), 'Overridden Root EngagementTone is replaced');
                Assert(!teamJoined.includes('Type default tone: formal consulting cadence.'), 'Overridden SpaceType EngagementTone is replaced');
                Assert(teamJoined.includes('TEAM-SECRET-MARGIN'), 'Team audience receives Team-band MarginGuardrail');
                Assert(teamJoined.includes('Shared checklist: confirm barcode scanner latency'), 'Team audience receives Shared CutoverChecklist');

                // Shared audience receives ONLY Shared parts — ZERO Team-band leakage
                const sharedResolved = await resolveSpaceScopedPromptParts({
                    provider: ctx.Provider,
                    systemUser: ctx.User,
                    spaceId: childSpaceId,
                    audience: 'Shared',
                });
                const sharedJoined = sharedResolved.instructions.join('\n');
                Assert(sharedJoined.includes('Type baseline: always cite verified enterprise records.'), 'Shared audience receives SpaceType Shared baseline');
                Assert(sharedJoined.includes('Child override: focus responses on Phase 1 warehouse cutover readiness.'), 'Shared audience receives Shared child override');
                Assert(sharedJoined.includes('Shared checklist: confirm barcode scanner latency'), 'Shared audience receives Shared checklist');
                Assert(!sharedJoined.includes('TEAM-SECRET-MARGIN'), 'Shared audience MUST NOT receive Team-band prompt parts');
                Assert(sharedResolved.excludedCount >= 1, `Shared resolution recorded excluded Team part(s) (${sharedResolved.excludedCount})`);
            } finally {
                if (childSpaceId) await cleanupSpace(ctx.Provider, ctx.User, childSpaceId);
                if (rootSpaceId) await cleanupSpace(ctx.Provider, ctx.User, rootSpaceId);
                await cleanupConfigurableTestSpaceType(ctx, promptTypeId);
            }
        },
    },
    {
        Id: 'round2-substrate.R2_4',
        Name: 'R2_4 — SupportsAudience bound action grants strip hidden server-bound scope params, withhold Team actions from Shared turns, and reject spoofed SpaceIDs',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            LoadSpaceAudienceActions();
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const solsticeHubId = await resolveEnterpriseSpaceId(ctx, SOLSTICE_PROGRAM_TASK_ID, 'Solstice Hub');
            const actionsEntity = ctx.Provider.EntityByName(ACTION_ENTITY);
            Assert(!!actionsEntity, 'MJ: Actions entity metadata exists');

            let createdActionId: string | null = null;
            let createdGrantId: string | null = null;

            try {
                // Ensure an Action record exists for ProposeSpaceAudienceOutputAction (or create temporary test Action + Params)
                const existingActions = await FindRows<{ ID: string }>(
                    ctx,
                    ACTION_ENTITY,
                    `DriverClass = '${PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION}'`,
                    ['ID'],
                    undefined,
                    { BypassCache: true },
                );
                let actionId = existingActions[0]?.ID ?? null;
                if (!actionId) {
                    const action = await ctx.Provider.GetEntityObject<MJActionEntity>(ACTION_ENTITY, ctx.User);
                    action.NewRecord();
                    action.Name = `${MARK} Propose Audience Output ${Date.now()}`;
                    action.Description = 'Integration test SupportsAudience action for Team draft proposal';
                    action.DriverClass = PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION;
                    action.Type = 'Custom';
                    action.Status = 'Active';
                    Assert(await action.Save() && !!action.ID, `Save test Action failed: ${action.LatestResult?.CompleteMessage ?? ''}`);
                    actionId = action.ID;
                    createdActionId = action.ID;

                    const paramSpecs: ReadonlyArray<{ name: string; required: boolean }> = [
                        { name: 'SpaceID', required: true },
                        { name: 'Band', required: false },
                        { name: 'DeliveryPrincipalID', required: false },
                        { name: 'Title', required: true },
                        { name: 'Content', required: true },
                    ];
                    for (const p of paramSpecs) {
                        const param = await ctx.Provider.GetEntityObject<MJActionParamEntity>(ACTION_PARAM_ENTITY, ctx.User);
                        param.NewRecord();
                        param.ActionID = actionId;
                        param.Name = p.name;
                        param.Type = 'Input';
                        param.ValueType = 'Scalar';
                        param.IsRequired = p.required;
                        param.IsArray = false;
                        Assert(await param.Save(), `Save ActionParam ${p.name} failed: ${param.LatestResult?.CompleteMessage ?? ''}`);
                    }
                }

                // Grant this action on Northstar Hub on the Team band
                const grant = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, ctx.User);
                grant.NewRecord();
                grant.SpaceID = northstarHubId;
                grant.Kind = 'Action';
                grant.TargetEntityID = actionsEntity!.ID;
                grant.TargetRecordID = actionId;
                grant.Band = 'Team';
                grant.IsDefault = false;
                grant.Mode = 'Extend';
                grant.Sequence = 10;
                Assert(await grant.Save() && !!grant.ID, `Save Team Action SpaceGrant failed: ${grant.LatestResult?.CompleteMessage ?? ''}`);
                createdGrantId = grant.ID;

                const loadedConfig = await loadSpaceConfiguration(ctx.Provider, northstarHubId, { reader: ctx.User });

                // 1. Team audience turn resolves the SupportsAudience action with hidden scope params stripped from visible schema
                const teamActions = await CollaborationBoundActionGrantRegistry.Instance.ResolveForTurn({
                    provider: ctx.Provider,
                    systemUser: ctx.User,
                    spaceId: northstarHubId,
                    audience: 'Team',
                    loadedConfiguration: loadedConfig,
                    callerUser: ada,
                });
                const exposure = teamActions.exposures.find((e) => SameID(e.ActionID, actionId));
                Assert(!!exposure, `Team turn exposes Team-band SupportsAudience action (${actionId})`);
                const visibleNames = new Set(exposure!.ExposedParams.map((p) => p.Name.toLowerCase()));
                Assert(visibleNames.has('title') && visibleNames.has('content'), 'Agent-visible schema keeps Title and Content');
                Assert(!visibleNames.has('spaceid') && !visibleNames.has('band') && !visibleNames.has('deliveryprincipalid'), 'Hidden server-bound scope params are stripped from agent schema');
                const injected = teamActions.boundActionParams[exposure!.ActionID] ?? {};
                Assert(SameID(String(injected['SpaceID'] ?? ''), northstarHubId), `Server binds SpaceID=${northstarHubId}`);

                // 2. Shared audience turn MUST NOT receive Team-band action grants
                const sharedActions = await CollaborationBoundActionGrantRegistry.Instance.ResolveForTurn({
                    provider: ctx.Provider,
                    systemUser: ctx.User,
                    spaceId: northstarHubId,
                    audience: 'Shared',
                    loadedConfiguration: loadedConfig,
                    callerUser: bea,
                });
                Assert(
                    !sharedActions.actionIds.some((id) => SameID(id, actionId)),
                    'Shared audience turn MUST NOT receive Team-band action grant',
                );

                // 3. Direct SupportsAudience action call with spoofed SpaceID (targeting Rival Solstice Hub) is rejected!
                const actionInstance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(
                    BaseAction,
                    PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION,
                );
                Assert(!!actionInstance, 'ProposeSpaceAudienceOutputAction is registered in ClassFactory');
                const actionEntityRecord = await ctx.Provider.GetEntityObject<MJActionEntity>(ACTION_ENTITY, ctx.User);
                Assert(await actionEntityRecord.Load(actionId), 'Loaded Action entity record for direct invocation');
                const spoofParams: ActionParam[] = [
                    { Name: 'SpaceID', Type: 'Input', Value: solsticeHubId, Bound: false },
                    { Name: 'Title', Type: 'Input', Value: 'Spoofed cross-org draft' },
                    { Name: 'Content', Type: 'Input', Value: 'Attempted cross-tenant injection' },
                ];
                const runParams: SpaceRunActionParams = {
                    Action: actionEntityRecord,
                    ContextUser: ada,
                    Provider: ctx.Provider,
                    Params: spoofParams,
                    Filters: [],
                    ServerBoundScopeParams: {
                        SpaceID: northstarHubId,
                        Band: 'Team',
                    },
                };
                const spoofResult: ActionResultSimple = await actionInstance!.Run(runParams);
                Assert(spoofResult.Success === false, `Spoofed SpaceID MUST be rejected, got: ${JSON.stringify(spoofResult)}`);
            } finally {
                if (createdGrantId) {
                    await deleteWhere(ctx.Provider, ctx.User, SPACE_GRANT_ENTITY, `ID = '${createdGrantId}'`, 'R2_4 test action grant');
                }
                if (createdActionId) {
                    await deleteWhere(ctx.Provider, ctx.User, ACTION_PARAM_ENTITY, `ActionID = '${createdActionId}'`, 'R2_4 test action params');
                    await deleteWhere(ctx.Provider, ctx.User, ACTION_ENTITY, `ID = '${createdActionId}'`, 'R2_4 test action');
                }
            }
        },
    },
    {
        Id: 'round2-substrate.R2_5',
        Name: 'R2_5 — Fan-out-on-read Space Notices enforce O(1) writes, Team/Shared band filtering, rival isolation, and independent per-persona watermarks',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');
            const bea = await GetPersonaUser(ctx, 'bea');
            const harper = await GetPersonaUser(ctx, 'harper');
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');

            const createdEventIds: string[] = [];
            try {
                const teamTitle = `${MARK} Team Notice ${Date.now()}`;
                const sharedTitle = `${MARK} Shared Notice ${Date.now()}`;

                const pubTeam = await runPublishSpaceNoticeEvent(ctx.Provider, ada, {
                    SpaceID: northstarHubId,
                    EventKind: 'Share',
                    Band: 'Team',
                    Title: teamTitle,
                    Body: 'Internal Meridian team update.',
                });
                Assert(
                    pubTeam.Success && pubTeam.NoticeEventRowsWritten === 1 && pubTeam.PerMemberInboxRowsWritten === 0 && !!pubTeam.Event,
                    `Team notice published O(1): ${pubTeam.ErrorMessage ?? ''}`,
                );
                createdEventIds.push(pubTeam.Event!.ID);

                const pubShared = await runPublishSpaceNoticeEvent(ctx.Provider, ada, {
                    SpaceID: northstarHubId,
                    EventKind: 'Share',
                    Band: 'Shared',
                    Title: sharedTitle,
                    Body: 'Shared milestone update for Northstar client team.',
                });
                Assert(
                    pubShared.Success && pubShared.NoticeEventRowsWritten === 1 && pubShared.PerMemberInboxRowsWritten === 0 && !!pubShared.Event,
                    `Shared notice published O(1): ${pubShared.ErrorMessage ?? ''}`,
                );
                createdEventIds.push(pubShared.Event!.ID);

                // Sam (Team) sees both Team & Shared notices
                const samFeed = await runGetSpaceNotices(ctx.Provider, sam, { SpaceID: northstarHubId });
                Assert(samFeed.Success, `Sam reads Space Notices: ${samFeed.ErrorMessage ?? ''}`);
                const samTitles = new Set(samFeed.Notices.map((n) => n.Title));
                Assert(samTitles.has(teamTitle) && samTitles.has(sharedTitle), 'Team member Sam reads both Team and Shared notices');

                // Bea (Client A Shared) sees ONLY Shared notice — ZERO Team notices
                const beaFeed = await runGetSpaceNotices(ctx.Provider, bea, { SpaceID: northstarHubId });
                Assert(beaFeed.Success, `Bea reads Space Notices: ${beaFeed.ErrorMessage ?? ''}`);
                const beaTitles = new Set(beaFeed.Notices.map((n) => n.Title));
                Assert(beaTitles.has(sharedTitle), 'Client A Bea reads Shared notice');
                Assert(!beaTitles.has(teamTitle), 'Client A Bea MUST NOT read Team notice');
                Assert(beaFeed.Notices.every((n) => n.Band === 'Shared'), 'Every notice returned to Shared-band Bea is Shared');

                // Harper (Rival Client B) sees ZERO Northstar notices
                const harperFeed = await runGetSpaceNotices(ctx.Provider, harper, { SpaceID: northstarHubId });
                Assert(harperFeed.Success && harperFeed.Notices.length === 0, `Rival Client B Harper reads 0 Northstar notices (got ${harperFeed.Notices.length})`);

                // Advance Bea's watermark to the Shared event -> Bea unread drops to 0 while Sam still has unread notices
                const advance = await runAdvanceSpaceNoticeWatermark(ctx.Provider, bea, {
                    SpaceID: northstarHubId,
                    EventID: pubShared.Event!.ID,
                });
                Assert(advance.Success && advance.Advanced, `Bea advances watermark: ${advance.ErrorMessage ?? ''}`);

                const beaUnread = await runGetSpaceUnreadNoticeCounts(ctx.Provider, bea, { SpaceIDs: [northstarHubId] });
                Assert(beaUnread.Success && beaUnread.TotalUnreadCount === 0, `Bea unread count drops to 0 after watermark advance (got ${beaUnread.TotalUnreadCount})`);

                const samUnread = await runGetSpaceUnreadNoticeCounts(ctx.Provider, sam, { SpaceIDs: [northstarHubId] });
                Assert(samUnread.Success && samUnread.TotalUnreadCount >= 2, `Sam still has unread notices independently of Bea (${samUnread.TotalUnreadCount})`);
            } finally {
                await deleteWhere(
                    ctx.Provider,
                    ctx.User,
                    SPACE_NOTICE_WATERMARK_ENTITY,
                    `SpaceID = '${northstarHubId}' AND UserID IN ('${bea.ID}', '${sam.ID}', '${ada.ID}')`,
                    'R2_5 notice watermarks',
                );
                if (createdEventIds.length > 0) {
                    await deleteWhere(
                        ctx.Provider,
                        ctx.User,
                        SPACE_NOTICE_EVENT_ENTITY,
                        `ID IN (${createdEventIds.map((id) => `'${id}'`).join(',')})`,
                        'R2_5 notice events',
                    );
                }
            }
        },
    },
    {
        Id: 'round2-substrate.R2_6',
        Name: 'R2_6 — Comms v2 notification routing & reach-verified scoped digests enforce Team/Shared band rules, block rival org leakage, and advance checkpoints idempotently',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');
            const bea = await GetPersonaUser(ctx, 'bea');
            const harper = await GetPersonaUser(ctx, 'harper');
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');

            const previousTransport = GetCollaborationCommsV2Transport();
            const dispatched: CommsV2TransportDispatchRequest[] = [];
            const spyTransport: CollaborationCommsV2Transport = {
                Name: 'IntegrationSpyCommsV2Transport',
                Dispatch: async (request: CommsV2TransportDispatchRequest) => {
                    dispatched.push(request);
                    const delivered: Array<'InApp' | 'Email' | 'SMS' | 'Chat'> = [];
                    if (request.Payload.Channels.InApp) delivered.push('InApp');
                    if (request.Payload.Channels.Email) delivered.push('Email');
                    if (request.Payload.Channels.SMS) delivered.push('SMS');
                    if (request.Payload.Channels.Chat) delivered.push('Chat');
                    return {
                        Success: true,
                        DeliveredChannels: delivered,
                        InAppNotificationID: null,
                        EmailDispatched: request.Payload.Channels.Email,
                        SMSDispatched: request.Payload.Channels.SMS,
                        ChatDispatched: request.Payload.Channels.Chat,
                    };
                },
            };

            const createdEventIds: string[] = [];
            try {
                RegisterCollaborationCommsV2Transport(spyTransport);

                // 1. Comms v2 notification routing: Team event vs Shared event on Northstar Hub
                const teamRoute = await runRouteCollaborationNotifications(ctx.Provider, ada, {
                    Event: {
                        EventType: 'Share',
                        SpaceID: northstarHubId,
                        SpaceName: 'Northstar ERP Modernization Hub',
                        Band: 'Team',
                        ActorUserID: ada.ID,
                        ActorName: ada.Name,
                        Title: `${MARK} Team-only margin alert`,
                        Body: 'Internal Meridian team alert.',
                    },
                    RecipientUserIDs: [sam.ID, bea.ID, harper.ID],
                    IncludeSpaceMembers: false,
                });
                Assert(teamRoute.Success, `Team notification routing failed: ${teamRoute.ErrorMessage ?? ''}`);
                const teamDeliveredUsers = new Set(
                    teamRoute.Deliveries.filter((o) => o.DeliveredChannels.length > 0).map((o) => o.RecipientUserID.toLowerCase()),
                );
                Assert(teamDeliveredUsers.has(sam.ID.toLowerCase()), 'Team member Sam receives Team notification');
                Assert(!teamDeliveredUsers.has(bea.ID.toLowerCase()), 'Client A Bea MUST NOT receive Team notification');
                Assert(!teamDeliveredUsers.has(harper.ID.toLowerCase()), 'Rival Client B Harper MUST NOT receive Team notification');

                const sharedRoute = await runRouteCollaborationNotifications(ctx.Provider, ada, {
                    Event: {
                        EventType: 'Share',
                        SpaceID: northstarHubId,
                        SpaceName: 'Northstar ERP Modernization Hub',
                        Band: 'Shared',
                        ActorUserID: ada.ID,
                        ActorName: ada.Name,
                        Title: `${MARK} Shared milestone notification`,
                        Body: 'Shared milestone posted to Northstar Hub.',
                    },
                    RecipientUserIDs: [sam.ID, bea.ID, harper.ID],
                    IncludeSpaceMembers: false,
                });
                Assert(sharedRoute.Success, `Shared notification routing failed: ${sharedRoute.ErrorMessage ?? ''}`);
                const sharedDeliveredUsers = new Set(
                    sharedRoute.Deliveries.filter((o) => o.DeliveredChannels.length > 0).map((o) => o.RecipientUserID.toLowerCase()),
                );
                Assert(sharedDeliveredUsers.has(sam.ID.toLowerCase()), 'Sam receives Shared notification');
                Assert(sharedDeliveredUsers.has(bea.ID.toLowerCase()), 'Client A Bea receives Shared notification');
                Assert(!sharedDeliveredUsers.has(harper.ID.toLowerCase()), 'Rival Client B Harper MUST NOT receive Northstar Shared notification');

                // 2. Reach-verified Scoped Digests across live SpaceNoticeEvents
                const teamDigestTitle = `${MARK} Digest Team Update ${Date.now()}`;
                const sharedDigestTitle = `${MARK} Digest Shared Update ${Date.now()}`;
                const evTeam = await runPublishSpaceNoticeEvent(ctx.Provider, ada, {
                    SpaceID: northstarHubId,
                    EventKind: 'Share',
                    Band: 'Team',
                    Title: teamDigestTitle,
                    Body: 'Internal digest item.',
                });
                const evShared = await runPublishSpaceNoticeEvent(ctx.Provider, ada, {
                    SpaceID: northstarHubId,
                    EventKind: 'Share',
                    Band: 'Shared',
                    Title: sharedDigestTitle,
                    Body: 'Client-visible digest item.',
                });
                Assert(evTeam.Success && !!evTeam.Event && evShared.Success && !!evShared.Event, 'Digest test events published');
                createdEventIds.push(evTeam.Event!.ID, evShared.Event!.ID);

                // Preview digest for Sam (Team): includes both Team and Shared items
                const samPreview = await runPreviewScopedSpaceDigest(ctx.Provider, sam, {
                    Cadence: 'Daily',
                    SpaceID: northstarHubId,
                    IgnoreCadenceFilter: true,
                    ForceWindow: true,
                });
                Assert(samPreview.Success && !!samPreview.Outcome, `Sam digest preview failed: ${samPreview.ErrorMessage ?? ''}`);
                const samDigestTitles = new Set((samPreview.Outcome?.Items ?? []).map((i) => i.Title));
                Assert(samDigestTitles.has(teamDigestTitle) && samDigestTitles.has(sharedDigestTitle), 'Sam digest preview includes both Team and Shared notices');

                // Preview digest for Bea (Client A Shared): includes Shared ONLY, ZERO Team leakage
                const beaPreview = await runPreviewScopedSpaceDigest(ctx.Provider, bea, {
                    Cadence: 'Daily',
                    SpaceID: northstarHubId,
                    IgnoreCadenceFilter: true,
                    ForceWindow: true,
                });
                Assert(beaPreview.Success && !!beaPreview.Outcome, `Bea digest preview failed: ${beaPreview.ErrorMessage ?? ''}`);
                const beaDigestItems = beaPreview.Outcome?.Items ?? [];
                Assert(beaDigestItems.some((i) => i.Title === sharedDigestTitle), 'Client A Bea digest includes Shared notice');
                Assert(!beaDigestItems.some((i) => i.Title === teamDigestTitle), 'Client A Bea digest MUST NOT leak Team notice');
                Assert(beaDigestItems.every((i) => i.Band === 'Shared'), 'Every item in Bea digest is Shared band');

                // Preview digest for Harper (Rival Client B): strictly 0 items (reach-verified)
                const harperPreview = await runPreviewScopedSpaceDigest(ctx.Provider, harper, {
                    Cadence: 'Daily',
                    SpaceID: northstarHubId,
                    IgnoreCadenceFilter: true,
                    ForceWindow: true,
                });
                Assert(
                    harperPreview.Success && (harperPreview.Outcome?.Items.length ?? 0) === 0,
                    `Rival Client B Harper digest on Northstar Hub MUST contain 0 items (got ${harperPreview.Outcome?.Items.length ?? 0})`,
                );

                // Execute digest run for Bea & Harper with checkpoint persistence, then re-run to verify idempotent zero-duplicate delivery
                const run1 = await runRunScopedSpaceDigests(ctx.Provider, ctx.User, {
                    Cadence: 'Daily',
                    SpaceID: northstarHubId,
                    RecipientUserIDs: [bea.ID, harper.ID],
                    IgnoreCadenceFilter: true,
                    ForceWindow: true,
                });
                Assert(run1.Success, `RunScopedSpaceDigests first run failed: ${run1.ErrorMessage ?? ''}`);
                const beaOutcome1 = run1.Outcomes.find((o) => SameID(o.RecipientUserID, bea.ID));
                const harperOutcome1 = run1.Outcomes.find((o) => SameID(o.RecipientUserID, harper.ID));
                Assert(!!beaOutcome1 && beaOutcome1.ShouldDeliver && beaOutcome1.Items.length >= 1, 'Bea first digest run delivers Shared items');
                Assert(!harperOutcome1 || !harperOutcome1.ShouldDeliver, 'Harper receives ZERO digest deliveries for Northstar Hub');

                // Second run with no new events delivers 0 duplicates because checkpoint advanced
                const run2 = await runRunScopedSpaceDigests(ctx.Provider, ctx.User, {
                    Cadence: 'Daily',
                    SpaceID: northstarHubId,
                    RecipientUserIDs: [bea.ID],
                    IgnoreCadenceFilter: true,
                    ForceWindow: true,
                });
                Assert(run2.Success, `RunScopedSpaceDigests second run failed: ${run2.ErrorMessage ?? ''}`);
                const beaOutcome2 = run2.Outcomes.find((o) => SameID(o.RecipientUserID, bea.ID));
                Assert(
                    !beaOutcome2 || !beaOutcome2.ShouldDeliver || beaOutcome2.Items.length === 0,
                    'Second digest run delivers 0 duplicate items after checkpoint advancement',
                );
            } finally {
                if (previousTransport) {
                    RegisterCollaborationCommsV2Transport(previousTransport);
                } else {
                    ResetCollaborationCommsV2Transport();
                }
                await deleteWhere(
                    ctx.Provider,
                    ctx.User,
                    SPACE_DIGEST_CHECKPOINT_ENTITY,
                    `SpaceID = '${northstarHubId}' AND UserID IN ('${bea.ID}', '${sam.ID}', '${harper.ID}', '${ada.ID}')`,
                    'R2_6 digest checkpoints',
                );
                if (createdEventIds.length > 0) {
                    await deleteWhere(
                        ctx.Provider,
                        ctx.User,
                        SPACE_NOTICE_EVENT_ENTITY,
                        `ID IN (${createdEventIds.map((id) => `'${id}'`).join(',')})`,
                        'R2_6 digest notice events',
                    );
                }
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('round2-substrate', {
    Setup: async () => {},
    Teardown: async () => {},
});
