/**
 * @fileoverview Suggested-evidence lookup for the `EditReviewPopover` — the
 * follow-up (c) named under idea #16 ("Shared, Ai-Generated Debate Flow")
 * in TODO.md: "composing the Common Argument Library's tagged card corpus
 * to suggest (not auto-apply) a pre-filled flow note from matching
 * evidence." Reuses `debate-card-search`'s `searchEvidenceLibrary`
 * directly for the keyword-overlap ranking rather than reimplementing it,
 * mirroring the existing cross-package precedent in `round/coaching-program.ts`
 * (`debate-round` depends on `debate-card-search`). This is pure lookup
 * logic only — a contributor must click a suggestion to insert it; nothing
 * here writes to a box's content on its own.
 *
 * @module flow/flow-evidence-suggestions
 */

import {
  searchEvidenceLibrary,
  type EvidenceLibraryEntry,
  type EvidenceSearchResult,
} from "debate-card-search/src/lib/shared-evidence-library";

/** How many ranked suggestions to surface by default — enough to scan, not enough to overwhelm a small popover. */
export const DEFAULT_EVIDENCE_SUGGESTION_LIMIT = 5;

/**
 * Ranks the shared evidence-library corpus against a box's in-progress
 * edit content and returns the top matches. Blank/whitespace-only content
 * yields no suggestions — there's nothing to match against yet, so this
 * mirrors `searchEvidenceLibrary`'s own "empty query" behavior rather than
 * falling back to an unranked, unrelated list.
 */
export function suggestEvidenceForBoxContent(
  entries: EvidenceLibraryEntry[],
  content: string,
  limit: number = DEFAULT_EVIDENCE_SUGGESTION_LIMIT,
): EvidenceSearchResult[] {
  const queryText = content.trim();
  if (!queryText) return [];
  return searchEvidenceLibrary(entries, { text: queryText }).slice(0, limit);
}

/**
 * Appends a suggested evidence entry's snippet (its full text, falling
 * back to its argument-block label for a `block` entry with no cut text)
 * and citation onto a box's existing content, separated by a blank line
 * from whatever the contributor has already typed. Never replaces or
 * clears existing content — this is the "insert", not "apply", half of the
 * suggest-not-auto-apply requirement.
 */
export function appendEvidenceToContent(content: string, entry: EvidenceLibraryEntry): string {
  const snippet = entry.text.trim() || entry.argBlock.trim();
  const citation = entry.cite.trim();
  const addition = citation ? `${snippet} (${citation})` : snippet;

  const trimmedContent = content.trim();
  return trimmedContent ? `${trimmedContent}\n\n${addition}` : addition;
}
