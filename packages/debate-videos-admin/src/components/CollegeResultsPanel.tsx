"use client";

/**
 * @fileoverview Admin card that looks every college round up on College
 * Debate Results and saves its winner, ballot count, judges and squirrels,
 * stepping `POST /api/admin/videos/college-results` one small batch at a time
 * until nothing remains.
 * @module components/CollegeResultsPanel
 */

import { useRef, useState } from "react";
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

export function CollegeResultsPanel() {
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
      </CardContent>
    </Card>
  );
}
