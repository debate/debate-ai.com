/**
 * Auto-numbering render pass (NUMBERING_PLAN.md §6).
 *
 * Draws the computed numbers as read-only widget decorations at the start of each
 * numbered card's tag, plus subtle restart/continue indicators on the non-default
 * units. Numbers are never stored (see `numbering.ts`): the whole set is recomputed
 * from the skeleton whenever the doc changes. Display is gated on the
 * `showCardNumbering` setting — the skeleton stays in the doc either way.
 *
 * Transclusion (§7): a live view's mirrored cards are real child content, so
 * they're decorated with host-positional glyphs exactly like a linked copy's —
 * the pass descends into both `self_ref` and `transclusion_ref`.
 *
 * Prototype scope: format is fixed (`1.` / `a)`). Full recompute on every
 * docChanged is fine at this size (numbering is inherently non-local).
 */

import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { AddMarkStep, RemoveMarkStep, ReplaceStep, ReplaceAroundStep } from 'prosemirror-transform';
import { computeNumbering, type NumberLabel } from './numbering.js';
import { settings, type NumberingSeparator } from './settings.js';

interface NumberingState {
  decorations: DecorationSet;
  /** Serialized doc-order label sequence from the last build — the fast
   *  path's ground truth: a non-structural edit whose recomputed sequence
   *  matches can keep the existing decorations, merely position-mapped. */
  labelSig: string;
}

export const numberingPluginKey = new PluginKey<NumberingState>('cardNumbering');

/** Transaction meta that forces the numbering set to rebuild even without a doc
 *  change — the settings subscriber fires it when the format/indent options
 *  change (they bake into the decorations, unlike the on/off gate). */
export const NUMBERING_REFRESH = 'pmd-numbering-refresh';

/** Per-user glyph separators (display-only; the .docx carries a canonical form).
 *  Number and substructure each pick their own separator independently. */
const FORMAT_SEP: Record<NumberingSeparator, string> = {
  period: '.',
  paren: ')',
  dash: ' -',
  colon: ':',
  emdash: '—',
  endash: '–',
  doublehyphen: '--',
  triplehyphen: '---',
};
function glyphText(label: NumberLabel): string {
  if (label.kind === 'sub') {
    const core = settings.get('cardNumberingSubCapitalized')
      ? label.text.toUpperCase()
      : label.text;
    return `${core}${FORMAT_SEP[settings.get('cardNumberingSubFormat')]}`;
  }
  return `${label.text}${FORMAT_SEP[settings.get('cardNumberingFormat')]}`;
}

/** The glyph a first-position number / substructure letter renders as under the
 *  current format settings — used by the ribbon's numbering buttons so their
 *  faces mirror the configured style. */
export function numberingSampleGlyph(kind: 'number' | 'sub'): string {
  return kind === 'number'
    ? glyphText({ kind: 'number', value: 1, text: '1' })
    : glyphText({ kind: 'sub', value: 1, text: 'a' });
}

/** "Match heading" color resolution: the single manual font color covering the
 *  heading's ENTIRE text, or null to inherit the heading's block color. Only
 *  text runs count (images/footnote refs have no font color); `000000` is
 *  Word's "Automatic" (renders as inherit) so it never counts as an override;
 *  any uncolored or differently-colored run breaks uniformity — a PARTIAL
 *  recolor deliberately leaves the number on the heading's base color. */
function wholeHeadingFontColor(heading: PMNode | null): string | null {
  if (!heading) return null;
  let color: string | null = null;
  let sawText = false;
  let uniform = true;
  heading.content.forEach((n) => {
    if (!uniform || !n.isText || !n.text) return;
    sawText = true;
    const mark = n.marks.find((m) => m.type.name === 'font_color');
    const hex = mark ? String(mark.attrs['color'] ?? '000000') : null;
    if (!hex || /^0{6}$/.test(hex)) {
      uniform = false;
      return;
    }
    if (color === null) color = hex;
    else if (color.toLowerCase() !== hex.toLowerCase()) uniform = false;
  });
  return sawText && uniform ? color : null;
}

/** The read-only number glyph element (rendered by the widget decorations).
 *  `match` = the "match heading" color mode: the glyph inherits its heading's
 *  color, or takes `colorHex` when one manual font color covers the whole
 *  heading. Off → the numbering-color token via CSS. */
export function createNumberGlyph(
  label: NumberLabel,
  opts?: { match?: boolean; colorHex?: string | null },
): HTMLElement {
  const span = document.createElement('span');
  span.className = 'pmd-card-number';
  if (label.kind === 'sub') {
    span.classList.add('pmd-card-number-sub');
    // Weight is a per-user display option for substructure only —
    // numbers always render bold.
    if (!settings.get('cardNumberingSubBold')) span.classList.add('pmd-card-number-sub-plain');
  }
  if (opts?.match) {
    // The widget sits inside the heading element but OUTSIDE its text runs'
    // font_color spans — `inherit` picks up the block color (tag/analytic
    // color settings, theme, dark mode); the whole-heading manual override
    // has to be applied explicitly.
    span.classList.add('pmd-card-number-match');
    if (opts.colorHex) span.style.color = `#${opts.colorHex}`;
  }
  span.textContent = glyphText(label);
  // Chrome, not content: never editable, never a selection/caret target.
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/** Everything that bakes into the rendered decoration set (or gates it).
 *  Both settings subscribers (single-doc index.ts, multi-pane shell) diff
 *  this to decide when to dispatch NUMBERING_REFRESH. */
export const numberingDisplaySig = (): string =>
  [
    settings.get('showCardNumbering'),
    settings.get('cardNumberingFormat'),
    settings.get('cardNumberingSubFormat'),
    settings.get('cardNumberingSubCapitalized'),
    settings.get('cardNumberingSubBold'),
    settings.get('cardNumberingIndent'),
    settings.get('cardNumberingSubIndent'),
    settings.get('cardNumberingMatchHeadingColor'),
  ].join('|');

const EMPTY_STATE: NumberingState = { decorations: DecorationSet.empty, labelSig: '' };

/** Test probe: counts full decoration rebuilds. The fast path's whole point
 *  is NOT calling build() — the equivalence suite asserts on this counter to
 *  prove which path ran (decoration/DOM identity can't distinguish them:
 *  find() materializes fresh wrappers, and position-free keys make rebuilds
 *  reuse DOM too). */
export const numberingPerfProbe = { builds: 0 };

function build(doc: PMNode): NumberingState {
  // Numbering display OFF: skip the whole computation (perf audit A-02 —
  // the O(numbered cards × top-level children) rebuild used to run on every
  // doc-changing transaction for EVERY doc, display on or off; the props
  // gate only hid the result). Turning the display on reaches every view
  // via NUMBERING_REFRESH: the single-doc settings subscriber nudges the
  // focused view, and the multi-pane shell broadcasts to every pane stack.
  if (!settings.get('showCardNumbering')) return EMPTY_STATE;
  numberingPerfProbe.builds++;
  const { cards } = computeNumbering(doc);
  const labelSig = sigFromCards(cards);
  const decos: Decoration[] = [];

  // Computed number / letter glyphs on host cards, plus optional per-level
  // indent. Number and substructure cards indent per their OWN setting.
  const numberIndent = settings.get('cardNumberingIndent');
  const subIndent = settings.get('cardNumberingSubIndent');
  const matchHeading = settings.get('cardNumberingMatchHeadingColor');
  for (const [cardPos, label] of cards) {
    // card at cardPos → its `tag`/`analytic` heading at +1 → the heading's inline
    // content starts at +2. Sit the number at the very start of that line.
    const at = cardPos + 2;
    if (at > doc.content.size) continue;
    const headingColor = matchHeading
      ? wholeHeadingFontColor(doc.nodeAt(cardPos)?.firstChild ?? null)
      : null;
    decos.push(
      Decoration.widget(at, () => createNumberGlyph(label, { match: matchHeading, colorHex: headingColor }), {
        side: -1,
        // Key includes the RENDERED glyph, not the raw label.text — separator
        // and capitalization bake into the glyph at render time, so a
        // format-only change (which doesn't touch position or label.text)
        // must still bust the key. Same key → ProseMirror reuses the existing
        // DOM node and never re-runs the render fn, leaving the old glyph on
        // screen until an unrelated rebuild (the "doesn't update until I
        // toggle numbering" field bug, 2026-07-11). The color mode/override
        // is part of the render too, so it joins the key.
        //
        // Deliberately NO position component: PM only compares keys between
        // widgets aligned at the same document position, so position adds
        // nothing for disambiguation — but baking it in meant every
        // structural rebuild recreated the DOM of every downstream glyph
        // (new positions → new keys → eq false), even when every glyph read
        // the same. Position-free keys let a rebuild reuse the spans of all
        // unchanged numbers (perf audit A-02 follow-up, 2026-07-13).
        //
        // Sub WEIGHT joins the key for the same reason the glyph does: it
        // bakes into the render (a class) without changing text or position,
        // so a same-key reuse would leave the old weight on screen.
        key: `cnum:${label.kind}:${glyphText(label)}:${matchHeading ? headingColor ?? 'inh' : 'tok'}${label.kind === 'sub' && !settings.get('cardNumberingSubBold') ? ':plain' : ''}`,
        ignoreSelection: true,
      }),
    );
    // Indent by level (display-only): number = 1 step, sub = 2. Each level is
    // gated on its own setting, applied to the tag line or the whole card.
    const indentMode = label.kind === 'sub' ? subIndent : numberIndent;
    if (indentMode !== 'off') {
      const cardNode = doc.nodeAt(cardPos);
      if (cardNode) {
        const step = (label.kind === 'sub' ? 2 : 1) * 1.6;
        const style = `margin-left: ${step}em`;
        if (indentMode === 'card') {
          decos.push(Decoration.node(cardPos, cardPos + cardNode.nodeSize, { style }));
        } else if (cardNode.firstChild) {
          const tagSize = cardNode.firstChild.nodeSize;
          decos.push(Decoration.node(cardPos + 1, cardPos + 1 + tagSize, { style }));
        }
      }
    }
  }

  // Restart / continue indicators (§6) — shown only for the NON-default states,
  // which only exist when the author toggled them.
  doc.descendants((node, pos) => {
    const t = node.type.name;
    if (t === 'block') {
      if (node.attrs['numRestart'] === false) {
        decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'pmd-num-flow-in' }));
      }
      return false;
    }
    if (t === 'card' || t === 'analytic_unit') {
      if (node.attrs['numRestart'] === true) {
        decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'pmd-num-restart' }));
      }
      return false;
    }
    if (t === 'pocket' || t === 'hat') return false;
    return true; // doc root + transclusion_ref + self_ref: descend to reach inner cards
  });

  return {
    decorations: decos.length ? DecorationSet.create(doc, decos) : DecorationSet.empty,
    labelSig,
  };
}

/** Doc-order label sequence, serialized. Everything the glyphs render from
 *  EXCEPT positions and settings: kind + value per numbered card. Restart
 *  badges don't need to be in the signature — they render from card/block
 *  attrs, and attrs can only change via step types the fast path already
 *  classifies as structural. */
function sigFromCards(cards: ReadonlyMap<number, NumberLabel>): string {
  const parts: string[] = [];
  for (const label of cards.values()) parts.push(label.kind === 'sub' ? `s${label.value}` : `n${label.value}`);
  return parts.join(',');
}

/** Node types whose insertion can renumber cards or add badge/indent
 *  decorations — a replace step whose slice contains any of them forces a
 *  full rebuild. */
const STRUCTURAL_TYPES = new Set([
  'card',
  'analytic_unit',
  'pocket',
  'hat',
  'block',
  'transclusion_ref',
  'self_ref',
]);

/** Conservative per-step classification (perf audit A-02): could this
 *  transaction change numbering-relevant STRUCTURE in a way the label
 *  signature alone can't catch? Mark steps never can (match-heading color
 *  is handled by the always-rebuild rule in apply). Replace steps are safe
 *  iff their inserted slice contains no structural node — deletions of
 *  numbered cards are caught by the signature; a delete+insert MOVE carries
 *  the card in its insert slice and lands here. Anything else (attr steps,
 *  future step types) rebuilds: numRole/numRestart live in attrs. */
function isStructuralTr(tr: Transaction): boolean {
  for (const step of tr.steps) {
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) continue;
    if (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) {
      let structural = false;
      step.slice.content.descendants((node) => {
        if (STRUCTURAL_TYPES.has(node.type.name)) {
          structural = true;
          return false;
        }
        return true;
      });
      if (structural) return true;
      continue;
    }
    return true;
  }
  return false;
}

export const cardNumberingPlugin: Plugin<NumberingState> = new Plugin<NumberingState>({
  key: numberingPluginKey,
  state: {
    init: (_config, { doc }) => build(doc),
    apply: (tr, prev) => {
      if (!settings.get('showCardNumbering')) {
        // Display off: never rebuild on edits; drop any stale set when the
        // off-flip's explicit refresh arrives (frees the old decorations).
        return tr.getMeta(NUMBERING_REFRESH) ? EMPTY_STATE : prev;
      }
      if (tr.getMeta(NUMBERING_REFRESH)) return build(tr.doc);
      if (!tr.docChanged) return prev;
      // Match-heading color reads the heading TEXT's marks — a plain text
      // edit inside a colored tag changes the glyph color input without
      // touching labels or structure, so that mode always rebuilds
      // (match-heading users keep the pre-fast-path behavior).
      if (settings.get('cardNumberingMatchHeadingColor')) return build(tr.doc);
      // Fast path (perf audit A-02): a non-structural edit whose recomputed
      // label sequence is unchanged can't alter any glyph or badge — keep
      // the existing decorations, position-mapped. computeNumbering never
      // descends into card content, so the recompute is O(top-level
      // children), not O(doc) — ~100x cheaper than the full rebuild on
      // numbered master files.
      if (isStructuralTr(tr)) return build(tr.doc);
      const labelSig = sigFromCards(computeNumbering(tr.doc).cards);
      if (labelSig !== prev.labelSig) return build(tr.doc);
      return { decorations: prev.decorations.map(tr.mapping, tr.doc), labelSig };
    },
  },
  props: {
    decorations(state) {
      // Display-only: the skeleton stays in the doc, but the setting hides the
      // glyphs. Gated live here (not in the state) so a toggle takes effect on the
      // next view update — the settings subscriber nudges the view immediately.
      if (!settings.get('showCardNumbering')) return DecorationSet.empty;
      return numberingPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
    },
  },
});
