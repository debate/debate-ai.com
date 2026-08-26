/**
 * Renderer client for the out-of-process file-index service.
 *
 * The palette used to hold the whole corpus (every FileEntry for every
 * search root, shipped over IPC at boot) and rank it locally. The index
 * AND the ranking now live in a utilityProcess (apps/desktop/src/
 * file-index-core.ts — same `searchFiles` code, imported there); this
 * client is a thin request/response shim over a MessagePort that main
 * brokers once per window:
 *
 *   renderer ──(host.requestFileIndexPort)──▶ main
 *   main ──(WebContents.postMessage + port)──▶ preload
 *   preload ──(window.postMessage transfer)──▶ here
 *
 * Every call is small: a query goes out, the ranked top-N rows + total
 * come back. Per-request timeouts double as the crash detector — a dead
 * service fails the pending calls, the client resets, and the next call
 * re-requests a fresh port (main respawns the service on demand).
 *
 * Non-Electron hosts (web/mobile) get `null` — file search is
 * electronOnly, matching the settings surface.
 */

import { getElectronHost } from './host/index.js';
import type { FileTiebreak } from './file-search.js';

/** One ranked hit — everything a palette file row needs. */
export interface FileIndexRow {
  path: string;
  relPath: string;
  name: string;
  mtimeMs: number;
  pinned: boolean;
}

export interface FileIndexQueryParams {
  query: string;
  roots: string[];
  exclusions: string[];
  formats: 'both' | 'cmir' | 'docx';
  tiebreak: FileTiebreak;
  pins: string[];
  /** Float pinned rows above the rest (`f`-mode ordering); the
   *  everything search keeps pure rank order but still gets ★ flags. */
  partitionPins: boolean;
  limit: number;
}

export interface FileIndexClient {
  /** Report the current roots: prunes departed ones from the persisted
   *  index and kicks scans/revalidation for the rest. */
  configure(roots: string[]): Promise<void>;
  query(params: FileIndexQueryParams): Promise<{ rows: FileIndexRow[]; total: number }>;
  /** mtimes for specific paths (pin warm pass) — excluded paths omitted. */
  entriesForPaths(args: {
    paths: string[];
    roots: string[];
    exclusions: string[];
  }): Promise<Array<{ path: string; mtimeMs: number }>>;
  /** A scan/revalidation landed a fresh listing — re-query to stay live. */
  onChanged(handler: () => void): () => void;
}

const PORT_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 30_000;

let clientPromise: Promise<FileIndexClient | null> | null = null;

/** The (lazily created, window-wide) service client, or null when the
 *  host has no file-index service. A failed acquisition resets the
 *  promise so the next caller retries from scratch. */
export function getFileIndexClient(): Promise<FileIndexClient | null> {
  clientPromise ??= acquire().catch(() => {
    clientPromise = null;
    return null;
  });
  return clientPromise;
}

/** Test hook: replace the client (or clear with null to re-acquire). */
export function setFileIndexClientForTests(client: FileIndexClient | null): void {
  clientPromise = client ? Promise.resolve(client) : null;
}

async function acquire(): Promise<FileIndexClient | null> {
  const host = getElectronHost();
  if (!host) return null;

  const portPromise = new Promise<MessagePort>((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('file-index port timeout'));
    }, PORT_TIMEOUT_MS);
    const onMessage = (e: MessageEvent): void => {
      if ((e.data as { type?: string } | null)?.type !== 'cardmirror:file-index-port') return;
      const port = e.ports[0];
      if (!port) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(port);
    };
    window.addEventListener('message', onMessage);
  });

  if (!host.requestFileIndexPort()) return null;
  const port = await portPromise;
  return wrapPort(port);
}

function wrapPort(port: MessagePort): FileIndexClient {
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  const changedHandlers = new Set<() => void>();

  const fail = (reason: string): void => {
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    pending.clear();
    // Reset the module-level client so the next call re-acquires a
    // fresh port (main respawns the service on demand).
    clientPromise = null;
  };

  port.onmessage = (e: MessageEvent): void => {
    const msg = e.data as
      | { id: number; ok: boolean; result?: unknown; error?: string }
      | { push: 'changed'; root: string }
      | null;
    if (!msg) return;
    if ('push' in msg) {
      for (const handler of changedHandlers) handler();
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error ?? 'file-index error'));
  };

  function request<T>(op: string, args: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        fail('file-index request timeout');
        reject(new Error('file-index request timeout'));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      try {
        port.postMessage({ id, op, args });
      } catch (err) {
        pending.delete(id);
        clearTimeout(timer);
        fail('file-index port dead');
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  return {
    configure: (roots) => request('configure', { roots }),
    query: (params) => request('query', params),
    entriesForPaths: (args) => request('entriesForPaths', args),
    onChanged: (handler) => {
      changedHandlers.add(handler);
      return () => changedHandlers.delete(handler);
    },
  };
}
