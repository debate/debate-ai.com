"use client";

import { useCallback, useEffect, useState } from "react";
import { parseYouTubeVideoId } from "debate-videos";
import { Button } from "../../lib/ui/primitives/button";
import { Badge } from "../../lib/ui/primitives/badge";
import { Input } from "../../lib/ui/primitives/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../lib/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../lib/ui/primitives/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../lib/ui/primitives/select";
import { VideoContentDialog, type ContentDialogVideo } from "./VideoContentDialog";
import { VideoEditDialog, emptyLibraryVideo, type LibraryVideo } from "./VideoEditDialog";


/** A table row: the editable video plus what the listing says about its transcript. */
type LibraryRow = LibraryVideo & {
  /** Words in the typed-up transcript, or `null` when there is none. */
  transcriptWords?: number | null;
  /** Whether YouTube's captions are cached for it. */
  hasCaptions?: boolean;
};

interface LibraryResponse {
  videos: LibraryRow[];
  page: number;
  limit: number;
  pageCount: number;
  total: number;
}

const STYLE_NAMES: Record<number, string> = { 1: "Policy", 2: "PF", 3: "LD", 4: "College" };

const STYLE_OPTIONS = [
  { value: "all", label: "All styles" },
  { value: "1", label: "Policy" },
  { value: "2", label: "PF" },
  { value: "3", label: "LD" },
  { value: "4", label: "College" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Everything" },
  { value: "round", label: "Rounds" },
  { value: "lecture", label: "Lectures" },
];

const TRANSCRIPT_OPTIONS = [
  { value: "all", label: "Any transcript" },
  { value: "with", label: "Has transcript" },
  { value: "without", label: "No transcript" },
];

const PAGE_SIZE = 25;


/**
 * Browse, edit and remove any video already published to the library.
 *
 * The queue below this card only lists rounds *waiting* to be published; once
 * a video goes live it leaves that queue, so this is where a published
 * video's metadata gets corrected or the video gets pulled.
 */
export function VideoLibraryTable() {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [style, setStyle] = useState("all");
  const [source, setSource] = useState("all");
  const [transcript, setTranscript] = useState("all");
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isOpeningAdd, setIsOpeningAdd] = useState(false);
  const [sort, setSort] = useState("published");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const [editing, setEditing] = useState<LibraryVideo | null>(null);
  const [adding, setAdding] = useState<LibraryVideo | null>(null);

  const [contentVideo, setContentVideo] = useState<ContentDialogVideo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LibraryVideo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort,
        dir,
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (style !== "all") params.set("style", style);
      if (source !== "all") params.set("source", source);
      if (transcript !== "all") params.set("transcript", transcript);
      const res = await fetch(`/api/admin/videos/library?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `Request failed: ${res.status}`);
      setData(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, sort, dir, debouncedSearch, style, source, transcript]);

  useEffect(() => {
    load();
  }, [load]);

  /** First click on a column sorts it descending; clicking it again flips. */
  const toggleSort = (key: string) => {
    if (sort === key) {
      setDir((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setDir(key === "title" || key === "channel" ? "asc" : "desc");
    }
    setPage(1);
  };

  /**
   * Opens the transcript editor for any YouTube video, pasted as a link or an
   * id — published or not. Documents are keyed by video id alone, so one
   * written before a round is published is waiting for it when it is.
   */
  const openAnyVideo = async () => {
    const videoId = parseYouTubeVideoId(addInput);
    if (!videoId) {
      setAddError("That doesn't look like a YouTube link or video id.");
      return;
    }
    setAddError(null);
    setIsOpeningAdd(true);
    try {
      // A 404 just means the video isn't published yet — still editable.
      const res = await fetch(`/api/admin/videos/library/${encodeURIComponent(videoId)}`);
      const body = res.ok ? await res.json().catch(() => null) : null;
      const video = body?.video as LibraryVideo | undefined;
      setContentVideo({
        videoId,
        title: video?.title || "Not in the library yet",
        channel: video?.channel ?? "",
        tournament: video?.tournament ?? null,
      });
      setAddInput("");
    } catch {
      setAddError("Could not reach the server.");
    } finally {
      setIsOpeningAdd(false);
    }
  };

  const handleSaved = (saved: LibraryVideo) => {
    // Patch the row in place rather than refetching, so the table does not
    // jump back to the top of a long list after a one-field correction.
    setData((current) =>
      current
        ? {
            ...current,
            videos: current.videos.map((video) =>
              // Keep the transcript flags: the edit endpoint returns the bare row.
            video.videoId === saved.videoId ? { ...video, ...saved } : video,
            ),
          }
        : current,
    );
    setNotice(`Saved “${saved.title}”.`);
    setEditing(null);
  };

  const handleAdded = (added: LibraryVideo) => {
    setNotice(`Added “${added.title}” to the library.`);
    setAdding(null);
    void load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/videos/library/${confirmDelete.videoId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Delete failed");
      setNotice(`Removed “${confirmDelete.title}” from the library.`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const videos = data?.videos ?? [];
  const pageCount = data?.pageCount ?? 1;

  const headerButton = (key: string, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className={`hover:text-foreground transition-colors ${
        sort === key ? "text-foreground font-medium" : ""
      }`}
    >
      {label}
      {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Video library</CardTitle>
          <Button size="sm" onClick={() => setAdding(emptyLibraryVideo())}>
            + Add video
          </Button>
        </div>
        <CardDescription>
          Every video already published to the site. Search for one, correct its metadata, or
          remove it — a removed video is also recorded so the weekly YouTube resync does not
          bring it back. “Transcripts” opens the long-form content beside the video: the
          speech-by-speech transcript, the AI summary, and the analysis videos linked to it.
          The Transcript column shows which videos have one; paste any YouTube link below to
          write one for a video that isn&apos;t in this list.
          The round queue further down only holds videos still waiting to be published.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void openAnyVideo();
          }}
        >
          <Input
            value={addInput}
            onChange={(event) => {
              setAddInput(event.target.value);
              setAddError(null);
            }}
            placeholder="Paste any YouTube link or video id to add a transcript…"
            className="max-w-md"
            aria-label="YouTube link or video id"
          />
          <Button type="submit" size="sm" disabled={isOpeningAdd || !addInput.trim()}>
            {isOpeningAdd ? "Opening…" : "Add transcript"}
          </Button>
          {addError && <span className="text-destructive text-sm">{addError}</span>}
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, channel, tournament or video id…"
            className="max-w-sm"
          />
          <Select
            value={style}
            onValueChange={(value) => {
              setStyle(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
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
          <Select
            value={source}
            onValueChange={(value) => {
              setSource(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={transcript}
            onValueChange={(value) => {
              setTranscript(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSCRIPT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            {isLoading ? "Loading…" : "Refresh"}
          </Button>
          {data && (
            <span className="text-muted-foreground text-sm">
              {data.total.toLocaleString()} matching
            </span>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {notice && <p className="text-muted-foreground text-sm">{notice}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="py-2 pr-3 font-normal">{headerButton("title", "Video")}</th>
                <th className="px-2 py-2 font-normal">{headerButton("style", "Style")}</th>
                <th className="px-2 py-2 font-normal">{headerButton("category", "Category")}</th>
                <th className="px-2 py-2 font-normal">{headerButton("channel", "Channel")}</th>
                <th className="px-2 py-2 font-normal">{headerButton("published", "Published")}</th>
                <th className="px-2 py-2 text-right font-normal">{headerButton("views", "Views")}</th>
                <th className="px-2 py-2 font-normal">Transcript</th>
                <th className="py-2 pl-2 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.videoId} className="hover:bg-accent/40 border-b transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                        alt=""
                        className="h-10 w-16 shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                      <div className="flex min-w-0 flex-col">
                        <a
                          href={`https://www.youtube.com/watch?v=${video.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-medium hover:underline"
                        >
                          {video.title || "—"}
                        </a>
                        <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                          {video.videoId}
                          {video.isTopPick && (
                            <Badge variant="secondary" className="font-normal">
                              top pick
                            </Badge>
                          )}
                          {video.tournament && <span>{video.tournament}</span>}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className="font-normal">
                      {video.style === null ? "Lecture" : STYLE_NAMES[video.style] ?? "Unknown"}
                    </Badge>
                  </td>
                  {/* The lecture category label, its own column rather than
                      standing in for the style badge: a lecture has both a
                      kind and a subject, and folding them into one cell meant
                      the table could not be scanned (or sorted) by either. */}
                  <td className="px-2 py-2">
                    {video.category ? (
                      <Badge variant="secondary" className="font-normal">
                        {video.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="text-muted-foreground max-w-40 truncate px-2 py-2 text-xs">
                    {video.channel || "—"}
                  </td>
                  <td className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap">
                    {video.publishedAt || "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {video.viewCount.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {video.transcriptWords ? (
                      <Badge
                        variant="secondary"
                        className="font-normal"
                        title="A typed-up transcript is on the watch page"
                      >
                        {video.transcriptWords.toLocaleString()} words
                      </Badge>
                    ) : video.hasCaptions ? (
                      <Badge
                        variant="outline"
                        className="font-normal"
                        title="No typed-up transcript, but YouTube's captions are cached — import them from the Transcripts dialog"
                      >
                        captions only
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(video)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setContentVideo({
                            videoId: video.videoId,
                            title: video.title,
                            channel: video.channel,
                            tournament: video.tournament,
                          })
                        }
                      >
                        Transcripts
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setConfirmDelete(video);
                          setDeleteError(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {videos.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground py-6 text-center text-sm">
                    {isLoading ? "Loading videos…" : "No published videos match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Page {data?.page ?? page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={isLoading || page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={isLoading || page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>


      <VideoEditDialog video={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      <VideoEditDialog
        video={adding}
        isNew
        onClose={() => setAdding(null)}
        onSaved={handleAdded}
      />

      <VideoContentDialog
        video={contentVideo}
        onOpenChange={(open) => (open ? undefined : setContentVideo(null))}
        onSaved={(message) => {
          setNotice(message);
          // Refresh the Transcript column behind the dialog.
          void load();
        }}
      />

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => (open ? undefined : setConfirmDelete(null))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this video?</DialogTitle>
            <DialogDescription>
              “{confirmDelete?.title}” will be deleted from the public library and added to the
              resync exclusion list, so a future YouTube sync will not re-publish it. This cannot
              be undone from here.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Removing…" : "Remove video"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
