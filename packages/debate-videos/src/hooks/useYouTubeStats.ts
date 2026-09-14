/**
 * @fileoverview Channel-statistics fetch for the videos pages' stats modal.
 * @module hooks/useYouTubeStats
 */

import { useEffect, useState } from "react";

/**
 * Loads `/api/youtube-stats` once, for the channel stats modal in the search
 * bar.
 *
 * The endpoint is optional furniture: it depends on a YouTube API key the
 * deployment may not have, and when it fails the platform returns an HTML
 * error page. Handing that to `res.json()` threw on every page load, so the
 * response is checked before it is parsed and a failure simply leaves the
 * modal button off.
 *
 * @returns The stats object, or `null` while loading or when unavailable.
 */
export function useYouTubeStats(): unknown | null {
  const [stats, setStats] = useState<unknown | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/youtube-stats", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) return null;
        if (!res.headers.get("content-type")?.includes("application/json")) return null;
        return res.json();
      })
      .then((data) => {
        if (data) setStats(data);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        console.error("Failed to load YouTube stats:", error);
      });

    return () => controller.abort();
  }, []);

  return stats;
}
