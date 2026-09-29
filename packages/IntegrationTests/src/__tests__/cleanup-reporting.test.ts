import { describe, expect, it } from 'vitest';
import { IntegrationCheckRegistry, type IntegrationCheckContext } from '@memberjunction/testing-integration/registry';
import { cleanupStep, registerChecks, runAllSteps } from '../checks/cleanup-helpers.js';

const ctx = {} as IntegrationCheckContext;

/** Registers one check under a fresh bundle and runs it the way the harness would. */
async function runCheck(id: string, body: () => Promise<void>): Promise<void> {
    registerChecks([{ Id: `unit-cleanup.${id}`, Name: id, RequiresMutation: false, Fn: async () => body() }]);
    const [check] = IntegrationCheckRegistry.Instance.GetBundle('unit-cleanup').filter((c) => c.Id === `unit-cleanup.${id}`);
    await check.Fn(ctx);
}

describe('which error a check reports', () => {
    it("reports the check's own error when its cleanup fails too", async () => {
        await expect(
            runCheck('own-error-wins', async () => {
                try {
                    throw new Error('the check failed');
                } finally {
                    await cleanupStep(async () => {
                        throw new Error('the cleanup failed');
                    });
                }
            }),
        ).rejects.toThrow('the check failed');
    });

    it('fails a check that passed when its cleanup failed', async () => {
        await expect(
            runCheck('cleanup-fails-a-pass', async () => {
                await cleanupStep(async () => {
                    throw new Error('the cleanup failed');
                });
            }),
        ).rejects.toThrow('the cleanup failed');
    });

    it('lets a check pass when its cleanup succeeds', async () => {
        await expect(runCheck('clean-pass', async () => cleanupStep(async () => undefined))).resolves.toBeUndefined();
    });

    it('reports the first of two cleanup failures', async () => {
        await expect(
            runCheck('first-cleanup-failure', async () => {
                await cleanupStep(async () => {
                    throw new Error('first');
                });
                await cleanupStep(async () => {
                    throw new Error('second');
                });
            }),
        ).rejects.toThrow('first');
    });

    it('throws a cleanup failure straight away outside a check, where nobody is there to report to', async () => {
        await expect(
            cleanupStep(async () => {
                throw new Error('no check is running');
            }),
        ).rejects.toThrow('no check is running');
    });
});

describe('a teardown that runs every step', () => {
    it('runs the steps after a failure and then throws the first one', async () => {
        const ran: string[] = [];
        await expect(
            runAllSteps([
                async () => {
                    ran.push('one');
                    throw new Error('one failed');
                },
                async () => {
                    ran.push('two');
                },
                async () => {
                    ran.push('three');
                    throw new Error('three failed');
                },
            ]),
        ).rejects.toThrow('one failed');
        expect(ran).toEqual(['one', 'two', 'three']);
    });

    it('throws nothing when every step succeeds', async () => {
        await expect(runAllSteps([async () => undefined, async () => undefined])).resolves.toBeUndefined();
    });
});
