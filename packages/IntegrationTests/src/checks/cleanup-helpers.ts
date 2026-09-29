import { AsyncLocalStorage } from 'node:async_hooks';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CompositeKey, RunView, type BaseEntity, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import {
    CONVERSATION_ENTITY,
    CONVERSATION_DETAIL_ENTITY,
    SPACE_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_CHAT_ENTITY,
    SPACE_MEMBER_ENTITY,
} from '../entity-names.js';

/** The harness signs its cleanups as the system user: it owns the rows the checks create. */
export function requireHarnessUser(user: UserInfo): void {
    Assert(
        user.Type.trim() === 'Owner',
        `Cleanup must run as the harness's system user (type Owner); ${user.Email ?? user.ID} is type ${user.Type}.`,
    );
}

/** Every row of a read, or a failed check: a read that fails must not look like "nothing to clean up". */
async function readAll<T extends { ID: string }>(
    rv: RunView,
    user: UserInfo,
    entityName: string,
    extraFilter: string,
): Promise<T[]> {
    const res = await rv.RunView<T>({ EntityName: entityName, ExtraFilter: extraFilter, Fields: ['ID'], ResultType: 'simple' }, user);
    Assert(res.Success === true, `Cleanup could not read ${entityName} where ${extraFilter}: ${res.ErrorMessage ?? 'unknown error'}`);
    return res.Results ?? [];
}

/** Reads a filter back and fails while any row is still there. */
async function assertNoRows(rv: RunView, user: UserInfo, entityName: string, extraFilter: string): Promise<void> {
    const left = await readAll(rv, user, entityName, extraFilter);
    Assert(left.length === 0, `Cleanup left ${left.length} ${entityName} row(s) where ${extraFilter}`);
}

/**
 * Deletes one row and reads it back to confirm it is gone. A row that won't load is not "already gone":
 * the read-back decides. Use it for every row a check creates outside `cleanupConversation` and `cleanupSpace`.
 */
async function deleteRowAndConfirmUnguarded(
    provider: IMetadataProvider,
    user: UserInfo,
    entityName: string,
    id: string,
    what: string,
): Promise<void> {
    const entity = await provider.GetEntityObject<BaseEntity>(entityName, user);
    if (await entity.InnerLoad(CompositeKey.FromID(id))) {
        const deleted = await entity.Delete();
        Assert(deleted === true, `Delete of ${what} ${id} failed: ${entity.LatestResult?.CompleteMessage ?? 'unknown error'}`);
    }
    await assertNoRows(RunView.FromMetadataProvider(provider), user, entityName, `ID = '${id}'`);
}

/**
 * A failed assert in a cleanup runs in a `finally`, where it would replace the check's own error.
 * So a cleanup reports a failure to the check that is running: the check's first error is the one thrown,
 * and a cleanup failure fails the check only when the check had no error of its own.
 * Outside a registered check there is nobody to report to, so the failure throws.
 */
const cleanupFailures = new AsyncLocalStorage<Error[]>();

function reportCleanupFailure(error: unknown): void {
    const failure = error instanceof Error ? error : new Error(String(error));
    const sink = cleanupFailures.getStore();
    if (!sink) throw failure;
    console.error(`Cleanup failed: ${failure.message}`);
    sink.push(failure);
}

/** Runs one cleanup step, reporting a failure to the running check instead of throwing it from a `finally`. */
export async function cleanupStep(step: () => Promise<void>): Promise<void> {
    try {
        await step();
    } catch (error) {
        reportCleanupFailure(error);
    }
}

/** Registers a bundle's checks, each one reporting its cleanup failures as described on `reportCleanupFailure`. */
export function registerChecks(checks: readonly NamedCheck[]): void {
    for (const check of checks) {
        IntegrationCheckRegistry.Instance.Register({
            ...check,
            Fn: async (ctx: IntegrationCheckContext) => {
                // A check's own error propagates untouched; a cleanup failure fails the check only when it passed
                const failures: Error[] = [];
                await cleanupFailures.run(failures, () => check.Fn(ctx));
                if (failures.length > 0) throw failures[0];
            },
        });
    }
}

/**
 * Deletes a conversation and everything a check hangs on it: its agent runs, space chats, details,
 * resource permissions and the conversation row. Every read and delete is checked, and a last read-back
 * fails while any of it is still there.
 */
async function cleanupConversationUnguarded(
    provider: IMetadataProvider,
    user: UserInfo,
    conversationId?: string | null,
    spaceChatId?: string | null,
): Promise<void> {
    requireHarnessUser(user);
    const rv = RunView.FromMetadataProvider(provider);
    if (conversationId) {
        const byConversation = `ConversationID = '${conversationId}'`;
        const steps: Array<{ entityName: string; filter: string; what: string }> = [
            { entityName: 'MJ: AI Agent Runs', filter: byConversation, what: 'AI Agent Run' },
            { entityName: SPACE_CHAT_ENTITY, filter: byConversation, what: 'Space Chat' },
            { entityName: CONVERSATION_DETAIL_ENTITY, filter: byConversation, what: 'Conversation Detail' },
            { entityName: 'MJ: Resource Permissions', filter: `ResourceRecordID = '${conversationId}'`, what: 'Resource Permission' },
        ];
        for (const step of steps) {
            for (const row of await readAll(rv, user, step.entityName, step.filter)) {
                await deleteRowAndConfirmUnguarded(provider, user, step.entityName, row.ID, step.what);
            }
        }
        await deleteRowAndConfirmUnguarded(provider, user, CONVERSATION_ENTITY, conversationId, 'Conversation');
        for (const step of steps) {
            await assertNoRows(rv, user, step.entityName, step.filter);
        }
    } else if (spaceChatId) {
        await deleteRowAndConfirmUnguarded(provider, user, SPACE_CHAT_ENTITY, spaceChatId, 'Space Chat');
    }
}

/** Deletes a space with its conversations, items and seats, checking every read and delete and reading the space back. */
async function cleanupSpaceUnguarded(
    provider: IMetadataProvider,
    user: UserInfo,
    spaceId: string,
): Promise<void> {
    requireHarnessUser(user);
    const rv = RunView.FromMetadataProvider(provider);

    const chats = await rv.RunView<{ ID: string; ConversationID: string }>(
        { EntityName: SPACE_CHAT_ENTITY, ExtraFilter: `SpaceID = '${spaceId}'`, Fields: ['ID', 'ConversationID'], ResultType: 'simple' },
        user,
    );
    Assert(chats.Success === true, `Cleanup could not read the space's chats: ${chats.ErrorMessage ?? 'unknown error'}`);
    for (const chat of chats.Results ?? []) {
        await cleanupConversationUnguarded(provider, user, chat.ConversationID, chat.ID);
    }

    for (const [entityName, what] of [
        [SPACE_ITEM_ENTITY, 'Space Item'],
        [SPACE_MEMBER_ENTITY, 'Space Member'],
    ] as const) {
        const filter = `SpaceID = '${spaceId}'`;
        for (const row of await readAll(rv, user, entityName, filter)) {
            await deleteRowAndConfirmUnguarded(provider, user, entityName, row.ID, what);
        }
        await assertNoRows(rv, user, entityName, filter);
    }

    await deleteRowAndConfirmUnguarded(provider, user, SPACE_ENTITY, spaceId, 'Space');
}

/** Deletes one row and reads it back to confirm it is gone (see `deleteRowAndConfirmUnguarded`). A failure is reported to the running check. */
export const deleteRowAndConfirm = (
    ...args: Parameters<typeof deleteRowAndConfirmUnguarded>
): Promise<void> => cleanupStep(() => deleteRowAndConfirmUnguarded(...args));

/** Deletes a conversation and what hangs on it (see `cleanupConversationUnguarded`). A failure is reported to the running check. */
export const cleanupConversation = (
    ...args: Parameters<typeof cleanupConversationUnguarded>
): Promise<void> => cleanupStep(() => cleanupConversationUnguarded(...args));

/** Deletes a space and what hangs on it (see `cleanupSpaceUnguarded`). A failure is reported to the running check. */
export const cleanupSpace = (
    ...args: Parameters<typeof cleanupSpaceUnguarded>
): Promise<void> => cleanupStep(() => cleanupSpaceUnguarded(...args));
