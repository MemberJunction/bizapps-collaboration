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

async function ensureFontsAndChatIconsLoaded(page: Page, selector = 'mjc-space-rail i[class*="fa-"]'): Promise<void> {
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

test.describe('CT-2 Space Chat Per-Answer Source Citation Chips & Receipts', () => {
    test('renders citation chips, enforces Shared reach filtering, toggles receipt inspector, opens cited source, and logs zero page/console errors in light & dark themes', async ({ page }) => {
        const pageErrors: string[] = [];
        const consoleErrors: string[] = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.goto('/frame/08');
        await ensureFontsAndChatIconsLoaded(page);

        await page.locator('mjc-space-tabs .tab:has-text("Chat")').click();
        const chatView = page.getByTestId('frame-08-chat-view');
        await expect(chatView).toBeVisible();
        await ensureFontsAndChatIconsLoaded(page, '[data-testid="frame-08-chat-view"] i[class*="fa-"]');

        const answerBody = page.getByTestId('frame-08-agent-answer-body');
        await expect(answerBody).toBeVisible();
        const answerText = (await answerBody.textContent()) ?? '';
        expect(answerText).not.toContain('###');
        expect(answerText).not.toContain('**');
        expect(answerText).not.toContain('[source:');

        const receipts = page.getByTestId('answer-source-receipts');
        await expect(receipts).toBeVisible();
        await expect(receipts).toContainText('Used 2 in-reach sources · 2 cited · Shared reach only');
        await expect(receipts).not.toContainText('Internal Partner Fee Margin.xlsx');

        const chips = receipts.getByTestId('answer-citation-chip');
        await expect(chips).toHaveCount(2);
        await expect(chips.nth(0)).toContainText('[1]');
        await expect(chips.nth(0)).toContainText('FY2026 Audit Committee Pack.pdf');
        await expect(chips.nth(1)).toContainText('[2]');
        await expect(chips.nth(1)).toContainText('Audit Charter Review Memo.docx');

        // Expand receipt inspector
        const toggle = receipts.getByTestId('receipt-inspect-toggle');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');

        const inspector = receipts.getByTestId('answer-receipt-inspector');
        await expect(inspector).toBeVisible();
        await expect(inspector.getByTestId('answer-receipt-row')).toHaveCount(2);
        await expect(inspector).toContainText('Vector match');
        await expect(inspector).toContainText('Lexical match');
        await expect(inspector).not.toContainText('Internal Partner Fee Margin.xlsx');

        // Click first citation chip to open the cited source
        await chips.nth(0).click();
        const banner = page.getByTestId('gallery-opened-source-banner');
        await expect(banner).toBeVisible();
        await expect(banner).toContainText('Opened source: FY2026 Audit Committee Pack.pdf (Shared)');

        await ensureFontsAndChatIconsLoaded(page, '[data-testid="frame-08-chat-view"] i[class*="fa-"]');
        saveScreenshot('c3-source-receipts-light.png', await page.screenshot({ fullPage: false, animations: 'disabled' }));

        // Verify dark theme renders cleanly with 0 errors as well
        await page.goto('/frame/08?theme=dark');
        await ensureFontsAndChatIconsLoaded(page);
        await page.locator('mjc-space-tabs .tab:has-text("Chat")').click();
        await expect(page.getByTestId('answer-source-receipts')).toBeVisible();
        await page.getByTestId('receipt-inspect-toggle').click();
        await expect(page.getByTestId('answer-receipt-inspector')).toBeVisible();
        await ensureFontsAndChatIconsLoaded(page, '[data-testid="frame-08-chat-view"] i[class*="fa-"]');
        saveScreenshot('c3-source-receipts-dark.png', await page.screenshot({ fullPage: false, animations: 'disabled' }));

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });
});
