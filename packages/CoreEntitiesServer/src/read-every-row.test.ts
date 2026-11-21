import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RunView, type IRunViewProvider, type RunViewParams, type RunViewResult, type UserInfo } from '@memberjunction/core';
import { readEveryRow } from '../dist/read-every-row.js';

const SEATS = 'MJ_BizApps_Collaboration: Space Members';
const reader = { ID: '00000000-0000-4000-8000-000000000001', Name: 'System' } as UserInfo;

interface SeatRow { ID?: string | null; UserID: string }

function seatId(n: number): string {
    return `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function seats(count: number): SeatRow[] {
    return Array.from({ length: count }, (_, index) => ({ ID: seatId(index + 1), UserID: `user-${index + 1}` }));
}

function result<T>(rows: readonly object[], failure?: string): RunViewResult<T> {
    return { Success: !failure, Results: rows as unknown as T[], RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0, ErrorMessage: failure ?? '' };
}

/** A provider that pages the way MemberJunction does: ordered by ID, after the cursor, at most MaxRows. */
function pagingView(rows: readonly SeatRow[], calls: RunViewParams[], respond?: (params: RunViewParams, page: SeatRow[]) => RunViewResult<SeatRow>): RunView {
    const provider = {
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            calls.push(params);
            const after = params.AfterKey ? String(params.AfterKey.GetValueByFieldName('ID')).toLowerCase() : '';
            const ordered = [...rows].sort((a, b) => String(a.ID).localeCompare(String(b.ID)));
            const page = ordered.filter((row) => String(row.ID).toLowerCase() > after).slice(0, params.MaxRows);
            return (respond ? respond(params, page) : result<SeatRow>(page)) as unknown as RunViewResult<T>;
        },
    };
    return new RunView(provider as unknown as IRunViewProvider);
}

const query = { EntityName: SEATS, ExtraFilter: `Status = 'Active'`, Fields: ['UserID'] };

describe('readEveryRow', () => {
    it('reads past the first page, to the end, in pages of the size asked for', async () => {
        const calls: RunViewParams[] = [];
        const rows = await readEveryRow<SeatRow>(pagingView(seats(7), calls), query, reader, 3);
        assert.equal(rows.length, 7);
        assert.deepEqual(rows.map((row) => row.UserID), seats(7).map((row) => row.UserID));
        assert.equal(calls.length, 3, 'three pages: 3, 3 and 1');
        assert.equal(calls[0].AfterKey, undefined, 'the first page has no cursor');
        assert.equal(String(calls[1].AfterKey?.GetValueByFieldName('ID')).toLowerCase(), seatId(3));
        assert.equal(String(calls[2].AfterKey?.GetValueByFieldName('ID')).toLowerCase(), seatId(6));
        for (const call of calls) {
            assert.equal(call.MaxRows, 3);
            assert.equal(call.OrderBy, 'ID');
            assert.ok(call.Fields?.includes('ID'), 'ID is read, since the next page starts after it');
        }
    });

    it('asks once more when the rows end on a page boundary, and stops on the empty page', async () => {
        const calls: RunViewParams[] = [];
        const rows = await readEveryRow<SeatRow>(pagingView(seats(6), calls), query, reader, 3);
        assert.equal(rows.length, 6);
        assert.equal(calls.length, 3);
    });

    it('throws when a page fails, whichever page it is', async () => {
        const failSecond = (params: RunViewParams, page: SeatRow[]) => (params.AfterKey ? result<SeatRow>([], 'the connection dropped') : result<SeatRow>(page));
        await assert.rejects(() => readEveryRow<SeatRow>(pagingView(seats(7), [], failSecond), query, reader, 3), /the connection dropped/);
        const failFirst = () => result<SeatRow>([], 'the view could not be run');
        await assert.rejects(() => readEveryRow<SeatRow>(pagingView(seats(7), [], failFirst), query, reader, 3), /the view could not be run/);
    });

    it('refuses a provider that ignores the cursor, rather than looping or stopping early', async () => {
        const firstPageAlways = () => result<SeatRow>(seats(3));
        await assert.rejects(() => readEveryRow<SeatRow>(pagingView(seats(7), [], firstPageAlways), query, reader, 3), /returned a row twice/);
    });

    it('refuses a full page whose last row has no key to continue from', async () => {
        const noKeys = (_params: RunViewParams, page: SeatRow[]) => result<SeatRow>(page.map((row) => ({ UserID: row.UserID })));
        await assert.rejects(() => readEveryRow<SeatRow>(pagingView(seats(7), [], noKeys), query, reader, 3), /no key to continue from/);
    });

    it('refuses a page size that is not a whole number of rows', async () => {
        for (const size of [0, -1, 2.5, Number.NaN]) {
            await assert.rejects(() => readEveryRow<SeatRow>(pagingView(seats(2), []), query, reader, size), /not a whole number of rows/);
        }
    });
});
