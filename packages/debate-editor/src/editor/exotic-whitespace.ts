/**
 * Exotic-whitespace artifacts of PDF/OCR text extraction, and the shared
 * folding rules for the commands that clean them up (F2 plain paste,
 * Condense, Repair OCR/PDF text). PDF extractors emit Unicode spacing
 * characters where the page had ordinary word gaps — U+2007 FIGURE SPACE
 * is the field case (line-break class GL, NON-breaking): a paragraph
 * whose words are joined by it has no legal wrap points, so the browser
 * wraps at stray intra-word spaces or emergency-breaks mid-word, which
 * reads as fake line breaks that no backspace can remove.
 *
 * Deliberately NOT applied globally (rich paste, file load, serialize):
 * these characters are legal document content, and existing files must
 * never mutate silently. Only the explicit cleanup commands fold them.
 *
 * Three disjoint buckets:
 *  - FOLD → ' ': the Unicode space separators (category Zs) other than
 *    U+0020 itself. By definition none of them can encode a line or
 *    paragraph break, so folding cannot lose structure.
 *  - BREAKS: the in-text break characters (VT, FF, NEL, LINE/PARAGRAPH
 *    SEPARATOR). These DO carry break semantics — paste routes them to
 *    its newline handling (they become paragraph splits); the in-place
 *    cleanups fold them to a space, matching how they treat '\n'.
 *  - STRIP: soft hyphen and the zero-width characters. A space here
 *    would be visibly wrong mid-word, so they are dropped outright.
 */
import type { Node as PMNode } from 'prosemirror-model';

/** Category Zs minus U+0020 — every Unicode space separator. Includes
 *  the no-break trio (U+00A0, U+2007, U+202F) that causes the fake-
 *  line-break rendering, plus the breaking-but-odd widths (thin, hair,
 *  en, em, …) folded for consistency. */
export function isFoldableSpace(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (
    c === 0x00a0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000
  );
}

/** In-text break characters: VT, FF, NEL, LINE SEPARATOR, PARAGRAPH
 *  SEPARATOR. (CR/LF are not listed — ProseMirror text nodes can't
 *  hold them, and the paste path splits on them already.) */
export function isUnicodeBreak(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c === 0x000b || c === 0x000c || c === 0x0085 || c === 0x2028 || c === 0x2029;
}

/** Soft hyphen + zero-width characters: dropped, never folded — a
 *  space in their place would split the word they sit inside. */
export function isStrippableInvisible(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c === 0x00ad || c === 0x200b || c === 0x200c || c === 0x200d || c === 0xfeff;
}

/** String-form equivalents for the replace-based call sites. Escaped,
 *  never literal — invisible characters in source can't be reviewed.
 *  Kept in lockstep with the predicates above (pinned by tests). */
export const FOLDABLE_SPACES_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
export const UNICODE_BREAKS_RE = /[\u000B\u000C\u0085\u2028\u2029]/g;
export const STRIPPABLE_INVISIBLES_RE = /[\u00AD\u200B\u200C\u200D\uFEFF]/g;

/** One replacement range in document positions — the same shape as
 *  repair-text's `LocatedFix`, so the collected fixes feed straight
 *  into `buildRepairTransaction`. */
export interface WhitespaceFix {
  from: number;
  to: number;
  replace: string;
}

/**
 * Collect the in-place cleanup edits for every text node intersecting
 * `[from, to)`: foldable spaces and break characters → ' ', strippable
 * invisibles → ''. Adjacent per-character edits merge into runs, so a
 * span of consecutive artifacts costs one transaction step. Returns
 * non-overlapping fixes in ascending document order; empty when the
 * range is already clean. Mirrored content (`self_ref` /
 * `transclusion_ref`) is skipped — it is derived, not source.
 */
export function collectExoticWhitespaceFixes(
  doc: PMNode,
  from: number,
  to: number,
): WhitespaceFix[] {
  const fixes: WhitespaceFix[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'self_ref' || node.type.name === 'transclusion_ref') return false;
    if (!node.isText || !node.text) return true;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    for (let docPos = start; docPos < end; docPos++) {
      const ch = node.text[docPos - pos]!;
      let replace: string | null = null;
      if (isFoldableSpace(ch) || isUnicodeBreak(ch)) replace = ' ';
      else if (isStrippableInvisible(ch)) replace = '';
      if (replace === null) continue;
      const prev = fixes[fixes.length - 1];
      if (prev && prev.to === docPos) {
        prev.to = docPos + 1;
        prev.replace += replace;
      } else {
        fixes.push({ from: docPos, to: docPos + 1, replace });
      }
    }
    return true;
  });
  return fixes;
}
