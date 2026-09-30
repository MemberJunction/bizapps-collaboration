// A host's class-registration manifest imports every `@RegisterClass` class by name from its package's entry, and skips one
// the entry doesn't export, with only a log line. So a registered class that isn't exported reaches a host only if something
// else happens to import its module. Fails when a class decorated with `@RegisterClass` in a published package's `src` isn't
// exported from that package's entry (its `main`, read back to `src`).
//
//   node scripts/check-registered-exports.mjs
//   node scripts/check-registered-exports.mjs --self-test
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SKIPPED_DIRS = new Set(['node_modules', 'dist', '__tests__']);
const TEST_FILE = /\.(test|spec)\.ts$/;

/** The classes a file registers: `@RegisterClass(...)` directly above `export class Name` (other decorators may sit between). */
export function registeredClasses(text) {
    const names = [];
    const pattern = /@RegisterClass\s*\((?:[^()]|\([^()]*\))*\)\s*(?:@\w+\s*\((?:[^()]|\([^()]*\))*\)\s*)*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    for (const match of text.matchAll(pattern)) names.push(match[1]);
    return names;
}

/** What one module exports by name, and the modules it re-exports everything from. */
export function exportsOf(text) {
    const names = new Set();
    const stars = [];
    const named = [];
    for (const m of text.matchAll(/export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|function|const|let|enum|interface|type)\s+(\w+)/g)) names.add(m[1]);
    for (const m of text.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) stars.push(m[1]);
    for (const m of text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*(?:from\s+['"]([^'"]+)['"])?/g)) {
        for (const part of m[1].split(',')) {
            const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim();
            if (name) names.add(name);
        }
        if (m[2]) named.push(m[2]);
    }
    return { names, stars, named };
}

function resolveModule(fromFile, specifier) {
    if (!specifier.startsWith('.')) return null;
    const base = resolve(dirname(fromFile), specifier.replace(/\.js$/, ''));
    for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) if (existsSync(candidate)) return candidate;
    return null;
}

/** Every name a package's entry exports, following `export * from` through the package's own files. */
export function entryExports(entryFile, read = (file) => readFileSync(file, 'utf8')) {
    const all = new Set();
    const seen = new Set();
    const visit = (file) => {
        if (seen.has(file)) return;
        seen.add(file);
        const found = exportsOf(read(file));
        for (const name of found.names) all.add(name);
        for (const specifier of found.stars) {
            const target = resolveModule(file, specifier);
            if (target) visit(target);
        }
    };
    visit(entryFile);
    return all;
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

/** The registered classes of one published package that its entry doesn't export, as "file: Class". */
export function checkPackage(packageDir) {
    const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
    if (manifest.private || !manifest.main) return [];
    const entry = join(packageDir, 'src', manifest.main.replace(/^dist\//, '').replace(/\.js$/, '.ts'));
    if (!existsSync(entry)) return [`${packageDir}: its entry ${entry} was not found`];
    const exported = entryExports(entry);
    const missing = [];
    for (const file of sourceFiles(join(packageDir, 'src'))) {
        for (const name of registeredClasses(readFileSync(file, 'utf8'))) {
            if (!exported.has(name)) missing.push(`${file}: ${name} is registered with @RegisterClass but ${manifest.name} does not export it from ${entry}`);
        }
    }
    return missing;
}

function selfTest() {
    const registered = registeredClasses(`
        @RegisterClass(BaseEntity, 'Things')
        export class ThingEntityServer extends ThingEntity {}
        @RegisterClass(BaseDriver, 'x', 2)
        @Injectable()
        export class Driver {}
        export class NotRegistered {}
    `);
    if (registered.join(',') !== 'ThingEntityServer,Driver') throw new Error(`self-test: registered classes read as ${registered}`);
    const found = exportsOf(`export { A, B as C, type D } from './a.js';\nexport * from './b.js';\nexport class E {}\nexport function f() {}`);
    if ([...found.names].sort().join(',') !== 'A,C,D,E,f') throw new Error(`self-test: exports read as ${[...found.names]}`);
    if (found.stars.join(',') !== './b.js') throw new Error('self-test: star exports not read');
    console.log('registered exports check self-test ok');
}

if (process.argv.includes('--self-test')) {
    selfTest();
} else {
    const missing = [];
    let checked = 0;
    for (const name of readdirSync('packages')) {
        const dir = join('packages', name);
        if (!existsSync(join(dir, 'package.json'))) continue;
        const before = missing.length;
        missing.push(...checkPackage(dir));
        if (!JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).private) checked += 1;
        void before;
    }
    if (missing.length > 0) {
        console.error(missing.join('\n'));
        console.error(`${missing.length} registered class(es) a host's manifest would skip. Export each from its package's entry.`);
        process.exit(1);
    }
    console.log(`registered exports ok (${checked} published packages: every @RegisterClass class is exported from its entry)`);
}
