/**
 * Web cross-window coordination over BroadcastChannel — the browser-edition
 * counterpart to the Electron main process, which the desktop build uses as its
 * coordination hub.
 *
 * One persistent channel per window (opened by `installWindowCoordination` at
 * boot) tracks live peers and answers two kinds of request:
 *  - **Mode-switch please-close** (three-pane consolidation): a window journals
 *    its open doc(s), reports {uid,dirty}, and self-closes — the web analogue of
 *    Electron's `journalAndCloseOtherWindows` / `reportModeSwitchJournaled` /
 *    `closeSelf`.
 *  - **Same-file query** (duplicate-open guard): a window about to open a file
 *    asks whether any other window already has it open, answered via
 *    `FileSystemFileHandle.isSameEntry` — the web analogue of Electron's
 *    `openPathCheck`.
 *
 * Design notes:
 *  - A BroadcastChannel delivers to every OTHER instance of the same channel
 *    name — including other instances in the SAME window — so every handler
 *    ignores messages stamped with its own `WINDOW_ID`.
 *  - Live-peer tracking (`hello`/`here`/`bye`) lets same-file checks short-circuit
 *    instantly when this window is alone, and gives the mode-switch an exact peer
 *    set to wait for.
 *  - Everything degrades to a graceful no-op where BroadcastChannel is absent.
 */

import type { ModeSwitchDoc } from './mode-switch.js';
import { getElectronHost } from './host/index.js';

const CHANNEL_NAME = 'pmd-window-coord';

/** Stable identity for THIS window, for the session. Shared across every channel
 *  instance this module opens in this window, so a window recognizes — and
 *  ignores — its own broadcasts. */
const WINDOW_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `w${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e9)}`;

/** Wall-clock time this window loaded — the singleton tiebreaker (older wins). */
const OPENED_AT = Date.now();

type CoordMsg =
  | { kind: 'coord:hello'; from: string }
  | { kind: 'coord:here'; from: string }
  | { kind: 'coord:bye'; from: string }
  | { kind: 'mode-switch:please-close'; from: string }
  | { kind: 'mode-switch:report'; from: string; docs: ModeSwitchDoc[] }
  | { kind: 'file-open:query'; from: string; nonce: string; handle: unknown }
  | { kind: 'file-open:hit'; from: string; nonce: string }
  | { kind: 'singleton:who'; from: string; openedAt: number }
  | { kind: 'singleton:here'; from: string; openedAt: number };

function makeChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;
  } catch {
    return null;
  }
}

/** Hard cap on waiting for slow passengers to report before proceeding anyway. */
const REPORT_CAP_MS = 1500;
/** Cap on waiting for a same-file answer (only paid when peers exist AND none
 *  claims the file — the alone case short-circuits). */
const FILE_QUERY_MS = 300;

/** IDs of the other windows we currently believe are open. Maintained by the
 *  persistent coordination channel via hello/here/bye. */
const livePeers = new Set<string>();

/** Whether any other window is (believed to be) open. */
export function hasPeers(): boolean {
  return livePeers.size > 0;
}

function hasIsSameEntry(h: unknown): h is FileSystemFileHandle {
  return (
    !!h &&
    typeof (h as { isSameEntry?: unknown }).isSameEntry === 'function'
  );
}

async function respondToFileQuery(
  ch: BroadcastChannel,
  getOpenHandles: () => unknown[],
  msg: Extract<CoordMsg, { kind: 'file-open:query' }>,
): Promise<void> {
  for (const h of getOpenHandles()) {
    if (!hasIsSameEntry(h)) continue;
    try {
      if (await h.isSameEntry(msg.handle as FileSystemFileHandle)) {
        ch.postMessage({ kind: 'file-open:hit', from: WINDOW_ID, nonce: msg.nonce } satisfies CoordMsg);
        return;
      }
    } catch {
      /* ignore a handle we can't compare */
    }
  }
}

async function handlePleaseClose(
  ch: BroadcastChannel,
  journalOpenDocs: () => Promise<ModeSwitchDoc[]>,
): Promise<void> {
  let docs: ModeSwitchDoc[] = [];
  try {
    docs = await journalOpenDocs();
  } catch (err) {
    console.warn('Mode-switch journaling failed:', err);
  }
  ch.postMessage({ kind: 'mode-switch:report', from: WINDOW_ID, docs } satisfies CoordMsg);
  // Give the report a beat to flush before this context is torn down, then
  // close (with the stuck-window fallback).
  window.setTimeout(() => {
    closeSelfWithFallback(
      'This document moved to your three-pane window. You can close this window.',
    );
  }, 150);
}

/**
 * Install the persistent coordination channel (once, at boot, on the browser
 * host only — Electron coordinates through main). Tracks live peers and answers
 * please-close + same-file queries. `journalOpenDocs` journals this window's
 * open doc(s) for a mode switch; `getOpenHandles` returns the file handles this
 * window currently has open (for the duplicate-open guard).
 */
export function installWindowCoordination(hooks: {
  journalOpenDocs: () => Promise<ModeSwitchDoc[]>;
  getOpenHandles: () => unknown[];
  /** Whether THIS window is a three-pane workspace (for singleton enforcement). */
  isMultiPane: () => boolean;
}): void {
  if (getElectronHost()) return; // desktop coordinates through main
  const ch = makeChannel();
  if (!ch) return;
  ch.addEventListener('message', (e: MessageEvent<CoordMsg>) => {
    const msg = e.data;
    if (!msg || msg.from === WINDOW_ID) return; // ignore our own broadcasts
    switch (msg.kind) {
      case 'coord:hello':
        livePeers.add(msg.from);
        ch.postMessage({ kind: 'coord:here', from: WINDOW_ID } satisfies CoordMsg);
        break;
      case 'coord:here':
        livePeers.add(msg.from);
        break;
      case 'coord:bye':
        livePeers.delete(msg.from);
        break;
      case 'mode-switch:please-close':
        void handlePleaseClose(ch, hooks.journalOpenDocs);
        break;
      case 'file-open:query':
        void respondToFileQuery(ch, hooks.getOpenHandles, msg);
        break;
      case 'singleton:who':
        // A window booting into three-pane is asking whether one is already
        // open. Answer only if WE are a three-pane window; it compares our
        // openedAt to decide who yields.
        if (hooks.isMultiPane()) {
          ch.postMessage({
            kind: 'singleton:here',
            from: WINDOW_ID,
            openedAt: OPENED_AT,
          } satisfies CoordMsg);
        }
        break;
      default:
        break; // '*:report' / '*:hit' / '*:here' are collected in their queries
    }
  });
  // Announce ourselves and learn who's already here.
  ch.postMessage({ kind: 'coord:hello', from: WINDOW_ID } satisfies CoordMsg);
  // Best-effort departure notice so peers prune us promptly.
  window.addEventListener('pagehide', () => {
    try {
      ch.postMessage({ kind: 'coord:bye', from: WINDOW_ID } satisfies CoordMsg);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Initiator side of a web mode switch: ask every other window to journal its
 * open doc(s) and close, and return the {uid,dirty} each reported so the caller
 * can fold them into the mode-switch marker. Resolves when every known peer has
 * reported or at the cap. Short-circuits to `[]` when this window is alone.
 */
export async function webCloseOtherWindowsForModeSwitch(): Promise<ModeSwitchDoc[]> {
  const expected = new Set(livePeers);
  if (expected.size === 0) return [];
  const channel = makeChannel();
  if (!channel) return [];
  return new Promise<ModeSwitchDoc[]>((resolve) => {
    const collected: ModeSwitchDoc[] = [];
    const reported = new Set<string>();
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      channel.removeEventListener('message', onMsg);
      channel.close();
      resolve(collected);
    };
    const onMsg = (e: MessageEvent<CoordMsg>): void => {
      const msg = e.data;
      if (
        msg?.kind === 'mode-switch:report' &&
        msg.from !== WINDOW_ID &&
        !reported.has(msg.from)
      ) {
        reported.add(msg.from);
        collected.push(...msg.docs);
        if ([...expected].every((p) => reported.has(p))) finish();
      }
    };
    channel.addEventListener('message', onMsg);
    channel.postMessage({ kind: 'mode-switch:please-close', from: WINDOW_ID } satisfies CoordMsg);
    window.setTimeout(finish, REPORT_CAP_MS);
  });
}

/**
 * Duplicate-open guard: does any OTHER window already have this file open?
 * Broadcasts the handle and resolves true if a peer answers that it matches one
 * of its open docs (via `isSameEntry`). Short-circuits to false when this window
 * is alone or the handle isn't comparable.
 */
export async function webIsFileOpenElsewhere(handle: unknown): Promise<boolean> {
  if (!hasIsSameEntry(handle) || !hasPeers()) return false;
  const channel = makeChannel();
  if (!channel) return false;
  const nonce =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : String(Math.random());
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      channel.removeEventListener('message', onMsg);
      channel.close();
      resolve(result);
    };
    const onMsg = (e: MessageEvent<CoordMsg>): void => {
      const msg = e.data;
      if (msg?.kind === 'file-open:hit' && msg.nonce === nonce && msg.from !== WINDOW_ID) {
        finish(true);
      }
    };
    channel.addEventListener('message', onMsg);
    channel.postMessage({
      kind: 'file-open:query',
      from: WINDOW_ID,
      nonce,
      handle,
    } satisfies CoordMsg);
    window.setTimeout(() => finish(false), FILE_QUERY_MS);
  });
}

/**
 * Whether `handle` is already open in another window — the duplicate-open guard.
 * Electron checks the main-process path registry (`openPathCheck`, string path
 * handles); web queries peer windows over BroadcastChannel (`isSameEntry`). A
 * second window editing the same file would race its save/autosave against the
 * first, so callers refuse the open when this returns true.
 */
export async function isFileOpenInAnotherWindow(handle: unknown): Promise<boolean> {
  const electron = getElectronHost();
  if (electron) {
    if (typeof handle === 'string' && handle) {
      const { takenByOther } = await electron.openPathCheck(handle);
      return takenByOther;
    }
    return false;
  }
  return webIsFileOpenElsewhere(handle);
}

/** Singleton enforcement: is another THREE-PANE window already open that
 *  OUTRANKS this one (opened earlier; exact ties broken by id)? A window booting
 *  into three-pane calls this and bounces itself when it's true, so a
 *  browser-spawned duplicate (Cmd+N, app icon) never becomes a second workspace.
 *  Resolves as soon as an older peer answers, else after a short timeout.
 *  No-op (false) on Electron (main manages windows) or without BroadcastChannel. */
export async function anOlderMultiPaneWindowExists(): Promise<boolean> {
  if (getElectronHost()) return false;
  const channel = makeChannel();
  if (!channel) return false;
  return new Promise<boolean>((resolve) => {
    let older = false;
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      channel.removeEventListener('message', onMsg);
      channel.close();
      resolve(older);
    };
    const onMsg = (e: MessageEvent<CoordMsg>): void => {
      const m = e.data;
      if (m?.kind === 'singleton:here' && m.from !== WINDOW_ID) {
        const outranks =
          m.openedAt < OPENED_AT || (m.openedAt === OPENED_AT && m.from < WINDOW_ID);
        if (outranks) {
          older = true;
          finish(); // an older three-pane window exists — we should bounce
        }
      }
    };
    channel.addEventListener('message', onMsg);
    channel.postMessage({
      kind: 'singleton:who',
      from: WINDOW_ID,
      openedAt: OPENED_AT,
    } satisfies CoordMsg);
    window.setTimeout(finish, 250);
  });
}

/**
 * Close this window, with a fallback for the case Chrome refuses the self-close
 * (a window opened via a capturable link click isn't script-closable from a
 * message handler — there's no user activation). If we're still alive shortly
 * after `window.close()`, cover the (now-stale) content with a dismissible
 * notice rather than leave a duplicate window sitting there.
 */
export function closeSelfWithFallback(message: string): void {
  window.close();
  window.setTimeout(() => {
    if (document.querySelector('[data-pmd-moved-overlay]')) return;
    showMovedOverlay(message);
  }, 500);
}

function showMovedOverlay(message: string): void {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-pmd-moved-overlay', '');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:24px',
    'background:var(--pmd-c-bg)',
    'color:var(--pmd-c-text)',
    'font:15px/1.5 system-ui,sans-serif',
    'text-align:center',
  ].join(';');
  const box = document.createElement('div');
  box.style.cssText = 'max-width:32rem';
  const p = document.createElement('p');
  p.textContent = message;
  p.style.cssText = 'margin:0 0 16px';
  const hint = document.createElement('p');
  hint.textContent = 'Close this window with ⌘W (or the window controls).';
  hint.style.cssText = 'margin:0;opacity:.7;font-size:13px';
  box.append(p, hint);
  overlay.append(box);
  document.body.append(overlay);
}
