"use client";

import type { TournamentInvite, TournamentSource } from "./client";
import { Badge, tabsListClass, tabsTriggerClass } from "./primitives";
import { BackLink, useTournaments } from "./shared";
import { TournamentLinksMenu } from "./TournamentLinksMenu";

export type TournamentTab = "invite" | "rounds" | "results" | "tabroom" | "ballot" | "admin";

/**
 * Tab strip for one tournament's pages. The last tab depends on where the
 * tournament lives: one hosted on this site gets its **Admin** view (on the
 * hosting API), one on live Tabroom gets Tabroom's own page, framed. Given the
 * invite, an **Info & links** dropdown beside the tabs carries the tournament's
 * Tabroom sidebar (see `TournamentLinksMenu`).
 */
export function TournamentNav({
  tournId,
  active,
  name,
  source = "hosted",
  invite,
}: {
  tournId: number;
  active: TournamentTab;
  name?: string;
  source?: TournamentSource;
  invite?: TournamentInvite;
}) {
  const { hrefs, Link, ballotApiBase } = useTournaments();
  const tabs: Array<[TournamentTab, string, string]> = [
    ["invite", "Invite", hrefs.tournament(tournId)],
    ["rounds", "Pairings", hrefs.rounds(tournId)],
    ["results", "Results", hrefs.results(tournId)],
    // Judges submit ballots here when the host app has a ballot API.
    ...(ballotApiBase ? [["ballot", "Ballot", hrefs.ballot(tournId)] as [TournamentTab, string, string]] : []),
    source === "hosted" ? ["admin", "Admin", hrefs.admin(tournId)] : ["tabroom", "Tabroom", hrefs.tabroom(tournId)],
  ];
  return (
    <div className="space-y-3">
      <BackLink href={hrefs.upcoming()}>All tournaments</BackLink>
      {name && (
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          {name}
          {source === "hosted" ? <Badge variant="outline">Hosted here</Badge> : null}
        </h1>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <nav className={tabsListClass} aria-label="Tournament sections">
          {tabs.map(([key, label, href]) => (
            <Link key={key} href={href} className={tabsTriggerClass(key === active)} aria-current={key === active ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {invite ? <TournamentLinksMenu invite={invite} source={source} /> : null}
      </div>
    </div>
  );
}
