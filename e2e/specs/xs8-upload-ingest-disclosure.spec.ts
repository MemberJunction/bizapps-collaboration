import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testResultsDir = resolve(__dirname, '../test-results/gallery');

function saveScreenshot(filename: string, buffer: Buffer): void {
  mkdirSync(testResultsDir, { recursive: true });
  writeFileSync(join(testResultsDir, filename), buffer);
}

async function ensureFontsAndIconsLoaded(page: Page, selector = 'i[class*="fa-"]'): Promise<void> {
  await page.waitForSelector(selector, { state: 'attached' });
  await page.evaluate(async (sel) => {
    await document.fonts.ready;
    if (!document.fonts.check('16px Inter')) {
      throw new Error('Font check failed: Inter font did not load');
    }
    if (!document.fonts.check('900 16px "Font Awesome 6 Free"')) {
      throw new Error('Font check failed: Font Awesome 6 Free solid (900) font face not loaded');
    }
    const icons = document.querySelectorAll(sel);
    if (icons.length === 0) {
      throw new Error(`Font check failed: No Font Awesome icons matched "${sel}"`);
    }
    for (const icon of icons) {
      const content = window.getComputedStyle(icon, '::before').content;
      if (!content || content === 'none' || content === 'normal' || content === '""') {
        throw new Error(`Font check failed: icon "${icon.className}" has empty ::before glyph`);
      }
    }
  }, selector);
}

function assertNoRawMarkdownLeak(text: string): void {
  expect(text).not.toContain('###');
  expect(text).not.toContain('**');
  expect(text).not.toContain('`');
  expect(text).not.toContain('[cite:');
  expect(text).not.toContain('[source:');
}

test.describe('XS-8 Upload Ingest Model Disclosure UI', () => {
  test('renders collapsed and expanded upload ingest disclosure across light & dark themes with semantic --mj-* tokens, loaded icon fonts, and zero errors', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Light mode on Frame 09 (Upload Dialog + Library Upload Disclosure)
    await page.goto('/frame/09?theme=light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await ensureFontsAndIconsLoaded(page, 'mjc-upload-dialog i[class*="fa-"]');

    const dialogDisclosure = page.locator('mjc-upload-dialog [data-testid="upload-ingest-disclosure"]');
    await expect(dialogDisclosure).toBeVisible();
    await expect(dialogDisclosure.getByTestId('disclosure-band-pill')).toContainText('Shared band');

    const toggle = dialogDisclosure.getByTestId('disclosure-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(dialogDisclosure.getByTestId('disclosure-details-panel')).toHaveCount(0);

    const collapsedText = (await dialogDisclosure.textContent()) ?? '';
    expect(collapsedText).toContain('MemberJunction Storage');
    assertNoRawMarkdownLeak(collapsedText);

    const lightBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mj-bg-surface').trim(),
    );
    expect(lightBg.length).toBeGreaterThan(0);

    saveScreenshot(
      'xs8-disclosure-collapsed-light.png',
      await page.screenshot({ fullPage: false, animations: 'disabled' }),
    );

    // Expand details drawer in light mode
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = dialogDisclosure.getByTestId('disclosure-details-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('disclosure-item-ingest')).toContainText('MemberJunction Storage');
    await expect(panel.getByTestId('disclosure-item-indexing')).toContainText('Content Pipeline');
    await expect(panel.getByTestId('disclosure-item-visibility')).toContainText('external space participants');
    await expect(panel.getByTestId('disclosure-item-retention')).toContainText('tombstones its content item');
    assertNoRawMarkdownLeak((await panel.textContent()) ?? '');
    await ensureFontsAndIconsLoaded(page, 'mjc-upload-dialog [data-testid="disclosure-details-panel"] i[class*="fa-"]');

    // Switch band to Team and mode to Link to verify dynamic disclosure copy
    await page.locator('mjc-upload-dialog input[type="radio"][value="Team"]').check();
    await expect(dialogDisclosure.getByTestId('disclosure-band-pill')).toContainText('Team band');
    await expect(panel.getByTestId('disclosure-item-visibility')).toContainText('visible only to team seats');

    await page.locator('mjc-upload-dialog mj-tab-nav').getByText('Link cloud doc').click();
    await expect(panel.getByTestId('disclosure-item-ingest')).toContainText('without copying binary bytes');
    await page.locator('mjc-upload-dialog mj-tab-nav').getByText('Upload file').click();
    await page.locator('mjc-upload-dialog input[type="radio"][value="Shared"]').check();

    saveScreenshot(
      'xs8-disclosure-expanded-light.png',
      await page.screenshot({ fullPage: false, animations: 'disabled' }),
    );

    // 2. Dark mode on Frame 09 (expanded disclosure)
    await page.goto('/frame/09?theme=dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await ensureFontsAndIconsLoaded(page, 'mjc-upload-dialog i[class*="fa-"]');

    const darkBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mj-bg-surface').trim(),
    );
    expect(darkBg.length).toBeGreaterThan(0);
    expect(darkBg).not.toBe(lightBg);

    const darkDisclosure = page.locator('mjc-upload-dialog [data-testid="upload-ingest-disclosure"]');
    await darkDisclosure.getByTestId('disclosure-toggle').click();
    await expect(darkDisclosure.getByTestId('disclosure-details-panel')).toBeVisible();
    await ensureFontsAndIconsLoaded(page, 'mjc-upload-dialog [data-testid="disclosure-details-panel"] i[class*="fa-"]');
    assertNoRawMarkdownLeak((await darkDisclosure.textContent()) ?? '');

    saveScreenshot(
      'xs8-disclosure-expanded-dark.png',
      await page.screenshot({ fullPage: false, animations: 'disabled' }),
    );

    // 3. Frame 03 Library Upload button opens Upload Dialog with XS-8 Disclosure
    await page.goto('/frame/03?theme=light');
    await ensureFontsAndIconsLoaded(page);
    await page.getByTestId('frame-03-upload-btn').click();
    const frame03Disclosure = page.locator('mjc-upload-dialog [data-testid="upload-ingest-disclosure"]');
    await expect(frame03Disclosure).toBeVisible();
    await frame03Disclosure.getByTestId('disclosure-toggle').click();
    await expect(frame03Disclosure.getByTestId('disclosure-details-panel')).toBeVisible();
    saveScreenshot(
      'xs8-library-upload-dialog-light.png',
      await page.screenshot({ fullPage: false, animations: 'disabled' }),
    );

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
