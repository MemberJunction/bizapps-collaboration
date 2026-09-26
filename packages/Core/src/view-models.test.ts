import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    avatarColorClass,
    AVATAR_COLOR_CLASSES,
    summarizeAudience,
    computeSpaceProgress,
    mergeAgenda,
    type AudienceMemberInput,
    type AgendaItem,
} from './view-models.ts';

describe('view-models (L0)', () => {
    describe('avatarColorClass', () => {
        it('returns stable color classes in c1..c10', () => {
            const c1 = avatarColorClass('user-123');
            const c2 = avatarColorClass('user-123');
            assert.equal(c1, c2, 'identical input produces identical color class');
            assert.ok(AVATAR_COLOR_CLASSES.includes(c1), 'result is in AVATAR_COLOR_CLASSES');
        });

        it('handles empty string gracefully', () => {
            assert.equal(avatarColorClass(''), 'c1');
        });

        it('distributes across different classes', () => {
            const classes = new Set(
                ['ada', 'sam', 'priya', 'casey', 'bea', 'omar', 'lena', 'jordan', 'remy', 'mia', 'ravi', 'dana'].map(
                    (id) => avatarColorClass(id),
                ),
            );
            assert.ok(classes.size > 3, 'distributes across multiple classes');
        });
    });

    describe('summarizeAudience', () => {
        const members: AudienceMemberInput[] = [
            { id: '1', organization: 'Meridian', isExternal: false },
            { id: '2', organization: 'Meridian', isExternal: false },
            { id: '3', organization: 'Meridian', isExternal: false },
            { id: '4', organization: 'Northwind', isExternal: true },
            { id: '5', organization: 'Northwind', isExternal: true },
            { id: '6', organization: 'Northwind', isExternal: true },
            { id: '7', organization: 'Northwind', isExternal: true },
            { id: '8', organization: 'Northwind', isExternal: true },
            { id: '9', organization: 'Northwind', isExternal: true },
        ];

        it('formats pill summary with internal and external counts from data', () => {
            const summary = summarizeAudience(members);
            assert.equal(summary.totalCount, 9);
            assert.equal(summary.internalCount, 3);
            assert.equal(summary.externalCount, 6);
            assert.equal(summary.pillSummary, '9 people · 3 Meridian · 6 Northwind');
        });

        it('formats composer and upload lines for staff viewer', () => {
            const summary = summarizeAudience(members, false);
            assert.equal(summary.composerLine, '9 people will see this, 6 at Northwind');
            assert.equal(summary.uploadLine, 'Shared with 9 people (6 at Northwind)');
        });

        it('formats composer and upload lines for external viewer', () => {
            const summary = summarizeAudience(members, true);
            assert.equal(summary.composerLine, '9 people will see this, 3 at Meridian');
            assert.equal(summary.uploadLine, 'Shared with 9 people (3 at Meridian)');
        });

        it('formats internal-only team lines when no external members', () => {
            const internalOnly: AudienceMemberInput[] = [
                { id: '1', organization: 'Meridian', isExternal: false },
                { id: '2', organization: 'Meridian', isExternal: false },
            ];
            const summary = summarizeAudience(internalOnly);
            assert.equal(summary.composerLine, 'Only the 2 Meridian staff here will see this');
            assert.equal(summary.uploadLine, 'Only the 2 Meridian staff here will see this');
        });

        it('uses singular "1 person" not "1 people"', () => {
            const singleMember: AudienceMemberInput[] = [
                { id: '1', organization: 'Acme', isExternal: false },
            ];
            const summary = summarizeAudience(singleMember);
            assert.equal(summary.totalCount, 1);
            assert.equal(summary.pillSummary, '1 person · 1 Acme');
            assert.equal(summary.composerLine, 'Only the 1 Acme staff here will see this');
            assert.equal(summary.uploadLine, 'Only the 1 Acme staff here will see this');
        });

        it('supports multiple outside organizations grouped by their own organization', () => {
            const multiOrg: AudienceMemberInput[] = [
                { id: '1', organization: 'Meridian', isExternal: false },
                { id: '2', organization: 'Northwind', isExternal: true },
                { id: '3', organization: 'Northwind', isExternal: true },
                { id: '4', organization: 'Acme', isExternal: true },
            ];
            const summary = summarizeAudience(multiOrg, false);
            assert.equal(summary.totalCount, 4);
            assert.equal(summary.internalCount, 1);
            assert.equal(summary.externalCount, 3);
            assert.equal(summary.pillSummary, '4 people · 1 Meridian · 2 Northwind · 1 Acme');
            assert.equal(summary.composerLine, '4 people will see this, 2 at Northwind, 1 at Acme');
        });
    });

    describe('computeSpaceProgress', () => {
        it('calculates week progress and percent complete', () => {
            const start = '2026-08-01T00:00:00Z';
            const end = '2026-10-10T00:00:00Z';
            const now = '2026-09-15T00:00:00Z';
            const progress = computeSpaceProgress(start, end, now);
            assert.equal(progress.totalWeeks, 10);
            assert.equal(progress.currentWeek, 7);
            assert.equal(progress.progressLabel, 'Week 7 of 10');
            assert.ok(progress.percentComplete >= 60 && progress.percentComplete <= 70);
        });

        it('handles null dates safely', () => {
            const progress = computeSpaceProgress(null, null);
            assert.equal(progress.totalWeeks, 0);
            assert.equal(progress.progressLabel, '');
        });
    });

    describe('mergeAgenda', () => {
        it('merges, deduplicates by id, and sorts chronologically', () => {
            const d1 = new Date('2026-10-01T10:00:00Z');
            const d2 = new Date('2026-10-05T10:00:00Z');
            const d3 = new Date('2026-10-15T10:00:00Z');

            const list1: AgendaItem[] = [
                { id: 'item-2', title: 'Second', date: d2 },
                { id: 'item-1', title: 'First', date: d1 },
            ];
            const list2: AgendaItem[] = [
                { id: 'item-1', title: 'First duplicate', date: d1 },
                { id: 'item-3', title: 'Third', date: d3 },
            ];

            const merged = mergeAgenda([list1, list2]);
            assert.equal(merged.length, 3);
            assert.equal(merged[0].id, 'item-1');
            assert.equal(merged[1].id, 'item-2');
            assert.equal(merged[2].id, 'item-3');
        });
    });
});
