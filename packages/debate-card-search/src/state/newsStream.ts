/**
 * @fileoverview News Stream feed assembly + per-viewer read/like state.
 *
 * `buildNewsFeed` composes `lib/news-stream.ts`'s static `PRODUCT_NEWS` with
 * every already-persisted community announcement — `dailyBestCardAnnouncements.ts`'s
 * `listAnnouncedDailyBestCards` and `contributorAwardAnnouncements.ts`'s
 * `listAnnouncedContributorAwards` — turning each into a `NewsItem` via
 * `daily-best-card.ts`'s `buildDailyBestCardHighlight` and
 * `contributor-awards.ts`'s `buildAwardsAnnouncementText`. Those two stores
 * remain the source of truth for their own events; this module only
 * re-shapes their already-persisted records into the feed's common type,
 * mirroring `state/contributions.ts`'s "compose the pure/store layer
 * directly" convention rather than duplicating either store's data.
 *
 * Read/like state is local to this feed (not shared with `contributions.ts`'s
 * like counts, which track a card's community helpfulness rather than
 * whether a reader has seen a news item) and stored under its own
 * `newsStreamViewerState` key, mirroring `contributorAvailability.ts`'s
 * per-viewer localStorage convention.
 *
 * @module state/newsStream
 */

import { PRODUCT_NEWS, sortNewsFeed, type NewsItem } from "../lib/news-stream";
import { listAnnouncedDailyBestCards } from "./dailyBestCardAnnouncements";
import { listAnnouncedContributorAwards } from "./contributorAwardAnnouncements";
import { buildDailyBestCardHighlight } from "../lib/daily-best-card";
import { buildAwardsAnnouncementText } from "../lib/contributor-awards";

/** Turns every announced Daily Best Card winner into a `NewsItem`. */
function dailyBestCardNews(): NewsItem[] {
  return listAnnouncedDailyBestCards().map((announcement) => ({
    id: `daily-best-card-${announcement.dayKey}`,
    category: "daily-best-card" as const,
    title: `Daily Best Card — ${announcement.dayKey}`,
    body: buildDailyBestCardHighlight(announcement),
    timestamp: Date.parse(`${announcement.dayKey}T00:00:00Z`),
    href: "/cards/best-card",
  }));
}

/** Turns every announced day's Contributor Award standings into a `NewsItem`. */
function contributorAwardsNews(): NewsItem[] {
  return listAnnouncedContributorAwards().map((announcement) => ({
    id: `contributor-awards-${announcement.dayKey}`,
    category: "awards" as const,
    title: `Contributor Awards — ${announcement.dayKey}`,
    body: buildAwardsAnnouncementText(announcement.awards),
    timestamp: Date.parse(`${announcement.dayKey}T00:00:00Z`),
    href: "/cards/awards",
  }));
}

/**
 * Builds the full News Stream feed: hand-maintained product updates plus
 * every announced Daily Best Card winner and Contributor Awards standings,
 * newest first. Reads two other localStorage stores (via the announcement
 * modules above) in addition to this module's own — safe to call
 * server-side or during SSR, since each underlying store already guards its
 * own `localStorage` access and returns an empty list when unavailable.
 */
export function buildNewsFeed(): NewsItem[] {
  return sortNewsFeed([...PRODUCT_NEWS, ...dailyBestCardNews(), ...contributorAwardsNews()]);
}

const VIEWER_STATE_KEY = "newsStreamViewerState";

interface ViewerState {
  read: Record<string, true>;
  liked: Record<string, true>;
}

function readViewerState(): ViewerState {
  if (typeof localStorage === "undefined") return { read: {}, liked: {} };
  try {
    const raw = localStorage.getItem(VIEWER_STATE_KEY);
    if (!raw) return { read: {}, liked: {} };
    const parsed = JSON.parse(raw);
    return {
      read: parsed && typeof parsed === "object" && parsed.read ? parsed.read : {},
      liked: parsed && typeof parsed === "object" && parsed.liked ? parsed.liked : {},
    };
  } catch {
    return { read: {}, liked: {} };
  }
}

function writeViewerState(state: ViewerState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(VIEWER_STATE_KEY, JSON.stringify(state));
}

/** Whether the viewer has marked this news item read. */
export function isNewsItemRead(id: string): boolean {
  return !!readViewerState().read[id];
}

/** Marks a news item read (idempotent). */
export function markNewsItemRead(id: string): void {
  const state = readViewerState();
  if (state.read[id]) return;
  state.read[id] = true;
  writeViewerState(state);
}

/** Whether the viewer has liked this news item. */
export function isNewsItemLiked(id: string): boolean {
  return !!readViewerState().liked[id];
}

/** Toggles the viewer's like on a news item, returning the new liked state. */
export function toggleNewsItemLiked(id: string): boolean {
  const state = readViewerState();
  if (state.liked[id]) {
    delete state.liked[id];
  } else {
    state.liked[id] = true;
  }
  writeViewerState(state);
  return !!state.liked[id];
}

/** Count of feed items the viewer hasn't marked read yet. */
export function countUnreadNewsItems(items: NewsItem[]): number {
  const state = readViewerState();
  return items.filter((item) => !state.read[item.id]).length;
}
