/**
 * Auto-numbering — the positional compute pass (NUMBERING_PLAN.md §2).
 *
 * Numbering is DISPLAY-ONLY: no number glyph is ever stored, only the authorial
 * skeleton (per-card `numRole` + `numRestart`, per-block `numRestart`). This
 * module derives the rendered numbers from that skeleton positionally — the one
 * source of truth both the on-screen render and (eventually) the `.docx`
 * `numId`/`ilvl` emit read from.
 *
 * Counting semantics (§2), two levels only:
 *   - NUMBER (role 'number'): counts `number` cards. CONTINUES across `none` and
 *     `sub` cards — a skip is a gap, it neither consumes a number nor breaks the
 *     run. Resets to 1 at any `restart` unit.
 *   - SUB (role 'sub'): subordinate to the number. Resets each time a `number`
 *     card advances the count (and at any `restart`), but is TRANSPARENT to
 *     skips — a `none` card never resets it. Renders as letters (a, b, c…).
 *   The only resets: a new NUMBER (resets sub) and a `restart` flag (resets
 *     both). Nothing else — a skip changes no counter.
 *
 * Scope boundaries reset both counters: a `block` (unless it's flagged to
 * CONTINUE, i.e. numRestart === false), and every higher heading (`pocket` /
 * `hat`, which always start a fresh scope). A card flagged `numRestart` restarts
 * the count at itself (before it is counted).
 *
 * Transclusion (§7): both variants flow through the host count. A linked copy
 * (`transclusion_ref`) AND a live view (`self_ref`) both hold real child cards
 * (the view's are the mirrored source, kept in sync by the content plugin),
 * counted in document order by their real positions — the window is transparent
 * to the host counter, never an opaque sub-scope, and its cards are decorated
 * like any other content.
 */

import { type Fragment, type Node as PMNode } from 'prosemirror-model';

export type NumRole = 'none' | 'number' | 'sub';

export interface NumberLabel {
  /** Which counter produced this. */
  kind: 'number' | 'sub';
  /** 1-based ordinal within the current run. */
  value: number;
  /** Rendered glyph: `String(value)` for a number, letters for a sub. */
  text: string;
}

/** Lowercase bijective base-26: 1→a, 26→z, 27→aa, 28→ab … */
export function toLetters(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(97 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s || 'a';
}

/** The card unit's stored role, defaulting to 'none' for anything unexpected. */
export function numRoleOf(node: PMNode): NumRole {
  const r = node.attrs['numRole'];
  return r === 'number' || r === 'sub' ? r : 'none';
}

export interface Numbering {
  /** Numbered card/analytic_unit → its label, keyed by ABSOLUTE document
   *  position (so a card inside a linked copy is keyed by its real position).
   *  Cards with role 'none' are absent. */
  cards: Map<number, NumberLabel>;
}

/**
 * Compute all numbering for a doc in one positional pass. Counters thread through
 * linked copies (real nested cards) AND live-view projections (resolved), so a
 * card after a window continues the count correctly and a window shows numbers
 * derived from its position here.
 */
export function computeNumbering(doc: PMNode): Numbering {
  const cards = new Map<number, NumberLabel>();
  let numCount = 0; // last NUMBER assigned in the current run
  let subCount = 0; // last SUB assigned under the current number

  const resetScope = (): void => {
    numCount = 0;
    subCount = 0;
  };

  /** Advance the counters for one card and return its label (or null for a skip). */
  const applyCard = (node: PMNode): NumberLabel | null => {
    if (node.attrs['numRestart'] === true) resetScope(); // restart resets both
    const role = numRoleOf(node);
    if (role === 'number') {
      numCount += 1;
      subCount = 0; // a new number resets its subs
      return { kind: 'number', value: numCount, text: String(numCount) };
    }
    if (role === 'sub') {
      subCount += 1;
      return { kind: 'sub', value: subCount, text: toLetters(subCount) };
    }
    return null; // 'none': a transparent skip — no counter touched
  };

  /** Walk a fragment in document order. `onCard` records each card's label; real
   *  fragments (the doc, a copy's content) pass absolute positions, projected
   *  fragments pass -1 (position-less). */
  const walk = (frag: Fragment, basePos: number, onCard: (label: NumberLabel | null, pos: number) => void): void => {
    frag.forEach((node, offset) => {
      const pos = basePos < 0 ? -1 : basePos + offset;
      switch (node.type.name) {
        case 'pocket':
        case 'hat':
          resetScope(); // a higher heading always starts a fresh scope
          return;
        case 'block':
          // Restart by default; a "continue" block carries the running count.
          if (node.attrs['numRestart'] !== false) resetScope();
          return;
        case 'card':
        case 'analytic_unit':
          onCard(applyCard(node), pos);
          return;
        case 'transclusion_ref':
        case 'self_ref':
          // Linked copy / live view: descend into its REAL child cards and number
          // them host-positionally (absolute positions), exactly like ordinary
          // content. (A live view's children are the mirrored source, kept in sync
          // by the content plugin.)
          walk(node.content, pos < 0 ? -1 : pos + 1, onCard);
          return;
        default:
          return;
      }
    });
  };

  walk(doc.content, 0, (label, pos) => {
    if (label && pos >= 0) cards.set(pos, label);
  });

  return { cards };
}
