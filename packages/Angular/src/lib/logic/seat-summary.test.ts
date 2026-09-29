import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeSeats } from './seat-summary.ts';

const seat = (name: string, band: string, status: string) => ({ name, initials: name.slice(0, 2).toUpperCase(), band, status });

describe('the header seat summary', () => {
    const seats = [
        seat('Ada', 'Team', 'Active'),
        seat('Sam', 'Team', 'Active'),
        seat('Bea', 'Shared', 'Active'),
        seat('Pat', 'Shared', 'Invited'),
        seat('Remy', 'Shared', 'Removed'),
    ];

    it('counts only Active seats', () => {
        const summary = summarizeSeats(seats);
        assert.equal(summary.totalPeople, 3);
        assert.equal(summary.staffAvatars.length, 2);
        assert.equal(summary.outsideAvatars.length, 1);
        assert.equal(summary.audienceSummary, '2 Team · 1 Outside');
    });

    it('does not let an invited or removed outside seat make the space Shared', () => {
        const summary = summarizeSeats([seat('Ada', 'Team', 'Active'), seat('Pat', 'Shared', 'Invited'), seat('Remy', 'Shared', 'Removed')]);
        assert.equal(summary.audienceBand, 'Team');
        assert.equal(summary.outsideAvatars.length, 0);
    });

    it('makes the space Shared once an outside seat is Active', () => {
        assert.equal(summarizeSeats(seats).audienceBand, 'Shared');
    });

    it('summarizes a space with no seats', () => {
        const summary = summarizeSeats([]);
        assert.equal(summary.totalPeople, 0);
        assert.equal(summary.audienceBand, 'Team');
    });
});
