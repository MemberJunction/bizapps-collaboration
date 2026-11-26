import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testResultsDir = resolve(__dirname, '../test-results/gallery');

interface ViewportSpec {
  name: 'desktop' | 'tablet' | 'mobile';
  width: number;
  height: number;
}

const RESPONSIVE_VIEWPORTS: readonly ViewportSpec[] = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

interface ViewportTelemetryEntry {
  viewport: ViewportSpec['name'];
  route: string;
  theme: 'light' | 'dark';
  width: number;
  height: number;
  scrollWidth: number;
  clientWidth: number;
  horizontalOverflowPx: number;
  brokenImages: number;
  pageErrors: number;
  consoleErrors: number;
  a11yViolations: string[];
  screenshot: string;
}

function saveScreenshot(filename: string, buffer: Buffer): void {
  mkdirSync(testResultsDir, { recursive: true });
  writeFileSync(join(testResultsDir, filename), buffer);
}

function saveTelemetry(entries: ViewportTelemetryEntry[]): void {
  mkdirSync(testResultsDir, { recursive: true });
  writeFileSync(
    join(testResultsDir, 'spacenote-turn-into-doc-telemetry.json'),
    JSON.stringify({ schemaVersion: 'ux-fidelity/v1', viewports: entries }, null, 2),
    'utf8',
  );
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
  expect(text).not.toContain('## ');
  expect(text).not.toContain('**');
  expect(text).not.toContain('`');
}

async function collectDomAndA11yAudit(page: Page): Promise<{
  scrollWidth: number;
  clientWidth: number;
  brokenImages: number;
  a11yViolations: string[];
}> {
  return page.evaluate(() => {
    const violations: string[] = [];
    const html = document.documentElement;
    if (!(html.getAttribute('lang')?.trim() ?? '')) violations.push('Missing <html lang>');
    if (!document.title.trim()) violations.push('Missing document <title>');
    const mainEls = document.querySelectorAll('main');
    if (mainEls.length !== 1) violations.push(`Expected 1 <main>, found ${mainEls.length}`);
    const h1Els = document.querySelectorAll('h1');
    if (h1Els.length !== 1) violations.push(`Expected 1 <h1>, found ${h1Els.length}`);
    if (document.querySelector('main aside')) violations.push('Complementary <aside> nested inside <main>');

    const imgs = Array.from(document.querySelectorAll('img'));
    const brokenImages = imgs.filter((img) => !img.complete || img.naturalWidth === 0).length;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      brokenImages,
      a11yViolations: violations,
    };
  });
}

test.describe('SpaceNotes Turn Into Native MJ: Artifacts Markdown Document (Frame 10)', () => {
  test('promotes SpaceNotes into native Markdown Documents with semantic --mj-* tokens, zero raw Markdown leaks, and responsive Light/Dark fidelity', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const telemetry: ViewportTelemetryEntry[] = [];

    for (const theme of ['light', 'dark'] as const) {
      for (const vp of RESPONSIVE_VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`/frame/10?theme=${theme}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('[data-testid="turn-into-document-btn"]');
        await ensureFontsAndIconsLoaded(page);

        const bodyText = await page.locator('mjc-space-notes').innerText();
        assertNoRawMarkdownLeak(bodyText);
        expect(bodyText).toContain('Discovery Synthesis & Risk Register');
        expect(bodyText).toContain('Untitled Note');

        // Verify semantic --mj-* styling and clean layout before promotion
        const preAudit = await collectDomAndA11yAudit(page);
        expect(preAudit.brokenImages).toBe(0);
        expect(preAudit.a11yViolations).toEqual([]);
        expect(preAudit.scrollWidth - preAudit.clientWidth).toBeLessThanOrEqual(2);

        // Trigger "Turn into document" on the first Team SpaceNote
        await page.locator('[data-testid="turn-into-document-btn"]').first().click();
        await page.waitForSelector('[data-testid="frame-10-doc-drawer"]');

        const drawerTitle = await page.locator('[data-testid="frame-10-doc-drawer-title"]').innerText();
        expect(drawerTitle).toContain('Discovery Synthesis & Risk Register');

        const drawerText = await page.locator('[data-testid="frame-10-doc-drawer"]').innerText();
        assertNoRawMarkdownLeak(drawerText);
        expect(drawerText).toContain('MJ: Artifacts · Markdown Document · v1');
        expect(drawerText).toContain('Routed via NavigationService');

        const screenshotName = `spacenote-turn-into-doc-${vp.name}-${theme}.png`;
        saveScreenshot(screenshotName, await page.screenshot({ fullPage: false }));

        // Close drawer and verify local document list refreshed in-place without reload
        await page.locator('[data-testid="frame-10-doc-drawer-close"]').click();
        await expect(page.locator('[data-testid="frame-10-doc-drawer"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="note-promoted-banner"]')).toHaveCount(1);
        await expect(page.locator('[data-testid="frame-10-doc-count"]')).toContainText('3 documents');

        const postAudit = await collectDomAndA11yAudit(page);
        expect(postAudit.brokenImages).toBe(0);
        expect(postAudit.a11yViolations).toEqual([]);
        expect(postAudit.scrollWidth - postAudit.clientWidth).toBeLessThanOrEqual(2);

        telemetry.push({
          viewport: vp.name,
          route: `/frame/10?theme=${theme}`,
          theme,
          width: vp.width,
          height: vp.height,
          scrollWidth: postAudit.scrollWidth,
          clientWidth: postAudit.clientWidth,
          horizontalOverflowPx: Math.max(0, postAudit.scrollWidth - postAudit.clientWidth),
          brokenImages: postAudit.brokenImages,
          pageErrors: pageErrors.length,
          consoleErrors: consoleErrors.length,
          a11yViolations: postAudit.a11yViolations,
          screenshot: screenshotName,
        });
      }
    }

    saveTelemetry(telemetry);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
