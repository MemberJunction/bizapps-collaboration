/**
 * CX-10 Server Substrate Adapter: adapts the real server implementations of
 * CX-1 (`EnsureSpaceForRecord`), CS-3 (`CollaborationChatWritePermissionProvider`),
 * and CX-4 (`resolveSpaceScopedPromptParts`) to `CollaborationSubstrateContract`.
 */

import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import {
    SUBSTRATE_CONTRACT_VERSION,
    type CollaborationSubstrateContract,
    type SubstrateChatWriteRequest,
    type SubstrateEnsureSpaceRequest,
    type SubstrateEnsureSpaceResult,
    type SubstrateScopedPromptRequest,
} from '@mj-biz-apps/collaboration-core';
import { CollaborationChatWritePermissionProvider } from './chat-write-permission-provider.js';
import { EnsureSpaceForRecord } from './ensure-space-for-record.js';
import { resolveSpaceScopedPromptParts } from './scoped-prompt-parts.js';

export interface CollaborationServerSubstrateOptions {
    provider: IMetadataProvider;
    resolveUser: (userId: string) => UserInfo | undefined;
    systemUser?: UserInfo;
}

export function createCollaborationServerSubstrate(
    options: CollaborationServerSubstrateOptions,
): CollaborationSubstrateContract {
    return {
        contractVersion: SUBSTRATE_CONTRACT_VERSION,
        capabilities: ['CX-1', 'CS-3', 'CX-4'],

        async ensureSpaceForRecord(request: SubstrateEnsureSpaceRequest): Promise<SubstrateEnsureSpaceResult> {
            const caller = options.resolveUser(request.callerUserId);
            if (!caller) {
                throw new Error(`Caller user "${request.callerUserId}" could not be resolved.`);
            }
            const space = await EnsureSpaceForRecord({
                typeCode: request.typeCode,
                entityName: request.entityName,
                recordId: request.recordId,
                spaceName: request.spaceName,
                anchorRole: request.anchorRole,
                inheritsMembership: request.inheritsMembership,
                details: request.details,
                contextUser: caller,
                provider: options.provider,
            });
            const subtypeName =
                space.LeafEntity && space.LeafEntity !== space
                    ? space.LeafEntity.EntityInfo?.Name ?? null
                    : null;
            return {
                spaceId: space.ID,
                spaceTypeId: space.SpaceTypeID,
                inheritsMembership: !!space.InheritsMembership,
                ownerUserId: space.OwnerID,
                ownerSeatAssigned: true,
                subtypeEntityName: subtypeName,
                anchorRole: request.anchorRole?.trim() || 'primary',
                created: true,
            };
        },

        async evaluateChatWritePermission(request: SubstrateChatWriteRequest) {
            const caller = options.resolveUser(request.callerUserId);
            if (!caller) {
                return { Decision: 'Deny', Reason: `Caller user "${request.callerUserId}" could not be resolved.` };
            }
            return CollaborationChatWritePermissionProvider.Instance.EvaluateWritePermission({
                Provider: options.provider,
                ContextUser: caller,
                Operation: request.operation,
                ConversationID: request.conversationId,
                ConversationDetail:
                    request.detailAuthorUserId !== undefined || request.detailRole !== undefined
                        ? { UserID: request.detailAuthorUserId ?? null, Role: request.detailRole ?? null }
                        : undefined,
                IsServerAuthoredReply: request.isServerAuthoredReply,
            });
        },

        async resolveScopedPromptParts(request: SubstrateScopedPromptRequest) {
            return resolveSpaceScopedPromptParts({
                provider: options.provider,
                systemUser: options.systemUser,
                spaceId: request.spaceId,
                promptId: request.promptId,
                audience: request.audience,
                secondaryScopes: request.secondaryScopes,
                additionalCandidates: request.candidates,
            });
        },
    };
}
