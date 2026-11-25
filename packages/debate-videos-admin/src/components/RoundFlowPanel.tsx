"use client";

/**
 * @fileoverview Admin "Hourly round flows" card: the progress of the hourly
 * job that, once an hour, takes the newest round with no flow chart yet and
 * generates its last four speeches' LLM summaries and its whole-round flow
 * chart (the watch page's "Flow chart" mind map), saved for every viewer.
 *
 * The job runs on the Worker's cron with the site's AI key; this card shows
 * how far it has got (rounds with a chart out of all rounds), which round is
 * next, and what the last runs did, and lets an admin pause it, resume it, or
 * run the next round (or a pasted one) right away
 * (`/api/admin/videos/round-flow`).
 * @module components/RoundFlowPanel
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/primitives/card";
import { Input } from "../ui/primitives/input";

/** One recorded attempt, as the route returns it. */
export interface RoundFlowRun {
  videoId: string;
  title: string;
  trigger: "cron" | "admin";
  /** Unix seconds. */
  ranAt: number;
  status: "done" | "skipped" | "failed";
  reason?: string;
  speeches: string[];
  detected: boolean;
  summaries: string[];
  flowChart: boolean;
  nodes: number;
  errors: string[];
}

interface RoundFlowStats {
  rounds: number;
  withFlowChart: number;
  paused: boolean;
  next: { videoId: string; title: string } | null;
  recent: RoundFlowRun[];
  schedule: string;
  aiConfigured: boolean;
}

/** "Wrote summaries for 2NR, 2AR; flow chart (24 bubbles)." for one attempt. */
export function describeRoundFlowRun(run: RoundFlowRun): string {
  if (run.status === "failed") return run.reason ?? run.errors[0] ?? "Failed.";
  if (run.status === "skipped") return run.reason ?? "Skipped.";
  const parts: string[] = [];
  if (run.detected) parts.push("detected speeches");
  if (run.summaries.length) parts.push(`summaries for ${run.summaries.join(", ")}`);
  if (run.flowChart) parts.push(`flow chart (${run.nodes} bubbles)`);
  const line = parts.length ? `Wrote ${parts.join("; ")}.` : "Nothing new.";
  return run.errors.length ? `${line} ${run.errors.length} step(s) failed: ${run.errors.join("; ")}` : line;
}

/** "3 min ago", "5 h ago", "2 d ago". */
export function formatRunAge(ranAt: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round(now / 1000 - ranAt));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}

/** Share of rounds done, 0–100, one decimal. */
export function roundFlowPercent(withFlowChart: number, rounds: number): number {
  if (rounds <= 0) return 0;
  return Math.min(100, Math.round((withFlowChart / rounds) * 1000) / 10);
}

/** Pulls a YouTube id out of a pasted URL, or returns the text as is. */
function videoIdFrom(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return match ? match[1] : trimmed;
}

/** How often the open card re-reads its status. */
const REFRESH_MS = 60_000;

export function RoundFlowPanel() {
  const [stats, setStats] = useState<RoundFlowStats | null>(null);
  const [busy, setBusy] = useState<"run" | "toggle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [singleVideo, setSingleVideo] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos/round-flow");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load status");
      setStats(body as RoundFlowStats);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/videos/round-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.details || body?.error || "Round flow failed");
    return body as { runs?: RoundFlowRun[]; idle?: string };
  };

  const run = async (videoId?: string) => {
    setBusy("run");
    setError(null);
    try {
      const result = await post({ action: "run", ...(videoId ? { videoId } : {}) });
      if (result.idle === "no-rounds") setError("Every round already has a flow chart.");
      if (videoId) setSingleVideo("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      void load();
    }
  };

  const togglePaused = async () => {
    if (!stats) return;
    setBusy("toggle");
    setError(null);
    try {
      await post({ action: stats.paused ? "resume" : "pause" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      void load();
    }
  };

  const percent = stats ? roundFlowPercent(stats.withFlowChart, stats.rounds) : 0;
  const disabled = busy !== null || stats?.aiConfigured === false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hourly round flows</CardTitle>
        <CardDescription>
          Every hour, the newest round that has no flow chart yet gets its last four speeches&apos; LLM
          summaries and its whole-round flow chart, reformatted into the watch page&apos;s Flow chart mind
          map. A round with no speech times gets Detect speeches first. Results are saved for every viewer,
          and nothing anyone saved is replaced. A round that fails, or has no captions, is tried again after a
          week. Each round takes up to six AI calls on the site&apos;s key.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {stats && (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-sm">
              <span>
                <span className="font-medium">{stats.withFlowChart.toLocaleString()}</span> of{" "}
                {stats.rounds.toLocaleString()} rounds have a flow chart
              </span>
              <span className="text-muted-foreground">{percent}%</span>
            </div>
            <div
              className="bg-muted h-2 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => run()} disabled={disabled || !stats?.next}>
            {busy === "run" ? "Generating…" : "Run next now"}
          </Button>
          {stats && (
            <Button variant="outline" onClick={togglePaused} disabled={busy !== null}>
              {stats.paused ? "Resume hourly runs" : "Pause hourly runs"}
            </Button>
          )}
        </div>

        {stats && (
          <p className="text-muted-foreground text-sm">
            {stats.paused ? "Paused — the hourly run is skipped until resumed." : `Runs hourly at :15 (cron ${stats.schedule}).`}
            {stats.next ? (
              <>
                {" "}Next up:{" "}
                <a className="underline" href={`/videos/watch/${stats.next.videoId}`} target="_blank" rel="noreferrer">
                  {stats.next.title || stats.next.videoId}
                </a>
                .
              </>
            ) : (
              " Every round has a flow chart."
            )}
          </p>
        )}
        {stats?.aiConfigured === false && (
          <p className="text-destructive text-sm">
            No shared AI key is configured on the server (OPENROUTER_API_KEY or ANTHROPIC_API_KEY).
          </p>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={singleVideo}
            onChange={(event) => setSingleVideo(event.target.value)}
            placeholder="One round: YouTube URL or ID"
            className="w-72"
            disabled={busy !== null}
          />
          <Button
            variant="outline"
            onClick={() => run(videoIdFrom(singleVideo))}
            disabled={disabled || !singleVideo.trim()}
          >
            Run this round
          </Button>
        </div>

        {stats && stats.recent.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Recent runs</p>
            <ul className="flex flex-col gap-1">
              {stats.recent.map((entry) => (
                <li key={`${entry.videoId}-${entry.ranAt}`} className="text-xs">
                  <span className={entry.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                    <span className="text-foreground">{formatRunAge(entry.ranAt)}</span>
                    {entry.trigger === "admin" ? " (manual)" : ""} ·{" "}
                    <a
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                      href={`/videos/watch/${entry.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {entry.title || entry.videoId}
                    </a>
                    {entry.speeches.length > 0 ? ` (${entry.speeches.join(", ")})` : ""} — {describeRoundFlowRun(entry)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
