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

In `apps/debate-ai.com` the D1 API is mounted at `/api/tabroom/*`
(`app/api/tabroom/[...path]/route.ts`, `lib/tournaments/handler.ts`). The UI is
mounted at `/practice/tournaments/*` with two sources (`apiBase` and
`liveApiBase`): live Tabroom through `/api/tabroom-beta/*`, a read-only proxy to
`https://api.tabroom.com/v1` (`lib/tournaments/tabroom-beta-proxy.ts`), and the
tournaments hosted on this site through `/api/tabroom`. The list merges both and
each tournament reads from whichever holds it. `/practice/tabroom` frames
beta.tabroom.com itself.

Hosting never touches Tabroom. `/host` (`src/host/router.ts`) is this package's
hosting API: `POST /host/tourns` creates a tournament, `GET /host/tourns` lists
the signed-in user's, `GET /host/tourns/:id/admin` is a hosted tournament's
admin view (`src/host/admin.ts`, rendered by `TournamentAdminPage`), and
`POST /host/demo` loads the demo below if it is missing or over. The schema is applied by `.github/scripts/migrate-d1.ts`,
which picks up this package's `migrations/` after the app's own, into the same
`debate_db` the app uses. Its statements are all `IF NOT EXISTS`, so a name
clash would be silent; `apps/debate-ai.com/lib/tournaments/__tests__/tabroom-schema.test.ts`
proves no Tabroom table or index shares a name with the app's or the
prediction markets' (`session` is skipped for that reason).

A hosted tournament can run any debate format in `src/host/formats.ts`:
Policy, LD, Public Forum, Parliamentary, British Parliamentary, World Schools,
Asian Parliamentary, Big Questions, IPDA and Congress. Each event is written
with upstream's own `event.type` (`debate`, `wudc`, `wsdc`, `congress`, typed
from the vendored `EventSchema`) and the `min_entry` / `max_entry` and
`aff_label` / `neg_label` settings upstream's pairing and ballot code reads.

The pages are built from shadcn primitives copied into `src/ui/primitives.tsx`
and use only shadcn theme tokens, so they follow the host's theme.

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

<TournamentsApp segments={slug} basePath="/practice/tournaments" apiBase="/api/tabroom" Link={Link} />
```

## Demo data

`seed/demo.sql` fills D1 with one demo tournament, the Bay Area Invitational
(tourn 90001): four debate divisions (VCX, VLD, VPF, VPRL) and four speech
events (OO, IX, DI, INF), 40 entries each, with power-matched prelims, elim
brackets, speaker awards and posted result sets. It is generated: edit
`scripts/generate-demo-seed.mjs` and run `bun run seed:demo`, and bump
`DEMO_SEED_VERSION` in both the script and `src/host/demo.ts` so deployed
sites reload it. The file first deletes the rows of demo tournaments
90001-90004 (which also clears the older three-tournament demo), then writes
its own rows with `INSERT OR REPLACE` at ids from 9,000,001 up, which no hosted
row is given. Dates are relative to load time. From `apps/debate-ai.com`:

```bash
bun run db:seed:tournaments      # migrate + seed the local D1
bun run db:seed:tournaments:d1   # migrate + seed the remote D1
```

Signing in with better-auth as `demo.judge@debate-ai.com` maps onto demo
Tabroom person 90001. Person 90010, `demo.admin`, owns the Bay Area
Invitational (90001), whose admin view is open to everyone as that mock
account. The app also applies the seed itself through `POST /host/demo`
(`src/host/demo.ts`, which imports the file with `?raw`), so statements end
with `;` at the end of a line. `test/demo-seed.test.ts` checks every UI
endpoint against this seed and `test/demo-admin.test.ts` the admin view.

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
