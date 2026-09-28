# debate-tournaments

Tournament invitations, pairings, results and judge paradigms — upstream
[Tabroom](https://github.com/debate/debate-tournament-tabroom) (the
speechanddebate/Tabroom v4 rewrite) vendored into this monorepo and adapted to
run on **Cloudflare Workers + D1**. The package exports three things:

| Import | What |
|---|---|
| `debate-tournaments/server` | `createTournamentsHandler()` — upstream's public `/rest` and `/pages` API as a fetch handler on D1 |
| `debate-tournaments` / `debate-tournaments/ui` | `TournamentsApp` and the individual React pages (upcoming, invite, pairings, round, results, result set) |
| `debate-tournaments/routes` | `matchTournamentRoute()` / `tournamentHrefs()` — the UI's route table |
| `debate-tournaments/migrations/*` | the D1 schema (110 upstream tables) |

In `apps/debate-ai.com` the API is mounted at `/api/tabroom/*`
(`app/api/tabroom/[...path]/route.ts`, `lib/tournaments/handler.ts`) and the UI
at `/tournaments/*` (`app/tournaments/[[...slug]]/page.tsx`). The schema is
applied by `scripts/migrate-d1.ts`, which picks up this package's
`migrations/` after the app's own.

```ts
import { createTournamentsHandler } from "debate-tournaments/server"

const handler = createTournamentsHandler({
  basePath: "/api/tabroom",
  getDb: () => env.debate_db,                  // any D1 binding
  getUser: async (req) => ({ email: "…" }),    // optional: the signed-in host user
})
```

```tsx
import { TournamentsApp } from "debate-tournaments"

<TournamentsApp segments={slug} basePath="/tournaments" apiBase="/api/tabroom" Link={Link} />
```

## Demo data

`seed/demo.sql` fills D1 with dummy tournaments: one running now with
published LD/PF pairings and results, two upcoming invites, and a hidden one.
Dates are relative to load time, and every id is ≥ 90000 with `INSERT OR
REPLACE`, so re-running it refreshes the data without colliding with real
rows. From `apps/debate-ai.com`:

```bash
bun run db:seed:tournaments      # migrate + seed the local D1
bun run db:seed:tournaments:d1   # migrate + seed the remote D1
```

Signing in with better-auth as `demo.judge@debate-ai.com` maps onto demo
Tabroom person 90001. `test/demo-seed.test.ts` checks every UI endpoint
against this seed.

## Taking upstream changes

Upstream stays the source of truth; this package only *adds* modifications on
top, so new upstream commits can be pulled in and the modifications re-applied:

```bash
cd packages/debate-tournaments
node scripts/sync-upstream.mjs --latest   # clone/fetch upstream, move the pin to main's head
bun run test                              # vendored routes on D1-compatible SQLite
node scripts/sync-upstream.mjs --seed && bun run test   # + every route on upstream's sample DB
```

`scripts/sync-upstream.mjs`:

1. `git clone`s upstream into `.upstream/` (git-ignored) and checks out the
   commit pinned in `upstream.json` (or `--latest` / `--ref <sha>`; `--source
   <path>` uses a local clone).
2. Applies `patches/*.patch` with `git apply --3way` — small line fixes to
   upstream files. If upstream touched the same lines, the conflict is left in
   `.upstream/`; resolve it and run `--save-patch`, then sync again.
3. Layers `overlays/` — whole-file replacements for the modules that cannot
   run on Workers.
4. Walks the import graph from `upstream.json`'s `entries` and copies exactly
   the reachable files into `vendor/tabroom/` (new upstream files come along
   automatically; a new npm dependency is reported).
5. Regenerates `migrations/0001_tabroom_schema.sql` and
   `src/db/generated/columns.ts` from upstream's schema dump
   (`indexcards/tests/test.sql`) with `scripts/lib/mysql-to-sqlite.mjs`.

**Never edit `vendor/`, `migrations/` or `src/db/generated/` by hand** — the
next sync overwrites them. To change upstream code, edit it in `.upstream/`
and run `node scripts/sync-upstream.mjs --save-patch`.

A changed migration file is *not* re-applied to a database that already ran
it (`migrate-d1.ts` records applied names). When an upstream schema change
lands, add the difference as a new `migrations/0002_….sql`.

## How upstream runs on Workers

| Upstream (Node + MariaDB) | Here |
|---|---|
| Express app + `express` routers | `router` (Express's own router) driven by a fetch adapter — `src/api/express-adapter.ts`; `express` imports resolve to `overlays/…/_shims/express.ts` |
| Kysely on a MariaDB pool (`api/data/database.ts`) | Kysely with a D1 dialect (`src/db/d1-dialect.ts`), resolved per request (`src/db/runtime.ts`) |
| Sequelize raw queries (`api/data/db.js`) | a Sequelize-shaped shim over D1 (`src/db/sequelize-shim.ts`) |
| MySQL SQL | translated per statement (`src/db/mysql-compat.ts`): `NOW()`, `DATE_SUB`, `CONVERT_TZ`, `CONCAT`, `GROUP_CONCAT … SEPARATOR`, `JSON_OBJECTAGG`, `IF()`, `WEEK()`, `RAND()`, `"string"` literals |
| DATETIME → `Date`, TINYINT(1) → boolean (mariadb `typeCast`) | restored on D1 rows (`src/db/values.ts`) |
| `config.json` from disk, winston | `src/config.ts` (`configureTabroom()`), a `console` logger |
| Tabroom sessions/cookies | the host app's signed-in user, matched to a Tabroom `person` by email (`src/api/actor.ts`) |

Scope: the read-only public API — `/rest/tourns/**` (list, tournament, invite,
files, schedule, rounds, results, events, entry records), `/rest/circuits`,
`/rest/paradigms` (login required), `/rest/pages`, `/rest/ads`,
`/rest/students`, `/rest/quizzes`, and `/pages/invite/**`. Writes answer 405;
upstream's tab-room (tournament administration), auth and admin routers are
not vendored — add them to `entries` in `upstream.json` when they are needed.
The UI is a React port of upstream's Svelte invite/pairings/results pages
(upstream's Svelte UI cannot mount in this React app), so upstream UI changes
are ported by hand.

The `session` table is skipped: it would collide with better-auth's table in
`debate_db`. Set a separate `tabroom_db` D1 binding to keep Tabroom's tables
in their own database; `lib/tournaments/handler.ts` prefers it when present.

## License

Upstream Tabroom is © the National Speech & Debate Association under the
RPL-1.5 (see `vendor/tabroom/LICENSE.md`); this package is distributed under
the same terms.

## Tests

```bash
bun run test        # or: npx vitest run
```

`test/api.test.ts` runs the vendored routes against the generated schema on
Node's SQLite through a D1-shaped adapter (`test/helpers/sqlite-d1.ts`), with a
small fixture tournament; `test/upstream-sample.test.ts` runs every public
route against upstream's full sample database when `.upstream-seed.sql` exists.
