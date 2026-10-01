"use client";

import { tabsListClass, tabsTriggerClass } from "./primitives";
import { BackLink, useTournaments } from "./shared";

export type TournamentTab = "invite" | "rounds" | "results" | "tabroom";

/** Tab strip for one tournament's pages. */
export function TournamentNav({
  tournId,
  active,
  name,
  webname,
}: {
  tournId: number;
  active: TournamentTab;
  name?: string;
  webname?: string | null;
}) {
  const { hrefs, Link } = useTournaments();
  const tabs: Array<[TournamentTab, string, string]> = [
    ["invite", "Invite", hrefs.tournament(tournId)],
    ["rounds", "Pairings", hrefs.rounds(tournId)],
    ["results", "Results", hrefs.results(tournId)],
    ["tabroom", "Tabroom", hrefs.tabroom(tournId)],
  ];
  const logoSrc = webname ? `/tournament-logos/${webname}.png` : null;
  return (
    <div className="space-y-3">
      <BackLink href={hrefs.upcoming()}>All tournaments</BackLink>
      <div className="flex items-center gap-3">
        {logoSrc && (
          <img
            src={logoSrc}
            alt={`${name || "Tournament"} logo`}
            className="h-12 w-auto max-w-[200px] object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        {name && <h1 className="text-2xl font-bold tracking-tight">{name}</h1>}
      </div>
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
