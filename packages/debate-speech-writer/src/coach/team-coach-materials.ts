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
 * @module coach/team-coach-materials
 */

/** The four material types the "Video-Lecture-Training Coach AI" idea names. */
export type CoachMaterialKind =
  | "lecture_transcript"
  | "camp_material"
  | "instructional_document"
  | "practice_recording";

/** A single piece of grounding material a coach has approved for the team coach AI. */
export interface CoachMaterial {
  id: string;
  kind: CoachMaterialKind;
  title: string;
  /** Topic this material primarily covers, e.g. a resolution or argument block. */
  topic?: string;
  tags: string[];
  /** Transcript or document text this material grounds an answer in. */
  text: string;
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

/** Display order for library groups — most commonly consulted kinds first. */
const COACH_MATERIAL_KIND_ORDER: CoachMaterialKind[] = [
  "lecture_transcript",
  "camp_material",
  "instructional_document",
  "practice_recording",
];

const COACH_MATERIAL_KIND_LABELS: Record<CoachMaterialKind, string> = {
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
