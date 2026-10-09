"use client";

import { useMemo, useState } from "react";
import { CalendarDays, MapPin, Plus, Search, ShieldCheck, Trophy } from "lucide-react";
import { DEMO_TOURN_ID } from "../../host/demo-account";
import { FramedOverlay } from "../FramedOverlay";
import { Badge, Card, Input, buttonVariants } from "../primitives";
import { Empty, Loaded, useApi, useTournaments, type LinkLike } from "../shared";
import type { OwnedTournament } from "../client";
import type { TournamentHrefs } from "../../routes";

/**
 * The Debate Majors season calendar — the week-by-week grid of the
 * season's major tournaments — a standalone page served from the
 * app's static assets, framed over this list rather than linked to.
 */
const MAJORS_CALENDAR_HREF = "/debate-majors-a-to-z.html";

/**
 * Upcoming tournaments, as on tabroom.com's front page (`/pages/invite/upcoming`):
 * the ones hosted on this site (the demo among them) first, then live Tabroom's.
 * Tabroom's own site has its own sidebar row, so it is not framed from here.
 */
export function UpcomingTournamentsPage() {
  const { client, hrefs, Link } = useTournaments();
  const state = useApi("upcoming", (signal) => client.upcoming(signal));
  // The tournaments the signed-in user hosts, for the button beside
  // "Host Tournament". A signed-out user's 401 reads as hosting none,
  // so the button simply stays off rather than erroring the page.
  const hosted = useApi("hosted", (signal) => client.myTournaments(signal));
  const [query, setQuery] = useState("");
  const [majorsOpen, setMajorsOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
          <p className="text-sm text-muted-foreground">
            Invitations, pairings and results from Tabroom, plus the tournaments hosted here.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
      <Loaded state={state}>
        {(tourns) => <UpcomingList tourns={tourns} query={query} hrefs={hrefs} Link={Link} />}
      </Loaded>
      <FramedOverlay
        open={majorsOpen}
        onClose={() => setMajorsOpen(false)}
        url={MAJORS_CALENDAR_HREF}
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
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {filtered.map((t) => (
          <li key={t.id}>
            <Link href={hrefs.tournament(t.tournId)} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-4 transition-colors hover:bg-accent/60">
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
