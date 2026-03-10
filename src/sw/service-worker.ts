import { VERSION } from "./version";
import { APP_FILE_LIST } from "./app-file-list";

const sw: ServiceWorkerGlobalScope = self as unknown as ServiceWorkerGlobalScope;

async function onInstall() {
  console.info("SW : Install : " + VERSION);
  const cache = await caches.open(VERSION);
  return cache.addAll(APP_FILE_LIST);
}

async function onActivate() {
  console.info("SW : Activate : " + VERSION);
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.filter((name) => name !== VERSION).map((name) => caches.delete(name))
  );
}

async function onFetch(event: FetchEvent) {
  const cache = await caches.open(VERSION);
  const url = new URL(event.request.url);
  const cacheResource = url.pathname;
  const response = await cache.match(cacheResource);
  return response || fetch(event.request);
}

sw.addEventListener("install", (event) => event.waitUntil(onInstall()));
sw.addEventListener("activate", (event) => event.waitUntil(onActivate()));
sw.addEventListener("fetch", (event) => event.respondWith(onFetch(event)));
