/**
 * @fileoverview Whether a round's decision has been revealed.
 *
 * A round video keeps its result hidden until the viewer clicks "Reveal
 * decision": the judges' decision and the gold border around the winning
 * team both wait for it. The watch page and the video's card share the
 * same per-video flag, so revealing on one shows the winner on the other.
 * It lasts for the tab's session and is not saved.
 *
 * @module hooks/useDecisionReveal
 */

import { useCallback, useSyncExternalStore } from "react";

const revealed = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Marks a video's decision as revealed for the rest of the session. */
export function revealDecision(videoId: string): void {
  if (revealed.has(videoId)) return;
  revealed.add(videoId);
  for (const listener of listeners) listener();
}

/** Test helper: hides every decision again. */
export function resetRevealedDecisions(): void {
  revealed.clear();
  for (const listener of listeners) listener();
}

/**
 * `[revealed, reveal]` for one video's decision. Until it is revealed,
 * nothing that names the winner should render.
 */
export function useDecisionReveal(videoId: string): [boolean, () => void] {
  const isRevealed = useSyncExternalStore(
    subscribe,
    () => revealed.has(videoId),
    () => false,
  );
  const reveal = useCallback(() => revealDecision(videoId), [videoId]);
  return [isRevealed, reveal];
}
