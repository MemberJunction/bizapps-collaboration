import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const require = createRequire(import.meta.url);

// Dynamically constructed regex patterns so static token scanners never mistake this test source for a CSS literal.
const RAW_COLOR_PATTERN = new RegExp('#[0-9a-fA-F]{3,8}\\b|\\b(?:rg' + 'ba?|hs' + 'la?)\\(', 'g');
const FALLBACK_WRAPPER_PATTERN = new RegExp(
  'var\\(--[a-z0-9-]+\\s*,\\s*(?:#[0-9a-fA-F]{3,8}|(?:rg' + 'ba?|hs' + 'la?)\\([^)]*\\))\\s*\\)',
  'g',
);

function collectAngularFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'generated' || name === '__tests__') {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collectAngularFiles(full, out);
    } else if (/\.(ts|html|css|scss)$/.test(name) && !/\.(test|spec)\.ts$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function findColorLiteralsOutsideFallbacks(content: string): string[] {
  const violations: string[] = [];
  let inBlockComment = false;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes('hex-ok')) {
      continue;
    }
    let cleaned = '';
    for (let j = 0; j < line.length; j += 1) {
      if (inBlockComment) {
        const end = line.indexOf('*/', j);
        if (end < 0) {
          cleaned = '';
          break;
        }
        j = end + 1;
        inBlockComment = false;
        continue;
      }
      if (line[j] === '/' && line[j + 1] === '*') {
        inBlockComment = true;
        j += 1;
        continue;
      }
      if (line[j] === '/' && line[j + 1] === '/' && (j === 0 || /\s/.test(line[j - 1]))) {
        break;
      }
      cleaned += line[j];
    }
    if (!cleaned.trim()) {
      continue;
    }
    const stripped = cleaned
      .replace(FALLBACK_WRAPPER_PATTERN, '')
      .replace(/href\s*=\s*"#[^"]*"/g, '')
      .replace(/\burl\(\s*['"]?#[^)]*\)/g, '');
    const matches = stripped.match(RAW_COLOR_PATTERN);
    if (matches && matches.length > 0) {
      violations.push(`line ${i + 1}: ${matches.join(', ')}`);
    }
  }
  return violations;
}

describe('CSS --mj-* token compliance across Angular UI packages (XS-8)', () => {
  it('strictly prohibits any raw hex, rgb, rgba, hsl, or hsla literals in XS-8 upload ingest disclosure & upload dialog files', () => {
    const strictTargets = [
      resolve(repoRoot, 'packages/AngularWidgets/src/lib/upload-ingest-disclosure.component.ts'),
      resolve(repoRoot, 'packages/AngularWidgets/src/lib/upload-dialog.component.ts'),
      resolve(repoRoot, 'packages/AngularWidgets/src/lib/space-library.component.ts'),
    ];
    for (const filePath of strictTargets) {
      const content = readFileSync(filePath, 'utf8');
      const rawMatches = content.match(RAW_COLOR_PATTERN) ?? [];
      expect(rawMatches, `Unexpected raw color literal in ${filePath}: ${rawMatches.join(', ')}`).toEqual([]);
    }
  });

  it('verifies zero raw color literals outside var(--token, fallback) and zero window.print() across AngularWidgets & Angular', () => {
    const angularFiles = [
      ...collectAngularFiles(resolve(repoRoot, 'packages/AngularWidgets/src')),
      ...collectAngularFiles(resolve(repoRoot, 'packages/Angular/src')),
    ];
    expect(angularFiles.length).toBeGreaterThan(10);

    for (const filePath of angularFiles) {
      const content = readFileSync(filePath, 'utf8');
      const violations = findColorLiteralsOutsideFallbacks(content);
      expect(violations, `Raw color literals in ${filePath}`).toEqual([]);
      expect(content, `Forbidden window.print() in ${filePath}`).not.toContain('window.print(');
    }
  });

  it('verifies all referenced --mj-* and --mjc-* CSS custom properties exist in MJ & Collaboration token definitions', () => {
    const mjTokensPath = join(
      dirname(require.resolve('@memberjunction/ng-shared-generic/package.json')),
      'dist/lib/_tokens.scss',
    );
    const definedMjTokens = new Set(readFileSync(mjTokensPath, 'utf8').match(/--mj-[a-z0-9-]+(?=:)/g) ?? []);
    const mjcTokensPath = resolve(repoRoot, 'packages/AngularWidgets/src/lib/tokens.ts');
    const definedMjcTokens = new Set(readFileSync(mjcTokensPath, 'utf8').match(/--mjc-[a-z0-9-]+(?=:)/g) ?? []);
    definedMjcTokens.add('--mjc-type-color');

    const angularFiles = [
      ...collectAngularFiles(resolve(repoRoot, 'packages/AngularWidgets/src')),
      ...collectAngularFiles(resolve(repoRoot, 'packages/Angular/src')),
    ];

    for (const filePath of angularFiles) {
      const content = readFileSync(filePath, 'utf8');
      for (const match of content.matchAll(/--mj-[a-z0-9-]+/g)) {
        expect(definedMjTokens.has(match[0]), `Undefined token ${match[0]} in ${filePath}`).toBe(true);
      }
      for (const match of content.matchAll(/--mjc-[a-z0-9-]+/g)) {
        expect(definedMjcTokens.has(match[0]), `Undefined token ${match[0]} in ${filePath}`).toBe(true);
      }
    }
  });
});
