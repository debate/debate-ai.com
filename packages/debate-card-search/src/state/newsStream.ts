/**
 * @fileoverview News Stream feed assembly + per-viewer read/like state.
 *
 * `buildNewsFeed` composes `lib/news-stream.ts`'s static `PRODUCT_NEWS` with
 * every already-persisted community announcement, turning each into a
 * `NewsItem`: `dailyBestCardAnnouncements.ts`'s `listAnnouncedDailyBestCards`
 * and `contributorAwardAnnouncements.ts`'s `listAnnouncedContributorAwards`
 * (via `daily-best-card.ts`'s `buildDailyBestCardHighlight` and
 * `contributor-awards.ts`'s `buildAwardsAnnouncementText`), plus three more
 * derived directly from their own already-persisted history rather than a
 * separate "announced" store — `dailyMissionResults.ts`'s
 * `buildQuestStreakMilestoneEvents`, `challengeWinEvents.ts`'s
 * `buildCompletedGroupChallengeEvents`, and `revisionHistory.ts`'s
 * `buildDailyTopReviserAnnouncements`, each replaying the same deterministic
 * history every time so nothing needs to be separately frozen. Every source
 * module remains the source of truth for its own events; this module only
 * re-shapes their already-persisted records into the feed's common type,
 * mirroring `state/contributions.ts`'s "compose the pure/store layer
 * directly" convention rather than duplicating any store's data.
 *
 * A fourth Community source, `sprintNotes.ts`'s `listSprintNotes`, closes
 * the "a Prep Room note ... [isn't] wired in" Known gap recorded in
 * `docs/features/news-stream.md` — unlike the streak/challenge/revision
 * sources above, a `SprintNote` is already the atomic event (no derivation
 * over a longer history is needed): every persisted note becomes one
 * `NewsItem`, rendered via `team-collaboration-mode.ts`'s new
 * `buildSprintNoteAnnouncementText`.
 *
 * A fifth Community source, `evidenceLibraryEntries.ts`'s
 * `listEvidenceLibraryEntries`, closes the "a new Argument Library entry
 * ... isn't wired in" half of that same Known gap — like a sprint note, a
 * submitted `EvidenceLibraryEntry` is already the atomic event, so
 * `argumentLibraryNews()` maps every "live" (not held back by an
 * in-progress peer review, via `isEntryLive`) entry that carries the
 * `createdAt` its submitting panel stamps on first save
 * straight to a `NewsItem`, rendered via `shared-evidence-library.ts`'s new
 * `buildEvidenceEntryAnnouncementText`. The gap's other half — a coaching
 * session — closes not by adding a source function here (it lives in
 * `debate-round`, which already depends on this package, so sourcing a news
 * item from it here would need the reverse dependency, a cycle this
 * package can't take on) but via `buildNewsFeed`'s new `extraItems`
 * parameter: `debate-round`'s `state/coachingSessions.ts` produces its own
 * `coachingSessionNews()`, composed in at the app layer instead.
 *
 * Read/like state is local to this feed (not shared with `contributions.ts`'s
 * like counts, which track a card's community helpfulness rather than
 * whether a reader has seen a news item) and stored under its own
 * `newsStreamViewerState` key, mirroring `contributorAvailability.ts`'s
 * per-viewer localStorage convention.
 *
 * `sprintNoteNews()` and `argumentLibraryNews()` close the "no volume
 * control" Known gap recorded in `docs/features/news-stream.md`: unlike the
 * streak/challenge/revision sources (naturally bounded to at most one event
 * per contributor per milestone, per challenge, or per day), a sprint note
 * or an Argument Library entry is posted every single time one is logged or
 * submitted, so a very active topic sprint or a busy submission period
 * could otherwise flood the feed. Both cap themselves to the
 * `MAX_COMMUNITY_ITEMS_PER_SOURCE` most recent records via `mostRecentBy`
 * — a feed-projection cap, not a store cap: nothing is deleted from
 * `sprintNotes.ts`/`evidenceLibraryEntries.ts`, older records just stop
 * appearing in this feed once newer ones push past the limit.
 *
 * @module state/newsStream
 */

import { PRODUCT_NEWS, buildAutoFeatureNews, sortNewsFeed, type NewsItem } from "../lib/news-stream";
import { listAnnouncedDailyBestCards } from "./dailyBestCardAnnouncements";
import { listAnnouncedContributorAwards } from "./contributorAwardAnnouncements";
import { buildDailyBestCardHighlight } from "../lib/daily-best-card";
import { buildAwardsAnnouncementText } from "../lib/contributor-awards";
import { buildQuestStreakMilestoneEvents } from "./dailyMissionResults";
import { buildStreakMilestoneAnnouncementText } from "../lib/gamified-quests";
import { buildCompletedGroupChallengeEvents } from "./challengeWinEvents";
import { buildChallengeCompletionAnnouncementText } from "../lib/group-challenges";
import { buildDailyTopReviserAnnouncements } from "./revisionHistory";
import { buildTopReviserAnnouncementText } from "../lib/revision-incentives";
import { listSprintNotes } from "./sprintNotes";
import { buildSprintNoteAnnouncementText } from "../lib/team-collaboration-mode";
import { isEntryLive, listEvidenceLibraryEntries } from "./evidenceLibraryEntries";
import { buildEvidenceEntryAnnouncementText, type EvidenceLibraryEntry } from "../lib/shared-evidence-library";

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

/** Turns every contributor's freshly earned streak-milestone crossing into a `NewsItem`. */
function questStreakMilestoneNews(): NewsItem[] {
  return buildQuestStreakMilestoneEvents().map((event) => ({
    id: `quest-streak-milestone-${event.contributorId}-${event.dayKey}`,
    category: "community" as const,
    title: `${event.contributorId} earned "${event.badge}"`,
    body: buildStreakMilestoneAnnouncementText(event.contributorId, event),
    timestamp: Date.parse(`${event.dayKey}T00:00:00Z`),
    href: "/cards/streaks",
  }));
}

/** Turns every completed group challenge into a `NewsItem`. */
function groupChallengeNews(): NewsItem[] {
  return buildCompletedGroupChallengeEvents().map((event) => ({
    id: `group-challenge-complete-${event.challengeId}`,
    category: "community" as const,
    title: `"${event.title}" complete!`,
    body: buildChallengeCompletionAnnouncementText(event),
    timestamp: event.completedAt,
    href: "/cards/group-challenges",
  }));
}

/** Turns each day's top Revision Incentives earner into a `NewsItem`. */
function revisionIncentiveNews(): NewsItem[] {
  return buildDailyTopReviserAnnouncements().map((announcement) => ({
    id: `revision-incentives-${announcement.dayKey}`,
    category: "community" as const,
    title: `Revision Incentives — ${announcement.dayKey}`,
    body: buildTopReviserAnnouncementText(announcement.dayKey, announcement.topContributor),
    timestamp: Date.parse(`${announcement.dayKey}T00:00:00Z`),
    href: "/cards/revisions",
  }));
}

/**
 * Caps a source's persisted history to this feed's most recent
 * `MAX_COMMUNITY_ITEMS_PER_SOURCE` records before mapping to `NewsItem`s —
 * see the module doc comment above. `sortNewsFeed` re-sorts the whole feed
 * afterward, so which records survive the cap (not their order here) is
 * all that matters.
 */
const MAX_COMMUNITY_ITEMS_PER_SOURCE = 20;

function mostRecentBy<T>(items: T[], timestampOf: (item: T) => number, limit: number): T[] {
  return [...items].sort((a, b) => timestampOf(b) - timestampOf(a)).slice(0, limit);
}

/** Turns the most recent persisted Team Collaboration Mode sprint notes into `NewsItem`s — no derivation needed, a note is already the event. */
function sprintNoteNews(): NewsItem[] {
  return mostRecentBy(listSprintNotes(), (note) => note.createdAt, MAX_COMMUNITY_ITEMS_PER_SOURCE).map((note) => ({
    id: `sprint-note-${note.id}`,
    category: "community" as const,
    title: `${note.authorId} added a "${note.topic}" prep note`,
    body: buildSprintNoteAnnouncementText(note),
    timestamp: note.createdAt,
    href: "/cards/collaboration",
  }));
}

/**
 * Turns the most recent "live" (not held back by an in-progress peer
 * review) persisted Argument Library entries that carry a `createdAt` into
 * `NewsItem`s — no derivation needed, a submitted entry is already the
 * event. An entry persisted before `createdAt` existed has none and is
 * silently skipped rather than backdated to an arbitrary time; the recency
 * cap is applied after that filter, so it always keeps the
 * `MAX_COMMUNITY_ITEMS_PER_SOURCE` most recently *timestamped* entries.
 */
function argumentLibraryNews(): NewsItem[] {
  const live = listEvidenceLibraryEntries().filter(
    (entry): entry is EvidenceLibraryEntry & { createdAt: number } => entry.createdAt !== undefined && isEntryLive(entry.id),
  );
  return mostRecentBy(live, (entry) => entry.createdAt, MAX_COMMUNITY_ITEMS_PER_SOURCE).map((entry) => ({
    id: `argument-library-entry-${entry.id}`,
    category: "community" as const,
    title:
      entry.kind === "card"
        ? `New card added to the Argument Library: "${entry.argBlock}"`
        : `New analytic block added to the Argument Library: "${entry.argBlock}"`,
    body: buildEvidenceEntryAnnouncementText(entry),
    timestamp: entry.createdAt,
    href: "/cards/argument-library",
  }));
}

/**
 * Builds the full News Stream feed: hand-maintained product updates plus
 * every announced Daily Best Card winner, Contributor Awards standings,
 * quest-streak milestone crossing, completed group challenge, top daily
 * Revision Incentives earner, logged Team Collaboration Mode sprint note,
 * newly submitted Argument Library entry, and any caller-supplied
 * `extraItems` — newest first. Reads several other localStorage stores (via
 * the modules imported above) in addition to this module's own — safe to
 * call server-side or during SSR, since each underlying store already
 * guards its own `localStorage` access and returns an empty list when
 * unavailable.
 *
 * `extraItems` is this feed's composition point for a source that would
 * otherwise need a dependency this package can't take without a cycle —
 * `debate-round`'s coaching sessions are the first such source: that
 * package already depends on this one, so it produces its own `NewsItem[]`
 * (`state/coachingSessions.ts`'s `coachingSessionNews()`) and the app layer
 * (`apps/debate-ai.com/app/news/page.tsx`, which already depends on both
 * packages) passes it in here rather than this module reaching back into
 * `debate-round`.
 *
 * Also folds in `lib/news-stream.ts`'s `buildAutoFeatureNews()` — a
 * generic "Tool spotlight" post for every `APP_FEATURES` catalog entry
 * `PRODUCT_NEWS` doesn't already cover by `href` — so every tool has some
 * presence in the feed even before anyone hand-writes a real announcement
 * for it.
 */
export function buildNewsFeed(extraItems: NewsItem[] = []): NewsItem[] {
  return sortNewsFeed([
    ...PRODUCT_NEWS,
    ...buildAutoFeatureNews(),
    ...extraItems,
    ...dailyBestCardNews(),
    ...contributorAwardsNews(),
    ...questStreakMilestoneNews(),
    ...groupChallengeNews(),
    ...revisionIncentiveNews(),
    ...sprintNoteNews(),
    ...argumentLibraryNews(),
  ]);
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

/** The full list of item ids the viewer has read, for pushing to the account sync route (`lib/news-stream-sync.ts`'s `newsRead`). */
export function listReadIds(): string[] {
  return Object.keys(readViewerState().read);
}

/** The full list of item ids the viewer has liked, for pushing to the account sync route (`lib/news-stream-sync.ts`'s `newsLiked`). */
export function listLikedIds(): string[] {
  return Object.keys(readViewerState().liked);
}

/**
 * Merges a signed-in user's account-synced read/liked ids into this
 * browser's local viewer state — a one-time hydration step run on sign-in
 * (see `NewsStreamPanel`'s optional `syncRemote.hydrate`), not a
 * replacement: a union of local and remote ids, so an item already read or
 * liked in this browser stays that way even if the account row hasn't
 * caught up yet, and vice versa. Unliking on one device therefore doesn't
 * clear a like already merged onto another until that other device's own
 * next toggle pushes the new state — an accepted, documented limitation
 * (see `docs/features/news-stream.md`'s Known gaps), matching every other
 * best-effort sync in this repo.
 *
 * @returns Whether anything actually changed (so a caller can skip a
 *   redundant re-render/write when the merge was a no-op).
 */
export function mergeRemoteViewerState(remote: { read?: string[]; liked?: string[] }): boolean {
  const state = readViewerState();
  let changed = false;
  for (const id of remote.read ?? []) {
    if (!state.read[id]) {
      state.read[id] = true;
      changed = true;
    }
  }
  for (const id of remote.liked ?? []) {
    if (!state.liked[id]) {
      state.liked[id] = true;
      changed = true;
    }
  }
  if (changed) writeViewerState(state);
  return changed;
}
