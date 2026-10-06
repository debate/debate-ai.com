"use client";

/**
 * The whole tournaments UI behind one component, so a host app mounts it with
 * a single catch-all page:
 *
 * ```tsx
 * // app/tournaments/[[...slug]]/page.tsx
 * <TournamentsApp segments={slug} basePath="/tournaments" apiBase="/api/tournaments" Link={Link} />
 * ```
 *
 * It resolves `segments` with `matchTournamentRoute` and renders that page;
 * data comes from the tournaments API mounted at `apiBase`, plus live Tabroom
 * through `liveApiBase` when given (see `createTournamentsClient`).
 *
 * A tournament URL names it by year and slug (`/2026/yale-invitational`),
 * which `client.resolve` turns into its tourn id. One that names it by id
 * (`/38436`) renders straight away, then has its address rewritten in place
 * to the named form once the tournament's name is known.
 */

import { useEffect, useMemo, type ReactNode } from "react";
import { matchTournamentRoute, tournamentHrefs, type TournamentPageRoute, type TournamentRoute } from "../routes";
import { createTournamentsClient } from "./client";
import { Empty, Loaded, TournamentsContext, defaultLink, useApi, useTournaments, type LinkLike } from "./shared";
import { TournamentNav, type TournamentTab } from "./TournamentNav";
import { UpcomingTournamentsPage } from "./pages/UpcomingTournamentsPage";
import { HostTournamentPage } from "./pages/HostTournamentPage";
import { TabroomTournamentPage } from "./pages/TabroomTournamentPage";
import { TournamentAdminPage } from "./pages/TournamentAdminPage";
import { TournamentInvitePage } from "./pages/TournamentInvitePage";
import { RoundsPage } from "./pages/RoundsPage";
import { RoundPage } from "./pages/RoundPage";
import { ResultsPage } from "./pages/ResultsPage";
import { ResultSetPage } from "./pages/ResultSetPage";

export interface TournamentsAppProps {
  /** Path segments after `basePath` (a catch-all route's params). */
  segments?: readonly string[];
  /** Where the UI is mounted (default `/tournaments`). */
  basePath?: string;
  /** Where the API handler is mounted (default `/api/tournaments`). Hosting and the admin view use it. */
  apiBase?: string;
  /** A read-only proxy to live Tabroom (e.g. `/api/tabroom-beta`), merged into the list when set. */
  liveApiBase?: string;
  /** The host's client-side link component (e.g. `next/link`); defaults to `<a>`. */
  Link?: LinkLike;
}

export function TournamentsApp({
  segments = [],
  basePath = "/tournaments",
  apiBase = "/api/tournaments",
  liveApiBase,
  Link = defaultLink,
}: TournamentsAppProps) {
  const value = useMemo(() => {
    const client = createTournamentsClient(apiBase, undefined, { liveApiBase });
    return { client, hrefs: tournamentHrefs(basePath, client.slugOf), Link };
  }, [apiBase, liveApiBase, basePath, Link]);
  const route = matchTournamentRoute(segments);
  return (
    <TournamentsContext.Provider value={value}>
      <RouteView route={route} />
    </TournamentsContext.Provider>
  );
}

const TAB_FOR: Partial<Record<TournamentRoute["page"], TournamentTab>> = {
  tournament: "invite",
  rounds: "rounds",
  round: "rounds",
  results: "results",
  resultSet: "results",
  tabroom: "tabroom",
};

function RouteView({ route }: { route: TournamentRoute }) {
  switch (route.page) {
    case "upcoming":
      return <UpcomingTournamentsPage />;
    case "host":
      return <HostTournamentPage />;
    case "notFound":
      return <Empty>That tournament page does not exist.</Empty>;
    default:
      return "tournId" in route.tourn ? (
        <TournamentRouteView route={route} tournId={route.tourn.tournId} />
      ) : (
        <ResolveTournament route={route} year={route.tourn.year} slug={route.tourn.slug} />
      );
  }
}

/** Looks up the tourn id a `/<year>/<slug>` route names, then renders its page. */
function ResolveTournament({ route, year, slug }: { route: TournamentPageRoute; year: number; slug: string }) {
  const { client } = useTournaments();
  const state = useApi(`resolve:${year}/${slug}`, (signal) => client.resolve(year, slug, signal));
  return (
    <div className={state.status === "ready" ? undefined : "mx-auto max-w-5xl p-4 md:p-6"}>
      <Loaded state={state}>{(tournId) => <TournamentRouteView route={route} tournId={tournId} />}</Loaded>
    </div>
  );
}

/**
 * Rewrites the address bar to the tournament's named URL (`/<year>/<slug>/…`)
 * once its name is known, without a navigation, so an id link or an old
 * `/practice/tournaments/<id>` bookmark settles on the canonical address.
 */
function useCanonicalHref(route: TournamentPageRoute, tournId: number, known: boolean) {
  const { hrefs, client } = useTournaments();
  useEffect(() => {
    if (!known || typeof window === "undefined" || !client.slugOf(tournId)) return;
    const href = hrefs.forRoute(route, tournId);
    const { pathname, search, hash } = window.location;
    if (decodeURI(pathname) !== decodeURI(href)) window.history.replaceState(window.history.state, "", `${href}${search}${hash}`);
  }, [route, tournId, known, hrefs, client]);
}

function TournamentRouteView({ route, tournId }: { route: TournamentPageRoute; tournId: number }) {
  if (route.page === "admin") return <AdminRoute route={route} tournId={tournId} />;
  return (
    <TournamentShell route={route} tournId={tournId} tab={TAB_FOR[route.page] ?? "invite"}>
      {(invite) => {
        switch (route.page) {
          case "tournament":
            return <TournamentInvitePage invite={invite} />;
          case "rounds":
            return <RoundsPage tournId={tournId} />;
          case "round":
            return <RoundPage tournId={tournId} eventAbbr={route.eventAbbr} roundName={route.roundName} />;
          case "results":
            return <ResultsPage tournId={tournId} />;
          case "resultSet":
            return <ResultSetPage tournId={tournId} resultSetId={route.resultSetId} />;
          case "tabroom":
            return <TabroomTournamentPage tournId={tournId} name={invite.name} />;
        }
      }}
    </TournamentShell>
  );
}

/**
 * Read from the hosting API directly, so a tournament that is not published
 * (or not public) still opens for its admins. Its name for the address bar
 * comes from the public invite when there is one.
 */
function AdminRoute({ route, tournId }: { route: TournamentPageRoute; tournId: number }) {
  const { client } = useTournaments();
  const state = useApi(`admin-name:${tournId}`, (signal) =>
    client.slugOf(tournId) ? Promise.resolve(true) : client.invite(tournId, signal).then(() => true, () => false),
  );
  useCanonicalHref(route, tournId, state.status === "ready" && state.data);
  return <TournamentAdminPage tournId={tournId} />;
}

/** Loads the tournament's invite once, for its name and the invite tab. */
function TournamentShell({
  route,
  tournId,
  tab,
  children,
}: {
  route: TournamentPageRoute;
  tournId: number;
  tab: TournamentTab;
  children: (invite: Awaited<ReturnType<ReturnType<typeof createTournamentsClient>["invite"]>>) => ReactNode;
}) {
  const { client } = useTournaments();
  const state = useApi(`invite:${tournId}`, (signal) => client.invite(tournId, signal));
  useCanonicalHref(route, tournId, state.status === "ready");
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <Loaded state={state}>
        {(invite) => (
          <>
            <TournamentNav tournId={tournId} active={tab} name={invite.name} source={client.sourceOf(tournId)} />
            {children(invite)}
          </>
        )}
      </Loaded>
    </div>
  );
}
