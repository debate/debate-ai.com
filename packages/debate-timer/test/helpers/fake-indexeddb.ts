/**
 * @fileoverview A minimal in-memory `indexedDB` for the recorder's media
 * store: `open` (with `onupgradeneeded` on first open), one object store per
 * database, and `put` / `get` / `delete` requests that resolve on the next
 * tick like the real thing. `failNext` makes the next request error.
 */

type Listener = (() => void) | null;

class FakeRequest<T> {
  result: T = undefined as T;
  onsuccess: Listener = null;
  onerror: Listener = null;
  onupgradeneeded: Listener = null;
}

export interface FakeIndexedDb {
  factory: IDBFactory;
  stores: Map<string, Map<string, unknown>>;
  /** The next object-store request fails instead of succeeding. */
  failNext(): void;
}

export function createFakeIndexedDb(): FakeIndexedDb {
  const stores = new Map<string, Map<string, unknown>>();
  let fail = false;

  function request<T>(work: () => T): FakeRequest<T> {
    const req = new FakeRequest<T>();
    const shouldFail = fail;
    fail = false;
    setTimeout(() => {
      if (shouldFail) return req.onerror?.();
      req.result = work();
      req.onsuccess?.();
    }, 0);
    return req;
  }

  const db = {
    createObjectStore(name: string) {
      stores.set(name, new Map());
    },
    transaction(name: string) {
      const store = stores.get(name)!;
      return {
        objectStore: () => ({
          put: (value: unknown, key: string) => request(() => (store.set(key, value), key)),
          get: (key: string) => request(() => store.get(key)),
          delete: (key: string) => request(() => (store.delete(key), undefined)),
        }),
      };
    },
  };

  const factory = {
    open() {
      const req = new FakeRequest<typeof db>();
      setTimeout(() => {
        req.result = db;
        if (stores.size === 0) req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  } as unknown as IDBFactory;

  return { factory, stores, failNext: () => (fail = true) };
}
