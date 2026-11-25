"use client";

/**
 * @fileoverview Admin "Detect speeches on every round" card: one button that
 * runs the watch page's Detect speeches on every round in the library,
 * newest upload first, so each watch page opens with its speeches already
 * timed.
 *
 * The work happens on the server on OpenRouter's free router
 * (`POST /api/admin/videos/detect-speeches`, a couple of rounds per request);
 * this panel loops on the returned cursor. A round that already holds a
 * detection is skipped, never re-run or replaced. When the free router
 * rate-limits, the panel waits and retries the same round, backing off each
 * time. The cursor is kept in this browser, so a stopped, interrupted or
 * reloaded run resumes where it left off.
 * @module components/DetectSpeechesBatchPanel
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/primitives/card";

interface DetectStats {
  rounds: number;
  detected: number;
  aiConfigured: boolean;
  /** The admin's own key (Settings → General) is the one the job will use. */
  ownKey?: boolean;
}

/** One round the server ran (skipped ones are only counted). */
export interface DetectSpeechesVideoResult {
  videoId: string;
  title: string;
  publishedAt: string;
  status: "detected" | "skipped" | "failed";
  speeches: string[];
  reason?: string;
}

interface DetectPage {
  scanned: number;
  detected: number;
  skipped: number;
  failed: number;
  results: DetectSpeechesVideoResult[];
  nextAfterId: string | null;
  done: boolean;
  rateLimited: boolean;
}

/** Totals of a run, as it goes. */
export interface DetectRunProgress {
  checked: number;
  detected: number;
  skipped: number;
  failed: number;
  finished: boolean;
  stopped: boolean;
  /** Seconds left before retrying after a rate limit, while waiting. */
  waitingSeconds?: number;
}

/** "Checked 120 · detected 40 · already done or no captions 78 · failed 2" plus how it ended. */
export function formatDetectRunProgress(progress: DetectRunProgress): string {
  const parts = [
    `Checked ${progress.checked.toLocaleString()}`,
    `detected ${progress.detected.toLocaleString()}`,
    `already done or no captions ${progress.skipped.toLocaleString()}`,
  ];
  if (progress.failed > 0) parts.push(`failed ${progress.failed.toLocaleString()}`);
  const line = parts.join(" · ");
  if (progress.stopped) return `${line} — stopped. Resume picks up from here.`;
  if (progress.finished) return `${line} — done.`;
  if (progress.waitingSeconds) return `${line} — rate limited, retrying in ${progress.waitingSeconds}s…`;
  return `${line}…`;
}

/** Where the resume point is kept. */
export const DETECT_SPEECHES_CURSOR_STORAGE_KEY = "admin:detect-speeches-cursor";

/** Results kept on screen. */
const RECENT_RESULTS = 30;
/** The run stops after this many failed rounds in a row (a bad key, a broken prompt). */
const MAX_CONSECUTIVE_FAILURES = 8;
/** Pause between requests, to stay under the free router's per-minute limit. */
const PAGE_PAUSE_MS = 3000;
/** Waits after a rate limit, in seconds; the run stops after the last one. */
export const RATE_LIMIT_BACKOFF_SECONDS = [30, 60, 120, 300, 600];

function readCursor(): string | null {
  try {
    return window.localStorage.getItem(DETECT_SPEECHES_CURSOR_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeCursor(cursor: string | null): void {
  try {
    if (cursor) window.localStorage.setItem(DETECT_SPEECHES_CURSOR_STORAGE_KEY, cursor);
    else window.localStorage.removeItem(DETECT_SPEECHES_CURSOR_STORAGE_KEY);
  } catch {
    // Storage blocked: the run still works, it just can't resume after a reload.
  }
}

export function DetectSpeechesBatchPanel() {
  const [stats, setStats] = useState<DetectStats | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DetectRunProgress | null>(null);
  const [recent, setRecent] = useState<DetectSpeechesVideoResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos/detect-speeches");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load stats");
      setStats(body as DetectStats);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    setCursor(readCursor());
    void load();
  }, [load]);

  const post = async (afterId: string | null): Promise<DetectPage> => {
    const res = await fetch("/api/admin/videos/detect-speeches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ afterId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.details || body?.error || "Detect speeches failed");
    return body as DetectPage;
  };

  /** Waits `seconds`, counting down on the progress line; false when stopped. */
  const wait = async (seconds: number, totals: DetectRunProgress): Promise<boolean> => {
    for (let left = seconds; left > 0; left--) {
      if (stopRef.current) return false;
      setProgress({ ...totals, waitingSeconds: left });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setProgress({ ...totals, waitingSeconds: undefined });
    return !stopRef.current;
  };

  /** Walks every round from `from` (or the newest) until done or stopped. */
  const runAll = async (from: string | null) => {
    stopRef.current = false;
    setRunning(true);
    setError(null);
    const totals: DetectRunProgress = { checked: 0, detected: 0, skipped: 0, failed: 0, finished: false, stopped: false };
    setProgress({ ...totals });
    let afterId = from;
    let consecutiveFailures = 0;
    let rateLimits = 0;
    try {
      for (;;) {
        const page = await post(afterId);
        totals.checked += page.scanned;
        totals.detected += page.detected;
        totals.skipped += page.skipped;
        totals.failed += page.failed;
        if (page.results.length) {
          setRecent((current) => [...[...page.results].reverse(), ...current].slice(0, RECENT_RESULTS));
        }
        consecutiveFailures = page.detected > 0 ? 0 : consecutiveFailures + page.failed;
        afterId = page.nextAfterId;
        writeCursor(page.done ? null : afterId);
        setCursor(page.done ? null : afterId);
        setProgress({ ...totals });
        if (page.done) break;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          totals.stopped = true;
          setError(`Stopped after ${MAX_CONSECUTIVE_FAILURES} failed rounds in a row. Check the reasons below, then Resume.`);
          break;
        }
        if (stopRef.current) {
          totals.stopped = true;
          break;
        }
        if (page.rateLimited) {
          if (page.detected > 0) rateLimits = 0;
          if (rateLimits >= RATE_LIMIT_BACKOFF_SECONDS.length) {
            totals.stopped = true;
            setError("The free AI router keeps rate-limiting (it may be its daily cap). Resume later.");
            break;
          }
          if (!(await wait(RATE_LIMIT_BACKOFF_SECONDS[rateLimits++], totals))) {
            totals.stopped = true;
            break;
          }
          continue;
        }
        rateLimits = 0;
        await new Promise((resolve) => setTimeout(resolve, PAGE_PAUSE_MS));
      }
      totals.finished = !totals.stopped;
      setProgress({ ...totals });
    } catch (err) {
      totals.stopped = true;
      setProgress({ ...totals });
      setError(`${(err as Error).message} Resume picks up from the last round that finished.`);
    } finally {
      setRunning(false);
      void load();
    }
  };

  const startOver = () => {
    writeCursor(null);
    setCursor(null);
    setProgress(null);
  };

  const disabled = running || stats?.aiConfigured === false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detect speeches on every round</CardTitle>
        <CardDescription>
          Runs the watch page&apos;s Detect speeches on every round in the library, newest upload first,
          and saves the speech times for every viewer. Rounds that already have a detection, or have no
          captions, are skipped; nothing anyone saved is replaced. Uses only OpenRouter&apos;s free router
          (one AI call per round), and waits and retries when it is rate-limited.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {cursor ? (
            <>
              <Button onClick={() => runAll(cursor)} disabled={disabled}>
                {running ? "Detecting…" : "Resume"}
              </Button>
              <Button variant="outline" onClick={startOver} disabled={running}>
                Start over from newest
              </Button>
            </>
          ) : (
            <Button onClick={() => runAll(null)} disabled={disabled}>
              {running ? "Detecting…" : "Detect speeches on all rounds"}
            </Button>
          )}
          {running && (
            <Button variant="outline" onClick={() => (stopRef.current = true)}>
              Stop
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Order: most recently uploaded first.
          {cursor && !running ? ` Paused after ${cursor}.` : ""}
        </p>
        {stats && (
          <p className="text-muted-foreground text-sm">
            {stats.detected.toLocaleString()} of {stats.rounds.toLocaleString()} rounds have detected speeches
          </p>
        )}
        {stats?.ownKey && (
          <p className="text-muted-foreground text-sm">Using your own AI key from Settings → General.</p>
        )}
        {stats?.aiConfigured === false && (
          <p className="text-destructive text-sm">No OpenRouter key: add your own in Settings → General, or set OPENROUTER_API_KEY on the server.</p>
        )}
        {progress && <p className="text-muted-foreground text-sm">{formatDetectRunProgress(progress)}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}

        {recent.length > 0 && (
          <ul className="flex flex-col gap-1">
            {recent.map((result, index) => (
              <li key={`${result.videoId}-${index}`} className="text-xs">
                <span className={result.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                  <span className="font-medium text-foreground">{result.title || result.videoId}</span>
                  {result.publishedAt ? ` (${result.publishedAt.slice(0, 10)})` : ""} —{" "}
                  {result.status === "failed"
                    ? (result.reason ?? "Failed.")
                    : `Detected ${result.speeches.length} speeches${result.speeches.length ? `: ${result.speeches.join(", ")}` : ""}.`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
