/**
 * Settings → General → "Personal dictionary": view and remove words added
 * via the editor's right-click "Add to Dictionary" action (see
 * `viewport-spellcheck.ts` / `user-dictionary.ts`), plus a field to add a
 * word directly.
 *
 * Pulled out of `settings-ui.ts` (like `user-dictionary.ts` itself) so this
 * small, self-contained section is unit-testable without importing that
 * file's much larger dependency graph (host detection, pairing, collab,
 * ...). `settings-ui.ts` calls `buildUserDictionarySection` and places it
 * next to the "Editor spellcheck" toggle.
 *
 * Before this, an account-synced word was invisible anywhere in the UI —
 * only the context-menu action could add one, and nothing could remove one
 * short of clearing `localStorage`.
 *
 * Each row also carries a "Synced" / "Not yet synced" badge — the same
 * per-record status `FlowHistoryList`'s History tab surfaces via
 * `getToolRecordSyncStatus`, now reused here as the follow-up flagged when
 * that status was first exposed. Omitted (not shown as a third "unknown"
 * state) before this collection has a baseline to compare against, same
 * rule `FlowHistoryList` follows. Refreshed on the watcher's own tick
 * interval so a badge does not stay "Not yet synced" once a background
 * flush actually lands it, without needing this store's own change events.
 */

import { setIcon } from './icons.js';
import { loadUserDictionary, saveUserDictionary, type UserDictionaryEntry } from './user-dictionary.js';
import {
  getToolRecordSyncStatus,
  TOOL_RECORD_AUTO_SYNC_INTERVAL_MS,
} from 'debate-data-sync/src/state/tool-record-auto-sync';

/** The `key` this store is registered under in `TOOL_RECORD_COLLECTIONS`. */
const SPELLCHECK_DICTIONARY_COLLECTION_KEY = 'spellcheckDictionary';

export interface UserDictionarySection {
  /** The section's root element — append it wherever it should be shown. */
  element: HTMLElement;
  /** Stops the periodic sync-status refresh. Call on unmount. */
  destroy: () => void;
}

export function buildUserDictionarySection(): UserDictionarySection {
  const section = document.createElement('section');
  section.className = 'pmd-settings-dictionary';

  const title = document.createElement('h3');
  title.className = 'pmd-settings-section-title';
  title.textContent = 'Personal dictionary';
  section.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'pmd-settings-row-desc';
  desc.textContent =
    'Words added via "Add to Dictionary" when spellcheck flags something that ' +
    "isn't a misspelling. Synced to your account like your other settings.";
  section.appendChild(desc);

  const addRow = document.createElement('div');
  addRow.className = 'pmd-dictionary-add-row';
  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.className = 'pmd-dictionary-add-input';
  addInput.placeholder = 'Add a word';
  addInput.setAttribute('aria-label', 'Add a word to the personal dictionary');
  addRow.appendChild(addInput);
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'pmd-dictionary-add-btn';
  addBtn.textContent = '+ Add';
  addRow.appendChild(addBtn);
  section.appendChild(addRow);

  const list = document.createElement('div');
  list.className = 'pmd-dictionary-list';
  section.appendChild(list);

  let words = loadUserDictionary();

  function commit(next: Set<string>): void {
    words = next;
    saveUserDictionary(words);
    render();
  }

  function render(): void {
    list.innerHTML = '';
    const sorted = [...words].sort((a, b) => a.localeCompare(b));
    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pmd-settings-empty pmd-dictionary-empty';
      empty.textContent = 'No words added yet.';
      list.appendChild(empty);
      return;
    }
    for (const word of sorted) {
      const row = document.createElement('div');
      row.className = 'pmd-dictionary-row';

      const label = document.createElement('span');
      label.className = 'pmd-dictionary-word';
      label.textContent = word;
      row.appendChild(label);

      const entry: UserDictionaryEntry = { id: word, word };
      const syncStatus = getToolRecordSyncStatus(SPELLCHECK_DICTIONARY_COLLECTION_KEY, entry);
      if (syncStatus !== 'unknown') {
        const badge = document.createElement('span');
        badge.className = `pmd-dictionary-sync-badge pmd-dictionary-sync-badge--${syncStatus}`;
        badge.textContent = syncStatus === 'synced' ? 'Synced' : 'Not yet synced';
        badge.title =
          syncStatus === 'synced' ? 'This word has reached your account' : 'Not yet synced to your account';
        row.appendChild(badge);
      }

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'pmd-dictionary-delete';
      setIcon(delBtn, 'close');
      delBtn.title = `Remove "${word}"`;
      delBtn.setAttribute('aria-label', `Remove "${word}" from the personal dictionary`);
      delBtn.addEventListener('click', () => {
        const next = new Set(words);
        next.delete(word);
        commit(next);
      });
      row.appendChild(delBtn);

      list.appendChild(row);
    }
  }

  function addWord(): void {
    const raw = addInput.value.trim();
    if (!raw) return;
    const next = new Set(words);
    next.add(raw);
    addInput.value = '';
    commit(next);
  }
  addBtn.addEventListener('click', addWord);
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWord();
    }
  });

  render();
  // Re-renders on the same cadence the account-sync watcher ticks on, so a
  // badge reflects a background flush landing without this store having any
  // change event of its own to react to (see the module doc comment).
  const refreshInterval = setInterval(render, TOOL_RECORD_AUTO_SYNC_INTERVAL_MS);

  return {
    element: section,
    destroy: () => clearInterval(refreshInterval),
  };
}
