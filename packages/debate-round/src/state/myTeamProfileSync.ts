/**
 * @fileoverview Account-synced "My Team" quick-fill profile — TODO.md idea
 * #17 ("User Settings — account-linked debate preferences")'s "create user
 * settings and link user db... save flows, docs, and debates" follow-up.
 * `state/myTeamProfile.ts` already persists a visitor's school/email1/email2
 * for the Create Round dialog's My Team checkbox (`dialogs/CreateRoundDialog/
 * TeamSection.tsx`), but only in `localStorage` — it explicitly documents
 * itself as not following a signed-in user across devices. This module adds
 * the pure validation/serialization half needed to also sync that profile
 * onto the account's `user_settings` row, mirroring
 * `research-progress-goal-sync.ts`'s split exactly (shared by the
 * `/api/settings` D1-backed route in `apps/debate-ai.com` and
 * `TeamSection.tsx` itself).
 *
 * Unlike `favoriteTools`/`wordLimitPresets`, this is a single nullable value
 * rather than a named list — a visitor has at most one "My Team" profile at a
 * time — so it's a whole-value replace on every profile save, like
 * `researchProgressGoal`/`brainstormSessionTimer`, rather than op-based: one
 * person edits their own profile at a time, so the two-tabs-race the
 * op-based fields exist for doesn't apply here.
 *
 * @module state/myTeamProfileSync
 */

import type { MyTeamProfile } from "./myTeamProfile";

export type MyTeamProfileSyncPayload = MyTeamProfile;

export type MyTeamProfilePatch = {
  /** `null` clears the synced profile; an object replaces it. */
  myTeamProfile: MyTeamProfileSyncPayload | null;
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_MY_TEAM_PROFILE_SYNC: MyTeamProfilePatch = {
  myTeamProfile: null,
};

/** Generous but bounded, so a buggy or malicious client can't stuff an arbitrarily large blob into a settings row. */
const MAX_FIELD_LENGTH = 200;

const ALLOWED_PROFILE_KEYS = new Set(["school", "email1", "email2"]);

function isValidProfileField(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_FIELD_LENGTH;
}

export function isValidMyTeamProfileSyncPayload(value: unknown): value is MyTeamProfileSyncPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  if (!Object.keys(profile).every((key) => ALLOWED_PROFILE_KEYS.has(key))) return false;
  return (
    isValidProfileField(profile.school) &&
    isValidProfileField(profile.email1) &&
    isValidProfileField(profile.email2)
  );
}

export type MyTeamProfilePatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<MyTeamProfilePatch>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch:
 * `myTeamProfile` is accepted as `null` (clear) or a well-formed
 * `{ school, email1, email2 }` object, mirroring
 * `normalizeResearchProgressGoalPatch`'s "replace the full value in one PUT"
 * shape.
 */
export function normalizeMyTeamProfilePatch(input: unknown): MyTeamProfilePatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<MyTeamProfilePatch> = {};
  const errors: string[] = [];

  if ("myTeamProfile" in record) {
    const raw = record.myTeamProfile;
    if (raw === null || isValidMyTeamProfileSyncPayload(raw)) {
      valid.myTeamProfile = raw as MyTeamProfileSyncPayload | null;
    } else {
      errors.push(
        `"myTeamProfile" must be null (to clear) or a { school, email1, email2 } object of strings, each at most ${MAX_FIELD_LENGTH} characters.`,
      );
    }
  }

  return { valid, errors };
}

/** Serializes a profile for the `my_team_profile` D1 column: `null` clears it, matching every other nullable column here. */
export function serializeMyTeamProfile(profile: MyTeamProfileSyncPayload | null): string | null {
  return profile === null ? null : JSON.stringify(profile);
}

/** Parses the `my_team_profile` D1 column back into a profile. Never throws — a null, malformed, or invalid-shape value reads back as `null` rather than erroring the request. */
export function parseMyTeamProfile(raw: string | null | undefined): MyTeamProfileSyncPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidMyTeamProfileSyncPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
