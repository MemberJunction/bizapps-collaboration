import { AsyncLocalStorage } from 'node:async_hooks';
import {
    BaseEntity,
    BaseEntityResult,
    type EntityDeleteOptions,
    type EntitySaveOptions,
    LogError,
    ServerOperationScopeManager,
    type UserInfo,
} from '@memberjunction/core';
import type { SourceReceiptReachContext } from '@mj-biz-apps/collaboration-core';
import { MJGlobal, RegisterClass } from '@memberjunction/global';
import {
    MJAIAgentRunEntityExtended,
    MJAIAgentRunStepEntityExtended,
    MJAIPromptRunEntityExtended,
} from '@memberjunction/ai-core-plus';
import { isSpaceParticipant } from './task-attribution.js';

/**
 * Server-authority operation key wrapping {@link executeSpaceChatTurn}'s agent execution.
 * Space Participant writes to AI run entities are rejected unless this scope is active for the acting user.
 */
export const COLLABORATION_AGENT_TURN_OPERATION = 'Collaboration.ExecuteSpaceChatTurn';

/**
 * Server-authority operation key wrapping cascading deletion of source receipts when a SpaceItem is deleted.
 */
export const COLLABORATION_ITEM_DELETE_OPERATION = 'Collaboration.SpaceItemCascadeDelete';

/**
 * Source receipts entity populated server-side at the commit boundary of a Space Chat Turn.
 */
export const COLLABORATION_SOURCE_RECEIPT_ENTITY = 'MJ_BizApps_Collaboration: Space Agent Source Receipts';

/**
 * AI execution-history entities guarded against direct or off-turn Space Participant writes.
 */
export const COLLABORATION_AI_RUN_LOCKDOWN_ENTITIES = [
    'MJ: AI Agent Runs',
    'MJ: AI Agent Run Steps',
    'MJ: AI Prompt Runs',
] as const;

export type CollaborationAIRunEntityName = typeof COLLABORATION_AI_RUN_LOCKDOWN_ENTITIES[number];

export interface CollaborationTurnAuthorityContext {
    userId: string;
    spaceChatId?: string;
    reachContext?: SourceReceiptReachContext;
}

const turnAuthorityStorage = new AsyncLocalStorage<CollaborationTurnAuthorityContext>();

/**
 * Returns the active turn's authority context (userId, optional spaceChatId and reachContext) when executing inside {@link runWithCollaborationAgentTurnAuthority}.
 */
export function getCollaborationTurnAuthorityContext(): CollaborationTurnAuthorityContext | undefined {
    return turnAuthorityStorage.getStore();
}

/**
 * Executes {@link fn} inside the server-orchestrated Space Chat Turn authority scope for {@link userId}.
 */
export function runWithCollaborationAgentTurnAuthority<T>(
    userId: string,
    fn: () => T,
    options?: { spaceChatId?: string; reachContext?: SourceReceiptReachContext },
): T {
    const ctx: CollaborationTurnAuthorityContext = {
        userId,
        ...(options?.spaceChatId ? { spaceChatId: options.spaceChatId } : {}),
        ...(options?.reachContext ? { reachContext: options.reachContext } : {}),
    };
    return turnAuthorityStorage.run(ctx, () =>
        ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: COLLABORATION_AGENT_TURN_OPERATION,
                source: 'ServerEngine',
                allowedEntities: [...COLLABORATION_AI_RUN_LOCKDOWN_ENTITIES, COLLABORATION_SOURCE_RECEIPT_ENTITY],
                userId,
            },
            fn
        ),
    );
}

/**
 * Evaluates whether {@link actingUser} may perform a save or delete on {@link entityName}.
 * Returns a human-readable refusal reason when blocked, or `null` when allowed.
 */
export function evaluateParticipantAIRunWriteAccess(
    entityName: CollaborationAIRunEntityName,
    action: 'save' | 'delete',
    actingUser: UserInfo | undefined
): string | null {
    if (!actingUser || !isSpaceParticipant(actingUser)) {
        return null;
    }
    if (action === 'delete') {
        return `Space Participant cannot delete ${entityName} records.`;
    }
    if (ServerOperationScopeManager.Instance.IsInDirectClientCrud()) {
        return `Direct client CRUD on ${entityName} is forbidden for Space Participant.`;
    }
    const inAuthorizedTurn = ServerOperationScopeManager.Instance.IsOperationActive(
        [COLLABORATION_AGENT_TURN_OPERATION],
        entityName,
        actingUser
    );
    if (!inAuthorizedTurn) {
        return `Space Participant cannot create or mutate ${entityName} outside an active space chat turn.`;
    }
    return null;
}

/**
 * Evaluates whether a save or delete on `MJ_BizApps_Collaboration: Space Agent Source Receipts`
 * is authorized under direct CRUD and Space Chat Turn lockdown rules.
 */
export function evaluateParticipantSourceReceiptWriteAccess(
    action: 'save' | 'delete',
    actingUser: UserInfo | undefined
): string | null {
    if (ServerOperationScopeManager.Instance.IsInDirectClientCrud()) {
        return `Direct client ${action} on ${COLLABORATION_SOURCE_RECEIPT_ENTITY} is forbidden.`;
    }
    if (!actingUser || !isSpaceParticipant(actingUser)) {
        return null;
    }
    if (action === 'delete') {
        return `Space Participant cannot delete ${COLLABORATION_SOURCE_RECEIPT_ENTITY} records.`;
    }
    const inAuthorizedTurn = ServerOperationScopeManager.Instance.IsOperationActive(
        [COLLABORATION_AGENT_TURN_OPERATION],
        COLLABORATION_SOURCE_RECEIPT_ENTITY,
        actingUser
    );
    if (!inAuthorizedTurn) {
        return `Space Participant cannot create or mutate ${COLLABORATION_SOURCE_RECEIPT_ENTITY} outside an authorized space chat turn.`;
    }
    return null;
}

function recordAIRunLockdownRefusal(entity: BaseEntity, action: 'save' | 'delete', message: string): false {
    const result = new BaseEntityResult();
    result.Success = false;
    result.Type = action === 'delete' ? 'delete' : entity.IsSaved ? 'update' : 'create';
    result.Message = message;
    entity.RegisterResultHistoryEntry(result);
    LogError(`ai-run-lockdown: ${message}`);
    return false;
}

interface PrototypeBearingClass {
    prototype?: object;
}

/**
 * Ensures {@link CollaborationAIPromptRunEntityServer} chains to `@memberjunction/core-entities-server`'s
 * `MJAIPromptRunEntityServer` (cost calculation) when that package is also loaded in ClassFactory.
 */
export function syncPromptRunBasePrototype(): void {
    const registrations = MJGlobal.Instance.ClassFactory.GetAllRegistrations(BaseEntity, 'MJ: AI Prompt Runs');
    const others = registrations
        .filter((reg) => reg.SubClass !== CollaborationAIPromptRunEntityServer)
        .sort((a, b) => b.Priority - a.Priority);
    const fallbackReg = others[0];
    const subClass: PrototypeBearingClass | undefined = fallbackReg?.SubClass;
    const baseProto = subClass?.prototype;
    if (subClass && baseProto && typeof baseProto === 'object') {
        if (Object.getPrototypeOf(CollaborationAIPromptRunEntityServer.prototype) !== baseProto) {
            Object.setPrototypeOf(CollaborationAIPromptRunEntityServer.prototype, baseProto);
            Object.setPrototypeOf(CollaborationAIPromptRunEntityServer, subClass);
        }
    }
    const activeReg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseEntity, 'MJ: AI Prompt Runs');
    if (activeReg && activeReg.SubClass !== CollaborationAIPromptRunEntityServer) {
        const highestPriority = registrations.reduce((max, reg) => (reg.Priority > max ? reg.Priority : max), 0);
        MJGlobal.Instance.ClassFactory.Register(
            BaseEntity,
            CollaborationAIPromptRunEntityServer,
            'MJ: AI Prompt Runs',
            highestPriority + 1
        );
    }
}

/**
 * Server gate for `MJ: AI Agent Runs`: rejects direct client CRUD, deletes, and off-turn writes by Space Participant.
 */
@RegisterClass(BaseEntity, 'MJ: AI Agent Runs', 100)
export class CollaborationAIAgentRunEntityServer extends MJAIAgentRunEntityExtended {
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        const refusal = evaluateParticipantAIRunWriteAccess('MJ: AI Agent Runs', 'save', this.ContextCurrentUser);
        if (refusal) {
            return recordAIRunLockdownRefusal(this, 'save', refusal);
        }
        return super.Save(options);
    }

    public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
        const refusal = evaluateParticipantAIRunWriteAccess('MJ: AI Agent Runs', 'delete', this.ContextCurrentUser);
        if (refusal) {
            return recordAIRunLockdownRefusal(this, 'delete', refusal);
        }
        return super.Delete(options);
    }
}

/**
 * Server gate for `MJ: AI Agent Run Steps`: rejects direct client CRUD, deletes, and off-turn writes by Space Participant.
 */
@RegisterClass(BaseEntity, 'MJ: AI Agent Run Steps', 100)
export class CollaborationAIAgentRunStepEntityServer extends MJAIAgentRunStepEntityExtended {
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        const refusal = evaluateParticipantAIRunWriteAccess('MJ: AI Agent Run Steps', 'save', this.ContextCurrentUser);
        if (refusal) {
            return recordAIRunLockdownRefusal(this, 'save', refusal);
        }
        return super.Save(options);
    }

    public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
        const refusal = evaluateParticipantAIRunWriteAccess('MJ: AI Agent Run Steps', 'delete', this.ContextCurrentUser);
        if (refusal) {
            return recordAIRunLockdownRefusal(this, 'delete', refusal);
        }
        return super.Delete(options);
    }
}

/**
 * Server gate for `MJ: AI Prompt Runs`: rejects direct client CRUD, deletes, and off-turn writes by Space Participant,
 * while preserving upstream `MJAIPromptRunEntityServer` cost calculation when loaded.
 */
@RegisterClass(BaseEntity, 'MJ: AI Prompt Runs', 100)
export class CollaborationAIPromptRunEntityServer extends MJAIPromptRunEntityExtended {
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        const refusal = evaluateParticipantAIRunWriteAccess('MJ: AI Prompt Runs', 'save', this.ContextCurrentUser);
        if (refusal) {
            return recordAIRunLockdownRefusal(this, 'save', refusal);
        }
        syncPromptRunBasePrototype();
        return super.Save(options);
    }

    public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
        const refusal = evaluateParticipantAIRunWriteAccess('MJ: AI Prompt Runs', 'delete', this.ContextCurrentUser);
        if (refusal) {
            return recordAIRunLockdownRefusal(this, 'delete', refusal);
        }
        syncPromptRunBasePrototype();
        return super.Delete(options);
    }
}

/** Ensures all CT-7 AI run lockdown subclasses and prototype links are registered at server startup. */
export function LoadCollaborationAIRunLockdown(): void {
    syncPromptRunBasePrototype();
}
