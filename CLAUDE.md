# pr-dashboard

Live terminal dashboard for GitHub PRs. TypeScript + Ink (React for the terminal). Distributed on npm; users install with `npm i -g @northern-information/pr-dashboard` and run `prd`.

## Architecture

Three layers, kept separate:

- **`src/github/`** — GraphQL queries against the GitHub API via `gh api graphql` shell-out (no token storage). Two-tier polling:
  - `queries/indexQuery.ts` — cheap query, returns `{id, number, updatedAt, headRefOid}` only
  - `queries/detailQuery.ts` — full per-PR query (CI, review, merge state) batched via `nodes(ids:)`
  - `queries/orgsQuery.ts` — fetches the authenticated user's login + org list, runs once at startup
  - `client.ts` — `graphqlQuery()` wrapper around `gh api graphql` (uses `execFile` with `-f query=` and typed variables)

- **`src/poll/`** — polling orchestration, no UI dependency
  - `cache.ts` — `diffForDetailFetch` and `mergeSnapshot` are the core of the two-tier model
  - `scheduler.ts` — runs an index tick every `indexIntervalMs`, fetches details only for changed PR ids, emits `PollTick` events

- **`src/ui/`** — Ink components
  - `App.tsx` — top-level, wires scheduler + keybinds + settings
  - `Header.tsx`, `PresetTabs.tsx`, `PRTable.tsx`, `StatusFooter.tsx`, `SettingsPanel.tsx`, `FilterBar.tsx`, `FailedChecks.tsx`

- **`src/format/`** — pure rendering helpers (`relativeTime`, `cleanTitle`, status glyphs)

- **`src/config/`** — Zod-validated config at `~/.config/pr-dashboard/config.json`. `loader.ts` reports `createdDefault: true` on first run so `App` knows to auto-open settings.

## Two-tier polling

The "fresher than GitHub" win lives in `poll/scheduler.ts`:

1. Every `indexIntervalMs` (default 20s), run one GraphQL `search` per active scope. Pull only `{id, updatedAt, headRefOid}`.
2. Compare each PR's `updatedAt`/`headRefOid` against the local cache (`cache.ts:diffForDetailFetch`).
3. Fire one batched detail fetch (`nodes(ids:)`) for only the PRs whose snapshot changed.
4. Merge into cache (`cache.ts:mergeSnapshot`), emit a `PollTick`.

Steady state: an open `prd` costs ~a few rate-limit points per minute against the 5000-pts/hr GraphQL budget.

## Auth

All API calls shell out to `gh api graphql`. The tool never sees or stores a token. If `gh` is not installed or not authenticated, `src/auth/ghToken.ts:verifyGhAvailable()` prints a banner with the `gh auth login` command and exits.

## First-run flow

`loadConfig` returns `createdDefault: true` when no config file existed. `main.tsx` passes this to `App` as `firstRun`, and `App.tsx` initializes `settingsMode` to `firstRun`. So the settings panel auto-opens on first launch only.

## Bin shim

`bin/prd` is a tiny Node script that spawns Node with `tsx` as an ESM loader and points it at `src/main.tsx`. Resolved via `createRequire('tsx/esm')` so it works under npm, pnpm, and yarn install layouts.

The whole project ships as TypeScript source — no build step. `tsx` is a *runtime* dependency, not a dev dependency, because the published npm package transpiles on-demand.

## Distribution

- Published to npm as `pr-dashboard`.
- `npm i -g @northern-information/pr-dashboard` puts `prd` on the user's PATH.
- `files` in `package.json` whitelist what ships: `bin/`, `src/`, `tsconfig.json`, `README.md`. Nothing else (no tests, no configs).
- `prepublishOnly` runs `npm run verify` so a broken publish is impossible.

To cut a release:
```
# bump version
npm version patch    # or minor / major
# publish
npm publish
# push tag
git push --follow-tags
```

## Conventions

- ES modules, `"type": "module"`.
- TypeScript strict mode + `verbatimModuleSyntax`. Use `.ts` / `.tsx` extensions in import paths.
- Path alias: `@/` → `src/`.
- ESLint: `strictTypeChecked` + `stylisticTypeChecked` from typescript-eslint. No `eslint-disable` comments — fix the underlying issue.
- Prettier: single quotes, no semis, `printWidth: 120`, trailing commas `es5`. Imports sorted via `@ianvs/prettier-plugin-sort-imports`.
- `npm run verify` (typecheck + lint + test) must pass before any commit.

## UI conventions

- Brand color: `#F51700` (matches the user's zsh prompt). Used for the header border, the bold `prd` label, the active preset tab, the row cursor.
- Sentence case for all prose. Title case for in-app labels (button text, headings).
- The footer (`StatusFooter`) shows `last poll · next · rate · polling…` then a keybind strip, both dim. It's *not* sticky-bottom-of-terminal — that caused flicker. It sits one line below the table.
- Row flicker is avoided by memoizing `PRRow` with a comparator that diffs the *rendered* relative-time string, not the raw `now` clock value.

## Testing

Vitest. Tests in `tests/`. Each module's invariants:

- `tests/cache.test.ts` — `diffForDetailFetch` returns changed ids only; `mergeSnapshot` drops removed PRs and preserves detail for unchanged ones.
- `tests/scheduler.test.ts` — first tick fetches all details, second tick fetches none if unchanged, only changed ids on later ticks. Detail batching respects `detailMaxBatchSize`. Errors are caught.
- `tests/config.test.ts` — schema validation, defaults written on first run, save/reload round-trip, `buildScopes` defaults newly-discovered scopes to on, respects `disabledScopes`, alphabetizes.
- `tests/relativeTime.test.ts` — seconds/minutes/hours/days bands.

When adding a new feature, add or update the relevant test. `npm run verify` is the CI gate.

## Coverage

`npm run test:coverage` runs the v8 coverage provider. Thresholds (in `vitest.config.ts`):

- statements: 90%
- branches: 80%
- functions: 90%
- lines: 90%

Scope is restricted to `src/config/**`, `src/poll/**`, `src/format/**` — the modules that are unit-testable in Node. UI components (`src/ui/**`) and shell-out code (`src/auth/**`, `src/github/**`) are excluded; those are exercised by integration smoke tests against live data.

CI (`.github/workflows/ci.yml`) runs `npm run test:coverage` on every push and PR, then uploads the `coverage/` directory as a workflow artifact (downloadable from the workflow run page). No third-party coverage service required.

## Branch protection

`main` is protected by a repository ruleset (managed in repo Settings → Rules → Rulesets, or via the GitHub API). Active rules:

- `non_fast_forward` — force pushes to main are blocked
- `deletion` — the main branch cannot be deleted
- `required_status_checks` with `strict: true` — the `verify` CI job must pass before merging, and the branch must be up to date with main

Admin (repo owner) can bypass any of these for emergency hotfixes. Use sparingly — if you find yourself bypassing often, fix the underlying CI flakiness instead.

## Publishing

`.github/workflows/publish.yml` publishes to npm on every tag push matching `v*`. Flow:

```
npm version patch       # 0.1.0 → 0.1.1, creates a git tag
git push --follow-tags  # pushes commit + tag
```

The workflow:
1. Checks out the tagged commit
2. Runs `npm ci`
3. Verifies the git tag matches `package.json` version (e.g. `v0.1.1` must match `"version": "0.1.1"`)
4. Runs `npm publish --provenance --access public` with `NODE_AUTH_TOKEN=${{ secrets.NPM_TOKEN }}`

Provenance adds a verified link from the npm package back to the GitHub commit it was built from. Shows up as a "verified" badge on npmjs.com.

The `NPM_TOKEN` secret needs to be added to repo settings (one-time setup) — generate at npmjs.com → Access Tokens → Generate New Token → "Automation" type.

## What lives where

- Adding a new column: extend `ColumnKey` in `src/config/schema.ts`, add a spec to `src/ui/columns.ts`, handle it in the switch in `src/ui/PRTable.tsx`. Update README's "Columns" section.
- Adding a new keybind: extend the `useInput` block in `src/ui/App.tsx` and the keybind strip in `src/ui/StatusFooter.tsx`. Update README's "Keys" table and `src/main.tsx`'s `--help` text.
- Changing the polling cadence default: edit `DEFAULT_CONFIG.indexIntervalMs` in `src/config/schema.ts`. Existing users keep their override.
- Adding to the GraphQL detail fetch: extend the query in `src/github/queries/detailQuery.ts`, extend `DetailedPR` in `src/github/types.ts`, and surface in `src/ui/PRTable.tsx` (and `PRRow`'s memo comparator if the field is visible).
