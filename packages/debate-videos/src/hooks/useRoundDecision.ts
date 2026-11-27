/**
 * @fileoverview A round's overall decision and its judges' votes from
 * `/api/videos/decision`, fetched only once the viewer reveals the decision
 * (it names the winner, so nothing is requested before the click). The server
 * answers from the stored result or looks the round up on Tabroom / College
 * Debate Results; a round it can't settle comes back `unknown`.
 *
 * Answers are kept for the tab's session so reopening a round is instant; a
 * failed request is not kept, so a later reveal tries again.
 * @module hooks/useRoundDecision
 */

import { useEffect, useState } from "react";
import { UNKNOWN_DECISION, parseRoundDecision, type RoundDecision } from "../lib/round-decision";

export interface RoundDecisionState {
  /** True from the reveal until the answer arrives. */
  loading: boolean;
  decision: RoundDecision;
}

const cache = new Map<string, Promise<RoundDecision>>();

function loadDecision(videoId: string): Promise<RoundDecision> {
  let pending = cache.get(videoId);
  if (!pending) {
    pending = fetch(`/api/videos/decision?id=${encodeURIComponent(videoId)}`)
      .then((res) => (res.ok ? res.json() : UNKNOWN_DECISION))
      .then(parseRoundDecision)
      .catch(() => {
        cache.delete(videoId);
        return UNKNOWN_DECISION;
      });
    cache.set(videoId, pending);
  }
  return pending;
}

/** Test helper: forgets every fetched decision. */
export function resetRoundDecisions(): void {
  cache.clear();
}

/** The decision for `videoId` once `enabled`; `loading` until it arrives. */
export function useRoundDecision(videoId: string, enabled: boolean): RoundDecisionState {
  const [state, setState] = useState<{ id: string; value: RoundDecision } | null>(null);
  useEffect(() => {
    if (!enabled || !videoId) return;
    let live = true;
    loadDecision(videoId).then((value) => {
      if (live) setState({ id: videoId, value });
    });
    return () => {
      live = false;
    };
  }, [videoId, enabled]);
  if (!enabled) return { loading: false, decision: UNKNOWN_DECISION };
  if (state?.id !== videoId) return { loading: true, decision: UNKNOWN_DECISION };
  return { loading: false, decision: state.value };
}
