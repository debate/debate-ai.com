/**
 * @fileoverview Account-synced quest-competition team roster — the
 * "account-syncing team rosters across devices" follow-up named under the
 * "🎯 Daily Quests and Targets" bullet (Research Crowdsourcing Organizer
 * Features) in TODO.md. `state/dailyQuests.ts`'s `listQuestTeams`/
 * `saveQuestTeam`/`deleteQuestTeam` already persist a `QuestTeam[]` roster in
 * localStorage; this module adds the pure validation/serialization half
 * needed to also sync a signed-in visitor's own copy of that roster onto
 * their `user_settings` row, mirroring `debate-round`'s
 * `state/outlineFilterPresets.ts`'s "replace the full list in one PUT" shape
 * (shared by the `/api/settings` D1-backed route in `apps/debate-ai.com` and
 * `hooks/useQuestTeamsSync.ts`).
 *
 * Unlike `quest-streak-sync.ts`'s per-contributor preferences, a team roster
 * isn't scoped to one contributor id — it's the whole competition's team
 * list — so this mirrors the simpler "remote overwrites local on load, every
 * local mutation pushes the full list back" convention instead of an
 * additive merge.
 *
 * @module lib/quest-teams-sync
 */

import type { QuestTeam } from "./daily-quests";

export type QuestTeamsSyncPayload = {
  questTeams: QuestTeam[];
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_QUEST_TEAMS_SYNC: QuestTeamsSyncPayload = {
  questTeams: [],
};

/** Generous but bounded, so a buggy or malicious client can't grow the row without limit. */
export const MAX_QUEST_TEAMS = 50;
const MAX_TEAM_NAME_LENGTH = 60;
export const MAX_QUEST_TEAM_CONTRIBUTOR_IDS = 50;
const MAX_CONTRIBUTOR_ID_LENGTH = 100;

function isValidTeamName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= MAX_TEAM_NAME_LENGTH;
}

/** A team with no members is a valid (if pointless) roster entry — `buildTeamQuestCompetitionStandings` already scores one 0/0 — so only the upper bound is enforced here. */
function isValidContributorIdsList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_QUEST_TEAM_CONTRIBUTOR_IDS &&
    value.every((id) => typeof id === "string" && id.trim().length > 0 && id.length <= MAX_CONTRIBUTOR_ID_LENGTH)
  );
}

const ALLOWED_QUEST_TEAM_KEYS = new Set(["id", "name", "contributorIds"]);

function isValidQuestTeam(value: unknown): value is QuestTeam {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const team = value as Record<string, unknown>;
  if (!Object.keys(team).every((key) => ALLOWED_QUEST_TEAM_KEYS.has(key))) return false;
  if (typeof team.id !== "string" || team.id.trim().length === 0) return false;
  if (!isValidTeamName(team.name)) return false;
  if (!isValidContributorIdsList(team.contributorIds)) return false;
  return true;
}

export function isValidQuestTeamsList(value: unknown): value is QuestTeam[] {
  if (!Array.isArray(value) || value.length > MAX_QUEST_TEAMS) return false;
  if (!value.every(isValidQuestTeam)) return false;
  const ids = value.map((team) => (team as QuestTeam).id);
  return new Set(ids).size === ids.length;
}

export type QuestTeamsSyncPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<QuestTeamsSyncPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: the whole
 * `questTeams` array is accepted or rejected as one field, mirroring
 * `normalizeOutlineFilterPresetsPatch`'s "replace the full list in one PUT"
 * shape.
 */
export function normalizeQuestTeamsPatch(input: unknown): QuestTeamsSyncPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<QuestTeamsSyncPayload> = {};
  const errors: string[] = [];

  if ("questTeams" in record) {
    if (isValidQuestTeamsList(record.questTeams)) {
      valid.questTeams = record.questTeams;
    } else {
      errors.push(
        `"questTeams" must be an array of up to ${MAX_QUEST_TEAMS} entries, each a { id, name, contributorIds } object with a non-empty id, a non-empty name (max ${MAX_TEAM_NAME_LENGTH} characters), and up to ${MAX_QUEST_TEAM_CONTRIBUTOR_IDS} non-empty contributor ids, with no two entries sharing an id.`,
      );
    }
  }

  return { valid, errors };
}

/** Serializes a roster for the `quest_teams` D1 column: `null` when empty, matching every other nullable column here. */
export function serializeQuestTeams(list: QuestTeam[]): string | null {
  return list.length === 0 ? null : JSON.stringify(list);
}

/** Parses the `quest_teams` D1 column back into a roster. Never throws — a null, malformed, or invalid-shape value reads back as an empty list rather than erroring the request. */
export function parseQuestTeams(raw: string | null | undefined): QuestTeam[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return isValidQuestTeamsList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
