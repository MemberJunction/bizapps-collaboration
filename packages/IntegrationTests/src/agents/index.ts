import './CollaborationTestSpaceAgentDriver.js';

export {
    COLLABORATION_TEST_AGENT_ID,
    COLLABORATION_TEST_AGENT_NAME,
    COLLABORATION_TEST_AGENT_DRIVER_CLASS,
} from './test-agent.js';

/**
 * Registers the test agent's driver. A process that runs a space chat turn on the harness's
 * behalf (an MJAPI the client harness talks to) loads this entry, and only this entry.
 */
export function LoadCollaborationTestAgent(): void {}
