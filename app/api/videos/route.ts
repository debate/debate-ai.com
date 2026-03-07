import { NextResponse } from "next/server";
import rounds from "@/lib/debate-data/debate-rounds-videos.json";
import topPicks from "@/lib/debate-data/debate-top-picks.json";
import lectures from "@/lib/debate-data/debate-lectures.json";
import topics from "@/lib/debate-data/debate-topics.json";
import champions from "@/lib/debate-data/debate-champions.json";

function getDebateHistory() {
  const history: Record<
    string,
    Record<string, string | number | undefined>
  > = {};
  for (const entry of topics) {
    const { year, ...rest } = entry;
    history[String(year)] = { ...history[String(year)], ...rest };
  }
  for (const entry of champions) {
    const { year, ...rest } = entry;
    history[String(year)] = { ...history[String(year)], ...rest };
  }
  return history;
}

export async function GET() {
  const history = getDebateHistory();
  return NextResponse.json({
    rounds,
    topPicks,
    lectures,
    topics,
    champions,
    history,
  });
}
