// A read with `MaxRows: 2000` returns 2,000 rows of 2,001 and says nothing. Where the rows decide who may see what (a roster, a
// tree, a set of grants), the missing one widens the answer. So a numeric row cap in hand-written source has to say what
// happens at the bound, on the same line or the line directly above it:
//
//     MaxRows: 2000, // row-cap-ok: refuses on a full page
//
// `MaxRows: 1` needs no marker: it asks for one row. A read that must return every row has no cap at all (it pages; see
// `readEveryRow` in collaboration-core-entities-server).
//
// The caps that were unmarked when this check arrived are counted per file in scripts/row-caps-baseline.json, and the check is a
// ratchet over that file: it fails when a file holds more unmarked caps than its baseline, or holds one and has no baseline. It
// only notes a count that has fallen. `--update-baseline` lowers the baseline to what the tree holds now; it never raises a
// count and never adds a file, so a new cap is marked or removed, not baselined.
//
//   node scripts/check-row-caps.mjs
//   node scripts/check-row-caps.mjs --update-baseline
//   node scripts/check-row-caps.mjs --self-test
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASELINE_FILE = join('scripts', 'row-caps-baseline.json');
const EXAMPLES_DIR = join('packages', 'ExampleSpaceTypes');
/** The harness reads a seeded world of known size; its caps are test code. */
const SKIPPED_PACKAGES = new Set(['IntegrationTests']);
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'generated']);
const TEST_FILE = /\.(test|spec)\.ts$/;

/** `MaxRows: 2000`, and `MaxRows: something ?? 2000`, whose default is as much a cap. */
const ROW_CAP = /\bMaxRows\s*:\s*(?:[^,;{}\n]*?\?\?\s*)?(\d[\d_]*)\b/g;
/** The marker, with a reason after it. */
const MARKER = /row-cap-ok:\s*\S/;

/** The unmarked numeric row caps in one file's text, as `{ line, cap }` (lines count from 1). */
export function unmarkedCaps(text) {
    const lines = text.split('\n');
    const found = [];
    lines.forEach((line, index) => {
        const marked = MARKER.test(line) || (index > 0 && MARKER.test(lines[index - 1]));
        for (const match of line.matchAll(ROW_CAP)) {
            const cap = Number(match[1].replaceAll('_', ''));
            if (cap !== 1 && !marked) found.push({ line: index + 1, cap });
        }
    });
    return found;
}

/**
 * The ratchet. `counts` and `baseline` map a file to its number of unmarked caps. `failures` are files above their baseline
 * and files with a cap and no baseline; `fallen` are baseline entries the tree is now under (a file with none left counts 0).
 */
export function compare(counts, baseline) {
    const failures = [];
    const fallen = [];
    for (const [file, count] of Object.entries(counts)) {
        const allowed = baseline[file];
        if (allowed === undefined) failures.push({ file, count, allowed: 0 });
        else if (count > allowed) failures.push({ file, count, allowed });
    }
    for (const [file, allowed] of Object.entries(baseline)) {
        const count = counts[file] ?? 0;
        if (count < allowed) fallen.push({ file, count, allowed });
    }
    return { failures, fallen };
}

/** The baseline lowered to the tree: no count rises, no file is added, and a file with no unmarked cap left is dropped. */
export function lowered(counts, baseline) {
    const next = {};
    for (const file of Object.keys(baseline).sort()) {
        const count = Math.min(baseline[file], counts[file] ?? 0);
        if (count > 0) next[file] = count;
    }
    return next;
}

function sourceFiles(dir, files = []) {
    for (const name of readdirSync(dir)) {
        if (SKIPPED_DIRS.has(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) sourceFiles(path, files);
        else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !TEST_FILE.test(name)) files.push(path);
    }
    return files;
}

// The `src` folders of hand-written packages: packages/*/src and packages/ExampleSpaceTypes/*/src.
function sourceRoots() {
    const roots = [];
    for (const parent of ['packages', EXAMPLES_DIR]) {
        for (const name of readdirSync(parent)) {
            if (parent === 'packages' && SKIPPED_PACKAGES.has(name)) continue;
            const src = join(parent, name, 'src');
            if (existsSync(src) && statSync(src).isDirectory()) roots.push(src);
        }
    }
    return roots;
}

/** Every scanned file that holds an unmarked cap, with its caps. Paths use `/` so the baseline reads the same on any machine. */
export function scanTree() {
    const byFile = {};
    for (const root of sourceRoots()) {
        for (const file of sourceFiles(root)) {
            const caps = unmarkedCaps(readFileSync(file, 'utf8'));
            if (caps.length) byFile[file.replaceAll('\\', '/')] = caps;
        }
    }
    return byFile;
}

function readBaseline() {
    if (!existsSync(BASELINE_FILE)) throw new Error(`${BASELINE_FILE} is missing; the check has nothing to hold the tree to`);
    const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
    for (const [file, count] of Object.entries(baseline)) {
        if (!Number.isInteger(count) || count < 1) throw new Error(`${BASELINE_FILE}: ${file} has the count ${count}; a count is a whole number above zero`);
    }
    return baseline;
}

function selfTest() {
    const expect = (what, actual, wanted) => {
        if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`self-test: ${what} read as ${JSON.stringify(actual)}, not ${JSON.stringify(wanted)}`);
    };
    expect('an unmarked cap', unmarkedCaps('a\n    MaxRows: 2000,\n'), [{ line: 2, cap: 2000 }]);
    expect('a cap with no space, and one written 5_000', unmarkedCaps('{ MaxRows:200 }\n{ MaxRows: 5_000 }'), [{ line: 1, cap: 200 }, { line: 2, cap: 5000 }]);
    expect('a defaulted cap', unmarkedCaps('MaxRows: options?.maxRows ?? 2000,'), [{ line: 1, cap: 2000 }]);
    expect('one row', unmarkedCaps('MaxRows: 1,\nMaxRows: 1 }'), []);
    expect('ten rows are not one row', unmarkedCaps('MaxRows: 10,'), [{ line: 1, cap: 10 }]);
    expect('a cap that is not a number', unmarkedCaps('MaxRows: pageSize,\nMaxRows: options.maxRows,'), []);
    expect('a marker on the line', unmarkedCaps('MaxRows: 2000, // row-cap-ok: refuses on a full page'), []);
    expect('a marker on the line above', unmarkedCaps('// row-cap-ok: UI page size; pages on scroll\nMaxRows: 50,'), []);
    expect('a marker two lines above', unmarkedCaps('// row-cap-ok: too far\n\nMaxRows: 50,'), [{ line: 3, cap: 50 }]);
    expect('a marker with no reason', unmarkedCaps('MaxRows: 50, // row-cap-ok:'), [{ line: 1, cap: 50 }]);
    expect('two caps on a line', unmarkedCaps('a({ MaxRows: 5 }); b({ MaxRows: 6 });'), [{ line: 1, cap: 5 }, { line: 1, cap: 6 }]);
    expect('another property', unmarkedCaps('UserViewMaxRows: 500, maxRows: 20'), []);

    const baseline = { 'a.ts': 2, 'b.ts': 1, 'gone.ts': 3 };
    expect('at the baseline', compare({ 'a.ts': 2, 'b.ts': 1, 'gone.ts': 3 }, baseline), { failures: [], fallen: [] });
    expect('above the baseline', compare({ 'a.ts': 3, 'b.ts': 1, 'gone.ts': 3 }, baseline).failures, [{ file: 'a.ts', count: 3, allowed: 2 }]);
    expect('a file with no baseline', compare({ 'new.ts': 1 }, {}).failures, [{ file: 'new.ts', count: 1, allowed: 0 }]);
    expect('under the baseline', compare({ 'a.ts': 1, 'b.ts': 1 }, baseline), { failures: [], fallen: [{ file: 'a.ts', count: 1, allowed: 2 }, { file: 'gone.ts', count: 0, allowed: 3 }] });
    expect('a fall in one file does not pay for a rise in another', compare({ 'a.ts': 1, 'b.ts': 2, 'gone.ts': 3 }, baseline).failures, [{ file: 'b.ts', count: 2, allowed: 1 }]);
    expect('lowering', lowered({ 'a.ts': 1, 'b.ts': 5, 'new.ts': 4 }, baseline), { 'a.ts': 1, 'b.ts': 1 });
    console.log('row caps check self-test ok');
}

function report(byFile, baseline) {
    const counts = Object.fromEntries(Object.entries(byFile).map(([file, caps]) => [file, caps.length]));
    const { failures, fallen } = compare(counts, baseline);
    for (const { file, count, allowed } of fallen) {
        console.log(`note: ${file} holds ${count} unmarked row cap(s), under its baseline of ${allowed}; run node scripts/check-row-caps.mjs --update-baseline`);
    }
    if (!failures.length) {
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        console.log(`Row caps: no new unmarked cap (${total} from before the check, in ${Object.keys(counts).length} files, still to be marked or paged).`);
        return 0;
    }
    for (const { file, count, allowed } of failures) {
        console.error(allowed
            ? `${file}: ${count} unmarked row caps, and its baseline is ${allowed}. One of these is new:`
            : `${file}: ${count} unmarked row cap(s), and the file has no baseline:`);
        for (const cap of byFile[file]) console.error(`  ${file}:${cap.line}: MaxRows ${cap.cap}`);
    }
    console.error('\nA numeric MaxRows says what happens at the bound, on its line or the line above: // row-cap-ok: <reason>');
    console.error('(for example "refuses on a full page" or "UI page size; pages on scroll"). A read that needs every row pages instead.');
    return 1;
}

const runAsScript = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!runAsScript) {
    // Imported for its functions
} else if (process.argv.includes('--self-test')) {
    selfTest();
} else {
    const byFile = scanTree();
    const baseline = readBaseline();
    if (process.argv.includes('--update-baseline')) {
        const counts = Object.fromEntries(Object.entries(byFile).map(([file, caps]) => [file, caps.length]));
        const next = lowered(counts, baseline);
        writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
        console.log(`${BASELINE_FILE} lowered where the tree allows; a count is never raised and a file is never added.`);
        process.exit(report(byFile, next));
    }
    process.exit(report(byFile, baseline));
}
