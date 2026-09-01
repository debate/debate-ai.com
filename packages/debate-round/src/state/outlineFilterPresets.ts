/**
 * @fileoverview Named Outline filter presets — TODO.md idea #10 ("Outline
 * Filters and Argument Tree View"), "Save and reuse named filter presets
 * instead of re-picking filters each visit" follow-up. Lets a user save
 * the current combination of `ArgumentTreeFilter` controls in
 * `ArgumentTreePanel` under a name and reapply it to any round's outline
 * later, instead of re-picking every dropdown on each visit. Pure
 * validation/shape helpers shared by the `/api/settings` D1-backed route
 * (`apps/debate-ai.com`) and `OutlineFilterPresetsBar`/
 * `useOutlineFilterPresets`, mirroring `state/wordLimitPresets.ts`'s split.
 *
 * Unlike `state/argumentTreeFilters.ts` (one filter selection per round,
 * localStorage-only), a preset here is a *named, reusable* filter
 * combination independent of any one round — applying a preset to a round
 * whose outline doesn't have a matching speech/side/contributor/etc. value
 * simply leaves that field with no match, the same as picking it by hand.
 *
 * @module state/outlineFilterPresets
 */

import type { ArgumentTreeFilter } from "../flow/argument-tree";

export type OutlineFilterPreset = {
  /** User-chosen label for this filter combination, e.g. "Unanswered AC turns". */
  name: string;
  filter: ArgumentTreeFilter;
};

export type OutlineFilterPresetsPayload = {
  outlineFilterPresets: OutlineFilterPreset[];
};

/** Mirrors every other `DEFAULT_*` in this package: the value used when no saved row/value exists yet. */
export const DEFAULT_OUTLINE_FILTER_PRESETS: OutlineFilterPresetsPayload = {
  outlineFilterPresets: [],
};

/** Generous but bounded, so a buggy or malicious client can't grow the row without limit. */
export const MAX_OUTLINE_FILTER_PRESETS = 50;

const MAX_PRESET_NAME_LENGTH = 60;
const ARGUMENT_TYPES = ["contention", "link", "impact", "turn", "answer", "extension"] as const;
const EVIDENCE_STATUSES = ["cited", "contested", "unverified"] as const;

/** Case-insensitive, trimmed — matches `state/wordLimitPresets.ts`'s `normalizePresetName` convention for duplicate detection (renamed here to avoid an ambiguous re-export with that module's same-named helper from this package's index). */
export function normalizeOutlineFilterPresetName(name: string): string {
  return name.trim().toUpperCase();
}

export function isValidOutlineFilterPresetName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= MAX_PRESET_NAME_LENGTH
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

/**
 * Validates an `ArgumentTreeFilter` shape: every field is optional, but if
 * present each must match its literal union/type — mirrors the strictness
 * of `isValidPresetWordLimit` etc., just applied to a nested object instead
 * of one scalar.
 */
export function isValidArgumentTreeFilter(value: unknown): value is ArgumentTreeFilter {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const filter = value as Record<string, unknown>;
  const allowedKeys = ["speech", "sideKey", "onlyUnanswered", "kind", "argumentType", "authorId", "evidenceStatus"];
  if (!Object.keys(filter).every((key) => allowedKeys.includes(key))) return false;

  if (!isOptionalString(filter.speech)) return false;
  if (!isOptionalString(filter.sideKey)) return false;
  if (filter.onlyUnanswered !== undefined && typeof filter.onlyUnanswered !== "boolean") return false;
  if (filter.kind !== undefined && filter.kind !== "heading" && filter.kind !== "argument") return false;
  if (filter.argumentType !== undefined && !ARGUMENT_TYPES.includes(filter.argumentType as never)) return false;
  if (!isOptionalString(filter.authorId)) return false;
  if (filter.evidenceStatus !== undefined && !EVIDENCE_STATUSES.includes(filter.evidenceStatus as never)) return false;

  return true;
}

function isValidPreset(value: unknown): value is OutlineFilterPreset {
  if (typeof value !== "object" || value === null) return false;
  const preset = value as Record<string, unknown>;
  return isValidOutlineFilterPresetName(preset.name) && isValidArgumentTreeFilter(preset.filter);
}

export function isValidOutlineFilterPresetsList(value: unknown): value is OutlineFilterPreset[] {
  if (!Array.isArray(value) || value.length > MAX_OUTLINE_FILTER_PRESETS) return false;
  if (!value.every(isValidPreset)) return false;
  const normalizedNames = value.map((preset) => normalizeOutlineFilterPresetName((preset as OutlineFilterPreset).name));
  return new Set(normalizedNames).size === normalizedNames.length;
}

export type OutlineFilterPresetsPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<OutlineFilterPresetsPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: the whole
 * `outlineFilterPresets` array is accepted or rejected as one field,
 * mirroring `normalizeWordLimitPresetsPatch`'s "replace the full list in
 * one PUT" shape.
 */
export function normalizeOutlineFilterPresetsPatch(input: unknown): OutlineFilterPresetsPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<OutlineFilterPresetsPayload> = {};
  const errors: string[] = [];

  if ("outlineFilterPresets" in record) {
    if (isValidOutlineFilterPresetsList(record.outlineFilterPresets)) {
      valid.outlineFilterPresets = record.outlineFilterPresets;
    } else {
      errors.push(
        `"outlineFilterPresets" must be an array of up to ${MAX_OUTLINE_FILTER_PRESETS} entries, each a { name, filter } pair with a non-empty name (max ${MAX_PRESET_NAME_LENGTH} characters) and a valid outline filter object, with no two entries sharing a name (case-insensitive).`,
      );
    }
  }

  return { valid, errors };
}

/** Serializes a presets list for the `outline_filter_presets` D1 column: `null` when empty, matching the "no saved value yet" semantics every other nullable column here uses. */
export function serializeOutlineFilterPresets(list: OutlineFilterPreset[]): string | null {
  return list.length === 0 ? null : JSON.stringify(list);
}

/** Parses the `outline_filter_presets` D1 column back into a list. Never throws — a null, malformed, or invalid-shape value reads back as an empty list rather than erroring the request. */
export function parseOutlineFilterPresets(raw: string | null | undefined): OutlineFilterPreset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return isValidOutlineFilterPresetsList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
