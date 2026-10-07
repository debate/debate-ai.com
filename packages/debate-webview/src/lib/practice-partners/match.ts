/**
 * @fileoverview How well a volunteer on the practice board suits the viewer.
 *
 * "Find me a match" draws from the most compatible debaters open to
 * challenges ({@link pickPracticeMatch}), so the partner a debater is offered
 * debates the formats they debate, at a speed and in styles they said they
 * are comfortable with. The board of volunteers is no longer public — the
 * match is anonymous until the other debater accepts.
 *
 * An empty list on either side means "any" rather than "none" — a debater who
 * ticked no formats has not said they debate nothing — so it scores as a
 * partial match instead of zero.
 *
 * @module lib/practice-partners/match
 */

import {
  PRACTICE_LEVELS,
  PRACTICE_SPEEDS,
  type PracticeFormat,
  type PracticePreferences,
  type PracticeStyle,
  type PracticeVolunteer,
} from "./types";

export interface PracticeMatch {
  /** 0–100. */
  score: number;
  /** "Great match" / "Good match", or `null` below both bars. */
  label: string | null;
  sharedFormats: PracticeFormat[];
  sharedStyles: PracticeStyle[];
}

const GREAT = 70;
const GOOD = 45;

function rank(options: readonly { id: string }[], id: string): number {
  return options.findIndex((option) => option.id === id);
}

function overlap<T>(a: readonly T[], b: readonly T[]): T[] {
  return a.filter((item) => b.includes(item));
}

/**
 * Scores one volunteer against the viewer's preferences.
 *
 * Formats weigh most (40): two debaters who share no format cannot run a round.
 * Styles (30) scale with how much of the smaller list is shared. Speed (20) and
 * level (10) score full for the same step and half for a neighbouring one.
 */
export function practiceMatch(viewer: PracticePreferences | null, other: PracticePreferences): PracticeMatch {
  if (!viewer) {
    return { score: 0, label: null, sharedFormats: [], sharedStyles: [] };
  }

  const sharedFormats = overlap(viewer.formats, other.formats);
  const sharedStyles = overlap(viewer.styles, other.styles);

  const formatScore =
    viewer.formats.length === 0 || other.formats.length === 0 ? 20 : sharedFormats.length > 0 ? 40 : 0;

  const smallerStyles = Math.min(viewer.styles.length, other.styles.length);
  const styleScore = smallerStyles === 0 ? 15 : Math.round((30 * sharedStyles.length) / smallerStyles);

  const speedGap = Math.abs(rank(PRACTICE_SPEEDS, viewer.speed) - rank(PRACTICE_SPEEDS, other.speed));
  const speedScore = speedGap === 0 ? 20 : speedGap === 1 ? 10 : 0;

  const levelGap = Math.abs(rank(PRACTICE_LEVELS, viewer.level) - rank(PRACTICE_LEVELS, other.level));
  const levelScore = levelGap === 0 ? 10 : levelGap === 1 ? 5 : 0;

  const score = formatScore + styleScore + speedScore + levelScore;
  const label = score >= GREAT ? "Great match" : score >= GOOD ? "Good match" : null;
  return { score, label, sharedFormats, sharedStyles };
}

/**
 * The board order: best match first, then most recently updated — a profile
 * someone touched yesterday is likelier to get an answer than one from March.
 */
export function rankVolunteers(
  viewer: PracticePreferences | null,
  volunteers: readonly PracticeVolunteer[],
): { volunteer: PracticeVolunteer; match: PracticeMatch }[] {
  return volunteers
    .map((volunteer) => ({ volunteer, match: practiceMatch(viewer, volunteer) }))
    .sort((a, b) => b.match.score - a.match.score || b.volunteer.updatedAt - a.volunteer.updatedAt);
}

/** How many of the best-scoring candidates a random match is drawn from. */
export const MATCH_POOL_SIZE = 5;

/**
 * Picks one partner for the viewer: scores every candidate, keeps the
 * {@link MATCH_POOL_SIZE} most compatible, and draws one of them at random,
 * weighted by score — so pressing the button again can land on someone else
 * without ever drifting to a poor fit while good ones are open. `null` when
 * there is nobody to pick.
 */
export function pickPracticeMatch<T extends PracticePreferences>(
  viewer: PracticePreferences | null,
  candidates: readonly T[],
  random: () => number = Math.random,
): { candidate: T; match: PracticeMatch } | null {
  const pool = candidates
    .map((candidate) => ({ candidate, match: practiceMatch(viewer, candidate) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, MATCH_POOL_SIZE);
  if (pool.length === 0) return null;

  // +1 keeps a zero-score candidate drawable when nobody scores higher.
  const weights = pool.map((entry) => entry.match.score + 1);
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}
