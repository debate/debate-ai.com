/**
 * Word-break iterator — Microsoft Word-compatible.
 *
 * Single source of truth for "what is a word", "what is a unit",
 * and "where are unit boundaries" inside a string of text.
 *
 * This is Layer 1 of the editor's word-selection model; this header
 * is the model's canonical definition. (Layer 2 = caret and mouse
 * selection, `word-selection-keymap.ts` / `word-selection-plugin.ts`;
 * Layer 3 = formatting-time trailing-space trimming,
 * `trimRangesForFormatting` in `ribbon-commands.ts`.) The model has
 * three classes of code-point — word-character, space, tab,
 * punctuation — plus four base units:
 *
 *   - Word: maximal run of word-characters.
 *   - Punctuation: maximal run of punctuation chars (any mix —
 *     `---` is one unit, `://` is one unit).
 *   - Space: maximal run of space chars.
 *   - Tab: exactly one tab. Tabs never group, not even with
 *     adjacent tabs.
 *
 * Word-characters: letters, digits, `'` U+0027, `'` U+2019. Notably
 * `'` U+2018 (left/opening single quote) is punctuation. Also
 * notable: `.`, `,`, `:`, `_`, `-`, `—`, `–`, `…`
 * are all punctuation and break a word, so `1,234` is three units
 * and `H2O` is one (letter↔digit transition doesn't break).
 *
 * Trailing-space absorption: querying a word OR punctuation unit
 * extends the unit to include any immediately-following space
 * unit (NOT a tab). Asymmetric — querying a space unit directly
 * never reaches backward.
 *
 * Layer 3 (formatting commands) skip the trailing space — see
 * `trimTrailingSpace`.
 *
 * Why a hand-rolled iterator instead of `Intl.Segmenter('word')`
 * or the browser's `\b`: those follow UAX #29's join classes
 * (e.g. `.`/`,`/`_` join across digits), which Word explicitly
 * does NOT. The spec lists this as the headline result — Word
 * uses a flatter classification, and the iterator is fully
 * predictive once you have the class table.
 */

export type CharClass = 'word' | 'space' | 'tab' | 'punct';

const TAB_CODE = 0x0009;
const APOSTROPHE_CODE = 0x0027;
const RIGHT_SINGLE_QUOTE_CODE = 0x2019;

/** Classify one code-point. Two-char code points (surrogate
 *  pairs) fall through whichever class their first code unit
 *  suggests — astral letters classify as 'word' via the
 *  Unicode-letter regex, astral symbols as 'punct'. Good enough
 *  for selection purposes (astral content always breaks anyway). */
export function classifyChar(ch: string): CharClass {
  if (ch.length === 0) return 'punct';
  const c = ch.charCodeAt(0);
  if (c === TAB_CODE) return 'tab';
  if (c === APOSTROPHE_CODE || c === RIGHT_SINGLE_QUOTE_CODE) return 'word';
  // \p{L} = letter, \p{N} = number (digits + other numerics).
  if (/[\p{L}\p{N}]/u.test(ch)) return 'word';
  // \s includes tab; we already classified tab above. Treat any
  // other whitespace (regular space, no-break space, en/em spaces,
  // etc.) as a space.
  if (/\s/.test(ch)) return 'space';
  return 'punct';
}

/** True iff `ch` is a word-character per the spec. Thin wrapper
 *  over `classifyChar` for the common test. */
export function isWordChar(ch: string): boolean {
  return classifyChar(ch) === 'word';
}

/** Fold Word's "smart" / curly quotes to their straight ASCII equivalents so
 *  text matching (find, repair-paragraph) treats a query typed with straight
 *  `'` / `"` as equal to the curly `‘ ’ “ ”` Word produces, and vice versa.
 *  Every replacement is a single BMP char → a single ASCII char, so the result
 *  is the SAME length as the input — callers can fold both haystack and needle
 *  without shifting the character offsets they map back to doc positions. */
export function foldQuotes(s: string): string {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"');
}

/**
 * Normalize text for fuzzy matching, returning the normalized string AND a
 * `map` from normalized-index → original-index (with a final entry equal to the
 * original length), so callers can translate a match's start/end back to the
 * real character offsets they map to doc positions.
 *
 * Folds, in order:
 *   - curly quotes → straight (via {@link foldQuotes});
 *   - every Unicode dash (the `\p{Dash}` property: hyphen, non-breaking hyphen,
 *     en/em dash, horizontal bar, minus sign, two/three-em dash, fullwidth
 *     hyphen, …) → ASCII `-`. All are single BMP chars, so this stays
 *     length-preserving;
 *   - an ASCII `...` and the ellipsis char `…` both → a single canonical `…`.
 *
 * The quote/dash folds are length-preserving (one char → one char), so every
 * character maps to itself there. The ellipsis collapse is the ONLY
 * length-changing step (`...` is three chars, `…` is one) — which is exactly why
 * the index map exists: without it, a `...` earlier in the haystack would shift
 * every later match offset.
 */
export function normalizeForMatch(s: string): { text: string; map: number[] } {
  // Length-preserving folds first, so indices into `folded` equal indices into
  // `s` and the map can be built against `folded` directly.
  const folded = foldQuotes(s).replace(/\p{Dash}/gu, '-');
  let text = '';
  const map: number[] = [];
  let i = 0;
  while (i < folded.length) {
    if (folded[i] === '.' && folded[i + 1] === '.' && folded[i + 2] === '.') {
      map.push(i);
      text += '…';
      i += 3;
    } else {
      map.push(i);
      text += folded[i]!;
      i += 1;
    }
  }
  map.push(folded.length);
  return { text, map };
}

// ─── Reference implementations (no live callers) ───────────────────
// The four unit-boundary functions below plus `trimTrailingSpace` are
// the reference implementations of the model's Layer 1 and Layer 3
// operations, kept so the model has runnable, testable definitions
// beyond this header's prose. The editor's live code paths
// (word-selection keymap/plugin, find/replace, ribbon) reimplement
// their boundary walks directly on `classifyChar`/`isWordChar` and do
// NOT import these. Kept deliberately — if you wire one into product
// code, delete this banner.

/** The base unit (without trailing-space absorption) containing
 *  the character at index `idx` in `text`. Returns `{ from, to }`
 *  with `to` exclusive. `idx` must satisfy `0 <= idx < text.length`;
 *  callers should guard.
 *
 *  - Word / punctuation / space units are maximal runs of the
 *    same class.
 *  - Tab units are always single-character (tabs never group).
 *
 *  Use `queryUnitAtIndex` instead when you want the absorbed-
 *  trailing-space form (Word's double-click semantic). */
export function bareUnitAtIndex(
  text: string,
  idx: number,
): { from: number; to: number } {
  const cls = classifyChar(text[idx]!);
  if (cls === 'tab') return { from: idx, to: idx + 1 };
  let lo = idx;
  let hi = idx;
  while (lo > 0 && classifyChar(text[lo - 1]!) === cls) lo--;
  while (hi + 1 < text.length && classifyChar(text[hi + 1]!) === cls) hi++;
  return { from: lo, to: hi + 1 };
}

/** The Layer 1 "query unit" — like `bareUnitAtIndex`, but a word
 *  or punctuation unit is extended to include any immediately-
 *  following space unit (matching Word's double-click result).
 *  Tab is never absorbed. Asymmetric: a space unit queried on its
 *  own does NOT reach backward. */
export function queryUnitAtIndex(
  text: string,
  idx: number,
): { from: number; to: number } {
  const u = bareUnitAtIndex(text, idx);
  const cls = classifyChar(text[u.from]!);
  if (cls !== 'word' && cls !== 'punct') return u;
  let end = u.to;
  while (end < text.length && classifyChar(text[end]!) === 'space') end++;
  return { from: u.from, to: end };
}

/** Find the start of the next unit boundary AT OR AFTER `pos` —
 *  the spec's Ctrl+Right destination (`pos` is the caret's current
 *  index; the destination is the start of the next unit). The live
 *  Ctrl+Right implementation walks `classifyChar` directly rather
 *  than calling this. Returns `text.length` when no further
 *  boundary exists. */
export function nextUnitBoundary(text: string, pos: number): number {
  const n = text.length;
  if (pos >= n) return n;
  let i = pos;
  // Skip the current unit's remaining characters.
  const startCls = classifyChar(text[i]!);
  if (startCls === 'tab') return i + 1;
  while (i < n && classifyChar(text[i]!) === startCls) i++;
  return i;
}

/** Find the start of the unit at OR BEFORE `pos`, going backward —
 *  the spec's Ctrl+Left destination: the leftmost index of the unit
 *  containing the character to the left of the caret. The live
 *  Ctrl+Left implementation walks `classifyChar` directly rather
 *  than calling this. Returns 0 when the caret is at the very
 *  start. */
export function prevUnitBoundary(text: string, pos: number): number {
  if (pos <= 0) return 0;
  // Look at the char to the left of the caret.
  const i = pos - 1;
  const cls = classifyChar(text[i]!);
  if (cls === 'tab') return i;
  let lo = i;
  while (lo > 0 && classifyChar(text[lo - 1]!) === cls) lo--;
  return lo;
}

/** Layer 3 trim: strip ONE trailing space character from the
 *  right edge of `[from, to)` in `text`. If the rightmost
 *  character isn't a space (or if the range is empty / inverted),
 *  returns the input range unchanged.
 *
 *  The spec is deliberate about "one" — `word ` becomes `word`,
 *  but `word word ` keeps its internal spaces formatted. The
 *  single-character trim falls out naturally for multi-unit
 *  selections since only the rightmost char is examined. */
export function trimTrailingSpace(
  text: string,
  from: number,
  to: number,
): { from: number; to: number } {
  if (from >= to) return { from, to };
  if (to - 1 < 0 || to - 1 >= text.length) return { from, to };
  if (classifyChar(text[to - 1]!) === 'space') return { from, to: to - 1 };
  return { from, to };
}
