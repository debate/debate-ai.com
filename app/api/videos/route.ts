import { NextResponse } from "next/server";
import rounds from "@/lib/debate-data/debate-rounds-videos.json";
import topPicks from "@/lib/debate-data/debate-top-picks.json";
import lectures from "@/lib/debate-data/debate-lectures.json";
import topics from "@/lib/debate-data/debate-topics.json";
import champions from "@/lib/debate-data/debate-champions.json";

function dedupeById<T extends [string, ...unknown[]]>(videos: T[]): T[] {
  const seen = new Set<string>();
  return videos.filter((v) => {
    if (seen.has(v[0])) return false;
    seen.add(v[0]);
    return true;
  });
}

function getDebateHistory() {
  const history: Record<
    string,
    Record<string, string | number | undefined>
  > = {};
  for (const entry of topics.data) {
    const { year, ...rest } = entry;
    history[String(year)] = { ...history[String(year)], ...rest };
  }
  for (const entry of champions.data) {
    const { year, ...rest } = entry;
    history[String(year)] = { ...history[String(year)], ...rest };
  }
  return history;
}

export async function GET() {
  const history = getDebateHistory();
  return NextResponse.json({
    rounds: dedupeById(rounds.data as [string, ...unknown[]][]),
    topPicks: topPicks.data,
    lectures: dedupeById(lectures.data as [string, ...unknown[]][]),
    topics: topics.data,
    champions: champions.data,
    history,
  });
}
