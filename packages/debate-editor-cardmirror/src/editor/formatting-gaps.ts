/**
 * The formatting-gap machinery — Verbatim's FixFormattingGaps, widened.
 *
 * Extracted from ribbon-commands.ts so that non-command callers (the
 * smart-paste converters in import/html-paste.ts, which normalize a
 * converted doc BEFORE it is pasted) can use it without importing the
 * command surface — ribbon-commands imports paste-plugin, so that
 * import would be a cycle. ribbon-commands re-exports
 * `fixFormattingGaps` and keeps the auto-bridge (`withGapFix`) side,
 * which consumes `forEachGap` / `isGapChar` / the shared constants
 * from here.
 */

import { type Mark, type MarkType, type Node as PMNode } from 'prosemirror-model';
import { type Command } from 'prosemirror-state';
import { schema } from '../schema/index.js';
import { settings } from './settings.js';

/**
 * Word-to-word gap matcher (Verbatim's FixFormattingGaps, widened): a left
 * bookend (one word char incl. straight/curly quotes) + 1+ gap chars + a
 * lookahead at the right bookend. The lookahead keeps `/g`'s lastIndex from
 * eating a single-char interior word that's the right bookend of one gap and
 * the left bookend of the next.
 *
 * The gap-char class is a deliberate ALLOWLIST driven by the `formattingGapClass`
 * setting: `both` → `. , ; : ? ( ) !` and space; `whitespace` → space only.
 * Dashes (hyphen `-`, em-dash `—`, en-dash `–`) and operators like `=` / `+` are
 * never in it under either mode: they join words (`well-known`, `A—B`, `x=y`), so
 * a dash/operator between two formatted words is a real seam the user chose —
 * never auto-bridged or stripped. Both the auto-bridge (`withGapFix`) and the
 * manual `fixFormattingGaps` read the same class via `makeGapRegex` / `isGapChar`.
 */
const GAP_WORD_CLASS = "A-Za-z0-9'\"‘’“”";
const GAP_CHARS_BOTH = '.,;:?()! ';
const GAP_CHARS_WHITESPACE = ' ';

/** The active gap-char set, per the `formattingGapClass` setting. */
function gapCharSet(): string {
  return settings.get('formattingGapClass') === 'whitespace'
    ? GAP_CHARS_WHITESPACE
    : GAP_CHARS_BOTH;
}
/** A fresh word-to-word gap regex for the active gap class (own `lastIndex`). */
export function makeGapRegex(): RegExp {
  return new RegExp(`[${GAP_WORD_CLASS}][${gapCharSet()}]+(?=[${GAP_WORD_CLASS}])`, 'g');
}
/** Whether `ch` is a single gap char under the active gap class. */
export function isGapChar(ch: string): boolean {
  return ch.length === 1 && gapCharSet().includes(ch);
}

/** Structural textblocks where formatting NEVER bridges across gaps — a tag,
 *  an analytic, the three heading levels, and undertags. Gaps inside these are
 *  left exactly as a command set them, in both the auto and manual paths.
 *  Judged per-textblock, so a selection spanning a structural block and a body
 *  paragraph still bridges within the body paragraph. */
export const STRUCTURAL_NO_BRIDGE = new Set<string>([
  'tag', 'analytic', 'pocket', 'hat', 'block', 'undertag',
]);

/** A gap "bookend" / word character — the class the gap regex uses on both
 *  sides of a gap. A changed range with NONE of these is pure gap content
 *  (whitespace and/or punctuation) the user selected deliberately. */
export const WORD_CHAR_RE = /[A-Za-z0-9'"‘’“”]/;

export interface GapHit {
  gapFrom: number;
  gapTo: number;
  firstNode: PMNode;
  lastNode: PMNode;
  parent: PMNode;
}

/** Walk every word-to-word gap in the textblocks intersecting `[from, to]`,
 *  calling `cb` with the gap's doc range (the chars strictly between the
 *  bookends) and the two bookend text nodes. Shared by `fixFormattingGaps`
 *  (full, all mark types) and the per-apply surgical normalizer. Bridges
 *  never cross paragraph breaks. */
export function forEachGap(
  doc: PMNode,
  from: number,
  to: number,
  cb: (hit: GapHit) => void,
): void {
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    // Structural paragraphs never bridge — per-textblock, so a mixed selection
    // still bridges in its body paragraphs.
    if (STRUCTURAL_NO_BRIDGE.has(node.type.name)) return false;
    const tbFrom = Math.max(from, pos + 1);
    const tbTo = Math.min(to, pos + node.nodeSize - 1);
    if (tbFrom >= tbTo) return false;
    let text = '';
    const charDocPos: number[] = [];
    const charNode: PMNode[] = [];
    let inlineOffset = 0;
    node.forEach((child) => {
      if (child.isText && child.text) {
        const childStart = pos + 1 + inlineOffset;
        const localFrom = Math.max(tbFrom, childStart);
        const localTo = Math.min(tbTo, childStart + child.nodeSize);
        if (localFrom < localTo) {
          const slice = child.text.slice(localFrom - childStart, localTo - childStart);
          for (let i = 0; i < slice.length; i++) {
            charDocPos.push(localFrom + i);
            charNode.push(child);
          }
          text += slice;
        }
      }
      inlineOffset += child.nodeSize;
    });
    const gapRegex = makeGapRegex();
    let m: RegExpExecArray | null;
    while ((m = gapRegex.exec(text)) !== null) {
      const firstBookendIdx = m.index;
      const gapStartIdx = firstBookendIdx + 1;
      const gapEndIdx = firstBookendIdx + m[0].length - 1;
      const secondBookendIdx = firstBookendIdx + m[0].length;
      if (gapStartIdx > gapEndIdx) continue;
      const gapFromPos = charDocPos[gapStartIdx];
      const gapEndPos = charDocPos[gapEndIdx];
      if (gapFromPos == null || gapEndPos == null) continue;
      const firstNode = charNode[firstBookendIdx];
      const lastNode = charNode[secondBookendIdx];
      if (!firstNode || !lastNode) continue;
      cb({ gapFrom: gapFromPos, gapTo: gapEndPos + 1, firstNode, lastNode, parent: node });
    }
    return false;
  });
}

export const STRUCTURAL_TEXTBLOCKS_FOR_UNDERLINE = new Set([
  'tag', 'analytic', 'pocket', 'hat', 'block', 'undertag',
]);

/**
 * Verbatim's `FixFormattingGaps` (extended) — normalize every short
 * word-to-word gap so its marks are the intersection of the two
 * bookends' marks. This both BRIDGES marks the bookends agree on
 * (so word-by-word formatting doesn't leave visual breaks) and
 * CLEANS UP marks the gap is wrongly carrying that aren't shared.
 *
 * Selection-sensitive (non-empty selection → that range; empty →
 * whole doc). Walks each textblock in scope independently — bridges
 * never cross paragraph breaks.
 *
 * The gap regex comes from `makeGapRegex` — left bookend (1 word
 * char, incl. straight/curly quotes so gaps adjacent to quoted runs
 * still bridge) + 1+ gap chars (the setting-driven allowlist; see
 * `formattingGapClass`) + a lookahead at the right bookend. The
 * lookahead is critical: it lets single-char interior words (e.g.,
 * "a", "I") serve as the right bookend of one match and the left
 * bookend of the next without `/g`'s lastIndex eating them.
 *
 * The gap range — the chars strictly between the bookends — is
 * what we modify; the bookends themselves are never touched.
 *
 * **Target mark set** for each gap, computed from the two bookends'
 * marks. Six mark types are touched; everything else (bold, italic,
 * font_color, font_family, link, …) is left alone.
 *
 *   - Named-style (underline_mark / emphasis_mark / cite_mark,
 *     mutually exclusive via schema):
 *       - Same named-style on both → include that mark.
 *       - underline + emphasis (either order) → include underline
 *         (Verbatim's "underline wins on mixed",
 *         `Formatting.bas:1071-1074`).
 *       - Anything else → no named-style mark in the target.
 *   - highlight / shading: both bookends carry the mark → include
 *     with the FIRST bookend's color attr. Else → none.
 *   - font_size (uses the chip's effective-pt resolver — the same
 *     one the chip / increment buttons / shrink use):
 *       - Compute each bookend's effective pt (explicit font_size →
 *         named-style default → parent block default).
 *       - Pick the bookend with the SMALLER effective pt.
 *       - If that bookend has an explicit font_size mark → include
 *         the same mark in the target.
 *       - If that bookend is implicit → no font_size in the target.
 *       - Tie + both explicit → either; tie + at least one implicit
 *         → no font_size (prefer the cleanest gap).
 *
 * For each touched type: if the type IS in the target, `addMark` it
 * over the gap range (idempotent if already there with same attrs;
 * replaces attrs if different); if the type is NOT in the target,
 * `removeMark` it (idempotent if absent). PM tracks zero-step
 * transactions, so gaps whose marks already match the target
 * produce no actual transaction work.
 *
 * No-op (returns false) when every gap in scope already matches its
 * target.
 */
export function fixFormattingGaps(
  effectivePt: (node: PMNode | null, parent: PMNode) => number,
): Command {
  return (state, dispatch) => {
    const sel = state.selection;
    const from = sel.empty ? 0 : sel.from;
    const to = sel.empty ? state.doc.content.size : sel.to;

    const underlineType = schema.marks['underline_mark']!;
    const underlineDirectType = schema.marks['underline_direct']!;
    const emphasisType = schema.marks['emphasis_mark']!;
    const citeType = schema.marks['cite_mark']!;
    const highlightType = schema.marks['highlight']!;
    const shadingType = schema.marks['shading']!;
    const fontSizeType = schema.marks['font_size']!;

    // Shared, setting-driven gap class (see `makeGapRegex` /
    // `formattingGapClass`); bookend/lookahead rationale in the
    // function doc above.
    const gapRegex = makeGapRegex();

    type Add = {
      from: number;
      to: number;
      marksToAdd: Mark[];
      marksToRemove: MarkType[];
    };
    const adds: Add[] = [];

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock) return true;
      // Structural paragraphs never bridge (per-textblock — see STRUCTURAL_NO_BRIDGE).
      if (STRUCTURAL_NO_BRIDGE.has(node.type.name)) return false;
      const tbFrom = Math.max(from, pos + 1);
      const tbTo = Math.min(to, pos + node.nodeSize - 1);
      if (tbFrom >= tbTo) return false;

      // Walk inline children, building per-char (doc-pos, owning-
      // text-node) lookup arrays alongside the text we'll regex.
      let text = '';
      const charDocPos: number[] = [];
      const charNode: PMNode[] = [];
      let inlineOffset = 0;
      node.forEach((child) => {
        if (child.isText && child.text) {
          const childStart = pos + 1 + inlineOffset;
          const localFrom = Math.max(tbFrom, childStart);
          const localTo = Math.min(tbTo, childStart + child.nodeSize);
          if (localFrom < localTo) {
            const slice = child.text.slice(
              localFrom - childStart,
              localTo - childStart,
            );
            for (let i = 0; i < slice.length; i++) {
              charDocPos.push(localFrom + i);
              charNode.push(child);
            }
            text += slice;
          }
        }
        inlineOffset += child.nodeSize;
      });

      gapRegex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = gapRegex.exec(text)) !== null) {
        // Match shape (left-bookend + gap chars consumed; right
        // bookend is the lookahead):
        //   firstBookendIdx  = m.index
        //   gapStartIdx      = m.index + 1   (first gap char)
        //   gapEndIdx        = m.index + m[0].length - 1
        //   secondBookendIdx = m.index + m[0].length   (lookahead)
        const firstBookendIdx = m.index;
        const gapStartIdx = firstBookendIdx + 1;
        const gapEndIdx = firstBookendIdx + m[0].length - 1;
        const secondBookendIdx = firstBookendIdx + m[0].length;
        if (gapStartIdx > gapEndIdx) continue;
        const gapFromPos = charDocPos[gapStartIdx];
        const gapEndPos = charDocPos[gapEndIdx];
        if (gapFromPos == null || gapEndPos == null) continue;
        const firstNode = charNode[firstBookendIdx];
        const lastNode = charNode[secondBookendIdx];
        if (!firstNode || !lastNode) continue;

        // Gap-only doc range: just the chars BETWEEN the bookends,
        // never the bookends themselves. Matches the user's "F9 on
        // the blank space" mental model and avoids the schema's
        // `excludes` rule kicking in on a mixed-bookend bridge
        // (otherwise applying underline_mark across an emphasized
        // last bookend would strip its emphasis).
        const gapFrom = gapFromPos;
        const gapTo = gapEndPos + 1;

        const fm = firstNode.marks;
        const lm = lastNode.marks;
        const fmU =
          fm.some((mk) => mk.type === underlineType || mk.type === underlineDirectType);
        const fmE = fm.some((mk) => mk.type === emphasisType);
        const fmC = fm.some((mk) => mk.type === citeType);
        const lmU =
          lm.some((mk) => mk.type === underlineType || mk.type === underlineDirectType);
        const lmE = lm.some((mk) => mk.type === emphasisType);
        const lmC = lm.some((mk) => mk.type === citeType);
        const fmHl = fm.find((mk) => mk.type === highlightType);
        const lmHl = lm.find((mk) => mk.type === highlightType);
        const fmSh = fm.find((mk) => mk.type === shadingType);
        const lmSh = lm.find((mk) => mk.type === shadingType);
        const fmFs = fm.find((mk) => mk.type === fontSizeType);
        const lmFs = lm.find((mk) => mk.type === fontSizeType);
        const fmEpt = effectivePt(firstNode, node);
        const lmEpt = effectivePt(lastNode, node);

        const marksToAdd: Mark[] = [];
        const marksToRemove: MarkType[] = [];

        // Named-style target: same on both → that mark; mixed u/e →
        // underline; otherwise → none (and strip any stale named-
        // style mark from the gap). The manual command is a stateless
        // normalizer with no selection-edge concept, so it bridges
        // emphasis-on-both with emphasis (keeps contiguous emphasized
        // phrases intact); the per-apply path is the one that fills an
        // emphasized SELECTION's edge gaps with underline.
        let namedStyle: 'underline' | 'emphasis' | 'cite' | null = null;
        if (fmU && lmU) namedStyle = 'underline';
        else if (fmE && lmE) namedStyle = 'emphasis';
        else if (fmC && lmC) namedStyle = 'cite';
        else if ((fmU && lmE) || (fmE && lmU)) namedStyle = 'underline';
        if (namedStyle === 'underline') {
          // Body underline is the named `underline_mark`; structural
          // blocks (tag / analytic / …) use `underline_direct`. The
          // direct mark has no `excludes`, so strip the other underline
          // kind and the other named styles explicitly.
          const structural = STRUCTURAL_TEXTBLOCKS_FOR_UNDERLINE.has(node.type.name);
          marksToAdd.push((structural ? underlineDirectType : underlineType).create());
          marksToRemove.push(
            structural ? underlineType : underlineDirectType,
            emphasisType,
            citeType,
          );
        } else if (namedStyle === 'emphasis') {
          // `excludes` strips underline_mark / cite automatically.
          marksToAdd.push(emphasisType.create());
          marksToRemove.push(underlineDirectType);
        } else if (namedStyle === 'cite') {
          marksToAdd.push(citeType.create());
          marksToRemove.push(underlineDirectType);
        } else {
          marksToRemove.push(underlineType, underlineDirectType, emphasisType, citeType);
        }

        // highlight / shading: bridge when BOTH bookends have it,
        // first bookend's color wins on mismatch. Otherwise strip.
        if (fmHl && lmHl) marksToAdd.push(highlightType.create(fmHl.attrs));
        else marksToRemove.push(highlightType);
        if (fmSh && lmSh) marksToAdd.push(shadingType.create(fmSh.attrs));
        else marksToRemove.push(shadingType);

        // Font size: pick the bookend with the smaller effective
        // pt; that bookend's explicit mark (if any) becomes the
        // target. Ties: prefer the implicit side unless both are
        // explicit (in which case either works, halfPoints are the
        // same).
        let targetFs: Mark | null = null;
        if (fmEpt < lmEpt) {
          if (fmFs) targetFs = fmFs;
        } else if (lmEpt < fmEpt) {
          if (lmFs) targetFs = lmFs;
        } else if (fmFs && lmFs) {
          targetFs = fmFs;
        }
        if (targetFs) {
          marksToAdd.push(fontSizeType.create(targetFs.attrs));
        } else {
          marksToRemove.push(fontSizeType);
        }

        adds.push({ from: gapFrom, to: gapTo, marksToAdd, marksToRemove });
      }
      return false;
    });

    // Always build the tr so the no-op detection is accurate. Every
    // matched gap queues both addMark and removeMark calls; PM's
    // ops are idempotent for marks already-present (addMark) or
    // already-absent (removeMark), so a gap whose marks already
    // match the target produces no actual step. `tr.steps.length`
    // is the truth.
    const tr = state.tr;
    for (const { from: f, to: t, marksToAdd, marksToRemove } of adds) {
      for (const mt of marksToRemove) tr.removeMark(f, t, mt);
      for (const m of marksToAdd) tr.addMark(f, t, m);
    }
    if (tr.steps.length === 0) return false;
    if (!dispatch) return true;
    dispatch(tr);
    return true;
  };
}
