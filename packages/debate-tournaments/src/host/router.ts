/// <reference path="../router.d.ts" />
/**
 * The hosting side of the tournaments API: `POST /host/tourns` to create a
 * tournament from inside this app, `GET /host/tourns` to list the ones the
 * signed-in user owns, `GET /host/tourns/:tournId/admin` for a hosted
 * tournament's admin view (see `./admin`), and `POST /host/demo` to load the
 * demo tournament anyone can browse as its mock admin (see `./demo`).
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
import { findPersonByEmail } from "../api/actor";
import { canAdminTournament, isDemoTournament, loadTournamentAdmin, mockAdminViewer, type AdminViewer } from "./admin";
import { ensureDemoTournament } from "./demo";
import { DEMO_ADMIN, DEMO_TOURN_ID } from "./demo-account";
import {
  createTournament,
  createTournamentSchema,
  ensurePersonByEmail,
  listOwnedTournaments,
} from "./create-tournament";

/** The `req.actor`/`req.user` the handler mounts, as this router reads them. */
interface HostRequest {
  body?: unknown;
  params?: Record<string, string>;
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
  routes.route("/tourns/:tournId/admin").get(admin);
  routes.route("/demo").post(demo);
  return routes as unknown as ExpressLikeRouter;
}

const admin = async (req: HostRequest, res: HostResponse) => {
  const tournId = Number(req.params?.tournId);
  if (!Number.isInteger(tournId) || tournId <= 0) return res.status(404).json({ detail: "No such tournament." });
  const user = req.hostUser ?? req.user;
  try {
    let viewer: AdminViewer | null = null;
    const person = user?.email ? await findPersonByEmail(user.email) : undefined;
    if (person && (await canAdminTournament(person.id, tournId))) {
      const name = [person.first, person.last].filter(Boolean).join(" ") || user?.name || person.email;
      viewer = { username: person.email.split("@")[0] ?? person.email, name, mock: false };
    } else if (isDemoTournament(tournId)) {
      // The demo is open to everyone, browsed as its mock admin.
      viewer = mockAdminViewer;
    }
    if (!viewer) {
      return user?.email
        ? res.status(403).json({ detail: "Only this tournament's owners and admins can open its admin view." })
        : res.status(401).json({ detail: "Sign in as one of this tournament's admins to open its admin view." });
    }
    const view = await loadTournamentAdmin(tournId, viewer);
    if (!view) return res.status(404).json({ detail: "No such tournament." });
    res.json(view);
  } catch (error) {
    res.status(500).json({ detail: messageFor(error, "Could not load the admin view.") });
  }
};

const demo = async (_req: HostRequest, res: HostResponse) => {
  try {
    const { seeded } = await ensureDemoTournament();
    res.json({ tournId: DEMO_TOURN_ID, username: DEMO_ADMIN.username, seeded });
  } catch (error) {
    res.status(500).json({ detail: messageFor(error, "Could not load the demo tournament.") });
  }
};

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
