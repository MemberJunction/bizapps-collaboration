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

## Options

`--who guest|staff|all` (default `all`), `--theme light|dark|both` (default `both`), `--only <name>` for one screen. A screen whose assertion fails is reported and the run exits 1.
