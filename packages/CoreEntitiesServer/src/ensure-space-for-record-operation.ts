/**
 * `EnsureSpaceForRecord` as a server operation (the extension model's item 85): the owning app's screen, or any caller over GraphQL,
 * asks for the space of a type anchored to one of its records, and gets it created the first time. Who may: anyone who can update
 * the record, by MJ's own permissions and row-level security (the record is read as the caller), unless the type's `ValidateAnchor`
 * refuses, which `EnsureSpaceForRecord` asks on the way.
 */
import { type IMetadataProvider, LogError, RunView, type UserInfo } from '@memberjunction/core';
import { EnsureSpaceForRecord } from './ensure-space-for-record.js';
import { asMetadata } from './uuid.js';

export interface EnsureSpaceForRecordInput {
    TypeCode: string;
    EntityName: string;
    RecordID: string;
    SpaceName?: string | null;
    AnchorRole?: string | null;
    InheritsMembership?: boolean | null;
}

export interface EnsureSpaceForRecordOutcome {
    ok: boolean;
    spaceId?: string;
    message?: string;
}

export async function ensureSpaceForRecordForUser(provider: IMetadataProvider, user: UserInfo, input: EnsureSpaceForRecordInput): Promise<EnsureSpaceForRecordOutcome> {
    const md = asMetadata(provider);
    if (!md) return { ok: false, message: 'Space refused: the provider cannot create entities.' };
    const entityName = (input.EntityName ?? '').trim();
    const recordId = (input.RecordID ?? '').trim();
    const typeCode = (input.TypeCode ?? '').trim();
    if (!entityName || !recordId || !typeCode) return { ok: false, message: 'Space refused: the type, the entity and the record are all needed.' };

    const entity = md.EntityByName(entityName);
    if (!entity) return { ok: false, message: `Space refused: there is no entity named "${entityName}".` };
    if (!entity.GetUserPermisions(user).CanUpdate) return { ok: false, message: `Space refused: you cannot update ${entity.Name} records, so you cannot open a space for one.` };
    if (entity.PrimaryKeys.length !== 1) return { ok: false, message: `Space refused: ${entity.Name} has a composite key, which an anchored space does not take yet.` };

    // The record, read as the caller: row-level security decides whether they see it at all
    const key = entity.PrimaryKeys[0];
    const value = recordId.toLowerCase().startsWith('id|') ? recordId.slice(3) : recordId;
    const read = await RunView.FromMetadataProvider(provider).RunView<Record<string, unknown>>({
        EntityName: entity.Name,
        ExtraFilter: `[${key.Name}] = '${value.replace(/'/g, "''")}'`,
        Fields: [key.Name],
        ResultType: 'simple',
        MaxRows: 1,
    }, user);
    if (!read.Success) return { ok: false, message: `Space refused: the record could not be read: ${read.ErrorMessage ?? 'unknown error'}` };
    if (!read.Results?.[0]) return { ok: false, message: `Space refused: no ${entity.Name} record you can see has that id.` };

    try {
        const space = await EnsureSpaceForRecord({
            typeCode,
            entityName: entity.Name,
            recordId: value,
            spaceName: input.SpaceName?.trim() || undefined,
            anchorRole: input.AnchorRole?.trim() || undefined,
            inheritsMembership: input.InheritsMembership ?? undefined,
            contextUser: user,
            provider,
        });
        return { ok: true, spaceId: space.ID };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        LogError(`EnsureSpaceForRecord (${typeCode}, ${entity.Name} ${value}) failed: ${message}`);
        return { ok: false, message: message.startsWith('Space') ? message : `Space refused: ${message}` };
    }
}
