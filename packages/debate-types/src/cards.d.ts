/** Encodes whether parsed authors are single/multiple/organization; `null` means unknown. */
export type AuthorType = number | null;

/** Parsed publication year where `"ND"` represents no date. */
export type CardYear = number | "ND" | null;

/** Normalized debate card produced by the parser. */
export interface Card {
  /** The card's tagline: the argument the evidence supports. */
  summary: string;
  /** Author's name as cited, or null when none was found. */
  author: string | null;
  /** Whether the author is one person, several, or an organization. */
  author_type: AuthorType;
  /** The full citation paragraph. */
  cite: string | null;
  /** Publication year, `"ND"` for no date, or null when unknown. */
  year: CardYear;
  /** Source URL, when the citation includes one. */
  url: string | null;
  /** The card body as HTML, with underline and highlight formatting. */
  html?: string;
  /** The card body reduced to its highlighted/marked text. */
  marked?: string;
  /** Word count of the whole card body. */
  words?: number;
  /** Word count of the highlighted text only. */
  wordsMarked?: number;
  /** Problems found while parsing, e.g. a missing citation. */
  error?: string[];
}

/** Mutable parsing state used while building a finalized {@link Card}. */
export interface MutableCard extends Card {
  /** Body paragraphs collected so far. */
  body?: string[];
  /** HTML collected so far, flushed into `html` when the card closes. */
  htmlBuffer?: string;
}

/** Structural heading entry returned in the outline. */
export interface OutlineItem {
  /** Heading level: 1 is the top level, 5 the deepest. */
  type: 1 | 2 | 3 | 4 | 5;
  /** The heading text. */
  text: string;
}

/** A parsed outline node, either a heading or a finished card. */
export type OutlineNode = OutlineItem | Card;

/** Metadata inferred from the source file and parse output. */
export interface ParseMetadata {
  /** Category inferred from the file name, e.g. "Case". */
  category: string | null;
  /** Title inferred from the file name. */
  title: string | null;
  /** Organization inferred from the file name, e.g. a school or camp. */
  organization: string | null;
  /** Year inferred from the file name. */
  year: number | null;
  /** How many cards (quotes) were parsed. */
  quotes: number;
  /** How many headings (blocks) were parsed. */
  blocks: number;
}

/** Top-level parse result for a document. */
export interface ParseResult {
  /** Facts inferred about the document as a whole. */
  metadata: ParseMetadata;
  /** Headings and cards in document order. */
  outline: OutlineNode[];
}

/** Heuristics that control how `htmlToCards` detects card boundaries. */
export interface FormatProfile {
  /** HTML tags treated as headings. */
  headingTags: string[];
  /** Headings that begin a new card. */
  cardStartHeadings: string[];
  /** Blank lines in a row that end a card. */
  minBlankLinesForBoundary: number;
  /** Whether the document's own `<p>` tags mark real paragraph breaks. */
  trustParagraphTags: boolean;
  /** Patterns that recognise a card's summary line. */
  summaryPatterns: RegExp[];
}

/** Optional parser overrides with a named profile selector. */
export interface ParseOptions extends Partial<FormatProfile> {
  /** Name of a built-in format profile to start from. */
  profile?: string;
}

/** Extracted citation fields from a citation paragraph. */
export interface CitationInfo {
  /** Author's name as cited. */
  author: string | null;
  /** Publication year. */
  year: CardYear;
  /** Whether the author is one person, several, or an organization. */
  author_type: AuthorType;
}

/** File-name-derived metadata used to enrich parse output. */
export interface FileNameParts {
  /** Category part of the file name. */
  category: string | null;
  /** Topic part of the file name. */
  topic: string | null;
  /** Organization part of the file name. */
  organization: string | null;
  /** Year part of the file name. */
  year: number | null;
}

/** Options for human-name normalization and citation formatting. */
export interface HumanNameOptions {
  /** Shorten the author in the cite to a last name. */
  formatCiteShortenAuthor?: boolean;
  /** Authors listed before the rest become "et al.". */
  maxAuthorsBeforeEtAl?: number;
}

/** Canonicalized human-name output used by citation parsing. */
export interface HumanNameResult {
  /** Author as written in the cite, e.g. "Smith and Jones". */
  author_cite: string;
  /** Short form of the author, e.g. "Smith". */
  author_short: string;
  /** Whether the author is one person, several, or an organization. */
  author_type: number;
}
