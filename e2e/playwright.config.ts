import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    testDir: resolve(here, 'specs'),
    testMatch: '**/*.spec.ts',
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: process.env.GALLERY_BASE_URL ?? 'http://localhost:4250',
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        actionTimeout: 10_000,
        navigationTimeout: 15_000,
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'node ../packages/UXGallery/server.mjs',
        port: 4250,
        reuseExistingServer: !process.env.CI,
        timeout: 10_000,
    },
    projects: [
        {
            name: 'gallery-chromium',
            use: {
                ...devices['Desktop Chrome'],
                channel: 'chromium',
                viewport: { width: 1440, height: 900 },
                deviceScaleFactor: 2,
            },
        },
    ],
});
