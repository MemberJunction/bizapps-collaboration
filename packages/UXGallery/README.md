# @mj-biz-apps/collaboration-ux-gallery

A small Angular app that draws the UX storyboard's frames from fixtures, with Collaboration's own widgets and no Explorer. The visual tests compare it with the frames in [`docs/ux/screens/`](../../docs/ux/screens/).

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `shell`. It's an app, not a library.
- **Depends on:** Angular 21 (`common`, `core`, `forms`, `platform-browser`, `router`), `collaboration-core`, `collaboration-ng-widgets`, and MJ's `ng-ui-components` and `ng-shared-generic`.

It also proves the widgets run in an Angular app that isn't Explorer.

## What's in it

- **`src/main.ts`, `src/app.component.ts` and `src/routes.ts`:** a standalone Angular app. The route `/frame/02` draws frame 02, and `/` redirects there.
- **`src/frames/frame-02.component.ts`:** frame 02's chrome (the top bar, the rail, the space header, the audience pill and the tabs), built from the widgets.
- **`src/fixtures/frame-02.fixture.ts`:** the frame's data (`FRAME_02_FIXTURE`), with the space type colors in one map (`SPACE_TYPE_COLORS`).
- **`bundle.mjs`:** bundles the compiled app with esbuild into `dist/app.bundle.js`, and writes `dist/gallery.css`: pinned fonts (Inter 5.3.0 and JetBrains Mono), MJ's token sheet from `ng-shared-generic`, the app's `--mjc-*` tokens, MJ's button styles, and a 1440×900 page.
- **`server.mjs`:** serves the gallery on port 4250 (`GALLERY_PORT` changes it). It loads Font Awesome 6.5.2, and `?theme=dark` sets `data-theme="dark"` on the page.

## Build and run

```bash
pnpm --filter @mj-biz-apps/collaboration-ux-gallery run build   # ngc, then bundle.mjs
node packages/UXGallery/server.mjs                              # http://localhost:4250/frame/02
```

`pnpm run test:e2e` starts the server itself and runs the Playwright spec in `e2e/specs/`. On CI the chrome must match `02-space-overview.png` within 100 pixels. The full-frame comparison is marked as an expected failure until slice A draws the frame's body.

## Not done yet

Frames 01 and 03 to 13. Each slice of [the UI plan](../../docs/ux/IMPLEMENTATION_PLAN.md) adds its frames here from fixtures, with a test for each.
