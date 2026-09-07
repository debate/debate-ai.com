/**
 * @fileoverview A reusable, named library of custom opponent personas — the
 * "🤖 AI Practice Opponent" idea's "share a custom-authored persona across a
 * team instead of per-user only" Next item in TODO.md's Research
 * Crowdsourcing Organizer Features.
 *
 * Before this, `opponent-personas.ts#buildCustomOpponentPersona` only ever
 * produced a one-off persona baked directly into a single practice
 * session's `OpponentPersonaSelection` — there was no way to save a custom
 * persona under a name and reuse it across sessions, let alone share it. A
 * `SavedCustomOpponentPersona` is that missing named, reusable, and
 * (optionally) `shared` library entry. `state/customOpponentPersonaLibrary.ts`
 * (`debate-practice-drills`) persists these locally; the account-linked
 * `saved_custom_opponent_personas` D1 table plus `/api/custom-opponent-
 * personas` routes sync a signed-in user's own library across devices and
 * expose every other user's `shared: true` entries as a read-only "shared by
 * your team" list (see `hooks/useCustomOpponentPersonaLibrary.ts`).
 *
 * @module opponent/opponent-persona-library
 */

import {
  buildCustomOpponentPersona,
  MAX_CUSTOM_NAME_LENGTH,
  MAX_CUSTOM_NOTES_LENGTH,
  sanitizeOpponentPersonaText,
  type OpponentPersona,
} from "./opponent-personas";

/** A named, reusable custom opponent persona saved to a user's library. */
export type SavedCustomOpponentPersona = {
  id: string;
  /** Label for the persona, e.g. "Coach Amy's aggressive K bot". */
  name: string;
  /** Free-form description of how this opponent argues/paces. */
  notes: string;
  /** Whether this entry is visible in the team-wide "shared by your team" list once account-synced. */
  shared: boolean;
  createdAt: number;
  updatedAt: number;
};

/** Hard cap on a single saved library entry's JSON size once account-synced — generous for name+notes, well short of D1's row-size limits. */
export const MAX_SAVED_CUSTOM_OPPONENT_PERSONA_BYTES = 20_000;

export type CustomOpponentPersonaLibraryEntryInput = {
  /** Reuses an existing entry's id when editing it in place; a fresh id is generated when omitted. */
  id?: string;
  name: string;
  notes: string;
  shared?: boolean;
};

function generateLibraryEntryId(): string {
  // Node ≥ 19 and every modern browser expose crypto.randomUUID() globally.
  return crypto.randomUUID();
}

/**
 * Builds a `SavedCustomOpponentPersona` from user input, sanitizing `name`
 * and `notes` the same way `buildCustomOpponentPersona` does. Throws if
 * either is empty after sanitization, since a saved persona with no
 * meaningful name or style description isn't reusable.
 *
 * `now` is injectable for deterministic tests; real callers should omit it.
 */
export function buildSavedCustomOpponentPersona(
  input: CustomOpponentPersonaLibraryEntryInput,
  now: number = Date.now(),
): SavedCustomOpponentPersona {
  const name = sanitizeOpponentPersonaText(input.name, MAX_CUSTOM_NAME_LENGTH);
  const notes = sanitizeOpponentPersonaText(input.notes, MAX_CUSTOM_NOTES_LENGTH);

  if (!name) throw new Error("buildSavedCustomOpponentPersona: name is required");
  if (!notes) throw new Error("buildSavedCustomOpponentPersona: notes are required");

  return {
    id: input.id ?? generateLibraryEntryId(),
    name,
    notes,
    shared: input.shared ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Resolves a saved library entry into a usable `OpponentPersona` — the same
 * shape a fresh, one-off `buildCustomOpponentPersona` call produces — so a
 * session picking a library entry behaves identically to typing its
 * name/notes in by hand.
 */
export function resolveOpponentPersonaFromLibraryEntry(entry: SavedCustomOpponentPersona): OpponentPersona {
  return buildCustomOpponentPersona({ name: entry.name, notes: entry.notes });
}

/** Every persisted library entry, alphabetically by name (case-insensitive) — for a picker/library UI. */
export function sortCustomOpponentPersonaLibrary(
  entries: SavedCustomOpponentPersona[],
): SavedCustomOpponentPersona[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `SavedCustomOpponentPersona` — shared by the
 * `/api/custom-opponent-personas` D1-backed routes (`apps/debate-ai.com`)
 * and `hooks/useCustomOpponentPersonaLibrary.ts`, mirroring
 * `state/savedDrillSets.ts#isValidDrillSetRecord`'s split.
 */
export function isValidSavedCustomOpponentPersona(value: unknown): value is SavedCustomOpponentPersona {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    typeof record.name === "string" &&
    record.name.trim().length > 0 &&
    typeof record.notes === "string" &&
    record.notes.trim().length > 0 &&
    typeof record.shared === "boolean" &&
    typeof record.createdAt === "number" &&
    typeof record.updatedAt === "number"
  );
}
