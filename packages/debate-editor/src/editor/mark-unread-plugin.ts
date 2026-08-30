/**
 * "Unread after marker" decoration.
 *
 * A toggleable review aid (`markUnreadAfterMarker`): when on, every run of a
 * card's body text that falls AFTER a reading-position marker (see
 * `reading-marker.ts`) is tinted red, a visual record of the part of the card
 * you didn't reach in a round. Bounded by the card: a marker only reddens the
 * rest of ITS card, never the next one.
 *
 * Display-only, like read mode's hiding: it's a `Decoration` set, never a doc
 * edit, so it round-trips to nothing and flips off cleanly. The red the
 * marker text itself already carries (`font_color` FF0000) is left alone; this
 * only colors the body that comes after it.
 *
 * Perf: the setting is OFF by default, so `build` bails before walking
 * anything (zero cost for the common case). When on, it rebuilds the whole
 * set on each doc change — an O(doc) full rebuild, which is fine since "on" is
 * a review posture (few edits). If a big doc ever lags while on, upgrade to
 * incremental (map + recompute the changed card, like read-mode-plugin).
 */

import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { settings } from './settings.js';
import { isMarkerText } from './reading-marker.js';

/** Meta flag on the no-op transaction the settings watcher dispatches when
 *  the toggle flips, so the plugin rebuilds on demand (mirrors read mode's
 *  `PMD_READ_MODE_TOGGLE`). The value is unused; `build` re-reads the setting
 *  itself, so the transaction is purely a rebuild nudge. */
export const MARK_UNREAD_TOGGLE = 'pmdMarkUnreadToggle';

/** The decorations for one doc, ignoring the toggle (the plugin gates on the
 *  setting before calling this). Pure; exported for testing. */
export function computeUnreadDecorations(doc: PMNode): Decoration[] {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    const name = node.type.name;
    // Descend through structural containers (pocket/hat/block) to reach cards.
    if (name !== 'card' && name !== 'analytic_unit') return true;
    // Walk this card's text runs in doc order: find the first marker, then
    // redden every following body run. Tags/cites are skipped, since the
    // feature is about the *body* you didn't read.
    let markerEnd = -1;
    node.descendants((child, offset, parent) => {
      if (!child.isText || !child.text) return true;
      const from = pos + 1 + offset;
      const to = from + child.nodeSize;
      if (markerEnd < 0) {
        if (isMarkerText(child)) markerEnd = to; // "after the marked location"
        return true;
      }
      const inBody = parent?.type.name === 'card_body' || parent?.type.name === 'undertag';
      if (inBody) decos.push(Decoration.inline(from, to, { class: 'pmd-unread' }));
      return true;
    });
    return false; // cards don't nest
  });
  return decos;
}

function build(doc: PMNode): DecorationSet {
  // OFF (the default) bails before any walk: zero cost for the common case.
  if (!settings.get('markUnreadAfterMarker')) return DecorationSet.empty;
  return DecorationSet.create(doc, computeUnreadDecorations(doc));
}

export const markUnreadPlugin: Plugin<DecorationSet> = new Plugin<DecorationSet>({
  state: {
    init(_config, state) {
      return build(state.doc);
    },
    apply(tr, prev, _old, newState) {
      // Rebuild on doc edits (a marker moved / body changed) and on the
      // toggle nudge; otherwise (selection-only, unrelated meta) reuse prev.
      if (tr.getMeta(MARK_UNREAD_TOGGLE) === undefined && !tr.docChanged) return prev;
      return build(newState.doc);
    },
  },
  props: {
    decorations(state) {
      return markUnreadPlugin.getState(state);
    },
  },
});
