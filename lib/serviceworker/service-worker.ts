/// <reference lib="webworker" />
import { VERSION } from "./version";
import { APP_FILE_LIST } from "./app-file-list";

const sw: ServiceWorkerGlobalScope = self as unknown as ServiceWorkerGlobalScope;

async function onInstall() {
  console.info("SW : Install : " + VERSION);
  const cache = await caches.open(VERSION);
  
  // Cache assets individually so one missing file doesn't break the whole installation
  const assetsToCache = ['/', '/index.html', ...APP_FILE_LIST];
  let cachedCount = 0;
  
  await Promise.all(
    assetsToCache.map(async (url) => {
      try {
        await cache.add(url);
        cachedCount++;
      } catch (err) {
        console.warn(`SW : Failed to cache asset: ${url}`, err);
      }
    })
  );
  
  console.info(`SW : Cached ${cachedCount}/${assetsToCache.length} critical assets`);
}

async function onActivate() {
  console.info("SW : Activate : " + VERSION);
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.filter((name) => name !== VERSION).map((name) => caches.delete(name))
  );
  // Take control of all clients immediately
  return sw.clients.claim();
}

function isNavigationRequest(request: Request): boolean {
  return request.mode === "navigate" || 
         (request.method === 'GET' && request.headers.get("accept")?.includes("text/html") === true);
}

function isNetworkFirst(url: URL, request: Request): boolean {
  // Use network-first for navigation requests and API routes
  return isNavigationRequest(request) || url.pathname.startsWith('/api/');
}

async function onFetch(event: FetchEvent): Promise<Response> {
  const url = new URL(event.request.url);

  // Network-first for pages and API routes (fresh data when online, cached offline)
  if (isNetworkFirst(url, event.request)) {
    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse.ok && url.origin === sw.location.origin) {
        const cache = await caches.open(VERSION);
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;
      // Last resort: serve app shell for navigation requests
      if (isNavigationRequest(event.request)) {
        const cache = await caches.open(VERSION);
        const offlineShell = await cache.match('/');
        if (offlineShell) return offlineShell;
      }
      throw error;
    }
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  const cachedResponse = await caches.match(event.request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(event.request);
    if (networkResponse.ok && url.origin === sw.location.origin) {
      const cache = await caches.open(VERSION);
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

sw.addEventListener("install", (event) => {
  sw.skipWaiting();
  event.waitUntil(onInstall());
});
sw.addEventListener("activate", (event) => event.waitUntil(onActivate()));
sw.addEventListener("fetch", (event) => {
  event.respondWith(onFetch(event));
});
