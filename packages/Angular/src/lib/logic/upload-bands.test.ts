import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowedUploadBands } from './upload-bands.ts';

describe('the bands a seat may choose for an upload', () => {
    it('offers a seat that cannot see Team only Shared', () => {
        assert.deepEqual(allowedUploadBands({ CanSeeTeamBand: false, CanPromoteBand: false }), ['Shared']);
    });

    it('offers a seat that sees Team but cannot promote only Team', () => {
        assert.deepEqual(allowedUploadBands({ CanSeeTeamBand: true, CanPromoteBand: false }), ['Team']);
    });

    it('offers both to a seat that sees Team and promotes', () => {
        assert.deepEqual(allowedUploadBands({ CanSeeTeamBand: true, CanPromoteBand: true }), ['Shared', 'Team']);
    });

    it('offers both when the seat is not known, and leaves the decision to the server', () => {
        assert.deepEqual(allowedUploadBands(null), ['Shared', 'Team']);
        assert.deepEqual(allowedUploadBands(undefined), ['Shared', 'Team']);
    });
});
