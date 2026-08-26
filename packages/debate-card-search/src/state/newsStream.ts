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
 * session — stays open: it lives in `debate-round`, which already depends
 * on this package, so sourcing a news item from it here would need the
 * reverse dependency, a cycle this package can't take on.
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

/** Turns every persisted Team Collaboration Mode sprint note into a `NewsItem` — no derivation needed, a note is already the event. */
function sprintNoteNews(): NewsItem[] {
  return listSprintNotes().map((note) => ({
    id: `sprint-note-${note.id}`,
    category: "community" as const,
    title: `${note.authorId} added a "${note.topic}" prep note`,
    body: buildSprintNoteAnnouncementText(note),
    timestamp: note.createdAt,
    href: "/cards/collaboration",
  }));
}

/**
 * Turns every "live" (not held back by an in-progress peer review) persisted
 * Argument Library entry that carries a `createdAt` into a `NewsItem` — no
 * derivation needed, a submitted entry is already the event. An entry
 * persisted before `createdAt` existed has none and is silently skipped
 * rather than backdated to an arbitrary time.
 */
function argumentLibraryNews(): NewsItem[] {
  return listEvidenceLibraryEntries()
    .filter((entry): entry is EvidenceLibraryEntry & { createdAt: number } => entry.createdAt !== undefined && isEntryLive(entry.id))
    .map((entry) => ({
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
 * and newly submitted Argument Library entry — newest first. Reads several
 * other localStorage stores (via the modules imported above) in addition to
 * this module's own — safe to call server-side or during SSR, since each
 * underlying store already guards its own `localStorage` access and returns
 * an empty list when unavailable.
 */
export function buildNewsFeed(): NewsItem[] {
  return sortNewsFeed([
    ...PRODUCT_NEWS,
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
