/**
 * @fileoverview Persistence for the "🏆 Top Contributor Awards" bullet's
 * follow-up (b) under Research Crowdsourcing Organizer Features in TODO.md —
 * "a scheduled job that periodically calls `buildTopContributorAwards` and
 * persists/announces the winners." This repo has no scheduled-job
 * infrastructure (see `dailyBestCardAnnouncements.ts`'s identical caveat), so
 * — mirroring that module's "Daily Best Card Challenge" announcement layer —
 * this adds a manual, idempotent-per-UTC-day "announce" action instead: a
 * person opens the panel and freezes that day's current category winners,
 * rather than the panel always recomputing standings live.
 *
 * The live (not-yet-announced) standings come straight from
 * `state/contributions.ts`'s `buildTopContributorAwardsFromStore`, which
 * already composes `lib/contributor-awards.ts`'s pure `buildTopContributorAwards`
 * against the persisted contribution store — so this module only adds the
 * announcement/freeze layer on top rather than re-deriving award standings
 * itself.
 *
 * `announceContributorAwards` persists a day's computed award standings once,
 * under a separate `contributorAwardAnnouncements` storage key keyed by
 * `dayKey`. Once a day has been announced its recorded standings are frozen —
 * a later, same-day contribution that would change the live standings does
 * not retroactively change an already-announced result, matching
 * `dailyBestCardAnnouncements.ts`'s same freeze behavior.
 *
 * @module state/contributorAwardAnnouncements
 */

import { buildTopContributorAwardsFromStore } from "debate-research-evidence/src/state/contributions";
import { getUtcDayKey } from "debate-research-evidence/src/lib/daily-best-card";
import type { ContributorAward } from "debate-research-evidence/src/lib/contributor-awards";

const ANNOUNCEMENTS_STORAGE_KEY = "contributorAwardAnnouncements";

/** One UTC day's frozen set of Top Contributor Awards category winners. */
export interface AnnouncedContributorAwards {
  dayKey: string;
  awards: ContributorAward[];
}

/**
 * Builds the current Top Contributor Awards standings directly from every
 * persisted contribution — the live (not-yet-announced) view. An empty store
 * returns an empty award list rather than throwing.
 */
export function buildPersistedTopContributorAwards(): ContributorAward[] {
  return buildTopContributorAwardsFromStore();
}

function readAnnouncements(): AnnouncedContributorAwards[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnnouncedContributorAwards[]) : [];
  } catch {
    return [];
  }
}

function writeAnnouncements(announcements: AnnouncedContributorAwards[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(announcements));
}

/**
 * Lists every announced day's award standings, sorted by `dayKey` ascending.
 */
export function listAnnouncedContributorAwards(): AnnouncedContributorAwards[] {
  return [...readAnnouncements()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/** Looks up an already-announced day's award standings by `dayKey`, if any. */
export function getAnnouncedContributorAwards(dayKey: string): AnnouncedContributorAwards | undefined {
  return readAnnouncements().find((announcement) => announcement.dayKey === dayKey);
}

/**
 * Announces the UTC calendar day of `now`'s current award standings, freezing
 * them in storage. Idempotent: if that day was already announced, the
 * existing announcement is returned unchanged rather than being recomputed
 * against contributions submitted after the first announcement. Returns
 * `null` (persisting nothing) if there are no awards to announce yet (no
 * contributions in any category).
 */
export function announceContributorAwards(now: number): AnnouncedContributorAwards | null {
  const dayKey = getUtcDayKey(now);
  const existing = getAnnouncedContributorAwards(dayKey);
  if (existing) return existing;

  const awards = buildPersistedTopContributorAwards();
  if (awards.length === 0) return null;

  const announcement: AnnouncedContributorAwards = { dayKey, awards };
  writeAnnouncements([...readAnnouncements(), announcement]);
  return announcement;
}
