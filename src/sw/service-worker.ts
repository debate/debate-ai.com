import { VERSION } from "./version";
import { APP_FILE_LIST } from "./app-file-list";

const sw: ServiceWorkerGlobalScope = self as unknown as ServiceWorkerGlobalScope;

async function onInstall() {
  console.info("SW : Install : " + VERSION);
  const cache = await caches.open(VERSION);
  // Use addAll for critical assets, but catch individual failures
  const results = await Promise.allSettled(
    APP_FILE_LIST.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        } else {
          console.warn("SW : Cache skip (not ok):", url, response.status);
        }
      } catch (err) {
        console.warn("SW : Cache skip (fetch failed):", url, err);
      }
    })
  );
  const cached = results.filter((r) => r.status === "fulfilled").length;
  console.info(`SW : Cached ${cached}/${APP_FILE_LIST.length} assets`);
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
  return request.mode === "navigate" || request.headers.get("accept")?.includes("text/html") === true;
}

async function onFetch(event: FetchEvent): Promise<Response> {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== sw.location.origin) {
    return fetch(event.request);
  }

  const cache = await caches.open(VERSION);

  // For navigation requests: network-first with offline fallback to cached shell
  if (isNavigationRequest(event.request)) {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        cache.put(url.pathname, response.clone());
      }
      return response;
    } catch {
      // Offline: try cached version of this page, then fall back to cached "/"
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      const fallback = await cache.match("/");
      if (fallback) return fallback;
      return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
    }
  }

  // For static assets (JS, CSS, images): cache-first with network fallback
  const cached = await cache.match(url.pathname);
  if (cached) return cached;

  try {
    const response = await fetch(event.request);
    // Cache successful responses for static assets
    if (response.ok && (url.pathname.startsWith("/_next/") || url.pathname.match(/\.(js|css|png|ico|woff2?)$/))) {
      cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

sw.addEventListener("install", (event) => {
  sw.skipWaiting();
  event.waitUntil(onInstall());
});
sw.addEventListener("activate", (event) => event.waitUntil(onActivate()));
sw.addEventListener("fetch", (event) => event.respondWith(onFetch(event)));
