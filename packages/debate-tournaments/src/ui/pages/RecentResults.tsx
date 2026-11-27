"use client";

import { CalendarDays, ListOrdered, MapPin, Trophy } from "lucide-react";
import { RECENT_RESULTS_DAYS, type PublishedRound, type ResultSet, type ResultsIndexEvent, type UpcomingTournament } from "../client";
import { isElimRound } from "../bracket";
import { ExpandableDetailRow, ExpandableGroupRow } from "../expandable-rows";
import { Badge, Card } from "../primitives";
import { ErrorNote, Loading, useApi, useTournaments } from "../shared";
import { pickResultSets, topFormatEvents, topFormatLabel, type TopFormatEvent } from "../top-formats";
import { ElimBracket } from "./ElimBracket";
import { ResultSetView } from "./ResultSetPage";

/** Final places and speaker awards shown per event; the full lists are one click away on the results page. */
const FINALS_SHOWN = 8;
const SPEAKERS_SHOWN = 10;

/** Columns in the table, for the rows that span it. */
const COLUMNS = 4;

/**
 * Tournaments whose results were completed in the last week, at the top
 * of the Tournaments page. Each is an expandable row (the same two-tier
 * pattern as the video grid): a tournament opens onto its PF, LD, Policy and
 * College Policy events — no other event is listed — and an event opens onto
 * its elimination bracket, final places, and speaker awards in small type.
 * A tournament's results are requested when its row is first expanded, and an
 * event's result sets when the event is.
 */
export function RecentResultsSection({
  tourns,
  state,
  onShowArchive,
}: {
  tourns: UpcomingTournament[];
  state: "loading" | "ready";
  /** Opens the full list of past tournaments with results; offered from the empty state. */
  onShowArchive?: () => void;
}) {
  return (
    <section aria-labelledby="recent-results-heading" className="space-y-2" data-recent-results="">
      <div>
        <h2 id="recent-results-heading" className="flex items-center gap-2 text-base font-semibold">
          <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden />
          Recent results
        </h2>
        <p className="text-xs text-muted-foreground">
          Tournaments with results completed in the last {RECENT_RESULTS_DAYS} days — PF, LD, Policy and College Policy.
        </p>
      </div>
      {state === "loading" ? (
        <Loading label="Loading recent results…" />
      ) : tourns.length === 0 ? (
        <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
          No tournaments finished with results in the last {RECENT_RESULTS_DAYS} days.
          {onShowArchive ? (
            <>
              {" "}
              <button type="button" onClick={onShowArchive} className="text-primary hover:underline">
                Browse all past results
              </button>
            </>
          ) : null}
        </p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Tournaments with recent results">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Tournament</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 text-right font-medium">
                  <span className="sr-only">Full results</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tourns.map((t) => (
                <TournamentResultsRows key={t.id} tourn={t} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

function TournamentResultsRows({ tourn }: { tourn: UpcomingTournament }) {
  const { hrefs, Link } = useTournaments();
  const where = [tourn.location, tourn.state].filter(Boolean).join(", ");
  return (
    <ExpandableGroupRow
      depth={0}
      kind="tournament"
      label={tourn.name}
      icon={Trophy}
      heading={<span className="truncate text-sm font-semibold text-foreground">{tourn.name}</span>}
      cells={
        <>
          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {tourn.fullDates || tourn.dates || "—"}
            </span>
          </td>
          <td className="px-3 py-2 text-xs text-muted-foreground">
            {where ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {where}
              </span>
            ) : (
              "—"
            )}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
            <span onClick={(event) => event.stopPropagation()}>
              <Link href={hrefs.results(tourn.tournId)} className="text-primary hover:underline" aria-label={`All results for ${tourn.name}`}>
                All results
              </Link>
            </span>
          </td>
        </>
      }
    >
      <TournamentFormatRows tournId={tourn.tournId} />
    </ExpandableGroupRow>
  );
}

/** The expanded tournament: its top-format events, found from its results index and published rounds. */
function TournamentFormatRows({ tournId }: { tournId: number }) {
  const { client } = useTournaments();
  const state = useApi(`recent-results:${tournId}`, (signal) =>
    Promise.all([client.results(tournId, signal), client.rounds(tournId, signal).catch((): PublishedRound[] => [])]).then(([results, rounds]) => ({
      events: topFormatEvents(results),
      rounds,
    })),
  );
  if (state.status === "loading") {
    return (
      <ExpandableDetailRow depth={1} colSpan={COLUMNS}>
        <Loading label="Loading results…" />
      </ExpandableDetailRow>
    );
  }
  if (state.status === "error") {
    return (
      <ExpandableDetailRow depth={1} colSpan={COLUMNS}>
        <ErrorNote error={state.error} />
      </ExpandableDetailRow>
    );
  }
  const { events, rounds } = state.data;
  return events.length === 0 ? <NoResultsRow /> : <FormatEventRows tournId={tournId} events={events} rounds={rounds} />;
}

function NoResultsRow() {
  return (
    <ExpandableDetailRow depth={1} colSpan={COLUMNS}>
      <p className="text-xs text-muted-foreground">No PF, LD, Policy or College Policy results have been posted for this tournament.</p>
    </ExpandableDetailRow>
  );
}

function FormatEventRows({ tournId, events, rounds }: { tournId: number; events: TopFormatEvent[]; rounds: PublishedRound[] }) {
  return (
    <>
      {events.map(({ format, event }, index) => (
        <ExpandableGroupRow
          key={event.id}
          depth={1}
          kind="event"
          label={event.name}
          defaultOpen={index === 0}
          heading={
            <>
              <span className="truncate text-sm font-semibold text-primary">{event.name}</span>
              <Badge variant="outline">{topFormatLabel(format)}</Badge>
            </>
          }
          cells={<td colSpan={COLUMNS - 1} />}
        >
          <ExpandableDetailRow depth={2} colSpan={COLUMNS}>
            <EventResults tournId={tournId} event={event} rounds={rounds} />
          </ExpandableDetailRow>
        </ExpandableGroupRow>
      ))}
    </>
  );
}

/**
 * One event's results: the elimination bracket first (the published elim
 * rounds, or the bracket result set when only that is posted), then final
 * places, then speaker awards in small type at the bottom.
 */
function EventResults({ tournId, event, rounds }: { tournId: number; event: ResultsIndexEvent; rounds: PublishedRound[] }) {
  const { client } = useTournaments();
  const sets = pickResultSets(event.ResultSets);
  const hasElimRounds = rounds.some((round) => round.Event.abbr === event.abbr && isElimRound(round.type));
  const loadSet = (id: number | undefined, signal: AbortSignal) =>
    id === undefined ? Promise.resolve(null) : client.resultSet(tournId, id, signal).then((found) => found[0] ?? null);
  const state = useApi(`recent-results:${tournId}:${event.id}`, (signal) =>
    Promise.all([
      loadSet(hasElimRounds ? undefined : sets.bracket?.id, signal).catch(() => null),
      loadSet(sets.finals?.id, signal).catch(() => null),
      loadSet(sets.speakers?.id, signal).catch(() => null),
    ]).then(([bracket, finals, speakers]) => ({ bracket, finals, speakers })),
  );
  if (state.status === "loading") return <Loading label={`Loading ${event.name} results…`} />;
  if (state.status === "error") return <ErrorNote error={state.error} />;
  const { bracket, finals, speakers } = state.data;
  const placed = finals?.results?.length ?? 0;
  const spoken = speakers?.results?.length ?? 0;
  return (
    <div className="space-y-4" data-event-results={event.abbr}>
      {hasElimRounds ? (
        <ElimBracket tournId={tournId} eventAbbr={event.abbr} rounds={rounds} />
      ) : bracket ? (
        <ResultSetView set={bracket} />
      ) : placed === 0 ? (
        <p className="text-xs text-muted-foreground">No elimination bracket has been posted.</p>
      ) : null}
      {placed > 0 ? <FinalPlaces set={finals!} /> : null}
      {spoken > 0 ? <SpeakerAwards set={speakers!} /> : null}
      {!hasElimRounds && !bracket && placed === 0 && spoken === 0 ? (
        <p className="text-xs text-muted-foreground">No results have been posted for {event.name} yet.</p>
      ) : null}
    </div>
  );
}

const placeOf = (row: NonNullable<ResultSet["results"]>[number]) => row.place ?? (row.rank != null ? String(row.rank) : "");
const placeNumber = (row: NonNullable<ResultSet["results"]>[number]) => {
  const n = Number.parseInt(placeOf(row), 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

function FinalPlaces({ set }: { set: ResultSet }) {
  const rows = [...(set.results ?? [])].sort((a, b) => placeNumber(a) - placeNumber(b)).slice(0, FINALS_SHOWN);
  return (
    <div>
      <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ListOrdered className="h-3.5 w-3.5" aria-hidden />
        Final places
      </h4>
      <ol className="space-y-0.5 text-xs" data-final-places="">
        {rows.map((row, i) => (
          <li key={row.Entry?.id ?? i} className="flex gap-2">
            <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{placeOf(row)}</span>
            <span className="min-w-0 truncate">
              <span className="font-medium">{row.Entry?.code}</span>
              {row.Entry?.name && row.Entry.name !== row.Entry.code ? <span className="text-muted-foreground"> {row.Entry.name}</span> : null}
              {row.School?.name ? <span className="text-muted-foreground"> · {row.School.name}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SpeakerAwards({ set }: { set: ResultSet }) {
  const rows = [...(set.results ?? [])].sort((a, b) => placeNumber(a) - placeNumber(b)).slice(0, SPEAKERS_SHOWN);
  return (
    <div>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Speaker awards</h4>
      <ol className="grid gap-x-6 gap-y-0.5 text-[11px] leading-snug sm:grid-cols-2" data-speaker-awards="">
        {rows.map((row, i) => {
          const name = [row.Student?.first, row.Student?.last].filter(Boolean).join(" ") || row.Entry?.name || row.Entry?.code || "";
          return (
            <li key={row.Student?.id ?? row.Entry?.id ?? i} className="flex gap-1.5">
              <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{placeOf(row)}</span>
              <span className="min-w-0 truncate">
                {name}
                {row.School?.name ? <span className="text-muted-foreground"> {row.School.name}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
