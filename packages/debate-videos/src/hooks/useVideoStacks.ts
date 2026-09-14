/**
 * @fileoverview Resolves the stacked playlists a loaded feed touches.
 *
 * `/api/videos` marks each row with its stack key but cannot carry the rest of
 * the stack: a round and the analysis made from it are pages apart in any
 * ordering, and a rounds view filters the analysis out entirely. This hook
 * collects the keys on screen and fetches their members once, so the grid can
 * fold both videos into one card with `<` / `>` arrows.
 *
 * Keys already fetched are never re-requested — infinite scroll appends pages
 * continuously, and re-fetching the whole set on each one would issue a
 * request per page for data that does not change.
 * @module hooks/useVideoStacks
 */

import { useEffect, useRef, useState } from "react";
import grab from "grab-url";
import type { VideoStacksResponse, VideoType } from "../types/videos";
import { collectStackKeys, type VideoStackMap } from "../components/video-grid/video-stacks";

/** Stack keys resolved per request; matches the server's own ceiling. */
const MAX_KEYS_PER_REQUEST = 120;

/**
 * Loads the members of every stacked playlist present in `videos`.
 *
 * @param videos - Videos loaded so far.
 * @param enabled - `false` skips fetching entirely (the stacking toggle is off).
 * @returns Members per stack key; empty until the first response lands.
 */
export function useVideoStacks(videos: VideoType[], enabled = true): VideoStackMap {
  const [stacks, setStacks] = useState<VideoStackMap>({});
  /** Keys already requested, resolved or not, so each is fetched once. */
  const requestedRef = useRef<Set<string>>(new Set());

  const keys = enabled ? collectStackKeys(videos) : [];
  const pending = keys.filter((key) => !requestedRef.current.has(key));
  // A stable identity for the *new* keys only: the effect below must run when
  // a page brings a stack the hook has not seen, and not on every re-render.
  const pendingKey = pending.join(",");

  useEffect(() => {
    if (!enabled || pendingKey.length === 0) return;

    const batch = pendingKey.split(",").slice(0, MAX_KEYS_PER_REQUEST);
    for (const key of batch) requestedRef.current.add(key);

    let cancelled = false;
    void (async () => {
      try {
        const data: VideoStacksResponse = await grab("videos/stacks", { keys: batch.join(",") });
        if (cancelled || !data?.stacks) return;
        setStacks((previous) => ({ ...previous, ...data.stacks }));
      } catch (error) {
        // A stack that cannot be resolved is not an error the user needs to
        // see: the videos render unstacked, which is the pre-feature layout.
        console.error("Failed to load video stacks", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingKey, enabled]);

  return stacks;
}
