"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../lib/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../lib/ui/primitives/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../lib/ui/primitives/select";

interface TranscriptScraperStats {
  totalVideos: number;
  withTranscript: number;
  withoutTranscript: number;
  withSummary: number;
}

interface ScrapePageResult {
  processed: number;
  scraped: number;
  summarized: number;
  errors: Array<{ videoId: string; error: string }>;
  nextAfterId: string | null;
  done: boolean;
}

/**
 * Backfills YouTube transcripts for every video in the library, and
 * optionally writes an AI summary of each one. Runs in pages so a
 * large corpus does not time out; videos that already have a
 * transcript are skipped.
 */
export function TranscriptScraperPanel() {
  const [stats, setStats] = useState<TranscriptScraperStats | null>(null);
  const [generateSummaries, setGenerateSummaries] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorLog, setErrorLog] = useState<Array<{ videoId: string; error: string }>>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos/transcripts");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load stats");
      setStats(body);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async () => {
    setIsRunning(true);
    setError(null);
    setNotice(null);
    setErrorLog([]);
    let afterId: string | null = null;
    let totalScraped = 0;
    let totalSummarized = 0;
    const allErrors: Array<{ videoId: string; error: string }> = [];
    try {
      // Loop until the API reports done, one page per request.
      for (;;) {
        const res = await fetch("/api/admin/videos/transcripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ afterId, generateSummaries }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.details || body?.error || "Scrape failed");
        const page = body as ScrapePageResult;
        totalScraped += page.scraped;
        totalSummarized += page.summarized;
        allErrors.push(...page.errors);
        setErrorLog([...allErrors]);
        setProgress(
          `Scraped ${totalScraped.toLocaleString()} transcripts` +
            (generateSummaries ? `, summarized ${totalSummarized.toLocaleString()}` : "") +
            ` — ${page.processed.toLocaleString()} on this page…`,
        );
        if (page.done || !page.nextAfterId) break;
        afterId = page.nextAfterId;
      }
      setNotice(
        `Done — scraped ${totalScraped.toLocaleString()} transcripts` +
          (generateSummaries ? ` and wrote ${totalSummarized.toLocaleString()} AI summaries.` : "."),
      );
      setProgress(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcript scraper</CardTitle>
        <CardDescription>
          Fetches YouTube's captions for every video in the library that has none cached yet and
          stores them in D1. Optionally writes an AI summary of each transcript as the video's
          summary document. Runs in pages and skips videos that already have a transcript.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={isRunning || (stats?.withoutTranscript ?? 0) === 0}>
            {isRunning ? "Scraping…" : "Scrape all transcripts"}
          </Button>
          <Select
            value={generateSummaries ? "yes" : "no"}
            onValueChange={(value) => setGenerateSummaries(value === "yes")}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">Transcripts only</SelectItem>
              <SelectItem value="yes">Transcripts + AI summaries</SelectItem>
            </SelectContent>
          </Select>
          {stats && (
            <span className="text-muted-foreground text-sm">
              {stats.withTranscript.toLocaleString()} of {stats.totalVideos.toLocaleString()} videos
              have transcripts · {stats.withSummary.toLocaleString()} have AI summaries
            </span>
          )}
        </div>
        {progress && <p className="text-muted-foreground text-sm">{progress}</p>}
        {notice && <p className="text-muted-foreground text-sm">{notice}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}
        {errorLog.length > 0 && (
          <details className="flex flex-col gap-1">
            <summary className="text-muted-foreground text-xs font-medium">
              {errorLog.length} skipped (no captions or failed)
            </summary>
            <ul className="flex flex-col gap-0.5">
              {errorLog.slice(0, 50).map((entry) => (
                <li key={entry.videoId} className="text-muted-foreground text-xs">
                  <span className="font-mono">{entry.videoId}</span> — {entry.error}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
