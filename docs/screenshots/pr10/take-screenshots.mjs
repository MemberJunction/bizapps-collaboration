// Takes PR 10's screenshots in Explorer with Playwright, as the people the plan names, in light and dark, and asserts what each
// screen must show before it saves the shot. See README.md for the setup.
//
//   node --env-file=.env docs/screenshots/pr10/take-screenshots.mjs [--who guest|leader|staff|all] [--theme light|dark|both] [--only <name>]
//   node docs/screenshots/pr10/take-screenshots.mjs --save-staff-session     (opens a browser: sign in once as staff)
//
// The guest is a seated outside member who signs in by magic link; the script mints the session itself. Staff sign in with the
// host's provider, so their session is saved once by hand (--save-staff-session) and reused; the file stays out of git.
// Stage 2's screens (20 to 33) add the leader: a chapter leader from the sample world, who also signs in by magic link.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { mintGuestSession } from '../../../packages/IntegrationTests/dist/screenshots/magic-link-session.js';
import { latestAuditLogId } from '../../../packages/IntegrationTests/dist/screenshots/latest-audit-log.js';

const here = dirname(fileURLToPath(import.meta.url));
const EXPLORER = (process.env.EXPLORER_URL ?? 'http://localhost:4217').replace(/\/$/, '');
const MJAPI = (process.env.MJAPI_URL ?? 'http://localhost:4117').replace(/\/$/, '');
const GUEST_EMAIL = process.env.SCREENSHOT_GUEST_EMAIL ?? '';
/** The chapter leader of the sample world's chapter 12 (a Space Participant with no host account): `personas.csv`'s lena. */
const LEADER_EMAIL = process.env.SCREENSHOT_LEADER_EMAIL ?? 'lena.leader@collab-world.example';
const STAFF_SESSION = join(here, 'staff-session.json');
const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const CLOSED_THIS_MONTH = 'C1000001-0000-4000-8000-000000000007';
const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';
// Stage 2's chapter world (spaces.csv): two chapters of the example-chapter type, a same-type sub-space and a staff-only sub-space
const CHAPTER_12 = 'C1000001-0000-4000-8000-000000000016';
const CHAPTER_40 = 'C1000001-0000-4000-8000-000000000017';
const CHAPTER_12_OUTREACH = 'C1000001-0000-4000-8000-000000000018';
const CHAPTER_12_STAFF = 'C1000001-0000-4000-8000-000000000019';
const EXAMPLE_CHAPTER_TYPE = 'C716F54B-23F7-4C6D-AD12-F7C95D33F0D0';
const GRANT_RUN_LOG_TYPE = '67486965-904D-4C18-8F20-5EDA97BFD2B4';
const SPACE_TYPES = 'MJ_BizApps_Collaboration: Space Types';
const AUDIT_LOGS = 'MJ: Audit Logs';
const CHAPTER_MEMBERS = 'MJ_BizApps_Collaboration_Examples: Example Chapter Members';
const recordUrl = (entity, id) => `${EXPLORER}/resource/record/${encodeURIComponent(entity)}/${id}`;
const listUrl = (entity) => `${EXPLORER}/resource/view/dynamic/${encodeURIComponent(entity)}`;

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
    // Stage 2, the server: what it changed on screen. The leader is seated on chapter 12 (Shared band) and nowhere else; the
    // staff-only sub-space (D34, 157) and the other chapter stay out of her list, the same-type sub-space (D30, row 18) is in it,
    // and the People tab reads with the type's label (53, 101). The data reach itself (B18) has no screen until B19 in stage 4:
    // it is checked over the wire (SC1) and in the persona check. Band names from the type (Labels.Bands) reach the dialogs in
    // stage 4 too; today the upload dialog keeps its default words.
    {
        name: '20-leader-chapter-overview', who: 'leader', item: 'B24, 157, 18',
        run: async (page) => {
            await page.goto(spaceUrl(CHAPTER_12, 'overview'));
            await assertScreen(page, '20', { present: ['Chapter 12', 'Chapter 12 outreach'], absent: ['Chapter 12 staff', 'Chapter 40'] });
        },
    },
    {
        name: '21-leader-chapter-members-tab', who: 'leader', item: '53, 101',
        run: async (page) => {
            await page.goto(spaceUrl(CHAPTER_12, 'people'));
            // The type's Labels.Tabs renames People to Members for every chapter; the label lands when the server's document does
            await page.getByRole('tab', { name: /Members/ }).waitFor({ state: 'visible', timeout: 20000 }).catch(() => { throw new Error('21: the People tab does not read "Members"'); });
            await assertScreen(page, '21', { present: ['Lena'], absent: ['Chapter 12 staff'] });
        },
    },
    {
        name: '22-leader-same-type-subspace', who: 'leader', item: '18, D30',
        run: async (page) => {
            await page.goto(spaceUrl(CHAPTER_12_OUTREACH, 'overview'));
            await assertScreen(page, '22', { present: ['Chapter 12 outreach'], absent: ['Chapter 12 staff'] });
        },
    },
    {
        name: '23-leader-other-chapter-not-in-list', who: 'leader', item: '14, 17',
        run: async (page) => {
            // A link to a space she does not reach opens her own list instead: nothing of chapter 40 is shown
            await page.goto(spaceUrl(CHAPTER_40, 'overview'));
            await assertScreen(page, '23', { present: ['Chapter 12'], absent: ['Chapter 40'] });
        },
    },
    {
        name: '24-leader-upload-dialog', who: 'leader', item: '6, 38',
        run: async (page) => {
            await page.goto(spaceUrl(CHAPTER_12, 'library'));
            await page.getByRole('button', { name: /Upload/ }).first().click();
            await assertScreen(page, '24', { present: ['Add document to Chapter 12', 'Who can see this?'], absent: ['Only the team can see it'] });
        },
    },
    // Staff, seated on the staff-only sub-space as its owner and holding Developer: the sub-space itself, the type's record with
    // its grants, a grant run's log row, and the chapter members as a Developer reads them (unfiltered: the reach is the
    // participant role's).
    {
        name: '30-staff-staff-only-subspace', who: 'staff', item: '157, D34',
        run: async (page) => {
            await page.goto(spaceUrl(CHAPTER_12_STAFF, 'overview'));
            await assertScreen(page, '30', { present: ['Chapter 12 staff'] });
        },
    },
    {
        name: '31-staff-chapter-type-record', who: 'staff', item: 'B24, 13',
        run: async (page) => {
            await page.goto(recordUrl(SPACE_TYPES, EXAMPLE_CHAPTER_TYPE));
            await assertScreen(page, '31', { present: ['example-chapter'] });
            // The grants hang off the type as a related list; open it when the form offers it
            await page.getByText(/Space Grants/).first().click({ timeout: 5000 }).catch(() => undefined);
            await page.waitForTimeout(1500);
        },
    },
    {
        name: '32-staff-grant-run-log', who: 'staff', item: 'A2 stand-in, 16',
        run: async (page) => {
            const id = await latestAuditLogId(GRANT_RUN_LOG_TYPE);
            if (!id) throw new Error('32: no grant run is logged yet; run the stage2 harness bundle first');
            await page.goto(recordUrl(AUDIT_LOGS, id));
            await assertScreen(page, '32', { present: ['Collaboration: Grant Run'] });
        },
    },
    {
        name: '33-staff-chapter-members-entity', who: 'staff', item: 'B18, 14',
        run: async (page) => {
            await page.goto(listUrl(CHAPTER_MEMBERS));
            await assertScreen(page, '33', { present: ['Ivy', 'Lou'] });
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
    const needsLeader = wanted.some((s) => s.who === 'leader');
    const needsStaff = wanted.some((s) => s.who === 'staff');
    if (needsGuest && !GUEST_EMAIL) throw new Error('Set SCREENSHOT_GUEST_EMAIL to a seated outside member (an invite from an owner seats them).');
    if (needsStaff && !existsSync(STAFF_SESSION)) {
        console.log(`No ${STAFF_SESSION}: the staff screens are skipped. Run --save-staff-session first.`);
    }
    const sessions = {
        guest: needsGuest ? await mintGuestSession(GUEST_EMAIL, MJAPI) : null,
        leader: needsLeader ? await mintGuestSession(LEADER_EMAIL, MJAPI) : null,
    };

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
                    if (shot.who === 'guest' || shot.who === 'leader') {
                        // The session token rides in the fragment, as the redeem's redirect sends it; Explorer reads it on load
                        const session = sessions[shot.who];
                        await page.goto(`${EXPLORER}/app/${session.applicationPath}#token=${encodeURIComponent(session.token)}`, { waitUntil: 'load' });
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
