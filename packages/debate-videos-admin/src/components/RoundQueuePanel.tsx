"use client";

/**
 * @fileoverview The admin "Round queue" section: rounds the YouTube sync found,
 * waiting for staff to publish or delete them, filterable by style, with
 * "Publish all", "Deduplicate" and "Auto-detect all" for the loaded queue. Each
 * row also has per-video "Publish", "Delete", "Auto-detect" (auto-detect lecture or
 * debate format with OpenRouter's free model) and "Edit" (metadata editor).
 * Pages through `/api/admin/youtube/videos` as the list scrolls.
 * @module components/RoundQueuePanel
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/primitives/button";
import { Badge } from "../ui/primitives/badge";
import { ViewCount } from "@debate-ai/rankings/src/view-count";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select";
import { VideoQueueEditDialog } from "./VideoQueueEditDialog";

/** Body returned by POST /api/admin/youtube/videos/detect. */
interface DetectAllResponse {
  ok?: boolean;
  error?: string;
  results?: { id: string; style: number | null; category: string | null }[];
  errors?: { id: string; error: string }[];
}

interface YoutubeRoundVideo { id: string; title: string; publishedAt: string; channel: string; views: number; description: string; style: number | null; category: string | null; tournament: string | null; roundLevel: string | null; aff: string | null; neg: string | null; winner: boolean | null; judgeDecision: string | null; }
const STYLE_NAMES: Record<number, string> = { 1: "Policy", 2: "PF", 3: "LD", 4: "College", 5: "Worlds", 6: "Atlantic", 8: "Parliamentary", 9: "Congress", 7: "Misc" };
/** Videos per auto-detect request; matches the detect route's limit. */
const DETECT_BATCH_SIZE = 5;
const STYLE_OPTIONS = [{ value: "all", label: "All styles" }, { value: "1", label: "Policy" }, { value: "2", label: "PF" }, { value: "3", label: "LD" }, { value: "4", label: "College" }, { value: "5", label: "Worlds" }, { value: "6", label: "Atlantic" }, { value: "8", label: "Parliamentary" }, { value: "9", label: "Congress" }, { value: "7", label: "Misc" }];

/** The queued round videos, with publish/delete/detect/edit per row and for the whole filtered queue. */
export function RoundQueuePanel() {
  const [videos, setVideos] = useState<YoutubeRoundVideo[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [style, setStyle] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const [publishAllError, setPublishAllError] = useState<string | null>(null);
  const [isDeduping, setIsDeduping] = useState(false);
  const [isDetectingAll, setIsDetectingAll] = useState(false);
  const [detectAllError, setDetectAllError] = useState<string | null>(null);
  const [detectAllNotice, setDetectAllNotice] = useState<string | null>(null);
  const [detectProgress, setDetectProgress] = useState<{ done: number; total: number } | null>(null);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [detectingIds, setDetectingIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [editVideo, setEditVideo] = useState<YoutubeRoundVideo | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  /**
   * Auto-detects one video's kind — debate round format or lecture category —
   * with OpenRouter's free model, and writes the detected style and category
   * back to its queue row so publishing files it under the right shelf.
   */
  const handleDetect = useCallback(async (id: string) => {
    const video = videos.find((video) => video.id === id);
    if (!video) return;
    setDetectingIds((prev) => new Set(prev).add(id));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/youtube/videos/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Detection failed");
      const result = data.results?.[0];
      if (!result) throw new Error(data.errors?.[0]?.error || "No detection returned");
      setVideos((prev) => prev.map((video) => video.id === id ? { ...video, style: result.style, category: result.category } : video));
      const label = result.style === null ? `lecture — ${result.category ?? "uncategorized"}` : STYLE_NAMES[result.style ?? 0] ?? "unknown";
      setQueueNotice(`Detected "${video.title}" as ${label}.`);
    } catch (error) {
      setRowErrors((prev) => ({ ...prev, [id]: (error as Error).message }));
    } finally {
      setDetectingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [videos]);

  /**
   * Runs the same auto-detect on every video loaded on the page, a batch of
   * DETECT_BATCH_SIZE per request (one request per video set would outlive
   * the Worker), updating each row's badge as its batch comes back.
   */
  const handleDetectAll = async () => {
    const ids = videos.map((video) => video.id);
    setIsDetectingAll(true);
    setDetectAllError(null);
    setDetectAllNotice(null);
    setDetectProgress({ done: 0, total: ids.length });
    let detected = 0;
    let failed = 0;
    try {
      for (let start = 0; start < ids.length; start += DETECT_BATCH_SIZE) {
        const batch = ids.slice(start, start + DETECT_BATCH_SIZE);
        const res = await fetch(`/api/admin/youtube/videos/detect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: batch }),
        });
        const data: DetectAllResponse = await res.json();
        if (!res.ok) throw new Error(data?.error || "Detection failed");
        const results = data.results ?? [];
        const errors = data.errors ?? [];
        const byId = new Map(results.map((result) => [result.id, result]));
        setVideos((prev) => prev.map((video) => {
          const result = byId.get(video.id);
          return result ? { ...video, style: result.style, category: result.category } : video;
        }));
        if (errors.length) {
          setRowErrors((prev) => ({ ...prev, ...Object.fromEntries(errors.map((e) => [e.id, e.error])) }));
        }
        detected += results.length;
        failed += errors.length;
        setDetectProgress({ done: Math.min(start + batch.length, ids.length), total: ids.length });
      }
      const failedLabel = failed ? `; ${failed} failed (see the rows)` : "";
      setDetectAllNotice(
        detected || failed
          ? `Auto-detected ${detected} video${detected === 1 ? "" : "s"}${failedLabel}.`
          : "No videos to detect.",
      );
    } catch (error) {
      const soFar = detected ? ` (${detected} detected before it stopped)` : "";
      setDetectAllError(`${(error as Error).message}${soFar}`);
    } finally {
      setIsDetectingAll(false);
      setDetectProgress(null);
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
      setQueueNotice(
        data?.skipped
          ? `Published ${data.published}; skipped ${data.skipped} already in the library (kept the existing versions).`
          : `Published ${data?.published ?? 0}.`,
      );
      await loadFirstPage(style);
    } catch (error) {
      setPublishAllError((error as Error).message);
    } finally {
      setIsPublishingAll(false);
    }
  };

  /**
   * Drops queued rounds that duplicate a published video or an older queued
   * round (same YouTube id or same title), always keeping the older copy.
   */
  const handleDedupe = async () => {
    setIsDeduping(true);
    setPublishAllError(null);
    try {
      const params = new URLSearchParams();
      if (style !== "all") params.set("style", style);
      const res = await fetch(`/api/admin/youtube/videos/dedupe?${params.toString()}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Deduplicate failed");
      setQueueNotice(
        data.removed
          ? `Removed ${data.removed} duplicate queued ${data.removed === 1 ? "video" : "videos"} (matched by YouTube ID or title); kept the older copies.`
          : "No duplicates — no queued video matches the library or another queued video by YouTube ID or title.",
      );
      await loadFirstPage(style);
    } catch (error) {
      setPublishAllError((error as Error).message);
    } finally {
      setIsDeduping(false);
    }
  };

  const handleEdit = (video: YoutubeRoundVideo) => {
    setEditVideo(video);
    setEditError(null);
  };

  const handleSavedEdit = (updated: YoutubeRoundVideo) => {
    setVideos((prev) => prev.map((video) => video.id === updated.id ? updated : video));
    setEditVideo(null);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Round videos</h2>
          <p className="text-muted-foreground text-sm">
            Queued rounds waiting to be published. Already-published videos live in the Video
            library tab.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDedupe}
            disabled={isDeduping || isPublishingAll || isDetectingAll || videos.length === 0}
            title="Remove queued videos that are already in the video library, keeping the existing versions"
          >
            {isDeduping ? "Deduplicating…" : "Deduplicate"}
          </Button>
          <Button
            variant="outline"
            onClick={handlePublishAll}
            disabled={isPublishingAll || isDeduping || isDetectingAll || videos.length === 0}
          >
            {isPublishingAll ? "Publishing…" : "Publish all"}
          </Button>
          <Button
            variant="outline"
            onClick={handleDetectAll}
            disabled={isDetectingAll || isPublishingAll || isDeduping || videos.length === 0}
            title="Run the same auto-detect (OpenRouter free model) on every video on this page, writing the detected debate format or lecture category back to each queue row"
          >
            {isDetectingAll
              ? `Detecting${detectProgress ? ` ${detectProgress.done}/${detectProgress.total}` : ""}…`
              : "Auto-detect all"}
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
      {!publishAllError && detectAllError && <p className="text-destructive text-sm">{detectAllError}</p>}
      {!publishAllError && !detectAllError && queueNotice && (
        <p className="text-muted-foreground text-sm">{queueNotice}</p>
      )}
      {!publishAllError && !detectAllError && detectAllNotice && (
        <p className="text-muted-foreground text-sm">{detectAllNotice}</p>
      )}

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
          const isDetecting = detectingIds.has(video.id);
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
                    <Badge variant="secondary">
                      {video.style === null ? `Lecture${video.category ? ` — ${video.category}` : ""}` : STYLE_NAMES[video.style ?? 0] ?? "Unknown"}
                    </Badge>
                    <span>{video.channel}</span>
                    <span>{video.publishedAt}</span>
                    <ViewCount views={video.views} suffix=" views" />
                    {video.tournament && <span>{video.tournament}</span>}
                  </div>
                  {rowError && <p className="text-destructive text-xs">{rowError}</p>}
                </div>
              </a>
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                <Button size="sm" onClick={() => handlePublish(video.id)} disabled={isPending || isDetecting}>
                  Publish
                </Button>
                <Button size="sm" onClick={() => handleDetect(video.id)} disabled={isPending || isDetecting}>
                  {isDetecting ? "Detecting…" : "Auto-detect"}
                </Button>
                <Button size="sm" onClick={() => handleEdit(video)} disabled={isPending || isDetecting || isSavingEdit}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(video.id)}
                  disabled={isPending || isDetecting}
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
        <VideoQueueEditDialog
          video={editVideo}
          onClose={() => setEditVideo(null)}
          onSaved={handleSavedEdit}
        />
      </div>
    </>
  );
}
