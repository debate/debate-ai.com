/**
 * In-editor confirm dialog — a Promise-based replacement for `window.confirm`
 * in editor flows, so a prompt reads as part of the app rather than a jarring
 * OS alert (and doesn't yank focus out of the contenteditable the way the
 * native dialog does). Resolves `true` on confirm, `false` on cancel / Escape /
 * backdrop click. Headless (no `document`) resolves `false`.
 */

import { pushOverlay, popOverlay } from './overlay-stack.js';
import { installModalKeys, captureFocusForDialog } from './text-prompt.js';

export interface ConfirmOptions {
  /** Optional bold title line above the message. */
  title?: string;
  /** The body text (supports multiple lines via `\n`). */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  danger?: boolean;
}

export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'pmd-confirm-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'pmd-confirm';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');

    if (opts.title) {
      const title = document.createElement('div');
      title.className = 'pmd-confirm-title';
      title.textContent = opts.title;
      dialog.appendChild(title);
    }

    const message = document.createElement('div');
    message.className = 'pmd-confirm-message';
    // Preserve author-intended line breaks without allowing HTML injection.
    message.textContent = opts.message;
    dialog.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'pmd-confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'pmd-confirm-btn pmd-confirm-cancel';
    cancelBtn.textContent = opts.cancelLabel ?? 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = `pmd-confirm-btn pmd-confirm-ok${opts.danger ? ' pmd-confirm-danger' : ''}`;
    confirmBtn.textContent = opts.confirmLabel ?? 'OK';

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Full modal treatment (2026-07-27 focus audit): this primitive
    // predates the shared wiring and was the one dialog file the
    // modal-key sweep missed — it registered nothing on the overlay
    // stack (so background handlers and any future focus logic saw
    // "no modal open") and swallowed only Enter/Escape, leaking every
    // other key during the pre-focus window.
    const overlayToken = pushOverlay();
    const restoreFocus = captureFocusForDialog();
    let removeKeys = (): void => {};
    let settled = false;
    const close = (result: boolean): void => {
      if (settled) return;
      settled = true;
      removeKeys();
      popOverlay(overlayToken);
      backdrop.remove();
      // Return focus to wherever it was (usually the editor).
      restoreFocus();
      resolve(result);
    };

    removeKeys = installModalKeys(dialog, overlayToken, (e) => {
      if (e.key === 'Escape') {
        close(false);
        return true;
      }
      if (e.key === 'Enter') {
        close(true);
        return true;
      }
      return false;
    });

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close(false);
    });

    // Focus the OK button (not the container): Tab reaches Cancel, and
    // Space activates natively. Enter is handled above BEFORE native
    // button activation (preventDefault), so it can't double-fire.
    setTimeout(() => confirmBtn.focus(), 0);
  });
}
