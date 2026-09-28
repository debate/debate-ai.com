/**
 * The per-request database the vendored upstream code runs against.
 *
 * Upstream Tabroom opens one process-wide MariaDB pool at import time
 * (`api/data/database.ts`, `api/data/db.js`). A Worker has no such thing: the
 * D1 binding arrives with each request. So the overlays that replace those two
 * modules resolve the database lazily from here, and the API handler scopes
 * every request with {@link runWithTabroomDb}.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { Kysely } from "kysely";
import type { D1DatabaseLike } from "./d1-types";
import { createTabroomKysely } from "./d1-dialect";

interface TabroomDbScope {
  d1: D1DatabaseLike;
  kysely: Kysely<any>;
}

const storage = new AsyncLocalStorage<TabroomDbScope>();
let fallback: TabroomDbScope | undefined;

const scopeFor = (d1: D1DatabaseLike): TabroomDbScope => ({ d1, kysely: createTabroomKysely(d1) });

/** Runs `fn` with `d1` as the database for all vendored upstream code it reaches. */
export function runWithTabroomDb<T>(d1: D1DatabaseLike, fn: () => T): T {
  return storage.run(scopeFor(d1), fn);
}

/**
 * Sets the database used outside any {@link runWithTabroomDb} scope — for
 * scripts and tests. Pass `undefined` to clear it.
 */
export function setDefaultTabroomDb(d1: D1DatabaseLike | undefined): void {
  fallback = d1 ? scopeFor(d1) : undefined;
}

function currentScope(): TabroomDbScope {
  const scope = storage.getStore() ?? fallback;
  if (!scope) {
    throw new Error(
      "debate-tournaments: no D1 database in scope. Wrap the call in runWithTabroomDb(env.DB, …) " +
        "or pass getDb to createTournamentsHandler().",
    );
  }
  return scope;
}

/** The D1 database for the current request. */
export function getTabroomD1(): D1DatabaseLike {
  return currentScope().d1;
}

/** The Kysely instance for the current request. */
export function getTabroomKysely<DB = any>(): Kysely<DB> {
  return currentScope().kysely as Kysely<DB>;
}

/**
 * A stand-in for upstream's module-level `db` Kysely export that forwards
 * every property access to the current request's instance.
 */
export function createKyselyProxy<DB = any>(): Kysely<DB> {
  return new Proxy({} as Kysely<DB>, {
    get(_target, prop) {
      const kysely = getTabroomKysely<DB>() as any;
      const value = kysely[prop];
      return typeof value === "function" ? value.bind(kysely) : value;
    },
  });
}
