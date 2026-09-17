/**
 * Mobile-shell activation — the boot-time decision between the
 * desktop UI and the view-first mobile shell (SPEC-mobile-view.md).
 *
 * Resolved ONCE per page load, before either shell mounts; rotating
 * a tablet or resizing mid-session never thrashes the shell (same
 * reload-to-switch convention as the three-pane toggle). The mobile
 * shell is a web-edition feature: Electron always gets the desktop
 * UI regardless of the setting or screen.
 */

export type MobileLayoutSetting = 'auto' | 'mobile' | 'desktop';

export interface MobileLayoutEnv {
  /** `getHost().kind` — only `'browser'` is eligible; native hosts
   *  (electron, tauri) always get the desktop UI. */
  hostKind: string;
  /** `matchMedia('(pointer: coarse)').matches` at boot. */
  coarsePointer: boolean;
  /** `window.innerWidth` at boot (CSS px). */
  viewportWidth: number;
  /** True when CardMirror is mounted inside `.dec-cardmirror-embed`
   *  (a host page's own column/panel — the FIAT speech-doc panel,
   *  Flow's split view, `/reason-editor`) rather than owning the whole
   *  page. The view-first mobile shell (fixed app bar, bottom mode
   *  bar, edge-swipe drawer — see mobile-shell.ts) hardcodes viewport
   *  positioning and appends its chrome to `document.body`, so it
   *  paints over the ENTIRE page instead of staying inside the host's
   *  column. Embeds keep the normal desktop ribbon + menu bar, which
   *  `embed-containment.css` already re-pins to the embed's own box. */
  embedded: boolean;
}

/** Width at/above which `auto` keeps the desktop layout even on a
 *  coarse pointer — large tablets in landscape are usable with the
 *  desktop UI, and its toggle is one tap away either way. */
export const MOBILE_AUTO_MAX_WIDTH = 1024;

/** Below this width `auto` picks mobile regardless of pointer type —
 *  a phone-class viewport can't fit the desktop chrome no matter what
 *  is pointing at it (and DevTools-style narrow windows should land
 *  in the mobile layout without needing touch emulation). */
export const MOBILE_AUTO_ANY_POINTER_WIDTH = 768;

/** Detects the `.dec-cardmirror-embed` wrapper `CardMirrorEditor` (the
 *  React shell every web call site in this app mounts through — the
 *  FIAT speech-doc panel, Flow split view, `/reason-editor`) renders
 *  around its host `<div>` BEFORE it dynamically imports this engine
 *  module. Safe to call at module-boot time: React has already
 *  committed that wrapper to the document by the time the singleton's
 *  `import('../editor/index.js')` resolves, even though the engine's
 *  own container element isn't reparented into it until later. */
export function detectEmbedded(): boolean {
  return typeof document !== 'undefined' && document.querySelector('.dec-cardmirror-embed') !== null;
}

export function resolveMobileLayout(
  setting: MobileLayoutSetting,
  env: MobileLayoutEnv,
): boolean {
  if (env.hostKind !== 'browser') return false;
  if (env.embedded) return false;
  if (setting === 'desktop') return false;
  if (setting === 'mobile') return true;
  if (env.viewportWidth < MOBILE_AUTO_ANY_POINTER_WIDTH) return true;
  return env.coarsePointer && env.viewportWidth < MOBILE_AUTO_MAX_WIDTH;
}

/** Phone vs tablet density inside the mobile shell. One shell, two
 *  layout classes — `pmd-mobile-phone` overlays the outline drawer;
 *  `pmd-mobile-tablet` pins it as a persistent rail. */
export function mobileDensity(viewportWidth: number): 'phone' | 'tablet' {
  return viewportWidth >= 768 ? 'tablet' : 'phone';
}

/** Below this width the desktop chrome's two fixed-width left
 *  sidebars stop fitting. `#app` insets from BOTH of them —
 *  `left: var(--nav-width)` (300px) normally, and
 *  `left: calc(var(--nav-width) + var(--pmd-recovery-width))`
 *  (580px) while the crash-recovery sidebar is up — so in any
 *  column narrower than that the document is pushed clean off the
 *  right edge: ribbon and sidebars paint, and not one pixel of the
 *  doc is on screen. Same threshold as `MOBILE_AUTO_ANY_POINTER_WIDTH`
 *  and for the same reason (a phone-class box can't hold the desktop
 *  chrome), but a separate constant because it answers a different
 *  question — that one picks a SHELL, this one only fixes how the
 *  desktop shell's chrome lays out. */
export const NARROW_CHROME_MAX_WIDTH = 768;

/** True when the desktop chrome is laying out into a box too narrow
 *  for its sidebars to take their width out of the document's.
 *
 *  This is deliberately NOT `resolveMobileLayout`'s job: that one
 *  refuses embeds outright (the view-first shell hardcodes viewport
 *  positioning, so it would paint over the host page), which leaves
 *  a phone-width embed rendering the full desktop chrome with no
 *  narrow handling at all. `.dec-cardmirror-embed` is exactly where
 *  the squeeze happens, so it needs its own answer. */
export function isNarrowChrome(boxWidth: number): boolean {
  return boxWidth > 0 && boxWidth < NARROW_CHROME_MAX_WIDTH;
}

/** The width of the box CardMirror's chrome actually lays out in.
 *  In an embed that is the host's column, not the window:
 *  `embed-containment.css` re-pins the chrome to
 *  `.dec-cardmirror-embed`, so the column's width is what its
 *  sidebars have to fit inside — a narrow split pane on a wide
 *  desktop is just as squeezed as a phone. Falls back to the
 *  viewport when there is no embed, or when the embed measures 0
 *  (a `display: none` ancestor, or a read before first layout)
 *  rather than calling a hidden deployment narrow. */
export function chromeBoxWidth(): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
  const embed = document.querySelector('.dec-cardmirror-embed');
  const embedWidth = embed instanceof HTMLElement ? embed.clientWidth : 0;
  return embedWidth > 0 ? embedWidth : window.innerWidth;
}
