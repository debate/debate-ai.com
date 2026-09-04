/**
 * Registry for the single live Handsontable instance. Command handlers reach
 * the grid through this module so lib/commands stays import-safe in tests and
 * on routes where no grid is mounted.
 */

import type Handsontable from "handsontable";

let active: Handsontable | null = null;
let onMutated: (() => void) | null = null;
let activeSheetId: string | null = null;
let activeSpacers = 0;

/**
 * HotGrid registers its instance (and snapshot callback) on mount, null on
 * unmount. `spacers` is the pane's inert leading column count: the pane owns
 * it and publishes it here so a command reaching the grid through this
 * registry converts against the number the grid was drawn with, rather than
 * deriving its own and drifting on padded sheets alone. Every argument is
 * required, so a caller that forgets the count cannot quietly republish zero
 * over a padded pane's real one.
 */
export function setActiveHot(
    hot: Handsontable | null,
    mutated: (() => void) | null,
    sheetId: string | null,
    spacers: number,
): void {
    active = hot;
    onMutated = mutated;
    activeSheetId = sheetId;
    activeSpacers = spacers;
}

export function getActiveHot(): Handsontable | null {
    return active;
}

/** The sheet the registered grid is showing, so a command can name it. */
export function getActiveSheetId(): string | null {
    return activeSheetId;
}

/** How many inert leading columns the registered grid is drawing. */
export function getActiveSpacers(): number {
    return activeSpacers;
}

/** Commands call this after writing cell meta so the snapshot/autosave runs. */
export function notifyGridMutated(): void {
    onMutated?.();
}

/**
 * Return keyboard focus to the grid so typing edits the flow and arrows move
 * cells. Overlays call this on close; re-selecting the last cell makes the grid
 * listen again after a dialog stole focus. Returns false when no grid is
 * mounted (e.g. the dashboard) so callers can fall back to default focus.
 */
export function focusActiveHot(): boolean {
    if (!active) return false;
    const sel = active.getSelectedLast();
    // The fallback is the first real column: a spacer stands for a speech this
    // sheet does not hold, so the cursor has no cell to land on there.
    active.selectCell(sel?.[0] ?? 0, sel?.[1] ?? activeSpacers);
    return true;
}
