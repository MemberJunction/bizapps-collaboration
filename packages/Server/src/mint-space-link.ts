import { CommunicationEngine } from '@memberjunction/communication-engine';
import { Message } from '@memberjunction/communication-types';
import { type UserInfo } from '@memberjunction/core';
import { configInfo } from '@memberjunction/server';
import { handInviteToEngine, type InviteEmail } from '@mj-biz-apps/collaboration-core';
import {
    mintSpaceLink as mintSpaceLinkCore,
    resolveMagicLinkHost,
    setMagicLinkHostProvider,
    type MagicLinkHost,
    type MintSpaceLinkResult,
} from '@mj-biz-apps/collaboration-core-entities-server';

async function sendInviteEmailViaEngine(system: UserInfo, providerName: string, draft: InviteEmail): Promise<boolean> {
    return handInviteToEngine(
        {
            SendSingleMessage: async (pName, type, message) => {
                const engine = CommunicationEngine.Instance;
                await engine.Config(false, system);
                const mail = new Message();
                mail.From = message.from;
                mail.To = message.to;
                mail.Subject = message.subject;
                mail.Body = message.body;
                return engine.SendSingleMessage(pName, type, mail);
            },
        },
        providerName,
        draft,
    );
}

setMagicLinkHostProvider(() => {
    const magic = configInfo?.magicLink;
    const publicUrl =
        configInfo?.publicUrl ||
        (configInfo?.baseUrl ? `${configInfo.baseUrl}:${configInfo.graphqlPort ?? 4000}${configInfo.graphqlRootPath || ''}` : 'http://localhost:4000');
    return {
        enabled: magic?.enabled ?? true,
        publicUrl,
        restrictedRoleName: magic?.restrictedRoleName || 'Magic Link Baseline',
        grantableRoleNames: magic?.grantableRoleNames ?? ['Space Participant'],
        inviteIssuerRoleNames: magic?.inviteIssuerRoleNames ?? ['UI', 'Developer', 'Integration'],
        communicationProvider: magic?.communicationProvider,
        fromAddress: magic?.fromAddress ?? '',
        defaultExpiresInHours: magic?.defaultExpiresInHours ?? 72,
        provisioningGuard: magic?.provisioningGuard === 'warn' ? 'warn' : 'block',
        sendInviteEmail: sendInviteEmailViaEngine,
    };
});

export async function mintSpaceLink(input: Parameters<typeof mintSpaceLinkCore>[0]): Promise<MintSpaceLinkResult> {
    const host = input.host ? { sendInviteEmail: sendInviteEmailViaEngine, ...input.host } : resolveMagicLinkHost();
    return mintSpaceLinkCore({ ...input, host });
}

export { resolveMagicLinkHost, setMagicLinkHostProvider, type MagicLinkHost, type MintSpaceLinkResult };
