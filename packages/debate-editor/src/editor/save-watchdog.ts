/**
 * Save watchdog — feedback for disk writes that neither succeed nor
 * fail.
 *
 * A hung filesystem call is indistinguishable from a dead Save button:
 * every real failure mode of the save pipeline surfaces a dialog, but
 * a write that BLOCKS (field case: a cloud-sync online-only
 * placeholder whose hydration stalls — Windows + Dropbox) produces
 * pure silence, before any UI fires, and every later save queues
 * behind it on the per-path chain. Node cannot cancel a blocked fs
 * call, so this module never aborts anything — it converts silence
 * into feedback:
 *
 *   - WARN_MS: a coalesced warning notice (status chip + toast),
 *     phrased as in-progress — a slow-but-healthy write (big file,
 *     AV scan) may still land, and "failed" would be a lie.
 *   - DIALOG_MS (manual saves only): a route-style dialog offering
 *     Save As… — the one real exit, since the hung write can't be
 *     cancelled. Choosing it resolves 'saveAs'; the abandoned write
 *     stays queued and, if the folder ever recovers, lands too —
 *     two copies, never zero.
 *
 * The underlying write always wins the race the moment it settles:
 * success resolves 'done' — a still-open escalation dialog closes
 * itself (abort signal) — and rejection propagates unchanged so the
 * caller's EMODIFIED / ENOENT / ELOCKED handling is untouched.
 */

import { postNotice } from './status-notices.js';
import { promptForRouteChoice } from './text-prompt.js';

export const SAVE_WARN_MS = 10_000;
export const SAVE_DIALOG_MS = 30_000;

export interface SaveWatchdogOptions {
  /** Offer the Save As escalation dialog (manual saves; autosave
   *  passes false — never a modal mid-typing). */
  escalate: boolean;
  /** Test overrides. */
  warnMs?: number;
  dialogMs?: number;
}

/** Lightweight phase watchdog for the save pipeline's PRE-WRITE steps
 *  (serialization): posts a warning notice if `work` runs past
 *  `warnMs`, and lets the result/rejection through untouched. The
 *  write watchdog below can't see these phases — a serialize that
 *  hung left the save silently amber forever (field case 2026-08-29,
 *  gzip worker death; the codec now has its own timeout, this is the
 *  belt-and-braces so ANY future pre-write hang surfaces). No
 *  escalation dialog: Save As would rerun the same serialize. */
export function warnIfSlow<T>(
  work: Promise<T>,
  filename: string | null,
  warnMs: number = SAVE_WARN_MS,
): Promise<T> {
  const name = filename ?? 'This document';
  const timer = setTimeout(() => {
    postNotice({
      severity: 'warning',
      title: 'Save is taking a long time',
      body:
        `Preparing "${name}" to be saved is taking unusually long. ` +
        `The save will continue — if this happens repeatedly, restart ` +
        `CardMirror and report it.`,
      key: `slow-save:${name}`,
    });
  }, warnMs);
  return work.finally(() => clearTimeout(timer));
}

export function awaitWithSaveWatchdog(
  write: Promise<void>,
  filename: string | null,
  opts: SaveWatchdogOptions,
): Promise<'done' | 'saveAs'> {
  const name = filename ?? 'This document';
  const warnMs = opts.warnMs ?? SAVE_WARN_MS;
  const dialogMs = opts.dialogMs ?? SAVE_DIALOG_MS;
  return new Promise<'done' | 'saveAs'>((resolve, reject) => {
    let finished = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Closes a still-open escalation dialog the moment the write
    // settles — its question is moot once the save has landed/failed.
    const dialogCloser = new AbortController();
    const finish = (outcome: 'done' | 'saveAs'): void => {
      if (finished) return;
      finished = true;
      for (const t of timers) clearTimeout(t);
      dialogCloser.abort();
      resolve(outcome);
    };
    write.then(
      () => finish('done'),
      (err: unknown) => {
        if (finished) return;
        finished = true;
        for (const t of timers) clearTimeout(t);
        dialogCloser.abort();
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
    timers.push(
      setTimeout(() => {
        if (finished) return;
        postNotice({
          severity: 'warning',
          title: 'Save is taking a long time',
          body:
            `"${name}" hasn't finished writing — its folder is responding ` +
            `slowly. If it lives in a cloud-synced folder (Dropbox, ` +
            `OneDrive, Google Drive), the sync app may need to download ` +
            `the file before it can be written: check that the file is ` +
            `available offline and the sync app is running. The save ` +
            `will complete if the folder recovers.`,
          key: `slow-save:${name}`,
        });
      }, warnMs),
    );
    if (opts.escalate) {
      timers.push(
        setTimeout(() => {
          if (finished) return;
          void promptForRouteChoice<'saveAs' | 'wait'>({
            signal: dialogCloser.signal,
            message:
              `"${name}" still hasn't finished saving — its folder isn't ` +
              `responding. Your work is safe in this window, but this save ` +
              `can't be cancelled; it will finish only if the folder ` +
              `recovers.`,
            choices: [
              {
                value: 'saveAs',
                label: 'Save As…',
                description: 'Save a copy somewhere responsive now — a local folder, such as the Desktop, is best.',
              },
              {
                value: 'wait',
                label: 'Keep Waiting',
                description: 'Leave the save running and carry on.',
              },
            ],
          }).then((choice) => {
            // A settled write aborts the dialog (resolves null); this
            // guard is belt-and-braces for the same-tick race.
            if (choice === 'saveAs') finish('saveAs');
          });
        }, dialogMs),
      );
    }
  });
}
