"use client";

import { useMemo, useState } from "react";
import { CalendarDays, MapPin, Search } from "lucide-react";
import { Empty, Loaded, useApi, useTournaments } from "../shared";

/** Upcoming tournaments, as on tabroom.com's front page (`/pages/invite/upcoming`). */
export function UpcomingTournamentsPage() {
  const { client, hrefs, Link } = useTournaments();
  const state = useApi("upcoming", (signal) => client.upcoming(signal));
  const [query, setQuery] = useState("");

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
          <p className="text-sm text-muted-foreground">Invitations, pairings and results, powered by Tabroom.</p>
        </div>
        <label className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tournaments, states, circuits…"
            aria-label="Search tournaments"
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <Loaded state={state}>
        {(tourns) => <UpcomingList tourns={tourns} query={query} hrefs={hrefs} Link={Link} />}
      </Loaded>
    </div>
  );
}

function UpcomingList({
  tourns,
  query,
  hrefs,
  Link,
}: {
  tourns: Awaited<ReturnType<ReturnType<typeof useTournaments>["client"]["upcoming"]>>;
  query: string;
  hrefs: ReturnType<typeof useTournaments>["hrefs"];
  Link: ReturnType<typeof useTournaments>["Link"];
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tourns;
    return tourns.filter((t) =>
      [t.name, t.location, t.state, t.circuits, t.events, t.eventTypes].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [tourns, query]);

  if (filtered.length === 0) return <Empty>No upcoming tournaments{query ? " match that search" : ""}.</Empty>;

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {filtered.map((t) => (
        <li key={t.id}>
          <Link href={hrefs.tournament(t.tournId)} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-4 hover:bg-muted/50">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  {t.fullDates || t.dates}
                </span>
                {(t.location || t.state) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {[t.location, t.state].filter(Boolean).join(", ")}
                  </span>
                )}
                {t.modes && <span>{t.modes.trim()}</span>}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {t.circuits && <p>{t.circuits}</p>}
              {t.events && <p className="max-w-[16rem] truncate">{t.events}</p>}
              {t.schoolCount ? <p>{t.schoolCount} schools</p> : null}
              {t.webname && (
                <img
                  src={`/tournament-logos/${t.webname}.png`}
                  alt=""
                  className="mt-2 h-8 w-auto max-w-[120px] object-contain opacity-60"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
