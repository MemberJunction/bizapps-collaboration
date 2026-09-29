# Mockup source

These files generate the frames in [`../screens/`](../screens/) and the HTML pages in [`html/`](html/). They were the design reference until the frames were retired as the reference (the plan's D24), and they aren't app code. The implementation lives in `packages/`, as [../IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) describes.

| File | What it holds |
|---|---|
| `base.css` | The design system the frames are drawn with (details below). |
| `lib.mjs` | The cast of people, avatars, the Explorer top bar stand-in, the left rail, and the space header and tabs. `page()` wraps a frame in its HTML document. |
| `screens-a.mjs` | 01 Home, 02 Space overview, 03 Library, 04 Share check |
| `screens-b.mjs` | 05 Room chat, 06 People, 07 Casey's portal, 08 Committee member |
| `screens-c.mjs` | 09 Assistant settings, 10 Work, 11 Dark chat, 12 Phone, 13 New space |
| `screens-d.mjs` | 00 Concept |
| `render.mjs` | Writes `html/NN-name.html` and `../screens/NN-name.png` |
| `assets/` | The MemberJunction mark, light and dark |
| `html/` | Generated. Open any page in a browser to inspect it. Don't edit these; edit the `.mjs` and re-render. |

## What `base.css` holds

- **MJ's tokens.** These are generated from MJ's `_tokens.scss` (light and dark), limited to what the frames use.
- **The app's `--mjc-*` tokens.** Each is written as an expression of MJ semantic tokens, so it follows light and dark with no theme block.
- **Mirrors of MJ component styles.** The frames draw with the exact metrics of these MJ components:

  | Class in the mockup | MJ component |
  |---|---|
  | `.btn` | `mjButton` |
  | `.input`, `.textarea` | `.mj-input`, `.mj-textarea` |
  | `.switch` | `mj-switch` |
  | `.seg` | `mj-tab-nav` |
  | `.fchip` | `mj-filter-chip` |
  | `.progress` | `mj-progress-bar` |
  | `.role` | `mj-dropdown` |
  | `.sn` | `mj-left-nav` |

  In the implementation, use the MJ components themselves rather than these classes.
- **Colors that are data.** The hex values in `.tile.*` (a space type's `Color`) and `.av.c1`–`.c10` (the avatar palette) stand in for data. The phone's device frame is an illustration, not UI. Everything else is a token.

## Re-rendering

`render.mjs` needs Node 20+ and Playwright. This folder is deliberately not a workspace package, so install Playwright beside it. The command below writes only `./node_modules`, which is git-ignored, and touches neither the workspace nor its lockfile:

```bash
cd docs/ux/mockup
npm install --prefix . --no-save --no-package-lock playwright@1.63.0
npx playwright install chromium       # or set CHROMIUM_PATH to an existing Chromium
node render.mjs                       # every frame
node render.mjs chat                  # only frames whose name contains "chat"
```

Pages load their fonts and icons from pinned CDN URLs: Inter 5.3.0, JetBrains Mono 5.3.0 and Font Awesome 6.5.2, which is the file MJ Explorer itself loads. **Render with network access.** Without it, the screenshots silently fall back to system fonts, and `render.mjs` prints `MISSING ICONS` for every frame. That output tells you not to commit those PNGs.

For each frame, the script also reports content that is cut off (`… 852>844`). A frame is finished when it prints nothing but its name and size.
