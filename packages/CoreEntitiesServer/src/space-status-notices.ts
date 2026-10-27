/**
 * The notice a space's members get when it enters a status whose `NotifyMembersOnEnter` is on (stage 1): one per active member
 * but the person who moved it, in app, through MJ's NotificationEngine as the shared-item notice goes. Its origin is a person's
 * act, so MJ's scoped notification configs may quiet it per application or role.
 */
import { LogError, RunView, type BaseEntity, type UserInfo } from '@memberjunction/core';
import { NotificationEngine } from '@memberjunction/notifications';
import { requireSystemUser } from './load-graph.js';
import { asMetadata, parseUuid } from './uuid.js';

export const SPACE_STATUS_NOTIFICATION_TYPE = 'Collaboration: Space Status Changed';
/** MJ's resource type for a Collaboration space, as the share notice names it. */
const SPACE_RESOURCE = '33642155-617E-4825-A2CC-F071A60F3739';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';

export interface SpaceStatusNoticeInput {
    spaceId: string;
    spaceName: string;
    actor: UserInfo;
    fromStatusName: string | null;
    toStatusName: string;
}

/** Sends the notice. A failure is logged, never thrown: the status change stands. Returns how many were sent. */
export async function notifySpaceStatusChange(entity: BaseEntity, input: SpaceStatusNoticeInput): Promise<number> {
    const provider = asMetadata(entity.ProviderToUse);
    const spaceId = parseUuid(input.spaceId);
    if (!provider || !spaceId) return 0;
    let sent = 0;
    try {
        const system = await requireSystemUser(entity);
        const members = await new RunView(entity.RunViewProviderToUse).RunView<{ UserID: string }>({
            EntityName: MEMBERS,
            ExtraFilter: `SpaceID = '${spaceId}' AND Status = 'Active'`,
            Fields: ['UserID'],
            ResultType: 'simple',
            MaxRows: 2000,
        }, system);
        if (!members.Success) {
            LogError(`Space status notice: the roster of ${spaceId} could not be read: ${members.ErrorMessage ?? 'unknown error'}`);
            return 0;
        }
        const actor = parseUuid(input.actor.ID);
        const recipients = [...new Set((members.Results ?? []).map((row) => parseUuid(row.UserID)).filter((id): id is string => !!id && id !== actor))];
        if (recipients.length === 0) return 0;
        await NotificationEngine.Instance.Config(false, system, provider);
        const actorName = input.actor.Name || input.actor.Email || 'Someone';
        for (const recipient of recipients) {
            try {
                await NotificationEngine.Instance.SendNotification({
                    userId: recipient,
                    typeNameOrId: SPACE_STATUS_NOTIFICATION_TYPE,
                    title: `${input.spaceName} is now ${input.toStatusName}`,
                    message: input.fromStatusName
                        ? `${actorName} moved ${input.spaceName} from ${input.fromStatusName} to ${input.toStatusName}.`
                        : `${actorName} moved ${input.spaceName} to ${input.toStatusName}.`,
                    resourceTypeId: SPACE_RESOURCE,
                    resourceRecordId: spaceId,
                    forceDeliveryChannels: { inApp: true, email: false, sms: false },
                }, system);
                sent += 1;
            } catch (error) {
                LogError(`Space status notice to ${recipient} was not delivered: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    } catch (error) {
        LogError(`Space status notice: ${error instanceof Error ? error.message : String(error)}`);
    }
    return sent;
}
