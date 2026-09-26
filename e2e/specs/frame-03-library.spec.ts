import { test, expect, Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testResultsDir = resolve(__dirname, '../test-results/gallery');

function saveTestResultScreenshot(filename: string, buffer: Buffer) {
    mkdirSync(testResultsDir, { recursive: true });
    writeFileSync(join(testResultsDir, filename), buffer);
}

async function ensureFontsLoaded(page: Page) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        const interLoaded = document.fonts.check('16px Inter');
        if (!interLoaded) {
            throw new Error('Font check failed: Inter variable font did not load');
        }
        const hasSolid = document.querySelector('i.fa-solid, [class*="fa-solid"]') !== null;
        const hasRegular = document.querySelector('i.fa-regular, [class*="fa-regular"]') !== null;

        if (hasSolid && !document.fonts.check('900 16px "Font Awesome 6 Free"')) {
            throw new Error('Font check failed: Font Awesome 6 Free solid (900) font face not loaded in document.fonts');
        }
        if (hasRegular && !document.fonts.check('400 16px "Font Awesome 6 Free"')) {
            throw new Error('Font check failed: Font Awesome 6 Free regular (400) font face not loaded in document.fonts');
        }
        const icons = document.querySelectorAll('i[class*="fa-"]');
        if (icons.length === 0) {
            throw new Error('Font check failed: No Font Awesome icons found on page to verify');
        }
        for (const icon of icons) {
            const pseudoContent = window.getComputedStyle(icon, '::before').content;
            if (!pseudoContent || pseudoContent === 'none' || pseudoContent === 'normal' || pseudoContent === '""') {
                throw new Error(`Font check failed: Font Awesome icon with class "${icon.className}" has no rendered ::before glyph`);
            }
        }
    });
}

test.describe('Frame 03 — Space Library', () => {
    test('renders collections sidebar, file table, and preview drawer in light theme', async ({ page }) => {
        await page.goto('/frame/03');
        await ensureFontsLoaded(page);

        // 1. Topbar
        const topbar = page.locator('header.topbar');
        await expect(topbar).toBeVisible();

        // 2. Space Header with activeTab = Library
        const header = page.locator('mjc-space-header section.space-head');
        await expect(header).toBeVisible();
        await expect(header.locator('mjc-space-tabs .tab.active')).toContainText('Library');
        await expect(header.locator('button[mjButton]').filter({ hasText: 'Upload' })).toBeVisible();

        // 3. Library Collections sidebar
        const lib = page.locator('mjc-space-library .lib');
        await expect(lib).toBeVisible();
        const folders = lib.locator('.folders');
        await expect(folders.locator('.fold.on')).toContainText('All material');
        await expect(folders.locator('.fold').filter({ hasText: 'Deliverables' })).toBeVisible();
        await expect(folders.locator('.fold').filter({ hasText: 'Interviews' })).toBeVisible();

        // 4. File Table
        const table = lib.locator('table.table');
        await expect(table).toBeVisible();
        const rows = table.locator('tbody tr');
        await expect(rows).toHaveCount(8);
        await expect(rows.nth(2)).toHaveClass(/sel/);
        await expect(rows.nth(2)).toContainText('Interview synthesis v3');

        // 5. Preview Drawer
        const drawer = lib.locator('.drawer');
        await expect(drawer).toBeVisible();
        await expect(drawer.locator('.doc-prev')).toBeVisible();
        await expect(drawer.locator('.flag-box')).toContainText('2 people could be identified');
        await expect(drawer.locator('button.btn.primary').filter({ hasText: 'Share with Northwind' })).toBeVisible();

        const screenshot = await page.screenshot({ fullPage: false, animations: 'disabled' });
        saveTestResultScreenshot('03-light.png', screenshot);
    });

    test('supports dark mode via ?theme=dark query param', async ({ page }) => {
        await page.goto('/frame/03?theme=dark');
        await ensureFontsLoaded(page);
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');

        const lib = page.locator('mjc-space-library .lib');
        await expect(lib).toBeVisible();

        const screenshot = await page.screenshot({ fullPage: false, animations: 'disabled' });
        saveTestResultScreenshot('03-dark.png', screenshot);
    });

    test('visual regression: matches 03-library.png within budget (§ 10 topbar mask)', async ({ page }) => {
        await page.goto('/frame/03');
        await ensureFontsLoaded(page);
        await page.waitForSelector('mjc-space-library .lib');

        const screenshotBuffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
        const targetPath = resolve(__dirname, '../../docs/ux/screens/03-library.png');
        if (!existsSync(targetPath)) {
            throw new Error(`Target screen not found: ${targetPath}`);
        }

        const actualPng = PNG.sync.read(screenshotBuffer);
        const targetPng = PNG.sync.read(readFileSync(targetPath));

        const width = actualPng.width;
        const height = actualPng.height;

        expect(targetPng.width).toBe(width);
        expect(targetPng.height).toBe(height);

        // Apply § 10 mask: Topbar (first 56px, 112px in 2x buffer)
        const maskHeightPx = 56 * 2;
        for (let y = 0; y < maskHeightPx; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (width * y + x) * 4;
                actualPng.data[idx] = targetPng.data[idx];
                actualPng.data[idx + 1] = targetPng.data[idx + 1];
                actualPng.data[idx + 2] = targetPng.data[idx + 2];
                actualPng.data[idx + 3] = targetPng.data[idx + 3];
            }
        }

        const diffPng = new PNG({ width, height });
        const numDiffPixels = pixelmatch(
            actualPng.data,
            targetPng.data,
            diffPng.data,
            width,
            height,
            { threshold: 0.1 }
        );

        saveTestResultScreenshot('03-diff.png', PNG.sync.write(diffPng));

        const totalPixels = width * (height - maskHeightPx);
        const diffRatio = numDiffPixels / totalPixels;
        console.log(`Frame 03 Library visual diff: ${numDiffPixels} / ${totalPixels} pixels (${(diffRatio * 100).toFixed(2)}%)`);

        // Budget: Separate CI (Linux full Chromium: <= 500 px) vs local macOS (~150k px due to font antialiasing across all 8 rows & drawer)
        const budget = process.env.CI ? 500 : 180000;
        expect(numDiffPixels).toBeLessThanOrEqual(budget);
    });
});
