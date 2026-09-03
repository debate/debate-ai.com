/**
 * Learn — manage flashcards (SPEC-learn-system §8). A full-screen overlay
 * that lists every card grouped by the file it's anchored to, so the
 * user can see which cards belong to which document (and confirm cards
 * re-associate after a round-trip), edit / delete / suspend them, and
 * jump into a scoped review.
 *
 * Reads + mutates the local learn store only; no file I/O. Live-updates
 * from the store while open. Decks are a later increment — this groups
 * by file (+ an "Unanchored" bucket).
 */

import { learnStore, localToday } from './learn-store-host.js';
import { openCardEditor } from './learn-create-ui.js';
import { openLearnSession } from './learn-session-ui.js';
import { isDue } from './learn-scheduler.js';
import type { CardState } from './learn-scheduler.js';
import type { CardDef, ExportedCard } from './learn-store.js';
import type { AnchorDescriptor } from './learn-anchor.js';
import { getHost } from './host/index.js';
import { pushOverlay, popOverlay, isTopOverlay } from './overlay-stack.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { readDocIdFromBytes, stampDocId } from '../index.js';

let openOverlay: HTMLElement | null = null;

// ── Export / Import (plain JSON via the host file pickers) ────────────

async function doExportCards(): Promise<void> {
  const cards = learnStore.exportCards();
  if (cards.length === 0) {
    showToast('No flashcards to export.');
    return;
  }
  const payload = JSON.stringify({ version: 1, cards }, null, 2);
  const bytes = new TextEncoder().encode(payload);
  await getHost().saveAs('cardmirror-flashcards.json', bytes, {
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
}

async function doImportCards(): Promise<void> {
  const opened = await getHost().openFile({
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!opened) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(opened.bytes));
  } catch {
    showToast(`Couldn't read “${opened.name}” as JSON.`);
    return;
  }
  const rawCards = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { cards?: unknown }).cards)
      ? (parsed as { cards: unknown[] }).cards
      : null;
  if (!rawCards) {
    showToast(`“${opened.name}” doesn't look like a flashcard export.`);
    return;
  }
  const entries = rawCards
    .map(parseImportedCard)
    .filter((e): e is ExportedCard => e !== null);
  if (entries.length === 0) {
    showToast('No importable flashcards found in that file.');
    return;
  }
  // ADD, never overwrite — importCards mints fresh ids; the open list
  // re-renders via the store subscription.
  const added = learnStore.importCards(entries, localToday());
  showToast(`Added ${added} flashcard${added === 1 ? '' : 's'}.`);
}

/** Defensively coerce one entry from an (untrusted) import file into an
 *  `ExportedCard`, or null if it isn't a usable card. */
function parseImportedCard(raw: unknown): ExportedCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r['type'] === 'cloze' ? 'cloze' : r['type'] === 'qa' ? 'qa' : null;
  if (!type) return null;
  const front = typeof r['front'] === 'string' ? r['front'] : '';
  const back = typeof r['back'] === 'string' ? r['back'] : '';
  if (!front) return null;

  // Schedule — only carried if well-formed; otherwise the card starts
  // fresh (due now) on import.
  let schedule: ExportedCard['schedule'] = null;
  const s = r['schedule'];
  if (s && typeof s === 'object') {
    const so = s as Record<string, unknown>;
    const state = so['state'];
    const stateOk =
      state === 'new' || state === 'learning' || state === 'review' || state === 'suspended';
    if (stateOk && typeof so['dueOn'] === 'string') {
      schedule = {
        state: state as CardState,
        dueOn: so['dueOn'],
        intervalDays: typeof so['intervalDays'] === 'number' ? so['intervalDays'] : 0,
        reps: typeof so['reps'] === 'number' ? so['reps'] : 0,
        lapses: typeof so['lapses'] === 'number' ? so['lapses'] : 0,
        lastReviewed: typeof so['lastReviewed'] === 'string' ? so['lastReviewed'] : null,
      };
    }
  }

  const anchors: ExportedCard['anchors'] = [];
  if (Array.isArray(r['anchors'])) {
    for (const a of r['anchors']) {
      if (!a || typeof a !== 'object') continue;
      const ao = a as Record<string, unknown>;
      if (typeof ao['docId'] !== 'string') continue;
      anchors.push({ docId: ao['docId'], anchor: parseImportedAnchor(ao['anchor']) });
    }
  }

  return { type, front, back, schedule, anchors };
}

/** Coerce an import file's anchor blob into a valid `AnchorDescriptor`,
 *  or null (unanchored / malformed). */
function parseImportedAnchor(raw: unknown): AnchorDescriptor | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o['quote'] !== 'string') return null;
  return {
    quote: o['quote'],
    prefix: typeof o['prefix'] === 'string' ? o['prefix'] : '',
    suffix: typeof o['suffix'] === 'string' ? o['suffix'] : '',
    approxPos: typeof o['approxPos'] === 'number' ? o['approxPos'] : 0,
  };
}

export function openLearnManage(): void {
  if (openOverlay) return; // already open — single instance

  const overlay = document.createElement('div');
  overlay.className = 'pmd-learn-manage-overlay';
  const panel = document.createElement('div');
  panel.className = 'pmd-learn-manage';
  overlay.appendChild(panel);
  openOverlay = overlay;

  let filter = '';
  let showSuspended = true;

  // ── Chrome (built once; only the list body re-renders) ──────────────
  const bar = document.createElement('div');
  bar.className = 'pmd-learn-manage-bar';
  const title = document.createElement('span');
  title.className = 'pmd-learn-manage-title';
  title.textContent = 'Flashcards';
  const count = document.createElement('span');
  count.className = 'pmd-learn-manage-count';
  const newCard = document.createElement('button');
  newCard.type = 'button';
  newCard.className = 'pmd-learn-manage-new';
  newCard.textContent = 'New card';
  newCard.title = 'Create a flashcard not tied to any document';
  newCard.addEventListener('click', () => {
    void (async () => {
      const def = await openCardEditor();
      if (!def) return;
      // Unanchored: a card with no CardAnchor. Still scheduled + reviewable
      // (the 'all' scope covers every card); appears in the Unanchored group.
      learnStore.upsertCard(
        { id: crypto.randomUUID(), type: def.type, front: def.front, back: def.back },
        localToday(),
      );
    })();
  });
  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'pmd-learn-manage-new';
  importBtn.textContent = 'Import';
  importBtn.title = 'Add flashcards from a file (never overwrites existing cards)';
  importBtn.addEventListener('click', () => void doImportCards());
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'pmd-learn-manage-new';
  exportBtn.textContent = 'Export';
  exportBtn.title = 'Save all flashcards to a file';
  exportBtn.addEventListener('click', () => void doExportCards());
  const reviewAll = document.createElement('button');
  reviewAll.type = 'button';
  reviewAll.className = 'pmd-learn-manage-review';
  reviewAll.textContent = 'Review all due';
  reviewAll.addEventListener('click', () =>
    openLearnSession({ kind: 'all' }, { title: 'Review — all', onShowInContext: cleanup }),
  );
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pmd-learn-manage-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '✕';
  close.addEventListener('click', cleanup);
  bar.append(title, count, newCard, importBtn, exportBtn, reviewAll, close);

  const toolbar = document.createElement('div');
  toolbar.className = 'pmd-learn-manage-toolbar';
  const filterInput = document.createElement('input');
  filterInput.type = 'search';
  filterInput.className = 'pmd-learn-manage-filter';
  filterInput.placeholder = 'Filter cards…';
  filterInput.addEventListener('input', () => {
    filter = filterInput.value;
    renderList();
  });
  const suspLabel = document.createElement('label');
  suspLabel.className = 'pmd-learn-manage-susp';
  const suspCb = document.createElement('input');
  suspCb.type = 'checkbox';
  suspCb.checked = showSuspended;
  suspCb.addEventListener('change', () => {
    showSuspended = suspCb.checked;
    renderList();
  });
  suspLabel.append(suspCb, document.createTextNode('Show suspended'));
  toolbar.append(filterInput, suspLabel);

  const listEl = document.createElement('div');
  listEl.className = 'pmd-learn-manage-list';

  panel.append(bar, toolbar, listEl);

  const unsubscribe = learnStore.subscribe(renderList);
  const overlayToken = pushOverlay();
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (!isTopOverlay(overlayToken)) return; // topmost overlay only
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    }
  }

  function cleanup(): void {
    unsubscribe();
    document.removeEventListener('keydown', onKey, true);
    popOverlay(overlayToken);
    overlay.remove();
    openOverlay = null;
  }

  // ── List body ───────────────────────────────────────────────────────
  function renderList(): void {
    const today = localToday();
    const cards = learnStore.listCards();
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const anchors = learnStore.listAnchors();
    const docs = new Map(learnStore.listDocs().map((d) => [d.docId, d]));

    count.textContent = cards.length === 1 ? '1 card' : `${cards.length} cards`;

    // Group cardIds by docId; track which cards are anchored anywhere and
    // how many files each is shared across.
    const byDoc = new Map<string, Set<string>>();
    const anchoredIds = new Set<string>();
    const docCount = new Map<string, number>();
    for (const a of anchors) {
      anchoredIds.add(a.cardId);
      docCount.set(a.cardId, (docCount.get(a.cardId) ?? 0) + 1);
      let set = byDoc.get(a.docId);
      if (!set) byDoc.set(a.docId, (set = new Set()));
      set.add(a.cardId);
    }

    const tokens = filter.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (c: CardDef): boolean => {
      if (tokens.length === 0) return true;
      const hay = `${c.front}\n${c.back}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    };
    const visible = (cardId: string): boolean => {
      const c = cardById.get(cardId);
      if (!c || !matches(c)) return false;
      if (!showSuspended && learnStore.getSchedule(cardId)?.state === 'suspended') return false;
      return true;
    };

    listEl.replaceChildren();

    if (cards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pmd-learn-manage-empty';
      empty.textContent = 'No flashcards yet. Select text in a document and choose Create Flashcard.';
      listEl.appendChild(empty);
      return;
    }

    // File groups, ordered by display name.
    const docIds = [...byDoc.keys()].sort((a, b) => {
      const na = docs.get(a)?.lastName ?? 'Untitled';
      const nb = docs.get(b)?.lastName ?? 'Untitled';
      return na.localeCompare(nb);
    });
    let anyShown = false;
    for (const docId of docIds) {
      const ids = [...byDoc.get(docId)!].filter(visible);
      if (ids.length === 0) continue;
      anyShown = true;
      const entry = docs.get(docId);
      const due = learnStore.dueCount({ kind: 'file', docId }, today);
      listEl.appendChild(
        groupHeader(entry?.lastName ?? 'Untitled', ids.length, due, () =>
          openLearnSession(
            { kind: 'file', docId },
            { title: `Review — ${entry?.lastName ?? 'Untitled'}`, onShowInContext: cleanup },
          ),
        ),
      );
      for (const id of ids) {
        const c = cardById.get(id)!;
        listEl.appendChild(cardRow(c, today, (docCount.get(id) ?? 1) > 1, false));
      }
    }

    // Unanchored bucket — cards whose text reference is gone in every
    // file (or that were never anchored). Their schedule still lives.
    const orphans = cards.filter((c) => !anchoredIds.has(c.id) && visible(c.id));
    if (orphans.length > 0) {
      anyShown = true;
      listEl.appendChild(groupHeader('Unanchored', orphans.length, 0, null));
      for (const c of orphans) listEl.appendChild(cardRow(c, today, false, true));
    }

    if (!anyShown) {
      const none = document.createElement('div');
      none.className = 'pmd-learn-manage-empty';
      none.textContent = 'No cards match the current filter.';
      listEl.appendChild(none);
    }
  }

  /** A file/section heading with a card count and an optional Review link.
   *  No format chip — the filename's extension already shows the format,
   *  and a chip there competed with the per-card type badge. */
  function groupHeader(
    name: string,
    cardN: number,
    due: number,
    onReview: (() => void) | null,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-learn-manage-group';
    const label = document.createElement('span');
    label.className = 'pmd-learn-manage-group-name';
    label.textContent = name;
    label.title = name;
    row.appendChild(label);
    const meta = document.createElement('span');
    meta.className = 'pmd-learn-manage-group-meta';
    meta.textContent = due > 0 ? `${cardN} · ${due} due` : `${cardN}`;
    row.appendChild(meta);
    if (onReview && due > 0) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmd-learn-manage-group-review';
      btn.textContent = 'Review';
      btn.addEventListener('click', onReview);
      row.appendChild(btn);
    }
    return row;
  }

  function cardRow(card: CardDef, today: string, shared: boolean, canLink: boolean): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-learn-manage-card';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'pmd-learn-manage-type';
    typeBadge.textContent = card.type === 'cloze' ? 'Cloze' : 'Q&A';
    row.appendChild(typeBadge);

    const text = document.createElement('div');
    text.className = 'pmd-learn-manage-text';
    const frontEl = document.createElement('div');
    frontEl.className = 'pmd-learn-manage-front';
    frontEl.textContent = card.front;
    text.appendChild(frontEl);
    if (card.type === 'qa' && card.back) {
      const backEl = document.createElement('div');
      backEl.className = 'pmd-learn-manage-back';
      backEl.textContent = card.back;
      text.appendChild(backEl);
    }
    row.appendChild(text);

    if (shared) {
      const sh = document.createElement('span');
      sh.className = 'pmd-learn-manage-shared';
      sh.textContent = 'shared';
      sh.title = 'Anchored in more than one file (one shared schedule)';
      row.appendChild(sh);
    }

    const sched = learnStore.getSchedule(card.id);
    const state = document.createElement('span');
    const suspended = sched?.state === 'suspended';
    const due = sched ? isDue(sched, today) : false;
    state.className = `pmd-learn-manage-state${suspended ? ' is-suspended' : due ? ' is-due' : ''}`;
    state.textContent = !sched
      ? '—'
      : suspended
        ? 'Suspended'
        : sched.state === 'new'
          ? 'New'
          : due
            ? 'Due'
            : `Due ${sched.dueOn}`;
    row.appendChild(state);

    const actions = document.createElement('div');
    actions.className = 'pmd-learn-manage-actions';

    if (canLink) {
      // Link this unanchored card to a file (file-level association; the
      // user can ground it to specific text later from inside that file).
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'pmd-learn-manage-action pmd-learn-manage-link';
      link.title = 'Link to a file';
      link.appendChild(icon('link', { label: 'Link to a file' }));
      link.addEventListener('click', () => void linkCardToFile(card.id));
      actions.appendChild(link);
    }

    const edit = mkAction('Edit', () => {
      void (async () => {
        const def = await openCardEditor({
          initial: { type: card.type, front: card.front, back: card.back },
        });
        if (def) {
          learnStore.upsertCard({ id: card.id, type: def.type, front: def.front, back: def.back }, today);
        }
      })();
    });

    const susp = mkAction(suspended ? 'Resume' : 'Suspend', () => {
      learnStore.setSuspended(card.id, !suspended);
    });

    // Two-click delete (avoids native confirm, which Electron disables).
    const del = mkAction('Delete', () => {});
    del.classList.add('pmd-learn-manage-delete');
    let armed = false;
    let armTimer: number | null = null;
    del.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        del.textContent = 'Delete?';
        del.classList.add('is-armed');
        armTimer = window.setTimeout(() => {
          armed = false;
          del.textContent = 'Delete';
          del.classList.remove('is-armed');
        }, 3000);
        return;
      }
      if (armTimer !== null) window.clearTimeout(armTimer);
      learnStore.deleteCard(card.id);
    });

    actions.append(edit, susp, del);
    row.appendChild(actions);
    return row;
  }

  renderList();
  document.body.appendChild(overlay);
  filterInput.focus();
}

/** Link an unanchored card to a file the user picks. Reads the file's
 *  docId (minting + stamping one in if it has none, so a future open
 *  re-associates), then records a file-level CardAnchor (null text
 *  anchor — the user grounds it to specific text later from inside the
 *  file). The manage list re-renders via the store subscription. */
async function linkCardToFile(cardId: string): Promise<void> {
  const host = getHost();
  const opened = await host.openFile({
    filters: [
      { name: 'CardMirror & Word documents', extensions: ['cmir', 'docx'] },
      { name: 'CardMirror', extensions: ['cmir'] },
      { name: 'Word', extensions: ['docx'] },
    ],
  });
  if (!opened) return;
  const lower = opened.name.toLowerCase();
  const format: 'cmir' | 'docx' | null = lower.endsWith('.cmir')
    ? 'cmir'
    : lower.endsWith('.docx')
      ? 'docx'
      : null;
  if (!format) {
    showToast('Pick a .cmir or .docx file to link.');
    return;
  }
  try {
    let docId = await readDocIdFromBytes(opened.bytes, format);
    if (!docId) {
      // No identity yet — mint one and stamp it into the file so a future
      // open re-associates with this card. Needs a writable handle.
      if (opened.handle == null) {
        showToast(`Can’t link “${opened.name}” — its location isn’t writable here.`);
        return;
      }
      docId = crypto.randomUUID();
      const stamped = await stampDocId(opened.bytes, format, docId);
      await host.saveExisting(opened.handle, stamped);
    }
    learnStore.registerDoc({
      docId,
      path: typeof opened.handle === 'string' ? opened.handle : null,
      name: opened.name,
      format,
    });
    learnStore.setAnchor(cardId, docId, null); // file-level; text anchor TBD
    showToast(`Linked to “${opened.name}”.`);
  } catch (err) {
    console.error('Link to file failed:', err);
    showToast(`Couldn’t link to “${opened.name}”.`);
  }
}

function mkAction(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pmd-learn-manage-action';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
