/**
 * D1 read replication via the Sessions API.
 *
 * With read replication enabled, D1 answers reads from a replica in the region
 * nearest the request instead of from the single primary instance in WNAM —
 * the win is round trips, not query time. A replica can lag the primary,
 * though, so reads have to be pinned to a database version or a user can write
 * a row and then not see it. That is what a *session* is for: every query in a
 * session carries a bookmark, and D1 only lets the session read a version at
 * least as new as everything it has already seen (sequential consistency), no
 * matter which replica answers.
 *
 * The lifecycle of one request:
 *
 *   1. The Worker entry opens a session scope (`runWithD1Session`), seeded
 *      with the bookmark the client returned from its previous request.
 *   2. `sessionedD1()` wraps the raw `debate_db` binding so every statement
 *      drizzle prepares runs inside that request's single session.
 *   3. The Worker entry writes the session's closing bookmark back onto the
 *      response (`applyD1Bookmark`), so the next request picks up where this
 *      one left off.
 *
 * Requests that never touch D1 never open a session, and outside a session
 * scope (prerendering, scripts, unit tests) the wrapper is a pass-through to
 * the plain binding. The Sessions API is also a no-op on databases with read
 * replication turned off, so this is safe to deploy before — and independently
 * of — flipping the switch in the D1 dashboard.
 *
 * @see https://developers.cloudflare.com/d1/best-practices/read-replication/
 */

import { AsyncLocalStorage } from "node:async_hooks";

/** Header an API client can use to carry a bookmark across requests. */
export const D1_BOOKMARK_HEADER = "x-d1-bookmark";

/** Cookie used to carry a bookmark across browser navigations. */
export const D1_BOOKMARK_COOKIE = "d1_bookmark";

/**
 * How long a returned bookmark stays useful. A bookmark only pins a *floor* on
 * the database version, so letting one expire costs a consistency guarantee,
 * never correctness — 15 minutes comfortably covers a browsing session while
 * keeping a long-idle tab from pinning its reads to an ancient version.
 */
const BOOKMARK_MAX_AGE_SECONDS = 900;

/**
 * Bookmarks are opaque strings minted by D1 (`<hex>-<hex>-<hex>-<hex>`), but
 * they reach us from a client-controlled cookie or header, so anything not
 * shaped like one is dropped rather than handed to the binding.
 */
const BOOKMARK_PATTERN = /^[0-9a-zA-Z_-]{1,255}$/;

/** Start the session anywhere — the first query may be served by any replica. */
export const FIRST_UNCONSTRAINED = "first-unconstrained";

/** Start the session on the primary — the first query sees the latest version. */
export const FIRST_PRIMARY = "first-primary";

/**
 * `D1_SESSION_MODE` (a plain Worker variable, so it can be changed in the
 * dashboard without a redeploy) overrides the per-request choice below:
 *
 *   auto (default)  bookmark if the client has one, else the primary for
 *                   writes and any replica for reads
 *   primary         always start on the primary — replicas still serve, but
 *                   only from the latest version
 *   unconstrained   always start anywhere — lowest latency, weakest freshness
 *   off             bypass the Sessions API entirely (rollback switch)
 */
export type D1SessionMode = "auto" | "primary" | "unconstrained" | "off";

/**
 * The slice of the D1 surface this module touches, declared structurally so
 * the module does not depend on which `@cloudflare/workers-types` happen to be
 * in scope. `sessionedD1()` preserves its argument's real type for callers.
 */
interface D1Meta {
  served_by_region?: string;
  served_by_primary?: boolean;
}

interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first(colName?: string): Promise<unknown>;
  run(): Promise<{ meta?: D1Meta }>;
  all(): Promise<{ meta?: D1Meta }>;
  raw(options?: unknown): Promise<unknown>;
}

interface D1SessionLike {
  prepare(query: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<{ meta?: D1Meta }[]>;
  getBookmark(): string | null;
}

interface D1DatabaseLike {
  prepare(query: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<{ meta?: D1Meta }[]>;
  withSession?(constraintOrBookmark?: string): D1SessionLike;
}

/**
 * Back-reference from a tracked statement to the real D1 statement. `batch()`
 * is handed the statements `prepare()` returned, and the runtime only accepts
 * its own objects there, so they are unwrapped on the way through.
 */
const NATIVE_STATEMENT = Symbol("d1.nativeStatement");

/**
 * How to build the same statement again — same SQL, same bindings — against a
 * different session. A statement belongs to the session that prepared it, so
 * abandoning a session (see {@link dropClientBookmark}) means re-preparing
 * every statement that was about to run on it.
 */
const REBUILD_STATEMENT = Symbol("d1.rebuildStatement");

type StatementFactory = (target: D1DatabaseLike | D1SessionLike) => D1StatementLike;

interface TrackedStatement extends D1StatementLike {
  [NATIVE_STATEMENT]: D1StatementLike;
  [REBUILD_STATEMENT]: StatementFactory;
}

interface D1SessionScope {
  /** Bookmark or constraint this request's sessions start from. */
  start: string;
  /**
   * Where to start over if `start` turns out to be unusable — the constraint
   * this request would have used had the client sent no bookmark at all.
   */
  fallback: string;
  /** `start` is a client-supplied bookmark rather than a constraint we chose. */
  resumed: boolean;
  /**
   * The request is safe to replay (GET/HEAD), so a failed statement can be
   * retried on a fresh session without risking a half-applied write.
   */
  replayable: boolean;
  /** Sessions API disabled for this request (`D1_SESSION_MODE=off`). */
  bypass: boolean;
  /** Created on first use and keyed by binding, so one scope can span bindings. */
  sessions: Map<D1DatabaseLike, D1SessionLike>;
  /** `meta` of the most recent query, for the replica-routing debug headers. */
  lastMeta?: D1Meta;
  /** The client's bookmark was abandoned, so the response must not keep it. */
  bookmarkDropped?: boolean;
}

const scopeStorage = new AsyncLocalStorage<D1SessionScope>();

/**
 * A cookie value, percent-decoded, or null when it is not a usable bookmark.
 *
 * `decodeURIComponent` *throws* on a malformed escape — a bare `%`, `%zz`, a
 * value some other software truncated mid-escape — and this runs in the Worker
 * entry, before any route handler and outside every try/catch there is. An
 * unguarded decode therefore turns one unparseable cookie into a thrown
 * exception on *every* request that browser makes, D1-backed or not
 * (`/api/auth/providers` reads no database and 500s all the same), and the
 * browser keeps re-sending the cookie, so the site stays down for that browser
 * until it ages out. A value that will not decode is simply not a bookmark, so
 * it is dropped exactly like one that decodes but is the wrong shape.
 */
function decodeClientBookmark(raw: string): string | null {
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return BOOKMARK_PATTERN.test(value) ? value : null;
}

/** A bookmark from the untrusted client, or null if missing or malformed. */
function readClientBookmark(request: Request): string | null {
  const header = request.headers.get(D1_BOOKMARK_HEADER);
  if (header && BOOKMARK_PATTERN.test(header)) return header;

  const cookies = request.headers.get("cookie");
  if (!cookies) return null;
  for (const pair of cookies.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() !== D1_BOOKMARK_COOKIE) continue;
    return decodeClientBookmark(pair.slice(eq + 1).trim());
  }
  return null;
}

/**
 * Where this request's session should start, and where to start over if that
 * turns out not to work. A bookmark always wins: it is both the fastest option
 * (any replica that has caught up can answer it) and the strictest one (never
 * older than what this client already saw). Without one, mutations start on
 * the primary so a handler that writes and then reads back cannot miss its own
 * write, and plain reads start anywhere.
 */
function resolveStartpoint(
  request: Request,
  mode: D1SessionMode,
): { start: string; fallback: string; resumed: boolean; replayable: boolean } {
  const method = request.method.toUpperCase();
  const replayable = method === "GET" || method === "HEAD";
  const fallback =
    mode === "primary" || !replayable ? FIRST_PRIMARY : FIRST_UNCONSTRAINED;

  if (mode === "primary") return { start: FIRST_PRIMARY, fallback, resumed: false, replayable };
  if (mode === "unconstrained") {
    return { start: FIRST_UNCONSTRAINED, fallback, resumed: false, replayable };
  }

  const bookmark = readClientBookmark(request);
  if (bookmark) return { start: bookmark, fallback, resumed: true, replayable };

  return { start: fallback, fallback, resumed: false, replayable };
}

function normalizeMode(raw: unknown): D1SessionMode {
  return raw === "primary" || raw === "unconstrained" || raw === "off" ? raw : "auto";
}

/**
 * Open a D1 session scope for the duration of `fn`. Everything the request
 * does through `sessionedD1()` — in any handler, on any binding — shares one
 * session and therefore one consistent view of the database.
 */
export function runWithD1Session<T>(request: Request, mode: unknown, fn: () => T): T {
  const resolved = normalizeMode(mode);
  const { start, fallback, resumed, replayable } = resolveStartpoint(request, resolved);
  return scopeStorage.run(
    { start, fallback, resumed, replayable, bypass: resolved === "off", sessions: new Map() },
    fn,
  );
}

/**
 * Open a session scope outside of a request — cron handlers, which have no
 * client bookmark to resume from and generally write.
 */
export function runWithPrimaryD1Session<T>(fn: () => T): T {
  return scopeStorage.run(
    {
      start: FIRST_PRIMARY,
      fallback: FIRST_PRIMARY,
      resumed: false,
      replayable: false,
      bypass: false,
      sessions: new Map(),
    },
    fn,
  );
}

function currentTarget(binding: D1DatabaseLike): D1DatabaseLike | D1SessionLike {
  const scope = scopeStorage.getStore();
  if (!scope || scope.bypass || typeof binding.withSession !== "function") return binding;

  let session = scope.sessions.get(binding);
  if (!session) {
    session = binding.withSession(scope.start);
    scope.sessions.set(binding, session);
  }
  return session;
}

function record(scope: D1SessionScope | undefined, meta: D1Meta | undefined) {
  if (scope && meta) scope.lastMeta = meta;
}

/** Errors in which D1 names the session or the bookmark as the problem. */
const BOOKMARK_ERROR_PATTERN = /bookmark|session/i;

/**
 * D1 refuses a bookmark it cannot honour — one minted before a restore, one
 * from another database, one older than the service keeps — and it refuses it
 * at *query* time, because `withSession()` itself does no I/O. The bookmark
 * arrives in a cookie the client keeps re-sending, so without this an
 * unusable bookmark takes down every D1-backed route for that browser until
 * the cookie ages out: `/api/settings`, `/api/topic-starters` and
 * `/api/auth/get-session` all 500 at once while the database itself is
 * perfectly healthy.
 *
 * A bookmark is only ever a consistency *floor*, so continuing without one
 * costs nothing but the guarantee it bought. The session is therefore
 * abandoned and restarted from the constraint the request would have used had
 * the client sent no bookmark at all, and the caller replays the statement
 * there.
 *
 * Returns whether the caller should replay what it was doing on the new
 * session.
 */
function dropClientBookmark(scope: D1SessionScope | undefined, error: unknown): boolean {
  if (!scope || scope.bypass || !scope.resumed || scope.bookmarkDropped) return false;
  // A replayable (GET/HEAD) request can retry whatever the error was — the
  // worst case is one wasted round trip that fails the same way. Anything that
  // may have written is retried only when D1 names the session or the
  // bookmark, so a statement that got through is never applied twice.
  if (!scope.replayable && !BOOKMARK_ERROR_PATTERN.test(String((error as Error)?.message ?? error))) {
    return false;
  }

  console.warn("D1 session: discarding the client's bookmark and retrying without it:", error);
  scope.bookmarkDropped = true;
  scope.resumed = false;
  scope.start = scope.fallback;
  scope.sessions.clear();
  return true;
}

/**
 * Re-expose a prepared statement so the `meta` D1 attaches to every remote
 * query — including the region that served it — reaches `getD1ReplicaInfo()`.
 * `bind()` returns a fresh statement, so the result is re-wrapped.
 *
 * `rebuild` reproduces the statement against another session, which is what
 * lets a query that failed on a bad bookmark run again on a clean session
 * (see {@link dropClientBookmark}) instead of surfacing as a 500.
 */
function trackStatement(
  raw: D1DatabaseLike,
  scope: D1SessionScope | undefined,
  statement: D1StatementLike,
  rebuild: StatementFactory,
): TrackedStatement {
  const attempt = async <T>(op: (target: D1StatementLike) => Promise<T>): Promise<T> => {
    try {
      return await op(statement);
    } catch (error) {
      if (!dropClientBookmark(scope, error)) throw error;
      return op(rebuild(currentTarget(raw)));
    }
  };

  return {
    [NATIVE_STATEMENT]: statement,
    [REBUILD_STATEMENT]: rebuild,
    bind: (...values: unknown[]) =>
      trackStatement(raw, scope, statement.bind(...values), (target) => rebuild(target).bind(...values)),
    first: (colName?: string) => attempt((s) => s.first(colName)),
    raw: (options?: unknown) => attempt((s) => s.raw(options)),
    run: () =>
      attempt(async (s) => {
        const result = await s.run();
        record(scope, result?.meta);
        return result;
      }),
    all: () =>
      attempt(async (s) => {
        const result = await s.all();
        record(scope, result?.meta);
        return result;
      }),
  };
}

function unwrapStatement(statement: D1StatementLike): D1StatementLike {
  return (statement as TrackedStatement)[NATIVE_STATEMENT] ?? statement;
}

/** The same statement prepared against `target`, for a retry on a new session. */
function rebuildStatement(statement: D1StatementLike, target: D1DatabaseLike | D1SessionLike): D1StatementLike {
  const rebuild = (statement as TrackedStatement)[REBUILD_STATEMENT];
  return rebuild ? rebuild(target) : unwrapStatement(statement);
}

/**
 * Wrap a D1 binding so its queries run inside the current request's session.
 *
 * The wrapper is stable — it resolves the session per *call*, not once at
 * construction — so a driver built over it and cached at module scope
 * (drizzle, for instance) keeps working while each request still gets its own
 * session. Methods this module does not intercept (`dump`, `exec`,
 * `withSession`) fall through to the binding. Returns the binding's own type,
 * so call sites need no cast.
 */
export function sessionedD1<T>(binding: T): T {
  const raw = binding as unknown as D1DatabaseLike;

  const overrides: D1DatabaseLike = {
    prepare(query: string) {
      const scope = scopeStorage.getStore();
      const build: StatementFactory = (target) => target.prepare(query);
      return trackStatement(raw, scope, build(currentTarget(raw)), build);
    },
    async batch(statements: D1StatementLike[]) {
      const scope = scopeStorage.getStore();
      const run = async (target: D1DatabaseLike | D1SessionLike, prepared: D1StatementLike[]) => {
        const results = await target.batch(prepared);
        record(scope, results?.[results.length - 1]?.meta);
        return results;
      };
      try {
        return await run(currentTarget(raw), statements.map(unwrapStatement));
      } catch (error) {
        if (!dropClientBookmark(scope, error)) throw error;
        const target = currentTarget(raw);
        return run(
          target,
          statements.map((statement) => unwrapStatement(rebuildStatement(statement, target))),
        );
      }
    },
  };

  return new Proxy(overrides, {
    get(target, property) {
      if (property in target) return Reflect.get(target, property);
      const value = (raw as unknown as Record<PropertyKey, unknown>)[property];
      return typeof value === "function" ? (value as CallableFunction).bind(raw) : value;
    },
  }) as unknown as T;
}

/**
 * The closing bookmark of this request's session, or null when the request
 * never queried D1 (a static asset, a cache hit) and so has nothing to hand
 * forward.
 */
export function getD1Bookmark(): string | null {
  const scope = scopeStorage.getStore();
  if (!scope) return null;
  for (const session of scope.sessions.values()) {
    const bookmark = session.getBookmark();
    if (bookmark) return bookmark;
  }
  return null;
}

/** Which D1 instance answered this request's last query, for diagnostics. */
export function getD1ReplicaInfo(): { region?: string; primary?: boolean } | null {
  const meta = scopeStorage.getStore()?.lastMeta;
  if (!meta) return null;
  return { region: meta.served_by_region, primary: meta.served_by_primary };
}

/**
 * Hand this request's bookmark back to the client so its next request resumes
 * from the same database version — as a header for API clients, as a cookie
 * for browser navigations. No-ops when D1 was not used, which is what keeps
 * the `Set-Cookie` off static and otherwise cacheable responses. When the
 * bookmark the client sent had to be abandoned and nothing replaced it, the
 * cookie is expired instead so the client stops sending it.
 *
 * Returns the response to send: headers are set in place where the response
 * allows it, and on a copy where it does not.
 */
export function applyD1Bookmark(response: Response, options?: { debug?: boolean }): Response {
  const bookmark = getD1Bookmark();
  // A bookmark D1 would not accept has to be taken off the client as well as
  // out of this request, or the next request resumes the same failure — see
  // `dropClientBookmark`. Expiring the cookie is the only way to say so.
  const dropped = Boolean(scopeStorage.getStore()?.bookmarkDropped);
  if (!bookmark && !dropped) return response;
  // A 101 cannot be reconstructed and carries no headers worth setting.
  if (response.status === 101) return response;

  let target = response;
  const set = () => {
    if (bookmark) {
      target.headers.set(D1_BOOKMARK_HEADER, bookmark);
      target.headers.append(
        "set-cookie",
        `${D1_BOOKMARK_COOKIE}=${encodeURIComponent(bookmark)}; Path=/; Max-Age=${BOOKMARK_MAX_AGE_SECONDS}; SameSite=Lax; Secure; HttpOnly`,
      );
    } else {
      target.headers.append(
        "set-cookie",
        `${D1_BOOKMARK_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`,
      );
    }
    if (options?.debug) {
      const info = getD1ReplicaInfo();
      if (info?.region) target.headers.set("x-d1-served-by-region", info.region);
      if (info?.primary !== undefined) target.headers.set("x-d1-served-by-primary", String(info.primary));
    }
  };

  try {
    set();
  } catch {
    target = new Response(response.body, response);
    set();
  }
  return target;
}
