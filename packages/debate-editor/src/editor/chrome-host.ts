/**
 * Where the engine's page-owning chrome mounts.
 *
 * Most of CardMirror's chrome is declared in `ribbon-template.ts` and so is
 * already born inside the engine's own container. A few surfaces are built in
 * JS and appended to `document.body` instead — fine for a page-owning
 * deployment, wrong for an embed: `embed-containment.css` confines the fixed
 * chrome with `.dec-cardmirror-embed <selector>` descendant rules, and a node
 * parked on `<body>` is not a descendant of anything, so those rules never
 * match it. The full-window home hub (`position: fixed; inset: 0`) then paints
 * over the ENTIRE page — the host app's sidebar included — instead of staying
 * inside the column the host gave CardMirror.
 *
 * `chromeHost()` returns the engine container (`.dec-cardmirror-root`, created
 * by the React singleton before it imports this engine, so it is already in the
 * document by the time module-scope boot code runs) when there is one, and
 * `document.body` otherwise. Mounting into the container also means the chrome
 * RIDES ALONG when the singleton re-parents that container into whichever
 * `<CardMirrorEditor>` currently owns it — no second move to keep in sync.
 *
 * This is for PERMANENT chrome only. JS-positioned floaters (tooltips, context
 * menus, the pill tray, the find bar) stay on `<body>` and stay
 * `position: fixed` on purpose: their coordinates come from
 * `getBoundingClientRect()`, which is viewport-relative no matter what
 * containing block is in play — see the header of `embed-containment.css`.
 */

/** The element page-owning chrome should be appended to. */
export function chromeHost(): HTMLElement {
  return document.querySelector<HTMLElement>('.dec-cardmirror-root') ?? document.body;
}
