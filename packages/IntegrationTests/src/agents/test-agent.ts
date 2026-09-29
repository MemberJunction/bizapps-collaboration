/**
 * The harness's own agent. It is a row in `metadata-tests/agents`, not the shipped
 * Collaboration Space Agent, and its driver answers deterministically (no model key).
 * Nothing here, or in the loader, changes a shipped row.
 */
export const COLLABORATION_TEST_AGENT_ID = '8394CDBE-5A93-4185-8A71-B285CC7E3EAD';

/** The name a message uses to mention it. */
export const COLLABORATION_TEST_AGENT_NAME = 'Space Chat Test Stub';

/** The `DriverClass` on the test agent's row, and the key its driver registers under. */
export const COLLABORATION_TEST_AGENT_DRIVER_CLASS = 'CollaborationTestSpaceAgentDriver';
