import type { AgentRunStatusPublisher } from '@memberjunction/server';
import type { TurnObserver, TurnOutcome } from '@mj-biz-apps/collaboration-core-entities-server';

/** What the observer needs of MemberJunction's publisher: its two callbacks, and the two ways a run ends. */
export type TurnStatusPublisher = Pick<AgentRunStatusPublisher, 'OnProgress' | 'OnStreaming' | 'PublishFinal' | 'PublishFailure'>;

/**
 * Hands a turn's progress, streamed text and end to the browser that asked, through MemberJunction's own publisher for an agent
 * run's live status: the chat follows the reply row from what it publishes, so a space's reply shows the same live status and
 * steps as any other conversation's. The run's own result is published as MJ publishes its own runs; a turn that ended without a
 * result, or whose reply could not be saved, is published as a failure, with the reply row's id so the chat knows which row finished.
 */
export function turnObserverFrom(publisher: TurnStatusPublisher): TurnObserver {
    return {
        OnProgress: publisher.OnProgress,
        OnStreaming: publisher.OnStreaming,
        OnFinished: (outcome: TurnOutcome) => {
            if (outcome.result && outcome.result.success === outcome.success) {
                publisher.PublishFinal(outcome.result, outcome.replyDetailId);
            } else {
                publisher.PublishFailure(outcome.replyDetailId, outcome.errorMessage ?? 'The turn did not finish.');
            }
        },
    };
}
