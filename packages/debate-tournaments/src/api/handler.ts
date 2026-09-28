/// <reference path="../router.d.ts" />
/**
 * The tournaments API as a fetch handler: upstream Tabroom's public `/rest`
 * and `/pages` routers (vendored under `vendor/tabroom`, see README) running
 * on D1.
 *
 * ```ts
 * // Next/vinext: app/api/tournaments/[...path]/route.ts
 * const handler = createTournamentsHandler({
 *   basePath: "/api/tournaments",
 *   getDb: () => env.debate_db,
 * })
 * export const GET = handler
 * ```
 *
 * Paths mirror upstream's `/v1` API with that prefix optional:
 * `/api/tournaments/rest/tourns`, `/api/tournaments/v1/rest/tourns/123/invite`,
 * `/api/tournaments/pages/invite/upcoming`, …
 */

import Router from "router";
import restRouter from "../../vendor/tabroom/indexcards/api/routes/routers/v1/rest/restRouter";
import pagesRouter from "../../vendor/tabroom/indexcards/api/routes/routers/v1/pages/pagesRouter";
import type { D1DatabaseLike } from "../db/d1-types";
import { runWithTabroomDb } from "../db/runtime";
import legacyDb from "../../vendor/tabroom/indexcards/api/data/db.js";
import { tabroomConfig } from "../config";
import { actorForHostUser, anonymousActor, type HostUser, type TabroomActor } from "./actor";
import { runExpressRouter, type ExpressLikeRouter } from "./express-adapter";

export interface TournamentsHandlerOptions {
  /** URL prefix the handler is mounted under, e.g. `/api/tournaments`. */
  basePath?: string;
  /** The D1 database holding the Tabroom tables, resolved per request. */
  getDb: (request: Request) => D1DatabaseLike | Promise<D1DatabaseLike>;
  /** The signed-in host-app user, if any — mapped onto a Tabroom actor. */
  getUser?: (request: Request) => HostUser | null | undefined | Promise<HostUser | null | undefined>;
  /** `Cache-Control` for successful GET responses (default: 60s shared cache). */
  cacheControl?: string | false;
}

/** Upstream's routers mounted as upstream's `/v1` router mounts them. */
function createRootRouter(): ExpressLikeRouter {
  const root = Router({ mergeParams: true });
  root.use("/rest", restRouter);
  root.use("/pages", pagesRouter);
  return root as unknown as ExpressLikeRouter;
}

let rootRouter: ExpressLikeRouter | undefined;

/** Strips `basePath` and an optional leading `/v1` from a request path. */
export function routedPath(pathname: string, basePath = ""): string {
  let path = pathname;
  const base = basePath.replace(/\/+$/, "");
  if (base && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length);
  if (path === "/v1" || path.startsWith("/v1/")) path = path.slice(3);
  return path || "/";
}

export function createTournamentsHandler(options: TournamentsHandlerOptions) {
  const { basePath = "", getDb, getUser, cacheControl = "public, max-age=60, s-maxage=60" } = options;

  return async function handleTournamentsRequest(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      return new Response(JSON.stringify({ title: "Method Not Allowed", status: 405 }), {
        status: 405,
        headers: { "content-type": "application/problem+json", allow: "GET, HEAD" },
      });
    }
    rootRouter ??= createRootRouter();
    const router = rootRouter;
    const d1 = await getDb(request);
    const user = getUser ? await getUser(request) : null;
    const path = routedPath(new URL(request.url).pathname, basePath);

    const response = await runWithTabroomDb(d1, async () => {
      const actor: TabroomActor = user ? await actorForHostUser(user) : anonymousActor;
      const person = actor.Person;
      return runExpressRouter(router, request, {
        path,
        locals: {
          // Upstream's app.js hangs these off every request.
          db: legacyDb,
          config: tabroomConfig,
          uuid: crypto.randomUUID(),
          valid: {},
          actor,
          person,
          session: person ? { id: null, person: person.id, su: null, Person: person, Su: null } : undefined,
        },
      });
    });

    if (cacheControl && request.method === "GET" && response.ok && !user && !response.headers.has("cache-control")) {
      response.headers.set("cache-control", cacheControl);
    }
    return response;
  };
}
