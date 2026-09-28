/**
 * @fileoverview Pure XP-and-level logic for "Debater Levels" — a video-game
 * style progression where a debater earns experience points (XP) for real
 * practice work (cutting cards, redoing a rebuttal, delivering a speech,
 * finishing a drill or a practice round) and levels up as that XP adds up.
 *
 * Two XP sources stack:
 *
 * - **Activity XP** — every logged activity earns a small, flat amount
 *   (`ACTIVITY_XP`), so any practice moves the bar.
 * - **Challenge XP** — `DEBATER_CHALLENGES` are goals like "Cut 5 cards" or
 *   "Redo a rebuttal". Reaching a challenge's target pays its bonus once per
 *   UTC day (daily challenges) or once ever (milestones).
 *
 * The level curve is the classic RPG shape: each level costs a bit more
 * than the last (`xpToAdvance`), capped at `MAX_DEBATER_LEVEL`. Every
 * function here is pure — `state/debaterLevel.ts` persists the
 * `DebaterLevelState` and turns activity events into calls to
 * `applyDebaterActivity`.
 *
 * @module lib/debater-levels
 */

/** A kind of practice work that earns XP. */
export type DebaterActivityKind =
  | "card_cut"
  | "rebuttal_redo"
  | "speech_delivered"
  | "drill_practiced"
  | "practice_round"
  | "practice_win";

/** Every activity kind, in display order. */
export const DEBATER_ACTIVITY_KINDS: DebaterActivityKind[] = [
  "card_cut",
  "rebuttal_redo",
  "speech_delivered",
  "drill_practiced",
  "practice_round",
  "practice_win",
];

/** Human-readable labels, singular, for logs and buttons. */
export const DEBATER_ACTIVITY_LABELS: Record<DebaterActivityKind, string> = {
  card_cut: "Cut a card",
  rebuttal_redo: "Redid a rebuttal",
  speech_delivered: "Delivered a speech",
  drill_practiced: "Practiced a drill",
  practice_round: "Finished a practice round",
  practice_win: "Won a practice round",
};

/** Flat XP each single activity earns, before any challenge bonus. */
export const ACTIVITY_XP: Record<DebaterActivityKind, number> = {
  card_cut: 5,
  rebuttal_redo: 15,
  speech_delivered: 10,
  drill_practiced: 10,
  practice_round: 25,
  practice_win: 15,
};

/** Whether a challenge resets every UTC day or pays out once ever. */
export type DebaterChallengeRepeat = "daily" | "once";

/** A goal that pays a bonus when a debater's activity count reaches its target. */
export interface DebaterChallenge {
  id: string;
  title: string;
  description: string;
  activity: DebaterActivityKind;
  /** How many of `activity` complete the challenge (per day for `daily`, lifetime for `once`). */
  target: number;
  /** Bonus XP paid on completion. */
  xpReward: number;
  repeat: DebaterChallengeRepeat;
}

/** The built-in challenge board: daily quests first, then lifetime milestones. */
export const DEBATER_CHALLENGES: DebaterChallenge[] = [
  {
    id: "daily-cut-5-cards",
    title: "Cut 5 cards",
    description: "Cut and save five cards today.",
    activity: "card_cut",
    target: 5,
    xpReward: 100,
    repeat: "daily",
  },
  {
    id: "daily-redo-rebuttal",
    title: "Redo a rebuttal",
    description: "Re-deliver a rebuttal you've already given, tighter this time.",
    activity: "rebuttal_redo",
    target: 1,
    xpReward: 75,
    repeat: "daily",
  },
  {
    id: "daily-drills-3",
    title: "Practice 3 drills",
    description: "Mark three drills practiced today.",
    activity: "drill_practiced",
    target: 3,
    xpReward: 75,
    repeat: "daily",
  },
  {
    id: "daily-practice-round",
    title: "Finish a practice round",
    description: "Debate a full round against the AI today.",
    activity: "practice_round",
    target: 1,
    xpReward: 100,
    repeat: "daily",
  },
  {
    id: "milestone-first-card",
    title: "First card",
    description: "Cut your very first card.",
    activity: "card_cut",
    target: 1,
    xpReward: 25,
    repeat: "once",
  },
  {
    id: "milestone-cards-50",
    title: "Card cutter",
    description: "Cut 50 cards.",
    activity: "card_cut",
    target: 50,
    xpReward: 300,
    repeat: "once",
  },
  {
    id: "milestone-cards-250",
    title: "Evidence machine",
    description: "Cut 250 cards.",
    activity: "card_cut",
    target: 250,
    xpReward: 1000,
    repeat: "once",
  },
  {
    id: "milestone-rebuttals-10",
    title: "Second chances",
    description: "Redo 10 rebuttals.",
    activity: "rebuttal_redo",
    target: 10,
    xpReward: 300,
    repeat: "once",
  },
  {
    id: "milestone-speeches-25",
    title: "Podium regular",
    description: "Deliver 25 speeches.",
    activity: "speech_delivered",
    target: 25,
    xpReward: 300,
    repeat: "once",
  },
  {
    id: "milestone-first-win",
    title: "First win",
    description: "Win a practice round against the AI.",
    activity: "practice_win",
    target: 1,
    xpReward: 150,
    repeat: "once",
  },
  {
    id: "milestone-wins-10",
    title: "Winning record",
    description: "Win 10 practice rounds.",
    activity: "practice_win",
    target: 10,
    xpReward: 500,
    repeat: "once",
  },
];

/** The highest reachable level. */
export const MAX_DEBATER_LEVEL = 50;

/** XP needed to go from `level` to `level + 1`: 100 at level 1, then 50 more per level. */
export function xpToAdvance(level: number): number {
  return 100 + 50 * (Math.max(1, Math.floor(level)) - 1);
}

/** Total XP needed to *reach* `level` from zero (level 1 needs 0). */
export function totalXpForLevel(level: number): number {
  const target = Math.min(MAX_DEBATER_LEVEL, Math.max(1, Math.floor(level)));
  let total = 0;
  for (let l = 1; l < target; l += 1) total += xpToAdvance(l);
  return total;
}

/** A rank title a debater holds from `minLevel` upward. */
export interface DebaterRank {
  minLevel: number;
  title: string;
}

/** Rank titles, lowest to highest. */
export const DEBATER_RANKS: DebaterRank[] = [
  { minLevel: 1, title: "Novice" },
  { minLevel: 5, title: "JV Debater" },
  { minLevel: 10, title: "Varsity Debater" },
  { minLevel: 15, title: "Octofinalist" },
  { minLevel: 20, title: "Quarterfinalist" },
  { minLevel: 25, title: "Semifinalist" },
  { minLevel: 30, title: "Finalist" },
  { minLevel: 40, title: "Tournament Champion" },
  { minLevel: MAX_DEBATER_LEVEL, title: "TOC Legend" },
];

/** The rank title for a level. */
export function rankTitleForLevel(level: number): string {
  let title = DEBATER_RANKS[0].title;
  for (const rank of DEBATER_RANKS) if (level >= rank.minLevel) title = rank.title;
  return title;
}

/** Where a total XP amount lands on the level curve. */
export interface DebaterLevelProgress {
  level: number;
  title: string;
  totalXp: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP the current level takes to clear (0 at max level). */
  xpForNextLevel: number;
  /** 0–1 progress toward the next level (1 at max level). */
  fraction: number;
  isMaxLevel: boolean;
}

/** Resolve a total XP amount to a level, rank and progress bar. */
export function computeLevelProgress(totalXp: number): DebaterLevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let floor = 0;
  while (level < MAX_DEBATER_LEVEL && xp >= floor + xpToAdvance(level)) {
    floor += xpToAdvance(level);
    level += 1;
  }
  const isMaxLevel = level >= MAX_DEBATER_LEVEL;
  const xpForNextLevel = isMaxLevel ? 0 : xpToAdvance(level);
  const xpIntoLevel = xp - floor;
  return {
    level,
    title: rankTitleForLevel(level),
    totalXp: xp,
    xpIntoLevel,
    xpForNextLevel,
    fraction: isMaxLevel ? 1 : xpIntoLevel / xpForNextLevel,
    isMaxLevel,
  };
}

/** One entry in a debater's recent XP log. */
export interface DebaterXpEvent {
  atMs: number;
  /** An activity kind, or a challenge id for a challenge bonus. */
  source: string;
  label: string;
  xp: number;
}

/** Maximum log entries kept in `DebaterLevelState.recentXp`. */
export const MAX_RECENT_XP_EVENTS = 30;

/** A debater's persisted progression. */
export interface DebaterLevelState {
  totalXp: number;
  /** Lifetime count per activity. */
  lifetimeCounts: Partial<Record<DebaterActivityKind, number>>;
  /** Today's counts; reset when `dayKey` is no longer today. */
  daily: { dayKey: string; counts: Partial<Record<DebaterActivityKind, number>>; completedChallengeIds: string[] };
  /** Ids of `once` challenges already paid out. */
  completedMilestoneIds: string[];
  /** Newest first. */
  recentXp: DebaterXpEvent[];
}

/** The UTC calendar day, "YYYY-MM-DD", an epoch-ms timestamp falls on. */
export function utcDayKeyFor(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** A fresh, zero-XP state. */
export function createDebaterLevelState(dayKey = ""): DebaterLevelState {
  return {
    totalXp: 0,
    lifetimeCounts: {},
    daily: { dayKey, counts: {}, completedChallengeIds: [] },
    completedMilestoneIds: [],
    recentXp: [],
  };
}

/** Roll `daily` over to `dayKey` if it's from an earlier day. Returns the same object when nothing changes. */
export function rollDebaterDay(state: DebaterLevelState, dayKey: string): DebaterLevelState {
  if (state.daily.dayKey === dayKey) return state;
  return { ...state, daily: { dayKey, counts: {}, completedChallengeIds: [] } };
}

/** What one `applyDebaterActivity` call earned. */
export interface DebaterActivityResult {
  state: DebaterLevelState;
  xpGained: number;
  completedChallenges: DebaterChallenge[];
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Record `count` of an activity at `nowMs`: add flat activity XP, pay any
 * challenge whose target this pushes it to, and report whether the debater
 * leveled up. Never mutates `state`.
 */
export function applyDebaterActivity(
  state: DebaterLevelState,
  kind: DebaterActivityKind,
  nowMs: number,
  count = 1,
  challenges: DebaterChallenge[] = DEBATER_CHALLENGES,
): DebaterActivityResult {
  const previousLevel = computeLevelProgress(state.totalXp).level;
  const n = Math.max(0, Math.floor(count));
  const rolled = rollDebaterDay(state, utcDayKeyFor(nowMs));
  if (n === 0) {
    return { state: rolled, xpGained: 0, completedChallenges: [], previousLevel, newLevel: previousLevel, leveledUp: false };
  }

  const lifetime = (rolled.lifetimeCounts[kind] ?? 0) + n;
  const today = (rolled.daily.counts[kind] ?? 0) + n;
  const events: DebaterXpEvent[] = [];
  const activityXp = ACTIVITY_XP[kind] * n;
  events.push({ atMs: nowMs, source: kind, label: n > 1 ? `${DEBATER_ACTIVITY_LABELS[kind]} ×${n}` : DEBATER_ACTIVITY_LABELS[kind], xp: activityXp });

  const dailyDone = new Set(rolled.daily.completedChallengeIds);
  const milestonesDone = new Set(rolled.completedMilestoneIds);
  const completedChallenges: DebaterChallenge[] = [];
  for (const challenge of challenges) {
    if (challenge.activity !== kind) continue;
    if (challenge.repeat === "daily") {
      if (dailyDone.has(challenge.id) || today < challenge.target) continue;
      dailyDone.add(challenge.id);
    } else {
      if (milestonesDone.has(challenge.id) || lifetime < challenge.target) continue;
      milestonesDone.add(challenge.id);
    }
    completedChallenges.push(challenge);
    events.push({ atMs: nowMs, source: challenge.id, label: `Challenge: ${challenge.title}`, xp: challenge.xpReward });
  }

  const xpGained = events.reduce((sum, event) => sum + event.xp, 0);
  const totalXp = rolled.totalXp + xpGained;
  const newLevel = computeLevelProgress(totalXp).level;
  const next: DebaterLevelState = {
    totalXp,
    lifetimeCounts: { ...rolled.lifetimeCounts, [kind]: lifetime },
    daily: {
      dayKey: rolled.daily.dayKey,
      counts: { ...rolled.daily.counts, [kind]: today },
      completedChallengeIds: Array.from(dailyDone),
    },
    completedMilestoneIds: Array.from(milestonesDone),
    recentXp: [...events.reverse(), ...rolled.recentXp].slice(0, MAX_RECENT_XP_EVENTS),
  };
  return { state: next, xpGained, completedChallenges, previousLevel, newLevel, leveledUp: newLevel > previousLevel };
}

/** A challenge with the debater's current progress toward it. */
export interface DebaterChallengeProgress {
  challenge: DebaterChallenge;
  current: number;
  isComplete: boolean;
}

/** Progress on every challenge as of `dayKey` (daily counts from an earlier day read as zero). */
export function getChallengeProgress(
  state: DebaterLevelState,
  dayKey: string,
  challenges: DebaterChallenge[] = DEBATER_CHALLENGES,
): DebaterChallengeProgress[] {
  const rolled = rollDebaterDay(state, dayKey);
  return challenges.map((challenge) => {
    if (challenge.repeat === "daily") {
      const isComplete = rolled.daily.completedChallengeIds.includes(challenge.id);
      const count = rolled.daily.counts[challenge.activity] ?? 0;
      return { challenge, current: Math.min(challenge.target, count), isComplete };
    }
    const isComplete = rolled.completedMilestoneIds.includes(challenge.id);
    const count = rolled.lifetimeCounts[challenge.activity] ?? 0;
    return { challenge, current: Math.min(challenge.target, count), isComplete };
  });
}

function isCountRecord(value: unknown): value is Partial<Record<DebaterActivityKind, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, count]) => (DEBATER_ACTIVITY_KINDS as string[]).includes(key) && typeof count === "number" && count >= 0,
  );
}

/** Parse persisted JSON back into a state, or `null` if it's malformed. */
export function parseDebaterLevelState(raw: unknown): DebaterLevelState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const daily = value.daily as Record<string, unknown> | undefined;
  if (
    typeof value.totalXp !== "number" ||
    value.totalXp < 0 ||
    !isCountRecord(value.lifetimeCounts) ||
    !daily ||
    typeof daily.dayKey !== "string" ||
    !isCountRecord(daily.counts) ||
    !Array.isArray(daily.completedChallengeIds) ||
    !Array.isArray(value.completedMilestoneIds) ||
    !Array.isArray(value.recentXp)
  ) {
    return null;
  }
  return {
    totalXp: value.totalXp,
    lifetimeCounts: value.lifetimeCounts,
    daily: {
      dayKey: daily.dayKey,
      counts: daily.counts,
      completedChallengeIds: daily.completedChallengeIds.filter((id): id is string => typeof id === "string"),
    },
    completedMilestoneIds: value.completedMilestoneIds.filter((id): id is string => typeof id === "string"),
    recentXp: value.recentXp
      .filter(
        (event): event is DebaterXpEvent =>
          !!event &&
          typeof event === "object" &&
          typeof (event as DebaterXpEvent).atMs === "number" &&
          typeof (event as DebaterXpEvent).source === "string" &&
          typeof (event as DebaterXpEvent).label === "string" &&
          typeof (event as DebaterXpEvent).xp === "number",
      )
      .slice(0, MAX_RECENT_XP_EVENTS),
  };
}

/** Whether a value names a known activity kind. */
export function isDebaterActivityKind(value: unknown): value is DebaterActivityKind {
  return typeof value === "string" && (DEBATER_ACTIVITY_KINDS as string[]).includes(value);
}
