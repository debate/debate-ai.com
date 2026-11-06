"use client";

/**
 * @fileoverview Admin card that removes the year from every saved tournament
 * name (`"2024 TOC"` → `"TOC"`) in the video library and the resync queue,
 * calling `POST /api/admin/videos/tournament-years` until no name is left.
 * The daily cron runs the same job, so this is only for doing it now.
 * @module components/TournamentYearsPanel
 */

import { useState } from "react";
import { Button } from "../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/primitives/card";

interface StepResult {
  renamed: number;
  rows: number;
  remaining: number;
  examples: Array<{ from: string; to: string | null }>;
}

/** Most calls one click makes, so a server that never reaches 0 can't loop forever. */
const MAX_STEPS = 50;

export function TournamentYearsPanel() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setProgress(null);
    let renamed = 0;
    let rows = 0;
    let example: StepResult["examples"][number] | undefined;
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const res = await fetch("/api/admin/videos/tournament-years", { method: "POST" });
        const data = (await res.json()) as StepResult & { error?: string; details?: string };
        if (!res.ok) throw new Error(data?.details || data?.error || "Cleanup failed");
        renamed += data.renamed;
        rows += data.rows;
        example ??= data.examples[0];
        const done = data.remaining === 0 || data.renamed === 0;
        const sample = example ? ` (e.g. “${example.from}” → “${example.to ?? "blank"}”)` : "";
        setProgress(
          renamed === 0
            ? "Every tournament name is already saved without a year."
            : `${done ? "Done:" : "Working…"} ${renamed.toLocaleString()} name${renamed === 1 ? "" : "s"} on ${rows.toLocaleString()} video${rows === 1 ? "" : "s"}${sample}${done ? "." : `, ${data.remaining.toLocaleString()} left`}`,
        );
        if (done) break;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remove years from tournament names</CardTitle>
        <CardDescription>
          Saves every tournament name without its year (&ldquo;2024 TOC&rdquo; &rarr; &ldquo;TOC&rdquo;,
          &ldquo;Wake Forest 2009&rdquo; &rarr; &ldquo;Wake Forest&rdquo;) in the video library and the
          resync queue; the season column already holds the year. New rounds, edits and auto-fill are
          saved this way on their own, and the daily cron runs this too. Safe to re-run.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={running} variant="outline">
            {running ? "Removing…" : "Remove years"}
          </Button>
          {progress && <span className="text-muted-foreground text-sm">{progress}</span>}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
