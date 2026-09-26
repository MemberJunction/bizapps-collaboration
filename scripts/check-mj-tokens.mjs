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
console.log(`mj tokens ok (${used.size} used, ${allowed.size} defined; ${usedMjc.size} mjc used, ${allowedMjc.size} defined)`);
