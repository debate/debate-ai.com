# D1 read replication

`debate-ai-db` runs its primary instance in WNAM. With read replication turned
on, D1 also keeps a replica in every supported region (ENAM, WNAM, WEUR, EEUR,
APAC, OC) and answers reads from the one nearest the request. The saving is
network round trips — a read from Europe stops crossing an ocean twice — not
query time.

The catch is that a replica can lag the primary. Left alone, that means a user
can write a row and then not see it on the next page load. The Sessions API is
the fix: every query in a session carries a *bookmark*, and D1 refuses to serve
that session a database version older than anything it has already seen. Reads
stay fast and stay sequentially consistent.

## What is wired up

`apps/debate-ai.com/lib/database/d1-session.ts` owns this. Per request:

1. The Worker entry opens a session scope, seeded with the bookmark the client
   returned from its previous request (the `x-d1-bookmark` header for API
   clients, the `d1_bookmark` cookie for browser navigations).
2. The `debate_db` binding is wrapped by `sessionedD1()`, so every statement
   drizzle prepares runs inside that one session.
3. The session's closing bookmark goes back on the response, so the client's
   next request resumes from at least this version.

Where a session starts, when the client has no bookmark to resume from:

| Request | Starts on | Why |
| --- | --- | --- |
| `/api/auth/*` | the primary (`first-primary`) | a sign-in writes on one request and reads back on the next — see below |
| `GET` / `HEAD` | any replica (`first-unconstrained`) | lowest latency; nothing has been written to miss |
| everything else | the primary (`first-primary`) | a handler that writes and reads back must not miss its own write |
| cron / background | the primary (`first-primary`) | no client bookmark exists, and these jobs write |

Requests that never touch D1 never open a session, which is what keeps the
bookmark cookie off static and otherwise cacheable responses.

### Why auth ignores the bookmark

Everything else in this table describes what happens when the client has no
bookmark. `/api/auth/*` is different: it starts on the primary *whatever* the
client sent, and whatever `D1_SESSION_MODE` says short of `off`.

A sign-in is a read-after-write that spans two requests, and the second one is
handed to us by somebody else. `POST /api/auth/sign-in/social` writes the OAuth
`state` row (magic links write their token the same way) and sends the browser
to the provider; the provider then returns it to
`GET /api/auth/callback/google`, which has to find that exact row. A callback
answered by a replica that has not caught up finds nothing, and better-auth
reports a missing state row as a CSRF failure — the dead-end
"Something went wrong / CODE: `state_mismatch`" page, instead of a signed-in
user.

The bookmark would normally carry that consistency across the redirect, but it
travels as a cookie and the callback is a cross-site navigation: a cleared
cookie jar, an embedded webview, or a bookmark D1 later refuses (which restarts
a replayable GET on `first-unconstrained`) all quietly downgrade the lookup to
the nearest replica. Auth is a handful of requests per session, so one round
trip to the primary is a cheap price for a sign-in that cannot fail this way.

## Turning replication on

Read replication is a property of the database, not of the Worker, so
wrangler.jsonc cannot carry it. Either:

- Cloudflare dashboard → D1 → `debate-ai-db` → Settings → Enable Read Replication, or
- `apps/debate-ai.com/scripts/d1-read-replication.sh enable`, with `CLOUDFLARE_ACCOUNT_ID`
  and a `CLOUDFLARE_API_TOKEN` holding `D1:Edit`.

`apps/debate-ai.com/scripts/d1-read-replication.sh status` prints the database's current
`read_replication.mode` (`auto` = on, `disabled` = off).

The two halves are independent and can be done in either order: the Sessions
API is a no-op on a database with replication off, and disabling replication
later leaves this code working (replicas take up to 24 hours to stop serving).

## Knobs

Both are plain Worker Variables, so they can be changed in the dashboard
without a redeploy.

- `D1_SESSION_MODE` — `auto` (default), `primary` (always start on the primary),
  `unconstrained` (always start anywhere), or `off` (bypass the Sessions API
  entirely; the rollback switch). `unconstrained` does not apply to
  `/api/auth/*`, which stays on the primary; `off` bypasses sessions, which
  routes those queries to the primary anyway.
- `D1_SESSION_DEBUG` — when set, responses carry `x-d1-served-by-region` and
  `x-d1-served-by-primary` from the last query's `meta`, so you can see which
  instance actually answered. These fields are `undefined` under
  `wrangler dev`; they only appear for remote D1 requests.

## See also

[When a sign-in fails on the way back](./sign-in-failures.md) — what a stale
replica read used to do to the OAuth callback, and the rest of the
`state_mismatch` story.
