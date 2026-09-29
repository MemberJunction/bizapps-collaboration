import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const matrix = JSON.parse(readFileSync(resolve(here, 'ui-pass/personas.json'), 'utf8')) as { personas: Array<{ name: string; label?: string }> };

/**
 * The UI pass against a running Explorer (no gallery server): one project per persona, each with its own saved sign-in.
 *   UI_PASS_BASE_URL=http://localhost:4201 pnpm --filter @mj-biz-apps/collaboration-e2e exec playwright test -c playwright.ui-pass.config.ts
 */
export default defineConfig({
    testDir: resolve(here, 'ui-pass'),
    testMatch: '**/*.spec.ts',
    timeout: 60_000,
    expect: { timeout: 15_000 },
    workers: 1,
    retries: 0,
    reporter: [['list']],
    outputDir: resolve(here, 'ui-pass-out'),
    use: { baseURL: process.env.UI_PASS_BASE_URL ?? 'http://localhost:4201', viewport: { width: 1440, height: 900 } },
    projects: matrix.personas.map((persona) => ({
        name: persona.label ?? persona.name,
        use: { ...devices['Desktop Chrome'], channel: 'chromium', storageState: resolve(here, `ui-pass/auth/${persona.name}.json`) },
    })),
});
