"use client";

import { Empty, Loaded, Section, formatDate, useApi, useTournaments } from "../shared";

/** Published result sets, grouped by event. */
export function ResultsPage({ tournId }: { tournId: number }) {
  const { client, hrefs, Link } = useTournaments();
  const state = useApi(`results:${tournId}`, (signal) => client.results(tournId, signal));
  return (
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
                        <Link href={hrefs.resultSet(tournId, rs.id)} className="flex justify-between gap-2 px-4 py-2 hover:bg-muted/50">
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
  );
}
