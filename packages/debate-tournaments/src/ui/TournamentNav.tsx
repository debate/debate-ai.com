"use client";

import { tabsListClass, tabsTriggerClass } from "./primitives";
import { BackLink, useTournaments } from "./shared";

export type TournamentTab = "invite" | "rounds" | "results" | "tabroom";

/** Tab strip for one tournament's pages. */
export function TournamentNav({
  tournId,
  active,
  name,
}: {
  tournId: number;
  active: TournamentTab;
  name?: string;
}) {
  const { hrefs, Link } = useTournaments();
  const tabs: Array<[TournamentTab, string, string]> = [
    ["invite", "Invite", hrefs.tournament(tournId)],
    ["rounds", "Pairings", hrefs.rounds(tournId)],
    ["results", "Results", hrefs.results(tournId)],
    ["tabroom", "Tabroom", hrefs.tabroom(tournId)],
  ];
  return (
    <div className="space-y-3">
      <BackLink href={hrefs.upcoming()}>All tournaments</BackLink>
      {name && <h1 className="text-2xl font-bold tracking-tight">{name}</h1>}
      <nav className={tabsListClass} aria-label="Tournament sections">
        {tabs.map(([key, label, href]) => (
          <Link key={key} href={href} className={tabsTriggerClass(key === active)} aria-current={key === active ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
