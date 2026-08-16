/**
 * @fileoverview Persistent storage for `OpponentTeamProfile` records,
 * keyed by `teamId` — the "(c) persisting/looking up profiles by team
 * across tournaments" follow-up named in the "Opponent Team Profiles"
 * slice (`rankings/opponent-team-profile.ts`) in TODO.md's Research
 * Crowdsourcing Organizer Features list. Stores profiles in localStorage,
 * mirroring `debate-speech-writer`'s `coachMaterials.ts` persistence
 * convention.
 *
 * @module state/opponentTeamProfiles
 */

import type { OpponentTeamProfile } from "../rankings/opponent-team-profile";

const STORAGE_KEY = "opponentTeamProfiles";

function readAll(): OpponentTeamProfile[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OpponentTeamProfile[]) : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: OpponentTeamProfile[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

/** Lists every persisted opponent team profile. */
export function listOpponentTeamProfiles(): OpponentTeamProfile[] {
  return readAll();
}

/** Looks up a single persisted opponent team profile by `teamId`, if any. */
export function getOpponentTeamProfile(teamId: string): OpponentTeamProfile | undefined {
  return readAll().find((profile) => profile.teamId === teamId);
}

/** Saves an opponent team profile, overwriting any existing record with the same `teamId`. */
export function saveOpponentTeamProfile(profile: OpponentTeamProfile): void {
  const profiles = readAll();
  const index = profiles.findIndex((existing) => existing.teamId === profile.teamId);
  if (index === -1) {
    profiles.push(profile);
  } else {
    profiles[index] = profile;
  }
  writeAll(profiles);
}

/** Deletes a persisted opponent team profile by `teamId`; a no-op if it isn't stored. */
export function deleteOpponentTeamProfile(teamId: string): void {
  writeAll(readAll().filter((profile) => profile.teamId !== teamId));
}
