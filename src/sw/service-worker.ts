/// <reference lib="webworker" />
import { VERSION } from "./version";
import { APP_FILE_LIST } from "./app-file-list";

const sw: ServiceWorkerGlobalScope = self as unknown as ServiceWorkerGlobalScope;

async function onInstall() {
  console.info("SW : Install : " + VERSION);
  const cache = await caches.open(VERSION);
  // User specifies: caches.open('v1').then(cache => cache.addAll(['/', '/index.html', ...]))
  try {
    await cache.addAll(['/', '/index.html', ...APP_FILE_LIST]);
    console.info(`SW : Cached critical assets`);
  } catch (err) {
    console.warn("SW : Cache addAll failed:", err);
  }
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
    try {
      return await fetch(event.request);
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw new Error("Offline fetch failed");
    }
  }

  const cache = await caches.open(VERSION);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  
  try {
    return await fetch(event.request);
  } catch {
    return new Response('Offline', {status: 503});
  }
}

sw.addEventListener("install", (event) => {
  sw.skipWaiting();
  event.waitUntil(onInstall());
});
sw.addEventListener("activate", (event) => event.waitUntil(onActivate()));
sw.addEventListener("fetch", (event) => {
  event.respondWith(
    onFetch(event).catch(() => caches.match(event.request) as Promise<Response>)
  );
});
