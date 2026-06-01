import { NextResponse } from "next/server";
import namesData from "@/lib/card-parser/human-name/human-names-92k.json";

// Pre-sorted capitalized name list, built once at module load
const ALL_NAMES: string[] = Object.keys(namesData)
  .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
  .sort();

export async function GET() {
  return NextResponse.json({ names: ALL_NAMES });
}
