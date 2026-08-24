"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "debate-ui/src/primitives/button";
import { Badge } from "debate-ui/src/primitives/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "debate-ui/src/primitives/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select";

interface YoutubeRoundVideo {
  id: string;
  title: string;
  publishedAt: string;
  channel: string;
  views: number;
  style: number;
  tournament: string | null;
  roundLevel: string | null;
  aff: string | null;
  neg: string | null;
  winner: boolean | null;
  judgeDecision: string | null;
}

interface SyncRun {
  id: number;
  status: "running" | "success" | "error";
  triggeredBy: string | null;
  channelsSynced: number;
  videosFetched: number;
  videosUpserted: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

const STYLE_NAMES: Record<number, string> = {
  1: "Policy",
  2: "PF",
  3: "LD",
  4: "College",
};

const STYLE_OPTIONS = [
  { value: "all", label: "All styles" },
  { value: "1", label: "Policy" },
  { value: "2", label: "PF" },
  { value: "3", label: "LD" },
  { value: "4", label: "College" },
];

export function AdminDashboard() {
  const [videos, setVideos] = useState<YoutubeRoundVideo[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [style, setStyle] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastRun, setLastRun] = useState<SyncRun | null>(null);
  const [resyncError, setResyncError] = useState<string | null>(null);

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

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Round videos</h2>
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

      <div className="flex flex-col gap-3">
        {isLoading && videos.length === 0 && (
          <p className="text-muted-foreground text-sm">Loading videos…</p>
        )}
        {!isLoading && videos.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No videos yet — run a resync to populate this list.
          </p>
        )}
        {videos.map((video) => (
          <a
            key={video.id}
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-accent flex gap-3 rounded-lg border p-3 transition-colors"
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
            </div>
          </a>
        ))}
        <div ref={sentinelRef} className="h-1" />
        {isLoadingMore && (
          <p className="text-muted-foreground text-center text-sm">Loading more…</p>
        )}
      </div>
    </main>
  );
}
