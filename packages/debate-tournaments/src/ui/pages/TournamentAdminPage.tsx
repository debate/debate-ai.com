"use client";

/**
 * The admin web view of a tournament hosted on this site, read from the
 * hosting API (`GET {apiBase}/host/tourns/:id/admin`) rather than Tabroom's
 * console: the schedule with unpublished rounds, every entry and its status,
 * schools, judges, rooms and result sets, each linked to its public page.
 *
 * Owners and admins see their own tournaments. The demo tournament is open to
 * everyone, who browse it as the mock admin `demo.admin`.
 */

import { useState, type ReactNode } from "react";
import { ExternalLink, ShieldCheck, UserRound } from "lucide-react";
import type { TournamentAdmin } from "../client";
import { Badge, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, buttonVariants, tabsListClass, tabsTriggerClass } from "../primitives";
import { BackLink, Empty, Loaded, Section, formatDate, useApi, useTournaments } from "../shared";

type AdminTab = "schedule" | "entries" | "schools" | "judges" | "rooms" | "results";

const TABS: Array<[AdminTab, string]> = [
  ["schedule", "Schedule"],
  ["entries", "Entries"],
  ["schools", "Schools"],
  ["judges", "Judges"],
  ["rooms", "Rooms"],
  ["results", "Results"],
];

export function TournamentAdminPage({ tournId }: { tournId: number }) {
  const { client, hrefs } = useTournaments();
  const state = useApi(`admin:${tournId}`, (signal) => client.admin(tournId, signal));
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <BackLink href={hrefs.upcoming()}>All tournaments</BackLink>
      <Loaded state={state}>{(view) => <AdminView view={view} />}</Loaded>
    </div>
  );
}

export function AdminView({ view }: { view: TournamentAdmin }) {
  const { hrefs, Link } = useTournaments();
  const [tab, setTab] = useState<AdminTab>("schedule");
  const { tourn, viewer } = view;
  const place = [tourn.city, tourn.state, tourn.country].filter(Boolean).join(", ");
  const count = (key: AdminTab): number =>
    key === "schedule" ? view.rounds.length : key === "results" ? view.resultSets.length : view[key].length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Tournament admin
          </p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {tourn.name}
            {tourn.hidden ? <Badge variant="outline">Hidden</Badge> : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[`${formatDate(tourn.start, tourn.tz)} – ${formatDate(tourn.end, tourn.tz)}`, place].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={hrefs.tournament(tourn.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Public invite
          </Link>
          <Link href={hrefs.rounds(tourn.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Pairings
          </Link>
          <Link href={hrefs.results(tourn.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Results
          </Link>
        </div>
      </div>

      <Card className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
        <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span>
          Signed in as <span className="font-medium">{viewer.username}</span>
          {viewer.name && viewer.name !== viewer.username ? <span className="text-muted-foreground"> ({viewer.name})</span> : null}
        </span>
        {viewer.mock ? (
          <>
            <Badge>Demo admin</Badge>
            <span className="text-xs text-muted-foreground">
              A mock account anyone can use to look around. Host your own tournament to manage one for real.
            </span>
          </>
        ) : (
          <Badge variant="outline">Owner</Badge>
        )}
      </Card>

      <dl className="grid gap-3 text-sm sm:grid-cols-4">
        <Stat label="Events" value={view.events.length} />
        <Stat label="Entries" value={view.entries.filter((e) => e.status === "active").length} />
        <Stat label="Judges" value={view.judges.length} />
        <Stat label="Registration" value={tourn.regEnd ? `Closes ${formatDate(tourn.regEnd, tourn.tz)}` : "Open"} />
      </dl>

      <Section title={`Events (${view.events.length})`}>
        {view.events.length === 0 ? (
          <Empty>No events yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Event</TableHead>
                <TableHead className="px-4">Division</TableHead>
                <TableHead className="px-4 text-right">Entries</TableHead>
                <TableHead className="px-4 text-right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="px-4">
                    <span className="font-medium">{event.name}</span>{" "}
                    <Badge variant="outline" className="ml-1">
                      {event.abbr}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 capitalize">{event.level ?? "—"}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{event.entryCount}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{event.fee != null ? `$${event.fee}` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <nav className={tabsListClass} aria-label="Admin sections">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={tabsTriggerClass(key === tab)} aria-pressed={key === tab} onClick={() => setTab(key)}>
            {label}
            <span className="ml-1 text-xs tabular-nums text-muted-foreground">{count(key)}</span>
          </button>
        ))}
      </nav>

      {tab === "schedule" ? <ScheduleTable view={view} /> : null}
      {tab === "entries" ? (
        <AdminTable
          empty="No entries yet."
          head={["Entry", "Event", "School", "Status"]}
          rows={view.entries.map((e) => [
            <span key="c">
              {e.code ?? "—"}
              {e.name && e.name !== e.code ? <span className="ml-1 text-muted-foreground">{e.name}</span> : null}
            </span>,
            e.eventAbbr ?? "—",
            e.schoolName ?? "—",
            <Badge key="s" variant={e.status === "active" ? "secondary" : "outline"} className="capitalize">
              {e.status}
            </Badge>,
          ])}
        />
      ) : null}
      {tab === "schools" ? (
        <AdminTable
          empty="No schools registered yet."
          head={["School", "Code", "Entries"]}
          rows={view.schools.map((s) => [s.name, s.code ?? "—", s.entryCount])}
        />
      ) : null}
      {tab === "judges" ? (
        <AdminTable
          empty="No judges yet."
          head={["Judge", "Code", "School", "Status"]}
          rows={view.judges.map((j) => [j.name || "—", j.code ?? "—", j.schoolName ?? "Hired", j.active ? "Active" : "Inactive"])}
        />
      ) : null}
      {tab === "rooms" ? (
        <AdminTable empty="No rooms yet." head={["Room", "Building"]} rows={view.rooms.map((r) => [r.name, r.building ?? "—"])} />
      ) : null}
      {tab === "results" ? (
        <AdminTable
          empty="No result sets yet."
          head={["Result set", "Event", "Visibility"]}
          rows={view.resultSets.map((r) => [
            r.published ? (
              <Link key="l" href={hrefs.resultSet(tourn.id, r.id)} className="font-medium underline-offset-4 hover:underline">
                {r.label ?? `Result set ${r.id}`}
              </Link>
            ) : (
              r.label ?? `Result set ${r.id}`
            ),
            r.eventAbbr ?? "—",
            r.published ? "Published" : "Not published",
          ])}
        />
      ) : null}
    </div>
  );
}

function ScheduleTable({ view }: { view: TournamentAdmin }) {
  const { hrefs, Link } = useTournaments();
  if (view.rounds.length === 0) return <Empty>No rounds scheduled yet.</Empty>;
  return (
    <AdminTable
      empty=""
      head={["Round", "Event", "Starts", "Sections", "Pairings", "Results"]}
      rows={view.rounds.map((round) => [
        round.published ? (
          <Link key="r" href={hrefs.round(view.tourn.id, round.eventAbbr, round.name)} className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">
            {round.label || `Round ${round.name}`}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        ) : (
          round.label || `Round ${round.name}`
        ),
        round.eventAbbr,
        round.start ? formatDate(round.start, view.tourn.tz, true) : "—",
        round.sectionCount,
        <Badge key="p" variant={round.published ? "secondary" : "outline"}>
          {round.published ? "Published" : "Draft"}
        </Badge>,
        round.resultsPosted ? "Posted" : "—",
      ])}
    />
  );
}

function AdminTable({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((label) => (
              <TableHead key={label} className="px-4">
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cells, i) => (
            <TableRow key={i}>
              {cells.map((cell, j) => (
                <TableCell key={j} className="px-4">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">{value}</dd>
    </Card>
  );
}
