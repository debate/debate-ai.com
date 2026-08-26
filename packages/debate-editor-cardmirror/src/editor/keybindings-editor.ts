/**
 * Keybindings editor — one row per command: every static
 * `RibbonCommandId` (grouped per `RIBBON_GROUPS`), plus a "Plugins"
 * section for registered plugin commands. Each row shows
 * the command label, its current bindings (overrides win over
 * defaults) as removable chips, a "+" button to capture a new
 * binding, and a "↺" reset that drops any override for that command
 * so the defaults take over again.
 *
 * Bindings are persisted via the `ribbonKeyOverrides` setting. When
 * that map changes, `index.ts` reconfigures the editor's plugin stack
 * so new bindings take effect immediately — no reload needed.
 *
 * Capture mode: clicking "+" replaces the button with a "Press a
 * key…" pill that listens for the next keydown. Pressing Escape
 * cancels. Keys that are just bare modifiers, or alpha keys without
 * any modifier (would intercept ordinary typing), are rejected.
 *
 * Conflict handling: if the captured key is already bound to another
 * command (via that command's override OR its built-in default), it
 * gets removed from that other command's binding set first — so a
 * single key can only ever fire one command, and the editor's last-
 * touched command wins. The displaced command is left without that
 * key (its default array is materialized into an override that omits
 * the displaced key), and a small inline note flashes briefly on the
 * editor to surface the change.
 */

import {
  RIBBON_COMMAND_IDS,
  DEFAULT_RIBBON_KEYS,
  ribbonKeyStringFor,
  formatKeyForDisplay,
  commandLabelFor,
  effectivePluginDefaultKeys,
  foldKeyString,
  type AnyCommandId,
} from './ribbon-commands.js';
import { pluginCommandIds } from './plugin-registry.js';
import { RIBBON_GROUPS } from './ribbon-groups.js';
import { isRibbonCommandAvailable } from './ribbon-availability.js';
import { settings, type KeyboardMacro } from './settings.js';
import { setIcon } from './icons';

function getOverrides(): Partial<Record<string, string | string[]>> {
  return settings.get('ribbonKeyOverrides');
}

/** Resolved key list for a command — overrides win over defaults, and
 *  single-string specs are normalized to arrays. Empty strings stay
 *  in the array (they're meaningless for display but the override
 *  map uses them to signal "explicitly unbound" — we filter those
 *  out at the chip-rendering level). */
function resolvedKeys(id: AnyCommandId): string[] {
  const overrides = getOverrides();
  // Plugin ids resolve through the shared helper so a plugin default that
  // loses a static collision doesn't show a chip that never dispatches.
  if (!(id in (DEFAULT_RIBBON_KEYS as Record<string, unknown>))) {
    return effectivePluginDefaultKeys(id, overrides);
  }
  const spec =
    id in overrides
      ? overrides[id]!
      : ((DEFAULT_RIBBON_KEYS as Record<string, string | string[] | undefined>)[id] ?? []);
  const arr = Array.isArray(spec) ? spec : [spec];
  return arr.filter((k) => typeof k === 'string') as string[];
}

/** Mutator: write a normalized key list back to the override map for
 *  a single command. Always overwrites (so once a row has been
 *  touched, defaults stop applying — explicit list wins). */
function setOverrideKeys(id: AnyCommandId, keys: string[]): void {
  const next = { ...getOverrides() };
  // Normalize: store strings as strings when there's exactly one
  // non-empty entry, arrays otherwise. Keeps the JSON-persisted shape
  // compact for the common single-key case.
  const filtered = keys.filter((k) => k.length > 0);
  if (filtered.length === 1) {
    next[id] = filtered[0]!;
  } else if (filtered.length === 0) {
    // Explicitly unbound — store empty array so it overrides defaults.
    next[id] = [];
  } else {
    next[id] = filtered;
  }
  settings.set('ribbonKeyOverrides', next);
}

/** Drop any override entry for `id`, falling back to defaults. */
function clearOverride(id: AnyCommandId): void {
  const next = { ...getOverrides() };
  delete next[id];
  settings.set('ribbonKeyOverrides', next);
}

// ── Keyboard macros ──────────────────────────────────────────────────
function getMacros(): KeyboardMacro[] {
  return settings.get('keyboardMacros');
}
function updateMacro(id: string, patch: Partial<KeyboardMacro>): void {
  settings.set(
    'keyboardMacros',
    getMacros().map((m) => (m.id === id ? { ...m, ...patch } : m)),
  );
}
function removeMacro(id: string): void {
  settings.set('keyboardMacros', getMacros().filter((m) => m.id !== id));
}
/** Set a macro's key, clearing that key from any other macro so one key
 *  only ever fires one macro (mirrors the one-key-one-command rule for
 *  shortcuts above). */
function setMacroKey(id: string, key: string): void {
  settings.set(
    'keyboardMacros',
    getMacros().map((m) => {
      if (m.id === id) return { ...m, key };
      if (m.key === key) return { ...m, key: '' };
      return m;
    }),
  );
}

/**
 * Find any command that currently has `key` in its resolved bindings.
 * Returns the first hit (callers use it to dislodge a conflicting
 * binding before installing the new one).
 */
function findConflict(
  key: string,
  excludeId: AnyCommandId,
): AnyCommandId | null {
  const folded = foldKeyString(key);
  for (const id of [...RIBBON_COMMAND_IDS, ...pluginCommandIds()]) {
    if (id === excludeId) continue;
    if (resolvedKeys(id).some((k) => foldKeyString(k) === folded)) return id;
  }
  return null;
}

/** Remove `key` from `id`'s binding set. If the result equals the
 *  default exactly, the override is dropped; otherwise the trimmed
 *  list becomes the new override. */
function removeKeyFromCommand(id: AnyCommandId, key: string): void {
  const folded = foldKeyString(key);
  const current = resolvedKeys(id).filter((k) => foldKeyString(k) !== folded);
  setOverrideKeys(id, current);
}

/**
 * Validate a candidate key string. Returns an error message or
 * `null` if the key is acceptable.
 */
function validateKey(key: string, raw: KeyboardEvent): string | null {
  if (!key) return 'No key detected.';
  // Bare modifier press — `Mod-Control` etc. — has no actual key.
  // ribbonKeyStringFor returns just modifiers in that case.
  const segments = key.split('-');
  const final = segments[segments.length - 1] ?? '';
  if (['Mod', 'Alt', 'Shift', 'Control', 'Meta'].includes(final)) {
    return 'Press a key together with the modifier.';
  }
  // Reject Escape / Tab / Enter / Space — keys we don't want to
  // claim. Anything single-character without a modifier is also
  // rejected (would intercept regular typing).
  if (
    final === 'Escape' ||
    final === 'Tab' ||
    final === 'Enter' ||
    final === ' '
  ) {
    return 'That key is reserved.';
  }
  if (
    final.length === 1 &&
    !raw.ctrlKey &&
    !raw.metaKey &&
    !raw.altKey
  ) {
    return 'Single-character keys must include Ctrl/Cmd/Alt.';
  }
  return null;
}

export function buildKeybindingsEditor(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pmd-keybindings-editor';

  // Group order + within-group order both come from RIBBON_GROUPS
  // — same taxonomy + ordering the Keyboard Shortcuts reference
  // modal uses, so the rebinding editor and the cheat sheet stay
  // visually aligned. The drift guard in `ribbon-groups.ts`
  // guarantees every `RibbonCommandId` is in exactly one group.

  let activeCapture: { row: HTMLElement; cleanup: () => void } | null = null;
  /** Live filter query for the searchbar — persists across the
   *  full-list rebuilds that fire after every override change.
   *  Empty string = no filter. */
  let searchQuery = '';

  /** Show / hide rows + group sections based on `searchQuery`.
   *  Match is case-insensitive substring against the row's
   *  command label OR any of its current keybinding chips. Empty
   *  groups (no surviving rows) collapse so the user doesn't see
   *  a stranded section title. */
  function applyFilter(): void {
    const q = searchQuery.trim().toLowerCase();
    const sections = wrap.querySelectorAll<HTMLElement>(
      '.pmd-keybindings-group',
    );
    for (const section of sections) {
      let anyVisible = false;
      for (const row of section.querySelectorAll<HTMLElement>(
        '.pmd-keybinding-row',
      )) {
        const label = (
          row.querySelector('.pmd-keybinding-label')?.textContent ?? ''
        ).toLowerCase();
        const chips = Array.from(
          row.querySelectorAll<HTMLElement>('.pmd-keybinding-chip'),
        )
          .map((c) => c.textContent ?? '')
          .join(' ')
          .toLowerCase();
        const hit = !q || label.includes(q) || chips.includes(q);
        row.style.display = hit ? '' : 'none';
        if (hit) anyVisible = true;
      }
      section.style.display = anyVisible ? '' : 'none';
    }
  }

  function exitCapture(): void {
    if (!activeCapture) return;
    activeCapture.cleanup();
    activeCapture = null;
  }

  function flashConflict(row: HTMLElement, msg: string): void {
    const note = row.querySelector<HTMLElement>('.pmd-keybinding-note');
    if (!note) return;
    note.textContent = msg;
    note.classList.add('pmd-keybinding-note-visible');
    window.setTimeout(() => {
      note.classList.remove('pmd-keybinding-note-visible');
    }, 2400);
  }

  function startCapture(id: AnyCommandId, row: HTMLElement): void {
    if (activeCapture) exitCapture();
    const addBtn = row.querySelector<HTMLButtonElement>('.pmd-keybinding-add');
    const capturePill =
      row.querySelector<HTMLElement>('.pmd-keybinding-capture');
    if (!addBtn || !capturePill) return;
    addBtn.style.display = 'none';
    capturePill.style.display = '';
    capturePill.textContent = 'Press a key… (Esc cancels)';
    row.classList.add('pmd-keybinding-row-capturing');

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitCapture();
        return;
      }
      // Ignore bare modifier keydowns; wait for the real key.
      if (
        e.key === 'Control' ||
        e.key === 'Shift' ||
        e.key === 'Alt' ||
        e.key === 'Meta'
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const key = ribbonKeyStringFor(e);
      const err = validateKey(key, e);
      if (err) {
        flashConflict(row, err);
        return;
      }
      // Drop the same key from any other command that has it.
      const conflict = findConflict(key, id);
      if (conflict) {
        removeKeyFromCommand(conflict, key);
        flashConflict(
          row,
          `Removed ${formatKeyForDisplay(key)} from "${commandLabelFor(conflict)}".`,
        );
      }
      const next = [...resolvedKeys(id)];
      if (!next.includes(key)) next.push(key);
      setOverrideKeys(id, next);
      exitCapture();
    };
    document.addEventListener('keydown', onKey, true);
    activeCapture = {
      row,
      cleanup: () => {
        document.removeEventListener('keydown', onKey, true);
        addBtn.style.display = '';
        capturePill.style.display = 'none';
        row.classList.remove('pmd-keybinding-row-capturing');
      },
    };
  }

  function renderRow(id: AnyCommandId): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-keybinding-row';

    const label = document.createElement('span');
    label.className = 'pmd-keybinding-label';
    label.textContent = commandLabelFor(id);
    row.appendChild(label);

    const chips = document.createElement('span');
    chips.className = 'pmd-keybinding-chips';
    row.appendChild(chips);

    const keys = resolvedKeys(id).filter((k) => k.length > 0);
    if (keys.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'pmd-keybinding-empty';
      empty.textContent = '—';
      chips.appendChild(empty);
    } else {
      for (const key of keys) {
        const chip = document.createElement('span');
        chip.className = 'pmd-keybinding-chip';
        const txt = document.createElement('span');
        txt.textContent = formatKeyForDisplay(key);
        chip.appendChild(txt);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'pmd-keybinding-chip-remove';
        setIcon(remove, 'close');
        remove.title = 'Remove this binding';
        remove.addEventListener('click', () => {
          removeKeyFromCommand(id, key);
        });
        chip.appendChild(remove);
        chips.appendChild(chip);
      }
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'pmd-keybinding-add';
    addBtn.textContent = '+';
    addBtn.title = 'Add a binding';
    addBtn.addEventListener('click', () => startCapture(id, row));
    row.appendChild(addBtn);

    const capturePill = document.createElement('span');
    capturePill.className = 'pmd-keybinding-capture';
    capturePill.style.display = 'none';
    row.appendChild(capturePill);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'pmd-keybinding-reset';
    setIcon(resetBtn, 'reset');
    resetBtn.title = 'Restore defaults for this command';
    resetBtn.addEventListener('click', () => clearOverride(id));
    row.appendChild(resetBtn);

    const note = document.createElement('span');
    note.className = 'pmd-keybinding-note';
    row.appendChild(note);

    return row;
  }

  // Mirrors `startCapture` (the shortcut version): hide the row's "+",
  // show the "Press a key…" pill, capture the next key, bind it.
  function startMacroKeyCapture(id: string, row: HTMLElement): void {
    if (activeCapture) exitCapture();
    const addBtn = row.querySelector<HTMLButtonElement>('.pmd-keybinding-add');
    const capturePill = row.querySelector<HTMLElement>('.pmd-keybinding-capture');
    if (!addBtn || !capturePill) return;
    addBtn.style.display = 'none';
    capturePill.style.display = '';
    capturePill.textContent = 'Press a key… (Esc cancels)';
    row.classList.add('pmd-keybinding-row-capturing');
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitCapture();
        return;
      }
      if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const key = ribbonKeyStringFor(e);
      const err = validateKey(key, e);
      if (err) {
        flashConflict(row, err);
        return;
      }
      setMacroKey(id, key); // → settings change → render() → exitCapture
      exitCapture();
    };
    document.addEventListener('keydown', onKey, true);
    activeCapture = {
      row,
      cleanup: () => {
        document.removeEventListener('keydown', onKey, true);
        addBtn.style.display = '';
        capturePill.style.display = 'none';
        row.classList.remove('pmd-keybinding-row-capturing');
      },
    };
  }

  /** A macro row, using the same row + binding-chip vocabulary as a
   *  shortcut row: the typed-text field plays the "label" slot, the
   *  shortcut shows as a key chip on the right (empty `—` + "+" until
   *  set). */
  function renderMacroRow(m: KeyboardMacro): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-keybinding-row pmd-macro-row';

    const text = document.createElement('input');
    text.type = 'text';
    text.className = 'pmd-macro-text';
    text.placeholder = 'Text to type…';
    text.value = m.text;
    // Commit on change (blur / Enter), not per keystroke — a per-input
    // settings write would re-render and steal focus mid-typing.
    text.addEventListener('change', () => updateMacro(m.id, { text: text.value }));
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        text.blur();
      }
    });
    row.appendChild(text);

    const chips = document.createElement('span');
    chips.className = 'pmd-keybinding-chips';
    if (!m.key) {
      const empty = document.createElement('span');
      empty.className = 'pmd-keybinding-empty';
      empty.textContent = '—';
      chips.appendChild(empty);
    } else {
      const chip = document.createElement('span');
      chip.className = 'pmd-keybinding-chip';
      const txt = document.createElement('span');
      txt.textContent = formatKeyForDisplay(m.key);
      chip.appendChild(txt);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pmd-keybinding-chip-remove';
      setIcon(remove, 'close');
      remove.title = 'Remove this binding';
      remove.addEventListener('click', () => updateMacro(m.id, { key: '' }));
      chip.appendChild(remove);
      chips.appendChild(chip);
    }
    row.appendChild(chips);

    // "+" to capture — only when unbound (a macro has a single key; to
    // change it, remove the chip first, like clearing then re-adding).
    if (!m.key) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'pmd-keybinding-add';
      addBtn.textContent = '+';
      addBtn.title = 'Set the shortcut';
      addBtn.addEventListener('click', () => startMacroKeyCapture(m.id, row));
      row.appendChild(addBtn);

      const capturePill = document.createElement('span');
      capturePill.className = 'pmd-keybinding-capture';
      capturePill.style.display = 'none';
      row.appendChild(capturePill);
    }

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'pmd-keybinding-reset pmd-macro-delete';
    del.title = 'Remove macro';
    del.setAttribute('aria-label', 'Remove macro');
    setIcon(del, 'close');
    del.addEventListener('click', () => removeMacro(m.id));
    row.appendChild(del);

    const note = document.createElement('span');
    note.className = 'pmd-keybinding-note';
    row.appendChild(note);

    return row;
  }

  function renderMacrosSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'pmd-keybindings-macros';
    // Deep-link target for the search palette's "Keyboard macros" result
    // (revealAnchor scrolls to + flashes `[data-anchor]`).
    section.dataset['anchor'] = 'keyboard-macros';
    // Title + description use the same classes as a settings row, so they
    // match the "Keyboard shortcuts" heading + its description above.
    const headBlock = document.createElement('div');
    headBlock.className = 'pmd-settings-row-text';
    const head = document.createElement('span');
    head.className = 'pmd-settings-row-title';
    head.textContent = 'Keyboard macros';
    headBlock.appendChild(head);
    const desc = document.createElement('span');
    desc.className = 'pmd-settings-row-desc';
    desc.textContent =
      'Bind a shortcut to type a snippet of text at the cursor. A macro key takes precedence over any command on the same key.';
    headBlock.appendChild(desc);
    section.appendChild(headBlock);

    // Same boxed list container as the shortcuts above.
    const macroList = document.createElement('div');
    macroList.className = 'pmd-keybindings-list pmd-macro-list';
    const macros = getMacros();
    if (macros.length === 0) {
      const emptyRow = document.createElement('div');
      emptyRow.className = 'pmd-keybinding-row';
      const span = document.createElement('span');
      span.className = 'pmd-keybinding-empty';
      span.textContent = 'No macros yet — add one below.';
      emptyRow.appendChild(span);
      macroList.appendChild(emptyRow);
    } else {
      for (const m of macros) macroList.appendChild(renderMacroRow(m));
    }
    section.appendChild(macroList);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'pmd-macro-add';
    addBtn.textContent = '+ Add macro';
    addBtn.addEventListener('click', () => {
      settings.set('keyboardMacros', [
        ...getMacros(),
        { id: crypto.randomUUID(), key: '', text: '' },
      ]);
    });
    section.appendChild(addBtn);
    return section;
  }

  function render(): void {
    exitCapture();
    // Preserve scroll position so rebinds don't snap the user
    // back to the top after every chip change. The scroll
    // container is the `.pmd-keybindings-list` element INSIDE
    // `wrap` (it owns `overflow-y: auto; max-height: 360px`), and
    // it gets fully replaced by the rebuild — so we snapshot the
    // OLD list's scrollTop before clearing, then assign to the
    // NEW list once it exists.
    const oldList = wrap.querySelector<HTMLElement>('.pmd-keybindings-list');
    const savedScrollTop = oldList ? oldList.scrollTop : 0;
    wrap.innerHTML = '';

    const help = document.createElement('p');
    help.className = 'pmd-keybindings-help';
    help.textContent =
      'A key bound here only fires one command at a time — if you reuse a key, the previous command loses that binding.';
    wrap.appendChild(help);

    const searchRow = document.createElement('div');
    searchRow.className = 'pmd-keybindings-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'pmd-keybindings-search-input';
    searchInput.placeholder = 'Search shortcuts…';
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      applyFilter();
    });
    searchRow.appendChild(searchInput);
    wrap.appendChild(searchRow);

    const list = document.createElement('div');
    list.className = 'pmd-keybindings-list';
    for (const group of RIBBON_GROUPS) {
      // Skip commands not available in this context (Flow off Windows,
      // voice off desktop, the cutter while disabled) — and the whole
      // group if nothing in it is available.
      const ids = group.commands.filter(isRibbonCommandAvailable);
      if (ids.length === 0) continue;
      const section = document.createElement('section');
      section.className = 'pmd-keybindings-group';
      const heading = document.createElement('h3');
      heading.className = 'pmd-keybindings-group-title';
      heading.textContent = group.title;
      section.appendChild(heading);
      for (const id of ids) section.appendChild(renderRow(id));
      list.appendChild(section);
    }
    // Registered plugin commands get their own rebind section (spec 3),
    // reusing the exact same row machinery — the override helpers and
    // conflict handling above already speak `AnyCommandId`. Skipped
    // entirely while no plugin has registered commands, so the static
    // list never grows a stranded empty heading.
    const pluginIds = pluginCommandIds();
    if (pluginIds.length > 0) {
      const section = document.createElement('section');
      section.className = 'pmd-keybindings-group';
      const heading = document.createElement('h3');
      heading.className = 'pmd-keybindings-group-title';
      heading.textContent = 'Plugins';
      section.appendChild(heading);
      for (const id of pluginIds) section.appendChild(renderRow(id));
      list.appendChild(section);
    }
    wrap.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'pmd-keybindings-footer';
    const restoreAll = document.createElement('button');
    restoreAll.type = 'button';
    restoreAll.className = 'pmd-keybindings-restore-all';
    restoreAll.textContent = 'Restore all defaults';
    restoreAll.addEventListener('click', () => {
      settings.set('ribbonKeyOverrides', {});
    });
    footer.appendChild(restoreAll);
    wrap.appendChild(footer);

    // Keyboard macros — their own section below all the shortcuts.
    wrap.appendChild(renderMacrosSection());

    // Re-apply the live filter so the just-rebuilt rows reflect
    // the current search query (rebuild ran from a settings
    // change while a filter was active).
    applyFilter();

    // Restore the new list's scrollTop to the old one's so the
    // user lands back where they were rather than at the top.
    const newList = wrap.querySelector<HTMLElement>('.pmd-keybindings-list');
    if (newList) newList.scrollTop = savedScrollTop;
  }

  // Re-render on any override change (writes from chip × / + / ↺ /
  // capture all flow through settings.set, which fires this subscriber).
  let lastOverrides = getOverrides();
  let lastMacros = getMacros();
  const unsubscribe = settings.subscribe((s) => {
    if (s.ribbonKeyOverrides !== lastOverrides || s.keyboardMacros !== lastMacros) {
      lastOverrides = s.ribbonKeyOverrides;
      lastMacros = s.keyboardMacros;
      render();
    }
  });
  // Cancel the settings subscription when the editor leaves the
  // DOM (e.g., the settings modal closes). MutationObserver
  // replacement for the deprecated DOMNodeRemoved event.
  const obs = new MutationObserver(() => {
    if (!wrap.isConnected) {
      unsubscribe();
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  render();
  return wrap;
}
