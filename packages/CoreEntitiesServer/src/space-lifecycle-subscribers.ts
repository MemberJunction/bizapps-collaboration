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
    /** The code of the space's type, so a subscriber hears only the types it names (item 86). Null when the type could not be read. */
    spaceTypeCode: string | null;
    actingUserId: string;
    event: SpaceLifecycleEvent;
    timestamp: Date;
    data?: Record<string, string | number | boolean | null | undefined | object>;
}

/**
 * A contribution any app registers (`@RegisterClass(BaseSpaceLifecycleSubscriber, 'its key')`) to hear a space's lifecycle events
 * after they commit. Found through the class factory's registrations (item 37), so no type has to name it; one that listens to some
 * types only lists their codes in `ForTypeCodes` (item 86), and hears nothing from the others.
 */
export abstract class BaseSpaceLifecycleSubscriber {
    /** The space type codes this subscriber hears; undefined means every type. */
    public readonly ForTypeCodes?: readonly string[];
    public abstract OnEvent(payload: SpaceLifecyclePayload): Promise<void> | void;
}

/** Whether a subscriber hears an event of a space of this type: it names no types, or names this one (without regard to case). */
export function subscriberHears(subscriber: Pick<BaseSpaceLifecycleSubscriber, 'ForTypeCodes'>, spaceTypeCode: string | null): boolean {
    const codes = subscriber.ForTypeCodes;
    if (!codes) return true;
    if (!spaceTypeCode) return false;
    return codes.some((code) => code.trim().toLowerCase() === spaceTypeCode.trim().toLowerCase());
}

interface ProviderWithRunAfterCommit {
    RunAfterCommit(task: () => Promise<void> | void, description?: string): void;
}

function hasRunAfterCommit(provider: object | null | undefined): provider is ProviderWithRunAfterCommit {
    return !!provider && typeof (provider as Partial<ProviderWithRunAfterCommit>).RunAfterCommit === 'function';
}

/**
 * Dispatches a space lifecycle event to every registered BaseSpaceLifecycleSubscriber that hears the space's type, after the saving
 * transaction commits (provider.RunAfterCommit), so a subscriber never sees a change that was rolled back. A subscriber that throws is
 * logged and does not silence the next.
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
                    if (subscriber && typeof subscriber.OnEvent === 'function' && subscriberHears(subscriber, payload.spaceTypeCode)) {
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
