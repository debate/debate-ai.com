import { NextResponse } from "next/server";
import { COMMON_HUMAN_NAMES } from "debate-card-parser/src/human-name/common-names";

// Pre-sorted capitalized name list, built once at module load
const ALL_NAMES: string[] = [...COMMON_HUMAN_NAMES]
  .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
  .sort();

export async function GET() {
  return NextResponse.json({ names: ALL_NAMES });
}
