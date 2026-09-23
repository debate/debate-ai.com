/**
 * @fileoverview The LLM annotation (flaws + author quality) the on-page reuse
 * check shows for an already-cut corpus card.
 *
 * Saved in `card_ai_analyses` beside the evidence search's analyses, keyed by
 * the same (card text hash, prompt hash) pair: the prompt hash covers
 * `CARD_REUSE_ANNOTATION_VERSION` too, so changing the schema regenerates
 * rather than serving answers in the old shape. A card is annotated at most
 * once per prompt version and every later reader gets the saved answer.
 *
 * The prompt, schema and parser live in `debate-research-evidence`
 * (`card-reuse-annotation.ts`); this module is only the cache and the call.
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  CARD_REUSE_ANNOTATION_PROMPT,
  CARD_REUSE_ANNOTATION_SCHEMA,
  CARD_REUSE_ANNOTATION_VERSION,
  buildCardReuseAnnotationContent,
  parseCardReuseAnnotation,
  sha256Hex,
  type CardReuseAnnotation,
} from "debate-research-evidence";
import { isMissingTableError } from "@/lib/contacts/server";
import { cardAiAnalyses, type DebateCardRow } from "@/lib/database/schema";
import { getEnv } from "@/lib/env";

const ANTHROPIC_MODEL = "claude-opus-5";
const ANTHROPIC_VERSION = "2023-06-01";
/** Opts into `fallbacks: "default"`, which re-runs a classifier-declined request on the recommended model. */
const ANTHROPIC_FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_TOKENS = 16_000;

/** The card columns the annotation reads. */
export type AnnotatableCard = Pick<DebateCardRow, "tag" | "cite" | "fullcite" | "markup" | "spoken" | "fulltext">;

let promptHashPromise: Promise<string> | null = null;

/** Hash of the versioned prompt — the prompt half of the cache key. */
function annotationPromptHash(): Promise<string> {
  promptHashPromise ??= sha256Hex(`${CARD_REUSE_ANNOTATION_VERSION}\n${CARD_REUSE_ANNOTATION_PROMPT}`);
  return promptHashPromise;
}

/** Hash of the text the model reads for this card — the card half of the cache key. */
export function annotationCardHash(card: AnnotatableCard): Promise<string> {
  return sha256Hex(buildCardReuseAnnotationContent(card));
}

/**
 * Saved annotations for several cards at once, for attaching to reuse-check
 * matches without a model call.
 *
 * @param db - Drizzle database handle.
 * @param cardHashes - {@link annotationCardHash} of each card.
 * @returns Parsed annotations by card hash; cards never annotated are absent.
 */
export async function readSavedAnnotations(
  db: any,
  cardHashes: readonly string[],
): Promise<Map<string, CardReuseAnnotation>> {
  const saved = new Map<string, CardReuseAnnotation>();
  if (cardHashes.length === 0) return saved;
  try {
    const rows: Array<{ cardHash: string; result: string }> = await db
      .select({ cardHash: cardAiAnalyses.cardHash, result: cardAiAnalyses.result })
      .from(cardAiAnalyses)
      .where(
        and(
          inArray(cardAiAnalyses.cardHash, [...new Set(cardHashes)]),
          eq(cardAiAnalyses.promptHash, await annotationPromptHash()),
        ),
      );
    for (const row of rows) {
      const annotation = parseCardReuseAnnotation(row.result);
      if (annotation) saved.set(row.cardHash, annotation);
    }
  } catch (error) {
    // Before the card_ai_analyses migration lands there is simply nothing saved.
    if (!isMissingTableError(error)) throw error;
  }
  return saved;
}

export type AnnotateCardResult =
  | { ok: true; annotation: CardReuseAnnotation; cached: boolean }
  | { ok: false; error: string; status: number };

/**
 * Returns a card's saved annotation, generating and saving it on first use.
 *
 * @param db - Drizzle database handle.
 * @param card - The stored corpus card.
 * @param userId - Signed-in user who triggered generation, if any.
 */
export async function annotateCard(
  db: any,
  card: AnnotatableCard,
  userId: string | null,
): Promise<AnnotateCardResult> {
  const content = buildCardReuseAnnotationContent(card);
  if (!content) return { ok: false, error: "This card has no text to annotate.", status: 422 };

  const cardHash = await sha256Hex(content);
  const saved = (await readSavedAnnotations(db, [cardHash])).get(cardHash);
  if (saved) return { ok: true, annotation: saved, cached: true };

  const apiKey = getEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return { ok: false, error: "AI features are not configured on this server.", status: 503 };

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-beta": ANTHROPIC_FALLBACK_BETA,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        fallbacks: "default",
        system: CARD_REUSE_ANNOTATION_PROMPT,
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: CARD_REUSE_ANNOTATION_SCHEMA },
        },
        messages: [{ role: "user", content: `Evidence card:\n\n${content}` }],
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `Network error contacting Anthropic: ${e instanceof Error ? e.message : String(e)}`,
      status: 502,
    };
  }
  if (!res.ok) return { ok: false, error: `Anthropic API returned ${res.status}.`, status: 502 };

  const json = (await res.json()) as {
    stop_reason?: string;
    model?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (json.stop_reason === "refusal") {
    return { ok: false, error: "The model declined to annotate this card.", status: 422 };
  }
  if (json.stop_reason === "max_tokens") {
    return { ok: false, error: "The annotation was cut off before it finished.", status: 502 };
  }
  const text = (json.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();
  const annotation = parseCardReuseAnnotation(text);
  if (!annotation) return { ok: false, error: "The model returned an unreadable annotation.", status: 502 };

  try {
    await db
      .insert(cardAiAnalyses)
      .values({
        cardHash,
        promptHash: await annotationPromptHash(),
        cardTag: card.tag.slice(0, 500) || null,
        result: JSON.stringify(annotation),
        // A fallback-served answer reports the model that actually wrote it.
        model: json.model ?? ANTHROPIC_MODEL,
        userId,
      })
      .onConflictDoNothing();
  } catch (error) {
    if (!isMissingTableError(error)) console.error("card-annotation: failed to save annotation", error);
  }

  return { ok: true, annotation, cached: false };
}
