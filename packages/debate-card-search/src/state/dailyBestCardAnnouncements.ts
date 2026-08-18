/**
 * @fileoverview Persistence for the "Daily Best Card Challenge" idea's
 * remaining follow-ups (b) and (c) under Research Crowdsourcing Organizer
 * Features in TODO.md — "a scheduled job or view that persists/announces the
 * day's winner" and "a challenge banner/widget UI". Follow-up (a), wiring a
 * `submittedAt` timestamp into wherever card contributions are persisted, was
 * already closed by `state/contributions.ts`'s `ContributionsFeedPanel`
 * submission flow, which stamps every submitted contribution's
 * `submittedAt: Date.now()` — so this store only needs to read that existing
 * persisted contribution list.
 *
 * `buildPersistedDailyBestCards`/`getPersistedBestCardForDay` compose
 * `lib/daily-best-card.ts`'s pure `buildDailyBestCards`/`getBestCardForDay`
 * directly against `state/contributions.ts`'s persisted store, mirroring the
 * existing "compose the pure function directly against the persisted store"
 * convention (see `buildPersistedLeaderboard`, `buildTopContributorAwardsFromStore`).
 *
 * `announceDailyBestCard` persists a day's computed winner once, under a
 * separate `dailyBestCardAnnouncements` storage key keyed by `dayKey`. Once a
 * day has been announced its recorded winner is frozen — a later, stronger
 * same-day submission does not retroactively change an already-announced
 * result, matching how a real daily-challenge announcement would work.
 *
 * @module state/dailyBestCardAnnouncements
 */

import { listContributions } from "./contributions";
import {
  buildDailyBestCards,
  getBestCardForDay,
  getUtcDayKey,
  type DailyBestCard,
  type TimestampedCardContribution,
} from "../lib/daily-best-card";
import type { HelpfulnessWeights } from "../lib/community-rating";
import { DEFAULT_HELPFULNESS_WEIGHTS } from "../lib/community-rating";

const ANNOUNCEMENTS_STORAGE_KEY = "dailyBestCardAnnouncements";

/**
 * Reconstructs a persisted `AttributedContribution` as a `TimestampedCardContribution`
 * if it's a timestamped card submission, or `null` otherwise. `AttributedContribution`
 * carries extra fields (`contributorId`, `argBlock`) that `TimestampedCardContribution`
 * doesn't declare, so this rebuilds the narrower shape explicitly rather than
 * relying on a type predicate over the wider type.
 */
function toTimestampedCardContribution(
  contribution: ReturnType<typeof listContributions>[number],
): TimestampedCardContribution | null {
  if (contribution.kind !== "card" || typeof contribution.submittedAt !== "number") return null;
  return {
    id: contribution.id,
    kind: "card",
    submittedAt: contribution.submittedAt,
    likes: contribution.likes,
    saves: contribution.saves,
    qualitySignals: contribution.qualitySignals,
    reviewerEndorsements: contribution.reviewerEndorsements,
  };
}

/** Narrows every persisted contribution down to timestamped card submissions. */
function readTimestampedCardContributions(): TimestampedCardContribution[] {
  return listContributions()
    .map(toTimestampedCardContribution)
    .filter((contribution): contribution is TimestampedCardContribution => contribution !== null);
}

/**
 * Builds the Daily Best Card Challenge results directly from every persisted
 * card contribution, composing this store with `daily-best-card.ts`'s pure
 * `buildDailyBestCards`. An empty (or card-less) store returns an empty list
 * rather than throwing.
 */
export function buildPersistedDailyBestCards(
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): DailyBestCard[] {
  return buildDailyBestCards(readTimestampedCardContributions(), weights);
}

/**
 * Looks up the live (not-yet-announced) winner among persisted card
 * contributions submitted on the UTC calendar day of `now`, or `null` if none
 * were submitted that day.
 */
export function getPersistedBestCardForDay(
  now: number,
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): DailyBestCard | null {
  return getBestCardForDay(readTimestampedCardContributions(), now, weights);
}

function readAnnouncements(): DailyBestCard[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DailyBestCard[]) : [];
  } catch {
    return [];
  }
}

function writeAnnouncements(announcements: DailyBestCard[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(announcements));
}

/**
 * Lists every announced daily winner, sorted by `dayKey` ascending.
 */
export function listAnnouncedDailyBestCards(): DailyBestCard[] {
  return [...readAnnouncements()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/** Looks up an already-announced day's winner by `dayKey`, if any. */
export function getAnnouncedDailyBestCard(dayKey: string): DailyBestCard | undefined {
  return readAnnouncements().find((announcement) => announcement.dayKey === dayKey);
}

/**
 * Announces the UTC calendar day of `now`'s winner, freezing it in storage.
 * Idempotent: if that day was already announced, the existing announcement is
 * returned unchanged rather than being recomputed against contributions
 * submitted after the first announcement. Returns `null` (persisting nothing)
 * if the day has no card contributions to announce yet.
 */
export function announceDailyBestCard(
  now: number,
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): DailyBestCard | null {
  const dayKey = getUtcDayKey(now);
  const existing = getAnnouncedDailyBestCard(dayKey);
  if (existing) return existing;

  const winner = getPersistedBestCardForDay(now, weights);
  if (!winner) return null;

  writeAnnouncements([...readAnnouncements(), winner]);
  return winner;
}
