/**
 * Bulk-compress modal — a temporary migration tool.
 *
 * `.cmir` files are gzip-compressed on save, but a corpus written by
 * older builds only shrinks as files are re-saved. This walks a
 * chosen folder and rewrites every `.cmir` compressed, in place. The heavy
 * lifting (skip-if-already-compressed, lossless verify, atomic rename,
 * mtime preservation) runs in the main process (`host:bulk-compress`); this
 * is just the picker + progress UI. Desktop-only.
 *
 * Intended to ship for only a few releases while corpora migrate, then be
 * removed — kept in its own file so that's a clean deletion.
 */

import { getElectronHost } from './host/index.js';
import { parseNative, serializeNative } from '../index.js';
import { runWebFileTool } from './web-file-tools.js';
import type { BulkCompressProgress } from './host/ipc-types.js';
import { setIcon } from './icons';

function baseName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pmd-bulk-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

class BulkCompressModal {
  private readonly overlay: HTMLDivElement;
  private readonly dialog: HTMLDivElement;
  private statusEl!: HTMLDivElement;
  private barFillEl!: HTMLDivElement;
  private folderPathEl!: HTMLDivElement;
  private runBtn!: HTMLButtonElement;
  private busy = false;
  private settled = false;
  private folder: string | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pmd-bulk-overlay';
    this.dialog = document.createElement('div');
    this.dialog.className = 'pmd-bulk-dialog';
    this.overlay.appendChild(this.dialog);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener('keydown', this.onKey, true);
    this.render();
    document.body.appendChild(this.overlay);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !this.busy) {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  };

  private close(): void {
    if (this.settled || this.busy) return;
    this.settled = true;
    document.removeEventListener('keydown', this.onKey, true);
    this.overlay.remove();
  }

  private render(): void {
    const header = document.createElement('header');
    header.className = 'pmd-bulk-header';
    const h = document.createElement('h2');
    h.textContent = 'Bulk compress';
    header.appendChild(h);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pmd-bulk-close';
    setIcon(close, 'close');
    close.title = 'Close';
    close.addEventListener('click', () => this.close());
    header.appendChild(close);
    this.dialog.appendChild(header);

    const body = document.createElement('div');
    body.className = 'pmd-bulk-body';

    const blurb = document.createElement('p');
    blurb.className = 'pmd-bulk-blurb';
    blurb.textContent =
      'Rewrites every .cmir file in a folder (and its subfolders) in compressed form, in place — typically ~10× smaller. Files already compressed are skipped, and each file is verified before it is replaced, so this is safe to run (and re-run) on your library.';
    body.appendChild(blurb);

    const field = document.createElement('div');
    field.className = 'pmd-bulk-field';
    const label = document.createElement('div');
    label.className = 'pmd-bulk-field-label';
    label.textContent = 'Folder';
    field.appendChild(label);
    const pickRow = document.createElement('div');
    pickRow.className = 'pmd-bulk-pickrow';
    pickRow.appendChild(button('Choose folder…', () => void this.pickFolder()));
    field.appendChild(pickRow);
    this.folderPathEl = document.createElement('div');
    this.folderPathEl.className = 'pmd-bulk-path';
    field.appendChild(this.folderPathEl);
    body.appendChild(field);

    const actions = document.createElement('div');
    actions.className = 'pmd-bulk-actions';
    this.runBtn = button('Compress', () => void this.run());
    this.runBtn.classList.add('pmd-bulk-btn-primary');
    actions.appendChild(this.runBtn);
    body.appendChild(actions);

    const bar = document.createElement('div');
    bar.className = 'pmd-bulk-progress';
    this.barFillEl = document.createElement('div');
    this.barFillEl.className = 'pmd-bulk-progress-fill';
    bar.appendChild(this.barFillEl);
    body.appendChild(bar);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'pmd-bulk-status';
    body.appendChild(this.statusEl);

    this.dialog.appendChild(body);
    this.refresh();
  }

  private refresh(): void {
    this.folderPathEl.textContent = this.folder ? this.folder : 'None selected';
    this.folderPathEl.classList.toggle('pmd-bulk-path-set', !!this.folder);
    this.runBtn.disabled = this.busy || !this.folder;
  }

  private setBusy(on: boolean): void {
    this.busy = on;
    this.dialog.classList.toggle('pmd-bulk-busy', on);
    this.refresh();
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }

  private setProgress(done: number, total: number): void {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    this.barFillEl.style.width = `${pct}%`;
  }

  private async pickFolder(): Promise<void> {
    const electron = getElectronHost();
    if (!electron) return;
    const folder = await electron.pickDirectory({ title: 'Choose a folder to compress' });
    if (!folder) return;
    this.folder = folder;
    this.refresh();
  }

  private async run(): Promise<void> {
    if (this.busy || !this.folder) return;
    const electron = getElectronHost();
    if (!electron) {
      this.setStatus('Bulk compress requires the desktop edition.');
      return;
    }
    const folder = this.folder;
    this.setBusy(true);
    this.setProgress(0, 1);
    this.setStatus(`Scanning ${baseName(folder)}…`);
    try {
      const onProgress = (p: BulkCompressProgress): void => {
        this.setProgress(p.done, p.total);
        this.setStatus(`Compressing ${p.done.toLocaleString()} / ${p.total.toLocaleString()}…`);
      };
      const r = await electron.bulkCompress(folder, onProgress);
      this.setProgress(1, 1);
      if (r.total === 0) {
        this.setStatus('No .cmir files found in that folder.');
        return;
      }
      const saved = r.bytesBefore - r.bytesAfter;
      const parts = [`Compressed ${r.compressed.toLocaleString()}`];
      if (r.skipped) parts.push(`${r.skipped.toLocaleString()} already compressed`);
      if (r.failed) parts.push(`${r.failed.toLocaleString()} failed (see console)`);
      this.setStatus(
        `Done — ${parts.join(', ')}. ` +
          `Saved ${formatBytes(saved)} (${formatBytes(r.bytesBefore)} → ${formatBytes(r.bytesAfter)}).`,
      );
    } catch (err) {
      this.setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.setBusy(false);
    }
  }
}

export function openBulkCompress(): void {
  new BulkCompressModal();
}

/** Web single-file Compress: pick one `.cmir`, rewrite it gzip-compressed
 *  (parse + re-serialize, preserving threads + docId), and Save-As the smaller
 *  copy. The web edition can't do the desktop in-place folder walk, so it works
 *  one file at a time. */
export function runCompressSingleFileWeb(): Promise<void> {
  return runWebFileTool({
    label: 'Compress',
    verb: 'Compressing',
    accept: /\.cmir$/i,
    acceptMsg: 'Compress works on .cmir files — please choose a .cmir file.',
    run: async (bytes, name) => {
      const { doc, threads, docId } = parseNative(bytes);
      const out = serializeNative(doc, {
        ...(threads.length ? { threads } : {}),
        ...(docId ? { docId } : {}),
      });
      const before = bytes.length;
      const after = out.length;
      const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
      return {
        bytes: out,
        outputName: name,
        filter: { name: 'CardMirror document', extensions: ['cmir'] },
        resultNote:
          after < before
            ? `Compressed: ${formatBytes(before)} → ${formatBytes(after)} (${pct}% smaller).`
            : `Already compact (${formatBytes(after)}).`,
      };
    },
  });
}
