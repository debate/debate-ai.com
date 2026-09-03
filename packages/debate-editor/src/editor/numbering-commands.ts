/**
 * Auto-numbering input commands (NUMBERING_PLAN.md §4) — PROTOTYPE.
 *
 * All three author the SKELETON (node attrs), never a number. `number` and `sub`
 * are mutually exclusive (one `numRole` value), and both operate on the in-scope
 * SET as a whole: the cursor's card, or every card/analytic the selection touches.
 */

import { type Command, type EditorState } from 'prosemirror-state';
import { type Node as PMNode } from 'prosemirror-model';
import type { NumRole } from './numbering.js';
import { settings } from './settings.js';

/** Authoring any part of the skeleton auto-enables the display (§6) — otherwise
 *  the edit is invisible and the user can't tell it worked. */
function ensureNumberingVisible(): void {
  if (!settings.get('showCardNumbering')) settings.set('showCardNumbering', true);
}

interface CardUnit {
  pos: number;
  node: PMNode;
}

/** The nav pane's explicit multi-selection, as a numbering scope:
 *  `kind: 'cards'` (level-4 rows → wrapping card/analytic_unit
 *  positions) or `kind: 'blocks'` (level-3 rows → block node
 *  positions). Null when no such selection exists. */
export interface NavNumberingScope {
  kind: 'blocks' | 'cards';
  positions: number[];
}

/** Provider for the nav scope (set at boot by index.ts via the
 *  active-nav-panel resolver, so it follows the focused pane in
 *  multi-pane mode) — see `NavigationPanel.selectedNumberingScope`.
 *  The role toggles consume only the 'cards' flavor; the restart
 *  toggle consumes both. */
let navScopeProvider: (() => NavNumberingScope | null) | null = null;
export function registerNavNumberingScope(provider: () => NavNumberingScope | null): void {
  navScopeProvider = provider;
}

/** Validate scope positions against THIS state — a stale position must
 *  drop out, never mis-target a random node. */
function unitsAt(state: EditorState, positions: number[], types: readonly string[]): CardUnit[] {
  const units: CardUnit[] = [];
  for (const pos of positions) {
    const node = state.doc.nodeAt(pos);
    if (node && types.includes(node.type.name)) units.push({ pos, node });
  }
  return units;
}

/** Card / analytic_unit units the RANGE selection touches. */
function cardUnitsInRange(state: EditorState): CardUnit[] {
  const units: CardUnit[] = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
    if (node.type.name === 'card' || node.type.name === 'analytic_unit') {
      units.push({ pos, node });
      return false; // a card's internals hold no nested card unit
    }
    return true;
  });
  return units;
}

/** Card / analytic_unit units in scope: the nav pane's explicit
 *  multi-selection when one is active (Shift/Ctrl-click on tag rows —
 *  the toggles then act on those cards "as if selected"), else the
 *  cursor's enclosing unit, or every unit the selection touches. */
function inScopeCardUnits(state: EditorState): CardUnit[] {
  // Nav-pane scope first — 'cards' flavor only (a blocks selection is
  // not a role-toggle scope; those commands fall through to the caret).
  const navScope = navScopeProvider?.();
  if (navScope && navScope.kind === 'cards' && navScope.positions.length > 0) {
    const units = unitsAt(state, navScope.positions, ['card', 'analytic_unit']);
    if (units.length > 0) return units;
  }
  const { selection } = state;
  if (!selection.empty) return cardUnitsInRange(state);
  const units: CardUnit[] = [];
  const $pos = selection.$from;
  for (let d = $pos.depth; d >= 0; d--) {
    const n = $pos.node(d);
    if (n.type.name === 'card' || n.type.name === 'analytic_unit') {
      units.push({ pos: $pos.before(d), node: n });
      break;
    }
  }
  return units;
}

/**
 * §4 whole-selection toggle. If EVERY in-scope card already has this role → clear
 * them all to 'none' (off). Otherwise (mixed, all-none, or all-the-other-role) →
 * set them all to this role. A lone card is just the one-element case.
 */
function makeRoleToggle(role: 'number' | 'sub'): Command {
  return (state, dispatch) => {
    const units = inScopeCardUnits(state);
    if (units.length === 0) return false;
    const next: NumRole = units.every((u) => u.node.attrs['numRole'] === role) ? 'none' : role;
    if (dispatch) {
      const tr = state.tr;
      // Attr-only edits don't shift positions, so no remapping is needed.
      for (const u of units) tr.setNodeAttribute(u.pos, 'numRole', next);
      dispatch(tr);
      ensureNumberingVisible();
    }
    return true;
  };
}

/** Toggle the "number" role on the in-scope card set. */
export const toggleNumberRole = makeRoleToggle('number');
/** Toggle the "substructure" role on the in-scope card set. */
export const toggleSubRole = makeRoleToggle('sub');

/**
 * Flip the restart flag ("start the count over here") on the cursor's unit — its
 * enclosing block header, or its card/analytic_unit. On a block this toggles
 * restart(default)↔continue; on a card it toggles a mid-list restart on/off.
 */
/** Whether a unit carries its NON-DEFAULT restart flag: a block flagged
 *  "continue" (blocks restart by default), or a card/analytic_unit
 *  flagged "restart here" (cards flow by default). */
function restartFlagged(node: PMNode): boolean {
  return node.type.name === 'block'
    ? node.attrs['numRestart'] === false
    : node.attrs['numRestart'] === true;
}

/** Whether a unit RESTARTS the count — the pressed-indicator sense
 *  (inverse polarity per kind: an unflagged block restarts; a flagged
 *  card restarts). */
function restartsHere(node: PMNode): boolean {
  return node.type.name === 'block'
    ? node.attrs['numRestart'] !== false
    : node.attrs['numRestart'] === true;
}

/** The non-default `numRestart` attr VALUE for a unit's kind. */
function nonDefaultRestartAttr(node: PMNode): boolean {
  return node.type.name === 'block' ? false : true;
}

/** Block nodes the RANGE selection touches. */
function blocksInRange(state: EditorState): CardUnit[] {
  const units: CardUnit[] = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
    if (node.type.name === 'block') {
      units.push({ pos, node });
      return false;
    }
    // Headings/cards hold no blocks; only descend through the doc root
    // and transclusion containers.
    const t = node.type.name;
    return t === 'doc' || t === 'transclusion_ref' || t === 'self_ref';
  });
  return units;
}

/** The restart toggle's scope, mirroring the role toggles but
 *  level-aware:
 *   - nav multi-selection: blocks (level-3 rows) or cards (level-4);
 *   - editor RANGE selection: the blocks it spans — and only if it
 *     spans none, the card units (flipping every card to "restart
 *     here" because the selection happened to cross a block would be
 *     catastrophic, so blocks win);
 *   - caret: the cursor's enclosing block or card/analytic_unit. */
function inScopeRestartUnits(state: EditorState): CardUnit[] {
  const navScope = navScopeProvider?.();
  if (navScope && navScope.positions.length > 0) {
    const types = navScope.kind === 'blocks' ? ['block'] : ['card', 'analytic_unit'];
    const units = unitsAt(state, navScope.positions, types);
    if (units.length > 0) return units;
  }
  const { selection } = state;
  if (!selection.empty) {
    const blocks = blocksInRange(state);
    if (blocks.length > 0) return blocks;
    return cardUnitsInRange(state);
  }
  const $pos = selection.$from;
  for (let d = $pos.depth; d >= 0; d--) {
    const n = $pos.node(d);
    const t = n.type.name;
    if (t === 'block' || t === 'card' || t === 'analytic_unit') {
      return [{ pos: $pos.before(d), node: n }];
    }
  }
  return [];
}

/**
 * Flip the restart flag on the in-scope unit set. Whole-set semantics,
 * normalized to the NON-DEFAULT state: if every unit already carries
 * its non-default flag (blocks all "continue" / cards all "restart
 * here") → restore them all to default; otherwise → set them ALL
 * non-default. So selecting the blocks that separate a consecutively-
 * numbered run and pressing once makes the count flow straight through
 * (every block "continue"); pressing again restores the per-block
 * restarts. A lone unit at the caret degenerates to the old behavior:
 * block restart(default)↔continue, card restart-here on/off.
 */
export const toggleNumRestart: Command = (state, dispatch) => {
  const units = inScopeRestartUnits(state);
  if (units.length === 0) return false;
  const allFlagged = units.every((u) => restartFlagged(u.node));
  if (dispatch) {
    const tr = state.tr;
    for (const u of units) {
      const next = allFlagged
        ? !nonDefaultRestartAttr(u.node) // restore the kind's default
        : nonDefaultRestartAttr(u.node);
      tr.setNodeAttribute(u.pos, 'numRestart', next);
    }
    dispatch(tr);
    ensureNumberingVisible();
  }
  return true;
};

/**
 * The current numbering state at the selection, for the ribbon buttons'
 * pressed indicators. `number`/`sub` are true when EVERY in-scope card carries
 * that role (the same set `makeRoleToggle` acts on); `restart` mirrors
 * `toggleNumRestart`'s scope — true when EVERY in-scope unit restarts the
 * count (a block "on" unless flagged continue; a card/analytic on only
 * when explicitly flagged to restart).
 */
export function numberingSelectionState(
  state: EditorState,
  precomputedUnits?: CardUnit[],
): {
  number: boolean;
  sub: boolean;
  restart: boolean;
} {
  // The fused selection-chrome walk (selection-chrome.ts) already collected
  // the in-scope units for range selections; accept them to avoid a second
  // O(selection) walk per refresh. Semantics identical to inScopeCardUnits.
  const units = precomputedUnits ?? inScopeCardUnits(state);
  const allRole = (role: NumRole): boolean =>
    units.length > 0 && units.every((u) => u.node.attrs['numRole'] === role);
  // Restart resolves its own (level-aware) scope — the chrome's
  // precomputed units are card-only and would miss a blocks selection.
  const restartUnits = inScopeRestartUnits(state);
  const restart = restartUnits.length > 0 && restartUnits.every((u) => restartsHere(u.node));
  return { number: allRole('number'), sub: allRole('sub'), restart };
}
