"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import { BookOpen, DatabaseBackup, Mail, FileSearch, Film, FolderTree, Globe, ListVideo, RefreshCw, School, Sparkles, Upload, Users } from "lucide-react";
import { cn } from "@debate-ai/ui/lib/utils";
import { Button } from "@debate-ai/ui/primitives/button";
import { Input } from "@debate-ai/ui/primitives/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@debate-ai/ui/primitives/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@debate-ai/ui/primitives/select";
import { REUSE_CHECK_LOG_RETENTION_DAYS, SourceArticlePanel } from "@debate-ai/research-evidence";
import { isLikelyArticleUrl } from "../../lib/url-detection/article-url";
import { CardTextR2Panel } from "./data/CardTextR2Panel";
import { CaselistSyncPanel } from "./data/CaselistSyncPanel";
import { DbBackupPanel } from "./data/DbBackupPanel";
import { EmailsPanel } from "./users/EmailsPanel";
import { DebateCardParquetUpload } from "./data/DebateCardParquetUpload";
import { ModeratorsPanel } from "./users/ModeratorsPanel";
import { SchoolClaimsPanel } from "./users/SchoolClaimsPanel";
import { TopicStarterUpload } from "./topic-starters/TopicStarterUpload";
import { TopicStartersAdminPanel } from "./topic-starters/TopicStartersAdminPanel";
import { UsersTable } from "./users/UsersTable";
import {
  RoundQueuePanel,
  SpeechAnalysisPanel,
  VideoLibraryTable,
  VideoReportsPanel,
  YoutubeSyncPanel,
} from "@debate-ai/videos-admin";

interface Overview { stats: { users: number; sessions: number; files: number; publishedVideos: number; stagedVideos: number }; recentUsers: Array<{ id: string; name: string; email: string; image: string | null; createdAt: string; isAnonymous: boolean }>; }

/**
 * The admin page. Admins (ADMIN_EMAIL / ADMIN_EMAILS) see everything;
 * moderators see only the content sections — the video library, video
 * reports, the round-video queue, school claims and Topic starters.
 */
type AdminTabKey = "users" | "library" | "queue" | "schools" | "topic-starters" | "speech-ai" | "youtube" | "cards" | "imports" | "url-detection" | "backups" | "emails";

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
  { key: "queue", name: "Round queue", description: "Queued debate rounds waiting to be published", icon: ListVideo, adminOnly: false },
  { key: "library", name: "Video library", description: "Edit the published video library and review video reports", icon: Film, adminOnly: false },
  { key: "schools", name: "School claims", description: "Coaches and administrators claiming a school's page, waiting on review", icon: School, adminOnly: false },
  { key: "topic-starters", name: "Topic starters", description: "The public topic starter files, and readers' edits and submissions waiting on approval", icon: FolderTree, adminOnly: false },
  { key: "speech-ai", name: "Speech AI", description: "Split round transcripts into speeches and write a summary and an alternative for each", icon: Sparkles, adminOnly: true },
  { key: "youtube", name: "YouTube sync", description: "Channel scans, view counts, video seeding and stacked playlists", icon: RefreshCw, adminOnly: true },
  { key: "cards", name: "Debate cards", description: "Extract source URLs from card citations, recheck them and the reuse-check log", icon: FileSearch, adminOnly: true },
  { key: "url-detection", name: "URL Detection", description: "View URLs detected by the browser extension from pages users visit", icon: Globe, adminOnly: true },
  { key: "imports", name: "Imports", description: "Topic starters, debate card Parquet shards and the caselist sync", icon: Upload, adminOnly: true },
  { key: "emails", name: "Emails", description: "Previews of the welcome, invite and coach emails, rendered with sample data", icon: Mail, adminOnly: true },
  { key: "backups", name: "Backups", description: "SQL dumps of videos, debate cards and history — download or store in R2", icon: DatabaseBackup, adminOnly: true },
  { key: "users", name: "Users", description: "Accounts, usage and the moderators who can edit content", icon: Users, adminOnly: true },
];

function isAdminTabKey(value: string): value is AdminTabKey {
  return ADMIN_TABS.some((tab) => tab.key === value);
}

export function AdminDashboard({ isAdmin = true }: { isAdmin?: boolean }) {
  const [isPurgingReuseLog, setIsPurgingReuseLog] = useState(false);
  const [reuseLogPurgeResult, setReuseLogPurgeResult] = useState<string | null>(null);
  const [reuseLogPurgeError, setReuseLogPurgeError] = useState<string | null>(null);
  const [isValidatingUrls, setIsValidatingUrls] = useState(false);
  const [urlValidationResult, setUrlValidationResult] = useState<string | null>(null);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [urlValidationProgress, setUrlValidationProgress] = useState<{ checked: number; valid: number; invalid: number; errors: number; done: boolean } | null>(null);
  const [isExtractingUrls, setIsExtractingUrls] = useState(false);
  const [urlExtractionError, setUrlExtractionError] = useState<string | null>(null);
  const [urlExtractionProgress, setUrlExtractionProgress] = useState<{ processed: number; withUrl: number; updated: number; demoUrls: string[]; done: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabKey>("queue");
  const [isLoadingUrlDetection, setIsLoadingUrlDetection] = useState(false);
  const [urlDetectionStats, setUrlDetectionStats] = useState<{
    totalUrls: number;
    uniqueUsers: number;
    totalVisits: number;
    topUrls: Array<{ url: string; title: string | null; visitCount: number; lastVisitedAt: number; userEmail?: string | null }>;
    periodDays: number;
  } | null>(null);
  const [urlDetectionUrls, setUrlDetectionUrls] = useState<Array<{
    id: number;
    userId: string;
    url: string;
    normalizedUrl: string;
    title: string | null;
    favicon: string | null;
    visitCount: number;
    lastVisitedAt: number;
    createdAt: number;
    userName: string | null;
    userEmail: string | null;
  }>>([]);
  const [urlDetectionTotal, setUrlDetectionTotal] = useState(0);
  const [urlDetectionPage, setUrlDetectionPage] = useState(0);
  const [urlDetectionSearch, setUrlDetectionSearch] = useState("");
  const [urlDetectionUserFilter, setUrlDetectionUserFilter] = useState("");
  const [urlDetectionError, setUrlDetectionError] = useState<string | null>(null);
  const [urlDetectionPeriodDays, setUrlDetectionPeriodDays] = useState(30);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);

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
           body: JSON.stringify({ afterId, limit: 100, timeoutMs: 8000 }),
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
    setUrlExtractionProgress({ processed: 0, withUrl: 0, updated: 0, demoUrls: [], done: false });
    try {
      let afterId = 0;
      let processed = 0;
      let withUrl = 0;
      let updated = 0;
      let done = false;
      // Sample URLs accumulate across pages, capped to the same count the
      // route returns per page — see DEMO_URL_COUNT in
      // app/api/admin/debate-cards/extract-urls/route.ts.
      let demoUrls: string[] = [];

      while (!done) {
        const res = await fetch("/api/admin/debate-cards/extract-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ afterId, limit: 100 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.details || data?.error || "URL extraction failed");

        processed += data.processed;
        withUrl += data.withUrl;
        updated += data.updated;
        afterId = data.nextAfterId;
        done = data.done;
        if (demoUrls.length < 10) demoUrls = [...demoUrls, ...data.demoUrls].slice(0, 10);
        setUrlExtractionProgress({ processed, withUrl, updated, demoUrls, done });
      }
    } catch (error) {
      setUrlExtractionError((error as Error).message);
    } finally {
      setIsExtractingUrls(false);
      setUrlExtractionProgress((prev) => (prev ? { ...prev, done: true } : null));
    }
  };

  const loadUrlDetectionStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/url-detection/stats?sinceDays=${urlDetectionPeriodDays}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setUrlDetectionStats(data);
    } catch (error) {
      console.error("Failed to load URL detection stats:", error);
    }
  }, [urlDetectionPeriodDays]);

  const loadUrlDetectionUrls = useCallback(async (page = 0) => {
    setIsLoadingUrlDetection(true);
    setUrlDetectionError(null);
    try {
      const params = new URLSearchParams({
        limit: "50",
        offset: String(page * 50),
      });
      if (urlDetectionSearch) params.set("search", urlDetectionSearch);
      if (urlDetectionUserFilter) params.set("userId", urlDetectionUserFilter);
      if (urlDetectionPeriodDays) params.set("sinceDays", String(urlDetectionPeriodDays));

      const res = await fetch(`/api/admin/url-detection?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setUrlDetectionUrls(data.urls);
      setUrlDetectionTotal(data.total);
      setUrlDetectionPage(page);
    } catch (error) {
      setUrlDetectionError((error as Error).message);
    } finally {
      setIsLoadingUrlDetection(false);
    }
  }, [urlDetectionSearch, urlDetectionUserFilter, urlDetectionPeriodDays]);

  useEffect(() => {
    if (activeTab === "url-detection") {
      loadUrlDetectionStats();
      loadUrlDetectionUrls(0);
    }
  }, [activeTab, loadUrlDetectionStats, loadUrlDetectionUrls]);

  const visibleTabs = ADMIN_TABS.filter((tab) => isAdmin || !tab.adminOnly);
  const currentTab = visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0];

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-10 lg:flex-row lg:gap-8">
      <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:w-[220px] lg:shrink-0 lg:self-start">
        <div>
          <h1 className="text-2xl font-semibold">{isAdmin ? "Admin" : "Moderation"}</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? "Accounts, videos, the debate card library and imports"
              : "The published video library, video reports, the round queue and school claims"}
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

        {currentTab.key === "speech-ai" && <SpeechAnalysisPanel />}

        {currentTab.key === "emails" && <EmailsPanel />}

        {currentTab.key === "schools" && <SchoolClaimsPanel />}

        {currentTab.key === "library" && (
          <>
            <VideoLibraryTable />

            <VideoReportsPanel />
          </>
        )}

        {currentTab.key === "queue" && <RoundQueuePanel />}

        {currentTab.key === "youtube" && <YoutubeSyncPanel />}

        {currentTab.key === "cards" && (
          <>
            <CardTextR2Panel />

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
                   {urlExtractionProgress && urlExtractionProgress.demoUrls.length > 0 && (
                     <div className="mt-2 flex flex-col gap-1">
                       <span className="text-muted-foreground text-xs font-medium">Sample URLs found:</span>
                       <div className="flex flex-wrap gap-2">
                         {urlExtractionProgress.demoUrls.map((url, index) => (
                           <a
                             key={index}
                             href={url}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-xs text-muted-foreground hover:text-foreground hover:underline truncate max-w-full"
                           >
                             {url}
                           </a>
                         ))}
                       </div>
                     </div>
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
                  the extraction first.                   Processes cards in batches of 100; a full corpus can take
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

        {currentTab.key === "url-detection" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>URL Detection Statistics</CardTitle>
                <CardDescription>
                  Summary of URLs detected by the browser extension from pages users visit over the last{" "}
                  {urlDetectionPeriodDays} days.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={String(urlDetectionPeriodDays)} onValueChange={(v) => setUrlDetectionPeriodDays(Number(v))}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="7" value="7">Last 7 days</SelectItem>
                      <SelectItem key="30" value="30">Last 30 days</SelectItem>
                      <SelectItem key="90" value="90">Last 90 days</SelectItem>
                      <SelectItem key="365" value="365">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={loadUrlDetectionStats} disabled={isLoadingUrlDetection}>
                    {isLoadingUrlDetection ? "Loading…" : "Refresh stats"}
                  </Button>
                </div>
                {urlDetectionStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="rounded-lg border p-4">
                      <p className="text-3xl font-bold">{urlDetectionStats.totalUrls.toLocaleString()}</p>
                      <p className="text-muted-foreground text-sm">Unique URLs</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-3xl font-bold">{urlDetectionStats.uniqueUsers.toLocaleString()}</p>
                      <p className="text-muted-foreground text-sm">Unique Users</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-3xl font-bold">{urlDetectionStats.totalVisits.toLocaleString()}</p>
                      <p className="text-muted-foreground text-sm">Total Visits</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-3xl font-bold">{urlDetectionStats.topUrls.length}</p>
                      <p className="text-muted-foreground text-sm">Top URLs shown</p>
                    </div>
                  </div>
                )}
                {urlDetectionStats?.topUrls.length && (
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-3">Most Visited URLs</h4>
                    <ul className="space-y-2">
                      {urlDetectionStats.topUrls.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                              {item.title || item.url}
                            </a>
                            <span className="text-muted-foreground">
                              {item.visitCount.toLocaleString()} visits • Last: {new Date(item.lastVisitedAt).toLocaleDateString()}
                              {item.userEmail && <> • Checked by {item.userEmail}</>}
                            </span>
                          </div>
                          {isLikelyArticleUrl(item.url) && (
                            <Button variant="outline" size="sm" onClick={() => setReaderUrl(item.url)} title="Open in reader mode">
                              <BookOpen /> Reader
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detected URLs</CardTitle>
                <CardDescription>
                  All URLs detected by the extension, paginated. Use search to filter by URL or title.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Search URL or title…"
                    value={urlDetectionSearch}
                    onChange={(e) => setUrlDetectionSearch(e.target.value)}
                    className="w-[300px]"
                  />
                  <Input
                    placeholder="Filter by user ID or email…"
                    value={urlDetectionUserFilter}
                    onChange={(e) => setUrlDetectionUserFilter(e.target.value)}
                    className="w-[200px]"
                  />
                  <Button variant="outline" onClick={() => loadUrlDetectionUrls(0)} disabled={isLoadingUrlDetection}>
                    {isLoadingUrlDetection ? "Loading…" : "Search"}
                  </Button>
                </div>
                {urlDetectionError && <p className="text-destructive text-sm">{urlDetectionError}</p>}
                {isLoadingUrlDetection && urlDetectionUrls.length === 0 && (
                  <p className="text-muted-foreground text-sm">Loading…</p>
                )}
                {!isLoadingUrlDetection && urlDetectionUrls.length === 0 && (
                  <p className="text-muted-foreground text-sm">No URLs found.</p>
                )}
                {urlDetectionUrls.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">URL</th>
                          <th className="px-3 py-2 text-left">Checked by</th>
                          <th className="px-3 py-2 text-right">Visits</th>
                          <th className="px-3 py-2 text-left">Last Visited</th>
                          <th className="px-3 py-2 text-left">First Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {urlDetectionUrls.map((item) => (
                          <tr key={item.id} className="border-t hover:bg-accent">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="truncate block max-w-xs hover:underline">
                                  {item.title || item.url}
                                </a>
                                {isLikelyArticleUrl(item.url) && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => setReaderUrl(item.url)} title="Open in reader mode" aria-label="Open in reader mode">
                                    <BookOpen />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col">
                                <span>{item.userEmail || item.userName || item.userId}</span>
                                {item.userEmail && item.userName && (
                                  <span className="text-muted-foreground text-xs">{item.userName}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">{item.visitCount.toLocaleString()}</td>
                            <td className="px-3 py-2">{new Date(item.lastVisitedAt).toLocaleString()}</td>
                            <td className="px-3 py-2">{new Date(item.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {urlDetectionTotal > (urlDetectionPage + 1) * 50 && (
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={() => loadUrlDetectionUrls(urlDetectionPage + 1)} disabled={isLoadingUrlDetection}>
                      Load more ({urlDetectionUrls.length} of {urlDetectionTotal.toLocaleString()})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {readerUrl && (
              <aside className="fixed inset-y-0 right-0 z-50 w-full border-l shadow-xl sm:w-[min(42rem,100vw)]">
                <SourceArticlePanel key={readerUrl} url={readerUrl} onClose={() => setReaderUrl(null)} />
              </aside>
            )}
          </>
        )}

        {currentTab.key === "topic-starters" && <TopicStartersAdminPanel />}

        {currentTab.key === "imports" && (
          <>
            <TopicStarterUpload />

            <DebateCardParquetUpload />

            <CaselistSyncPanel />
          </>
        )}

        {currentTab.key === "backups" && <DbBackupPanel />}
      </section>
    </main>
  );
}
