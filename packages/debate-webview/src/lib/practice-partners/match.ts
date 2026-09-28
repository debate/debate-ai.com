/**
 * @fileoverview How well a volunteer on the practice board suits the viewer.
 *
 * The board is sorted by this and each card carries its label, so the first
 * people a debater sees are the ones who debate the formats they debate, at a
 * speed and in styles they said they are comfortable with. It is a ranking
 * aid, not a gate: anyone open to challenges can be challenged whatever their
 * score, because "I want to practise against spreading" is a perfectly good
 * reason to pick a mismatch.
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
