/**
 * @fileoverview What the `/authors` pages ask of the data, as plain functions
 * over an {@link AuthorsDataset} (the committed JSON snapshot), plus the shapes
 * both read paths return.
 *
 * `author-repository.ts` answers the same questions from the SQL tables and
 * falls back to these when the tables are missing or empty, so the pages get
 * identical results either way. The ordering rules live here once:
 * authors rank by cards, then by cards that carry quoted text, then by name.
 *
 * @module lib/authors/author-queries
 */
import type { AuthorRecord, AuthorsDataset, CitationRecord } from "@debate-ai/help-docs/lib/authors/types";
import { searchKey } from "@debate-ai/help-docs/lib/authors/author-names";

export const DEFAULT_AUTHOR_PAGE_SIZE = 50;
export const MAX_AUTHOR_PAGE_SIZE = 100;

/** Where a result was read from, for the admin status and for debugging. */
export type AuthorsSource = "sql" | "json";

export interface AuthorListParams {
  /** Author-name search; every word must appear in the name or an alias. */
  q?: string;
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

export interface AuthorListPage {
  authors: AuthorRecord[];
  /** Authors matching `q` (all of them when it is empty). */
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** The search as it was applied, trimmed. */
  query: string;
  /** The whole index, regardless of the search. */
  overview: AuthorsOverview;
  source: AuthorsSource;
}

export interface AuthorsOverview {
  authors: number;
  citations: number;
  citationsWithQuotes: number;
}

/** A co-author as shown beside a card. */
export interface CoAuthor {
  slug: string;
  name: string;
  role: string;
}

/** One card on an author's page: the citation, with the author's own credit on it. */
export type AuthorCard = Omit<CitationRecord, "authors" | "quoteText"> & {
  /** What this author did on the source: `author`, `editor` or `director`. */
  role: string;
  /** This author's qualification on the card; falls back to the card's whole line. */
  authorQualification: string;
  coAuthors: CoAuthor[];
};

export interface AuthorProfile {
  author: AuthorRecord;
  cards: AuthorCard[];
  source: AuthorsSource;
}

/** The words of a search, folded the way names are indexed. */
export function searchWords(query: string | undefined): string[] {
  return searchKey(query ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 6);
}

export function normalizePage(page: number | undefined): number {
  return Number.isFinite(page) && page! >= 1 ? Math.floor(page!) : 1;
}

export function normalizePageSize(pageSize: number | undefined): number {
  if (!Number.isFinite(pageSize) || pageSize! < 1) return DEFAULT_AUTHOR_PAGE_SIZE;
  return Math.min(Math.floor(pageSize!), MAX_AUTHOR_PAGE_SIZE);
}

/** Whether every search word is in the author's name or one of their other spellings. */
export function authorMatches(author: AuthorRecord, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const haystack = [author.normalizedName, ...author.aliases.map(searchKey)].join(" ");
  return words.every((word) => haystack.includes(word));
}

/** Most cards first, then most quoted cards, then name order. */
export function compareAuthors(a: AuthorRecord, b: AuthorRecord): number {
  return (
    b.cardCount - a.cardCount ||
    b.quoteCount - a.quoteCount ||
    (a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Newest cards first; undated ones last; ties in References-page order. */
export function compareCards(a: AuthorCard, b: AuthorCard): number {
  return (
    (b.yearNumber ?? -Infinity) - (a.yearNumber ?? -Infinity) ||
    (a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : 0) ||
    a.entryNumber - b.entryNumber
  );
}

export function datasetOverview(dataset: AuthorsDataset): AuthorsOverview {
  return {
    authors: dataset.authors.length,
    citations: dataset.citations.length,
    citationsWithQuotes: dataset.citations.filter((citation) => citation.quoteHtml).length,
  };
}

/** {@link AuthorListPage} computed from the snapshot. */
export function listAuthorsFromDataset(dataset: AuthorsDataset, params: AuthorListParams = {}): AuthorListPage {
  const words = searchWords(params.q);
  const pageSize = normalizePageSize(params.pageSize);
  const matching = dataset.authors.filter((author) => authorMatches(author, words)).sort(compareAuthors);
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(normalizePage(params.page), totalPages);
  return {
    authors: matching.slice((page - 1) * pageSize, page * pageSize),
    total: matching.length,
    page,
    pageSize,
    totalPages,
    query: (params.q ?? "").trim(),
    overview: datasetOverview(dataset),
    source: "json",
  };
}

/** The card a citation row becomes on one author's page. */
export function toAuthorCard(
  citation: Omit<CitationRecord, "authors" | "quoteText">,
  credit: { role: string; qualification: string },
  coAuthors: CoAuthor[],
): AuthorCard {
  return {
    ...citation,
    role: credit.role,
    authorQualification: credit.qualification || citation.qualification,
    coAuthors,
  };
}

/** {@link AuthorProfile} computed from the snapshot; `null` for an unknown slug. */
export function profileFromDataset(dataset: AuthorsDataset, slug: string): AuthorProfile | null {
  const author = dataset.authors.find((candidate) => candidate.slug === slug);
  if (!author) return null;
  const nameById = new Map(dataset.authors.map((candidate) => [candidate.id, candidate]));
  const cards: AuthorCard[] = [];
  for (const citation of dataset.citations) {
    const credit = citation.authors.find((link) => link.authorId === author.id);
    if (!credit) continue;
    const { authors: links, quoteText: _quoteText, ...rest } = citation;
    const coAuthors = links
      .filter((link) => link.authorId !== author.id)
      .map((link) => ({ slug: nameById.get(link.authorId)!.slug, name: nameById.get(link.authorId)!.name, role: link.role }));
    cards.push(toAuthorCard(rest, credit, coAuthors));
  }
  return { author, cards: cards.sort(compareCards), source: "json" };
}
