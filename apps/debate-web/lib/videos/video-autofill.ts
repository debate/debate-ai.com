/**
 * @fileoverview "Auto-fill with AI" for the admin video form.
 *
 * Three sources, in order (see `autofillVideo`): YouTube, the title and
 * description read by rule (`video-title-fields.ts`, fast and exact for the
 * usual "2024 TOC LD Finals: A vs B" shapes), and the model for what's left —
 * skipped entirely when the rules read everything.
 * 1. **YouTube** — the facts YouTube owns (title, channel, publish date, view
 *    count, description), read with one `videos.list` call when a key is
 *    configured. A form value the admin already typed wins over YouTube's for
 *    title and description, so re-running auto-fill on a corrected video does
 *    not undo the correction.
 * 2. **The title rules** — exact readings of a known title shape; they win.
 * 3. **The model** — the fields the sync's regex parsers guess at from the
 *    title and description (style, lecture category, tournament, round,
 *    teams, each side's arguments, winner, decision, speech-doc link). The
 *    model reads the same text and answers with one JSON object; the category
 *    is checked against `LECTURE_CATEGORIES` so auto-fill can't invent a new
 *    library shelf. Its answers are put in the library's spelling the same
 *    way the rules' are (`canonicalTournament`, `canonicalRoundLevel`), and a
 *    pairing whose teams the video's text never mentions is dropped.
 *
 * The request is a plain chat call through write-language (the client
 * `/api/reason-ai` uses), with the JSON shape spelled out in the prompt.
 * OpenRouter keys ask for `openrouter/free`. The user's own key, when the
 * browser sent one (`x-user-ai-key`), is tried first; then the shared
 * `OPENROUTER_API_KEY` (cleaned of the quotes/newlines a pasted secret can
 * carry); then `ANTHROPIC_API_KEY`. Each failure keeps the provider's message.
 *
 * Nothing here writes to the database. The route returns suggestions, the
 * form shows them, and the admin saves (or doesn't) as with any edit.
 * @module lib/videos/video-autofill
 */

import {
  getVideosByIds,
  setYouTubeApiKey,
} from "@debate-ai/videos-admin/src/sync/youtube/youtube-api";
import { canonicalRoundLevel } from "@debate-ai/videos-admin/src/sync/youtube/parsers/round-title";
import { canonicalTournament, KNOWN_TOURNAMENTS } from "@debate-ai/videos-admin/src/sync/youtube/parsers/tournament-names";
import {
  classifyLecture,
  LECTURE_CATEGORIES,
  LECTURE_CATEGORY_GUIDANCE,
  MISCELLANEOUS_CATEGORY,
  ruleLectureCategory,
} from "@debate-ai/videos/src/data/lecture-classifier";
import { getEnv } from "@/lib/env";
import { OPENROUTER_FREE_MODEL, parseOwnKeyHeader, sharedProviderKeys, type ProviderKey } from "@/lib/ai/provider-key";
import { logAIFailure, writeLanguageChat } from "@/lib/ai/write-language-chat";
import {
  type AutofillFields,
  cleanTeam,
  describeTitleFields,
  readTitleFields,
} from "@debate-ai/webview/lib/videos/video-title-fields";

export type { AutofillFields };

/** Only used when the key is an Anthropic one (the user's own, or the shared fallback). */
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
/** Room for free reasoning models, which spend tokens thinking before the JSON. */
const MAX_TOKENS = 4_000;
/**
 * How long one key gets before auto-fill moves on. Free models are sometimes
 * queued for a long time; the form should answer (with the title's readings
 * at least) rather than hang.
 */
const MODEL_TIMEOUT_MS = 20_000;
/** Descriptions run long (full tournament credits, sponsor blurbs); the facts are near the top. */
const MAX_DESCRIPTION_CHARS = 6_000;

/** What the form already holds, sent so the model reads the admin's text. */
export interface AutofillInput {
  videoId: string;
  /** The incoming request, read for the caller's own AI key. */
  request?: Request;
  title?: string | null;
  channel?: string | null;
  description?: string | null;
}


export interface AutofillResult {
  fields: AutofillFields;
  /** Whether YouTube's metadata was read. */
  fromYouTube: boolean;
  /** Whether any field was read from the title/description by rule. */
  fromTitle: boolean;
  /** Whether the model's extraction was applied. */
  fromAi: boolean;
  /** Non-fatal problems, shown under the form ("YouTube key not configured"). */
  warnings: string[];
}

const STYLE_BY_LABEL: Record<string, number | null> = {
  policy: 1,
  pf: 2,
  ld: 3,
  college: 4,
  wsd: 5,
  acc: 6,
  misc: 7,
  parli: 8,
  congress: 9,
  lecture: null,
};

/** Other ways a model writes a style label ("Lincoln-Douglas", "Public Forum", "NDT"). */
const STYLE_SYNONYMS: Record<string, string> = {
  "lincoln-douglas": "ld",
  "lincoln douglas": "ld",
  "public forum": "pf",
  "cx": "policy",
  "policy debate": "policy",
  "ndt": "college",
  "ceda": "college",
  "college policy": "college",
  "world schools": "wsd",
  "parliamentary": "parli",
  "congressional": "congress",
  "other": "misc",
};

/** A style label as the model wrote it, as one of `STYLE_BY_LABEL`'s keys, or `null`. */
function styleLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim().toLowerCase();
  if (Object.hasOwn(STYLE_BY_LABEL, label)) return label;
  return STYLE_SYNONYMS[label] ?? null;
}

/** "critique / critical theory" → "critique critical theory": for loose category matching. */
function categoryKey(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The library shelf a model's category names, matched loosely: exact, then
 * ignoring case and punctuation ("Counterplans and Theory"), then one name
 * containing the other ("Critical Theory" → "Critique / Critical Theory").
 * `null` when nothing matches, so a made-up shelf never gets saved.
 */
export function matchLectureCategory(value: string | null): string | null {
  if (!value) return null;
  if ((LECTURE_CATEGORIES as readonly string[]).includes(value)) return value;
  const key = categoryKey(value);
  if (!key || key === "none") return null;
  const exact = LECTURE_CATEGORIES.find((category) => categoryKey(category) === key);
  if (exact) return exact;
  const partial = LECTURE_CATEGORIES.filter((category) => {
    const other = categoryKey(category);
    return other.length > 3 && key.length > 3 && (other.includes(key) || key.includes(other));
  });
  return partial.length === 1 ? partial[0] : null;
}

/**
 * The model's answer shape. Every field is required and nothing is nullable
 * — an empty string (or `unknown` / `none`) means "can't tell" — so the parser
 * reads one shape. Not sent as a structured-output schema (see the module
 * note); kept as the single description of the answer for the prompt and
 * tests.
 */
export const VIDEO_AUTOFILL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "style",
    "category",
    "tournament",
    "roundLevel",
    "affTeam",
    "negTeam",
    "winner",
    "judgeDecision",
    "speechDocsUrl",
    "affArguments",
    "negArguments",
  ],
  properties: {
    style: { type: "string", enum: Object.keys(STYLE_BY_LABEL) },
    category: { type: "string", enum: [...LECTURE_CATEGORIES, "none"] },
    tournament: { type: "string" },
    roundLevel: { type: "string" },
    affTeam: { type: "string" },
    negTeam: { type: "string" },
    winner: { type: "string", enum: ["aff", "neg", "unknown"] },
    judgeDecision: { type: "string" },
    speechDocsUrl: { type: "string" },
    affArguments: { type: "string" },
    negArguments: { type: "string" },
  },
} as const;

export const VIDEO_AUTOFILL_PROMPT = `You catalogue YouTube videos for a competitive debate video library (Policy, Public Forum, Lincoln-Douglas, college debate).

Given a video's title, channel and description, fill in its library metadata. Answer with a single JSON object and nothing else — no prose, no code fence — with exactly these keys:
{"style": "", "category": "", "tournament": "", "roundLevel": "", "affTeam": "", "negTeam": "", "winner": "", "judgeDecision": "", "speechDocsUrl": "", "affArguments": "", "negArguments": ""}

Fields:
- style: "policy" (high-school policy / CX), "pf" (Public Forum), "ld" (Lincoln-Douglas), "college" (NDT/CEDA/college policy), "wsd" (World Schools), "acc" (the ACC Debate Tournament), "parli" (parliamentary debate: NPDA, NPTE, APDA, high-school parli), "congress" (a recorded congressional debate round, not a lecture about it), "misc" (any other debate round format) when the video is a recorded debate round. "lecture" for anything else — lectures, drills, demo explanations, round analyses and redos, documentaries, advice. Clues: a resolution with "ought" is Lincoln-Douglas; speeches named 1AC/1NC/2NR are policy or LD; "Summary" and "Final Focus" are Public Forum; a channel named for a format (e.g. "Peninsula LD Debate", "Marist Public Forum") usually films that format.
- category: for a lecture, the single best category from the allowed list, copied exactly. For a round, "none". ${LECTURE_CATEGORY_GUIDANCE}
- tournament: the tournament's short name without any year, using the library's name when it is one of these: ${KNOWN_TOURNAMENTS.join(", ")}. "Tournament of Champions" is "TOC"; "Cal" or "California Invitational" is "Berkeley"; "Nats" is "NSDA Nationals". For a round robin, the host's name followed by "Round Robin" (e.g. "Harvard-Westlake Round Robin"). Empty if not a round or not stated.
- roundLevel: exactly one of "R1", "R2", … (prelim rounds: "Round 4" and "Rd 4" are "R4"), "Triples" (triple octafinals), "Doubles" (double octafinals), "Octafinals", "Quarterfinals", "Semifinals", "Finals", "Runoffs", or "Round Robin" for any round of a round robin. Empty if not stated.
- affTeam / negTeam: the two teams or debaters as the title names them — school plus entry code (e.g. "Seven Lakes LM", "Harvard-Westlake AD"), or full names when that is all it gives. Leave out any "(Aff)"/"(Neg)" marker, round, tournament or year. When the title or description marks the sides ("(Aff)", "Aff X vs Neg Y", "X on the neg"), follow them; otherwise put the first-named team in affTeam. Never name a team the text doesn't mention.
- winner: "aff" or "neg" only when the description or title states the result; otherwise "unknown".
- judgeDecision: the decision as stated, e.g. "3-2 Aff" or "2-1 for Neg". Empty if not stated.
- speechDocsUrl: a link from the description to the round's speech documents (opencaselist, Google Drive/Docs, Dropbox, speechdrop). Empty if there is none. Never invent a URL.
- affArguments: the affirmative's case as stated — the plan or advocacy and its advantages (the 1AC), e.g. "Space cooperation plan; Asteroid and Russia advantages". Empty if not stated.
- negArguments: the negative's positions as stated — off-case (kritiks, counterplans, disadvantages, topicality) and on-case, preferring what went for the 2NR, e.g. "Cap K, Politics DA, T-Substantial". Empty if not stated.

Allowed values: style is one of ${Object.keys(STYLE_BY_LABEL).map((s) => `"${s}"`).join(", ")}. winner is "aff", "neg" or "unknown". category is "none" or one of: ${LECTURE_CATEGORIES.map((c) => `"${c}"`).join(", ")}.

Examples:
Title: "Blake TP vs. Seven Lakes LM TOC Octos 2023" — Channel: "Victory Briefs" — Description: "Resolved: The United States ought to guarantee the right to housing."
{"style": "ld", "category": "none", "tournament": "TOC", "roundLevel": "Octafinals", "affTeam": "Blake TP", "negTeam": "Seven Lakes LM", "winner": "unknown", "judgeDecision": "", "speechDocsUrl": "", "affArguments": "", "negArguments": ""}
Title: "Loyola 2020 Doubles - Aff Strake Jesuit BE vs. Neg Southlake Carroll PK" — Channel: "LDBen" — Description: "Neg wins on a 2-1. The aff read a nuclear deterrence plan; the 2NR was the Russia DA."
{"style": "ld", "category": "none", "tournament": "Loyola", "roundLevel": "Doubles", "affTeam": "Strake Jesuit BE", "negTeam": "Southlake Carroll PK", "winner": "neg", "judgeDecision": "2-1 Neg", "speechDocsUrl": "", "affArguments": "Nuclear deterrence plan", "negArguments": "Russia DA"}
Title: "How to Write a 2NR | Policy Lecture" — Channel: "DebateDrills"
{"style": "lecture", "category": "Negative Strategy", "tournament": "", "roundLevel": "", "affTeam": "", "negTeam": "", "winner": "unknown", "judgeDecision": "", "speechDocsUrl": "", "affArguments": "", "negArguments": ""}

Use only what the text says. Leave a field empty rather than guess.`;

/**
 * Builds the user turn: the three pieces of text the model reads, plus what
 * the title rules already read (`known`), which the model keeps.
 */
export function buildAutofillContent(
  input: {
    title: string;
    channel: string;
    description: string;
  },
  known = "",
): string {
  return [
    `Title: ${input.title}`,
    `Channel: ${input.channel}`,
    ...(known
      ? ["Already read from the title (copy these into your answer as they are; fill the other keys):", known]
      : []),
    "Description:",
    input.description.slice(0, MAX_DESCRIPTION_CHARS),
  ].join("\n");
}

/** Pulls the JSON object out of a reply that may be fenced or chatty. */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Answers that mean "can't tell", which free models write instead of an empty string. */
const NO_ANSWER = /^(?:unknown|none|n\/?a|null|not stated|not specified|not mentioned|unclear|tbd|-+|\?+)$/i;

/** A trimmed string, or `null` for blank / non-string / "unknown". */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && !NO_ANSWER.test(trimmed) ? trimmed : null;
}

/** A model's team answer without a side marker or a "Aff:" label: "(Aff) Strake BE" → "Strake BE". */
function team(value: unknown): string | null {
  const raw = text(value)?.replace(/^(?:aff(?:irmative)?|neg(?:ative)?)\s*[:\-]\s*/i, "");
  return cleanTeam(raw ?? null);
}

/**
 * Turns the model's reply into form suggestions, or `null` when the reply is
 * not the expected object.
 *
 * Out-of-list values are dropped rather than passed through: a category the
 * picker doesn't know would create a stray shelf, and a speech-doc "link"
 * that isn't an http(s) URL is almost certainly made up.
 */
export function parseAutofillReply(reply: string): AutofillFields | null {
  const raw = extractJsonObject(reply);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const answer = raw as Record<string, unknown>;

  const fields: AutofillFields = {};

  const label = styleLabel(answer.style);
  if (label) fields.style = STYLE_BY_LABEL[label];

  const isLecture = fields.style === null;
  fields.category = isLecture ? matchLectureCategory(text(answer.category)) : null;

  // Rounds only: a lecture has no tournament, round or teams to file.
  const round = !isLecture;
  fields.tournament = round ? canonicalTournament(text(answer.tournament)) : null;
  const roundLevel = round ? text(answer.roundLevel) : null;
  fields.roundLevel = roundLevel ? (canonicalRoundLevel(roundLevel) ?? roundLevel) : null;
  const affTeam = round ? team(answer.affTeam) : null;
  const negTeam = round ? team(answer.negTeam) : null;
  // One team alone, or the same team twice, can't be filed as a pairing.
  const pair = !!affTeam && !!negTeam && affTeam.toLowerCase() !== negTeam.toLowerCase();
  fields.affTeam = pair ? affTeam : null;
  fields.negTeam = pair ? negTeam : null;
  fields.judgeDecision = round ? text(answer.judgeDecision) : null;
  const winner = typeof answer.winner === "string" ? answer.winner.trim().toLowerCase() : "";
  fields.affWin = !round
    ? null
    : /^aff(?:irmative)?$/.test(winner)
      ? true
      : /^neg(?:ative)?$/.test(winner)
        ? false
        : null;

  fields.arg1ac = round ? text(answer.affArguments) : null;
  fields.arg2nr = round ? text(answer.negArguments) : null;

  const docs = text(answer.speechDocsUrl);
  fields.speechDocsUrl = docs && /^https?:\/\//i.test(docs) ? docs : null;

  return fields;
}

/** YouTube's own metadata for one video, or `null` when it can't be read. */
async function readYouTube(videoId: string, warnings: string[]): Promise<AutofillFields | null> {
  const apiKey = getEnv("YOUTUBE_API_KEY");
  if (!apiKey) {
    warnings.push("YouTube API key not configured — only the text in the form was used.");
    return null;
  }
  // Same reason as `resync-rounds.ts`: the shared client reads `process.env`,
  // which is empty inside the Worker.
  setYouTubeApiKey(apiKey);
  try {
    const [tuple] = await getVideosByIds([videoId]);
    if (!tuple) {
      warnings.push("YouTube didn't return this video — it may be private or deleted.");
      return null;
    }
    const [, title, publishedAt, channel, viewCount, description] = tuple;
    return { title, publishedAt, channel, viewCount, description };
  } catch (error) {
    warnings.push(`YouTube lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** The model each key is asked for: OpenRouter's free router, or Claude on an Anthropic key. */
function modelFor(key: ProviderKey): string {
  return key.provider === "openrouter" ? OPENROUTER_FREE_MODEL : ANTHROPIC_MODEL;
}

/**
 * The keys to try, in order: the caller's own key (`x-user-ai-key`, sent by
 * the browser when the user saved one in Settings → General), then the
 * site's shared `OPENROUTER_API_KEY`, then `ANTHROPIC_API_KEY`.
 */
export function autofillKeys(request?: Request): ProviderKey[] {
  const own = request ? parseOwnKeyHeader(request) : null;
  return [...(own ? [own] : []), ...sharedProviderKeys()];
}

/**
 * Asks the model for the structured fields. Throws with a user-facing message.
 * Exported for bulk re-parsing (`reclassify-by-title.ts`), which reads stored
 * rows instead of the form.
 *
 * Each key in `keys` is tried in turn (see `autofillKeys`) through
 * write-language, the same client `/api/reason-ai` uses; OpenRouter keys ask
 * for `openrouter/free`. A later key is only reached when the earlier one
 * failed or answered with something that isn't the JSON object.
 *
 * `system` overrides the default auto-fill system prompt — the queue page's
 * auto-detect reuses this caller with its own detect prompt while keeping the
 * same key fallback and reply parsing.
 */
export async function askModel(
  content: string,
  keys: ProviderKey[] = sharedProviderKeys(),
  timeoutMs: number = MODEL_TIMEOUT_MS,
  system?: string,
): Promise<AutofillFields> {
  if (keys.length === 0) {
    throw new Error("AI features are not configured on the server — set OPENROUTER_API_KEY or add your own key in Settings → General.");
  }

  const errors: string[] = [];
  for (const key of keys) {
    const label = `${key.own ? "Your " : ""}${key.provider === "openrouter" ? "OpenRouter" : "Anthropic"}${key.own ? " key" : ""}`;
    let replyText: string;
    try {
      const reply = await writeLanguageChat({
        key,
        model: modelFor(key),
        system: system ?? VIDEO_AUTOFILL_PROMPT,
        messages: [{ role: "user", content }],
        maxTokens: MAX_TOKENS,
        temperature: 0,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      replyText = reply.text;
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const message = /abort|timeout/i.test(raw) ? `no answer within ${Math.round(timeoutMs / 1000)}s.` : raw;
      logAIFailure(`video-autofill: ${label}`, error, message);
      errors.push(`${label}: ${message}`);
      continue;
    }
    const fields = parseAutofillReply(replyText);
    if (fields) return fields;
    errors.push(`${label}: the model returned an unreadable answer.`);
  }
  throw new Error(errors.join(" "));
}

/** Keys a "lecture" answer clears, dropped when the rules already saw a round. */
const LECTURE_ANSWER_KEYS = [
  "style",
  "category",
  "tournament",
  "roundLevel",
  "affTeam",
  "negTeam",
  "affWin",
  "judgeDecision",
  "arg1ac",
  "arg2nr",
] as const;

/** "Harvard-Westlake AD" → ["harvard", "westlake", "ad"]. */
function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
}

/**
 * Drops the model's teams when either one shares no word with the video's
 * text — a free model sometimes fills a pairing from memory or from its
 * prompt's examples. Both go, since one team alone can't be filed.
 */
export function dropUnsupportedTeams(fields: AutofillFields, sourceText: string): void {
  if (!fields.affTeam && !fields.negTeam) return;
  const source = new Set(words(sourceText));
  const supported = (name: string | null | undefined) => !!name && words(name).some((word) => source.has(word));
  if (!supported(fields.affTeam) || !supported(fields.negTeam)) {
    fields.affTeam = null;
    fields.negTeam = null;
  }
}

/**
 * Suggests every form field it can for one video.
 *
 * 1. YouTube's own metadata (title, channel, date, views, description).
 * 2. The title and description read by rule (`video-title-fields.ts`):
 *    format, tournament, round, teams, result, doc link, labelled arguments.
 *    These win over the model's answers — they are exact readings of a
 *    known title shape.
 * 3. The model, only when something is left (`needsModel`), told what the
 *    rules already read so it fills the gaps instead of re-guessing them.
 *
 * YouTube and model failures are warnings, not errors, when anything was
 * filled; a model failure is an error only when nothing else was.
 *
 * @param input - The video id and whatever the form already holds.
 */
export async function autofillVideo(input: AutofillInput): Promise<AutofillResult> {
  const warnings: string[] = [];
  const youtube = await readYouTube(input.videoId, warnings);

  const title = text(input.title) ?? youtube?.title ?? "";
  const channel = text(input.channel) ?? youtube?.channel ?? "";
  const description = text(input.description) ?? youtube?.description ?? "";

  const fields: AutofillFields = { ...(youtube ?? {}) };
  // The admin's typed title/description wins; YouTube only fills blanks.
  if (text(input.title)) delete fields.title;
  if (text(input.description)) delete fields.description;

  if (!title && !description) {
    throw new Error("Nothing to read — YouTube returned no metadata and the form's title and description are empty.");
  }

  const parsed = readTitleFields({ title, channel, description });
  const fromTitle = Object.keys(parsed.fields).some((key) => key !== "category");

  let fromAi = false;
  if (parsed.needsModel) {
    try {
      const known = describeTitleFields(parsed.fields);
      const content = buildAutofillContent({ title, channel, description }, known);
      const answer = await askModel(content, autofillKeys(input.request));
      if (parsed.isRound && answer.style === null) {
        // The rules saw teams and a round; a "lecture" answer is the model's mistake.
        for (const key of LECTURE_ANSWER_KEYS) delete answer[key];
      }
      dropUnsupportedTeams(answer, `${title}\n${description}`);
      Object.assign(fields, answer);
      fromAi = true;
    } catch (error) {
      if (!youtube && !fromTitle) throw error;
      warnings.push(error instanceof Error ? error.message : String(error));
      if (!parsed.isRound) {
        // No model: the keyword classifier still files a lecture on a shelf.
        const category = matchLectureCategory(classifyLecture(title, description, channel));
        if (category) {
          fields.style = null;
          fields.category = category;
        }
      }
    }
  }
  Object.assign(fields, parsed.fields);
  // The NSDA channel's lectures, every Super Debate video and Congressional
  // Debate lectures sit on their own shelf, whatever the title or the model
  // says (see `ruleLectureCategory`).
  const channelCategory = ruleLectureCategory(title, description, channel);
  if (channelCategory && fields.style === null) {
    fields.style = null;
    fields.category = channelCategory;
  }
  // A lecture nothing could place goes on the fallback shelf, not unfiled.
  if (fields.style === null && !fields.category) fields.category = MISCELLANEOUS_CATEGORY;

  return { fields, fromYouTube: !!youtube, fromTitle, fromAi, warnings };
}
