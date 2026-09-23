"use client";

import { useTournaments } from "./shared";

export type TournamentTab = "invite" | "rounds" | "results";

/** Tab strip for one tournament's pages. */
export function TournamentNav({ tournId, active, name }: { tournId: number; active: TournamentTab; name?: string }) {
  const { hrefs, Link } = useTournaments();
  const tabs: Array<[TournamentTab, string, string]> = [
    ["invite", "Invite", hrefs.tournament(tournId)],
    ["rounds", "Pairings", hrefs.rounds(tournId)],
    ["results", "Results", hrefs.results(tournId)],
  ];
  return (
    <div className="space-y-3">
      <Link href={hrefs.upcoming()} className="text-xs text-muted-foreground hover:underline">
        ← All tournaments
      </Link>
      {name && <h1 className="text-2xl font-bold tracking-tight">{name}</h1>}
      <nav className="flex gap-1 border-b" aria-label="Tournament sections">
        {tabs.map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              key === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
