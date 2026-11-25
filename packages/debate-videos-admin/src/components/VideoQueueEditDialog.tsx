"use client";

import { useEffect, useState } from "react";
import { LECTURE_CATEGORIES } from "@debate-ai/videos/src/data/lecture-classifier";
import { Button } from "../ui/primitives/button";
import { Input } from "../ui/primitives/input";
import { Label } from "../ui/primitives/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/primitives/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select";

/** One queued round video, as the admin queue page holds it. */
export interface QueueVideo {
  id: string;
  title: string;
  publishedAt: string;
  channel: string;
  views: number;
  description: string;
  style: number | null;
  category: string | null;
  tournament: string | null;
  roundLevel: string | null;
  aff: string | null;
  neg: string | null;
  winner: boolean | null;
  judgeDecision: string | null;
}

/** Style picker inside the edit form — lectures carry no numeric style. */
const EDIT_STYLE_OPTIONS = [
  { value: "none", label: "None (lecture)" },
  { value: "1", label: "Policy" },
  { value: "2", label: "PF" },
  { value: "3", label: "LD" },
  { value: "4", label: "College" },
  { value: "5", label: "Worlds" },
  { value: "6", label: "Atlantic" },
  { value: "8", label: "Parliamentary" },
  { value: "7", label: "Misc" },
];

/** Select value for "no lecture category" — Radix Select can't hold `""`. */
const NO_CATEGORY = "none";

const WINNER_OPTIONS = [
  { value: "unknown", label: "Not recorded" },
  { value: "true", label: "Aff won" },
  { value: "false", label: "Neg won" },
];

/** The edit dialog's fields, all held as strings so inputs stay controlled. */
export interface QueueEditForm {
  title: string;
  channel: string;
  publishedAt: string;
  description: string;
  style: string;
  category: string;
  tournament: string;
  roundLevel: string;
  affTeam: string;
  negTeam: string;
  affWin: string;
  judgeDecision: string;
}

function toForm(video: QueueVideo): QueueEditForm {
  return {
    title: video.title ?? "",
    channel: video.channel ?? "",
    publishedAt: video.publishedAt ?? "",
    description: video.description ?? "",
    style: video.style === null || video.style === undefined ? "none" : String(video.style),
    category: video.category ?? "",
    tournament: video.tournament ?? "",
    roundLevel: video.roundLevel ?? "",
    affTeam: video.aff ?? "",
    negTeam: video.neg ?? "",
    affWin: video.winner === null || video.winner === undefined ? "unknown" : String(video.winner),
    judgeDecision: video.judgeDecision ?? "",
  };
}

/** The PATCH body for `/api/admin/youtube/videos/[id]` — the form coerced back to row columns. */
function toPatch(form: QueueEditForm): Record<string, unknown> {
  return {
    title: form.title.trim(),
    channel: form.channel.trim(),
    publishedAt: form.publishedAt.trim(),
    description: form.description.trim(),
    style: form.style === "none" ? null : Number(form.style),
    category: form.category.trim() || null,
    tournament: form.tournament.trim() || null,
    roundLevel: form.roundLevel.trim() || null,
    aff: form.affTeam.trim() || null,
    neg: form.negTeam.trim() || null,
    winner: form.affWin === "unknown" ? null : form.affWin === "true",
    judgeDecision: form.judgeDecision.trim() || null,
  };
}

/** The lecture-category picker's options: every category the classifier
 * produces, plus the video's current label when it is a legacy one outside
 * that set, so opening the dialog never silently drops a stored category. */
function categoryOptions(current: string): string[] {
  const options: string[] = [...LECTURE_CATEGORIES];
  if (current && !options.includes(current)) options.push(current);
  return options;
}

interface VideoQueueEditDialogProps {
  /** The queued video being edited; `null` closes the dialog. */
  video: QueueVideo | null;
  onClose: () => void;
  /** Called with the saved row once the PATCH succeeds. */
  onSaved: (video: QueueVideo) => void;
}

/** The metadata editor for one queued video: title, channel, style,
 * lecture category and the round fields the queue row carries. */
export function VideoQueueEditDialog({ video, onClose, onSaved }: VideoQueueEditDialogProps) {
  const [form, setForm] = useState<QueueEditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setForm(video ? toForm(video) : null);
    setSaveError(null);
  }, [video]);

  const handleSave = async () => {
    if (!video || !form) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/youtube/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPatch(form)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || body?.details || "Save failed");
      onSaved({ ...video, ...toPatch(form) });
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const field = (key: keyof QueueEditForm, label: string, type = "text") => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`queue-video-${key}`}>{label}</Label>
      <Input
        id={`queue-video-${key}`}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
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
          <DialogTitle>Edit queued video</DialogTitle>
          <DialogDescription>
            {video?.id} — fix the metadata before publishing. Changes apply to this queued
            video; publish it when it's right.
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("title", "Title")}
              {field("channel", "Channel")}
              {field("publishedAt", "Published (YYYY-MM-DD)")}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="queue-video-style">Style</Label>
                <Select
                  value={form.style}
                  onValueChange={(value) =>
                    setForm((current) => (current ? { ...current, style: value } : current))
                  }
                >
                  <SelectTrigger id="queue-video-style">
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="queue-video-category">Lecture category</Label>
                <Select
                  value={form.category || NO_CATEGORY}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current ? { ...current, category: value === NO_CATEGORY ? "" : value } : current,
                    )
                  }
                >
                  <SelectTrigger id="queue-video-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>None</SelectItem>
                    {categoryOptions(form.category).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field("tournament", "Tournament")}
              {field("roundLevel", "Round level")}
              {field("affTeam", "Aff team")}
              {field("negTeam", "Neg team")}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="queue-video-winner">Winner</Label>
                <Select
                  value={form.affWin}
                  onValueChange={(value) =>
                    setForm((current) => (current ? { ...current, affWin: value } : current))
                  }
                >
                  <SelectTrigger id="queue-video-winner">
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
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="queue-video-description">Description</Label>
              <textarea
                id="queue-video-description"
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

            {saveError && <p className="text-destructive text-sm">{saveError}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
