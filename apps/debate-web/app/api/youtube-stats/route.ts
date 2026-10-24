import { NextResponse } from "next/server";
import youtubeStats from "@debate-ai/data-sync/data/youtube-stats.json";

export async function GET() {
  return NextResponse.json(youtubeStats);
}
