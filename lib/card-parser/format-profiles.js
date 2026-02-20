/**
 * @fileoverview Format profiles for parsing debate cards from HTML.
 * Each profile defines parsing behavior for different document formats.
 * @module card-parser/format-profiles
 */

/**
 * @typedef {Object} FormatProfile
 * @property {string[]} headingTags - HTML tags to treat as headings
 * @property {string[]} cardStartHeadings - Heading tags that can start a new card
 * @property {number} minBlankLinesForBoundary - Minimum blank lines to create card boundary
 * @property {boolean} trustParagraphTags - Whether to trust paragraph tags for structure
 * @property {RegExp[]} summaryPatterns - Patterns that indicate card summary lines
 */

/**
 * Predefined format profiles for different document types.
 * @type {Object.<string, FormatProfile>}
 */
export const FORMAT_PROFILES = {
  /**
   * Standard format for well-structured debate documents.
   * Uses h4 tags for card starts and trusts paragraph structure.
   */
  standard: {
    headingTags: ["h1", "h2", "h3", "h4"],
    cardStartHeadings: ["h4"],
    minBlankLinesForBoundary: 1,
    trustParagraphTags: true,
    summaryPatterns: [
      /^Aff\s*[-–]/i,
      /^Neg\s*[-–]/i,
      /^Impact:/i,
      /^Analysis:/i,
      /^Link:/i,
      /^Alt:/i,
      /^Framework:/i,
      /^Uniqueness:/i,
      /^Solvency:/i,
      /^Card:/i,
      /^\d+\.\s*/,
      /^[A-Z][a-z]+\s+\d{2,4}/,
    ],
  },

  /**
   * Flexible format for documents with varied heading structures.
   * Accepts h3-h5 as card starts and includes more summary patterns.
   */
  flexible: {
    headingTags: ["h1", "h2", "h3", "h4", "h5", "h6"],
    cardStartHeadings: ["h3", "h4", "h5"],
    minBlankLinesForBoundary: 1,
    trustParagraphTags: true,
    summaryPatterns: [
      /^Aff\s*[-–]/i,
      /^Neg\s*[-–]/i,
      /^Pro\s*[-–]/i,
      /^Con\s*[-–]/i,
      /^Impact[s]?:/i,
      /^Analysis:/i,
      /^Link[s]?:/i,
      /^Alt[ernative]*[s]?:/i,
      /^Framework:/i,
      /^Uniqueness:/i,
      /^Solvency:/i,
      /^Card[s]?:/i,
      /^Claim[s]?:/i,
      /^Warrant[s]?:/i,
      /^Evidence:/i,
      /^Contention[s]?:/i,
      /^Argument[s]?:/i,
      /^\d+[.):]\s+/,
      /^[A-Z]\.\s+/,
      /^[IVX]+\.\s+/,
      /^[A-Z][a-z]+\s+\d{2,4}[,:\s]/,
      /^[A-Z][a-z]+\s+'\d{2}[,:\s]/,
      /^[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+\d{2,4}/,
      /^[A-Z][A-Z\s]+\d{2,4}/,
      /^[A-Z][a-z]+\s+et\s+al\.?\s+\d{2,4}/,
      /^['""][^'"]{10,}['""]/,
      /^['""][A-Z]/,
      /^\*\*[^*]+\*\*/,
      /^__[^_]+__/,
      /^#\s*[A-Z]/,
      /^\[[^\]]+\]/,
      /^<[A-Z][^>]+>/,
    ],
  },

  /**
   * Ultra-flexible format for poorly structured documents.
   * Treats paragraphs as potential card starters and requires no blank lines.
   */
  ultraFlexible: {
    headingTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p"],
    cardStartHeadings: ["h3", "h4", "h5", "h6", "p"],
    minBlankLinesForBoundary: 0,
    trustParagraphTags: false,
    summaryPatterns: [
      /^Aff\s*[-–:]/i,
      /^Neg\s*[-–:]/i,
      /^Pro\s*[-–:]/i,
      /^Con\s*[-–:]/i,
      /^Impact[s]?:/i,
      /^Analysis:/i,
      /^Link[s]?:/i,
      /^Alt[ernative]*[s]?:/i,
      /^Framework:/i,
      /^Uniqueness:/i,
      /^Solvency:/i,
      /^Card[s]?:/i,
      /^Claim[s]?:/i,
      /^Warrant[s]?:/i,
      /^Evidence:/i,
      /^Contention[s]?:/i,
      /^Argument[s]?:/i,
      /^\d+[.):]\s+/,
      /^[A-Z]\.\s+/,
      /^[IVX]+\.\s+/,
      /^[A-Z][a-z]+\s+\d{2,4}[,:\s]/,
      /^[A-Z][a-z]+\s+'\d{2}[,:\s]/,
      /^[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+\d{2,4}/,
      /^[A-Z][A-Z\s]+\d{2,4}/,
      /^[A-Z][a-z]+\s+et\s+al\.?\s+\d{2,4}/,
      /^['""][^'"]{10,}['""]/,
      /^['""][A-Z]/,
      /^\*\*[^*]+\*\*/,
      /^__[^_]+__/,
      /^#\s*[A-Z]/,
      /^\[[^\]]+\]/,
      /^<[A-Z][^>]+>/,
    ],
  },

  /**
   * Legacy Word format for older Microsoft Word documents.
   * Uses h4 and p tags for cards, requires 2 blank lines for boundaries.
   */
  legacyWord: {
    headingTags: ["h1", "h2", "h3", "h4", "p"],
    cardStartHeadings: ["h4", "p"],
    minBlankLinesForBoundary: 2,
    trustParagraphTags: false,
    summaryPatterns: [/^Aff\s*[-–]/i, /^Neg\s*[-–]/i, /^Impact:/i, /^Analysis:/i, /^Card:/i],
  },

  /**
   * Clean HTML format for well-formatted HTML documents.
   * Minimal summary patterns, relies on proper heading structure.
   */
  cleanHtml: {
    headingTags: ["h1", "h2", "h3", "h4"],
    cardStartHeadings: ["h4"],
    minBlankLinesForBoundary: 1,
    trustParagraphTags: true,
    summaryPatterns: [],
  },

  /**
   * Pasted PDF format for content copied from PDF documents.
   * Handles inconsistent structure typical of PDF conversions.
   */
  pastedPDF: {
    headingTags: ["h1", "h2", "h3", "h4", "p"],
    cardStartHeadings: ["h4", "h3", "p"],
    minBlankLinesForBoundary: 1,
    trustParagraphTags: false,
    summaryPatterns: [/^Aff\s*[-–]/i, /^Neg\s*[-–]/i, /^Impact:/i, /^\d+\./],
  },
}
