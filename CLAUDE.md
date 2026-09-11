# @medalsocial/sdk — Claude Guide

## What this is

TypeScript SDK for the Medal Social API. Public open-source package published to npm as `@medalsocial/sdk`.

## Branch Strategy

```
feat/* → dev → promote/dev-to-prod-<date> → prod
```

- `dev` — where all feature PRs merge first
- `prod` — **the repository's default branch**. Pushing to it triggers the
  release and the docs deploy. GitHub also evaluates Dependabot and code
  scanning alerts against `prod`, so a security fix merged to `dev` does not
  clear the security tab until it is promoted.

### `prod` is ahead of `dev` permanently — do not try to "fix" it

`prod` is **not** an ancestor of `dev` and cannot be made one:

```bash
git merge-base --is-ancestor origin/prod origin/dev   # fails, by design
```

Every release puts a `chore: release packages` commit (version bump +
CHANGELOG) on `prod`, and every promote adds a squash commit that exists only
there. So `prod` always carries commits `dev` lacks.

**A back-merge cannot repair this.** `dev` has classic branch protection with
`required_linear_history: true` and `enforce_admins: true`, so merge commits
are refused outright — the API returns `405 Merge commits are not allowed on
this repository`, and `--admin` does not get past `enforce_admins`. Squash and
rebase both flatten the second parent, so a back-merge PR merged either way
restores nothing while looking like it did.

Do not cite PR #67 ("chore: back-merge prod into dev") as precedent. It merged
as `e1f0599` with a **single parent** — it was squashed, so it never restored
ancestry. The only true merge commits on `dev` predate linear history.

This is therefore a consequence of the branch policy, not neglect, and the
tree-swap promote below is the correct permanent procedure — not a workaround.
Changing it would mean relaxing linear history on `dev` and allowing
fast-forward pushes to `prod`, which is a deliberate policy decision, not a
cleanup task. Do not force-push `prod` either: it rewrites a public repo's
default branch, npm/JSR provenance attestations reference published commit
SHAs, and the next release breaks it again regardless.

`git cherry origin/dev origin/prod` prints ~30 `+` lines here. That is patch-id
noise from squash-created promote commits, **not** evidence of lost content —
do not use it as the pre-flight. Use the tree diff instead.

## Promoting `dev` → `prod`

One commit carrying **dev's exact tree** with prod's tip as its parent. Never
open a `base=prod head=dev` PR directly — it shows as conflicting.

```bash
git fetch origin '+refs/heads/dev:refs/remotes/origin/dev' '+refs/heads/prod:refs/remotes/origin/prod'

# Pre-flight — this is the check that matters. Every line must be an expected
# `M`. An unexpected `D` means the swap would DROP content that only exists on
# prod: stop and back-merge prod into dev first.
git diff --name-status origin/prod origin/dev

DATE=$(date -u +%Y-%m-%d)
SHA=$(git commit-tree 'origin/dev^{tree}' -p origin/prod   -m "chore(release): promote dev → prod ($DATE)")

# Verify the promote commit really carries dev's tree — must print nothing.
git diff "$SHA" origin/dev

git push origin "$SHA:refs/heads/promote/dev-to-prod-$DATE"
gh pr create --base prod --head "promote/dev-to-prod-$DATE"   --title "chore(release): promote dev → prod ($DATE)"
```

Then, once `lint` / `test` / `build` are green on the PR:

```bash
# --match-head-commit refuses the merge if anything landed on the branch after
# you opened it, so the approval cannot be transferred to a different tree.
gh pr merge --squash --match-head-commit "$SHA" "promote/dev-to-prod-$DATE"
```

`prod` requires **1 approving review from another account** — whoever pushed
the branch cannot approve it.

### What the promote triggers

- `release.yml` — Changesets. With pending `.changeset/*.md` files it opens a
  `chore: release packages` version PR (bot-pushed, so it is self-mergeable);
  merging that publishes to npm + JSR. **With no pending changesets nothing is
  published** and the version stays put.
- `docs.yml` — TypeDoc to GitHub Pages.
- `codeql.yml` / `scorecard.yml` — re-scan, which is what closes security alerts.

### Rollback

There is none, and there cannot be one: npm and JSR releases are immutable and
npm blocks unpublish after 72 hours. **Releases are roll-forward only** — fix
on `dev`, promote again, publish a new patch. Treat the promote as the point of
no return and make sure CI is green before merging, not after.

## Release Pipeline

Publishing uses **Changesets** with **npm OIDC trusted publishing** — no static `NPM_TOKEN` is needed.

### How it works

1. Merge a PR with a `.changeset/*.md` file into `dev`
2. Promote `dev → prod` (see [Promoting `dev` → `prod`](#promoting-dev--prod) — it is a tree-swap, not a plain PR)
3. Merging to `prod` triggers `.github/workflows/release.yml`
4. The workflow runs inside the `npm` GitHub Environment (locked to `prod` branch only)
5. `id-token: write` permission issues an OIDC token
6. npm authenticates via OIDC — no secret token required
7. `NPM_CONFIG_PROVENANCE=true` attaches provenance attestation to the published package

### Adding a changeset

```bash
pnpm changeset        # interactive — pick patch/minor/major + write summary
```

Or just create `.changeset/<name>.md` manually:

```md
---
"@medalsocial/sdk": minor
---

Add support for X resource
```

### One-time npm setup (already done)

- npmjs.com → `@medalsocial/sdk` → Settings → Publishing access → OIDC enabled for `Medal-Social/MedalSocial`
- GitHub Environment `npm` exists, locked to `prod` branch

### The second registry: JSR

The package also goes to [JSR](https://jsr.io/@medalsocial/sdk), from a
**separate workflow step** that runs after `changesets/action` — deliberately
not from inside `pnpm release`. Two reasons:

1. **Tags and GitHub releases must not depend on JSR.** They are created by the
   changesets action, and anything that fails inside the publish script fails
   the whole action. `jsr publish` used to sit at the end of `pnpm release`, so
   a JSR hiccup took the release bookkeeping with it.
2. **`jsr publish` is not atomic and not re-runnable.** JSR creates the version
   the moment the tarball is accepted; only *then* does `deno publish` mint the
   Sigstore provenance attestation. A transient Fulcio/Rekor failure exits
   non-zero on a version that is already live and immutable — and a plain
   re-run then dies on "already published".

`pnpm jsr:publish` (`scripts/jsr-publish.mjs`) handles both: it asks
`https://jsr.io/@medalsocial/sdk/<version>_meta.json` before publishing and
skips if the version is there, and asks again if the CLI fails — a failure on a
version the registry already has downgrades to a warning naming the likely
culprit. Anything else still fails the job. `pnpm jsr:publish --dry-run`
reports what it would do without publishing.

A version published without provenance has `rekorLogId: null` in
`https://api.jsr.io/scopes/medalsocial/packages/sdk/versions` — that is how to
tell an attestation failure from a healthy release after the fact.

## CI

`.github/workflows/ci.yml` runs on all PRs and pushes to `dev`/`prod`:

| Job | What it checks |
|-----|---------------|
| `test` | Vitest via `pnpm test:coverage` + Codecov upload. Coverage thresholds are **100%** on statements/branches/functions/lines — a new uncovered branch fails CI |
| `lint` | Biome |
| `build` | `pnpm typecheck`, then OpenAPI lint, `tsup` build, OpenAPI coverage, entry-point verification |
| `security` | secretlint over tracked files + knip |

`pnpm typecheck` runs `tsc --noEmit` twice: once on `tsconfig.json` (`src` only,
the shipped surface) and once on `tsconfig.test.json`, which widens it to
`tests`, `pilot` and `scripts`. Vitest never typechecks, so without the second
pass test files are unchecked.

`prod`'s ruleset requires the `lint`, `test` and `build` contexts.

## Security Workflows

| Workflow | Trigger |
|----------|---------|
| `codeql.yml` | Push to `prod` + weekly Monday |
| `scorecard.yml` | Push to `prod` + weekly Monday |

## Project Structure

```
src/
  client.ts              # BaseClient — HTTP, retry (drains body before retry), auth
  index.ts               # Medal class — main entry point, defaults baseUrl to https://io.medalsocial.com
  version.ts             # GENERATED by scripts/sync-version.mjs — SDK_VERSION for the User-Agent
  capability-confirmer.ts # mints Idempotency-Key + X-Capability-Confirmation for confirmable writes
  webhook-events.ts      # typed WebhookEvent union + verifyWebhookSignature
  resources/             # bookings, capability-confirmations, channels, contacts, deals, emails,
                         # gdpr, helpdesk, portal, posts, scan, webhooks, workspaces
  types/                 # TypeScript types per resource
  openapi.generated.ts   # openapi-typescript output — regenerate with `pnpm openapi:types`
pilot/index.ts           # `@medalsocial/sdk/pilot` — zod tool schemas for agents
openapi/                 # the OpenAPI 3.1 contract the SDK is checked against
skills/                  # TanStack Intent skills, shipped in the npm tarball
scripts/                 # release + verification scripts (each has a test under tests/scripts/)
tests/
  *.test.ts              # Unit tests (vitest, 100% coverage thresholds on src/)
  integration.test.ts    # Live API tests — skipped without credentials
```

## Key Rules

- **Public repo** — never commit secrets, internal URLs, or Medal Social infrastructure references
- **Base URL** is `https://io.medalsocial.com` — not `api.medalsocial.com` (common mistake, already fixed once)
- **License** is Apache-2.0 — keep `LICENSE`, `package.json`, and published metadata aligned
- **No `NPM_TOKEN`** — publishing uses OIDC, do not add a static token
- **This repository is the authoritative source for the SDK.** The API it wraps is implemented in the private Medal Social monorepo; when the SDK's types drift from what the API actually accepts or returns, fix them here (types, resources and the OpenAPI document together), and remember that a value the API refuses with a 400 is a correction, not a breaking change, even when TypeScript now rejects it.
- **Enums are closed on purpose.** `DealStatus`, `ContactStatus`, `PostStatus`, `EmailSendStatus`, `HelpdeskChannel`, `PortalLocale`, `SubscribableWebhookEventType` name exactly what the API accepts — do not widen them to `string` to make a caller compile.
- **The version lives in one place.** `package.json` is the source; `src/version.ts` (`SDK_VERSION`, sent in the `User-Agent`), `jsr.json` and the OpenAPI `info.version` are written by `scripts/sync-version.mjs`, which `pnpm run version` runs right after `changeset version`. Never hand-edit those three — `pnpm run version:check` (in the `build` CI job) and `tests/version-sync.test.ts` fail on drift.
- **Node floors differ by role.** The published SDK supports Node 20+ (`engines.node`), and CI runs the unit suite on 20, 22 and 24 to prove it. Developing the SDK needs Node 22+ because the release tooling (`changesets`, `secretlint`, `lint-staged`) and pnpm 11 itself require it.
