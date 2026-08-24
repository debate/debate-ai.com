/**
 * Shared "one context menu at a time" registry.
 *
 * The nav-pane and the spellcheck right-click menus each track their own
 * open element, so without coordination both could be open at once. Each
 * menu calls `registerOpenContextMenu` with its own closer when it opens
 * (which first closes whatever else was open) and `clearOpenContextMenu`
 * when it closes. A full shared context-menu primitive is a larger
 * refactor; this is the minimal mutual-exclusion.
 */

let activeCloser: (() => void) | null = null;

/** Close any currently-open context menu, then mark `closer` as active.
 *  Call right after a menu mounts. */
export function registerOpenContextMenu(closer: () => void): void {
  if (activeCloser && activeCloser !== closer) activeCloser();
  activeCloser = closer;
}

/** Clear the active closer if it's `closer`. Call from a menu's own close
 *  path so the registry doesn't hold a stale reference. */
export function clearOpenContextMenu(closer: () => void): void {
  if (activeCloser === closer) activeCloser = null;
}
