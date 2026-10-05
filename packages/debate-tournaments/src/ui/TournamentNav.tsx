"use client";

import type { TournamentSource } from "./client";
import { Badge, tabsListClass, tabsTriggerClass } from "./primitives";
import { BackLink, useTournaments } from "./shared";

export type TournamentTab = "invite" | "rounds" | "results" | "tabroom" | "admin";

/**
 * Tab strip for one tournament's pages. The last tab depends on where the
 * tournament lives: one hosted on this site gets its **Admin** view (on the
 * hosting API), one on live Tabroom gets Tabroom's own page, framed.
 */
export function TournamentNav({
  tournId,
  active,
  name,
  source = "hosted",
}: {
  tournId: number;
  active: TournamentTab;
  name?: string;
  source?: TournamentSource;
}) {
  const { hrefs, Link } = useTournaments();
  const tabs: Array<[TournamentTab, string, string]> = [
    ["invite", "Invite", hrefs.tournament(tournId)],
    ["rounds", "Pairings", hrefs.rounds(tournId)],
    ["results", "Results", hrefs.results(tournId)],
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
