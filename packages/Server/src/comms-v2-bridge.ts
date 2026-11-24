import { CommunicationEngine } from '@memberjunction/communication-engine';
import { Message } from '@memberjunction/communication-types';
import {
    type CommsV2DirectMessagePayload,
    EnsureCollaborationCommsV2TransportRegistered,
    SetCollaborationCommsV2DirectMessageDispatcher,
} from '@mj-biz-apps/collaboration-core-entities-server';

/**
 * Dispatches direct Comms v2 messages (e.g. Chat channel notifications) through
 * `@memberjunction/communication-engine` using the host's configured provider.
 */
async function dispatchDirectCommsV2Message(request: CommsV2DirectMessagePayload): Promise<boolean> {
    const engine = CommunicationEngine.Instance;
    await engine.Config(false, request.SystemUser, request.Provider);
    const providerName =
        request.ProviderName?.trim() ||
        engine.Providers.find((p) => p.SupportsSending !== false)?.Name;
    if (!providerName) {
        return false;
    }
    const msg = new Message();
    msg.To = request.To;
    msg.Subject = request.Subject;
    msg.Body = request.Body;
    msg.ContextData = request.Payload.TemplateData;
    const result = await engine.SendSingleMessage(
        providerName,
        request.MessageTypeName,
        msg,
        undefined,
        false,
        undefined,
        request.SystemUser,
    );
    return result?.Success === true;
}

/**
 * Installs the MJ Comms v2 direct-message bridge and ensures the NT-1
 * transport & BaseRemotableOperations are registered on server startup.
 */
export function InstallCollaborationCommsV2Bridge(): void {
    SetCollaborationCommsV2DirectMessageDispatcher(dispatchDirectCommsV2Message);
    EnsureCollaborationCommsV2TransportRegistered();
}
