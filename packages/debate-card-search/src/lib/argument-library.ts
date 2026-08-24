/**
 * @fileoverview Pure organizing helpers for the "Common Argument Library"
 * idea under Research Crowdsourcing Organizer Features in TODO.md
 * ("Organize all shared research into topic folders, case areas, and
 * tag-based collections"). Extends the existing "Topic Coverage Dashboard"
 * slice's `argBlock`-tagged card model with a `topic`, `caseArea`, and
 * free-form `tags`, then groups a flat card list into topic folders (each
 * split into case-area subgroups) and tag-based collections. This is the
 * first slice only — it works entirely off a caller-supplied, already-tagged
 * card list; it doesn't read real submitted cards, persist a library's
 * structure, or render a folder/collection browser UI. See the follow-ups
 * noted in TODO.md.
 *
 * `contributionToLibraryCard`/`buildLibraryCardsFromContributions` close
 * follow-up (a) named under this bullet in TODO.md — "wiring a `topic`/
 * `caseArea`/`tags` field into wherever submitted cards are eventually
 * persisted beyond the existing evidence-library store". The general-purpose
 * Contributions Feed (`contribution-leaderboard.ts`'s `AttributedContribution`,
 * persisted by `state/contributions.ts`) now carries the same optional
 * `topic`/`caseArea`/`tags` fields as a `LibraryCard`; a contribution missing
 * `topic` or `caseArea` (both required on `LibraryCard`) is excluded rather
 * than defaulted, since there's no reasonable topic/case-area fallback.
 * `state/evidenceLibraryEntries.ts`'s `buildCombinedPersistedArgumentLibrary`
 * composes these against the persisted Contributions Feed store alongside the
 * existing evidence-library entries.
 *
 * @module lib/argument-library
 */

import type { CoverageCardSummary } from "./topic-coverage";
import type { AttributedContribution } from "./contribution-leaderboard";

/** A submitted card tagged with the topic/case-area/tags needed to file it into the library. */
export interface LibraryCard extends CoverageCardSummary {
  /** Debate topic (resolution) this card was researched for. */
  topic: string;
  /** Case area/argument category, e.g. "Aff", "Neg", "DA", "CP", "K", "T", "Case". */
  caseArea: string;
  /** Free-form tags for cross-cutting, tag-based collections. */
  tags: string[];
}

/** One topic's cards, split into case-area subgroups. */
export interface CaseAreaGroup {
  caseArea: string;
  cards: LibraryCard[];
}

/** A topic folder: every case area with at least one card under this topic. */
export interface TopicFolder {
  topic: string;
  caseAreas: CaseAreaGroup[];
  cardCount: number;
}

/** A tag-based collection: every card carrying a given tag, across topics. */
export interface TagCollection {
  tag: string;
  cards: LibraryCard[];
}

/** The full organized library: topic folders plus cross-cutting tag collections. */
export interface ArgumentLibrary {
  topicFolders: TopicFolder[];
  tagCollections: TagCollection[];
}

/** Groups cards by `topic`, preserving each group's relative submission order. */
export function groupCardsByTopic(cards: LibraryCard[]): Map<string, LibraryCard[]> {
  const byTopic = new Map<string, LibraryCard[]>();
  for (const card of cards) {
    const group = byTopic.get(card.topic);
    if (group) {
      group.push(card);
    } else {
      byTopic.set(card.topic, [card]);
    }
  }
  return byTopic;
}

/** Groups cards by `caseArea`, preserving each group's relative submission order. */
export function groupCardsByCaseArea(cards: LibraryCard[]): Map<string, LibraryCard[]> {
  const byCaseArea = new Map<string, LibraryCard[]>();
  for (const card of cards) {
    const group = byCaseArea.get(card.caseArea);
    if (group) {
      group.push(card);
    } else {
      byCaseArea.set(card.caseArea, [card]);
    }
  }
  return byCaseArea;
}

/**
 * Builds one topic's folder: its cards split into case-area subgroups,
 * sorted by `caseArea` for a stable, deterministic order.
 */
export function buildTopicFolder(topic: string, cards: LibraryCard[]): TopicFolder {
  const byCaseArea = groupCardsByCaseArea(cards);
  const caseAreas = Array.from(byCaseArea.entries())
    .map(([caseArea, group]) => ({ caseArea, cards: group }))
    .sort((a, b) => a.caseArea.localeCompare(b.caseArea));

  return { topic, caseAreas, cardCount: cards.length };
}

/**
 * Builds a topic folder for every topic represented in `cards`, sorted by
 * `topic` for a stable, deterministic order.
 */
export function buildTopicFolders(cards: LibraryCard[]): TopicFolder[] {
  const byTopic = groupCardsByTopic(cards);
  return Array.from(byTopic.entries())
    .map(([topic, group]) => buildTopicFolder(topic, group))
    .sort((a, b) => a.topic.localeCompare(b.topic));
}

/**
 * Builds a tag collection for every distinct tag found across `cards` (a
 * card with multiple tags appears in each of its tags' collections),
 * sorted by `tag` for a stable, deterministic order.
 */
export function buildTagCollections(cards: LibraryCard[]): TagCollection[] {
  const byTag = new Map<string, LibraryCard[]>();
  for (const card of cards) {
    for (const tag of card.tags) {
      const group = byTag.get(tag);
      if (group) {
        group.push(card);
      } else {
        byTag.set(tag, [card]);
      }
    }
  }

  return Array.from(byTag.entries())
    .map(([tag, group]) => ({ tag, cards: group }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Filters cards by a set of desired tags. `mode: "any"` (default) keeps
 * cards carrying at least one of `tags`; `mode: "all"` requires every tag
 * to be present on the card.
 */
export function filterCardsByTags(
  cards: LibraryCard[],
  tags: string[],
  mode: "any" | "all" = "any",
): LibraryCard[] {
  if (tags.length === 0) return [];
  return cards.filter((card) => {
    const cardTags = new Set(card.tags);
    return mode === "all" ? tags.every((tag) => cardTags.has(tag)) : tags.some((tag) => cardTags.has(tag));
  });
}

/**
 * Builds the full argument library from a flat, caller-supplied card list:
 * topic folders (each split into case-area subgroups) plus cross-cutting
 * tag-based collections.
 */
export function buildArgumentLibrary(cards: LibraryCard[]): ArgumentLibrary {
  return {
    topicFolders: buildTopicFolders(cards),
    tagCollections: buildTagCollections(cards),
  };
}

/**
 * Splits a comma-separated tags input field into the already-completed tags
 * before the last comma and the in-progress fragment still being typed after
 * it, for a tag-autocomplete affordance over a free-text tags field (the "(c)
 * a tag-autocomplete/tag-management affordance" follow-up under the "📚
 * Common Argument Library" bullet in TODO.md).
 */
export function parseTagsInput(input: string): { completedTags: string[]; draftTag: string } {
  const parts = input.split(",");
  const draftTag = parts[parts.length - 1] ?? "";
  const completedTags = parts
    .slice(0, -1)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return { completedTags, draftTag };
}

/**
 * Appends a chosen suggestion to a comma-separated tags input in place of the
 * in-progress fragment being typed (see `parseTagsInput`), leaving a trailing
 * ", " so the contributor can keep typing another tag.
 */
export function applyTagSuggestion(input: string, suggestion: string): string {
  const { completedTags } = parseTagsInput(input);
  return [...completedTags, suggestion].join(", ") + ", ";
}

/**
 * Suggests existing tags from `knownTags` that could complete the
 * in-progress `query` fragment, so a contributor reuses an existing tag
 * instead of coining a near-duplicate. Case-insensitive; a tag already
 * present in `excludeTags` (already added to the field) or matching `query`
 * exactly is never suggested. Prefix matches rank ahead of substring
 * matches; each group is otherwise sorted alphabetically. An empty `query`
 * (nothing typed yet to complete) returns no suggestions. Results are capped
 * at `limit` (default 8).
 */
export function suggestTags(
  knownTags: string[],
  query: string,
  excludeTags: string[] = [],
  limit = 8,
): string[] {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) return [];

  const excluded = new Set(excludeTags.map((tag) => tag.trim().toLowerCase()));
  const seen = new Set<string>();
  const prefixMatches: string[] = [];
  const substringMatches: string[] = [];

  for (const tag of knownTags) {
    const lower = tag.toLowerCase();
    if (lower === trimmedQuery || excluded.has(lower) || seen.has(lower)) continue;
    if (lower.startsWith(trimmedQuery)) {
      prefixMatches.push(tag);
      seen.add(lower);
    } else if (lower.includes(trimmedQuery)) {
      substringMatches.push(tag);
      seen.add(lower);
    }
  }

  prefixMatches.sort((a, b) => a.localeCompare(b));
  substringMatches.sort((a, b) => a.localeCompare(b));

  return [...prefixMatches, ...substringMatches].slice(0, limit);
}

/**
 * Replaces `oldTag` with `newTag` inside a single card's tag list, if
 * present. If the card already carries `newTag` too, the duplicate is
 * dropped rather than kept (a merge into an existing tag shouldn't leave a
 * card with the same tag twice). A card that doesn't carry `oldTag` is
 * returned unchanged (`tags` itself, not a copy).
 */
export function renameTagInList(tags: string[], oldTag: string, newTag: string): string[] {
  if (!tags.includes(oldTag)) return tags;
  const withoutOld = tags.filter((tag) => tag !== oldTag);
  return withoutOld.includes(newTag) ? withoutOld : [...withoutOld, newTag];
}

/**
 * Renames (or, when `newTag` is already used elsewhere, merges into) a tag
 * across every card that carries it — the "no tag rename/merge tool" gap
 * recorded in `docs/features/evidence-library.md`'s Known gaps. Cards not
 * carrying `oldTag` are returned as the exact same object (no new
 * reference), so an unaffected card never appears "changed" to a caller
 * doing identity comparison. Throws if either tag, once trimmed, is blank,
 * or if they're the same tag (nothing to rename). Renaming a tag that isn't
 * used anywhere is a safe no-op — `changedCount` is `0` and every card is
 * returned unchanged.
 */
export function renameTagAcrossCards<T extends LibraryCard>(
  cards: T[],
  oldTag: string,
  newTag: string,
): { cards: T[]; changedCount: number } {
  const trimmedOld = oldTag.trim();
  const trimmedNew = newTag.trim();
  if (!trimmedOld || !trimmedNew) {
    throw new Error("renameTagAcrossCards requires non-blank oldTag and newTag");
  }
  if (trimmedOld === trimmedNew) {
    throw new Error("renameTagAcrossCards requires oldTag and newTag to differ");
  }

  let changedCount = 0;
  const updated = cards.map((card) => {
    const renamed = renameTagInList(card.tags, trimmedOld, trimmedNew);
    if (renamed === card.tags) return card;
    changedCount++;
    return { ...card, tags: renamed };
  });

  return { cards: updated, changedCount };
}

/**
 * Converts a Contributions Feed `AttributedContribution` into a `LibraryCard`,
 * or `null` if it's missing `topic` or `caseArea` — both required on
 * `LibraryCard` but optional on a contribution, since not every contribution
 * is filed into the Argument Library. `tags` defaults to an empty array.
 * `argBlock` falls back to `"Untagged"` and `wordCount` to `0`, since a
 * contribution carries no card body to measure — mirroring how other
 * cross-store composition in this codebase (see `evidenceLibraryEntries.ts`)
 * documents its known-placeholder fields rather than silently guessing.
 */
export function contributionToLibraryCard(contribution: AttributedContribution): LibraryCard | null {
  if (!contribution.topic || !contribution.caseArea) return null;
  return {
    id: contribution.id,
    argBlock: contribution.argBlock ?? "Untagged",
    wordCount: 0,
    topic: contribution.topic,
    caseArea: contribution.caseArea,
    tags: contribution.tags ?? [],
  };
}

/**
 * Converts every contribution that carries both `topic` and `caseArea` into a
 * `LibraryCard`, dropping the rest (see `contributionToLibraryCard`).
 */
export function buildLibraryCardsFromContributions(contributions: AttributedContribution[]): LibraryCard[] {
  return contributions
    .map(contributionToLibraryCard)
    .filter((card): card is LibraryCard => card !== null);
}

/** Renders a short summary line for an argument-library browser header. */
export function buildLibrarySummaryText(library: ArgumentLibrary): string {
  const cardCount = library.topicFolders.reduce((sum, folder) => sum + folder.cardCount, 0);
  const caseAreaCount = new Set(
    library.topicFolders.flatMap((folder) => folder.caseAreas.map((group) => `${folder.topic}::${group.caseArea}`)),
  ).size;

  return `${cardCount} card${cardCount === 1 ? "" : "s"} across ${library.topicFolders.length} topic${
    library.topicFolders.length === 1 ? "" : "s"
  }, ${caseAreaCount} case area${caseAreaCount === 1 ? "" : "s"}, ${library.tagCollections.length} tag${
    library.tagCollections.length === 1 ? "" : "s"
  }`;
}
