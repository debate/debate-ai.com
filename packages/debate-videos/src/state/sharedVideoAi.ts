/**
 * @fileoverview The client half of the watch page's shared AI results — see
 * `lib/shared-video-ai.ts` for the rules.
 *
 * `useSharedVideoAi(videoId)` loads what any viewer already ran for a video
 * (one `GET /api/video-ai-results` per video per page load, shared by every
 * panel that asks), and `shareVideoAiResult` offers a fresh run back. The
 * server keeps the first good result and ignores later ones unless an admin
 * asked to replace it, so a share never overwrites what others already see.
 *
 * Kept in memory, not `localStorage`: the per-browser caches
 * (`speechAiCache.ts`, `speechOutcomeCache.ts`) hold what *this* reader ran
 * and are capped and account-synced, and filling them with every video's
 * shared runs would evict the reader's own. Panels read their own cache
 * first and fall back to the shared copy.
 * @module state/sharedVideoAi
 */

import { useEffect, useState } from "react";
import {
  EMPTY_SHARED_VIDEO_AI,
  isSharedVideoId,
  outcomeKey,
  type SharedVideoAi,
  type SharedVideoAiItem,
} from "../lib/shared-video-ai";

export const SHARED_VIDEO_AI_ENDPOINT = "/api/video-ai-results";

const loaded = new Map<string, SharedVideoAi>();
const pending = new Map<string, Promise<SharedVideoAi>>();
const listeners = new Set<(videoId: string) => void>();

function emit(videoId: string): void {
  for (const listener of listeners) listener(videoId);
}

/** What is already known for a video, without fetching. */
export function peekSharedVideoAi(videoId: string): SharedVideoAi {
  return loaded.get(videoId) ?? EMPTY_SHARED_VIDEO_AI;
}

/**
 * Loads a video's shared results once; later calls reuse the answer. A failed
 * load reads as empty and is retried by the next call.
 */
export function loadSharedVideoAi(videoId: string): Promise<SharedVideoAi> {
  const known = loaded.get(videoId);
  if (known) return Promise.resolve(known);
  const inFlight = pending.get(videoId);
  if (inFlight) return inFlight;
  if (!isSharedVideoId(videoId) || typeof fetch === "undefined") return Promise.resolve(EMPTY_SHARED_VIDEO_AI);

  const request = fetch(`${SHARED_VIDEO_AI_ENDPOINT}?videoId=${encodeURIComponent(videoId)}`)
    .then(async (res) => {
      if (!res.ok) return EMPTY_SHARED_VIDEO_AI;
      const json = (await res.json()) as Partial<SharedVideoAi>;
      const shared: SharedVideoAi = {
        segmentation: json.segmentation ?? null,
        summaries: json.summaries ?? {},
        outcomes: json.outcomes ?? {},
      };
      // A share that landed while this was in flight is newer than the answer.
      const local = loaded.get(videoId);
      const merged = local ? mergeShared(shared, local) : shared;
      loaded.set(videoId, merged);
      emit(videoId);
      return merged;
    })
    .catch(() => EMPTY_SHARED_VIDEO_AI)
    .finally(() => pending.delete(videoId));
  pending.set(videoId, request);
  return request;
}

function mergeShared(base: SharedVideoAi, over: SharedVideoAi): SharedVideoAi {
  return {
    segmentation: over.segmentation ?? base.segmentation,
    summaries: { ...base.summaries, ...over.summaries },
    outcomes: { ...base.outcomes, ...over.outcomes },
  };
}

function withItem(shared: SharedVideoAi, item: SharedVideoAiItem): SharedVideoAi {
  switch (item.kind) {
    case "segmentation":
      return { ...shared, segmentation: item.data };
    case "summary":
      return { ...shared, summaries: { ...shared.summaries, [item.key]: item.data } };
    case "outcome":
      return { ...shared, outcomes: { ...shared.outcomes, [item.key]: item.data } };
  }
}

/**
 * Offers a fresh result to every viewer of the video. Fire-and-forget: a
 * signed-out reader, a full server or a lost race just means this run stays
 * in the reader's own browser. When the server already held a result it
 * answers with it, and that stored copy becomes this page's shared one.
 *
 * @param replace - Ask to overwrite an existing result; the server honours
 *   it for admins only (their "Run again" regenerates the shared copy).
 */
export async function shareVideoAiResult(
  videoId: string,
  item: SharedVideoAiItem,
  { replace = false }: { replace?: boolean } = {},
): Promise<void> {
  if (!isSharedVideoId(videoId) || typeof fetch === "undefined") return;
  try {
    const res = await fetch(SHARED_VIDEO_AI_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoId, ...item, replace }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as { item?: SharedVideoAiItem };
    const stored = json.item ?? item;
    loaded.set(videoId, withItem(peekSharedVideoAi(videoId), stored));
    emit(videoId);
  } catch {
    // Offline or blocked — the run is still in this browser.
  }
}

/** Convenience for the Outcomes view's key. */
export function sharedOutcome(shared: SharedVideoAi, speechKey: string, lens: string) {
  return shared.outcomes[outcomeKey(speechKey, lens)] ?? null;
}

/** The speech keys with a shared outcome run under any panel. */
export function sharedOutcomeSpeechKeys(shared: SharedVideoAi): string[] {
  return Object.keys(shared.outcomes).map((key) => key.slice(0, key.lastIndexOf("::")));
}

/** Drops everything loaded — for tests. */
export function resetSharedVideoAi(): void {
  loaded.clear();
  pending.clear();
}

/**
 * A video's shared AI results, loading them on first use and updating when a
 * share (from any panel on the page) lands.
 */
export function useSharedVideoAi(videoId: string | undefined): SharedVideoAi {
  const [shared, setShared] = useState<SharedVideoAi>(() =>
    videoId ? peekSharedVideoAi(videoId) : EMPTY_SHARED_VIDEO_AI,
  );
  useEffect(() => {
    if (!videoId) {
      setShared(EMPTY_SHARED_VIDEO_AI);
      return;
    }
    setShared(peekSharedVideoAi(videoId));
    const listener = (changed: string) => {
      if (changed === videoId) setShared(peekSharedVideoAi(videoId));
    };
    listeners.add(listener);
    void loadSharedVideoAi(videoId);
    return () => {
      listeners.delete(listener);
    };
  }, [videoId]);
  return shared;
}
