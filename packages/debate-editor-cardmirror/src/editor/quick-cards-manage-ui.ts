/**
 * Quick Cards — Manage overlay.
 *
 * Full-window master/detail surface for browsing and editing the
 * quick-card library (see `reference-docs/SPEC-quick-cards.md`):
 *   - List (left): every card with its name, tags, source file, and
 *     updated date; sortable; multi-select for bulk delete / export;
 *     a filter box.
 *   - Detail (right): edit the selected card's name + tags, and its
 *     content in an embedded ProseMirror editor (shared schema +
 *     plugins). Save / Delete.
 *   - Export (selected or all) / Import via plain-JSON file pickers.
 *
 * Opens over everything via the `pmd-qc-manage-active` root class; the
 * editor stays mounted underneath. Live-updates from the store while
 * open (another window editing the library re-renders the list).
 */

import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Slice } from 'prosemirror-model';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import { checkedSliceFromJSON, sliceJsonIsValid } from '../schema/slice-check.js';
import { getHost } from './host/index.js';
import {
  quickCardsStore,
  buildQuickCard,
  distinctTags,
  findDuplicate,
  normalizeTag,
  type QuickCard,
} from './quick-cards-store.js';
import { setIcon } from './icons';
import { pushOverlay, popOverlay, isTopOverlay } from './overlay-stack.js';
import { alertDialog, confirmDialog } from './text-prompt.js';

type SortMode = 'updated' | 'name' | 'source';

class QuickCardsManageUI {
  private root: HTMLDivElement | null = null;
  private listEl!: HTMLDivElement;
  private detailEl!: HTMLDivElement;
  private unsubscribe: (() => void) | null = null;

  private cards: QuickCard[] = [];
  private selectedId: string | null = null;
  private checked = new Set<string>();
  private sortMode: SortMode = 'updated';
  private filter = '';

  // Detail draft + embedded editor. `renderSeq` guards the async
  // editor mount against re-entrant renders (Electron fires the store
  // subscription twice per mutation — optimistic + broadcast echo).
  private renderSeq = 0;
  private editor: EditorView | null = null;
  private draftName = '';
  private draftTags: string[] = [];
  private contentDirty = false;

  isOpen(): boolean {
    return !!this.root;
  }

  async open(opts: { selectId?: string } = {}): Promise<void> {
    if (this.root) {
      if (opts.selectId) this.select(opts.selectId);
      return;
    }
    this.cards = quickCardsStore.list();
    this.selectedId = opts.selectId ?? this.sortedFiltered()[0]?.id ?? null;

    this.root = document.createElement('div');
    this.root.className = 'pmd-qc-manage';
    this.root.innerHTML = `
      <div class="pmd-qc-manage-inner">
        <header class="pmd-qc-manage-header">
          <h1>Quick Cards</h1>
          <div class="pmd-qc-manage-header-actions"></div>
          <button type="button" class="pmd-qc-manage-close" aria-label="Close"><span class="pmd-icon pmd-icon-close" aria-hidden="true"></span></button>
        </header>
        <div class="pmd-qc-manage-cols">
          <div class="pmd-qc-manage-list-pane">
            <div class="pmd-qc-manage-listbar"></div>
            <div class="pmd-qc-manage-list"></div>
          </div>
          <div class="pmd-qc-manage-detail"></div>
        </div>
      </div>`;
    document.body.appendChild(this.root);
    document.documentElement.classList.add('pmd-qc-manage-active');

    this.listEl = this.root.querySelector('.pmd-qc-manage-list')!;
    this.detailEl = this.root.querySelector('.pmd-qc-manage-detail')!;
    this.root.querySelector('.pmd-qc-manage-close')!
      .addEventListener('click', () => void this.close());
    // On `document` (capture) — not `this.root` — so Esc closes from
    // anywhere, including before the user has focused any control in
    // the overlay (focus is still on the doc underneath on open).
    this.overlayToken = pushOverlay();
    document.addEventListener('keydown', this.onKeyDown, true);

    this.renderHeaderActions();
    this.renderListBar();
    await this.renderAll();

    this.unsubscribe = quickCardsStore.subscribe((cards) => {
      const wasDirty = this.isDirty();
      this.cards = cards;
      const selectionGone =
        this.selectedId && !cards.some((c) => c.id === this.selectedId);
      if (selectionGone) {
        // The open card was deleted (here or in another window) — reset.
        this.selectedId = this.sortedFiltered()[0]?.id ?? null;
        this.renderList();
        void this.renderDetail();
        return;
      }
      this.renderList();
      // Preserve an in-progress edit: only rebuild the detail (which
      // tears down the embedded editor) when there's nothing unsaved.
      if (!wasDirty) void this.renderDetail();
    });
  }

  async close(): Promise<void> {
    if (!this.root) return;
    // In-DOM confirm — native window.confirm on Windows/Linux never returns
    // keyboard focus to the editor (untypeable-editor field-bug class).
    if (this.isDirty() && !(await confirmDialog('Discard unsaved changes to this quick card?'))) {
      return;
    }
    this.teardownEditor();
    this.unsubscribe?.();
    this.unsubscribe = null;
    document.removeEventListener('keydown', this.onKeyDown, true);
    if (this.overlayToken) popOverlay(this.overlayToken);
    this.root.remove();
    this.root = null;
    document.documentElement.classList.remove('pmd-qc-manage-active');
  }

  private overlayToken: symbol | null = null;

  private onKeyDown = (e: KeyboardEvent): void => {
    // Esc always closes the overlay (like the × button), even from
    // inside the embedded editor or a text field. Capture-phase (see
    // the listener registration) so it wins over the editor's keymap.
    if (e.key === 'Escape') {
      // Only the topmost overlay reacts, so a stacked dialog doesn't
      // collapse the whole stack on one Escape.
      if (this.overlayToken && !isTopOverlay(this.overlayToken)) return;
      e.preventDefault();
      e.stopPropagation();
      void this.close();
    }
  };

  // ── Data shaping ──────────────────────────────────────────────────

  private sortedFiltered(): QuickCard[] {
    // Filter on name + tags only — NOT the full card content. Debate
    // cards carry so much body text that content matching makes almost
    // every query match everything (which read as "filter does
    // nothing"). Content search is the Search palette's job.
    const tokens = this.filter.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (c: QuickCard): boolean =>
      tokens.every(
        (tok) => c.nameLower.includes(tok) || c.tagsLower.some((t) => t.includes(tok)),
      );
    const rows = this.cards.filter(match);
    const cmp: Record<SortMode, (a: QuickCard, b: QuickCard) => number> = {
      updated: (a, b) => b.updatedAt - a.updatedAt,
      name: (a, b) => a.nameLower.localeCompare(b.nameLower),
      source: (a, b) =>
        a.sourceName.toLowerCase().localeCompare(b.sourceName.toLowerCase()) ||
        a.nameLower.localeCompare(b.nameLower),
    };
    return [...rows].sort(cmp[this.sortMode]);
  }

  // ── Rendering ─────────────────────────────────────────────────────

  private renderHeaderActions(): void {
    const host = this.root!.querySelector('.pmd-qc-manage-header-actions')!;
    host.innerHTML = '';
    const importBtn = button('Import…', () => void this.doImport());
    const exportAllBtn = button('Export all', () => void this.doExport(this.cards));
    host.append(importBtn, exportAllBtn);
  }

  private renderListBar(): void {
    const bar = this.root!.querySelector('.pmd-qc-manage-listbar')!;
    bar.innerHTML = '';

    const filter = document.createElement('input');
    filter.type = 'search';
    filter.className = 'pmd-qc-manage-filter';
    filter.placeholder = 'Filter…';
    filter.value = this.filter;
    filter.addEventListener('input', () => {
      this.filter = filter.value;
      this.renderList();
    });
    bar.appendChild(filter);

    const sort = document.createElement('select');
    sort.className = 'pmd-qc-manage-sort';
    for (const [val, label] of [
      ['updated', 'Recently updated'],
      ['name', 'Name'],
      ['source', 'Source file'],
    ] as const) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (val === this.sortMode) opt.selected = true;
      sort.appendChild(opt);
    }
    sort.addEventListener('change', () => {
      this.sortMode = sort.value as SortMode;
      this.renderList();
    });
    bar.appendChild(sort);

    // Bulk-action row (shown only when ≥1 checked).
    const bulk = document.createElement('div');
    bulk.className = 'pmd-qc-manage-bulk';
    bar.appendChild(bulk);
    this.renderBulkBar(bulk);
  }

  private renderBulkBar(bulk?: HTMLElement): void {
    const el = bulk ?? this.root?.querySelector<HTMLElement>('.pmd-qc-manage-bulk');
    if (!el) return;
    el.innerHTML = '';
    const n = this.checked.size;
    el.hidden = n === 0;
    if (n === 0) return;
    const count = document.createElement('span');
    count.className = 'pmd-qc-manage-bulk-count';
    count.textContent = `${n} selected`;
    el.append(
      count,
      button('Export', () =>
        void this.doExport(this.cards.filter((c) => this.checked.has(c.id))),
      ),
      confirmButton('Delete', () => void this.deleteChecked(), 'pmd-qc-manage-danger'),
    );
  }

  private async renderAll(): Promise<void> {
    this.renderList();
    await this.renderDetail();
  }

  private renderList(): void {
    const rows = this.sortedFiltered();
    this.listEl.innerHTML = '';
    if (rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pmd-qc-manage-empty';
      empty.textContent = this.cards.length
        ? 'No cards match your filter.'
        : 'No quick cards yet. Select text in a document and use Add Quick Card.';
      this.listEl.appendChild(empty);
      this.renderBulkBar();
      return;
    }
    for (const card of rows) {
      this.listEl.appendChild(this.renderRow(card));
    }
    this.renderBulkBar();
  }

  private renderRow(card: QuickCard): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-qc-manage-row';
    if (card.id === this.selectedId) row.classList.add('pmd-qc-manage-row-active');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'pmd-qc-manage-row-check';
    check.checked = this.checked.has(card.id);
    check.addEventListener('click', (e) => e.stopPropagation());
    check.addEventListener('change', () => {
      if (check.checked) this.checked.add(card.id);
      else this.checked.delete(card.id);
      this.renderBulkBar();
    });
    row.appendChild(check);

    const main = document.createElement('div');
    main.className = 'pmd-qc-manage-row-main';
    const name = document.createElement('div');
    name.className = 'pmd-qc-manage-row-name';
    name.textContent = card.name;
    main.appendChild(name);
    const meta = document.createElement('div');
    meta.className = 'pmd-qc-manage-row-meta';
    const tags = document.createElement('span');
    tags.className = 'pmd-qc-manage-row-tags';
    tags.textContent = card.tags.join(', ');
    meta.appendChild(tags);
    const src = document.createElement('span');
    src.className = 'pmd-qc-manage-row-src';
    src.textContent = card.sourceName || '—';
    meta.appendChild(src);
    main.appendChild(meta);
    row.appendChild(main);

    row.addEventListener('click', () => void this.select(card.id));
    return row;
  }

  private async select(id: string): Promise<void> {
    if (id === this.selectedId) return;
    if (this.isDirty() && !(await confirmDialog('Discard unsaved changes to this quick card?'))) {
      return;
    }
    this.selectedId = id;
    this.renderList();
    void this.renderDetail();
  }

  private async renderDetail(): Promise<void> {
    const seq = ++this.renderSeq;
    this.teardownEditor();
    this.detailEl.innerHTML = '';
    const card = this.cards.find((c) => c.id === this.selectedId);
    if (!card) {
      const empty = document.createElement('p');
      empty.className = 'pmd-qc-manage-empty';
      empty.textContent = 'Select a quick card to edit.';
      this.detailEl.appendChild(empty);
      return;
    }

    this.draftName = card.name;
    this.draftTags = [...card.tags];
    this.contentDirty = false;

    // Name
    const nameField = field('Name');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'pmd-qc-manage-input';
    nameInput.value = card.name;
    nameInput.addEventListener('input', () => {
      this.draftName = nameInput.value;
    });
    nameField.appendChild(nameInput);
    this.detailEl.appendChild(nameField);

    // Tags
    const tagsField = field('Tags');
    const chips = document.createElement('div');
    chips.className = 'pmd-qc-add-chips';
    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.className = 'pmd-qc-manage-input pmd-qc-add-tag-input';
    tagInput.placeholder = 'Add a tag…';
    const suggestions = document.createElement('div');
    suggestions.className = 'pmd-qc-add-suggestions';
    const renderChips = (): void => {
      chips.innerHTML = '';
      chips.hidden = this.draftTags.length === 0;
      this.draftTags.forEach((tag, i) => {
        const chip = document.createElement('span');
        chip.className = 'pmd-qc-add-chip';
        const label = document.createElement('span');
        label.textContent = tag;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'pmd-qc-add-chip-x';
        setIcon(x, 'close');
        x.addEventListener('click', () => {
          this.draftTags.splice(i, 1);
          renderChips();
          renderSuggestions();
        });
        chip.append(label, x);
        chips.appendChild(chip);
      });
    };
    const addTag = (raw: string): void => {
      const display = raw.trim().replace(/,+$/, '').trim();
      if (!display) return;
      const norm = normalizeTag(display);
      if (!this.draftTags.some((t) => normalizeTag(t) === norm)) {
        this.draftTags.push(display);
      }
      tagInput.value = '';
      renderChips();
      renderSuggestions();
    };
    const renderSuggestions = (): void => {
      const q = normalizeTag(tagInput.value);
      const taken = new Set(this.draftTags.map((t) => normalizeTag(t)));
      const matches = distinctTags(this.cards)
        .filter((t) => !taken.has(normalizeTag(t)))
        .filter((t) => (q ? normalizeTag(t).includes(q) : true))
        .slice(0, 12);
      suggestions.innerHTML = '';
      suggestions.hidden = matches.length === 0;
      for (const tag of matches) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pmd-qc-add-suggestion';
        b.textContent = tag;
        b.addEventListener('click', () => {
          addTag(tag);
          tagInput.focus();
        });
        suggestions.appendChild(b);
      }
    };
    tagInput.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && tagInput.value.trim()) {
        e.preventDefault();
        addTag(tagInput.value);
      } else if (e.key === 'Backspace' && !tagInput.value && this.draftTags.length) {
        this.draftTags.pop();
        renderChips();
        renderSuggestions();
      }
    });
    tagInput.addEventListener('input', renderSuggestions);
    tagsField.append(chips, tagInput, suggestions);
    this.detailEl.appendChild(tagsField);
    renderChips();
    renderSuggestions();

    // Content (embedded editor) + footer — both appended SYNCHRONOUSLY
    // (before the async editor mount) so an interleaved re-render can't
    // double-append the footer. Only the EditorView creation is async.
    const contentField = field('Content');
    contentField.classList.add('pmd-qc-manage-field-content');
    const editorHost = document.createElement('div');
    editorHost.className = 'pmd-qc-manage-editor';
    contentField.appendChild(editorHost);
    this.detailEl.appendChild(contentField);

    const footer = document.createElement('div');
    footer.className = 'pmd-qc-manage-detail-footer';
    footer.append(
      confirmButton('Delete', () => void this.deleteCard(card), 'pmd-qc-manage-danger'),
      button('Save', () => void this.saveCard(card), 'pmd-qc-manage-primary'),
    );
    this.detailEl.appendChild(footer);

    await this.mountEditor(editorHost, card, seq);
  }

  private async mountEditor(host: HTMLElement, card: QuickCard, seq: number): Promise<void> {
    const { buildEditorPlugins } = await import('./index.js');
    // Guard: a newer render started (or the user navigated away) while
    // the dynamic import resolved — discard this stale mount.
    if (!this.root || seq !== this.renderSeq || this.selectedId !== card.id) return;
    const doc = docFromCard(card);
    const state = EditorState.create({ doc, schema, plugins: buildEditorPlugins() });
    const self = this;
    const view: EditorView = new EditorView(host, {
      state,
      dispatchTransaction(tx) {
        const next = view.state.apply(tx);
        view.updateState(next);
        if (tx.docChanged) self.contentDirty = true;
      },
    });
    this.editor = view;
  }

  private teardownEditor(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  private isDirty(): boolean {
    const card = this.cards.find((c) => c.id === this.selectedId);
    if (!card) return false;
    if (this.contentDirty) return true;
    if (this.draftName !== card.name) return true;
    return JSON.stringify(this.draftTags) !== JSON.stringify(card.tags);
  }

  // ── Mutations ─────────────────────────────────────────────────────

  private async saveCard(card: QuickCard): Promise<void> {
    const name = this.draftName.trim();
    if (!name) {
      void alertDialog('Give the quick card a name.');
      return;
    }
    const dup = findDuplicate(this.cards, name, this.draftTags, card.id);
    if (dup) {
      void alertDialog(
        this.draftTags.length
          ? `Another quick card named “${name}” with those tags already exists.`
          : `Another quick card named “${name}” (no tags) already exists.`,
      );
      return;
    }
    const { json, plainText } = this.editor
      ? extractContent(this.editor.state.doc)
      : { json: card.contentJson, plainText: card.textLower };
    const updated = buildQuickCard({
      id: card.id,
      createdAt: card.createdAt,
      name,
      tags: this.draftTags,
      contentJson: json,
      plainText,
      sourceName: card.sourceName,
    });
    await quickCardsStore.upsert(updated);
    this.contentDirty = false;
    this.draftName = updated.name;
    this.draftTags = [...updated.tags];
  }

  private async deleteCard(card: QuickCard): Promise<void> {
    // Confirmation is the Delete button's two-click arm (see confirmButton).
    this.contentDirty = false; // skip the dirty guard during re-render
    this.draftName = card.name;
    this.draftTags = [...card.tags];
    await quickCardsStore.remove(card.id);
    this.checked.delete(card.id);
  }

  private async deleteChecked(): Promise<void> {
    const n = this.checked.size;
    if (n === 0) return;
    // Confirmation is the Delete button's two-click arm (see confirmButton).
    const ids = [...this.checked];
    this.checked.clear();
    // Drop the dirty guard if the open card is among the deleted.
    if (this.selectedId && ids.includes(this.selectedId)) this.contentDirty = false;
    for (const id of ids) await quickCardsStore.remove(id);
  }

  // ── Export / Import (plain JSON via the host file pickers) ─────────

  private async doExport(cards: QuickCard[]): Promise<void> {
    if (cards.length === 0) {
      void alertDialog('No quick cards to export.');
      return;
    }
    const payload = JSON.stringify({ version: 1, cards }, null, 2);
    const bytes = new TextEncoder().encode(payload);
    await getHost().saveAs('quick-cards.json', bytes, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
  }

  private async doImport(): Promise<void> {
    const opened = await getHost().openFile({
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!opened) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(opened.bytes));
    } catch {
      void alertDialog(`Couldn't read “${opened.name}” as JSON.`);
      return;
    }
    const incoming = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { cards?: unknown }).cards)
        ? (parsed as { cards: unknown[] }).cards
        : null;
    if (!incoming) {
      void alertDialog(`“${opened.name}” doesn't look like a quick-cards export.`);
      return;
    }
    // Import as NEW (fresh ids) so an import never overwrites an
    // existing card; rebuild via buildQuickCard to recompute keys.
    // Structural gate (audit tier 2): contentJson is arbitrary external
    // JSON, and the insert path splices closed nodes past ProseMirror's
    // frontier-only validation — refuse records whose slice doesn't
    // validate rather than persist a payload that would re-inject
    // invalid structure on every future use.
    const cards: QuickCard[] = [];
    let skippedInvalid = 0;
    for (const raw of incoming) {
      const r = raw as Partial<QuickCard>;
      if (typeof r.name !== 'string' || r.contentJson === undefined) continue;
      if (!sliceJsonIsValid(r.contentJson)) {
        skippedInvalid++;
        continue;
      }
      cards.push(
        buildQuickCard({
          name: r.name,
          tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
          contentJson: r.contentJson,
          plainText: typeof r.textLower === 'string' ? r.textLower : '',
          sourceName: typeof r.sourceName === 'string' ? r.sourceName : '',
        }),
      );
    }
    if (cards.length === 0) {
      void alertDialog(
        skippedInvalid > 0
          ? `No importable quick cards — ${skippedInvalid} record${skippedInvalid === 1 ? ' was' : 's were'} skipped as structurally invalid.`
          : 'No importable quick cards found in that file.',
      );
      return;
    }
    await quickCardsStore.importMany(cards);
    void alertDialog(
      `Imported ${cards.length} quick card${cards.length === 1 ? '' : 's'}.` +
        (skippedInvalid > 0
          ? ` Skipped ${skippedInvalid} structurally invalid record${skippedInvalid === 1 ? '' : 's'}.`
          : ''),
    );
  }
}

// ── Module helpers ───────────────────────────────────────────────────

function button(label: string, onClick: () => void, extraClass = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `pmd-qc-manage-btn ${extraClass}`.trim();
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** A two-click confirm button: the first click arms it (label → "<label>?"),
 *  a second click within 3s runs `onConfirm`; otherwise it disarms. Mirrors the
 *  learn manager's two-click delete — avoids the native confirm(), which
 *  Electron disables. */
function confirmButton(
  label: string,
  onConfirm: () => void,
  extraClass = '',
): HTMLButtonElement {
  const b = button(label, () => {}, extraClass);
  let armed = false;
  let armTimer: number | null = null;
  const disarm = (): void => {
    armed = false;
    b.textContent = label;
    b.classList.remove('is-armed');
    if (armTimer !== null) {
      window.clearTimeout(armTimer);
      armTimer = null;
    }
  };
  b.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      b.textContent = `${label}?`;
      b.classList.add('is-armed');
      armTimer = window.setTimeout(disarm, 3000);
      return;
    }
    disarm();
    onConfirm();
  });
  return b;
}

function field(label: string): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.className = 'pmd-qc-manage-field';
  const span = document.createElement('span');
  span.className = 'pmd-qc-manage-field-label';
  span.textContent = label;
  wrap.appendChild(span);
  return wrap;
}

/** Build an editable doc seeded with a card's stored slice. Inserting
 *  the slice into an empty doc (replaceSelection) handles open/inline
 *  slices the way paste does, so any captured content is editable.
 *  A stored payload that fails validation (see slice-check.ts) yields
 *  a placeholder doc instead of an exception — the manage UI must
 *  keep working around one corrupt record. */
function docFromCard(card: QuickCard): PMNode {
  const empty = schema.topNodeType.createAndFill();
  let st = EditorState.create({ doc: empty ?? schema.topNodeType.create(), schema });
  try {
    const slice = checkedSliceFromJSON(card.contentJson);
    st = st.apply(st.tr.replaceSelection(slice));
    return st.doc;
  } catch {
    st = st.apply(
      st.tr.insertText("This quick card's stored content is invalid and can't be edited."),
    );
    return st.doc;
  }
}

/** Extract the edited content back to a slice JSON + plain-text key,
 *  trimming a single trailing empty paragraph the seed/edits may leave. */
function extractContent(doc: PMNode): { json: unknown; plainText: string } {
  let end = doc.content.size;
  const last = doc.lastChild;
  if (last && last.isTextblock && last.content.size === 0 && doc.childCount > 1) {
    end -= last.nodeSize;
  }
  const slice = doc.slice(0, end);
  return {
    json: slice.toJSON(),
    plainText: doc.textBetween(0, end, '\n', '\n'),
  };
}

export const quickCardsManageUI = new QuickCardsManageUI();
