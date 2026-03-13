import type { TopicType } from "@/lib/types/videos"
import { DEBATE_STYLE_LABELS } from "@/lib/types/videos"

export const STYLE_COLORS: Record<number, string> = {
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  3: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  1: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
}

export function getRoundBadgeColor(roundLevel: string) {
  const round = roundLevel.toLowerCase().trim();
  if (round === "finals" || round === "final" || round === "champ" || round === "1st") {
    return "border-amber-400 bg-amber-400 text-amber-950 dark:border-amber-500 dark:bg-amber-600 dark:text-amber-50 hover:bg-amber-500 dark:hover:bg-amber-500";
  }
  if (round.includes("semi")) {
    return "border-yellow-400 bg-yellow-400 text-yellow-950 dark:border-yellow-500 dark:bg-yellow-500 dark:text-yellow-50 hover:bg-yellow-500 dark:hover:bg-yellow-400";
  }
  if (round.includes("quarter")) {
    return "border-yellow-300 bg-yellow-300 text-yellow-900 dark:border-yellow-400 dark:bg-yellow-400 dark:text-yellow-950 hover:bg-yellow-400 dark:hover:bg-yellow-300";
  }
  if (round.includes("octo")) {
    return "border-yellow-200 bg-yellow-200 text-yellow-800 dark:border-yellow-300 dark:bg-yellow-300 dark:text-yellow-900 hover:bg-yellow-300 dark:hover:bg-yellow-200";
  }
  if (round.includes("double") || round.includes("triple")) {
    return "border-yellow-100 bg-yellow-50 text-yellow-700 dark:border-yellow-200 dark:bg-yellow-100 dark:text-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-50";
  }
  return "border-amber-100 bg-amber-50/50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40";
}

export function getYearTopic(year: number, style: number | undefined, topics?: TopicType[]): string | undefined {
  if (!year || !topics) return undefined;
  const topicEntry = topics.find((t) => Number(t.year) === year);
  if (!topicEntry) return undefined;
  if (style === 1) return topicEntry.policy_topic;
  if (style === 2) return topicEntry.ld_topic;
  if (style === 3) return topicEntry.pf_topic;
  if (style === 4) return topicEntry.ndt_topic;
  return undefined;
}

export { DEBATE_STYLE_LABELS }