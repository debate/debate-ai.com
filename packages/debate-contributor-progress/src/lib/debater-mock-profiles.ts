/**
 * @fileoverview Sample debater profiles for previewing the Debater Level page
 * with realistic progress — the panel's **Mock data** button. Each profile is
 * a novice, mid-season or varsity debater with some challenges and milestones
 * fully earned and others partway there, plus a few judge awards.
 *
 * States are built by replaying activity through `applyDebaterActivity`, so
 * XP, levels, completed challenges and the recent-XP log stay consistent
 * with the real rules. Nothing here touches storage: the panel shows a mock
 * profile in place of the debater's own progress and never saves it.
 *
 * @module lib/debater-mock-profiles
 */

import {
  applyDebaterActivity,
  createDebaterLevelState,
  type DebaterActivityKind,
  type DebaterLevelState,
} from "./debater-levels";
import type { JudgeAward, JudgeAwardKind } from "./judge-awards";

/** A sample debater: who they are, their XP state and the judge awards they hold. */
export interface DebaterMockProfile {
  id: string;
  name: string;
  /** One line on where this debater is in their season. */
  summary: string;
  state: DebaterLevelState;
  judgeAwards: JudgeAward[];
}

type Counts = Partial<Record<DebaterActivityKind, number>>;

interface MockProfileSeed {
  id: string;
  name: string;
  summary: string;
  /** Activity done before today, spread over the past weeks. */
  history: Counts;
  /** Activity done today, which drives the daily challenges. */
  today: Counts;
  awards: { kind: JudgeAwardKind; judgeName: string; tournament: string; daysAgo: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 28;

const MOCK_PROFILE_SEEDS: MockProfileSeed[] = [
  {
    id: "mock-novice",
    name: "Maya Chen",
    summary: "Novice, first month on the team",
    history: { card_cut: 9, speech_delivered: 6, drill_practiced: 4, practice_round: 2 },
    today: { card_cut: 3, drill_practiced: 1 },
    awards: [{ kind: "most_improved", judgeName: "Dana Ortiz", tournament: "Fall Novice Classic", daysAgo: 9 }],
  },
  {
    id: "mock-jv",
    name: "Jordan Ellis",
    summary: "JV, mid-season",
    history: {
      card_cut: 59,
      rebuttal_redo: 6,
      speech_delivered: 25,
      drill_practiced: 28,
      practice_round: 12,
      practice_win: 4,
    },
    today: { card_cut: 5, rebuttal_redo: 1, drill_practiced: 2 },
    awards: [
      { kind: "most_improved", judgeName: "Sam Whitaker", tournament: "Glenbrooks", daysAgo: 20 },
      { kind: "best_research", judgeName: "Priya Raman", tournament: "Blake Invitational", daysAgo: 6 },
    ],
  },
  {
    id: "mock-varsity",
    name: "Avery Brooks",
    summary: "Varsity, chasing a TOC bid",
    history: {
      card_cut: 268,
      rebuttal_redo: 16,
      speech_delivered: 60,
      drill_practiced: 80,
      practice_round: 45,
      practice_win: 22,
    },
    today: { card_cut: 7, rebuttal_redo: 2, drill_practiced: 2 },
    awards: [
      { kind: "best_speaker", judgeName: "Dana Ortiz", tournament: "Greenhill", daysAgo: 25 },
      { kind: "best_impact_calculus", judgeName: "Marcus Lee", tournament: "Greenhill", daysAgo: 25 },
      { kind: "best_critique_debater", judgeName: "Sam Whitaker", tournament: "Glenbrooks", daysAgo: 20 },
      { kind: "best_research", judgeName: "Priya Raman", tournament: "Harvard", daysAgo: 3 },
    ],
  },
];

/** Replay `counts` as one activity batch per kind per day, oldest first. */
function replay(state: DebaterLevelState, counts: Counts, startMs: number, days: number): DebaterLevelState {
  let next = state;
  for (let day = 0; day < days; day += 1) {
    for (const [kind, total] of Object.entries(counts) as [DebaterActivityKind, number][]) {
      // Spread `total` evenly over `days`, giving the remainder to the earliest days.
      const n = Math.floor(total / days) + (day < total % days ? 1 : 0);
      if (n > 0) next = applyDebaterActivity(next, kind, startMs + day * DAY_MS, n).state;
    }
  }
  return next;
}

function buildMockProfile(seed: MockProfileSeed, nowMs: number): DebaterMockProfile {
  // Start of today (UTC) plus a few hours, so "today" activity lands on today's day key.
  const todayMs = Math.floor(nowMs / DAY_MS) * DAY_MS + Math.min(nowMs % DAY_MS, 9 * 60 * 60 * 1000);
  const historyStart = todayMs - HISTORY_DAYS * DAY_MS;
  let state = replay(createDebaterLevelState(), seed.history, historyStart, HISTORY_DAYS);
  state = replay(state, seed.today, todayMs, 1);
  const judgeAwards = seed.awards.map((award, index) => ({
    id: `${seed.id}-award-${index}`,
    kind: award.kind,
    debaterId: seed.id,
    judgeName: award.judgeName,
    tournament: award.tournament,
    awardedAt: todayMs - award.daysAgo * DAY_MS,
  }));
  return { id: seed.id, name: seed.name, summary: seed.summary, state, judgeAwards };
}

/** Every sample profile, novice to varsity, with today's activity dated to `nowMs`'s UTC day. */
export function buildDebaterMockProfiles(nowMs: number = Date.now()): DebaterMockProfile[] {
  return MOCK_PROFILE_SEEDS.map((seed) => buildMockProfile(seed, nowMs));
}
