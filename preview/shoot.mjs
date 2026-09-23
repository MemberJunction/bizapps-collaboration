import playwright from '/Users/amith/Dropbox/develop/M5/node_modules/playwright/index.js';
const { chromium } = playwright;
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const shots = resolve(root, 'screenshots');
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
for (const id of ['engagement', 'committee', 'work', 'no-access']) {
    const box = await page.locator('#' + id).boundingBox();
    await page.locator('#' + id).screenshot({ path: resolve(shots, id + '.png') });
    if (!box || box.height < 80) throw new Error(id + ' did not render');
}
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('#engagement').screenshot({ path: resolve(shots, 'engagement-mobile.png') });
await browser.close();
console.log('shots', shots);
