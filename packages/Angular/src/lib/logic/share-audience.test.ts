import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shareAudience, type AudienceSeat } from './share-audience.ts';

const seat = (name: string, band: string, status = 'Active'): AudienceSeat => ({ id: name, name, band, status });

describe("who a share reaches", () => {
    it('says nobody new gains access in Studio, where only staff sit', () => {
        const studio = [seat('Ada', 'Team'), seat('Sam', 'Team')];
        const audience = shareAudience(studio);
        assert.equal(audience.header, 'Nobody new gains access');
        assert.deepEqual(audience.people, []);
    });

    it("lists only the Active outside seats in Discovery, not staff, the invited or the removed", () => {
        const discovery = [seat('Ada', 'Team'), seat('Bea', 'Shared'), seat('Remy', 'Shared', 'Removed'), seat('Pat', 'Shared', 'Invited')];
        const audience = shareAudience(discovery);
        assert.deepEqual(audience.people.map((p) => p.name), ['Bea']);
        assert.equal(audience.subtitle, '1 outside participant');
    });

    it("does not fall back to everyone when the only outside seats are Invited or Removed", () => {
        const audience = shareAudience([seat('Ada', 'Team'), seat('Remy', 'Shared', 'Removed')]);
        assert.equal(audience.people.length, 0);
    });
});
