/**
 * @fileoverview Named, account-synced Argument Library collections — the
 * "saved custom collections per user" follow-up named under the "📚 Common
 * Argument Library" bullet (Research Crowdsourcing Organizer Features) in
 * `TODO.md`. Lets a user save the current tag-filter selection on
 * `ArgumentLibraryPanel` (`activeTags`) under a name and reapply it later,
 * instead of re-picking tag chips each visit. Pure validation/serialization
 * helpers shared by the `/api/settings` D1-backed route
 * (`apps/debate-ai.com`) and `hooks/useSavedArgumentCollections.ts`,
 * mirroring `debate-round`'s `state/outlineFilterPresets.ts` split exactly
 * (this package can't import that module directly — `debate-round` already
 * depends on `debate-card-search`, not the other way around — so the shape
 * is duplicated here rather than shared).
 *
 * Unlike an `OutlineFilterPreset` (one round's `ArgumentTreeFilter`), a
 * saved collection here is just a set of tags — the same shape
 * `ArgumentLibraryPanel`'s `activeTags` state and `filterCardsByTags`
 * already use, applied library-wide rather than scoped to one round.
 *
 * @module lib/argument-library-collections
 */

export type SavedArgumentCollection = {
  /** User-chosen label for this tag set, e.g. "Topicality answers". */
  name: string;
  tags: string[];
};

export type SavedArgumentCollectionsPayload = {
  savedArgumentCollections: SavedArgumentCollection[];
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_SAVED_ARGUMENT_COLLECTIONS: SavedArgumentCollectionsPayload = {
  savedArgumentCollections: [],
};

/** Generous but bounded, so a buggy or malicious client can't grow the row without limit — mirrors `MAX_OUTLINE_FILTER_PRESETS`. */
export const MAX_SAVED_ARGUMENT_COLLECTIONS = 50;

const MAX_COLLECTION_NAME_LENGTH = 60;
/** Bounds a single collection's tag count — well above any realistic tag-filter selection. */
export const MAX_TAGS_PER_COLLECTION = 30;
const MAX_TAG_LENGTH = 60;

/** Case-insensitive, trimmed — matches `outlineFilterPresets.ts#normalizeOutlineFilterPresetName`'s duplicate-detection convention. */
export function normalizeSavedArgumentCollectionName(name: string): string {
  return name.trim().toUpperCase();
}

export function isValidSavedArgumentCollectionName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= MAX_COLLECTION_NAME_LENGTH
  );
}

function isValidTagsList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_TAGS_PER_COLLECTION &&
    value.every((tag) => typeof tag === "string" && tag.trim().length > 0 && tag.length <= MAX_TAG_LENGTH)
  );
}

function isValidSavedArgumentCollection(value: unknown): value is SavedArgumentCollection {
  if (typeof value !== "object" || value === null) return false;
  const collection = value as Record<string, unknown>;
  return isValidSavedArgumentCollectionName(collection.name) && isValidTagsList(collection.tags);
}

/** Why a save/rename/update of a collection was refused — one value per user-visible message. */
export type SavedArgumentCollectionSaveFailure =
  | "empty-tags"
  | "too-many-tags"
  | "invalid-tag"
  | "invalid-name"
  | "duplicate-name"
  | "at-capacity"
  | "unknown-collection";

/**
 * Validates a prospective new collection against the documented limits
 * *before* it is persisted — the same rules `isValidSavedArgumentCollectionsList`
 * enforces on read, so an over-limit save can never poison the stored list
 * (previously a 31-tag save persisted fine and then wiped every collection on
 * the next read). Returns `null` when the save is allowed.
 */
export function validateNewSavedArgumentCollection(
  existing: SavedArgumentCollection[],
  name: string,
  tags: string[],
): SavedArgumentCollectionSaveFailure | null {
  if (tags.length === 0) return "empty-tags";
  if (tags.length > MAX_TAGS_PER_COLLECTION) return "too-many-tags";
  if (!tags.every((tag) => typeof tag === "string" && tag.trim().length > 0 && tag.length <= MAX_TAG_LENGTH)) {
    return "invalid-tag";
  }
  if (!isValidSavedArgumentCollectionName(name)) return "invalid-name";
  const normalized = normalizeSavedArgumentCollectionName(name);
  if (existing.some((collection) => normalizeSavedArgumentCollectionName(collection.name) === normalized)) {
    return "duplicate-name";
  }
  if (existing.length >= MAX_SAVED_ARGUMENT_COLLECTIONS) return "at-capacity";
  return null;
}

/** Validates renaming `oldName` to `newName` (case-insensitive identity; a rename to a name another collection holds is refused). Returns `null` when allowed. */
export function validateSavedArgumentCollectionRename(
  existing: SavedArgumentCollection[],
  oldName: string,
  newName: string,
): SavedArgumentCollectionSaveFailure | null {
  const oldNormalized = normalizeSavedArgumentCollectionName(oldName);
  if (!existing.some((collection) => normalizeSavedArgumentCollectionName(collection.name) === oldNormalized)) {
    return "unknown-collection";
  }
  if (!isValidSavedArgumentCollectionName(newName)) return "invalid-name";
  const newNormalized = normalizeSavedArgumentCollectionName(newName);
  if (
    newNormalized !== oldNormalized &&
    existing.some((collection) => normalizeSavedArgumentCollectionName(collection.name) === newNormalized)
  ) {
    return "duplicate-name";
  }
  return null;
}

/** Validates replacing `name`'s tag list with `tags` in place. Returns `null` when allowed. */
export function validateSavedArgumentCollectionTagsUpdate(
  existing: SavedArgumentCollection[],
  name: string,
  tags: string[],
): SavedArgumentCollectionSaveFailure | null {
  const normalized = normalizeSavedArgumentCollectionName(name);
  if (!existing.some((collection) => normalizeSavedArgumentCollectionName(collection.name) === normalized)) {
    return "unknown-collection";
  }
  if (tags.length === 0) return "empty-tags";
  if (tags.length > MAX_TAGS_PER_COLLECTION) return "too-many-tags";
  if (!tags.every((tag) => typeof tag === "string" && tag.trim().length > 0 && tag.length <= MAX_TAG_LENGTH)) {
    return "invalid-tag";
  }
  return null;
}

/**
 * User-facing message for a refused collection save/rename/update. `name` is
 * the name the user typed, quoted into the messages that reference it.
 */
export function buildSavedArgumentCollectionFailureMessage(
  failure: SavedArgumentCollectionSaveFailure,
  name: string,
): string {
  switch (failure) {
    case "empty-tags":
      return "Select at least one tag first.";
    case "too-many-tags":
      return `A collection can hold at most ${MAX_TAGS_PER_COLLECTION} tags.`;
    case "invalid-tag":
      return `Every tag must be non-empty and at most ${MAX_TAG_LENGTH} characters.`;
    case "invalid-name":
      return `Collection names must be 1-${MAX_COLLECTION_NAME_LENGTH} characters.`;
    case "duplicate-name":
      return `A collection named "${name.trim()}" already exists.`;
    case "at-capacity":
      return `You already have ${MAX_SAVED_ARGUMENT_COLLECTIONS} saved collections — remove one first.`;
    case "unknown-collection":
      return `No saved collection named "${name.trim()}" exists.`;
  }
}

export function isValidSavedArgumentCollectionsList(value: unknown): value is SavedArgumentCollection[] {
  if (!Array.isArray(value) || value.length > MAX_SAVED_ARGUMENT_COLLECTIONS) return false;
  if (!value.every(isValidSavedArgumentCollection)) return false;
  const normalizedNames = value.map((collection) =>
    normalizeSavedArgumentCollectionName((collection as SavedArgumentCollection).name),
  );
  return new Set(normalizedNames).size === normalizedNames.length;
}

export type SavedArgumentCollectionsPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<SavedArgumentCollectionsPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: the whole
 * `savedArgumentCollections` array is accepted or rejected as one field,
 * mirroring `normalizeOutlineFilterPresetsPatch`'s "replace the full list in
 * one PUT" shape.
 */
export function normalizeSavedArgumentCollectionsPatch(input: unknown): SavedArgumentCollectionsPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<SavedArgumentCollectionsPayload> = {};
  const errors: string[] = [];

  if ("savedArgumentCollections" in record) {
    if (isValidSavedArgumentCollectionsList(record.savedArgumentCollections)) {
      valid.savedArgumentCollections = record.savedArgumentCollections;
    } else {
      errors.push(
        `"savedArgumentCollections" must be an array of up to ${MAX_SAVED_ARGUMENT_COLLECTIONS} entries, each a { name, tags } pair with a non-empty name (max ${MAX_COLLECTION_NAME_LENGTH} characters) and 1-${MAX_TAGS_PER_COLLECTION} non-empty tags, with no two entries sharing a name (case-insensitive).`,
      );
    }
  }

  return { valid, errors };
}

/** Serializes a collections list for the `saved_argument_collections` D1 column: `null` when empty, matching the "no saved value yet" semantics every other nullable column here uses. */
export function serializeSavedArgumentCollections(list: SavedArgumentCollection[]): string | null {
  return list.length === 0 ? null : JSON.stringify(list);
}

/** Parses the `saved_argument_collections` D1 column back into a list. Never throws — a null, malformed, or invalid-shape value reads back as an empty list rather than erroring the request. */
export function parseSavedArgumentCollections(raw: string | null | undefined): SavedArgumentCollection[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return isValidSavedArgumentCollectionsList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
