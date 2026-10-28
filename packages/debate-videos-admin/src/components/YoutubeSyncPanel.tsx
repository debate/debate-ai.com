"use client";

/**
 * @fileoverview The admin "YouTube sync" section: the channel resync, the
 * subscribed-channel list, the transcript scraper, view-count and duration
 * refreshes, the JSON seed, stack recomputation and AI reclassification.
 * Admin-only; the admin page hides it from moderators.
 * @module components/YoutubeSyncPanel
 */

import { useCallback, useEffect, useState } from "react";
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
import { formatRecomputeStacksResult } from "../lib/format-recompute-stacks-result";
import {
  formatSeedVideosResult,
  formatSeedVideosStatus,
  type SeedVideosStatus,
} from "../lib/format-seed-videos-result";
import { ReclassifyVideosPanel } from "./ReclassifyVideosPanel";
import { TranscriptScraperPanel } from "./TranscriptScraperPanel";
import { YoutubeChannelsPanel } from "./YoutubeChannelsPanel";

interface SyncRun { id: number; status: "running" | "success" | "error"; triggeredBy?: string | null; channelsSynced: number; videosUpserted: number; error: string | null; }
// `youtube_sync_runs.triggered_by` for a run the daily scan cron started rather
// than an admin — the sentinel written by lib/youtube/weekly-sync.ts. Repeated
// here as a literal so this client component does not import that server module.
const CRON_TRIGGERED_BY = "cron";
interface ViewCountStatus { publishedVideos: number; queuedVideos: number; }
interface DurationStatus {
  videos: number;
  withDuration: number;
  withoutDuration: number;
  publishedSeconds: number;
  queuedSeconds: number;
  totalSeconds: number;
}

/** Seconds as "1,234h 5m", the unit a library's running time reads in. */
function formatHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toLocaleString()}h ${minutes}m`;
}

function formatDurationStatus(status: DurationStatus): string {
  const coverage = `${status.withDuration.toLocaleString()} of ${status.videos.toLocaleString()} videos have a duration`;
  return `${coverage} · ${formatHours(status.totalSeconds)} total (${formatHours(status.publishedSeconds)} published, ${formatHours(status.queuedSeconds)} queued)`;
}

/** Every YouTube-sync maintenance job, one card each. */
export function YoutubeSyncPanel() {
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncCutoff, setResyncCutoff] = useState("");
  const [lastRun, setLastRun] = useState<SyncRun | null>(null);
  const [resyncError, setResyncError] = useState<string | null>(null);
  const [isResyncingViews, setIsResyncingViews] = useState(false);
  const [viewResyncResult, setViewResyncResult] = useState<string | null>(null);
  const [viewResyncError, setViewResyncError] = useState<string | null>(null);
  const [viewCountStatus, setViewCountStatus] = useState<ViewCountStatus | null>(null);
  const [durationStatus, setDurationStatus] = useState<DurationStatus | null>(null);
  const [isFetchingDurations, setIsFetchingDurations] = useState(false);
  const [durationProgress, setDurationProgress] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [isRecomputingStacks, setIsRecomputingStacks] = useState(false);
  const [recomputeStacksResult, setRecomputeStacksResult] = useState<string | null>(null);
  const [recomputeStacksError, setRecomputeStacksError] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<SeedVideosStatus | null>(null);
  const [isSeedingVideos, setIsSeedingVideos] = useState(false);
  const [seedVideosResult, setSeedVideosResult] = useState<string | null>(null);
  const [seedVideosError, setSeedVideosError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/youtube/resync")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.runs?.[0]) setLastRun(data.runs[0]);
      })
      .catch(() => {});
  }, []);

  const loadViewCountStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos/view-counts");
      if (!res.ok) return;
      setViewCountStatus(await res.json());
    } catch {
      // The card still works without the count; it only sizes the run.
    }
  }, []);

  useEffect(() => {
    loadViewCountStatus();
  }, [loadViewCountStatus]);

  const loadDurationStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos/durations");
      if (!res.ok) return;
      setDurationStatus(await res.json());
    } catch {
      // The card still works without the totals.
    }
  }, []);

  useEffect(() => {
    loadDurationStatus();
  }, [loadDurationStatus]);

  const loadSeedStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos/seed");
      if (!res.ok) return;
      setSeedStatus(await res.json());
    } catch {
      // The card still works without the status; it only informs the label.
    }
  }, []);

  useEffect(() => {
    loadSeedStatus();
  }, [loadSeedStatus]);

  const handleResync = async () => {
    setIsResyncing(true);
    setResyncError(null);
    try {
      const res = await fetch("/api/admin/youtube/resync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedAfter: resyncCutoff || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || "Resync failed");
      // Only the fields `SyncRun` declares — the rest of the run row the API
      // returns is not read here.
      setLastRun({
        id: data.runId,
        status: "success",
        channelsSynced: data.channelsSynced,
        videosUpserted: data.videosUpserted,
        error: null,
      });
    } catch (error) {
      setResyncError((error as Error).message);
    } finally {
      setIsResyncing(false);
    }
  };

  const handleResyncViewCounts = async () => {
    setIsResyncingViews(true);
    setViewResyncError(null);
    setViewResyncResult(null);
    try {
      const res = await fetch("/api/admin/videos/view-counts", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || "View count resync failed");
       const missing = data.missing > 0 ? `, ${data.missing} unavailable on YouTube` : "";
      const { availability = null } = data;
      let summary = "";
      if (data.updated === 0) {
        summary = `All ${data.videosChecked.toLocaleString()} view counts were already current${missing}.`;
      } else {
        summary = `Updated ${data.updated.toLocaleString()} of ${data.videosChecked.toLocaleString()} view counts${missing}.`;
      }
      if (availability) {
        const parts: string[] = [];
        if (availability.available > 0) parts.push(`${availability.available} available`);
        if (availability.private > 0) parts.push(`${availability.private} private`);
        if (availability.notEmbeddable > 0) parts.push(`${availability.notEmbeddable} not embeddable`);
        if (availability.removed > 0) parts.push(`${availability.removed} removed`);
        if (parts.length > 0) {
          summary += ` — availability: ${parts.join(", ")}.`;
        }
      }
      setViewResyncResult(summary);
      await loadViewCountStatus();
    } catch (error) {
      setViewResyncError((error as Error).message);
    } finally {
      setIsResyncingViews(false);
    }
  };

  // Pages through every stored id, one request per page, until the server
  // says the walk is done; each page writes as it goes, so stopping midway
  // (a closed tab, a quota error) keeps what was fetched.
  const handleFetchDurations = async (refresh: boolean) => {
    setIsFetchingDurations(true);
    setDurationError(null);
    setDurationProgress(null);
    let after: string | null = null;
    let checked = 0;
    let stored = 0;
    let missing = 0;
    try {
      do {
        const res: Response = await fetch("/api/admin/videos/durations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ after, refresh }),
        });
        const data: any = await res.json();
        if (!res.ok) throw new Error(data?.details || data?.error || "Fetching durations failed");
        checked += data.checked;
        stored += data.stored;
        missing += data.missing;
        after = data.nextCursor;
        setDurationStatus(data.status);
        setDurationProgress(
          `${after ? "Fetching… " : ""}Stored ${stored.toLocaleString()} of ${checked.toLocaleString()} checked${missing > 0 ? `, ${missing.toLocaleString()} unavailable on YouTube` : ""}.`,
        );
      } while (after);
    } catch (error) {
      setDurationError((error as Error).message);
    } finally {
      setIsFetchingDurations(false);
    }
  };

  const handleRecomputeStacks = async () => {
    setIsRecomputingStacks(true);
    setRecomputeStacksError(null);
    try {
      const res = await fetch("/api/admin/videos/recompute-stacks", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || "Recompute failed");
      setRecomputeStacksResult(formatRecomputeStacksResult(data));
    } catch (error) {
      setRecomputeStacksError((error as Error).message);
    } finally {
      setIsRecomputingStacks(false);
    }
  };

  const handleSeedVideos = async () => {
    setIsSeedingVideos(true);
    setSeedVideosError(null);
    try {
      const res = await fetch("/api/admin/videos/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || "Seed failed");
      setSeedVideosResult(formatSeedVideosResult(data));
      await loadSeedStatus();
    } catch (error) {
      setSeedVideosError((error as Error).message);
    } finally {
      setIsSeedingVideos(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Resync YouTube rounds</CardTitle>
          <CardDescription>
            Refetches every subscribed channel from YouTube, re-classifies rounds, and
            upserts them into the database. Already-stored videos are not overridden — only
            their view count is refreshed. Runs automatically every Monday at 08:00 UTC;
            this button is for when you do not want to wait.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resync-cutoff">Cutoff date (optional)</Label>
              <Input
                id="resync-cutoff"
                type="date"
                value={resyncCutoff}
                onChange={(e) => setResyncCutoff(e.target.value)}
                className="w-[200px]"
                disabled={isResyncing}
              />
              <p className="text-muted-foreground text-xs">
                Only fetches videos published after this date. Leave empty to use the default
                floor (2023-05-01). Pick a later date to scan a smaller window, or an earlier
                date to look back further.
              </p>
            </div>
            <Button onClick={handleResync} disabled={isResyncing}>
              {isResyncing ? "Resyncing…" : "Resync videos"}
            </Button>
            {lastRun && (
              <span className="text-muted-foreground text-sm">
                Last run{lastRun.triggeredBy === CRON_TRIGGERED_BY ? " (scheduled)" : ""}:{" "}
                {lastRun.status === "error" ? "failed" : "success"}
                {lastRun.status !== "error" &&
                  ` — ${lastRun.videosUpserted} rounds from ${lastRun.channelsSynced} channels`}
              </span>
            )}
          </div>
          {resyncError && <p className="text-destructive text-sm">{resyncError}</p>}
          {lastRun?.status === "error" && lastRun.error && (
            <p className="text-destructive text-sm">{lastRun.error}</p>
          )}
        </CardContent>
      </Card>

      <YoutubeChannelsPanel />

      <TranscriptScraperPanel />

      <Card>
        <CardHeader>
          <CardTitle>Resync video view counts</CardTitle>
          <CardDescription>
            Refetches the watch count of every stored video from YouTube — both published
            videos and the queue below — and writes back the ones that moved. Counts are
            captured once, at ingest, so they only fall behind; the video library sorts on
            them. Runs automatically on the same weekly schedule as the round scan above.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={handleResyncViewCounts} disabled={isResyncingViews} variant="outline">
              {isResyncingViews ? "Resyncing view counts…" : "Resync view counts"}
            </Button>
            {viewResyncResult ? (
              <span className="text-muted-foreground text-sm">{viewResyncResult}</span>
            ) : (
              viewCountStatus && (
                <span className="text-muted-foreground text-sm">
                  Up to{" "}
                  {(
                    viewCountStatus.publishedVideos + viewCountStatus.queuedVideos
                  ).toLocaleString()}{" "}
                  videos to check
                </span>
              )
            )}
          </div>
          {viewResyncError && <p className="text-destructive text-sm">{viewResyncError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fetch video durations</CardTitle>
          <CardDescription>
            Looks up the length of every stored video on YouTube — rounds, lectures and the
            queue below — and stores it, so the library's total running time can be read off
            here. By default only videos without a duration are fetched, so it is cheap to
            re-run after new videos land; "Refetch all" looks every video up again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => handleFetchDurations(false)}
              disabled={isFetchingDurations}
              variant="outline"
            >
              {isFetchingDurations ? "Fetching durations…" : "Fetch missing durations"}
            </Button>
            <Button
              onClick={() => handleFetchDurations(true)}
              disabled={isFetchingDurations}
              variant="ghost"
            >
              Refetch all
            </Button>
            {durationProgress && (
              <span className="text-muted-foreground text-sm">{durationProgress}</span>
            )}
          </div>
          {durationStatus && (
            <p className="text-muted-foreground text-sm">{formatDurationStatus(durationStatus)}</p>
          )}
          {durationError && <p className="text-destructive text-sm">{durationError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seed videos</CardTitle>
          <CardDescription>
            Loads the bundled video JSON assets into the <code>videos</code> table that{" "}
            <code>/api/videos</code> pages over. Safe to re-run — rows are upserted by video id
            and rows the assets no longer carry are pruned. Until this has been run at least
            once, the public feed still works, served from the JSON assets in memory instead of
            SQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={handleSeedVideos} disabled={isSeedingVideos} variant="outline">
              {isSeedingVideos ? "Seeding…" : "Seed videos"}
            </Button>
            {seedVideosResult ? (
              <span className="text-muted-foreground text-sm">{seedVideosResult}</span>
            ) : (
              seedStatus && (
                <span className="text-muted-foreground text-sm">
                  {formatSeedVideosStatus(seedStatus)}
                </span>
              )
            )}
          </div>
          {seedVideosError && <p className="text-destructive text-sm">{seedVideosError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recompute video stacks</CardTitle>
          <CardDescription>
            Re-derives stacked-playlist placement (which videos are grouped as a round and
            its analysis) for every video in the library. Every publish already keeps this
            current on its own; use this to backfill rounds published before that wiring
            existed, or after a manual database edit. Safe to re-run — a video already
            carrying its correct placement is left alone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={handleRecomputeStacks} disabled={isRecomputingStacks} variant="outline">
              {isRecomputingStacks ? "Recomputing…" : "Recompute stacks"}
            </Button>
            {recomputeStacksResult && (
              <span className="text-muted-foreground text-sm">{recomputeStacksResult}</span>
            )}
          </div>
          {recomputeStacksError && <p className="text-destructive text-sm">{recomputeStacksError}</p>}
        </CardContent>
      </Card>

      <ReclassifyVideosPanel />
    </>
  );
}
