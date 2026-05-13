import { NextResponse } from "next/server";
import youtubeStats from "@/packages/debate-data-sync/data/metadata/youtube-stats.json";

export async function GET() {
  return NextResponse.json(youtubeStats);
}
