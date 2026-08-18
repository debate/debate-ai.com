/**
 * @fileoverview Persistence for the "Daily Best Card Challenge" idea's
 * follow-up (b) under Research Crowdsourcing Organizer Features in TODO.md —
 * "a scheduled job or view that persists/announces the day's winner".
 * Follow-up (a), wiring a `submittedAt` timestamp into wherever card
 * contributions are persisted, was already closed by `state/contributions.ts`'s
 * `ContributionsFeedPanel` submission flow, which stamps every submitted
 * contribution's `submittedAt: Date.now()`.
 *
 * The live (not-yet-announced) results come straight from
 * `state/contributions.ts`'s `buildDailyBestCardsFromStore`/
 * `getTodaysBestCardFromStore`, which already compose
 * `lib/daily-best-card.ts`'s pure day-grouping/winner selection against the
 * persisted contribution store and keep each winner's `contributorId`
 * attached — so this module only adds the announcement layer on top rather
 * than re-reading and re-narrowing the store itself.
 *
 * `announceDailyBestCard` persists a day's computed winner once, under a
 * separate `dailyBestCardAnnouncements` storage key keyed by `dayKey`. Once a
 * day has been announced its recorded winner is frozen — a later, stronger
 * same-day submission does not retroactively change an already-announced
 * result, matching how a real daily-challenge announcement would work.
 *
 * @module state/dailyBestCardAnnouncements
 */

import {
  buildDailyBestCardsFromStore,
  getTodaysBestCardFromStore,
  type AttributedDailyBestCard,
} from "./contributions";
import { getUtcDayKey } from "../lib/daily-best-card";
import type { HelpfulnessWeights } from "../lib/community-rating";
import { DEFAULT_HELPFULNESS_WEIGHTS } from "../lib/community-rating";

const ANNOUNCEMENTS_STORAGE_KEY = "dailyBestCardAnnouncements";

/**
 * Builds the Daily Best Card Challenge results directly from every persisted
 * card contribution. An empty (or card-less) store returns an empty list
 * rather than throwing.
 */
export function buildPersistedDailyBestCards(
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): AttributedDailyBestCard[] {
  return buildDailyBestCardsFromStore(weights);
}

/**
 * Looks up the live (not-yet-announced) winner among persisted card
 * contributions submitted on the UTC calendar day of `now`, or `null` if none
 * were submitted that day.
 */
export function getPersistedBestCardForDay(
  now: number,
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): AttributedDailyBestCard | null {
  return getTodaysBestCardFromStore(now, weights);
}

function readAnnouncements(): AttributedDailyBestCard[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttributedDailyBestCard[]) : [];
  } catch {
    return [];
  }
}

function writeAnnouncements(announcements: AttributedDailyBestCard[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(announcements));
}

/**
 * Lists every announced daily winner, sorted by `dayKey` ascending.
 */
export function listAnnouncedDailyBestCards(): AttributedDailyBestCard[] {
  return [...readAnnouncements()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/** Looks up an already-announced day's winner by `dayKey`, if any. */
export function getAnnouncedDailyBestCard(dayKey: string): AttributedDailyBestCard | undefined {
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
): AttributedDailyBestCard | null {
  const dayKey = getUtcDayKey(now);
  const existing = getAnnouncedDailyBestCard(dayKey);
  if (existing) return existing;

  const winner = getPersistedBestCardForDay(now, weights);
  if (!winner) return null;

  writeAnnouncements([...readAnnouncements(), winner]);
  return winner;
}
