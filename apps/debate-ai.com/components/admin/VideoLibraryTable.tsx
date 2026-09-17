"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../lib/ui/primitives/button";
import { Badge } from "../../lib/ui/primitives/badge";
import { Input } from "../../lib/ui/primitives/input";
import { Label } from "../../lib/ui/primitives/label";
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

/** One row of the published `videos` table, as the admin API returns it. */
interface LibraryVideo {
  videoId: string;
  source: string;
  title: string;
  publishedAt: string;
  channel: string;
  viewCount: number;
  description: string;
  style: number | null;
  category: string | null;
  categoryKey: string | null;
  tournament: string | null;
  roundLevel: string | null;
  affTeam: string | null;
  negTeam: string | null;
  affWin: boolean | null;
  judgeDecision: string | null;
  isTopPick: boolean;
  speechDocsUrl: string | null;
  seasonYear: number;
}

interface LibraryResponse {
  videos: LibraryVideo[];
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

/** Style picker inside the edit form — lectures carry no numeric style. */
const EDIT_STYLE_OPTIONS = [
  { value: "none", label: "None (lecture)" },
  { value: "1", label: "Policy" },
  { value: "2", label: "PF" },
  { value: "3", label: "LD" },
  { value: "4", label: "College" },
];

const WINNER_OPTIONS = [
  { value: "unknown", label: "Not recorded" },
  { value: "true", label: "Aff won" },
  { value: "false", label: "Neg won" },
];

const PAGE_SIZE = 25;

/** The edit dialog's fields, all held as strings so inputs stay controlled. */
interface EditForm {
  title: string;
  channel: string;
  publishedAt: string;
  viewCount: string;
  style: string;
  category: string;
  tournament: string;
  roundLevel: string;
  affTeam: string;
  negTeam: string;
  affWin: string;
  judgeDecision: string;
  speechDocsUrl: string;
  description: string;
  isTopPick: boolean;
}

function toForm(video: LibraryVideo): EditForm {
  return {
    title: video.title ?? "",
    channel: video.channel ?? "",
    publishedAt: video.publishedAt ?? "",
    viewCount: String(video.viewCount ?? 0),
    style: video.style === null || video.style === undefined ? "none" : String(video.style),
    category: video.category ?? "",
    tournament: video.tournament ?? "",
    roundLevel: video.roundLevel ?? "",
    affTeam: video.affTeam ?? "",
    negTeam: video.negTeam ?? "",
    affWin: video.affWin === null || video.affWin === undefined ? "unknown" : String(video.affWin),
    judgeDecision: video.judgeDecision ?? "",
    speechDocsUrl: video.speechDocsUrl ?? "",
    description: video.description ?? "",
    isTopPick: !!video.isTopPick,
  };
}

/**
 * Derives the lecture category slug the public feed filters on, matching
 * `normalizeCategoryKey` in `debate-data-sync` so an edited category lands in
 * the same bucket a synced one would.
 */
function categoryKeyFor(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[&/]/g, "_");
}

/** The PATCH body for an edit — the whole form, coerced back to row types. */
function toPatch(form: EditForm) {
  return {
    title: form.title.trim(),
    channel: form.channel.trim(),
    publishedAt: form.publishedAt.trim(),
    viewCount: Number(form.viewCount) || 0,
    style: form.style === "none" ? null : Number(form.style),
    category: form.category.trim() || null,
    categoryKey: categoryKeyFor(form.category),
    tournament: form.tournament.trim() || null,
    roundLevel: form.roundLevel.trim() || null,
    affTeam: form.affTeam.trim() || null,
    negTeam: form.negTeam.trim() || null,
    affWin: form.affWin === "unknown" ? null : form.affWin === "true",
    judgeDecision: form.judgeDecision.trim() || null,
    speechDocsUrl: form.speechDocsUrl.trim() || null,
    description: form.description,
    isTopPick: form.isTopPick,
  };
}

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
  const [sort, setSort] = useState("published");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const [editing, setEditing] = useState<LibraryVideo | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      const res = await fetch(`/api/admin/videos/library?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `Request failed: ${res.status}`);
      setData(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, sort, dir, debouncedSearch, style, source]);

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

  const openEditor = (video: LibraryVideo) => {
    setEditing(video);
    setForm(toForm(video));
    setSaveError(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setForm(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editing || !form) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/videos/library/${editing.videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPatch(form)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Save failed");
      // Patch the row in place rather than refetching, so the table does not
      // jump back to the top of a long list after a one-field correction.
      setData((current) =>
        current
          ? {
              ...current,
              videos: current.videos.map((video) =>
                video.videoId === body.video.videoId ? body.video : video,
              ),
            }
          : current,
      );
      setNotice(`Saved “${body.video.title}”.`);
      closeEditor();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
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

  const field = (key: keyof EditForm, label: string, type = "text") => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`video-${key}`}>{label}</Label>
      <Input
        id={`video-${key}`}
        type={type}
        value={String(form?.[key] ?? "")}
        onChange={(event) =>
          setForm((current) => (current ? { ...current, [key]: event.target.value } : current))
        }
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video library</CardTitle>
        <CardDescription>
          Every video already published to the site. Search for one, correct its metadata, or
          remove it — a removed video is also recorded so the weekly YouTube resync does not
          bring it back. “Transcripts” opens the long-form content beside the video: the
          speech-by-speech transcript, the AI summary, and the analysis videos linked to it.
          The round queue further down only holds videos still waiting to be published.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
                  <td className="py-2 pl-2 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditor(video)}>
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
                  <td colSpan={7} className="text-muted-foreground py-6 text-center text-sm">
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

      <Dialog open={!!editing} onOpenChange={(open) => (open ? undefined : closeEditor())}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit video</DialogTitle>
            <DialogDescription>
              {editing?.videoId} — changes apply to the public library immediately.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="flex flex-col gap-4">
              {field("title", "Title")}
              <div className="grid gap-4 sm:grid-cols-2">
                {field("channel", "Channel")}
                {field("publishedAt", "Published (YYYY-MM-DD)")}
                {field("viewCount", "View count", "number")}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="video-style">Style</Label>
                  <Select
                    value={form.style}
                    onValueChange={(value) =>
                      setForm((current) => (current ? { ...current, style: value } : current))
                    }
                  >
                    <SelectTrigger id="video-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDIT_STYLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {field("category", "Lecture category")}
                {field("tournament", "Tournament")}
                {field("roundLevel", "Round level")}
                {field("affTeam", "Aff team")}
                {field("negTeam", "Neg team")}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="video-winner">Winner</Label>
                  <Select
                    value={form.affWin}
                    onValueChange={(value) =>
                      setForm((current) => (current ? { ...current, affWin: value } : current))
                    }
                  >
                    <SelectTrigger id="video-winner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WINNER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {field("judgeDecision", "Judge decision")}
                {field("speechDocsUrl", "Speech docs URL")}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="video-description">Description</Label>
                <textarea
                  id="video-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                  rows={5}
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isTopPick}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, isTopPick: event.target.checked } : current,
                    )
                  }
                />
                Feature as a top pick
              </label>

              {saveError && <p className="text-destructive text-sm">{saveError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VideoContentDialog
        video={contentVideo}
        onOpenChange={(open) => (open ? undefined : setContentVideo(null))}
        onSaved={setNotice}
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
