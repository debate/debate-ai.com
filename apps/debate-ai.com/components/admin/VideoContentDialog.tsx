"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  VIDEO_DOCUMENT_KINDS,
  VIDEO_DOCUMENT_LABELS,
  VIDEO_RELATION_KINDS,
  VIDEO_RELATION_LABELS,
  countWords,
  parseDocumentSections,
  type VideoDocument,
  type VideoDocumentKind,
} from "debate-videos";
import { Button } from "../../lib/ui/primitives/button";
import { Badge } from "../../lib/ui/primitives/badge";
import { Input } from "../../lib/ui/primitives/input";
import { Label } from "../../lib/ui/primitives/label";
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

/**
 * The editor for everything that sits *beside* a video: its long-form
 * documents and the videos linked to it.
 *
 * Separate from the metadata dialog in `VideoLibraryTable` on purpose. A
 * round's transcript is tens of thousands of words, and carrying that in and
 * out of the form that fixes a misspelt team name would make every small
 * correction expensive and every save risky. These have their own endpoints,
 * their own save buttons, and — for the transcript — their own house style:
 * markdown whose `##` headings name the speeches, optionally with the
 * timecode the speech starts at, which is what makes the watch page's panel
 * navigable and its headings clickable.
 */

/** The video this dialog is editing, as the library table holds it. */
export interface ContentDialogVideo {
  videoId: string;
  title: string;
  channel: string;
  tournament: string | null;
}

interface VideoContentDialogProps {
  video: ContentDialogVideo | null;
  onOpenChange: (open: boolean) => void;
  /** Called after a save, so the table can note what changed. */
  onSaved?: (message: string) => void;
}

/** One stored link, as the admin API returns it. */
interface RelationRow {
  videoId: string;
  relatedVideoId: string;
  relation: string;
  note: string | null;
  position: number;
}

/** A candidate for linking, from the library search. */
interface SearchResult {
  videoId: string;
  title: string;
  channel: string;
  tournament: string | null;
  publishedAt: string;
}

/** Who wrote a document — drives the panel's attribution line. */
const AUTHOR_OPTIONS = [
  { value: "editor", label: "Written by an editor" },
  { value: "ai", label: "AI generated" },
  { value: "youtube", label: "Cleaned-up YouTube captions" },
];

/** The house style shown under an empty transcript box. */
const TRANSCRIPT_TEMPLATE = `## 1AC — Aff Team (0:00)

Paste or type the speech here.

## 1NC — Neg Team (9:30)

…`;

/** The dialog's tabs: one per document kind, plus the links tab. */
const TABS = [
  ...VIDEO_DOCUMENT_KINDS.map((kind) => ({ id: kind as string, label: VIDEO_DOCUMENT_LABELS[kind].label })),
  { id: "related", label: "Related videos" },
];

/** An empty document, for a kind this video has nothing stored for yet. */
function blankDocument(videoId: string, kind: VideoDocumentKind): VideoDocument {
  return { videoId, kind, title: "", body: "", author: "editor", model: "", wordCount: 0 };
}

export function VideoContentDialog({ video, onOpenChange, onSaved }: VideoContentDialogProps) {
  const [tab, setTab] = useState<string>(VIDEO_DOCUMENT_KINDS[0]);
  const [documents, setDocuments] = useState<Record<string, VideoDocument>>({});
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [relation, setRelation] = useState<string>("analysis");
  const [note, setNote] = useState("");

  const videoId = video?.videoId ?? null;

  const load = useCallback(async () => {
    if (!videoId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [documentsRes, relationsRes] = await Promise.all([
        fetch(`/api/admin/videos/library/${videoId}/documents`),
        fetch(`/api/admin/videos/library/${videoId}/related`),
      ]);
      const documentsBody = await documentsRes.json();
      const relationsBody = await relationsRes.json();
      if (!documentsRes.ok) throw new Error(documentsBody?.error || "Failed to load documents");
      if (!relationsRes.ok) throw new Error(relationsBody?.error || "Failed to load links");

      const byKind: Record<string, VideoDocument> = {};
      for (const kind of VIDEO_DOCUMENT_KINDS) byKind[kind] = blankDocument(videoId, kind);
      for (const document of documentsBody.documents as VideoDocument[]) {
        byKind[document.kind] = { ...blankDocument(videoId, document.kind), ...document };
      }
      setDocuments(byKind);
      setRelations(relationsBody.relations ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    setTab(VIDEO_DOCUMENT_KINDS[0]);
    setNotice(null);
    setSearch("");
    setResults([]);
    setNote("");
    void load();
  }, [videoId, load]);

  // Search the published library for something to link. Debounced, because
  // this fires on every keystroke against the same endpoint the table pages.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/admin/videos/library?q=${encodeURIComponent(term)}&limit=8`,
        );
        const body = await res.json();
        if (res.ok) setResults(body.videos ?? []);
      } catch {
        // A failed search leaves the previous results; the add box is not
        // worth an error banner of its own.
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const activeDocument = VIDEO_DOCUMENT_KINDS.includes(tab as VideoDocumentKind)
    ? documents[tab]
    : undefined;

  const sections = useMemo(
    () => (activeDocument ? parseDocumentSections(activeDocument.body) : []),
    [activeDocument],
  );
  const liveWordCount = useMemo(
    () => (activeDocument ? countWords(activeDocument.body) : 0),
    [activeDocument],
  );

  const patchDocument = (kind: string, patch: Partial<VideoDocument>) =>
    setDocuments((current) => ({ ...current, [kind]: { ...current[kind], ...patch } }));

  const handleSaveDocument = async () => {
    if (!videoId || !activeDocument) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/videos/library/${videoId}/documents`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: activeDocument.kind,
          title: activeDocument.title ?? "",
          body: activeDocument.body,
          author: activeDocument.author ?? "editor",
          model: activeDocument.model ?? "",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Save failed");
      patchDocument(activeDocument.kind, body.document ?? {});
      const message = `Saved the ${VIDEO_DOCUMENT_LABELS[activeDocument.kind].label.toLowerCase()} (${(body.document?.wordCount ?? 0).toLocaleString()} words).`;
      setNotice(message);
      onSaved?.(message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!videoId || !activeDocument) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/videos/library/${videoId}/documents?kind=${activeDocument.kind}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Delete failed");
      patchDocument(activeDocument.kind, blankDocument(videoId, activeDocument.kind));
      setNotice("Document removed.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLink = async (relatedVideoId: string) => {
    if (!videoId) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/videos/library/${videoId}/related`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedVideoId, relation, note: note.trim() || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Link failed");
      setNote("");
      setSearch("");
      setResults([]);
      await load();
      setNotice("Linked.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlink = async (row: RelationRow) => {
    if (!videoId) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/videos/library/${videoId}/related?relatedVideoId=${row.relatedVideoId}&relation=${row.relation}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Unlink failed");
      setRelations((current) =>
        current.filter(
          (item) =>
            !(item.relatedVideoId === row.relatedVideoId && item.relation === row.relation),
        ),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  /** Moves a link one place up or down and persists the whole new order. */
  const handleMove = async (index: number, delta: number) => {
    if (!videoId) return;
    const next = [...relations];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRelations(next);
    try {
      await fetch(`/api/admin/videos/library/${videoId}/related`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((row) => row.relatedVideoId) }),
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog open={!!video} onOpenChange={(open) => (open ? undefined : onOpenChange(false))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Transcripts &amp; related videos</DialogTitle>
          <DialogDescription>
            {video?.title} — {video?.videoId}. These appear as tabs beside the player on the
            video&apos;s watch page.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1 border-b pb-2">
          {TABS.map((entry) => (
            <Button
              key={entry.id}
              size="sm"
              variant={tab === entry.id ? "secondary" : "ghost"}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
              {documents[entry.id]?.wordCount ? (
                <Badge variant="outline" className="ml-1.5 font-normal">
                  {documents[entry.id].wordCount?.toLocaleString()}
                </Badge>
              ) : null}
              {entry.id === "related" && relations.length > 0 ? (
                <Badge variant="outline" className="ml-1.5 font-normal">
                  {relations.length}
                </Badge>
              ) : null}
            </Button>
          ))}
        </div>

        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}
        {notice && !error && <p className="text-muted-foreground text-sm">{notice}</p>}

        {activeDocument && !isLoading && (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">
              {VIDEO_DOCUMENT_LABELS[activeDocument.kind].description} Start each speech with a
              markdown heading — <code>## 1AC — Michigan (2:15)</code> — and the watch page turns
              it into a jump list whose timecodes seek the video.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="document-title">Panel heading (optional)</Label>
                <Input
                  id="document-title"
                  value={activeDocument.title ?? ""}
                  placeholder={VIDEO_DOCUMENT_LABELS[activeDocument.kind].label}
                  onChange={(event) =>
                    patchDocument(activeDocument.kind, { title: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="document-author">Attribution</Label>
                <Select
                  value={activeDocument.author ?? "editor"}
                  onValueChange={(value) => patchDocument(activeDocument.kind, { author: value })}
                >
                  <SelectTrigger id="document-author">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTHOR_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeDocument.author === "ai" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="document-model">Model</Label>
                  <Input
                    id="document-model"
                    value={activeDocument.model ?? ""}
                    placeholder="Named in the panel's footnote"
                    onChange={(event) =>
                      patchDocument(activeDocument.kind, { model: event.target.value })
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="document-body">Document</Label>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {liveWordCount.toLocaleString()} words
                  {sections.length > 0 && ` · ${sections.filter((s) => s.heading).length} speeches`}
                </span>
              </div>
              <textarea
                id="document-body"
                value={activeDocument.body}
                placeholder={activeDocument.kind === "transcript" ? TRANSCRIPT_TEMPLATE : undefined}
                onChange={(event) =>
                  patchDocument(activeDocument.kind, { body: event.target.value })
                }
                rows={18}
                spellCheck={false}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </div>

            {sections.some((section) => section.heading) && (
              <div className="flex flex-wrap gap-1.5">
                {sections
                  .filter((section) => section.heading)
                  .map((section, index) => (
                    <Badge key={index} variant="outline" className="font-normal">
                      {section.heading}
                      <span className="text-muted-foreground ml-1 tabular-nums">
                        {section.wordCount.toLocaleString()}w
                      </span>
                    </Badge>
                  ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={handleSaveDocument} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save document"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDeleteDocument}
                disabled={isSaving || !activeDocument.wordCount}
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        {tab === "related" && !isLoading && (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">
              Videos listed here fill the watch page&apos;s “Analysis” tab — the round-analysis
              videos made about this round, say. This is a stated link, unlike the stacked
              playlists the YouTube sync derives from video descriptions.
            </p>

            <div className="flex flex-col gap-2 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="link-search">Find a video to link</Label>
                  <Input
                    id="link-search"
                    value={search}
                    placeholder="Title, channel, tournament or video id…"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="link-relation">Relation</Label>
                  <Select value={relation} onValueChange={setRelation}>
                    <SelectTrigger id="link-relation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_RELATION_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {VIDEO_RELATION_LABELS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="link-note">Note (optional)</Label>
                <Input
                  id="link-note"
                  value={note}
                  placeholder="Why these belong together — shown under the card"
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>

              {isSearching && <p className="text-muted-foreground text-xs">Searching…</p>}

              {results.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {results
                    .filter((result) => result.videoId !== video?.videoId)
                    .map((result) => (
                      <li key={result.videoId} className="flex items-center gap-2 p-2">
                        <img
                          src={`https://img.youtube.com/vi/${result.videoId}/mqdefault.jpg`}
                          alt=""
                          loading="lazy"
                          className="h-9 w-14 shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{result.title}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {result.channel}
                            {result.tournament ? ` · ${result.tournament}` : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => handleLink(result.videoId)}
                        >
                          Link
                        </Button>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <ul className="divide-y rounded-md border">
              {relations.map((row, index) => (
                <li key={`${row.relation}-${row.relatedVideoId}`} className="flex items-center gap-2 p-2">
                  <img
                    src={`https://img.youtube.com/vi/${row.relatedVideoId}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="h-9 w-14 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {row.relatedVideoId}
                      <Badge variant="outline" className="ml-1.5 font-normal">
                        {VIDEO_RELATION_LABELS[row.relation as keyof typeof VIDEO_RELATION_LABELS] ??
                          row.relation}
                      </Badge>
                    </p>
                    {row.note && <p className="text-muted-foreground truncate text-xs">{row.note}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => handleMove(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={index === relations.length - 1}
                    onClick={() => handleMove(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button size="sm" variant="outline" disabled={isSaving} onClick={() => handleUnlink(row)}>
                    Unlink
                  </Button>
                </li>
              ))}
              {relations.length === 0 && (
                <li className="text-muted-foreground p-3 text-center text-sm">
                  Nothing linked to this video yet.
                </li>
              )}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
