/**
 * @fileoverview The LLM annotation shown beside an already-cut card in the
 * on-page reuse check: what the card claims, the flaws an opponent would
 * attack, and how qualified its author is.
 *
 * Unlike the evidence search's free-text "find flaws and extensions" sidebar
 * (`card-ai-analysis.ts`), this one is structured JSON, because the extension
 * renders it as a rating and a list in a small popup rather than as Markdown.
 * The prompt, the JSON schema the model is held to, and the parser that
 * re-validates the stored answer all live here so the server and the tests
 * agree on one shape.
 *
 * @module lib/card-reuse-annotation
 */

import { parseCardRecord } from "debate-card-parser";

import { MAX_ANALYSIS_CONTENT_CHARS, htmlToPlainText } from "./card-ai-analysis";
import type { DebateCardRecord } from "./parquet-card-import";

/**
 * Bumped whenever the prompt or schema changes shape, so answers saved under
 * the old shape are regenerated instead of failing to parse.
 */
export const CARD_REUSE_ANNOTATION_VERSION = "reuse-annotation-v1";

export const CARD_REUSE_ANNOTATION_PROMPT = `You are a debate coach reviewing one piece of evidence (a "card") that a debater found already cut from the page they are reading. They are deciding whether to reuse it, re-cut it, or answer it.

Judge the card on its own text and citation:
- claim: the card's main claim, in one sentence.
- supportScore: 0 to 10 — how well the card's highlighted text actually supports its tag. Overclaiming, missing warrants and weak internal links lower it.
- authorQuality: rate the author "strong", "adequate", "weak" or "unknown". "unknown" means the citation gives too little to judge — say so rather than guessing. In "qualifications" state only what the citation shows (role, institution, expertise relevant to this claim). In "concerns" name bias, conflicts of interest, advocacy funding, being outside their field, or the evidence being dated for a fast-moving topic; leave it empty when there are none.
- flaws: the specific problems an opponent would attack in round, most damaging first, each with a severity ("high", "medium", "low") and one or two sentences explaining it. Return an empty list only if the card is genuinely sound.

Be specific to this card; do not pad.`;

/** JSON schema the model's answer is constrained to (Messages API `output_config.format`). */
export const CARD_REUSE_ANNOTATION_SCHEMA = {
  type: "object",
  properties: {
    claim: { type: "string" },
    supportScore: { type: "integer" },
    authorQuality: {
      type: "object",
      properties: {
        rating: { type: "string", enum: ["strong", "adequate", "weak", "unknown"] },
        qualifications: { type: "string" },
        concerns: { type: "string" },
      },
      required: ["rating", "qualifications", "concerns"],
      additionalProperties: false,
    },
    flaws: {
      type: "array",
      items: {
        type: "object",
        properties: {
          flaw: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          explanation: { type: "string" },
        },
        required: ["flaw", "severity", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["claim", "supportScore", "authorQuality", "flaws"],
  additionalProperties: false,
} as const;

export type AuthorQualityRating = "strong" | "adequate" | "weak" | "unknown";
export type CardFlawSeverity = "high" | "medium" | "low";

export interface CardReuseAnnotation {
  claim: string;
  /** 0-10, clamped. */
  supportScore: number;
  authorQuality: {
    rating: AuthorQualityRating;
    qualifications: string;
    concerns: string;
  };
  flaws: Array<{ flaw: string; severity: CardFlawSeverity; explanation: string }>;
}

const RATINGS: readonly AuthorQualityRating[] = ["strong", "adequate", "weak", "unknown"];
const SEVERITIES: readonly CardFlawSeverity[] = ["high", "medium", "low"];

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parses and re-validates a stored annotation.
 *
 * The model is schema-constrained, but saved rows outlive schema changes and
 * a hand-edited row is still possible, so nothing reaches the popup without
 * passing through here.
 *
 * @param raw - The JSON text the model returned (or a parsed object).
 * @returns The annotation, or `null` when it is not one.
 */
export function parseCardReuseAnnotation(raw: unknown): CardReuseAnnotation | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const author = (record.authorQuality ?? {}) as Record<string, unknown>;

  const claim = asText(record.claim);
  const score = Number(record.supportScore);
  if (!claim || !Number.isFinite(score)) return null;

  const rating = RATINGS.includes(author.rating as AuthorQualityRating)
    ? (author.rating as AuthorQualityRating)
    : "unknown";
  const flaws = Array.isArray(record.flaws)
    ? record.flaws.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const flaw = asText(item.flaw);
        if (!flaw) return [];
        const severity = SEVERITIES.includes(item.severity as CardFlawSeverity)
          ? (item.severity as CardFlawSeverity)
          : "medium";
        return [{ flaw, severity, explanation: asText(item.explanation) }];
      })
    : [];

  return {
    claim,
    supportScore: Math.min(10, Math.max(0, Math.round(score))),
    authorQuality: {
      rating,
      qualifications: asText(author.qualifications),
      concerns: asText(author.concerns),
    },
    flaws,
  };
}

/**
 * The card as the model reads it: tag, full citation, the highlighted text
 * the card is read for, then the whole card text for context.
 *
 * Capped at {@link MAX_ANALYSIS_CONTENT_CHARS}, the evidence search's limit —
 * the dump's longest cards sit around 40k characters, and the tag, cite and
 * highlighting that decide the verdict come first.
 */
export function buildCardReuseAnnotationContent(
  card: Pick<DebateCardRecord, "tag" | "cite" | "fullcite" | "markup" | "spoken" | "fulltext">,
): string {
  const { quotes } = parseCardRecord(card);
  const body = card.fulltext || htmlToPlainText(card.markup);
  return [
    card.tag && `Tag: ${card.tag}`,
    (card.fullcite || card.cite) && `Citation: ${card.fullcite || card.cite}`,
    quotes.length > 0 && `Highlighted (read aloud):\n${quotes.join(" … ")}`,
    body && `Full card text:\n${body}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_ANALYSIS_CONTENT_CHARS);
}
