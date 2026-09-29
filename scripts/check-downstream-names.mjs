// Collaboration must not know its downstream apps. Fails when the name of an app that builds on Collaboration appears in
// packages/ or metadata/, outside the example package, test files and fixtures (docs are not scanned).
//
//   node scripts/check-downstream-names.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The apps that sit downstream of Collaboration. Common and Tasks sit upstream, and are allowed. */
export const DOWNSTREAM_APPS = ['accounting', 'ats', 'caliber', 'committees', 'contracts', 'credentialing', 'forms', 'fpna', 'issues', 'marketing', 'orders', 'sales', 'secure-messaging', 'sonar'];

const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.backups', 'sql_logging', 'ExampleSpaceTypes', '__tests__', 'fixtures']);
const TEXT_FILE = /\.(ts|json|md|mjs|cjs|scss|css|html|csv|sql)$/;
const TEST_FILE = /\.(test|spec)\.ts$/;

/** The patterns that name an app: its repo, its npm scope and its entity schema. */
export function patternFor(app) {
    const schema = app.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join('');
    const escaped = app.replace(/-/g, '[-_]');
    return new RegExp(`bizapps-${escaped}\\b|@mj-biz-apps/${escaped}-|MJ_BizApps_${schema}\\b`, 'i');
}

/** The lines of one file's text that name a downstream app, as "file:line: app". */
export function findNames(text, file) {
    const found = [];
    text.split('\n').forEach((line, index) => {
        for (const app of DOWNSTREAM_APPS) {
            if (patternFor(app).test(line)) found.push(`${file}:${index + 1}: names the downstream app "${app}"`);
        }
    });
    return found;
}

function walk(dir, found) {
    for (const name of readdirSync(dir)) {
        if (SKIPPED_DIRS.has(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path, found);
        else if (TEXT_FILE.test(name) && !TEST_FILE.test(name)) found.push(...findNames(readFileSync(path, 'utf8'), path));
    }
}

export function checkTree(roots) {
    const found = [];
    for (const root of roots) walk(root, found);
    return found;
}

if (process.argv[1] && process.argv[1].endsWith('check-downstream-names.mjs')) {
    const problems = checkTree(['packages', 'metadata']);
    if (problems.length) {
        for (const problem of problems) console.error(problem);
        console.error(`${problems.length} downstream name(s) found. Collaboration stays blind to the apps that build on it.`);
        process.exit(1);
    }
    console.log('No downstream app names in packages/ or metadata/.');
}
