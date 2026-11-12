"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../../ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../ui/primitives/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../ui/primitives/select";

/** apps/debate-web/app/api/admin/debate-cards/extract-sources/route.ts */
const API = "/api/admin/debate-cards/extract-sources";
/** Where a stopped run picks up, per year/format filter. */
const CURSOR_KEY = "admin:card-sources-cursor";
/** Stop after this many failed requests in a row instead of hammering a broken endpoint. */
const MAX_CONSECUTIVE_ERRORS = 5;
/** Re-count the chart every this many pages while running. */
const STATS_EVERY_PAGES = 5;

const ALL = "all";

interface Stats {
  total: number;
  withUrl: number;
  extracted: number;
  viaCite: number;
  viaSearch: number;
  notFound: number;
  failed: number;
  years: number[];
  events: string[];
}

interface PageResult {
  cardId: number;
  status: "extracted" | "not_found" | "failed";
  via: "cite" | "search" | "";
  url: string;
  title?: string;
  wordCount: number;
  matchScore?: number;
  error?: string;
}

interface RunProgress {
  processed: number;
  extracted: number;
  viaCite: number;
  viaSearch: number;
  notFound: number;
  failed: number;
}

const EMPTY_RUN: RunProgress = { processed: 0, extracted: 0, viaCite: 0, viaSearch: 0, notFound: 0, failed: 0 };

const EVENT_LABELS: Record<string, string> = { cx: "Policy", policy: "Policy", ld: "Lincoln-Douglas", pf: "Public Forum" };

function eventLabel(event: string): string {
  return EVENT_LABELS[event.toLowerCase()] ?? event.toUpperCase();
}

/** Caselist years name the season they start: 2025 is 2025–26. */
function seasonLabel(year: number): string {
  return `${year}–${String((year + 1) % 100).padStart(2, "0")}`;
}

function percent(part: number, whole: number): string {
  if (!whole) return "0%";
  const value = (part / whole) * 100;
  return `${value < 10 && value > 0 ? value.toFixed(1) : Math.round(value)}%`;
}

function cursorKey(year: string, event: string, retryFailed: boolean): string {
  return `${year}|${event}|${retryFailed ? "retry" : "new"}`;
}

function readCursors(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(CURSOR_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writeCursor(key: string, afterId: number | null): void {
  try {
    const cursors = readCursors();
    if (afterId === null) delete cursors[key];
    else cursors[key] = afterId;
    window.localStorage.setItem(CURSOR_KEY, JSON.stringify(cursors));
  } catch {
    // Without storage a stopped run restarts from the first card, which only costs a re-scan.
  }
}

/** One bar of the chart: a track with stacked, labelled segments. */
function ProgressBar({
  label,
  segments,
  total,
}: {
  label: string;
  segments: Array<{ label: string; value: number; className: string }>;
  total: number;
}) {
  const done = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {done.toLocaleString()} / {total.toLocaleString()} · {percent(done, total)}
        </span>
      </div>
      <div
        className="bg-muted flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${label}: ${percent(done, total)}`}
      >
        {segments.map((segment) =>
          segment.value > 0 && total > 0 ? (
            <div
              key={segment.label}
              className={segment.className}
              style={{ width: `${Math.max(0.5, (segment.value / total) * 100)}%` }}
              title={`${segment.label}: ${segment.value.toLocaleString()}`}
            />
          ) : null,
        )}
      </div>
      {segments.length > 1 && (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {segments.map((segment) => (
            <span key={segment.label} className="flex items-center gap-1.5">
              <span className={`inline-block size-2 rounded-full ${segment.className}`} />
              {segment.label} {segment.value.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Admin → Debate cards → Original sources. Charts how many cards cite a URL
 * and how many have had their original source text extracted (filterable by
 * season and format), and runs the extraction: the cited URL through
 * QwkSearch's article extractor, or — for a card with no URL — the best
 * QwkSearch match for its citation. Stoppable; a stopped run resumes where it
 * left off, and finished cards are never redone.
 */
export function CardSourceExtractionPanel() {
  const [year, setYear] = useState(ALL);
  const [event, setEvent] = useState(ALL);
  const [retryFailed, setRetryFailed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [run, setRun] = useState<RunProgress | null>(null);
  const [recent, setRecent] = useState<PageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedCursor, setSavedCursor] = useState(0);
  const stopRef = useRef(false);

  const filterBody = useCallback(
    () => ({ year: year === ALL ? undefined : Number(year), event: event === ALL ? undefined : event }),
    [year, event],
  );

  const loadStats = useCallback(async () => {
    const params = new URLSearchParams();
    if (year !== ALL) params.set("year", year);
    if (event !== ALL) params.set("event", event);
    try {
      const res = await fetch(`${API}?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || "Counting cards failed");
      setStats(data as Stats);
      setStatsError(null);
    } catch (err) {
      setStatsError((err as Error).message);
    }
  }, [year, event]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    setSavedCursor(readCursors()[cursorKey(year, event, retryFailed)] ?? 0);
  }, [year, event, retryFailed]);

  const handleRun = async (fromStart: boolean) => {
    const key = cursorKey(year, event, retryFailed);
    let afterId = fromStart ? 0 : (readCursors()[key] ?? 0);
    stopRef.current = false;
    setStopRequested(false);
    setIsRunning(true);
    setError(null);
    setRun({ ...EMPTY_RUN });
    setRecent([]);
    let pages = 0;
    let consecutiveErrors = 0;
    try {
      while (!stopRef.current) {
        let data: { done: boolean; nextAfterId: number; results: PageResult[] } & RunProgress;
        try {
          const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ afterId, retryFailed, ...filterBody() }),
          });
          data = await res.json();
          if (!res.ok) throw new Error((data as any)?.details || (data as any)?.error || `HTTP ${res.status}`);
          consecutiveErrors = 0;
        } catch (err) {
          consecutiveErrors += 1;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) throw err;
          setError(`${(err as Error).message} — retrying (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);
          await new Promise((resolve) => setTimeout(resolve, 2_000 * consecutiveErrors));
          continue;
        }
        setError(null);
        afterId = data.nextAfterId;
        setRun((current) => {
          const base = current ?? EMPTY_RUN;
          return {
            processed: base.processed + data.processed,
            extracted: base.extracted + data.extracted,
            viaCite: base.viaCite + data.viaCite,
            viaSearch: base.viaSearch + data.viaSearch,
            notFound: base.notFound + data.notFound,
            failed: base.failed + data.failed,
          };
        });
        setRecent((current) => [...data.results.slice().reverse(), ...current].slice(0, 12));
        if (data.done) {
          writeCursor(key, null);
          setSavedCursor(0);
          break;
        }
        writeCursor(key, afterId);
        setSavedCursor(afterId);
        pages += 1;
        if (pages % STATS_EVERY_PAGES === 0) void loadStats();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRunning(false);
      void loadStats();
    }
  };

  const total = stats?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Original sources</CardTitle>
        <CardDescription>
          Pulls the full text of the article, paper or report each parsed card was cut from. A card that
          cites a URL is read from that page through the QwkSearch extractor; a card with no URL (or a dead
          one) is searched for on QwkSearch by its citation — the quoted title and author when it has them —
          and the result whose text holds the most of the card&apos;s own words is kept. The text is stored in
          the <code>CARD_TEXT</code> R2 bucket under <code>card-sources/</code>. Cards already done are
          skipped, so the run can be stopped and resumed at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={year} onValueChange={setYear} disabled={isRunning}>
            <SelectTrigger className="w-[150px]" aria-label="Season">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All years</SelectItem>
              {(stats?.years ?? []).map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {seasonLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={event} onValueChange={setEvent} disabled={isRunning}>
            <SelectTrigger className="w-[180px]" aria-label="Format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All formats</SelectItem>
              {(stats?.events ?? []).map((value) => (
                <SelectItem key={value} value={value}>
                  {eventLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => void loadStats()} disabled={isRunning}>
            Refresh
          </Button>
        </div>

        {stats ? (
          <div className="flex flex-col gap-4">
            <ProgressBar
              label="Cards with a URL in the cite"
              total={total}
              segments={[{ label: "With a URL", value: stats.withUrl, className: "bg-sky-500" }]}
            />
            <ProgressBar
              label="Original source extracted"
              total={total}
              segments={[
                { label: "From the cited URL", value: stats.viaCite, className: "bg-emerald-500" },
                { label: "Found by QwkSearch", value: stats.viaSearch, className: "bg-violet-500" },
              ]}
            />
            <p className="text-muted-foreground text-xs">
              {stats.notFound.toLocaleString()} not found · {stats.failed.toLocaleString()} failed ·{" "}
              {(total - stats.extracted - stats.notFound - stats.failed).toLocaleString()} not tried yet
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{statsError ?? "Counting cards…"}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!isRunning && savedCursor > 0 && (
            <Button onClick={() => void handleRun(false)} variant="outline">
              Resume from card #{savedCursor.toLocaleString()}
            </Button>
          )}
          {!isRunning && (
            <Button onClick={() => void handleRun(true)} variant={savedCursor > 0 ? "ghost" : "outline"}>
              {savedCursor > 0 ? "Start over" : "Extract original sources"}
            </Button>
          )}
          {isRunning && (
            <>
              <Button disabled variant="outline">
                Extracting…
              </Button>
              <Button
                onClick={() => {
                  stopRef.current = true;
                  setStopRequested(true);
                }}
                disabled={stopRequested}
                variant="ghost"
              >
                {stopRequested ? "Stopping after this page…" : "Stop"}
              </Button>
            </>
          )}
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={retryFailed}
              onChange={(e) => setRetryFailed(e.target.checked)}
              disabled={isRunning}
            />
            Retry failed cards
          </label>
        </div>

        {run && (
          <span className="text-muted-foreground text-sm">
            This run: {run.processed.toLocaleString()} cards — {run.viaCite.toLocaleString()} from the cited URL,{" "}
            {run.viaSearch.toLocaleString()} found by search, {run.notFound.toLocaleString()} not found,{" "}
            {run.failed.toLocaleString()} failed{isRunning ? "…" : " (stopped or done)"}
          </span>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}

        {recent.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs">
            {recent.map((result) => (
              <li key={`${result.cardId}-${result.status}`} className="flex min-w-0 gap-2">
                <span className="text-muted-foreground shrink-0 tabular-nums">#{result.cardId}</span>
                <span
                  className={
                    result.status === "extracted"
                      ? "shrink-0 text-emerald-600"
                      : result.status === "failed"
                        ? "text-destructive shrink-0"
                        : "text-muted-foreground shrink-0"
                  }
                >
                  {result.status === "extracted" ? (result.via === "search" ? "searched" : "cited") : result.status.replace("_", " ")}
                </span>
                {result.status === "extracted" ? (
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                    {result.title || result.url}
                  </a>
                ) : (
                  <span className="text-muted-foreground truncate">{result.error}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
