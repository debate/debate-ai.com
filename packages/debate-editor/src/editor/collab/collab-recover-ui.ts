/**
 * Recover Previous Version — the UI over collab-history.ts.
 *
 * Entry branches on context (the command's contract):
 *  - focused doc has a live session → open straight to THAT session's
 *    version list (someone watching a document get wrecked should be
 *    one step from recovery, not browsing files), with a
 *    "Recover from file…" escape hatch alongside;
 *  - no session → skip the dialog and open the OS picker at the
 *    journals folder immediately — with no session for context an
 *    intermediate screen would just be a worse file browser.
 *
 * Selecting a version NEVER touches a live session or the canonical
 * document: the chosen state is checked out on a scratch doc built
 * from the history file and opened as a NEW, unsaved document in its
 * own window. Untitled-and-unsaved is deliberate — the recovered copy
 * must be impossible to confuse with (or reflex-overwrite onto) the
 * canonical file. The user copies what they want across by hand.
 */

import { serializeNative } from '../../native/index.js';
import { appVersion } from '../install-info.js';
import { getElectronHost } from '../host/index.js';
import type { HistoryEnvelope } from '../host/types.js';
import { pushOverlay, popOverlay, isTopOverlay } from '../overlay-stack.js';
import { showToast } from '../toast.js';
import type { CollabSession } from './collab-session.js';
import {
  collapseSeedPrefix,
  deriveVersionRows,
  groupVersionRows,
  historyHandleFor,
  materializeVersion,
  snapshotFromEnvelope,
  type VersionGroup,
  type VersionRow,
} from './collab-history.js';
import { LoroDoc } from 'loro-crdt';
import { configTextStyle } from './collab-session.js';

/** How a recovered copy gets opened. index.ts supplies a mode-aware
 *  opener: multi-pane mounts it into a slot of THIS window (via the
 *  same funnel as File → Open); single-pane spawns a fresh window. */
export type OpenRecoveredDoc = (name: string, bytes: Uint8Array) => Promise<void>;

/** Entry point (via collab-ui, which supplies the focused session). */
export async function openRecoverPreviousVersion(
  session: CollabSession | null,
  openDoc?: OpenRecoveredDoc,
): Promise<void> {
  const host = getElectronHost();
  if (!host) {
    showToast('Recover Previous Version requires the desktop edition.');
    return;
  }
  let envelope: HistoryEnvelope | null = null;
  if (session) {
    // Make the file current first — the dialog reads the FILE so the
    // in-session and from-file paths share one code path.
    await historyHandleFor(session.roomId)?.flush();
    envelope = await host.readHistory({ roomId: session.roomId });
    if (!envelope) {
      showToast('No history has been captured for this session yet.');
      return;
    }
  } else {
    envelope = await pickEnvelopeFromFile();
    if (!envelope) return; // cancelled, or already toasted
  }
  openVersionDialog(envelope, openDoc);
}

async function pickEnvelopeFromFile(): Promise<HistoryEnvelope | null> {
  const host = getElectronHost();
  if (!host) return null;
  const path = await host.pickHistoryFile();
  if (!path) return null;
  const envelope = await host.readHistory({ path });
  if (!envelope) {
    showToast('That file could not be read as CardMirror session history.');
    return null;
  }
  return envelope;
}

function openVersionDialog(envelope: HistoryEnvelope, openDoc?: OpenRecoveredDoc): void {
  // Derive the list up front; the snapshot import is the expensive part
  // and it is shared by every later checkout.
  let ldoc: LoroDoc;
  let groups: VersionGroup[];
  try {
    ldoc = new LoroDoc();
    configTextStyle(ldoc);
    ldoc.import(snapshotFromEnvelope(envelope));
    groups = groupVersionRows(collapseSeedPrefix(deriveVersionRows(ldoc, envelope.changeTimes)));
  } catch {
    showToast('That session history is damaged and could not be read.');
    return;
  }
  if (groups.length === 0) {
    showToast('This session history contains no changes yet.');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'pmd-bulk-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-bulk-dialog pmd-recover-dialog';
  overlay.appendChild(dialog);

  const token = pushOverlay();
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    popOverlay(token);
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && isTopOverlay(token)) {
      e.preventDefault();
      e.stopPropagation();
      close();
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
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = 'pmd-bulk-body pmd-recover-body';
  const blurb = document.createElement('p');
  blurb.className = 'pmd-bulk-blurb';
  blurb.textContent =
    `“${envelope.docTitle}” — history through ${fmtTime(envelope.updatedAt)}. ` +
    `Opening a version makes a separate unsaved copy; the shared document is not changed.`;
  body.appendChild(blurb);

  const list = document.createElement('div');
  list.className = 'pmd-recover-list';
  // Newest first — vandalism recovery reaches for "just before the end".
  for (const group of [...groups].reverse()) {
    list.appendChild(groupRow(group, envelope, close, openDoc));
  }
  body.appendChild(list);
  dialog.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'pmd-bulk-actions';
  const fromFile = document.createElement('button');
  fromFile.type = 'button';
  fromFile.className = 'pmd-bulk-btn';
  fromFile.textContent = 'Recover from file…';
  fromFile.addEventListener('click', () => {
    void pickEnvelopeFromFile().then((other) => {
      if (!other) return;
      close();
      openVersionDialog(other, openDoc);
    });
  });
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'pmd-bulk-btn pmd-bulk-btn-primary';
  done.textContent = 'Close';
  done.addEventListener('click', close);
  actions.append(fromFile, done);
  dialog.appendChild(actions);

  document.body.appendChild(overlay);
  done.focus();
}

function groupRow(
  group: VersionGroup,
  envelope: HistoryEnvelope,
  closeDialog: () => void,
  openDoc?: OpenRecoveredDoc,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pmd-recover-group';

  const head = document.createElement('div');
  head.className = 'pmd-recover-group-head';

  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'pmd-recover-expand';
  expand.textContent = '▸';
  expand.title = 'Show individual changes';

  const label = document.createElement('span');
  label.className = 'pmd-recover-group-label';
  // A group that IS just the seed row gets named for what it is.
  label.textContent =
    group.rows.length === 1 && group.rows[0]!.isSeed
      ? `Session started — ${groupLabel(group)}`
      : groupLabel(group);

  const meta = document.createElement('span');
  meta.className = 'pmd-recover-group-meta';
  meta.textContent =
    `${group.rows.length} change${group.rows.length === 1 ? '' : 's'} · ` +
    `${group.peers.length} editor${group.peers.length === 1 ? '' : 's'}`;

  // The group's recover target is its LAST change — "the document as it
  // stood at the end of this burst of editing".
  const open = recoverButton(group.rows[group.rows.length - 1]!, envelope, closeDialog, openDoc);

  head.append(expand, label, meta, open);
  wrap.appendChild(head);

  let detail: HTMLElement | null = null;
  expand.addEventListener('click', () => {
    if (detail) {
      detail.remove();
      detail = null;
      expand.textContent = '▸';
      return;
    }
    expand.textContent = '▾';
    detail = document.createElement('div');
    detail.className = 'pmd-recover-detail';
    // Newest first, same as the group list.
    for (const row of [...group.rows].reverse()) {
      const line = document.createElement('div');
      line.className = 'pmd-recover-row';
      const t = document.createElement('span');
      t.className = 'pmd-recover-row-time';
      t.textContent = row.atMs === null ? '—' : fmtTime(row.atMs);
      const who = document.createElement('span');
      who.className = 'pmd-recover-row-peer';
      who.textContent = row.isSeed ? 'session started (initial document)' : `editor …${row.peer.slice(-4)}`;
      line.append(t, who, recoverButton(row, envelope, closeDialog, openDoc));
      detail.appendChild(line);
    }
    wrap.appendChild(detail);
  });
  return wrap;
}

function recoverButton(
  row: VersionRow,
  envelope: HistoryEnvelope,
  closeDialog: () => void,
  openDoc?: OpenRecoveredDoc,
): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pmd-bulk-btn pmd-recover-open';
  btn.textContent = 'Open copy';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Opening…';
    // Yield a beat so the busy state PAINTS: materializeVersion is a
    // synchronous rebuild that freezes the renderer for ~10s on a
    // tournament-master-sized file.
    void new Promise((r) => setTimeout(r, 30))
      .then(() => recoverVersion(row, envelope, openDoc))
      .then((ok) => {
        if (ok) closeDialog();
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = original;
      });
  });
  return btn;
}

async function recoverVersion(
  row: VersionRow,
  envelope: HistoryEnvelope,
  openDoc?: OpenRecoveredDoc,
): Promise<boolean> {
  const host = getElectronHost();
  if (!host) return false;
  try {
    const node = materializeVersion(snapshotFromEnvelope(envelope), row.frontier);
    const bytes = serializeNative(node, { appVersion });
    const name = envelope.docTitle || 'Recovered document';
    if (openDoc) {
      await openDoc(name, bytes);
    } else {
      await host.spawnWindow({
        filename: name,
        bytes,
        handle: null, // never the canonical file — unsaved by construction
        format: 'cmir',
        uid: null,
      });
    }
    return true;
  } catch (err) {
    console.error('[recover] failed to open version:', err);
    showToast('Could not reconstruct that version — the history may be damaged.');
    return false;
  }
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString()} ${time}`;
}

function groupLabel(group: VersionGroup): string {
  if (group.startMs === null && group.endMs === null) return 'Earlier changes';
  const start = fmtTime(group.startMs ?? group.endMs!);
  const end = fmtTime(group.endMs ?? group.startMs!);
  return start === end ? start : `${start} – ${end}`;
}
