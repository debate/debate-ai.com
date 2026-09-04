/**
 * @fileoverview Grounding-materials library and prompt builder for the
 * "Video-Lecture-Training Coach AI" idea in TODO.md ("Let coaches upload
 * practice-round recordings, lecture transcripts, camp materials, and
 * approved instructional documents to create a private team coach AI that
 * explains concepts and gives advice grounded in that team's own teaching
 * materials."). Organizes a team's caller-supplied materials into a
 * kind-grouped library, scores each material's relevance to a question with
 * a deterministic keyword-overlap heuristic (mirroring
 * `debate-card-search`'s `llm-card-scoring.ts` relevance scoring), and
 * composes a self-contained, grounded prompt from the most relevant
 * materials — mirroring `../opponent/opponent-personas.ts` and
 * `../judge/judge-paradigms.ts`'s "structured prompt section" convention.
 * This is the first slice only — it doesn't transcribe recordings, parse
 * uploaded documents, call any AI model, or persist a team's materials.
 * Follow-ups: (a) transcription/parsing that turns an uploaded recording or
 * document into a `CoachMaterial`'s `text`, (b) an actual AI Q&A call that
 * consumes `buildGroundedCoachPrompt`'s output, (c) a materials-upload/coach
 * chat panel UI, (d) persisting a team's `CoachMaterial`s.
 *
 * A reviewer/approval workflow gates a material's `status` before it grounds
 * an "Ask the coach" answer — the "reviewer/approval workflow before a saved
 * material is available to the team coach" follow-up named under idea #8 in
 * TODO.md. This repo has no roles/auth system (see
 * `debate-search-evidence`'s `reviewer-permissions.ts` for the same honest
 * limitation elsewhere), so "reviewer" here is a free-form id/name, not a
 * permission check — see `isCoachMaterialApproved`/`approveCoachMaterial`/
 * `rejectCoachMaterial` below.
 *
 * @module coach/team-coach-materials
 */

/** The four material types the "Video-Lecture-Training Coach AI" idea names. */
export type CoachMaterialKind =
  | "lecture_transcript"
  | "camp_material"
  | "instructional_document"
  | "practice_recording";

/**
 * A material's place in the reviewer/approval workflow. A material with no
 * `status` at all (every material saved before this field existed) is
 * treated the same as `"approved"` — see `isCoachMaterialApproved` — so this
 * follow-up doesn't retroactively hide anything already trusted.
 */
export type CoachMaterialStatus = "pending" | "approved" | "rejected";

/** Every `CoachMaterialStatus`, for a validator's/dropdown's fixed option set. */
export const COACH_MATERIAL_STATUSES: CoachMaterialStatus[] = ["pending", "approved", "rejected"];

/** Human-readable label for each `CoachMaterialStatus`, for badge/filter display. */
export const COACH_MATERIAL_STATUS_LABELS: Record<CoachMaterialStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

/** A single piece of grounding material a coach has uploaded for the team coach AI. */
export interface CoachMaterial {
  id: string;
  kind: CoachMaterialKind;
  title: string;
  /** Topic this material primarily covers, e.g. a resolution or argument block. */
  topic?: string;
  tags: string[];
  /** Transcript or document text this material grounds an answer in. */
  text: string;
  /** Reviewer/approval workflow gate. Missing is treated as `"approved"` — see `isCoachMaterialApproved`. */
  status?: CoachMaterialStatus;
  /** Free-form id/name of whoever last reviewed this material (no roles system exists to verify it). */
  reviewedBy?: string;
  /** Epoch milliseconds of the last review decision. */
  reviewedAt?: number;
  /** Optional reviewer note, most useful on a rejection to explain why. */
  reviewNote?: string;
}

/** One kind's materials, in caller-supplied order. */
export interface CoachMaterialGroup {
  kind: CoachMaterialKind;
  materials: CoachMaterial[];
}

/** A team's full coach-material library, grouped by kind. */
export interface CoachMaterialLibrary {
  groups: CoachMaterialGroup[];
  totalMaterials: number;
}

/** A material scored against a question, 0 (no overlap) to 1 (every query token matched). */
export interface CoachMaterialMatch {
  material: CoachMaterial;
  relevance: number;
}

export interface FindRelevantMaterialsOptions {
  /** Restrict candidates to materials tagged with this exact topic. */
  topic?: string;
  /** Cap the number of matches returned, most relevant first. */
  limit?: number;
  /** Minimum relevance (exclusive) a material must clear to be returned. Defaults to 0. */
  minRelevance?: number;
}

export interface GroundedCoachPromptOptions {
  /** Maximum characters of each material's text included in the prompt. */
  excerptLength?: number;
}

/**
 * One already-answered question/answer pair in an "Ask the coach"
 * conversation, persisted so a later question can build on it. See
 * `state/coachConversation.ts` for the persistence layer and
 * `buildCoachConversationMessages` below for how a turn becomes part of a
 * later AI call's message history.
 */
export interface CoachConversationTurn {
  id: string;
  question: string;
  answer: string;
  /** Epoch milliseconds the turn was recorded at. */
  askedAt: number;
}

/** A single turn of an Anthropic-style chat `messages` array. */
export interface AnthropicChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** How many of a conversation's most recent turns are fed back as context by default. */
const DEFAULT_MAX_HISTORY_TURNS = 6;

export interface BuildCoachConversationMessagesOptions extends GroundedCoachPromptOptions {
  /**
   * Caps how many of `history`'s most recent turns are included as context
   * (default 6 — older turns are dropped rather than growing every call's
   * prompt without bound). Pass 0 to omit history entirely.
   */
  maxHistoryTurns?: number;
}

/** Display order for library groups — most commonly consulted kinds first. */
export const COACH_MATERIAL_KIND_ORDER: CoachMaterialKind[] = [
  "lecture_transcript",
  "camp_material",
  "instructional_document",
  "practice_recording",
];

/** Human-readable label for each `CoachMaterialKind`, for form/badge display. */
export const COACH_MATERIAL_KIND_LABELS: Record<CoachMaterialKind, string> = {
  lecture_transcript: "Lecture Transcript",
  camp_material: "Camp Material",
  instructional_document: "Instructional Document",
  practice_recording: "Practice-Round Recording",
};

const DEFAULT_EXCERPT_LENGTH = 320;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

/** Groups a team's materials by kind, in a stable kind order, omitting kinds with no materials. */
export function buildCoachMaterialLibrary(materials: CoachMaterial[]): CoachMaterialLibrary {
  const byKind = new Map<CoachMaterialKind, CoachMaterial[]>();
  for (const material of materials) {
    const bucket = byKind.get(material.kind);
    if (bucket) {
      bucket.push(material);
    } else {
      byKind.set(material.kind, [material]);
    }
  }

  const groups = COACH_MATERIAL_KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
    kind,
    materials: byKind.get(kind) as CoachMaterial[],
  }));

  return { groups, totalMaterials: materials.length };
}

/**
 * Scores how relevant `material` is to `query` as the share of the query's
 * distinct tokens that also appear among the material's title, tags, and
 * body text. Returns 0 for an empty query.
 */
export function scoreMaterialRelevance(material: CoachMaterial, query: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) {
    return 0;
  }

  const materialTokens = new Set([
    ...tokenize(material.title),
    ...tokenize(material.text),
    ...material.tags.flatMap(tokenize),
  ]);

  let hits = 0;
  for (const token of queryTokens) {
    if (materialTokens.has(token)) {
      hits += 1;
    }
  }

  return hits / queryTokens.size;
}

/**
 * Finds and ranks the materials most relevant to `query`, most relevant
 * first (ties broken alphabetically by title), optionally scoped to a topic
 * and capped at `limit`.
 */
export function findRelevantMaterials(
  materials: CoachMaterial[],
  query: string,
  options: FindRelevantMaterialsOptions = {},
): CoachMaterialMatch[] {
  const { topic, limit, minRelevance = 0 } = options;

  const scoped = topic === undefined ? materials : materials.filter((material) => material.topic === topic);

  const matches = scoped
    .map((material) => ({ material, relevance: scoreMaterialRelevance(material, query) }))
    .filter((match) => match.relevance > minRelevance)
    .sort((a, b) => b.relevance - a.relevance || a.material.title.localeCompare(b.material.title));

  return typeof limit === "number" ? matches.slice(0, limit) : matches;
}

/** Truncates `text` to `maxLength` characters (default 320), appending an ellipsis when cut. */
export function excerptMaterialText(text: string, maxLength: number = DEFAULT_EXCERPT_LENGTH): string {
  const trimmed = text.trim();
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

/**
 * Composes a self-contained prompt asking a future AI call to answer
 * `question` using only the given grounding-material matches, suitable for
 * inserting into a team coach AI Q&A call. Instructs the model to say so
 * rather than guess when the materials don't cover the question.
 */
export function buildGroundedCoachPrompt(
  question: string,
  matches: CoachMaterialMatch[],
  options: GroundedCoachPromptOptions = {},
): string {
  const { excerptLength = DEFAULT_EXCERPT_LENGTH } = options;

  const lines = [
    "Team Coach AI",
    "Answer strictly using the grounding materials below. If they don't cover the question, say so instead of guessing.",
    "",
    `Question: ${question}`,
    "",
  ];

  if (matches.length === 0) {
    lines.push("Grounding materials: none matched this question.");
    return lines.join("\n");
  }

  lines.push("Grounding materials (most relevant first):");
  matches.forEach((match, index) => {
    const { material } = match;
    const topicSuffix = material.topic === undefined ? "" : ` (topic: ${material.topic})`;
    lines.push(
      "",
      `${index + 1}. [${COACH_MATERIAL_KIND_LABELS[material.kind]}] ${material.title}${topicSuffix}`,
      excerptMaterialText(material.text, excerptLength),
    );
  });

  return lines.join("\n");
}

/**
 * Composes the full `messages` array for an "Ask the coach" AI call: each of
 * `history`'s most recent turns (capped at `maxHistoryTurns`, oldest of the
 * kept turns first) as an alternating user/assistant pair, followed by
 * `question`'s own `buildGroundedCoachPrompt` output as the final user turn
 * — so a follow-up question ("what about a counter-interp?") can build on
 * an earlier answer while the current question still gets its own
 * freshly-matched grounding materials rather than reusing an earlier turn's.
 */
export function buildCoachConversationMessages(
  question: string,
  matches: CoachMaterialMatch[],
  history: CoachConversationTurn[] = [],
  options: BuildCoachConversationMessagesOptions = {},
): AnthropicChatTurn[] {
  const { maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS, ...promptOptions } = options;
  const recentHistory = maxHistoryTurns > 0 ? history.slice(-maxHistoryTurns) : [];

  const messages: AnthropicChatTurn[] = [];
  for (const turn of recentHistory) {
    messages.push({ role: "user", content: turn.question });
    messages.push({ role: "assistant", content: turn.answer });
  }
  messages.push({ role: "user", content: buildGroundedCoachPrompt(question, matches, promptOptions) });

  return messages;
}

export interface CoachMaterialFilterOptions {
  /** Case-insensitive substring match against title, topic, tags, and body text. */
  query?: string;
  /** Restrict to materials carrying this exact tag. */
  tag?: string;
}

/** Every distinct tag across `materials`, alphabetically sorted, for a filter bar's tag dropdown. */
export function listCoachMaterialTags(materials: CoachMaterial[]): string[] {
  const tags = new Set<string>();
  for (const material of materials) {
    for (const tag of material.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

/**
 * Filters materials by a case-insensitive keyword search across title,
 * topic, tags, and body text, and/or an exact tag match — the search/filter
 * bar follow-up named under idea #8 in TODO.md, for once a library grows
 * past a handful of uploads. Returns every material unchanged when neither
 * option is given.
 */
export function filterCoachMaterials(
  materials: CoachMaterial[],
  options: CoachMaterialFilterOptions = {},
): CoachMaterial[] {
  const { query, tag } = options;
  const needle = query?.trim().toLowerCase();

  return materials.filter((material) => {
    if (tag !== undefined && !material.tags.includes(tag)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    const haystack = [material.title, material.topic ?? "", ...material.tags, material.text]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

/**
 * Whether `material` is currently live for the team coach AI: `"approved"`,
 * or no `status` at all (a material saved before this field existed).
 * `"pending"` and `"rejected"` are excluded.
 */
export function isCoachMaterialApproved(material: CoachMaterial): boolean {
  return material.status === undefined || material.status === "approved";
}

/** Narrows `materials` to only those `isCoachMaterialApproved` — what "Ask the coach" is allowed to draw on. */
export function filterApprovedCoachMaterials(materials: CoachMaterial[]): CoachMaterial[] {
  return materials.filter(isCoachMaterialApproved);
}

/** Narrows `materials` to those still awaiting a review decision. */
export function filterPendingCoachMaterials(materials: CoachMaterial[]): CoachMaterial[] {
  return materials.filter((material) => material.status === "pending");
}

/**
 * Records a review decision on `material`, stamping who made it and when.
 * Pure — returns a new record rather than mutating; a caller
 * (`state/coachMaterials.ts#setCoachMaterialReviewStatus`) is responsible for
 * persisting the result. `reviewerId` is a free-form id/name (see the module
 * doc above for why this repo can't verify a real reviewer role).
 */
export function reviewCoachMaterial(
  material: CoachMaterial,
  status: "approved" | "rejected",
  reviewerId: string,
  note?: string,
): CoachMaterial {
  return { ...material, status, reviewedBy: reviewerId, reviewedAt: Date.now(), reviewNote: note };
}

/** Approves `material` — shorthand for `reviewCoachMaterial(material, "approved", reviewerId, note)`. */
export function approveCoachMaterial(material: CoachMaterial, reviewerId: string, note?: string): CoachMaterial {
  return reviewCoachMaterial(material, "approved", reviewerId, note);
}

/** Rejects `material` — shorthand for `reviewCoachMaterial(material, "rejected", reviewerId, note)`. */
export function rejectCoachMaterial(material: CoachMaterial, reviewerId: string, note?: string): CoachMaterial {
  return reviewCoachMaterial(material, "rejected", reviewerId, note);
}

/** Renders a short, human-readable summary of a team's coach-material library. */
export function buildCoachMaterialLibrarySummaryText(library: CoachMaterialLibrary): string {
  if (library.totalMaterials === 0) {
    return "No coach materials uploaded yet.";
  }

  const lines = [
    `Team coach library: ${library.totalMaterials} material${library.totalMaterials === 1 ? "" : "s"}.`,
  ];
  for (const group of library.groups) {
    lines.push(`- ${COACH_MATERIAL_KIND_LABELS[group.kind]}: ${group.materials.length}`);
  }

  return lines.join("\n");
}
