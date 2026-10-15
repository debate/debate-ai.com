import { NextResponse, type NextRequest } from "next/server";
import { getVideoStacks, MAX_STACK_KEYS } from "@/lib/videos/video-repository";

/**
 * Members of the stacked playlists currently on screen.
 *
 * `/api/videos` marks each row with the stack it belongs to but cannot carry
 * the other members: a round and the round-analysis video made from it are
 * pages apart in any ordering, and the analysis is usually filtered out of a
 * rounds view altogether. The grid therefore collects the stack keys of the
 * rows it loaded and resolves them here, which is what lets one card hold both
 * videos behind `<` / `>` arrows.
 *
 * Query parameters:
 * - `keys` — comma-separated stack keys, at most {@link MAX_STACK_KEYS}
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keys = (searchParams.get("keys") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
    .slice(0, MAX_STACK_KEYS);

  if (keys.length === 0) {
    return NextResponse.json({ stacks: {}, backend: "sql" });
  }

  try {
    return NextResponse.json(await getVideoStacks(keys));
  } catch (error) {
    console.error("Failed to load video stacks", error);
    return NextResponse.json({ error: "Failed to load video stacks" }, { status: 500 });
  }
}
