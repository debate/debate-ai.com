/**
 * Custom acronym patterns — user-defined letter selections for the
 * acronym commands (Alt-F10 emphasize / Alt-F11 highlight /
 * underlineAcronym).
 *
 * Each entry maps a phrase to the character offsets the user picked
 * in the settings letter-picker (Settings → Editing → Acronym
 * marking). When an acronym command's whole-word-expanded selection
 * matches a phrase, those exact characters are marked instead of the
 * default first-letter-of-each-word — so "weapons of mass
 * destruction" can read as "WMD" rather than "womd". Inspired by the
 * customization flow in shreerammodi/debate-scripts for Verbatim,
 * reimplemented from scratch with click-picked offsets instead of a
 * pattern DSL.
 */

export interface AcronymPattern {
  /** The phrase as the user typed it (offsets index into this). */
  phrase: string;
  /** Sorted, deduped character offsets to mark. Never whitespace. */
  chars: number[];
}

/**
 * The table entry whose phrase matches `text`, or null. Matching is
 * case-insensitive but otherwise exact — spacing and interior
 * punctuation must agree, which keeps the stored offsets valid on the
 * matched text (equal strings, equal indices). `text` should be the
 * whole-word-expanded selection text, so it never carries leading or
 * trailing punctuation. Entries with no picked letters are inert.
 */
export function matchAcronymPattern(
  text: string,
  patterns: readonly AcronymPattern[],
): AcronymPattern | null {
  const needle = text.toLowerCase();
  for (const p of patterns) {
    if (p.chars.length === 0) continue;
    if (p.phrase.toLowerCase() === needle) return p;
  }
  return null;
}

/** Sanitize one raw entry from storage: string phrase, integer
 *  offsets in range and not pointing at whitespace; sorted + deduped.
 *  Returns null for entries too malformed to keep. */
export function sanitizeAcronymPattern(raw: unknown): AcronymPattern | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const phrase = (raw as { phrase?: unknown }).phrase;
  const chars = (raw as { chars?: unknown }).chars;
  if (typeof phrase !== 'string') return null;
  if (!Array.isArray(chars)) return null;
  const clean = [
    ...new Set(
      chars
        .map((c) => (typeof c === 'number' ? Math.round(c) : NaN))
        .filter(
          (c) =>
            Number.isInteger(c) &&
            c >= 0 &&
            c < phrase.length &&
            !/\s/.test(phrase[c] ?? ' '),
        ),
    ),
  ].sort((a, b) => a - b);
  return { phrase, chars: clean };
}
