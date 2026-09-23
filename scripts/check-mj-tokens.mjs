import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const allowed = new Set(
    readFileSync(new URL('./mj-tokens.txt', import.meta.url), 'utf8')
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean),
);
const roots = ['packages', 'docs'];
const used = new Map();

function walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === 'node_modules' || name === 'dist') continue;
        const info = statSync(path);
        if (info.isDirectory()) walk(path);
        else if (/\.(css|scss|html|ts)$/.test(name)) {
            const text = readFileSync(path, 'utf8');
            for (const token of text.matchAll(/--mj-[a-z0-9-]+/g)) {
                if (!used.has(token[0])) used.set(token[0], path);
            }
        }
    }
}

for (const root of roots) walk(root);
const unknown = [...used.entries()].filter(([token]) => !allowed.has(token));
if (unknown.length) {
    for (const [token, path] of unknown) console.error(`${token} in ${path}`);
    process.exit(1);
}
console.log(`mj tokens ok (${used.size} used)`);
