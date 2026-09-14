/**
 * Regression tests for the offline service worker's build-swap behaviour.
 *
 * The worker is a module with top-level side effects (it reads `self` and
 * registers its listeners on import), so each test builds a fake
 * `ServiceWorkerGlobalScope` plus a fake CacheStorage, installs them as
 * globals, and re-imports the module to capture the listeners it registers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: any) => void;

class FakeCache {
  entries = new Map<string, Response>();
  async add(url: string) {
    this.entries.set(url, new Response("precached"));
  }
  async put(request: Request | string, response: Response) {
    this.entries.set(typeof request === "string" ? request : request.url, response);
  }
  async match(request: Request | string) {
    return this.entries.get(typeof request === "string" ? request : request.url);
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();
  async open(name: string) {
    const existing = this.caches.get(name);
    if (existing) return existing;
    const created = new FakeCache();
    this.caches.set(name, created);
    return created;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
  /** The whole-origin search the worker must never use. */
  async match(request: Request | string) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

const ORIGIN = "https://debate-ai.com";

/**
 * @param windowClients how many pages are open when the worker installs
 */
async function loadWorker(windowClients: number) {
  const listeners = new Map<string, Listener>();
  const skipWaiting = vi.fn();
  const claim = vi.fn(async () => {});
  const cacheStorage = new FakeCacheStorage();

  const scope = {
    location: new URL(`${ORIGIN}/service-worker.js`),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting,
    clients: {
      claim,
      matchAll: async () => Array.from({ length: windowClients }, (_, i) => ({ id: `w${i}` })),
    },
  };

  vi.stubGlobal("self", scope);
  vi.stubGlobal("caches", cacheStorage);
  vi.resetModules();
  await import("../service-worker");

  /** Runs a registered listener and awaits whatever it passed to waitUntil. */
  const dispatch = async (type: string, event: Record<string, unknown> = {}) => {
    const pending: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    listeners.get(type)?.({
      ...event,
      waitUntil: (p: Promise<unknown>) => pending.push(p),
      respondWith: (p: Promise<Response>) => {
        responded = p;
      },
    });
    await Promise.all(pending);
    return responded;
  };

  return { dispatch, skipWaiting, claim, cacheStorage };
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("install", () => {
  it("does not take over pages that are already running another build", async () => {
    // The crash this guards against: skipping the wait activates this worker
    // under a page from the previous build, `onActivate` deletes the cache that
    // page's chunks came from, and its next lazy import 404s — surfacing as
    // `Cannot access '<name>' before initialization` from the component that
    // rendered next.
    const { dispatch, skipWaiting } = await loadWorker(1);
    await dispatch("install");
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it("takes over immediately when no page is open", async () => {
    const { dispatch, skipWaiting } = await loadWorker(0);
    await dispatch("install");
    expect(skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("still precaches the build's assets when it has to wait", async () => {
    const { dispatch, cacheStorage } = await loadWorker(1);
    await dispatch("install");
    const [cache] = [...cacheStorage.caches.values()];
    expect(cache.entries.has("/")).toBe(true);
  });
});

describe("activate", () => {
  it("drops every cache but this build's and claims the remaining pages", async () => {
    const { dispatch, claim, cacheStorage } = await loadWorker(0);
    await cacheStorage.open("debate-ai-0.0.0-previousbuild");
    await dispatch("install");
    await dispatch("activate");
    expect([...cacheStorage.caches.keys()]).toHaveLength(1);
    expect(claim).toHaveBeenCalledTimes(1);
  });
});

describe("fetch", () => {
  // A precached path (so `isImmutableAsset` sends it down the cache-first
  // branch) that every build re-emits under the same name.
  const assetRequest = () => new Request(`${ORIGIN}/site.webmanifest`);

  it("ignores an older build's cache entry for a shared path", async () => {
    // `/site.webmanifest` (like the app shell and the icons) keeps its path
    // across builds, so an origin-wide `caches.match` would answer it from
    // whichever cache was created first — the previous build's.
    const { dispatch, cacheStorage } = await loadWorker(0);
    const stale = await cacheStorage.open("debate-ai-0.0.0-previousbuild");
    await stale.put(assetRequest(), new Response("previous build"));

    const fetchMock = vi.fn(async () => new Response("current build"));
    vi.stubGlobal("fetch", fetchMock);

    const responded = await dispatch("fetch", { request: assetRequest() });
    expect(await responded!.text()).toBe("current build");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves this build's own cache entry without hitting the network", async () => {
    const { dispatch, cacheStorage } = await loadWorker(0);
    await dispatch("install");
    const [current] = [...cacheStorage.caches.values()];
    await current.put(assetRequest(), new Response("current build"));

    const fetchMock = vi.fn(async () => new Response("network"));
    vi.stubGlobal("fetch", fetchMock);

    const responded = await dispatch("fetch", { request: assetRequest() });
    expect(await responded!.text()).toBe("current build");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
