/**
 * Version history — the renderer half of the "Keep version history"
 * setting.
 *
 * On every save trigger (manual and autosave), the serialized `.cmir`
 * bytes are offered to the main-process snapshot store
 * (apps/desktop/src/doc-history.ts) BEFORE the document's own disk
 * write is awaited — deliberately, so a save whose destination folder
 * is wedged (the field case: a cloud-sync placeholder hanging the
 * write) still leaves a recoverable version in app data. The store
 * dedups identical content by hash; this module adds the tier policy
 * and a per-doc minimum interval so bursts of autosaves don't grind
 * the store.
 *
 * Relationship to the crash journals: the journal is the always-on,
 * seconds-fresh, single overwritten copy whose deletion means "nothing
 * to recover"; this is the opt-out, capped, browsable trail behind it.
 * Never a replacement — see the journals' module docs.
 *
 * The solo branch of Recover Previous Version lives here too: a
 * version list for the focused doc's snapshots, mirroring the session
 * history dialog's chrome, each version opening as a new unsaved doc.
 */

import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { getElectronHost } from './host/index.js';
import { isTopOverlay, popOverlay, pushOverlay } from './overlay-stack.js';
import { settings } from './settings.js';
import { showToast } from './toast.js';
import { parseNative } from '../native/index.js';
import { countReadAloudWords } from './word-count.js';
import { NavigationPanel } from './nav-panel.js';

export type VersionHistoryTier = 'off' | 'standard' | 'extended' | 'custom';

interface TierPolicy {
  minIntervalMs: number;
  retentionDays: number;
  maxDocBytes: number;
  maxTotalBytes: number;
}

/** The tiers the setting exposes. Standard is the capped default the
 *  settings copy describes; Extended is the opt-in "more history, more
 *  disk" mode whose description carries the disk warning. */
const TIER_POLICIES: Record<'standard' | 'extended', TierPolicy> = {
  standard: {
    minIntervalMs: 5 * 60 * 1000,
    retentionDays: 30,
    maxDocBytes: 50 * 1024 * 1024,
    maxTotalBytes: 500 * 1024 * 1024,
  },
  extended: {
    minIntervalMs: 2 * 60 * 1000,
    retentionDays: 90,
    maxDocBytes: 200 * 1024 * 1024,
    maxTotalBytes: 2 * 1024 * 1024 * 1024,
  },
};

/** Last snapshot ATTEMPT per doc (session-scoped). Attempt, not
 *  success: an unchanged-content skip still resets the clock — the
 *  content will still be unchanged in a minute. */
const lastAttemptAt = new Map<string, number>();

/**
 * Offer one save's bytes to the snapshot store. Fire-and-forget by
 * design: never awaited by a save path, never surfaces errors (a
 * failed snapshot must not scare anyone out of a successful save —
 * the journal still guards the crash case).
 */
/** The active tier's effective policy, or null when history is off.
 *  Custom takes Extended's cadence and retention and the user's own
 *  byte caps (the caps are the knob people actually asked for; a
 *  custom retention would multiply the matrix for little gain). */
export function currentHistoryPolicy(): TierPolicy | null {
  const tier = settings.get('versionHistory');
  if (tier === 'off') return null;
  if (tier === 'custom') {
    // 0 = uncapped. A huge FINITE stand-in rather than Infinity: the
    // policy crosses IPC and main validates Number.isFinite on it.
    const mb = (v: number): number =>
      v === 0 ? Number.MAX_SAFE_INTEGER : v * 1024 * 1024;
    return {
      minIntervalMs: TIER_POLICIES.extended.minIntervalMs,
      retentionDays: TIER_POLICIES.extended.retentionDays,
      maxDocBytes: mb(settings.get('versionHistoryDocCapMb')),
      maxTotalBytes: mb(settings.get('versionHistoryTotalCapMb')),
    };
  }
  return TIER_POLICIES[tier];
}

export type SnapshotTrigger = 'manual' | 'auto' | 'close';

export function maybeSnapshotVersion(
  docId: string | null | undefined,
  bytes: Uint8Array,
  trigger: SnapshotTrigger,
): void {
  if (!docId) return; // never-saved drafts are the journal's job
  const host = getElectronHost();
  if (!host) return; // web: no app-data store
  const policy = currentHistoryPolicy();
  if (!policy) return;
  const now = Date.now();
  const last = lastAttemptAt.get(docId) ?? 0;
  if (now - last < policy.minIntervalMs) return;
  lastAttemptAt.set(docId, now);
  void host
    .historySnapshot(
      docId,
      bytes,
      {
        retentionDays: policy.retentionDays,
        maxDocBytes: policy.maxDocBytes,
        maxTotalBytes: policy.maxTotalBytes,
      },
      trigger,
    )
    .catch(() => {});
}

// ─── Solo version list (Recover Previous Version branch) ───────────

/** Matches collab-recover-ui's OpenRecoveredDoc — supplied by index.ts. */
type OpenRecoveredDoc = (name: string, bytes: Uint8Array) => Promise<void>;

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Snapshots exist for this doc? (Cheap gate for the recover flow.) */
export async function hasVersionSnapshots(docId: string | null | undefined): Promise<boolean> {
  if (!docId) return false;
  const host = getElectronHost();
  if (!host) return false;
  return (await host.historyList(docId)).length > 0;
}

// ─── Derived snapshot stats (rows that say what changed) ───────────

/** Per-snapshot digest: word/card counts plus a card signature map
 *  (tag id → content hash) that powers the delta lines and the
 *  "not in current doc" badge. Cheap relative to the parse. */
export interface SnapshotStats {
  words: number;
  cards: number;
  /** tag heading id → hash of the tag's text. */
  sig: Map<string, string>;
}

/** djb2 over the text, base36 — collision-tolerant (a false "same"
 *  only mutes an "edited" nuance, never loses a version). */
function textHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function computeSnapshotStats(doc: PMNode): SnapshotStats {
  const sig = new Map<string, string>();
  let cards = 0;
  doc.descendants((node) => {
    const t = node.type.name;
    if (t === 'card') cards++;
    if (t === 'tag') {
      const id = node.attrs['id'];
      if (typeof id === 'string' && id) sig.set(id, textHash(node.textContent));
      return false; // tag has no card descendants
    }
    return true;
  });
  return { words: countReadAloudWords(doc), cards, sig };
}

export interface SnapshotDelta {
  addedCards: number;
  removedCards: number;
  wordsDelta: number;
}

/** What `next` (newer) has relative to `prev` (older). */
export function diffSnapshotStats(next: SnapshotStats, prev: SnapshotStats): SnapshotDelta {
  let addedCards = 0;
  for (const id of next.sig.keys()) if (!prev.sig.has(id)) addedCards++;
  let removedCards = 0;
  for (const id of prev.sig.keys()) if (!next.sig.has(id)) removedCards++;
  return { addedCards, removedCards, wordsDelta: next.words - prev.words };
}

/** Cards in `snap` that a reference doc lacks (the recovery question:
 *  "which version has the thing I lost?"). */
export function cardsMissingFrom(snap: SnapshotStats, reference: SnapshotStats): number {
  let n = 0;
  for (const id of snap.sig.keys()) if (!reference.sig.has(id)) n++;
  return n;
}

export function formatDelta(d: SnapshotDelta): string {
  const parts: string[] = [];
  if (d.addedCards > 0) parts.push(`+${d.addedCards} card${d.addedCards === 1 ? '' : 's'}`);
  if (d.removedCards > 0) parts.push(`\u2212${d.removedCards} card${d.removedCards === 1 ? '' : 's'}`);
  if (d.wordsDelta !== 0) {
    const sign = d.wordsDelta > 0 ? '+' : '\u2212';
    parts.push(`${sign}${Math.abs(d.wordsDelta).toLocaleString()} words`);
  }
  return parts.length ? `${parts.join(' \u00b7 ')} vs previous` : 'No content changes vs previous';
}

/**
 * Mount a read-only rendered preview of `doc` into `pane`: a REAL
 * NavigationPanel on the left (the user's actual nav pane — level
 * buttons, chevron + double-click expand/collapse, per-type styling)
 * and the document on the right, rendered by a real ProseMirror view
 * wearing `.pmd-pane-editor` so the full document stylesheet applies.
 * Returns the view — caller owns destroy() (the nav panel is torn
 * down with it via the returned view's destroy hook).
 */
export function mountVersionPreview(pane: HTMLElement, doc: PMNode, opts: { plugins?: Plugin[] } = {}): EditorView {
  pane.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'pmd-recover-preview-wrap';
  const navHost = document.createElement('div');
  navHost.className = 'pmd-recover-preview-nav';
  const scrollHost = document.createElement('div');
  scrollHost.className = 'pmd-recover-preview-scroll';
  const mountHost = document.createElement('div');
  mountHost.className = 'pmd-pane-editor pmd-recover-preview-editor';
  scrollHost.appendChild(mountHost);
  wrap.append(navHost, scrollHost);
  pane.appendChild(wrap);
  const view = new EditorView(mountHost, {
    state: EditorState.create({ doc, plugins: opts.plugins ?? [] }),
    editable: () => false,
    // Hard read-only: selection may move (nav jumps set it), but no
    // transaction may change the doc — belt to `editable`'s braces,
    // and the guarantee that makes embedding interactive chrome (the
    // nav panel) safe against stray dispatches.
    dispatchTransaction(tr) {
      if (tr.docChanged) return;
      view.updateState(view.state.apply(tr));
    },
  });
  const nav = new NavigationPanel(navHost, { readOnly: true, onClose: () => {} });
  nav.attach(view);
  // Tear the panel down with the view (both dialogs only ever call
  // view.destroy()).
  const baseDestroy = view.destroy.bind(view);
  view.destroy = () => {
    nav.destroy();
    baseDestroy();
  };
  return view;
}

/** Session cache: snapshot content is immutable (the hash is in the
 *  id), so a digest computed once serves every dialog open. */
const statsCache = new Map<string, SnapshotStats>();

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Saved',
  auto: 'Autosave',
  close: 'On close',
};

/**
 * The solo-doc version dialog: the focused doc's snapshots, newest
 * first, each opening as a NEW unsaved document — the original file is
 * never touched, same contract as session recovery.
 *
 * Overhauled (field request): two-pane — version list on the left with
 * per-row stats, deltas vs the previous snapshot, and a "cards not in
 * current doc" badge; click a row to render a read-only PREVIEW on the
 * right (no more opening windows just to see what a version holds).
 * Stats fill in progressively from a background parse pipeline; the
 * per-snapshot digests are cached for the session (snapshot content is
 * immutable, so a digest never goes stale).
 */
export async function openVersionSnapshotDialog(
  docId: string,
  docTitle: string,
  openDoc?: OpenRecoveredDoc,
  currentDoc?: PMNode | null,
): Promise<boolean> {
  const host = getElectronHost();
  if (!host) return false;
  const entries = await host.historyList(docId);
  if (entries.length === 0) return false;

  const overlay = document.createElement('div');
  overlay.className = 'pmd-bulk-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-bulk-dialog pmd-recover-dialog pmd-recover-dialog-wide';
  overlay.appendChild(dialog);

  const token = pushOverlay();
  let closed = false;
  let previewView: EditorView | null = null;
  const close = (): void => {
    if (closed) return;
    closed = true;
    popOverlay(token);
    document.removeEventListener('keydown', onKey, true);
    previewView?.destroy();
    previewView = null;
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!isTopOverlay(token)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // List navigation from anywhere in the dialog — the preview pane
      // never takes keyboard focus (read-only), so arrows are free.
      e.preventDefault();
      e.stopPropagation();
      const next = selectedIndex + (e.key === 'ArrowDown' ? 1 : -1);
      if (next >= 0 && next < entries.length) void selectRow(next);
    }
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const header = document.createElement('header');
  header.className = 'pmd-bulk-header';
  const h = document.createElement('h2');
  h.textContent = 'Recover Previous Version';
  header.appendChild(h);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pmd-bulk-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = 'pmd-bulk-body pmd-recover-body pmd-recover-body-wide';
  const blurb = document.createElement('p');
  blurb.className = 'pmd-bulk-blurb';
  blurb.textContent =
    `\u201c${docTitle}\u201d \u2014 ${entries.length} saved version${entries.length === 1 ? '' : 's'}. ` +
    `Click a version to preview it. Opening a version makes a separate unsaved copy; the current document is not changed.`;
  body.appendChild(blurb);

  const split = document.createElement('div');
  split.className = 'pmd-recover-split';
  const list = document.createElement('div');
  list.className = 'pmd-recover-versions';
  const previewPane = document.createElement('div');
  previewPane.className = 'pmd-recover-preview-pane';
  const previewEmpty = document.createElement('div');
  previewEmpty.className = 'pmd-recover-preview-empty';
  previewEmpty.textContent = 'Select a version to preview it.';
  previewPane.appendChild(previewEmpty);
  split.append(list, previewPane);
  body.appendChild(split);
  dialog.appendChild(body);

  const currentStats = currentDoc ? computeSnapshotStats(currentDoc) : null;

  interface RowRefs {
    row: HTMLElement;
    stats: HTMLElement;
    delta: HTMLElement;
    badge: HTMLElement;
  }
  const rows: RowRefs[] = [];
  let selectedIndex = -1;

  const cacheKey = (id: string): string => `${docId}/${id}`;

  /** Read + parse one snapshot's doc (no caching — bytes are only
   *  needed transiently for preview / digest). Null on any failure. */
  const loadDoc = async (id: string): Promise<{ doc: PMNode; bytes: Uint8Array } | null> => {
    const bytes = await host.historyRead(docId, id);
    if (!bytes) return null;
    try {
      return { doc: parseNative(bytes).doc, bytes };
    } catch {
      return null;
    }
  };

  const statsFor = async (id: string): Promise<SnapshotStats | null> => {
    const hit = statsCache.get(cacheKey(id));
    if (hit) return hit;
    const loaded = await loadDoc(id);
    if (!loaded) return null;
    const st = computeSnapshotStats(loaded.doc);
    statsCache.set(cacheKey(id), st);
    return st;
  };

  const selectRow = async (index: number): Promise<void> => {
    const entry = entries[index];
    if (!entry) return;
    selectedIndex = index;
    for (let i = 0; i < rows.length; i++) {
      rows[i]!.row.classList.toggle('pmd-recover-version-selected', i === index);
    }
    rows[index]!.row.scrollIntoView({ block: 'nearest' });
    previewPane.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'pmd-recover-preview-empty';
    loading.textContent = 'Loading preview\u2026';
    previewPane.appendChild(loading);
    const loaded = await loadDoc(entry.id);
    if (closed || selectedIndex !== index) return; // superseded
    previewPane.innerHTML = '';
    previewView?.destroy();
    previewView = null;
    if (!loaded) {
      const err = document.createElement('div');
      err.className = 'pmd-recover-preview-empty';
      err.textContent = 'This version could not be previewed (missing or unreadable).';
      previewPane.appendChild(err);
      return;
    }
    previewView = mountVersionPreview(previewPane, loaded.doc);
  };

  entries.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'pmd-recover-version-row';
    row.tabIndex = 0;
    row.setAttribute('role', 'button');

    const top = document.createElement('div');
    top.className = 'pmd-recover-version-top';
    const time = document.createElement('span');
    time.className = 'pmd-recover-version-time';
    time.textContent = fmtTime(entry.ts);
    top.appendChild(time);
    if (entry.trigger && TRIGGER_LABELS[entry.trigger]) {
      const chip = document.createElement('span');
      chip.className = `pmd-recover-trigger-chip pmd-recover-trigger-${entry.trigger}`;
      chip.textContent = TRIGGER_LABELS[entry.trigger]!;
      top.appendChild(chip);
    }
    const size = document.createElement('span');
    size.className = 'pmd-recover-version-size';
    size.textContent = fmtSize(entry.size);
    top.appendChild(size);
    row.appendChild(top);

    const stats = document.createElement('div');
    stats.className = 'pmd-recover-version-stats';
    stats.textContent = '\u2026';
    row.appendChild(stats);
    const delta = document.createElement('div');
    delta.className = 'pmd-recover-version-delta';
    row.appendChild(delta);
    const badge = document.createElement('div');
    badge.className = 'pmd-recover-version-badge';
    row.appendChild(badge);

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'pmd-bulk-btn pmd-recover-open';
    open.textContent = 'Open a copy';
    open.addEventListener('click', (e) => {
      e.stopPropagation(); // don't also flip the preview
      void (async () => {
        open.disabled = true;
        const bytes = await host.historyRead(docId, entry.id);
        if (!bytes) {
          showToast('That version is no longer available.');
          open.disabled = false;
          return;
        }
        close();
        await openDoc?.(`${docTitle} (${fmtTime(entry.ts)})`, bytes);
      })();
    });
    row.appendChild(open);

    row.addEventListener('click', () => void selectRow(index));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void selectRow(index);
      }
    });

    list.appendChild(row);
    rows.push({ row, stats, delta, badge });
  });

  const actions = document.createElement('div');
  actions.className = 'pmd-bulk-actions';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'pmd-bulk-btn pmd-bulk-btn-primary';
  done.textContent = 'Close';
  done.addEventListener('click', close);
  actions.append(done);
  dialog.appendChild(actions);

  document.body.appendChild(overlay);
  done.focus();

  // Background digest pipeline: newest-first (matching reading order),
  // one parse at a time so the dialog never floods the main thread.
  // Each finished digest fills its row's stats/badge; a delta line
  // needs the NEXT-OLDER digest too, so it lands one step behind.
  void (async () => {
    const digests: Array<SnapshotStats | null> = new Array(entries.length).fill(null);
    for (let i = 0; i < entries.length && !closed; i++) {
      const st = await statsFor(entries[i]!.id);
      if (closed) return;
      digests[i] = st;
      const refs = rows[i]!;
      if (!st) {
        refs.stats.textContent = 'Unreadable version';
        continue;
      }
      refs.stats.textContent = `${st.words.toLocaleString()} words \u00b7 ${st.cards.toLocaleString()} cards`;
      if (currentStats) {
        const missing = cardsMissingFrom(st, currentStats);
        refs.badge.textContent =
          missing > 0
            ? `${missing} card${missing === 1 ? '' : 's'} not in current doc`
            : '';
      }
      const newer = i - 1;
      if (newer >= 0 && digests[newer]) {
        rows[newer]!.delta.textContent = formatDelta(diffSnapshotStats(digests[newer]!, st));
      }
      if (i === entries.length - 1) {
        refs.delta.textContent = 'Oldest kept version';
      }
      // Yield between parses — snapshots can be MBs each.
      await new Promise((r) => setTimeout(r, 0));
    }
  })();

  return true;
}
