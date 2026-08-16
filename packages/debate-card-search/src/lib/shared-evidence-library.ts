/**
 * @fileoverview Pure fast-search helpers for the "Shared Evidence Library"
 * idea under Research Crowdsourcing Organizer Features in TODO.md ("Keep a
 * team-wide repository of cards, tags, cites, analytics, and reusable
 * blocks with fast search"). Extends the existing "Common Argument Library"
 * slice's `LibraryCard` with a searchable full-text `text` body, a `cite`,
 * and a `kind` distinguishing a cut/tagged evidence card from a
 * team-drafted reusable analytic block, then adds keyword/tag/cite/topic/
 * case-area search over that repository — reusing `filterCardsByTags`
 * directly for tag filtering and the existing "LLM Card Scoring" slice's
 * `scoreRelevance` directly for keyword-overlap ranking, rather than
 * reimplementing either. This is the first slice only — it works entirely
 * off a caller-supplied entry list; it doesn't read real submitted cards or
 * blocks, persist the repository, or render a search UI. See the
 * follow-ups noted in TODO.md.
 *
 * @module lib/shared-evidence-library
 */

import { buildArgumentLibrary, filterCardsByTags, type ArgumentLibrary, type LibraryCard } from "./argument-library";
import { scoreRelevance } from "./llm-card-scoring";

/** Whether a repository entry is a cut/tagged evidence card or a team-drafted reusable analytic block. */
export type EvidenceEntryKind = "card" | "block";

/**
 * One entry in the shared evidence repository: a `LibraryCard` (already
 * topic/case-area/tag-addressed) plus the full-text body needed for
 * keyword search and a citation. A reusable analytic `block` isn't citing
 * outside evidence, so `cite` is blank for those entries.
 */
export interface EvidenceLibraryEntry extends LibraryCard {
  kind: EvidenceEntryKind;
  /** Full-text body searched for keyword matches (a card's cut text, or a block's prose). */
  text: string;
  /** Citation string, e.g. "Smith 24" — blank for a `block` entry. */
  cite: string;
}

/** Search criteria over the shared evidence repository. All fields are optional and combine with AND. */
export interface EvidenceSearchQuery {
  /** Free-text query matched (case-insensitively, word-by-word) against `text`, `argBlock`, and `cite`. */
  text?: string;
  /** Restrict to entries carrying at least one (or, with `tagMode: "all"`, every one) of these tags. */
  tags?: string[];
  tagMode?: "any" | "all";
  topic?: string;
  caseArea?: string;
  kind?: EvidenceEntryKind;
}

/** One search result: the matched entry plus its keyword-relevance score against the query's `text`. */
export interface EvidenceSearchResult {
  entry: EvidenceLibraryEntry;
  /** 0-100 keyword-overlap relevance to `query.text`, via `scoreRelevance`; 0 when no `text` query was given. */
  relevanceScore: number;
}

function tokenizeQueryText(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Searches the shared evidence repository. Non-text filters (`tags`,
 * `topic`, `caseArea`, `kind`) narrow the candidate set first; a `text`
 * query then ranks the remaining entries by keyword-overlap relevance
 * (matched against each entry's `text`, `argBlock`, and `cite` combined)
 * and drops entries with zero matched keywords, so an unrelated card in a
 * matching topic/tag doesn't clutter results. Results are sorted by
 * `relevanceScore` descending, tie-broken by entry `id`. With no `text`
 * query, every filtered entry is returned (each scored 0) in that same
 * tie-broken order.
 */
export function searchEvidenceLibrary(
  entries: EvidenceLibraryEntry[],
  query: EvidenceSearchQuery = {},
): EvidenceSearchResult[] {
  let candidates = entries;

  if (query.kind) {
    candidates = candidates.filter((entry) => entry.kind === query.kind);
  }
  if (query.topic) {
    candidates = candidates.filter((entry) => entry.topic === query.topic);
  }
  if (query.caseArea) {
    candidates = candidates.filter((entry) => entry.caseArea === query.caseArea);
  }
  if (query.tags && query.tags.length > 0) {
    candidates = filterCardsByTags(candidates, query.tags, query.tagMode ?? "any") as EvidenceLibraryEntry[];
  }

  const queryText = query.text?.trim();
  if (!queryText) {
    return [...candidates]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((entry) => ({ entry, relevanceScore: 0 }));
  }

  const keywords = tokenizeQueryText(queryText);
  return candidates
    .map((entry) => ({
      entry,
      relevanceScore: scoreRelevance(`${entry.text} ${entry.argBlock} ${entry.cite}`, keywords),
    }))
    .filter((result) => result.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.entry.id.localeCompare(b.entry.id));
}

/** Finds every entry citing a given source, matched case-insensitively against `cite`. */
export function findEntriesByCite(entries: EvidenceLibraryEntry[], cite: string): EvidenceLibraryEntry[] {
  const lowerCite = cite.trim().toLowerCase();
  if (!lowerCite) return [];
  return entries.filter((entry) => entry.cite.toLowerCase().includes(lowerCite));
}

/**
 * Builds the repository's topic-folder/tag-collection index, reusing
 * `buildArgumentLibrary` directly — an `EvidenceLibraryEntry` is already a
 * `LibraryCard`, so no separate grouping logic is needed here.
 */
export function buildEvidenceLibraryIndex(entries: EvidenceLibraryEntry[]): ArgumentLibrary {
  return buildArgumentLibrary(entries);
}

/** Renders a short summary line for a search results panel. */
export function buildEvidenceSearchSummaryText(results: EvidenceSearchResult[], query: EvidenceSearchQuery): string {
  const count = results.length;
  const noun = `result${count === 1 ? "" : "s"}`;
  if (query.text?.trim()) {
    return `${count} ${noun} for "${query.text.trim()}"`;
  }
  return `${count} ${noun}`;
}
