import fs from 'node:fs';
import path from 'node:path';

function stripSync(obj) {
    if (Array.isArray(obj)) {
        return obj.map(stripSync);
    }
    if (obj !== null && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (k === 'sync') continue;
            out[k] = stripSync(v);
        }
        return out;
    }
    return obj;
}

function processDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.backups' && entry.name !== 'sql_logging') {
                processDir(full);
            }
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            try {
                const text = fs.readFileSync(full, 'utf-8');
                const parsed = JSON.parse(text);
                let hadSync = false;
                function checkAndStrip(val) {
                    if (Array.isArray(val)) {
                        return val.map(checkAndStrip);
                    }
                    if (val !== null && typeof val === 'object') {
                        const out = {};
                        for (const [k, v] of Object.entries(val)) {
                            if (k === 'sync') {
                                hadSync = true;
                                continue;
                            }
                            out[k] = checkAndStrip(v);
                        }
                        return out;
                    }
                    return val;
                }
                const cleaned = checkAndStrip(parsed);
                if (hadSync) {
                    fs.writeFileSync(full, JSON.stringify(cleaned, null, 2) + '\n');
                }
            } catch (err) {
                console.error(`Error parsing JSON in ${full}:`, err);
            }
        }
    }
}

const metadataDir = path.resolve('metadata');
processDir(metadataDir);
const metadataTestsDir = path.resolve('metadata-tests');
if (fs.existsSync(metadataTestsDir)) {
    processDir(metadataTestsDir);
}
console.log('Stripped sync blocks from metadata and metadata-tests');

