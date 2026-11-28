import { vi } from 'vitest';

type UpdatedListener = (tabId: number, change: { url?: string }, tab: { id: number; url?: string }) => void;
type RemovedListener = (tabId: number) => void;

/**
 * A scriptable stand-in for `browser.tabs`, for the sign-in flows that open a
 * tab and then watch it: `navigate()` fires `onUpdated` the way the browser
 * does as the tab's URL changes, and `close()` fires `onRemoved`.
 */
export function fakeTabs() {
  const updated = new Set<UpdatedListener>();
  const removed = new Set<RemovedListener>();
  const urls = new Map<number, string>();
  let nextId = 100;

  const api = {
    create: vi.fn(async ({ url }: { url: string; active?: boolean }) => {
      const id = nextId++;
      urls.set(id, url);
      return { id, url };
    }),
    get: vi.fn(async (id: number) => ({ id, url: urls.get(id) })),
    remove: vi.fn(async (id: number) => {
      urls.delete(id);
    }),
    onUpdated: {
      addListener: (fn: UpdatedListener) => void updated.add(fn),
      removeListener: (fn: UpdatedListener) => void updated.delete(fn),
    },
    onRemoved: {
      addListener: (fn: RemovedListener) => void removed.add(fn),
      removeListener: (fn: RemovedListener) => void removed.delete(fn),
    },
  };

  return {
    api,
    listenerCount: () => updated.size + removed.size,
    navigate(id: number, url: string) {
      urls.set(id, url);
      for (const fn of [...updated]) fn(id, { url }, { id, url });
    },
    close(id: number) {
      urls.delete(id);
      for (const fn of [...removed]) fn(id);
    },
  };
}
