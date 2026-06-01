"use client";

import { useEffect } from "react";

export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.log("Service Worker not supported");
      return;
    }

    // Skip on localhost for development
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      return;
    }

    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        console.log("Service Worker registered:", reg);
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  }, []);

  return <>{children}</>;
}
