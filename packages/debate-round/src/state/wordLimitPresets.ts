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
