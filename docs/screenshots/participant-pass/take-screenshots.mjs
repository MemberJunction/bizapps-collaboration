// The participant pass: signs in as an outside participant by magic link and opens every screen of a space, in light and dark,
// asserting that each rendered (no loading screen, no error state, the screen's own landmark present). It exists because MJ's
// Explorer shell on 6.2 edge needs the resource-type catalog at startup; a participant whose read was empty hung on the loading
// screen. Playwright is installed beside PR 10's script (docs/screenshots/pr10/node_modules), which this reuses.
//
//   node --env-file=.env.base docs/screenshots/participant-pass/take-screenshots.mjs [--theme light|dark|both] [--only <name>[,<name>…]]
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../pr10/node_modules/playwright/index.mjs';
import { mintGuestSession } from '../../../packages/IntegrationTests/dist/screenshots/magic-link-session.js';

const here = dirname(fileURLToPath(import.meta.url));
const EXPLORER = (process.env.EXPLORER_URL ?? 'http://localhost:4218').replace(/\/$/, '');
const MJAPI = (process.env.MJAPI_URL ?? 'http://localhost:4119').replace(/\/$/, '');
/** Bea: a Space Participant with a Shared seat on Discovery (the sample world's `personas.csv`). */
const PARTICIPANT = process.env.SCREENSHOT_PARTICIPANT_EMAIL ?? 'bea.member@collab-world.example';
const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const themes = { light: ['light'], dark: ['dark'], both: ['light', 'dark'] }[option('--theme', 'both')];
const only = option('--only', null);
const spaceUrl = (tab) => `${EXPLORER}/app/collaboration/Spaces?view=space&tab=${tab}&space=${DISCOVERY}`;

/** What no screen may show: the shell's stuck loading state, MJ's refusal page, and a view that failed to register. */
const NEVER = ['Taking longer than expected', 'Access Restricted', "isn't available in the running build", 'could not be read'];

async function assertScreen(page, name, present) {
    for (const text of present) {
        await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
            throw new Error(`${name}: "${text}" is not on the screen`);
        });
    }
    const body = await page.locator('body').innerText();
    for (const text of NEVER) if (body.includes(text)) throw new Error(`${name}: the screen shows "${text}"`);
}

const SHOTS = [
    { name: '01-home', url: `${EXPLORER}/app/collaboration`, present: ['All spaces'] },
    { name: '02-discovery-overview', url: spaceUrl('overview'), present: ['Discovery', 'Overview'] },
    { name: '03-discovery-documents', url: spaceUrl('library'), present: ['Discovery', 'site-photo.png'] },
    { name: '04-discovery-work', url: spaceUrl('work'), present: ['Discovery', 'Work'] },
    { name: '05-discovery-notes', url: spaceUrl('notes'), present: ['Discovery', 'Notes'] },
    { name: '06-discovery-chat', url: spaceUrl('chat'), present: ['Discovery', 'discovery-general'] },
    { name: '07-discovery-people', url: spaceUrl('people'), present: ['Discovery', 'People'] },
];

async function main() {
    mkdirSync(here, { recursive: true });
    const onlyNames = only ? only.split(',').map((n) => n.trim()).filter(Boolean) : [];
    const wanted = SHOTS.filter((s) => !onlyNames.length || onlyNames.includes(s.name));
    const session = await mintGuestSession(PARTICIPANT, MJAPI);
    const browser = await chromium.launch({ channel: 'chromium' });
    const failures = [];
    try {
        for (const theme of themes) {
            const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: theme });
            await context.addInitScript((t) => { try { localStorage.setItem('mj-theme', t); } catch { /* theme falls back */ } }, theme);
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (e) => errors.push(String(e)));
            page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('[Cache]')) errors.push(`console: ${m.text()}`); });
            try {
                // The session token rides in the fragment, as the redeem's redirect sends it; Explorer reads it on load
                await page.goto(`${EXPLORER}/app/${session.applicationPath}#token=${encodeURIComponent(session.token)}`, { waitUntil: 'load' });
                await page.getByText('All spaces').first().waitFor({ state: 'visible', timeout: 90000 }).catch(() => {
                    throw new Error(`sign-in: the shell did not reach the Spaces page as ${PARTICIPANT}`);
                });
                for (const shot of wanted) {
                    try {
                        await page.goto(shot.url, { waitUntil: 'load' });
                        await assertScreen(page, shot.name, shot.present);
                        await page.waitForTimeout(600);
                        await page.screenshot({ path: join(here, `${shot.name}-${theme}.png`) });
                        console.log(`ok   ${shot.name}-${theme}.png${errors.length ? `  page errors so far: ${errors.length}` : ''}`);
                    } catch (error) {
                        await page.screenshot({ path: join(here, `${shot.name}-${theme}-FAILED.png`) }).catch(() => undefined);
                        failures.push(`${shot.name}-${theme}: ${error instanceof Error ? error.message : String(error)}`);
                        console.log(`FAIL ${shot.name}-${theme}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
                    }
                }
            } catch (error) {
                await page.screenshot({ path: join(here, `sign-in-${theme}-FAILED.png`) }).catch(() => undefined);
                failures.push(`sign-in-${theme}: ${error instanceof Error ? error.message : String(error)}`);
                console.log(`FAIL sign-in-${theme}: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                if (errors.length) console.log(`     page errors (${theme}): ${[...new Set(errors.map((e) => e.split('\n')[0].slice(0, 160)))].slice(0, 12).join(' | ')}`);
                await context.close();
            }
        }
    } finally {
        await browser.close();
    }
    if (failures.length) {
        console.error(`${failures.length} screen(s) failed:\n${failures.join('\n')}`);
        process.exit(1);
    }
}

await main();
