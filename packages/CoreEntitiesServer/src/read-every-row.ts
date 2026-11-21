import { CompositeKey, type RunView, type UserInfo } from '@memberjunction/core';
import { parseUuid } from './uuid.js';

/**
 * The rows asked for in one round trip. It is not a ceiling on the read: `readEveryRow` asks again until a page comes back
 * short, so the answer is the same whatever the size.
 */
export const EVERY_ROW_PAGE_SIZE = 1000;

export interface EveryRowQuery {
    /** An entity whose one primary key column is a uniqueidentifier named `ID` (the seats are: Space Members). */
    EntityName: string;
    ExtraFilter: string;
    /** The columns wanted. `ID` is read as well, since the next page starts after it. */
    Fields: readonly string[];
}

/**
 * Every row the filter matches, read by MemberJunction's keyset paging (`RunViewParams.AfterKey`), page after page until one
 * comes back short. For a read whose answer decides what someone else may see, where a missing row widens it: there is no row
 * count at which this returns part of the answer. It throws instead, when a page fails, when a full page cannot be continued
 * from (no key on its last row), and when the provider hands back a row it already gave, which means it did not honour the
 * cursor and the walk would never be known to be complete.
 */
export async function readEveryRow<T extends { ID?: string | null }>(
    view: RunView,
    query: EveryRowQuery,
    user: UserInfo,
    pageSize: number = EVERY_ROW_PAGE_SIZE,
): Promise<T[]> {
    if (!Number.isInteger(pageSize) || pageSize < 1) {
        throw new Error(`Refusing the read: ${query.EntityName} was asked for in pages of ${pageSize}, which is not a whole number of rows.`);
    }
    const fields = query.Fields.includes('ID') ? [...query.Fields] : ['ID', ...query.Fields];
    const rows: T[] = [];
    const seen = new Set<string>();
    let afterKey: CompositeKey | undefined;
    for (;;) {
        const page = await view.RunView<T>({
            EntityName: query.EntityName,
            ExtraFilter: query.ExtraFilter,
            Fields: fields,
            OrderBy: 'ID',
            MaxRows: pageSize,
            AfterKey: afterKey,
            ResultType: 'simple',
        }, user);
        if (!page.Success) {
            throw new Error(page.ErrorMessage || `Could not read ${query.EntityName}.`);
        }
        const pageRows = page.Results ?? [];
        refuseRepeatedRows(query.EntityName, pageRows, seen);
        rows.push(...pageRows);
        if (pageRows.length < pageSize) {
            return rows;
        }
        afterKey = cursorAfter(query.EntityName, pageRows[pageRows.length - 1]);
    }
}

/** A row seen on an earlier page means the cursor was ignored; going on would loop, and stopping would pass a part for the whole. */
function refuseRepeatedRows(entityName: string, pageRows: readonly { ID?: string | null }[], seen: Set<string>): void {
    for (const row of pageRows) {
        const id = parseUuid(row.ID);
        if (!id) continue;
        if (seen.has(id)) {
            throw new Error(`Refusing the read: ${entityName} returned a row twice, so the pages do not add up to the whole.`);
        }
        seen.add(id);
    }
}

function cursorAfter(entityName: string, lastRow: { ID?: string | null }): CompositeKey {
    const lastId = parseUuid(lastRow.ID);
    if (!lastId) {
        throw new Error(`Refusing the read: a full page of ${entityName} came back with no key to continue from, so the read would be incomplete.`);
    }
    return CompositeKey.FromID(lastId);
}
