# CLAUDE.md — `debate-predictions`

Private. Play-money prediction markets on debates, tournament winners and
team rating moves. Entry `src/index.ts` (engine, rules, types), browser
calls at `debate-predictions/client`, tests in `test/`. User and engineering
doc: `packages/debate-help-docs/content/docs/features/prediction-markets.mdx`.

## What lives where

- **Here**: pure code only. `lmsr.ts` (pricing), `settle.ts` (payouts and
  the settlement rules for hosted Tabroom rounds/events and rating markets),
  `validation.ts` (request parsing, `canResolveMarket`), `format.ts`,
  `presets.ts` (the site's own markets: each division's top five and the
  season's `MAJOR_TOURNAMENTS` calendar),
  `types.ts`, `client.ts`, and `migrations/` (the D1 tables).
- **`apps/debate-ai.com`**: `app/api/predictions/**` (routes) and
  `lib/predictions/` (queries, the rankings lookup, `presets.ts` which
  opens the missing preset markets on board reads). Raw SQL over the
  `debate-tournaments` Tabroom tables lives there too.
- **`debate-webview`**: `components/predictions/` and
  `routes/predictions/page.tsx` (`/practice/predictions`).

## Things that bite

- **Points are play money.** No purchase, no cash-out, no transfer between
  accounts. Keep it that way: anything that lets points leave the site turns
  this into gambling.
- **The tables are declared twice**: in the app's `schema.ts` (for drizzle)
  and in `migrations/` (because the app's `drizzle/` is untracked, a package
  migration is how the tables reach D1 from CI). Change both;
  `apps/debate-ai.com/lib/predictions/__tests__/queries.test.ts` fails when
  they drift. Never edit an applied migration; add `0002_…`.
- **Every write is guarded** because D1 has no interactive transactions: the
  wallet debit (`balance >= stake`), the market's `version`, and the
  settlement claim (`status = 'open'`). Don't replace them with
  read-then-write.
- **Ratings are on the site scale** (`debate-rankings-adapter`'s offset and
  divisor), both when a rating market records its baseline and when it
  settles. Mixing in raw upstream ratings would settle every market wrong.
- **Preset market ids are the dedupe key.** `planPresetMarkets` is pure and
  the app inserts only ids that don't exist, so changing an id format
  reopens every preset. The tournament calendar is per season: replace
  `MAJOR_TOURNAMENTS` when the next one is announced.
