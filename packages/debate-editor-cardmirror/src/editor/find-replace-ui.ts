/**
 * Find / Replace floating bar.
 *
 * Sits in the upper-right of the editor surface. Two modes:
 *   - 'find' (Ctrl-F): just the find input + navigation + close.
 *   - 'replace' (Ctrl-H): adds the replace input + Replace + Replace All.
 *
 * Drives the editor's `findReplacePlugin` via transaction metas:
 *   - User types in the find input → debounced `setQuery` meta.
 *   - Toggle case-sensitive / whole-word → re-sends `setQuery` with the
 *     updated flags.
 *   - Next / Prev buttons (or Enter / Shift-Enter in the find input)
 *     → `navigate` meta, followed by `scrollToCurrentMatch`.
 *   - Replace / Replace All buttons → `runReplace` / `runReplaceAll`
 *     commands.
 *
 * The bar manages its own DOM lifecycle — created on first open,
 * hidden via `display: none` after that. Closing restores focus to
 * the editor.
 */

import type { EditorView } from 'prosemirror-view';
import { suppressAutofill } from './autofill-ignore.js';
import {
  findReplaceKey,
  runReplace,
  runReplaceAll,
  scrollToCurrentMatch,
  FIND_MATCH_CAP,
  type FindReplaceState,
  type FindSortMode,
} from './find-replace-plugin.js';
import { settings } from './settings.js';
import type { NavigationPanel } from './nav-panel.js';
import { setIcon, type IconName } from './icons';

type Mode = 'find' | 'replace';
export type FindBarOpenOptions = { mode: Mode; sortMode: FindSortMode };

const SNIPPET_PAD = 30;

/** Cap on result rows rendered in the in-context panel. A list of thousands of
 *  rows isn't scannable and is expensive to build (a snippet per row); past this
 *  we show the first N and a "refine to narrow" footer. */
const FIND_RESULT_ROW_CAP = 500;

/** Build a (before, hit, after) text triple from the textblock that
 *  contains the given match. Trims whitespace at the snippet edges
 *  and prepends/appends ellipses when the match isn't already
 *  flush against the textblock's bounds. */
function buildSnippet(
  view: EditorView,
  match: { from: number; to: number },
): { before: string; hit: string; after: string } {
  const $from = view.state.doc.resolve(match.from);
  // Find the enclosing textblock — usually $from.parent, but be
  // defensive in case the match lands on a node boundary.
  let depth = $from.depth;
  while (depth > 0 && !$from.node(depth).isTextblock) depth--;
  if (depth === 0) return { before: '', hit: '', after: '' };
  const block = $from.node(depth);
  const blockStart = $from.before(depth) + 1;
  const blockEnd = blockStart + block.content.size;
  const localStart = match.from - blockStart;
  const localEnd = match.to - blockStart;
  // One-char leaf placeholder so offsets stay position-aligned past
  // inline images (same trick as the plugin's scan); U+FFFC renders
  // as the standard object-replacement glyph in the snippet.
  const text = block.textBetween(0, block.content.size, undefined, '￼');
  const beforeStart = Math.max(0, localStart - SNIPPET_PAD);
  const afterEnd = Math.min(text.length, localEnd + SNIPPET_PAD);
  const beforeRaw = text.slice(beforeStart, localStart);
  const hit = text.slice(localStart, localEnd);
  const afterRaw = text.slice(localEnd, afterEnd);
  // Collapse whitespace and add ellipses if we truncated.
  const before =
    (beforeStart > 0 ? '…' : '') + beforeRaw.replace(/\s+/g, ' ');
  const after =
    afterRaw.replace(/\s+/g, ' ') + (afterEnd < text.length ? '…' : '');
  return { before, hit, after };
}

export class FindReplaceBar {
  private root: HTMLElement;
  private findInput: HTMLInputElement;
  private replaceInput: HTMLInputElement;
  private replaceRow: HTMLElement;
  private caseSensitiveCheckbox: HTMLInputElement;
  private wholeWordCheckbox: HTMLInputElement;
  private scopeCheckbox: HTMLInputElement;
  private countLabel: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private replaceBtn: HTMLButtonElement;
  private replaceAllBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private expandBtn: HTMLButtonElement;
  private resultsPanel: HTMLElement;
  private resultsList: HTMLElement;
  private resultsExpanded = false;
  /** The match array the result rows were last built for. When unchanged, a
   *  re-render only moves the active row instead of rebuilding every row. */
  private lastRenderedMatches: unknown = null;
  /** The match array the nav-pane hit markers were last pushed for. Skips the
   *  O(N) re-map/re-render when only the active index changed. */
  private lastNavHitMatches: unknown = null;
  private getView: () => EditorView | null;
  private getNavPanel: () => NavigationPanel | null;
  /** The view + nav panel the bar opened against. Cleanup targets THESE,
   *  not the lazily-resolved current ones: in multi-pane the shell closes
   *  the bar mid-focus-switch, when "current" may already be the incoming
   *  pane — lazy resolution there would clear the wrong pane and leave the
   *  outgoing pane's match decorations and nav hit markers stuck. */
  private openedView: EditorView | null = null;
  private openedNavPanel: NavigationPanel | null = null;
  private mode: Mode = 'find';
  private sortMode: FindSortMode = 'categorized';
  /** Cursor position captured at `open()` time. Used as the wrap
   *  anchor (ordering runs top-to-bottom from here, then wraps) so
   *  navigating through matches doesn't shuffle the order under the
   *  user's feet. */
  private anchor = 0;
  private setQueryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Trailing debounce for the O(matches) panel/nav rebuilds triggered
   *  by edits in the document while the bar is open. */
  private stateChangeTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeView: (() => void) | null = null;
  private sortLabel: HTMLElement;

  constructor(
    getView: () => EditorView | null,
    getNavPanel: () => NavigationPanel | null = () => null,
  ) {
    this.getView = getView;
    this.getNavPanel = getNavPanel;
    this.root = document.createElement('div');
    this.root.className = 'pmd-find-bar';
    this.root.hidden = true;

    // Row 1: find input + toggles + count + nav + close.
    const findRow = document.createElement('div');
    findRow.className = 'pmd-find-row';

    this.findInput = document.createElement('input');
    this.findInput.type = 'text';
    this.findInput.placeholder = 'Find';
    this.findInput.className = 'pmd-find-input';
    // Keep password-manager extensions from crawling the doc on focus (web).
    suppressAutofill(this.findInput);
    findRow.appendChild(this.findInput);

    this.caseSensitiveCheckbox = this.buildToggle(
      findRow,
      'pmd-find-case',
      'Aa',
      'Match case',
    );
    this.wholeWordCheckbox = this.buildToggle(
      findRow,
      'pmd-find-word',
      'W',
      'Whole word',
    );
    this.scopeCheckbox = this.buildToggle(
      findRow,
      'pmd-find-scope-toggle',
      '⌖',
      'Search within selection only (Alt-L while bar is open)',
    );

    this.sortLabel = document.createElement('span');
    this.sortLabel.className = 'pmd-find-sort-label';
    this.sortLabel.textContent = '';
    findRow.appendChild(this.sortLabel);

    this.countLabel = document.createElement('span');
    this.countLabel.className = 'pmd-find-count';
    this.countLabel.textContent = '0 of 0';
    findRow.appendChild(this.countLabel);

    this.prevBtn = this.buildIconButton(findRow, 'chevron-left', 'Previous match');
    this.nextBtn = this.buildIconButton(findRow, 'chevron-right', 'Next match');
    this.expandBtn = this.buildIconButton(
      findRow,
      'chevron-down',
      'Show matches in context',
    );
    this.expandBtn.classList.add('pmd-find-expand');
    this.expandBtn.setAttribute('aria-pressed', 'false');
    this.closeBtn = this.buildIconButton(findRow, 'close', 'Close find');
    this.closeBtn.classList.add('pmd-find-close');

    this.root.appendChild(findRow);

    // Row 2: replace input + Replace + Replace All.
    this.replaceRow = document.createElement('div');
    this.replaceRow.className = 'pmd-find-replace-row';
    this.replaceInput = document.createElement('input');
    this.replaceInput.type = 'text';
    this.replaceInput.placeholder = 'Replace';
    this.replaceInput.className = 'pmd-find-input pmd-find-replace-input';
    suppressAutofill(this.replaceInput);
    this.replaceRow.appendChild(this.replaceInput);
    this.replaceBtn = document.createElement('button');
    this.replaceBtn.type = 'button';
    this.replaceBtn.className = 'pmd-find-action';
    this.replaceBtn.textContent = 'Replace';
    this.replaceBtn.title = 'Replace current match';
    this.replaceRow.appendChild(this.replaceBtn);
    this.replaceAllBtn = document.createElement('button');
    this.replaceAllBtn.type = 'button';
    this.replaceAllBtn.className = 'pmd-find-action';
    this.replaceAllBtn.textContent = 'Replace All';
    this.replaceAllBtn.title = 'Replace every match';
    this.replaceRow.appendChild(this.replaceAllBtn);
    this.root.appendChild(this.replaceRow);

    document.body.appendChild(this.root);

    // Results-list expansion panel. Visually a separate box so it
    // reads as "an optional list under the bar", not as part of the
    // bar itself. Hidden by default; toggle visibility via
    // `setResultsExpanded`.
    this.resultsPanel = document.createElement('div');
    this.resultsPanel.className = 'pmd-find-results-panel';
    this.resultsPanel.hidden = true;
    this.resultsList = document.createElement('div');
    this.resultsList.className = 'pmd-find-results-list';
    this.resultsPanel.appendChild(this.resultsList);
    document.body.appendChild(this.resultsPanel);

    this.wireEvents();
  }

  private buildToggle(
    parent: HTMLElement,
    className: string,
    label: string,
    title: string,
  ): HTMLInputElement {
    const wrap = document.createElement('label');
    wrap.className = `pmd-find-toggle ${className}`;
    wrap.title = title;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    wrap.appendChild(cb);
    const txt = document.createElement('span');
    txt.textContent = label;
    wrap.appendChild(txt);
    parent.appendChild(wrap);
    return cb;
  }

  private buildIconButton(
    parent: HTMLElement,
    iconName: IconName,
    title: string,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-find-icon-btn';
    setIcon(btn, iconName);
    btn.title = title;
    btn.setAttribute('aria-label', title);
    parent.appendChild(btn);
    return btn;
  }

  private wireEvents(): void {
    this.findInput.addEventListener('input', () => this.scheduleSetQuery());
    this.caseSensitiveCheckbox.addEventListener('change', () => this.applyQueryNow());
    this.wholeWordCheckbox.addEventListener('change', () => this.applyQueryNow());
    this.scopeCheckbox.addEventListener('change', () => this.applyScopeFromToggle());

    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigate(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.altKey && e.key.toLowerCase() === 'l') {
        // Alt-L toggles scope from inside the find input.
        e.preventDefault();
        this.scopeCheckbox.checked = !this.scopeCheckbox.checked;
        this.applyScopeFromToggle();
      }
    });
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.doReplace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    this.prevBtn.addEventListener('click', () => this.navigate(-1));
    this.nextBtn.addEventListener('click', () => this.navigate(1));
    this.expandBtn.addEventListener('click', () =>
      this.setResultsExpanded(!this.resultsExpanded, true),
    );
    this.closeBtn.addEventListener('click', () => this.close());
    this.replaceBtn.addEventListener('click', () => this.doReplace());
    this.replaceAllBtn.addEventListener('click', () => this.doReplaceAll());
  }

  private setResultsExpanded(expanded: boolean, persist: boolean): void {
    this.resultsExpanded = expanded;
    this.resultsPanel.hidden = !expanded;
    this.expandBtn.setAttribute('aria-pressed', expanded ? 'true' : 'false');
    setIcon(this.expandBtn, expanded ? 'chevron-up' : 'chevron-down');
    this.expandBtn.title = expanded
      ? 'Hide matches in context'
      : 'Show matches in context';
    if (expanded) {
      this.positionResultsPanel();
      this.renderResults();
    }
    if (persist) settings.set('findResultsExpanded', expanded);
  }

  /** Place the results panel directly below the bar, right-aligned
   *  to it. We position absolutely (not as a child of the bar)
   *  because the panel should read as a visually-separate box. */
  private positionResultsPanel(): void {
    const rect = this.root.getBoundingClientRect();
    this.resultsPanel.style.top = `${rect.bottom + 6}px`;
    this.resultsPanel.style.right = `${window.innerWidth - rect.right}px`;
    this.resultsPanel.style.width = `${rect.width}px`;
  }

  private renderResults(): void {
    if (!this.resultsExpanded) return;
    const view = this.getView();
    const s = this.getState();
    if (!view || !s || s.matches.length === 0) {
      this.resultsList.innerHTML = '';
      this.lastRenderedMatches = null;
      const empty = document.createElement('div');
      empty.className = 'pmd-find-results-empty';
      empty.textContent = s && s.query ? 'No matches.' : 'Type to search.';
      this.resultsList.appendChild(empty);
      return;
    }
    // Same match list (only the active index changed) and the rows are still
    // present: only move the active highlight. Rebuilding every row + a snippet
    // per match is O(N) — the dominant per-step cost on huge searches.
    if (
      s.matches === this.lastRenderedMatches &&
      this.resultsList.querySelector('.pmd-find-result-row')
    ) {
      this.updateActiveResultRow(s.currentIndex);
      return;
    }
    this.lastRenderedMatches = s.matches;
    this.resultsList.innerHTML = '';
    const CATEGORY_LABEL: Record<string, string> = {
      heading: 'Heading',
      tag: 'Tag',
      analytic: 'Analytic',
      undertag: 'Undertag',
      cite: 'Cite',
      other: 'Body',
    };
    const shown = Math.min(s.matches.length, FIND_RESULT_ROW_CAP);
    for (let i = 0; i < shown; i++) {
      const m = s.matches[i]!;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'pmd-find-result-row';
      row.dataset['active'] = 'false';
      const cat = document.createElement('span');
      cat.className = `pmd-find-result-category pmd-find-result-category-${m.category}`;
      cat.textContent = CATEGORY_LABEL[m.category] ?? m.category;
      row.appendChild(cat);
      const snippetEl = document.createElement('span');
      snippetEl.className = 'pmd-find-result-snippet';
      const { before, hit, after } = buildSnippet(view, m);
      const b = document.createElement('span');
      b.className = 'pmd-find-result-snippet-before';
      b.textContent = before;
      const h = document.createElement('span');
      h.className = 'pmd-find-result-snippet-match';
      h.textContent = hit;
      const a = document.createElement('span');
      a.className = 'pmd-find-result-snippet-after';
      a.textContent = after;
      snippetEl.appendChild(b);
      snippetEl.appendChild(h);
      snippetEl.appendChild(a);
      row.appendChild(snippetEl);
      row.addEventListener('click', () => {
        const liveView = this.getView();
        if (!liveView) return;
        liveView.dispatch(
          liveView.state.tr.setMeta(findReplaceKey, {
            type: 'setCurrentIndex',
            index: i,
          }),
        );
        scrollToCurrentMatch(liveView);
        this.syncCount();
        this.renderResults();
      });
      this.resultsList.appendChild(row);
    }
    if (s.matches.length > shown) {
      const more = document.createElement('div');
      more.className = 'pmd-find-results-more';
      const total =
        s.matches.length >= FIND_MATCH_CAP ? `${FIND_MATCH_CAP}+` : `${s.matches.length}`;
      more.textContent = `Showing first ${shown} of ${total} — refine to narrow.`;
      this.resultsList.appendChild(more);
    }
    this.updateActiveResultRow(s.currentIndex);
  }

  /** Move the "active" highlight to the row for `currentIndex` and scroll it into
   *  view — without rebuilding the list. No-op for an index past the rendered cap
   *  (the active match is still scrolled to in the editor by `scrollToCurrentMatch`). */
  private updateActiveResultRow(currentIndex: number): void {
    const prev = this.resultsList.querySelector<HTMLElement>(
      '.pmd-find-result-row[data-active="true"]',
    );
    if (prev) prev.dataset['active'] = 'false';
    const rows = this.resultsList.querySelectorAll<HTMLElement>('.pmd-find-result-row');
    const row = currentIndex >= 0 ? rows[currentIndex] : undefined;
    if (row) {
      row.dataset['active'] = 'true';
      row.scrollIntoView({ block: 'nearest' });
    }
  }

  open(opts: FindBarOpenOptions): void {
    this.mode = opts.mode;
    this.sortMode = opts.sortMode;
    // Whether the bar was closed before this call. Used below to seed
    // the input only on a fresh open — re-triggering while already open
    // (e.g. Ctrl-F → Ctrl-H to switch modes) must keep what's typed.
    const wasClosed = this.root.hidden;
    this.root.hidden = false;
    this.replaceRow.hidden = opts.mode === 'find';
    this.sortLabel.textContent =
      opts.sortMode === 'uncategorized' ? 'uncategorized' : 'categorized';
    this.sortLabel.title =
      opts.sortMode === 'uncategorized'
        ? 'Alt-F: matches in document order from the cursor (wrapping), categories ignored'
        : 'Ctrl-F: matches grouped by category, each in document order from the cursor (wrapping). Configure category order in Settings.';

    // Capture the cursor position as the wrap anchor: ordering runs
    // top-to-bottom from here, then wraps to the top. Stays fixed for
    // the lifetime of this open — navigating through matches doesn't
    // re-anchor (otherwise the order would shift under the user's
    // feet as they step through).
    const view = this.getView();
    this.anchor = view ? view.state.selection.head : 0;
    this.openedView = view;
    this.openedNavPanel = this.getNavPanel();

    // Capture the selection range — used by the scope toggle as
    // the "search within this" scope. We capture once at open
    // time because focusing the find input would normally collapse
    // the editor selection visually (the browser doesn't render
    // text-selection highlights on an unfocused contenteditable),
    // losing the user's intent.
    let scopeCandidate: { from: number; to: number } | null = null;
    if (view && !view.state.selection.empty) {
      const { from, to } = view.state.selection;
      scopeCandidate = { from, to };
    }
    this.capturedScope = scopeCandidate;

    // Seed the input on a fresh open: with the remembered last query
    // when that setting is on, otherwise empty. Set it unconditionally
    // (not only when currently empty) — the bar keeps the DOM input's
    // value across open/close, so when the setting is off we must
    // actively clear the lingering query, otherwise the bar behaves as
    // if "remember last query" were always on. Selection-seeding is
    // intentionally NOT done — a user opening Ctrl-F with text selected
    // typically wants to scope the search to that selection (see the
    // scope toggle below), not pre-fill the find input with it.
    if (wasClosed) {
      this.findInput.value = settings.get('findRememberLastQuery')
        ? settings.get('findLastQuery')
        : '';
    }

    // Auto-enable the scope toggle whenever the user opened the
    // bar over a non-empty selection. The scope band decoration
    // doubles as the "we still know what you selected" visual,
    // which matters because focusing the find input clears the
    // browser's selection highlight on the editor.
    this.scopeCheckbox.checked = scopeCandidate !== null;

    this.findInput.focus();
    this.findInput.select();
    // Apply scope BEFORE the initial query so the rescan that
    // setQuery triggers respects the scope from the start.
    this.applyScopeFromToggle();
    this.applyQueryNow();
    this.subscribeToStateChanges();
    this.syncCount();
    this.setResultsExpanded(!!settings.get('findResultsExpanded'), false);
  }

  /** `refocusEditor: false` skips the editor refocus — for the pane-switch
   *  close, where focus is already moving to another pane and yanking it
   *  back to the outgoing editor would fight the click that caused the
   *  switch. */
  close(opts: { refocusEditor?: boolean } = {}): void {
    if (this.root.hidden) return;
    // Persist the last query before clearing the bar. Only write
    // non-empty values — an empty input on close would otherwise
    // clobber a previously-remembered query.
    if (settings.get('findRememberLastQuery') && this.findInput.value) {
      settings.set('findLastQuery', this.findInput.value);
    }
    this.root.hidden = true;
    this.resultsPanel.hidden = true;
    // A destroyed opened view (its doc was closed under the open bar) needs
    // no clearing — the decorations died with it — and dispatching would
    // throw. The lazy fallback only covers a bar that opened without a view.
    const view = this.openedView ?? this.getView();
    if (view && !view.isDestroyed) {
      view.dispatch(view.state.tr.setMeta(findReplaceKey, { type: 'clear' }));
      if (opts.refocusEditor !== false) view.focus();
    }
    this.openedNavPanel?.setFindHitPositions(null);
    this.openedView = null;
    this.openedNavPanel = null;
    this.capturedScope = null;
    this.unsubscribeFromStateChanges();
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Re-run `setQuery` against the live editor with whatever's in
   *  the find input + toggles. Used both for the debounced
   *  text-input path and the immediate toggle-change path. */
  private applyQueryNow(): void {
    if (this.setQueryTimer !== null) {
      clearTimeout(this.setQueryTimer);
      this.setQueryTimer = null;
    }
    const view = this.getView();
    if (!view) return;
    const query = this.findInput.value;
    view.dispatch(
      view.state.tr.setMeta(findReplaceKey, {
        type: 'setQuery',
        query,
        caseSensitive: this.caseSensitiveCheckbox.checked,
        wholeWord: this.wholeWordCheckbox.checked,
        anchor: this.anchor,
        sortMode: this.sortMode,
        categoryOrder: settings.get('findCategoryOrder'),
      }),
    );
    scrollToCurrentMatch(view);
    this.syncCount();
    this.renderResults();
    this.syncNavHits();
  }

  private scheduleSetQuery(): void {
    if (this.setQueryTimer !== null) clearTimeout(this.setQueryTimer);
    // Length-scaled debounce. Short queries match a huge number of
    // runs on a big doc (each match also costs a decoration), so
    // we wait longer for the user to commit. Once the query is
    // specific enough (4+ chars) the match count drops to something
    // tractable and we fire close to immediately.
    //
    // Empty input clears synchronously — no work to do.
    const q = this.findInput.value;
    if (q.length === 0) {
      this.applyQueryNow();
      return;
    }
    const delay =
      q.length === 1 ? 400 :
      q.length === 2 ? 250 :
      q.length === 3 ? 150 :
                       60;
    this.setQueryTimer = setTimeout(() => {
      this.setQueryTimer = null;
      this.applyQueryNow();
    }, delay);
  }

  private navigate(dir: 1 | -1): void {
    const view = this.getView();
    if (!view) return;
    view.dispatch(
      view.state.tr.setMeta(findReplaceKey, { type: 'navigate', dir }),
    );
    scrollToCurrentMatch(view);
    this.syncCount();
    this.renderResults();
    this.syncNavHits();
  }

  private doReplace(): void {
    const view = this.getView();
    if (!view) return;
    const cmd = runReplace(this.replaceInput.value);
    cmd(view.state, view.dispatch.bind(view));
    scrollToCurrentMatch(view);
    this.syncCount();
    this.renderResults();
    this.syncNavHits();
  }

  private doReplaceAll(): void {
    const view = this.getView();
    if (!view) return;
    const cmd = runReplaceAll(this.replaceInput.value);
    cmd(view.state, view.dispatch.bind(view));
    this.syncCount();
    this.renderResults();
    this.syncNavHits();
  }

  private getState(): FindReplaceState | null {
    const view = this.getView();
    if (!view) return null;
    return findReplaceKey.getState(view.state) ?? null;
  }

  /** Capture the selection range stashed during `open` (or last
   *  on-demand scope toggle) and apply it as the find scope.
   *  When the toggle is OFF, clears the scope. */
  private capturedScope: { from: number; to: number } | null = null;
  private applyScopeFromToggle(): void {
    const view = this.getView();
    if (!view) return;
    if (this.scopeCheckbox.checked) {
      // Prefer the scope we captured at open time (a non-empty
      // selection from before the user clicked into the find
      // input). Fall back to whatever the editor selection is
      // RIGHT NOW — useful if the user clicked the toggle without
      // having a pre-captured range (rare, but it shouldn't
      // dead-end).
      let next = this.capturedScope;
      if (!next) {
        const sel = view.state.selection;
        if (!sel.empty) next = { from: sel.from, to: sel.to };
      }
      if (!next) {
        // No selection to scope over — flip the toggle back off.
        this.scopeCheckbox.checked = false;
        return;
      }
      view.dispatch(
        view.state.tr.setMeta(findReplaceKey, { type: 'setScope', scope: next }),
      );
      this.capturedScope = next;
    } else {
      view.dispatch(
        view.state.tr.setMeta(findReplaceKey, { type: 'setScope', scope: null }),
      );
    }
    scrollToCurrentMatch(view);
    this.syncCount();
    this.renderResults();
    this.syncNavHits();
  }

  /** Push the current match set into the active nav panel so it
   *  can decorate hit-containing headings. Called on every state
   *  mutation in the bar (setQuery / navigate / replace / etc.)
   *  and on close (clears decorations). */
  private syncNavHits(): void {
    const nav = this.openedNavPanel;
    if (!nav) return;
    const s = this.getState();
    if (!s || s.matches.length === 0) {
      nav.setFindHitPositions(null);
      this.lastNavHitMatches = null;
      return;
    }
    // Hit positions only change when the match list does — skip the O(N) re-map +
    // re-render of every nav-pane marker when only the active index changed.
    if (s.matches === this.lastNavHitMatches) return;
    this.lastNavHitMatches = s.matches;
    nav.setFindHitPositions(s.matches.map((m) => m.from));
  }

  /** Listen for editor state changes so the bar stays in sync as the
   *  user types into the doc (matches re-scan on every doc-changing
   *  transaction). The count label is O(1) and stays synchronous; the
   *  results panel + nav markers rebuild O(matches) DOM (the plugin
   *  hands back a fresh matches array each rescan, so their identity
   *  guards never hit while typing), so those are coalesced into one
   *  trailing rebuild per burst of edits. */
  private subscribeToStateChanges(): void {
    if (this.unsubscribeView) this.unsubscribeView();
    const view = this.getView();
    if (!view) return;
    const dom = view.dom;
    const handler = () => {
      this.syncCount();
      if (this.stateChangeTimer !== null) clearTimeout(this.stateChangeTimer);
      this.stateChangeTimer = setTimeout(() => {
        this.stateChangeTimer = null;
        this.renderResults();
        this.syncNavHits();
      }, 150);
    };
    // PM doesn't expose a "state-changed" event on the view;
    // `input` + `keyup` on the editor DOM fire after dispatch in
    // practice and cover edits made in the editor while the bar is
    // open. Bar-driven dispatches call the sync methods directly.
    dom.addEventListener('input', handler);
    dom.addEventListener('keyup', handler);
    this.unsubscribeView = () => {
      dom.removeEventListener('input', handler);
      dom.removeEventListener('keyup', handler);
      if (this.stateChangeTimer !== null) {
        clearTimeout(this.stateChangeTimer);
        this.stateChangeTimer = null;
      }
    };
  }

  private unsubscribeFromStateChanges(): void {
    if (this.unsubscribeView) {
      this.unsubscribeView();
      this.unsubscribeView = null;
    }
  }

  private syncCount(): void {
    const s = this.getState();
    if (!s || s.matches.length === 0) {
      this.countLabel.textContent = s && s.query ? 'No matches' : '0 of 0';
      this.prevBtn.disabled = true;
      this.nextBtn.disabled = true;
      this.replaceBtn.disabled = true;
      this.replaceAllBtn.disabled = s ? !s.query : true;
      return;
    }
    const cur = s.currentIndex < 0 ? 0 : s.currentIndex + 1;
    const total =
      s.matches.length >= FIND_MATCH_CAP ? `${FIND_MATCH_CAP}+` : `${s.matches.length}`;
    this.countLabel.textContent = `${cur} of ${total}`;
    this.prevBtn.disabled = false;
    this.nextBtn.disabled = false;
    this.replaceBtn.disabled = false;
    this.replaceAllBtn.disabled = false;
  }
}
