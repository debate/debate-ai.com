/**
 * @fileoverview Pure diff/message logic for a "Progress Unlocks" unlock
 * celebration — the "🔓 Progress Unlocks" bullet's own next-named follow-up
 * in TODO.md: "a small unlock celebration toast when a tier/badge is
 * earned." `ContributorUnlockStatusWithStreak.badges` (tier badges from
 * `progress-unlocks.ts` plus streak badges from `gamified-quests.ts`, merged
 * by `unlock-streak-status.ts`) only ever grows for a contributor, so
 * "newly earned since last seen" is a plain set difference against a
 * persisted baseline (`state/unlockCelebrations.ts`) — no new badge/tier
 * rule is introduced here.
 *
 * @module lib/unlock-celebration
 */

/**
 * Badges present in `currentBadges` but not in `previousBadges`, in
 * `currentBadges`'s order. A `previousBadges` of `undefined` means this
 * contributor has never had a baseline recorded before — treated as
 * "nothing to compare yet" rather than "every current badge is new", so a
 * contributor with existing badges doesn't get a false "just earned"
 * celebration the first time a baseline is recorded for them.
 */
export function getNewlyEarnedBadges(previousBadges: string[] | undefined, currentBadges: string[]): string[] {
  if (previousBadges === undefined) return [];
  const previousSet = new Set(previousBadges);
  return currentBadges.filter((badge) => !previousSet.has(badge));
}

/**
 * Renders a short celebration message for one or more newly earned badges,
 * for display in a dismissible toast/banner. Returns an empty string for an
 * empty list — callers should only render a banner when this is non-empty.
 */
export function buildUnlockCelebrationMessage(newlyEarnedBadges: string[]): string {
  if (newlyEarnedBadges.length === 0) return "";
  if (newlyEarnedBadges.length === 1) return `🎉 New badge earned: ${newlyEarnedBadges[0]}!`;
  return `🎉 New badges earned: ${newlyEarnedBadges.join(", ")}!`;
}
