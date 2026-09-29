import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDate, formatDateTime, UNKNOWN_DATE } from './format-date.ts';

describe('dates are shown in the locale asked for, with the year', () => {
    const when = '2026-09-29T14:05:00Z';

    it('follows the locale', () => {
        assert.match(formatDate(when, 'en-US'), /Sep 29, 2026|Sep 30, 2026/);
        assert.match(formatDate(when, 'de-DE'), /2026/);
        assert.notEqual(formatDate(when, 'en-US'), formatDate(when, 'de-DE'));
    });

    it('adds the time when asked to', () => {
        assert.match(formatDateTime(when, 'en-US'), /\d{1,2}:\d{2}/);
        assert.doesNotMatch(formatDate(when, 'en-US'), /\d{1,2}:\d{2}/);
    });

    it('reads a bad or missing value as unknown, never "Invalid Date"', () => {
        assert.equal(formatDate('not a date'), UNKNOWN_DATE);
        assert.equal(formatDate(''), UNKNOWN_DATE);
        assert.equal(formatDateTime(null), UNKNOWN_DATE);
        assert.equal(formatDateTime(undefined), UNKNOWN_DATE);
    });
});
