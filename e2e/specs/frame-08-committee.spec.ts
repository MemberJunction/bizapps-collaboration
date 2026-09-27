import { test, expect, Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    });
}

test.describe('Frame 08 — Board & Committee Member Portal', () => {
    test('renders board header, custom tabs, meeting card, agenda card, and active vote card', async ({ page }) => {
        await page.goto('/frame/08');
        await ensureFontsLoaded(page);

        // 1. Topbar & Rail
        const topbar = page.locator('header.topbar');
        await expect(topbar).toBeVisible();
        await expect(topbar.locator('.av')).toHaveText('DW');

        const rail = page.locator('mjc-space-rail');
        await expect(rail).toBeVisible();
        await expect(rail).toContainText('Audit Committee');

        // 2. Space Header
        const header = page.locator('mjc-space-header');
        await expect(header).toBeVisible();
        await expect(header.locator('h1')).toHaveText('Audit Committee');
        await expect(header.locator('.chip.plain')).toHaveText('Committee');
        await expect(header).toContainText('Financial reporting, internal controls and the external audit');

        // 3. Audience Pill (7 members, 2 outside directors)
        const audiencePill = page.locator('mjc-audience-pill');
        await expect(audiencePill).toBeVisible();
        await expect(audiencePill).toContainText('7 members');
        await expect(audiencePill).toContainText('2 outside directors');

        // 4. Custom Tabs contributed by ExampleBoardUIDriver
        const tabs = page.locator('mjc-space-tabs');
        await expect(tabs).toContainText('Overview');
        await expect(tabs).toContainText('Meetings');
        await expect(tabs).toContainText('Papers');
        await expect(tabs).toContainText('Motions');
        await expect(tabs).toContainText('Members');
        await expect(tabs).toContainText('Chat');

        // 5. Overview Cards contributed by ExampleBoardUIDriver
        const nextMeetingCard = page.locator('mjc-example-board-next-meeting-card');
        await expect(nextMeetingCard).toBeVisible();
        await expect(nextMeetingCard).toContainText('Q3 Audit Committee meeting');
        await expect(nextMeetingCard).toContainText('Q3 board pack');

        const agendaCard = page.locator('mjc-example-board-agenda-card');
        await expect(agendaCard).toBeVisible();
        await expect(agendaCard).toContainText('Call to order; minutes of July 17');
        await expect(agendaCard).toContainText('Motion 2026-14: appoint the external auditor');

        const voteCard = page.locator('mjc-example-board-vote-card');
        await expect(voteCard).toBeVisible();
        await expect(voteCard).toContainText('Your vote is needed');
        await expect(voteCard).toContainText('Motion 2026-14');
        await expect(voteCard).toContainText('Appoint Hartwell & Co.');
        await expect(voteCard.locator('button:has-text("For")')).toBeVisible();

        const membersCard = page.locator('mjc-example-board-members-card');
        await expect(membersCard).toBeVisible();
        await expect(membersCard).toContainText('Margaret Cole · chair');
        await expect(membersCard).toContainText('Ken Mori · outside director');

        // Save screenshot
        const screenshot = await page.screenshot({ fullPage: true });
        saveTestResultScreenshot('frame-08-rendered.png', screenshot);
    });

    test('switches tabs to Meetings, Papers, and Motions', async ({ page }) => {
        await page.goto('/frame/08');
        await ensureFontsLoaded(page);

        // Click Meetings tab
        await page.locator('mjc-space-tabs .tab:has-text("Meetings")').click();
        const meetingsTab = page.locator('mjc-example-board-meetings-tab');
        await expect(meetingsTab).toBeVisible();
        await expect(meetingsTab).toContainText('Committee Meetings');
        await expect(meetingsTab).toContainText('Q3 Audit Committee Meeting');

        // Click Papers tab
        await page.locator('mjc-space-tabs .tab:has-text("Papers")').click();
        const papersTab = page.locator('mjc-example-board-papers-tab');
        await expect(papersTab).toBeVisible();
        await expect(papersTab).toContainText('Committee Papers & Packs');

        // Click Motions tab
        await page.locator('mjc-space-tabs .tab:has-text("Motions")').click();
        const motionsTab = page.locator('mjc-example-board-motions-tab');
        await expect(motionsTab).toBeVisible();
        await expect(motionsTab).toContainText('Motions & E-Ballots');
    });
});
