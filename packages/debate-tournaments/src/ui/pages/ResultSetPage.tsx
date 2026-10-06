"use client";

import type { BracketRound, ResultSet } from "../client";
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
  const bracket = set.tag === "bracket" ? bracketRounds(set) : [];
  // Speaker awards rank competitors, so each row names the student as well.
  const speakers = Boolean(results?.some((row) => row.Student));
  // Tabroom sends each tiebreak column once in `headers`, keyed like the
  // `values` on every row.
  const columns = Object.entries(set.headers ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">
        {set.Event?.name ? `${set.Event.name} — ` : ""}
        {set.label}
      </h2>
      {bracket.length ? (
        <BracketView rounds={bracket} />
      ) : !results ? (
        <Empty>{`${set.tag === "bracket" ? "Bracket" : "Table"} results aren’t available here yet — see Tabroom Classic for the full bracket.`}</Empty>
      ) : results.length === 0 ? (
        <Empty>No results in this set.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Place</TableHead>
                {speakers ? <TableHead>Speaker</TableHead> : null}
                <TableHead>Entry</TableHead>
                <TableHead>School</TableHead>
                {columns.map(([key, column]) => (
                  <TableHead key={key} className="text-right" title={column.description ?? undefined}>
                    {column.tag || column.description}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((row, i) => (
                <TableRow key={row.Student?.id ?? row.Entry?.id ?? i}>
                  <TableCell className="tabular-nums">{row.place ?? row.rank ?? ""}</TableCell>
                  {speakers ? (
                    <TableCell>{[row.Student?.first, row.Student?.last].filter(Boolean).join(" ")}</TableCell>
                  ) : null}
                  <TableCell>
                    {row.Entry?.code}
                    {row.Entry?.name && row.Entry.name !== row.Entry.code && (
                      <span className="ml-1 text-muted-foreground">{row.Entry.name}</span>
                    )}
                  </TableCell>
                  <TableCell>{row.School?.name}</TableCell>
                  {columns.map(([key]) => (
                    <TableCell key={key} className="text-right tabular-nums">
                      {formatValue(row.values?.[key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

const formatValue = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

/** A bracket set's rounds, first round first. */
function bracketRounds(set: ResultSet): BracketRound[] {
  // Live Tabroom can send a round with no sections at all, e.g. `{ 7: {} }`.
  return Object.values((set.rounds ?? {}) as Record<string, Partial<BracketRound>>)
    .filter((round): round is BracketRound => Boolean(round?.Sections && Object.keys(round.Sections).length))
    .sort((a, b) => a.order - b.order);
}

/**
 * The elimination bracket, one column per round. An entry that appears in the
 * next round advanced, so it is shown in bold; Tabroom's bracket sets carry
 * pairings only, not decisions, so the final's winner is on Final Places.
 */
function BracketView({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-4 pb-2">
        {rounds.map((round, index) => {
          const next = rounds[index + 1];
          const advanced = new Set(
            next ? Object.values(next.Sections).flatMap((section) => Object.values(section.Entries).map((entry) => entry.id)) : [],
          );
          const sections = Object.entries(round.Sections).sort(([a], [b]) => Number(a) - Number(b));
          return (
            <section key={round.label} className="w-48 space-y-2" aria-label={round.label}>
              <h3 className="text-sm font-medium text-muted-foreground">{round.label}</h3>
              <div className="flex h-full flex-col justify-around gap-2">
                {sections.map(([position, section]) => (
                  <Card key={position} className="divide-y text-sm">
                    {Object.entries(section.Entries)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([side, entry]) => (
                        <p key={side} className={`px-3 py-1.5 ${!next ? "" : advanced.has(entry.id) ? "font-semibold" : "text-muted-foreground"}`}>
                          {entry.code}
                        </p>
                      ))}
                    {section.room ? <p className="px-3 py-1 text-xs text-muted-foreground">{section.room}</p> : null}
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
