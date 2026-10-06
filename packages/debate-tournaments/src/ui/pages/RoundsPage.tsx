"use client";

import type { PublishedRound } from "../client";
import { buttonVariants } from "../primitives";
import { isLiveDemo } from "../live/demo-live";
import { LiveRoundBadge, useNow } from "../live/LiveRoom";
import { Empty, Loaded, Section, useApi, useTournaments } from "../shared";

/** Published rounds (pairings), grouped by event. */
export function RoundsPage({ tournId }: { tournId: number }) {
  const { client } = useTournaments();
  const state = useApi(`rounds:${tournId}`, (signal) => client.rounds(tournId, signal));
  return <Loaded state={state}>{(rounds) => <RoundsByEvent tournId={tournId} rounds={rounds} />}</Loaded>;
}

function RoundsByEvent({ tournId, rounds }: { tournId: number; rounds: PublishedRound[] }) {
  const { hrefs, Link } = useTournaments();
  const live = isLiveDemo(tournId);
  const now = useNow(live ? 2000 : 60_000);
  if (rounds.length === 0) return <Empty>No pairings have been published yet.</Empty>;
  const byEvent = new Map<number, { event: PublishedRound["Event"]; rounds: PublishedRound[] }>();
  for (const round of rounds) {
    const group = byEvent.get(round.Event.id) ?? { event: round.Event, rounds: [] };
    group.rounds.push(round);
    byEvent.set(round.Event.id, group);
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[...byEvent.values()]
        .sort((a, b) => a.event.name.localeCompare(b.event.name))
        .map(({ event, rounds: eventRounds }) => (
          <Section key={event.id} title={`${event.name} (${event.abbr})`}>
            <ul className="flex flex-wrap gap-2 p-4">
              {eventRounds
                .sort((a, b) => a.name - b.name)
                .map((round) => (
                  <li key={round.id}>
                    <Link
                      href={hrefs.round(tournId, event.abbr, round.name)}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: live ? "h-auto min-w-28 flex-col items-start py-1.5" : undefined,
                      })}
                    >
                      {round.label || `Round ${round.name}`}
                      {live && <LiveRoundBadge roundId={round.id} eventAbbr={event.abbr} eventType={event.type} now={now} />}
                    </Link>
                  </li>
                ))}
            </ul>
          </Section>
        ))}
    </div>
  );
}
