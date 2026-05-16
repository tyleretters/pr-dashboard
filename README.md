# prd — pull request dashboard

A live terminal dashboard for GitHub PRs across all your orgs. Fresher than the web UI: it polls smart (a cheap "index" query identifies which PRs actually changed; only those get detail fetches), shows freshness in the UI so you can see it's alive, and stays out of your way otherwise.

![prd screenshot](https://raw.githubusercontent.com/northern-information/pr-dashboard/main/.github/screenshot.png)

## Install

```
npm i -g pr-dashboard
```

Requirements:
- **Node 22 or later** — check with `node --version`
- **`gh` CLI** installed and authenticated — `brew install gh && gh auth login`

That's it. The tool re-uses your `gh` session, so there's nothing else to configure.

## First run

```
prd
```

On the first launch you'll see the settings panel. Every GitHub org you belong to (plus your own user account) appears as a checkbox, in alphabetical order. Toggle the ones you want to see as tabs and hit `enter`.

After that, `prd` opens straight to the dashboard.

Config lives at `~/.config/pr-dashboard/config.json`. You can edit it by hand, or press `s` inside the app to re-open the settings panel.

## Keys

| Key | Action |
|-----|--------|
| `1`–`9` | switch scope tab |
| `j` / `k` (or arrows) | move cursor |
| `enter` / `o` | open focused PR in browser |
| `x` | toggle failed-checks panel for focused PR |
| `/` | filter rows |
| `r` | force refresh |
| `s` | open settings (toggle scopes on/off) |
| `q` / `Ctrl+C` | quit |

### Settings panel keys

| Key | Action |
|-----|--------|
| `j` / `k` | move cursor |
| `space` / `x` | toggle focused scope |
| `a` | enable all |
| `n` | disable all |
| `enter` | save and close |
| `esc` | cancel |

## Columns

- **CI**: `✓` success · `✗` failure · `●` pending · `–` none
- **Rev**: `✓` approved · `✗` changes requested · `?` review requested · `·` none
- **Mrg**: `✓` clean · `⚠` blocked/behind · `✗` dirty (conflicts) · `D` draft
- **Age**: days since `createdAt` — red when >7 days
- **Updated**: relative time since `updatedAt`. Ticks live; this is what makes the dashboard feel fresh.

## How freshness works

- **Index tick** (every `indexIntervalMs`, default 20s): one GraphQL `search` query per active scope pulls `{id, updatedAt, headRefOid}` only. Cheap — a few rate-limit points.
- **Detail tick**: a single batched `nodes(ids:)` query fetches the full row only for PRs whose `updatedAt` or `headRefOid` changed since last cycle. So in steady state, an open `prd` costs almost nothing against your 5000-pts/hr GraphQL budget.
- The status footer shows `last poll Ns ago / next in Ns / rate <remaining>/5000` so you can always see it's alive.
- Org membership is re-checked on every launch — join a new org, restart `prd`, and it shows up in settings.

## Configuration

`~/.config/pr-dashboard/config.json`:

```json
{
  "indexIntervalMs": 20000,
  "detailMaxBatchSize": 25,
  "enabledScopes": ["discogs", "northern-information"],
  "disabledScopes": [],
  "columns": ["repo", "number", "title", "ci", "review", "merge", "age", "updated"]
}
```

- `enabledScopes` — org slugs (or your user login) that should appear as tabs.
- `disabledScopes` — scopes you've explicitly hidden. Newly-discovered orgs default to *enabled* unless they appear here.
- Both lists are managed by the in-app settings panel. Editing the file by hand also works.

Each scope renders as a single GitHub search query: `is:open is:pr involves:@me <user-or-org>:<key> archived:false` — meaning authored, review-requested, mentioned, or assigned.

## Develop

```
git clone git@github.com:northern-information/pr-dashboard.git
cd pr-dashboard
npm install
npm link        # makes `prd` resolve to your local checkout
prd
```

Scripts:

```
npm run dev         # run via tsx
npm run test        # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run verify      # all three (typecheck + lint + test)
```

## Why not just use `gh pr list`?

`gh pr list` is great for one-shot output. `prd` is for the case where you want to *leave a terminal pane open* with live PR state — across multiple orgs, with CI/review/merge state visible at a glance, without manually refreshing. Think of it as the dashboard GitHub's web UI should be.

## License

MIT
