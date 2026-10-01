/// <reference path="../router.d.ts" />
/**
 * The write side of the tournaments API: `POST /host/tourns` to create a
 * tournament from inside this app, and `GET /host/tourns` to list the ones the
 * signed-in user owns.
 *
 * This is deliberately a separate mount from the vendored `/rest` and `/pages`
 * trees. Those mirror upstream's public read API and are mounted as
 * read-only in {@link createTournamentsHandler}; keeping creation under its own
 * `/host` prefix means a route can never be added to them by accident, and the
 * host UI's client is pointed at the same base as the reads.
 *
 * Unlike upstream's `tab` routers this needs no session: the actor's Tabroom
 * `person` comes from the host app's signed-in email (see `../api/actor`), and
 * the new tournament is given that person an `owner` permission row.
 */

import Router from "router";
import type { ExpressLikeRouter } from "../api/express-adapter";
import type { HostUser, TabroomActor } from "../api/actor";
import {
  createTournament,
  createTournamentSchema,
  ensurePersonByEmail,
  listOwnedTournaments,
} from "./create-tournament";

/** The `req.actor`/`req.user` the handler mounts, as this router reads them. */
interface HostRequest {
  body?: unknown;
  actor?: TabroomActor;
  hostUser?: HostUser;
  user?: HostUser;
}

type HostResponse = {
  status: (code: number) => HostResponse;
  json: (payload: unknown) => HostResponse;
};

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type HostHandler = (req: HostRequest, res: HostResponse) => void;

function createHostRouter(): ExpressLikeRouter {
  const routes = Router({ mergeParams: true }) as unknown as {
    route: (path: string) => {
      get: (handler: HostHandler) => unknown;
      post: (handler: HostHandler) => unknown;
    };
  };

  const tourns = routes.route("/tourns");
  tourns.get(listMine);
  tourns.post(create);
  return routes as unknown as ExpressLikeRouter;
}

const listMine = async (req: HostRequest, res: HostResponse) => {
  const user = req.hostUser ?? req.user;
  if (!user?.email) return res.status(401).json({ detail: "Sign in to host a tournament." });
  try {
    const person = await ensurePersonByEmail({ email: user.email, name: user.name });
    res.json({ tournaments: await listOwnedTournaments(person.id) });
  } catch (error) {
    res.status(500).json({ detail: messageFor(error, "Could not load your tournaments.") });
  }
};

const create = async (req: HostRequest, res: HostResponse) => {
  const user = req.hostUser ?? req.user;
  if (!user?.email) return res.status(401).json({ detail: "Sign in to host a tournament." });

  const parsed = createTournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      detail: parsed.error.issues[0]?.message ?? "That tournament could not be created.",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  try {
    // The person row is the host's Tabroom account, created the first time
    // somebody hosts, so the ownership row has something to point at.
    const person = await ensurePersonByEmail({ email: user.email, name: user.name });
    res.status(201).json({ tournament: await createTournament({ id: person.id }, parsed.data) });
  } catch (error) {
    res.status(500).json({ detail: messageFor(error, "That tournament could not be created.") });
  }
};

let hostRouter: ExpressLikeRouter | undefined;

/** The `/host` router, built once. */
export function getHostRouter(): ExpressLikeRouter {
  hostRouter ??= createHostRouter();
  return hostRouter;
}

/** Whether a routed path is a host (write) path, which may take any method. */
export function isHostPath(path: string): boolean {
  return path === "/host" || path.startsWith("/host/");
}

/**
 * Whether a routed path takes this HTTP method. The vendored `/rest` and
 * `/pages` trees mirror upstream's public read API and stay read-only; only
 * `/host`, this package's own mount, accepts writes.
 */
export function hostPathAllowsMethod(path: string, method: string): boolean {
  return isHostPath(path) || READ_METHODS.has(method);
}

const messageFor = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;
