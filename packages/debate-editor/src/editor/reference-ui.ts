/**
 * Keyboard-shortcut reference modal. A read-only "cheat sheet" view
 * of the ribbon's bound F-keys / Mod-keys, grouped conceptually.
 *
 * The thematic grouping is shared with the Settings → Keybindings
 * editor — see `ribbon-groups.ts`. The drift-guard assertion lives
 * there too, so both surfaces stay in sync.
 */

import {
  DEFAULT_RIBBON_KEYS,
  RIBBON_COMMAND_LABELS,
  formatKeyForDisplay,
  commandLabelFor,
  effectivePluginDefaultKeys,
  type RibbonCommandId,
} from './ribbon-commands.js';
import { RIBBON_GROUPS } from './ribbon-groups.js';
import { isRibbonCommandAvailable } from './ribbon-availability.js';
import { pluginCommandIds } from './plugin-registry.js';
import { settings } from './settings.js';
import { setIcon } from './icons';
import { pushOverlay, popOverlay } from './overlay-stack.js';
import {
  installModalKeys,
  armDialogFocus,
  captureFocusForDialog,
} from './text-prompt.js';
import { getHost } from './host/index.js';
import {
  formatShortcutsReferenceText,
  type ShortcutsReferenceGroup,
} from './reference-export.js';
import { buildShortcutsReferencePdf } from './reference-pdf-export.js';


class ReferenceModal {
  private overlay: HTMLDivElement;
  private dialog: HTMLDivElement;
  /** Live filter query for the searchbar — kept on the instance
   *  so reopening the modal preserves the last search. */
  private searchQuery = '';
  /** Modal plumbing while open (2026-07-27 focus audit: same
   *  no-focus, unregistered pattern as the word-count modal —
   *  keystrokes fell through to the document behind). */
  private overlayToken: symbol | null = null;
  private removeKeys: (() => void) | null = null;
  private restoreFocus: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pmd-reference-overlay';
    this.overlay.style.display = 'none';

    this.dialog = document.createElement('div');
    this.dialog.className = 'pmd-reference-dialog';
    this.overlay.appendChild(this.dialog);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.body.appendChild(this.overlay);
  }

  open(): void {
    this.render();
    this.overlay.style.display = '';
    if (this.overlayToken === null) {
      const token = pushOverlay();
      this.overlayToken = token;
      this.restoreFocus = captureFocusForDialog();
      this.removeKeys = installModalKeys(this.dialog, token, (e) => {
        if (e.key === 'Escape') {
          this.close();
          return true;
        }
        return false;
      });
    }
    armDialogFocus(this.dialog, 'dialog', 'Keyboard shortcuts');
  }

  close(): void {
    this.overlay.style.display = 'none';
    if (this.overlayToken !== null) {
      popOverlay(this.overlayToken);
      this.overlayToken = null;
    }
    this.removeKeys?.();
    this.removeKeys = null;
    this.restoreFocus?.();
    this.restoreFocus = null;
  }

  /** Gathers every visible group + row (static `RIBBON_GROUPS` plus a
   *  trailing "Plugins" section) as plain data — the single source
   *  both the on-screen modal and the Print/Export actions render
   *  from, so all three always agree with each other and with the
   *  user's live keybindings. */
  private collectGroups(): ShortcutsReferenceGroup[] {
    const overrides = settings.get('ribbonKeyOverrides');
    const groups: ShortcutsReferenceGroup[] = [];

    for (const group of RIBBON_GROUPS) {
      // Hide commands that don't apply here (Flow off Windows, voice off
      // desktop, the cutter while disabled), and skip a group entirely
      // when none of its commands are available.
      const ids = group.commands.filter(isRibbonCommandAvailable);
      if (ids.length === 0) continue;

      groups.push({
        title: group.title,
        rows: ids.map((id) => {
          // Live overrides from settings take precedence over defaults
          // so the reference always reflects the user's current
          // bindings (including unbound / freshly-customized commands).
          const keySpec = overrides[id] ?? DEFAULT_RIBBON_KEYS[id];
          const keys = Array.isArray(keySpec) ? keySpec : [keySpec];
          const keyText = keys
            .map((k) => formatKeyForDisplay(k))
            .filter((s) => s.length > 0)
            .join(' / ');
          return { label: RIBBON_COMMAND_LABELS[id], keyText };
        }),
      });
    }

    // Registered plugin commands get their own section, appended after
    // the static groups — reusing `effectivePluginDefaultKeys` so the
    // printed keys match what actually dispatches (a plugin default
    // that loses to a static key prints as unbound, not as a lie).
    // Skipped entirely while no plugin has registered commands.
    const pluginIds = pluginCommandIds();
    if (pluginIds.length > 0) {
      groups.push({
        title: 'Plugins',
        rows: pluginIds.map((id) => {
          const keys = effectivePluginDefaultKeys(id, overrides);
          const keyText = keys
            .map((k) => formatKeyForDisplay(k))
            .filter((s) => s.length > 0)
            .join(' / ');
          return { label: commandLabelFor(id), keyText };
        }),
      });
    }

    return groups;
  }

  /** Opens the platform print dialog scoped to a hidden print-only
   *  copy of the reference — the on-screen modal itself never prints
   *  (fixed height + internal scroll, would clip to one page). Builds
   *  the fragment fresh from `groups` each call rather than caching it,
   *  since it must reflect whatever's current when the button is
   *  clicked (a rebind since the modal opened, a search that doesn't
   *  apply here — print/export always show everything). */
  private print(groups: ShortcutsReferenceGroup[]): void {
    const root = document.createElement('div');
    root.className = 'pmd-reference-print-root';

    const heading = document.createElement('h1');
    heading.textContent = 'Keyboard shortcuts';
    root.appendChild(heading);

    for (const group of groups) {
      if (group.rows.length === 0) continue;
      const section = document.createElement('section');
      const title = document.createElement('h2');
      title.textContent = group.title;
      section.appendChild(title);

      const table = document.createElement('table');
      const tbody = document.createElement('tbody');
      for (const row of group.rows) {
        const tr = document.createElement('tr');
        const keyTd = document.createElement('td');
        keyTd.textContent = row.keyText || '—';
        const labelTd = document.createElement('td');
        labelTd.textContent = row.label;
        tr.append(keyTd, labelTd);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      section.appendChild(table);
      root.appendChild(section);
    }

    document.body.appendChild(root);
    const cleanup = () => root.remove();
    // `afterprint` covers the normal case (print or cancel from the
    // native dialog); the timeout is a backstop for hosts that never
    // fire it (some Electron/print-preview paths) so the print-only
    // copy can't get stranded in the live DOM.
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 5000);
    window.print();
  }

  /** Saves the reference as a plain-text file via the platform host
   *  (native "Save As" picker where available, download fallback
   *  otherwise — the same path Settings → Export settings… uses). */
  private async exportAsText(
    groups: ShortcutsReferenceGroup[],
  ): Promise<void> {
    const text = formatShortcutsReferenceText(groups);
    const bytes = new TextEncoder().encode(text);
    await getHost().saveAs('cardmirror-shortcuts.txt', bytes, {
      filters: [{ name: 'Text', extensions: ['txt'] }],
    });
  }

  /** Saves the reference as a portable, already-paginated PDF file via
   *  the platform host — for a user who wants a shareable document
   *  without invoking their browser's own print-to-PDF flow. */
  private async exportAsPdf(groups: ShortcutsReferenceGroup[]): Promise<void> {
    const bytes = await buildShortcutsReferencePdf(groups);
    await getHost().saveAs('cardmirror-shortcuts.pdf', bytes, {
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
  }

  private render(): void {
    this.dialog.innerHTML = '';
    const groups = this.collectGroups();

    const header = document.createElement('header');
    header.className = 'pmd-reference-header';
    const title = document.createElement('h2');
    title.textContent = 'Keyboard shortcuts';
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'pmd-reference-header-actions';

    const printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'pmd-reference-action-btn';
    printBtn.textContent = 'Print';
    printBtn.title = 'Print the full shortcuts reference';
    printBtn.addEventListener('click', () => this.print(groups));
    actions.appendChild(printBtn);

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'pmd-reference-action-btn';
    exportBtn.textContent = 'Export…';
    exportBtn.title = 'Save the full shortcuts reference as a text file';
    exportBtn.addEventListener('click', () => void this.exportAsText(groups));
    actions.appendChild(exportBtn);

    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'pmd-reference-action-btn';
    pdfBtn.textContent = 'Download PDF';
    pdfBtn.title = 'Save the full shortcuts reference as a PDF file';
    pdfBtn.addEventListener('click', () => void this.exportAsPdf(groups));
    actions.appendChild(pdfBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'pmd-reference-close';
    setIcon(closeBtn, 'close');
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => this.close());
    actions.appendChild(closeBtn);

    header.appendChild(actions);
    this.dialog.appendChild(header);

    const searchRow = document.createElement('div');
    searchRow.className = 'pmd-reference-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'pmd-reference-search-input';
    searchInput.placeholder = 'Search shortcuts…';
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.applyFilter();
    });
    searchRow.appendChild(searchInput);
    this.dialog.appendChild(searchRow);

    const body = document.createElement('div');
    body.className = 'pmd-reference-body';

    for (const group of groups) {
      if (group.rows.length === 0) continue;

      const section = document.createElement('section');
      section.className = 'pmd-reference-group';

      const heading = document.createElement('h3');
      heading.className = 'pmd-reference-group-title';
      heading.textContent = group.title;
      section.appendChild(heading);

      const rows = document.createElement('div');
      rows.className = 'pmd-reference-group-rows';

      for (const commandRow of group.rows) {
        const row = document.createElement('div');
        row.className = 'pmd-reference-row';

        const keyEl = document.createElement('span');
        keyEl.className = 'pmd-reference-key';
        keyEl.textContent = commandRow.keyText || '—';
        row.appendChild(keyEl);

        const labelEl = document.createElement('span');
        labelEl.className = 'pmd-reference-label';
        labelEl.textContent = commandRow.label;
        row.appendChild(labelEl);

        rows.appendChild(row);
      }

      section.appendChild(rows);
      body.appendChild(section);
    }

    this.dialog.appendChild(body);

    // Re-apply the persisted search so the rebuilt rows reflect it.
    this.applyFilter();
  }

  /** Show / hide rows + group sections per `searchQuery`. Match is
   *  case-insensitive substring against each row's label OR its
   *  current keybinding text. Empty groups collapse so a stranded
   *  section heading doesn't sit alone. */
  private applyFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();
    const sections = this.dialog.querySelectorAll<HTMLElement>(
      '.pmd-reference-group',
    );
    for (const section of sections) {
      let anyVisible = false;
      for (const row of section.querySelectorAll<HTMLElement>(
        '.pmd-reference-row',
      )) {
        const label = (
          row.querySelector('.pmd-reference-label')?.textContent ?? ''
        ).toLowerCase();
        const keyText = (
          row.querySelector('.pmd-reference-key')?.textContent ?? ''
        ).toLowerCase();
        const hit = !q || label.includes(q) || keyText.includes(q);
        row.style.display = hit ? '' : 'none';
        if (hit) anyVisible = true;
      }
      section.style.display = anyVisible ? '' : 'none';
    }
  }
}

let modal: ReferenceModal | null = null;

export function openReference(): void {
  if (!modal) modal = new ReferenceModal();
  modal.open();
  // Signal to the Verbatim nudge (verbatim-nudge.ts) that the reference
  // has already been found — button, tour step, palette, or menu, it
  // doesn't matter which.
  if (!settings.get('hasOpenedShortcutsReference')) {
    settings.set('hasOpenedShortcutsReference', true);
  }
}
