/**
 * Formatters for `debate-topics.json`: yearly Policy/NDT resolutions plus
 * month-stamped LD/PF lists.
 */

import type { DebateTopicYear, SeasonalTopic } from "@debate-ai/types";

// The definitions (and their field docs) live in `@debate-ai/types`.
export type { DebateTopicYear, SeasonalTopic };

/** Joins monthly topics for tooltips and banners that still want one string. */
export function formatSeasonalTopics(
  topics: SeasonalTopic[] | string | undefined,
): string | undefined {
  if (!topics) return undefined;
  if (typeof topics === "string") return topics;
  if (topics.length === 0) return undefined;
  return topics
    .map((entry) => {
      const month = entry.start_month?.trim();
      return month ? `${month}: ${entry.topic}` : entry.topic;
    })
    .join("<br>");
}

/** Prefixes a yearly resolution with its short name when both exist. */
export function formatNamedTopic(
  name: string | undefined,
  topic: string | undefined,
): string | undefined {
  if (!topic) return undefined;
  const label = name?.trim();
  return label ? `${label}<br>${topic}` : topic;
}

export function getStyleTopicText(
  entry: DebateTopicYear | undefined,
  style: number | undefined,
): string | undefined {
  if (!entry) return undefined;
  if (style === 1) return formatNamedTopic(entry.policy_topic_name, entry.policy_topic);
  if (style === 2) return formatSeasonalTopics(entry.pf_topics ?? entry.pf_topic);
  if (style === 3) return formatSeasonalTopics(entry.ld_topics ?? entry.ld_topic);
  if (style === 4) return formatNamedTopic(entry.ndt_topic_name, entry.ndt_topic);
  return undefined;
}

export function topicDisplayLines(topic: string): string {
  return topic.replace(/<br\s*\/?>/gi, "\n");
}

/** One resolution as the topics explorer lists it: a short title with its
 *  icon (when the data has them), the month it started, and the full text. */
export type TopicItem = {
  title?: string;
  emoji?: string;
  month?: string;
  text: string;
};

/**
 * Every resolution `entry` has for `style`, one item per topic. Legacy
 * `ld_topic` / `pf_topic` HTML strings come back as a single untitled item.
 */
export function getStyleTopicItems(
  entry: DebateTopicYear | undefined,
  style: number | undefined,
): TopicItem[] {
  if (!entry) return [];
  const named = (title?: string, emoji?: string, text?: string): TopicItem[] =>
    text ? [{ title: title?.trim() || undefined, emoji: emoji?.trim() || undefined, text }] : [];
  const seasonal = (topics: SeasonalTopic[] | string | undefined): TopicItem[] => {
    if (!topics) return [];
    if (typeof topics === "string") return [{ text: topicDisplayLines(topics) }];
    return topics.map((t) => ({
      title: t.topic_name?.trim() || undefined,
      emoji: t.emoji?.trim() || undefined,
      month: t.start_month?.trim() || undefined,
      text: t.topic,
    }));
  };
  if (style === 1) return named(entry.policy_topic_name, entry.policy_topic_emoji, entry.policy_topic);
  if (style === 2) return seasonal(entry.pf_topics ?? entry.pf_topic);
  if (style === 3) return seasonal(entry.ld_topics ?? entry.ld_topic);
  if (style === 4) return named(entry.ndt_topic_name, entry.ndt_topic_emoji, entry.ndt_topic);
  return [];
}

/** Longest a fallback short name runs before it is cut at a word. */
const SHORT_TOPIC_LENGTH = 28;

/**
 * A topic's short name: its curated title, or else the start of the
 * resolution (minus a leading "Resolved:") cut at a word boundary.
 */
export function shortTopicName(item: TopicItem, maxLength = SHORT_TOPIC_LENGTH): string {
  if (item.title) return item.title;
  const text = item.text.replace(/^\s*resolved\s*[:,]?\s*/i, "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > maxLength / 2 ? cut.slice(0, space) : cut.slice(0, maxLength)).replace(/[\s,;:.]+$/, "")}…`;
}

/**
 * The topics of the competition season ending in `seasonYear` for one
 * format. `debate-topics.json` keys a season by the year it starts, so the
 * "23-24" season (`seasonYear` 2024) reads the 2023 entry.
 */
export function getSeasonTopicItems(
  topics: DebateTopicYear[] | undefined,
  seasonYear: number | undefined,
  style: number | undefined,
): TopicItem[] {
  if (!topics || !seasonYear) return [];
  const entry = topics.find((t) => Number(t.year) === seasonYear - 1);
  return getStyleTopicItems(entry, style);
}
