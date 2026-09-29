import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

type Expectation = 'closedBanner' | 'composer' | 'newConversationButton' | 'settingsLink';
const EXPECTATIONS: readonly Expectation[] = ['closedBanner', 'composer', 'newConversationButton', 'settingsLink'];

interface Persona {
    name: string;
    label?: string;
    space: string;
    expect: Record<Expectation, boolean>;
}

const personas = (JSON.parse(readFileSync(resolve(here, 'personas.json'), 'utf8')) as { personas: Persona[] }).personas;

// A matrix that can pass by asserting nothing is not a check
if (personas.length === 0) throw new Error('personas.json lists no personas.');
for (const persona of personas) {
    for (const key of EXPECTATIONS) {
        if (typeof persona.expect?.[key] !== 'boolean') throw new Error(`${persona.label ?? persona.name}: expectation "${key}" is missing.`);
    }
}

/** The space name, or the environment variable it names ($NAME). Null when that variable is unset. */
function spaceNameOf(persona: Persona): string | null {
    return persona.space.startsWith('$') ? process.env[persona.space.slice(1)] ?? null : persona.space;
}

function probe(page: Page, key: Expectation): Locator {
    switch (key) {
        case 'closedBanner': return page.locator('.space-closed-banner');
        case 'composer': return page.locator('mj-conversation-chat-area').locator('textarea, [contenteditable="true"]').first();
        case 'newConversationButton': return page.locator('mjc-space-rail').locator('.btn-add-section[aria-label="New Conversation"]');
        case 'settingsLink': return page.locator('mjc-space-rail').locator('.space-nav-link', { hasText: 'Settings & Assistant' });
    }
}

async function openSpace(page: Page, name: string): Promise<void> {
    await page.goto('/');
    // The rail lists the spaces; match the whole name, inside the rail
    await page.locator('mjc-space-rail').getByText(name, { exact: true }).first().click();
    // The page has rendered the space when its name is in the header
    await expect(page.locator('h1, h2, .space-title, .space-header').getByText(name, { exact: true }).first()).toBeVisible();
}

async function shoot(page: Page, persona: Persona, step: string): Promise<void> {
    await page.screenshot({ path: resolve(here, `../ui-pass-out/${persona.label ?? persona.name}-${step}.png`) });
}

for (const persona of personas) {
    const title = persona.label ?? persona.name;
    test.describe(title, () => {
        test.beforeEach(({ browserName }, testInfo) => {
            test.skip(testInfo.project.name !== title, `each persona runs in its own project (${browserName})`);
        });

        test(`${title} sees what its seat allows`, async ({ page }) => {
            const space = spaceNameOf(persona);
            test.skip(space === null, `${persona.space} is not set`);
            await openSpace(page, space!);
            await shoot(page, persona, 'space');
            for (const key of EXPECTATIONS) {
                if (persona.expect[key]) await expect(probe(page, key), key).toBeVisible();
                else await expect(probe(page, key), key).toBeHidden();
            }
        });

        // Named steps for the screenshots the review asks for; each opens one thing and captures it
        test(`${title}: Settings & Assistant`, async ({ page }) => {
            const space = spaceNameOf(persona);
            test.skip(space === null || !persona.expect.settingsLink, 'this seat has no Settings & Assistant');
            await openSpace(page, space!);
            await probe(page, 'settingsLink').click();
            await shoot(page, persona, 'settings');
        });
    });
}
