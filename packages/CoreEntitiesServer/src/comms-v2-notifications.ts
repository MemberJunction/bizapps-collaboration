/**
 * NT-1 Server Comms v2 Transport Adapter (`MJCommsV2NotificationTransport`).
 *
 * Bridges Collaboration's preference-gated NT-1 notification payloads into
 * MemberJunction's `@memberjunction/notifications` (`NotificationEngine`) and
 * optional `@memberjunction/communication-engine` direct-message dispatcher.
 */

import { LogError, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { NotificationEngine } from '@memberjunction/notifications';
import type {
    CollaborationNotificationChannel,
    CommsV2NotificationPayload,
} from '@mj-biz-apps/collaboration-core';
import {
    type CollaborationCommsV2Transport,
    type CommsV2TransportDispatchRequest,
    type CommsV2TransportDispatchResult,
    GetCollaborationCommsV2Transport,
    LoadCollaborationDigestOperations,
    LoadCollaborationNotificationOperations,
    RegisterCollaborationCommsV2Transport,
} from '@mj-biz-apps/collaboration-engine-base';

export interface CommsV2DirectMessagePayload {
    Channel: 'Email' | 'SMS' | 'Chat';
    ProviderName?: string;
    MessageTypeName: string;
    To: string;
    Subject: string;
    Body: string;
    Payload: CommsV2NotificationPayload;
    Provider: IMetadataProvider;
    SystemUser: UserInfo;
}

export type CommsV2DirectMessageDispatcher = (request: CommsV2DirectMessagePayload) => Promise<boolean>;

let registeredDirectMessageDispatcher: CommsV2DirectMessageDispatcher | null = null;

export function SetCollaborationCommsV2DirectMessageDispatcher(
    dispatcher: CommsV2DirectMessageDispatcher | null,
): void {
    registeredDirectMessageDispatcher = dispatcher;
}

export function GetCollaborationCommsV2DirectMessageDispatcher(): CommsV2DirectMessageDispatcher | null {
    return registeredDirectMessageDispatcher;
}

export function ResetCollaborationCommsV2DirectMessageDispatcher(): void {
    registeredDirectMessageDispatcher = null;
}

/**
 * Live server Comms v2 notification transport backed by MJ `NotificationEngine`
 * (In-App `MJ: User Notifications` + template-based Email/SMS) and optional
 * direct `CommunicationEngine` message dispatch (for Chat and untemplated channels).
 */
export class MJCommsV2NotificationTransport implements CollaborationCommsV2Transport {
    public readonly Name = 'MJCommsV2NotificationTransport';

    public async Dispatch(request: CommsV2TransportDispatchRequest): Promise<CommsV2TransportDispatchResult> {
        const { Payload, Provider, SystemUser } = request;
        const deliveredChannels: CollaborationNotificationChannel[] = [];
        const errors: string[] = [];
        let inAppNotificationId: string | null = null;
        let emailDispatched = false;
        let smsDispatched = false;
        let chatDispatched = false;

        const wantsUnifiedChannels =
            Payload.Channels.InApp || Payload.Channels.Email || Payload.Channels.SMS;

        if (wantsUnifiedChannels) {
            try {
                await NotificationEngine.Instance.Config(false, SystemUser, Provider);
                const sendResult = await NotificationEngine.Instance.SendNotification(
                    {
                        userId: Payload.RecipientUserID,
                        typeNameOrId: Payload.NotificationTypeName,
                        title: Payload.Title,
                        message: Payload.Message,
                        resourceTypeId: Payload.ResourceTypeID,
                        resourceRecordId: Payload.ResourceRecordID,
                        resourceConfiguration: Payload.ResourceConfiguration,
                        templateData: Payload.TemplateData,
                        // Channels were already gated by NT-1 preference evaluation; pass both
                        // forceDeliveryChannels and subtractive allowedDeliveryChannels ceiling.
                        forceDeliveryChannels: {
                            inApp: Payload.Channels.InApp,
                            email: Payload.Channels.Email,
                            sms: Payload.Channels.SMS,
                        },
                        allowedDeliveryChannels: {
                            inApp: Payload.Channels.InApp,
                            email: Payload.Channels.Email,
                            sms: Payload.Channels.SMS,
                        },
                    },
                    SystemUser,
                );

                if (sendResult.success) {
                    if (Payload.Channels.InApp && sendResult.deliveryChannels.inApp) {
                        deliveredChannels.push('InApp');
                        inAppNotificationId = sendResult.inAppNotificationId ?? null;
                    }
                    if (Payload.Channels.Email && sendResult.deliveryChannels.email && sendResult.emailSent !== false) {
                        deliveredChannels.push('Email');
                        emailDispatched = true;
                    }
                    if (Payload.Channels.SMS && sendResult.deliveryChannels.sms && sendResult.smsSent !== false) {
                        deliveredChannels.push('SMS');
                        smsDispatched = true;
                    }
                } else if (sendResult.errors && sendResult.errors.length > 0) {
                    errors.push(...sendResult.errors);
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                LogError(`MJCommsV2NotificationTransport: NotificationEngine dispatch failed: ${msg}`);
                errors.push(msg);
            }
        }

        const directDispatcher = GetCollaborationCommsV2DirectMessageDispatcher();
        if (directDispatcher && Payload.Channels.Chat && Payload.RecipientChatHandle) {
            try {
                const sent = await directDispatcher({
                    Channel: 'Chat',
                    MessageTypeName: 'Chat',
                    To: Payload.RecipientChatHandle,
                    Subject: Payload.Subject,
                    Body: Payload.Message,
                    Payload,
                    Provider,
                    SystemUser,
                });
                if (sent) {
                    deliveredChannels.push('Chat');
                    chatDispatched = true;
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                LogError(`MJCommsV2NotificationTransport: Chat dispatch failed: ${msg}`);
                errors.push(msg);
            }
        }

        return {
            Success: errors.length === 0 && (deliveredChannels.length > 0 || !wantsUnifiedChannels),
            DeliveredChannels: deliveredChannels,
            InAppNotificationID: inAppNotificationId,
            EmailDispatched: emailDispatched,
            SMSDispatched: smsDispatched,
            ChatDispatched: chatDispatched,
            ...(errors.length > 0 ? { ErrorMessage: errors.join('; ') } : {}),
        };
    }
}

/**
 * Ensures the NT-1 `BaseRemotableOperation` classes are retained and installs the default
 * {@link MJCommsV2NotificationTransport} when no custom/test transport is registered.
 */
export function EnsureCollaborationCommsV2TransportRegistered(): void {
    LoadCollaborationNotificationOperations();
    LoadCollaborationDigestOperations();
    if (!GetCollaborationCommsV2Transport()) {
        RegisterCollaborationCommsV2Transport(new MJCommsV2NotificationTransport());
    }
}
