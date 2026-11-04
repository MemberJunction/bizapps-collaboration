import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { ContentPipelineStartup, ContentUploadIngestor } from '@memberjunction/content-pipeline';
import { SPACE_FILES_CONTENT_SOURCE_ID } from './SpaceItemEntityServer.js';
import { parseUuid } from './uuid.js';

const FILES_ENTITY = 'MJ: Files';
const SPACE_ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';

export interface BackfillSpaceFilesResult {
    totalItems: number;
    ingestedCount: number;
    alreadyIngestedCount: number;
    skippedMissingFileCount: number;
    failedCount: number;
    itemIds: string[];
}

function extractFileId(rawRecordId: string | null | undefined): string | null {
    if (!rawRecordId) return null;
    const trimmed = rawRecordId.trim();
    const candidate = trimmed.toLowerCase().startsWith('id|') ? trimmed.slice(3) : trimmed;
    return parseUuid(candidate);
}

/**
 * Idempotent backfill that ingests existing uploaded `MJ_BizApps_Collaboration: Space Items` rows
 * (`EntityID = MJ: Files`) into the `"Space files"` `Upload` Content Source.
 */
export async function backfillSpaceFiles(
    provider: IMetadataProvider,
    contextUser: UserInfo,
): Promise<BackfillSpaceFilesResult> {
    const filesEntity = provider.EntityByName(FILES_ENTITY);
    if (!filesEntity) {
        throw new Error(`backfillSpaceFiles: '${FILES_ENTITY}' entity was not found in metadata`);
    }

    await ContentPipelineStartup.Instance.HandleStartup(contextUser, provider);

    const rv = RunView.FromMetadataProvider(provider);
    const itemsRes = await rv.RunView<{ ID: string; RecordID: string }>(
        {
            EntityName: SPACE_ITEMS_ENTITY,
            ExtraFilter: `EntityID = '${filesEntity.ID}'`,
            Fields: ['ID', 'RecordID'],
            OrderBy: '__mj_CreatedAt ASC, ID ASC',
            IgnoreMaxRows: true,
            ResultType: 'simple',
            BypassCache: true,
        },
        contextUser,
    );
    if (!itemsRes.Success) {
        throw new Error(`backfillSpaceFiles: could not query '${SPACE_ITEMS_ENTITY}': ${itemsRes.ErrorMessage}`);
    }

    const items = itemsRes.Results ?? [];
    if (items.length === 0) {
        return {
            totalItems: 0,
            ingestedCount: 0,
            alreadyIngestedCount: 0,
            skippedMissingFileCount: 0,
            failedCount: 0,
            itemIds: [],
        };
    }

    const fileIdSet = new Set<string>();
    for (const item of items) {
        const fileId = extractFileId(item.RecordID);
        if (fileId) {
            fileIdSet.add(fileId.toLowerCase());
        }
    }

    const filesById = new Map<string, { ID: string; Name: string; Description: string | null }>();
    if (fileIdSet.size > 0) {
        const fileIdsClause = [...fileIdSet].map((id) => `'${id.replace(/'/g, "''")}'`).join(', ');
        const filesRes = await rv.RunView<{ ID: string; Name: string; Description: string | null }>(
            {
                EntityName: FILES_ENTITY,
                ExtraFilter: `ID IN (${fileIdsClause})`,
                Fields: ['ID', 'Name', 'Description'],
                IgnoreMaxRows: true,
                ResultType: 'simple',
                BypassCache: true,
            },
            contextUser,
        );
        if (!filesRes.Success) {
            throw new Error(`backfillSpaceFiles: could not query '${FILES_ENTITY}': ${filesRes.ErrorMessage}`);
        }
        for (const f of filesRes.Results ?? []) {
            const fid = parseUuid(f.ID);
            if (fid) {
                filesById.set(fid.toLowerCase(), f);
            }
        }
    }

    let ingestedCount = 0;
    let alreadyIngestedCount = 0;
    let skippedMissingFileCount = 0;
    let failedCount = 0;
    const itemIds: string[] = [];

    for (const item of items) {
        const fileId = extractFileId(item.RecordID);
        const fileRow = fileId ? filesById.get(fileId.toLowerCase()) : undefined;
        if (!fileId || !fileRow) {
            skippedMissingFileCount += 1;
            continue;
        }
        try {
            const res = await ContentUploadIngestor.Ingest({
                ContentSourceID: SPACE_FILES_CONTENT_SOURCE_ID,
                FileID: fileRow.ID,
                Name: fileRow.Name,
                Description: fileRow.Description ?? null,
                Origin: {
                    EntityName: SPACE_ITEMS_ENTITY,
                    RecordID: item.ID,
                },
                RunNow: true,
                ContextUser: contextUser,
                Provider: provider,
            });
            if (res.Created) {
                ingestedCount += 1;
                itemIds.push(item.ID);
            } else {
                alreadyIngestedCount += 1;
            }
        } catch (error) {
            failedCount += 1;
            LogError(
                `backfillSpaceFiles: failed to ingest Space Item ${item.ID} (FileID ${fileId}): ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    return {
        totalItems: items.length,
        ingestedCount,
        alreadyIngestedCount,
        skippedMissingFileCount,
        failedCount,
        itemIds,
    };
}
