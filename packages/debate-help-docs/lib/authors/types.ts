/**
 * @file types.ts
 * @description The shapes of the authors dataset: every author credited on a
 * References page card, and every card (citation) with its quoted text.
 *
 * The dataset is built from the docs MDX by `extract-authors.ts`, written to
 * `apps/debate-web/lib/authors/authors-snapshot.json` by
 * `.github/scripts/sync-authors.ts`, loaded into the `authors`, `citations`
 * and `citation_authors` SQL tables, and read by the `/authors` pages. It is a
 * plain JSON value (no dates, no class instances) and is built
 * deterministically, so re-running the sync on unchanged docs leaves the
 * snapshot byte-for-byte identical.
 */
import type { SourceKind } from '../reference-display';
import type { ReferenceQuoteStatus } from '../reference-quote-status';

/** A person, or an organization credited as the author (`Cleveland Clinic`). */
export type AuthorKind = 'person' | 'institution';

/** What the author did on the card's source: wrote it, edited it, or directed it. */
export type AuthorRole = 'author' | 'editor' | 'director';

export interface AuthorRecord {
  /** Stable primary key, `author:<slug>`. */
  id: string;
  /** URL segment: `/authors/<slug>`, e.g. `ryan-galloway`. */
  slug: string;
  /** Display name, given name first: `Ryan Galloway`, `George C. Edwards III`. */
  name: string;
  /** Bibliography order, family name first: `Galloway, Ryan`. */
  sortName: string;
  /** Lowercase ASCII, punctuation-free `given family`, used for searching. */
  normalizedName: string;
  kind: AuthorKind;
  /** The author's qualifications as the cards word them (the most common one), without the author's own name. */
  qualifications: string;
  /** Other spellings of the name found on cards that were merged into this author. */
  aliases: string[];
  /** Cards this author is credited on. */
  cardCount: number;
  /** Of those, cards that carry quoted card text. */
  quoteCount: number;
  /** Earliest and latest cited year; `null` when every card is undated. */
  firstYear: number | null;
  lastYear: number | null;
}

/** One author's credit on one card. */
export interface CitationAuthorLink {
  authorId: string;
  /** 0-based position in the byline. */
  position: number;
  role: AuthorRole;
  /** This author's qualification on the card; empty when the card gives none for them. */
  qualification: string;
}

/** A docs page that cites a card, for the "cited in" links. */
export interface CitedInPage {
  /** Absolute path, e.g. `/docs/journal/synergy-slayer-critiques/02-original-sin`. */
  path: string;
  title: string;
}

/** One evidence card: a References page entry with its quoted text. */
export interface CitationRecord {
  /** Stable primary key, `<collection>#<anchor>`. */
  id: string;
  /** Content folder the References page sits in, without slashes at the ends: `journal/synergy-slayer-critiques`. */
  collection: string;
  /** The collection's title, for the back link: `The Synergy Slayer of Critiques in Debate`. */
  collectionTitle: string;
  /** The References page: `/docs/journal/synergy-slayer-critiques/references`. */
  pagePath: string;
  /** Anchor of the card on that page, `ref-ackerman-2020`. The card is at `pagePath#anchor`. */
  anchor: string;
  /** 1-based position in the References list. */
  entryNumber: number;
  /** The Chicago bibliography entry as sanitized HTML (`<em>`, `<a>`). */
  chicago: string;
  /** The same entry as plain text. */
  chicagoText: string;
  /** Year as cited: `2020`, `2026a`, `1990`, `n.d.`, or `''`. */
  year: string;
  /** The year as a number (the edition year for `[1888] 1990`); `null` when undated. */
  yearNumber: number | null;
  /** The source's title: the article, chapter, book or film. Plain text. */
  title: string;
  /** What the title appears in: the journal, magazine or site. Plain text, may be empty. */
  container: string;
  sourceKind: SourceKind;
  /** The link the entry carries, if any. */
  url: string;
  /** The card's tag: what it says, in a sentence or two. */
  summary: string;
  /** The qualification line as the card words it. */
  qualification: string;
  /** Quoted card text with its underlining and highlights, as sanitized HTML; empty when the card has none. */
  quoteHtml: string;
  /** The quoted card text as plain text, paragraphs separated by a blank line. */
  quoteText: string;
  quoteWordCount: number;
  quoteStatus: ReferenceQuoteStatus;
  /** The byline had `et al.`: more authors exist than are credited here. */
  etAl: boolean;
  /** Pages of the same paper that cite this card in running text (best effort). */
  citedIn: CitedInPage[];
  /** Credited authors in byline order; empty for a court case or other unsigned source. */
  authors: CitationAuthorLink[];
}

/** Counts and caveats of one extraction run, for the report and the admin status. */
export interface AuthorsDatasetStats {
  authors: number;
  persons: number;
  institutions: number;
  citations: number;
  /** Cards with no credited author (court cases, unsigned pieces). */
  unauthoredCitations: number;
  /** Cards that carry quoted text. */
  citationsWithQuotes: number;
  /** Cards whose byline said `et al.`: later authors were not named and are not credited. */
  etAlCitations: number;
  /** Author-name spellings merged into another author's record. */
  mergedVariants: number;
}

/** A name the extractor could not place with confidence, for the sync report. */
export interface AuthorsDatasetWarning {
  kind: 'ambiguous-name' | 'no-author' | 'no-year';
  message: string;
}

export interface AuthorsDataset {
  /** Bumped when the shape changes, so a stale snapshot is detectable. */
  version: 1;
  /** The content folders that were read. */
  collections: string[];
  stats: AuthorsDatasetStats;
  warnings: AuthorsDatasetWarning[];
  authors: AuthorRecord[];
  citations: CitationRecord[];
}
