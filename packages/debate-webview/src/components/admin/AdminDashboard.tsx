"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { FileSearch, Film, ListVideo, RefreshCw, Upload, Users } from "lucide-react";
import { cn } from "../../lib/ui/lib/utils";
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
import { formatRecomputeStacksResult } from "../../lib/videos/format-recompute-stacks-result";
import {
  formatSeedVideosResult,
  formatSeedVideosStatus,
  type SeedVideosStatus,
} from "../../lib/videos/format-seed-videos-result";
import { CaselistSyncPanel } from "./CaselistSyncPanel";
import { DebateCardParquetUpload } from "./DebateCardParquetUpload";
import { ModeratorsPanel } from "./ModeratorsPanel";
import { TopicStarterUpload } from "./TopicStarterUpload";
import { UsersTable } from "./UsersTable";
import { VideoLibraryTable } from "./VideoLibraryTable";
import { VideoReportsPanel } from "./VideoReportsPanel";
import { YoutubeChannelsPanel } from "./YoutubeChannelsPanel";

interface YoutubeRoundVideo { id: string; title: string; publishedAt: string; channel: string; views: number; style: number; tournament: string | null; }
interface SyncRun { id: number; status: "running" | "success" | "error"; triggeredBy?: string | null; channelsSynced: number; videosUpserted: number; error: string | null; }
// `youtube_sync_runs.triggered_by` for a run the weekly cron started rather
// than an admin — the sentinel written by lib/youtube/weekly-sync.ts. Repeated
// here as a literal so this client component does not import that server module.
const CRON_TRIGGERED_BY = "cron";
interface ViewCountStatus { publishedVideos: number; queuedVideos: number; }
interface Overview { stats: { users: number; sessions: number; files: number; publishedVideos: number; stagedVideos: number }; recentUsers: Array<{ id: string; name: string; email: string; image: string | null; createdAt: string; isAnonymous: boolean }>; }
const STYLE_NAMES: Record<number, string> = { 1: "Policy", 2: "PF", 3: "LD", 4: "College" };
const STYLE_OPTIONS = [{ value: "all", label: "All styles" }, { value: "1", label: "Policy" }, { value: "2", label: "PF" }, { value: "3", label: "LD" }, { value: "4", label: "College" }];

/**
 * The admin page. Admins (ADMIN_EMAIL / ADMIN_EMAILS) see everything;
 * moderators see only the content sections — the video library, video
 * reports and the round-video queue.
 */
type AdminTabKey = "users" | "library" | "queue" | "youtube" | "cards" | "imports";

interface AdminTab {
  key: AdminTabKey;
  name: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  /** Hidden from moderators, whose APIs would refuse these panels anyway. */
  adminOnly: boolean;
}

// Sidebar sections, in the order they appear — laid out like the settings
// sidebar. The active one is mirrored into the URL hash (/admin#cards) so a
// section can be linked to and survives a reload.
const ADMIN_TABS: AdminTab[] = [
  { key: "users", name: "Users", description: "Accounts, usage and the moderators who can edit content", icon: Users, adminOnly: true },
  { key: "library", name: "Video library", description: "Edit the published video library and review video reports", icon: Film, adminOnly: false },
  { key: "queue", name: "Round queue", description: "Queued debate rounds waiting to be published", icon: ListVideo, adminOnly: false },
  { key: "youtube", name: "YouTube sync", description: "Channel scans, view counts, video seeding and stacked playlists", icon: RefreshCw, adminOnly: true },
  { key: "cards", name: "Debate cards", description: "Extract source URLs from card citations, recheck them and the reuse-check log", icon: FileSearch, adminOnly: true },
  { key: "imports", name: "Imports", description: "Topic starters, debate card Parquet shards and the caselist sync", icon: Upload, adminOnly: true },
];

function isAdminTabKey(value: string): value is AdminTabKey {
  return ADMIN_TABS.some((tab) => tab.key === value);
}

export function AdminDashboard({ isAdmin = true }: { isAdmin?: boolean }) {
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
  const [isResyncingViews, setIsResyncingViews] = useState(false);
  const [viewResyncResult, setViewResyncResult] = useState<string | null>(null);
  const [viewResyncError, setViewResyncError] = useState<string | null>(null);
  const [viewCountStatus, setViewCountStatus] = useState<ViewCountStatus | null>(null);
  const [isPurgingReuseLog, setIsPurgingReuseLog] = useState(false);
  const [reuseLogPurgeResult, setReuseLogPurgeResult] = useState<string | null>(null);
  const [reuseLogPurgeError, setReuseLogPurgeError] = useState<string | null>(null);
  const [isValidatingUrls, setIsValidatingUrls] = useState(false);
  const [urlValidationResult, setUrlValidationResult] = useState<string | null>(null);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [urlValidationProgress, setUrlValidationProgress] = useState<{ checked: number; valid: number; invalid: number; errors: number; done: boolean } | null>(null);
  const [isExtractingUrls, setIsExtractingUrls] = useState(false);
  const [urlExtractionError, setUrlExtractionError] = useState<string | null>(null);
  const [urlExtractionProgress, setUrlExtractionProgress] = useState<{ processed: number; withUrl: number; updated: number; done: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabKey>(isAdmin ? "users" : "library");
  const [isRecomputingStacks, setIsRecomputingStacks] = useState(false);
  const [recomputeStacksResult, setRecomputeStacksResult] = useState<string | null>(null);
  const [recomputeStacksError, setRecomputeStacksError] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<SeedVideosStatus | null>(null);
  const [isSeedingVideos, setIsSeedingVideos] = useState(false);
  const [seedVideosResult, setSeedVideosResult] = useState<string | null>(null);
  const [seedVideosError, setSeedVideosError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Open the section named in the URL hash, and follow later hash changes.
  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (isAdminTabKey(hash)) setActiveTab(hash);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.hash === `#${activeTab}`) return;
    url.hash = activeTab;
    window.history.replaceState(null, "", url);
  }, [activeTab]);

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
    if (!isAdmin) return;
    fetch("/api/admin/youtube/resync")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.runs?.[0]) setLastRun(data.runs[0]);
      })
      .catch(() => {});
  }, [isAdmin]);

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
    if (isAdmin) loadViewCountStatus();
  }, [isAdmin, loadViewCountStatus]);

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
    if (isAdmin) loadSeedStatus();
  }, [isAdmin, loadSeedStatus]);

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
    // The sentinel only exists while the round queue tab is shown.
  }, [loadMore, activeTab]);

  const handleResync = async () => {
    setIsResyncing(true);
    setResyncError(null);
    try {
      const res = await fetch("/api/admin/youtube/resync", { method: "POST" });
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
      await loadFirstPage(style);
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
      await Promise.all([loadViewCountStatus(), loadFirstPage(style)]);
    } catch (error) {
      setViewResyncError((error as Error).message);
    } finally {
      setIsResyncingViews(false);
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

  const handleValidateUrls = async () => {
    setIsValidatingUrls(true);
    setUrlValidationError(null);
    setUrlValidationResult(null);
    setUrlValidationProgress({ checked: 0, valid: 0, invalid: 0, errors: 0, done: false });
    try {
      let afterId = 0;
      let totalChecked = 0;
      let totalValid = 0;
      let totalInvalid = 0;
      let totalErrors = 0;
      let done = false;

      while (!done) {
        const res = await fetch("/api/admin/debate-cards/validate-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ afterId, limit: 500, timeoutMs: 8000 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.details || data?.error || "URL validation failed");

        totalChecked += data.checked;
        totalValid += data.valid;
        totalInvalid += data.invalid;
        totalErrors += data.errors;

        setUrlValidationProgress({
          checked: totalChecked,
          valid: totalValid,
          invalid: totalInvalid,
          errors: totalErrors,
          done: data.done,
        });

        afterId = data.nextAfterId;
        done = data.done;

        // Small delay to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setUrlValidationResult(
        `Checked ${totalChecked.toLocaleString()} cards with URLs: ${totalValid.toLocaleString()} valid, ${totalInvalid.toLocaleString()} invalid, ${totalErrors.toLocaleString()} errors.`,
      );
    } catch (error) {
      setUrlValidationError((error as Error).message);
    } finally {
      setIsValidatingUrls(false);
      setUrlValidationProgress((prev) => prev ? { ...prev, done: true } : null);
    }
  };

  const handleExtractUrls = async () => {
    setIsExtractingUrls(true);
    setUrlExtractionError(null);
    setUrlExtractionProgress({ processed: 0, withUrl: 0, updated: 0, done: false });
    try {
      let afterId = 0;
      let processed = 0;
      let withUrl = 0;
      let updated = 0;
      let done = false;

      while (!done) {
        const res = await fetch("/api/admin/debate-cards/extract-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ afterId, limit: 500 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.details || data?.error || "URL extraction failed");

        processed += data.processed;
        withUrl += data.withUrl;
        updated += data.updated;
        afterId = data.nextAfterId;
        done = data.done;
        setUrlExtractionProgress({ processed, withUrl, updated, done });
      }
    } catch (error) {
      setUrlExtractionError((error as Error).message);
    } finally {
      setIsExtractingUrls(false);
      setUrlExtractionProgress((prev) => (prev ? { ...prev, done: true } : null));
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

  const visibleTabs = ADMIN_TABS.filter((tab) => isAdmin || !tab.adminOnly);
  const currentTab = visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0];

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 lg:flex-row lg:gap-8">
      <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:w-[220px] lg:shrink-0 lg:self-start">
        <div>
          <h1 className="text-2xl font-semibold">{isAdmin ? "Admin" : "Moderation"}</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? "Accounts, videos, the debate card library and imports"
              : "The published video library, video reports and the round queue"}
          </p>
        </div>
        {/* Narrow screens get a dropdown, as the settings sidebar does. */}
        <div className="lg:hidden">
          <Select value={currentTab.key} onValueChange={(value) => setActiveTab(value as AdminTabKey)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleTabs.map((tab) => (
                <SelectItem key={tab.key} value={tab.key}>
                  {tab.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <nav className="hidden flex-col gap-1 lg:flex" aria-label="Admin sections">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={tab.key === currentTab.key ? "page" : undefined}
              className={cn(
                "flex w-full flex-row items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition duration-200 hover:bg-accent active:scale-95",
                tab.key === currentTab.key ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon size={17} />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="border-b pb-4">
          <h2 className="text-lg font-medium">{currentTab.name}</h2>
          <p className="text-muted-foreground text-sm">{currentTab.description}</p>
        </div>

        {currentTab.key === "users" && (
          <>
            <UsersTable />

            <ModeratorsPanel />
          </>
        )}

        {currentTab.key === "library" && (
          <>
            <VideoLibraryTable />

            <VideoReportsPanel />
          </>
        )}

        {currentTab.key === "queue" && (
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
          </>
        )}

        {currentTab.key === "youtube" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Resync YouTube rounds</CardTitle>
                <CardDescription>
                  Refetches every subscribed channel from YouTube, re-classifies rounds, and
                  upserts them into the database. Runs automatically every Monday at 08:00 UTC;
                  this button is for when you do not want to wait.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
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
          </>
        )}

        {currentTab.key === "cards" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Extract debate card source URLs</CardTitle>
                <CardDescription>
                  Runs the debate-card parser over the citation of every card in the library and
                  stores the source URL it finds in the <code>debate_cards.source_url</code> column,
                  refreshing the on-page reuse check at the same time. New imports fill the column
                  as they land; use this to backfill cards imported before it existed. Safe to
                  re-run — only cards whose URL changed are written.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Button onClick={handleExtractUrls} disabled={isExtractingUrls} variant="outline">
                    {isExtractingUrls ? "Extracting…" : "Extract URLs"}
                  </Button>
                  {urlExtractionProgress && (
                    <span className="text-muted-foreground text-sm">
                      Parsed {urlExtractionProgress.processed.toLocaleString()} cards —{" "}
                      {urlExtractionProgress.withUrl.toLocaleString()} with a URL,{" "}
                      {urlExtractionProgress.updated.toLocaleString()} updated
                      {urlExtractionProgress.done ? " (done)" : "…"}
                    </span>
                  )}
                </div>
                {urlExtractionError && <p className="text-destructive text-sm">{urlExtractionError}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Validate debate card URLs</CardTitle>
                <CardDescription>
                  Rechecks the source URL stored on each card — the one extracted above — with an HTTP
                  HEAD request. Reports which URLs are still accessible (2xx), which return errors
                  (4xx/5xx), and which time out or fail. Cards with no stored URL are skipped, so run
                  the extraction first. Processes cards in batches of 500; a full corpus can take
                  several minutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Button onClick={handleValidateUrls} disabled={isValidatingUrls} variant="outline">
                    {isValidatingUrls ? "Validating…" : "Validate URLs"}
                  </Button>
                  {urlValidationProgress && (
                    <span className="text-muted-foreground text-sm">
                      Checked {urlValidationProgress.checked.toLocaleString()} —{" "}
                      {urlValidationProgress.valid.toLocaleString()} valid,{" "}
                      {urlValidationProgress.invalid.toLocaleString()} invalid,{" "}
                      {urlValidationProgress.errors.toLocaleString()} errors
                      {urlValidationProgress.done ? " (done)" : "…"}
                    </span>
                  )}
                </div>
                {urlValidationResult && <span className="text-muted-foreground text-sm">{urlValidationResult}</span>}
                {urlValidationError && <p className="text-destructive text-sm">{urlValidationError}</p>}
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
          </>
        )}

        {currentTab.key === "imports" && (
          <>
            <TopicStarterUpload />

            <DebateCardParquetUpload />

            <CaselistSyncPanel />
          </>
        )}
      </section>
    </main>
  );
}
