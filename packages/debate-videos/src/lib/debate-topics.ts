/**
 * Formatters for `debate-topics.json`: yearly Policy/NDT resolutions plus
 * month-stamped LD/PF lists.
 */

export type SeasonalTopic = {
  start_month?: string;
  topic_name?: string;
  /** Icon shown beside `topic_name` (e.g. "🧊"). */
  emoji?: string;
  topic: string;
};

export type DebateTopicYear = {
  year: number | string;
  ndt_topic_name?: string;
  ndt_topic_emoji?: string;
  ndt_topic?: string;
  policy_topic_name?: string;
  policy_topic_emoji?: string;
  policy_topic?: string;
  ld_topics?: SeasonalTopic[];
  pf_topics?: SeasonalTopic[];
  /** Legacy single HTML string from older debate-topics.json. */
  ld_topic?: string;
  pf_topic?: string;
};

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
