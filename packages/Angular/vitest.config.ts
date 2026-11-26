import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));
const widgetsDistEntry = resolve(here, '../AngularWidgets/dist/public-api.js');
const widgetsSrcEntry = resolve(here, '../AngularWidgets/src/public-api.ts');

// One copy of Angular for the tests: MJ's packages are linked from their own checkout, and where that checkout keeps a store of
// its own the same Angular version would load twice (two copies of `@angular/core`, and injection fails with NG0203).
export default defineConfig({
  resolve: {
    dedupe: ['@angular/core', '@angular/common', '@angular/compiler', '@angular/forms', '@angular/platform-browser', '@angular/animations', 'rxjs'],
    ...(!existsSync(widgetsDistEntry)
      ? {
          alias: {
            '@mj-biz-apps/collaboration-ng-widgets': widgetsSrcEntry,
          },
        }
      : {}),
  },
  test: {
    // The logic tests run on node:test; vitest runs rendered and Angular __tests__ specs
    include: ['src/**/*.render.test.ts', 'src/__tests__/**/*.spec.ts'],
    server: { deps: { inline: [/@memberjunction\/ng-/, /@mj-biz-apps\/tasks-ng/, /@angular\//] } },
  },
});
