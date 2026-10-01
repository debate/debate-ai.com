"use client";

import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../primitives";
import { BackLink, Empty, Loaded, useApi, useTournaments } from "../shared";

/** One published result set: places, entries and schools. */
export function ResultSetPage({ tournId, resultSetId }: { tournId: number; resultSetId: number }) {
  const { client, hrefs } = useTournaments();
  const state = useApi(`resultSet:${tournId}:${resultSetId}`, (signal) => client.resultSet(tournId, resultSetId, signal));
  return (
    <div className="space-y-3">
      <BackLink href={hrefs.results(tournId)}>All results</BackLink>
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
                <Card className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Place</TableHead>
                        <TableHead>Entry</TableHead>
                        <TableHead>School</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {set.results.map((row, i) => (
                        <TableRow key={row.Entry?.id ?? i}>
                          <TableCell className="tabular-nums">{row.place ?? row.rank ?? ""}</TableCell>
                          <TableCell>
                            {row.Entry?.code}
                            {row.Entry?.name && row.Entry.name !== row.Entry.code && (
                              <span className="ml-1 text-muted-foreground">{row.Entry.name}</span>
                            )}
                          </TableCell>
                          <TableCell>{row.School?.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          );
        }}
      </Loaded>
    </div>
  );
}
