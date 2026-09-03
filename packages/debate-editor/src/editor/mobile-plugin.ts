/**
 * Mobile-shell editor behavior (SPEC-mobile-view.md).
 *
 * The mobile shell is view-first: the ProseMirror view is never
 * contenteditable, which keeps the on-screen keyboard away entirely
 * while leaving decorations, history, and programmatic selection
 * fully alive. Commands target content via tap coordinates
 * (`posAtCoords` under the hood of `handleClick`'s `pos`), not via a
 * caret — there is no caret.
 *
 * Tap behaviors, by mode:
 * - Read mode on: a tap toggles the reading-position marker at the
 *   tapped word (the touch equivalent of the Space/Enter binding —
 *   a non-editable view gets no key events at all).
 * - Move / Repair mode on: a tap selects the smallest structural
 *   unit (card / analytic_unit / heading subtree) under the finger,
 *   visualized by a node decoration, and notifies the shell — Move's
 *   sheet offers Up / Down / Send to… / Copy / Delete; Repair's
 *   offers the AI text / formatting repairs scoped to the unit.
 *
 * Lives in its own module (not mobile-shell.ts) so `buildEditorPlugins`
 * can include it statically without importing the shell, which itself
 * imports from editor/index.ts (the same dynamic-import cycle-break
 * the multi-pane shell uses).
 */

import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { readModePlugin } from './read-mode-plugin.js';
import { toggleReadingMarker } from './reading-marker.js';
import { unitRangeAtPos, type UnitRange } from './structural-move.js';

/** Set once at boot, before any EditorView mounts. Never flips
 *  mid-session — the shell decision is per-load (see
 *  `resolveMobileLayout`). */
let mobileShellActive = false;

export function setMobileShellActive(on: boolean): void {
  mobileShellActive = on;
}

export function isMobileShellActive(): boolean {
  return mobileShellActive;
}

/** Tap-select mode — `'move'` and `'repair'` share the same
 *  tap-to-select-unit machinery; the shell decides what the
 *  selection drives. Toggled by the shell's mode bar. */
export type MobileTapMode = 'none' | 'move' | 'repair';
let tapMode: MobileTapMode = 'none';
let unitTapHandler: ((unit: UnitRange | null) => void) | null = null;

export function setMobileTapMode(view: EditorView, mode: MobileTapMode): void {
  tapMode = mode;
  if (mode === 'none') setMobileUnitSelection(view, null);
}

/** The shell registers one handler; called with the unit under every
 *  tap-select-mode tap (null = tapped outside any unit). */
export function onMobileUnitTapped(cb: (unit: UnitRange | null) => void): void {
  unitTapHandler = cb;
}

const MOBILE_SELECT_META = 'pmdMobileUnitSelect';

interface MobileShellState {
  selected: { from: number; to: number } | null;
}

const mobileKey = new PluginKey<MobileShellState>('pmdMobileShell');

/** Set / clear the Move-mode unit highlight. */
export function setMobileUnitSelection(view: EditorView, unit: UnitRange | null): void {
  view.dispatch(
    view.state.tr
      .setMeta(MOBILE_SELECT_META, unit ? { from: unit.from, to: unit.to } : null)
      .setMeta('addToHistory', false),
  );
}

/** Node decorations over every top-level node in the selected range —
 *  one box for a card, heading line + subtree nodes for a section. */
function selectionDecorations(doc: PMNode, sel: { from: number; to: number }): DecorationSet {
  const decos: Decoration[] = [];
  doc.forEach((node, offset) => {
    if (offset >= sel.from && offset + node.nodeSize <= sel.to) {
      decos.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'pmd-mobile-unit-selected',
        }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

export const mobilePlugin: Plugin<MobileShellState> = new Plugin<MobileShellState>({
  key: mobileKey,
  state: {
    init(): MobileShellState {
      return { selected: null };
    },
    apply(tr, prev): MobileShellState {
      const meta = tr.getMeta(MOBILE_SELECT_META) as
        | { from: number; to: number }
        | null
        | undefined;
      if (meta !== undefined) return { selected: meta };
      if (!tr.docChanged || !prev.selected) return prev;
      // Map the highlight through edits; a move replaces it anyway
      // (the shell re-selects the unit at its landing position).
      const from = tr.mapping.map(prev.selected.from, 1);
      const to = tr.mapping.map(prev.selected.to, -1);
      return { selected: from < to ? { from, to } : null };
    },
  },
  props: {
    /** View-first: never contenteditable on mobile. */
    editable(): boolean {
      return !mobileShellActive;
    },
    decorations(state) {
      const sel = mobileKey.getState(state)?.selected;
      if (!sel) return null;
      return selectionDecorations(state.doc, sel);
    },
    /** Tap detection via raw pointer events, NOT PM's `handleClick`:
     *  the word-selection plugin owns `mousedown` and handles single
     *  clicks itself, so PM's built-in click pipeline (which is what
     *  dispatches handleClick) never runs for text clicks. This
     *  plugin sits first in the plugin array, so these handlers see
     *  the events before word-selection does. A tap = down→up under
     *  10px and 500ms; anything longer or farther is a scroll or a
     *  long-press and is left alone. */
    handleDOMEvents: {
      pointerdown(_view, e): boolean {
        if (!mobileShellActive || !e.isPrimary) return false;
        tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
        return false;
      },
      pointercancel(): boolean {
        tapStart = null;
        return false;
      },
      pointerup(view, e): boolean {
        if (!mobileShellActive || !tapStart || e.pointerId !== tapStart.id) return false;
        const start = tapStart;
        tapStart = null;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (dx * dx + dy * dy > 100 || Date.now() - start.t > 500) return false;
        const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (!hit) return false;
        // Tap-select modes win over read-mode markers (the shell
        // never leaves both on; precedence keeps a race harmless).
        if (tapMode !== 'none') {
          let unit = unitRangeAtPos(view.state.doc, hit.pos);
          // Repairs run one card at a time — heading subtrees are
          // not a selectable scope in Repair mode.
          if (tapMode === 'repair' && unit && unit.level !== 4) unit = null;
          console.log(
            `[cardmirror] mobile: ${tapMode} tap pos=${hit.pos} → ${unit ? `${unit.type} "${unit.label.slice(0, 40)}"` : 'no unit'}`,
          );
          setMobileUnitSelection(view, unit);
          unitTapHandler?.(unit);
          return true;
        }
        if (!readModePlugin.getState(view.state)?.on) return false;
        const $pos = view.state.doc.resolve(hit.pos);
        view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)));
        return toggleReadingMarker(view);
      },
    },
  },
});

/** In-flight tap candidate on the editor surface. */
let tapStart: { id: number; x: number; y: number; t: number } | null = null;
