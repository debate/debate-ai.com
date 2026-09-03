/**
 * Shared legacy debate-style vocabulary.
 *
 * Two legacy lineages predate modern Verbatim styling and both turn up in older
 * debate files:
 *   - the classic non-Verbatim template (Tags / Cards / Cites / Block Headings /
 *     Nothing paragraph styles; Author-Date / Debate Underline / Debate
 *     Highlighted character styles), and
 *   - earlier Verbatim distributions (Style Bold Underline, Style Style Bold +
 *     12 pt, …).
 *
 * This module is the single source of truth for classifying those styles, used
 * by BOTH the .docx style cleaner (`style-clean/legacy-remap.ts`, which rewrites
 * the styleIds) and the importer (`import/importer.ts`, which maps them to
 * schema nodes/marks). Keeping it in one place stops the two from drifting
 * into each covering only half the vocabulary.
 *
 * A style is matched by UI name (case-insensitive) or by styleId.
 */

/** Semantic role of a legacy debate style. */
export type LegacyRole =
  | 'tag' // argument tag → Heading 4 / tag node
  | 'heading' // organizational header → a heading level chosen per document
  | 'cite' // citation paragraph → Normal (its cite is carried on the runs)
  | 'body' // card / body text → Normal
  | 'char-cite' // cite character style (bold author/date) → Style13ptBold / cite_mark
  | 'char-underline'; // read-underline character style → StyleUnderline / underline_mark

/** Legacy style UI names (lowercased) → role. */
const BY_NAME: Record<string, LegacyRole> = {
  // Tags → always the tag level.
  tags: 'tag',
  tag: 'tag',
  'debate tag': 'tag',
  'heading 4': 'tag',
  // Organizational headings → a level chosen per document (see buildLegacyHeadingMap).
  'block headings': 'heading',
  'block heading': 'heading',
  'block title': 'heading',
  'hidden block header': 'heading',
  'heading 1': 'heading',
  'heading 2': 'heading',
  'heading 3': 'heading',
  // Citation paragraph → Normal (the cite is the char-cite on its runs).
  cites: 'cite',
  cite: 'cite',
  'debate cite main': 'cite',
  'debate secondary cite': 'cite',
  normalcite: 'cite',
  // Body text → Normal.
  cards: 'body',
  card: 'body',
  'card text': 'body',
  'card (indented)': 'body',
  nothing: 'body',
  'normal text': 'body',
  'evidence text': 'body',
  // Character styles — classic template.
  'author-date': 'char-cite',
  'debate underline': 'char-underline',
  'debate highlighted': 'char-underline',
  underline: 'char-underline',
  'dotted underline': 'char-underline',
  // Character styles — earlier Verbatim distributions.
  'style bold underline': 'char-underline',
  'style style bold + 12 pt': 'char-cite',
};

/** Legacy styleIds → role. Covers the same styles for callers that only have
 *  the styleId (e.g. the importer when styles.xml is absent) and the earlier-
 *  Verbatim character ids whose name may already be normalized away. */
const BY_ID: Record<string, LegacyRole> = {
  Tags: 'tag',
  BlockHeadings: 'heading',
  BlockTitle: 'heading',
  Cites: 'cite',
  Cards: 'body',
  Nothing: 'body',
  'Author-Date': 'char-cite',
  DebateUnderline: 'char-underline',
  DebateHighlighted: 'char-underline',
  DottedUnderline: 'char-underline',
  StyleBoldUnderline: 'char-underline',
  StyleStyleBold12pt: 'char-cite',
};

/** Names also used by modern Verbatim (Word's built-in headings). Their
 *  presence does NOT on its own mark a document as legacy — the gate requires
 *  an unambiguous marker — but once tripped they are classified with the rest. */
const AMBIGUOUS_NAMES = new Set(['heading 1', 'heading 2', 'heading 3', 'heading 4']);

export interface LegacyLookup {
  name?: string | null;
  id?: string | null;
}

/** The role of a legacy style, or undefined if it isn't one. */
export function legacyRole(s: LegacyLookup): LegacyRole | undefined {
  if (s.name != null) {
    const r = BY_NAME[s.name.toLowerCase()];
    if (r) return r;
  }
  if (s.id != null) {
    const r = BY_ID[s.id];
    if (r) return r;
  }
  return undefined;
}

/** Whether a style is an *unambiguously* legacy marker — a legacy style whose
 *  name isn't one modern Verbatim also uses. A document is treated as legacy
 *  only when it USES one of these, so files that merely share Word's heading
 *  names (or that carry but don't use legacy defs) are left alone. */
export function isUnambiguousLegacy(s: LegacyLookup): boolean {
  if (legacyRole(s) === undefined) return false;
  return !(s.name != null && AMBIGUOUS_NAMES.has(s.name.toLowerCase()));
}

/** Build the legacy-heading outline-level → Verbatim heading level (1–5)
 *  function for a single document.
 *   - mixed mode (the doc already has the Verbatim styles): trust each
 *     heading's own outline level (0→1 … 3→4), so real Verbatim headings map to
 *     themselves.
 *   - pure mode (pre-Verbatim): infer depth — the deepest heading level above
 *     tags → 3 (Block), growing up to 2 (Hat) and 1 (Pocket).
 *  Tags are handled separately (always level 4) by callers. */
export function buildLegacyHeadingMap(
  levels: Iterable<number>,
  mixedMode: boolean,
): (level: number) => number {
  if (mixedMode) {
    return (level) => Math.min(Math.max(level + 1, 1), 5);
  }
  const sorted = [...new Set(levels)].sort((a, b) => b - a); // deepest (largest outline) first
  const ranked = [3, 2, 1];
  const map = new Map<number, number>();
  sorted.forEach((level, i) => map.set(level, ranked[Math.min(i, ranked.length - 1)]!));
  return (level) => map.get(level) ?? 1;
}
