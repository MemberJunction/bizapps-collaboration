import { readFileSync } from 'node:fs';

/** Headers become keys. These files have no quoted commas. */
export function readCsv(path: string): Array<Record<string, string>> {
    const lines = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    const headers = lines[0].split(',').map((cell) => cell.trim());
    return lines.slice(1).map((line) => {
        const cells = line.split(',').map((cell) => cell.trim());
        return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    });
}
