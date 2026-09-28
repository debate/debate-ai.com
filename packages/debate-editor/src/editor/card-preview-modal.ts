/**
 * Card preview — a full-size, read-only look at a Dropzone shelf item
 * or a received card WITHOUT inserting it anywhere (field request
 * 2026-09-09: the only way to see what a row held was to put it in a
 * document). The dialog takes most of the screen and mounts the same
 * preview Recover Previous Version uses — a real ProseMirror view under
 * the document stylesheet with the real nav pane beside it — plus two
 * actions: Copy (the cards go to the clipboard exactly as a copy from a
 * document would, through the shared clipboard path) and Close.
 */
import { Transform } from 'prosemirror-transform';
import type { Node as PMNode, Slice } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { schema } from '../schema/index.js';
import { checkedSliceFromJSON } from '../schema/slice-check.js';
import { mountVersionPreview as mountDocPreview } from './version-history.js';
import { popOverlay, pushOverlay } from './overlay-stack.js';
import { armDialogFocus, captureFocusForDialog, installModalKeys } from './text-prompt.js';
import { serializeRangesForClipboard } from './clipboard-slice.js';
import { writeClipboardHtml, CLIPBOARD_BUSY_MESSAGE } from './clipboard-write.js';
import { showToast } from './toast.js';
import { settings } from './settings.js';
import { readModePlugin, PMD_READ_MODE_TOGGLE } from './read-mode-plugin.js';

export interface CardPreviewOptions {
  /** Dialog title — the row's label. */
  title: string;
  /** Secondary line beside the title (sender · time), optional. */
  subtitle?: string;
  /** `Slice.toJSON()` payload, as the shelf and the inbox store it. */
  sliceJson: unknown;
}

export const CARD_PREVIEW_UNREADABLE_MESSAGE = 'This card could not be previewed.';

/** The preview's own read-mode switch. Remembered across previews (and
 *  restarts): turn it on once and every later preview opens in read
 *  mode until it is turned off — a browsing setting, not a per-preview
 *  one. Independent of the document's read mode. */
const READ_MODE_KEY = 'pmd-card-preview-read-mode';
export function previewReadModeOn(): boolean {
  try {
    return localStorage.getItem(READ_MODE_KEY) === '1';
  } catch {
    return false;
  }
}
export function setPreviewReadMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(READ_MODE_KEY, '1');
    else localStorage.removeItem(READ_MODE_KEY);
  } catch {
    /* storage unavailable: the switch lasts this preview only */
  }
}

/** The document a stored slice previews as: the slice fitted into an
 *  otherwise empty document (an open-edged slice — a copy that started
 *  mid-card — is closed by the fitter, the way an insert closes it). */
export function docFromSlice(slice: Slice): PMNode {
  const empty = schema.nodes['doc']!.createAndFill()!;
  const tr = new Transform(empty);
  tr.replace(0, empty.content.size, slice);
  return tr.doc;
}

export function docFromSliceJson(sliceJson: unknown): PMNode {
  return docFromSlice(checkedSliceFromJSON(sliceJson));
}

function countCards(doc: PMNode): number {
  let n = 0;
  doc.descendants((node) => {
    if (node.type.name === 'card') n++;
    return node.type.name !== 'card';
  });
  return n;
}

export function copiedLabel(cards: number): string {
  if (cards === 0) return 'Copied to the clipboard';
  return `Copied ${cards} card${cards === 1 ? '' : 's'} to the clipboard`;
}

/**
 * Open the preview. Returns false (with a toast) when the stored payload
 * cannot be rebuilt — the row's insert would fail the same way.
 */
export function openCardPreview(opts: CardPreviewOptions): boolean {
  let doc: PMNode;
  try {
    doc = docFromSliceJson(opts.sliceJson);
  } catch {
    showToast(CARD_PREVIEW_UNREADABLE_MESSAGE);
    return false;
  }

  const overlay = document.createElement('div');
  overlay.className = 'pmd-bulk-overlay pmd-card-preview-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-bulk-dialog pmd-recover-dialog pmd-recover-dialog-wide pmd-card-preview-dialog';
  overlay.appendChild(dialog);

  const token = pushOverlay();
  const restoreFocus = captureFocusForDialog();
  let closed = false;
  let previewView: EditorView | null = null;
  let removeKeys: (() => void) | null = null;
  const close = (): void => {
    if (closed) return;
    closed = true;
    removeKeys?.();
    popOverlay(token);
    previewView?.destroy();
    previewView = null;
    overlay.remove();
    restoreFocus();
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const header = document.createElement('header');
  header.className = 'pmd-bulk-header';
  const heading = document.createElement('div');
  heading.className = 'pmd-card-preview-heading';
  const h = document.createElement('h2');
  h.className = 'pmd-card-preview-title';
  h.textContent = opts.title;
  h.title = opts.title;
  heading.appendChild(h);
  if (opts.subtitle) {
    const sub = document.createElement('span');
    sub.className = 'pmd-card-preview-subtitle';
    sub.textContent = opts.subtitle;
    heading.appendChild(sub);
  }
  header.appendChild(heading);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pmd-bulk-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = 'pmd-bulk-body pmd-recover-body pmd-recover-body-wide pmd-card-preview-body';
  const pane = document.createElement('div');
  pane.className = 'pmd-recover-preview-pane pmd-card-preview-pane';
  body.appendChild(pane);
  dialog.appendChild(body);
  previewView = mountDocPreview(pane, doc, { plugins: [readModePlugin] });
  // Read mode is what the panes do: the read-mode plugin's decorations
  // hide the unmarked text (toggled through its transaction meta) and
  // the host classes carry the CSS half, so the preview shows exactly
  // what the document would.
  const editorHost = pane.querySelector<HTMLElement>('.pmd-recover-preview-editor');
  const applyReadMode = (on: boolean): void => {
    editorHost?.classList.toggle('pmd-read-mode', on);
    editorHost?.classList.toggle('pmd-rm-no-emphasis-borders', on && settings.get('hideEmphasisBordersInReadMode'));
    editorHost?.classList.toggle('pmd-rm-para-integrity', on && settings.get('readModeParagraphIntegrity'));
    editorHost?.classList.toggle('pmd-rm-show-undertags', on && settings.get('readModeShowUndertags'));
    if (previewView && (readModePlugin.getState(previewView.state)?.on ?? false) !== on) {
      previewView.dispatch(previewView.state.tr.setMeta(PMD_READ_MODE_TOGGLE, on));
    }
    readBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    readBtn.title = on ? 'Show everything (read mode is on)' : 'Show only the marked text';
  };

  const actions = document.createElement('div');
  actions.className = 'pmd-bulk-actions pmd-card-preview-actions';
  const readBtn = document.createElement('button');
  readBtn.type = 'button';
  readBtn.className = 'pmd-bulk-btn pmd-card-preview-readmode';
  readBtn.textContent = 'Read mode';
  readBtn.addEventListener('click', () => {
    const on = readBtn.getAttribute('aria-pressed') !== 'true';
    setPreviewReadMode(on);
    applyReadMode(on);
  });
  applyReadMode(previewReadModeOn());
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'pmd-bulk-btn pmd-card-preview-copy';
  copyBtn.textContent = 'Copy to clipboard';
  copyBtn.title = 'Copy these cards; paste them wherever you like';
  copyBtn.addEventListener('click', () => {
    if (!previewView || copyBtn.disabled) return;
    copyBtn.disabled = true;
    // The shared clipboard path — the same payload a copy from a document
    // produces (and the same comment-thread serialization).
    const { html, text } = serializeRangesForClipboard(previewView, [
      { from: 0, to: previewView.state.doc.content.size },
    ]);
    void writeClipboardHtml(html, text).then((ok) => {
      if (closed) return;
      if (!ok) {
        copyBtn.disabled = false;
        showToast(CLIPBOARD_BUSY_MESSAGE);
        return;
      }
      showToast(copiedLabel(countCards(doc)));
      close();
    });
  });
  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'pmd-bulk-btn pmd-bulk-btn-primary pmd-card-preview-close';
  doneBtn.textContent = 'Close';
  doneBtn.addEventListener('click', close);
  actions.append(readBtn, copyBtn, doneBtn);
  dialog.appendChild(actions);

  // Escape closes; every other key aimed at the dialog's own surfaces (the
  // preview's selection keys, the nav pane) runs natively, and nothing
  // falls through to the document underneath.
  removeKeys = installModalKeys(dialog, token, (e) => {
    if (e.key === 'Escape') {
      close();
      return true;
    }
    return false;
  });

  document.body.appendChild(overlay);
  armDialogFocus(dialog, 'dialog', `Preview: ${opts.title}`);
  return true;
}
