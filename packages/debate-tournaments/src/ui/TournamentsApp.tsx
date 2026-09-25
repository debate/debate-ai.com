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
 * data comes from the tournaments API mounted at `apiBase`.
 */

import { useMemo, type ReactNode } from "react";
import { matchTournamentRoute, tournamentHrefs, type TournamentRoute } from "../routes";
import { createTournamentsClient } from "./client";
import { Empty, Loaded, TournamentsContext, defaultLink, useApi, useTournaments, type LinkLike } from "./shared";
import { TournamentNav, type TournamentTab } from "./TournamentNav";
import { UpcomingTournamentsPage } from "./pages/UpcomingTournamentsPage";
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
  /** Where the API handler is mounted (default `/api/tournaments`). */
  apiBase?: string;
  /** The host's client-side link component (e.g. `next/link`); defaults to `<a>`. */
  Link?: LinkLike;
}

export function TournamentsApp({ segments = [], basePath = "/tournaments", apiBase = "/api/tournaments", Link = defaultLink }: TournamentsAppProps) {
  const value = useMemo(
    () => ({ client: createTournamentsClient(apiBase), hrefs: tournamentHrefs(basePath), Link }),
    [apiBase, basePath, Link],
  );
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
};

function RouteView({ route }: { route: TournamentRoute }) {
  switch (route.page) {
    case "upcoming":
      return <UpcomingTournamentsPage />;
    case "notFound":
      return <Empty>That tournament page does not exist.</Empty>;
    default:
      return (
        <TournamentShell tournId={route.tournId} tab={TAB_FOR[route.page] ?? "invite"}>
          {(invite) => {
            switch (route.page) {
              case "tournament":
                return <TournamentInvitePage invite={invite} />;
              case "rounds":
                return <RoundsPage tournId={route.tournId} />;
              case "round":
                return <RoundPage tournId={route.tournId} eventAbbr={route.eventAbbr} roundName={route.roundName} />;
              case "results":
                return <ResultsPage tournId={route.tournId} />;
              case "resultSet":
                return <ResultSetPage tournId={route.tournId} resultSetId={route.resultSetId} />;
            }
          }}
        </TournamentShell>
      );
  }
}

/** Loads the tournament's invite once, for its name and the invite tab. */
function TournamentShell({
  tournId,
  tab,
  children,
}: {
  tournId: number;
  tab: TournamentTab;
  children: (invite: Awaited<ReturnType<ReturnType<typeof createTournamentsClient>["invite"]>>) => ReactNode;
}) {
  const { client } = useTournaments();
  const state = useApi(`invite:${tournId}`, (signal) => client.invite(tournId, signal));
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <Loaded state={state}>
        {(invite) => (
          <>
            <TournamentNav tournId={tournId} active={tab} name={invite.name} webname={invite.webname} />
            {children(invite)}
          </>
        )}
      </Loaded>
    </div>
  );
}
