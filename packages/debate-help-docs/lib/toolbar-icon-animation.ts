/**
 * @file toolbar-icon-animation.ts
 * @description The sidebar's random icon animation, on the docs toolbar's
 * buttons. Hovering or focusing a button plays a random effect (a wiggle,
 * bounce, pulse, spin, shake, flip, jelly or tada, in a random color) on its
 * icon, at most once every 3 seconds; clicking it plays one every time. It
 * is the very same animation and the same "Animate sidebar icons" setting as
 * the sidebar's (`@debate-ai/videos/sidebar-icon-hover`).
 *
 * It is attached once to the element holding the toolbar's items
 * (`[data-toolbar-item]`) and works by delegation, so it covers any button
 * that is put in, server-rendered ones like Navigation included.
 */
import { playRandomIconAnimation } from '@debate-ai/videos/sidebar-icon-hover';

/** The toolbar button a pointer or focus event is on, and the icon to animate in it. */
export function toolbarIconFor(target: EventTarget | null, root: Element): { item: Element; icon: SVGElement } | null {
  if (!(target instanceof Element)) return null;
  const item = target.closest('[data-toolbar-item]');
  if (!item || !root.contains(item)) return null;
  // An open menu or panel sits inside its item; only the button itself animates.
  const button = item.querySelector('button');
  if (!button || !button.contains(target)) return null;
  const icon = button.querySelector('svg');
  return icon ? { item, icon } : null;
}

/** Gives the toolbar under `root` the random icon animation; returns the function that detaches it. */
export function attachToolbarIconAnimation(root: HTMLElement): () => void {
  const onEnter = (event: PointerEvent | FocusEvent) => {
    if (event instanceof PointerEvent && event.pointerType === 'touch') return;
    const hit = toolbarIconFor(event.target, root);
    if (!hit) return;
    // Moving between the parts of one button (its icon, its label) is not a new hover.
    const from = event.relatedTarget;
    if (from instanceof Node && hit.item.querySelector('button')?.contains(from)) return;
    playRandomIconAnimation(hit.icon);
  };
  const onClick = (event: MouseEvent) => {
    const hit = toolbarIconFor(event.target, root);
    if (hit) playRandomIconAnimation(hit.icon, { force: true });
  };
  root.addEventListener('pointerover', onEnter);
  root.addEventListener('focusin', onEnter);
  root.addEventListener('click', onClick);
  return () => {
    root.removeEventListener('pointerover', onEnter);
    root.removeEventListener('focusin', onEnter);
    root.removeEventListener('click', onClick);
  };
}

/** A ref callback that attaches {@link attachToolbarIconAnimation} to the element it is put on. */
export function toolbarIconAnimationRef(element: HTMLElement | null): (() => void) | undefined {
  return element ? attachToolbarIconAnimation(element) : undefined;
}
