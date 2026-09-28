/**
 * Context menus open on a RIGHT-CLICK only (user request 2026-09-21).
 *
 * The browser fires `contextmenu` for more than the right button: on
 * macOS a Ctrl+click synthesizes one, and the keyboard's menu key or
 * Shift+F10 does too. The app's menus — the editor's text / link /
 * image / misspelling menus, the nav pane's row menu, the palette's
 * row actions, the formatting panel's select-all — all listen for
 * `contextmenu`, so a Ctrl+click opened them. Every listener now asks
 * this gate first and, when refused, still cancels the browser's own
 * menu but opens nothing.
 *
 * Accepted: the right button (`button === 2`), and a keyboard-invoked
 * menu (`button === 0`, no Ctrl) — that one is not a click at all and
 * stays available for accessibility. Refused: anything with Ctrl held
 * (Ctrl+click on macOS reports the left button; a right-click with
 * Ctrl held is refused too — a small cost, and it makes the rule hold
 * even if a browser reports Ctrl+click as the right button).
 */
export function isRightClickContextMenu(e: MouseEvent): boolean {
  if (e.ctrlKey) return false;
  return e.button === 2 || e.button === 0;
}
