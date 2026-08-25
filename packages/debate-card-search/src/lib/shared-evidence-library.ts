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
 * `sourceUrl`/`normalizeSourceUrl`/`findEntriesBySourceUrl`/
 * `checkPageForExistingCards`/`buildPageReuseCheckSummaryText` implement the
 * first slice of the "On Page Card Reuse Search" idea in TODO.md's Product
 * Feature Ideas list ("See if anyone has cut this article in the chrome
 * ext") — the reuse-check logic a browser extension calls against the
 * current tab's URL, kept a plain, testable function here rather than
 * inside the extension itself. `buildReuseCheckDeepLink` is the second
 * slice — the `extension/card-reuse-checker` browser extension (see its
 * README) calls it to open `/cards/library` with the active tab's URL
 * pre-filled and auto-checked, closing that idea's remaining follow-up.
 *
 * @module lib/shared-evidence-library
 */

import { buildArgumentLibrary, filterCardsByTags, type ArgumentLibrary, type LibraryCard } from "./argument-library";
import { scoreClarity, scoreRelevance, scoreUsability } from "./llm-card-scoring";
import { computeEvidenceStaleness, type CardRevision, type CardSnapshot, type EvidenceStalenessSignal } from "./revision-incentives";

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
  /** The source article's URL this entry was cut from, if known — blank/absent for a `block` entry. */
  sourceUrl?: string;
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
 * Counts the words in a card/block's full-text body, for stamping a
 * submitted entry's `wordCount` (the depth-of-coverage signal
 * `lib/topic-coverage.ts` scores against) without requiring the submitter to
 * type it in themselves.
 */
export function computeWordCount(text: string): number {
  return tokenizeQueryText(text).length;
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
 * Normalizes a page URL for reuse-check matching: lower-cased, scheme and
 * leading "www." stripped, query string/fragment dropped (tracking
 * parameters like `?utm_source=` shouldn't defeat a match), and any
 * trailing slash(es) removed. A plain regex-based normalization rather than
 * the `URL` API, so it degrades gracefully on a malformed/partial string
 * instead of throwing.
 */
export function normalizeSourceUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

/**
 * Finds every entry cut from the same source article as `url`, matched via
 * `normalizeSourceUrl` so differing schemes, a leading "www.", tracking
 * query parameters, or a trailing slash don't defeat the match. An entry
 * with no `sourceUrl` (e.g. a `block`, or a card submitted before this
 * field existed) never matches.
 */
export function findEntriesBySourceUrl(entries: EvidenceLibraryEntry[], url: string): EvidenceLibraryEntry[] {
  const normalized = normalizeSourceUrl(url);
  if (!normalized) return [];
  return entries.filter((entry) => entry.sourceUrl && normalizeSourceUrl(entry.sourceUrl) === normalized);
}

/**
 * The result of checking whether a page has already been cut into the
 * shared evidence repository — the "On Page Card Reuse Search" idea in
 * TODO.md's Product Feature Ideas list ("See if anyone has cut this
 * article"). This is the reusable check a browser extension would call
 * against the current tab's URL before a contributor starts cutting a new
 * card; no extension exists in this repo yet, so `matches` is exposed
 * directly for any caller (a panel, or eventually an extension background
 * script) to render.
 */
export interface PageReuseCheckResult {
  url: string;
  alreadyCut: boolean;
  matches: EvidenceLibraryEntry[];
}

/** Checks whether `url` has already been cut into the repository, via `findEntriesBySourceUrl`. */
export function checkPageForExistingCards(entries: EvidenceLibraryEntry[], url: string): PageReuseCheckResult {
  const matches = findEntriesBySourceUrl(entries, url);
  return { url, alreadyCut: matches.length > 0, matches };
}

/** Renders a one-line summary of a `PageReuseCheckResult`, e.g. for a "Check this page" panel action. */
export function buildPageReuseCheckSummaryText(result: PageReuseCheckResult): string {
  if (!result.alreadyCut) return "No existing cards found for this page — safe to cut.";
  const count = result.matches.length;
  return `Already cut: ${count} existing ${count === 1 ? "entry" : "entries"} for this page.`;
}

/**
 * Builds the deep-link a browser extension opens to run the "Check this
 * page" box automatically against the current tab, closing follow-up (a)
 * under the "On Page Card Reuse Search" idea ("an actual browser extension
 * that calls this same check automatically against the current tab's URL").
 * The evidence repository is persisted in this app's own localStorage — an
 * extension runs in a different origin and can't read it directly — so
 * rather than reimplementing the check against data it has no access to,
 * the extension deep-links into `/cards/library` with the active tab's URL
 * pre-filled via a `checkUrl` query param, which `EvidenceLibraryPanel`
 * reads on mount and runs through the same `checkPersistedPageForExistingCards`
 * the manual "Check this page" box already calls. `appOrigin` is trimmed and
 * stripped of any trailing slash(es) first so a caller-supplied origin with
 * or without one produces the same link.
 */
export function buildReuseCheckDeepLink(appOrigin: string, pageUrl: string): string {
  const origin = appOrigin.trim().replace(/\/+$/, "");
  return `${origin}/cards/library?checkUrl=${encodeURIComponent(pageUrl.trim())}`;
}

/**
 * Builds the repository's topic-folder/tag-collection index, reusing
 * `buildArgumentLibrary` directly — an `EvidenceLibraryEntry` is already a
 * `LibraryCard`, so no separate grouping logic is needed here.
 */
export function buildEvidenceLibraryIndex(entries: EvidenceLibraryEntry[]): ArgumentLibrary {
  return buildArgumentLibrary(entries);
}

/** A 4-digit year (1900s or 2000s) found anywhere in a citation string, e.g. "24" in "Smith 24". */
const CITE_YEAR_RE = /\b(19|20)\d{2}\b/;

/**
 * Derives a Revision Incentives `CardSnapshot` from an evidence-library
 * entry, so an edit to a real `EvidenceLibraryEntry` can be scored by
 * `lib/revision-incentives.ts` without asking the editor to separately rate
 * the card. Reuses the existing `llm-card-scoring.ts` deterministic
 * heuristics directly rather than inventing new scoring logic:
 * - `qualitySignals` is `[scoreClarity, scoreUsability]` (each rescaled from
 *   0-100 to the 0-1 signal scale `scoreQualitySignal` expects).
 * - `citationCompleteness` is `0` with no citation, `1` when the citation
 *   contains a parseable 4-digit year (e.g. "Smith 24" does not, "Smith
 *   2024" does — "ND" citations reflect that there's no date to cite), and
 *   `0.5` for any other non-blank citation.
 * - `evidenceYear` is the parsed year, or `0` when none is found — so citing
 *   a dated source for the first time still counts as refreshing evidence
 *   relative to an undated "before" snapshot.
 */
export function deriveCardSnapshotFromEntry(entry: EvidenceLibraryEntry): CardSnapshot {
  const wordCount = computeWordCount(entry.text);
  const cite = entry.cite.trim();
  const yearMatch = cite.match(CITE_YEAR_RE);
  const evidenceYear = yearMatch ? Number.parseInt(yearMatch[0], 10) : 0;

  return {
    qualitySignals: [scoreClarity(entry.text) / 100, scoreUsability(wordCount) / 100],
    citationCompleteness: cite.length === 0 ? 0 : evidenceYear > 0 ? 1 : 0.5,
    evidenceYear,
    wordCount,
  };
}

/**
 * Builds a `CardRevision` from an evidence-library entry's before/after
 * state, composing `deriveCardSnapshotFromEntry` on each side so a real
 * edit — not a caller-supplied snapshot pair — can feed
 * `lib/revision-incentives.ts`'s scoring directly.
 */
export function buildEvidenceEntryRevision(
  before: EvidenceLibraryEntry,
  after: EvidenceLibraryEntry,
  contributorId: string,
): CardRevision {
  return {
    cardId: after.id,
    contributorId,
    before: deriveCardSnapshotFromEntry(before),
    after: deriveCardSnapshotFromEntry(after),
  };
}

/**
 * Flags whether an evidence-library entry's cited evidence is stale as of
 * `currentYear`, composing `deriveCardSnapshotFromEntry`'s parsed
 * `evidenceYear` directly with `revision-incentives.ts`'s
 * `computeEvidenceStaleness` — so a reusable analytic `block` (no `cite`,
 * `evidenceYear` always 0) is flagged stale the same way an undated card
 * would be.
 */
export function getEvidenceStaleness(entry: EvidenceLibraryEntry, currentYear: number): EvidenceStalenessSignal {
  return computeEvidenceStaleness(deriveCardSnapshotFromEntry(entry).evidenceYear, currentYear);
}

/**
 * Filters a list of evidence-library entries down to `card` entries (a
 * reusable analytic `block` never cites outside evidence, so staleness
 * doesn't apply to it) whose cited evidence is stale as of `currentYear`,
 * preserving input order — the proactive counterpart to
 * `revision-incentives.ts` only rewarding a refresh after it happens.
 */
export function getStaleEvidenceEntries(entries: EvidenceLibraryEntry[], currentYear: number): EvidenceLibraryEntry[] {
  return entries.filter((entry) => entry.kind === "card" && getEvidenceStaleness(entry, currentYear).isStale);
}

/** A search panel's raw filter-field values, before being narrowed into an `EvidenceSearchQuery`. */
export interface EvidenceSearchFormFilters {
  text: string;
  /** `undefined` (or omitted) means "any kind" — no `kind` filter applied. */
  kind?: EvidenceEntryKind;
  topic: string;
  caseArea: string;
  /** Comma-separated tags, matched in `"any"` mode. */
  tags: string;
}

/**
 * Narrows a search panel's raw filter-field values into an `EvidenceSearchQuery`,
 * trimming `topic`/`caseArea` and parsing `tags` into a list — omitting any
 * field that's blank so it doesn't narrow the search, rather than passing an
 * empty string/array through to `searchEvidenceLibrary`.
 */
export function buildEvidenceSearchFormQuery(filters: EvidenceSearchFormFilters): EvidenceSearchQuery {
  const topic = filters.topic.trim();
  const caseArea = filters.caseArea.trim();
  const tags = filters.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    text: filters.text,
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(topic ? { topic } : {}),
    ...(caseArea ? { caseArea } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
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
