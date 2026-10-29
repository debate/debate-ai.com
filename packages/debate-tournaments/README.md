# debate-tournaments

**Tournaments on debate-ai.com: find one, read its invitation, follow its
pairings and results, read judge paradigms, and host your own.**

This package is the [Tabroom](https://github.com/debate/debate-tournaments)
code that real speech and debate tournaments run on (the speechanddebate/Tabroom
v4 rewrite), brought into this monorepo and adapted to run on
**Cloudflare Workers + D1**. It gives the app three pieces: an API server, the
React pages, and the database schema.

- [Quick start](#quick-start)
- [What you can do](#what-you-can-do)
- [The demo tournament](#the-demo-tournament)
- [Using it in an app](#using-it-in-an-app)
- [Tests](#tests)
- [For maintainers](#for-maintainers)
- [License](#license)

## Quick start

Load the demo tournament into your local database, then start the site. From
`apps/debate-ai.com`:

```bash
bun run db:seed:tournaments      # migrate + seed the local D1
bun run dev                      # then open /tournaments on the dev server
```

Seeding the remote D1 instead is `bun run db:seed:tournaments:d1`. You can also
skip seeding: the site loads the demo by itself the first time it is needed
(the tournament list calls `POST /host/demo` when it is missing).

Where things show up on the site:

| Page | What it is |
|---|---|
| `/tournaments` | Upcoming tournaments, from live Tabroom and from this site, in one list |
| `/tournaments/2026/yale-invitational/results` | One tournament's pages, by start year and a slug of its name |
| `/tournaments/38436/results` | The same pages by Tabroom id (the address updates to the named form) |
| `/practice/tabroom` | beta.tabroom.com itself, in a frame |

## What you can do

### Browse real tournaments

The list mixes two sources and each tournament reads from whichever one holds
it:

- **Live Tabroom**, through `/api/tabroom-beta/*`, a read-only proxy to
  `https://api.tabroom.com/v1` (`packages/debate-webview/src/lib/tournaments/tabroom-beta-proxy.ts`).
- **Tournaments hosted on this site**, through `/api/tabroom/*`.

For each tournament there are pages for the upcoming list, the invitation,
pairings, a single round, results and a single result set.

**Info & links.** A dropdown beside each tournament's tabs carries its Tabroom
sidebar: Pages & Uploads, Circuits, Past Years' Editions, Dates & Deadlines,
Locations and Contacts, plus the pages every Tabroom tournament has (entries,
judges, pairings, live updates, results, events, schools, email archive).
Tabroom's API has no circuits, deadlines or past editions, so the proxy's
`/api/tabroom-beta/sidebar/:id` scrapes them from the classic invitation page
(`parseTabroomSidebar` in `src/sidebar.ts`, cached 10 minutes). Hosted
tournaments, and live ones whose page can't be read, build the menu from their
invite instead; empty groups are hidden.

**How addresses work.** A tournament's pages live at
`/tournaments/<year it starts>/<slug of its name>/…`. `client.resolve` turns
that pair into the Tabroom tourn id by looking, in order, at the tournaments it
has already seen, the upcoming list, and each source's `GET /rest/tourns` for
that year (hosted first). The id form still opens and is rewritten to the named
form once the name is known. The app's old `/practice/tournaments/*` URLs
redirect (308) to the new ones (`debate-search-evidence`'s
`routes/category-paths.ts`). If two tournaments in the same year have the same
name they share a slug, so only the first one seen gets the named URL; the
other keeps its id.

### Judge paradigms and voting records

Every judge in a round's pairings opens a dialog (`src/ui/JudgeProfileView.tsx`)
with their paradigm and voting record: rounds judged, Aff/Neg split, squirrels
(lone dissents on a panel) and each round's vote against the panel's.

- A **hosted** tournament's judges come from this package's own
  `/rest/paradigms/:personId` and `/rest/paradigms/:personId/record`
  (`client.hostedJudgeProfile`), as the signed-in viewer.
- A **live Tabroom** judge comes through the host's `lookupJudgeProfile`. On
  debate-ai.com that is `/api/judge-paradigms`, which caches each judge in D1
  and reads Tabroom with `fetchTabroomJudge` (`src/paradigms-server.ts`).

Tabroom serves paradigms only to signed-in users: the API's `paradigmsRouter`
answers 401, and the classic `index/paradigm.mhtml` redirects to its login.
`fetchTabroomJudge` therefore takes a session token (sent as the `TabroomToken`
cookie), tries `GET /v1/rest/paradigms/:id` and `/record` first, and falls back
to parsing the classic page (`parseClassicParadigmPage` in `src/paradigms.ts`,
written against `paradigm.mas` in speechanddebate/tabroom). Paradigm HTML is
run through `sanitizeParadigmHtml` before it is stored or shown.
`searchTabroomParadigms` pages through `GET /v1/rest/paradigms?search=`, which
the host's admin sync walks to cache every judge.

### Host your own tournament

Hosting happens entirely on this site and never touches Tabroom. The hosting
API is `/host` (`src/host/router.ts`):

| Request | Does |
|---|---|
| `POST /host/tourns` | Creates a tournament |
| `GET /host/tourns` | Lists the signed-in user's tournaments |
| `GET /host/tourns/:id/admin` | A hosted tournament's admin view (`src/host/admin.ts`, rendered by `TournamentAdminPage`) |
| `POST /host/demo` | Loads the demo tournament if it is missing or over |

**Formats.** A hosted tournament can run any debate format in
`src/host/formats.ts`: Policy, LD, Public Forum, Parliamentary, British
Parliamentary, World Schools, Asian Parliamentary, Big Questions, IPDA and
Congress. Each event is saved the way Tabroom itself would save it: upstream's
own `event.type` (`debate`, `wudc`, `wsdc`, `congress`, typed from the vendored
`EventSchema`) plus the `min_entry` / `max_entry` and `aff_label` /
`neg_label` settings that upstream's pairing and ballot code reads.

### Matches your theme

The pages are built from shadcn primitives copied into `src/ui/primitives.tsx`
and use only shadcn theme tokens, so they follow the host app's theme.

## The demo tournament

The **Debate AI Demo Invitational** (tourn 90001) is a full sample tournament
you can click through:

- four debate divisions (VCX, VLD, VPF, VPRL) and four speech events (OO, IX,
  DI, INF), with 40 entries each;
- power-matched prelims, elimination brackets, speaker awards and posted
  result sets;
- dates relative to when it was loaded, so it always looks current.

### Signing in as a demo user

| Sign in as | You are |
|---|---|
| `demo.judge@debate-ai.com` (better-auth) | Demo Tabroom person 90001, a judge |
| `demo.admin@debate-ai.com` | Person 90010, who owns the Demo Invitational |

The demo's admin view is open to everyone, as the `demo.admin` mock account.

### Editing the demo

Anyone can change the demo's mock data from its admin view
(`src/host/demo-edit.ts`, `src/ui/pages/DemoMockEditor.tsx`):

| Request | Does |
|---|---|
| `POST /host/demo/edit` | Changes one entry, judge, round, section (judges, winner) or result set; refuses any row that is not tournament 90001's |
| `GET /host/demo/rounds/:roundId/sections` | Reads a round's pairings to edit |
| `POST /host/demo/reset` | Re-applies the seed |

### Simulated live rounds

The demo's pairings also show rounds in progress, though nothing about them is
stored. `src/ui/live/demo-live.ts` works out each room's state (the speech
under way, its progress, a status feed, transcripts and summaries) from the
room's section id, its round id and the clock, at `DEMO_SPEED` (6×), looping
check-in → speeches → decision. Every viewer therefore sees the same moment.

`src/ui/live/LiveRoom.tsx` renders it as the **Live** column and stream panel
in `RoundPage`, a per-round badge in `RoundsPage`, and **Live now** in
`ResultsPage`. Read-aloud uses the browser's `speechSynthesis`. Only
`DEMO_TOURN_ID` gets this (`isLiveDemo`); real tournaments are unchanged.

### Changing the demo data

`seed/demo.sql` is generated, so don't edit it directly:

1. Edit `scripts/generate-demo-seed.mjs`.
2. Run `bun run seed:demo` (in this package).
3. Bump `DEMO_SEED_VERSION` in both the script and `src/host/demo.ts`, so
   deployed sites reload it.

How the file behaves: it first deletes the rows of demo tournaments 90001-90004
(which also clears the older three-tournament demo), then writes its own rows
with `INSERT OR REPLACE` at ids from 9,000,001 up, which no hosted row is
given. The app applies the seed itself through `POST /host/demo`
(`src/host/demo.ts` imports the file with `?raw`), so every statement must end
with `;` at the end of a line. `test/demo-seed.test.ts` checks every UI
endpoint against this seed, and `test/demo-admin.test.ts` checks the admin view.

## Using it in an app

The package is `@debate-ai/tournaments`. Its entry points:

| Import | What you get |
|---|---|
| `@debate-ai/tournaments/server` | `createTournamentsHandler()`: upstream's public `/rest` and `/pages` API, plus `/host`, as a fetch handler on D1 |
| `@debate-ai/tournaments` / `@debate-ai/tournaments/ui` | `TournamentsApp` and the individual React pages (upcoming, invite, pairings, round, results, result set) |
| `@debate-ai/tournaments/routes` | `matchTournamentRoute()` / `tournamentHrefs()`: the UI's route table |
| `@debate-ai/tournaments/migrations/*` | The D1 schema (108 upstream tables) |

The API server:

```ts
import { createTournamentsHandler } from "@debate-ai/tournaments/server"

const handler = createTournamentsHandler({
  basePath: "/api/tabroom",
  getDb: () => env.debate_db,                  // any D1 binding
  getUser: async (req) => ({ email: "…" }),    // optional: the signed-in host user
})
```

The pages:

```tsx
import { TournamentsApp } from "@debate-ai/tournaments"

<TournamentsApp segments={slug} basePath="/tournaments" apiBase="/api/tabroom" Link={Link} />
```

### How debate-ai.com wires it up

- **API:** mounted at `/api/tabroom/*` (`app/api/tabroom/[...path]/route.ts`,
  `lib/tournaments/handler.ts`).
- **Pages:** mounted at `/tournaments/*` with two sources, `apiBase`
  (`/api/tabroom`, hosted here) and `liveApiBase` (`/api/tabroom-beta`, live
  Tabroom).
- **Database:** the schema goes into the same `debate_db` the app uses, applied
  by `.github/scripts/migrate-d1.ts`, which runs this package's `migrations/`
  after the app's own. To keep Tabroom's tables in their own database instead,
  add a separate `tabroom_db` D1 binding; `lib/tournaments/handler.ts` prefers
  it when present.

## Tests

```bash
bun run test        # or: npx vitest run
```

- `test/api.test.ts` runs the vendored routes against the generated schema on
  Node's SQLite through a D1-shaped adapter (`test/helpers/sqlite-d1.ts`), with
  a small fixture tournament.
- `test/upstream-sample.test.ts` runs every public route against upstream's
  full sample database when `.upstream-seed.sql` exists.
- `test/demo-seed.test.ts` and `test/demo-admin.test.ts` cover the demo (see
  above).

---

## For maintainers

Everything below is about how the package is built and kept in sync with
upstream Tabroom. You don't need it to use the pages or the API.

### Ground rules

- **Upstream is the source of truth.** This package only *adds* modifications
  on top, so new upstream commits can be pulled in and the modifications
  re-applied.
- **Never edit `vendor/`, `migrations/` or `src/db/generated/` by hand.** The
  next sync overwrites them. To change upstream code, edit it in `.upstream/`
  and run `node scripts/sync-upstream.mjs --save-patch`.

### Taking upstream changes

```bash
cd packages/debate-tournaments
node scripts/sync-upstream.mjs --latest   # clone/fetch upstream, move the pin to main's head
bun run test                              # vendored routes on D1-compatible SQLite
node scripts/sync-upstream.mjs --seed && bun run test   # + every route on upstream's sample DB
```

What `scripts/sync-upstream.mjs` does:

1. Fetches upstream into the `packages/debate-tournaments-tabroom` git
   submodule (run `git submodule update --init packages/debate-tournaments-tabroom`
   first) and checks out the commit pinned in `upstream.json` (or `--latest` /
   `--ref <sha>`; `--source <path>` fetches from a local clone).
2. Applies `patches/*.patch` with `git apply --3way`: small line fixes to
   upstream files. If upstream touched the same lines, the conflict is left in
   the submodule; resolve it and run `--save-patch`, then sync again.
3. Layers `overlays/`: whole-file replacements for the modules that cannot
   run on Workers.
4. Walks the import graph from `upstream.json`'s `entries` and copies exactly
   the reachable files into `vendor/tabroom-build/` (new upstream files come
   along automatically; a new npm dependency is reported).
5. Regenerates `migrations/0001_tabroom_schema.sql` and
   `src/db/generated/columns.ts` from upstream's schema dump
   (`indexcards/tests/test.sql`) with `scripts/lib/mysql-to-sqlite.mjs`,
   corrected by `scripts/lib/schema-rules.mjs`: redundant indexes dropped,
   lossy types widened (`person.phone`, `chapter.zip` are TEXT), CHECKs on
   flag columns, verified reference columns' `DEFAULT 0` sentinels made
   nullable. Which columns are references is never guessed from names: it is
   the explicit registry in `scripts/lib/relationships.mjs`, with the evidence
   for each (an upstream foreign key, or sample rows that resolve), and the
   sync warns about any new column that looks like one but is not listed. It
   also regenerates `packages/dev-docs/tabroom-schema.md`
   (`scripts/lib/schema-doc.mjs`), and `--seed` nulls the sentinels,
   credentials and personal contact details in the sample data.

**The submodule vs `vendor/tabroom-build/`.** `packages/debate-tournaments-tabroom`
is a git submodule of upstream ([debate/debate-tournaments](https://github.com/debate/debate-tournaments)),
which `sync-upstream.mjs` patches in place. Upstream's files import `express` and
`@tabroom/types` and pull in Node-only modules, so the app imports
`vendor/tabroom-build/`: the generated copy of just the reachable files, with
those imports rewritten to the in-package shims. Commit both the submodule pin
and `vendor/tabroom-build/` after a sync.

**Tournament admin.** Besides the public `/rest` and `/pages` trees, the handler
mounts upstream's tournament-admin routers at
`/tab/tourns/:tournId/{categories,schools,sites,timeslots}` (GET only, owners and
admins of that tournament only, via upstream's `requireAccess`). The admin page
reads timeslots and judge categories from there.

### Schema changes and upgrades

A changed migration file is *not* re-applied to a database that already ran it
(`migrate-d1.ts` records applied names). So when a sync changes 0001 it also
writes the next-numbered `migrations/NNNN_tabroom_schema_upgrade.sql`
(`scripts/lib/schema-upgrade.mjs`), which rebuilds each changed table, keeping
its rows, and drops or creates indexes. Commit it with the new 0001. It never
drops a table the new schema skips.

**Skipped tables.** `session` is skipped because it would collide with
better-auth's table in `debate_db`. `server` and `campus_log` are skipped
because nothing here reads them.

**Name clashes.** The migration statements are all `IF NOT EXISTS`, so a name
clash with the app's tables would be silent.
`apps/debate-ai.com/lib/tournaments/__tests__/tabroom-schema.test.ts` proves no
Tabroom table or index shares a name with the app's or the prediction
markets'.

### Data integrity audit

The schema declares no foreign keys, because upstream data has orphan rows.
Instead, from `apps/debate-ai.com`, run `bun run db:check:tournaments` (local)
or `bun run db:check:tournaments:d1` (remote) to audit (`src/db/audit.ts`) for:

- orphan ids;
- rows whose `tourn` differs from a parent's (an entry pointing at another
  tournament's event or school);
- duplicate set memberships (`jpool_judge`, `rpool_room`, …);
- duplicates a unique index admits through a NULL column
  (`judge_setting.conditional`).

### Private fields

Credentials and personal contact details (`SENSITIVE` in `schema-rules.mjs`)
are outside each table's public field allowlist (`PUBLIC_COLUMNS` in
`src/db/generated/columns.ts`). The API handler strips them from every JSON
response (`src/api/public-fields.ts`).

### How upstream runs on Workers

| Upstream (Node + MariaDB) | Here |
|---|---|
| Express app + `express` routers | `router` (Express's own router) driven by a fetch adapter: `src/api/express-adapter.ts`; `express` imports resolve to `overlays/…/_shims/express.ts` |
| Kysely on a MariaDB pool (`api/data/database.ts`) | Kysely with a D1 dialect (`src/db/d1-dialect.ts`), resolved per request (`src/db/runtime.ts`) |
| Sequelize raw queries (`api/data/db.js`) | A Sequelize-shaped shim over D1 (`src/db/sequelize-shim.ts`) |
| MySQL SQL | Translated per statement (`src/db/mysql-compat.ts`): `NOW()`, `DATE_SUB`, `CONVERT_TZ`, `CONCAT`, `GROUP_CONCAT … SEPARATOR`, `JSON_OBJECTAGG`, `IF()`, `WEEK()`, `RAND()`, `"string"` literals |
| DATETIME → `Date`, TINYINT(1) → boolean (mariadb `typeCast`) | Restored on D1 rows (`src/db/values.ts`) |
| `config.json` from disk, winston | `src/config.ts` (`configureTabroom()`), a `console` logger |
| Tabroom sessions/cookies | The host app's signed-in user, matched to a Tabroom `person` by email (`src/api/actor.ts`) |

### What is and isn't vendored

The vendored API is the read-only public API: `/rest/tourns/**` (list,
tournament, invite, files, schedule, rounds, results, events, entry records),
`/rest/circuits`, `/rest/paradigms` (login required), `/rest/pages`,
`/rest/ads`, `/rest/students`, `/rest/quizzes`, and `/pages/invite/**`. Writes
answer 405. Upstream's tab-room (tournament administration), auth and admin
routers are not vendored; add them to `entries` in `upstream.json` when they
are needed.

The UI is a React port of upstream's Svelte invite/pairings/results pages
(upstream's Svelte UI cannot mount in this React app), so upstream UI changes
are ported by hand.

## License

Upstream Tabroom is © the National Speech & Debate Association under the
RPL-1.5 (see `vendor/tabroom-build/LICENSE.md`); this package is distributed
under the same terms.
