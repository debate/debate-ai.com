"use client";

import { Empty, Loaded, useApi, useTournaments } from "../shared";

/** One published result set: places, entries and schools. */
export function ResultSetPage({ tournId, resultSetId }: { tournId: number; resultSetId: number }) {
  const { client, hrefs, Link } = useTournaments();
  const state = useApi(`resultSet:${tournId}:${resultSetId}`, (signal) => client.resultSet(tournId, resultSetId, signal));
  return (
    <div className="space-y-3">
      <Link href={hrefs.results(tournId)} className="text-xs text-muted-foreground hover:underline">
        ← All results
      </Link>
      <Loaded state={state}>
        {(sets) => {
          const set = sets[0];
          if (!set) return <Empty>Result set not found.</Empty>;
          return (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">
                {set.Event?.name ? `${set.Event.name} — ` : ""}
                {set.label}
              </h2>
              {set.results.length === 0 ? (
                <Empty>No results in this set.</Empty>
              ) : (
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Place</th>
                        <th className="px-3 py-2 font-medium">Entry</th>
                        <th className="px-3 py-2 font-medium">School</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {set.results.map((row, i) => (
                        <tr key={row.Entry?.id ?? i}>
                          <td className="px-3 py-2 tabular-nums">{row.place ?? row.rank ?? ""}</td>
                          <td className="px-3 py-2">
                            {row.Entry?.code}
                            {row.Entry?.name && row.Entry.name !== row.Entry.code && (
                              <span className="ml-1 text-muted-foreground">{row.Entry.name}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{row.School?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }}
      </Loaded>
    </div>
  );
}
