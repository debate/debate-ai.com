/**
 * Formatters for `debate-topics.json`: yearly Policy/NDT resolutions plus
 * month-stamped LD/PF lists.
 */

export type SeasonalTopic = {
  start_month?: string;
  topic_name?: string;
  topic: string;
};

export type DebateTopicYear = {
  year: number | string;
  ndt_topic_name?: string;
  ndt_topic?: string;
  policy_topic_name?: string;
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
