"use client";

/**
 * @fileoverview Admin card that fills every video's computed title
 * ("2026 Harvard Quarters: Iowa #6 Eltyeb & Weimar vs Emory #1 Gallagher &
 * Young"), stepping `POST /api/admin/videos/computed-titles` through every
 * season.
 * @module components/ComputedTitlesPanel
 */

import { useState } from "react";
import { Button } from "../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/primitives/card";
import { formatComputedTitlesProgress, type ComputedTitlesProgress } from "../lib/format-computed-titles-result";

interface StepResult {
  season: number | null;
  updated: number;
  titled: number;
  ranked: number;
  missingTables: string[];
  nextSeason: number | null;
  seasons: number[];
}

export function ComputedTitlesPanel() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setProgress(null);
    const totals: ComputedTitlesProgress = { done: 0, total: 0, updated: 0, titled: 0, ranked: 0, missingTables: [], finished: false };
    try {
      let season: number | null = null;
      do {
        const res = await fetch("/api/admin/videos/computed-titles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season }),
        });
        const data = (await res.json()) as StepResult & { error?: string; details?: string };
        if (!res.ok) throw new Error(data?.details || data?.error || "Fill failed");
        if (totals.total === 0) totals.total = data.seasons.length;
        if (data.season !== null) totals.done += 1;
        totals.updated += data.updated;
        totals.titled += data.titled;
        totals.ranked += data.ranked;
        totals.missingTables.push(...data.missingTables);
        season = data.nextSeason;
        totals.finished = season === null;
        setProgress(formatComputedTitlesProgress(totals));
      } while (season !== null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fill computed titles</CardTitle>
        <CardDescription>
          Gives every round its standardized title: year, tournament, round, then each team as school,
          rank in that season&rsquo;s rankings and the debaters&rsquo; full last names, plus the argument
          it ran when known (&ldquo;2026 Harvard Quarters: Iowa #6 Eltyeb &amp; Weimar vs Emory #1
          Gallagher &amp; Young&rdquo;). The site shows it in place of the YouTube title. Safe to re-run;
          run it again after a sync or after filling team last names to pick up new ranks and names.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={running} variant="outline">
            {running ? "Filling…" : "Fill computed titles"}
          </Button>
          {progress && <span className="text-muted-foreground text-sm">{progress}</span>}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
