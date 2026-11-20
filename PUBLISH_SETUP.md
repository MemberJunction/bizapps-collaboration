# Publishing Setup — bizapps-collaboration

This repo publishes the `@mj-biz-apps/collaboration-*` packages to npm with the open-app release
pipeline shared across the BizApps repos. The release workflows and their scripts are copied
byte-for-byte from **bizapps-issues** and must stay identical; checks specific to this repo live
in `.github/workflows/repo-checks.yml`. bizapps-collaboration is the first repo on release lines, so its
copies are ahead of bizapps-issues until the other apps adopt them; nothing in them is specific
to this repo.

## Branch model

This repo follows release lines (`guides/RELEASE_LINES.md`):

```
feature ──PR──▶ next ──backport label──▶ lts/6.2 ──(App opens Version Packages PR)──▶ main ──(publish.yml)──▶ npm
```

- `next` is built on MJ Edge and **never versions or publishes**. PRs land there first, with a
  changeset (`pnpm run change`). A migration or `metadata/` change needs at least a **`minor`**
  changeset (`migration changeset` check).
- A `backport lts/X.Y` label on the PR into `next` makes `backport.yml` open the cherry-pick PR
  into that line once it merges. The changeset travels with it.
- Every push to a line runs `version.yml`, which refreshes that line's **Version Packages PR**,
  opened by the `blue-cypress-ci-bot` App. It runs `pnpm run version:prepare`: `changeset
  version`, the `mj-app.json` version and MJ range sync (`ci/sync-mj-app-version.mjs`), and a
  lockfile refresh.
  - The newest line (`releasesThrough: main` in `release-lines.json`): `changeset-release/main`
    → `main`. Publishes as `latest`; afterwards the App opens and merges a
    `release-back-merge/vX.Y.Z` PR into the line.
  - An older line (`releasesThrough: branch`): `changeset-release/lts/X.Y` → `lts/X.Y`.
    Publishes under the dist-tag `lts-X.Y`; no back-merge.
- **Merging that PR is the release** (`Cut the Release` dispatch, `line` input empty for the
  newest line). `release-readiness.yml` gates it (`rr:` checks: no pending changesets, bump
  level, metadata shipped, Postgres counterparts, release base current, migration immutability,
  packages on npm). `publish.yml` publishes over npm OIDC under the line's dist-tag, tags
  `vX.Y.Z`, checks the dist-tag, and opens a PR into `next` removing the changesets it released.
- There is no hand-opened PR into `main`, and nothing commits to `main` directly.

## npm authentication — OIDC (no NPM_TOKEN secret)

`publish.yml` declares `id-token: write`; npm verifies the GitHub Actions OIDC identity at publish
time. Each package's **Settings → Trusted Publisher** on npmjs.com must name
`MemberJunction/bizapps-collaboration` and the `publish.yml` workflow.

## First publish — adding a new package

CI cannot publish a package that npm has never seen: a trusted publisher can only be attached to
a package that already exists, and creating one needs an interactive 2FA prompt. So a new package
is set up by hand, once, by someone with publish rights on its npm scope — on the PR that adds
it, not during the release.

The `new package seeded` check (`new-package-gate.yml`) blocks a PR into `next` that adds a
publishable package until that package carries a **seed version published through this repo's
`publish.yml`**. Existing on npm is not enough: a hand-made placeholder exists but proves nothing
about whether the trusted publisher is attached. The seed's public provenance attestation does,
because it can only be produced by a publish that went through it.

From a checkout of this repo, with npm 11.15 or newer (`npm install -g npm@^11.15.0`), `npm login`
(2FA on) and `gh auth login`:

```sh
.github/scripts/seed-new-npm-package.sh @mj-biz-apps/new-thing [@mj-biz-apps/other-thing ...]
```

For each package it creates the placeholder if one is missing, attaches the trusted publisher,
dispatches the seed and waits up to 10 minutes for the attestation. It checks live state before
every step, so it is safe to re-run. Then re-run the failed `new package seeded` job on the PR.

What it does, if you would rather do it by hand:

1. `npx -y setup-npm-trusted-publish <package>` — creates the package with a placeholder version.
2. `npm trust github <package> --file publish.yml --repo MemberJunction/bizapps-collaboration --allow-publish -y`
   — attaches the trusted publisher (one 2FA prompt; no GitHub environment is used).
3. `gh workflow run publish.yml --ref next -f seed_package=<package> -f confirm_seed_package=<package>`
   — runs only the `seed-package` job, which publishes `0.0.1-seed.1` under the `seed` dist-tag
   (never `latest`). Nothing is built and no changeset is consumed. It succeeds only if step 2
   worked, and it refuses to run from any branch but `next` or `main`.

The release-side checks (`rr: packages on npm`, and the same step in `publish.yml`) still run and
still only ask whether every package exists; they are the backstop, not the proof.

## Org setup

- The `blue-cypress-ci-bot` App is installed on this repo, and the org `APP_CLIENT_ID` variable
  and `APP_PRIVATE_KEY` secret reach it.
- Rulesets: `protect-next` (PR required, one approval, the four door checks, strict; App bypass for pull requests only), `protect-main` (the seven `rr:` checks
  plus `build`, one approval) and `protect-lts` on `lts/*` (PR required, one approval, code-owner review, the
  `lines:` checks, the door checks and `build`; App bypass for pull requests only, for the
  back-merge and an older line's release PR).

## Notes

- `migrations/` holds a `B`-prefixed Flyway baseline; the filename and changeset checks match the
  `V…` files added after it.
- Every new `migrations/*.sql` needs a `migrations-pg/` counterpart
  (`pnpm run mj:migrate:convert`). A PR without one gets a warning; `rr: pg counterparts` fails
  the release until it exists.
