/**
 * @fileoverview Which library videos count as "incomplete", and how an
 * auto-fill suggestion is laid over one without touching what is already
 * filled in. Shared by the admin "Incomplete videos" panel (client) and the
 * `incomplete=1` filter of `/api/admin/videos/library` (server), so the list
 * and the bulk run agree on what "missing" means.
 * @module lib/incomplete-videos
 */

/** The fields a round (a video with a debate style) should have. */
export const ROUND_REQUIRED_FIELDS = [
  "tournament",
  "roundLevel",
  "affTeam",
  "negTeam",
  "affWin",
  "arg1ac",
  "arg2nr",
] as const;

/** The fields a lecture (a video with no debate style) should have. */
export const LECTURE_REQUIRED_FIELDS = ["category"] as const;

export type RequiredField =
  | (typeof ROUND_REQUIRED_FIELDS)[number]
  | (typeof LECTURE_REQUIRED_FIELDS)[number];

/** Short labels for the panel's "missing" chips. */
export const REQUIRED_FIELD_LABELS: Record<RequiredField, string> = {
  tournament: "Tournament",
  roundLevel: "Round",
  affTeam: "Aff team",
  negTeam: "Neg team",
  affWin: "Winner",
  arg1ac: "Aff args",
  arg2nr: "Neg args",
  category: "Category",
};

/** The slice of a library row this module reads. */
export interface IncompleteCheckVideo {
  style: number | null;
  category?: string | null;
  tournament?: string | null;
  roundLevel?: string | null;
  affTeam?: string | null;
  negTeam?: string | null;
  affWin?: boolean | null;
  arg1ac?: string | null;
  arg2nr?: string | null;
}

const isBlank = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

/** The required fields this video is missing, in display order. */
export function missingFields(video: IncompleteCheckVideo): RequiredField[] {
  const required: readonly RequiredField[] =
    video.style === null || video.style === undefined ? LECTURE_REQUIRED_FIELDS : ROUND_REQUIRED_FIELDS;
  return required.filter((field) => isBlank(video[field]));
}

/** What `/api/admin/videos/library/autofill` suggests (absent = no suggestion). */
export interface AutofillSuggestion {
  category?: string | null;
  tournament?: string | null;
  roundLevel?: string | null;
  affTeam?: string | null;
  negTeam?: string | null;
  affWin?: boolean | null;
  judgeDecision?: string | null;
  speechDocsUrl?: string | null;
  arg1ac?: string | null;
  arg2nr?: string | null;
}

/** Turns a lecture category label into the slug the public feed filters on. */
function categoryKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[&/]/g, "_");
}

/**
 * The PATCH that fills only this video's blank fields from a suggestion.
 * Nothing already filled in is changed — not even when the model disagrees —
 * and the style is never touched, so a round can't be turned into a lecture.
 * The judge decision and speech-doc link are filled too when blank, though
 * they don't make a video "incomplete". Returns `{}` when nothing would change.
 */
export function fillMissingPatch(
  video: IncompleteCheckVideo & { judgeDecision?: string | null; speechDocsUrl?: string | null },
  suggestion: AutofillSuggestion,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const fillText = (
    key: "tournament" | "roundLevel" | "affTeam" | "negTeam" | "arg1ac" | "arg2nr" | "judgeDecision" | "speechDocsUrl",
  ) => {
    const value = suggestion[key];
    if (isBlank(video[key]) && typeof value === "string" && value.trim()) patch[key] = value.trim();
  };

  const isLecture = video.style === null || video.style === undefined;
  if (isLecture) {
    const category = suggestion.category;
    if (isBlank(video.category) && typeof category === "string" && category.trim()) {
      patch.category = category.trim();
      patch.categoryKey = categoryKey(category);
    }
    return patch;
  }

  fillText("tournament");
  fillText("roundLevel");
  fillText("affTeam");
  fillText("negTeam");
  fillText("arg1ac");
  fillText("arg2nr");
  fillText("judgeDecision");
  fillText("speechDocsUrl");
  if (isBlank(video.affWin) && typeof suggestion.affWin === "boolean") patch.affWin = suggestion.affWin;
  return patch;
}
