import { Assert, type IntegrationCheckContext } from '@memberjunction/testing-integration/registry';
import type { mjBizAppsCollaborationSpaceAgentEntity } from '@mj-biz-apps/collaboration-entities';
import { COLLABORATION_TEST_AGENT_DRIVER_CLASS, COLLABORATION_TEST_AGENT_ID } from '../agents/test-agent.js';
import { AI_AGENT_ENTITY, SPACE_AGENT_ENTITY } from '../entity-names.js';
import { FindRows, RequireSave } from '../wire.js';

/**
 * Lets a bundle's turns run on the harness's own test agent without touching a shipped row.
 * The test agent is a row in `metadata-tests/agents`. A bundle attaches it to the space its turns run in
 * (a Space Agent row, added in Setup) and detaches it in Teardown. A turn then names it by mention.
 */
export async function attachTestAgent(ctx: IntegrationCheckContext, spaceId: string): Promise<string> {
    const agents = await FindRows<{ ID: string; DriverClass: string | null }>(
        ctx,
        AI_AGENT_ENTITY,
        `ID = '${COLLABORATION_TEST_AGENT_ID}'`,
        ['ID', 'DriverClass'],
    );
    Assert(
        agents.length === 1,
        `The harness's test agent row is missing. Push it with "pnpm run mj:push:tests" (metadata-tests/agents).`,
    );
    Assert(
        agents[0].DriverClass === COLLABORATION_TEST_AGENT_DRIVER_CLASS,
        `The test agent's DriverClass must be ${COLLABORATION_TEST_AGENT_DRIVER_CLASS} (saw ${agents[0].DriverClass ?? 'null'}).`,
    );

    const attachment = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceAgentEntity>(SPACE_AGENT_ENTITY, ctx.User);
    attachment.NewRecord();
    attachment.AgentID = COLLABORATION_TEST_AGENT_ID;
    attachment.SpaceID = spaceId;
    attachment.IsDefault = false;
    await RequireSave(attachment, 'Space Agent for the test agent');
    return attachment.ID;
}

/** Removes an attachment and reads it back to confirm it is gone. */
export async function detachTestAgent(ctx: IntegrationCheckContext, attachmentId: string): Promise<void> {
    const attachment = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceAgentEntity>(SPACE_AGENT_ENTITY, ctx.User);
    if (await attachment.Load(attachmentId)) {
        const deleted = await attachment.Delete();
        Assert(deleted, `Space Agent ${attachmentId} delete failed: ${attachment.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    const left = await FindRows<{ ID: string }>(ctx, SPACE_AGENT_ENTITY, `ID = '${attachmentId}'`, ['ID']);
    Assert(left.length === 0, `Space Agent ${attachmentId} is still there after its delete`);
}
