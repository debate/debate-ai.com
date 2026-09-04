/**
 * @fileoverview Flow-note evidence suggestions — closes follow-up (c) named
 * under idea #16 ("Shared, Ai-Generated Debate Flow") in TODO.md: "composing
 * the Common Argument Library's tagged card corpus to suggest (not
 * auto-apply) a pre-filled flow note from matching evidence." Scores a
 * contributor's in-progress `FlowEdit` content against the Common Argument
 * Library's cards (`debate-card-search`'s `LibraryCard`) by keyword overlap,
 * reusing `llm-card-scoring.ts#scoreRelevance`'s substring-match scoring
 * directly against each card's own derived keywords. A matched card is only
 * ever formatted into note text a contributor can insert as a starting
 * point — never applied to a box automatically, matching the idea's "keep
 * humans in control of the actual flow and strategic interpretation"
 * requirement.
 *
 * @module flow/flow-note-suggestions
 */

import type { LibraryCard } from "debate-research-evidence/src/lib/argument-library";
import { scoreRelevance } from "debate-research-evidence/src/lib/llm-card-scoring";

/** One `LibraryCard` matched against a query, with its relevance score. */
export type FlowNoteSuggestion = {
  card: LibraryCard;
  score: number;
};

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

/**
 * Derives keywords describing a `LibraryCard` from its `argBlock`, `topic`,
 * `caseArea`, and `tags` — mirrors `llm-card-scoring.ts#deriveArgBlockKeywords`:
 * each phrase is kept whole, plus its individual words longer than two
 * characters (so short tags like "DA"/"CP" don't drown out real words).
 * Blank phrases and duplicate keywords are dropped.
 */
export function deriveLibraryCardKeywords(card: LibraryCard): string[] {
  const phrases = [card.argBlock, card.topic, card.caseArea, ...card.tags];
  const keywords = new Set<string>();
  for (const phrase of phrases) {
    const trimmed = phrase.trim();
    if (!trimmed) continue;
    keywords.add(trimmed);
    for (const word of tokenize(trimmed)) {
      if (word.length > 2) keywords.add(word);
    }
  }
  return Array.from(keywords);
}

/**
 * Scores every card in `cards` against `query` (a contributor's in-progress
 * flow-note content) by the share of the card's own keywords found in
 * `query`, reusing `scoreRelevance` directly. Cards scoring 0 (no keyword
 * overlap) are dropped; the rest are sorted by score descending, ties
 * broken by `id` for a deterministic order, and capped at `limit` (default
 * 5). A blank `query` returns no suggestions — there's nothing yet to match
 * against.
 */
export function suggestFlowNotesFromLibrary(
  cards: LibraryCard[],
  query: string,
  limit = 5,
): FlowNoteSuggestion[] {
  if (!query.trim()) return [];

  return cards
    .map((card) => ({ card, score: scoreRelevance(query, deriveLibraryCardKeywords(card)) }))
    .filter((suggestion) => suggestion.score > 0)
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id))
    .slice(0, limit);
}

/**
 * Formats a suggested card into flow-note text a contributor can insert as
 * a starting point for a `FlowEdit`'s content — still fully editable, never
 * auto-applied to the box itself.
 */
export function buildFlowNoteFromCard(card: LibraryCard): string {
  const tagsSuffix = card.tags.length > 0 ? ` [${card.tags.join(", ")}]` : "";
  return `${card.argBlock} — ${card.caseArea} (${card.topic})${tagsSuffix}`;
}
