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
    join(testResultsDir, 'xs8-viewport-telemetry.json'),
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
  expect(text).not.toContain('**');
  expect(text).not.toContain('`');
  expect(text).not.toContain('[cite:');
  expect(text).not.toContain('[source:');
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

    const lang = html.getAttribute('lang')?.trim() ?? '';
    if (!lang) {
      violations.push('Missing <html lang> attribute');
    }
    if (!document.title.trim()) {
      violations.push('Missing document <title>');
    }
    const mainEls = document.querySelectorAll('main');
    if (mainEls.length !== 1) {
      violations.push(`Expected exactly 1 <main> landmark, found ${mainEls.length}`);
    }
    const h1Els = document.querySelectorAll('h1');
    if (h1Els.length !== 1) {
      violations.push(`Expected exactly 1 <h1>, found ${h1Els.length}`);
    }

    // Verify no skipped heading levels
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let prevLevel = 0;
    for (const h of headings) {
      const level = Number(h.tagName.slice(1));
      if (prevLevel > 0 && level > prevLevel + 1) {
        violations.push(`Skipped heading level: h${prevLevel} -> h${level}`);
      }
      prevLevel = level;
    }

    // Verify no <aside> nested inside <main> (landmark-complementary-is-top-level)
    if (document.querySelector('main aside')) {
      violations.push('Complementary <aside> landmark nested inside <main>');
    }

    // Verify unique accessible names for role="region" landmarks
    const regionNames = new Map<string, number>();
    for (const region of document.querySelectorAll('[role="region"]')) {
      const ariaLabel = region.getAttribute('aria-label')?.trim() ?? '';
      const labelledBy = region.getAttribute('aria-labelledby')?.trim() ?? '';
      const labelledText = labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() ?? '' : '';
      const name = ariaLabel || labelledText;
      if (!name) {
        violations.push('role="region" missing accessible name');
      } else {
        regionNames.set(name, (regionNames.get(name) ?? 0) + 1);
      }
    }
    for (const [name, count] of regionNames.entries()) {
      if (count > 1) {
        violations.push(`Duplicate role="region" accessible name "${name}" (${count}x)`);
      }
    }

    // Verify visible buttons have accessible names
    for (const btn of document.querySelectorAll('button')) {
      const style = window.getComputedStyle(btn);
      if (style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }
      const text = btn.textContent?.trim() ?? '';
      const ariaLabel = btn.getAttribute('aria-label')?.trim() ?? '';
      const title = btn.getAttribute('title')?.trim() ?? '';
      if (!text && !ariaLabel && !title) {
        violations.push(`Button missing accessible name: ${btn.outerHTML.slice(0, 80)}`);
      }
    }

    // Verify zero broken images
    let brokenImages = 0;
    for (const img of document.querySelectorAll('img')) {
      if (img.complete && img.naturalWidth === 0) {
        brokenImages += 1;
      }
    }

    return {
      scrollWidth: html.scrollWidth,
      clientWidth: html.clientWidth,
      brokenImages,
      a11yViolations: violations,
    };
  });
}

test.describe('XS-8 Upload Ingest Model Disclosure UI', () => {
  test('serves /health and semantic HTML5 index without overflow or errors across desktop, tablet, and mobile viewports', async ({
    page,
    request,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const healthRes = await request.get('/health');
    expect(healthRes.status()).toBe(200);
    expect(await healthRes.json()).toEqual({ status: 'ok' });

    for (const vp of RESPONSIVE_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await ensureFontsAndIconsLoaded(page);
      const audit = await collectDomAndA11yAudit(page);
      expect(audit.scrollWidth, `Horizontal overflow on / at ${vp.name}`).toBeLessThanOrEqual(audit.clientWidth);
      expect(audit.brokenImages).toBe(0);
      expect(audit.a11yViolations).toEqual([]);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('renders collapsed and expanded upload ingest disclosure across light & dark themes and desktop/tablet/mobile viewports with WCAG 2.1 AA hygiene, semantic --mj-* tokens, loaded icon fonts, and zero errors', async ({
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

    const telemetry: ViewportTelemetryEntry[] = [];

    // 1. Light mode on Frame 09 across desktop (1440x900), tablet (768x1024), and mobile (390x844)
    for (const vp of RESPONSIVE_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/frame/09?theme=light');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await ensureFontsAndIconsLoaded(page, 'mjc-upload-dialog i[class*="fa-"]');

      const dialogDisclosure = page.locator('mjc-upload-dialog [data-testid="upload-ingest-disclosure"]');
      await expect(dialogDisclosure).toBeVisible();
      await expect(dialogDisclosure.getByTestId('disclosure-band-pill')).toContainText('Shared band');

      const toggle = dialogDisclosure.getByTestId('disclosure-toggle');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(dialogDisclosure.getByTestId('disclosure-details-panel')).toHaveCount(0);

      const collapsedAudit = await collectDomAndA11yAudit(page);
      expect(collapsedAudit.scrollWidth, `Overflow on /frame/09 collapsed at ${vp.name}`).toBeLessThanOrEqual(
        collapsedAudit.clientWidth,
      );
      expect(collapsedAudit.brokenImages).toBe(0);
      expect(collapsedAudit.a11yViolations).toEqual([]);

      if (vp.name === 'desktop') {
        saveScreenshot(
          'xs8-disclosure-collapsed-light.png',
          await page.screenshot({ fullPage: false, animations: 'disabled' }),
        );
      }

      // Expand details drawer
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const panel = dialogDisclosure.getByTestId('disclosure-details-panel');
      await expect(panel).toBeVisible();
      await ensureFontsAndIconsLoaded(
        page,
        'mjc-upload-dialog [data-testid="disclosure-details-panel"] i[class*="fa-"]',
      );
      assertNoRawMarkdownLeak((await dialogDisclosure.textContent()) ?? '');

      const expandedAudit = await collectDomAndA11yAudit(page);
      expect(expandedAudit.scrollWidth, `Overflow on /frame/09 expanded at ${vp.name}`).toBeLessThanOrEqual(
        expandedAudit.clientWidth,
      );
      expect(expandedAudit.brokenImages).toBe(0);
      expect(expandedAudit.a11yViolations).toEqual([]);

      const shotName = `xs8-disclosure-${vp.name}-${vp.width}x${vp.height}-light.png`;
      saveScreenshot(shotName, await page.screenshot({ fullPage: false, animations: 'disabled' }));

      telemetry.push({
        viewport: vp.name,
        route: '/frame/09?theme=light',
        theme: 'light',
        width: vp.width,
        height: vp.height,
        scrollWidth: expandedAudit.scrollWidth,
        clientWidth: expandedAudit.clientWidth,
        horizontalOverflowPx: Math.max(0, expandedAudit.scrollWidth - expandedAudit.clientWidth),
        brokenImages: expandedAudit.brokenImages,
        a11yViolations: expandedAudit.a11yViolations,
        screenshot: shotName,
      });
    }

    // 2. Desktop interactive checks: band switch, mode switch, light/dark token contrast
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/frame/09?theme=light');
    await ensureFontsAndIconsLoaded(page, 'mjc-upload-dialog i[class*="fa-"]');
    const dialogDisclosure = page.locator('mjc-upload-dialog [data-testid="upload-ingest-disclosure"]');
    const collapsedText = (await dialogDisclosure.textContent()) ?? '';
    expect(collapsedText).toContain('MemberJunction Storage');
    assertNoRawMarkdownLeak(collapsedText);

    const lightBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mj-bg-surface').trim(),
    );
    expect(lightBg.length).toBeGreaterThan(0);

    await dialogDisclosure.getByTestId('disclosure-toggle').click();
    const panel = dialogDisclosure.getByTestId('disclosure-details-panel');
    await expect(panel.getByTestId('disclosure-item-ingest')).toContainText('MemberJunction Storage');
    await expect(panel.getByTestId('disclosure-item-indexing')).toContainText('Content Pipeline');
    await expect(panel.getByTestId('disclosure-item-visibility')).toContainText('external space participants');
    await expect(panel.getByTestId('disclosure-item-retention')).toContainText('tombstones its content item');

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

    // 3. Dark mode on Frame 09 (expanded disclosure)
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
    await ensureFontsAndIconsLoaded(
      page,
      'mjc-upload-dialog [data-testid="disclosure-details-panel"] i[class*="fa-"]',
    );
    assertNoRawMarkdownLeak((await darkDisclosure.textContent()) ?? '');
    const darkAudit = await collectDomAndA11yAudit(page);
    expect(darkAudit.scrollWidth).toBeLessThanOrEqual(darkAudit.clientWidth);
    expect(darkAudit.a11yViolations).toEqual([]);

    saveScreenshot(
      'xs8-disclosure-expanded-dark.png',
      await page.screenshot({ fullPage: false, animations: 'disabled' }),
    );

    // 4. Frame 03 Library across desktop/tablet/mobile + Upload button opens Upload Dialog with XS-8 Disclosure
    for (const vp of RESPONSIVE_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/frame/03?theme=light');
      await ensureFontsAndIconsLoaded(page);
      const frame03Audit = await collectDomAndA11yAudit(page);
      expect(frame03Audit.scrollWidth, `Overflow on /frame/03 at ${vp.name}`).toBeLessThanOrEqual(
        frame03Audit.clientWidth,
      );
      expect(frame03Audit.brokenImages).toBe(0);
      expect(frame03Audit.a11yViolations).toEqual([]);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
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

    saveTelemetry(telemetry);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
