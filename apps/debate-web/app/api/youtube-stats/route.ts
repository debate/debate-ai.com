import { NextResponse } from "next/server";
import youtubeStats from "@debate-ai/videos-admin/data/youtube-stats.json";

export async function GET() {
  return NextResponse.json(youtubeStats);
}
