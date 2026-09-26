import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('Frame 02 Chrome — Space Overview', () => {
    test('renders topbar, navigation rail, space header, audience pill, and tabs in light theme', async ({ page }) => {
        await page.goto('/frame/02');

        // 1. Topbar (masked stand-in in § 10)
        const topbar = page.locator('header.topbar');
        await expect(topbar).toBeVisible();
        await expect(topbar.locator('.app-pill')).toContainText('Collaboration');
        await expect(topbar.locator('.search')).toContainText('Search everything');
        await expect(topbar.locator('.av.c1')).toBeVisible();

        // 2. Navigation rail (Angular component: mjc-space-rail)
        const rail = page.locator('mjc-space-rail nav.appnav');
        await expect(rail).toBeVisible();
        await expect(rail.locator('.jump')).toContainText('Jump to a space');
        await expect(rail.locator('.nav-item').filter({ hasText: 'Home' })).toBeVisible();
        await expect(rail.locator('.nav-item').filter({ hasText: 'Inbox' })).toContainText('4');
        await expect(rail.locator('.nav-item').filter({ hasText: 'My tasks' })).toContainText('6');

        // Spaces tree in rail
        const discoveryItem = rail.locator('.tree-item.active');
        await expect(discoveryItem).toContainText('Discovery');
        await expect(discoveryItem.locator('.unread')).toBeVisible();

        // 3. Space Header & Breadcrumbs (Angular component: mjc-space-header)
        const header = page.locator('mjc-space-header section.space-head');
        await expect(header).toBeVisible();
        await expect(header.locator('.crumbs')).toContainText('Spaces');
        await expect(header.locator('.crumbs')).toContainText('Northwind');
        await expect(header.locator('.crumbs')).toContainText('Discovery');

        // Title and Chips
        await expect(header.locator('h1.h1')).toHaveText('Discovery');
        await expect(header.locator('.chip.plain')).toHaveText('Engagement');
        await expect(header.locator('.chip.ok')).toContainText('Active');

        // Subtitle with lifecycle progress
        const sub = header.locator('.sub');
        await expect(sub).toContainText('Supply-chain operating model diagnostic');
        await expect(sub).toContainText('Week 7 of 10');
        await expect(sub).toContainText('Readout Oct 9');

        // 4. Audience Pill (Angular component: mjc-audience-pill)
        const aud = header.locator('mjc-audience-pill .aud');
        await expect(aud).toBeVisible();
        await expect(aud).toContainText('9 people');
        await expect(aud).toContainText('3 Meridian · 6 Northwind');

        // 5. Tabs (Angular component: mjc-space-tabs)
        const tabs = header.locator('mjc-space-tabs .tab');
        await expect(tabs).toHaveCount(6);
        await expect(tabs.nth(0)).toContainText('Overview');
        await expect(tabs.nth(0)).toHaveClass(/active/);
        await expect(tabs.nth(1)).toContainText('Library');
        await expect(tabs.nth(1).locator('.c')).toHaveText('24');
        await expect(tabs.nth(2)).toContainText('Work');
        await expect(tabs.nth(2).locator('.c')).toHaveText('10');
        await expect(tabs.nth(3)).toContainText('Chat');
        await expect(tabs.nth(3).locator('.c')).toHaveText('3');
        await expect(tabs.nth(4)).toContainText('People');
        await expect(tabs.nth(4).locator('.c')).toHaveText('9');
        await expect(tabs.nth(5)).toContainText('Settings');

        const diffDir = resolve(__dirname, '../../docs/screenshots/pr3/ux');
        mkdirSync(diffDir, { recursive: true });
        await page.screenshot({ path: join(diffDir, '02-light.png'), fullPage: false });
    });

    test('supports dark mode via ?theme=dark query param', async ({ page }) => {
        await page.goto('/frame/02?theme=dark');
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');

        const header = page.locator('mjc-space-header section.space-head');
        await expect(header).toBeVisible();
        await expect(header.locator('h1.h1')).toHaveText('Discovery');

        const diffDir = resolve(__dirname, '../../docs/screenshots/pr3/ux');
        mkdirSync(diffDir, { recursive: true });
        await page.screenshot({ path: join(diffDir, '02-dark.png'), fullPage: false });
    });

    test('visual regression against 02-space-overview.png with pixelmatch (§ 10 masks)', async ({ page }) => {
        // As specified by reviewer in Round 87:
        // Frame 02's chrome matches foundations, but the full-page overview content cards
        // (Shared band, Team band, activity, calendar) land in Slice A.
        test.fail(true, 'Frame 02 chrome matches foundations, full page overview cards land in Slice A');

        await page.goto('/frame/02');
        await page.waitForSelector('mjc-space-header section.space-head');

        // Screenshot at 1440x900 2x
        const screenshotBuffer = await page.screenshot({ fullPage: false });

        const targetPath = resolve(__dirname, '../../docs/ux/screens/02-space-overview.png');
        if (!existsSync(targetPath)) {
            throw new Error(`Target screen not found: ${targetPath}`);
        }

        const actualPng = PNG.sync.read(screenshotBuffer);
        const targetPng = PNG.sync.read(readFileSync(targetPath));

        const width = actualPng.width;
        const height = actualPng.height;

        expect(targetPng.width).toBe(width);
        expect(targetPng.height).toBe(height);

        // Apply § 10 mask:
        // Topbar mask: first 56px (56 * 2 = 112px in 2x buffer)
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

        if (numDiffPixels > 0) {
            const diffDir = resolve(__dirname, '../../docs/screenshots/pr3/ux');
            mkdirSync(diffDir, { recursive: true });
            writeFileSync(join(diffDir, '02-diff.png'), PNG.sync.write(diffPng));
        }

        // Target budget comparison
        expect(numDiffPixels).toBeLessThanOrEqual(50);
    });
});
