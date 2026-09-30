// MJ's components are used as they are, by the input names they have now. Fails when a template binds one of the names MJ
// deprecated: `variant`, `size` and `ariaLabel` on `mjButton` (now `Variant`, `Size`, `AriaLabel`), and `showText`, `text` and
// `size` on `mj-loading` (now `ShowText`, `Text`, `Size`). Generated files are CodeGen's and are not scanned.
//
//   node scripts/check-mj-inputs.mjs
//   node scripts/check-mj-inputs.mjs --self-test
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'generated']);
const TEMPLATE_FILE = /\.(ts|html)$/;
const TAG = /<(button|a|mj-loading)\b[^>]*?>/gs;
const BUTTON_NAMES = /(?:\[|\s)(variant|size|ariaLabel)(?:\]|=)/;
const LOADING_NAMES = /(?:\[|\s)(showText|text|size)(?:\]|=)/;

/** The deprecated input names one file's templates bind, as "file:line: what". */
export function findDeprecatedInputs(text, file) {
    const found = [];
    for (const match of text.matchAll(TAG)) {
        const tag = match[0];
        const line = text.slice(0, match.index).split('\n').length;
        if (match[1] === 'mj-loading') {
            const name = tag.match(LOADING_NAMES)?.[1];
            if (name) found.push(`${file}:${line}: mj-loading binds the deprecated "${name}"`);
        } else if (/\bmjButton\b/.test(tag)) {
            const name = tag.match(BUTTON_NAMES)?.[1];
            if (name) found.push(`${file}:${line}: mjButton binds the deprecated "${name}"`);
        }
    }
    return found;
}

function walk(dir, found) {
    for (const name of readdirSync(dir)) {
        if (SKIPPED_DIRS.has(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path, found);
        else if (TEMPLATE_FILE.test(name)) found.push(...findDeprecatedInputs(readFileSync(path, 'utf8'), path));
    }
}

function selfTest() {
    const bad = [
        '<button mjButton variant="primary">x</button>',
        '<button\n  type="button"\n  mjButton\n  size="sm">x</button>',
        '<button mjButton [variant]="v">x</button>',
        '<button mjButton ariaLabel="Close">x</button>',
        '<mj-loading Size="small" [showText]="false"></mj-loading>',
        '<mj-loading text="Reading"></mj-loading>',
    ];
    const good = [
        '<button mjButton Variant="primary" Size="sm" AriaLabel="Close">x</button>',
        '<button class="plain" size="3">a plain button is not MJ\'s</button>',
        '<mj-loading Size="small" [ShowText]="false"></mj-loading>',
        '<mj-dropdown size="x"></mj-dropdown>',
    ];
    for (const text of bad) if (findDeprecatedInputs(text, 't').length !== 1) throw new Error(`self-test: not caught: ${text}`);
    for (const text of good) if (findDeprecatedInputs(text, 't').length !== 0) throw new Error(`self-test: wrongly caught: ${text}`);
    console.log('mj inputs check self-test ok');
}

if (process.argv.includes('--self-test')) {
    selfTest();
} else {
    const found = [];
    walk('packages', found);
    if (found.length > 0) {
        console.error(found.join('\n'));
        console.error(`${found.length} deprecated MJ input name(s) found. Use the PascalCase name.`);
        process.exit(1);
    }
    console.log('mj inputs ok (no deprecated input names on mjButton or mj-loading)');
}
