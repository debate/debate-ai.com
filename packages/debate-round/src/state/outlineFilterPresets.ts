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
 * `roundId` optionally records which round's outline the preset was saved
 * from, so `ArgumentTreePanel`'s global "Saved filter presets" list can
 * jump to (select and scroll to) that round when the preset is applied from
 * there, rather than only ever changing the filter of whichever round card
 * happens to already be on screen — closing
 * `packages/debate-help-docs/content/docs/features/argument-tree-outline.mdx`'s
 * "doesn't select or scroll to a particular round" Known gap. It's absent
 * on presets saved before this field existed, and on those the panel falls
 * back to the pre-existing per-round behavior.
 *
 * @module state/outlineFilterPresets
 */

import type { ArgumentTreeFilter } from "../flow/argument-tree";

export type OutlineFilterPreset = {
  /** User-chosen label for this filter combination, e.g. "Unanswered AC turns". */
  name: string;
  filter: ArgumentTreeFilter;
  /** The round this preset was saved from, if saved after this field was introduced. */
  roundId?: string;
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
  if (!isOptionalString(preset.roundId)) return false;
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

/**
 * A single add/remove operation, applied server-side against the caller's
 * currently stored presets list rather than a client-computed whole-list
 * replacement. Unlike `state/wordLimitPresets.ts#WordLimitPresetOp`, there is
 * no `updateOutlineFilterPreset` — `useOutlineFilterPresets.ts` has no
 * rename/edit-in-place UI today, only add and remove.
 */
export type OutlineFilterPresetOp = {
  addOutlineFilterPreset?: { name: string; filter: ArgumentTreeFilter; roundId?: string };
  removeOutlineFilterPreset?: string;
};

export type OutlineFilterPresetOpPatchResult = {
  valid: OutlineFilterPresetOp;
  errors: string[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Why an add op was refused — one value per user-visible message. */
export type OutlineFilterPresetSaveFailure = "invalid-name" | "invalid-filter" | "duplicate-name" | "at-capacity";

/**
 * Validates a prospective new preset against the documented limits *before*
 * it is persisted, mirroring `state/wordLimitPresets.ts#validateNewWordLimitPreset`.
 * Returns `null` when the add is allowed.
 */
export function validateNewOutlineFilterPreset(
  existing: OutlineFilterPreset[],
  name: string,
  filter: ArgumentTreeFilter,
): OutlineFilterPresetSaveFailure | null {
  if (!isValidOutlineFilterPresetName(name)) return "invalid-name";
  if (!isValidArgumentTreeFilter(filter)) return "invalid-filter";
  const normalized = normalizeOutlineFilterPresetName(name);
  if (existing.some((preset) => normalizeOutlineFilterPresetName(preset.name) === normalized)) return "duplicate-name";
  if (existing.length >= MAX_OUTLINE_FILTER_PRESETS) return "at-capacity";
  return null;
}

/** User-facing message for a refused preset add. `name` is the name the user typed, quoted into the messages that reference it. */
export function buildOutlineFilterPresetFailureMessage(failure: OutlineFilterPresetSaveFailure, name: string): string {
  switch (failure) {
    case "invalid-name":
      return `Preset names must be 1-${MAX_PRESET_NAME_LENGTH} characters.`;
    case "invalid-filter":
      return "That filter combination isn't valid.";
    case "duplicate-name":
      return `A preset named "${name.trim()}" already exists.`;
    case "at-capacity":
      return `You already have ${MAX_OUTLINE_FILTER_PRESETS} saved presets — remove one first.`;
  }
}

/**
 * Validates an untrusted `{ addOutlineFilterPreset }` / `{ removeOutlineFilterPreset }`
 * patch — the fix for the "two tabs/devices edit Outline filter presets at
 * once" lost-update race `normalizeOutlineFilterPresetsPatch`'s whole-list
 * replace is exposed to (see
 * `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 * Known gaps), mirroring `state/wordLimitPresets.ts#normalizeWordLimitPresetOpPatch`.
 * The caller sends just the op being performed, and `/api/settings`'s route
 * resolves it against the row's current value (read-then-write) via
 * {@link applyOutlineFilterPresetOp} rather than trusting a client-computed
 * list that may already be stale by the time it lands. Only shape is checked
 * here (types, a valid nested filter) — name-uniqueness and capacity
 * business rules can only be enforced once the current list is known, so
 * {@link applyOutlineFilterPresetOp} re-uses {@link validateNewOutlineFilterPreset}
 * for that.
 */
export function normalizeOutlineFilterPresetOpPatch(input: unknown): OutlineFilterPresetOpPatchResult {
  if (!isPlainRecord(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const hasAdd = "addOutlineFilterPreset" in input;
  const hasRemove = "removeOutlineFilterPreset" in input;

  if (hasAdd && hasRemove) {
    return {
      valid: {},
      errors: ['Provide only one of "addOutlineFilterPreset" or "removeOutlineFilterPreset" per request.'],
    };
  }

  if (hasAdd) {
    const value = input.addOutlineFilterPreset;
    if (isPlainRecord(value) && typeof value.name === "string" && isValidArgumentTreeFilter(value.filter)) {
      const roundId = typeof value.roundId === "string" ? value.roundId : undefined;
      return {
        valid: { addOutlineFilterPreset: { name: value.name, filter: value.filter, ...(roundId ? { roundId } : {}) } },
        errors: [],
      };
    }
    return {
      valid: {},
      errors: ['"addOutlineFilterPreset" must be a { name: string, filter: object } object with a valid filter.'],
    };
  }
  if (hasRemove) {
    const value = input.removeOutlineFilterPreset;
    if (typeof value === "string" && value.trim().length > 0) {
      return { valid: { removeOutlineFilterPreset: value }, errors: [] };
    }
    return { valid: {}, errors: ['"removeOutlineFilterPreset" must be a non-empty preset name.'] };
  }
  return { valid: {}, errors: [] };
}

export type OutlineFilterPresetOpResult = {
  /** The resulting list. Equal to `current` (same reference) when the op was refused or was a no-op. */
  next: OutlineFilterPreset[];
  /** Set when the op was refused by a business rule (duplicate name, at capacity, invalid filter); `next` is unchanged in that case. */
  failure: OutlineFilterPresetSaveFailure | null;
};

/**
 * Applies one validated add/remove op to a currently stored presets list.
 * Mirrors `state/wordLimitPresets.ts#applyWordLimitPresetOp`: an add can be
 * refused by a business rule shared with the local-first hook path
 * ({@link validateNewOutlineFilterPreset}) — a duplicate name or an
 * at-capacity list — so the caller must check `failure` before treating the
 * op as applied. `removeOutlineFilterPreset` is the one exception: removing
 * an absent name is a silent no-op rather than a failure, matching
 * `useOutlineFilterPresets.ts#removePreset`'s own `void` return.
 */
export function applyOutlineFilterPresetOp(
  current: OutlineFilterPreset[],
  op: OutlineFilterPresetOp,
): OutlineFilterPresetOpResult {
  if (op.addOutlineFilterPreset) {
    const { name, filter, roundId } = op.addOutlineFilterPreset;
    const failure = validateNewOutlineFilterPreset(current, name, filter);
    if (failure) return { next: current, failure };
    return {
      next: [...current, { name: name.trim(), filter, ...(roundId ? { roundId } : {}) }],
      failure: null,
    };
  }
  if (op.removeOutlineFilterPreset) {
    const normalized = normalizeOutlineFilterPresetName(op.removeOutlineFilterPreset);
    const next = current.filter((preset) => normalizeOutlineFilterPresetName(preset.name) !== normalized);
    return { next: next.length === current.length ? current : next, failure: null };
  }
  return { next: current, failure: null };
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
