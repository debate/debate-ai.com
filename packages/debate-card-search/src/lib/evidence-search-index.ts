/**
 * @fileoverview A real search index over the "Shared Evidence Library" —
 * closes follow-up (c) named under the "📋 Shared Evidence Library" bullet
 * in TODO.md's Research Crowdsourcing Organizer Features list ("a real
 * search index (e.g. Typesense) once entries are persisted at scale").
 * `lib/shared-evidence-library.ts`'s `searchEvidenceLibrary` re-scores every
 * candidate entry's full text against the query on every call; this module
 * instead builds a token → postings-list inverted index once
 * (`buildEvidenceSearchIndex`) and ranks a query by looking its terms up
 * directly (`searchEvidenceLibraryWithIndex`), weighting each match by
 * TF-IDF (term frequency in the entry, times inverse document frequency
 * across the indexed corpus) rather than `scoreRelevance`'s presence/
 * absence keyword-overlap ratio — so a term that appears in fewer entries
 * (more distinctive) outranks a term nearly every entry shares. Kept a
 * drop-in alternative: same `EvidenceSearchQuery` input and
 * `EvidenceSearchResult` output shape as `searchEvidenceLibrary`, and the
 * same non-text filter semantics (topic/caseArea/kind/tags, reusing
 * `filterCardsByTags` directly).
 *
 * `addEntryToIndex`/`removeEntryFromIndex`/`updateEntryInIndex` close this
 * bullet's remaining "Known gap" named in `docs/features/evidence-library.md`
 * — true incremental indexing that updates only the entries a write
 * actually touched, rather than `state/evidenceLibraryEntries.ts`'s cached
 * index falling back to a full `buildEvidenceSearchIndex` re-tokenize-
 * everything pass whenever anything in the corpus changes. Each indexed
 * entry's own contributed terms are tracked (`entryTermsById`) so removing
 * or updating one entry only ever touches the postings lists that entry
 * itself appears in, not the full vocabulary.
 *
 * @module lib/evidence-search-index
 */

import { filterCardsByTags } from "./argument-library";
import type { EvidenceLibraryEntry, EvidenceSearchQuery, EvidenceSearchResult } from "./shared-evidence-library";

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

/** The same fields `searchEvidenceLibrary` scores against, combined and tokenized into a term → frequency map. */
function computeEntryTermFrequencies(entry: EvidenceLibraryEntry): Map<string, number> {
  const termFrequencies = new Map<string, number>();
  for (const token of tokenize(`${entry.text} ${entry.argBlock} ${entry.cite}`)) {
    termFrequencies.set(token, (termFrequencies.get(token) ?? 0) + 1);
  }
  return termFrequencies;
}

/** One entry's occurrence of a term: which entry, and how many times the term appears in it. */
export interface EvidenceSearchIndexPosting {
  entryId: string;
  termFrequency: number;
}

/**
 * A real inverted index over a set of evidence-library entries: every
 * indexed entry keyed by id, a token → postings-list map recording which
 * entries contain each token and how often, and (for incremental updates)
 * each indexed entry's own set of contributed terms.
 */
export interface EvidenceSearchIndex {
  entriesById: Map<string, EvidenceLibraryEntry>;
  postings: Map<string, EvidenceSearchIndexPosting[]>;
  /** Which terms each indexed entry contributed, so `removeEntryFromIndex` need not scan the full vocabulary. */
  entryTermsById: Map<string, string[]>;
  /** Corpus size the inverse-document-frequency weighting below is computed against. */
  documentCount: number;
}

/**
 * Builds an `EvidenceSearchIndex` from a list of entries, tokenizing each
 * entry's `text`, `argBlock`, and `cite` combined — the same fields
 * `searchEvidenceLibrary` scores against — into a token → postings-list
 * inverted index.
 */
export function buildEvidenceSearchIndex(entries: EvidenceLibraryEntry[]): EvidenceSearchIndex {
  const index: EvidenceSearchIndex = {
    entriesById: new Map(),
    postings: new Map(),
    entryTermsById: new Map(),
    documentCount: 0,
  };
  for (const entry of entries) {
    addEntryToIndex(index, entry);
  }
  return index;
}

/**
 * Adds a single entry to an existing index in place, without re-tokenizing
 * or touching any other indexed entry. Replaces (via `removeEntryFromIndex`
 * first) if `entry.id` is already indexed, so it's also safe to call for an
 * entry whose content changed.
 */
export function addEntryToIndex(index: EvidenceSearchIndex, entry: EvidenceLibraryEntry): void {
  if (index.entriesById.has(entry.id)) {
    removeEntryFromIndex(index, entry.id);
  }

  const termFrequencies = computeEntryTermFrequencies(entry);
  index.entriesById.set(entry.id, entry);
  index.entryTermsById.set(entry.id, Array.from(termFrequencies.keys()));
  index.documentCount += 1;

  for (const [term, termFrequency] of termFrequencies) {
    const list = index.postings.get(term);
    const posting: EvidenceSearchIndexPosting = { entryId: entry.id, termFrequency };
    if (list) {
      list.push(posting);
    } else {
      index.postings.set(term, [posting]);
    }
  }
}

/**
 * Removes a single entry from an existing index in place, touching only the
 * postings lists for terms that entry itself contributed (via
 * `entryTermsById`) rather than scanning the full vocabulary. A no-op if
 * `entryId` isn't indexed.
 */
export function removeEntryFromIndex(index: EvidenceSearchIndex, entryId: string): void {
  const terms = index.entryTermsById.get(entryId);
  if (!terms) return;

  for (const term of terms) {
    const list = index.postings.get(term);
    if (!list) continue;
    const filtered = list.filter((posting) => posting.entryId !== entryId);
    if (filtered.length === 0) {
      index.postings.delete(term);
    } else {
      index.postings.set(term, filtered);
    }
  }

  index.entryTermsById.delete(entryId);
  index.entriesById.delete(entryId);
  index.documentCount -= 1;
}

/**
 * Updates a single already-indexed (or new) entry in place — a
 * remove-then-add, so a changed entry's stale terms/frequencies never
 * linger in the postings lists.
 */
export function updateEntryInIndex(index: EvidenceSearchIndex, entry: EvidenceLibraryEntry): void {
  removeEntryFromIndex(index, entry.id);
  addEntryToIndex(index, entry);
}

/**
 * Searches an `EvidenceSearchIndex`, mirroring `searchEvidenceLibrary`'s
 * query shape and non-text filter semantics exactly (kind, topic, caseArea,
 * tags narrow the candidate set first, via `filterCardsByTags` for tags).
 * With no `text` query, every filtered entry is returned unscored,
 * tie-broken by id, matching `searchEvidenceLibrary`.
 *
 * With a `text` query, each query term is looked up directly in the
 * index's postings — entries that share no term with the query are never
 * visited — and each matching entry is scored by summing, per matched term,
 * `termFrequency * inverseDocumentFrequency` (a smoothed
 * `ln((N + 1) / (documentFrequency + 1)) + 1`, always positive, so a term
 * present in every indexed entry still contributes rather than zeroing the
 * score out). Scores are then rescaled to 0-100 relative to the top-scoring
 * match, matching `EvidenceSearchResult.relevanceScore`'s declared range.
 * An entry matching none of the query's terms is dropped, same as
 * `searchEvidenceLibrary`.
 */
export function searchEvidenceLibraryWithIndex(
  index: EvidenceSearchIndex,
  query: EvidenceSearchQuery = {},
): EvidenceSearchResult[] {
  let candidates = Array.from(index.entriesById.values());

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

  const candidateIds = new Set(candidates.map((entry) => entry.id));
  const rawScores = new Map<string, number>();

  for (const term of tokenize(queryText)) {
    const postingsForTerm = index.postings.get(term);
    if (!postingsForTerm || postingsForTerm.length === 0) continue;

    const inverseDocumentFrequency = Math.log((index.documentCount + 1) / (postingsForTerm.length + 1)) + 1;
    for (const posting of postingsForTerm) {
      if (!candidateIds.has(posting.entryId)) continue;
      rawScores.set(
        posting.entryId,
        (rawScores.get(posting.entryId) ?? 0) + posting.termFrequency * inverseDocumentFrequency,
      );
    }
  }

  if (rawScores.size === 0) return [];

  const maxScore = Math.max(...rawScores.values());
  return Array.from(rawScores.entries())
    .map(([entryId, score]) => ({
      entry: index.entriesById.get(entryId) as EvidenceLibraryEntry,
      relevanceScore: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.entry.id.localeCompare(b.entry.id));
}
