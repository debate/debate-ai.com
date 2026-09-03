/**
 * Legacy debate-style remapping for the .docx style cleaner.
 *
 * Pre-Verbatim debate files (and files merged from them) style their content
 * with an older vocabulary — Tags / Cards / Cites / Block Headings / Nothing,
 * Author-Date / Debate Underline — that the Verbatim cleaner doesn't recognize.
 * Left alone, the cleaner removes those unknown styles and the content collapses
 * to Normal. This pass reassigns the legacy styles to the canonical Verbatim
 * styles BEFORE the formatting→style conversion runs, so the rest of the cleaner
 * sees a Verbatim-shaped document.
 *
 * The legacy vocabulary itself lives in the shared `../legacy-styles.ts` (used
 * by the importer too); this file is just the cleaner-side application of it.
 *
 * It only acts on documents that actually USE an unambiguously-legacy style — so
 * a modern doc that merely *carries* legacy definitions (e.g. a merged AFF-Space)
 * is untouched — and it matches each paragraph/run by name, so a partially-
 * migrated ("mixed") document keeps its already-Verbatim content and only the
 * legacy parts convert.
 */

import { CANONICAL_STYLES_XML } from '../styles.js';
import {
  buildLegacyHeadingMap,
  isUnambiguousLegacy,
  legacyRole,
  type LegacyRole,
} from '../legacy-styles.js';
import { OoxmlDoc } from './ooxml-doc.js';

export interface RemapOptions {
  /** True when the document already has the Verbatim styles (a "mixed" doc):
   *  trust each legacy heading's outline level directly. False for a pure
   *  pre-Verbatim doc: infer the hierarchy depth adaptively. */
  mixedMode: boolean;
  /** Style names (lowercased) the user protected — never remapped. */
  protectedNamesLower?: Set<string>;
}

interface LegacyInfo {
  role: LegacyRole;
  /** Unambiguously legacy (i.e. trips the "this is a legacy doc" gate). */
  unambiguous: boolean;
  /** The style's effective outline level (basedOn-resolved), or -1 if none. */
  outline: number;
}

/** Reassign legacy debate styles to canonical Verbatim styles, in place.
 *  Returns true if it remapped anything; a no-op (false) unless the document
 *  actually uses an unambiguously-legacy style. */
export function remapLegacyStyles(doc: OoxmlDoc, opts: RemapOptions): boolean {
  const protectedNames = opts.protectedNamesLower ?? new Set<string>();

  // 1. Index DEFINED legacy styles by id. (Cheap O(styles) screen — most modern
  //    docs define none, so we bail before touching content.) Matched by name,
  //    like the rest of the cleaner.
  const legacyById = new Map<string, LegacyInfo>();
  for (const style of doc.styles.all()) {
    const name = style.name;
    const role = legacyRole({ name });
    if (!role) continue;
    if (name !== null && protectedNames.has(name.toLowerCase())) continue;
    const sid = style.styleId;
    if (sid === null) continue;
    legacyById.set(sid, {
      role,
      unambiguous: isUnambiguousLegacy({ name }),
      outline: doc.styles.effectiveStyleFormat(sid).outlineLevel ?? -1,
    });
  }
  if (legacyById.size === 0) return false;

  // 2. Scan usage: the gate is "an unambiguous legacy style is actually USED"
  //    (so a doc that merely defines them is left alone), and collect the
  //    heading-role outline levels present for the per-document heading map.
  let tripped = false;
  const headingLevels = new Set<number>();
  for (const paragraph of doc.paragraphs) {
    const pInfo = legacyById.get(paragraph.style.styleId ?? '');
    if (pInfo) {
      if (pInfo.unambiguous) tripped = true;
      if (pInfo.role === 'heading') headingLevels.add(paragraph.effectiveOutlineLevel() ?? -1);
    }
    for (const run of paragraph.runs) {
      const rInfo = legacyById.get(run.style.styleId ?? '');
      if (rInfo && rInfo.unambiguous) tripped = true;
    }
  }
  if (!tripped) return false;

  // 3. Ensure the canonical targets exist (a mixed doc may lack some headings).
  doc.injectMissingStyles(CANONICAL_STYLES_XML);

  // 4. Heading outline level → canonical style id.
  // Cap at Heading4: the canonical injectable set tops out at Heading4. The
  // shared map can yield 5 (the importer has a Heading5→block rule), but the
  // cleaner has no Heading5 style to assign, so a deeper heading normalizes to
  // the deepest Verbatim level rather than throwing.
  const headingLevelFor = buildLegacyHeadingMap(headingLevels, opts.mixedMode);
  const headingIdFor = (outline: number): string =>
    `Heading${Math.min(headingLevelFor(outline), 4)}`;

  // 5. Apply.
  for (const paragraph of doc.paragraphs) {
    const pInfo = legacyById.get(paragraph.style.styleId ?? '');
    if (pInfo) {
      if (pInfo.role === 'tag') {
        paragraph.style = doc.styles.get('Heading4');
      } else if (pInfo.role === 'heading') {
        paragraph.style = doc.styles.get(headingIdFor(paragraph.effectiveOutlineLevel() ?? -1));
      } else if (pInfo.role === 'cite' || pInfo.role === 'body') {
        paragraph.style = doc.styles.get('Normal');
      }
    }
    for (const run of paragraph.runs) {
      const rInfo = legacyById.get(run.style.styleId ?? '');
      if (!rInfo) continue;
      if (rInfo.role === 'char-cite') run.style = doc.styles.get('Style13ptBold');
      else if (rInfo.role === 'char-underline') run.style = doc.styles.get('StyleUnderline');
    }
  }
  return true;
}
