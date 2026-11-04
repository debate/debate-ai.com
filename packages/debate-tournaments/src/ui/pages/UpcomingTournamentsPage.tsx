"use client";

import { useMemo, useState } from "react";
import { CalendarDays, History, MapPin, Plus, Search, ShieldCheck, Trophy } from "lucide-react";
import { DEMO_TOURN_ID } from "../../host/demo-account";
import { FramedOverlay } from "../FramedOverlay";
import { DebateMajorsCalendar } from "../majors";
import { Badge, Card, Input, Select, buttonVariants } from "../primitives";
import { Empty, Loaded, useApi, useTournaments, type LinkLike } from "../shared";
import type { ActiveCircuit, OwnedTournament, UpcomingTournament } from "../client";
import type { TournamentHrefs } from "../../routes";

/**
 * Upcoming tournaments, as on Tournament Admin's front page (`/pages/invite/upcoming`):
 * the ones hosted on this site (the demo among them) first, then live Tabroom's.
 * The demo tournament is reachable from the Demo admin button beside
 * "Host Tournament" rather than listed here, so it does not clutter the list
 * while it is underway. Tabroom's own site has its own sidebar row, so it is not
 * framed from here.
 *
 * The top bar filters by state and by circuit, and its Results button swaps
 * the list for past tournaments with published results (the last 60 days).
 * Upcoming rows carry their circuits, so that filter runs here; past rows do
 * not, so a circuit there is sent upstream by id (see `pastTournaments`).
 */
export function UpcomingTournamentsPage() {
  const { client, hrefs, Link } = useTournaments();
  const upcoming = useApi("upcoming", (signal) => client.upcoming(signal));
  // The tournaments the signed-in user hosts, for the button beside
  // "Host Tournament". A signed-out user's 401 reads as hosting none,
  // so the button simply stays off rather than erroring the page.
  const hosted = useApi("hosted", (signal) => client.myTournaments(signal));
  const [query, setQuery] = useState("");
  const [majorsOpen, setMajorsOpen] = useState(false);
  const [state, setStateFilter] = useState("");
  const [circuit, setCircuit] = useState("");
  const [showResults, setShowResults] = useState(false);
  const circuits = useApi("circuits", (signal) => client.activeCircuits(signal).catch(() => [] as ActiveCircuit[]));
  const activeCircuit =
    circuit && circuits.status === "ready"
      ? circuits.data.find((c) => c.abbr.toUpperCase() === circuit.toUpperCase()) ?? null
      : null;
  const past = useApi(showResults ? `past:${circuit}:${circuits.status}` : "past:off", (signal) =>
    showResults && !(circuit && circuits.status === "loading")
      ? circuit && !activeCircuit
        ? Promise.resolve([] as UpcomingTournament[])
        : client.pastTournaments({ circuit: activeCircuit, signal })
      : Promise.resolve([] as UpcomingTournament[]),
  );
  const rows = showResults ? past : upcoming;
  const circuitOptions = useMemo(
    () => circuitChoices(circuits.status === "ready" ? circuits.data : [], upcoming.status === "ready" ? upcoming.data : []),
    [circuits, upcoming],
  );
  const stateOptions = useMemo(
    () => stateChoices([...(upcoming.status === "ready" ? upcoming.data : []), ...(past.status === "ready" ? past.data : [])]),
    [upcoming, past],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
          <p className="text-sm text-muted-foreground">
            Invitations, pairings and results from Tabroom, plus the tournaments hosted here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={state}
            onChange={(e) => setStateFilter(e.target.value)}
            aria-label="Filter by state"
            className="w-auto"
          >
            <option value="">All states</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            value={circuit}
            onChange={(e) => setCircuit(e.target.value)}
            aria-label="Filter by circuit"
            className="w-auto max-w-[14rem]"
          >
            <option value="">All circuits</option>
            {circuitOptions.map((c) => (
              <option key={c.abbr} value={c.abbr} title={c.name}>
                {c.name && c.name !== c.abbr ? `${c.abbr} — ${c.name}` : c.abbr}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setShowResults((on) => !on)}
            aria-pressed={showResults}
            title={showResults ? "Back to upcoming tournaments" : "Past tournaments with published results"}
            className={buttonVariants({ variant: showResults ? "default" : "outline", size: "sm" })}
          >
            <History aria-hidden />
            Results
          </button>
          <label className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tournaments, states, circuits…"
              aria-label="Search tournaments"
              className="pl-8"
            />
          </label>
          <button
            type="button"
            onClick={() => setMajorsOpen(true)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Trophy aria-hidden />
            Debate Majors
          </button>
          <Link href={hrefs.admin(DEMO_TOURN_ID)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ShieldCheck aria-hidden />
            Demo admin
          </Link>
          {hosted.status === "ready" && hosted.data.tournaments.length > 0 && (
            <HostedTournamentButton tournaments={hosted.data.tournaments} hrefs={hrefs} Link={Link} />
          )}
          <Link href={hrefs.host()} className={buttonVariants({ size: "sm" })}>
            <Plus className="mr-1.5 h-4 w-4" />
            Host Tournament
          </Link>
        </div>
      </div>
      {showResults ? (
        <h2 className="text-sm font-medium text-muted-foreground">Results · past tournaments, last 60 days</h2>
      ) : null}
      <Loaded state={rows}>
        {(tourns) => (
          <UpcomingList
            tourns={tourns.filter((t) => t.tournId !== DEMO_TOURN_ID)}
            query={query}
            state={state}
            circuit={showResults ? "" : circuit}
            past={showResults}
            hrefs={hrefs}
            Link={Link}
          />
        )}
      </Loaded>
      <FramedOverlay
        open={majorsOpen}
        onClose={() => setMajorsOpen(false)}
        content={<DebateMajorsCalendar />}
        title="Debate Majors"
        description="The whole 2026–27 season at a glance — weeks A–Y plus the Z championships, one placement per tournament."
      />
    </div>
  );
}

/**
 * The button beside "Host Tournament" that shows the tournament the
 * signed-in user is hosting — the newest one, since the host's
 * tournaments come back newest first — and opens its admin view. A
 * count badge stands for the rest when the user hosts more than one.
 */
export function HostedTournamentButton({
  tournaments,
  hrefs,
  Link,
}: {
  tournaments: OwnedTournament[];
  hrefs: TournamentHrefs;
  Link: LinkLike;
}) {
  if (tournaments.length === 0) return null;
  const newest = tournaments[0];
  const hosting = tournaments.length > 1;
  return (
    <Link
      href={hrefs.admin(newest.id)}
      className={buttonVariants({ variant: "outline", size: "sm" })}
      title={
        hosting
          ? `Hosting ${tournaments.length} tournaments — opens the newest one's admin view`
          : "Open the admin view of the tournament you are hosting"
      }
      aria-label={
        hosting
          ? `Open the admin view of ${newest.name}, the newest of your ${tournaments.length} hosted tournaments`
          : `Open the admin view of ${newest.name}, the tournament you are hosting`
      }
    >
      <ShieldCheck aria-hidden />
      {newest.name}
      {hosting ? <Badge variant="outline">{tournaments.length}</Badge> : null}
    </Link>
  );
}

/** Splits an upcoming row's `circuits` ("NSDA, TOC") into abbreviations. */
export function circuitsOf(t: Pick<UpcomingTournament, "circuits">): string[] {
  return (t.circuits ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * The circuit dropdown's choices: this year's active circuits, plus any
 * abbreviation an upcoming row names that the circuits list missed,
 * busiest first and then alphabetical.
 */
export function circuitChoices(
  active: ActiveCircuit[],
  upcoming: Pick<UpcomingTournament, "circuits">[],
): Array<{ abbr: string; name: string }> {
  const counts = new Map<string, { abbr: string; name: string; count: number }>();
  for (const c of active) counts.set(c.abbr.toUpperCase(), { abbr: c.abbr, name: c.name, count: c.tournCount });
  for (const t of upcoming) {
    for (const abbr of circuitsOf(t)) {
      const key = abbr.toUpperCase();
      const known = counts.get(key);
      if (known) known.count += 1;
      else counts.set(key, { abbr, name: abbr, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.abbr.localeCompare(b.abbr))
    .map(({ abbr, name }) => ({ abbr, name }));
}

/** The state dropdown's choices: every state a listed tournament is in, alphabetical. */
export function stateChoices(rows: Pick<UpcomingTournament, "state">[]): string[] {
  const states = new Set<string>();
  for (const t of rows) {
    const s = t.state?.trim().toUpperCase();
    if (s) states.add(s);
  }
  return [...states].sort();
}

/** Applies the top bar's search, state and circuit filters to a list of tournaments. */
export function filterTournaments<T extends Pick<UpcomingTournament, "name" | "location" | "state" | "circuits" | "events" | "eventTypes">>(
  tourns: T[],
  { query = "", state = "", circuit = "" }: { query?: string; state?: string; circuit?: string },
): T[] {
  const q = query.trim().toLowerCase();
  const st = state.trim().toUpperCase();
  const ci = circuit.trim().toUpperCase();
  return tourns.filter((t) => {
    if (st && t.state?.trim().toUpperCase() !== st) return false;
    if (ci && !circuitsOf(t).some((c) => c.toUpperCase() === ci)) return false;
    if (!q) return true;
    return [t.name, t.location, t.state, t.circuits, t.events, t.eventTypes].some((f) => f?.toLowerCase().includes(q));
  });
}

function UpcomingList({
  tourns,
  query,
  state,
  circuit,
  past,
  hrefs,
  Link,
}: {
  tourns: UpcomingTournament[];
  query: string;
  state: string;
  circuit: string;
  past: boolean;
  hrefs: ReturnType<typeof useTournaments>["hrefs"];
  Link: ReturnType<typeof useTournaments>["Link"];
}) {
  const filtered = useMemo(() => filterTournaments(tourns, { query, state, circuit }), [tourns, query, state, circuit]);

  if (filtered.length === 0) {
    const filteredBy = query || state || circuit;
    return (
      <Empty>
        No {past ? "past tournaments with results" : "upcoming tournaments"}
        {filteredBy ? " match those filters" : ""}.
      </Empty>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {filtered.map((t) => (
          <li key={t.id}>
            <Link href={past ? hrefs.results(t.tournId) : hrefs.tournament(t.tournId)} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-4 transition-colors hover:bg-accent/60">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {t.name}
                  {t.source === "hosted" ? <Badge variant="outline">Hosted here</Badge> : null}
                </p>
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
                  {t.modes && <Badge variant="outline">{t.modes.trim()}</Badge>}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right text-xs text-muted-foreground">
                {t.circuits && (
                  <span className="flex flex-wrap justify-end gap-1">
                    {t.circuits
                      .split(",")
                      .map((c) => c.trim())
                      .filter(Boolean)
                      .map((c) => (
                        <Badge key={c}>{c}</Badge>
                      ))}
                  </span>
                )}
                {t.events && <p className="max-w-[16rem] truncate">{t.events}</p>}
                {t.schoolCount ? <p>{t.schoolCount} schools</p> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
