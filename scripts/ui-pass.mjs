// Screenshots + rendering assertions for the Collaboration UI, one run per persona.
//
//   node scripts/ui-pass.mjs <config.json>
//
// config.json:
//   {
//     "baseUrl": "http://localhost:4201",
//     "outDir": "ui-pass-out",
//     "personas": [
//       {
//         "name": "firm-owner",
//         "storageState": "auth/firm-owner.json",     // a saved sign-in (playwright `context.storageState`)
//         "space": "Acme engagement",                 // the space to open, by the name shown in the rail
//         "expect": { "closedBanner": false, "composer": true, "newConversationButton": true, "settingsLink": true }
//       }
//     ]
//   }
//
// Every key in "expect" is optional; only the ones given are asserted. Exit code is 1 when any assertion fails.
// Signing in (Auth0) is not automated here: capture one sign-in per persona with `npx playwright codegen --save-storage`.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROBES = {
    closedBanner: '.space-closed-banner',
    composer: 'mj-conversation-chat-area textarea, mj-conversation-chat-area [contenteditable="true"]',
    newConversationButton: '.btn-add-section[aria-label="New Conversation"]',
    settingsLink: '.space-nav-link:has-text("Settings & Assistant")',
};

async function isShown(page, selector) {
    return (await page.locator(selector).first().isVisible().catch(() => false));
}

async function runPersona(browser, config, persona) {
    const context = await browser.newContext({ storageState: persona.storageState, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const failures = [];
    try {
        await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
        await page.getByText(persona.space, { exact: false }).first().click();
        await page.waitForLoadState('networkidle');
        for (const [key, want] of Object.entries(persona.expect ?? {})) {
            const selector = PROBES[key];
            if (!selector) { failures.push(`unknown expectation "${key}"`); continue; }
            const got = await isShown(page, selector);
            if (got !== want) failures.push(`${key}: expected ${want}, saw ${got}`);
        }
        await page.screenshot({ path: join(config.outDir, `${persona.name}.png`), fullPage: false });
    } catch (err) {
        failures.push(`could not run: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        await context.close();
    }
    return failures;
}

async function main() {
    const config = JSON.parse(readFileSync(process.argv[2] ?? 'ui-pass.config.json', 'utf8'));
    mkdirSync(config.outDir, { recursive: true });
    const browser = await chromium.launch();
    let failed = 0;
    for (const persona of config.personas) {
        const failures = await runPersona(browser, config, persona);
        console.log(`${failures.length ? 'FAIL' : 'ok  '} ${persona.name}${failures.length ? ': ' + failures.join('; ') : ''}`);
        failed += failures.length;
    }
    await browser.close();
    process.exit(failed ? 1 : 0);
}

main();
