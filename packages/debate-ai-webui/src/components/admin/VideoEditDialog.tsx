"use client";

import { useEffect, useState } from "react";
import { parseYouTubeVideoId } from "debate-videos";
import { Button } from "../../lib/ui/primitives/button";
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

/** One row of the published `videos` table, as the admin API returns it. */
export interface LibraryVideo {
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

/** A blank row for the "Add video" form. */
export function emptyLibraryVideo(): LibraryVideo {
  return {
    videoId: "",
    source: "lecture",
    title: "",
    publishedAt: "",
    channel: "",
    viewCount: 0,
    description: "",
    style: null,
    category: null,
    categoryKey: null,
    tournament: null,
    roundLevel: null,
    affTeam: null,
    negTeam: null,
    affWin: null,
    judgeDecision: null,
    isTopPick: false,
    speechDocsUrl: null,
    seasonYear: 0,
  };
}

/** What `/api/admin/videos/library/autofill` suggests; absent keys mean "no suggestion". */
type AutofillFields = Partial<
  Pick<
    LibraryVideo,
    | "title"
    | "channel"
    | "publishedAt"
    | "viewCount"
    | "description"
    | "style"
    | "category"
    | "tournament"
    | "roundLevel"
    | "affTeam"
    | "negTeam"
    | "affWin"
    | "judgeDecision"
    | "speechDocsUrl"
  >
>;

/**
 * Lays auto-fill suggestions over the form. An empty suggestion never blanks
 * a field the admin already filled — "the model couldn't tell" is not "clear
 * it" — except for style, where `null` is a real answer (a lecture).
 */
function applyAutofill(form: EditForm, fields: AutofillFields): EditForm {
  const next = { ...form };
  const setText = (key: keyof EditForm, value: unknown) => {
    if (typeof value === "string" && value.trim()) (next[key] as string) = value;
  };
  setText("title", fields.title);
  setText("channel", fields.channel);
  setText("publishedAt", fields.publishedAt);
  setText("description", fields.description);
  setText("category", fields.category);
  setText("tournament", fields.tournament);
  setText("roundLevel", fields.roundLevel);
  setText("affTeam", fields.affTeam);
  setText("negTeam", fields.negTeam);
  setText("judgeDecision", fields.judgeDecision);
  setText("speechDocsUrl", fields.speechDocsUrl);
  if (typeof fields.viewCount === "number") next.viewCount = String(fields.viewCount);
  if (fields.style !== undefined) next.style = fields.style === null ? "none" : String(fields.style);
  if (typeof fields.affWin === "boolean") next.affWin = String(fields.affWin);
  return next;
}

interface VideoEditDialogProps {
  /** The video being edited; `null` closes the dialog. */
  video: LibraryVideo | null;
  /**
   * Adds a new video instead of editing one: the form asks for the YouTube
   * link and saves with a POST. Pass {@link emptyLibraryVideo} as `video`.
   */
  isNew?: boolean;
  onClose: () => void;
  /** Called with the saved row once the PATCH (or POST) succeeds. */
  onSaved: (video: LibraryVideo) => void;
}

/**
 * The metadata editor for one published video, shared by the admin library
 * table and the "Edit video" button admins and moderators see on a watch page.
 */
export function VideoEditDialog({ video, isNew = false, onClose, onSaved }: VideoEditDialogProps) {
  const [form, setForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [isFilling, setIsFilling] = useState(false);
  const [fillNotice, setFillNotice] = useState<string | null>(null);

  useEffect(() => {
    setForm(video ? toForm(video) : null);
    setSaveError(null);
    setLinkInput("");
    setFillNotice(null);
  }, [video]);

  /** The id being edited, or the one parsed from the pasted link when adding. */
  const videoId = isNew ? parseYouTubeVideoId(linkInput) : video?.videoId ?? null;

  const handleAutofill = async () => {
    if (!form || !videoId) return;
    setIsFilling(true);
    setSaveError(null);
    setFillNotice(null);
    try {
      const res = await fetch("/api/admin/videos/library/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          title: form.title,
          channel: form.channel,
          description: form.description,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Auto-fill failed");
      setForm((current) => (current ? applyAutofill(current, body.fields ?? {}) : current));
      const sources = [body.fromYouTube && "YouTube", body.fromAi && "AI"].filter(Boolean).join(" and ");
      setFillNotice(
        [`Filled from ${sources} — check the fields before saving.`, ...(body.warnings ?? [])].join(" "),
      );
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setIsFilling(false);
    }
  };

  const handleSave = async () => {
    if (!video || !form) return;
    if (isNew && !videoId) {
      setSaveError("Paste a YouTube link or video id first.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = isNew
        ? await fetch("/api/admin/videos/library", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId, ...toPatch(form) }),
          })
        : await fetch(`/api/admin/videos/library/${video.videoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toPatch(form)),
          });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Save failed");
      onSaved(body.video);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

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
    <Dialog open={!!video} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add video" : "Edit video"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Paste a YouTube link, then auto-fill or type the details. The video is public as soon as you add it."
              : `${video?.videoId} — changes apply to the public library immediately.`}
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="flex flex-col gap-4">
            {isNew && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="video-link">YouTube link or video id</Label>
                <Input
                  id="video-link"
                  value={linkInput}
                  onChange={(event) => setLinkInput(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  autoFocus
                />
                {linkInput.trim() && !videoId && (
                  <span className="text-destructive text-xs">
                    That doesn&apos;t look like a YouTube link or video id.
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAutofill}
                disabled={!videoId || isFilling || isSaving}
              >
                {isFilling ? "Auto-filling…" : "✨ Auto-fill with AI"}
              </Button>
              <span className="text-muted-foreground text-xs">
                Reads YouTube&apos;s title and description and fills in the style, category,
                tournament, teams and result. Empty answers leave your fields alone.
              </span>
            </div>
            {fillNotice && <p className="text-muted-foreground text-sm">{fillNotice}</p>}
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
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isFilling || (isNew && !videoId)}>
            {isSaving ? "Saving…" : isNew ? "Add video" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
