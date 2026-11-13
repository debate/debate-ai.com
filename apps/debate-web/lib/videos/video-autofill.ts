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
 *    library shelf.
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
import { LECTURE_CATEGORIES } from "@debate-ai/videos/src/data/lecture-classifier";
import { stripTournamentYear } from "@debate-ai/videos/src/data/video-rows";
import { getEnv } from "@/lib/env";
import { OPENROUTER_FREE_MODEL, parseOwnKeyHeader, sharedProviderKeys, type ProviderKey } from "@/lib/ai/provider-key";
import { writeLanguageChat } from "@/lib/ai/write-language-chat";
import {
  type AutofillFields,
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
  lecture: null,
};

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
- style: "policy", "pf" (Public Forum), "ld" (Lincoln-Douglas), "college" (NDT/CEDA/college policy or parli), "wsd" (World Schools), "acc" (the ACC Debate Tournament), "misc" (any other debate round format) when the video is a recorded debate round. "lecture" for anything else — lectures, drills, demo explanations, documentaries, advice.
- category: for a lecture, the single best category from the allowed list. For a round, "none".
- tournament: the tournament name without any year (e.g. "Tournament of Champions", "Glenbrooks"). Empty if not a round or not stated.
- roundLevel: the round as written in debate shorthand, e.g. "Finals", "Semifinals", "Quarterfinals", "Octafinals", "Double Octafinals", "Round 4". Empty if not stated.
- affTeam / negTeam: the affirmative and negative teams or debaters as named (school plus initials or names). Empty if the sides aren't stated — do not guess which side a team was on.
- winner: "aff" or "neg" only when the description or title states the result; otherwise "unknown".
- judgeDecision: the decision as stated, e.g. "3-2 Aff" or "2-1 for Neg". Empty if not stated.
- speechDocsUrl: a link from the description to the round's speech documents (opencaselist, Google Drive/Docs, Dropbox, speechdrop). Empty if there is none. Never invent a URL.
- affArguments: the affirmative's case as stated — the plan or advocacy and its advantages (the 1AC), e.g. "Space cooperation plan; Asteroid and Russia advantages". Empty if not stated.
- negArguments: the negative's positions as stated — off-case (kritiks, counterplans, disadvantages, topicality) and on-case, preferring what went for the 2NR, e.g. "Cap K, Politics DA, T-Substantial". Empty if not stated.

Allowed values: style is one of ${Object.keys(STYLE_BY_LABEL).map((s) => `"${s}"`).join(", ")}. winner is "aff", "neg" or "unknown". category is "none" or one of: ${LECTURE_CATEGORIES.map((c) => `"${c}"`).join(", ")}.

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

/** A trimmed string, or `null` for blank / non-string. */
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

  const styleLabel = typeof answer.style === "string" ? answer.style.toLowerCase() : "";
  if (Object.hasOwn(STYLE_BY_LABEL, styleLabel)) fields.style = STYLE_BY_LABEL[styleLabel];

  const isLecture = fields.style === null;
  const category = text(answer.category);
  fields.category =
    isLecture && category && (LECTURE_CATEGORIES as readonly string[]).includes(category)
      ? category
      : null;

  fields.tournament = stripTournamentYear(text(answer.tournament));
  fields.roundLevel = text(answer.roundLevel);
  fields.affTeam = text(answer.affTeam);
  fields.negTeam = text(answer.negTeam);
  fields.judgeDecision = text(answer.judgeDecision);
  fields.affWin = answer.winner === "aff" ? true : answer.winner === "neg" ? false : null;

  fields.arg1ac = text(answer.affArguments);
  fields.arg2nr = text(answer.negArguments);

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
 */
export async function askModel(
  content: string,
  keys: ProviderKey[] = sharedProviderKeys(),
  timeoutMs: number = MODEL_TIMEOUT_MS,
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
        system: VIDEO_AUTOFILL_PROMPT,
        messages: [{ role: "user", content }],
        maxTokens: MAX_TOKENS,
        temperature: 0,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      replyText = reply.text;
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const message = /abort|timeout/i.test(raw) ? `no answer within ${Math.round(timeoutMs / 1000)}s.` : raw;
      console.error(`video-autofill: ${label}: ${message}`);
      errors.push(`${label}: ${message}`);
      continue;
    }
    const fields = parseAutofillReply(replyText);
    if (fields) return fields;
    errors.push(`${label}: the model returned an unreadable answer.`);
  }
  throw new Error(errors.join(" "));
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
        delete answer.style;
        delete answer.category;
      }
      Object.assign(fields, answer);
      fromAi = true;
    } catch (error) {
      if (!youtube && !fromTitle) throw error;
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }
  Object.assign(fields, parsed.fields);

  return { fields, fromYouTube: !!youtube, fromTitle, fromAi, warnings };
}
