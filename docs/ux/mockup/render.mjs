// Renders every mockup screen to html/<name>.html, then screenshots it to ../screens/<name>.png.
//
//   node render.mjs            all screens
//   node render.mjs chat       only screens whose name contains "chat"
//
// Needs Playwright (see README.md). Set CHROMIUM_PATH to use an existing Chromium instead of
// Playwright's own download. Fonts and icons come from pinned CDN URLs, so render with network access:
// without it the screenshots silently fall back to system fonts and blank icons.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as A from './screens-a.mjs';
import * as B from './screens-b.mjs';
import * as C from './screens-c.mjs';
import * as D from './screens-d.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const htmlDir = join(here, 'html');
const shotDir = join(here, '..', 'screens');

export const SCREENS = [
  ['00-concept', D.concept],
  ['01-home', A.homeStaff],
  ['02-space-overview', A.overviewStaff],
  ['03-library', A.library],
  ['04-share-check', A.shareDialog],
  ['05-chat-room', B.chatRoom],
  ['06-people-access', B.peopleAccess],
  ['07-client-home', B.clientHome],
  ['08-committee-member', B.committeeMember],
  ['09-assistant-settings', C.assistantSettings],
  ['10-work-board', C.workBoard],
  ['11-chat-dark', C.chatDark],
  ['12-mobile-client', C.mobileClient],
  ['13-new-space', C.newSpace],
];

/** Writes one screen's HTML and returns its path and viewport (the page() helper fixes the body size). */
export function writeScreenHtml(name, build) {
  const html = build();
  const path = join(htmlDir, `${name}.html`);
  writeFileSync(path, html);
  const size = html.match(/body \{ width: (\d+)px; height: (\d+)px/);
  return { path, width: Number(size?.[1] ?? 1440), height: Number(size?.[2] ?? 900) };
}

/** Reports content that is cut off, and icons whose class names Font Awesome does not define. */
export async function findLayoutProblems(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.card, .modal, .msg, .kcard, .need, .scard, .drawer, .page, .col')) {
      if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflow !== 'visible') {
        out.push(`${el.className.slice(0, 40)} ${el.scrollHeight}>${el.clientHeight}`);
      }
    }
    const b = document.body;
    if (b.scrollHeight > b.clientHeight + 2) out.push(`BODY ${b.scrollHeight}>${b.clientHeight}`);
    const missing = [...document.querySelectorAll('i[class*="fa-"]')].filter((i) => {
      const c = getComputedStyle(i, '::before').content;
      return !c || c === 'none' || c === 'normal' || c === '""';
    }).map((i) => i.className);
    if (missing.length) out.push('MISSING ICONS: ' + [...new Set(missing)].join(' | '));
    return out;
  });
}

async function main() {
  const filter = process.argv[2];
  mkdirSync(htmlDir, { recursive: true });
  mkdirSync(shotDir, { recursive: true });
  const executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    for (const [name, build] of SCREENS) {
      if (filter && !name.includes(filter)) continue;
      const { path, width, height } = writeScreenHtml(name, build);
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      try {
        await page.goto(pathToFileURL(path).href, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const problems = await findLayoutProblems(page);
        await page.screenshot({ path: join(shotDir, `${name}.png`) });
        console.log(`${name}  ${width}x${height}${problems.length ? '\n   ' + problems.join('\n   ') : ''}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
