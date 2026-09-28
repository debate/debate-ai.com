/**
 * Gzip codec for the `.cmir` container.
 *
 * `.cmir` files are gzip-wrapped JSON envelopes (the JSON shape and
 * `formatVersion` are unchanged — compression is a container concern).
 * Format is self-describing by magic bytes, so old plaintext files and
 * new compressed files coexist with no version flag:
 *
 *   - legacy plaintext always begins with `{` (0x7B);
 *   - gzip always begins with 0x1F 0x8B.
 *
 * These never collide, so a reader sniffs the first two bytes and decides.
 *
 * Uses `fflate` (synchronous, dependency-free) rather than `node:zlib` so
 * the same code runs in the Electron renderer and the browser build — the
 * read/write path is synchronous and called from many sites, and `node:zlib`
 * isn't available in the browser bundle (and `CompressionStream` is async).
 * The main-process bulk-compress tool uses `node:zlib` directly for raw
 * throughput; both emit standard gzip and are fully interoperable.
 */

import { gzipSync, gunzipSync, gzip as gzipWorker } from 'fflate';

/** True when `bytes` is a gzip stream (magic 0x1F 0x8B). */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** Gzip `bytes`. `mtime: 0` keeps the output deterministic (identical
 *  content → identical bytes), which helps sync/dedup. Level 6 matches the
 *  repo's existing DEFLATE level and is the size/speed sweet spot. */
export function gzip(bytes: Uint8Array): Uint8Array {
  return gzipSync(bytes, { level: 6, mtime: 0 });
}

/** Inflate a gzip stream produced by `gzip` (or any standard gzip). */
export function gunzip(bytes: Uint8Array): Uint8Array {
  return gunzipSync(bytes);
}

// One failed worker spawn means they'll all fail (no Worker global /
// CSP restriction) — remember and stop paying the attempt.
let gzipWorkerBroken = false;

/** How long to wait for the worker's answer before concluding it died
 *  mid-flight. Level-6 gzip of even a very large doc completes in
 *  well under a second, so this is far beyond any legitimate run. */
export const GZIP_WORKER_TIMEOUT_MS = 5_000;

/** Async `gzip` — byte-identical output to `gzip()` (same level 6,
 *  mtime 0), but the DEFLATE work runs on fflate's internal worker
 *  thread so the caller's thread stays free. For the editor's debounced
 *  journal/autosave paths, where the sync variant's compression stalls
 *  typing on large docs. Falls back to the sync path where workers are
 *  unavailable (unit tests, exotic CSP).
 *
 *  A worker that SPAWNS and then dies never calls back (field case
 *  2026-08-29: a weeks-old renderer under memory pressure — every
 *  `.cmir` save hung amber forever, before the save watchdog could
 *  arm, and Save As never reached the file picker). The timeout
 *  converts that into one slow save + a session-long sync latch.
 *  Latch rather than retry: fflate spawns a FRESH worker per call, so
 *  there is no worker to restart — and whatever killed one mid-flight
 *  tends to persist, so re-probing would tax every save with the full
 *  timeout to relearn the same fact. An app restart resets both the
 *  latch and, usually, the condition. */
export function gzipAsync(
  bytes: Uint8Array,
  timeoutMs: number = GZIP_WORKER_TIMEOUT_MS,
): Promise<Uint8Array> {
  if (gzipWorkerBroken) return Promise.resolve(gzip(bytes));
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (out: Uint8Array): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      resolve(out);
    };
    timer = setTimeout(() => {
      if (settled) return;
      gzipWorkerBroken = true;
      console.warn(
        '[cardmirror] gzip worker unresponsive — compressing on the main thread for the rest of this session',
      );
      finish(gzip(bytes));
    }, timeoutMs);
    try {
      gzipWorker(bytes, { level: 6, mtime: 0 }, (err, out) => {
        if (err || !out) {
          gzipWorkerBroken = true;
          finish(gzip(bytes));
        } else {
          finish(out);
        }
      });
    } catch {
      gzipWorkerBroken = true;
      finish(gzip(bytes));
    }
  });
}

/** Test hook: clear the session latch. */
export function __resetGzipWorkerStateForTests(): void {
  gzipWorkerBroken = false;
}
