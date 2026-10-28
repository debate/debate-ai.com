"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/primitives/button";
import { Badge } from "../ui/primitives/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/primitives/card";
import { VIDEO_DOCUMENT_LABELS } from "@debate-ai/videos";
import { VideoContentDialog, type ContentDialogVideo } from "./VideoContentDialog";

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
 *
 * "Suggested edit" and "Deletion request" are viewer change requests from the
 * watch page's edit button. An edit carries its proposed fields as JSON in
 * `issue`; "Apply" writes exactly those fields, and "Delete video" removes the
 * video the same way the library table's Remove does.
 *
 * "Submitted video" and "Submitted channel" come from the plus button beside
 * the library's search bar. "Add to library" adds the video through the same
 * endpoint as the library table's Add video form; "Subscribe" adds the channel
 * to the subscribed list the resync scans (admins only, like that tab).
 *
 * "Needs transcript" reports are filed by `/api/transcript` itself, not by a
 * viewer, when YouTube has no captions for a library video. "Add transcript"
 * opens the same content editor the library table uses, and saving there
 * marks the report applied.
 *
 * Unavailable videos can be cleared one at a time ("It works now", "Remove")
 * or removed in bulk by takedown state. "Check YouTube now" runs the same
 * resync the weekly cron does, so the list can be refreshed before removing.
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

const STYLE_NAMES: Record<number, string> = { 1: "Policy", 2: "PF", 3: "LD", 4: "College", 5: "WSD", 6: "ACC", 7: "Misc" };

/** How each report reason reads in the list. */
const KIND_LABELS: Record<string, string> = {
  miscategorized: "Wrong category",
  unavailable: "Does not play",
  metadata: "Wrong metadata",
  quality: "Quality",
  transcript: "Needs transcript",
  edit: "Suggested edit",
  delete: "Deletion request",
  "submit-video": "Submitted video",
  "submit-channel": "Submitted channel",
  other: "Other",
};

/** How each proposed field reads in a suggested edit. */
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  channel: "Channel",
  publishedAt: "Published",
  description: "Description",
  style: "Style",
  category: "Lecture category",
  tournament: "Tournament",
  roundLevel: "Round level",
  affTeam: "Aff team",
  negTeam: "Neg team",
  affWin: "Winner",
  judgeDecision: "Judge decision",
  speechDocsUrl: "Speech docs URL",
  arg1ac: "Aff arguments",
  arg2nr: "Neg arguments",
};

/** A suggested edit's stored request: the proposed fields and the viewer's reason. */
interface ChangeRequest {
  changes: Record<string, unknown>;
  reason: string;
}

/** Reads an edit request back out of a report's `issue` text. */
function parseChangeRequest(issue: VideoIssue): ChangeRequest | null {
  if (issue.kind !== "edit") return null;
  try {
    const parsed = JSON.parse(issue.issue) as Partial<ChangeRequest>;
    if (!parsed?.changes || typeof parsed.changes !== "object") return null;
    return { changes: parsed.changes, reason: String(parsed.reason ?? "") };
  } catch {
    return null;
  }
}

/** A viewer submission's stored details: the pasted link, and their note. */
interface Submission {
  url: string;
  channel: string;
  note: string;
}

/** Reads a `submit-video` or `submit-channel` report's `issue` JSON back out. */
function parseSubmission(issue: VideoIssue): Submission | null {
  if (issue.kind !== "submit-video" && issue.kind !== "submit-channel") return null;
  try {
    const parsed = JSON.parse(issue.issue) as Partial<Submission>;
    return {
      url: String(parsed?.url ?? ""),
      channel: String(parsed?.channel ?? ""),
      note: String(parsed?.note ?? ""),
    };
  } catch {
    return { url: "", channel: "", note: issue.issue };
  }
}

/** How one proposed value reads in the review list. */
function formatProposedValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "(cleared)";
  if (field === "style") return STYLE_NAMES[Number(value)] ?? String(value);
  if (field === "affWin") return value ? "Aff won" : "Neg won";
  const text = String(value);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

/** How each availability state reads, and how alarming it is. */
const AVAILABILITY_LABELS: Record<string, { label: string; variant: "destructive" | "secondary" }> = {
  removed: { label: "Gone from YouTube", variant: "destructive" },
  private: { label: "Made private", variant: "secondary" },
  not_embeddable: { label: "Embedding turned off", variant: "secondary" },
};

/** The takedown states, in the order the bulk-removal choices list them. */
const TAKEDOWN_STATES = ["removed", "private", "not_embeddable"] as const;
type TakedownState = (typeof TAKEDOWN_STATES)[number];

/** Published rows per takedown state, as `/api/admin/videos/availability` counts them. */
type TakedownCounts = Record<TakedownState, number>;

const NO_TAKEDOWNS: TakedownCounts = { removed: 0, private: 0, not_embeddable: 0 };

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
  const [takedownCounts, setTakedownCounts] = useState<TakedownCounts>(NO_TAKEDOWNS);
  /** Which takedown states the bulk removal covers. Deleted uploads only, by default. */
  const [removeStates, setRemoveStates] = useState<TakedownState[]>(["removed"]);
  const [isChecking, setIsChecking] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The report whose video is open in the content editor. */
  const [editing, setEditing] = useState<VideoIssue | null>(null);

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
      setTakedownCounts(unavailableRes.ok ? { ...NO_TAKEDOWNS, ...unavailableBody.counts } : NO_TAKEDOWNS);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUnavailable = unavailable.filter((video) => video.availability !== "not_embeddable");

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

  /** Writes a suggested edit's proposed fields to the video, then marks it applied. */
  const applyChangeRequest = async (issue: VideoIssue, request: ChangeRequest) => {
    setBusyId(issue.id);
    setError(null);
    try {
      const patch: Record<string, unknown> = { ...request.changes };
      if (Object.hasOwn(patch, "category")) {
        patch.categoryKey = categoryKeyFor(String(patch.category ?? ""));
      }
      const res = await fetch(`/api/admin/videos/library/${issue.videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to apply the edit");
      setNotice(`Applied the suggested edit to “${body.video?.title ?? issue.title}”.`);
      await resolve(issue, "applied");
    } catch (err) {
      setError((err as Error).message);
      setBusyId(null);
    }
  };

  /** Approves a deletion request: removes the video, then marks the request applied. */
  const applyDeletion = async (issue: VideoIssue) => {
    if (!window.confirm(`Delete “${issue.title || issue.videoId}” from the library? This can't be undone.`)) {
      return;
    }
    setBusyId(issue.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/videos/library/${issue.videoId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to delete the video");
      setNotice(`Deleted “${issue.title || issue.videoId}”.`);
      await resolve(issue, "applied");
    } catch (err) {
      setError((err as Error).message);
      setBusyId(null);
    }
  };

  /** Approves a submitted video: adds it to the library, then marks it applied. */
  const approveVideoSubmission = async (issue: VideoIssue, submission: Submission) => {
    setBusyId(issue.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/videos/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: issue.videoId,
          title: issue.title || issue.videoId,
          channel: submission.channel || null,
        }),
      });
      const body = await res.json();
      // Already in the library is still an answer to the submission.
      if (!res.ok && res.status !== 409) {
        throw new Error(body?.details || body?.error || "Failed to add the video");
      }
      setNotice(
        res.status === 409
          ? `“${issue.title || issue.videoId}” was already in the library.`
          : `Added “${issue.title || issue.videoId}” to the library.`,
      );
      await resolve(issue, "applied");
    } catch (err) {
      setError((err as Error).message);
      setBusyId(null);
    }
  };

  /** Approves a submitted channel: subscribes to it, then marks it applied. */
  const approveChannelSubmission = async (issue: VideoIssue) => {
    setBusyId(issue.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/youtube/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: issue.title }),
      });
      const body = await res.json();
      if (res.status === 403) throw new Error("Only admins can subscribe to a channel");
      if (!res.ok) throw new Error(body?.error || "Failed to subscribe to the channel");
      setNotice(`Subscribed to ${issue.title}; its videos arrive on the next resync.`);
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

  /** Removes one unavailable video from the library, like the library table's Remove. */
  const removeOne = async (video: UnavailableVideo) => {
    if (!window.confirm(`Remove “${video.title || video.videoId}” from the library? This can't be undone.`)) {
      return;
    }
    setBusyId(video.videoId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/videos/library/${video.videoId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to remove the video");
      setNotice(`Removed “${video.title || video.videoId}”.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  /** Asks YouTube about every stored video again, then reloads the list. */
  const checkNow = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/videos/view-counts", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Checking YouTube failed");
      setNotice(`Checked ${body.videosChecked ?? 0} videos against YouTube.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsChecking(false);
    }
  };

  const removeCount = removeStates
    .filter((state) => state !== "not_embeddable")
    .reduce((sum, state) => sum + takedownCounts[state], 0);

  /** Removes every video in the chosen takedown states, after a confirmation naming the count. */
  const removeUnavailable = async () => {
    if (removeCount === 0) return;
    const breakdown = removeStates
      .filter((state) => state !== "not_embeddable" && takedownCounts[state] > 0)
      .map((state) => `${takedownCounts[state]} ${AVAILABILITY_LABELS[state].label.toLowerCase()}`)
      .join(", ");
    if (
      !window.confirm(
        `Remove ${removeCount} ${removeCount === 1 ? "video" : "videos"} from the library (${breakdown})? ` +
          "They won't be re-imported by the YouTube sync. This can't be undone.",
      )
    ) {
      return;
    }
    setIsRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/videos/availability", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ states: removeStates }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to remove videos");
      setNotice(`Removed ${body.removed} unavailable ${body.removed === 1 ? "video" : "videos"}.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRemoving(false);
    }
  };

  const toggleRemoveState = (state: TakedownState, checked: boolean) => {
    if (state === "not_embeddable") return;
    setRemoveStates((current) =>
      checked ? TAKEDOWN_STATES.filter((s) => s === state || current.includes(s)) : current.filter((s) => s !== state),
    );
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
            {issues.map((issue) => {
              const request = parseChangeRequest(issue);
              const submission = parseSubmission(issue);
              return (
                <li key={issue.id} className="flex flex-wrap items-start gap-3 p-3">
                  {issue.videoId ? (
                    <img
                      src={`https://img.youtube.com/vi/${issue.videoId}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-10 w-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="bg-muted h-10 w-16 shrink-0 rounded" aria-hidden />
                  )}
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

                    {request ? (
                      <>
                        <ul className="text-xs">
                          {Object.entries(request.changes).map(([field, value]) => (
                            <li key={field}>
                              <span className="text-muted-foreground">{FIELD_LABELS[field] ?? field}:</span>{" "}
                              {formatProposedValue(field, value)}
                            </li>
                          ))}
                        </ul>
                        {request.reason && (
                          <p className="text-muted-foreground text-xs">“{request.reason}”</p>
                        )}
                      </>
                    ) : submission ? (
                      <>
                        {submission.url && (
                          <a
                            href={submission.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-xs hover:underline"
                          >
                            {submission.url}
                          </a>
                        )}
                        {submission.channel && (
                          <p className="text-muted-foreground text-xs">Channel: {submission.channel}</p>
                        )}
                        {submission.note && (
                          <p className="text-muted-foreground text-xs">“{submission.note}”</p>
                        )}
                      </>
                    ) : (
                      issue.issue && <p className="text-muted-foreground text-xs">{issue.issue}</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {issue.reportedBy ?? (issue.kind === "transcript" ? "automatic" : "anonymous")} ·{" "}
                      {formatWhen(issue.createdAt)}
                      {issue.videoId ? ` · ${issue.videoId}` : ""}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {issue.status === "open" && request && (
                      <Button
                        size="sm"
                        disabled={busyId === issue.id}
                        onClick={() => applyChangeRequest(issue, request)}
                      >
                        Apply
                      </Button>
                    )}
                    {issue.status === "open" && submission && issue.kind === "submit-video" && (
                      <Button
                        size="sm"
                        disabled={busyId === issue.id}
                        onClick={() => approveVideoSubmission(issue, submission)}
                      >
                        Add to library
                      </Button>
                    )}
                    {issue.status === "open" && issue.kind === "submit-channel" && (
                      <Button
                        size="sm"
                        disabled={busyId === issue.id}
                        onClick={() => approveChannelSubmission(issue)}
                      >
                        Subscribe
                      </Button>
                    )}
                    {issue.status === "open" && issue.kind === "delete" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === issue.id}
                        onClick={() => applyDeletion(issue)}
                      >
                        Delete video
                      </Button>
                    )}
                    {issue.status === "open" && (issue.suggestedStyle || issue.suggestedCategory) && (
                      <Button
                        size="sm"
                        disabled={busyId === issue.id}
                        onClick={() => applyCorrection(issue)}
                      >
                        Apply
                      </Button>
                    )}
                    {issue.status === "open" && issue.kind === "transcript" && (
                      <Button size="sm" disabled={busyId === issue.id} onClick={() => setEditing(issue)}>
                        Add transcript
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
              );
            })}
            {issues.length === 0 && (
              <li className="text-muted-foreground p-3 text-center text-sm">
                {isLoading ? "Loading reports…" : "No reports waiting."}
              </li>
            )}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Unavailable videos{filteredUnavailable.length > 0 ? ` (${filteredUnavailable.length})` : ""}
          </h3>
          <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <Button variant="outline" size="sm" onClick={checkNow} disabled={isChecking || isRemoving}>
              {isChecking ? "Checking YouTube…" : "Check YouTube now"}
            </Button>
            {TAKEDOWN_STATES.filter((state) => state !== "not_embeddable").map((state) => (
              <label key={state} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={removeStates.includes(state)}
                  onChange={(event) => toggleRemoveState(state, event.target.checked)}
                />
                {AVAILABILITY_LABELS[state].label} ({takedownCounts[state]})
              </label>
            ))}
            <Button
              variant="destructive"
              size="sm"
              onClick={removeUnavailable}
              disabled={removeCount === 0 || isRemoving || isChecking}
            >
              {isRemoving
                ? "Removing…"
                : `Remove ${removeCount} unavailable ${removeCount === 1 ? "video" : "videos"}`}
            </Button>
          </div>
          <ul className="divide-y rounded-md border">
            {filteredUnavailable.map((video) => {
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
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyId === video.videoId}
                    onClick={() => removeOne(video)}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
            {filteredUnavailable.length === 0 && (
              <li className="text-muted-foreground p-3 text-center text-sm">
                {isLoading ? "Loading…" : "Every stored video still plays."}
              </li>
            )}
          </ul>
        </section>
      </CardContent>

      <VideoContentDialog
        video={
          editing
            ? ({ videoId: editing.videoId, title: editing.title, channel: "", tournament: null } satisfies ContentDialogVideo)
            : null
        }
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={(message) => {
          setNotice(message);
          // Only a saved transcript answers the report; a summary saved in
          // passing, or a document removed, does not.
          const transcriptLabel = VIDEO_DOCUMENT_LABELS.transcript.label.toLowerCase();
          const issue = editing;
          if (issue?.status === "open" && message.startsWith(`Saved the ${transcriptLabel} `)) {
            void resolve(issue, "applied");
          }
        }}
      />
    </Card>
  );
}
