# prd — pull request dashboard

A live terminal dashboard for GitHub PRs. Faster and fresher than the web UI, because it polls smart: a cheap "index" query every 20s identifies which PRs actually changed, and only those get detail fetches. Everything else reads from local cache.

## Install

```
cd ~/projects/pr-dashboard
npm install
npm link     # makes `prd` available globally
```

Requires:
- Node 24 (see `.node-version`)
- `gh` CLI installed and authenticated (`gh auth login`)

## Usage

```
prd
```

First run writes a starter config to `~/.config/pr-dashboard/config.json`. Edit it to add or change presets.

### Keys

| Key | Action |
|-----|--------|
| `1`–`9` | switch preset |
| `j` / `k` (or arrows) | move cursor |
| `enter` | toggle failed-checks panel for focused PR |
| `o` | open focused PR in browser |
| `c` | copy focused PR URL to clipboard |
| `/` | filter rows |
| `r` | force refresh |
| `q` / `Ctrl+C` | quit |

### Columns

- **CI**: `✓` success · `✗` failure · `●` pending · `–` none
- **Rev**: `✓` approved · `✗` changes requested · `?` review requested · `·` none
- **Mrg**: `✓` clean · `⚠` blocked/behind · `✗` dirty (conflicts) · `D` draft
- **Age**: days since `createdAt` — red+bold when >7 days
- **Updated**: ticks every 500ms — this is what makes it feel live

## Config

```json
{
  "indexIntervalMs": 20000,
  "detailMaxBatchSize": 25,
  "defaultPreset": "work",
  "presets": {
    "work": { "label": "Work", "filters": ["is:open is:pr involves:@me org:discogs"] },
    "personal": { "label": "Personal", "filters": ["is:open is:pr author:@me -org:discogs"] }
  },
  "columns": ["repo", "number", "title", "ci", "review", "merge", "age", "updated"]
}
```

Each preset can list multiple GitHub search query strings — results are unioned and deduped. Use this to combine orgs into one tab.

## How freshness works

- Index tick (every `indexIntervalMs`, default 20s): one GraphQL `search` query per filter pulls `{id, updatedAt, headRefOid}` only.
- Detail tick: a single batched `nodes(ids:)` query fetches the full row only for PRs whose `updatedAt` or `headRefOid` changed since last cycle.
- The header shows `last poll Ns ago / next in Ns` plus your rate-limit budget so you can see the dashboard is alive.

## Dev

```
npm run dev         # run via tsx
npm run test        # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run verify      # all three
```
