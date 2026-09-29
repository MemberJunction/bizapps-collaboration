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
    await page.waitForSelector('i[class*="fa-"]', { state: 'attached' });
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

test.describe('Frame 04 — Share Check Dialog', () => {
    test('renders backdrop, dialog, audience grid, finding review, and effects in light theme', async ({ page }) => {
        await page.goto('/frame/04');
        await ensureFontsLoaded(page);

        // 1. Topbar
        const topbar = page.locator('header.topbar');
        await expect(topbar).toBeVisible();

        // 2. mj-dialog's backdrop and container; the dialog is named, and draws one close button
        const dialog = page.locator('mjc-share-check-dialog');
        await expect(dialog.locator('.mj-dialog-backdrop')).toBeVisible();
        const modal = dialog.locator('.mj-dialog-container');
        await expect(modal).toBeVisible();
        await expect(modal).toHaveAttribute('aria-labelledby', /^mj-dialog-title-/);
        await expect(modal.locator('[aria-label="Close dialog"]')).toHaveCount(1);

        // 3. Title (mj-dialog's) and the item line (share-check's header)
        await expect(modal.locator('.mj-dialog-title')).toContainText('Share with Northwind');
        await expect(modal.locator('.m-h')).toContainText('Interview synthesis v3');

        // 4. Audience Grid
        const pgrid = modal.locator('.pgrid .pp');
        await expect(pgrid).toHaveCount(5);
        await expect(pgrid.nth(0)).toContainText('Casey Morgan');
        await expect(pgrid.nth(4)).toContainText('2 more');

        // 5. Assistant Review Findings
        const review = modal.locator('.review');
        await expect(review).toBeVisible();
        await expect(review.locator('.chip.warn')).toContainText('2 to review');
        const fixes = review.locator('.fix');
        await expect(fixes).toHaveCount(2);

        // 6. Effects
        const effects = modal.locator('.effects .eff');
        await expect(effects).toHaveCount(3);

        // 7. Action buttons, in mj-dialog's actions (outside the scrolling body)
        const footer = modal.locator('mj-dialog-actions');
        await expect(footer.locator('button').first()).toContainText('Apply 2 fixes and share');
        await expect(footer.locator('button').filter({ hasText: 'Share as is' })).toBeVisible();
        await expect(footer.locator('button').filter({ hasText: 'Cancel' })).toBeVisible();
        await expect(modal.locator('.mj-dialog-body')).not.toContainText('Share as is');

        const screenshot = await page.screenshot({ fullPage: false, animations: 'disabled' });
        saveTestResultScreenshot('04-light.png', screenshot);
    });

    test('supports dark mode via ?theme=dark query param', async ({ page }) => {
        await page.goto('/frame/04?theme=dark');
        await ensureFontsLoaded(page);
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');

        const modal = page.locator('mjc-share-check-dialog .mj-dialog-container');
        await expect(modal).toBeVisible();

        const screenshot = await page.screenshot({ fullPage: false, animations: 'disabled' });
        saveTestResultScreenshot('04-dark.png', screenshot);
    });

    // Retired per D24 & Item 2: Mockups are retired as reference; local builder owns UI with Amith
    test.skip('visual regression: matches 04-share-check.png within budget (§ 10 topbar mask) [Retired per D24]', async ({ page }) => {
        await page.goto('/frame/04');
        await ensureFontsLoaded(page);
        await page.waitForSelector('mjc-share-check-dialog .mj-dialog-container');

        const screenshotBuffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
        const targetPath = resolve(__dirname, '../../docs/ux/screens/04-share-check.png');
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

        saveTestResultScreenshot('04-diff.png', PNG.sync.write(diffPng));

        const totalPixels = width * (height - maskHeightPx);
        const diffRatio = numDiffPixels / totalPixels;
        console.log(`Frame 04 Share Check visual diff: ${numDiffPixels} / ${totalPixels} pixels (${(diffRatio * 100).toFixed(2)}%)`);

        // Budget: Full Chromium font antialiasing + mj-switch / mjButton on backdrop + modal (CI Linux: <= 69,889 px [measured 69,789 repeatable + 100 margin], local macOS: <= 85,000 px)
        const budget = process.env.CI ? 69889 : 85000;
        expect(numDiffPixels).toBeLessThanOrEqual(budget);
    });
});
