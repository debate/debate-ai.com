"use client";

/**
 * @fileoverview Admin "Incomplete videos" section: every published video
 * missing a field it should have (a round's tournament, round, teams, winner
 * or arguments; a lecture's category), with the same "Auto-fill with AI" the
 * edit dialog has, per video or for all of them in one run.
 *
 * Auto-fill only ever fills blanks. A field that already has a value is left
 * as it is, whatever the suggestion says, and the style is never changed
 * (see `fillMissingPatch`). Each filled video is saved with the same PATCH
 * the edit dialog uses, so it is marked admin-edited like any other edit.
 * @module components/IncompleteVideosPanel
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../ui/primitives/badge";
import { Button } from "../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/primitives/card";
import {
  fillMissingPatch,
  missingFields,
  REQUIRED_FIELD_LABELS,
  type AutofillSuggestion,
} from "../lib/incomplete-videos";
import { VideoEditDialog, type LibraryVideo } from "./VideoEditDialog";

/** Rows per page in the list, and per batch in the "Autofill all" run. */
const PAGE_SIZE = 25;
const BATCH_SIZE = 50;
/** The run stops after this many failures in a row (a missing key, a rate limit). */
const MAX_CONSECUTIVE_FAILURES = 5;

const STYLE_LABELS: Record<number, string> = {
  1: "Policy",
  2: "PF",
  3: "LD",
  4: "College",
  5: "WSD",
  6: "ACC",
  7: "Misc",
};

interface LibraryPage {
  videos: LibraryVideo[];
  page: number;
  pageCount: number;
  /** `null` on keyset pages (`after`), which skip the count. */
  total: number | null;
}

/** Totals of an "Autofill all" run, shown as it goes. */
export interface AutofillRunProgress {
  checked: number;
  filled: number;
  unchanged: number;
  failed: number;
  finished: boolean;
  stopped: boolean;
}

/** "Checked 40 · filled 31 · nothing to add 7 · failed 2" plus how it ended. */
export function formatAutofillRunProgress(progress: AutofillRunProgress): string {
  const parts = [
    `Checked ${progress.checked}`,
    `filled ${progress.filled}`,
    `nothing to add ${progress.unchanged}`,
  ];
  if (progress.failed > 0) parts.push(`failed ${progress.failed}`);
  const line = parts.join(" · ");
  if (progress.stopped) return `${line} — stopped.`;
  if (progress.finished) return `${line} — done.`;
  return `${line}…`;
}

/** Tries per page when the server answers 503 busy (D1 overloaded). */
const BUSY_ATTEMPTS = 3;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchIncomplete(params: Record<string, string>): Promise<LibraryPage> {
  const query = new URLSearchParams({ incomplete: "1", ...params });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`/api/admin/videos/library?${query}`);
    // A busy database: wait as asked rather than retrying straight away,
    // which only keeps D1 overloaded.
    if (res.status === 503 && attempt < BUSY_ATTEMPTS) {
      const seconds = Number(res.headers.get("Retry-After")) || 5;
      await wait(seconds * 1000);
      continue;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load videos");
    return body as LibraryPage;
  }
}

/**
 * Runs auto-fill on one video and saves whatever blanks it can fill.
 * @returns The saved row when something was filled, `null` when there was nothing to add.
 */
async function autofillOne(video: LibraryVideo): Promise<LibraryVideo | null> {
  const res = await fetch("/api/admin/videos/library/autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId: video.videoId,
      title: video.title,
      channel: video.channel,
      description: video.description,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || "Auto-fill failed");
  const patch = fillMissingPatch(video, (body.fields ?? {}) as AutofillSuggestion);
  if (Object.keys(patch).length === 0) return null;

  const saved = await fetch(`/api/admin/videos/library/${video.videoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const savedBody = await saved.json();
  if (!saved.ok) throw new Error(savedBody?.details || savedBody?.error || "Save failed");
  return (savedBody.video as LibraryVideo) ?? { ...video, ...patch };
}

export function IncompleteVideosPanel() {
  const [data, setData] = useState<LibraryPage | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowNotice, setRowNotice] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<AutofillRunProgress | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LibraryVideo | null>(null);
  const stopRef = useRef(false);

  const load = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchIncomplete({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        sort: "published",
        dir: "desc",
      });
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const autofillRow = async (video: LibraryVideo) => {
    setRowBusy(video.videoId);
    try {
      const saved = await autofillOne(video);
      const stillMissing = saved ? missingFields(saved).length : missingFields(video).length;
      setRowNotice((notes) => ({
        ...notes,
        [video.videoId]: !saved
          ? "Nothing to add"
          : stillMissing > 0
            ? "Filled some fields"
            : "Complete",
      }));
      if (saved) {
        setData((current) =>
          current
            ? {
                ...current,
                videos: current.videos.map((row) => (row.videoId === saved.videoId ? saved : row)),
              }
            : current,
        );
      }
    } catch (err) {
      setRowNotice((notes) => ({ ...notes, [video.videoId]: (err as Error).message }));
    } finally {
      setRowBusy(null);
    }
  };

  const autofillAll = async () => {
    stopRef.current = false;
    setRunning(true);
    setRunError(null);
    const totals: AutofillRunProgress = {
      checked: 0,
      filled: 0,
      unchanged: 0,
      failed: 0,
      finished: false,
      stopped: false,
    };
    setProgress({ ...totals });
    let consecutiveFailures = 0;
    try {
      // Walks the incomplete videos by id, so one that stays incomplete
      // (the model couldn't tell) is not picked up again in the same run.
      let after = "";
      outer: while (true) {
        const batch = await fetchIncomplete({
          sort: "id",
          dir: "asc",
          limit: String(BATCH_SIZE),
          ...(after ? { after } : {}),
        });
        if (batch.videos.length === 0) break;
        for (const video of batch.videos) {
          if (stopRef.current) {
            totals.stopped = true;
            break outer;
          }
          totals.checked += 1;
          after = video.videoId;
          try {
            const saved = await autofillOne(video);
            if (saved) totals.filled += 1;
            else totals.unchanged += 1;
            consecutiveFailures = 0;
          } catch (err) {
            totals.failed += 1;
            consecutiveFailures += 1;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              totals.stopped = true;
              setRunError(
                `Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row. Last error: ${(err as Error).message}`,
              );
              break outer;
            }
          }
          setProgress({ ...totals });
        }
        if (batch.videos.length < BATCH_SIZE) break;
      }
      totals.finished = !totals.stopped;
      setProgress({ ...totals });
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setRunning(false);
      void load(1);
      setPage(1);
    }
  };

  const total = data?.total ?? 0;
  const pageCount = data?.pageCount ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incomplete videos</CardTitle>
        <CardDescription>
          Published videos missing details: rounds without a tournament, round, teams, winner or either
          side&rsquo;s arguments, and lectures without a category. Auto-fill reads YouTube, the title and
          the description (with AI for what the title doesn&rsquo;t say) and saves only the blank fields;
          anything already filled in is left alone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={autofillAll} disabled={running || total === 0}>
            {running ? "Auto-filling…" : `Autofill all${total ? ` (${total})` : ""}`}
          </Button>
          {running && (
            <Button
              variant="outline"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              Stop
            </Button>
          )}
          {progress && (
            <span className="text-muted-foreground text-sm">{formatAutofillRunProgress(progress)}</span>
          )}
        </div>
        {runError && <p className="text-destructive text-sm">{runError}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}

        {data && total === 0 && !isLoading && (
          <p className="text-muted-foreground text-sm">Every video has all its details filled in.</p>
        )}

        {data && data.videos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-3 font-normal">Video</th>
                  <th className="px-2 py-2 font-normal">Style</th>
                  <th className="px-2 py-2 font-normal">Missing</th>
                  <th className="py-2 pl-2 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.videos.map((video) => {
                  const missing = missingFields(video);
                  const notice = rowNotice[video.videoId];
                  return (
                    <tr key={video.videoId} className="border-b align-top last:border-0">
                      <td className="max-w-md py-2 pr-3">
                        <div className="line-clamp-2">{video.title}</div>
                        <div className="text-muted-foreground text-xs">
                          {video.channel} · {video.videoId}
                        </div>
                        {notice && <div className="text-muted-foreground mt-1 text-xs">{notice}</div>}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className="font-normal">
                          {video.style === null ? "Lecture" : STYLE_LABELS[video.style] ?? `Style ${video.style}`}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {missing.length === 0 ? (
                            <span className="text-muted-foreground text-xs">Nothing</span>
                          ) : (
                            missing.map((field) => (
                              <Badge key={field} variant="secondary" className="font-normal">
                                {REQUIRED_FIELD_LABELS[field]}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-2 pl-2 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={running || rowBusy !== null}
                          onClick={() => autofillRow(video)}
                        >
                          {rowBusy === video.videoId ? "Filling…" : "Autofill"}
                        </Button>{" "}
                        <Button size="sm" variant="ghost" disabled={running} onClick={() => setEditing(video)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && pageCount > 1 && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              Page {data.page} of {pageCount} · {total} videos
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading || running || data.page <= 1}
                onClick={() => setPage(data.page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading || running || data.page >= pageCount}
                onClick={() => setPage(data.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <VideoEditDialog
        video={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load(page);
        }}
      />
    </Card>
  );
}
