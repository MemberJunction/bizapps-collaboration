/**
 * Copyright (c) MemberJunction.com
 * SPDX-License-Identifier: BUSL-1.1
 */

/**
 * Round-2 Collaboration v1 Substrate Client Checks over GraphQL wire (no `*Server` classes loaded).
 *
 * Verifies audience-cut `GetSpaceConfiguration` & `GetSpaceChatHostRules`, and GraphQL RLS
 * confinement for `Space Notice Events`, `Space Notice Watermarks`, `Space Digest Checkpoints`,
 * and `Space Anchors` across Meridian Team, Northstar Client A, and Solstice Rival Client B.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient } from '@mj-biz-apps/collaboration-entities';
import {
    SPACE_ANCHOR_ENTITY,
    SPACE_DIGEST_CHECKPOINT_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
    SPACE_NOTICE_WATERMARK_ENTITY,
    TASK_ENTITY,
} from '../../entity-names.js';
import { FindRows, getPersonaClientContext, SameID } from '../../wire.js';
import {
    ENTERPRISE_NOTICE_TITLES,
    NORTHSTAR_PROGRAM_TASK_ID,
    SOLSTICE_PROGRAM_TASK_ID,
} from '../../world/enterprise-ids.js';
import { registerChecks } from '../cleanup-helpers.js';

type ClientPersona = Awaited<ReturnType<typeof getPersonaClientContext>>;

function asPersona(ctx: IntegrationCheckContext, persona: ClientPersona): IntegrationCheckContext {
    return { ...ctx, Provider: persona.Provider, User: persona.User };
}

function clientOf(persona: ClientPersona): CollaborationClient {
    return new CollaborationClient(persona.GraphQLProvider);
}

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
    Assert(anchors.length === 1, `Expected 1 primary SpaceAnchor for ${label}`);
    return anchors[0].SpaceID;
}

const checks: NamedCheck[] = [
    {
        Id: 'round2-substrate.R2C1',
        Name: 'R2C1 — over the wire: GetSpaceConfiguration and GetSpaceChatHostRules cut audience capabilities for Team vs Shared and refuse Rival Client B',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const bea = await getPersonaClientContext(ctx, 'bea');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');

            const adaCfg = await clientOf(ada).GetSpaceConfiguration(northstarHubId);
            Assert(adaCfg.Success === true && adaCfg.CanSeeTeam === true, `Ada gets Team configuration over GraphQL: ${adaCfg.ErrorMessage ?? ''}`);

            const beaCfg = await clientOf(bea).GetSpaceConfiguration(northstarHubId);
            Assert(beaCfg.Success === true && beaCfg.CanSeeTeam === false, `Bea gets Shared-only configuration over GraphQL: ${beaCfg.ErrorMessage ?? ''}`);

            const harperCfg = await clientOf(harper).GetSpaceConfiguration(northstarHubId);
            Assert(harperCfg.Success === false, 'Rival Client B Harper refused GetSpaceConfiguration on Northstar Hub');

            const adaRules = await clientOf(ada).GetSpaceChatHostRules(northstarHubId);
            Assert(adaRules.Success === true && adaRules.AllowedConversationKinds.includes('Private'), 'Ada host rules allow Private chats');

            const beaRules = await clientOf(bea).GetSpaceChatHostRules(northstarHubId);
            Assert(beaRules.Success === true && !beaRules.AllowedConversationKinds.includes('Private'), 'Bea host rules exclude Private chats');

            const harperRules = await clientOf(harper).GetSpaceChatHostRules(northstarHubId);
            Assert(harperRules.Success === false, 'Rival Client B Harper refused GetSpaceChatHostRules on Northstar Hub');
        },
    },
    {
        Id: 'round2-substrate.R2C2',
        Name: 'R2C2 — over the wire: Space Notice Events and Watermarks enforce band and cross-org RLS over GraphQL',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const bea = await getPersonaClientContext(ctx, 'bea');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const solsticeHubId = await resolveEnterpriseSpaceId(ctx, SOLSTICE_PROGRAM_TASK_ID, 'Solstice Hub');

            const adaNotices = await FindRows<{ Title: string; Band: string }>(
                asPersona(ctx, ada),
                SPACE_NOTICE_EVENT_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['Title', 'Band'],
                ada.User,
                { BypassCache: true },
            );
            const adaTitles = new Set(adaNotices.map((n) => n.Title));
            Assert(
                adaTitles.has(ENTERPRISE_NOTICE_TITLES.northstarTeamNotice) &&
                    adaTitles.has(ENTERPRISE_NOTICE_TITLES.northstarSharedNotice),
                'Ada reads both Team and Shared notices in Northstar Hub over GraphQL',
            );

            const beaNotices = await FindRows<{ Title: string; Band: string }>(
                asPersona(ctx, bea),
                SPACE_NOTICE_EVENT_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['Title', 'Band'],
                bea.User,
                { BypassCache: true },
            );
            Assert(
                beaNotices.some((n) => n.Title === ENTERPRISE_NOTICE_TITLES.northstarSharedNotice) &&
                    beaNotices.every((n) => n.Band === 'Shared'),
                'Client A Bea reads Shared notices only over GraphQL',
            );

            const harperNorthstarNotices = await FindRows<{ ID: string }>(
                asPersona(ctx, harper),
                SPACE_NOTICE_EVENT_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['ID'],
                harper.User,
                { BypassCache: true },
            );
            Assert(harperNorthstarNotices.length === 0, 'Rival Client B Harper reads 0 Northstar notices over GraphQL');

            const harperSolsticeNotices = await FindRows<{ Title: string }>(
                asPersona(ctx, harper),
                SPACE_NOTICE_EVENT_ENTITY,
                `SpaceID = '${solsticeHubId}'`,
                ['Title'],
                harper.User,
                { BypassCache: true },
            );
            Assert(
                harperSolsticeNotices.some((n) => n.Title === ENTERPRISE_NOTICE_TITLES.solsticeSharedNotice),
                'Harper reads Solstice Shared notice over GraphQL',
            );

            const harperWatermarks = await FindRows<{ ID: string }>(
                asPersona(ctx, harper),
                SPACE_NOTICE_WATERMARK_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['ID'],
                harper.User,
                { BypassCache: true },
            );
            Assert(harperWatermarks.length === 0, 'Harper reads 0 Northstar watermarks over GraphQL');
        },
    },
    {
        Id: 'round2-substrate.R2C3',
        Name: 'R2C3 — over the wire: Space Anchors and Space Digest Checkpoints enforce strict cross-org and own-user RLS confinement',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await getPersonaClientContext(ctx, 'bea');
            const harper = await getPersonaClientContext(ctx, 'harper');
            const northstarHubId = await resolveEnterpriseSpaceId(ctx, NORTHSTAR_PROGRAM_TASK_ID, 'Northstar Hub');
            const solsticeHubId = await resolveEnterpriseSpaceId(ctx, SOLSTICE_PROGRAM_TASK_ID, 'Solstice Hub');

            const beaAnchors = await FindRows<{ SpaceID: string }>(
                asPersona(ctx, bea),
                SPACE_ANCHOR_ENTITY,
                `SpaceID IN ('${northstarHubId}', '${solsticeHubId}')`,
                ['SpaceID'],
                bea.User,
                { BypassCache: true },
            );
            Assert(
                beaAnchors.length >= 1 && beaAnchors.every((a) => SameID(a.SpaceID, northstarHubId)),
                'Bea reads Northstar Hub anchor and 0 Solstice anchors over GraphQL',
            );

            const harperAnchors = await FindRows<{ SpaceID: string }>(
                asPersona(ctx, harper),
                SPACE_ANCHOR_ENTITY,
                `SpaceID IN ('${northstarHubId}', '${solsticeHubId}')`,
                ['SpaceID'],
                harper.User,
                { BypassCache: true },
            );
            Assert(
                harperAnchors.length >= 1 && harperAnchors.every((a) => SameID(a.SpaceID, solsticeHubId)),
                'Harper reads Solstice Hub anchor and 0 Northstar anchors over GraphQL',
            );

            const harperNorthstarCheckpoints = await FindRows<{ ID: string }>(
                asPersona(ctx, harper),
                SPACE_DIGEST_CHECKPOINT_ENTITY,
                `SpaceID = '${northstarHubId}'`,
                ['ID'],
                harper.User,
                { BypassCache: true },
            );
            Assert(harperNorthstarCheckpoints.length === 0, 'Harper reads 0 Northstar digest checkpoints over GraphQL');
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('round2-substrate', {
    Setup: async () => {},
    Teardown: async () => {},
});
