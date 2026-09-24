#!/usr/bin/env node
/**
 * Fail the build when fewer checks RAN than the registry declares.
 *
 * Usage: node scripts/assert-check-count.mjs <integration-log>
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const logPath = process.argv[2];

/** Expected counts, parsed from the parity test so there is exactly one source of truth. */
function expectedCounts() {
    const src = readFileSync(
        join(root, 'packages/IntegrationTests/src/__tests__/registry-parity.test.ts'),
        'utf8',
    );
    const block = src.match(/EXPECTED_BUNDLES[^=]*=\s*\{([\s\S]*?)\}\s*;/);
    if (!block) throw new Error('could not find the EXPECTED_BUNDLES map in registry-parity.test.ts');
    const counts = new Map();
    for (const [, name, n] of block[1].matchAll(/'?([a-zA-Z-]+)'?\s*:\s*(\d+)/g)) {
        counts.set(name, Number(n));
    }
    if (!counts.size) throw new Error('the EXPECTED_BUNDLES map parsed empty');
    return counts;
}

const log = logPath && logPath !== '-' ? readFileSync(logPath, 'utf8') : readFileSync(0, 'utf8');
const expected = expectedCounts();
const expectedTotal = [...expected.values()].reduce((a, b) => a + b, 0);

// Look for tally lines like "30 passed / 0 failed" or "30 passed, 0 failed"
const tally = log.match(/(\d+)\s+passed\s*(?:\/|,)\s*(\d+)\s+failed/i);
const passed = tally ? Number(tally[1]) : 0;
const failed = tally ? Number(tally[2]) : 0;
const ran = passed + failed;

const problems = [];

if (!tally) {
    problems.push('the run produced no final tally — it did not finish');
}
if (ran < expectedTotal) {
    problems.push(
        `only ${ran} checks ran; the registry declares ${expectedTotal}. ` +
            `${expectedTotal - ran} were SKIPPED or missing.`,
    );
}
if (failed > 0) {
    problems.push(`${failed} checks failed`);
}

// Check each bundle ran
for (const [bundle, count] of expected) {
    const bundleChecks = (log.match(new RegExp(`(?:ok|FAIL|✔|✖)\\s+${bundle}\\.`, 'g')) ?? []).length;
    if (bundleChecks === 0) {
        problems.push(`bundle '${bundle}' never ran — is it missing from the runner's list?`);
    } else if (bundleChecks !== count) {
        problems.push(
            `bundle '${bundle}' ran ${bundleChecks} checks, expected ${count}`,
        );
    }
}

if (problems.length) {
    console.error('\n✖ Integration coverage assertion FAILED\n');
    for (const p of problems) console.error(`  · ${p}`);
    console.error(
        '\nA passing tally is not evidence on its own without verifying every declared check ran.\n',
    );
    process.exit(1);
}

console.log(
    `✓ coverage assertion passed — ${ran} checks ran across ${expected.size} bundles ` +
        `(${passed} passed, ${failed} failed)`,
);
