/**
 * Auto-numbering → Word numbering (NUMBERING_PLAN.md §5).
 *
 * Maps the stored skeleton onto native Word numbering so Word/Verbatim compute
 * the actual numbers (nothing numeric is ever written):
 *   - role 'number' → `<w:numPr>` ilvl 0; role 'sub' → ilvl 1; 'none' → no numPr.
 *   - every restart boundary (a restarting card, a default-restart block, a
 *     pocket/hat) starts a fresh `numId`, and each numId is an independent Word
 *     counter — so Word restarts exactly where CardMirror does. A "continue"
 *     block simply keeps the running numId across its (numPr-less) heading.
 * All numIds share one abstractNum, whose two levels render `1.` and `a.`
 * — the CANONICAL glyphs (the app's display defaults), deliberately NOT the
 * exporting user's separator settings: those are display-only (see the
 * `cardNumberingFormat` doc in settings.ts), so the same doc exports
 * identically no matter whose machine writes it — and
 * whose level-1 counter auto-restarts under level 0 (Word's default), matching
 * the app's "sub resets under each number".
 *
 * Self-refs are flattened before export, so only real cards (including a linked
 * copy's, which flatten transparently) reach this pass.
 */

import { type Node as PMNode } from 'prosemirror-model';
import { XML_PROLOG } from '../ooxml/xml.js';

export interface DocxNumbering {
  /** The tag/analytic heading node of each numbered card → its `<w:numPr>`. */
  perHeading: Map<PMNode, { numId: number; ilvl: number }>;
  /** Every numId allocated, in order (each gets a `<w:num>` in numbering.xml). */
  numIds: number[];
}

function roleOf(node: PMNode): 'none' | 'number' | 'sub' {
  const r = node.attrs['numRole'];
  return r === 'number' || r === 'sub' ? r : 'none';
}

/**
 * Assign a `numId`/`ilvl` to each numbered card, allocating a fresh numId lazily
 * at the first numbered card of every restart run. Returns nothing to write when
 * the doc has no numbered cards.
 */
export function assignDocxNumbering(doc: PMNode): DocxNumbering {
  const perHeading = new Map<PMNode, { numId: number; ilvl: number }>();
  const numIds: number[] = [];
  let nextNumId = 1;
  let currentNumId = 0;
  let needNewRun = true; // a restart boundary is pending

  const walk = (node: PMNode): void => {
    node.forEach((child) => {
      const t = child.type.name;
      if (t === 'pocket' || t === 'hat') {
        needNewRun = true;
        return;
      }
      if (t === 'block') {
        if (child.attrs['numRestart'] !== false) needNewRun = true;
        return;
      }
      if (t === 'card' || t === 'analytic_unit') {
        if (child.attrs['numRestart'] === true) needNewRun = true;
        const role = roleOf(child);
        if (role === 'none') return; // a skip: no numPr, no numId consumed
        if (needNewRun) {
          currentNumId = nextNumId++;
          numIds.push(currentNumId);
          needNewRun = false;
        }
        const heading = child.firstChild; // tag / analytic — the numPr lives here
        if (heading) perHeading.set(heading, { numId: currentNumId, ilvl: role === 'number' ? 0 : 1 });
        return;
      }
      if (t === 'transclusion_ref') {
        walk(child); // linked copy: its real cards flatten into the flow
        return;
      }
      // self_ref shouldn't appear (flattened pre-export); anything else is inert.
    });
  };
  walk(doc);
  return { perHeading, numIds };
}

/** The single numPr snippet for a heading paragraph's `<w:pPr>`. */
export function numPrXml(num: { numId: number; ilvl: number }): string {
  return `<w:numPr><w:ilvl w:val="${num.ilvl}"/><w:numId w:val="${num.numId}"/></w:numPr>`;
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * `word/numbering.xml`: one abstractNum (levels `1.` / `a)`) plus a `<w:num>`
 * per allocated numId. Each numId is its own counter → a restart per new numId.
 */
export function buildNumberingXml(numIds: number[]): string {
  const abstractNum =
    '<w:abstractNum w:abstractNumId="0">' +
    '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl>' +
    '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2."/><w:lvlJc w:val="left"/></w:lvl>' +
    '</w:abstractNum>';
  // Each num instance needs an explicit startOverride: Word runs ONE
  // counter per abstractNum across the whole document, so distinct
  // numIds sharing abstractNum 0 CONTINUE each other unless every
  // <w:num> restates its start. Without these, every exported doc
  // rendered as one continuous list in Word (field report 2026-08-17)
  // — invisible to our own round-trip, whose importer derives restarts
  // from numId transitions rather than Word's counter semantics.
  const startOverrides =
    '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' +
    '<w:lvlOverride w:ilvl="1"><w:startOverride w:val="1"/></w:lvlOverride>';
  const nums = numIds
    .map((id) => `<w:num w:numId="${id}"><w:abstractNumId w:val="0"/>${startOverrides}</w:num>`)
    .join('');
  return `${XML_PROLOG}\n<w:numbering xmlns:w="${W_NS}">${abstractNum}${nums}</w:numbering>`;
}
