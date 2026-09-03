/**
 * Tiny ephemeral tooltip near the mouse pointer ("Copied!", "Saved!",
 * etc.). Tracks the cursor position via a passive global mousemove
 * listener so callers don't need to thread an event through.
 */

let lastMouseX = 0;
let lastMouseY = 0;
let tracked = false;

function ensureTracking(): void {
  if (tracked) return;
  tracked = true;
  window.addEventListener(
    'mousemove',
    (e) => {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    },
    { passive: true },
  );
}

export interface ToastOptions {
  /** Total time the toast stays visible (ms). Default 1000. */
  durationMs?: number;
  /** Fade-out animation length (ms). Default 200. */
  fadeMs?: number;
}

/** Default visibility from reading time, not vibes (toast audit,
 *  2026-08-17: the flat 1000ms default under-timed 60% of the app's
 *  toasts — every error and most instructions). ~200ms/word at a
 *  UI-reading pace on top of a pickup floor, capped so a runaway
 *  message can't park a tooltip for half a minute. Explicit
 *  `durationMs` still wins. */
function defaultDurationMs(message: string): number {
  const words = message.trim().split(/\s+/).length;
  return Math.min(8000, Math.max(1600, 1600 + (words - 1) * 200));
}

export function showToast(message: string, opts: ToastOptions = {}): void {
  // Guard for non-DOM environments (vitest's Node default). Callers
  // can invoke showToast from any Command without breaking unit tests.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  ensureTracking();
  const durationMs = opts.durationMs ?? defaultDurationMs(message);
  const fadeMs = opts.fadeMs ?? 200;

  const toast = document.createElement('div');
  toast.className = 'pmd-toast';
  toast.textContent = message;
  // Offset slightly down/right from the cursor so it doesn't sit
  // under the pointer.
  toast.style.left = `${lastMouseX + 10}px`;
  toast.style.top = `${lastMouseY + 14}px`;
  toast.style.transitionDuration = `${fadeMs}ms`;
  document.body.appendChild(toast);

  // Trigger fade after duration - fade time so the toast finishes
  // dismissing right around the duration mark.
  const visibleMs = Math.max(0, durationMs - fadeMs);
  setTimeout(() => {
    toast.classList.add('pmd-toast-fade');
    setTimeout(() => toast.remove(), fadeMs);
  }, visibleMs);
}
