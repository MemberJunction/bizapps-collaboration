import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

type Expectation = 'readOnlyLock' | 'composer' | 'newConversationButton' | 'settingsLink';
const EXPECTATIONS: readonly Expectation[] = ['readOnlyLock', 'composer', 'newConversationButton', 'settingsLink'];

interface Persona {
    name: string;
    label: string;
    space?: string;
    spaceId?: string;
    noSpaces?: boolean;
    expect?: Record<Expectation, boolean>;
}

/** Where Explorer serves the Collaboration section. Override when the host names it differently. */
const SECTION_PATH = process.env.UI_PASS_SECTION_PATH ?? '/app/Collaboration/Spaces';

const personas = (JSON.parse(readFileSync(resolve(here, 'personas.json'), 'utf8')) as { personas: Persona[] }).personas;

// A matrix that can pass by asserting nothing is not a check
if (personas.length === 0) throw new Error('personas.json lists no personas.');
for (const persona of personas) {
    if (!persona.label) throw new Error(`${persona.name}: every row needs a label, or its tests are skipped.`);
    if (persona.noSpaces) continue;
    if (!persona.spaceId || !persona.space) throw new Error(`${persona.label}: a space and its id are required.`);
    for (const key of EXPECTATIONS) {
        if (typeof persona.expect?.[key] !== 'boolean') throw new Error(`${persona.label}: expectation "${key}" is missing.`);
    }
}

function probe(page: Page, key: Expectation): Locator {
    switch (key) {
        // A conversation that can't be posted in shows a lock in the chat's header (a closed space, or no seat that lets them post), not a banner
        case 'readOnlyLock': return page.locator('mjc-space-chat .read-only-lock').first();
        case 'composer': return page.locator('mj-conversation-chat-area').locator('textarea, [contenteditable="true"]').first();
        // Both the expanded and the collapsed rail: found by their icon and label, never by visible text
        case 'newConversationButton': return page.locator('mjc-space-rail').locator('button[aria-label="New Conversation"]').first();
        case 'settingsLink': return page.locator('mjc-space-rail').locator('.space-nav-link:has(i.fa-sliders)').first();
    }
}

/** Opens a space on a tab by URL, and waits until the header shows its name. */
async function openSpace(page: Page, persona: Persona, tab: string): Promise<void> {
    await page.goto(`${SECTION_PATH}?view=space&space=${persona.spaceId}&tab=${tab}`);
    await expect(page.locator('mjc-space-header').getByText(persona.space!, { exact: true }).first()).toBeVisible();
}

/**
 * The chat area draws its composer only for an open conversation, so a row that probes it needs one to open (a closed space's
 * lock shows over the list too). A closed space's conversation is archived and read-only, so its composer probe looks at a chat that is there.
 * The world seeds a General conversation in each such space; when the rail lists none, the row fails with that said.
 */
async function openFirstConversation(page: Page, persona: Persona): Promise<void> {
    const first = page.locator('mjc-space-rail .convo-link').first();
    await expect(first, `${persona.label}: the rail lists no conversation, so the composer and the lock can't be probed`).toBeVisible();
    await first.click();
    // The chat area itself, not its wrapper: the wrapper is always there, so waiting for it proves the click did nothing
    await expect(page.locator('mjc-space-chat mj-conversation-chat-area')).toBeVisible();
}

async function shoot(page: Page, persona: Persona, step: string): Promise<void> {
    await page.screenshot({ path: resolve(here, `../ui-pass-out/${persona.label}-${step}.png`) });
}

for (const persona of personas) {
    test.describe(persona.label, () => {
        test.beforeEach(({ browserName }, testInfo) => {
            test.skip(testInfo.project.name !== persona.label, `each persona runs in its own project (${browserName})`);
        });

        if (persona.noSpaces) {
            test(`${persona.label} sees no spaces`, async ({ page }) => {
                await page.goto(SECTION_PATH);
                await expect(page.getByText('Access Restricted')).toBeVisible();
                await expect(page.locator('mjc-space-rail')).toBeHidden();
                await shoot(page, persona, 'no-access');
            });
            return;
        }

        test(`${persona.label} sees what its seat allows`, async ({ page }) => {
            // The rail is on every tab; the chat area is on the Chat tab
            await openSpace(page, persona, 'chat');
            await openFirstConversation(page, persona);
            for (const key of EXPECTATIONS) {
                if (persona.expect![key]) await expect(probe(page, key), key).toBeVisible();
                else await expect(probe(page, key), key).toBeHidden();
            }
            await shoot(page, persona, 'chat');
        });

        test(`${persona.label}: the tabs open`, async ({ page }) => {
            for (const tab of ['overview', 'library', 'work', 'people']) {
                await openSpace(page, persona, tab);
                await shoot(page, persona, tab);
            }
        });

        test(`${persona.label}: Settings`, async ({ page }) => {
            test.skip(!persona.expect!.settingsLink, 'this seat has no Settings');
            await openSpace(page, persona, 'settings');
            await shoot(page, persona, 'settings');
        });
    });
}
