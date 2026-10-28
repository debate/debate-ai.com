/**
 * @fileoverview "Auto-fill with AI" for the admin video form.
 *
 * Two sources, in order:
 * 1. **YouTube** — the facts YouTube owns (title, channel, publish date, view
 *    count, description), read with one `videos.list` call when a key is
 *    configured. A form value the admin already typed wins over YouTube's for
 *    title and description, so re-running auto-fill on a corrected video does
 *    not undo the correction.
 * 2. **The model** — the fields the sync's regex parsers guess at from the
 *    title and description (style, lecture category, tournament, round,
 *    teams, each side's arguments, winner, decision, speech-doc link). The
 *    model reads the same text and answers with one JSON object; the category
 *    is checked against `LECTURE_CATEGORIES` so auto-fill can't invent a new
 *    library shelf.
 *
 * The request is a plain chat completion, the same shape the site's other AI
 * routes send, with the JSON shape spelled out in the prompt. It used to ask
 * OpenRouter for a strict `json_schema` response from `anthropic/claude-opus-5`,
 * and OpenRouter rejected that request, so every auto-fill failed with only
 * "AI API returned 4xx" to show for it. Errors now carry the provider's own
 * message, and a failed OpenRouter call falls back to Anthropic when that key
 * is configured too.
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
import { getEnv } from "@/lib/env";

// The models the site's other AI routes (`card-ai-analysis`, `reason-ai`,
// the transcript summaries) already call in production.
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 2_000;
/** Descriptions run long (full tournament credits, sponsor blurbs); the facts are near the top. */
const MAX_DESCRIPTION_CHARS = 6_000;

/** What the form already holds, sent so the model reads the admin's text. */
export interface AutofillInput {
  videoId: string;
  title?: string | null;
  channel?: string | null;
  description?: string | null;
}

/** Suggested form values. Absent keys mean "no suggestion — leave the field". */
export interface AutofillFields {
  title?: string;
  channel?: string;
  publishedAt?: string;
  viewCount?: number;
  description?: string;
  style?: number | null;
  category?: string | null;
  tournament?: string | null;
  roundLevel?: string | null;
  affTeam?: string | null;
  negTeam?: string | null;
  affWin?: boolean | null;
  judgeDecision?: string | null;
  speechDocsUrl?: string | null;
  /** The affirmative's arguments: the plan or advocacy and its advantages (the 1AC). */
  arg1ac?: string | null;
  /** The negative's positions: off-case and on-case arguments, ideally what went for the 2NR. */
  arg2nr?: string | null;
}

export interface AutofillResult {
  fields: AutofillFields;
  /** Whether YouTube's metadata was read. */
  fromYouTube: boolean;
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
- tournament: the tournament name without a leading year (e.g. "Tournament of Champions", "Glenbrooks"). Empty if not a round or not stated.
- roundLevel: the round as written in debate shorthand, e.g. "Finals", "Semifinals", "Quarterfinals", "Octafinals", "Double Octafinals", "Round 4". Empty if not stated.
- affTeam / negTeam: the affirmative and negative teams or debaters as named (school plus initials or names). Empty if the sides aren't stated — do not guess which side a team was on.
- winner: "aff" or "neg" only when the description or title states the result; otherwise "unknown".
- judgeDecision: the decision as stated, e.g. "3-2 Aff" or "2-1 for Neg". Empty if not stated.
- speechDocsUrl: a link from the description to the round's speech documents (opencaselist, Google Drive/Docs, Dropbox, speechdrop). Empty if there is none. Never invent a URL.
- affArguments: the affirmative's case as stated — the plan or advocacy and its advantages (the 1AC), e.g. "Space cooperation plan; Asteroid and Russia advantages". Empty if not stated.
- negArguments: the negative's positions as stated — off-case (kritiks, counterplans, disadvantages, topicality) and on-case, preferring what went for the 2NR, e.g. "Cap K, Politics DA, T-Substantial". Empty if not stated.

Allowed values: style is one of ${Object.keys(STYLE_BY_LABEL).map((s) => `"${s}"`).join(", ")}. winner is "aff", "neg" or "unknown". category is "none" or one of: ${LECTURE_CATEGORIES.map((c) => `"${c}"`).join(", ")}.

Use only what the text says. Leave a field empty rather than guess.`;

/** Builds the user turn: the three pieces of text the model reads. */
export function buildAutofillContent(input: {
  title: string;
  channel: string;
  description: string;
}): string {
  return [
    `Title: ${input.title}`,
    `Channel: ${input.channel}`,
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

  fields.tournament = text(answer.tournament);
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

/** One provider attempt: the reply text, or a user-facing error. */
type ModelReply = { ok: true; text: string } | { ok: false; error: string };

/** The provider's own error message out of a non-OK body, trimmed for the form. */
function providerError(provider: string, status: number, body: string): string {
  let message = body.trim();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    const inner = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
    if (inner) message = inner;
  } catch {
    // Not JSON — keep the raw text.
  }
  return `${provider} returned ${status}${message ? `: ${message.slice(0, 300)}` : "."}`;
}

async function callOpenRouter(key: string, content: string): Promise<ModelReply> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://debate-ai.com",
      "X-Title": "Debate AI",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: VIDEO_AUTOFILL_PROMPT },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) return { ok: false, error: providerError("OpenRouter", res.status, await res.text().catch(() => "")) };
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };
  // OpenRouter can answer 200 with an `error` body when the upstream failed.
  if (json.error) return { ok: false, error: `OpenRouter: ${json.error.message ?? "upstream error"}` };
  return { ok: true, text: json.choices?.[0]?.message?.content ?? "" };
}

async function callAnthropic(key: string, content: string): Promise<ModelReply> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: VIDEO_AUTOFILL_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) return { ok: false, error: providerError("Anthropic", res.status, await res.text().catch(() => "")) };
  const json = (await res.json()) as {
    stop_reason?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (json.stop_reason === "refusal") return { ok: false, error: "The model declined to read this video." };
  return {
    ok: true,
    text: (json.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join(""),
  };
}

/**
 * Asks the model for the structured fields. Throws with a user-facing message.
 * Exported for bulk re-parsing (`reclassify-by-title.ts`), which reads stored
 * rows instead of the form.
 *
 * Tries OpenRouter first when its key is set (as the other AI routes do), then
 * Anthropic; the second is only reached when the first failed.
 */
export async function askModel(content: string): Promise<AutofillFields> {
  const openrouterKey = getEnv("OPENROUTER_API_KEY");
  const anthropicKey = getEnv("ANTHROPIC_API_KEY");
  if (!openrouterKey && !anthropicKey) throw new Error("AI features are not configured on the server.");

  const attempts: Array<() => Promise<ModelReply>> = [];
  if (openrouterKey) attempts.push(() => callOpenRouter(openrouterKey, content));
  if (anthropicKey) attempts.push(() => callAnthropic(anthropicKey, content));

  const errors: string[] = [];
  for (const attempt of attempts) {
    let reply: ModelReply;
    try {
      reply = await attempt();
    } catch (error) {
      reply = {
        ok: false,
        error: `Network error contacting AI provider: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (!reply.ok) {
      console.error(`video-autofill: ${reply.error}`);
      errors.push(reply.error);
      continue;
    }
    const fields = parseAutofillReply(reply.text);
    if (fields) return fields;
    errors.push("The model returned an unreadable answer.");
  }
  throw new Error(errors.join(" "));
}

/**
 * Suggests every form field it can for one video.
 *
 * YouTube failures are warnings, not errors — the model can still read what
 * the admin typed. A model failure is an error only when there was nothing
 * from YouTube either, so the admin at least gets the title and date back.
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

  let fromAi = false;
  try {
    Object.assign(fields, await askModel(buildAutofillContent({ title, channel, description })));
    fromAi = true;
  } catch (error) {
    if (!youtube) throw error;
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  return { fields, fromYouTube: !!youtube, fromAi, warnings };
}
