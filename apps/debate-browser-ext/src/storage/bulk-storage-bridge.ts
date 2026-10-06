/**
 * The extension's half of debate-ai.com's on-device storage
 * (`packages/debate-data-sync/src/state/bulk-storage.ts`).
 *
 * The site keeps flows, rounds and flow history in IndexedDB, whose quota on a
 * web origin is a share of free disk the browser may evict under pressure.
 * When this extension is installed the site also mirrors every write here,
 * into `chrome.storage.local` — which the manifest's `unlimitedStorage`
 * permission lifts every quota from — and reads a key back from here if its
 * own copy was lost. The site reaches this worker over
 * `externally_connectable`, which the manifest limits to debate-ai.com (and
 * localhost for development); nothing else can send these messages.
 *
 * Values are opaque strings kept under {@link KEY_PREFIX}, so they can never
 * collide with the extension's own settings. Only the keys the site's store
 * owns are accepted.
 */

/** Must match `BULK_STORAGE_MESSAGE` in debate-data-sync's `state/bulk-storage.ts`. */
export const BULK_STORAGE_MESSAGE = 'debate-ai:bulk-storage';

/** Must match `BULK_STORAGE_KEYS` in debate-data-sync's `state/bulk-storage.ts`. */
export const BULK_STORAGE_KEYS: readonly string[] = ['flows', 'rounds', 'flow-history'];

export const KEY_PREFIX = 'bulk:';

/** The part of `chrome.storage.local` the bridge needs. */
export interface BridgeStorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export interface BridgeResponse {
  ok: boolean;
  unlimited?: boolean;
  values?: Record<string, string | null>;
  error?: string;
}

const isKey = (key: unknown): key is string =>
  typeof key === 'string' && BULK_STORAGE_KEYS.includes(key);

/** Whether a message is meant for the bridge. */
export function isBulkStorageMessage(message: unknown): boolean {
  return (message as { type?: unknown } | undefined)?.type === BULK_STORAGE_MESSAGE;
}

/** Answers one bridge request against `area`. */
export async function handleBulkStorageMessage(
  message: unknown,
  area: BridgeStorageArea
): Promise<BridgeResponse> {
  const request = message as {
    op?: unknown;
    key?: unknown;
    keys?: unknown;
    value?: unknown;
  };
  try {
    switch (request.op) {
      case 'ping':
        return { ok: true, unlimited: true };
      case 'get': {
        const keys = Array.isArray(request.keys) ? request.keys.filter(isKey) : [];
        const stored = await area.get(keys.map((key) => KEY_PREFIX + key));
        const values: Record<string, string | null> = {};
        for (const key of keys) {
          const value = stored[KEY_PREFIX + key];
          values[key] = typeof value === 'string' ? value : null;
        }
        return { ok: true, values };
      }
      case 'set':
        if (!isKey(request.key) || typeof request.value !== 'string') {
          return { ok: false, error: 'Bad request' };
        }
        await area.set({ [KEY_PREFIX + request.key]: request.value });
        return { ok: true };
      case 'remove':
        if (!isKey(request.key)) return { ok: false, error: 'Bad request' };
        await area.remove([KEY_PREFIX + request.key]);
        return { ok: true };
      default:
        return { ok: false, error: 'Unknown operation' };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
