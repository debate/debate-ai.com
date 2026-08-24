/**
 * Clean — a home-screen utility that cleans a `.docx`'s styles to the
 * Verbatim-standard scheme (convert direct formatting to semantic styles,
 * rename/remove stray styles, strip hyperlinks). It can clean a single file or
 * a whole folder (recursed), writing cleaned copies into a chosen destination.
 *
 * The cleaning runs entirely client-side over the style cleaner in
 * `ooxml/style-clean`. Electron-only: needs recursive directory listing +
 * write-to-path, so the home screen only surfaces it on the desktop edition.
 */

import { cleanDocumentBytes } from '../ooxml/style-clean/style-cleaner.js';
import { runWebFileTool } from './web-file-tools.js';
import { Docx } from '../ooxml/docx.js';
import { getHost, getElectronHost } from './host/index.js';
import { settings } from './settings.js';
import { setIcon } from './icons';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Read distinct style names (with a paragraph/character/… label) from a
 *  .docx's styles.xml, for the "add from template" picker. */
async function readTemplateStyleNames(bytes: Uint8Array): Promise<{ name: string; type: string }[]> {
  const docx = await Docx.load(bytes);
  const xml = await docx.readText('word/styles.xml');
  if (xml === null) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const seen = new Map<string, string>();
  for (const style of Array.from(doc.getElementsByTagNameNS(W_NS, 'style'))) {
    const nameEl = style.getElementsByTagNameNS(W_NS, 'name')[0];
    const name = nameEl ? (nameEl.getAttributeNS(W_NS, 'val') ?? nameEl.getAttribute('w:val')) : null;
    if (!name || seen.has(name)) continue;
    seen.set(name, style.getAttributeNS(W_NS, 'type') ?? style.getAttribute('w:type') ?? '');
  }
  return [...seen.entries()]
    .map(([name, type]) => ({ name, type }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface InputSel {
  kind: 'file' | 'folder';
  path: string;
  name: string;
  /** Bytes (file input only). */
  bytes?: Uint8Array;
}

function baseName(p: string): string {
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p;
}

/** Join a destination dir + relative path with a forward slash
 *  (Node's fs accepts it on every platform). */
function joinPath(dir: string, rel: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${rel.replace(/^[\\/]+/, '')}`;
}

/** Prefix the basename of a relative path with `cleaned_` (so output never
 *  overwrites a source file even if the destination is the source folder). */
export function cleanedRel(rel: string): string {
  const norm = rel.replace(/\\/g, '/');
  const slash = norm.lastIndexOf('/');
  const dir = slash >= 0 ? norm.slice(0, slash + 1) : '';
  const base = slash >= 0 ? norm.slice(slash + 1) : norm;
  return `${dir}cleaned_${base}`;
}

/** The phrase the in-place overwrite dialog makes you type out. */
export const OVERWRITE_CONFIRM_PHRASE = 'I accept the risk';

/** Whether what the user typed counts as the confirmation phrase.
 *
 *  Case- and spacing-insensitive on purpose: this is a "prove you read the
 *  warning" ritual, not a password, and the dialog has already shouted the
 *  phrase in a label whose `text-transform: uppercase` makes it LOOK like it
 *  wants caps. Matching exactly meant anyone who typed what the screen showed
 *  was locked out of their own confirmation with no way to tell why. Pure (no
 *  view) so it can be unit-tested. */
export function matchesOverwriteConfirmPhrase(typed: string): boolean {
  const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();
  return norm(typed) === norm(OVERWRITE_CONFIRM_PHRASE);
}

/** The directory part of a file path (its containing folder). */
function dirName(p: string): string {
  const m = p.replace(/[\\/]+$/, '').match(/^(.*)[\\/][^\\/]*$/);
  return m ? m[1]! : '';
}

/** Whether the given Clean options would write over the source files — i.e. NOT
 *  prepending `cleaned_`, AND the destination resolves to the source's own
 *  folder (the default null destination, or a chosen folder equal to the
 *  source). Prepending always writes new files; a different destination writes
 *  copies there. Pure (no view) so it can be unit-tested. */
export function cleanOverwritesInPlace(opts: {
  prepend: boolean;
  inputKind: 'file' | 'folder';
  inputPath: string;
  outputDir: string | null;
}): boolean {
  if (opts.prepend) return false;
  const norm = (p: string): string => p.replace(/[\\/]+$/, '');
  const sourceRoot = opts.inputKind === 'file' ? dirName(opts.inputPath) : opts.inputPath;
  const dest = opts.outputDir ?? sourceRoot;
  return norm(dest) === norm(sourceRoot);
}

class CleanModal {
  private readonly overlay: HTMLDivElement;
  private readonly dialog: HTMLDivElement;
  private statusEl!: HTMLDivElement;
  private inputPathEl!: HTMLDivElement;
  private outputPathEl!: HTMLDivElement;
  private cleanBtn!: HTMLButtonElement;
  private barFillEl!: HTMLDivElement;
  private protectedListEl: HTMLDivElement | null = null;
  /** Stacked sub-modals (the protected-styles editor, the template picker)
   *  layered over the Clean modal. Escape closes the topmost first. */
  private subOverlays: { el: HTMLDivElement; onClose?: () => void }[] = [];
  private busy = false;
  private settled = false;

  private inputSel: InputSel | null = null;
  private outputDir: string | null = null;
  /** Whether to prefix output filenames with `cleaned_`. On (default) always
   *  writes NEW files; off writes the original name — which overwrites the
   *  originals in place when the destination is their own folder (gated behind a
   *  typed confirmation in `onCleanClick`). */
  private prepend = true;

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
      // Capture-phase: stop Escape from also reaching the home screen's
      // keydown handler (which would dismiss home under the closing modal).
      e.stopPropagation();
      // Close the topmost open sub-modal first, else the Clean modal itself.
      if (!this.closeTopSubOverlay()) this.close();
    }
  };

  private close(): void {
    if (this.settled || this.busy) return;
    this.settled = true;
    document.removeEventListener('keydown', this.onKey, true);
    for (const s of this.subOverlays.splice(0)) s.el.remove();
    this.overlay.remove();
  }

  private render(): void {
    const header = document.createElement('header');
    header.className = 'pmd-bulk-header';
    const h = document.createElement('h2');
    h.textContent = 'Clean';
    header.appendChild(h);
    const gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'pmd-bulk-close';
    setIcon(gear, 'settings');
    gear.title = 'Protected styles';
    gear.addEventListener('click', () => this.openProtectedModal());
    header.appendChild(gear);
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
      'Cleans a .docx’s styles to the Verbatim standard — converting stray ' +
      'formatting to the right styles, removing junk styles, and stripping ' +
      'hyperlinks. Cleaned copies are written to the destination.';
    body.appendChild(blurb);

    // Input.
    const inField = document.createElement('div');
    inField.className = 'pmd-bulk-field';
    const inLabel = document.createElement('div');
    inLabel.className = 'pmd-bulk-field-label';
    inLabel.textContent = 'Input';
    inField.appendChild(inLabel);
    const inBtns = document.createElement('div');
    inBtns.className = 'pmd-bulk-pickrow';
    inBtns.append(
      button('Choose file…', () => void this.pickFile()),
      button('Choose folder…', () => void this.pickFolder()),
    );
    inField.appendChild(inBtns);
    this.inputPathEl = document.createElement('div');
    this.inputPathEl.className = 'pmd-bulk-path';
    inField.appendChild(this.inputPathEl);
    body.appendChild(inField);

    // Destination.
    const outField = document.createElement('div');
    outField.className = 'pmd-bulk-field';
    const outLabel = document.createElement('div');
    outLabel.className = 'pmd-bulk-field-label';
    outLabel.textContent = 'Destination';
    outField.appendChild(outLabel);
    const outBtns = document.createElement('div');
    outBtns.className = 'pmd-bulk-pickrow';
    outBtns.append(button('Choose destination…', () => void this.pickDestination()));
    outField.appendChild(outBtns);
    this.outputPathEl = document.createElement('div');
    this.outputPathEl.className = 'pmd-bulk-path';
    outField.appendChild(this.outputPathEl);

    // Prepend toggle. On → `cleaned_…` copies (never touches the originals).
    // Off → the original filename, which overwrites the originals when the
    // destination is their own folder.
    const prependRow = document.createElement('label');
    prependRow.className = 'pmd-clean-prepend-row';
    const prependCb = document.createElement('input');
    prependCb.type = 'checkbox';
    prependCb.checked = this.prepend;
    prependCb.addEventListener('change', () => {
      this.prepend = prependCb.checked;
      this.refresh();
    });
    const prependLabel = document.createElement('span');
    prependLabel.textContent = 'Prepend “cleaned_” to output filenames';
    prependRow.append(prependCb, prependLabel);
    outField.appendChild(prependRow);

    body.appendChild(outField);

    // Clean.
    const actions = document.createElement('div');
    actions.className = 'pmd-bulk-actions';
    this.cleanBtn = button('Clean', () => void this.onCleanClick());
    this.cleanBtn.classList.add('pmd-bulk-btn-primary');
    actions.appendChild(this.cleanBtn);
    body.appendChild(actions);

    // Progress bar — runs processed within the current file.
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

  // ── Protected styles (a separate modal opened from the gear) ────────

  private openProtectedModal(): void {
    const overlay = document.createElement('div');
    overlay.className = 'pmd-bulk-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'pmd-bulk-dialog pmd-clean-prot-dialog';
    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeSubOverlay(overlay);
    });

    const header = document.createElement('header');
    header.className = 'pmd-bulk-header';
    const h = document.createElement('h2');
    h.textContent = 'Protected styles';
    header.appendChild(h);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pmd-bulk-close';
    setIcon(close, 'close');
    close.title = 'Close';
    close.addEventListener('click', () => this.closeSubOverlay(overlay));
    header.appendChild(close);
    dialog.appendChild(header);

    const body = document.createElement('div');
    body.className = 'pmd-bulk-body';

    const blurb = document.createElement('p');
    blurb.className = 'pmd-bulk-blurb';
    blurb.textContent =
      'Styles listed here are never removed or reassigned by Clean (their ' +
      'dependencies are kept too). Match is by name, case-insensitive.';
    body.appendChild(blurb);

    this.protectedListEl = document.createElement('div');
    this.protectedListEl.className = 'pmd-clean-prot-list';
    body.appendChild(this.protectedListEl);

    // Add manually.
    const addField = document.createElement('div');
    addField.className = 'pmd-bulk-field';
    const addLabel = document.createElement('div');
    addLabel.className = 'pmd-bulk-field-label';
    addLabel.textContent = 'Add a style';
    addField.appendChild(addLabel);
    const addRow = document.createElement('div');
    addRow.className = 'pmd-clean-prot-addrow';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Style name';
    input.className = 'pmd-clean-prot-input';
    const submit = (): void => {
      const v = input.value.trim();
      if (v) {
        this.addNames([v]);
        input.value = '';
      }
      input.focus();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    // Compact +/template buttons matching the keyboard-macros editor.
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'pmd-keybinding-add';
    addBtn.textContent = '+';
    addBtn.title = 'Add';
    addBtn.addEventListener('click', submit);
    const tmplBtn = document.createElement('button');
    tmplBtn.type = 'button';
    tmplBtn.className = 'pmd-readers-add pmd-clean-prot-template';
    tmplBtn.textContent = '+ Add from template';
    tmplBtn.addEventListener('click', () => void this.addFromTemplate());
    addRow.append(input, addBtn);
    // "Add from template" sits on its own line so it doesn't read as tied to
    // the style-name box.
    addField.append(addRow, tmplBtn);
    body.appendChild(addField);

    const actions = document.createElement('div');
    actions.className = 'pmd-bulk-actions';
    const done = button('Done', () => this.closeSubOverlay(overlay));
    done.classList.add('pmd-bulk-btn-primary');
    actions.appendChild(done);
    body.appendChild(actions);

    dialog.appendChild(body);
    this.pushSubOverlay(overlay, () => {
      this.protectedListEl = null;
    });
    this.refreshProtectedList();
    input.focus();
  }

  // ── Stacked sub-modals (Escape closes the topmost) ─────────────────

  private pushSubOverlay(el: HTMLDivElement, onClose?: () => void): void {
    this.subOverlays.push({ el, onClose });
    document.body.appendChild(el);
  }

  private closeSubOverlay(el: HTMLDivElement): void {
    const idx = this.subOverlays.findIndex((s) => s.el === el);
    if (idx < 0) return;
    const [removed] = this.subOverlays.splice(idx, 1);
    el.remove();
    removed?.onClose?.();
  }

  private closeTopSubOverlay(): boolean {
    const top = this.subOverlays[this.subOverlays.length - 1];
    if (!top) return false;
    this.closeSubOverlay(top.el);
    return true;
  }

  private getProtectedNames(): string[] {
    return settings.get('cleanProtectedStyles');
  }

  private saveNames(names: string[]): void {
    const cleaned = Array.from(
      new Set(names.map((n) => n.trim()).filter((n) => n.length > 0)),
    );
    settings.set('cleanProtectedStyles', cleaned);
    this.refreshProtectedList();
  }

  private addNames(names: string[]): void {
    this.saveNames([...this.getProtectedNames(), ...names]);
  }

  private refreshProtectedList(): void {
    const listEl = this.protectedListEl;
    if (!listEl) return; // the editor modal isn't open
    const names = this.getProtectedNames();
    listEl.innerHTML = '';
    if (names.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pmd-clean-prot-empty';
      empty.textContent = 'None yet.';
      listEl.appendChild(empty);
      return;
    }
    names.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'pmd-clean-prot-row';
      const field = document.createElement('input');
      field.type = 'text';
      field.value = name;
      field.className = 'pmd-clean-prot-input';
      field.addEventListener('change', () => {
        const next = [...this.getProtectedNames()];
        next[i] = field.value;
        this.saveNames(next);
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pmd-keybinding-chip-remove pmd-clean-prot-remove';
      remove.title = 'Remove';
      setIcon(remove, 'close');
      remove.addEventListener('click', () => {
        const next = this.getProtectedNames().filter((_, j) => j !== i);
        this.saveNames(next);
      });
      row.append(field, remove);
      listEl.appendChild(row);
    });
  }

  private async addFromTemplate(): Promise<void> {
    const opened = await getHost().openFile({
      filters: [{ name: '.docx', extensions: ['docx'] }],
    });
    if (!opened || !opened.bytes) return;
    let styles: { name: string; type: string }[];
    try {
      styles = await readTemplateStyleNames(opened.bytes);
    } catch {
      styles = [];
    }
    if (styles.length === 0) return;
    this.showTemplatePicker(styles);
  }

  private showTemplatePicker(styles: { name: string; type: string }[]): void {
    const existing = new Set(this.getProtectedNames().map((n) => n.toLowerCase()));
    const overlay = document.createElement('div');
    overlay.className = 'pmd-bulk-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'pmd-bulk-dialog';
    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeSubOverlay(overlay);
    });

    const header = document.createElement('header');
    header.className = 'pmd-bulk-header';
    const h = document.createElement('h2');
    h.textContent = 'Add from template';
    header.appendChild(h);
    dialog.appendChild(header);

    const body = document.createElement('div');
    body.className = 'pmd-bulk-body';
    const hint = document.createElement('p');
    hint.className = 'pmd-bulk-blurb';
    hint.textContent = 'Select styles to protect.';
    body.appendChild(hint);

    const list = document.createElement('div');
    list.className = 'pmd-clean-prot-picklist';
    const checks: { name: string; input: HTMLInputElement }[] = [];
    for (const s of styles) {
      const row = document.createElement('label');
      row.className = 'pmd-bulk-radio';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      if (existing.has(s.name.toLowerCase())) {
        cb.checked = true;
        cb.disabled = true;
      }
      const text = document.createElement('span');
      text.textContent = s.type && s.type !== 'paragraph' ? `${s.name}  ·  ${s.type}` : s.name;
      row.append(cb, text);
      list.appendChild(row);
      checks.push({ name: s.name, input: cb });
    }
    body.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'pmd-bulk-actions';
    const add = button('Add selected', () => {
      const picked = checks.filter((c) => c.input.checked && !c.input.disabled).map((c) => c.name);
      if (picked.length) this.addNames(picked);
      this.closeSubOverlay(overlay);
    });
    add.classList.add('pmd-bulk-btn-primary');
    actions.append(add, button('Cancel', () => this.closeSubOverlay(overlay)));
    body.appendChild(actions);

    dialog.appendChild(body);
    this.pushSubOverlay(overlay);
  }

  private setProgress(done: number, total: number): void {
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    this.barFillEl.style.width = `${pct}%`;
  }

  /** Update path displays + the Clean button's enabled state. */
  private refresh(): void {
    this.inputPathEl.textContent = this.inputSel
      ? `${this.inputSel.kind === 'folder' ? 'Folder' : 'File'}: ${this.inputSel.path}`
      : 'None selected';
    this.inputPathEl.classList.toggle('pmd-bulk-path-set', !!this.inputSel);
    const overwrite = this.wouldOverwriteInPlace();
    this.outputPathEl.textContent = overwrite
      ? '⚠ Overwrites the originals in place — not reversible'
      : this.outputDir
      ? this.outputDir
      : 'Same location as the original (default)';
    this.outputPathEl.classList.toggle('pmd-bulk-path-set', !!this.outputDir && !overwrite);
    this.outputPathEl.classList.toggle('pmd-clean-overwrite-hint', overwrite);
    this.cleanBtn.disabled = this.busy || !this.inputSel;
  }

  private setBusy(on: boolean): void {
    this.busy = on;
    this.dialog.classList.toggle('pmd-bulk-busy', on);
    this.refresh();
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }

  // ── Pickers ───────────────────────────────────────────────────────

  private async pickFile(): Promise<void> {
    const opened = await getHost().openFile({
      filters: [{ name: '.docx', extensions: ['docx'] }],
    });
    if (!opened || typeof opened.handle !== 'string') return;
    this.inputSel = { kind: 'file', path: opened.handle, name: opened.name, bytes: opened.bytes };
    this.refresh();
  }

  private async pickFolder(): Promise<void> {
    const electron = getElectronHost();
    if (!electron) return;
    const folder = await electron.pickDirectory({ title: 'Choose a folder to clean' });
    if (!folder) return;
    this.inputSel = { kind: 'folder', path: folder, name: baseName(folder) };
    this.refresh();
  }

  private async pickDestination(): Promise<void> {
    const electron = getElectronHost();
    if (!electron) return;
    const dest = await electron.pickDirectory({ title: 'Choose a destination folder' });
    if (!dest) return;
    this.outputDir = dest;
    this.refresh();
  }

  // ── Overwrite gating ──────────────────────────────────────────────

  /** True when the current options would write over the source files. Delegates
   *  to the pure `cleanOverwritesInPlace`. */
  private wouldOverwriteInPlace(): boolean {
    if (!this.inputSel) return false;
    return cleanOverwritesInPlace({
      prepend: this.prepend,
      inputKind: this.inputSel.kind,
      inputPath: this.inputSel.path,
      outputDir: this.outputDir,
    });
  }

  /** Clean-button handler: gate an in-place overwrite behind a typed
   *  confirmation; otherwise start cleaning straight away. */
  private async onCleanClick(): Promise<void> {
    if (this.busy || !this.inputSel) return;
    if (this.wouldOverwriteInPlace() && !(await this.confirmOverwrite())) return;
    void this.run();
  }

  /** Modal that requires the user to type the exact phrase before overwriting
   *  the originals in place. Resolves true only when they confirm. */
  private confirmOverwrite(): Promise<boolean> {
    const PHRASE = OVERWRITE_CONFIRM_PHRASE;
    return new Promise<boolean>((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'pmd-bulk-overlay';
      const dialog = document.createElement('div');
      dialog.className = 'pmd-bulk-dialog pmd-clean-overwrite-dialog';
      overlay.appendChild(dialog);

      let settled = false;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        resolve(ok);
        this.closeSubOverlay(overlay);
      };
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(false);
      });

      const header = document.createElement('header');
      header.className = 'pmd-bulk-header';
      const h = document.createElement('h2');
      h.textContent = 'Overwrite files in place?';
      header.appendChild(h);
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'pmd-bulk-close';
      setIcon(close, 'close');
      close.title = 'Cancel';
      close.addEventListener('click', () => finish(false));
      header.appendChild(close);
      dialog.appendChild(header);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'pmd-bulk-body';
      const warn = document.createElement('p');
      warn.className = 'pmd-bulk-blurb pmd-clean-overwrite-warn';
      warn.textContent =
        'You are about to overwrite the original files in place. This cannot be undone, ' +
        'and there is a chance the cleaner destroys some of your formatting.';
      bodyEl.appendChild(warn);

      const prompt = document.createElement('label');
      // Not uppercased like sibling field labels: this one names a string the
      // user has to reproduce, so it must read exactly as typed.
      prompt.className = 'pmd-bulk-field-label pmd-clean-overwrite-prompt';
      prompt.textContent = `Type “${PHRASE}” to proceed:`;
      bodyEl.appendChild(prompt);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pmd-clean-prot-input';
      input.placeholder = PHRASE;
      input.autocomplete = 'off';
      input.spellcheck = false;
      bodyEl.appendChild(input);

      const actions = document.createElement('div');
      actions.className = 'pmd-bulk-actions';
      const cancel = button('Cancel', () => finish(false));
      const confirm = button('Confirm Overwrite', () => {
        if (matchesOverwriteConfirmPhrase(input.value)) finish(true);
      });
      confirm.classList.add('pmd-bulk-btn-primary', 'pmd-clean-overwrite-confirm');
      confirm.disabled = true;
      input.addEventListener('input', () => {
        confirm.disabled = !matchesOverwriteConfirmPhrase(input.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && matchesOverwriteConfirmPhrase(input.value)) {
          e.preventDefault();
          finish(true);
        }
      });
      actions.append(cancel, confirm);
      bodyEl.appendChild(actions);

      dialog.appendChild(bodyEl);
      // Escape (closeTopSubOverlay) → onClose → treat as cancel.
      this.pushSubOverlay(overlay, () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });
      input.focus();
    });
  }

  // ── Clean ─────────────────────────────────────────────────────────

  private async run(): Promise<void> {
    if (this.busy || !this.inputSel) return;
    const electron = getElectronHost();
    if (!electron) {
      this.setStatus('Clean requires the desktop edition.');
      return;
    }
    const protectedStyleNames = this.getProtectedNames();
    // No destination chosen → write next to the originals (same location).
    const dest = this.outputDir;
    const input = this.inputSel;
    const runs = (cur: number, tot: number, prefix: string): void => {
      this.setProgress(cur, tot);
      this.setStatus(`${prefix} (${cur.toLocaleString()} / ${tot.toLocaleString()} runs)`);
    };
    this.setBusy(true);
    try {
      if (input.kind === 'file') {
        const destDir = dest ?? dirName(input.path);
        this.setProgress(0, 1);
        const cleaned = await cleanDocumentBytes(input.bytes!, {
          protectedStyleNames,
          progressCallback: (cur, tot) => runs(cur, tot, `Cleaning ${input.name}…`),
        });
        const outName = this.prepend ? `cleaned_${input.name}` : input.name;
        await electron.writeFileAtPath(joinPath(destDir, outName), cleaned);
        this.setProgress(1, 1);
        this.setStatus(`Cleaned “${input.name}”.`);
      } else {
        const destRoot = dest ?? input.path;
        this.setStatus('Scanning…');
        const files = await electron.listFilesRecursive(input.path, 'docx');
        if (files.length === 0) {
          this.setStatus('No .docx files found in that folder.');
          return;
        }
        let ok = 0;
        let failed = 0;
        let invalid = 0;
        for (let i = 0; i < files.length; i++) {
          const f = files[i]!;
          this.setProgress(0, 1);
          try {
            const read = await electron.readFileAtPath(f.path);
            if (!read) throw new Error('unreadable');
            const cleaned = await cleanDocumentBytes(read.bytes, {
              protectedStyleNames,
              progressCallback: (cur, tot) =>
                runs(cur, tot, `Cleaning ${i + 1} / ${files.length}: ${baseName(f.relPath)}…`),
            });
            const outRel = this.prepend ? cleanedRel(f.relPath) : f.relPath;
            await electron.writeFileAtPath(joinPath(destRoot, outRel), cleaned);
            ok++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // A file that isn't a readable .docx zip (empty, truncated, or a
            // non-document) is "skipped", not "failed" — separate it out so a
            // few corrupt files (e.g. zero-byte cloud conflict copies) don't
            // read as cleaning failures.
            if (/central directory|corrupted zip|end of data|is this a zip/i.test(msg)) {
              invalid++;
              console.warn('Skipped (not a valid .docx):', f.path);
            } else {
              failed++;
              console.error('Clean failed for', f.path, err);
            }
          }
        }
        this.setProgress(1, 1);
        const parts = [`${ok} cleaned`];
        if (invalid) parts.push(`${invalid} skipped (not a valid .docx)`);
        if (failed) parts.push(`${failed} failed (see console)`);
        this.setStatus(`Done — ${parts.join(', ')}.`);
      }
    } catch (err) {
      this.setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.setBusy(false);
    }
  }
}

// ── Small DOM helper ──────────────────────────────────────────────────

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pmd-bulk-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

export function openClean(): void {
  new CleanModal();
}

/** Web single-file Clean: pick one `.docx`, clean its styles to the Verbatim
 *  standard behind a progress modal, and Save-As the result (prefixed
 *  `cleaned_`). The web edition can't do the desktop folder-recursive flow, so it
 *  works one file at a time. */
export function runCleanSingleFileWeb(): Promise<void> {
  return runWebFileTool({
    label: 'Clean',
    verb: 'Cleaning',
    accept: /\.docx$/i,
    acceptMsg: 'Clean works on .docx files — please choose a .docx file.',
    run: async (bytes, name) => ({
      bytes: await cleanDocumentBytes(bytes),
      outputName: `cleaned_${name}`,
      filter: { name: 'Word document', extensions: ['docx'] },
    }),
  });
}
