"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../lib/ui/primitives/button";
import { Badge } from "../../lib/ui/primitives/badge";
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
import { REUSE_CHECK_LOG_RETENTION_DAYS } from "debate-research-evidence";
import { TopicStarterUpload } from "./TopicStarterUpload";

interface YoutubeRoundVideo { id: string; title: string; publishedAt: string; channel: string; views: number; style: number; tournament: string | null; }
interface SyncRun { id: number; status: "running" | "success" | "error"; channelsSynced: number; videosUpserted: number; error: string | null; }
interface Overview { stats: { users: number; sessions: number; files: number; publishedVideos: number; stagedVideos: number }; recentUsers: Array<{ id: string; name: string; email: string; image: string | null; createdAt: string; isAnonymous: boolean }>; }
const STYLE_NAMES: Record<number, string> = { 1: "Policy", 2: "PF", 3: "LD", 4: "College" };
const STYLE_OPTIONS = [{ value: "all", label: "All styles" }, { value: "1", label: "Policy" }, { value: "2", label: "PF" }, { value: "3", label: "LD" }, { value: "4", label: "College" }];

export function AdminDashboard() {
  const [videos, setVideos] = useState<YoutubeRoundVideo[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [style, setStyle] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastRun, setLastRun] = useState<SyncRun | null>(null);
  const [resyncError, setResyncError] = useState<string | null>(null);
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const [publishAllError, setPublishAllError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [isPurgingReuseLog, setIsPurgingReuseLog] = useState(false);
  const [reuseLogPurgeResult, setReuseLogPurgeResult] = useState<string | null>(null);
  const [reuseLogPurgeError, setReuseLogPurgeError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadFirstPage = useCallback(async (styleFilter: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (styleFilter !== "all") params.set("style", styleFilter);
      const res = await fetch(`/api/admin/youtube/videos?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setVideos(data.videos ?? []);
      setNextCursor(data.nextCursor ?? null);
    } catch (error) {
      console.error("Failed to load videos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      if (style !== "all") params.set("style", style);
      const res = await fetch(`/api/admin/youtube/videos?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setVideos((prev) => [...prev, ...(data.videos ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (error) {
      console.error("Failed to load more videos:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, style]);

  useEffect(() => {
    loadFirstPage(style);
  }, [style, loadFirstPage]);

  useEffect(() => {
    fetch("/api/admin/youtube/resync")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.runs?.[0]) setLastRun(data.runs[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleResync = async () => {
    setIsResyncing(true);
    setResyncError(null);
    try {
      const res = await fetch("/api/admin/youtube/resync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || "Resync failed");
      setLastRun({
        id: data.runId,
        status: "success",
        triggeredBy: null,
        channelsSynced: data.channelsSynced,
        videosFetched: data.videosFetched,
        videosUpserted: data.videosUpserted,
        error: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
      await loadFirstPage(style);
    } catch (error) {
      setResyncError((error as Error).message);
    } finally {
      setIsResyncing(false);
    }
  };

  const handlePublish = useCallback(async (id: string) => {
    setPendingIds((prev) => new Set(prev).add(id));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/youtube/videos/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Publish failed");
      setVideos((prev) => prev.filter((video) => video.id !== id));
    } catch (error) {
      setRowErrors((prev) => ({ ...prev, [id]: (error as Error).message }));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setPendingIds((prev) => new Set(prev).add(id));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/youtube/videos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setVideos((prev) => prev.filter((video) => video.id !== id));
    } catch (error) {
      setRowErrors((prev) => ({ ...prev, [id]: (error as Error).message }));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handlePurgeReuseCheckLog = async () => {
    setIsPurgingReuseLog(true);
    setReuseLogPurgeError(null);
    setReuseLogPurgeResult(null);
    try {
      const res = await fetch("/api/admin/evidence-reuse-check-log/purge", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || "Purge failed");
      setReuseLogPurgeResult(
        data.purgedCount === 0
          ? "No expired rows to purge."
          : `Purged ${data.purgedCount} row${data.purgedCount === 1 ? "" : "s"} older than the retention window.`,
      );
    } catch (error) {
      setReuseLogPurgeError((error as Error).message);
    } finally {
      setIsPurgingReuseLog(false);
    }
  };

  const handlePublishAll = async () => {
    setIsPublishingAll(true);
    setPublishAllError(null);
    try {
      const params = new URLSearchParams();
      if (style !== "all") params.set("style", style);
      const res = await fetch(`/api/admin/youtube/videos/publish-all?${params.toString()}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Publish all failed");
      await loadFirstPage(style);
    } catch (error) {
      setPublishAllError((error as Error).message);
    } finally {
      setIsPublishingAll(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground text-sm">YouTube round video sync</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resync YouTube rounds</CardTitle>
          <CardDescription>
            Refetches every subscribed channel from YouTube, re-classifies rounds, and
            upserts them into the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={handleResync} disabled={isResyncing}>
              {isResyncing ? "Resyncing…" : "Resync videos"}
            </Button>
            {lastRun && (
              <span className="text-muted-foreground text-sm">
                Last run: {lastRun.status === "error" ? "failed" : "success"}
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

      <Card>
        <CardHeader>
          <CardTitle>Reuse-check log retention</CardTitle>
          <CardDescription>
            Purges reuse-check log rows older than {REUSE_CHECK_LOG_RETENTION_DAYS} days. Runs
            automatically every week; use this to apply it right away instead of waiting for the
            next run.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={handlePurgeReuseCheckLog} disabled={isPurgingReuseLog} variant="outline">
              {isPurgingReuseLog ? "Purging…" : "Purge old entries now"}
            </Button>
            {reuseLogPurgeResult && (
              <span className="text-muted-foreground text-sm">{reuseLogPurgeResult}</span>
            )}
          </div>
          {reuseLogPurgeError && <p className="text-destructive text-sm">{reuseLogPurgeError}</p>}
        </CardContent>
      </Card>

      <TopicStarterUpload />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Round videos</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handlePublishAll}
            disabled={isPublishingAll || videos.length === 0}
          >
            {isPublishingAll ? "Publishing…" : "Publish all"}
          </Button>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {publishAllError && <p className="text-destructive text-sm">{publishAllError}</p>}

      <div className="flex flex-col gap-3">
        {isLoading && videos.length === 0 && (
          <p className="text-muted-foreground text-sm">Loading videos…</p>
        )}
        {!isLoading && videos.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No videos to review — run a resync to populate this list. Already-published videos
            are cleared from this queue automatically.
          </p>
        )}
        {videos.map((video) => {
          const isPending = pendingIds.has(video.id);
          const rowError = rowErrors[video.id];
          return (
            <div
              key={video.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
            >
              <a
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-accent flex min-w-0 flex-1 gap-3 rounded transition-colors"
              >
                <img
                  src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                  alt=""
                  className="h-20 w-32 shrink-0 rounded object-cover"
                  loading="lazy"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate font-medium">{video.title}</p>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">{STYLE_NAMES[video.style] ?? "Unknown"}</Badge>
                    <span>{video.channel}</span>
                    <span>{video.publishedAt}</span>
                    <span>{video.views.toLocaleString()} views</span>
                    {video.tournament && <span>{video.tournament}</span>}
                  </div>
                  {rowError && <p className="text-destructive text-xs">{rowError}</p>}
                </div>
              </a>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                <Button size="sm" onClick={() => handlePublish(video.id)} disabled={isPending}>
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(video.id)}
                  disabled={isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
        <div ref={sentinelRef} className="h-1" />
        {isLoadingMore && (
          <p className="text-muted-foreground text-center text-sm">Loading more…</p>
        )}
      </div>
    </main>
  );
}
