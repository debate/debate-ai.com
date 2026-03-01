/** @fileoverview Shared type definitions used across card parsing helpers. */
/** Encodes whether parsed authors are single/multiple/organization; `null` means unknown. */
export type AuthorType = number | null

/** Parsed publication year where `"ND"` represents no date. */
export type CardYear = number | "ND" | null

/** Normalized debate card produced by the parser. */
export interface Card {
  summary: string
  author: string | null
  author_type: AuthorType
  cite: string | null
  year: CardYear
  url: string | null
  html?: string
  marked?: string
  words?: number
  wordsMarked?: number
  error?: string[]
}

/** Mutable parsing state used while building a finalized {@link Card}. */
export interface MutableCard extends Card {
  body?: string[]
  htmlBuffer?: string
}

/** Structural heading entry returned in the outline. */
export interface OutlineItem {
  type: 1 | 2 | 3 | 4 | 5
  text: string
}

/** A parsed outline node, either a heading or a finished card. */
export type OutlineNode = OutlineItem | Card

/** Metadata inferred from the source file and parse output. */
export interface ParseMetadata {
  category: string | null
  title: string | null
  organization: string | null
  year: number | null
  quotes: number
  blocks: number
}

/** Top-level parse result for a document. */
export interface ParseResult {
  metadata: ParseMetadata
  outline: OutlineNode[]
}

/** Heuristics that control how `htmlToCards` detects card boundaries. */
export interface FormatProfile {
  headingTags: string[]
  cardStartHeadings: string[]
  minBlankLinesForBoundary: number
  trustParagraphTags: boolean
  summaryPatterns: RegExp[]
}

/** Optional parser overrides with a named profile selector. */
export interface ParseOptions extends Partial<FormatProfile> {
  profile?: keyof typeof import("./format-profiles").FORMAT_PROFILES | string
}

/** Extracted citation fields from a citation paragraph. */
export interface CitationInfo {
  author: string | null
  year: CardYear
  author_type: AuthorType
}

/** File-name-derived metadata used to enrich parse output. */
export interface FileNameParts {
  category: string | null
  topic: string | null
  organization: string | null
  year: number | null
}

/** Options for human-name normalization and citation formatting. */
export interface HumanNameOptions {
  formatCiteShortenAuthor?: boolean
  maxAuthorsBeforeEtAl?: number
}

/** Canonicalized human-name output used by citation parsing. */
export interface HumanNameResult {
  author_cite: string
  author_short: string
  author_type: number
}
