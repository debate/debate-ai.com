/**
 * @fileoverview A round's judges and squirrels from `/api/videos/judges`,
 * fetched only once the decision is revealed (they name the winner's
 * majority, so they stay hidden until then). Answers are kept for the tab's
 * session so the card and the watch page share one request per video.
 * @module hooks/useRoundJudges
 */

import { useEffect, useState } from "react";

export interface RoundJudges {
  /** Comma-separated names, or null when none are saved. */
  judges: string | null;
  /** Judges in the minority; `""` for a unanimous decision, null when unknown. */
  squirrels: string | null;
}

const cache = new Map<string, Promise<RoundJudges>>();
const NONE: RoundJudges = { judges: null, squirrels: null };

function loadJudges(videoId: string): Promise<RoundJudges> {
  let pending = cache.get(videoId);
  if (!pending) {
    pending = fetch(`/api/videos/judges?id=${encodeURIComponent(videoId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<RoundJudges>) : NONE))
      .then((data) => ({ judges: data?.judges ?? null, squirrels: data?.squirrels ?? null }))
      .catch(() => {
        cache.delete(videoId);
        return NONE;
      });
    cache.set(videoId, pending);
  }
  return pending;
}

/** Test helper: forgets every fetched panel. */
export function resetRoundJudges(): void {
  cache.clear();
}

/** The saved judges for `videoId` once `enabled`; empty until they load. */
export function useRoundJudges(videoId: string, enabled: boolean): RoundJudges {
  const [state, setState] = useState<{ id: string; value: RoundJudges } | null>(null);
  useEffect(() => {
    if (!enabled || !videoId) return;
    let live = true;
    loadJudges(videoId).then((value) => {
      if (live) setState({ id: videoId, value });
    });
    return () => {
      live = false;
    };
  }, [videoId, enabled]);
  return enabled && state?.id === videoId ? state.value : NONE;
}
