"use client";

/**
 * A judge's paradigm and voting record, shown in the overlay a judge's name
 * opens in pairings. The profile comes from the host's
 * `lookupJudgeProfile` (live Tabroom judges, through the host's paradigm
 * cache) or, for a tournament hosted on this site, from the client's own
 * Tabroom API (`client.hostedJudgeProfile`).
 *
 * `paradigmHtml` is rendered as HTML: hosts sanitize it before it gets here
 * (`sanitizeParadigmHtml` in `../paradigms-server`). A hosted judge's
 * paradigm arrives as plain text instead.
 */

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { summarizeJudgeRecord, type JudgeProfile, type JudgeRecordRow } from "../paradigms";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, buttonVariants, tabsListClass, tabsTriggerClass } from "./primitives";

type Tab = "paradigm" | "record";

/** A row's date as `Oct 4, 2025`, or as Tabroom wrote it when it isn't ISO. */
function shortDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : value;
}

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

/** The headline numbers over a record. */
function RecordSummary({ rows }: { rows: readonly JudgeRecordRow[] }) {
  const summary = summarizeJudgeRecord(rows);
  const decided = summary.affVotes + summary.negVotes;
  const stats: Array<[string, string, string?]> = [
    ["Rounds judged", String(summary.rounds)],
    ["Aff / Pro votes", `${summary.affVotes} (${percent(summary.affVotes, decided)})`],
    ["Neg / Con votes", `${summary.negVotes} (${percent(summary.negVotes, decided)})`],
    ["Squirrels", `${summary.squirrels} of ${summary.panels} panels`, "Panel rounds where this judge was the lone dissent"],
  ];
  return (
    <div className="space-y-2" data-judge-summary="">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, value, title]) => (
          <div key={label} className="rounded-lg border bg-muted/40 px-3 py-2" title={title}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {summary.events.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {summary.events
            .slice(0, 6)
            .map((e) => `${e.event} ${e.rounds}`)
            .join(" · ")}
          {summary.latest ? ` — last judged at ${summary.latest.name}${summary.latest.date ? `, ${shortDate(summary.latest.date)}` : ""}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** The record as a table, newest first, the judge's vote marked against the panel's. */
function RecordTable({ rows }: { rows: readonly JudgeRecordRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tournament</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Ev</TableHead>
          <TableHead>Rd</TableHead>
          <TableHead>Aff</TableHead>
          <TableHead>Neg</TableHead>
          <TableHead>Vote</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => {
          const dissent = Boolean(row.vote && row.panelVote && row.panelVote !== "Tie" && row.vote !== row.panelVote);
          return (
            <TableRow key={i}>
              <TableCell className="max-w-56 truncate" title={row.Tourn.name}>
                {row.Tourn.name}
              </TableCell>
              <TableCell className="whitespace-nowrap">{shortDate(row.roundDate)}</TableCell>
              <TableCell>{row.eventAbbr}</TableCell>
              <TableCell>{row.roundLabel}</TableCell>
              <TableCell>{row.affTeam}</TableCell>
              <TableCell>{row.negTeam}</TableCell>
              <TableCell>
                {row.vote ? (
                  <Badge
                    variant={dissent ? "outline" : "secondary"}
                    className={dissent ? "border-red-500/60 text-red-700 dark:text-red-400" : undefined}
                    title={dissent ? "Voted against the panel" : undefined}
                  >
                    {row.vote}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {row.panelVote} {row.record}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** The paradigm: the judge's own one written here when verified, else Tabroom's. */
function Paradigm({ profile }: { profile: JudgeProfile }) {
  const own = profile.ownParadigm;
  const html = own?.html ?? profile.paradigmHtml;
  if (!html && !profile.paradigmText) {
    return <p className="text-sm text-muted-foreground">This judge has no paradigm on file.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {own
          ? `Written on this site by the judge · updated ${shortDate(own.updatedAt)}`
          : profile.lastReviewed
            ? `Last reviewed ${shortDate(profile.lastReviewed)} on Tabroom`
            : "From Tabroom"}
      </p>
      {html ? (
        <div
          data-paradigm=""
          className="max-w-none space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div data-paradigm="" className="space-y-3 whitespace-pre-wrap text-sm leading-relaxed">
          {profile.paradigmText}
        </div>
      )}
    </div>
  );
}

export interface JudgeProfileViewProps {
  name: string;
  /** `undefined` while loading; `null` when nothing could be found. */
  profile: JudgeProfile | null | undefined;
  /** Tabroom's page for the judge, when their person id is known. */
  tabroomUrl?: string | null;
  /** Where a judge edits their own paradigm on the host site. */
  editHref?: string | null;
}

/** The body of the judge overlay: tabs for the paradigm and the voting record. */
export function JudgeProfileView({ name, profile, tabroomUrl, editHref }: JudgeProfileViewProps) {
  const [tab, setTab] = useState<Tab>("paradigm");
  const links = (
    <div className="flex flex-wrap items-center gap-2">
      {tabroomUrl ? (
        <a href={tabroomUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Tabroom page
          <ExternalLink aria-hidden />
        </a>
      ) : null}
      {editHref ? (
        <a href={editHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Are you {name}? Edit your paradigm
        </a>
      ) : null}
    </div>
  );

  if (profile === undefined) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading {name}&apos;s paradigm and record…
      </div>
    );
  }
  if (profile === null) {
    return (
      <div className="space-y-3 p-6 text-sm">
        <p className="text-muted-foreground">No Tabroom paradigm or judging record was found for {name}.</p>
        {links}
      </div>
    );
  }
  return (
    <div className="space-y-4 p-4" data-judge-profile="">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {profile.certifications.map((cert) => (
            <Badge key={cert.label} variant="outline" title={cert.description ?? undefined}>
              {cert.label}
            </Badge>
          ))}
          {profile.stale ? <Badge variant="outline">Cached copy</Badge> : null}
        </div>
        {links}
      </div>
      {profile.note ? <p className="text-xs text-muted-foreground">{profile.note}</p> : null}
      <div className={tabsListClass} role="tablist" aria-label={`${name}'s paradigm and record`}>
        {(
          [
            ["paradigm", "Paradigm"],
            ["record", `Voting record (${profile.record.length})`],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tabsTriggerClass(tab === key)} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "paradigm" ? (
        <Paradigm profile={profile} />
      ) : profile.record.length === 0 ? (
        <p className="text-sm text-muted-foreground">No published rounds judged.</p>
      ) : (
        <div className="space-y-3">
          <RecordSummary rows={profile.record} />
          <RecordTable rows={profile.record} />
        </div>
      )}
    </div>
  );
}
