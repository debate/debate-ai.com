/**
 * @fileoverview Persistent storage for `JudgeProfile` records, keyed by
 * `judgeId` — the "(c) persisting/looking up profiles by judge across
 * tournaments" follow-up named in the "Judge Profiles" slice
 * (`judge/judge-profile.ts`) in TODO.md's Research Crowdsourcing Organizer
 * Features list. Stores profiles in localStorage, mirroring
 * `debate-data-sync`'s `opponentTeamProfiles.ts`/this package's
 * `coachMaterials.ts` persistence convention. Also exposes
 * `buildJudgeProfilesRoster`, the ready-to-render ordering used by
 * `panels/JudgeProfilesPanel.tsx` — follow-up (b), "a judge-profile
 * card/panel UI," under the same TODO.md bullet.
 *
 * @module state/judgeProfiles
 */

import type { JudgeProfile } from "../judge/judge-profile";

const STORAGE_KEY = "judgeProfiles";

function readAll(): JudgeProfile[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JudgeProfile[]) : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: JudgeProfile[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

/** Lists every persisted judge profile. */
export function listJudgeProfiles(): JudgeProfile[] {
  return readAll();
}

/** Looks up a single persisted judge profile by `judgeId`, if any. */
export function getJudgeProfile(judgeId: string): JudgeProfile | undefined {
  return readAll().find((profile) => profile.judgeId === judgeId);
}

/** Saves a judge profile, overwriting any existing record with the same `judgeId`. */
export function saveJudgeProfile(profile: JudgeProfile): void {
  const profiles = readAll();
  const index = profiles.findIndex((existing) => existing.judgeId === profile.judgeId);
  if (index === -1) {
    profiles.push(profile);
  } else {
    profiles[index] = profile;
  }
  writeAll(profiles);
}

/** Deletes a persisted judge profile by `judgeId`; a no-op if it isn't stored. */
export function deleteJudgeProfile(judgeId: string): void {
  writeAll(readAll().filter((profile) => profile.judgeId !== judgeId));
}

/**
 * Lists every persisted judge profile ordered by rounds judged descending
 * (most experienced first, ties broken alphabetically by `judgeId`) — the
 * ready-to-render order for a judge-profile roster panel.
 */
export function buildJudgeProfilesRoster(): JudgeProfile[] {
  return [...readAll()].sort((a, b) => {
    if (b.roundsJudged !== a.roundsJudged) return b.roundsJudged - a.roundsJudged;
    return a.judgeId.localeCompare(b.judgeId);
  });
}
