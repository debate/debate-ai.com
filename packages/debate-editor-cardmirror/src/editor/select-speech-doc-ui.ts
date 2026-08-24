/**
 * Select Speech Doc modal — lists every open document across every
 * CardMirror window, indicates which one is currently the speech
 * doc (gold accent matching the `--pmd-c-speech-*` tokens), and
 * lets the user pick a different one or clear the designation
 * entirely.
 *
 * The modal does NOT focus the picked doc's window; the user
 * stays where they are. The speech designation flows through the
 * existing `host:speech-set` IPC, which broadcasts to every
 * window via `speech:changed`.
 *
 * Electron-only — no-op on web.
 */

import { getElectronHost } from './host/index.js';
import { captureFocusForDialog, installModalKeys, armDialogFocus } from './text-prompt.js';
import { showToast } from './toast.js';
import { setIcon } from './icons';
import { pushOverlay, popOverlay } from './overlay-stack.js';

let openOverlay: HTMLDivElement | null = null;
let overlayToken: symbol | null = null;

interface DocRow {
  uid: string;
  filename: string | null;
  windowId: number;
  windowTitle: string;
  isSpeech: boolean;
  isOwnWindow: boolean;
  isFocusedWindow: boolean;
}

/** Focus restorer captured when the modal opened — closing an in-DOM overlay
 *  otherwise leaves the caret on <body> (selection visible, keystrokes dead
 *  until a click). */
let restoreFocusOnClose: (() => void) | null = null;

let removeModalKeys: (() => void) | null = null;

function closeModal(): void {
  if (!openOverlay) return;
  if (overlayToken) popOverlay(overlayToken);
  overlayToken = null;
  openOverlay.remove();
  openOverlay = null;
  removeModalKeys?.();
  removeModalKeys = null;
  restoreFocusOnClose?.();
  restoreFocusOnClose = null;
}

async function setSpeechAndClose(host: NonNullable<ReturnType<typeof getElectronHost>>, uid: string | null): Promise<void> {
  try {
    await host.speechSet(uid);
  } catch (err) {
    showToast(`Couldn't update speech doc: ${err instanceof Error ? err.message : String(err)}`);
  }
  closeModal();
}

function renderRow(host: NonNullable<ReturnType<typeof getElectronHost>>, row: DocRow): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pmd-select-speech-row';
  if (row.isSpeech) btn.classList.add('pmd-select-speech-row-current');

  const indicator = document.createElement('span');
  indicator.className = 'pmd-select-speech-row-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.textContent = row.isSpeech ? '🎤' : '';
  btn.appendChild(indicator);

  const text = document.createElement('span');
  text.className = 'pmd-select-speech-row-text';
  const name = document.createElement('span');
  name.className = 'pmd-select-speech-row-name';
  name.textContent = row.filename ?? 'Untitled';
  text.appendChild(name);

  const sub = document.createElement('span');
  sub.className = 'pmd-select-speech-row-sub';
  const parts: string[] = [];
  if (row.isOwnWindow) parts.push('this window');
  else if (row.windowTitle) parts.push(row.windowTitle);
  else parts.push(`Window ${row.windowId}`);
  if (row.isSpeech) parts.push('current speech doc');
  sub.textContent = parts.join(' · ');
  text.appendChild(sub);

  btn.appendChild(text);

  btn.addEventListener('click', () => {
    // Clicking the current speech doc unsets it (toggle off);
    // clicking a different doc sets that one.
    void setSpeechAndClose(host, row.isSpeech ? null : row.uid);
  });

  return btn;
}

/** Open the modal. Lists every open doc across every window;
 *  clicking a row sets that doc as the speech doc (or unsets if
 *  the row was already speech), and the modal closes. Esc / click
 *  outside also closes. */
export async function openSelectSpeechDocModal(): Promise<void> {
  if (openOverlay) {
    closeModal();
    return;
  }
  const host = getElectronHost();
  if (!host) {
    showToast('Select Speech Doc is only available in the desktop app.');
    return;
  }

  const rows = await host.listDocs();

  restoreFocusOnClose = captureFocusForDialog();
  const overlay = document.createElement('div');
  overlay.className = 'pmd-select-speech-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const dialog = document.createElement('div');
  dialog.className = 'pmd-select-speech-dialog';
  overlay.appendChild(dialog);

  const header = document.createElement('header');
  header.className = 'pmd-select-speech-header';
  const title = document.createElement('h2');
  title.textContent = 'Select Speech Document';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pmd-select-speech-close';
  setIcon(closeBtn, 'close');
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', () => closeModal());
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const intro = document.createElement('p');
  intro.className = 'pmd-select-speech-intro';
  intro.textContent =
    'Pick a doc to receive content sent via the speech commands. Click the current speech doc to unset it.';
  dialog.appendChild(intro);

  const list = document.createElement('div');
  list.className = 'pmd-select-speech-list';
  dialog.appendChild(list);

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'pmd-select-speech-empty';
    empty.textContent = 'No open documents found.';
    list.appendChild(empty);
  } else {
    // Stable order: current speech doc first, then own window's
    // docs, then other windows. Within each group, sort by
    // filename (Untitled docs land last in their group).
    const sorted = [...rows].sort((a, b) => {
      if (a.isSpeech !== b.isSpeech) return a.isSpeech ? -1 : 1;
      if (a.isOwnWindow !== b.isOwnWindow) return a.isOwnWindow ? -1 : 1;
      if (a.windowId !== b.windowId) return a.windowId - b.windowId;
      const aName = a.filename ?? '￿';
      const bName = b.filename ?? '￿';
      return aName.localeCompare(bName);
    });
    for (const row of sorted) {
      list.appendChild(renderRow(host, row));
    }
  }

  // Always-visible "Clear speech doc" footer button — explicit
  // even though clicking the current row also clears, because
  // discoverability of the toggle behavior is low.
  const footer = document.createElement('footer');
  footer.className = 'pmd-select-speech-footer';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'pmd-select-speech-clear';
  const hasSpeech = rows.some((r) => r.isSpeech);
  clearBtn.textContent = hasSpeech ? 'Clear speech doc designation' : 'No speech doc designated';
  clearBtn.disabled = !hasSpeech;
  clearBtn.addEventListener('click', () => {
    if (hasSpeech) void setSpeechAndClose(host, null);
  });
  footer.appendChild(clearBtn);
  dialog.appendChild(footer);

  document.body.appendChild(overlay);
  openOverlay = overlay;
  const token = pushOverlay();
  overlayToken = token;
  removeModalKeys = installModalKeys(dialog, token, (e) => {
    if (e.key === 'Escape') {
      closeModal();
      return true;
    }
    return false;
  });
  armDialogFocus(dialog, 'dialog', 'Select Speech Document');
}
