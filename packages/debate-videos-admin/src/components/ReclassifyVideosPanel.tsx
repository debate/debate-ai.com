"use client";

import { useState } from "react";
import { Button } from "../ui/primitives/button";
import { Input } from "../ui/primitives/input";
import { Label } from "../ui/primitives/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/primitives/card";

const STYLES = [
  { value: 1, label: "Policy" },
  { value: 2, label: "Public Forum" },
  { value: 3, label: "Lincoln-Douglas" },
  { value: 4, label: "College" },
  { value: 5, label: "World Schools (WSD)" },
  { value: 6, label: "ACC" },
  { value: 7, label: "Misc" },
];

/** One page of `POST /api/admin/videos/reclassify`. */
interface ReclassifyPage {
  updated: unknown[];
  failed: unknown[];
  queueUpdated: number;
  nextCursor: string | null;
}

/**
 * Re-files every library video whose title contains a phrase under one debate
 * style, and optionally re-runs the AI round-info extraction on each. Drives
 * `POST /api/admin/videos/reclassify` page by page until it reports no
 * `nextCursor`. Defaults to the Dartmouth RR fix: those rounds are college but
 * their titles name no format, so the title parser filed them as Policy.
 */
export function ReclassifyVideosPanel() {
  const [match, setMatch] = useState("Dartmouth RR");
  const [style, setStyle] = useState(4);
  const [parseRoundInfo, setParseRoundInfo] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    let after: string | null = null;
    let updated = 0;
    let failed = 0;
    let queued = 0;
    try {
      do {
        const res: Response = await fetch("/api/admin/videos/reclassify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ match, style, parseRoundInfo, after }),
        });
        const data: ReclassifyPage & { error?: string; details?: string } = await res.json();
        if (!res.ok) throw new Error(data?.details || data?.error || "Reclassify failed");
        updated += data.updated.length;
        failed += data.failed.length;
        queued += data.queueUpdated;
        after = data.nextCursor;
        setProgress(
          `${updated} videos updated${failed ? `, ${failed} AI parses failed` : ""}${queued ? `, ${queued} queued rounds restyled` : ""}${after ? "…" : "."}`,
        );
      } while (after);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reclassify videos by title</CardTitle>
        <CardDescription>
          Sets the debate style of every library video whose title contains the phrase, and can
          re-run the AI round-info parse (tournament, round, teams, decision) on each. Fields the
          AI can&apos;t read from the title keep their current value.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="reclassify-match">Title contains</Label>
            <Input id="reclassify-match" value={match} onChange={(e) => setMatch(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="reclassify-style">Style</Label>
            <select
              id="reclassify-style"
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={style}
              onChange={(e) => setStyle(Number(e.target.value))}
            >
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={parseRoundInfo}
              onChange={(e) => setParseRoundInfo(e.target.checked)}
            />
            Parse round info with AI
          </label>
          <Button onClick={run} disabled={running || match.trim().length < 3} variant="outline">
            {running ? "Reclassifying…" : "Reclassify"}
          </Button>
        </div>
        {progress && <p className="text-muted-foreground text-sm">{progress}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
