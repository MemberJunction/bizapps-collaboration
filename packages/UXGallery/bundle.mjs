import { build, transform } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export async function bundleGalleryApp() {
    // 1. Bundle Angular application
    await build({
        entryPoints: [join(here, 'dist/main.js')],
        bundle: true,
        outfile: join(here, 'dist/app.bundle.js'),
        format: 'esm',
        target: 'es2022',
        sourcemap: true,
        define: {
            'ngDevMode': 'false',
        },
    });
    console.log('UXGallery app bundled to dist/app.bundle.js');

    // 2. Build canonical gallery stylesheet (MJ tokens + Inter 5.3.0 + mjButton styles + app tokens)
    const fontCss = `
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url('https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.3.0/files/inter-latin-wght-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  src: url('https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.3.0/files/jetbrains-mono-latin-400-normal.woff2') format('woff2');
}
`;

    const tokensScssPath = join(dirname(require.resolve('@memberjunction/ng-shared-generic/package.json')), 'dist/lib/_tokens.scss');
    const tokensContent = readFileSync(tokensScssPath, 'utf8');

    const buttonScssPath = join(dirname(require.resolve('@memberjunction/ng-ui-components/package.json')), 'dist/lib/button/button.scss');
    const buttonContent = readFileSync(buttonScssPath, 'utf8');
    const { code: buttonCss } = await transform(buttonContent, { loader: 'css' });

    const collabTokens = `
:root {
  --mjc-shared: var(--mj-brand-tertiary-active);
  --mjc-shared-strong: var(--mj-brand-tertiary-hover);
  --mjc-shared-bg: var(--mj-brand-tertiary-subtle);
  --mjc-shared-border: color-mix(in srgb, var(--mj-brand-tertiary) 35%, transparent);
  --mjc-team: var(--mj-text-secondary);
  --mjc-team-strong: var(--mj-text-secondary);
  --mjc-team-bg: color-mix(in srgb, var(--mj-text-muted) 12%, transparent);
  --mjc-team-border: var(--mj-border-strong);
  --mjc-on-strong: var(--mj-text-inverse);
  --mjc-ai-from: var(--mj-brand-primary);
  --mjc-ai-to: var(--mj-brand-accent);
}
`;

    const baseReset = `
*, *::before, *::after {
  box-sizing: border-box;
}
html, body {
  margin: 0;
  padding: 0;
  width: 1440px;
  height: 900px;
  overflow: hidden;
  font-family: var(--mj-font-family, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  background: var(--mj-bg-page, #ffffff);
  color: var(--mj-text-primary, #0f172a);
  -webkit-font-smoothing: antialiased;
}
`;

    const combinedCss = [fontCss, tokensContent, collabTokens, buttonCss, baseReset].join('\n\n');
    writeFileSync(join(here, 'dist/gallery.css'), combinedCss, 'utf8');
    console.log('UXGallery stylesheet built to dist/gallery.css');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    await bundleGalleryApp();
}
