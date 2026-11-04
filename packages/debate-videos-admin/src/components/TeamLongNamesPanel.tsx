"use client";

/**
 * @fileoverview Admin card that fills debaters' last names for round videos
 * whose teams are only initials ("Strath Haven YS" → Yang & Smith), stepping
 * `POST /api/admin/videos/team-long-names` through every season.
 * @module components/TeamLongNamesPanel
 */

import { useState } from "react";
import { Button } from "../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/primitives/card";
import { formatTeamLongNamesProgress, type TeamLongNamesProgress } from "../lib/format-team-long-names-result";

interface StepResult {
  season: number | null;
  updated: number;
  unresolved: number;
  missingTables: string[];
  nextSeason: number | null;
  seasons: number[];
}

export function TeamLongNamesPanel() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (overwrite: boolean) => {
    setRunning(true);
    setError(null);
    setProgress(null);
    const totals: TeamLongNamesProgress = { done: 0, total: 0, updated: 0, unresolved: 0, missingTables: [], finished: false };
    try {
      let season: number | null = null;
      do {
        const res = await fetch("/api/admin/videos/team-long-names", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season, overwrite }),
        });
        const data = (await res.json()) as StepResult & { error?: string; details?: string };
        if (!res.ok) throw new Error(data?.details || data?.error || "Fill failed");
        if (totals.total === 0) totals.total = data.seasons.length;
        if (data.season !== null) totals.done += 1;
        totals.updated += data.updated;
        totals.unresolved += data.unresolved;
        totals.missingTables.push(...data.missingTables);
        season = data.nextSeason;
        totals.finished = season === null;
        setProgress(formatTeamLongNamesProgress(totals));
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
        <CardTitle>Fill team last names</CardTitle>
        <CardDescription>
          For round videos whose teams are a school and two initials (&ldquo;Strath Haven YS&rdquo;),
          looks the team up in that season&rsquo;s top-team rankings (debatedata for college,
          Extinction.GG for HS policy, PF and college, 2015-16 on) and stores the two debaters&rsquo;
          last names. Tries the video&rsquo;s season, then the one before. Safe to re-run: names
          already stored and admin-edited videos are left alone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => run(false)} disabled={running} variant="outline">
            {running ? "Filling…" : "Fill team last names"}
          </Button>
          <Button onClick={() => run(true)} disabled={running} variant="ghost">
            Redo all
          </Button>
          {progress && <span className="text-muted-foreground text-sm">{progress}</span>}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
