/** What is shown when a date is missing or won't parse. */
export const UNKNOWN_DATE = 'Unknown date';

function parse(value: string | Date | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** A date in the person's own locale, with the year ("Sep 29, 2026"). A bad or missing value reads as unknown, never "Invalid Date". */
export function formatDate(value: string | Date | null | undefined, locale?: string): string {
    const date = parse(value);
    return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date) : UNKNOWN_DATE;
}

/** A date and time in the person's own locale, for places where the hour matters, such as chat and recent use. */
export function formatDateTime(value: string | Date | null | undefined, locale?: string): string {
    const date = parse(value);
    return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : UNKNOWN_DATE;
}
