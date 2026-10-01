"use client";

import type { ResultSet } from "../client";
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../primitives";
import { BackLink, Empty, Loaded, useApi, useTournaments } from "../shared";

/** One published result set: places, entries and schools. */
export function ResultSetPage({ tournId, resultSetId }: { tournId: number; resultSetId: number }) {
  const { client, hrefs } = useTournaments();
  const state = useApi(`resultSet:${tournId}:${resultSetId}`, (signal) => client.resultSet(tournId, resultSetId, signal));
  return (
    <div className="space-y-3">
      <BackLink href={hrefs.results(tournId)}>All results</BackLink>
      <Loaded state={state}>{(sets) => <ResultSetView set={sets[0]} />}</Loaded>
    </div>
  );
}

export function ResultSetView({ set }: { set: ResultSet | undefined }) {
  if (!set) return <Empty>Result set not found.</Empty>;
  // Bracket and table sets report through `rounds`, never `results`, so upstream
  // sends no `results` key at all for them and there is no table to render.
  const bracketed = set.tag === "bracket" || set.tag === "table";
  const results = bracketed ? undefined : (set.results ?? []);
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">
        {set.Event?.name ? `${set.Event.name} — ` : ""}
        {set.label}
      </h2>
      {!results ? (
        <Empty>{`${set.tag === "bracket" ? "Bracket" : "Table"} results aren’t available here yet — see Tabroom Classic for the full bracket.`}</Empty>
      ) : results.length === 0 ? (
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
              {results.map((row, i) => (
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
}
