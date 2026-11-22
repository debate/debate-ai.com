"use client";

import { useEffect, useState } from "react";
import { parseYouTubeVideoId } from "@debate-ai/videos";
import { LECTURE_CATEGORIES } from "@debate-ai/videos/src/data/lecture-classifier";
import { canonicalCategoryLabel } from "@debate-ai/videos/src/data/video-rows";
import { JudgeVotes } from "@debate-ai/videos/src/components/videos/watch/JudgeVotes";
import { parseJudgePanel, roundKey, type CollegeResultsLookup } from "../lib/college-results";
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
  /** The affirmative's arguments — plan or advocacy and advantages (the 1AC). */
  arg1ac?: string | null;
  /** The negative's positions — what was run, ideally what went for the 2NR. */
  arg2nr?: string | null;
  isTopPick: boolean;
  speechDocsUrl: string | null;
  seasonYear: number;
  /** College rounds: the judges, comma-separated (from College Debate Results). */
  resultsJudges?: string | null;
  /** College rounds: judges in the minority; `""` for a unanimous decision, null when unknown. */
  resultsSquirrels?: string | null;
}

/** Style picker inside the edit form — lectures carry no numeric style. */
const EDIT_STYLE_OPTIONS = [
  { value: "none", label: "None (lecture)" },
  { value: "1", label: "Policy" },
  { value: "2", label: "PF" },
  { value: "3", label: "LD" },
  { value: "4", label: "College" },
  { value: "5", label: "WSD" },
  { value: "6", label: "ACC" },
  { value: "8", label: "Parli" },
  { value: "7", label: "Misc" },
];

/** Select value for "no lecture category" — Radix Select can't hold `""`. */
const NO_CATEGORY = "none";

/**
 * The lecture-category picker's options: every category the classifier
 * produces, plus the video's current label when it is a legacy one outside
 * that set, so opening the dialog never silently drops a stored category.
 */
function categoryOptions(current: string): string[] {
  const options: string[] = [...LECTURE_CATEGORIES];
  if (current && !options.includes(current)) options.push(current);
  return options;
}

const WINNER_OPTIONS = [
  { value: "unknown", label: "Not recorded" },
  { value: "true", label: "Aff won" },
  { value: "false", label: "Neg won" },
];

/** The edit dialog's fields, all held as strings so inputs stay controlled. */
export interface EditForm {
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
  arg1ac: string;
  arg2nr: string;
  description: string;
  isTopPick: boolean;
  /**
   * The judges, comma-separated, with an asterisk after each judge who
   * squirreled (voted with the minority) — the way College Debate Results
   * writes elim panels: "Jacob Wilkus, Cade Blenden*, AJ Byrne".
   */
  judges: string;
}

export function toForm(video: LibraryVideo): EditForm {
  return {
    title: video.title ?? "",
    channel: video.channel ?? "",
    publishedAt: video.publishedAt ?? "",
    viewCount: String(video.viewCount ?? 0),
    style: video.style === null || video.style === undefined ? "none" : String(video.style),
    category: video.category ? canonicalCategoryLabel(video.category) : "",
    tournament: video.tournament ?? "",
    roundLevel: video.roundLevel ?? "",
    affTeam: video.affTeam ?? "",
    negTeam: video.negTeam ?? "",
    affWin: video.affWin === null || video.affWin === undefined ? "unknown" : String(video.affWin),
    judgeDecision: video.judgeDecision ?? "",
    speechDocsUrl: video.speechDocsUrl ?? "",
    arg1ac: video.arg1ac ?? "",
    arg2nr: video.arg2nr ?? "",
    description: video.description ?? "",
    isTopPick: !!video.isTopPick,
    judges: markSquirrels(video.resultsJudges, video.resultsSquirrels),
  };
}

const namesOf = (list: string | null | undefined): string[] =>
  (list ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

/** `"A, B, C"` + squirrels `"B"` → `"A, B*, C"`, the judges field's spelling. */
export function markSquirrels(judges: string | null | undefined, squirrels: string | null | undefined): string {
  const minority = new Set(namesOf(squirrels).map((name) => name.toLowerCase()));
  return namesOf(judges)
    .map((name) => (minority.has(name.toLowerCase()) ? `${name}*` : name))
    .join(", ");
}

/**
 * The judges field back to its two columns: the plain names, and the starred
 * ones as the squirrels. No stars reads as nobody squirreling (`""`) unless
 * the ballot count says somebody did, when who it was is unknown (null).
 */
export function judgesColumns(
  value: string,
  judgeDecision: string,
): { resultsJudges: string | null; resultsSquirrels: string | null } {
  const entries = namesOf(value);
  if (entries.length === 0) return { resultsJudges: null, resultsSquirrels: null };
  const plain = (name: string) => name.replace(/\*+$/, "").trim();
  const starred = entries.filter((name) => name.endsWith("*")).map(plain);
  const split = judgeDecision.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
  const splitDecision = !!split && Math.min(Number(split[1]), Number(split[2])) > 0;
  return {
    resultsJudges: entries.map(plain).join(", "),
    resultsSquirrels: starred.length > 0 ? starred.join(", ") : splitDecision ? null : "",
  };
}

/**
 * Derives the lecture category slug the public feed filters on, matching
 * `normalizeCategoryKey` in the former `debate-data-sync` package so an edited category lands in
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
    arg1ac: form.arg1ac.trim() || null,
    arg2nr: form.arg2nr.trim() || null,
    description: form.description,
    isTopPick: form.isTopPick,
    ...judgesColumns(form.judges, form.judgeDecision),
  };
}

/** Fields a viewer's suggestion may change — mirrors `SUGGESTABLE_FIELDS` on the server. */
const SUGGESTABLE_FIELDS = [
  "title",
  "channel",
  "publishedAt",
  "description",
  "style",
  "category",
  "tournament",
  "roundLevel",
  "affTeam",
  "negTeam",
  "affWin",
  "judgeDecision",
  "speechDocsUrl",
  "arg1ac",
  "arg2nr",
  "resultsJudges",
  "resultsSquirrels",
] as const;

/**
 * The fields a suggestion actually changes: the edited form's patch, minus
 * every field that still matches the stored row.
 */
export function changedFields(original: LibraryVideo, form: EditForm): Record<string, unknown> {
  const before = toPatch(toForm(original)) as Record<string, unknown>;
  const after = toPatch(form) as Record<string, unknown>;
  const changes: Record<string, unknown> = {};
  for (const field of SUGGESTABLE_FIELDS) {
    if (before[field] !== after[field]) changes[field] = after[field];
  }
  return changes;
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
    arg1ac: null,
    arg2nr: null,
    isTopPick: false,
    speechDocsUrl: null,
    seasonYear: 0,
    resultsJudges: null,
    resultsSquirrels: null,
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
    | "arg1ac"
    | "arg2nr"
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
  setText("arg1ac", fields.arg1ac);
  setText("arg2nr", fields.arg2nr);
  if (typeof fields.viewCount === "number") next.viewCount = String(fields.viewCount);
  if (fields.style !== undefined) next.style = fields.style === null ? "none" : String(fields.style);
  if (typeof fields.affWin === "boolean") next.affWin = String(fields.affWin);
  return next;
}

/** The style value of college policy rounds — the only videos College Debate Results covers. */
export const COLLEGE_STYLE = "4";

/**
 * Lays a College Debate Results match over the form: the winner (only when
 * the site states one), the elim ballot count, the sides as the site records
 * them, and the round level when the form's isn't a recognisable round.
 */
export function applyCollegeResult(form: EditForm, result: CollegeResultsLookup): EditForm {
  const next = { ...form };
  if (result.sidesSwapped) {
    next.affTeam = form.negTeam;
    next.negTeam = form.affTeam;
  }
  if (result.match) {
    // Blank team boxes take the site's names for the (possibly swapped) sides.
    if (!next.affTeam.trim()) next.affTeam = result.match.affTeam;
    if (!next.negTeam.trim()) next.negTeam = result.match.negTeam;
    const panel = parseJudgePanel(result.match.judges, result.ballots);
    if (panel.judges.length > 0) next.judges = markSquirrels(panel.judges.join(", "), panel.squirrels?.join(", "));
  }
  if (result.winnerSide) next.affWin = String(result.winnerSide === "aff");
  if (result.ballots) next.judgeDecision = result.ballots;
  if (result.round && !roundKey(form.roundLevel)) next.roundLevel = result.round;
  return next;
}

/** The fields "Use this result" can change, with their labels for the confirmation line. */
const COLLEGE_RESULT_FIELDS = [
  ["affTeam", "Aff team"],
  ["negTeam", "Neg team"],
  ["affWin", "Winner"],
  ["judgeDecision", "Judge decision"],
  ["roundLevel", "Round level"],
  ["judges", "Judges"],
] as const;

type CollegeResultField = (typeof COLLEGE_RESULT_FIELDS)[number][0];

/** How a field reads in the confirmation line: the winner as its option label. */
function describeField(key: CollegeResultField, form: EditForm): string {
  if (key === "affWin") return WINNER_OPTIONS.find((option) => option.value === form.affWin)?.label ?? form.affWin;
  return form[key];
}

/**
 * Which fields applying a result changes, and the sentence that says so —
 * or says the form already matched, so the button never looks dead.
 */
export function describeCollegeResultChanges(
  before: EditForm,
  after: EditForm,
): { changed: CollegeResultField[]; message: string } {
  const changed = COLLEGE_RESULT_FIELDS.filter(([key]) => before[key] !== after[key]).map(([key]) => key);
  if (changed.length === 0) {
    return { changed, message: "The form already matches this result — nothing to change." };
  }
  const parts = COLLEGE_RESULT_FIELDS.filter(([key]) => changed.includes(key)).map(
    ([key, label]) => `${label}: ${describeField(key, after)}`,
  );
  return { changed, message: `Filled in ${parts.join(", ")}. Save to keep it.` };
}

/** A saved video's watch-page path before and after the edit; `null` when unknown. */
export interface SavedVideoPaths {
  href: string | null;
  previousHref: string | null;
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
  /**
   * Called with the saved row once the PATCH (or POST) succeeds. An edit also
   * passes the video's watch-page paths from before and after the save, so a
   * watch page can follow the video when a corrected title, tournament or
   * team name moves its address.
   */
  onSaved: (video: LibraryVideo, paths?: SavedVideoPaths) => void;
  /**
   * `suggest` is the viewer's version: nothing is saved — the changed fields,
   * or a deletion request, go to the moderators' review queue instead.
   * Staff-only controls (auto-fill, view count, top pick) are hidden.
   */
  mode?: "staff" | "suggest";
  /** Suggest mode: called with a confirmation once a request is filed. */
  onSubmitted?: (message: string) => void;
}

/**
 * The metadata editor for one published video, shared by the admin library
 * table and the "Edit video" button admins and moderators see on a watch page.
 */
export function VideoEditDialog({
  video,
  isNew = false,
  onClose,
  onSaved,
  mode = "staff",
  onSubmitted,
}: VideoEditDialogProps) {
  const isSuggest = mode === "suggest" && !isNew;
  const [form, setForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [isFilling, setIsFilling] = useState(false);
  const [fillNotice, setFillNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookup, setLookup] = useState<CollegeResultsLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string[]>([]);

  useEffect(() => {
    setForm(video ? toForm(video) : null);
    setSaveError(null);
    setLinkInput("");
    setFillNotice(null);
    setReason("");
    setLookup(null);
    setLookupError(null);
    setAppliedNotice(null);
    setHighlighted([]);
  }, [video]);

  /** "Use this result": fills the form, then shows and highlights what changed. */
  const useCollegeResult = () => {
    if (!form || !lookup) return;
    const next = applyCollegeResult(form, lookup);
    const { changed, message } = describeCollegeResultChanges(form, next);
    setForm(next);
    setAppliedNotice(message);
    setHighlighted(changed);
    const first = changed[0] === "affWin" ? "video-winner" : changed[0] ? `video-${changed[0]}` : null;
    if (first) {
      // Let the new values render, then bring the first changed field into view.
      setTimeout(() => document.getElementById(first)?.scrollIntoView?.({ block: "center", behavior: "smooth" }), 0);
    }
  };

  /** A ring around fields "Use this result" just changed. */
  const highlight = (key: string) => (highlighted.includes(key) ? "ring-2 ring-emerald-500" : "");

  /** College rounds only: finds this debate on College Debate Results. */
  const handleLookup = async () => {
    if (!form) return;
    setIsLookingUp(true);
    setLookup(null);
    setLookupError(null);
    setAppliedNotice(null);
    setHighlighted([]);
    try {
      const params = new URLSearchParams({
        tournament: form.tournament,
        roundLevel: form.roundLevel,
        affTeam: form.affTeam,
        negTeam: form.negTeam,
        seasonYear: String(video?.seasonYear ?? ""),
        publishedAt: form.publishedAt,
      });
      const res = await fetch(`/api/videos/college-results?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Lookup failed");
      setLookup(body as CollegeResultsLookup);
    } catch (err) {
      setLookupError((err as Error).message);
    } finally {
      setIsLookingUp(false);
    }
  };

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
      const parts = [body.fromYouTube && "YouTube", body.fromTitle && "the title", body.fromAi && "AI"].filter(
        (part): part is string => Boolean(part),
      );
      const sources = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] ?? "";
      setFillNotice(
        [`Filled from ${sources} — check the fields before saving.`, ...(body.warnings ?? [])].join(" "),
      );
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setIsFilling(false);
    }
  };

  /** Suggest mode: files an edit or deletion request for a moderator to review. */
  const submitRequest = async (kind: "edit" | "delete") => {
    if (!video || !form) return;
    const proposedChanges = kind === "edit" ? changedFields(video, form) : undefined;
    if (proposedChanges && Object.keys(proposedChanges).length === 0) {
      setSaveError("Change at least one field first.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/video-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          videoId: video.videoId,
          title: video.title,
          reason: reason.trim(),
          proposedChanges,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not submit your request");
      onSubmitted?.(
        kind === "delete"
          ? "Deletion request sent to the moderators."
          : "Thanks — your changes were sent to the moderators for approval.",
      );
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (isSuggest) return submitRequest("edit");
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
      if (typeof body.href === "string") {
        onSaved(body.video, {
          href: body.href,
          previousHref: typeof body.previousHref === "string" ? body.previousHref : null,
        });
      } else {
        onSaved(body.video);
      }
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
        className={highlight(key)}
        type={type}
        value={String(form?.[key] ?? "")}
        onChange={(event) =>
          setForm((current) => (current ? { ...current, [key]: event.target.value } : current))
        }
      />
    </div>
  );

  /** A two-line box for one side's arguments, which run longer than a team name. */
  const argumentsField = (key: "arg1ac" | "arg2nr", label: string, placeholder: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`video-${key}`}>{label}</Label>
      <textarea
        id={`video-${key}`}
        value={form?.[key] ?? ""}
        placeholder={placeholder}
        onChange={(event) =>
          setForm((current) => (current ? { ...current, [key]: event.target.value } : current))
        }
        rows={2}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 placeholder:text-muted-foreground w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
      />
    </div>
  );

  return (
    <Dialog open={!!video} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add video" : isSuggest ? "Suggest an edit" : "Edit video"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Paste a YouTube link, then auto-fill or type the details. The video is public as soon as you add it."
              : isSuggest
                ? "Fix anything that's wrong — a moderator reviews your changes before they go live."
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
            {!isSuggest && (
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
                  tournament, teams, each side&apos;s arguments and result. Empty answers leave
                  your fields alone.
                </span>
              </div>
            )}
            {fillNotice && <p className="text-muted-foreground text-sm">{fillNotice}</p>}
            {form.style === COLLEGE_STYLE && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleLookup}
                    disabled={isLookingUp || isSaving}
                  >
                    {isLookingUp ? "Looking up…" : "🏛️ Look up results"}
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    Finds this round on College Debate Results by tournament, season, round and
                    teams. The winner is only filled in when the site records the decision.
                  </span>
                </div>
                {lookupError && <p className="text-destructive text-sm">{lookupError}</p>}
                {lookup && (
                  <div className="flex flex-col gap-1.5 text-sm" data-testid="college-results">
                    <p className={lookup.status === "verified" ? "font-medium" : "text-muted-foreground"}>
                      {lookup.message}
                    </p>
                    {lookup.tournament && (
                      <a
                        href={lookup.tournament.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline"
                      >
                        {lookup.tournament.name} · {lookup.tournament.season}
                        {lookup.round ? ` · ${lookup.round}` : ""}
                      </a>
                    )}
                    {lookup.match && (
                      <ul className="text-muted-foreground text-xs">
                        <li>
                          AFF: {lookup.match.affTeam} ({lookup.match.affDebaters})
                        </li>
                        <li>
                          NEG: {lookup.match.negTeam} ({lookup.match.negDebaters})
                        </li>
                        {lookup.match.judges && (
                          <li>
                            <JudgeVotes
                              judges={lookup.match.judges}
                              affWin={lookup.winnerSide ? lookup.winnerSide === "aff" : null}
                            />
                          </li>
                        )}
                        {lookup.match.decision && <li>Decision: {lookup.match.decision}</li>}
                      </ul>
                    )}
                    {lookup.sidesSwapped && (
                      <p className="text-xs text-amber-600">
                        The site lists these teams on the opposite sides; using the result swaps them.
                      </p>
                    )}
                    {lookup.candidates.length > 0 && (
                      <ul className="text-muted-foreground text-xs">
                        {lookup.candidates.map((candidate) => (
                          <li key={candidate.id}>
                            {candidate.name}
                            {candidate.startDate ? ` (${candidate.startDate})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {lookup.match && (
                      <div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={useCollegeResult}
                        >
                          Use this result
                        </Button>
                      </div>
                    )}
                    {appliedNotice && (
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
                        {appliedNotice}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {field("title", "Title")}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("channel", "Channel")}
              {field("publishedAt", "Published (YYYY-MM-DD)")}
              {!isSuggest && field("viewCount", "View count", "number")}
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="video-category">Lecture category</Label>
                <Select
                  value={form.category || NO_CATEGORY}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current
                        ? { ...current, category: value === NO_CATEGORY ? "" : value }
                        : current,
                    )
                  }
                >
                  <SelectTrigger id="video-category">
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
                <Label htmlFor="video-winner">Winner</Label>
                <Select
                  value={form.affWin}
                  onValueChange={(value) =>
                    setForm((current) => (current ? { ...current, affWin: value } : current))
                  }
                >
                  <SelectTrigger id="video-winner" className={highlight("affWin")}>
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
              {(form.style === COLLEGE_STYLE || form.judges) && (
                <div className="flex flex-col gap-1">
                  {field("judges", "Judges (* after a judge who squirreled)")}
                  <JudgeVotes
                    className="text-xs text-muted-foreground"
                    judges={form.judges}
                    affWin={form.affWin === "unknown" ? null : form.affWin === "true"}
                  />
                </div>
              )}
              {field("speechDocsUrl", "Speech docs URL")}
              {argumentsField("arg1ac", "Aff arguments", "Plan / advocacy and advantages (1AC)")}
              {argumentsField("arg2nr", "Neg arguments", "Positions run, e.g. Cap K, Politics DA, T")}
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

            {isSuggest ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="video-reason">Why? (optional)</Label>
                <Input
                  id="video-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. this is a college round, not high school"
                />
              </div>
            ) : (
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
            )}

            {saveError && <p className="text-destructive text-sm">{saveError}</p>}
          </div>
        )}

        <DialogFooter>
          {isSuggest && (
            <Button
              variant="ghost"
              className="text-destructive mr-auto"
              onClick={() => submitRequest("delete")}
              disabled={isSaving}
              title="Ask the moderators to take this video off the site"
            >
              Request deletion
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isFilling || (isNew && !videoId)}>
            {isSaving
              ? isSuggest
                ? "Sending…"
                : "Saving…"
              : isNew
                ? "Add video"
                : isSuggest
                  ? "Submit for approval"
                  : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
