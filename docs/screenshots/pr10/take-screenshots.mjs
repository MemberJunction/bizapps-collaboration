// Takes PR 10's screenshots in Explorer with Playwright, as the people the plan names, in light and dark, and asserts what each
// screen must show before it saves the shot. See README.md for the setup.
//
//   node --env-file=.env docs/screenshots/pr10/take-screenshots.mjs [--who guest|staff|all] [--theme light|dark|both] [--only <name>]
//   node docs/screenshots/pr10/take-screenshots.mjs --save-staff-session     (opens a browser: sign in once as staff)
//
// The guest is a seated outside member who signs in by magic link; the script mints the session itself. Staff sign in with the
// host's provider, so their session is saved once by hand (--save-staff-session) and reused; the file stays out of git.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { mintGuestSession } from '../../../packages/IntegrationTests/dist/screenshots/magic-link-session.js';

const here = dirname(fileURLToPath(import.meta.url));
const EXPLORER = (process.env.EXPLORER_URL ?? 'http://localhost:4217').replace(/\/$/, '');
const MJAPI = (process.env.MJAPI_URL ?? 'http://localhost:4117').replace(/\/$/, '');
const GUEST_EMAIL = process.env.SCREENSHOT_GUEST_EMAIL ?? '';
const STAFF_SESSION = join(here, 'staff-session.json');
const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const CLOSED_THIS_MONTH = 'C1000001-0000-4000-8000-000000000007';
const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const who = option('--who', 'all');
const themes = { light: ['light'], dark: ['dark'], both: ['light', 'dark'] }[option('--theme', 'both')];
const only = option('--only', null);

const spaceUrl = (spaceId, tab) => `${EXPLORER}/app/collaboration/Spaces?view=space&tab=${tab}&space=${spaceId}`;

/** Fails the run when `page` doesn't show every text in `present`, or shows any in `absent`. */
async function assertScreen(page, name, { present = [], absent = [] }) {
    for (const text of present) {
        await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {
            throw new Error(`${name}: "${text}" is not on the screen`);
        });
    }
    const body = await page.locator('body').innerText();
    for (const text of absent) if (body.includes(text)) throw new Error(`${name}: "${text}" must not be on the screen`);
}

const SAMPLE_PDF = join(here, 'sample.pdf');
const SAMPLE_NAME = 'sample.pdf';

/** Puts `sample.pdf` in Northwind's Shared band once, as the guest, so the viewer has a real page to paint. The world's own PDFs are stubs. */
async function ensureSamplePdf(page) {
    await page.goto(spaceUrl(NORTHWIND, 'library'));
    await page.getByText('executive-roadmap.pdf').first().waitFor({ state: 'visible', timeout: 20000 });
    if ((await page.locator('body').innerText()).includes(SAMPLE_NAME)) return;
    await page.getByRole('button', { name: /Upload/ }).first().click();
    await page.getByText('Add document to Northwind relationship').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PDF);
    await page.getByRole('button', { name: /Upload file/ }).click();
    await page.getByText(SAMPLE_NAME).first().waitFor({ state: 'visible', timeout: 30000 });
}

/** The screens, in the plan's order (pr10-plan § 4's table). Each step drives the page and says what the shot must show. */
const SHOTS = [
    {
        name: '01-client-overview', who: 'guest', item: '25, D42',
        run: async (page) => {
            await page.goto(spaceUrl(NORTHWIND, 'overview'));
            await assertScreen(page, '01', { present: ['Shared with everyone in this space', 'executive-roadmap.pdf'], absent: ['Team only', 'northwind-internal'] });
        },
    },
    {
        name: '02-client-library', who: 'guest', item: '25',
        run: async (page) => {
            await page.goto(spaceUrl(NORTHWIND, 'library'));
            await assertScreen(page, '02', { present: ['executive-roadmap.pdf', 'Shared'], absent: ['master-services-agreement.pdf', 'northwind-account-plan.txt'] });
        },
    },
    {
        name: '03-client-file-viewer', who: 'guest', item: '29',
        run: async (page) => {
            await ensureSamplePdf(page);
            // The name also sits in hidden copies (the upload toast, a collapsed panel): click the visible row
            await page.getByText(SAMPLE_NAME, { exact: true }).filter({ visible: true }).first().click();
            await page.getByRole('button', { name: /Open Document/i }).click();
            // MJ's record tab: the file's name in the tab strip, and the way back to the space above the viewer
            await page.locator('.mj-file-viewer-stage, iframe').first().waitFor({ state: 'attached', timeout: 20000 });
            const text = await page.locator('body').innerText();
            for (const needle of [SAMPLE_NAME, 'Collaboration', 'Spaces']) if (!text.includes(needle)) throw new Error(`03: "${needle}" is not on the screen`);
            await page.waitForTimeout(4000); // the PDF frame paints after the record loads
        },
    },
    {
        name: '04-client-people', who: 'guest', item: '25',
        run: async (page) => {
            await page.goto(spaceUrl(NORTHWIND, 'people'));
            await assertScreen(page, '04', { present: ['Active', 'Outside member', 'Owner'] });
        },
    },
    {
        name: '05-client-chat-open', who: 'guest', item: '25, 23',
        run: async (page) => {
            await page.goto(spaceUrl(NORTHWIND, 'chat'));
            await page.getByText('northwind-general').first().click();
            await assertScreen(page, '05', { present: ['northwind-general'], absent: ['northwind-internal', 'Consulting Team'] });
            await page.waitForTimeout(1500);
        },
    },
    {
        name: '06-client-closed-chat', who: 'guest', item: '25, MJ#4838',
        run: async (page) => {
            await page.goto(spaceUrl(CLOSED_THIS_MONTH, 'chat'));
            await assertScreen(page, '06', { present: ['Closed this month'] });
            await page.locator('.read-only-lock').first().waitFor({ state: 'visible', timeout: 20000 });
        },
    },
    {
        name: '07-client-lock-reason', who: 'guest', item: '121, 125',
        run: async (page) => {
            await page.goto(spaceUrl(CLOSED_THIS_MONTH, 'chat'));
            const lock = page.locator('.read-only-lock').first();
            await lock.waitFor({ state: 'visible', timeout: 20000 });
            await lock.focus(); // focus shows the reason (item 125); Enter would toggle it closed again
            await page.locator('.read-only-reason').first().waitFor({ state: 'visible', timeout: 5000 });
        },
    },
    {
        name: '08-client-upload-dialog', who: 'guest', item: '38',
        run: async (page) => {
            await page.goto(spaceUrl(NORTHWIND, 'library'));
            await page.getByRole('button', { name: /Upload/ }).first().click();
            await assertScreen(page, '08', { present: ['Add document to Northwind relationship', 'Who can see this?'] });
            // An outside member's band choice: Shared only; the Team option is for seats that see the Team band
            const dialog = await page.locator('body').innerText();
            if (dialog.includes('Only the team can see it')) throw new Error('08: the Team band is offered to an outside member');
        },
    },
    // Staff screens run once staff-session.json exists (see --save-staff-session). The items they cover: 23's five with the real
    // agent answering, 38 (Discovery's default band is Team and Sam's Shared choice is refused), 70's row (a type with the library
    // off), D42's three board forms, 121 (switching spaces on Chat with no note) and MJ#4884/4885 (a turn's live status).
    {
        name: '10-staff-overview', who: 'staff', item: '25',
        run: async (page) => {
            await page.goto(spaceUrl(NORTHWIND, 'overview'));
            await assertScreen(page, '10', { present: ['Team only', 'Shared with everyone in this space'] });
        },
    },
    {
        name: '11-staff-discovery-upload-default-team', who: 'staff', item: '38',
        run: async (page) => {
            await page.goto(spaceUrl(DISCOVERY, 'library'));
            await page.getByRole('button', { name: /Upload/ }).first().click();
            await assertScreen(page, '11', { present: ['Add document to Discovery', 'Only the team can see it'] });
        },
    },
    {
        name: '12-staff-chat-switch-no-note', who: 'staff', item: '121',
        run: async (page) => {
            // Staff's chat page lists sections and conversations, not child spaces, so the switch is a navigation.
            await page.goto(spaceUrl(NORTHWIND, 'chat'));
            await page.getByText('New Conversation').first().waitFor();
            await page.goto(spaceUrl(DISCOVERY, 'chat'));
            await page.getByText('New Conversation').first().waitFor();
            await page.waitForTimeout(800);
            await assertScreen(page, '12', { present: ['Discovery'], absent: ["can't post", 'not on the roster'] });
        },
    },
];

async function saveStaffSession() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    await page.goto(`${EXPLORER}/`);
    console.log('Sign in as staff in the browser window. The session is saved when the Spaces page is shown.');
    await page.waitForURL(/\/app\//, { timeout: 10 * 60 * 1000 });
    await page.waitForTimeout(3000);
    await context.storageState({ path: STAFF_SESSION });
    console.log(`Saved ${STAFF_SESSION}. Keep it out of git.`);
    await browser.close();
}

async function main() {
    if (args.includes('--save-staff-session')) return saveStaffSession();
    mkdirSync(here, { recursive: true });
    const wanted = SHOTS.filter((s) => (who === 'all' || s.who === who) && (!only || s.name === only));
    const needsGuest = wanted.some((s) => s.who === 'guest');
    const needsStaff = wanted.some((s) => s.who === 'staff');
    if (needsGuest && !GUEST_EMAIL) throw new Error('Set SCREENSHOT_GUEST_EMAIL to a seated outside member (an invite from an owner seats them).');
    if (needsStaff && !existsSync(STAFF_SESSION)) {
        console.log(`No ${STAFF_SESSION}: the staff screens are skipped. Run --save-staff-session first.`);
    }
    const guest = needsGuest ? await mintGuestSession(GUEST_EMAIL, MJAPI) : null;

    // The full Chromium build, not the headless shell: only it paints a PDF in the viewer's frame
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' });
    const failures = [];
    try {
        for (const theme of themes) {
            for (const shot of wanted) {
                if (shot.who === 'staff' && !existsSync(STAFF_SESSION)) continue;
                const context = await browser.newContext({
                    viewport: { width: 1600, height: 1000 },
                    colorScheme: theme,
                    ...(shot.who === 'staff' ? { storageState: STAFF_SESSION } : {}),
                });
                await context.addInitScript((t) => { try { localStorage.setItem('mj-theme', t); } catch { /* theme falls back */ } }, theme);
                const page = await context.newPage();
                const errors = [];
                page.on('pageerror', (e) => errors.push(String(e)));
                try {
                    if (shot.who === 'guest') {
                        // The session token rides in the fragment, as the redeem's redirect sends it; Explorer reads it on load
                        await page.goto(`${EXPLORER}/app/${guest.applicationPath}#token=${encodeURIComponent(guest.token)}`, { waitUntil: 'load' });
                        await page.getByText('All Spaces').first().waitFor({ state: 'visible', timeout: 60000 });
                    }
                    await shot.run(page);
                    await page.waitForTimeout(400);
                    const file = join(here, `${shot.name}-${theme}.png`);
                    await page.screenshot({ path: file });
                    console.log(`ok   ${shot.name}-${theme}.png (item ${shot.item})${errors.length ? `  page errors: ${errors.length}` : ''}`);
                } catch (error) {
                    // The failed screen is kept beside the others, so the assertion can be read against what was shown
                    await page.screenshot({ path: join(here, `${shot.name}-${theme}-FAILED.png`) }).catch(() => undefined);
                    failures.push(`${shot.name}-${theme}: ${error instanceof Error ? error.message : String(error)}`);
                    console.log(`FAIL ${shot.name}-${theme}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
                } finally {
                    await context.close();
                }
            }
        }
    } finally {
        await browser.close();
    }
    if (failures.length) {
        console.error(`${failures.length} screenshot(s) failed their assertions:\n${failures.join('\n')}`);
        process.exit(1);
    }
}

await main();
