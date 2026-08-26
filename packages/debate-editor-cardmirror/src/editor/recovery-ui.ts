/**
 * Crash-recovery sidebar.
 *
 * Word-style left panel that shows journal entries left over from
 * a previous session. Each row lets the user **Save** the draft to
 * disk, **Open** it in the editor for inspection, or **Discard** it
 * (delete the journal). Drafts the user neither saves nor discards
 * stay in the journal store and reappear on the next launch.
 *
 * Unlike a modal, the sidebar coexists with the editor — the user
 * can scroll through one draft, decide, then click another. The
 * sidebar lays out to the right of the nav-pane, pushing the
 * editor area further right; closing it returns the editor to its
 * normal width.
 *
 * Promise-based: resolves when the user closes the sidebar (or
 * once every entry has been saved or discarded).
 */

import type { JournalEntry } from './host/index.js';
import { setIcon } from './icons';
import { isAnyOverlayOpen } from './overlay-stack.js';

export interface RecoverySidebarCallbacks {
  /** Called when the user clicks Save on a row. Should write the
   *  entry's bytes to disk (in-place if `entry.handle` is set,
   *  otherwise via a Save-As dialog) WITHOUT mounting the doc
   *  into the editor. Returns `true` if the user saved (the
   *  sidebar removes the row); `false` if cancelled. The callback
   *  is responsible for deleting the journal entry on success. */
  onSave(entry: JournalEntry): Promise<boolean> | boolean;
  /** Called when the user clicks Open on a row. Should mount the
   *  entry's doc into the editor. The sidebar marks the row as
   *  "Currently open" but doesn't remove it — the user can open
   *  others to compare, and only Save or Discard finalizes. */
  onOpen(entry: JournalEntry): Promise<void> | void;
  /** Called when the user clicks Discard. The sidebar removes the
   *  row from its list before invoking; the callback should delete
   *  the journal entry from the host store. */
  onDiscard(entry: JournalEntry): Promise<void> | void;
}

export function openRecoverySidebar(
  entries: JournalEntry[],
  callbacks: RecoverySidebarCallbacks,
): Promise<void> {
  return new Promise((resolve) => {
    new RecoverySidebar(entries, callbacks, resolve);
  });
}

class RecoverySidebar {
  private readonly root: HTMLElement;
  private readonly listEl: HTMLDivElement;
  /** UID of the entry currently mounted in the editor (if any) —
   *  drives the "Currently open" visual indicator. Null when the
   *  user hasn't opened any draft yet (or has switched away). */
  private currentlyOpenUid: string | null = null;
  /** Live list of remaining entries. Mutated by Discard. */
  private entries: JournalEntry[];
  private settled = false;

  constructor(
    initialEntries: JournalEntry[],
    private readonly callbacks: RecoverySidebarCallbacks,
    private readonly settle: () => void,
  ) {
    this.entries = [...initialEntries];

    this.root = document.createElement('aside');
    this.root.className = 'pmd-recovery-sidebar';
    document.body.appendChild(this.root);
    document.body.classList.add('pmd-recovery-active');

    document.addEventListener('keydown', this.handleKey);

    this.listEl = document.createElement('div');
    this.listEl.className = 'pmd-recovery-sidebar-list';

    this.render();
  }

  private readonly handleKey = (e: KeyboardEvent): void => {
    if (this.settled) return;
    if (e.key !== 'Escape') return;
    // A modal dialog above (e.g. a row's Save-As flow) owns the
    // keyboard — its Escape must not also close the sidebar.
    if (isAnyOverlayOpen()) return;
    e.preventDefault();
    e.stopPropagation();
    this.close();
  };

  private render(): void {
    this.root.innerHTML = '';

    const header = document.createElement('header');
    header.className = 'pmd-recovery-sidebar-header';
    const title = document.createElement('h2');
    title.textContent = 'Recover drafts';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'pmd-recovery-sidebar-close';
    setIcon(closeBtn, 'close');
    closeBtn.title = 'Close — drafts left here will reappear next time you launch CardMirror';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    this.root.appendChild(header);

    const intro = document.createElement('p');
    intro.className = 'pmd-recovery-sidebar-intro';
    intro.textContent =
      'These drafts weren\'t saved last time. Save writes the draft to disk without opening it; Open loads it into the editor for inspection; Discard deletes it. Drafts you skip will reappear next launch.';
    this.root.appendChild(intro);

    // (Re)mount the list element. Cleared on each render so we can
    // rebuild after a Discard removes a row.
    this.listEl.innerHTML = '';
    for (const entry of this.entries) {
      this.listEl.appendChild(this.renderRow(entry));
    }
    this.root.appendChild(this.listEl);

    const footer = document.createElement('footer');
    footer.className = 'pmd-recovery-sidebar-footer';
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'pmd-recovery-sidebar-done';
    doneBtn.textContent = this.entries.length === 0 ? 'Done' : 'Close';
    doneBtn.addEventListener('click', () => this.close());
    footer.appendChild(doneBtn);
    this.root.appendChild(footer);
  }

  private renderRow(entry: JournalEntry): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-recovery-sidebar-row';
    if (entry.uid === this.currentlyOpenUid) {
      row.classList.add('pmd-recovery-sidebar-row-active');
    }

    const name = document.createElement('div');
    name.className = 'pmd-recovery-sidebar-row-name';
    name.textContent = entry.filename || 'Untitled';
    row.appendChild(name);

    const sub = document.createElement('div');
    sub.className = 'pmd-recovery-sidebar-row-sub';
    const parts: string[] = [formatRelativeTime(entry.savedAt)];
    if (entry.format) parts.push(entry.format);
    sub.textContent = parts.join(' · ');
    row.appendChild(sub);

    if (entry.uid === this.currentlyOpenUid) {
      const indicator = document.createElement('div');
      indicator.className = 'pmd-recovery-sidebar-row-indicator';
      indicator.textContent = 'Open in editor';
      row.appendChild(indicator);
    }

    const actions = document.createElement('div');
    actions.className = 'pmd-recovery-sidebar-row-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'pmd-recovery-sidebar-row-btn pmd-recovery-sidebar-row-btn-save';
    saveBtn.textContent = 'Save';
    saveBtn.title =
      entry.handle
        ? 'Write this draft back to its original location and remove it from the recovery list.'
        : 'Pick a location to write this draft to. Removes it from the recovery list on success.';
    saveBtn.addEventListener('click', () => void this.saveEntry(entry));
    actions.appendChild(saveBtn);

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'pmd-recovery-sidebar-row-btn pmd-recovery-sidebar-row-btn-open';
    openBtn.textContent = entry.uid === this.currentlyOpenUid ? 'Reopen' : 'Open';
    openBtn.title =
      'Load this draft into the editor so you can see it. Save it to keep it; Discard to delete it.';
    openBtn.addEventListener('click', () => void this.openEntry(entry));
    actions.appendChild(openBtn);

    const discardBtn = document.createElement('button');
    discardBtn.type = 'button';
    discardBtn.className = 'pmd-recovery-sidebar-row-btn pmd-recovery-sidebar-row-btn-discard';
    discardBtn.textContent = 'Discard';
    discardBtn.title = 'Delete this draft. You can\'t undo this.';
    discardBtn.addEventListener('click', () => void this.discardEntry(entry));
    actions.appendChild(discardBtn);

    row.appendChild(actions);
    return row;
  }

  private async saveEntry(entry: JournalEntry): Promise<void> {
    let saved = false;
    try {
      saved = await this.callbacks.onSave(entry);
    } catch (err) {
      console.warn(`Failed to save recovery draft ${entry.uid}:`, err);
    }
    if (!saved) return;
    this.entries = this.entries.filter((e) => e.uid !== entry.uid);
    if (this.currentlyOpenUid === entry.uid) this.currentlyOpenUid = null;
    this.render();
    if (this.entries.length === 0) this.close();
  }

  private async openEntry(entry: JournalEntry): Promise<void> {
    try {
      await this.callbacks.onOpen(entry);
      this.currentlyOpenUid = entry.uid;
      this.render();
    } catch (err) {
      console.warn(`Failed to open recovery draft ${entry.uid}:`, err);
    }
  }

  private async discardEntry(entry: JournalEntry): Promise<void> {
    this.entries = this.entries.filter((e) => e.uid !== entry.uid);
    if (this.currentlyOpenUid === entry.uid) this.currentlyOpenUid = null;
    this.render();
    try {
      await this.callbacks.onDiscard(entry);
    } catch (err) {
      console.warn(`Failed to discard recovery draft ${entry.uid}:`, err);
    }
    // Auto-close when the list is empty — no more decisions to make.
    if (this.entries.length === 0) {
      this.close();
    }
  }

  private close(): void {
    if (this.settled) return;
    this.settled = true;
    document.removeEventListener('keydown', this.handleKey);
    document.body.classList.remove('pmd-recovery-active');
    this.root.remove();
    this.settle();
  }
}

/** Relative-time string ("5 minutes ago" / "2 hours ago" / etc.).
 *  Falls back to the raw locale string for entries older than a
 *  week. */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const ms = Date.now() - date.getTime();
  if (Number.isNaN(ms)) return iso;
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'} ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  return date.toLocaleString();
}
