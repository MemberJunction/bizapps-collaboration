/**
 * Cleans what `mj sync push` writes back into metadata JSON: it strips every `sync` block and
 * restores each file's final newline (the push drops it).
 *
 *   node scripts/strip-sync-blocks.mjs           rewrite the files
 *   node scripts/strip-sync-blocks.mjs --check   change nothing; exit 1 if any file has a sync block or no final newline
 */
import fs from 'node:fs';
import path from 'node:path';

const checkOnly = process.argv.includes('--check');
const skippedDirs = new Set(['node_modules', '.backups', 'sql_logging']);
const problems = [];

/** True for the block the sync tool writes: an object with a checksum or a lastModified stamp. */
function isSyncBlock(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val) && ('checksum' in val || 'lastModified' in val);
}

/** Returns the value without its records' `sync` blocks, and whether it held any. */
function withoutSync(value) {
    let found = false;
    const strip = (val) => {
        if (Array.isArray(val)) return val.map(strip);
        if (val !== null && typeof val === 'object') {
            const out = {};
            // A `sync` block is recognised by its own shape (a checksum or last-modified stamp); a `sync` key anywhere else is somebody's data
            for (const [key, child] of Object.entries(val)) {
                if (key === 'sync' && isSyncBlock(child)) {
                    found = true;
                    continue;
                }
                out[key] = strip(child);
            }
            return out;
        }
        return val;
    };
    return { cleaned: strip(value), found };
}

function processFile(file) {
    const text = fs.readFileSync(file, 'utf-8');
    const { cleaned, found } = withoutSync(JSON.parse(text));
    const missingNewline = !text.endsWith('\n');
    if (found) problems.push(`${file}: has a sync block`);
    if (missingNewline) problems.push(`${file}: no final newline`);
    if (checkOnly || (!found && !missingNewline)) return;
    fs.writeFileSync(file, found ? JSON.stringify(cleaned, null, 2) + '\n' : text + '\n');
}

function processDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!skippedDirs.has(entry.name)) processDir(full);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            try {
                processFile(full);
            } catch (error) {
                problems.push(`${full}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
}

for (const dir of ['metadata', 'metadata-tests']) {
    if (fs.existsSync(path.resolve(dir))) processDir(path.resolve(dir));
}

if (checkOnly) {
    if (problems.length > 0) {
        console.error(`Metadata is not clean:\n  ${problems.join('\n  ')}\nRun: node scripts/strip-sync-blocks.mjs`);
        process.exit(1);
    }
    console.log('Metadata is clean: no sync blocks, every file ends in a newline.');
} else {
    console.log('Stripped sync blocks and restored final newlines in metadata and metadata-tests.');
}
