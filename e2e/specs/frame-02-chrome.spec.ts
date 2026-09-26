import { test, expect } from '@playwright/test';

test.describe('Frame 02 Chrome — Space Overview', () => {
    test('renders topbar, navigation rail, space header, audience pill, and tabs in light theme', async ({ page }) => {
        await page.goto('/frame/02');

        // 1. Topbar
        const topbar = page.locator('header.topbar');
        await expect(topbar).toBeVisible();
        await expect(topbar.locator('.app-pill')).toContainText('Collaboration');
        await expect(topbar.locator('.search')).toContainText('Search everything');
        await expect(topbar.locator('.av.c1')).toBeVisible();

        // 2. Navigation rail
        const rail = page.locator('nav.appnav');
        await expect(rail).toBeVisible();
        await expect(rail.locator('.jump')).toContainText('Jump to a space');
        await expect(rail.locator('.nav-item').filter({ hasText: 'Home' })).toBeVisible();
        await expect(rail.locator('.nav-item').filter({ hasText: 'Inbox' })).toContainText('4');
        await expect(rail.locator('.nav-item').filter({ hasText: 'My tasks' })).toContainText('6');

        // Spaces tree in rail
        const discoveryItem = rail.locator('.tree-item.active');
        await expect(discoveryItem).toContainText('Discovery');
        await expect(discoveryItem.locator('.unread')).toBeVisible();

        // 3. Space Header & Breadcrumbs
        const header = page.locator('section.space-head');
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

        // 4. Audience Pill
        const aud = header.locator('.aud');
        await expect(aud).toBeVisible();
        await expect(aud).toContainText('9 people');
        await expect(aud).toContainText('3 Meridian · 6 Northwind');

        // 5. Tabs
        const tabs = header.locator('.tabs .tab');
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
    });

    test('supports dark mode via ?theme=dark query param', async ({ page }) => {
        await page.goto('/frame/02?theme=dark');
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');

        const header = page.locator('section.space-head');
        await expect(header).toBeVisible();
        await expect(header.locator('h1.h1')).toHaveText('Discovery');
    });
});
