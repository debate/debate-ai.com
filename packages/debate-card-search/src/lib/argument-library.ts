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
 * @module lib/argument-library
 */

import type { CoverageCardSummary } from "./topic-coverage";

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
