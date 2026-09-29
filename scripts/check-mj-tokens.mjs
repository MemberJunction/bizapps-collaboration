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
// A colour written as a hex literal belongs in a token. The only hex allowed is a fallback inside var(--token, #hex), the two
// categorical palettes (avatars and file types), the token definitions, and a line marked `hex-ok` with its reason.
const hexAllowedFiles = new Set([
    'packages/AngularWidgets/src/lib/avatar.component.ts',
    'packages/AngularWidgets/src/lib/file-icon.component.ts',
    'packages/AngularWidgets/src/lib/tokens.ts',
]);
const hexProblems = [];
function walkHex(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === 'node_modules' || name === 'dist') continue;
        if (statSync(path).isDirectory()) walkHex(path);
        else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name) && !hexAllowedFiles.has(path)) {
            readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
                if (line.includes('hex-ok')) return;
                const withoutFallbacks = line.replace(/var\(--[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\)/g, '');
                if (/#[0-9a-fA-F]{3,8}\b/.test(withoutFallbacks) && !/^\s*(\/\/|\*)/.test(line)) hexProblems.push(`${path}:${index + 1}: ${line.trim().slice(0, 100)}`);
            });
        }
    }
}
for (const root of ['packages/Angular/src', 'packages/AngularWidgets/src']) walkHex(root);
if (hexProblems.length) {
    for (const problem of hexProblems) console.error(`hex outside a var() fallback: ${problem}`);
    console.error(`${hexProblems.length} hex literal(s) found. Use a token, or mark the line "hex-ok" with a reason.`);
    process.exit(1);
}
console.log(`mj tokens ok (${used.size} used, ${allowed.size} defined; ${usedMjc.size} mjc used, ${allowedMjc.size} defined)`);
