"use client";

import { useEffect } from "react";
import { debugLog } from "@/lib/debug-log";

/**
 * Registers the offline service worker built by `npm run build:sw`.
 *
 * This lives as an ordinary client component rendered by the root layout
 * rather than as `app/template.tsx`. A special `template.tsx` file is also
 * rendered by the router itself, which passes it the raw null-prototype
 * `params` object produced by the route matcher; React cannot serialize that
 * across the server/client boundary, so a client-side template crashes the
 * RSC render of every page ("Only plain objects, and a few built-ins, can be
 * passed to Client Components from Server Components").
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      debugLog("Service Worker not supported");
      return;
    }

    // Skip on localhost for development
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      return;
    }

    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        debugLog("Service Worker registered:", reg);
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  }, []);

  return null;
}
