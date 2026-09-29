# @mj-biz-apps/collaboration-ux-gallery

A small Angular app that draws the UX storyboard's frames from fixtures, with Collaboration's own widgets and no Explorer. Its Playwright specs check what each frame draws, and frame 02's also checks dark mode. The frames in [`docs/ux/screens/`](../../docs/ux/screens/) are no longer the reference (the plan's D24), so the pixel comparisons with them are skipped.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `shell`. It's an app, not a library.
- **Depends on:** Angular 21 (`common`, `core`, `forms`, `platform-browser`, `router`), `collaboration-core`, `collaboration-ng-widgets`, `collaboration-example-space-types` (frame 08 draws the example board), and MJ's `ng-ui-components` and `ng-shared-generic`.

It also proves the widgets run in an Angular app that isn't Explorer.

## What's in it

- **`src/main.ts`, `src/app.component.ts` and `src/routes.ts`:** a standalone Angular app with a route per frame: `/frame/02` (the space overview), `/frame/03` (the library), `/frame/04` (the share check) and `/frame/08` (the example board).
- **`src/frames/`:** each frame, built from the widgets.
- **`src/fixtures/`:** each frame's data, such as `FRAME_02_FIXTURE`, with the space type colors in one map (`SPACE_TYPE_COLORS`).
- **`bundle.mjs`:** bundles the compiled app with esbuild into `dist/app.bundle.js`, and writes `dist/gallery.css`: pinned fonts (Inter 5.3.0 and JetBrains Mono), MJ's token sheet from `ng-shared-generic`, its own copy of the app's `--mjc-*` color tokens at `:root`, MJ's button and dialog styles, and a 1440×900 page.
- **`server.mjs`:** serves the gallery on port 4250 (`GALLERY_PORT` changes it), with an index of the frames at `/`. It loads Font Awesome 6.5.2, and `?theme=dark` sets `data-theme="dark"` on the page.

## Build and run

```bash
pnpm --filter @mj-biz-apps/collaboration-ux-gallery run build   # ngc, then bundle.mjs
node packages/UXGallery/server.mjs                              # http://localhost:4250/frame/02
```

`pnpm run test:e2e` starts the server itself and runs the four Playwright specs in `e2e/specs/`, one per frame. The pixel comparisons with the old frames are skipped.

## Not done yet

Frames 01, 05 to 07 and 09 to 13. The rest of the screens are checked in Explorer, by the UI pass in `e2e/ui-pass/`, which signs in as each persona.
