"use client";

import type { PublishedRound } from "../client";
import { isLiveDemo, liveRoundState } from "../live/demo-live";
import { LiveRoundBadge, useNow } from "../live/LiveRoom";
import { Empty, Loaded, Section, formatDate, useApi, useTournaments } from "../shared";

/** Published result sets, grouped by event. */
export function ResultsPage({ tournId }: { tournId: number }) {
  const { client, hrefs, Link } = useTournaments();
  const state = useApi(`results:${tournId}`, (signal) => client.results(tournId, signal));
  return (
    <div className="space-y-4">
      {isLiveDemo(tournId) && <LiveNow tournId={tournId} />}
      <Loaded state={state}>
        {(byEvent) => {
          const events = Object.values(byEvent).filter((e) => e.ResultSets?.length);
          if (events.length === 0) return <Empty>No results have been published yet.</Empty>;
          return (
            <div className="grid gap-4 md:grid-cols-2">
              {events
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((event) => (
                  <Section key={event.id} title={`${event.name} (${event.abbr})`}>
                    <ul className="divide-y text-sm">
                      {event.ResultSets.map((rs) => (
                        <li key={rs.id}>
                          <Link
                            href={hrefs.resultSet(tournId, rs.id)}
                            className="flex justify-between gap-2 px-4 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            <span>{rs.label || rs.tag}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(rs.createdAt)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Section>
                ))}
            </div>
          );
        }}
      </Loaded>
    </div>
  );
}

/** The demo tournament's simulated live rounds: each event's latest round in progress, linking to its pairings. */
function LiveNow({ tournId }: { tournId: number }) {
  const { client } = useTournaments();
  const state = useApi(`rounds:${tournId}`, (signal) => client.rounds(tournId, signal));
  return state.status === "ready" ? <LiveNowList tournId={tournId} rounds={state.data} /> : null;
}

export function LiveNowList({ tournId, rounds, at }: { tournId: number; rounds: PublishedRound[]; at?: number }) {
  const { hrefs, Link } = useTournaments();
  const ticking = useNow(2000);
  const now = at ?? ticking;
  if (now === null) return null;
  const latest = new Map<number, PublishedRound>();
  for (const round of rounds) {
    if (liveRoundState(round.id, round.Event.abbr, round.Event.type, now).phase !== "live") continue;
    const seen = latest.get(round.Event.id);
    if (!seen || round.name > seen.name) latest.set(round.Event.id, round);
  }
  if (latest.size === 0) return null;
  return (
    <Section title="Live now (simulated)">
      <ul className="grid gap-2 p-4 sm:grid-cols-2 md:grid-cols-4">
        {[...latest.values()]
          .sort((a, b) => a.Event.name.localeCompare(b.Event.name))
          .map((round) => (
            <li key={round.id}>
              <Link
                href={hrefs.round(tournId, round.Event.abbr, round.name)}
                className="block rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="font-medium">
                  {round.Event.abbr} · {round.label || `Round ${round.name}`}
                </span>
                <LiveRoundBadge roundId={round.id} eventAbbr={round.Event.abbr} eventType={round.Event.type} now={now} />
              </Link>
            </li>
          ))}
      </ul>
    </Section>
  );
}
