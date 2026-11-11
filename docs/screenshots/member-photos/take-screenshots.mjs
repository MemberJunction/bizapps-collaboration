/**
 * The member-photos browser pass: a person's photo (MJ: Users.UserImageURL) shows wherever Collaboration draws that person,
 * and a person without one keeps their initials. Light and dark, each screen asserted before its capture.
 *
 *   node --env-file=.env.base docs/screenshots/member-photos/take-screenshots.mjs [--who participant|staff|all] [--theme light|dark|both] [--only <name>,<name>]
 *   node --env-file=.env.base docs/screenshots/member-photos/take-screenshots.mjs --save-staff-session   # a window opens; sign in; the session is saved
 *
 * Env: EXPLORER_URL (default http://localhost:4218; it must say localhost, the MSAL redirect is registered for it), MJAPI_URL +
 * MJ_API_KEY (the harness user, for the seed), SCREENSHOT_STAFF_EMAIL (the signed-in staff person, who has a seat on Northwind),
 * STAFF_SIGNIN_MINUTES, SHOT_DEBUG=1 (print what each avatar drew and each screen's console errors).
 *
 * Two sources feed a member's photo. Their own user's (UserImageURL) comes first, since MJ's chat draws that one; the photo on
 * their People record (PhotoURL) fills in. The participant is Bea, signed in by magic link (no saved session needed). A Space
 * Participant reads only their own row of MJ: Users, and the People records of everyone they share a space with, so Bea's
 * screens prove her own photo from her user and the others' from People. Her chat is not among them: on MJ next
 * (6.2.0-edge.8) the chat area's message load is refused for a row-filtered user, so no message is drawn for her at all (MJ's,
 * noted in the README). The staff screens prove the user's photo winning, the People photo filling in, and the thread and the
 * people menu; they use the session PR 10's
 * runner saves (docs/screenshots/pr10/staff-session.json, git-ignored) and are skipped, and said to be skipped, when it is missing.
 * Playwright is installed beside PR 10's runner, which this reuses.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { chromium } from '../pr10/node_modules/playwright/index.mjs';
import { mintGuestSession } from '../../../packages/IntegrationTests/dist/screenshots/magic-link-session.js';

const here = dirname(fileURLToPath(import.meta.url));
const EXPLORER = (process.env.EXPLORER_URL ?? 'http://localhost:4218').replace(/\/$/, '');
const MJAPI = (process.env.MJAPI_URL ?? 'http://localhost:4119').replace(/\/$/, '');
const STAFF_SESSION = join(here, '..', 'pr10', 'staff-session.json');
const STAFF_EMAIL = (process.env.SCREENSHOT_STAFF_EMAIL ?? '').toLowerCase();
const PARTICIPANT = 'bea.member@collab-world.example';

/** The sample world's spaces (packages/IntegrationTests/src/world/ids.ts). Discovery sits under Northwind and inherits its seats. */
const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';
const spaceUrl = (space, tab, extra = '') => `${EXPLORER}/app/collaboration/Spaces?view=space&tab=${tab}&space=${space}${extra}`;

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const themes = { light: ['light'], dark: ['dark'], both: ['light', 'dark'] }[option('--theme', 'both')];
const who = option('--who', 'all');
const only = option('--only', null);

/** A small head-and-shoulders picture on one flat color, as a PNG data URI: a photo the screens can tell from another by its bytes. */
function samplePhoto([red, green, blue]) {
    const size = 96;
    const raw = Buffer.alloc(size * (1 + size * 3));
    for (let y = 0; y < size; y++) {
        const row = y * (1 + size * 3);
        for (let x = 0; x < size; x++) {
            const figure = (x - 48) ** 2 + (y - 36) ** 2 < 18 ** 2 || ((x - 48) / 34) ** 2 + ((y - 96) / 36) ** 2 < 1;
            raw.set(figure ? [246, 240, 230] : [red, green, blue], row + 1 + x * 3);
        }
    }
    const chunk = (type, data) => {
        const body = Buffer.concat([Buffer.from(type), data]);
        const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
        const check = Buffer.alloc(4); check.writeUInt32BE(crc32(body) >>> 0);
        return Buffer.concat([length, body, check]);
    };
    const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Who gets which photo, so each screen can tell by the bytes which source it drew:
 *   Ada    a photo on her user AND a different one on her People record: staff see the user's, a participant the People one
 *   Casey  a photo on her People record only: everyone sees that one (the fallback, for staff too)
 *   Bea    a photo on her user only: she sees her own, and staff see it
 *   Sam    none anywhere: initials for everyone
 */
const USER_PHOTOS = {
    'ada.owner@collab-world.example': samplePhoto([0, 118, 182]),
    'casey.admin@collab-world.example': null,
    [PARTICIPANT]: samplePhoto([46, 125, 50]),
};
const PERSON_PHOTOS = {
    'ada.owner@collab-world.example': samplePhoto([94, 53, 177]),
    'casey.admin@collab-world.example': samplePhoto([178, 74, 42]),
};
const ADA = { name: 'Ada Owner', userPhoto: USER_PHOTOS['ada.owner@collab-world.example'], personPhoto: PERSON_PHOTOS['ada.owner@collab-world.example'] };
const CASEY = { name: 'Casey Admin', personPhoto: PERSON_PHOTOS['casey.admin@collab-world.example'] };
const BEA = { name: 'Bea Member', userPhoto: USER_PHOTOS[PARTICIPANT] };
const SAMPLE = {
    adaReply: 'Thanks, Bea. I will bring the photos to the walkthrough (sample)',
    staffReply: 'Noted, thanks both (sample)',
};

/**
 * Made once, by value, over GraphQL: the photos on the users and on their People records as the harness user, and one thread
 * reply from Ada under Bea's message in discovery-general as Ada herself, so the thread has a person with a photo in it.
 * Returns the ids the screens open.
 */
async function seed() {
    process.env.MJ_INTEGRATION_TEST = '1';
    const { bootstrapIntegrationClient } = await import('@memberjunction/testing-integration/client');
    const { Metadata, RunView } = await import('@memberjunction/core');
    await bootstrapIntegrationClient();
    const harness = await import('../../../packages/IntegrationTests/dist/client-index.js');
    const provider = Metadata.Provider;
    const user = provider.CurrentUser;
    if (!user) throw new Error('The GraphQL provider has no CurrentUser: check MJAPI_URL and MJ_API_KEY.');
    const ctx = { User: user, Provider: provider, Schema: process.env.MJ_CORE_SCHEMA || '__mj', Storage: undefined };
    const rows = async (entityName, filter, fields, orderBy) => {
        const r = await new RunView().RunView({ EntityName: entityName, ExtraFilter: filter, Fields: fields, OrderBy: orderBy, ResultType: 'simple' }, user);
        if (!r.Success) throw new Error(`${entityName}: ${r.ErrorMessage}`);
        return r.Results;
    };
    const requireSave = async (entity, what) => { if (!(await entity.Save())) throw new Error(`${what} was not saved: ${entity.LatestResult?.CompleteMessage ?? entity.LatestResult?.Message ?? 'no message'}`); };

    const userIds = {};
    for (const [email, photo] of Object.entries(USER_PHOTOS)) {
        const [found] = await rows('MJ: Users', `Email = '${email}'`, ['ID', 'UserImageURL']);
        if (!found) throw new Error(`${email} is not a user: load the sample world first.`);
        userIds[email] = found.ID;
        if ((found.UserImageURL ?? null) === photo) continue;
        const entity = await provider.GetEntityObject('MJ: Users', user);
        if (!(await entity.Load(found.ID))) throw new Error(`${email} could not be loaded.`);
        entity.UserImageURL = photo;
        await requireSave(entity, `${email}'s user photo`);
    }
    for (const [email, photo] of Object.entries(PERSON_PHOTOS)) {
        const [person] = await rows('MJ_BizApps_Common: People', `LinkedUserID = '${userIds[email]}'`, ['ID', 'PhotoURL']);
        if (!person) throw new Error(`${email} has no People record linked to their user: load the sample world first.`);
        if (person.PhotoURL === photo) continue;
        const entity = await provider.GetEntityObject('MJ_BizApps_Common: People', user);
        if (!(await entity.Load(person.ID))) throw new Error(`${email}'s People record could not be loaded.`);
        entity.PhotoURL = photo;
        await requireSave(entity, `${email}'s People photo`);
    }

    const [chat] = await rows('MJ_BizApps_Collaboration: Space Chats', `SpaceID = '${DISCOVERY}' AND Name = 'discovery-general'`, ['ID', 'ConversationID']);
    if (!chat) throw new Error('Discovery has no discovery-general conversation: load the sample world first.');
    const details = await rows('MJ: Conversation Details', `ConversationID = '${chat.ConversationID}'`, ['ID', 'ParentID', 'Message', 'User', 'UserID'], '__mj_CreatedAt ASC');
    const root = details.find((d) => !d.ParentID && d.User === 'Bea Member');
    if (!root) throw new Error("discovery-general has no message from Bea to reply under.");
    if (!details.some((d) => d.Message === SAMPLE.adaReply)) {
        try {
            const ada = await harness.getPersonaClientContext(ctx, 'ada');
            const reply = await ada.GraphQLProvider.GetEntityObject('MJ: Conversation Details', ada.GraphQLProvider.CurrentUser);
            reply.NewRecord();
            reply.ConversationID = chat.ConversationID;
            reply.ParentID = root.ID;
            reply.Message = SAMPLE.adaReply;
            reply.Role = 'User';
            reply.UserID = ada.GraphQLProvider.CurrentUser.ID;
            await requireSave(reply, "Ada's thread reply");
        } finally {
            await harness.cleanupPersonaProviders(ctx);
        }
    }
    return { conversation: chat.ConversationID, root: root.ID };
}

/** Fails the screen when the page doesn't show every text in `present`, or shows any in `absent`. */
async function assertScreen(page, name, { present = [], absent = [], timeout = 30000 }) {
    for (const text of present) {
        // the first match may be an element the shell keeps hidden (a tab's title, a tooltip): wait for a visible one
        await page.getByText(text, { exact: false }).locator('visible=true').first().waitFor({ state: 'visible', timeout }).catch(() => {
            throw new Error(`${name}: "${text}" is not on the screen`);
        });
    }
    const body = await page.locator('body').innerText();
    for (const text of [...absent, 'Taking longer than expected', 'Access Restricted', 'could not be read']) if (body.includes(text)) throw new Error(`${name}: "${text}" must not be on the screen`);
}

/**
 * What each avatar under `rowSelector` drew: the person's name (from `nameSelector` in the row, or the avatar's own title),
 * the photo's address and whether the browser decoded it, or the initials.
 */
async function avatarsIn(page, rowSelector, nameSelector = null) {
    const list = await page.locator(rowSelector).evaluateAll((rows, nameSel) => rows.map((row) => {
        const avatar = row.matches('mjc-avatar') ? row.querySelector('.av') : row.querySelector('mjc-avatar .av');
        const img = avatar?.querySelector('img.av-img') ?? null;
        const name = nameSel ? row.querySelector(nameSel)?.textContent : avatar?.getAttribute('title');
        return {
            name: (name ?? '').trim(),
            photo: img ? img.getAttribute('src') : null,
            decoded: img ? img.complete && img.naturalWidth > 0 : false,
            initials: img ? '' : (avatar?.textContent ?? '').trim(),
        };
    }), nameSelector);
    console.log(`     ${rowSelector}: ${list.map((a) => `${a.name || '?'}=${a.photo ? `photo(${a.photo.length}b${a.decoded ? '' : ', NOT decoded'})` : `"${a.initials}"`}`).join(', ') || '(none)'}`);
    return list;
}

/** The person is on the list and drawn as their photo: the very bytes saved on their user when `photo` is given, and decoded. */
function expectPhoto(list, screen, person, photo = null) {
    const found = list.filter((a) => a.name.startsWith(person));
    if (!found.length) throw new Error(`${screen}: ${person} is not among ${list.map((a) => a.name).join(', ') || 'no avatars'}`);
    for (const avatar of found) {
        if (!avatar.photo) throw new Error(`${screen}: ${person} is drawn as "${avatar.initials}", not as their photo`);
        if (photo && avatar.photo !== photo) throw new Error(`${screen}: ${person}'s avatar shows a different picture than the one on their user`);
        if (!avatar.decoded) throw new Error(`${screen}: ${person}'s photo did not load`);
    }
}

/** The person is on the list and, having no photo, drawn as these initials. */
function expectInitials(list, screen, person, initials) {
    const found = list.filter((a) => a.name.startsWith(person));
    if (!found.length) throw new Error(`${screen}: ${person} is not among ${list.map((a) => a.name).join(', ') || 'no avatars'}`);
    for (const avatar of found) if (avatar.photo || avatar.initials !== initials) throw new Error(`${screen}: ${person} should be drawn as "${initials}", saw ${avatar.photo ? 'a photo' : `"${avatar.initials}"`}`);
}

async function captureNow(page, name) {
    await page.waitForTimeout(400);
    const theme = await page.evaluate(() => localStorage.getItem('mj-theme'));
    await page.screenshot({ path: join(here, `${name}-${theme}.png`) });
    page.__captured = true;
}

/** Opens the thread under Bea's message and returns the drawer. The thread bar is a toggle, so an open one is left open. */
async function openThread(page, screen) {
    const bar = page.locator('[data-testid="message-thread-replies"]').first();
    await bar.waitFor({ state: 'visible', timeout: 60000 }).catch(() => { throw new Error(`${screen}: the message has no thread bar`); });
    const drawer = page.locator('[data-testid="message-thread-drawer"]').first();
    if (!(await drawer.isVisible())) await bar.click();
    await drawer.waitFor({ state: 'visible', timeout: 20000 }).catch(() => { throw new Error(`${screen}: the thread did not open`); });
    return drawer;
}

const SHOTS = (ids) => [
    {
        name: '01-people-participant', who: 'participant', proves: "People list as a participant: her own photo from her user, Ada's and Casey's from their People records, Sam as initials, her own email still read",
        run: async (page) => {
            await page.goto(spaceUrl(DISCOVERY, 'people'));
            await assertScreen(page, '01', { present: ['Discovery', BEA.name, PARTICIPANT, ADA.name, 'Sam Member'] });
            const people = await avatarsIn(page, '.member-row', '.person-name');
            expectPhoto(people, '01', BEA.name, BEA.userPhoto);
            expectPhoto(people, '01', ADA.name, ADA.personPhoto);
            expectPhoto(people, '01', CASEY.name, CASEY.personPhoto);
            expectInitials(people, '01', 'Sam Member', 'SM');
        },
    },
    {
        name: '02-overview-participant', who: 'participant', proves: "Overview as a participant: the Discussion card and the header stacks draw her photo and the others' People photos",
        run: async (page) => {
            await page.goto(spaceUrl(DISCOVERY, 'overview'));
            await assertScreen(page, '02', { present: ['Discovery', 'Discussion'] });
            const senders = await avatarsIn(page, '.room-card .mm:has(mjc-avatar)', 'b');
            expectPhoto(senders, '02 Discussion card', BEA.name, BEA.userPhoto);
            expectPhoto(senders, '02 Discussion card', ADA.name, ADA.personPhoto);
            const header = await avatarsIn(page, 'mjc-space-header mjc-avatar-stack mjc-avatar');
            expectPhoto(header, '02 header', BEA.name, BEA.userPhoto);
            expectPhoto(header, '02 header', ADA.name, ADA.personPhoto);
            expectPhoto(header, '02 header', CASEY.name, CASEY.personPhoto);
            expectInitials(header, '02 header', 'Sam Member', 'SM');
        },
    },
    {
        name: '11-people-staff', who: 'staff', proves: "People list as staff: Ada's user photo (not her People one), Casey's People photo, the signed-in person's own, initials for Sam",
        run: async (page) => {
            await page.goto(spaceUrl(NORTHWIND, 'people'));
            await assertScreen(page, '11', { present: ['Northwind relationship', ADA.name, 'Sam Member', CASEY.name] });
            const people = await avatarsIn(page, '.member-row', '.person-name');
            expectPhoto(people, '11', ADA.name, ADA.userPhoto);
            expectPhoto(people, '11', CASEY.name, CASEY.personPhoto);
            expectInitials(people, '11', 'Sam Member', 'SM');
            if (STAFF_EMAIL) {
                const own = await avatarsIn(page, `.member-row:has-text("${STAFF_EMAIL}")`, '.person-name');
                if (!own.length || !own[0].photo || !own[0].decoded) throw new Error(`11: ${STAFF_EMAIL}'s own photo is not drawn on their People row`);
            }
        },
    },
    {
        name: '12-overview-staff', who: 'staff', proves: 'Overview as staff: the Discussion card and both header stacks draw the photos',
        run: async (page) => {
            await page.goto(spaceUrl(NORTHWIND, 'overview'));
            await assertScreen(page, '12', { present: ['Northwind relationship', 'Discussion'] });
            const senders = await avatarsIn(page, '.room-card .mm:has(mjc-avatar)', 'b');
            expectPhoto(senders, '12 Discussion card', ADA.name, ADA.userPhoto);
            expectInitials(senders, '12 Discussion card', 'Sam Member', 'SM');
            const header = await avatarsIn(page, 'mjc-space-header mjc-avatar-stack mjc-avatar');
            expectPhoto(header, '12 header', ADA.name, ADA.userPhoto);
            expectPhoto(header, '12 header', CASEY.name, CASEY.personPhoto);
            expectInitials(header, '12 header', 'Sam Member', 'SM');
        },
    },
    {
        name: '13-thread-reply-staff', who: 'staff', proves: "Chat as staff: the thread bar and the thread draw Ada's photo, and a reply the signed-in person posts is kept and drawn as their own photo (acts: posts once, reloads)",
        run: async (page) => {
            await page.goto(spaceUrl(DISCOVERY, 'chat', `&conv=${ids.conversation}`));
            await assertScreen(page, '13', { present: ['Discovery', 'discovery-general'], timeout: 60000 });
            let drawer = await openThread(page, '13');
            await drawer.getByText(SAMPLE.adaReply).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => { throw new Error("13: Ada's seeded reply is not in the thread"); });
            if (!(await drawer.getByText(SAMPLE.staffReply).count())) {
                const input = drawer.locator('[data-testid="thread-reply-input"]').first();
                await input.waitFor({ state: 'visible', timeout: 20000 });
                await input.fill(SAMPLE.staffReply);
                await drawer.locator('[data-testid="thread-reply-send"]:not([disabled])').first().click();
                await drawer.getByText(SAMPLE.staffReply).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => { throw new Error('13: the reply did not appear after sending'); });
                await page.waitForTimeout(1500);
            }
            await page.reload();
            await assertScreen(page, '13', { present: ['Discovery', 'discovery-general'], timeout: 60000 });
            drawer = await openThread(page, '13');
            await drawer.getByText(SAMPLE.staffReply).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => { throw new Error('13: the reply was not kept after a reload'); });
            expectPhoto(await avatarsIn(page, '.thread-avatar-stack mjc-avatar'), '13 thread bar', ADA.name, ADA.userPhoto);
            expectPhoto(await avatarsIn(page, '[data-testid="message-thread-drawer"] .thread-reply-item:has(mjc-avatar)'), '13 thread', ADA.name, ADA.userPhoto);
            const own = await avatarsIn(page, `[data-testid="message-thread-drawer"] .thread-reply-item:has-text("${SAMPLE.staffReply}")`);
            if (!own.length || !own[0].photo || !own[0].decoded) throw new Error("13: the signed-in person's own reply is not drawn as their photo");
        },
    },
    {
        name: '14-chat-people-menu-staff', who: 'staff', proves: 'Chat as staff: the people menu draws the photos (acts: opens the menu)',
        run: async (page) => {
            await page.goto(spaceUrl(DISCOVERY, 'chat', `&conv=${ids.conversation}`));
            await assertScreen(page, '14', { present: ['Discovery', 'discovery-general'], timeout: 60000 });
            await page.locator('[data-testid="message-thread-replies"]').first().waitFor({ state: 'visible', timeout: 60000 });
            await page.locator('[data-testid="chat-participants-pill"]').first().click();
            await page.locator('[data-testid="chat-participants-people-heading"]').first().waitFor({ state: 'visible', timeout: 20000 });
            const menu = await avatarsIn(page, '.chat-participant-row:has(mjc-avatar)');
            expectPhoto(menu, '14 people menu', ADA.name, ADA.userPhoto);
            expectPhoto(menu, '14 people menu', BEA.name, BEA.userPhoto);
            expectPhoto(menu, '14 people menu', CASEY.name, CASEY.personPhoto);
            expectInitials(menu, '14 people menu', 'Sam Member', 'SM');
            await captureNow(page, '14-chat-people-menu-staff');
            await page.keyboard.press('Escape');
        },
    },
];

async function saveStaffSession() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    await page.goto(`${EXPLORER}/`);
    console.log('Sign in as staff in the browser window. The session is saved when the app shows.');
    await page.waitForURL(/\/app\//, { timeout: Number(process.env.STAFF_SIGNIN_MINUTES || 10) * 60 * 1000 });
    await page.waitForTimeout(3000);
    await context.storageState({ path: STAFF_SESSION });
    console.log(`Saved ${STAFF_SESSION}. Keep it out of git.`);
    await browser.close();
}

async function main() {
    if (args.includes('--save-staff-session')) return saveStaffSession();
    mkdirSync(here, { recursive: true });
    const ids = await seed();
    const onlyNames = only ? only.split(',').map((n) => n.trim()).filter(Boolean) : [];
    const wanted = SHOTS(ids).filter((s) => (who === 'all' || s.who === who) && (!onlyNames.length || onlyNames.includes(s.name)));
    const sessions = [...new Set(wanted.map((s) => s.who))];
    const skipped = [];
    if (sessions.includes('staff') && !existsSync(STAFF_SESSION)) {
        skipped.push(...wanted.filter((s) => s.who === 'staff').map((s) => s.name));
        console.log(`No ${STAFF_SESSION}: the staff screens are SKIPPED (${skipped.join(', ')}). Run --save-staff-session first.`);
    }
    const guest = sessions.includes('participant') ? await mintGuestSession(PARTICIPANT, MJAPI) : null;
    const browser = await chromium.launch({ channel: 'chromium' });
    const failures = [];
    for (const theme of themes) {
        for (const session of sessions) {
            const shots = wanted.filter((s) => s.who === session && !skipped.includes(s.name));
            if (!shots.length) continue;
            // One sign-in per person and theme; that person's screens then run in order on its page
            const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: theme, ...(session === 'staff' ? { storageState: STAFF_SESSION } : {}) });
            await context.addInitScript((t) => { try { localStorage.setItem('mj-theme', t); } catch { /* theme falls back */ } }, theme);
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (e) => errors.push(String(e)));
            page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('[Cache]')) errors.push(`console: ${message.text()}`); });
            try {
                // A participant's session token rides in the fragment, as the redeem's redirect sends it; staff carry theirs in storage
                await page.goto(session === 'staff' ? `${EXPLORER}/app/collaboration` : `${EXPLORER}/app/${guest.applicationPath}#token=${encodeURIComponent(guest.token)}`, { waitUntil: 'load' });
                await page.getByText('All spaces').first().waitFor({ state: 'visible', timeout: 90000 }).catch(() => {
                    throw new Error(`sign-in: the shell did not reach the Spaces page as ${session}${session === 'staff' ? ' (an expired session: run --save-staff-session again)' : ''}`);
                });
            } catch (error) {
                await page.screenshot({ path: join(here, `sign-in-${session}-${theme}-FAILED.png`) }).catch(() => undefined);
                failures.push(...shots.map((s) => `${s.name}-${theme}: ${error instanceof Error ? error.message : String(error)}`));
                console.log(`FAIL sign-in as ${session} (${theme}): ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
                await context.close();
                continue;
            }
            for (const shot of shots) {
                const before = errors.length;
                page.__captured = false;
                try {
                    await shot.run(page);
                    await page.waitForTimeout(600);
                    if (!page.__captured) await page.screenshot({ path: join(here, `${shot.name}-${theme}.png`) });
                    console.log(`ok   ${shot.name}-${theme}.png${errors.length > before ? `  page errors: ${errors.length - before}` : ''}`);
                    if (process.env.SHOT_DEBUG && errors.length > before) console.log(`     ${[...new Set(errors.slice(before).map((e) => e.split('\n')[0].slice(0, 400)))].slice(0, 12).join('\n     ')}`);
                } catch (error) {
                    await page.screenshot({ path: join(here, `${shot.name}-${theme}-FAILED.png`) }).catch(() => undefined);
                    failures.push(`${shot.name}-${theme}: ${error instanceof Error ? error.message : String(error)}`);
                    if (errors.length > before) console.log(`     page errors (${errors.length - before}):\n       ${[...new Set(errors.slice(before).map((e) => e.split('\n')[0].slice(0, 300)))].slice(0, 10).join('\n       ')}`);
                    console.log(`     at ${page.url()}`);
                    console.log(`FAIL ${shot.name}-${theme}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
                }
            }
            await context.close();
        }
    }
    await browser.close();
    if (skipped.length) console.log(`\nSkipped, not tested: ${skipped.join(', ')}`);
    if (failures.length) {
        console.log(`\n${failures.length} screenshot(s) failed their assertions:\n${failures.map((f) => `  ${f}`).join('\n')}`);
        process.exit(1);
    }
    process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
