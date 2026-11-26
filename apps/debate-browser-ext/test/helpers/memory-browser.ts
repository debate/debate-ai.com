/**
 * An in-memory stand-in for `wxt/browser`'s storage areas, for the tests that
 * assert what the extension reads, writes and sends (a stored session, the
 * request a call makes) rather than the browser itself. Used from
 * `vi.mock('wxt/browser', ...)` factories.
 */
export interface MemoryStorage {
  sync: Record<string, unknown>;
  local: Record<string, unknown>;
}

function area(data: Record<string, unknown>) {
  return {
    get: async (keys?: string | Record<string, unknown> | null) => {
      if (typeof keys === 'string') return keys in data ? { [keys]: data[keys] } : {};
      return { ...(keys ?? {}), ...data };
    },
    set: async (items: Record<string, unknown>) => void Object.assign(data, items),
    remove: async (key: string) => void delete data[key],
  };
}

export function memoryBrowser(storage: MemoryStorage) {
  return { storage: { sync: area(storage.sync), local: area(storage.local) } } as Record<string, any>;
}

export function resetStorage(storage: MemoryStorage): void {
  for (const data of [storage.sync, storage.local]) {
    for (const key of Object.keys(data)) delete data[key];
  }
}
