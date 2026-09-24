"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../lib/ui/primitives/button";
import { Badge } from "../../lib/ui/primitives/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../lib/ui/primitives/card";

/**
 * Two things the library only learns about from outside: what viewers report,
 * and what YouTube has taken down.
 *
 * Neither had anywhere to land before. Reports were appended to a JSON file
 * with `fs.writeFile`, which cannot work on Workers — so in production every
 * report failed silently and none was ever read. Takedowns were not tracked
 * at all: a deleted video kept its card and its thumbnail, and the only way
 * to find out was to click it.
 *
 * A miscategorised report carries the correction as fields rather than prose,
 * so "Apply" writes it straight to the video instead of leaving an admin to
 * re-derive it from a sentence.
 */

/** One report, as `/api/video-issues` returns it. */
interface VideoIssue {
  id: string;
  videoId: string;
  title: string;
  kind: string;
  issue: string;
  suggestedStyle: number | null;
  suggestedCategory: string | null;
  suggestedRoundLevel: string | null;
  reportedBy: string | null;
  status: string;
  createdAt: string | number;
}

/** One video YouTube no longer serves. */
interface UnavailableVideo {
  videoId: string;
  title: string;
  channel: string;
  availability: string;
  missingChecks: number;
  availabilityCheckedAt: string | number | null;
}

const STYLE_NAMES: Record<number, string> = { 1: "Policy", 2: "PF", 3: "LD", 4: "College" };

/** How each report reason reads in the list. */
const KIND_LABELS: Record<string, string> = {
  miscategorized: "Wrong category",
  unavailable: "Does not play",
  metadata: "Wrong metadata",
  quality: "Quality",
  other: "Other",
};

/** How each availability state reads, and how alarming it is. */
const AVAILABILITY_LABELS: Record<string, { label: string; variant: "destructive" | "secondary" }> = {
  removed: { label: "Gone from YouTube", variant: "destructive" },
  private: { label: "Made private", variant: "secondary" },
  not_embeddable: { label: "Embedding turned off", variant: "secondary" },
};

/**
 * Derives the lecture category slug the public feed filters on, matching
 * `normalizeCategoryKey` in `debate-data-sync`.
 */
function categoryKeyFor(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[&/]/g, "_");
}

/** Formats a stored timestamp, which arrives as an ISO string or epoch seconds. */
function formatWhen(value: string | number | null): string {
  if (value === null || value === undefined) return "never";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleDateString();
}

export function VideoReportsPanel() {
  const [issues, setIssues] = useState<VideoIssue[]>([]);
  const [unavailable, setUnavailable] = useState<UnavailableVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [issuesRes, unavailableRes] = await Promise.all([
        fetch(`/api/video-issues?status=${showResolved ? "all" : "open"}`),
        fetch("/api/admin/videos/availability"),
      ]);
      const issuesBody = await issuesRes.json();
      const unavailableBody = await unavailableRes.json();
      if (!issuesRes.ok) throw new Error(issuesBody?.error || "Failed to load reports");
      setIssues(issuesBody.issues ?? []);
      setUnavailable(unavailableRes.ok ? (unavailableBody.videos ?? []) : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (issue: VideoIssue, status: "applied" | "dismissed" | "open") => {
    setBusyId(issue.id);
    setError(null);
    try {
      const res = await fetch("/api/video-issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: issue.id, status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to update report");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Writes a miscategorised report's own correction to the video, then marks
   * the report applied.
   *
   * Only the fields that map to a column are written. The competition level
   * is deliberately not one of them: `videos.round_level` holds the
   * elimination round ("Octafinals"), not college-versus-high-school, which
   * this library expresses through the debate style. It is shown to the admin
   * as context for choosing that style instead.
   */
  const applyCorrection = async (issue: VideoIssue) => {
    setBusyId(issue.id);
    setError(null);
    try {
      const patch: Record<string, unknown> = {};
      if (issue.suggestedStyle) {
        patch.style = issue.suggestedStyle;
      }
      if (issue.suggestedCategory) {
        patch.category = issue.suggestedCategory;
        patch.categoryKey = categoryKeyFor(issue.suggestedCategory);
        // A lecture is precisely a row with no numeric style; leaving one on
        // would keep the video in a format tab it does not belong to.
        patch.style = null;
      }

      if (Object.keys(patch).length === 0) {
        throw new Error("This report carries no correction to apply");
      }

      const res = await fetch(`/api/admin/videos/library/${issue.videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to apply correction");

      setNotice(`Recategorised “${body.video?.title ?? issue.title}”.`);
      await resolve(issue, "applied");
    } catch (err) {
      setError((err as Error).message);
      setBusyId(null);
    }
  };

  const clearFlag = async (video: UnavailableVideo) => {
    setBusyId(video.videoId);
    setError(null);
    try {
      const res = await fetch("/api/admin/videos/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.videoId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to clear the flag");
      setUnavailable((current) => current.filter((row) => row.videoId !== video.videoId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports &amp; takedowns</CardTitle>
        <CardDescription>
          What viewers have reported about a video, and which videos YouTube has stopped
          serving. Takedowns are found by the view-count resync, which asks the API about every
          stored id — an id it declines to return has been deleted or made private.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            {isLoading ? "Loading…" : "Refresh"}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
            />
            Include resolved reports
          </label>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {notice && !error && <p className="text-muted-foreground text-sm">{notice}</p>}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Reported issues{issues.length > 0 ? ` (${issues.length})` : ""}
          </h3>
          <ul className="divide-y rounded-md border">
            {issues.map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-start gap-3 p-3">
                <img
                  src={`https://img.youtube.com/vi/${issue.videoId}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  className="h-10 w-16 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="truncate font-medium">{issue.title || issue.videoId}</span>
                    <Badge variant="outline" className="font-normal">
                      {KIND_LABELS[issue.kind] ?? issue.kind}
                    </Badge>
                    {issue.status !== "open" && (
                      <Badge variant="secondary" className="font-normal">
                        {issue.status}
                      </Badge>
                    )}
                  </p>

                  {(issue.suggestedStyle || issue.suggestedCategory || issue.suggestedRoundLevel) && (
                    <p className="text-muted-foreground text-xs">
                      Should be:{" "}
                      {[
                        issue.suggestedStyle ? STYLE_NAMES[issue.suggestedStyle] : null,
                        issue.suggestedCategory,
                        issue.suggestedRoundLevel,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  {issue.issue && <p className="text-muted-foreground text-xs">{issue.issue}</p>}
                  <p className="text-muted-foreground text-xs">
                    {issue.reportedBy ?? "anonymous"} · {formatWhen(issue.createdAt)} ·{" "}
                    {issue.videoId}
                  </p>
                </div>

                <div className="flex gap-2">
                  {issue.status === "open" && (issue.suggestedStyle || issue.suggestedCategory) && (
                    <Button
                      size="sm"
                      disabled={busyId === issue.id}
                      onClick={() => applyCorrection(issue)}
                    >
                      Apply
                    </Button>
                  )}
                  {issue.status === "open" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === issue.id}
                      onClick={() => resolve(issue, "dismissed")}
                    >
                      Dismiss
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === issue.id}
                      onClick={() => resolve(issue, "open")}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {issues.length === 0 && (
              <li className="text-muted-foreground p-3 text-center text-sm">
                {isLoading ? "Loading reports…" : "No reports waiting."}
              </li>
            )}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Unavailable videos{unavailable.length > 0 ? ` (${unavailable.length})` : ""}
          </h3>
          <ul className="divide-y rounded-md border">
            {unavailable.map((video) => {
              const state = AVAILABILITY_LABELS[video.availability] ?? {
                label: video.availability,
                variant: "secondary" as const,
              };
              return (
                <li key={video.videoId} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm">
                      <a
                        href={`https://www.youtube.com/watch?v=${video.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium hover:underline"
                      >
                        {video.title || video.videoId}
                      </a>
                      <Badge variant={state.variant} className="font-normal">
                        {state.label}
                      </Badge>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {video.channel} · missed {video.missingChecks}{" "}
                      {video.missingChecks === 1 ? "check" : "checks"} · last checked{" "}
                      {formatWhen(video.availabilityCheckedAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === video.videoId}
                    onClick={() => clearFlag(video)}
                  >
                    It works now
                  </Button>
                </li>
              );
            })}
            {unavailable.length === 0 && (
              <li className="text-muted-foreground p-3 text-center text-sm">
                {isLoading ? "Loading…" : "Every stored video still plays."}
              </li>
            )}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
