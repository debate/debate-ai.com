/**
 * @fileoverview Custom word-limit presets — TODO.md idea #2 ("Word-Count-Only
 * Speech Format"), "a per-style word-limit preset manager (add/edit/remove
 * custom limits instead of only the built-in registry)" follow-up. Lets a
 * user override or extend `debate-timer`'s hardcoded `wordCountStyles`
 * registry (currently a single "Public Forum (Word Count)" style) with their
 * own `speechName → wordLimit` entries, synced to their account on the same
 * `user_settings` row as every other field. Pure validation/shape helpers
 * shared by the `/api/settings` D1-backed route (`apps/debate-ai.com`) and
 * `WordLimitPresetsPanel`/`useWordLimitPresets`, mirroring
 * `state/favoriteTools.ts`'s split.
 *
 * A preset's `name` is matched against a live or authored speech name the
 * same way `round/word-count-speech-mode.ts`'s `resolveSpeechWordLimit`
 * already matches the built-in registry: case-insensitively, trimmed. Two
 * presets that would normalize to the same name are rejected as duplicates
 * rather than silently letting the second shadow the first.
 *
 * @module state/wordLimitPresets
 */

export type WordLimitPreset = {
  /** Speech/column name this preset overrides, e.g. `"AC"` or `"1AR"`. */
  name: string;
  /** Maximum words allowed for a speech matching `name`. */
  wordLimit: number;
};

export type WordLimitPresetsPayload = {
  wordLimitPresets: WordLimitPreset[];
};

/** Mirrors every other `DEFAULT_*` in this package: the value used when no saved row/value exists yet. */
export const DEFAULT_WORD_LIMIT_PRESETS: WordLimitPresetsPayload = {
  wordLimitPresets: [],
};

/** Generous but bounded, so a buggy or malicious client can't grow the row without limit. */
export const MAX_WORD_LIMIT_PRESETS = 50;

/** Matches every authored `WordCountSpeech.name` in `debate-timer`'s registry (short, all-caps-or-digits speech labels like `"AC"`/`"1AR"`), generalized to allow any non-empty, reasonably short label a user might type. */
const MAX_PRESET_NAME_LENGTH = 40;
const MAX_WORD_LIMIT = 100_000;

/** Case-insensitive, trimmed — the same normalization `resolveSpeechWordLimit` applies when matching a live speech name against the registry. */
export function normalizePresetName(name: string): string {
  return name.trim().toUpperCase();
}

export function isValidPresetName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= MAX_PRESET_NAME_LENGTH
  );
}

export function isValidPresetWordLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_WORD_LIMIT;
}

function isValidPreset(value: unknown): value is WordLimitPreset {
  if (typeof value !== "object" || value === null) return false;
  const preset = value as Record<string, unknown>;
  return isValidPresetName(preset.name) && isValidPresetWordLimit(preset.wordLimit);
}

export function isValidWordLimitPresetsList(value: unknown): value is WordLimitPreset[] {
  if (!Array.isArray(value) || value.length > MAX_WORD_LIMIT_PRESETS) return false;
  if (!value.every(isValidPreset)) return false;
  const normalizedNames = value.map((preset) => normalizePresetName((preset as WordLimitPreset).name));
  return new Set(normalizedNames).size === normalizedNames.length;
}

export type WordLimitPresetsPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<WordLimitPresetsPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: the whole
 * `wordLimitPresets` array is accepted or rejected as one field, mirroring
 * `normalizeFavoriteToolsPatch`'s "replace the full list in one PUT" shape.
 */
export function normalizeWordLimitPresetsPatch(input: unknown): WordLimitPresetsPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<WordLimitPresetsPayload> = {};
  const errors: string[] = [];

  if ("wordLimitPresets" in record) {
    if (isValidWordLimitPresetsList(record.wordLimitPresets)) {
      valid.wordLimitPresets = record.wordLimitPresets;
    } else {
      errors.push(
        `"wordLimitPresets" must be an array of up to ${MAX_WORD_LIMIT_PRESETS} entries, each a { name, wordLimit } pair with a non-empty name (max ${MAX_PRESET_NAME_LENGTH} characters) and a positive integer word limit, with no two entries sharing a name (case-insensitive).`,
      );
    }
  }

  return { valid, errors };
}

/**
 * A single add/update/remove operation, applied server-side against the
 * caller's currently stored presets list rather than a client-computed
 * whole-list replacement.
 */
export type WordLimitPresetOp = {
  addWordLimitPreset?: { name: string; wordLimit: number };
  updateWordLimitPreset?: { name: string; wordLimit: number };
  removeWordLimitPreset?: string;
};

export type WordLimitPresetOpPatchResult = {
  valid: WordLimitPresetOp;
  errors: string[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Why an add/update op was refused — one value per user-visible message. */
export type WordLimitPresetSaveFailure =
  | "invalid-name"
  | "invalid-word-limit"
  | "duplicate-name"
  | "at-capacity"
  | "unknown-preset";

/**
 * Validates a prospective new preset against the documented limits *before*
 * it is persisted, mirroring `argument-library-collections.ts#validateNewSavedArgumentCollection`'s
 * split. Returns `null` when the add is allowed.
 */
export function validateNewWordLimitPreset(
  existing: WordLimitPreset[],
  name: string,
  wordLimit: number,
): WordLimitPresetSaveFailure | null {
  if (!isValidPresetName(name)) return "invalid-name";
  if (!isValidPresetWordLimit(wordLimit)) return "invalid-word-limit";
  const normalized = normalizePresetName(name);
  if (existing.some((preset) => normalizePresetName(preset.name) === normalized)) return "duplicate-name";
  if (existing.length >= MAX_WORD_LIMIT_PRESETS) return "at-capacity";
  return null;
}

/** Validates replacing `name`'s word limit with `wordLimit` in place. Returns `null` when allowed. */
export function validateWordLimitPresetUpdate(
  existing: WordLimitPreset[],
  name: string,
  wordLimit: number,
): WordLimitPresetSaveFailure | null {
  const normalized = normalizePresetName(name);
  if (!existing.some((preset) => normalizePresetName(preset.name) === normalized)) return "unknown-preset";
  if (!isValidPresetWordLimit(wordLimit)) return "invalid-word-limit";
  return null;
}

/** User-facing message for a refused preset add/update. `name` is the name the user typed, quoted into the messages that reference it. */
export function buildWordLimitPresetFailureMessage(failure: WordLimitPresetSaveFailure, name: string): string {
  switch (failure) {
    case "invalid-name":
      return `Preset names must be 1-${MAX_PRESET_NAME_LENGTH} characters.`;
    case "invalid-word-limit":
      return `Word limit must be a positive whole number up to ${MAX_WORD_LIMIT}.`;
    case "duplicate-name":
      return `A preset named "${name.trim()}" already exists.`;
    case "at-capacity":
      return `You already have ${MAX_WORD_LIMIT_PRESETS} saved presets — remove one first.`;
    case "unknown-preset":
      return `No saved preset named "${name.trim()}" exists.`;
  }
}

/**
 * Validates an untrusted `{ addWordLimitPreset }` / `{ updateWordLimitPreset }`
 * / `{ removeWordLimitPreset }` patch — the fix for the "two tabs/devices
 * edit word-limit presets at once" lost-update race
 * `normalizeWordLimitPresetsPatch`'s whole-list replace is exposed to (see
 * `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 * Known gaps), mirroring `state/favoriteTools.ts#normalizeFavoriteToolOpPatch`
 * and `argument-library-collections.ts#normalizeSavedArgumentCollectionOpPatch`.
 * The caller sends just the op being performed, and `/api/settings`'s route
 * resolves it against the row's current value (read-then-write) via
 * {@link applyWordLimitPresetOp} rather than trusting a client-computed list
 * that may already be stale by the time it lands. Only shape is checked
 * here (types, non-empty strings) — name-uniqueness and capacity business
 * rules can only be enforced once the current list is known, so
 * {@link applyWordLimitPresetOp} re-uses {@link validateNewWordLimitPreset}/
 * {@link validateWordLimitPresetUpdate} for that.
 */
export function normalizeWordLimitPresetOpPatch(input: unknown): WordLimitPresetOpPatchResult {
  if (!isPlainRecord(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const hasAdd = "addWordLimitPreset" in input;
  const hasUpdate = "updateWordLimitPreset" in input;
  const hasRemove = "removeWordLimitPreset" in input;

  if ([hasAdd, hasUpdate, hasRemove].filter(Boolean).length > 1) {
    return {
      valid: {},
      errors: [
        'Provide only one of "addWordLimitPreset", "updateWordLimitPreset" or "removeWordLimitPreset" per request.',
      ],
    };
  }

  if (hasAdd) {
    const value = input.addWordLimitPreset;
    if (isPlainRecord(value) && typeof value.name === "string" && typeof value.wordLimit === "number") {
      return { valid: { addWordLimitPreset: { name: value.name, wordLimit: value.wordLimit } }, errors: [] };
    }
    return { valid: {}, errors: ['"addWordLimitPreset" must be a { name: string, wordLimit: number } object.'] };
  }
  if (hasUpdate) {
    const value = input.updateWordLimitPreset;
    if (isPlainRecord(value) && typeof value.name === "string" && typeof value.wordLimit === "number") {
      return { valid: { updateWordLimitPreset: { name: value.name, wordLimit: value.wordLimit } }, errors: [] };
    }
    return { valid: {}, errors: ['"updateWordLimitPreset" must be a { name: string, wordLimit: number } object.'] };
  }
  if (hasRemove) {
    const value = input.removeWordLimitPreset;
    if (typeof value === "string" && value.trim().length > 0) {
      return { valid: { removeWordLimitPreset: value }, errors: [] };
    }
    return { valid: {}, errors: ['"removeWordLimitPreset" must be a non-empty preset name.'] };
  }
  return { valid: {}, errors: [] };
}

export type WordLimitPresetOpResult = {
  /** The resulting list. Equal to `current` (same reference) when the op was refused or was a no-op. */
  next: WordLimitPreset[];
  /** Set when the op was refused by a business rule (duplicate name, at capacity, unknown preset); `next` is unchanged in that case. */
  failure: WordLimitPresetSaveFailure | null;
};

/**
 * Applies one validated add/update/remove op to a currently stored presets
 * list. Unlike `state/favoriteTools.ts#applyFavoriteToolOp` (always silently
 * idempotent), an add/update here can be refused by a business rule shared
 * with the local-first hook path (`validateNewWordLimitPreset`/
 * `validateWordLimitPresetUpdate`) — e.g. a duplicate name or an unknown
 * preset — so the caller must check `failure` before treating the op as
 * applied. `removeWordLimitPreset` is the one exception: like
 * `removeFavoriteTool`, removing an absent name is a silent no-op rather
 * than an `unknown-preset` failure, matching
 * `useWordLimitPresets.ts#removePreset`'s own `void` return.
 */
export function applyWordLimitPresetOp(current: WordLimitPreset[], op: WordLimitPresetOp): WordLimitPresetOpResult {
  if (op.addWordLimitPreset) {
    const { name, wordLimit } = op.addWordLimitPreset;
    const failure = validateNewWordLimitPreset(current, name, wordLimit);
    if (failure) return { next: current, failure };
    return { next: [...current, { name: name.trim(), wordLimit }], failure: null };
  }
  if (op.updateWordLimitPreset) {
    const { name, wordLimit } = op.updateWordLimitPreset;
    const failure = validateWordLimitPresetUpdate(current, name, wordLimit);
    if (failure) return { next: current, failure };
    const normalized = normalizePresetName(name);
    return {
      next: current.map((preset) =>
        normalizePresetName(preset.name) === normalized ? { ...preset, wordLimit } : preset,
      ),
      failure: null,
    };
  }
  if (op.removeWordLimitPreset) {
    const normalized = normalizePresetName(op.removeWordLimitPreset);
    const next = current.filter((preset) => normalizePresetName(preset.name) !== normalized);
    return { next: next.length === current.length ? current : next, failure: null };
  }
  return { next: current, failure: null };
}

/** Serializes a presets list for the `word_limit_presets` D1 column: `null` when empty, matching the "no saved value yet" semantics every other nullable column here uses. */
export function serializeWordLimitPresets(list: WordLimitPreset[]): string | null {
  return list.length === 0 ? null : JSON.stringify(list);
}

/** Parses the `word_limit_presets` D1 column back into a list. Never throws — a null, malformed, or invalid-shape value reads back as an empty list rather than erroring the request. */
export function parseWordLimitPresets(raw: string | null | undefined): WordLimitPreset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return isValidWordLimitPresetsList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Looks up a custom preset for a speech name, matching the same
 * case-insensitive/trimmed rule `resolveSpeechWordLimit` uses for the
 * built-in registry. Returns `undefined` when no preset matches.
 */
export function findPresetWordLimit(
  presets: WordLimitPreset[],
  speechName: string,
): number | undefined {
  const normalized = normalizePresetName(speechName);
  return presets.find((preset) => normalizePresetName(preset.name) === normalized)?.wordLimit;
}
