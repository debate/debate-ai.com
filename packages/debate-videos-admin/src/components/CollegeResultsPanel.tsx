"use client";

/**
 * @fileoverview Admin card that looks every college round up on College
 * Debate Results and saves its winner, ballot count, judges and squirrels,
 * stepping `POST /api/admin/videos/college-results` one small batch at a time
 * until nothing remains.
 * @module components/CollegeResultsPanel
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/primitives/card";

interface StepResult {
  checked: number;
  statuses: Record<string, number>;
  winnersFilled: number;
  decisionsFilled: number;
  remaining: number;
  total: number;
}

/** Running totals across the batches of one run. */
export interface CollegeResultsProgress {
  checked: number;
  statuses: Record<string, number>;
  winnersFilled: number;
  decisionsFilled: number;
  remaining: number;
  finished: boolean;
  stopped: boolean;
}

const STATUS_LABELS: [string, string][] = [
  ["verified", "found with a decision"],
  ["winner_not_explicit", "found without a decision"],
  ["conflict", "disagree with the saved winner"],
  ["not_found", "not found"],
  ["ambiguous", "ambiguous, skipped"],
  ["error", "failed"],
];

/** `"Done: 1,480 checked — 1,201 found with a decision, … 640 winners and 702 ballot counts filled."` */
export function formatCollegeResultsProgress(p: CollegeResultsProgress): string {
  const head = p.finished
    ? `Done: ${p.checked.toLocaleString()} checked`
    : p.stopped
      ? `Stopped after ${p.checked.toLocaleString()} (${p.remaining.toLocaleString()} left — press again to continue)`
      : `${p.checked.toLocaleString()} checked, ${p.remaining.toLocaleString()} to go`;
  const parts = STATUS_LABELS.filter(([key]) => p.statuses[key]).map(
    ([key, label]) => `${p.statuses[key].toLocaleString()} ${label}`,
  );
  const fills = `${p.winnersFilled.toLocaleString()} winner${p.winnersFilled === 1 ? "" : "s"} and ${p.decisionsFilled.toLocaleString()} ballot count${p.decisionsFilled === 1 ? "" : "s"} filled`;
  return `${head}${parts.length ? ` — ${parts.join(", ")}` : ""}. ${fills}.`;
}

/** A round the lookup couldn't settle, from `GET /api/admin/videos/college-results`. */
export interface UnsettledRound {
  videoId: string;
  title: string;
  tournament: string | null;
  roundLevel: string | null;
  affTeam: string | null;
  negTeam: string | null;
  seasonYear: number | null;
  status: string;
}

/** The lists the card can show, each one lookup outcome. */
const LISTS: [status: string, label: string][] = [
  ["not_found", "Not found"],
  ["ambiguous", "Ambiguous"],
  ["conflict", "Conflicts"],
  ["winner_not_explicit", "No decision"],
  ["error", "Failed"],
];

/** `2027` → `"2026-27"`, the season a video's `season_year` closes. */
const seasonLabel = (year: number | null) => (year ? `${year - 1}-${String(year).slice(-2)}` : "");

/** The rounds whose last lookup ended in one status, each linking to its watch page. */
function UnsettledList({ status }: { status: string }) {
  const [state, setState] = useState<{ rows: UnsettledRound[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setState(null);
    setError(null);
    fetch(`/api/admin/videos/college-results?status=${encodeURIComponent(status)}`)
      .then(async (res) => {
        const data = (await res.json()) as { rows?: UnsettledRound[]; total?: number; error?: string };
        if (!res.ok) throw new Error(data?.error || "Could not load the list");
        if (live) setState({ rows: data.rows ?? [], total: data.total ?? 0 });
      })
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [status]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!state) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (state.rows.length === 0) return <p className="text-muted-foreground text-sm">None.</p>;
  return (
    <div className="flex flex-col gap-1" data-testid="college-results-list">
      <p className="text-muted-foreground text-xs">
        {state.total.toLocaleString()} round{state.total === 1 ? "" : "s"}
        {state.total > state.rows.length ? `, showing the first ${state.rows.length.toLocaleString()}` : ""}. Open one to fix its
        tournament, round or team codes, then use &ldquo;Look up results&rdquo; in its edit dialog.
      </p>
      <ul className="max-h-96 overflow-y-auto rounded border text-sm divide-y">
        {state.rows.map((row) => (
          <li key={row.videoId} className="flex flex-wrap items-baseline gap-x-2 px-2 py-1">
            <span className="text-muted-foreground text-xs tabular-nums">{seasonLabel(row.seasonYear)}</span>
            <span className="font-medium">
              {row.tournament}
              {row.roundLevel ? ` · ${row.roundLevel}` : ""}
            </span>
            <span>
              {row.affTeam} vs {row.negTeam}
            </span>
            <a
              href={`/videos/watch/${encodeURIComponent(row.videoId)}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground min-w-0 truncate text-xs underline"
              title={row.title}
            >
              {row.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CollegeResultsPanel() {
  const [list, setList] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  /** `recheck` revisits every round; otherwise only rounds never checked (resumes a stopped run). */
  const run = async (recheck: boolean) => {
    setRunning(true);
    setError(null);
    setProgress(null);
    stopRef.current = false;
    const since = recheck ? Math.floor(Date.now() / 1000) : 0;
    const totals: CollegeResultsProgress = {
      checked: 0,
      statuses: {},
      winnersFilled: 0,
      decisionsFilled: 0,
      remaining: 0,
      finished: false,
      stopped: false,
    };
    try {
      for (;;) {
        const res = await fetch("/api/admin/videos/college-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ since }),
        });
        const data = (await res.json()) as StepResult & { error?: string; details?: string };
        if (!res.ok) throw new Error(data?.details || data?.error || "Lookup failed");
        totals.checked += data.checked;
        totals.winnersFilled += data.winnersFilled;
        totals.decisionsFilled += data.decisionsFilled;
        for (const [key, n] of Object.entries(data.statuses ?? {})) totals.statuses[key] = (totals.statuses[key] ?? 0) + n;
        totals.remaining = data.remaining;
        totals.finished = data.remaining === 0 || data.checked === 0;
        totals.stopped = !totals.finished && stopRef.current;
        setProgress(formatCollegeResultsProgress(totals));
        if (totals.finished || totals.stopped) break;
      }
    } catch (err) {
      setError(`${(err as Error).message} — press "Look up college results" to pick up where it stopped.`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Look up college results</CardTitle>
        <CardDescription>
          Finds every college round on College Debate Results and saves the judges and who squirreled
          (judges in the minority), plus the winner and ballot count where the video has none. A winner
          is only taken from the site&rsquo;s recorded decision; ambiguous tournaments and pairings are
          skipped, and a saved winner the site disagrees with is flagged, not overwritten. Runs about ten
          rounds per request, gently paced; it picks up where it stopped if you leave the page.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => run(false)} disabled={running} variant="outline">
            {running ? "Looking up…" : "Look up college results"}
          </Button>
          <Button onClick={() => run(true)} disabled={running} variant="ghost" title="Check every college round again, including ones already looked up">
            Recheck all
          </Button>
          {running && (
            <Button onClick={() => (stopRef.current = true)} variant="ghost">
              Stop
            </Button>
          )}
        </div>
        {progress && <p className="text-muted-foreground text-sm">{progress}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Show rounds:</span>
          {LISTS.map(([status, label]) => (
            <Button
              key={status}
              size="sm"
              variant={list === status ? "secondary" : "ghost"}
              aria-pressed={list === status}
              onClick={() => setList((current) => (current === status ? null : status))}
            >
              {label}
            </Button>
          ))}
        </div>
        {list && <UnsettledList key={`${list}-${running}`} status={list} />}
      </CardContent>
    </Card>
  );
}
