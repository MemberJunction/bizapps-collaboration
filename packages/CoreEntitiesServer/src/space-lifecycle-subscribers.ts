/**
 * Space lifecycle subscribers.
 * Follows extensibility plan § 5.
 */

import { type IEntityDataProvider, type IMetadataProvider, LogError } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';

export type SpaceLifecycleEvent =
    | 'AfterSpaceClosed'
    /** Stage 1: the space entered another status; `data` carries `fromStatusCode`, `toStatusCode` and `toStatusId`. A close raises both. */
    | 'AfterSpaceStatusChanged'
    | 'AfterMemberAdded'
    | 'AfterMemberRemoved'
    | 'AfterItemPromoted';

export interface SpaceLifecyclePayload {
    spaceId: string;
    actingUserId: string;
    event: SpaceLifecycleEvent;
    timestamp: Date;
    data?: Record<string, string | number | boolean | null | undefined | object>;
}

export abstract class BaseSpaceLifecycleSubscriber {
    public abstract OnEvent(payload: SpaceLifecyclePayload): Promise<void> | void;
}

interface ProviderWithRunAfterCommit {
    RunAfterCommit(task: () => Promise<void> | void, description?: string): void;
}

function hasRunAfterCommit(provider: object | null | undefined): provider is ProviderWithRunAfterCommit {
    return !!provider && typeof (provider as Partial<ProviderWithRunAfterCommit>).RunAfterCommit === 'function';
}

/**
 * Dispatches a space lifecycle event to all registered BaseSpaceLifecycleSubscriber instances
 * after the saving transaction commits via provider.RunAfterCommit.
 */
export function notifySpaceLifecycleSubscribers(
    provider: IMetadataProvider | IEntityDataProvider | null | undefined,
    payload: SpaceLifecyclePayload
): void {
    const task = async (): Promise<void> => {
        try {
            const regs = MJGlobal.Instance.ClassFactory.GetAllRegistrations(BaseSpaceLifecycleSubscriber);
            for (const reg of regs) {
                try {
                    const subscriber = MJGlobal.Instance.ClassFactory.CreateInstance<BaseSpaceLifecycleSubscriber>(
                        BaseSpaceLifecycleSubscriber,
                        reg.Key
                    );
                    if (subscriber && typeof subscriber.OnEvent === 'function') {
                        await subscriber.OnEvent(payload);
                    }
                } catch (subErr) {
                    LogError(`Space lifecycle subscriber [${reg.Key}] failed on ${payload.event}: ${subErr instanceof Error ? subErr.message : String(subErr)}`);
                }
            }
        } catch (err) {
            LogError(`Failed dispatching space lifecycle event ${payload.event}: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    if (hasRunAfterCommit(provider)) {
        provider.RunAfterCommit(task, `SpaceLifecycle:${payload.event}:${payload.spaceId}`);
    } else {
        LogError(`Cannot dispatch space lifecycle subscribers for ${payload.event}: provider does not support RunAfterCommit`);
    }
}
