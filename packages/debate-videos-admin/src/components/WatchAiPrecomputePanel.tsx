"use client";

/**
 * @fileoverview Admin "Watch page AI" toolkit: one button that runs the
 * watch page's AI over every round ahead of time, so readers open each round
 * with its last three speeches (in policy the 1AR, 2NR and 2AR) already
 * summarized and their Alternatives (alternative responses with predicted
 * ballots) already simulated.
 *
 * The work happens on the server with the site's AI key
 * (`POST /api/admin/videos/watch-ai`, one round per request); this panel
 * loops on the returned cursor. A round that already has its results is
 * skipped, never re-run or replaced. The cursor is kept in this browser per
 * scope, so a stopped or interrupted run resumes where it left off.
 * @module components/WatchAiPrecomputePanel
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/primitives/card";
import { Input } from "../ui/primitives/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/primitives/select";

type Scope = "goat" | "all";

interface WatchAiStats {
  scope: Scope;
  rounds: number;
  withAlternatives: number;
  withSummaries: number;
  aiConfigured: boolean;
}

/** One round the server ran (skipped ones are only counted). */
export interface WatchAiVideoResult {
  videoId: string;
  title: string;
  status: "done" | "skipped" | "failed";
  reason?: string;
  speeches: string[];
  detected: boolean;
  summaries: string[];
  outcomes: string[];
  errors: string[];
}

interface WatchAiPage {
  scanned: number;
  processed: number;
  skipped: number;
  failed: number;
  results: WatchAiVideoResult[];
  nextAfterId: string | null;
  done: boolean;
}

/** Totals of a run, as it goes. */
export interface WatchAiRunProgress {
  checked: number;
  generated: number;
  skipped: number;
  failed: number;
  finished: boolean;
  stopped: boolean;
}

/** "Checked 40 · generated 12 · already done 26 · failed 2" plus how it ended. */
export function formatWatchAiRunProgress(progress: WatchAiRunProgress): string {
  const parts = [
    `Checked ${progress.checked.toLocaleString()}`,
    `generated ${progress.generated.toLocaleString()}`,
    `already done ${progress.skipped.toLocaleString()}`,
  ];
  if (progress.failed > 0) parts.push(`failed ${progress.failed.toLocaleString()}`);
  const line = parts.join(" · ");
  if (progress.stopped) return `${line} — stopped. Resume picks up from here.`;
  if (progress.finished) return `${line} — done.`;
  return `${line}…`;
}

/** "2AR: summary, alternatives" lines for one round. */
export function describeWatchAiResult(result: WatchAiVideoResult): string {
  if (result.status === "failed") return result.reason ?? result.errors[0] ?? "Failed.";
  const parts: string[] = [];
  if (result.detected) parts.push("detected speeches");
  if (result.summaries.length) parts.push(`summaries for ${result.summaries.join(", ")}`);
  if (result.outcomes.length) parts.push(`alternatives for ${result.outcomes.join(", ")}`);
  const line = parts.length ? `Wrote ${parts.join("; ")}.` : (result.reason ?? "Nothing new.");
  return result.errors.length ? `${line} ${result.errors.length} step(s) failed: ${result.errors.join("; ")}` : line;
}

const SCOPE_LABELS: Record<Scope, string> = {
  goat: "Greatest of All-Time rounds",
  all: "Every round",
};

/** Where each scope's resume point is kept. */
export const WATCH_AI_CURSOR_STORAGE_KEY = "admin:watch-ai-cursor";

/** Results kept on screen. */
const RECENT_RESULTS = 30;
/** The run stops after this many failed rounds in a row (a missing key, a rate limit). */
const MAX_CONSECUTIVE_FAILURES = 5;

function readCursor(scope: Scope): string | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(WATCH_AI_CURSOR_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    return typeof stored[scope] === "string" ? (stored[scope] as string) : null;
  } catch {
    return null;
  }
}

function writeCursor(scope: Scope, cursor: string | null): void {
  try {
    const stored = JSON.parse(window.localStorage.getItem(WATCH_AI_CURSOR_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    if (cursor) stored[scope] = cursor;
    else delete stored[scope];
    window.localStorage.setItem(WATCH_AI_CURSOR_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage blocked: the run still works, it just can't resume after a reload.
  }
}

/** Pulls a YouTube id out of a pasted URL, or returns the text as is. */
function videoIdFrom(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return match ? match[1] : trimmed;
}

export function WatchAiPrecomputePanel() {
  const [scope, setScope] = useState<Scope>("goat");
  const [stats, setStats] = useState<WatchAiStats | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<WatchAiRunProgress | null>(null);
  const [recent, setRecent] = useState<WatchAiVideoResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [singleVideo, setSingleVideo] = useState("");
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/videos/watch-ai?scope=${scope}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load stats");
      setStats(body as WatchAiStats);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [scope]);

  useEffect(() => {
    setCursor(readCursor(scope));
    void load();
  }, [scope, load]);

  const post = async (payload: Record<string, unknown>): Promise<WatchAiPage> => {
    const res = await fetch("/api/admin/videos/watch-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, ...payload }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.details || body?.error || "Watch page AI failed");
    return body as WatchAiPage;
  };

  const record = (results: WatchAiVideoResult[]) => {
    if (results.length) setRecent((current) => [...results.reverse(), ...current].slice(0, RECENT_RESULTS));
  };

  /** Walks every round in scope from `from` (or the start) until done or stopped. */
  const runAll = async (from: string | null) => {
    stopRef.current = false;
    setRunning(true);
    setError(null);
    const totals: WatchAiRunProgress = { checked: 0, generated: 0, skipped: 0, failed: 0, finished: false, stopped: false };
    setProgress({ ...totals });
    let afterId = from;
    let consecutiveFailures = 0;
    try {
      for (;;) {
        const page = await post({ afterId });
        totals.checked += page.scanned;
        totals.generated += page.processed;
        totals.skipped += page.skipped;
        totals.failed += page.failed;
        record([...page.results]);
        consecutiveFailures = page.processed > 0 ? 0 : consecutiveFailures + page.failed;
        afterId = page.nextAfterId;
        writeCursor(scope, page.done ? null : afterId);
        setCursor(page.done ? null : afterId);
        setProgress({ ...totals });
        if (page.done || !afterId) break;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          totals.stopped = true;
          setError(`Stopped after ${MAX_CONSECUTIVE_FAILURES} failed rounds in a row. Check the reasons below, then Resume.`);
          break;
        }
        if (stopRef.current) {
          totals.stopped = true;
          break;
        }
      }
      totals.finished = !totals.stopped;
      setProgress({ ...totals });
    } catch (err) {
      setError(`${(err as Error).message} Resume picks up from the last round that finished.`);
    } finally {
      setRunning(false);
      void load();
    }
  };

  const runOne = async () => {
    const videoId = videoIdFrom(singleVideo);
    if (!videoId) return;
    setRunning(true);
    setError(null);
    try {
      const page = await post({ videoId });
      if (page.results.length === 0) {
        record([{ videoId, title: videoId, status: "skipped", reason: "Already pre-generated, or not a round.", speeches: [], detected: false, summaries: [], outcomes: [], errors: [] }]);
      } else record([...page.results]);
      void load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const startOver = () => {
    writeCursor(scope, null);
    setCursor(null);
    setProgress(null);
  };

  const disabled = running || stats?.aiConfigured === false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch page AI</CardTitle>
        <CardDescription>
          Pre-generates what readers would otherwise wait for on the watch page: for each round&apos;s last
          three speeches (in policy the 1AR, 2NR and 2AR), the LLM summary and the Alternatives run, with
          the default flow judge. A round with no speech times gets Detect speeches first. Results are
          saved for every viewer, exactly as a reader&apos;s own run would be. Rounds that already have
          them are skipped, and nothing anyone saved is replaced. Each round takes up to seven AI calls on
          the site&apos;s key.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={scope} onValueChange={(value) => setScope(value as Scope)} disabled={running}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SCOPE_LABELS) as Scope[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SCOPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cursor ? (
            <>
              <Button onClick={() => runAll(cursor)} disabled={disabled}>
                {running ? "Generating…" : "Resume"}
              </Button>
              <Button variant="outline" onClick={startOver} disabled={running}>
                Start over
              </Button>
            </>
          ) : (
            <Button onClick={() => runAll(null)} disabled={disabled}>
              {running ? "Generating…" : `Generate for ${SCOPE_LABELS[scope].toLowerCase()}`}
            </Button>
          )}
          {running && (
            <Button variant="outline" onClick={() => (stopRef.current = true)}>
              Stop after this round
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Order: Greatest of All-Time first, then most viewed.
          {cursor && !running ? ` Paused at ${cursor}.` : ""}
        </p>
        {stats && (
          <p className="text-muted-foreground text-sm">
            {stats.rounds.toLocaleString()} rounds · {stats.withSummaries.toLocaleString()} with summaries ·{" "}
            {stats.withAlternatives.toLocaleString()} with alternatives
          </p>
        )}
        {stats?.aiConfigured === false && (
          <p className="text-destructive text-sm">
            No shared AI key is configured on the server (OPENROUTER_API_KEY or ANTHROPIC_API_KEY).
          </p>
        )}
        {progress && <p className="text-muted-foreground text-sm">{formatWatchAiRunProgress(progress)}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={singleVideo}
            onChange={(event) => setSingleVideo(event.target.value)}
            placeholder="One round: YouTube URL or ID"
            className="w-72"
            disabled={running}
          />
          <Button variant="outline" onClick={runOne} disabled={disabled || !singleVideo.trim()}>
            Generate for this round
          </Button>
        </div>

        {recent.length > 0 && (
          <ul className="flex flex-col gap-1">
            {recent.map((result, index) => (
              <li key={`${result.videoId}-${index}`} className="text-xs">
                <span className={result.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                  <span className="font-medium text-foreground">{result.title || result.videoId}</span>
                  {result.speeches.length > 0 ? ` (${result.speeches.join(", ")})` : ""} — {describeWatchAiResult(result)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
