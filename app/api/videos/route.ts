import { NextResponse } from "next/server";
import roundsPolicy from "@/lib/debate-data/debate-videos/rounds-policy.json";
import roundsPf from "@/lib/debate-data/debate-videos/rounds-pf.json";
import roundsLd from "@/lib/debate-data/debate-videos/rounds-ld.json";
import roundsCollege from "@/lib/debate-data/debate-videos/rounds-college.json";
import topPicks from "@/lib/debate-data/debate-videos/debate-top-picks.json";
import lectures from "@/lib/debate-data/debate-videos/debate-lectures.json";
import topics from "@/lib/debate-data/debate-metadata/debate-topics.json";
import champions from "@/lib/debate-data/debate-metadata/debate-champions.json";

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
    rounds: dedupeById([...roundsPolicy.data, ...roundsPf.data, ...roundsLd.data, ...roundsCollege.data] as [string, ...unknown[]][]),
    topPicks: topPicks.data,
    lectures: dedupeById(lectures.data as [string, ...unknown[]][]),
    topics: topics.data,
    champions: champions.data,
    history,
  });
}
