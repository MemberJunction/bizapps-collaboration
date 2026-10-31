/**
 * Word-level diff helper for the Space Pages "Review & publish" drawer.
 *
 * Uses a longest-common-subsequence table over whitespace-preserving tokens so
 * authors can see exact word additions and removals before publishing a draft.
 */

export type DiffOp = 'equal' | 'insert' | 'delete';

export interface DiffSegment {
    op: DiffOp;
    text: string;
}

const MAX_TOKENS = 800;

/**
 * Compute a word-level diff between `before` (currently live) and `after` (draft).
 */
export function DiffWords(before: string | null | undefined, after: string | null | undefined): DiffSegment[] {
    const a = Tokenize(before ?? '');
    const b = Tokenize(after ?? '');

    if (a.length === 0 && b.length === 0) return [];
    if (a.length === 0) return [{ op: 'insert', text: b.join('') }];
    if (b.length === 0) return [{ op: 'delete', text: a.join('') }];

    if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
        if (before === after) return [{ op: 'equal', text: after ?? '' }];
        return [
            { op: 'delete', text: before ?? '' },
            { op: 'insert', text: after ?? '' },
        ];
    }

    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            if (a[i] === b[j]) {
                dp[i][j] = 1 + dp[i + 1][j + 1];
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const raw: DiffSegment[] = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (a[i] === b[j]) {
            raw.push({ op: 'equal', text: a[i] });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            raw.push({ op: 'delete', text: a[i] });
            i++;
        } else {
            raw.push({ op: 'insert', text: b[j] });
            j++;
        }
    }
    while (i < m) {
        raw.push({ op: 'delete', text: a[i++] });
    }
    while (j < n) {
        raw.push({ op: 'insert', text: b[j++] });
    }

    const merged: DiffSegment[] = [];
    for (const seg of raw) {
        const last = merged[merged.length - 1];
        if (last && last.op === seg.op) {
            last.text += seg.text;
        } else {
            merged.push({ ...seg });
        }
    }
    return merged;
}

/** True when `before` and `after` differ after normalizing trailing whitespace. */
export function HasTextChange(before: string | null | undefined, after: string | null | undefined): boolean {
    return (before ?? '').trim() !== (after ?? '').trim();
}

/** Count added and removed word tokens in a segment list. */
export function SummarizeDiff(segments: DiffSegment[]): { addedWords: number; removedWords: number } {
    let addedWords = 0;
    let removedWords = 0;
    for (const s of segments) {
        if (s.op === 'insert') addedWords += CountWords(s.text);
        else if (s.op === 'delete') removedWords += CountWords(s.text);
    }
    return { addedWords, removedWords };
}

function Tokenize(text: string): string[] {
    if (!text) return [];
    return text.match(/\S+|\s+/g) ?? [];
}

function CountWords(text: string): number {
    const matches = text.trim().match(/\S+/g);
    return matches ? matches.length : 0;
}
