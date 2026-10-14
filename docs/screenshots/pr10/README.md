# PR 10's screenshots

`take-screenshots.mjs` drives Explorer with Playwright and saves each screen in light and dark, after asserting what the screen must show. The names follow [the plan's table](../../../plans/pr10-plan.md#4-the-rest-of-stage-0): `01` to `08` are a seated outside member's screens, `10` onward are staff's.

## Setup

- MJAPI and Explorer running against a database with the sample world loaded (`EXPLORER_URL` and `MJAPI_URL` default to `http://localhost:4217` and `http://localhost:4117`).
- The repo built (`pnpm build`), so `packages/IntegrationTests/dist` exists, and the root `.env` pointing at the database.
- Playwright, installed beside the script and kept out of git:

  ```sh
  npm install --prefix docs/screenshots/pr10 --no-save --no-package-lock playwright@1.58.1
  (cd docs/screenshots/pr10 && npx playwright install chromium)   # or set CHROMIUM_PATH to a Chromium you have
  ```

- Magic links on in MJ's config, with `explorerUrl` pointing at Explorer as the browser reaches it.

## The guest

`SCREENSHOT_GUEST_EMAIL` names a person who already holds an outside seat on *Northwind relationship*: an owner invites them once from People → Invite. The script mints a fresh single-use sign-in for that email each run and opens Explorer with the session token in the URL fragment, as the redeem's redirect does.

```sh
SCREENSHOT_GUEST_EMAIL=someone@example.com node --env-file=.env docs/screenshots/pr10/take-screenshots.mjs --who guest
```

## Staff

Staff sign in with the host's provider, so their session is saved once by hand and reused:

```sh
node docs/screenshots/pr10/take-screenshots.mjs --save-staff-session   # a browser opens; sign in; the session is saved
node --env-file=.env docs/screenshots/pr10/take-screenshots.mjs --who staff
```

`staff-session.json` holds the sign-in and stays out of git.

## The leader (stage 2)

Stage 2's screens (`20` to `24`) are taken as a chapter leader from the sample world, `personas.csv`'s lena: a Space Participant
seated on *Chapter 12* and nowhere else, who signs in by magic link like the guest. `SCREENSHOT_LEADER_EMAIL` names someone else
in that seat. The staff screens `30` to `33` need the staff session, seated on *Chapter 12 staff* and holding Developer.

```sh
node --env-file=.env docs/screenshots/pr10/take-screenshots.mjs --who leader
```

## Stage 3

Screens `40` and `41` make an agent turn as the staff account (`SCREENSHOT_STAFF_EMAIL`, the person whose session is saved) in
*Chapter 12 staff*, with the harness's stub agent seated for the shot, and show the reply: a General conversation gives the agent
nothing, an Internal Only one gives it the staff type's query through *Run space data*.

```sh
SCREENSHOT_STAFF_EMAIL=someone@example.com node --env-file=.env docs/screenshots/pr10/take-screenshots.mjs --who staff
```

Screen `42` is the leader's own chat: it passes on an MJ that carries MJ#5243 (the plan's A12.17); before that fix MJ's chat area
showed a magic-link participant no messages and no composer.

## Stage 4

The screens of B19, B21 and B22, taken as the staff account, the guest (Casey) and the leader (Lena). Each one that writes removes
what it wrote (a pin, a note, a star), so the dark pass starts from the world as loaded.

| Screen | Who | Shows |
|---|---|---|
| `50-staff-notes-tab` | staff | Northwind's Notes tab: the Shared and the Team note, not Ada's private one; *Share with* on the Team note (the owner may promote). |
| `51-staff-note-promote-confirm` | staff | The confirmation before a promotion (call 15): what becomes visible, and that it is not undone. |
| `52-guest-notes-shared-only` | guest | Casey's Notes tab: the Shared note only, and no *Share with*. |
| `53-staff-pinned-strip` | staff | A note pinned from the Notes tab shows in the Overview's *Pinned* strip. |
| `54-staff-home-my-pins` | staff | Home's *My Pins*: the pin, named by its space. The pin is removed afterwards. |
| `55-staff-data-tab-query` | staff | *Chapter 12 staff*'s Data tab: the renewals query run on the server, its rows in the tab. |
| `56-staff-data-component` | staff | The chapter banner, an MJ component in the React host, its props bound on the server from the chapter anchor. |
| `57-staff-settings-configuration` | staff | Settings: the grants, anchors and data reach in force (D23). |
| `58-leader-note-quick-add` | leader | The *Note* button on the Overview opens the composer; the note lands on the Shared band. Deleted afterwards. |
| `59-guest-space-star` | guest | The star in the header (MJ's User Favorites), toggled on and back off. |

## Options

- `SHOT_DEBUG=1` prints the GraphQL calls a shot makes and, on a failure, the page's errors and its URL, so a step that changed nothing visible can be read in the run's output.


`--who guest|staff|all` (default `all`), `--theme light|dark|both` (default `both`), `--only <name>` for one screen. A screen whose assertion fails is reported and the run exits 1.
