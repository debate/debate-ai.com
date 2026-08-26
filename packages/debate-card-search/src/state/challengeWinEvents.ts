/**
 * @fileoverview Persistent storage for `group-challenges.ts`'s
 * `ChallengeWinEvent` records — the "persisted challenge win events" half of
 * the "(b-continued)" follow-up named under idea #13 ("Coaching Programs and
 * Group Challenges") in TODO.md: "a dashboard view that renders each
 * program's full `buildCoachingProgramBoard` (still needs persisted
 * challenge win events and topic-sprint contributions in a form the board
 * could read live... none of which exist yet)". Stores win events in
 * localStorage, mirroring the existing `groupChallenges.ts`/`contributions.ts`
 * persistence convention (SSR/no-storage-safe, corrupt or missing JSON
 * degrades to an empty list rather than throwing).
 *
 * A `ChallengeWinEvent` isn't itself scoped to one challenge —
 * `group-challenges.ts`'s `computeGroupChallengeProgress` matches any
 * `win_target` challenge whose roster and window contain the event, the same
 * way `buildContributionStandings` matches a `contribution_target` challenge
 * against the shared contribution feed rather than a per-challenge one — so
 * this store persists one flat, squad-wide event list rather than keying
 * events by challenge id.
 *
 * `buildPersistedGroupChallengeBoard` closes the rest of that follow-up: it
 * composes the persisted challenge roster (`state/groupChallenges.ts`), the
 * real, persisted contribution feed (`state/contributions.ts`, reusing
 * `dailyQuests.ts`'s `hasSubmittedAt` guard convention), and this store's
 * persisted win events into a live `GroupChallengeProgress[]` board, so a
 * panel no longer needs a caller-supplied contribution/win-event list to
 * show real standings.
 *
 * @module state/challengeWinEvents
 */

import type { AttributedContribution } from "../lib/contribution-leaderboard";
import type { ChallengeWinEvent, GroupChallengeProgress } from "../lib/group-challenges";
import { buildGroupChallengeBoard, computeChallengeCompletionTimestamp, computeGroupChallengeProgress } from "../lib/group-challenges";
import type { QuestContribution } from "../lib/daily-quests";
import { listContributions } from "./contributions";
import { listGroupChallenges } from "./groupChallenges";

const STORAGE_KEY = "challengeWinEvents";

function readAll(): ChallengeWinEvent[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChallengeWinEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(events: ChallengeWinEvent[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

/** Lists every persisted challenge win event. */
export function listChallengeWinEvents(): ChallengeWinEvent[] {
  return readAll();
}

/** Records a squad member's win, appending it to the persisted event list. */
export function recordChallengeWinEvent(contributorId: string, occurredAt: number): ChallengeWinEvent {
  const event: ChallengeWinEvent = { contributorId, occurredAt };
  writeAll([...readAll(), event]);
  return event;
}

/** Whether a persisted contribution carries the `submittedAt` timestamp `daily-quests.ts` needs to match it against a challenge window. */
function hasSubmittedAt(
  contribution: AttributedContribution,
): contribution is AttributedContribution & { submittedAt: number } {
  return typeof (contribution as { submittedAt?: unknown }).submittedAt === "number";
}

/**
 * Builds every persisted group challenge's live progress directly from the
 * persisted challenge roster, the real, persisted contribution feed, and
 * this store's persisted win events — rather than requiring the caller to
 * hold and pass in all three themselves. Contributions without a
 * `submittedAt` timestamp are excluded rather than throwing, mirroring
 * `dailyQuests.ts`'s `buildPersistedDailyQuestBoard`. An empty challenge
 * roster returns an empty board rather than throwing.
 */
export function buildPersistedGroupChallengeBoard(now: number): GroupChallengeProgress[] {
  const challenges = listGroupChallenges();
  const contributions = listContributions().filter(hasSubmittedAt) as QuestContribution[];
  const winEvents = readAll();
  return buildGroupChallengeBoard(challenges, contributions, winEvents, now);
}

/** One persisted group challenge that has reached its goal, with the timestamp it did. */
export interface CompletedGroupChallengeEvent {
  challengeId: string;
  title: string;
  completedAt: number;
  completedCount: number;
  targetCount: number;
  mvpContributorId?: string;
}

/**
 * Finds every persisted group challenge that has reached its goal, each with
 * the timestamp its `targetCount`-th matching contribution or win event
 * landed — the "group challenge results" News Stream category noted as
 * unwired in `news-stream.md`'s Known gaps. Purely derived from the same
 * persisted roster/contributions/win events `buildPersistedGroupChallengeBoard`
 * already reads, via `group-challenges.ts`'s `computeChallengeCompletionTimestamp`
 * — no separate "completion" store needed, since replaying the same inputs
 * always yields the same completion instant. A challenge whose goal hasn't
 * been reached yet is excluded. Sorted newest completion first, tie-broken
 * by `challengeId` for a stable, deterministic order.
 */
export function buildCompletedGroupChallengeEvents(): CompletedGroupChallengeEvent[] {
  const challenges = listGroupChallenges();
  const contributions = listContributions().filter(hasSubmittedAt) as QuestContribution[];
  const winEvents = readAll();

  const events: CompletedGroupChallengeEvent[] = [];
  for (const challenge of challenges) {
    const completedAt = computeChallengeCompletionTimestamp(challenge, contributions, winEvents);
    if (completedAt === null) continue;
    const progress = computeGroupChallengeProgress(challenge, contributions, winEvents, completedAt);
    events.push({
      challengeId: challenge.id,
      title: challenge.title,
      completedAt,
      completedCount: progress.completedCount,
      targetCount: progress.targetCount,
      mvpContributorId: progress.mvpContributorId,
    });
  }

  return events.sort((a, b) => b.completedAt - a.completedAt || a.challengeId.localeCompare(b.challengeId));
}
