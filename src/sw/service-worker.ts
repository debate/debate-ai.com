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

async function onFetch(event: FetchEvent): Promise<Response> {
  const url = new URL(event.request.url);

  // 1. Check cache first for all requests
  const cachedResponse = await caches.match(event.request);
  if (cachedResponse) return cachedResponse;

  // 2. Try network
  try {
    const networkResponse = await fetch(event.request);
    
    // Optional: Cache successful same-origin responses (Network First strategy for others)
    if (networkResponse.ok && url.origin === sw.location.origin) {
      const cache = await caches.open(VERSION);
      cache.put(event.request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // 3. Fallback for navigation requests (App Shell)
    if (isNavigationRequest(event.request)) {
      const cache = await caches.open(VERSION);
      const offlineShell = await cache.match('/');
      if (offlineShell) return offlineShell;
    }
    
    // Return a basic error instead of hardcoded string if not in cache
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
