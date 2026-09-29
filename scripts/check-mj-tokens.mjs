import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const stylesheet = join(dirname(require.resolve('@memberjunction/ng-shared-generic/package.json')), 'dist/lib/_tokens.scss');
const allowed = new Set(readFileSync(stylesheet, 'utf8').match(/--mj-[a-z0-9-]+(?=:)/g) ?? []);
const used = new Map();

const tokensTsPath = 'packages/AngularWidgets/src/lib/tokens.ts';
const allowedMjc = new Set(readFileSync(tokensTsPath, 'utf8').match(/--mjc-[a-z0-9-]+(?=:)/g) ?? []);
allowedMjc.add('--mjc-type-color');
const usedMjc = new Map();

function walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === 'node_modules' || name === 'dist') continue;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(css|scss|html|ts)$/.test(name)) {
            const content = readFileSync(path, 'utf8');
            for (const token of content.matchAll(/--mj-[a-z0-9-]+/g)) {
                if (!used.has(token[0])) used.set(token[0], path);
            }
            for (const token of content.matchAll(/--mjc-[a-z0-9-]+/g)) {
                if (!usedMjc.has(token[0])) usedMjc.set(token[0], path);
            }
        }
    }
}

for (const root of ['packages', 'docs']) walk(root);
const unknown = [...used.entries()].filter(([token]) => !allowed.has(token));
if (unknown.length) {
    for (const [token, path] of unknown) console.error(`${token} in ${path} is not in ${stylesheet}`);
    process.exit(1);
}
const unknownMjc = [...usedMjc.entries()].filter(([token]) => !allowedMjc.has(token));
if (unknownMjc.length) {
    for (const [token, path] of unknownMjc) console.error(`${token} in ${path} is not in ${tokensTsPath}`);
    process.exit(1);
}
// A colour written as a literal (hex, rgb(), rgba(), hsl(), hsla()) belongs in a token. The only literal allowed is a fallback
// inside var(--token, <colour>), and a line marked `hex-ok` with its reason (the two categorical palettes are marked that way).
const FALLBACK = /var\(--[a-z0-9-]+\s*,\s*(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^)]*\))\s*\)/g;
const LITERAL = /(?<![&\w/])#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

/**
 * The code on a line once its comments are set aside. `state.inComment` carries an open block comment from one line to the next.
 * Quotes are tracked so a `/*` inside a string (a glob such as 'src/**\/*.ts') doesn't open a comment, and a `//` counts only at
 * the start of a line or after a space (never in `http://`).
 */
function codeOf(line, state) {
    if (!state.inComment && /^\s*<!--/.test(line)) return '';
    let out = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (state.inComment) {
            const end = line.indexOf('*/', i);
            if (end < 0) return out;
            i = end + 1;
            state.inComment = false;
            out += ' ';
            continue;
        }
        if (quote) {
            out += ch;
            if (ch === '\\') { out += line[i + 1] ?? ''; i++; } else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; continue; }
        if (ch === '/' && line[i + 1] === '*') { state.inComment = true; i++; continue; }
        if (ch === '/' && line[i + 1] === '/' && (i === 0 || /\s/.test(line[i - 1]))) return out;
        out += ch;
    }
    return out;
}

/** Removes template reference variables (`<input #add>`): a bare `#name` attribute, outside quotes, inside a tag. */
function withoutTemplateRefs(code) {
    let out = '';
    let quote = null;
    let inTag = false;
    for (let i = 0; i < code.length; i++) {
        const ch = code[i];
        if (quote) {
            out += ch;
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; out += ch; continue; }
        if (ch === '<' && /[a-zA-Z]/.test(code[i + 1] ?? '')) inTag = true;
        else if (ch === '>') inTag = false;
        if (inTag && /\s/.test(ch)) {
            const ref = /^\s+#[A-Za-z]\w*(?=[\s>/=]|$)/.exec(code.slice(i));
            if (ref) { i += ref[0].length - 1; continue; }
        }
        out += ch;
    }
    return out;
}

/** Colour literals on one line of source, after fallbacks and anchors are set aside. Empty when the line is clean. */
export function colorLiteralsIn(line, state = { inComment: false }) {
    if (line.includes('hex-ok')) return [];
    const code = codeOf(line, state);
    if (!code.trim()) return [];
    const stripped = withoutTemplateRefs(code)
        .replace(FALLBACK, '')
        .replace(/href\s*=\s*"#[^"]*"/g, '')
        // Not a colour: an SVG reference `url(#fade)`, and a template reference variable on a line of its own
        .replace(/\burl\(\s*['"]?#[^)]*\)/g, '')
        .replace(/^\s*#[A-Za-z]\w*\s*\/?>?\s*$/, '');
    const found = stripped.match(new RegExp(LITERAL.source, 'g'));
    return found ?? [];
}

const hexProblems = [];
function walkHex(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === 'node_modules' || name === 'dist') continue;
        if (statSync(path).isDirectory()) walkHex(path);
        else if (/\.(ts|html|css|scss)$/.test(name) && !/\.test\.ts$/.test(name)) {
            const state = { inComment: false };
            readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
                if (colorLiteralsIn(line, state).length) hexProblems.push(`${path}:${index + 1}: ${line.trim().slice(0, 100)}`);
            });
        }
    }
}

function selfTest() {
    const bad = ['color: #fff;', 'color: #0076b6;', 'background: rgba(0, 0, 0, 0.4);', 'box-shadow: 0 1px 2px rgb(1 2 3);', 'a { color: hsl(10, 20%, 30%); }', '* { color: #333; }', "public c = '#abc123';", '*::before { color: #333; }', '<div style="color: #fff">', '<div class="a" style="border: 1px solid #ddd">', "const g = 'src/**/*.ts'; const c = '#abc123';", '/* note */ color: #fff;', 'color: #fff; /* c */'];
    const good = ['color: var(--mj-text-primary, #0f172a);', 'color: var(--mj-x, rgba(1,2,3,0.5));', '<a href="#add">', '// color: #fff', 'color: #fff; /* hex-ok: brand */', 'width: 10px;', 'background: color-mix(in srgb, var(--mj-brand-primary) 25%, transparent);', 'const id = a#b;', 'fill: url(#fade);', '<input #add type="text">', '  #add', '/* old #fff */'];
    // Lines read in order, as a file is: a block comment that spans lines hides its inside, and ends where it ends
    const spanning = ['/* a note', ' * about #fff', ' */', '.x { color: #333; }', '* > .x { color: #444; }'];
    const spanState = { inComment: false };
    const spanFlagged = spanning.map((line) => colorLiteralsIn(line, spanState).length > 0);
    const failures = [
        ...(JSON.stringify(spanFlagged) === JSON.stringify([false, false, false, true, true]) ? [] : [`a block comment across lines: ${JSON.stringify(spanFlagged)}`]),
        ...bad.filter((line) => colorLiteralsIn(line).length === 0).map((line) => `should be flagged: ${line}`),
        ...good.filter((line) => colorLiteralsIn(line).length !== 0).map((line) => `should pass: ${line}`),
    ];
    if (failures.length) {
        for (const failure of failures) console.error(failure);
        process.exit(1);
    }
    console.log('colour-literal check self-test ok');
}

if (process.argv.includes('--self-test')) {
    selfTest();
    process.exit(0);
}
for (const root of ['packages/Angular/src', 'packages/AngularWidgets/src', 'packages/ExampleSpaceTypes/src']) walkHex(root);
if (hexProblems.length) {
    for (const problem of hexProblems) console.error(`colour literal outside a var() fallback: ${problem}`);
    console.error(`${hexProblems.length} colour literal(s) found. Use a token, or mark the line "hex-ok" with a reason.`);
    process.exit(1);
}
console.log(`mj tokens ok (${used.size} used, ${allowed.size} defined; ${usedMjc.size} mjc used, ${allowedMjc.size} defined)`);
