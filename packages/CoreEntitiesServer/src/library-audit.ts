import { BaseEntity, RunView, ValidationErrorInfo, ValidationErrorType, type UserInfo, type ValidationResult } from '@memberjunction/core';
import { authorizeNoticeWrite, authorizeUseWrite, type Band } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { parseUuid } from './uuid.js';

const ITEMS = 'MJ_BizApps_Collaboration: Space Items';

export async function libraryDecision(
    entity: BaseEntity,
    user: UserInfo,
    spaceId: string,
    itemId: string,
    decide: (item: { spaceId: string; band: Band }, spaces: Awaited<ReturnType<typeof loadWriteContext>>) => { ok: true } | { ok: false; message: string },
): Promise<string | null> {
    const system = await requireSystemUser(entity);
    const found = await new RunView(entity.RunViewProviderToUse).RunView<{ SpaceID: string; Band: Band }>({
        EntityName: ITEMS,
        ExtraFilter: `ID = '${itemId}'`,
        MaxRows: 1,
    }, system);
    if (!found.Success) {
        return found.ErrorMessage || 'The item could not be read.';
    }
    const item = found.Results?.[0];
    if (!item) {
        return 'The item is not in this space.';
    }
    const context = await loadWriteContext(entity, user, spaceId, null);
    const decision = decide({ spaceId: item.SpaceID, band: item.Band }, context);
    return decision.ok ? null : decision.message;
}

export function failLibrary(result: ValidationResult, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo('SpaceID', message, null, ValidationErrorType.Failure));
    return result;
}

export function requireIds(spaceId: string | null | undefined, itemId: string | null | undefined): { spaceId: string; itemId: string } | null {
    const space = parseUuid(spaceId);
    const item = parseUuid(itemId);
    if (!space || !item) return null;
    return { spaceId: space, itemId: item };
}
